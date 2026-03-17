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
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_ROOT = resolve(__dirname, '..');
const MONO_ROOT = resolve(BLOG_ROOT, '..', '..', '..');

const CF_ACCOUNT_ID = '2013b526ab724299e028e1fcfe5a5c62';
const CF_PROJECT_NAME = 'superdots-blog';
const GH_REMOTE = 'superdots-blog';
const GH_REPO_URL = 'https://github.com/nio85/superdots-blog.git';
const SUBTREE_PREFIX = 'agents/superdots/blog';

const args = process.argv.slice(2);
const forceWrangler = args.includes('--wrangler');
const forceGit = args.includes('--git');
const dryRun = args.includes('--dry-run');

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function runCapture(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', ...opts }).trim();
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
  // Quick check: test the token
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

  // Ensure remote exists
  try {
    runCapture(`git remote get-url ${GH_REMOTE}`, { cwd: MONO_ROOT });
  } catch {
    run(`git remote add ${GH_REMOTE} ${GH_REPO_URL}`, { cwd: MONO_ROOT });
  }

  // Set authenticated remote URL
  const token = process.env.GITHUB_TOKEN;
  const authUrl = `https://x-access-token:${token}@github.com/nio85/superdots-blog.git`;
  run(`git remote set-url ${GH_REMOTE} "${authUrl}"`, { cwd: MONO_ROOT });

  try {
    run(`git subtree push --prefix=${SUBTREE_PREFIX} ${GH_REMOTE} main`, {
      cwd: MONO_ROOT,
    });
    console.log('\nDeploy complete (subtree push → Cloudflare Pages CI/CD).');
  } finally {
    // Restore non-authenticated URL
    run(`git remote set-url ${GH_REMOTE} "${GH_REPO_URL}"`, { cwd: MONO_ROOT });
  }
}

async function main() {
  console.log('superdots-blog deploy');
  console.log('====================');

  const distDir = build();

  if (dryRun) {
    console.log('\n--dry-run: skipping deploy.');
    return;
  }

  // Pick deploy method
  if (forceWrangler) {
    if (!canWrangler()) {
      console.error('CLOUDFLARE_API_TOKEN not set. Cannot deploy via Wrangler.');
      process.exit(1);
    }
    deployWrangler(distDir);
  } else if (forceGit) {
    if (!canGit()) {
      console.error('GITHUB_TOKEN not set or invalid. Cannot deploy via subtree push.');
      process.exit(1);
    }
    deployGit();
  } else {
    // Auto-detect
    if (canWrangler()) {
      deployWrangler(distDir);
    } else if (canGit()) {
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
}

main().catch(err => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
