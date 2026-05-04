#!/usr/bin/env node
/**
 * content-decay.mjs — Weekly Content Decay Check
 *
 * Compares GSC page positions over the last 14 days vs the previous 14 days.
 * Thresholds:
 *   decay — position dropped ≥5 places (schedule content refresh)
 *   alert — position dropped ≥2 places OR CTR dropped ≥30%
 *
 * If decay/alert pages found → creates a Content Manager issue.
 * If all pages are stable → exits silently (no issue created).
 *
 * Usage:
 *   node scripts/content-decay.mjs [--dry-run] [--json]
 */

import './config.mjs';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLOG_ROOT, SITE_URL, PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID,
  PAPERCLIP_PROJECT_ID, AGENTS, getPaperclipApiKey,
} from './config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GCP_KEY_FILE = process.env.GCP_KEY_FILE
  || [
    resolve(BLOG_ROOT, '.secrets', 'gdrive-service-account.json'),
    '/home/luca/paperclip/agents/superdots/.secrets/gdrive-service-account.json',
  ].find(p => existsSync(p))
  || resolve(BLOG_ROOT, '.secrets', 'gdrive-service-account.json');

const GSC_SITE_URL = 'sc-domain:superdots.sh';

const DRY_RUN = process.argv.includes('--dry-run');
const JSON_OUTPUT = process.argv.includes('--json');

// Decay thresholds
const MIN_IMPRESSIONS = 10;      // min impressions in EACH period for a valid comparison
const MIN_IMPRESSIONS_CTR = 20;  // min impressions in prev period for CTR comparison (CTR is noisy at low volume)
const DECAY_POS_DROP = 5;        // ≥5 position drop → decay
const ALERT_POS_DROP = 2;        // ≥2 position drop → alert
const ALERT_CTR_DROP = 0.30;     // ≥30% CTR drop → alert (requires CTR ≥1% in prev period)

function fmtDate(d) { return d.toISOString().slice(0, 10); }
function log(...a) { if (!JSON_OUTPUT) console.log(...a); }

function buildRanges() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1); // GSC has 1-2 day lag

  const recentEnd = new Date(yesterday);
  const recentStart = new Date(yesterday);
  recentStart.setDate(yesterday.getDate() - 13); // 14 days total

  const prevEnd = new Date(recentStart);
  prevEnd.setDate(recentStart.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - 13); // 14 days total

  return {
    recent: { startDate: fmtDate(recentStart), endDate: fmtDate(recentEnd) },
    previous: { startDate: fmtDate(prevStart), endDate: fmtDate(prevEnd) },
  };
}

async function getSearchConsole() {
  if (!existsSync(GCP_KEY_FILE)) {
    throw new Error(`GCP service account key not found: ${GCP_KEY_FILE}`);
  }
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile: GCP_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const client = await auth.getClient();
  return google.searchconsole({ version: 'v1', auth: client });
}

async function queryPages(sc, { startDate, endDate }, rowLimit = 200) {
  const res = await sc.searchanalytics.query({
    siteUrl: GSC_SITE_URL,
    requestBody: { startDate, endDate, dimensions: ['page'], rowLimit },
  });
  return (res.data.rows || []).map(r => ({
    page: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

function comparePages(recentPages, previousPages) {
  const prevMap = new Map(previousPages.map(p => [p.page, p]));
  const findings = [];

  for (const recent of recentPages) {
    if (!recent.page.includes('/blog/')) continue;

    const prev = prevMap.get(recent.page);
    if (!prev) continue; // new article, no comparison baseline

    // Require meaningful impressions in BOTH periods to avoid noise from newly indexed pages
    if (recent.impressions < MIN_IMPRESSIONS && prev.impressions < MIN_IMPRESSIONS) continue;
    // Also require a baseline floor in each direction to avoid "1 impression vs 50" comparisons
    if (prev.impressions < MIN_IMPRESSIONS && recent.impressions > 0) continue;

    const posDelta = recent.position - prev.position; // positive = worse ranking
    const ctrDelta = prev.ctr > 0.01 && prev.impressions >= MIN_IMPRESSIONS_CTR
      ? (recent.ctr - prev.ctr) / prev.ctr
      : 0; // only trust CTR signal when prev period has enough volume

    let status = 'stable';
    if (posDelta >= DECAY_POS_DROP) {
      status = 'decay';
    } else if (posDelta >= ALERT_POS_DROP || ctrDelta <= -ALERT_CTR_DROP) {
      status = 'alert';
    }

    if (status !== 'stable') {
      findings.push({
        page: recent.page,
        slug: recent.page.replace(`${SITE_URL}/blog/`, '').replace(/\/$/, ''),
        status,
        recent: { position: recent.position, impressions: recent.impressions, clicks: recent.clicks, ctr: recent.ctr },
        previous: { position: prev.position, impressions: prev.impressions, clicks: prev.clicks, ctr: prev.ctr },
        posDelta,
        ctrDelta,
      });
    }
  }

  return findings.sort((a, b) => b.posDelta - a.posDelta);
}

function isoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function buildIssueDescription(findings, ranges) {
  const decay = findings.filter(f => f.status === 'decay');
  const alert = findings.filter(f => f.status === 'alert');

  const lines = [
    `## Weekly Content Decay Report`,
    ``,
    `**Period:** ${ranges.previous.startDate} → ${ranges.previous.endDate} vs ${ranges.recent.startDate} → ${ranges.recent.endDate}`,
    `**Thresholds:** decay ≥${DECAY_POS_DROP} pos drop, alert ≥${ALERT_POS_DROP} pos drop or CTR ≥${ALERT_CTR_DROP * 100}% drop`,
    `**Findings:** ${decay.length} decay, ${alert.length} alert`,
    ``,
  ];

  if (decay.length > 0) {
    lines.push(`### Decay (position dropped ≥${DECAY_POS_DROP} places — needs content refresh)`);
    lines.push(``);
    lines.push(`| Article | Prev Pos | Now Pos | Drop | Prev Impr | Now Impr | CTR Δ |`);
    lines.push(`|---------|----------|---------|------|-----------|----------|--------|`);
    for (const f of decay) {
      const ctrStr = formatCtrDelta(f.ctrDelta);
      lines.push(`| [${f.slug}](${f.page}) | ${f.previous.position.toFixed(1)} | ${f.recent.position.toFixed(1)} | +${f.posDelta.toFixed(1)} | ${f.previous.impressions} | ${f.recent.impressions} | ${ctrStr} |`);
    }
    lines.push(``);
    lines.push(`**Action:** For each decay article, evaluate:`);
    lines.push(`1. Is the content outdated? (refresh stats, examples, tool versions)`);
    lines.push(`2. Are competitors outranking with better content? (check SERP)`);
    lines.push(`3. Has the page lost internal links recently? (check linking report)`);
    lines.push(``);
  }

  if (alert.length > 0) {
    lines.push(`### Alert (early warning — monitor or action)`);
    lines.push(``);
    lines.push(`| Article | Prev Pos | Now Pos | Drop | Prev Impr | Now Impr | CTR Δ |`);
    lines.push(`|---------|----------|---------|------|-----------|----------|--------|`);
    for (const f of alert) {
      const ctrStr = formatCtrDelta(f.ctrDelta);
      const dropStr = f.posDelta >= 0 ? `+${f.posDelta.toFixed(1)}` : f.posDelta.toFixed(1);
      lines.push(`| [${f.slug}](${f.page}) | ${f.previous.position.toFixed(1)} | ${f.recent.position.toFixed(1)} | ${dropStr} | ${f.previous.impressions} | ${f.recent.impressions} | ${ctrStr} |`);
    }
    lines.push(``);
    lines.push(`**Action:** Monitor next week. If trend continues, schedule a content refresh.`);
    lines.push(``);
  }

  return lines.join('\n');
}

function formatCtrDelta(delta) {
  if (delta === 0) return '—';
  const pct = (delta * 100).toFixed(0);
  return delta >= 0 ? `+${pct}%` : `${pct}%`;
}

async function createIssue(findings, ranges) {
  const decay = findings.filter(f => f.status === 'decay');
  const alert = findings.filter(f => f.status === 'alert');

  const week = `W${isoWeekNumber(new Date())}`;
  const yr = new Date().getFullYear();
  const rawTitle = `Content decay: ${decay.length}D ${alert.length}A (${week} ${yr})`;
  const title = rawTitle.slice(0, 60);
  const description = buildIssueDescription(findings, ranges);

  const apiKey = process.env.PAPERCLIP_API_KEY || getPaperclipApiKey(AGENTS.GROWTH_ANALYST);
  if (!apiKey) throw new Error('No Paperclip API key available');

  const runId = process.env.PAPERCLIP_RUN_ID || '';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Paperclip-Run-Id': runId,
  };

  // Create without assigneeAgentId — Growth Analyst lacks tasks:assign permission.
  // Notify Content Manager via comment mention after creation.
  const body = {
    title,
    description,
    status: 'todo',
    priority: decay.length > 0 ? 'high' : 'medium',
    projectId: PAPERCLIP_PROJECT_ID,
  };

  const res = await fetch(`${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Paperclip API ${res.status}: ${txt}`);
  }

  const issue = await res.json();

  // @mention Content Manager so they get a heartbeat wake
  const commentBody = `@Content Manager — ${decay.length} articles in decay, ${alert.length} on alert this week.\n\nDecay articles need a content refresh (check SERP competitors, update stats/examples). Alert articles need monitoring — if trend continues next week, schedule refresh. Full report in the description above.`;
  await fetch(`${PAPERCLIP_API_URL}/api/issues/${issue.id}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: commentBody }),
  });

  return issue;
}

async function main() {
  log(`Content Decay Check — ${new Date().toISOString().slice(0, 10)}`);

  const ranges = buildRanges();
  log(`Recent period:   ${ranges.recent.startDate} → ${ranges.recent.endDate}`);
  log(`Previous period: ${ranges.previous.startDate} → ${ranges.previous.endDate}`);

  log('\nFetching GSC data for both periods...');
  const sc = await getSearchConsole();
  const [recentPages, previousPages] = await Promise.all([
    queryPages(sc, ranges.recent),
    queryPages(sc, ranges.previous),
  ]);

  log(`Recent: ${recentPages.length} pages | Previous: ${previousPages.length} pages`);

  const findings = comparePages(recentPages, previousPages);
  const decay = findings.filter(f => f.status === 'decay');
  const alert = findings.filter(f => f.status === 'alert');

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ ranges, findings, summary: { decay: decay.length, alert: alert.length } }, null, 2));
    return;
  }

  if (findings.length === 0) {
    log('\nAll tracked pages are stable — no action required.');
    return;
  }

  log(`\nDecay: ${decay.length} | Alert: ${alert.length}`);
  for (const f of findings) {
    const dropStr = f.posDelta >= 0 ? `+${f.posDelta.toFixed(1)}` : f.posDelta.toFixed(1);
    log(`  [${f.status.toUpperCase()}] ${f.slug} — pos ${f.previous.position.toFixed(1)} → ${f.recent.position.toFixed(1)} (${dropStr})`);
  }

  if (DRY_RUN) {
    log('\n--- DRY RUN ---');
    log(buildIssueDescription(findings, ranges));
    return;
  }

  log('\nCreating Content Manager issue...');
  const issue = await createIssue(findings, ranges);
  log(`Created: ${issue.identifier} — ${issue.title}`);

  return { findings, issue };
}

main().catch(e => {
  console.error(`Content decay check failed: ${e.message}`);
  process.exit(1);
});
