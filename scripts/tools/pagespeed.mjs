#!/usr/bin/env node
/**
 * Google PageSpeed Insights wrapper
 *
 * Lighthouse performance, accessibility, best-practices, SEO scores + Core Web Vitals.
 * Auth: none (free public API, no key needed).
 *
 * Usage:
 *   node scripts/tools/pagespeed.mjs <command> [options]
 */

import '../config.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BLOG_ROOT, SITE_URL } from '../config.mjs';

const CONTENT_DIR = join(BLOG_ROOT, 'src', 'content', 'blog');
const API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const DELAY_MS = 3000; // rate limit: ~25 req/min free tier
const API_KEY = process.env.PAGESPEED_API_KEY || ''; // optional: higher daily quota with key

const HELP = `Usage: node pagespeed.mjs <command> [options]

Commands:
  check <url>                   Lighthouse scores + Core Web Vitals for a URL
  check-batch <url1> [url2...]  Check multiple URLs (3s delay between)
  check-random [n]              Check n random blog articles (default: 3)
  report                        Full report: homepage + 5 random articles

Options:
  --strategy mobile|desktop  Analysis strategy (default: mobile)
  --json                     Output as JSON
  --help                     Show this help`;

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

const strategy = getArg('--strategy', 'mobile');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- PageSpeed API ---

async function runPageSpeed(url) {
  const params = new URLSearchParams({ url, strategy });
  for (const cat of CATEGORIES) params.append('category', cat);
  if (API_KEY) params.append('key', API_KEY);

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${API_BASE}?${params}`, { signal: controller.signal });
    clearTimeout(tid);
    if (res.status === 429) {
      throw new Error('API quota exceeded (429). Set PAGESPEED_API_KEY in .env for higher limits, or try again tomorrow.');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return parseResult(url, data);
  } catch (e) {
    clearTimeout(tid);
    if (e.name === 'AbortError') throw new Error(`Timeout (60s) for ${url}`);
    throw e;
  }
}

function parseResult(url, data) {
  const lr = data.lighthouseResult;
  if (!lr) throw new Error('No lighthouse result in response');

  const scores = {};
  for (const cat of CATEGORIES) {
    const c = lr.categories[cat];
    scores[cat.replace('-', '')] = c ? Math.round(c.score * 100) : null;
  }

  const audit = (id) => {
    const a = lr.audits[id];
    return a ? a.numericValue : null;
  };

  return {
    url,
    strategy,
    scores: {
      performance: scores.performance,
      accessibility: scores.accessibility,
      bestPractices: scores.bestpractices,
      seo: scores.seo,
    },
    coreWebVitals: {
      lcpMs: Math.round(audit('largest-contentful-paint') || 0),
      clsScore: Math.round((audit('cumulative-layout-shift') || 0) * 1000) / 1000,
      tbtMs: Math.round(audit('total-blocking-time') || 0),
    },
    fetchedAt: new Date().toISOString(),
  };
}

function printResult(r) {
  log(`\n  ${r.url} (${r.strategy})`);
  log(`  Performance:    ${r.scores.performance}`);
  log(`  Accessibility:  ${r.scores.accessibility}`);
  log(`  Best Practices: ${r.scores.bestPractices}`);
  log(`  SEO:            ${r.scores.seo}`);
  log(`  LCP: ${r.coreWebVitals.lcpMs}ms | CLS: ${r.coreWebVitals.clsScore} | TBT: ${r.coreWebVitals.tbtMs}ms`);
}

// --- Get random article slugs ---

function getRandomSlugs(n) {
  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const shuffled = files.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n).map(f => f.replace(/\.md$/, ''));
}

// ═══════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════

async function cmdCheck() {
  const url = positional[1];
  if (!url) err('Usage: pagespeed.mjs check <url>');
  log(`Checking ${url} (${strategy})...`);
  const result = await runPageSpeed(url);
  if (jsonOutput) out(result);
  else printResult(result);
}

async function cmdCheckBatch() {
  const urls = positional.slice(1);
  if (urls.length === 0) err('Usage: pagespeed.mjs check-batch <url1> [url2...]');

  const results = [];
  for (let i = 0; i < urls.length; i++) {
    log(`Checking ${i + 1}/${urls.length}: ${urls[i]}...`);
    try {
      results.push(await runPageSpeed(urls[i]));
    } catch (e) {
      results.push({ url: urls[i], error: e.message });
    }
    if (i < urls.length - 1) await sleep(DELAY_MS);
  }

  if (jsonOutput) {
    out(results);
  } else {
    for (const r of results) {
      if (r.error) log(`\n  ${r.url}: ERROR — ${r.error}`);
      else printResult(r);
    }
  }
}

async function cmdCheckRandom() {
  const n = parseInt(positional[1]) || 3;
  const slugs = getRandomSlugs(n);
  const urls = slugs.map(s => `${SITE_URL}/blog/${s}/`);
  log(`Checking ${n} random articles...`);

  const results = [];
  for (let i = 0; i < urls.length; i++) {
    log(`  ${i + 1}/${urls.length}: ${slugs[i]}`);
    try {
      results.push(await runPageSpeed(urls[i]));
    } catch (e) {
      results.push({ url: urls[i], error: e.message });
    }
    if (i < urls.length - 1) await sleep(DELAY_MS);
  }

  if (jsonOutput) {
    out(results);
  } else {
    for (const r of results) {
      if (r.error) log(`\n  ${r.url}: ERROR — ${r.error}`);
      else printResult(r);
    }
  }
}

async function cmdReport() {
  log(`Running full PageSpeed report (${strategy})...\n`);
  const results = [];

  // Homepage
  log('Checking homepage...');
  try {
    results.push(await runPageSpeed(SITE_URL));
  } catch (e) {
    results.push({ url: SITE_URL, error: e.message });
  }
  await sleep(DELAY_MS);

  // 5 random articles
  const slugs = getRandomSlugs(5);
  for (let i = 0; i < slugs.length; i++) {
    const url = `${SITE_URL}/blog/${slugs[i]}/`;
    log(`Checking article ${i + 1}/5: ${slugs[i]}...`);
    try {
      results.push(await runPageSpeed(url));
    } catch (e) {
      results.push({ url, error: e.message });
    }
    if (i < slugs.length - 1) await sleep(DELAY_MS);
  }

  // Calculate averages
  const valid = results.filter(r => !r.error);
  const avg = (field) => {
    const vals = valid.map(r => r.scores[field]).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const avgCwv = (field) => {
    const vals = valid.map(r => r.coreWebVitals[field]).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const averages = {
    performance: avg('performance'),
    accessibility: avg('accessibility'),
    bestPractices: avg('bestPractices'),
    seo: avg('seo'),
  };

  const avgVitals = {
    lcpMs: avgCwv('lcpMs'),
    clsScore: Math.round((valid.map(r => r.coreWebVitals.clsScore).reduce((a, b) => a + b, 0) / (valid.length || 1)) * 1000) / 1000,
    tbtMs: avgCwv('tbtMs'),
  };

  // Flags
  const flags = [];
  for (const r of valid) {
    if (r.scores.accessibility < 90) flags.push({ url: r.url, issue: 'accessibility_below_90', score: r.scores.accessibility });
    if (r.coreWebVitals.lcpMs > 4000) flags.push({ url: r.url, issue: 'lcp_slow', value: `${r.coreWebVitals.lcpMs}ms` });
    if (r.coreWebVitals.clsScore > 0.25) flags.push({ url: r.url, issue: 'cls_high', value: r.coreWebVitals.clsScore });
    if (r.coreWebVitals.tbtMs > 600) flags.push({ url: r.url, issue: 'tbt_high', value: `${r.coreWebVitals.tbtMs}ms` });
  }

  const report = {
    strategy,
    checkedAt: new Date().toISOString(),
    pagesChecked: results.length,
    pagesSuccessful: valid.length,
    homepage: results[0],
    articles: results.slice(1),
    averages,
    coreWebVitals: avgVitals,
    flags,
  };

  if (jsonOutput) {
    out(report);
  } else {
    log('\n═══ PageSpeed Report ═══\n');
    for (const r of results) {
      if (r.error) log(`  ${r.url}: ERROR — ${r.error}`);
      else printResult(r);
    }
    log(`\n─── Averages (${valid.length} pages) ───`);
    log(`  Performance:    ${averages.performance}`);
    log(`  Accessibility:  ${averages.accessibility}`);
    log(`  Best Practices: ${averages.bestPractices}`);
    log(`  SEO:            ${averages.seo}`);
    log(`  LCP: ${avgVitals.lcpMs}ms | CLS: ${avgVitals.clsScore} | TBT: ${avgVitals.tbtMs}ms`);
    if (flags.length > 0) {
      log(`\n─── Flags (${flags.length}) ───`);
      for (const f of flags) log(`  ⚠ ${f.url}: ${f.issue} (${f.score || f.value})`);
    } else {
      log('\n  ✓ No flags — all scores within acceptable range.');
    }
  }
}

// --- Dispatch ---

switch (command) {
  case 'check':        await cmdCheck(); break;
  case 'check-batch':  await cmdCheckBatch(); break;
  case 'check-random': await cmdCheckRandom(); break;
  case 'report':       await cmdReport(); break;
  default:             err(`Unknown command: ${command}. Run --help for usage.`);
}
