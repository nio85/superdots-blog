#!/usr/bin/env node
/**
 * Umami Analytics API wrapper
 *
 * Interacts with Umami (localhost:3001) for web analytics data.
 * Auth: Bearer token from UMAMI_API_TOKEN env var.
 * Fallback: if token is expired/invalid, auto-refreshes via login endpoint.
 *
 * Usage:
 *   node scripts/tools/umami.mjs <command> [options]
 */

import '../config.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_ROOT = resolve(__dirname, '../..');

const UMAMI_URL = process.env.UMAMI_API_URL || 'http://localhost:3001';
let UMAMI_TOKEN = process.env.UMAMI_API_TOKEN;
const WEBSITE_ID = process.env.UMAMI_WEBSITE_ID;
const UMAMI_USER = process.env.UMAMI_USERNAME;
const UMAMI_PASS = process.env.UMAMI_PASSWORD;

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
  utm-stats --source <x>    Sessions/pageviews filtered by utm_source
  funnel --source <x>       Composite quality report for a traffic source

Options:
  --json         Output as JSON
  --days <n>     Lookback period in days (default 7)
  --source <x>   UTM source to filter (e.g. reddit, google)
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

const siteId = getOpt('site') || WEBSITE_ID;
if (!siteId) err('Missing website ID. Set UMAMI_WEBSITE_ID env or use --site <id>');

const days = parseInt(getOpt('days') || '7', 10);
const endAt = Date.now();
const startAt = endAt - days * 86400000;

/** Re-authenticate via login endpoint and update .env token */
async function refreshToken() {
  if (!UMAMI_USER || !UMAMI_PASS) {
    err('Token expired and no UMAMI_USERNAME/UMAMI_PASSWORD in .env for auto-refresh');
  }
  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: UMAMI_USER, password: UMAMI_PASS }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  UMAMI_TOKEN = data.token;

  // Persist new token to .env so future calls don't need to re-login
  try {
    const envPath = resolve(BLOG_ROOT, '.env');
    let env = readFileSync(envPath, 'utf-8');
    env = env.replace(/^UMAMI_API_TOKEN=.*$/m, `UMAMI_API_TOKEN=${UMAMI_TOKEN}`);
    writeFileSync(envPath, env);
  } catch { /* best-effort */ }

  return UMAMI_TOKEN;
}

async function api(path) {
  if (!UMAMI_TOKEN) await refreshToken();

  const url = `${UMAMI_URL}${path}`;
  let res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${UMAMI_TOKEN}` },
  });

  // Token expired — auto-refresh and retry once
  if (res.status === 401) {
    await refreshToken();
    res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${UMAMI_TOKEN}` },
    });
  }

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
      const data = await api(`/api/websites/${siteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=path`);
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
    case 'utm-stats': {
      const source = getOpt('source');
      if (!source) err('Missing --source. Example: --source reddit');
      const queries = await api(`/api/websites/${siteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=query`);
      const filtered = (queries || []).filter(q => {
        const p = new URLSearchParams(q.x);
        return p.get('utm_source') === source || p.get('ref') === source;
      });
      const totalSessions = filtered.reduce((sum, q) => sum + (q.y || 0), 0);
      const result = { source, days, sessions: totalSessions, queries: filtered.slice(0, 50) };
      if (jsonOutput) { out(result); break; }
      log(`UTM stats for source="${source}" (last ${days} days):`);
      log(`  Sessions: ${totalSessions}`);
      for (const q of filtered.slice(0, 20)) {
        log(`  ${String(q.y).padStart(5)}  ${q.x}`);
      }
      break;
    }
    case 'funnel': {
      const source = getOpt('source');
      if (!source) err('Missing --source. Example: --source reddit');
      const [pageMetrics, eventData, statsData] = await Promise.all([
        api(`/api/websites/${siteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=query`),
        api(`/api/websites/${siteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=event`),
        api(`/api/websites/${siteId}/stats?startAt=${startAt}&endAt=${endAt}`),
      ]);
      const utmSessions = (pageMetrics || [])
        .filter(q => {
          const p = new URLSearchParams(q.x);
          return p.get('utm_source') === source;
        })
        .reduce((sum, q) => sum + (q.y || 0), 0);
      const events = {};
      for (const ev of (eventData || [])) {
        events[ev.x] = (events[ev.x] || 0) + (ev.y || 0);
      }
      const totalPageviews = statsData?.pageviews?.value || 1;
      const scrollEvents = events['reading_progress'] || 0;
      const newsletterSignups = events['newsletter_signup'] || 0;
      const redditLandings = events['reddit_landing'] || 0;
      const read75Estimate = Math.round(scrollEvents * 0.25);
      const scroll75Rate = utmSessions > 0 ? Math.min(1, read75Estimate / utmSessions) : 0;
      const signupRate = utmSessions > 0 ? newsletterSignups / utmSessions : 0;
      const qualityScore = utmSessions > 0
        ? Math.round((scroll75Rate * 0.5 + signupRate * 0.3 + Math.min(1, utmSessions / totalPageviews) * 0.2) * 100) / 100
        : 0;
      const result = {
        source, days,
        sessions: utmSessions,
        reddit_landings: redditLandings,
        total_site_pageviews: totalPageviews,
        scroll_events: scrollEvents,
        read_75_estimate: read75Estimate,
        scroll_75_rate: Math.round(scroll75Rate * 100) / 100,
        newsletter_signups: newsletterSignups,
        signup_rate: Math.round(signupRate * 10000) / 100,
        quality_score: qualityScore,
      };
      if (jsonOutput) { out(result); break; }
      log(`Funnel report for source="${source}" (last ${days} days):`);
      log(`  Sessions from ${source}: ${utmSessions}`);
      log(`  Reddit landings: ${redditLandings}`);
      log(`  Scroll 75%+ rate: ${Math.round(scroll75Rate * 100)}%`);
      log(`  Newsletter signups: ${newsletterSignups} (${result.signup_rate}%)`);
      log(`  Quality score: ${qualityScore}`);
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
