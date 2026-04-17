#!/usr/bin/env node
/**
 * CMS notification writer + Web Push sender
 *
 * Writes directly to the superdots-cms notification history and optionally
 * sends Web Push notifications. Used by Paperclip agents to push campaign
 * reports, alerts, and other notifications to Luca's CMS dashboard.
 *
 * Usage:
 *   node scripts/tools/notify-cms.mjs --type <type> --title "..." --body "..." [options]
 *
 * Options:
 *   --type       Notification type (campaign_daily_report, campaign_alert, campaign_weekly_report, etc.)
 *   --title      Notification title
 *   --body       Short preview text (≤120 chars, shown in list view)
 *   --detail     Full markdown text (shown in detail view). Use @file to read from file.
 *   --agent      Agent name (e.g. "Reddit Ads Specialist")
 *   --url        Deep link URL (default: "/routines")
 *   --metadata   JSON metadata object
 *   --no-push    Skip Web Push, only write to history file
 *   --json       Output result as JSON
 *   --help       Show this help
 */

import { readFile, writeFile, rename } from 'fs/promises';
import { randomUUID } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CMS_DATA_DIR = '/home/luca/superdots-cms/data';
const NOTIF_HISTORY_FILE = resolve(CMS_DATA_DIR, 'notification-history.json');
const SUBS_FILE = resolve(CMS_DATA_DIR, 'push-subscriptions.json');
const NOTIF_HISTORY_MAX = 200;

const HELP = `Usage: node notify-cms.mjs --type <type> --title "..." --body "..." [options]

Types:
  campaign_daily_report    Daily campaign performance report
  campaign_alert           Campaign alert (budget, launch, anomaly)
  campaign_weekly_report   Weekly campaign summary
  routine_completed        (existing) Routine completed
  routine_failed           (existing) Routine failed

Options:
  --type <type>     Notification type (required)
  --title <text>    Title (required)
  --body <text>     Short preview ≤120 chars (required)
  --detail <text>   Full markdown for detail view. Use @<filepath> to read from file.
  --agent <name>    Agent name (default: "Reddit Ads Specialist")
  --url <path>      Deep link (default: "/routines")
  --metadata <json> JSON metadata object
  --no-push         Only write to history, skip Web Push
  --json            Output as JSON
  --help            Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

function getOpt(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : null;
}

const jsonOutput = args.includes('--json');
const noPush = args.includes('--no-push');

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

const type = getOpt('type');
const title = getOpt('title');
const body = getOpt('body');
let detail = getOpt('detail');
const agentName = getOpt('agent') || 'Reddit Ads Specialist';
const url = getOpt('url') || '/routines';
const metadataRaw = getOpt('metadata');

if (!type) err('Missing --type');
if (!title) err('Missing --title');
if (!body) err('Missing --body');

if (detail && detail.startsWith('@')) {
  try {
    detail = await readFile(detail.slice(1), 'utf-8');
  } catch (e) {
    err(`Cannot read detail file: ${e.message}`);
  }
}

let metadata = {};
if (metadataRaw) {
  try { metadata = JSON.parse(metadataRaw); } catch { err(`Invalid --metadata JSON: ${metadataRaw}`); }
}

const entry = {
  id: randomUUID(),
  timestamp: new Date().toISOString(),
  type,
  title,
  body: body.slice(0, 120),
  detail: detail || undefined,
  url,
  agentName,
  read: false,
  status: type.includes('alert') ? 'alert' : type.includes('daily') ? 'report' : 'summary',
  metadata,
};

async function writeNotificationHistory(newEntry) {
  let history = [];
  try {
    const raw = await readFile(NOTIF_HISTORY_FILE, 'utf-8');
    history = JSON.parse(raw);
  } catch { /* file doesn't exist yet */ }
  history.unshift(newEntry);
  history = history.slice(0, NOTIF_HISTORY_MAX);
  const tmp = NOTIF_HISTORY_FILE + '.tmp';
  await writeFile(tmp, JSON.stringify(history, null, 2));
  await rename(tmp, NOTIF_HISTORY_FILE);
}

async function sendWebPush(newEntry) {
  const {
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
  } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    log('  Web Push skipped (missing VAPID env vars)');
    return 0;
  }

  let webpush;
  try {
    webpush = (await import('web-push')).default;
  } catch {
    log('  Web Push skipped (web-push not installed)');
    return 0;
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let subs = [];
  try {
    const raw = await readFile(SUBS_FILE, 'utf-8');
    subs = JSON.parse(raw);
  } catch {
    log('  Web Push skipped (no subscriptions)');
    return 0;
  }

  const payload = JSON.stringify({
    title: newEntry.title,
    body: newEntry.body,
    data: { url: `/?notification=${newEntry.id}`, notificationId: newEntry.id },
  });

  let sent = 0;
  const live = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub.subscription || sub, payload);
      sent++;
      live.push(sub);
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        log(`  Removing stale subscription: ${e.statusCode}`);
      } else {
        live.push(sub);
      }
    }
  }
  if (live.length < subs.length) {
    try {
      const tmp = SUBS_FILE + '.tmp';
      await writeFile(tmp, JSON.stringify(live, null, 2));
      await rename(tmp, SUBS_FILE);
    } catch {}
  }
  return sent;
}

try {
  await writeNotificationHistory(entry);
  log(`Notification written: ${entry.id}`);
  log(`  Type: ${type}`);
  log(`  Title: ${title}`);

  let pushSent = 0;
  if (!noPush) {
    pushSent = await sendWebPush(entry);
    log(`  Web Push sent: ${pushSent}`);
  }

  if (jsonOutput) {
    out({ success: true, id: entry.id, pushSent });
  }
} catch (e) {
  if (jsonOutput) { out({ success: false, error: e.message }); } else { err(e.message); }
}
