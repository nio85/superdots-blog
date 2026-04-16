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
 *     [--recommended-format insight-stat|how-to|contrarian] [--issue-id <id>]
 *
 *   node social-draft.mjs list [--status draft|scheduled|published|failed] [--slug <slug>] [--json]
 *   node social-draft.mjs update <id> [--content "<text>"] [--scheduled-at ISO] [--image-url <url>]
 *   node social-draft.mjs delete <id>
 *   node social-draft.mjs get <id> [--json]
 */

import { readFile, writeFile, unlink, rename, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
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
  const start = Date.now();
  while (existsSync(LOCK_FILE)) {
    if (Date.now() - start > LOCK_TIMEOUT_MS) {
      try { await unlink(LOCK_FILE); } catch {}
      break;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  await writeFile(LOCK_FILE, process.pid.toString());
}

async function releaseLock() {
  try { await unlink(LOCK_FILE); } catch {}
}

async function readDrafts() {
  try {
    const raw = await readFile(DRAFTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeDrafts(drafts) {
  await mkdir(DATA_DIR, { recursive: true });
  await acquireLock();
  try {
    await writeFile(TMP_FILE, JSON.stringify(drafts, null, 2), 'utf-8');
    await rename(TMP_FILE, DRAFTS_FILE);
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

  const draft = {
    id: generateId(),
    slug,
    platform,
    integrationId,
    content,
    imageUrl: getFlag('--image-url') || undefined,
    scheduledAt: new Date(scheduledAt).toISOString(),
    status: 'draft',
    department: getFlag('--department') || undefined,
    recommendedFormat: getFlag('--recommended-format') || undefined,
    hookSuggestion: getFlag('--hook-suggestion') || undefined,
    createdBy,
    issueId: getFlag('--issue-id') || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const drafts = await readDrafts();
  await writeDrafts([...drafts, draft]);

  if (jsonOutput) { out(draft); } else {
    log(`Draft created: ${draft.id}`);
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

  const drafts = await readDrafts();
  const idx = drafts.findIndex((d) => d.id === id);
  if (idx === -1) err(`Draft not found: ${id}`);

  const patch = { updatedAt: new Date().toISOString() };
  if (getFlag('--content')) patch.content = getFlag('--content');
  if (getFlag('--scheduled-at')) patch.scheduledAt = new Date(getFlag('--scheduled-at')).toISOString();
  if (getFlag('--image-url')) patch.imageUrl = getFlag('--image-url');

  drafts[idx] = { ...drafts[idx], ...patch };
  await writeDrafts(drafts);

  if (jsonOutput) { out(drafts[idx]); } else { log(`Draft updated: ${id}`); }
}

async function cmdDelete() {
  const id = args.find((a) => !a.startsWith('--') && a !== 'delete');
  if (!id) err('Usage: social-draft.mjs delete <id>');

  const drafts = await readDrafts();
  const filtered = drafts.filter((d) => d.id !== id);
  if (filtered.length === drafts.length) err(`Draft not found: ${id}`);

  await writeDrafts(filtered);
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

// ── Main ──────────────────────────────────────────────────────────────────────

if (!command || command === '--help') {
  console.log(`Usage: node social-draft.mjs <command> [options]

Commands:
  create   Create a new social draft (assigned to agents: Content Manager, etc.)
  list     List drafts [--status draft|scheduled|published|failed] [--slug <slug>]
  update   Update a draft by ID [--content <text>] [--scheduled-at ISO] [--image-url <url>]
  delete   Delete a draft by ID
  get      Get a single draft by ID

Options:
  --json   Output raw JSON
  --help   Show this help`);
  process.exit(0);
}

switch (command) {
  case 'create': await cmdCreate(); break;
  case 'list':   await cmdList(); break;
  case 'update': await cmdUpdate(); break;
  case 'delete': await cmdDelete(); break;
  case 'get':    await cmdGet(); break;
  default: err(`Unknown command: ${command}. Run with --help for usage.`);
}
