#!/usr/bin/env node
/**
 * Cleanup stale pending contacts (GDPR Art. 5(1)(e) — storage limitation)
 * SUP-494
 *
 * Contacts with consent_status=pending older than 30 days are hard-deleted
 * from Mautic. Confirmation tokens expire after 7 days; 30 days is a
 * generous buffer before cleanup.
 *
 * Required env vars:
 *   MAUTIC_API_URL          - e.g. https://mautic.bartoccini.cloud
 *   MAUTIC_USERNAME         - HTTP Basic Auth username
 *   MAUTIC_PASSWORD         - HTTP Basic Auth password
 *   CF_ACCESS_CLIENT_ID     - (optional) Cloudflare Access service token
 *   CF_ACCESS_CLIENT_SECRET - (optional)
 *
 * Usage:
 *   node scripts/cleanup-stale-pending.mjs            # Delete stale contacts
 *   node scripts/cleanup-stale-pending.mjs --dry-run   # Preview only
 */

import { config } from 'dotenv';
config();

const DRY_RUN = process.argv.includes('--dry-run');
const RATE_LIMIT_MS = 200;
const RETENTION_DAYS = 30;
const PAGE_LIMIT = 100;

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - RETENTION_DAYS);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function fetchStalePending() {
  const cutoff = cutoffDate();
  // Mautic search: consent_status=pending AND date_added before cutoff
  const search = `consent_status:pending date_added:!${cutoff}`;
  const contacts = [];
  let start = 0;

  while (true) {
    const path = `/api/contacts?search=${encodeURIComponent(search)}&limit=${PAGE_LIMIT}&start=${start}&orderBy=date_added&orderByDir=asc`;
    const res = await mauticApi('GET', path);

    if (!res.ok) {
      console.error(`Failed to fetch contacts (start=${start}):`, res.status, res.data);
      break;
    }

    const batch = res.data.contacts;
    if (!batch || typeof batch !== 'object') break;

    const entries = Object.values(batch);
    if (entries.length === 0) break;

    for (const c of entries) {
      contacts.push({
        id: c.id,
        email: c.fields?.all?.email || c.fields?.core?.email?.value || 'unknown',
        dateAdded: c.dateAdded,
        consentStatus: c.fields?.all?.consent_status || c.fields?.core?.consent_status?.value || 'unknown',
      });
    }

    start += PAGE_LIMIT;
    if (entries.length < PAGE_LIMIT) break;
    await sleep(RATE_LIMIT_MS);
  }

  return contacts;
}

async function deleteContact(contactId) {
  return mauticApi('DELETE', `/api/contacts/${contactId}/delete`);
}

async function main() {
  console.log(`=== Stale Pending Contact Cleanup ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Retention: ${RETENTION_DAYS} days`);
  console.log(`Cutoff: ${cutoffDate()}`);
  console.log(`Mautic: ${baseUrl}`);
  console.log('');

  const contacts = await fetchStalePending();
  console.log(`Found ${contacts.length} stale pending contact(s)`);

  if (contacts.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nWould delete:');
    for (const c of contacts) {
      console.log(`  - [${c.id}] ${c.email} (added: ${c.dateAdded})`);
    }
    console.log(`\nTotal: ${contacts.length} contact(s) would be deleted.`);
    return;
  }

  let deleted = 0;
  let errors = 0;

  for (const c of contacts) {
    const res = await deleteContact(c.id);
    if (res.ok) {
      deleted++;
      console.log(`  Deleted [${c.id}] ${c.email}`);
    } else {
      errors++;
      console.error(`  Failed [${c.id}] ${c.email}: ${res.status}`, res.data);
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nDone. Deleted: ${deleted}, Errors: ${errors}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
