#!/usr/bin/env node
/**
 * Umami Analytics API wrapper
 *
 * Interacts with Umami (localhost:3001) for web analytics data.
 * Auth: Bearer token from UMAMI_API_TOKEN env var.
 *
 * Usage:
 *   node scripts/tools/umami.mjs <command> [options]
 */

import '../config.mjs';

const UMAMI_URL = process.env.UMAMI_API_URL || 'http://localhost:3001';
const UMAMI_TOKEN = process.env.UMAMI_API_TOKEN;
const WEBSITE_ID = process.env.UMAMI_WEBSITE_ID;

const HELP = `Usage: node umami.mjs <command> [options]

Commands:
  stats [--days N]           Site stats summary (default: last 7 days)
  pageviews [--days N]       Pageview time series (daily)
  top-pages [--days N]       Top pages by views
  referrers [--days N]       Top referrers
  browsers [--days N]        Browser breakdown
  countries [--days N]       Country breakdown
  devices [--days N]         Device breakdown
  active                     Currently active visitors

Options:
  --json         Output as JSON
  --days <n>     Lookback period in days (default 7)
  --site <id>    Website UUID (default from UMAMI_WEBSITE_ID env)
  --help         Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));

function getOpt(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : null;
}

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

if (!UMAMI_TOKEN) err('Missing env var UMAMI_API_TOKEN. Create an API key in Umami admin UI.');

const siteId = getOpt('site') || WEBSITE_ID;
if (!siteId && command !== 'sites') err('Missing website ID. Set UMAMI_WEBSITE_ID env or use --site <id>');

const days = parseInt(getOpt('days') || '7', 10);
const endAt = Date.now();
const startAt = endAt - days * 86400000;

async function api(path) {
  const url = `${UMAMI_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${UMAMI_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  switch (command) {
    case 'stats': {
      const data = await api(`/api/websites/${siteId}/stats?startAt=${startAt}&endAt=${endAt}`);
      if (jsonOutput) { out(data); break; }
      log(`Stats (last ${days} days):`);
      log(`  Pageviews: ${data.pageviews?.value ?? '-'}`);
      log(`  Visitors:  ${data.visitors?.value ?? '-'}`);
      log(`  Visits:    ${data.visits?.value ?? '-'}`);
      log(`  Bounce:    ${data.bounces?.value ?? '-'}`);
      log(`  Avg time:  ${data.totaltime?.value ?? '-'}s`);
      break;
    }
    case 'pageviews': {
      const data = await api(`/api/websites/${siteId}/pageviews?startAt=${startAt}&endAt=${endAt}&unit=day`);
      if (jsonOutput) { out(data); break; }
      log(`Pageviews (last ${days} days, daily):`);
      for (const d of (data.pageviews || [])) {
        log(`  ${d.x}: ${d.y} views`);
      }
      break;
    }
    case 'top-pages': {
      const data = await api(`/api/websites/${siteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=url`);
      if (jsonOutput) { out(data); break; }
      log(`Top pages (last ${days} days):`);
      for (const p of (data || []).slice(0, 20)) {
        log(`  ${String(p.y).padStart(5)}  ${p.x}`);
      }
      break;
    }
    case 'referrers': {
      const data = await api(`/api/websites/${siteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=referrer`);
      if (jsonOutput) { out(data); break; }
      log(`Top referrers (last ${days} days):`);
      for (const r of (data || []).slice(0, 20)) {
        log(`  ${String(r.y).padStart(5)}  ${r.x || '(direct)'}`);
      }
      break;
    }
    case 'browsers': {
      const data = await api(`/api/websites/${siteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=browser`);
      if (jsonOutput) { out(data); break; }
      log(`Browser breakdown (last ${days} days):`);
      for (const b of (data || [])) { log(`  ${String(b.y).padStart(5)}  ${b.x}`); }
      break;
    }
    case 'countries': {
      const data = await api(`/api/websites/${siteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=country`);
      if (jsonOutput) { out(data); break; }
      log(`Country breakdown (last ${days} days):`);
      for (const c of (data || [])) { log(`  ${String(c.y).padStart(5)}  ${c.x}`); }
      break;
    }
    case 'devices': {
      const data = await api(`/api/websites/${siteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=device`);
      if (jsonOutput) { out(data); break; }
      log(`Device breakdown (last ${days} days):`);
      for (const d of (data || [])) { log(`  ${String(d.y).padStart(5)}  ${d.x}`); }
      break;
    }
    case 'active': {
      const data = await api(`/api/websites/${siteId}/active`);
      if (jsonOutput) { out(data); break; }
      log(`Active visitors: ${data[0]?.x ?? data?.x ?? JSON.stringify(data)}`);
      break;
    }
    default:
      err(`Unknown command: ${command}\nRun with --help for usage.`);
  }
}

main().catch(e => {
  if (jsonOutput) { out({ error: e.message }); } else { console.error(e.message); }
  process.exit(1);
});
