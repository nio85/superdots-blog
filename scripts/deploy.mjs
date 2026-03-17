#!/usr/bin/env node
/**
 * Deploy superdots-blog to production.
 *
 * Strategy (in order of preference):
 *   1. Wrangler direct upload to Cloudflare Pages (needs CLOUDFLARE_API_TOKEN)
 *   2. Git subtree push to nio85/superdots-blog (needs GITHUB_TOKEN with repo scope)
 *
 * Usage:
 *   node scripts/deploy.mjs            # auto-detect method
 *   node scripts/deploy.mjs --wrangler # force wrangler
 *   node scripts/deploy.mjs --git      # force subtree push
 *   node scripts/deploy.mjs --dry-run  # build only, skip deploy
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BLOG_ROOT, MONO_ROOT,
  CF_ACCOUNT_ID, CF_PROJECT_NAME,
  GH_REMOTE, GH_REPO_URL, SUBTREE_PREFIX,
  PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID, SITE_URL,
  getPaperclipApiKey,
} from './config.mjs';

const args = process.argv.slice(2);
const forceWrangler = args.includes('--wrangler');
const forceGit = args.includes('--git');
const dryRun = args.includes('--dry-run');
const skipImages = args.includes('--skip-images');

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function runCapture(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', ...opts }).trim();
}

function generateImages() {
  if (skipImages) {
    console.log('\n== Skipping image generation (--skip-images) ==');
    return;
  }
  if (!process.env.REPLICATE_API_TOKEN) {
    console.log('\n== Skipping image generation (REPLICATE_API_TOKEN not set) ==');
    console.log('  Existing SVG hero images will be used as fallback.');
    return;
  }
  console.log('\n== Generating AI hero images ==');
  try {
    run('node scripts/generate-ai-images.mjs', { cwd: BLOG_ROOT });
    console.log('Image generation complete.');
  } catch (err) {
    console.warn(`Image generation failed: ${err.message}`);
    console.warn('Continuing with existing images (SVG fallback).');
  }
}

function build() {
  console.log('\n== Building blog ==');
  run('npm run build', { cwd: BLOG_ROOT });

  const distDir = resolve(BLOG_ROOT, 'dist');
  if (!existsSync(distDir)) {
    console.error('Build failed: dist/ directory not found');
    process.exit(1);
  }
  console.log('Build successful.');
  return distDir;
}

function canWrangler() {
  return !!process.env.CLOUDFLARE_API_TOKEN;
}

function canGit() {
  if (!process.env.GITHUB_TOKEN) return false;
  try {
    const result = runCapture(
      `curl -sf -H "Authorization: token ${process.env.GITHUB_TOKEN}" https://api.github.com/user`
    );
    return !!result;
  } catch {
    return false;
  }
}

function deployWrangler(distDir) {
  console.log('\n== Deploying via Wrangler (direct upload) ==');
  run(
    `npx wrangler pages deploy "${distDir}" --project-name=${CF_PROJECT_NAME} --commit-dirty=true`,
    {
      cwd: BLOG_ROOT,
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT_ID,
      },
    }
  );
  console.log('\nDeploy complete (Wrangler).');
}

function deployGit() {
  console.log('\n== Deploying via git subtree push ==');

  try {
    runCapture(`git remote get-url ${GH_REMOTE}`, { cwd: MONO_ROOT });
  } catch {
    run(`git remote add ${GH_REMOTE} ${GH_REPO_URL}`, { cwd: MONO_ROOT });
  }

  const token = process.env.GITHUB_TOKEN;
  const authUrl = `https://x-access-token:${token}@github.com/nio85/superdots-blog.git`;
  run(`git remote set-url ${GH_REMOTE} "${authUrl}"`, { cwd: MONO_ROOT });

  try {
    run(`git subtree push --prefix=${SUBTREE_PREFIX} ${GH_REMOTE} main`, {
      cwd: MONO_ROOT,
    });
    console.log('\nDeploy complete (subtree push -> Cloudflare Pages CI/CD).');
  } finally {
    run(`git remote set-url ${GH_REMOTE} "${GH_REPO_URL}"`, { cwd: MONO_ROOT });
  }
}

async function notifyPaperclip(success, method, error) {
  const apiKey = getPaperclipApiKey();
  if (!apiKey) return;
  const runId = process.env.PAPERCLIP_RUN_ID;
  const taskId = process.env.PAPERCLIP_TASK_ID;
  if (!taskId) return;

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (runId) headers['X-Paperclip-Run-Id'] = runId;

  const body = success
    ? { status: 'done', comment: `Deploy successful via ${method}.\n\nSite live at ${SITE_URL}` }
    : { status: 'blocked', comment: `Deploy failed via ${method}.\n\nError: ${error}` };

  try {
    await fetch(`${PAPERCLIP_API_URL}/api/issues/${taskId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    console.log(`Paperclip task ${taskId} updated: ${body.status}`);
  } catch (e) {
    console.error(`Failed to notify Paperclip: ${e.message}`);
  }
}

async function main() {
  console.log('superdots-blog deploy');
  console.log('====================');

  generateImages();
  const distDir = build();

  if (dryRun) {
    console.log('\n--dry-run: skipping deploy.');
    return;
  }

  let method = 'unknown';
  try {
    if (forceWrangler) {
      if (!canWrangler()) {
        console.error('CLOUDFLARE_API_TOKEN not set. Cannot deploy via Wrangler.');
        process.exit(1);
      }
      method = 'wrangler';
      deployWrangler(distDir);
    } else if (forceGit) {
      if (!canGit()) {
        console.error('GITHUB_TOKEN not set or invalid. Cannot deploy via subtree push.');
        process.exit(1);
      }
      method = 'subtree-push';
      deployGit();
    } else {
      if (canWrangler()) {
        method = 'wrangler';
        deployWrangler(distDir);
      } else if (canGit()) {
        method = 'subtree-push';
        deployGit();
      } else {
        console.error(
          '\nNo deploy credentials available.\n' +
          'Set CLOUDFLARE_API_TOKEN for Wrangler direct upload, or\n' +
          'set GITHUB_TOKEN (with repo scope) for subtree push.\n'
        );
        process.exit(1);
      }
    }
    await notifyPaperclip(true, method);
  } catch (err) {
    await notifyPaperclip(false, method, err.message);
    throw err;
  }
}

main().catch(err => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
