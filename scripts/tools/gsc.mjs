#!/usr/bin/env node
/**
 * Google Search Console API wrapper
 *
 * Granular access to GSC search performance data.
 * Auth: GCP service account via GCP_KEY_FILE env var.
 *
 * Usage:
 *   node scripts/tools/gsc.mjs <command> [options]
 */

import '../config.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE_URL, BLOG_ROOT } from '../config.mjs';

const GCP_KEY_FILE = process.env.GCP_KEY_FILE
  || resolve(BLOG_ROOT, '.secrets', 'gdrive-service-account.json');
const GSC_SITE_URL = 'sc-domain:superdots.sh';

const HELP = `Usage: node gsc.mjs <command> [options]

Commands:
  stats [--days N]              Summary: total clicks, impressions, CTR, avg position (default: 7 days)
  queries [--days N] [--limit N]  Top search queries by clicks (default: 7 days, 20 results)
  pages [--days N] [--limit N]    Top pages by clicks (default: 7 days, 20 results)
  query <keyword> [--days N]      Performance for a specific query
  page <url> [--days N]           Performance for a specific page
  opportunities [--days N]        High impressions + low CTR = quick wins

Options:
  --days N    Lookback period in days (default: 7)
  --limit N   Max results (default: 20)
  --json      Output as JSON
  --help      Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

function fmtDate(d) { return d.toISOString().slice(0, 10); }

function dateRange(days) {
  const end = new Date();
  end.setDate(end.getDate() - 1); // GSC data has 1-2 day lag
  const start = new Date(end);
  start.setDate(end.getDate() - days + 1);
  return { startDate: fmtDate(start), endDate: fmtDate(end) };
}

// --- Google Auth ---

let _google = null;

async function getGoogle() {
  if (_google) return _google;
  try {
    const mod = await import('googleapis');
    _google = mod.google;
    return _google;
  } catch {
    err('googleapis package not installed. Run: npm install googleapis');
  }
}

async function getSearchConsole() {
  if (!existsSync(GCP_KEY_FILE)) {
    err(`Service account key not found: ${GCP_KEY_FILE}`);
  }
  const google = await getGoogle();
  const auth = new google.auth.GoogleAuth({
    keyFile: GCP_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const client = await auth.getClient();
  return google.searchconsole({ version: 'v1', auth: client });
}

/**
 * Query GSC Search Analytics API.
 */
async function query({ startDate, endDate, dimensions = [], dimensionFilterGroups, rowLimit = 20 }) {
  const sc = await getSearchConsole();
  const requestBody = { startDate, endDate, dimensions, rowLimit };
  if (dimensionFilterGroups) requestBody.dimensionFilterGroups = dimensionFilterGroups;

  const res = await sc.searchanalytics.query({
    siteUrl: GSC_SITE_URL,
    requestBody,
  });

  return (res.data.rows || []).map(r => {
    const entry = {
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    };
    if (dimensions.includes('query')) entry.query = r.keys[dimensions.indexOf('query')];
    if (dimensions.includes('page')) entry.page = r.keys[dimensions.indexOf('page')];
    if (dimensions.includes('date')) entry.date = r.keys[dimensions.indexOf('date')];
    return entry;
  });
}

/**
 * Query GSC for totals (no dimensions).
 */
async function queryTotals({ startDate, endDate }) {
  const sc = await getSearchConsole();
  const res = await sc.searchanalytics.query({
    siteUrl: GSC_SITE_URL,
    requestBody: { startDate, endDate },
  });
  const row = res.data.rows?.[0];
  return row ? { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position } : null;
}

async function main() {
  const days = parseInt(getArg('--days', '7'), 10);
  const limit = parseInt(getArg('--limit', '20'), 10);
  const range = dateRange(days);

  switch (command) {
    case 'stats': {
      const totals = await queryTotals(range);
      if (jsonOutput) { out({ ...range, days, ...totals }); break; }
      if (!totals) { log(`No GSC data for last ${days} days.`); break; }
      log(`Google Search Console — last ${days} days (${range.startDate} → ${range.endDate}):`);
      log(`  Clicks:      ${totals.clicks}`);
      log(`  Impressions: ${totals.impressions}`);
      log(`  CTR:         ${(totals.ctr * 100).toFixed(1)}%`);
      log(`  Avg Position: ${totals.position.toFixed(1)}`);
      break;
    }

    case 'queries': {
      const rows = await query({ ...range, dimensions: ['query'], rowLimit: limit });
      if (jsonOutput) { out({ ...range, days, queries: rows }); break; }
      if (rows.length === 0) { log(`No query data for last ${days} days.`); break; }
      log(`GSC Top Queries — last ${days} days:`);
      log('  Clicks | Impr    | CTR    | Pos   | Query');
      log('  -------|---------|--------|-------|------');
      for (const r of rows) {
        log(`  ${String(r.clicks).padStart(6)} | ${String(r.impressions).padStart(7)} | ${(r.ctr * 100).toFixed(1).padStart(5)}% | ${r.position.toFixed(1).padStart(5)} | ${r.query}`);
      }
      break;
    }

    case 'pages': {
      const rows = await query({ ...range, dimensions: ['page'], rowLimit: limit });
      if (jsonOutput) { out({ ...range, days, pages: rows }); break; }
      if (rows.length === 0) { log(`No page data for last ${days} days.`); break; }
      log(`GSC Top Pages — last ${days} days:`);
      log('  Clicks | Impr    | CTR    | Pos   | Page');
      log('  -------|---------|--------|-------|-----');
      for (const r of rows) {
        const page = r.page.replace(SITE_URL, '');
        log(`  ${String(r.clicks).padStart(6)} | ${String(r.impressions).padStart(7)} | ${(r.ctr * 100).toFixed(1).padStart(5)}% | ${r.position.toFixed(1).padStart(5)} | ${page}`);
      }
      break;
    }

    case 'query': {
      const keyword = positional[1];
      if (!keyword) err('Usage: gsc.mjs query <keyword>');
      const rows = await query({
        ...range,
        dimensions: ['date'],
        dimensionFilterGroups: [{
          filters: [{ dimension: 'query', expression: keyword, operator: 'contains' }],
        }],
        rowLimit: days,
      });
      if (jsonOutput) { out({ ...range, keyword, data: rows }); break; }
      if (rows.length === 0) { log(`No data for query "${keyword}" in last ${days} days.`); break; }
      log(`GSC: "${keyword}" — last ${days} days:`);
      log('  Date       | Clicks | Impr    | CTR    | Pos');
      log('  -----------|--------|---------|--------|------');
      for (const r of rows) {
        log(`  ${r.date}  | ${String(r.clicks).padStart(6)} | ${String(r.impressions).padStart(7)} | ${(r.ctr * 100).toFixed(1).padStart(5)}% | ${r.position.toFixed(1).padStart(5)}`);
      }
      break;
    }

    case 'page': {
      const url = positional[1];
      if (!url) err('Usage: gsc.mjs page <url>');
      const fullUrl = url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
      const rows = await query({
        ...range,
        dimensions: ['query'],
        dimensionFilterGroups: [{
          filters: [{ dimension: 'page', expression: fullUrl, operator: 'equals' }],
        }],
        rowLimit: limit,
      });
      if (jsonOutput) { out({ ...range, page: fullUrl, queries: rows }); break; }
      if (rows.length === 0) { log(`No data for page "${fullUrl}" in last ${days} days.`); break; }
      log(`GSC: queries for ${fullUrl.replace(SITE_URL, '')} — last ${days} days:`);
      log('  Clicks | Impr    | CTR    | Pos   | Query');
      log('  -------|---------|--------|-------|------');
      for (const r of rows) {
        log(`  ${String(r.clicks).padStart(6)} | ${String(r.impressions).padStart(7)} | ${(r.ctr * 100).toFixed(1).padStart(5)}% | ${r.position.toFixed(1).padStart(5)} | ${r.query}`);
      }
      break;
    }

    case 'opportunities': {
      const rows = await query({ ...range, dimensions: ['query'], rowLimit: 100 });
      const opps = rows
        .filter(r => r.impressions >= 5 && r.ctr < 0.03 && r.position > 5)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, limit);
      if (jsonOutput) { out({ ...range, days, opportunities: opps }); break; }
      if (opps.length === 0) { log(`No opportunities found (need impressions >= 5, CTR < 3%, position > 5).`); break; }
      log(`GSC Opportunities — high impressions, low CTR (last ${days} days):`);
      log('  Impr    | CTR    | Pos   | Query');
      log('  --------|--------|-------|------');
      for (const r of opps) {
        log(`  ${String(r.impressions).padStart(7)} | ${(r.ctr * 100).toFixed(1).padStart(5)}% | ${r.position.toFixed(1).padStart(5)} | ${r.query}`);
      }
      log(`\nThese queries have visibility but low click-through. Optimize titles and meta descriptions.`);
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
