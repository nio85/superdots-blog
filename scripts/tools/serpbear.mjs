#!/usr/bin/env node
/**
 * SerpBear API wrapper
 *
 * Interacts with SerpBear (localhost:3005) for SERP rank tracking.
 * Auth: Bearer token from SERPBEAR_API_KEY env var.
 *
 * Usage:
 *   node scripts/tools/serpbear.mjs <command> [options]
 */

import '../config.mjs';

const SERPBEAR_URL = process.env.SERPBEAR_URL || 'http://localhost:3005';
const SERPBEAR_API_KEY = process.env.SERPBEAR_API_KEY;

const HELP = `Usage: node serpbear.mjs <command> [options]

Commands:
  domains                    List tracked domains
  keywords <domain>          List keywords for a domain
  keyword <id>               Get keyword with history
  refresh <id>               Refresh a single keyword
  scrape                     Trigger full scrape
  insight <domain>           GSC insights for domain
  search-console <domain>    Search Console data for domain

Options:
  --json    Output as JSON
  --help    Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

if (!SERPBEAR_API_KEY) err('Missing env var SERPBEAR_API_KEY');

async function api(method, path, body) {
  const url = `${SERPBEAR_URL}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${SERPBEAR_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const detail = typeof data === 'object' ? JSON.stringify(data) : data;
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`);
  }
  return data;
}

async function main() {
  switch (command) {
    case 'domains': {
      const data = await api('GET', '/api/domains');
      if (jsonOutput) { out(data); break; }
      const domains = Array.isArray(data) ? data : data.domains || [];
      if (domains.length === 0) { log('No domains tracked.'); break; }
      for (const d of domains) {
        log(`  ${d.id ?? '-'}  ${d.domain}  (keywords: ${d.keywordCount ?? d.keyword_count ?? '?'})`);
      }
      break;
    }
    case 'keywords': {
      const domain = positional[1];
      if (!domain) err('Usage: serpbear.mjs keywords <domain>');
      const data = await api('GET', `/api/keywords?domain=${encodeURIComponent(domain)}`);
      if (jsonOutput) { out(data); break; }
      const kws = Array.isArray(data) ? data : data.keywords || [];
      if (kws.length === 0) { log('No keywords found.'); break; }
      for (const k of kws) {
        log(`  ${k.id}  [${k.position ?? '-'}]  ${k.keyword}`);
      }
      break;
    }
    case 'keyword': {
      const id = positional[1];
      if (!id) err('Usage: serpbear.mjs keyword <id>');
      const data = await api('GET', `/api/keyword?id=${id}`);
      if (jsonOutput) { out(data); break; }
      log(JSON.stringify(data, null, 2));
      break;
    }
    case 'refresh': {
      const id = positional[1];
      if (!id) err('Usage: serpbear.mjs refresh <id>');
      const data = await api('POST', `/api/refresh?id=${id}`);
      if (jsonOutput) { out(data); break; }
      log('Refresh triggered.');
      if (data) log(JSON.stringify(data, null, 2));
      break;
    }
    case 'scrape': {
      const data = await api('POST', '/api/cron');
      if (jsonOutput) { out(data); break; }
      log('Full scrape triggered.');
      if (data) log(JSON.stringify(data, null, 2));
      break;
    }
    case 'insight': {
      const domain = positional[1];
      if (!domain) err('Usage: serpbear.mjs insight <domain>');
      const data = await api('GET', `/api/insight?domain=${encodeURIComponent(domain)}`);
      if (jsonOutput) { out(data); break; }
      log(JSON.stringify(data, null, 2));
      break;
    }
    case 'search-console': {
      const domain = positional[1];
      if (!domain) err('Usage: serpbear.mjs search-console <domain>');
      const data = await api('GET', `/api/searchconsole?domain=${encodeURIComponent(domain)}`);
      if (jsonOutput) { out(data); break; }
      log(JSON.stringify(data, null, 2));
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
