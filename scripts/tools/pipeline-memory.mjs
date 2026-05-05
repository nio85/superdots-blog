#!/usr/bin/env node
/**
 * Pipeline Memory Helper — read history before pipelines run, write outcome after.
 *
 * Usage:
 *   node scripts/tools/pipeline-memory.mjs recall <pipeline-slug> "<query>" [--limit 10] [--days 60]
 *   node scripts/tools/pipeline-memory.mjs write  <pipeline-slug> --content <file|-> --outcome <pending|good|neutral|negative> [--tag <extra>]...
 *
 * Tags applied automatically on write:
 *   pipeline:<slug>     — always
 *   run:YYYY-WW         — ISO year-week
 *   outcome:<value>     — from --outcome (default: pending)
 *
 * Auth: uses PAPERCLIP_API_KEY env var, or auto-generates JWT via config.mjs.
 * Run from /home/luca/superdots-blog/ as user luca.
 */

import { readFileSync } from 'node:fs';
import {
  PAPERCLIP_API_URL,
  PAPERCLIP_COMPANY_ID,
  AGENTS,
  getPaperclipApiKey,
} from '../config.mjs';

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
  const res = await fetch(`${PAPERCLIP_API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        if (flags[key]) {
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
  const limit = parseInt(flags.limit || '10', 10);
  const days = parseInt(flags.days || '60', 10);
  const tags = [`pipeline:${slug}`];

  const result = await api('POST', `/api/companies/${PAPERCLIP_COMPANY_ID}/memories/semantic`, {
    query,
    tags,
    limit,
  });

  const items = result.memories || result.items || result || [];
  const cutoff = Date.now() - days * 86400000;
  const fresh = (Array.isArray(items) ? items : []).filter((m) => {
    const t = new Date(m.created_at || m.createdAt || 0).getTime();
    return t >= cutoff;
  });

  if (fresh.length === 0) {
    console.log(`# Memory recall: pipeline:${slug}`);
    console.log(`# Query: ${query}`);
    console.log('');
    console.log('_No prior memories found for this pipeline within the lookback window._');
    console.log('_This may be the first run — establish baseline carefully and document thoroughly in the write-history step._');
    return;
  }

  console.log(`# Memory recall: pipeline:${slug} (${fresh.length} entries, last ${days}d)`);
  console.log(`# Query: ${query}`);
  console.log('');

  for (const m of fresh) {
    const date = (m.created_at || m.createdAt || '').slice(0, 10);
    const tagList = (m.tags || []).join(', ');
    const score = m.similarity != null ? ` [sim=${m.similarity.toFixed(3)}]` : '';
    console.log(`## ${date}${score}`);
    console.log(`Tags: ${tagList}`);
    console.log('');
    console.log((m.content || '').slice(0, 1500));
    console.log('');
    console.log('---');
    console.log('');
  }
}

async function cmdWrite(slug, flags) {
  if (!slug) {
    console.error('Usage: write <pipeline-slug> --content <file|-> --outcome <pending|good|neutral|negative> [--agent <KEY>]');
    process.exit(1);
  }

  const contentSource = flags.content;
  if (!contentSource) {
    console.error('--content required (file path or "-" for stdin)');
    process.exit(1);
  }

  let content;
  if (contentSource === '-') {
    content = readFileSync(0, 'utf-8');
  } else {
    content = readFileSync(contentSource, 'utf-8');
  }
  content = content.trim();
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
    } else {
      console.error('Unknown command. Use: recall | write');
      console.error('');
      console.error('  node scripts/tools/pipeline-memory.mjs recall <slug> "<query>" [--limit 10] [--days 60]');
      console.error('  node scripts/tools/pipeline-memory.mjs write  <slug> --content <file|-> --outcome pending [--agent KEY]');
      process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(2);
  }
}

main();
