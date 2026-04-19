#!/usr/bin/env node
/**
 * social-draft.mjs — CLI for agents to manage social post drafts.
 * Drafts are stored in /home/luca/superdots-cms/data/social-drafts.json
 * and picked up by the hub for Luca's approval before scheduling.
 *
 * Usage:
 *   node social-draft.mjs create --slug <slug> --platform linkedin --content "<text>" \
 *     --scheduled-at 2026-04-14T09:00:00+02:00 --created-by "Content Manager" \
 *     [--image-url <url>] [--department <dept>] [--hook-suggestion "<text>"] \
 *     [--recommended-format insight-stat|how-to|contrarian] [--issue-id <id>] \
 *     [--image-style <style>] [--experiment <tag>] [--force] \
 *     [--post-format image|carousel|link-only|document|video|text-only] \
 *     [--media-urls <url1>,<url2>,...] [--document-url <url>] [--article-url <url>]
 *
 *   node social-draft.mjs list [--status draft|scheduled|published|failed] [--slug <slug>] [--json]
 *   node social-draft.mjs update <id> [--content "<text>"] [--scheduled-at ISO] [--image-url <url>]
 *   node social-draft.mjs delete <id>
 *   node social-draft.mjs get <id> [--json]
 */

import { readFile, writeFile, unlink, rename, mkdir, open } from 'fs/promises';
import path from 'path';

const DATA_DIR = '/home/luca/superdots-cms/data';
const DRAFTS_FILE = path.join(DATA_DIR, 'social-drafts.json');
const TMP_FILE = path.join(DATA_DIR, 'social-drafts.json.tmp');
const LOCK_FILE = path.join(DATA_DIR, 'social-drafts.lock');
const LOCK_TIMEOUT_MS = 5000;

// Integration IDs — keep in sync with src/lib/social/platforms.ts
const INTEGRATION_IDS = {
  linkedin: 'cmns03m1p00a9oe0yzm2kh5wp',
  facebook: 'cmns0c0bh00bzn70yamri4j59',
};

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const command = args.find((a) => !a.startsWith('--'));

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

// ── Store helpers ─────────────────────────────────────────────────────────────

async function acquireLock() {
  let start = Date.now();
  while (true) {
    try {
      // 'wx' = exclusive create — atomic on POSIX, throws EEXIST if already present
      const fh = await open(LOCK_FILE, 'wx');
      await fh.writeFile(process.pid.toString());
      await fh.close();
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() - start > LOCK_TIMEOUT_MS) {
        // Stale lock — attempt removal and reset the timeout window
        try { await unlink(LOCK_FILE); } catch {}
        start = Date.now();
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

async function releaseLock() {
  try { await unlink(LOCK_FILE); } catch {}
}

async function readDrafts() {
  try {
    const raw = await readFile(DRAFTS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.error(`[WARN] social-drafts.json is not an array — treating as empty`);
      return [];
    }
    return data;
  } catch (e) {
    if (e.code === 'ENOENT') return []; // file doesn't exist yet — OK
    // File exists but is corrupt — don't silently return [] (next write would destroy data)
    console.error(`[ERROR] social-drafts.json is corrupt: ${e.message}`);
    // Back up the corrupt file so we don't lose whatever data is there
    try { await rename(DRAFTS_FILE, DRAFTS_FILE + '.corrupt.' + Date.now()); } catch {}
    return [];
  }
}

async function writeDraftsAtomic(drafts) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TMP_FILE, JSON.stringify(drafts, null, 2), 'utf-8');
  await rename(TMP_FILE, DRAFTS_FILE);
}

/**
 * Read-modify-write under lock.
 * The callback receives current drafts and must return the new array.
 * This prevents lost-update races by reading INSIDE the lock.
 */
async function withLockedDrafts(fn) {
  await acquireLock();
  try {
    const drafts = await readDrafts();
    const { result, newDrafts } = await fn(drafts);
    if (newDrafts) await writeDraftsAtomic(newDrafts);
    return result;
  } finally {
    await releaseLock();
  }
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdCreate() {
  const slug = getFlag('--slug');
  const platform = getFlag('--platform');
  const content = getFlag('--content');
  const scheduledAt = getFlag('--scheduled-at');
  const createdBy = getFlag('--created-by');

  if (!slug || !platform || !content || !scheduledAt || !createdBy) {
    err('Missing required flags: --slug, --platform, --content, --scheduled-at, --created-by');
  }

  const integrationId = INTEGRATION_IDS[platform];
  if (!integrationId) {
    err(`Unknown platform: ${platform}. Known: ${Object.keys(INTEGRATION_IDS).join(', ')}`);
  }

  // ── Post format handling
  const VALID_FORMATS = ['image', 'carousel', 'link-only', 'document', 'video', 'text-only'];
  const postFormat = getFlag('--post-format') || 'image';
  if (!VALID_FORMATS.includes(postFormat)) {
    err(`Invalid --post-format: ${postFormat}. Valid: ${VALID_FORMATS.join(', ')}`);
  }

  const mediaUrlsRaw = getFlag('--media-urls');
  const mediaUrls = mediaUrlsRaw ? mediaUrlsRaw.split(',').map(u => u.trim()).filter(Boolean) : undefined;
  const documentUrl = getFlag('--document-url') || undefined;
  const articleUrl = getFlag('--article-url') || undefined;

  // Format-specific validation
  if (postFormat === 'carousel') {
    if (!mediaUrls || mediaUrls.length < 2) err('Carousel requires --media-urls with at least 2 comma-separated URLs.');
    if (mediaUrls.length > 10) err('Carousel supports max 10 slides.');
  }
  if (postFormat === 'link-only' && !articleUrl) err('Link-only requires --article-url.');
  if (postFormat === 'document' && !documentUrl) err('Document requires --document-url.');
  if (postFormat === 'video') {
    if (!mediaUrls || mediaUrls.length !== 1) err('Video requires --media-urls with exactly 1 video URL.');
  }

  const draft = {
    id: generateId(),
    slug,
    platform,
    integrationId,
    content,
    postFormat,
    imageUrl: getFlag('--image-url') || undefined,
    mediaUrls,
    documentUrl,
    articleUrl,
    scheduledAt: new Date(scheduledAt).toISOString(),
    status: 'draft',
    department: getFlag('--department') || undefined,
    recommendedFormat: getFlag('--recommended-format') || undefined,
    hookSuggestion: getFlag('--hook-suggestion') || undefined,
    imageStyle: getFlag('--image-style') || undefined,
    experiment: getFlag('--experiment') || undefined,
    createdBy,
    issueId: getFlag('--issue-id') || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Auto-compute quality score
  draft.qualityScore = computeQualityScore(draft);

  const dupResult = await withLockedDrafts((drafts) => {
    // Dedup guard inside lock — reject if a non-failed draft already exists for slug+platform
    const existing = drafts.find(d => d.slug === slug && d.platform === platform && d.status !== 'failed');
    if (existing && !args.includes('--force')) {
      return { result: { duplicate: true, existing }, newDrafts: null };
    }
    return { result: { duplicate: false }, newDrafts: [...drafts, draft] };
  });
  if (dupResult.duplicate) {
    err(`Duplicate blocked: draft "${dupResult.existing.id}" already exists for ${slug}/${platform} (status: ${dupResult.existing.status}). Use --force to override.`);
  }

  if (jsonOutput) { out(draft); } else {
    log(`Draft created: ${draft.id} (quality: ${draft.qualityScore}/100)`);
    log(`Platform: ${draft.platform} | Scheduled: ${scheduledAt}`);
    log(`View in hub: https://cms.superdots.sh/social`);
  }
}

async function cmdList() {
  const statusFilter = getFlag('--status');
  const slugFilter = getFlag('--slug');
  let drafts = await readDrafts();

  if (statusFilter) drafts = drafts.filter((d) => d.status === statusFilter);
  if (slugFilter) drafts = drafts.filter((d) => d.slug === slugFilter);

  if (jsonOutput) { out(drafts); return; }

  if (drafts.length === 0) { log('No drafts found.'); return; }
  for (const d of drafts) {
    log(`[${d.status.toUpperCase().padEnd(9)}] ${d.id}  ${d.platform.padEnd(8)}  ${d.scheduledAt.slice(0, 16)}  ${d.slug}`);
  }
}

async function cmdUpdate() {
  const id = args.find((a) => !a.startsWith('--') && a !== 'update');
  if (!id) err('Usage: social-draft.mjs update <id> [--content <text>] [--scheduled-at ISO] [--image-url <url>]');

  const patch = { updatedAt: new Date().toISOString() };
  if (getFlag('--content')) patch.content = getFlag('--content');
  if (getFlag('--scheduled-at')) patch.scheduledAt = new Date(getFlag('--scheduled-at')).toISOString();
  if (getFlag('--image-url')) patch.imageUrl = getFlag('--image-url');
  if (getFlag('--post-format')) {
    const VALID_FORMATS = ['image', 'carousel', 'link-only', 'document', 'video', 'text-only'];
    const pf = getFlag('--post-format');
    if (!VALID_FORMATS.includes(pf)) err(`Invalid --post-format: ${pf}. Valid: ${VALID_FORMATS.join(', ')}`);
    patch.postFormat = pf;
  }
  if (getFlag('--media-urls')) patch.mediaUrls = getFlag('--media-urls').split(',').map(u => u.trim()).filter(Boolean);
  if (getFlag('--document-url')) patch.documentUrl = getFlag('--document-url');
  if (getFlag('--article-url')) patch.articleUrl = getFlag('--article-url');

  const result = await withLockedDrafts((drafts) => {
    const idx = drafts.findIndex((d) => d.id === id);
    if (idx === -1) return { result: null, newDrafts: null };
    drafts[idx] = { ...drafts[idx], ...patch };
    drafts[idx].qualityScore = computeQualityScore(drafts[idx]);
    return { result: drafts[idx], newDrafts: drafts };
  });
  if (!result) err(`Draft not found: ${id}`);

  if (jsonOutput) { out(result); } else { log(`Draft updated: ${id} (quality: ${result.qualityScore}/100)`); }
}

async function cmdDelete() {
  const id = args.find((a) => !a.startsWith('--') && a !== 'delete');
  if (!id) err('Usage: social-draft.mjs delete <id>');

  const found = await withLockedDrafts((drafts) => {
    const filtered = drafts.filter((d) => d.id !== id);
    if (filtered.length === drafts.length) return { result: false, newDrafts: null };
    return { result: true, newDrafts: filtered };
  });
  if (!found) err(`Draft not found: ${id}`);

  if (jsonOutput) { out({ ok: true }); } else { log(`Draft deleted: ${id}`); }
}

async function cmdGet() {
  const id = args.find((a) => !a.startsWith('--') && a !== 'get');
  if (!id) err('Usage: social-draft.mjs get <id>');

  const drafts = await readDrafts();
  const draft = drafts.find((d) => d.id === id);
  if (!draft) err(`Draft not found: ${id}`);

  if (jsonOutput) { out(draft); } else {
    log(`ID:         ${draft.id}`);
    log(`Platform:   ${draft.platform}`);
    log(`Status:     ${draft.status}`);
    log(`Slug:       ${draft.slug}`);
    log(`Scheduled:  ${draft.scheduledAt}`);
    log(`Content:    ${draft.content.slice(0, 100)}…`);
  }
}

// ── Scheduling intelligence ──────────────────────────────────────────────────

const ROME_TZ = 'Europe/Rome';
const DEFAULT_CADENCE = {
  linkedin: { days: [1, 3, 5], hours: [9] },   // Mon/Wed/Fri 09:00
  facebook: { days: [2, 4], hours: [12] },      // Tue/Thu 12:00
};

function toRomeDate(iso) {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: ROME_TZ }));
}

function getPublishedWithAnalytics(drafts) {
  return drafts.filter(d => d.status === 'published' && d.analytics && d.analytics.impressions != null);
}

function computeEngagementScore(a) {
  return (a.impressions ?? 0) * 0.3 + (a.reactions ?? 0) * 0.4 + (a.clicks ?? 0) * 0.3;
}

async function cmdBestTimes() {
  const platform = getFlag('--platform');
  const drafts = await readDrafts();
  let published = getPublishedWithAnalytics(drafts);
  if (platform) published = published.filter(d => d.platform === platform);

  if (published.length < 10) {
    const result = { status: 'insufficient_data', count: published.length, minimumRequired: 10, fallback: DEFAULT_CADENCE };
    if (jsonOutput) { out(result); } else {
      log(`Insufficient data: ${published.length}/10 published posts with analytics.`);
      log('Falling back to default cadence.');
    }
    return;
  }

  // Group by platform + day-of-week + hour
  const buckets = {};
  for (const d of published) {
    const rome = toRomeDate(d.scheduledAt);
    const key = `${d.platform}|${rome.getDay()}|${rome.getHours()}`;
    if (!buckets[key]) buckets[key] = { platform: d.platform, day: rome.getDay(), hour: rome.getHours(), scores: [] };
    buckets[key].scores.push(computeEngagementScore(d.analytics));
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ranked = Object.values(buckets)
    .map(b => ({ ...b, avgScore: b.scores.reduce((a, s) => a + s, 0) / b.scores.length, count: b.scores.length }))
    .sort((a, b) => b.avgScore - a.avgScore);

  if (jsonOutput) { out(ranked); return; }

  log('Best posting times (ranked by avg engagement score):');
  log('');
  log('Platform   Day    Hour   Avg Score   Posts');
  log('─'.repeat(50));
  for (const r of ranked.slice(0, 10)) {
    log(`${r.platform.padEnd(10)} ${dayNames[r.day].padEnd(6)} ${String(r.hour).padStart(2)}:00  ${r.avgScore.toFixed(1).padStart(9)}   ${r.count}`);
  }
}

async function cmdSuggestSlot() {
  const platform = getFlag('--platform');
  if (!platform) err('Usage: social-draft.mjs suggest-slot --platform linkedin|facebook');

  const integrationId = INTEGRATION_IDS[platform];
  if (!integrationId) err(`Unknown platform: ${platform}`);

  const drafts = await readDrafts();

  // Get taken slots (draft or scheduled)
  const takenSlots = drafts
    .filter(d => d.platform === platform && ['draft', 'scheduled'].includes(d.status))
    .map(d => d.scheduledAt);

  // Try Postiz find-slot API
  let postizSlot = null;
  try {
    const { execSync } = await import('child_process');
    const raw = execSync(
      `node /home/luca/superdots-blog/scripts/tools/postiz.mjs find-slot ${integrationId} --json`,
      { encoding: 'utf-8', timeout: 15000 }
    ).trim();
    const parsed = JSON.parse(raw);
    postizSlot = parsed.date || parsed.slot || null;
  } catch {}

  // Get best times from analytics
  const published = getPublishedWithAnalytics(drafts).filter(d => d.platform === platform);
  let bestHours = null;
  if (published.length >= 10) {
    const hourBuckets = {};
    for (const d of published) {
      const rome = toRomeDate(d.scheduledAt);
      const h = rome.getHours();
      if (!hourBuckets[h]) hourBuckets[h] = [];
      hourBuckets[h].push(computeEngagementScore(d.analytics));
    }
    bestHours = Object.entries(hourBuckets)
      .map(([h, scores]) => ({ hour: Number(h), avgScore: scores.reduce((a, s) => a + s, 0) / scores.length }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3);
  }

  // Find next available slot using cadence
  const cadence = DEFAULT_CADENCE[platform];
  const now = new Date();
  const candidates = [];
  const preferredHour = bestHours ? bestHours[0].hour : cadence.hours[0];

  // Compute Rome's UTC offset dynamically (handles CET/CEST transitions correctly)
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: ROME_TZ, timeZoneName: 'shortOffset' });
  const tzPart = fmt.formatToParts(now).find(p => p.type === 'timeZoneName');
  const offsetMatch = tzPart?.value?.match(/GMT([+-]\d+)/);
  const romeOffsetHours = offsetMatch ? Number(offsetMatch[1]) : 1;

  // Iterate over the next 30 Rome-local dates
  const todayRome = now.toLocaleDateString('en-CA', { timeZone: ROME_TZ }); // YYYY-MM-DD
  for (let d = 0; d < 30; d++) {
    // Build Rome-local date for preferredHour, then convert to UTC
    const romeDate = new Date(todayRome + 'T12:00:00Z'); // noon placeholder
    romeDate.setUTCDate(romeDate.getUTCDate() + d);
    // Check day-of-week in Rome time
    const romeDayStr = romeDate.toLocaleDateString('en-US', { timeZone: ROME_TZ, weekday: 'long' });
    const romeDow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(romeDayStr);
    if (!cadence.days.includes(romeDow)) continue;

    // Convert Rome preferredHour → UTC
    const utcDate = new Date(romeDate);
    utcDate.setUTCHours(preferredHour - romeOffsetHours, 0, 0, 0);
    const iso = utcDate.toISOString();

    // Skip if in the past
    if (utcDate <= now) continue;

    // Check conflicts with taken slots (same date)
    const dateStr = iso.slice(0, 10);
    const conflict = takenSlots.some(s => s.slice(0, 10) === dateStr);
    const dayLabel = utcDate.toLocaleDateString('en-GB', { weekday: 'short', timeZone: ROME_TZ });
    candidates.push({ date: iso, romeTime: `${dayLabel} ${preferredHour}:00`, conflict });
  }

  const nextFree = candidates.find(c => !c.conflict);

  const result = {
    platform,
    postizSuggestion: postizSlot,
    suggestedSlot: nextFree || null,
    takenSlots: takenSlots.slice(0, 10),
    bestHours,
    nextCandidates: candidates.slice(0, 8),
  };

  if (jsonOutput) { out(result); return; }

  log(`Platform: ${platform}`);
  if (postizSlot) log(`Postiz suggestion: ${postizSlot}`);
  if (nextFree) log(`Next free slot: ${nextFree.romeTime} (${nextFree.date})`);
  if (bestHours) {
    log(`Best hours (from analytics): ${bestHours.map(h => `${h.hour}:00 (score: ${h.avgScore.toFixed(1)})`).join(', ')}`);
  } else {
    log('No analytics data yet — using default cadence.');
  }
  log(`Taken slots: ${takenSlots.length}`);
}

async function cmdPerformanceReport() {
  const platform = getFlag('--platform');
  const drafts = await readDrafts();
  let published = getPublishedWithAnalytics(drafts);
  if (platform) published = published.filter(d => d.platform === platform);

  if (published.length === 0) {
    const result = { status: 'no_data', message: 'No published posts with analytics data.' };
    if (jsonOutput) { out(result); } else { log('No published posts with analytics data.'); }
    return;
  }

  // 1. Format performance
  const formatGroups = {};
  for (const d of published) {
    const fmt = d.recommendedFormat || 'unknown';
    if (!formatGroups[fmt]) formatGroups[fmt] = [];
    formatGroups[fmt].push(d.analytics);
  }
  const formatPerf = Object.entries(formatGroups).map(([fmt, analytics]) => ({
    format: fmt,
    count: analytics.length,
    avgImpressions: Math.round(analytics.reduce((s, a) => s + (a.impressions ?? 0), 0) / analytics.length),
    avgReactions: Math.round(analytics.reduce((s, a) => s + (a.reactions ?? 0), 0) / analytics.length),
    avgClicks: Math.round(analytics.reduce((s, a) => s + (a.clicks ?? 0), 0) / analytics.length),
    avgScore: +(analytics.reduce((s, a) => s + computeEngagementScore(a), 0) / analytics.length).toFixed(1),
  })).sort((a, b) => b.avgScore - a.avgScore);

  // 2. Style performance
  const styleGroups = {};
  for (const d of published) {
    const style = d.imageStyle || 'unknown';
    if (!styleGroups[style]) styleGroups[style] = [];
    styleGroups[style].push(d.analytics);
  }
  const stylePerf = Object.entries(styleGroups).map(([style, analytics]) => ({
    style,
    count: analytics.length,
    avgScore: +(analytics.reduce((s, a) => s + computeEngagementScore(a), 0) / analytics.length).toFixed(1),
  })).sort((a, b) => b.avgScore - a.avgScore);

  // 3. Platform × day
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const platformDayGroups = {};
  for (const d of published) {
    const rome = toRomeDate(d.scheduledAt);
    const key = `${d.platform}|${dayNames[rome.getDay()]}`;
    if (!platformDayGroups[key]) platformDayGroups[key] = { platform: d.platform, day: dayNames[rome.getDay()], scores: [] };
    platformDayGroups[key].scores.push(computeEngagementScore(d.analytics));
  }
  const platformDayPerf = Object.values(platformDayGroups)
    .map(g => ({ ...g, avgScore: +(g.scores.reduce((a, s) => a + s, 0) / g.scores.length).toFixed(1), count: g.scores.length }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // 4. Top 5 posts
  const top5 = [...published]
    .map(d => ({ slug: d.slug, platform: d.platform, score: computeEngagementScore(d.analytics), ...d.analytics }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // 5. Post format performance
  const postFormatGroups = {};
  for (const d of published) {
    const pf = d.postFormat || 'image';
    if (!postFormatGroups[pf]) postFormatGroups[pf] = [];
    postFormatGroups[pf].push(d.analytics);
  }
  const postFormatPerf = Object.entries(postFormatGroups).map(([pf, analytics]) => ({
    postFormat: pf,
    count: analytics.length,
    avgImpressions: Math.round(analytics.reduce((s, a) => s + (a.impressions ?? 0), 0) / analytics.length),
    avgReactions: Math.round(analytics.reduce((s, a) => s + (a.reactions ?? 0), 0) / analytics.length),
    avgClicks: Math.round(analytics.reduce((s, a) => s + (a.clicks ?? 0), 0) / analytics.length),
    avgScore: +(analytics.reduce((s, a) => s + computeEngagementScore(a), 0) / analytics.length).toFixed(1),
  })).sort((a, b) => b.avgScore - a.avgScore);

  // 6. Experiment results (if any)
  const experimentGroups = {};
  for (const d of published) {
    if (!d.experiment) continue;
    if (!experimentGroups[d.experiment]) experimentGroups[d.experiment] = [];
    experimentGroups[d.experiment].push(d.analytics);
  }
  const experimentPerf = Object.entries(experimentGroups).map(([tag, analytics]) => ({
    experiment: tag,
    count: analytics.length,
    avgScore: +(analytics.reduce((s, a) => s + computeEngagementScore(a), 0) / analytics.length).toFixed(1),
  })).sort((a, b) => b.avgScore - a.avgScore);

  const result = { totalPublished: published.length, formatPerformance: formatPerf, stylePerformance: stylePerf, postFormatPerformance: postFormatPerf, platformDayPerformance: platformDayPerf, top5Posts: top5, experiments: experimentPerf.length > 0 ? experimentPerf : undefined };

  if (jsonOutput) { out(result); return; }

  log(`\nSocial Performance Report (${published.length} posts with analytics)\n`);
  log('── Format Performance ──');
  for (const f of formatPerf) log(`  ${f.format.padEnd(15)} ${f.count} posts  avg: ${f.avgImpressions} imp / ${f.avgReactions} react / ${f.avgClicks} clicks (score: ${f.avgScore})`);
  log('\n── Post Format Performance ──');
  for (const p of postFormatPerf) log(`  ${p.postFormat.padEnd(15)} ${p.count} posts  avg: ${p.avgImpressions} imp / ${p.avgReactions} react / ${p.avgClicks} clicks (score: ${p.avgScore})`);
  log('\n── Image Style Performance ──');
  for (const s of stylePerf) log(`  ${s.style.padEnd(20)} ${s.count} posts  score: ${s.avgScore}`);
  log('\n── Platform × Day ──');
  for (const p of platformDayPerf) log(`  ${p.platform.padEnd(10)} ${p.day.padEnd(5)} ${p.count} posts  score: ${p.avgScore}`);
  log('\n── Top 5 Posts ──');
  for (const t of top5) log(`  ${t.platform.padEnd(10)} ${t.slug.slice(0, 40).padEnd(42)} ${t.impressions} imp / ${t.reactions} react / ${t.clicks} clicks`);
  if (experimentPerf.length > 0) {
    log('\n── Experiments ──');
    for (const e of experimentPerf) log(`  ${e.experiment.padEnd(30)} ${e.count} posts  score: ${e.avgScore}`);
  }
}

// ── Quality scoring ──────────────────────────────────────────────────────────

const PLATFORM_SWEET_SPOT = {
  linkedin: { min: 1000, max: 1500 },
  facebook: { min: 250, max: 600 },
};
const PLATFORM_HASHTAG_LIMIT = { linkedin: 3, facebook: 0 };

function computeQualityScore(draft) {
  let score = 0;
  const fmt = draft.postFormat || 'image';

  // Content length in sweet spot (20 pts, or 25 for text-only)
  const maxPts = fmt === 'text-only' ? 25 : 20;
  const textOnlySpot = { linkedin: { min: 1200, max: 1800 }, facebook: { min: 300, max: 600 } };
  const linkOnlySpot = { linkedin: { min: 400, max: 600 }, facebook: { min: 100, max: 200 } };
  const spot = fmt === 'text-only' ? textOnlySpot[draft.platform]
    : fmt === 'link-only' ? linkOnlySpot[draft.platform]
    : PLATFORM_SWEET_SPOT[draft.platform];
  if (spot) {
    const len = draft.content.length;
    if (len >= spot.min && len <= spot.max) score += maxPts;
    else if (len >= spot.min * 0.8 && len <= spot.max * 1.2) score += Math.round(maxPts / 2);
  }

  // Contains blog link (10 pts, 15 for link-only)
  const linkPts = fmt === 'link-only' ? 15 : 10;
  if (/superdots\.sh\/blog\/|\/blog\//.test(draft.content)) score += linkPts;

  // Hashtag count OK (10 pts)
  const hashtagCount = (draft.content.match(/#\w+/g) || []).length;
  const limit = PLATFORM_HASHTAG_LIMIT[draft.platform] ?? 3;
  if (draft.platform === 'facebook') {
    if (hashtagCount === 0) score += 10;
  } else {
    if (hashtagCount >= 1 && hashtagCount <= limit) score += 10;
  }

  // Media present (15 pts) — format-aware
  if (fmt === 'image') {
    if (draft.imageUrl && draft.imageUrl.startsWith('http')) score += 15;
  } else if (fmt === 'carousel') {
    if (draft.mediaUrls && draft.mediaUrls.length >= 2) score += 15;
  } else if (fmt === 'document') {
    if (draft.documentUrl && draft.documentUrl.startsWith('http')) score += 15;
  } else if (fmt === 'video') {
    if (draft.mediaUrls && draft.mediaUrls.length === 1) score += 15;
  }
  // link-only and text-only: skip media check (0 pts allocated)

  // Hook present — aligned with AGENTS.md hook patterns A/B/C (20 pts)
  const firstLine = draft.content.split('\n')[0].trim();
  const hookA = /^\$?\d.*\b(but|yet|however|actually|instead|problem|wrong|not|don't|isn't)\b/i;
  const hookB = /^(?:you(?:'re| are)|most|stop|the .* (?:isn't|is not|won't|doesn't))/i;
  const hookC = /^\$[\d,.]+|^\d+[\d,.]*\s*(%|x\b|hours?|days?|minutes?|\/mo)/i;
  const hookQuote = /^[""\u201C]/;
  if (hookA.test(firstLine) || hookB.test(firstLine) || hookC.test(firstLine) || hookQuote.test(firstLine)) score += 20;
  else if (/^[A-Z]/.test(firstLine) && firstLine.length > 40 && !/[?]$/.test(firstLine)) score += 10;

  // Contains a specific number, price, or data point (10 pts)
  if (/\$[\d,.]+|\d+%|\d+x\b|\d+\s*(hours?|days?|minutes?|\/mo|users?|teams?)/.test(draft.content)) score += 10;

  // No banned phrases (15 pts)
  const banned = [
    'revolutionize', 'game-changer', 'game changer', 'synergy', 'leverage', 'paradigm shift',
    'disrupt', 'digital transformation', 'in today\'s world', 'in today\'s fast-paced',
    'ever-changing', 'let\'s face it', 'it\'s important to note', 'it\'s worth mentioning',
    'before we dive in', 'let\'s explore', 'hai mai pensato',
    'agree?', 'comment below', 'tag someone', 'like if you', 'share if you', 'repost if',
  ];
  const lower = draft.content.toLowerCase();
  if (!banned.some(b => lower.includes(b))) score += 15;

  // Normalize to 0-100
  if (fmt === 'text-only' || fmt === 'link-only') {
    score = Math.round((score / 90) * 100);
  }
  return Math.min(score, 100);
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!command || command === '--help') {
  console.log(`Usage: node social-draft.mjs <command> [options]

Commands:
  create             Create a new social draft [--force to override dedup]
  list               List drafts [--status <s>] [--slug <slug>]
  update <id>        Update a draft [--content <text>] [--scheduled-at ISO] [--image-url <url>]
  delete <id>        Delete a draft
  get <id>           Get a single draft
  suggest-slot       Find next available posting slot --platform linkedin|facebook
  best-times         Analyze best posting times from analytics [--platform <p>]
  performance-report Social performance by format, style, timing [--platform <p>]

Create flags:
  --slug, --platform, --content, --scheduled-at, --created-by  (required)
  --image-url <url>           Single image URL (for image format)
  --post-format <format>      image|carousel|link-only|document|video|text-only (default: image)
  --media-urls <url1>,<url2>  Comma-separated URLs (carousel: 2-10 slides, video: 1 URL)
  --document-url <url>        PDF URL (for document format)
  --article-url <url>         Blog URL (for link-only format)
  --department, --recommended-format, --hook-suggestion, --issue-id

Options:
  --json   Output raw JSON
  --help   Show this help`);
  process.exit(0);
}

switch (command) {
  case 'create':             await cmdCreate(); break;
  case 'list':               await cmdList(); break;
  case 'update':             await cmdUpdate(); break;
  case 'delete':             await cmdDelete(); break;
  case 'get':                await cmdGet(); break;
  case 'suggest-slot':       await cmdSuggestSlot(); break;
  case 'best-times':         await cmdBestTimes(); break;
  case 'performance-report': await cmdPerformanceReport(); break;
  default: err(`Unknown command: ${command}. Run with --help for usage.`);
}
