#!/usr/bin/env node
/**
 * Mautic Custom Fields & Segments Setup Script
 * SUP-482: Creates all custom fields needed for the newsletter double opt-in flow
 *
 * Required env vars:
 *   MAUTIC_API_URL        - e.g. https://mautic.bartoccini.cloud
 *   MAUTIC_USERNAME       - HTTP Basic Auth username
 *   MAUTIC_PASSWORD       - HTTP Basic Auth password
 *   CF_ACCESS_CLIENT_ID   - (optional) Cloudflare Access service token
 *   CF_ACCESS_CLIENT_SECRET - (optional) Cloudflare Access service token
 *
 * Usage:
 *   MAUTIC_API_URL=... MAUTIC_USERNAME=... MAUTIC_PASSWORD=... node scripts/oneshot/mautic-setup-fields.mjs
 */

import { config } from 'dotenv';
config();

const {
  MAUTIC_API_URL,
  MAUTIC_USERNAME,
  MAUTIC_PASSWORD,
  CF_ACCESS_CLIENT_ID,
  CF_ACCESS_CLIENT_SECRET,
} = process.env;

if (!MAUTIC_API_URL || !MAUTIC_USERNAME || !MAUTIC_PASSWORD) {
  console.error('Missing required env vars: MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD');
  process.exit(1);
}

const baseUrl = MAUTIC_API_URL.replace(/\/$/, '');

function buildHeaders() {
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

async function mauticApi(method, path, body) {
  const url = `${baseUrl}${path}`;
  const opts = { method, headers: buildHeaders() };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    return { ok: false, status: res.status, data };
  }
  return { ok: true, status: res.status, data };
}

// ── Custom Fields to Create ──────────────────────────────────────────────────

const CUSTOM_FIELDS = [
  {
    alias: 'consent_status',
    label: 'Consent Status',
    type: 'select',
    properties: {
      list: [
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
      ],
    },
    group: 'core', // contact group
    object: 'lead',
    description: 'Newsletter double opt-in consent status (pending/confirmed)',
  },
  {
    alias: 'signup_source',
    label: 'Signup Source',
    type: 'text',
    group: 'core',
    object: 'lead',
    description: 'Source of the newsletter signup (banner, inline, hero, midpost, compact)',
  },
  {
    alias: 'signup_ip',
    label: 'Signup IP',
    type: 'text',
    group: 'core',
    object: 'lead',
    description: 'IP address at the time of signup',
  },
  {
    alias: 'signup_timestamp',
    label: 'Signup Timestamp',
    type: 'datetime',
    group: 'core',
    object: 'lead',
    description: 'Timestamp of the newsletter signup',
  },
  {
    alias: 'confirmed_at',
    label: 'Confirmed At',
    type: 'datetime',
    group: 'core',
    object: 'lead',
    description: 'Timestamp of the double opt-in confirmation',
  },
  {
    alias: 'confirmed_ip',
    label: 'Confirmed IP',
    type: 'text',
    group: 'core',
    object: 'lead',
    description: 'IP address at the time of confirmation',
  },
];

// ── Segments to Create ───────────────────────────────────────────────────────

const SEGMENTS = [
  {
    name: 'Newsletter Subscribers',
    alias: 'newsletter-subscribers',
    description: 'Confirmed subscribers — the ONLY segment for newsletter sends',
    isPublished: true,
    filters: [
      {
        glue: 'and',
        field: 'consent_status',
        object: 'lead',
        type: 'select',
        operator: '=',
        filter: 'confirmed',
        display: null,
      },
    ],
  },
  {
    name: 'Pending Confirmation',
    alias: 'pending-confirmation',
    description: 'Contacts who signed up but have not yet confirmed',
    isPublished: true,
    filters: [
      {
        glue: 'and',
        field: 'consent_status',
        object: 'lead',
        type: 'select',
        operator: '=',
        filter: 'pending',
        display: null,
      },
    ],
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function getExistingFields() {
  const res = await mauticApi('GET', '/api/contacts/list/fields');
  if (!res.ok) {
    console.error('Failed to fetch existing fields:', res.data);
    return [];
  }
  // Mautic returns fields as an object keyed by ID or an array
  const fields = Array.isArray(res.data) ? res.data : Object.values(res.data);
  return fields.map(f => f.alias).filter(Boolean);
}

async function getExistingSegments() {
  const res = await mauticApi('GET', '/api/segments?limit=100');
  if (!res.ok) {
    console.error('Failed to fetch existing segments:', res.data);
    return [];
  }
  const lists = res.data.lists || {};
  return Object.values(lists).map(s => s.alias).filter(Boolean);
}

async function createField(field) {
  const existing = await getExistingFields();
  if (existing.includes(field.alias)) {
    console.log(`  ✓ Field "${field.alias}" already exists — skipping`);
    return true;
  }

  const res = await mauticApi('POST', '/api/fields/contact/new', field);
  if (res.ok) {
    console.log(`  ✓ Created field "${field.alias}"`);
    return true;
  }
  // 400 with "already exists" is also OK
  if (res.status === 400 && JSON.stringify(res.data).includes('already exists')) {
    console.log(`  ✓ Field "${field.alias}" already exists — skipping`);
    return true;
  }
  console.error(`  ✗ Failed to create field "${field.alias}":`, res.data);
  return false;
}

async function createSegment(segment) {
  const existing = await getExistingSegments();
  if (existing.includes(segment.alias)) {
    console.log(`  ✓ Segment "${segment.alias}" already exists — skipping`);
    return true;
  }

  const res = await mauticApi('POST', '/api/segments/new', segment);
  if (res.ok) {
    console.log(`  ✓ Created segment "${segment.name}"`);
    return true;
  }
  console.error(`  ✗ Failed to create segment "${segment.name}":`, res.data);
  return false;
}

async function main() {
  console.log(`Mautic setup: ${baseUrl}\n`);

  // 1. Test connectivity
  console.log('Testing API connectivity...');
  const ping = await mauticApi('GET', '/api/contacts?limit=1');
  if (!ping.ok) {
    console.error('Cannot connect to Mautic API:', ping.status, ping.data);
    process.exit(1);
  }
  console.log('  ✓ Connected to Mautic API\n');

  // 2. Create custom fields
  console.log('Creating custom fields...');
  let allOk = true;
  for (const field of CUSTOM_FIELDS) {
    const ok = await createField(field);
    if (!ok) allOk = false;
  }
  console.log();

  // 3. Create segments
  console.log('Creating segments...');
  for (const segment of SEGMENTS) {
    const ok = await createSegment(segment);
    if (!ok) allOk = false;
  }
  console.log();

  // 4. Summary
  if (allOk) {
    console.log('All fields and segments created successfully.');
    console.log('\n── Field Mapping (Resend → Mautic) ──');
    console.log('  Resend data.source          → signup_source');
    console.log('  Resend data.signup_ip        → signup_ip');
    console.log('  Resend data.signup_timestamp  → signup_timestamp');
    console.log('  Resend data.consent_pending   → consent_status (pending/confirmed)');
    console.log('  Resend data.confirmed_at      → confirmed_at');
    console.log('  Resend data.confirmed_ip      → confirmed_ip');
    console.log('  Resend unsubscribed=true/false → consent_status + DNC flag');
  } else {
    console.error('Some operations failed — check errors above.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
