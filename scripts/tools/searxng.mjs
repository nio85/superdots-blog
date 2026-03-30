#!/usr/bin/env node
/**
 * SearXNG search wrapper
 *
 * Interacts with SearXNG (localhost:8888) for web search.
 * No auth required — local instance.
 *
 * Usage:
 *   node scripts/tools/searxng.mjs <command> [options]
 */

import '../config.mjs';

const SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8888';

const HELP = `Usage: node searxng.mjs <command> [options]

Commands:
  search <query>              General web search
  news <query>                News search
  images <query>              Image search
  top-results <query>         Top N results with position (for CI)

Options:
  --json         Output as JSON
  --time <range> Time filter: day, week, month, year
  --page <n>     Page number (default 1)
  --lang <code>  Language (default en)
  --limit <n>    Max results for top-results (default 5)
  --help         Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function getOpt(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : null;
}

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

async function search(query, categories, timeRange, page, lang) {
  const params = new URLSearchParams({ q: query, format: 'json' });
  if (categories) params.set('categories', categories);
  if (timeRange) params.set('time_range', timeRange);
  if (page) params.set('pageno', page);
  if (lang) params.set('language', lang);

  const res = await fetch(`${SEARXNG_URL}/search?${params}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const query = positional.slice(1).join(' ');
  const timeRange = getOpt('time');
  const page = getOpt('page');
  const lang = getOpt('lang') || 'en';

  switch (command) {
    case 'search': {
      if (!query) err('Usage: searxng.mjs search <query>');
      const data = await search(query, 'general', timeRange, page, lang);
      if (jsonOutput) { out(data); break; }
      const results = data.results || [];
      log(`Found ${results.length} results for "${query}":\n`);
      for (const r of results.slice(0, 10)) {
        log(`  ${r.title}`);
        log(`  ${r.url}`);
        log(`  ${(r.content || '').slice(0, 120)}`);
        log('');
      }
      break;
    }
    case 'news': {
      if (!query) err('Usage: searxng.mjs news <query>');
      const data = await search(query, 'news', timeRange || 'week', page, lang);
      if (jsonOutput) { out(data); break; }
      const results = data.results || [];
      log(`Found ${results.length} news results for "${query}":\n`);
      for (const r of results.slice(0, 10)) {
        log(`  ${r.title}`);
        log(`  ${r.url}`);
        if (r.publishedDate) log(`  ${r.publishedDate}`);
        log('');
      }
      break;
    }
    case 'images': {
      if (!query) err('Usage: searxng.mjs images <query>');
      const data = await search(query, 'images', timeRange, page, lang);
      if (jsonOutput) { out(data); break; }
      const results = data.results || [];
      log(`Found ${results.length} image results for "${query}":\n`);
      for (const r of results.slice(0, 10)) {
        log(`  ${r.title} — ${r.img_src || r.url}`);
      }
      break;
    }
    case 'top-results': {
      if (!query) err('Usage: searxng.mjs top-results <query> [--limit N] [--json]');
      const limit = parseInt(getOpt('limit') || '5', 10);
      const data = await search(query, 'general', timeRange, page, lang);
      const results = (data.results || []).slice(0, limit).map((r, i) => ({
        position: i + 1,
        title: r.title,
        url: r.url,
        snippet: (r.content || '').slice(0, 200),
      }));
      if (jsonOutput) { out({ query, results }); break; }
      log(`Top ${results.length} results for "${query}":\n`);
      for (const r of results) {
        log(`  #${r.position} ${r.title}`);
        log(`  ${r.url}`);
        log(`  ${r.snippet}`);
        log('');
      }
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
