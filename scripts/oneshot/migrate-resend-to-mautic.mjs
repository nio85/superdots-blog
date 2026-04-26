#!/usr/bin/env node
/**
 * One-shot migration: Resend Audience contacts → Mautic
 * SUP-486
 *
 * Required env vars:
 *   RESEND_API_KEY         - Resend API key (to read contacts)
 *   RESEND_AUDIENCE_ID     - Resend Audience ID
 *   MAUTIC_API_URL         - e.g. https://mautic.bartoccini.cloud
 *   MAUTIC_USERNAME        - HTTP Basic Auth username
 *   MAUTIC_PASSWORD        - HTTP Basic Auth password
 *   CF_ACCESS_CLIENT_ID    - (optional) Cloudflare Access service token
 *   CF_ACCESS_CLIENT_SECRET - (optional)
 *
 * Usage:
 *   node scripts/oneshot/migrate-resend-to-mautic.mjs           # Full migration
 *   node scripts/oneshot/migrate-resend-to-mautic.mjs --dry-run  # Preview only
 */

import { config } from 'dotenv';
config();

const DRY_RUN = process.argv.includes('--dry-run');
const RATE_LIMIT_MS = 200; // 200ms between Mautic API calls (~5 req/s)

const {
  RESEND_API_KEY,
  RESEND_AUDIENCE_ID,
  MAUTIC_API_URL,
  MAUTIC_USERNAME,
  MAUTIC_PASSWORD,
  CF_ACCESS_CLIENT_ID,
  CF_ACCESS_CLIENT_SECRET,
} = process.env;

if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
  console.error('Missing: RESEND_API_KEY, RESEND_AUDIENCE_ID');
  process.exit(1);
}
if (!MAUTIC_API_URL || !MAUTIC_USERNAME || !MAUTIC_PASSWORD) {
  console.error('Missing: MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD');
  process.exit(1);
}

const mauticBase = MAUTIC_API_URL.replace(/\/$/, '');

function mauticHeaders() {
  const headers = {
    'Authorization': 'Basic ' + Buffer.from(`${MAUTIC_USERNAME}:${MAUTIC_PASSWORD}`).toString('base64'),
    'Content-Type': 'application/json',
  };
  if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = CF_ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = CF_ACCESS_CLIENT_SECRET;
  }
  return headers;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Resend API ───────────────────────────────────────────────────────────────

async function fetchResendContacts() {
  const contacts = [];
  let cursor = null;

  while (true) {
    const url = new URL(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`);
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
    });

    if (!res.ok) {
      console.error('Resend API error:', res.status, await res.text());
      break;
    }

    const data = await res.json();
    const items = data.data || [];
    contacts.push(...items);
    console.log(`  Fetched ${contacts.length} contacts from Resend...`);

    // Resend pagination: if fewer than page size, we're done
    if (items.length === 0 || !data.cursor) break;
    cursor = data.cursor;
  }

  return contacts;
}

// ── Mautic API ───────────────────────────────────────────────────────────────

async function searchMauticContact(email) {
  const res = await fetch(
    `${mauticBase}/api/contacts?search=email:${encodeURIComponent(email)}&limit=1`,
    { headers: mauticHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const contacts = data.contacts || {};
  const id = Object.keys(contacts)[0];
  return id ? { id, ...contacts[id] } : null;
}

async function upsertMauticContact(contactData) {
  const res = await fetch(`${mauticBase}/api/contacts/new`, {
    method: 'POST',
    headers: mauticHeaders(),
    body: JSON.stringify(contactData),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

// ── Mapping ──────────────────────────────────────────────────────────────────

function mapResendToMautic(resendContact) {
  const meta = resendContact.data || {};
  const isConfirmed = resendContact.unsubscribed === false;
  const isPending = resendContact.unsubscribed === true && meta.consent_pending === 'true';

  const mauticData = {
    email: resendContact.email,
    consent_status: isConfirmed ? 'confirmed' : 'pending',
    tags: isConfirmed ? ['newsletter', 'double-opt-in'] : ['newsletter-pending'],
  };

  if (meta.source) mauticData.signup_source = meta.source;
  if (meta.signup_ip) mauticData.signup_ip = meta.signup_ip;
  if (meta.signup_timestamp) mauticData.signup_timestamp = meta.signup_timestamp;
  if (meta.confirmed_at) mauticData.confirmed_at = meta.confirmed_at;
  if (meta.confirmed_ip) mauticData.confirmed_ip = meta.confirmed_ip;

  return { mauticData, isConfirmed, isPending };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Resend → Mautic Migration${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log('='.repeat(50));

  // 1. Fetch all Resend contacts
  console.log('\n1. Fetching contacts from Resend...');
  const resendContacts = await fetchResendContacts();
  console.log(`   Total: ${resendContacts.length} contacts\n`);

  if (resendContacts.length === 0) {
    console.log('No contacts to migrate.');
    return;
  }

  // 2. Stats
  const stats = { total: resendContacts.length, created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors = [];

  // 3. Migrate each contact
  console.log('2. Migrating contacts...');
  for (let i = 0; i < resendContacts.length; i++) {
    const rc = resendContacts[i];
    const { mauticData, isConfirmed } = mapResendToMautic(rc);
    const status = isConfirmed ? 'confirmed' : 'pending';
    const label = `[${i + 1}/${resendContacts.length}] ${rc.email} (${status})`;

    if (DRY_RUN) {
      console.log(`  ${label} → would upsert`);
      stats.created++;
      continue;
    }

    try {
      // Check if already in Mautic
      const existing = await searchMauticContact(rc.email);
      await sleep(RATE_LIMIT_MS);

      if (existing) {
        // Update with any missing fields
        const result = await upsertMauticContact(mauticData);
        await sleep(RATE_LIMIT_MS);
        if (result.ok) {
          console.log(`  ${label} → updated`);
          stats.updated++;
        } else {
          console.error(`  ${label} → update FAILED: ${result.status}`);
          errors.push({ email: rc.email, error: `update failed: ${result.status}` });
          stats.errors++;
        }
      } else {
        // Create new contact
        const result = await upsertMauticContact(mauticData);
        await sleep(RATE_LIMIT_MS);
        if (result.ok) {
          console.log(`  ${label} → created`);
          stats.created++;
        } else {
          console.error(`  ${label} → create FAILED: ${result.status}`);
          errors.push({ email: rc.email, error: `create failed: ${result.status}` });
          stats.errors++;
        }
      }
    } catch (err) {
      console.error(`  ${label} → ERROR: ${err.message}`);
      errors.push({ email: rc.email, error: err.message });
      stats.errors++;
    }
  }

  // 4. Report
  console.log('\n' + '='.repeat(50));
  console.log('Migration Report');
  console.log('='.repeat(50));
  console.log(`  Total contacts:  ${stats.total}`);
  console.log(`  Created:         ${stats.created}`);
  console.log(`  Updated:         ${stats.updated}`);
  console.log(`  Skipped:         ${stats.skipped}`);
  console.log(`  Errors:          ${stats.errors}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const e of errors) {
      console.log(`  - ${e.email}: ${e.error}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n(DRY RUN — no changes were made)');
  }

  console.log('\nNote: Resend contacts were NOT deleted. Run cleanup separately if needed.');

  if (stats.errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
