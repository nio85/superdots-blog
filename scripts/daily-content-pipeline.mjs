#!/usr/bin/env node
/**
 * Daily Content Pipeline
 *
 * Creates a parent "Daily content" task assigned to the Content Manager,
 * with SEO brief and Copywriter proposal subtasks.
 *
 * Flow (per SUP-31 editorial workflow):
 *   Content Manager owns the parent task and coordinates:
 *   1. SEO Expert → keyword research & briefs
 *   2. Content Manager → reviews briefs, creates article briefs for Copywriter
 *   3. Copywriter → develops proposals from briefs
 *   4. Content Manager → quality check, publish handoff
 *   5. Founding Engineer → deploy all new articles to production
 *
 * Auth: uses PAPERCLIP_API_KEY if available, otherwise generates a JWT
 * from PAPERCLIP_AGENT_JWT_SECRET (loaded from ~/.paperclip/instances/default/.env).
 *
 * Env vars required (at least one auth method):
 *   PAPERCLIP_API_KEY — or —
 *   PAPERCLIP_AGENT_JWT_SECRET (auto-loaded from paperclip .env)
 *
 * Also needs: PAPERCLIP_COMPANY_ID (defaults to Superdots company)
 */

import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// Load paperclip .env for JWT secret
const PAPERCLIP_ENV_PATH = resolve(homedir(), '.paperclip', 'instances', 'default', '.env');
try {
  const envFile = readFileSync(PAPERCLIP_ENV_PATH, 'utf-8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

const API_URL = process.env.PAPERCLIP_API_URL || 'http://localhost:3100';
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || 'cdb3c45d-c7df-4ea0-b495-26426a1e9df4';

// Agent IDs
const CEO_ID = 'ce91a8d9-14e5-4d4b-a9bc-aae3e20a405b';
const CONTENT_MANAGER_ID = '4e20f5d2-69a0-4406-98fa-797de097792e';
const SEO_EXPERT_ID = 'af76f46b-658d-4216-adf5-a9ef8653157a';
const COPYWRITER_ID = 'c19687c9-1bbd-4f5e-a220-fac60ae547c6';
const FOUNDING_ENGINEER_ID = '11e3188a-5eda-49d8-acd4-8815456d9a0f';
const PROJECT_ID = 'd4fe361f-bdeb-4f81-9238-2d6795a54dbc';

function createJwt(secret, agentId, companyId) {
  const b64url = (s) => Buffer.from(s, 'utf8').toString('base64url');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    sub: agentId,
    company_id: companyId,
    adapter_type: 'claude_local',
    run_id: randomUUID(),
    iat: now,
    exp: now + 3600,
    iss: 'paperclip',
    aud: 'paperclip-api',
  }));
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// Resolve auth token
let API_KEY = process.env.PAPERCLIP_API_KEY;
if (!API_KEY && process.env.PAPERCLIP_AGENT_JWT_SECRET) {
  API_KEY = createJwt(process.env.PAPERCLIP_AGENT_JWT_SECRET, CEO_ID, COMPANY_ID);
}
if (!API_KEY) {
  console.error('No auth available: set PAPERCLIP_API_KEY or PAPERCLIP_AGENT_JWT_SECRET');
  process.exit(1);
}

const RUN_ID = process.env.PAPERCLIP_RUN_ID || '';
const today = new Date().toISOString().split('T')[0];

async function api(method, path, body) {
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (RUN_ID) headers['X-Paperclip-Run-Id'] = RUN_ID;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log(`[${today}] Creating daily content pipeline tasks...`);

  // Check if today's parent task already exists
  const existing = await api('GET', `/api/companies/${COMPANY_ID}/issues?q=${encodeURIComponent(`[${today}] Daily content pipeline`)}`);
  if (Array.isArray(existing) && existing.some(i => i.title === `[${today}] Daily content pipeline`)) {
    console.log('Tasks for today already exist. Skipping.');
    return;
  }

  // 1. Create parent task assigned to Content Manager
  const parentTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] Daily content pipeline`,
    description: `## Daily Content Pipeline — ${today}\n\nCoordinate today's content production:\n1. Review SEO briefs when ready\n2. Create article briefs for the Copywriter\n3. Quality-check proposals before they go out\n\nSubtasks track the individual steps.`,
    status: 'todo',
    priority: 'high',
    projectId: PROJECT_ID,
    assigneeAgentId: CONTENT_MANAGER_ID,
  });
  console.log(`  Parent task: ${parentTask.identifier} (${parentTask.id})`);

  // 2. Create SEO brief subtask
  const seoTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] SEO brief: 3 article topic recommendations`,
    description: `## Daily Content Pipeline — ${today}\n\nResearch and provide keyword-backed briefs for 3 blog article topics.\n\nFor each topic:\n- **Target keyword** and search volume/difficulty estimate\n- **Headline suggestion** — SEO-optimized and compelling\n- **Content angle** — practical value for non-technical professionals\n- **Recommended structure** — headings, word count, internal links\n\n## Output\nPost 3 briefs as a comment on this task.\n\n## Deadline\nComplete by 11:00 CET so the Content Manager can review before handing off to the Copywriter.`,
    status: 'todo',
    priority: 'high',
    projectId: PROJECT_ID,
    parentId: parentTask.id,
    assigneeAgentId: SEO_EXPERT_ID,
  });
  console.log(`  SEO task: ${seoTask.identifier} (${seoTask.id})`);

  // 3. Create Copywriter proposals subtask (blocked on SEO + CM review)
  const copyTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] Write 3 article proposals`,
    description: `## Daily Content Pipeline — ${today}\n\nDevelop 3 article proposals based on article briefs from the Content Manager.\n\nFor each proposal:\n- **Title** — compelling, click-worthy, SEO-optimized\n- **Hook** — opening paragraph draft (2-3 sentences)\n- **Outline** — heading structure with summaries\n- **Key takeaways** — 3-5 actionable points\n\n## Guidelines\n- Write for busy professionals, not academics\n- Each proposal should be a different article type (how-to, listicle, deep-dive)\n- Voice: direct, conversational, zero corporate fluff\n- Do NOT write full articles — just proposals\n\n## Output\nPost all 3 proposals as a structured comment.\n\n## Blocked on\nContent Manager review of [${seoTask.identifier}](/SUP/issues/${seoTask.identifier}) SEO briefs.`,
    status: 'blocked',
    priority: 'high',
    projectId: PROJECT_ID,
    parentId: parentTask.id,
    assigneeAgentId: COPYWRITER_ID,
  });
  console.log(`  Copywriter task: ${copyTask.identifier} (${copyTask.id})`);

  // 4. Create deploy subtask (blocked on Content Manager review of articles)
  const deployTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] Deploy new articles to production`,
    description: `## Daily Content Pipeline — ${today}\n\nDeploy all new articles from today's content batch to production.\n\n## Steps\n1. Run \`npm run deploy\` from the blog directory (auto-detects Wrangler or subtree push)\n2. Verify deployment succeeds\n\n## Blocked on\nContent Manager review and approval of articles from [${copyTask.identifier}](/SUP/issues/${copyTask.identifier}).`,
    status: 'blocked',
    priority: 'high',
    projectId: PROJECT_ID,
    parentId: parentTask.id,
    assigneeAgentId: FOUNDING_ENGINEER_ID,
  });
  console.log(`  Deploy task: ${deployTask.identifier} (${deployTask.id})`);

  console.log(`[${today}] Pipeline tasks created. Content Manager owns coordination.`);
}

main().catch(err => {
  console.error('Pipeline creation failed:', err.message);
  process.exit(1);
});
