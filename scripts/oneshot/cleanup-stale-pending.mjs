#!/usr/bin/env node
/**
 * Cleanup stale pending contacts (GDPR Art. 5(1)(e) — storage limitation)
 * SUP-494
 *
 * Contacts with consent_status=pending older than 30 days are hard-deleted
 * from Mautic. Confirmation tokens expire after 7 days; 30 days is a
 * generous buffer before cleanup.
 *
 * After each run, sends a report email to the configured recipient.
 *
 * Required env vars:
 *   MAUTIC_API_URL          - e.g. https://mautic.bartoccini.cloud
 *   MAUTIC_USERNAME         - HTTP Basic Auth username
 *   MAUTIC_PASSWORD         - HTTP Basic Auth password
 *   RESEND_SMTP_API_KEY     - Resend SMTP key for email report
 *   CF_ACCESS_CLIENT_ID     - (optional) Cloudflare Access service token
 *   CF_ACCESS_CLIENT_SECRET - (optional)
 *
 * Usage:
 *   node scripts/cleanup-stale-pending.mjs            # Delete stale contacts + send report
 *   node scripts/cleanup-stale-pending.mjs --dry-run   # Preview only (no email)
 */

import { config } from 'dotenv';
import { createTransport } from 'nodemailer';
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
  RESEND_SMTP_API_KEY,
} = process.env;

const MAIL_FROM = process.env.MAIL_FROM || 'notifications@superdots.sh';
const TO_EMAIL = process.env.TO_EMAIL || 'lucavittorio.bartoccini@gmail.com';

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

const REQUEST_TIMEOUT_MS = 30_000; // 30s per request — prevents infinite hang if Mautic is unresponsive

async function mauticApi(method, path, body) {
  const url = `${baseUrl}${path}`;
  const opts = { method, headers: buildHeaders() };
  if (body) opts.body = JSON.stringify(body);

  const controller = new AbortController();
  // Timer covers both the fetch() connection AND res.text() body read.
  // Cleared and re-set after headers arrive so each phase gets the full timeout budget.
  let timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });

    // Headers received — reset timer to cover body read as well
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      return { ok: false, status: res.status, data };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${method} ${path}`);
      return { ok: false, status: 0, data: 'timeout' };
    }
    console.error(`Request failed: ${method} ${path}`, err.message);
    return { ok: false, status: 0, data: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - RETENTION_DAYS);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function fetchTotalContacts() {
  const res = await mauticApi('GET', '/api/contacts?limit=1');
  if (res.ok && res.data?.total != null) return parseInt(res.data.total, 10);
  return -1;
}

async function fetchPendingCount() {
  const res = await mauticApi('GET', `/api/contacts?search=${encodeURIComponent('consent_status:pending')}&limit=1`);
  if (res.ok && res.data?.total != null) return parseInt(res.data.total, 10);
  return -1;
}

async function fetchConfirmedCount() {
  const res = await mauticApi('GET', `/api/contacts?search=${encodeURIComponent('consent_status:confirmed')}&limit=1`);
  if (res.ok && res.data?.total != null) return parseInt(res.data.total, 10);
  return -1;
}

async function fetchStalePending() {
  const cutoff = cutoffDate();
  // Mautic search: consent_status=pending AND date_added before cutoff
  const search = `consent_status:pending date_added:<${cutoff}`;
  const contacts = [];
  let start = 0;
  let aborted = false;

  while (true) {
    const path = `/api/contacts?search=${encodeURIComponent(search)}&limit=${PAGE_LIMIT}&start=${start}&orderBy=date_added&orderByDir=asc`;
    const res = await mauticApi('GET', path);

    if (!res.ok) {
      const reason = res.status === 0 ? `Mautic unreachable (${res.data})` : `HTTP ${res.status}`;
      console.error(`Failed to fetch contacts (start=${start}): ${reason}`);
      aborted = true;
      break;
    }

    if (typeof res.data !== 'object' || !res.data.contacts) {
      console.error('Unexpected API response (possible CF Access block). Check CF_ACCESS_CLIENT_ID/SECRET.');
      console.error('Response:', typeof res.data === 'string' ? res.data.substring(0, 200) : JSON.stringify(res.data).substring(0, 200));
      aborted = true;
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

  return { contacts, aborted };
}

async function deleteContact(contactId) {
  return mauticApi('DELETE', `/api/contacts/${contactId}/delete`);
}

async function sendReport(report) {
  if (!RESEND_SMTP_API_KEY) {
    console.warn('No RESEND_SMTP_API_KEY — skipping email report');
    return;
  }

  const transport = createTransport({
    host: 'smtp.resend.com',
    port: 587,
    secure: false,
    auth: { user: 'resend', pass: RESEND_SMTP_API_KEY },
  });

  const isPartialAbort = report.aborted && report.staleFound > 0;
  const isFullAbort = report.aborted && report.staleFound === 0 && report.totalContacts === -1;
  const statusEmoji = isFullAbort ? '🔴' : (isPartialAbort || report.errors > 0 ? '⚠️' : (report.deleted > 0 ? '🧹' : '✅'));
  const abortedNote = isFullAbort ? ' [MAUTIC UNREACHABLE]' : isPartialAbort ? ' [PARTIAL — MAUTIC TIMEOUT]' : '';
  const totalDisplay = report.totalContacts === -1 ? 'N/A' : report.totalContacts;
  const subject = `${statusEmoji} GDPR Cleanup: ${report.deleted} deleted, ${report.staleFound} stale, ${totalDisplay} total${abortedNote}`;

  let html = `<h2>GDPR Stale Pending Contact Cleanup</h2>`;
  html += `<p><strong>Date:</strong> ${new Date().toISOString().split('T')[0]}</p>`;
  html += `<p><strong>Cutoff:</strong> ${report.cutoff} (${RETENTION_DAYS} days)</p>`;
  html += `<hr>`;
  html += `<h3>Summary</h3>`;
  html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">`;
  html += `<tr><td><strong>Total contacts in Mautic</strong></td><td>${report.totalContacts}</td></tr>`;
  html += `<tr><td><strong>Confirmed subscribers</strong></td><td>${report.confirmedCount}</td></tr>`;
  html += `<tr><td><strong>Pending contacts (all)</strong></td><td>${report.pendingCount}</td></tr>`;
  html += `<tr><td><strong>Stale pending (> ${RETENTION_DAYS} days)</strong></td><td>${report.staleFound}</td></tr>`;
  html += `<tr><td><strong>Deleted</strong></td><td>${report.deleted}</td></tr>`;
  html += `<tr><td><strong>Errors</strong></td><td>${report.errors}</td></tr>`;
  html += `</table>`;

  if (report.deletedContacts.length > 0) {
    html += `<h3>Deleted Contacts</h3><ul>`;
    for (const c of report.deletedContacts) {
      html += `<li><code>${c.email}</code> (id: ${c.id}, added: ${c.dateAdded})</li>`;
    }
    html += `</ul>`;
  }

  if (report.failedContacts.length > 0) {
    html += `<h3>⚠️ Failed Deletions</h3><ul>`;
    for (const c of report.failedContacts) {
      html += `<li><code>${c.email}</code> (id: ${c.id}) — ${c.error}</li>`;
    }
    html += `</ul>`;
  }

  if (report.staleFound === 0) {
    html += `<p>No stale pending contacts found. Nothing to clean up.</p>`;
  }

  html += `<hr><p style="color:#888;font-size:12px;">Automated GDPR cleanup — Superdots</p>`;

  await transport.sendMail({
    from: MAIL_FROM,
    to: TO_EMAIL,
    subject,
    html,
  });

  console.log(`Report email sent to ${TO_EMAIL}`);
}

async function main() {
  console.log(`=== Stale Pending Contact Cleanup ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Retention: ${RETENTION_DAYS} days`);
  console.log(`Cutoff: ${cutoffDate()}`);
  console.log(`Mautic: ${baseUrl}`);
  console.log('');

  // Gather DB stats
  const [totalContacts, pendingCount, confirmedCount] = await Promise.all([
    fetchTotalContacts(),
    fetchPendingCount(),
    fetchConfirmedCount(),
  ]);

  console.log(`Total contacts: ${totalContacts}`);
  console.log(`Confirmed: ${confirmedCount}`);
  console.log(`Pending: ${pendingCount}`);
  console.log('');

  const { contacts, aborted } = await fetchStalePending();
  console.log(`Found ${contacts.length} stale pending contact(s)${aborted ? ' (fetch aborted — Mautic unreachable or timed out)' : ''}`);

  const report = {
    cutoff: cutoffDate(),
    totalContacts,
    pendingCount,
    confirmedCount,
    staleFound: contacts.length,
    deleted: 0,
    errors: 0,
    deletedContacts: [],
    failedContacts: [],
    aborted,
  };

  if (aborted && contacts.length === 0) {
    console.log('Aborting — Mautic unreachable. Sending error report.');
    if (!DRY_RUN) await sendReport(report);
    return;
  }

  if (contacts.length === 0) {
    console.log('Nothing to clean up.');
    if (!DRY_RUN) await sendReport(report);
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

  for (const c of contacts) {
    const res = await deleteContact(c.id);
    if (res.ok) {
      report.deleted++;
      report.deletedContacts.push(c);
      console.log(`  Deleted [${c.id}] ${c.email}`);
    } else {
      report.errors++;
      report.failedContacts.push({ ...c, error: `${res.status} ${JSON.stringify(res.data)}` });
      console.error(`  Failed [${c.id}] ${c.email}: ${res.status}`, res.data);
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nDone. Deleted: ${report.deleted}, Errors: ${report.errors}`);
  await sendReport(report);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
