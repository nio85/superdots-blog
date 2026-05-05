#!/usr/bin/env node
/**
 * IndexNow API wrapper
 *
 * Notifies Bing, Yandex, Naver, Seznam of new/updated URLs for instant crawling.
 * Auth: INDEXNOW_API_KEY env var (also used as key file name).
 *
 * Usage:
 *   node scripts/tools/indexnow.mjs <command> [options]
 */

import '../config.mjs';
import { SITE_URL, SITE_HOST } from '../config.mjs';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const INDEXNOW_API_KEY = process.env.INDEXNOW_API_KEY;
const MAX_BATCH_SIZE = 10000;

const HELP = `Usage: node indexnow.mjs <command> [options]

Commands:
  submit-url <url>              Submit a single URL
  submit-batch <url1> [url2..]  Submit multiple URLs (max 10,000)
  submit-sitemap                Parse sitemap and submit all URLs
  submit-recent [days]          Submit URLs modified in last N days (default: 1)

Options:
  --dry-run   Show what would be submitted without sending
  --json      Output as JSON
  --help      Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const dryRun = args.includes('--dry-run');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

if (!INDEXNOW_API_KEY) err('Missing env var INDEXNOW_API_KEY');

/**
 * Submit a batch of URLs to IndexNow.
 * @param {string[]} urls
 * @returns {Promise<{status: number, submitted: number}>}
 */
async function submitBatch(urls) {
  if (urls.length === 0) return { status: 200, submitted: 0 };
  if (urls.length > MAX_BATCH_SIZE) {
    err(`Too many URLs (${urls.length}). Max batch size is ${MAX_BATCH_SIZE}.`);
  }

  const body = {
    host: SITE_HOST,
    key: INDEXNOW_API_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_API_KEY}.txt`,
    urlList: urls,
  };

  if (dryRun) {
    log(`[DRY RUN] Would submit ${urls.length} URL(s) to IndexNow:`);
    for (const u of urls) log(`  ${u}`);
    return { status: 200, submitted: urls.length, dryRun: true };
  }

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  // IndexNow returns 200 (ok), 202 (accepted), 400/422/429 on error
  const status = res.status;
  let detail = '';
  try { detail = await res.text(); } catch {}

  if (status === 200 || status === 202) {
    log(`Submitted ${urls.length} URL(s) to IndexNow. Response: ${status}`);
  } else {
    log(`IndexNow returned ${status}: ${detail}`);
  }

  return { status, submitted: urls.length, detail: detail || undefined };
}

/**
 * Fetch and parse the sitemap index, returning all <loc> URLs.
 */
async function fetchSitemapUrls() {
  const indexUrl = `${SITE_URL}/sitemap-index.xml`;
  log(`Fetching sitemap index: ${indexUrl}`);
  const indexRes = await fetch(indexUrl);
  if (!indexRes.ok) err(`Failed to fetch sitemap index: ${indexRes.status}`);
  const indexXml = await indexRes.text();

  // Extract sub-sitemap URLs from sitemap index
  const sitemapLocs = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (sitemapLocs.length === 0) err('No sitemaps found in sitemap index');

  const allEntries = [];

  for (const sitemapUrl of sitemapLocs) {
    log(`Fetching sitemap: ${sitemapUrl}`);
    const sitemapRes = await fetch(sitemapUrl);
    if (!sitemapRes.ok) { log(`  Warning: failed to fetch ${sitemapUrl} (${sitemapRes.status})`); continue; }
    const sitemapXml = await sitemapRes.text();

    // Extract URL entries with optional lastmod
    const urlBlocks = sitemapXml.split('<url>').slice(1);
    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
      const modMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
      if (locMatch) {
        allEntries.push({
          url: locMatch[1],
          lastmod: modMatch ? modMatch[1] : null,
        });
      }
    }
  }

  return allEntries;
}

/**
 * Filter URLs to only content pages worth indexing.
 * Excludes: tag pages, category pages, legal/service pages.
 */
const INDEXABLE_PREFIXES = ['/blog/', '/guides/', '/about'];
const INDEXABLE_EXACT = ['/']; // homepage

function filterContentUrls(urls) {
  return urls.filter(url => {
    const path = url.replace(SITE_URL, '');
    if (INDEXABLE_EXACT.includes(path)) return true;
    return INDEXABLE_PREFIXES.some(p => path.startsWith(p));
  });
}

async function main() {
  switch (command) {
    case 'submit-url': {
      const url = positional[1];
      if (!url) err('Usage: indexnow.mjs submit-url <url>');
      // Ensure full URL
      const fullUrl = url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
      // Refuse to submit URLs that don't resolve (typically future-dated articles
      // that won't go live until their daily 07:00 Rome rebuild). The standing
      // "IndexNow: daily new articles" routine handles those — never schedule a
      // per-article one-shot routine to work around this check.
      if (!dryRun) {
        try {
          const head = await fetch(fullUrl, { method: 'HEAD', redirect: 'follow' });
          if (head.status === 404) {
            err(`URL returned 404: ${fullUrl}\nLikely a future-dated article. Do NOT create a one-shot routine — the daily IndexNow routine (cron 30 7 * * *) will submit it automatically on its pubDate.`);
          }
        } catch (e) {
          log(`Warning: HEAD check failed (${e.message}) — proceeding with submission anyway.`);
        }
      }
      const result = await submitBatch([fullUrl]);
      if (jsonOutput) out(result);
      break;
    }

    case 'submit-batch': {
      const urls = positional.slice(1);
      if (urls.length === 0) err('Usage: indexnow.mjs submit-batch <url1> [url2...]');
      const fullUrls = urls.map(u => u.startsWith('http') ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`);
      const result = await submitBatch(fullUrls);
      if (jsonOutput) out(result);
      break;
    }

    case 'submit-sitemap': {
      const entries = await fetchSitemapUrls();
      const allUrls = entries.map(e => e.url);
      const urls = filterContentUrls(allUrls);
      log(`Found ${entries.length} URLs in sitemap, ${urls.length} are content pages.`);
      const result = await submitBatch(urls);
      if (jsonOutput) out({ ...result, totalUrls: entries.length, contentUrls: urls.length });
      break;
    }

    case 'submit-recent': {
      const days = parseInt(positional[1], 10) || 1;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const entries = await fetchSitemapUrls();
      const recent = entries.filter(e => {
        if (!e.lastmod) return false;
        return new Date(e.lastmod) >= cutoff;
      });
      const filtered = recent.filter(e => filterContentUrls([e.url]).length > 0);
      log(`Found ${recent.length} URL(s) modified in the last ${days} day(s), ${filtered.length} are content pages.`);
      if (filtered.length === 0) {
        log('Nothing to submit.');
        if (jsonOutput) out({ status: 200, submitted: 0, totalUrls: entries.length });
        break;
      }
      const result = await submitBatch(filtered.map(e => e.url));
      if (jsonOutput) out({ ...result, recentUrls: filtered.length, totalUrls: entries.length });
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
