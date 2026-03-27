#!/usr/bin/env node
/**
 * Bing Webmaster Tools API wrapper
 *
 * Pulls search performance data, index status, and crawl stats from Bing.
 * Auth: BING_WEBMASTER_API_KEY env var.
 *
 * Usage:
 *   node scripts/tools/bing-webmaster.mjs <command> [options]
 */

import '../config.mjs';
import { SITE_URL } from '../config.mjs';

const API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';
const API_KEY = process.env.BING_WEBMASTER_API_KEY;
const SITE = SITE_URL; // https://superdots.sh

const HELP = `Usage: node bing-webmaster.mjs <command> [options]

Commands:
  stats                         Site traffic stats (last 30 days)
  query-stats [--date YYYY-MM-DD]  Search query performance data
  page-stats [--date YYYY-MM-DD]   Per-page traffic data
  crawl-stats                   Crawl statistics
  url-info <url>                Traffic info for a specific URL
  backlinks                     Inbound links summary

Options:
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

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

if (!API_KEY) err('Missing env var BING_WEBMASTER_API_KEY');

async function api(method, params = {}) {
  const url = new URL(`${API_BASE}/${method}`);
  url.searchParams.set('apikey', API_KEY);
  url.searchParams.set('siteUrl', SITE);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const detail = typeof data === 'object' ? JSON.stringify(data) : data;
    throw new Error(`${method} → ${res.status}: ${detail}`);
  }
  return data;
}

async function apiPost(method, body = {}) {
  const url = new URL(`${API_BASE}/${method}`);
  url.searchParams.set('apikey', API_KEY);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const detail = typeof data === 'object' ? JSON.stringify(data) : data;
    throw new Error(`POST ${method} → ${res.status}: ${detail}`);
  }
  return data;
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

async function main() {
  switch (command) {
    case 'stats': {
      const data = await api('GetRankAndTrafficStats');
      if (jsonOutput) { out(data); break; }
      const entries = data?.d || data;
      if (!Array.isArray(entries) || entries.length === 0) {
        log('No traffic data available yet.');
        break;
      }
      log('Bing Search Performance (recent data):');
      log('  Date                | Clicks | Impressions | CTR     | Avg Pos');
      log('  --------------------|--------|-------------|---------|--------');
      for (const e of entries.slice(-14)) {
        const date = e.Date ? new Date(parseInt(e.Date.match(/\d+/)[0])).toISOString().split('T')[0] : '?';
        const clicks = String(e.Clicks ?? 0).padStart(6);
        const impressions = String(e.Impressions ?? 0).padStart(11);
        const ctr = ((e.Clicks ?? 0) / Math.max(e.Impressions ?? 1, 1) * 100).toFixed(1).padStart(6) + '%';
        const pos = (e.AvgImpressionPosition ?? 0).toFixed(1).padStart(7);
        log(`  ${date}            |${clicks} |${impressions} |${ctr} |${pos}`);
      }
      break;
    }

    case 'query-stats': {
      const date = getArg('--date') || formatDate(new Date(Date.now() - 3 * 86400000));
      const data = await api('GetQueryStats', { query: date });
      if (jsonOutput) { out(data); break; }
      const entries = data?.d || data;
      if (!Array.isArray(entries) || entries.length === 0) {
        log(`No query data for ${date}.`);
        break;
      }
      log(`Bing Query Stats for ${date}:`);
      log('  Clicks | Impressions | CTR     | Pos   | Query');
      log('  -------|-------------|---------|-------|------');
      for (const e of entries.slice(0, 30)) {
        const clicks = String(e.Clicks ?? 0).padStart(6);
        const impressions = String(e.Impressions ?? 0).padStart(11);
        const ctr = ((e.Clicks ?? 0) / Math.max(e.Impressions ?? 1, 1) * 100).toFixed(1).padStart(6) + '%';
        const pos = (e.AvgImpressionPosition ?? 0).toFixed(1).padStart(5);
        log(`  ${clicks} |${impressions} |${ctr} |${pos} | ${e.Query || '?'}`);
      }
      break;
    }

    case 'page-stats': {
      const date = getArg('--date') || formatDate(new Date(Date.now() - 3 * 86400000));
      const data = await api('GetQueryPageStats', { query: date });
      if (jsonOutput) { out(data); break; }
      const entries = data?.d || data;
      if (!Array.isArray(entries) || entries.length === 0) {
        log(`No page data for ${date}.`);
        break;
      }
      log(`Bing Page Stats for ${date}:`);
      log('  Clicks | Impressions | URL');
      log('  -------|-------------|----');
      for (const e of entries.slice(0, 30)) {
        const clicks = String(e.Clicks ?? 0).padStart(6);
        const impressions = String(e.Impressions ?? 0).padStart(11);
        log(`  ${clicks} |${impressions} | ${e.Url || e.Query || '?'}`);
      }
      break;
    }

    case 'crawl-stats': {
      const data = await api('GetCrawlStats');
      if (jsonOutput) { out(data); break; }
      const entries = data?.d || data;
      if (!Array.isArray(entries) || entries.length === 0) {
        log('No crawl data available yet.');
        break;
      }
      log('Bing Crawl Stats (recent):');
      log('  Date       | Crawled | Errors | In Index');
      log('  -----------|---------|--------|----------');
      for (const e of entries.slice(-14)) {
        const date = e.Date ? new Date(parseInt(e.Date.match(/\d+/)[0])).toISOString().split('T')[0] : '?';
        log(`  ${date} | ${String(e.CrawledPages ?? 0).padStart(7)} | ${String(e.CrawlErrors ?? 0).padStart(6)} | ${String(e.InIndex ?? 0).padStart(8)}`);
      }
      break;
    }

    case 'url-info': {
      const url = positional[1];
      if (!url) err('Usage: bing-webmaster.mjs url-info <url>');
      const fullUrl = url.startsWith('http') ? url : `${SITE}${url.startsWith('/') ? '' : '/'}${url}`;
      const data = await api('GetUrlTrafficInfo', { url: fullUrl });
      if (jsonOutput) { out(data); break; }
      log(`Bing URL Info: ${fullUrl}`);
      log(JSON.stringify(data?.d || data, null, 2));
      break;
    }

    case 'backlinks': {
      const data = await api('GetLinkCounts');
      if (jsonOutput) { out(data); break; }
      const counts = data?.d || data;
      log(`Bing Backlinks for ${SITE}:`);
      log(JSON.stringify(counts, null, 2));
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
