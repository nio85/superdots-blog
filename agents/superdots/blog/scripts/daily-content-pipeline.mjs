#!/usr/bin/env node
/**
 * Daily Content Pipeline
 *
 * Creates a parent "Daily content" task assigned to the Content Manager,
 * with SEO brief and Copywriter proposal subtasks.
 *
 * Flow (per SUP-31 editorial workflow):
 *   Content Manager owns the parent task and coordinates:
 *   1. SEO Expert -> keyword research & briefs
 *   2. Content Manager -> reviews briefs, creates article briefs for Copywriter
 *   3. Copywriter -> develops proposals from briefs
 *   4. Content Manager -> quality check, publish handoff
 *   5. Founding Engineer -> deploy all new articles to production
 *
 * Auth: uses PAPERCLIP_API_KEY if available, otherwise generates a JWT
 * from PAPERCLIP_AGENT_JWT_SECRET (loaded from ~/.paperclip/instances/default/.env).
 */

import {
  PAPERCLIP_API_URL as API_URL,
  PAPERCLIP_COMPANY_ID as COMPANY_ID,
  PAPERCLIP_PROJECT_ID as PROJECT_ID,
  AGENTS,
  getPaperclipApiKey,
} from './config.mjs';

const API_KEY = getPaperclipApiKey(AGENTS.CEO);
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
    assigneeAgentId: AGENTS.CONTENT_MANAGER,
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
    assigneeAgentId: AGENTS.SEO_EXPERT,
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
    assigneeAgentId: AGENTS.COPYWRITER,
  });
  console.log(`  Copywriter task: ${copyTask.identifier} (${copyTask.id})`);

  // 4. Create image generation subtask (blocked on Content Manager review of articles)
  const imageTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] Generate AI hero images for new articles`,
    description: `## Daily Content Pipeline — ${today}\n\nGenerate AI hero images for today's new articles using Flux Pro via Replicate.\n\n## Steps\n1. Run \`node scripts/generate-ai-images.mjs\` from the blog directory\n2. Script auto-detects articles missing AI images and generates them\n3. Falls back to existing SVG hero images if Replicate API fails\n4. Updates article frontmatter with new image paths\n\n## Requirements\n- \`REPLICATE_API_TOKEN\` must be set\n- If token is unavailable, existing SVG images are kept as fallback\n\n## Blocked on\nContent Manager review and approval of articles from [${copyTask.identifier}](/SUP/issues/${copyTask.identifier}).`,
    status: 'blocked',
    priority: 'high',
    projectId: PROJECT_ID,
    parentId: parentTask.id,
    assigneeAgentId: AGENTS.FOUNDING_ENGINEER,
  });
  console.log(`  Image gen task: ${imageTask.identifier} (${imageTask.id})`);

  // 5. Create deploy subtask (blocked on image generation)
  const deployTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] Deploy new articles to production`,
    description: `## Daily Content Pipeline — ${today}\n\nDeploy all new articles from today's content batch to production.\n\n## Steps\n1. Run \`npm run deploy\` from the blog directory (auto-detects Wrangler or subtree push)\n2. Deploy script auto-generates any missing AI hero images before building\n3. Verify deployment succeeds\n\n## Blocked on\nImage generation [${imageTask.identifier}](/SUP/issues/${imageTask.identifier}) and Content Manager review of articles from [${copyTask.identifier}](/SUP/issues/${copyTask.identifier}).`,
    status: 'blocked',
    priority: 'high',
    projectId: PROJECT_ID,
    parentId: parentTask.id,
    assigneeAgentId: AGENTS.FOUNDING_ENGINEER,
  });
  console.log(`  Deploy task: ${deployTask.identifier} (${deployTask.id})`);

  console.log(`[${today}] Pipeline tasks created. Content Manager owns coordination.`);
}

main().catch(err => {
  console.error('Pipeline creation failed:', err.message);
  process.exit(1);
});
