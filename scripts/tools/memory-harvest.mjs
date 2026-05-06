#!/usr/bin/env node
/**
 * Memory Harvest — Bridges file-based PARA memory into Paperclip vector DB.
 *
 * Usage:
 *   node memory-harvest.mjs harvest                          # Harvest current agent's memory
 *   node memory-harvest.mjs harvest --agent-name "CEO" --agent-id <uuid>
 *   node memory-harvest.mjs recall "<query>"                 # Semantic search (cross-agent, default excludes self)
 *   node memory-harvest.mjs recall "<query>" --include-self  # Include own memories too
 *   node memory-harvest.mjs search "<query>"                 # Keyword search (cross-agent)
 *   node memory-harvest.mjs shared-insights                  # Recent insights from all agents
 *   node memory-harvest.mjs cleanup                          # Delete expired entries
 *   node memory-harvest.mjs health                           # Vector memory stats
 *
 * Hardening (Phase 1.5.B Step 2.A — 2026-05-06):
 *   - TTL defaults: tacit=90d, insight=180d, decision=NULL, tag:evergreen=NULL
 *   - Recall filters: similarity ≥ 0.55 + exclude self by default
 *   - Harvest filters: skip boilerplate sections (placeholder, < 200 char body, < 2 substantive bullets)
 *   - cleanup command: prune expired entries (run via cron daily)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
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

// Recall noise filter
const MIN_SIMILARITY = 0.55;

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

// --- API helpers ---

function getAuth(targetAgentId) {
  const callingAgentId = process.env.PAPERCLIP_AGENT_ID;
  if (targetAgentId && callingAgentId && targetAgentId !== callingAgentId) {
    const jwt = createPaperclipJwt(targetAgentId);
    if (jwt) return jwt;
  }
  const key = process.env.PAPERCLIP_API_KEY || getPaperclipApiKey(targetAgentId);
  if (!key) throw new Error('No PAPERCLIP_API_KEY or JWT secret available');
  return key;
}

async function apiCall(method, path, body, agentId) {
  const url = `${PAPERCLIP_API_URL}${path}`;
  const headers = {
    'Authorization': `Bearer ${getAuth(agentId)}`,
    'Content-Type': 'application/json',
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
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
  const companyId = process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID;
  const agentHome = getAgentHome(agentId);

  if (!agentHome) {
    console.error(`Unknown agent ID: ${agentId}`);
    process.exit(1);
  }

  console.log(`Harvesting memory for ${agentName} (${agentId})...`);

  let existingSourceFiles = new Set();
  let existingSourceMap = new Map();
  try {
    const existing = await apiCall('GET',
      `/api/companies/${companyId}/memories?agent=${agentId}&limit=200`,
      null, agentId);
    for (const m of (existing || [])) {
      if (m.source_file) {
        existingSourceFiles.add(m.source_file);
        existingSourceMap.set(m.source_file, m.id);
      }
    }
  } catch {}

  const memories = [];

  const memoryMd = readFileSafe(join(agentHome, 'MEMORY.md'));
  if (memoryMd) {
    const sections = extractMemorySections(memoryMd, 'MEMORY.md');
    for (const s of sections) {
      const sourceKey = `MEMORY.md#${s.title}`;
      memories.push({
        content: `[${agentName}] ${s.title}\n\n${s.content}`,
        contentType: 'tacit',
        tags: ['memory-md', s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)],
        sourceFile: sourceKey,
        update: existingSourceFiles.has(sourceKey),
      });
    }
  }

  const dailyNotes = getRecentDailyNotes(agentHome);
  const noteInsights = extractDailyNoteInsights(dailyNotes);
  for (const n of noteInsights) {
    if (existingSourceFiles.has(n.sourceFile)) continue;
    memories.push({
      content: `[${agentName}] ${n.title}\n\n${n.content}`,
      contentType: n.contentType,
      tags: n.tags,
      sourceFile: n.sourceFile,
    });
  }

  const decisions = extractDecisions(agentHome);
  for (const d of decisions) {
    if (existingSourceFiles.has(d.sourceFile)) continue;
    memories.push({
      content: `[${agentName}] ${d.title}\n\n${d.content}`,
      contentType: d.contentType,
      tags: d.tags,
      sourceFile: d.sourceFile,
    });
  }

  if (memories.length === 0) {
    console.log('No new memories to harvest (after boilerplate filter).');
    return;
  }

  let created = 0, updated = 0, failed = 0;
  for (const mem of memories) {
    try {
      const expires_at = computeExpiresAt(mem.contentType, mem.tags);
      if (mem.update && existingSourceMap.has(mem.sourceFile)) {
        const existingId = existingSourceMap.get(mem.sourceFile);
        await apiCall('PATCH',
          `/api/companies/${companyId}/memories/${existingId}`,
          { content: mem.content, tags: mem.tags, ...(expires_at ? { expires_at } : {}) }, agentId);
        updated++;
        continue;
      }
      await apiCall('POST', `/api/companies/${companyId}/memories`, {
        agentId,
        content: mem.content,
        content_type: mem.contentType,
        tags: mem.tags || [],
        source_file: mem.sourceFile,
        ...(expires_at ? { expires_at } : {}),
      }, agentId);
      created++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`Harvest: ${created} created, ${updated} updated, ${failed} failed`);
}

async function recall(query, opts = {}) {
  const companyId = process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID;
  const agentId = opts.agentId || process.env.PAPERCLIP_AGENT_ID || AGENTS.CEO;
  const limit = opts.limit || 5;
  const includeSelf = opts.includeSelf || false;

  console.log(`Semantic search: "${query}"\n`);

  const result = await apiCall('POST', `/api/companies/${companyId}/memories/semantic`, {
    query,
    limit: limit * 2,  // overfetch to compensate for client-side filter
  }, agentId);

  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exit(3);
  }

  const raw = Array.isArray(result.results) ? result.results : [];
  if (raw.length === 0) {
    console.log('No matching memories found.');
    return;
  }

  // Apply filters: similarity threshold + exclude-self by default
  const filtered = raw.filter((m) => {
    if (typeof m.similarity === 'number' && m.similarity < MIN_SIMILARITY) return false;
    if (!includeSelf && m.agent_id === agentId) return false;
    return true;
  }).slice(0, limit);

  if (filtered.length === 0) {
    console.log(`No high-confidence matches (threshold ≥ ${MIN_SIMILARITY}, exclude-self=${!includeSelf}).`);
    console.log(`API returned ${raw.length} candidates below threshold or from your own memory.`);
    return;
  }

  for (const mem of filtered) {
    const sim = typeof mem.similarity === 'number' ? `(${(mem.similarity * 100).toFixed(1)}%)` : '';
    console.log(`--- ${mem.agent_name} ${sim} [${mem.content_type}] ${mem.created_at?.slice(0, 10) || ''}`);
    console.log(mem.content.slice(0, 300));
    if (mem.content.length > 300) console.log('  ...');
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

async function cleanup() {
  const companyId = process.env.PAPERCLIP_COMPANY_ID || PAPERCLIP_COMPANY_ID;
  const agentId = process.env.PAPERCLIP_AGENT_ID || AGENTS.CEO;

  console.log('Memory cleanup: prune expired entries\n');

  const all = await apiCall('GET',
    `/api/companies/${companyId}/memories?limit=500`,
    null, agentId);

  if (!all || all.length === 0) {
    console.log('No memories found.');
    return;
  }

  const now = Date.now();
  const expired = all.filter((m) => m.expires_at && new Date(m.expires_at).getTime() < now);
  console.log(`Total: ${all.length} | Expired: ${expired.length}`);

  let deleted = 0, failed = 0;
  for (const m of expired) {
    try {
      await apiCall('DELETE', `/api/companies/${companyId}/memories/${m.id}`, null, m.agent_id);
      deleted++;
    } catch (err) {
      console.error(`  FAILED to delete ${m.id}: ${err.message}`);
      failed++;
    }
  }
  console.log(`Cleanup: ${deleted} expired memories deleted, ${failed} failed`);
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
  harvest                Harvest current agent's memory (uses PAPERCLIP_AGENT_ID)
  harvest --all          Harvest all agents' memories
  harvest --agent-name "CEO" --agent-id <uuid>
  recall "<query>"       Semantic search across other agents (excludes own by default, ≥0.55 similarity)
  recall "<query>" --include-self    Include own memories too
  search "<query>"       Keyword (BM25) search across all agents
  shared-insights        Recent insights from all agents (last 7 days)
  cleanup                Prune expired entries (run nightly)
  health                 Vector memory statistics

Hardening (2026-05-06):
  - TTL applied at write: tacit=90d, insight=180d, decision=NULL, tag:evergreen=NULL
  - Recall filters: similarity ≥ 0.55 + exclude-self by default (use --include-self to override)
  - Harvest filters: skip boilerplate sections (placeholder/short/<2 substantive bullets)
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
