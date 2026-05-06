#!/usr/bin/env node
/**
 * Memory Harvest — Bridges file-based PARA memory into Paperclip vector DB.
 *
 * Usage:
 *   node memory-harvest.mjs harvest                          # Harvest current agent's memory
 *   node memory-harvest.mjs harvest --agent-name "CEO" --agent-id <uuid>
 *   node memory-harvest.mjs recall "<query>"                 # Semantic search (cross-agent, excludes self)
 *   node memory-harvest.mjs recall "<query>" --include-self  # Include own memories too
 *   node memory-harvest.mjs search "<query>"                 # Keyword search (cross-agent)
 *   node memory-harvest.mjs shared-insights                  # Recent insights from all agents
 *   node memory-harvest.mjs cleanup                          # Delete expired entries (DB read + API delete)
 *   node memory-harvest.mjs backfill-ttl                     # One-off: apply TTL to legacy entries lacking it
 *   node memory-harvest.mjs cleanup-deleted-agents           # One-off: purge memories of decommissioned agents
 *   node memory-harvest.mjs health                           # Vector memory stats
 *
 * Hardening v2 (Step 2.B — 2026-05-06):
 * Future-proof against Paperclip upstream upgrades: zero server patches.
 * Three server-side gaps are worked around client-side:
 *
 *   - semantic()/list() don't return agent_id → fetch own memory IDs separately
 *     and filter by ID-set membership for `--exclude-self`.
 *   - PATCH ignores expires_at → harvest re-creates tacit memories via DELETE+POST
 *     instead of PATCH so TTL is always re-applied from the source content type.
 *   - GET /memories filters expired server-side → cleanup reads expired IDs via
 *     direct DB SELECT (read-only, allowed by CLAUDE.md), DELETEs via API.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID, AGENTS,
  getPaperclipApiKey, createPaperclipJwt,
} from '../config.mjs';

// --- Constants ---

const AGENT_BASE = '/home/luca/paperclip/agents/superdots/agents';
const DAILY_NOTES_LOOKBACK_DAYS = 3;
const MAX_CONTENT_PER_MEMORY = 4000;

// TTL defaults in days. NULL = never expire.
const TTL_DAYS = {
  tacit:    90,    // MEMORY.md sections
  insight:  180,   // Daily notes & extracted insights
  decision: null,  // Decisions never expire
};
const EVERGREEN_TAGS = new Set(['evergreen', 'seed', 'decision']);

// Boilerplate detection — sections matching these in body are skipped at harvest
const BOILERPLATE_PATTERNS = [
  /^_Record /,
  /^_Document /,
  /^_Note /,
  /^_\(/, /^_\(.*\)_$/,
  /^TODO:/,
  /^\s*\.\.\.\s*$/,
];
const MIN_BODY_LENGTH = 200;
const MIN_SUBSTANTIVE_BULLETS = 2;

// Recall filters
const MIN_SIMILARITY = 0.60;
const RECALL_OVERFETCH = 3;  // similarity filter is in SQL; overfetch limit*3 to allow JS .slice trim
const SCAN_WARN_MS = 1000;   // warn if direct-DB recall exceeds this — hint to revisit IVFFlat
const SCAN_WARN_ROWS = 20000;

// Decommissioned agents — their leftover memories are pruned by cleanup-deleted-agents
const DELETED_AGENT_NAMES = ['Reddit Ads Specialist'];

// Updated 2026-05-06: GEO Specialist added, PAID_ADS_OPERATOR points to renamed folder
const AGENT_FOLDERS = {
  [AGENTS.CEO]: 'ceo',
  [AGENTS.CONTENT_MANAGER]: 'content-manager',
  [AGENTS.SEO_EXPERT]: 'seo-expert',
  [AGENTS.COPYWRITER]: 'copywriter',
  [AGENTS.FOUNDING_ENGINEER]: 'founding-engineer',
  [AGENTS.FRONTEND_DESIGNER]: 'frontend-designer',
  [AGENTS.LEGAL_EXPERT]: 'legal-expert',
  [AGENTS.GROWTH_ANALYST]: 'growth-analyst',
  [AGENTS.PROGRAM_MANAGER]: 'program-manager',
  [AGENTS.PAID_ADS_OPERATOR]: 'paid-ads-specialist',
  [AGENTS.GEO_SPECIALIST]: 'geo-specialist',
};

const AGENT_NAME_TO_ID = Object.fromEntries(
  Object.entries(AGENTS).map(([key, id]) => {
    const names = {
      CEO: 'CEO', CONTENT_MANAGER: 'Content Manager', SEO_EXPERT: 'SEO Expert',
      COPYWRITER: 'Copywriter', FOUNDING_ENGINEER: 'Founding Engineer',
      FRONTEND_DESIGNER: 'Frontend Designer', LEGAL_EXPERT: 'Legal Expert',
      GROWTH_ANALYST: 'Growth Analyst', PROGRAM_MANAGER: 'Program Manager',
      PAID_ADS_OPERATOR: 'Paid Ads Specialist',
      GEO_SPECIALIST: 'GEO Specialist',
    };
    return [names[key], id];
  }),
);

// --- Validation ---

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value, fieldName) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`Invalid UUID for ${fieldName}: ${JSON.stringify(value)}`);
  }
  return value;
}

// --- API helpers ---

// boardOnly: forces the PAPERCLIP_API_KEY (board admin) auth path. Used by
// cleanup-deleted-agents — the deleted agent has no row in agents table, so a JWT
// minted for its UUID would yield no actor under "authenticated" deployment mode.
function getAuth(targetAgentId, { boardOnly = false } = {}) {
  if (boardOnly) {
    const key = process.env.PAPERCLIP_API_KEY;
    if (!key) throw new Error('boardOnly: PAPERCLIP_API_KEY env var is required for this command');
    return key;
  }
  const callingAgentId = process.env.PAPERCLIP_AGENT_ID;
  if (targetAgentId && callingAgentId && targetAgentId !== callingAgentId) {
    const jwt = createPaperclipJwt(targetAgentId);
    if (jwt) return jwt;
  }
  const key = process.env.PAPERCLIP_API_KEY || getPaperclipApiKey(targetAgentId);
  if (!key) throw new Error('No PAPERCLIP_API_KEY or JWT secret available');
  return key;
}

async function apiCall(method, path, body, agentId, opts = {}) {
  const url = `${PAPERCLIP_API_URL}${path}`;
  const headers = {
    'Authorization': `Bearer ${getAuth(agentId, opts)}`,
    'Content-Type': 'application/json',
  };
  const fetchOpts = { method, headers };
  if (body) fetchOpts.body = JSON.stringify(body);

  const res = await fetch(url, fetchOpts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// --- DB helper (read-only, peer auth as luca) ---
// Used to get fields the API doesn't return (agent_id) or rows the API filters out (expired)
// or to bypass the API's IVFFlat index when its lists≫rows configuration causes low recall.
// CLAUDE.md rule #2 forbids DB *writes* — reads are allowed.

// stderr captured separately so psql NOTICEs/WARNINGs don't pollute the row stream.
// On non-zero exit, raise with both streams visible.
function runPsql(sql) {
  const result = spawnSync(
    'psql',
    ['-U', 'luca', '-d', 'paperclip', '-t', '-A', '-X', '-q', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`psql exit ${result.status}: ${result.stderr.slice(0, 500)}`);
  }
  return result.stdout;
}

function dbQuery(sql) {
  // Tab-separated. Caller is responsible for ensuring no embedded newlines/tabs
  // in selected columns (e.g. wrap text columns with regexp_replace if needed).
  const stdout = spawnSync(
    'psql',
    ['-U', 'luca', '-d', 'paperclip', '-t', '-A', '-F', '\t', '-X', '-q', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (stdout.status !== 0) throw new Error(`psql exit ${stdout.status}: ${stdout.stderr.slice(0, 500)}`);
  return stdout.stdout.trim().split('\n').filter(Boolean).map((line) => line.split('\t'));
}

// Robust JSON-per-row parser. Each line that successfully parses as a JSON object
// is included; everything else (NOTICEs, blank lines, command tags) is skipped.
function dbQueryJson(sql) {
  const stdout = runPsql(sql);
  const rows = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      // Skip lines that look JSON-ish but aren't (extremely rare).
    }
  }
  return rows;
}

function contentHash(content) {
  return createHash('md5').update(content, 'utf8').digest('hex').slice(0, 12);
}

async function ollamaEmbed(text) {
  const res = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.embedding)) throw new Error('Ollama returned no embedding');
  return data.embedding;
}

// --- TTL ---

function computeExpiresAt(contentType, tags) {
  if (tags && tags.some((t) => EVERGREEN_TAGS.has(t.toLowerCase()))) return null;
  const days = TTL_DAYS[contentType];
  if (days == null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// --- Boilerplate detection ---

function isBoilerplate(body) {
  if (!body || body.length < MIN_BODY_LENGTH) return true;

  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return true;
  if (lines.every((l) => BOILERPLATE_PATTERNS.some((rx) => rx.test(l)))) return true;

  const bullets = lines.filter((l) => /^[-*]\s/.test(l));
  if (bullets.length >= 2 && bullets.length === lines.length) {
    const substantive = bullets.filter((l) => l.replace(/^[-*]\s+/, '').length >= 20);
    if (substantive.length < MIN_SUBSTANTIVE_BULLETS) return true;
  }

  return false;
}

// --- File reading ---

function readFileSafe(path) {
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

function getAgentHome(agentId) {
  const folder = AGENT_FOLDERS[agentId];
  if (!folder) return null;
  return join(AGENT_BASE, folder);
}

function getRecentDailyNotes(agentHome, days = DAILY_NOTES_LOOKBACK_DAYS) {
  const memoryDir = join(agentHome, 'memory');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const notes = [];

  try {
    const files = readdirSync(memoryDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().reverse();
    for (const f of files) {
      const dateStr = f.replace('.md', '');
      if (new Date(dateStr) < cutoff) break;
      const content = readFileSafe(join(memoryDir, f));
      if (content && content.trim().length > 0) {
        notes.push({ file: f, date: dateStr, content: content.trim() });
      }
    }
  } catch {}

  return notes;
}

// --- Memory extraction ---

function extractMemorySections(content, sourceFile) {
  const sections = [];
  const lines = content.split('\n');
  let currentTitle = null;
  let currentLines = [];

  function flush() {
    if (!currentTitle) return;
    const body = currentLines.join('\n').trim();
    if (isBoilerplate(body)) return;
    sections.push({
      title: currentTitle,
      content: body.slice(0, MAX_CONTENT_PER_MEMORY),
      sourceFile,
    });
  }

  for (const line of lines) {
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      flush();
      currentTitle = h2[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();
  return sections;
}

function extractDailyNoteInsights(notes) {
  return notes
    .filter((note) => !isBoilerplate(note.content))
    .map((note) => ({
      title: `Daily note ${note.date}`,
      content: note.content.slice(0, MAX_CONTENT_PER_MEMORY),
      sourceFile: `memory/${note.file}`,
      tags: ['daily-note', note.date],
      contentType: 'insight',
    }));
}

function extractDecisions(agentHome) {
  const decisionsDir = join(agentHome, 'memory', 'decisions');
  const decisions = [];

  try {
    const files = readdirSync(decisionsDir).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      const content = readFileSafe(join(decisionsDir, f));
      if (!content) continue;
      const trimmed = content.trim();
      if (isBoilerplate(trimmed)) continue;
      decisions.push({
        title: `Decision: ${f.replace('.md', '')}`,
        content: trimmed.slice(0, MAX_CONTENT_PER_MEMORY),
        sourceFile: `memory/decisions/${f}`,
        tags: ['decision'],
        contentType: 'decision',
      });
    }
  } catch {}

  return decisions;
}

// --- Commands ---

async function harvest(agentId, agentName) {
  const companyId = assertUuid(process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID, 'companyId');
  assertUuid(agentId, 'agentId');
  const agentHome = getAgentHome(agentId);

  if (!agentHome) {
    console.error(`Unknown agent ID: ${agentId}`);
    process.exit(1);
  }

  console.log(`Harvesting memory for ${agentName} (${agentId})...`);

  // existingMap: source_file -> { id, contentHash }. contentHash is read from a `hash:<md5>` tag
  // when present, allowing us to skip re-embed when content is unchanged.
  const existingMap = new Map();
  try {
    const existing = await apiCall('GET',
      `/api/companies/${companyId}/memories?agent=${agentId}&limit=500`,
      null, agentId);
    for (const m of (existing || [])) {
      if (!m.source_file) continue;
      const hashTag = (m.tags || []).find((t) => typeof t === 'string' && t.startsWith('hash:'));
      existingMap.set(m.source_file, {
        id: m.id,
        contentHash: hashTag ? hashTag.slice(5) : null,
      });
    }
  } catch {}

  const memories = [];

  const memoryMd = readFileSafe(join(agentHome, 'MEMORY.md'));
  if (memoryMd) {
    const sections = extractMemorySections(memoryMd, 'MEMORY.md');
    for (const s of sections) {
      const sourceKey = `MEMORY.md#${s.title}`;
      const fullContent = `[${agentName}] ${s.title}\n\n${s.content}`;
      const hash = contentHash(fullContent);
      const existing = existingMap.get(sourceKey);
      memories.push({
        content: fullContent,
        contentType: 'tacit',
        tags: ['memory-md', s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50), `hash:${hash}`],
        sourceFile: sourceKey,
        replaceExistingId: existing?.id ?? null,
        skipReason: existing && existing.contentHash === hash ? 'unchanged' : null,
      });
    }
  }

  const dailyNotes = getRecentDailyNotes(agentHome);
  const noteInsights = extractDailyNoteInsights(dailyNotes);
  for (const n of noteInsights) {
    if (existingMap.has(n.sourceFile)) continue;  // daily notes are immutable; skip if exists
    const fullContent = `[${agentName}] ${n.title}\n\n${n.content}`;
    memories.push({
      content: fullContent,
      contentType: n.contentType,
      tags: [...n.tags, `hash:${contentHash(fullContent)}`],
      sourceFile: n.sourceFile,
      replaceExistingId: null,
      skipReason: null,
    });
  }

  const decisions = extractDecisions(agentHome);
  for (const d of decisions) {
    if (existingMap.has(d.sourceFile)) continue;  // decisions are immutable; skip if exists
    const fullContent = `[${agentName}] ${d.title}\n\n${d.content}`;
    memories.push({
      content: fullContent,
      contentType: d.contentType,
      tags: [...d.tags, `hash:${contentHash(fullContent)}`],
      sourceFile: d.sourceFile,
      replaceExistingId: null,
      skipReason: null,
    });
  }

  if (memories.length === 0) {
    console.log('No new memories to harvest (after boilerplate filter).');
    return;
  }

  let created = 0, replaced = 0, skipped = 0, failed = 0;
  for (const mem of memories) {
    if (mem.skipReason === 'unchanged') {
      skipped++;
      continue;
    }
    try {
      const expires_at = computeExpiresAt(mem.contentType, mem.tags);

      // POST first → capture new ID → DELETE old by ID. If POST fails, the old entry
      // remains intact (no data-loss window). Acceptable trade-off: temporary duplicate
      // if DELETE fails — next harvest will re-build the existing map and clean up.
      const posted = await apiCall('POST', `/api/companies/${companyId}/memories`, {
        agentId,
        content: mem.content,
        content_type: mem.contentType,
        tags: mem.tags || [],
        source_file: mem.sourceFile,
        ...(expires_at ? { expires_at } : {}),
      }, agentId);

      if (mem.replaceExistingId) {
        try {
          await apiCall('DELETE', `/api/companies/${companyId}/memories/${mem.replaceExistingId}`, null, agentId);
        } catch (delErr) {
          if (!String(delErr.message).includes('404')) {
            console.error(`  WARN: post-delete failed for ${mem.sourceFile} (orphan old id ${mem.replaceExistingId}): ${delErr.message}`);
          }
        }
        replaced++;
      } else {
        created++;
      }
    } catch (err) {
      console.error(`  FAILED ${mem.sourceFile}: ${err.message}`);
      failed++;
    }
  }

  console.log(`Harvest: ${created} created, ${replaced} replaced (post+delete), ${skipped} unchanged, ${failed} failed`);
}

// Direct-DB semantic recall. Bypasses the Paperclip API for one specific reason:
// the IVFFlat index in agent_memories was created with lists=50 — fine when the corpus
// is large, but with 46-1,000 rows it returns just 1-4 candidates per query (low recall,
// confirmed by Postgres' own NOTICE on REINDEX). Brute-force scan via Ollama embedding
// is fast enough for any corpus we'll have for the next year, and it returns agent_id
// (which the API SELECT clause omits) so exclude-self becomes trivial.
//
// Future-proof: if Paperclip ships a fix (probes setting, lists=auto, HNSW migration),
// nothing breaks — we just keep getting correct results.
async function recall(query, opts = {}) {
  const companyId = assertUuid(process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID, 'companyId');
  const rawAgentId = opts.agentId || process.env.PAPERCLIP_AGENT_ID || AGENTS.CEO;
  const agentId = assertUuid(rawAgentId, 'agentId');
  const limit = opts.limit || 5;
  const includeSelf = opts.includeSelf || false;

  console.log(`Semantic search: "${query}"\n`);

  const embedding = await ollamaEmbed(query).catch((err) => {
    console.error(`Embedding failed (Ollama down?): ${err.message}`);
    process.exit(3);
  });
  const embStr = `[${embedding.join(',')}]`;
  const selfClause = includeSelf ? '' : `AND agent_id <> '${agentId}'::uuid`;
  const sqlLimit = Math.max(limit * RECALL_OVERFETCH, 5);

  // SET LOCAL enable_indexscan=off forces a seq scan, bypassing IVFFlat's low-recall
  // ANN approximation (created with lists=50 but corpus is small). Brute-force on
  // <1k rows is <50ms; <5k rows ~50-200ms; threshold for revisit is ~20k rows or 1s,
  // whichever comes first — see SCAN_WARN_* constants. Similarity threshold and limit
  // are pushed into SQL so we transfer only what's needed back over psql stdout.
  const t0 = Date.now();
  const rows = dbQueryJson(`
    BEGIN;
    SET LOCAL enable_indexscan = OFF;
    SET LOCAL enable_bitmapscan = OFF;
    SELECT row_to_json(t) FROM (
      SELECT
        id::text AS id,
        agent_id::text AS agent_id,
        agent_name,
        content,
        content_type,
        to_char(created_at, 'YYYY-MM-DD') AS created,
        ROUND((1 - (embedding <=> '${embStr}'::vector))::numeric, 4) AS similarity
      FROM agent_memories
      WHERE company_id = '${companyId}'::uuid
        AND embedding IS NOT NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (1 - (embedding <=> '${embStr}'::vector)) >= ${MIN_SIMILARITY}
        ${selfClause}
      ORDER BY embedding <=> '${embStr}'::vector
      LIMIT ${sqlLimit}
    ) t;
    COMMIT;
  `);
  const elapsedMs = Date.now() - t0;

  if (elapsedMs > SCAN_WARN_MS) {
    console.error(`  WARN: recall took ${elapsedMs}ms — corpus may be outgrowing brute-force. Revisit IVFFlat lists tuning.`);
  }

  if (rows.length === 0) {
    console.log(`No matches above similarity ${MIN_SIMILARITY} (exclude-self=${!includeSelf}).`);
    return;
  }

  const filtered = rows.slice(0, limit);
  for (const m of filtered) {
    console.log(`--- ${m.agent_name} (${(Number(m.similarity) * 100).toFixed(1)}%) [${m.content_type}] ${m.created}`);
    console.log(m.content.slice(0, 300));
    if (m.content.length > 300) console.log('  ...');
    console.log();
  }
}

async function search(query, opts = {}) {
  const companyId = process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID;
  const agentId = opts.agentId || process.env.PAPERCLIP_AGENT_ID || AGENTS.CEO;
  const limit = opts.limit || 10;

  console.log(`Keyword search: "${query}"\n`);

  const results = await apiCall('GET',
    `/api/companies/${companyId}/memories/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    null, agentId);

  if (!results || results.length === 0) {
    console.log('No matching memories found.');
    return;
  }

  for (const mem of results) {
    console.log(`--- ${mem.agent_name} [${mem.content_type}] ${mem.created_at?.slice(0, 10) || ''}`);
    console.log(mem.content.slice(0, 300));
    if (mem.content.length > 300) console.log('  ...');
    console.log();
  }
}

async function sharedInsights(opts = {}) {
  const companyId = process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID;
  const agentId = opts.agentId || process.env.PAPERCLIP_AGENT_ID || AGENTS.CEO;
  const days = opts.days || 7;

  const since = new Date();
  since.setDate(since.getDate() - days);

  console.log(`Shared insights from all agents (last ${days} days)\n`);

  const results = await apiCall('GET',
    `/api/companies/${companyId}/memories?since=${since.toISOString()}&limit=50`,
    null, agentId);

  if (!results || results.length === 0) {
    console.log('No recent shared insights.');
    return;
  }

  const byAgent = {};
  for (const mem of results) {
    if (!byAgent[mem.agent_name]) byAgent[mem.agent_name] = [];
    byAgent[mem.agent_name].push(mem);
  }

  for (const [agent, mems] of Object.entries(byAgent)) {
    console.log(`## ${agent} (${mems.length} memories)\n`);
    for (const mem of mems.slice(0, 5)) {
      const tags = mem.tags?.length ? ` [${mem.tags.join(', ')}]` : '';
      console.log(`- ${mem.content.split('\n')[0].slice(0, 120)}${tags}`);
    }
    if (mems.length > 5) console.log(`  ... and ${mems.length - 5} more`);
    console.log();
  }
}

// Reads expired entries directly from DB (API filters them out). DELETEs via API.
// agent_name is replaced with regexp_replace to neutralize embedded tabs/newlines.
async function cleanup() {
  const companyId = assertUuid(process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID, 'companyId');

  console.log('Memory cleanup: prune expired entries\n');

  const rows = dbQuery(`
    SELECT
      id::text,
      agent_id::text,
      regexp_replace(agent_name, E'[\\t\\n\\r]', ' ', 'g') AS agent_name,
      expires_at::text
    FROM agent_memories
    WHERE company_id = '${companyId}'::uuid
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    ORDER BY expires_at ASC
  `);

  console.log(`Expired entries: ${rows.length}`);
  if (rows.length === 0) return;

  let deleted = 0, failed = 0;
  for (const [id, agentId, agentName, expiredAt] of rows) {
    try {
      await apiCall('DELETE', `/api/companies/${companyId}/memories/${id}`, null, agentId);
      deleted++;
      console.log(`  ✓ ${agentName} ${id} (expired ${expiredAt.slice(0, 10)})`);
    } catch (err) {
      console.error(`  ✗ ${agentName} ${id}: ${err.message}`);
      failed++;
    }
  }
  console.log(`\nCleanup: ${deleted} deleted, ${failed} failed`);
}

// One-off: apply TTL to legacy entries that have NULL expires_at.
// Strategy: read entry from DB, DELETE via API, POST same content with TTL applied.
// Skips entries with evergreen tags or content_type=decision (no TTL by policy).
// One-off: apply TTL to legacy entries that have NULL expires_at.
// POST-then-DELETE order: if interrupted mid-flight, the old row remains intact and
// the next run will see it and retry. created_at is reset on the new row (one-time
// cost, breaks the "last 7 days" window for backfilled rows for one week).
async function backfillTtl(opts = {}) {
  const companyId = assertUuid(process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID, 'companyId');
  const dryRun = opts.dryRun || false;

  console.log(`Backfill TTL on legacy memories${dryRun ? ' [DRY RUN]' : ''}\n`);

  // API has no GET /memories/:id, so read full content from DB. Newlines handled via JSON.
  const rows = dbQueryJson(`
    SELECT row_to_json(t) FROM (
      SELECT
        id::text AS id,
        agent_id::text AS agent_id,
        agent_name,
        content,
        content_type,
        COALESCE(tags, ARRAY[]::text[]) AS tags,
        source_file
      FROM agent_memories
      WHERE company_id = '${companyId}'::uuid
        AND expires_at IS NULL
        AND content_type IN ('tacit', 'insight')
      ORDER BY created_at ASC
    ) t
  `);

  console.log(`Candidates without TTL: ${rows.length}`);
  if (rows.length === 0) return;

  let backfilled = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    const tags = Array.isArray(r.tags) ? r.tags : [];
    if (tags.some((t) => EVERGREEN_TAGS.has(String(t).toLowerCase()))) {
      skipped++;
      continue;
    }
    const expires_at = computeExpiresAt(r.content_type, tags);
    if (!expires_at) { skipped++; continue; }

    if (dryRun) {
      console.log(`  [dry] ${r.agent_name} ${r.id} (${r.content_type}) → expires ${expires_at.slice(0, 10)}`);
      backfilled++;
      continue;
    }

    try {
      // POST first (preserves data on POST failure), then DELETE old.
      await apiCall('POST', `/api/companies/${companyId}/memories`, {
        agentId: r.agent_id,
        content: r.content,
        content_type: r.content_type,
        tags,
        source_file: r.source_file,
        expires_at,
      }, r.agent_id);

      try {
        await apiCall('DELETE', `/api/companies/${companyId}/memories/${r.id}`, null, r.agent_id);
      } catch (delErr) {
        // Orphan old row: not fatal. Re-running backfill won't re-process it
        // (it now has a sibling new row that's still NULL-expires-at? No — the
        // sibling has expires_at set, so only THIS old row matches the WHERE again.
        // Re-run is safe.) Log and move on.
        if (!String(delErr.message).includes('404')) {
          console.error(`  WARN: post-delete failed for ${r.id}: ${delErr.message}`);
        }
      }

      backfilled++;
      console.log(`  ✓ ${r.agent_name} ${r.id} → expires ${expires_at.slice(0, 10)}`);
    } catch (err) {
      console.error(`  ✗ ${r.agent_name} ${r.id}: ${err.message}`);
      failed++;
    }
  }
  console.log(`\nBackfill: ${backfilled} updated, ${skipped} skipped (evergreen/decision), ${failed} failed`);
}

// One-off: purge memories of decommissioned agents (DELETED_AGENT_NAMES).
// Uses board-admin auth (PAPERCLIP_API_KEY) because the deleted agent has no row in
// the agents table — minting a JWT for its UUID would fail under "authenticated"
// deployment mode. The board key bypasses agent ownership checks at the API layer.
async function cleanupDeletedAgents(opts = {}) {
  const companyId = assertUuid(process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID, 'companyId');
  const dryRun = opts.dryRun || false;

  console.log(`Cleanup memories of decommissioned agents${dryRun ? ' [DRY RUN]' : ''}: ${DELETED_AGENT_NAMES.join(', ')}\n`);

  const namesList = DELETED_AGENT_NAMES.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
  const rows = dbQuery(`
    SELECT
      id::text,
      agent_id::text,
      regexp_replace(agent_name, E'[\\t\\n\\r]', ' ', 'g') AS agent_name
    FROM agent_memories
    WHERE company_id = '${companyId}'::uuid
      AND agent_name IN (${namesList})
  `);

  console.log(`Found: ${rows.length}`);
  if (rows.length === 0) return;

  // Validate board key up front — fail fast if the env isn't set, instead of
  // silently falling back to JWT and hitting 401s per-row in authenticated mode.
  if (!dryRun && !process.env.PAPERCLIP_API_KEY) {
    console.error('PAPERCLIP_API_KEY env required to delete cross-agent memories. Set it and retry.');
    process.exit(2);
  }

  let deleted = 0, failed = 0;
  for (const [id, agentId, agentName] of rows) {
    if (dryRun) {
      console.log(`  [dry] ${agentName} ${id}`);
      deleted++;
      continue;
    }
    try {
      await apiCall('DELETE', `/api/companies/${companyId}/memories/${id}`, null, agentId, { boardOnly: true });
      deleted++;
    } catch (err) {
      console.error(`  ✗ ${agentName} ${id}: ${err.message}`);
      failed++;
    }
  }
  console.log(`\nDeleted: ${deleted}, failed: ${failed}`);
}

async function healthCheck() {
  const companyId = process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID;
  const agentId = process.env.PAPERCLIP_AGENT_ID || AGENTS.CEO;

  const result = await apiCall('GET',
    `/api/companies/${companyId}/memories/health`, null, agentId);

  console.log('Vector Memory Health\n');
  console.log(`Total memories: ${result.total}`);
  console.log(`Created last 7d: ${result.created_last_7d}`);
  console.log(`Null embeddings: ${result.null_embeddings}`);
  console.log(`Avg access count: ${result.avg_access_count}`);
  console.log();
  console.log('By agent:');
  for (const [agent, count] of Object.entries(result.by_agent || {})) {
    console.log(`  ${agent}: ${count}`);
  }
  console.log();
  console.log('By type:');
  for (const [type, count] of Object.entries(result.by_content_type || {})) {
    console.log(`  ${type}: ${count}`);
  }
}

async function harvestAll() {
  console.log('Harvesting all agents...\n');
  const nameToId = Object.entries(AGENT_NAME_TO_ID);
  for (const [name, id] of nameToId) {
    try {
      console.log(`\n=== ${name} ===`);
      await harvest(id, name);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }
}

// --- CLI ---

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}
function hasFlag(name) {
  return args.includes(name);
}

if (!command || command === '--help') {
  console.log(`
memory-harvest — Bridge PARA file memory into Paperclip vector DB

Commands:
  harvest                       Harvest current agent's memory (uses PAPERCLIP_AGENT_ID)
  harvest --all                 Harvest all agents' memories
  harvest --agent-name "CEO" --agent-id <uuid>
  recall "<query>"              Semantic search across other agents (excludes own by default)
  recall "<query>" --include-self    Include own memories too
  search "<query>"              Keyword (BM25) search across all agents
  shared-insights               Recent insights from all agents (last 7 days)
  cleanup                       Prune expired entries (DB read + API delete)
  backfill-ttl [--dry-run]      One-off: apply TTL to legacy entries with NULL expires_at
  cleanup-deleted-agents [--dry-run]  One-off: purge memories of decommissioned agents
  health                        Vector memory statistics

Hardening v2 (2026-05-06) — future-proof against Paperclip upstream:
  - Recall via direct DB scan + Ollama embed (bypasses API's low-recall IVFFlat with lists=50)
  - Exclude-self: native SQL clause on agent_id (DB returns it; API SELECT does not)
  - TTL re-application: harvest uses DELETE+POST instead of PATCH (PATCH ignores expires_at)
  - Cleanup expired: reads DB directly (API filters expired rows server-side)
  - Similarity threshold ≥ ${MIN_SIMILARITY} after full brute-force scan (top ${API_MAX_LIMIT})
`);
  process.exit(0);
}

try {
  if (command === 'harvest') {
    if (args.includes('--all')) {
      await harvestAll();
    } else {
      const agentName = getFlag('--agent-name') || process.env.PAPERCLIP_AGENT_NAME;
      let agentId = getFlag('--agent-id') || process.env.PAPERCLIP_AGENT_ID;
      if (!agentId && agentName) agentId = AGENT_NAME_TO_ID[agentName];
      if (!agentId) { console.error('Provide --agent-id or set PAPERCLIP_AGENT_ID'); process.exit(1); }
      const name = agentName || Object.entries(AGENT_NAME_TO_ID).find(([, id]) => id === agentId)?.[0] || 'Unknown';
      await harvest(agentId, name);
    }
  } else if (command === 'recall') {
    const query = args[1];
    if (!query) { console.error('Usage: recall "<query>" [--limit N] [--include-self]'); process.exit(1); }
    await recall(query, {
      limit: getFlag('--limit') ? Number(getFlag('--limit')) : undefined,
      includeSelf: hasFlag('--include-self'),
    });
  } else if (command === 'search') {
    const query = args[1];
    if (!query) { console.error('Usage: search "<query>"'); process.exit(1); }
    await search(query, { limit: getFlag('--limit') ? Number(getFlag('--limit')) : undefined });
  } else if (command === 'shared-insights') {
    await sharedInsights({ days: getFlag('--days') ? Number(getFlag('--days')) : undefined });
  } else if (command === 'cleanup') {
    await cleanup();
  } else if (command === 'backfill-ttl') {
    await backfillTtl({ dryRun: hasFlag('--dry-run') });
  } else if (command === 'cleanup-deleted-agents') {
    await cleanupDeletedAgents({ dryRun: hasFlag('--dry-run') });
  } else if (command === 'health') {
    await healthCheck();
  } else {
    console.error(`Unknown command: ${command}. Use --help`);
    process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
