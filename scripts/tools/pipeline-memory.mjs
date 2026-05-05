#!/usr/bin/env node
/**
 * Pipeline Memory Helper — read history before pipelines run, write outcome after.
 *
 * Usage:
 *   node scripts/tools/pipeline-memory.mjs recall <pipeline-slug> "<query>" [--limit 10] [--days 60]
 *   node scripts/tools/pipeline-memory.mjs write  <pipeline-slug> --content <file|-> --outcome <pending|good|neutral|negative> [--tag <extra>]...
 *   node scripts/tools/pipeline-memory.mjs update-outcome <memory-id> <good|neutral|negative>
 *
 * Tags applied automatically on write:
 *   pipeline:<slug>     — always
 *   run:YYYY-WW         — ISO year-week
 *   outcome:<value>     — from --outcome (default: pending)
 *
 * Auth: uses PAPERCLIP_API_KEY env var, or auto-generates JWT via config.mjs.
 * Run from /home/luca/superdots-blog/ as user luca.
 *
 * Exit codes:
 *   0 — OK
 *   1 — usage error (caller fault)
 *   2 — runtime error (network, IO, etc.)
 *   3 — semantic recall API returned an error (e.g. Ollama unavailable)
 *   4 — write succeeded but with NULL embedding (degraded — invisible to recall)
 *   5 — content file missing or stale
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  PAPERCLIP_API_URL,
  PAPERCLIP_COMPANY_ID,
  AGENTS,
  getPaperclipApiKey,
} from '../config.mjs';

const FETCH_TIMEOUT_MS = 30_000;
const ALLOWED_CONTENT_PREFIXES = ['/tmp/', '/home/luca/superdots-blog/tmp/'];
const STALE_FILE_MS = 24 * 3600_000;

// ----- Helpers -----

function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

function getAuth(agentId) {
  const key = process.env.PAPERCLIP_API_KEY || getPaperclipApiKey(agentId || AGENTS.PROGRAM_MANAGER);
  if (!key) throw new Error('No auth: set PAPERCLIP_API_KEY or PAPERCLIP_AGENT_JWT_SECRET');
  return key;
}

async function api(method, path, body, agentId) {
  const headers = {
    'Authorization': `Bearer ${getAuth(agentId)}`,
    'Content-Type': 'application/json',
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${PAPERCLIP_API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`API ${method} ${path} timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function parsePositiveInt(value, name) {
  const n = parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`--${name} must be a positive integer (got: ${value})`);
  }
  return n;
}

function parseFlags(args) {
  const VALUE_FLAGS = new Set(['limit', 'days', 'content', 'outcome', 'agent', 'tag']);
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      // For known value-taking flags, always consume next arg even if it starts with --
      if (VALUE_FLAGS.has(key) && next !== undefined) {
        if (flags[key] !== undefined) {
          flags[key] = Array.isArray(flags[key]) ? [...flags[key], next] : [flags[key], next];
        } else {
          flags[key] = next;
        }
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

// ----- Commands -----

async function cmdRecall(slug, query, flags) {
  if (!slug || !query) {
    console.error('Usage: recall <pipeline-slug> "<query>" [--limit N] [--days N]');
    process.exit(1);
  }
  const limit = parsePositiveInt(flags.limit || '10', 'limit');
  const days = parsePositiveInt(flags.days || '60', 'days');
  const tags = [`pipeline:${slug}`];

  // Fetch with a higher server limit so client-side `days` filter doesn't hide
  // relevant memories that are merely outranked by older similar entries.
  const serverLimit = Math.max(limit * 3, 30);

  const result = await api('POST', `/api/companies/${PAPERCLIP_COMPANY_ID}/memories/semantic`, {
    query,
    tags,
    limit: serverLimit,
  });

  // The semantic endpoint returns `{ error?, results: [...] }`. When Ollama is down
  // it returns `{ error: "...", results: [] }` with HTTP 200 — we MUST detect this
  // and surface it, otherwise pipelines silently treat every run as a baseline.
  if (result && typeof result === 'object' && !Array.isArray(result) && result.error) {
    console.error(`# Recall failed (semantic API reported): ${result.error}`);
    console.error('# Pipelines depending on this should NOT mark task done — set blocked instead.');
    process.exit(3);
  }

  const items = Array.isArray(result?.results) ? result.results
    : Array.isArray(result?.memories) ? result.memories
    : Array.isArray(result?.items) ? result.items
    : Array.isArray(result) ? result
    : null;

  if (items === null) {
    console.error(`# Recall response shape unexpected: ${JSON.stringify(result).slice(0, 300)}`);
    process.exit(3);
  }

  const cutoff = Date.now() - days * 86400000;
  const fresh = items.filter((m) => {
    const t = new Date(m.created_at || m.createdAt || 0).getTime();
    return t >= cutoff;
  }).slice(0, limit);

  if (fresh.length === 0) {
    console.log(`# Memory recall: pipeline:${slug}`);
    console.log(`# Query: ${query}`);
    console.log('');
    if (items.length > 0) {
      console.log(`_${items.length} matches found but ALL older than ${days} days. Treat as stale, not absent._`);
    } else {
      console.log('_No prior memories found for this pipeline._');
      console.log('_This may be the first run — establish baseline carefully and document thoroughly in the write-history step._');
    }
    return;
  }

  console.log(`# Memory recall: pipeline:${slug} (${fresh.length} entries, last ${days}d)`);
  console.log(`# Query: ${query}`);
  console.log('');

  for (const m of fresh) {
    const date = (m.created_at || m.createdAt || '').slice(0, 10);
    const tagList = (m.tags || []).join(', ');
    const score = m.similarity != null ? ` [sim=${Number(m.similarity).toFixed(3)}]` : '';
    const id = m.id ? ` (id: ${m.id})` : '';
    console.log(`## ${date}${score}${id}`);
    console.log(`Tags: ${tagList}`);
    console.log('');
    console.log((m.content || '').slice(0, 1500));
    console.log('');
    console.log('---');
    console.log('');
  }
}

function readContent(contentSource) {
  if (contentSource === '-') {
    return readFileSync(0, 'utf-8');
  }
  // Path whitelist — block reading sensitive files like .env, secrets, etc.
  if (!ALLOWED_CONTENT_PREFIXES.some((p) => contentSource.startsWith(p))) {
    console.error(`--content path must start with one of: ${ALLOWED_CONTENT_PREFIXES.join(', ')}`);
    console.error(`Compose your memory content as a markdown file under /tmp/ first.`);
    process.exit(5);
  }
  if (!existsSync(contentSource)) {
    console.error(`Memory file not found: ${contentSource}`);
    console.error(`Compose the memory content as a markdown file at this path before calling 'write'.`);
    process.exit(5);
  }
  const st = statSync(contentSource);
  const ageMs = Date.now() - st.mtimeMs;
  if (ageMs > STALE_FILE_MS) {
    console.error(`Memory file is ${Math.round(ageMs / 3600000)}h old — stale, refusing to write.`);
    console.error(`Re-compose the memory file or remove the stale one and try again.`);
    process.exit(5);
  }
  return readFileSync(contentSource, 'utf-8');
}

async function cmdWrite(slug, flags) {
  if (!slug) {
    console.error('Usage: write <pipeline-slug> --content <file|-> --outcome <pending|good|neutral|negative> [--agent <KEY>] [--tag <extra>]...');
    process.exit(1);
  }

  const contentSource = flags.content;
  if (!contentSource) {
    console.error('--content required (file path or "-" for stdin)');
    process.exit(1);
  }

  let content = readContent(contentSource).trim();
  if (!content) {
    console.error('Content is empty');
    process.exit(1);
  }
  if (content.length > 50000) {
    console.error(`Content too long (${content.length} chars, max 50000)`);
    process.exit(1);
  }

  const outcome = flags.outcome || 'pending';
  if (!['pending', 'good', 'neutral', 'negative'].includes(outcome)) {
    console.error('--outcome must be one of: pending, good, neutral, negative');
    process.exit(1);
  }

  const tags = [
    `pipeline:${slug}`,
    `run:${isoWeek()}`,
    `outcome:${outcome}`,
  ];
  const extraTags = flags.tag ? (Array.isArray(flags.tag) ? flags.tag : [flags.tag]) : [];
  tags.push(...extraTags);

  const agentKey = flags.agent || 'PROGRAM_MANAGER';
  const agentId = AGENTS[agentKey];
  if (!agentId) {
    console.error(`Unknown agent key: ${agentKey}. Valid: ${Object.keys(AGENTS).join(', ')}`);
    process.exit(1);
  }

  const result = await api('POST', `/api/companies/${PAPERCLIP_COMPANY_ID}/memories`, {
    agentId,
    content,
    content_type: 'insight',
    tags,
  }, agentId);

  console.log(`Memory written: ${result.id || '(no id returned)'}`);
  console.log(`Tags: ${tags.join(', ')}`);
  console.log(`Length: ${content.length} chars`);

  // Detect degraded write: API stores rows with embedding=null when Ollama is down,
  // but those rows are filtered out of future semantic recalls. Surface this.
  if (result && (result.embedding === null || result.embedding_status === 'failed' || result.warning)) {
    console.error('');
    console.error('⚠ WARNING: memory written WITHOUT embedding (Ollama likely unavailable).');
    console.error('  This entry will be invisible to future semantic recalls until embedding is backfilled.');
    console.error('  Investigate Ollama status. Pipeline task should be set to blocked, not done.');
    process.exit(4);
  }
}

async function cmdUpdateOutcome(memoryId, newOutcome) {
  if (!memoryId || !newOutcome) {
    console.error('Usage: update-outcome <memory-id> <good|neutral|negative>');
    process.exit(1);
  }
  if (!['good', 'neutral', 'negative'].includes(newOutcome)) {
    console.error('outcome must be one of: good, neutral, negative');
    process.exit(1);
  }

  // Read current memory
  const memory = await api('GET', `/api/companies/${PAPERCLIP_COMPANY_ID}/memories/${memoryId}`);
  const oldTags = (memory.tags || []).filter((t) => !t.startsWith('outcome:'));
  const newTags = [...oldTags, `outcome:${newOutcome}`];

  await api('PATCH', `/api/companies/${PAPERCLIP_COMPANY_ID}/memories/${memoryId}`, {
    tags: newTags,
  });

  console.log(`Memory ${memoryId} outcome → ${newOutcome}`);
  console.log(`Tags now: ${newTags.join(', ')}`);
}

// ----- Entry -----

async function main() {
  const args = process.argv.slice(2);
  const [cmd, slug, ...rest] = args;
  const { positional, flags } = parseFlags(rest);

  try {
    if (cmd === 'recall') {
      const query = positional.join(' ');
      await cmdRecall(slug, query, flags);
    } else if (cmd === 'write') {
      await cmdWrite(slug, flags);
    } else if (cmd === 'update-outcome') {
      await cmdUpdateOutcome(slug, positional[0]);
    } else {
      console.error('Unknown command. Use: recall | write | update-outcome');
      console.error('');
      console.error('  node scripts/tools/pipeline-memory.mjs recall <slug> "<query>" [--limit 10] [--days 60]');
      console.error('  node scripts/tools/pipeline-memory.mjs write  <slug> --content <file|-> --outcome pending [--agent KEY] [--tag X]');
      console.error('  node scripts/tools/pipeline-memory.mjs update-outcome <memory-id> <good|neutral|negative>');
      process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(2);
  }
}

main();
