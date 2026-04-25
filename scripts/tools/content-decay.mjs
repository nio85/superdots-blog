#!/usr/bin/env node
/**
 * Content Decay Detection — GSC-based position monitoring
 *
 * Compares page rankings between the current 14-day window and the previous
 * 14-day window to detect decay in organic search visibility.
 *
 * Usage:
 *   node scripts/tools/content-decay.mjs [options]
 *
 * Options:
 *   --decay-threshold N     Min position drop to flag "decay" (default: 3)
 *   --alert-threshold N     Min position drop to flag "alert" (default: 5)
 *   --min-impressions N     Min impressions in current period (default: 10)
 *   --impression-drop N     Min impression drop % for "decay" (default: 20)
 *   --json                  Output as JSON
 *   --help                  Show this help
 */

import '../config.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BLOG_ROOT, SITE_URL } from '../config.mjs';

const GCP_KEY_FILE = process.env.GCP_KEY_FILE
  || resolve(BLOG_ROOT, '.secrets', 'gdrive-service-account.json');
const GSC_SITE_URL = 'sc-domain:superdots.sh';

const HELP = `Usage: node content-decay.mjs [options]

Detects content decay by comparing GSC positions over two consecutive 14-day windows.

Options:
  --decay-threshold N     Position drop to flag as "decay" (default: 3)
  --alert-threshold N     Position drop to flag as "alert" (default: 5)
  --min-impressions N     Min impressions in current period to include URL (default: 10)
  --impression-drop N     Min impression drop % required for "decay" flag (default: 20)
  --json                  Output as JSON
  --help                  Show this help

Flags explained:
  alert  — position dropped >= alert-threshold (critical, action required)
  decay  — position dropped >= decay-threshold AND impressions dropped >= impression-drop%
  stable — small or no change in position
  improving — position improved by 2+ positions`;

const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');

function getArg(flag, def) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
}

function log(...a) { if (!jsonOutput) console.log(...a); }
function fmtDate(d) { return d.toISOString().slice(0, 10); }

const decayThreshold = parseFloat(getArg('--decay-threshold', '3'));
const alertThreshold = parseFloat(getArg('--alert-threshold', '5'));
const minImpressions = parseInt(getArg('--min-impressions', '10'), 10);
const impressionDropPct = parseFloat(getArg('--impression-drop', '20')) / 100;

function getPeriods() {
  const today = new Date();
  today.setDate(today.getDate() - 2); // GSC has 1-2 day lag

  const currentEnd = new Date(today);
  const currentStart = new Date(today);
  currentStart.setDate(today.getDate() - 13); // 14-day window

  const prevEnd = new Date(currentStart);
  prevEnd.setDate(currentStart.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - 13); // previous 14-day window

  return {
    current: { startDate: fmtDate(currentStart), endDate: fmtDate(currentEnd) },
    previous: { startDate: fmtDate(prevStart), endDate: fmtDate(prevEnd) },
  };
}

async function getSearchConsole() {
  if (!existsSync(GCP_KEY_FILE)) {
    throw new Error(`Service account key not found: ${GCP_KEY_FILE}`);
  }
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile: GCP_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const client = await auth.getClient();
  return google.searchconsole({ version: 'v1', auth: client });
}

async function queryPages(sc, { startDate, endDate }, rowLimit = 5000) {
  const res = await sc.searchanalytics.query({
    siteUrl: GSC_SITE_URL,
    requestBody: { startDate, endDate, dimensions: ['page'], rowLimit },
  });
  const map = new Map();
  for (const r of (res.data.rows || [])) {
    map.set(r.keys[0], {
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    });
  }
  return map;
}

async function queryTopQueries(sc, { startDate, endDate }, rowLimit = 25000) {
  const res = await sc.searchanalytics.query({
    siteUrl: GSC_SITE_URL,
    requestBody: { startDate, endDate, dimensions: ['page', 'query'], rowLimit },
  });
  // Pick top query per page (highest impressions)
  const topQueries = new Map();
  for (const r of (res.data.rows || [])) {
    const [page, query] = r.keys;
    const existing = topQueries.get(page);
    if (!existing || r.impressions > existing.impressions) {
      topQueries.set(page, { query, impressions: r.impressions });
    }
  }
  return topQueries;
}

async function main() {
  const periods = getPeriods();

  log('Content Decay Detection');
  log(`Current period:  ${periods.current.startDate} → ${periods.current.endDate}`);
  log(`Previous period: ${periods.previous.startDate} → ${periods.previous.endDate}`);
  log(`Thresholds: decay=${decayThreshold} pos, alert=${alertThreshold} pos, min_impressions=${minImpressions}, impression_drop=${impressionDropPct * 100}%`);
  log('');

  const sc = await getSearchConsole();

  const [currentPages, previousPages, topQueries] = await Promise.all([
    queryPages(sc, periods.current),
    queryPages(sc, periods.previous),
    queryTopQueries(sc, periods.current),
  ]);

  if (currentPages.size === 0) {
    const result = {
      periods,
      generatedAt: new Date().toISOString(),
      note: 'No GSC data available. Site may be new or have insufficient data.',
      healthScore: null,
      thresholds: { decayThreshold, alertThreshold, minImpressions, impressionDropPct: impressionDropPct * 100 },
      summary: { total: 0, alert: 0, decay: 0, stable: 0, improving: 0, newUrls: 0 },
      articles: [],
    };
    if (jsonOutput) { console.log(JSON.stringify(result, null, 2)); return; }
    log('No GSC data available for analysis.');
    return;
  }

  const articles = [];

  for (const [url, curr] of currentPages) {
    if (curr.impressions < minImpressions) continue;

    const prev = previousPages.get(url);
    const topQuery = topQueries.get(url);

    const slug = url.replace(SITE_URL, '') || '/';

    if (!prev) {
      articles.push({
        url,
        slug,
        topQuery: topQuery?.query || null,
        status: 'new',
        currentPosition: Math.round(curr.position * 10) / 10,
        previousPosition: null,
        positionDelta: null,
        currentImpressions: curr.impressions,
        previousImpressions: null,
        impressionDelta: null,
        impressionDeltaPct: null,
        currentClicks: curr.clicks,
        currentCtr: Math.round(curr.ctr * 10000) / 100,
      });
      continue;
    }

    const positionDelta = curr.position - prev.position; // positive = worse
    const impressionDelta = curr.impressions - prev.impressions;
    const impressionDeltaPct = prev.impressions > 0
      ? (curr.impressions - prev.impressions) / prev.impressions
      : null;

    let status;
    if (positionDelta >= alertThreshold) {
      status = 'alert';
    } else if (positionDelta >= decayThreshold && impressionDeltaPct !== null && impressionDeltaPct <= -impressionDropPct) {
      status = 'decay';
    } else if (positionDelta <= -2) {
      status = 'improving';
    } else {
      status = 'stable';
    }

    articles.push({
      url,
      slug,
      topQuery: topQuery?.query || null,
      status,
      currentPosition: Math.round(curr.position * 10) / 10,
      previousPosition: Math.round(prev.position * 10) / 10,
      positionDelta: Math.round(positionDelta * 10) / 10,
      currentImpressions: curr.impressions,
      previousImpressions: prev.impressions,
      impressionDelta,
      impressionDeltaPct: impressionDeltaPct !== null ? Math.round(impressionDeltaPct * 1000) / 10 : null,
      currentClicks: curr.clicks,
      currentCtr: Math.round(curr.ctr * 10000) / 100,
    });
  }

  const severityOrder = { alert: 0, decay: 1, stable: 2, improving: 3, new: 4 };
  articles.sort((a, b) => {
    const so = (severityOrder[a.status] ?? 5) - (severityOrder[b.status] ?? 5);
    if (so !== 0) return so;
    return (b.positionDelta ?? 0) - (a.positionDelta ?? 0);
  });

  const summary = {
    total: articles.length,
    alert: articles.filter(a => a.status === 'alert').length,
    decay: articles.filter(a => a.status === 'decay').length,
    stable: articles.filter(a => a.status === 'stable').length,
    improving: articles.filter(a => a.status === 'improving').length,
    newUrls: articles.filter(a => a.status === 'new').length,
  };

  const trackedWithHistory = summary.total - summary.newUrls;
  const healthyCount = summary.stable + summary.improving;
  const healthScore = trackedWithHistory > 0
    ? Math.round((healthyCount / trackedWithHistory) * 100)
    : null;

  const result = {
    periods,
    generatedAt: new Date().toISOString(),
    thresholds: { decayThreshold, alertThreshold, minImpressions, impressionDropPct: impressionDropPct * 100 },
    healthScore,
    summary,
    articles,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  log(`Health Score: ${healthScore !== null ? `${healthScore}%` : 'N/A'} (${healthyCount}/${trackedWithHistory} pages stable/improving)`);
  log('');
  log(`Summary: ${summary.total} pages analyzed`);
  log(`  Alert:     ${summary.alert}`);
  log(`  Decay:     ${summary.decay}`);
  log(`  Stable:    ${summary.stable}`);
  log(`  Improving: ${summary.improving}`);
  log(`  New URLs:  ${summary.newUrls}`);
  log('');

  const problemArticles = articles.filter(a => a.status === 'alert' || a.status === 'decay');
  if (problemArticles.length === 0) {
    log('No decay detected. All tracked pages are stable or improving.');
    return;
  }

  log(`Pages needing attention (${problemArticles.length}):`);
  log('');
  for (const a of problemArticles) {
    const icon = a.status === 'alert' ? '[ALERT]' : '[DECAY]';
    log(`${icon} ${a.slug}`);
    log(`   Position: ${a.previousPosition} -> ${a.currentPosition} (+${a.positionDelta})`);
    const impStr = a.impressionDeltaPct !== null
      ? `${a.previousImpressions} -> ${a.currentImpressions} (${a.impressionDeltaPct > 0 ? '+' : ''}${a.impressionDeltaPct}%)`
      : 'N/A';
    log(`   Impressions: ${impStr}`);
    if (a.topQuery) log(`   Top query: "${a.topQuery}"`);
    log('');
  }
}

main().catch(e => {
  if (jsonOutput) { console.log(JSON.stringify({ error: e.message })); }
  else { console.error(e.message); }
  process.exit(1);
});
