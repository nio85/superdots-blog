#!/usr/bin/env node
/**
 * Daily Content Pipeline
 *
 * Creates a parent "Daily content" task assigned to the Content Manager,
 * with sequential subtasks for the full editorial workflow.
 *
 * Flow:
 *   Content Manager owns the parent task and coordinates:
 *   1. SEO Expert -> keyword research & briefs
 *   2. Content Manager -> reviews briefs, creates article briefs for Copywriter
 *   3. Copywriter -> writes articles, opens PRs (one per article)
 *   4. Frontend Designer -> generates AI hero images, pushes to same PR branch
 *   5. Legal Expert -> reviews PR for compliance, approves or requests changes
 *   6. Content Manager -> final review, merges PR -> auto-deploy to production
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

  // 3. Create Copywriter article writing subtask (blocked on SEO + CM review)
  const copyTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] Write articles and open PRs`,
    description: `## Daily Content Pipeline — ${today}\n\nWrite full articles based on article briefs from the Content Manager.\n\nFor each article:\n1. Follow the **Git Publishing Procedure** in CLAUDE.md\n2. Create branch \`content/${today}_<slug>\`\n3. Write the article in \`src/content/blog/<slug>.md\`\n4. Include an \`imageHint\` field in frontmatter — a short description (10-20 words) of what the hero image should depict, specific to the article content (e.g. \`imageHint: "person at desk comparing two email drafts side by side"\`)\n5. Commit, push, open PR targeting \`main\`\n6. Post the PR URL as a comment on this task\n\n## Guidelines\n- Write for busy professionals, not academics\n- Voice: direct, conversational, zero corporate fluff\n- Every article MUST have a FAQ section (4-5 questions)\n- One PR per article\n\n## Blocked on\nContent Manager review of [${seoTask.identifier}](/SUP/issues/${seoTask.identifier}) SEO briefs.`,
    status: 'blocked',
    priority: 'high',
    projectId: PROJECT_ID,
    parentId: parentTask.id,
    assigneeAgentId: AGENTS.COPYWRITER,
  });
  console.log(`  Copywriter task: ${copyTask.identifier} (${copyTask.id})`);

  // 4. Create image generation subtask — Frontend Designer (blocked on Copywriter PRs)
  const imageTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] Generate AI hero images for new articles`,
    description: `## Daily Content Pipeline — ${today}\n\nGenerate AI hero images for today's new articles and push them to the Copywriter's open PRs.\n\n## Steps\nFor each article PR opened by the Copywriter:\n1. \`git fetch origin && git checkout <branch-name> && git pull origin <branch-name>\`\n2. Run \`node scripts/generate-ai-images.mjs --slug <article-slug>\` to generate the hero image\n3. Review the generated image against brand guidelines (see \`scripts/image-style-config.json\` qualityCalibration section). Regenerate if it doesn't meet standards.\n4. Verify the image is specific to the article content, not generic. The article's \`imageHint\` frontmatter field describes what the image should depict.\n5. Commit the image + updated frontmatter, push to the same branch\n6. Comment on this task confirming images are done\n\n## Requirements\n- \`REPLICATE_API_TOKEN\` must be set (load from \`.env\`)\n- Work on the **same branch** as the Copywriter's PR — do NOT create a new branch\n- Check PR URLs in [${copyTask.identifier}](/SUP/issues/${copyTask.identifier}) task comments\n\n## Blocked on\nCopywriter PRs from [${copyTask.identifier}](/SUP/issues/${copyTask.identifier}). Look for PR URLs in that task's comments.`,
    status: 'blocked',
    priority: 'high',
    projectId: PROJECT_ID,
    parentId: parentTask.id,
    assigneeAgentId: AGENTS.FRONTEND_DESIGNER,
  });
  console.log(`  Image gen task: ${imageTask.identifier} (${imageTask.id})`);

  // 5. Create legal review subtask (blocked on images being added)
  const legalTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] Legal compliance review of new articles`,
    description: `## Daily Content Pipeline — ${today}\n\nReview today's article PRs for legal and compliance issues before publication.\n\n## What to check\n- GDPR compliance: no personal data collection claims without proper disclosure\n- Affiliate/sponsorship disclosure if applicable\n- No misleading claims about AI capabilities\n- Copyright: no copied content, proper attribution\n- Privacy policy consistency: if article references data handling, verify it matches our privacy policy\n\n## Steps\nFor each article PR (find PR URLs in [${imageTask.identifier}](/SUP/issues/${imageTask.identifier}) and [${copyTask.identifier}](/SUP/issues/${copyTask.identifier}) task comments):\n1. Read the article content in the PR branch\n2. If **approved**: comment on this task "Approved: PR #XX" for each PR\n3. If **changes needed**: create a new Paperclip task assigned to the relevant agent (Copywriter for content changes, Designer for image changes) with specific required fixes and a reference to the PR. Set this task to \`blocked\` until the fix task is done.\n\n## When all PRs are approved\nComment on the parent task [${parentTask.identifier}](/SUP/issues/${parentTask.identifier}) that legal review is complete. The Content Manager can then merge.\n\n## Blocked on\nImages added to PRs by Frontend Designer [${imageTask.identifier}](/SUP/issues/${imageTask.identifier}).`,
    status: 'blocked',
    priority: 'medium',
    projectId: PROJECT_ID,
    parentId: parentTask.id,
    assigneeAgentId: AGENTS.LEGAL_EXPERT,
  });
  console.log(`  Legal review task: ${legalTask.identifier} (${legalTask.id})`);

  // 6. Create Content Manager merge subtask (blocked on legal approval)
  const mergeTask = await api('POST', `/api/companies/${COMPANY_ID}/issues`, {
    title: `[${today}] Final review and merge article PRs`,
    description: `## Daily Content Pipeline — ${today}\n\nFinal editorial review and merge of today's article PRs.\n\n## Prerequisites\n- All PRs have article content (Copywriter) + hero images (Designer)\n- Legal review approved ([${legalTask.identifier}](/SUP/issues/${legalTask.identifier}))\n\n## Steps\nFor each article PR:\n1. Final editorial quality check (tone, structure, frontmatter completeness)\n2. Verify hero image is present and appropriate\n3. Verify CI passes\n4. Merge PR to \`main\` using \`gh pr merge <number> --merge --repo nio85/superdots-blog\`\n5. Verify deploy succeeded at https://superdots.sh\n\n## After merging all PRs\nComment on parent task [${parentTask.identifier}](/SUP/issues/${parentTask.identifier}) with published article URLs. Close the parent task.\n\n## Blocked on\nLegal approval from [${legalTask.identifier}](/SUP/issues/${legalTask.identifier}).`,
    status: 'blocked',
    priority: 'high',
    projectId: PROJECT_ID,
    parentId: parentTask.id,
    assigneeAgentId: AGENTS.CONTENT_MANAGER,
  });
  console.log(`  Merge task: ${mergeTask.identifier} (${mergeTask.id})`);

  console.log(`[${today}] Pipeline tasks created. Content Manager owns coordination.`);
}

main().catch(err => {
  console.error('Pipeline creation failed:', err.message);
  process.exit(1);
});
