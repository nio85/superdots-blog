#!/usr/bin/env node
/**
 * E2E Newsletter Flow Test — Post-Mautic Migration (SUP-487)
 *
 * Tests the full subscribe → confirm → unsubscribe flow against the live site.
 * Also performs code-level regression checks (no Resend Audience references).
 *
 * Usage:
 *   node scripts/test-newsletter-e2e.mjs [--live]
 *
 * Without --live: runs code-analysis tests only (safe, no side effects)
 * With --live:    also hits https://superdots.sh/api/* endpoints
 */

import { readFileSync } from 'fs';
import { createHmac } from 'crypto';

const SITE_URL = 'https://superdots.sh';
const TEST_EMAIL = `e2e-test-${Date.now()}@superdots-test.invalid`;
const LIVE_MODE = process.argv.includes('--live');

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed++;
  console.error(`  ✗ ${name}`);
  if (detail) console.error(`    → ${detail}`);
}

function skip(name) {
  skipped++;
  console.log(`  ○ ${name} (skipped — use --live)`);
}

// --- Code Regression Tests ---

function testCodeRegression() {
  console.log('\n── Code Regression: No Resend Audience References ──\n');

  const workers = [
    'functions/api/subscribe.js',
    'functions/api/confirm.js',
    'functions/api/unsubscribe.js',
  ];

  const bannedPatterns = [
    { regex: /audiences\//i, desc: 'Resend Audience API path (audiences/)' },
    { regex: /RESEND_AUDIENCE_ID/i, desc: 'RESEND_AUDIENCE_ID env var' },
    { regex: /addContact|removeContact/i, desc: 'Resend Audience addContact/removeContact' },
    { regex: /api\.resend\.com\/audiences/i, desc: 'Resend Audience endpoint' },
  ];

  for (const file of workers) {
    const code = readFileSync(file, 'utf-8');

    for (const { regex, desc } of bannedPatterns) {
      if (regex.test(code)) {
        fail(`${file}: still references ${desc}`);
      } else {
        ok(`${file}: no ${desc}`);
      }
    }
  }

  // Verify Mautic integration is present
  console.log('\n── Code Check: Mautic Integration Present ──\n');

  const subscribeCode = readFileSync('functions/api/subscribe.js', 'utf-8');
  const confirmCode = readFileSync('functions/api/confirm.js', 'utf-8');
  const unsubCode = readFileSync('functions/api/unsubscribe.js', 'utf-8');

  const mauticChecks = [
    [subscribeCode, 'subscribe.js', 'MAUTIC_API_URL', /MAUTIC_API_URL/],
    [subscribeCode, 'subscribe.js', 'consent_status: pending', /consent_status.*pending/],
    [subscribeCode, 'subscribe.js', 'signup_source field', /signup_source/],
    [subscribeCode, 'subscribe.js', 'signup_ip field', /signup_ip/],
    [subscribeCode, 'subscribe.js', 'signup_timestamp field', /signup_timestamp/],
    [confirmCode, 'confirm.js', 'consent_status: confirmed', /consent_status.*confirmed/],
    [confirmCode, 'confirm.js', 'confirmed_at field', /confirmed_at/],
    [confirmCode, 'confirm.js', 'confirmed_ip field', /confirmed_ip/],
    [confirmCode, 'confirm.js', 'newsletter tag added', /tags.*newsletter/],
    [confirmCode, 'confirm.js', 'newsletter-pending tag removed', /-newsletter-pending/],
    [unsubCode, 'unsubscribe.js', 'Mautic contact search', /\/api\/contacts\?search/],
    [unsubCode, 'unsubscribe.js', 'Mautic hard delete', /\/delete/],
  ];

  for (const [code, file, desc, regex] of mauticChecks) {
    if (regex.test(code)) {
      ok(`${file}: has ${desc}`);
    } else {
      fail(`${file}: missing ${desc}`);
    }
  }

  // Verify env var requirements
  console.log('\n── Code Check: Required Env Vars ──\n');

  const envChecks = [
    [subscribeCode, 'subscribe.js', ['RESEND_API_KEY', 'NEWSLETTER_SECRET', 'MAUTIC_API_URL', 'MAUTIC_USERNAME', 'MAUTIC_PASSWORD']],
    [confirmCode, 'confirm.js', ['NEWSLETTER_SECRET', 'MAUTIC_API_URL', 'MAUTIC_USERNAME', 'MAUTIC_PASSWORD']],
    [unsubCode, 'unsubscribe.js', ['NEWSLETTER_SECRET', 'MAUTIC_API_URL', 'MAUTIC_USERNAME', 'MAUTIC_PASSWORD']],
  ];

  for (const [code, file, vars] of envChecks) {
    const missing = vars.filter(v => !code.includes(v));
    if (missing.length === 0) {
      ok(`${file}: checks all required env vars (${vars.join(', ')})`);
    } else {
      fail(`${file}: missing env var checks for ${missing.join(', ')}`);
    }
  }

  // Verify RESEND_AUDIENCE_ID is NOT required
  for (const file of workers) {
    const code = readFileSync(file, 'utf-8');
    if (!code.includes('RESEND_AUDIENCE_ID')) {
      ok(`${file}: RESEND_AUDIENCE_ID not required`);
    } else {
      fail(`${file}: still requires RESEND_AUDIENCE_ID`);
    }
  }
}

// --- HMAC Token Helpers (mirror worker logic) ---

function createConfirmToken(email, timestamp, secret) {
  return createHmac('sha256', secret)
    .update(`${email}:${timestamp}:confirm`)
    .digest('hex');
}

function createUnsubscribeToken(email, secret) {
  return createHmac('sha256', secret)
    .update(`${email}:unsubscribe`)
    .digest('hex');
}

// --- Live API Tests ---

async function testLiveEndpoints() {
  console.log('\n── Live API Tests ──\n');
  console.log(`  Test email: ${TEST_EMAIL}`);
  console.log(`  Target: ${SITE_URL}\n`);

  // 1. Subscribe — happy path
  {
    const res = await fetch(`${SITE_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, source: 'e2e-test' }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      ok('POST /api/subscribe — new email accepted (200)');
    } else {
      fail(`POST /api/subscribe — expected 200 ok, got ${res.status}`, JSON.stringify(data));
    }
  }

  // 2. Subscribe — duplicate (should be idempotent)
  {
    const res = await fetch(`${SITE_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, source: 'e2e-test-dup' }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      ok('POST /api/subscribe — duplicate email is idempotent (200)');
    } else {
      fail(`POST /api/subscribe duplicate — expected 200, got ${res.status}`, JSON.stringify(data));
    }
  }

  // 3. Subscribe — invalid email
  {
    const res = await fetch(`${SITE_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', source: 'test' }),
    });
    if (res.status === 400) {
      ok('POST /api/subscribe — invalid email rejected (400)');
    } else {
      fail(`POST /api/subscribe invalid — expected 400, got ${res.status}`);
    }
  }

  // 4. Subscribe — missing body
  {
    const res = await fetch(`${SITE_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.status === 400) {
      ok('POST /api/subscribe — empty body rejected (400)');
    } else {
      fail(`POST /api/subscribe empty — expected 400, got ${res.status}`);
    }
  }

  // 5. Confirm — invalid token
  {
    const res = await fetch(`${SITE_URL}/api/confirm?email=${encodeURIComponent(TEST_EMAIL)}&ts=${Date.now()}&token=invalid`, {
      redirect: 'manual',
    });
    const body = await res.text();
    if (body.includes('Invalid confirmation link') || body.includes('Oops')) {
      ok('GET /api/confirm — invalid token shows error page');
    } else {
      fail('GET /api/confirm invalid token — expected error page');
    }
  }

  // 6. Confirm — expired token (timestamp > 7 days ago)
  {
    const oldTs = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
    const res = await fetch(`${SITE_URL}/api/confirm?email=${encodeURIComponent(TEST_EMAIL)}&ts=${oldTs}&token=somehex`, {
      redirect: 'manual',
    });
    const body = await res.text();
    if (body.includes('expired') || body.includes('Oops')) {
      ok('GET /api/confirm — expired token shows expiry message');
    } else {
      fail('GET /api/confirm expired — expected expiry error page');
    }
  }

  // 7. Unsubscribe — invalid token
  {
    const res = await fetch(`${SITE_URL}/api/unsubscribe?email=${encodeURIComponent(TEST_EMAIL)}&token=badtoken`, {
      redirect: 'manual',
    });
    const body = await res.text();
    if (body.includes('Invalid unsubscribe link') || body.includes('Oops')) {
      ok('GET /api/unsubscribe — invalid token shows error page');
    } else {
      fail('GET /api/unsubscribe invalid token — expected error page');
    }
  }

  // 8. CORS preflight on subscribe
  {
    const res = await fetch(`${SITE_URL}/api/subscribe`, {
      method: 'OPTIONS',
    });
    const acam = res.headers.get('access-control-allow-methods') || '';
    if (res.status === 204 && acam.includes('POST')) {
      ok('OPTIONS /api/subscribe — CORS preflight returns 204 with POST allowed');
    } else {
      fail(`OPTIONS /api/subscribe — expected 204 + CORS, got ${res.status}`);
    }
  }

  // Note: we can't test successful confirm/unsubscribe without NEWSLETTER_SECRET
  console.log('\n  ℹ  Cannot test valid confirm/unsubscribe tokens without NEWSLETTER_SECRET.');
  console.log('     The token HMAC is server-side only. Manual verify: check Mautic dashboard.\n');
}

// --- Mautic Field Verification ---

function testSetupScript() {
  console.log('\n── Setup Script Check ──\n');

  const setupCode = readFileSync('scripts/mautic-setup-fields.mjs', 'utf-8');

  const expectedFields = [
    'consent_status',
    'signup_source',
    'signup_ip',
    'signup_timestamp',
    'confirmed_at',
    'confirmed_ip',
  ];

  for (const field of expectedFields) {
    if (setupCode.includes(field)) {
      ok(`Setup script defines field: ${field}`);
    } else {
      fail(`Setup script missing field: ${field}`);
    }
  }

  // Check segments
  if (setupCode.includes('Confirmed Subscribers')) {
    ok('Setup script defines "Confirmed Subscribers" segment');
  } else {
    fail('Setup script missing "Confirmed Subscribers" segment');
  }

  if (setupCode.includes('Pending Confirmation')) {
    ok('Setup script defines "Pending Confirmation" segment');
  } else {
    fail('Setup script missing "Pending Confirmation" segment');
  }
}

// --- Migration Script Check ---

function testMigrationScript() {
  console.log('\n── Migration Script Check ──\n');

  const migCode = readFileSync('scripts/migrate-resend-to-mautic.mjs', 'utf-8');

  const checks = [
    ['--dry-run support', /dry.?run/i],
    ['Resend Audience read', /audiences/i],
    ['Mautic upsert', /contacts\/new|contacts/i],
    ['consent_status mapping', /consent_status/],
    ['Rate limiting', /200|delay|sleep|setTimeout/i],
  ];

  for (const [desc, regex] of checks) {
    if (regex.test(migCode)) {
      ok(`Migration script has ${desc}`);
    } else {
      fail(`Migration script missing ${desc}`);
    }
  }
}

// --- Main ---

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Newsletter E2E Test — Post-Mautic Migration    ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Mode: ${LIVE_MODE ? 'LIVE (hitting superdots.sh)' : 'CODE-ONLY (no network calls)'}`);

  testCodeRegression();
  testSetupScript();
  testMigrationScript();

  if (LIVE_MODE) {
    await testLiveEndpoints();
  } else {
    console.log('\n── Live API Tests ──\n');
    skip('Live endpoint tests');
  }

  // Summary
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('══════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
