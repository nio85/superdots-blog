#!/usr/bin/env node
/**
 * Deploy superdots-blog to production.
 *
 * Strategy (in order of preference):
 *   1. Wrangler direct upload to Cloudflare Pages (needs CLOUDFLARE_API_TOKEN)
 *   2. Git subtree push to nio85/superdots-blog (needs GITHUB_TOKEN with repo scope)
 *
 * Post-deploy verification:
 *   - Polls CF Pages API to confirm deployment succeeded
 *   - Verifies all generated pages are live (homepage, blog listing, sitemap, RSS,
 *     individual articles, tag/department/use-case pages)
 *
 * Usage:
 *   node scripts/deploy.mjs                          # auto-detect method
 *   node scripts/deploy.mjs --wrangler               # force wrangler
 *   node scripts/deploy.mjs --git                    # force subtree push
 *   node scripts/deploy.mjs --dry-run                # build only, skip deploy
 *   node scripts/deploy.mjs --skip-verify            # skip post-deploy verification
 *   node scripts/deploy.mjs --verify-slugs=a,b,c     # verify only specific slugs
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BLOG_ROOT, MONO_ROOT,
  CF_ACCOUNT_ID, CF_PROJECT_NAME,
  GH_REMOTE, GH_REPO_URL, SUBTREE_PREFIX,
  PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID, SITE_URL,
  getPaperclipApiKey,
} from './config.mjs';

// --- CLI flags ---

const args = process.argv.slice(2);
const forceWrangler = args.includes('--wrangler');
const forceGit = args.includes('--git');
const dryRun = args.includes('--dry-run');
const skipImages = args.includes('--skip-images');
const skipVerify = args.includes('--skip-verify');
const verifySlugsArg = args.find(a => a.startsWith('--verify-slugs='));
const verifySlugs = verifySlugsArg ? verifySlugsArg.split('=')[1].split(',').filter(Boolean) : null;

// --- Shell helpers ---

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function runCapture(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', ...opts }).trim();
}

// --- HTTP helper ---

async function fetchWithTimeout(url, timeoutMs = 15000, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url, timeoutMs = 15000) {
  try {
    const res = await fetchWithTimeout(url, timeoutMs);
    if (res.ok) return res;
    // Non-200: retry once after 10s (CDN cache propagation)
    console.log(`    ${url} returned ${res.status}, retrying in 10s...`);
    await sleep(10000);
    return await fetchWithTimeout(url, timeoutMs);
  } catch (err) {
    console.log(`    ${url} failed (${err.message}), retrying in 10s...`);
    await sleep(10000);
    return await fetchWithTimeout(url, timeoutMs);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- Build & deploy (unchanged) ---

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

  const currentUrl = runCapture(`git remote get-url ${GH_REMOTE}`, { cwd: MONO_ROOT });
  if (currentUrl !== GH_REPO_URL) {
    run(`git remote set-url ${GH_REMOTE} "${GH_REPO_URL}"`, { cwd: MONO_ROOT });
  }

  let needsCleanup = false;
  try {
    runCapture(`git ls-remote --heads ${GH_REMOTE} main`, { cwd: MONO_ROOT });
  } catch {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN not set and credential helper failed');
    const authUrl = `https://x-access-token:${token}@github.com/nio85/superdots-blog.git`;
    run(`git remote set-url ${GH_REMOTE} "${authUrl}"`, { cwd: MONO_ROOT });
    needsCleanup = true;
  }

  try {
    run(`git subtree push --prefix=${SUBTREE_PREFIX} ${GH_REMOTE} main`, {
      cwd: MONO_ROOT,
    });
    console.log('\nDeploy complete (subtree push -> Cloudflare Pages CI/CD).');
  } finally {
    if (needsCleanup) {
      run(`git remote set-url ${GH_REMOTE} "${GH_REPO_URL}"`, { cwd: MONO_ROOT });
    }
  }
}

// --- Step 1: Poll CF deployment status ---

async function pollCfDeployment(method) {
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!cfToken) {
    console.log('\n== Skipping CF deployment poll (CLOUDFLARE_API_TOKEN not set) ==');
    return 'skipped';
  }

  console.log('\n== Polling CF deployment status ==');
  const maxAttempts = method === 'wrangler' ? 30 : 60; // 5 min / 10 min
  const pollInterval = 10000; // 10s
  const deployStartTime = Date.now();
  const cfHeaders = { headers: { 'Authorization': `Bearer ${cfToken}` } };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PROJECT_NAME}/deployments?per_page=1`,
        15000,
        cfHeaders
      );
      if (!res.ok) {
        console.log(`  CF API returned ${res.status}, retrying...`);
        await sleep(pollInterval);
        continue;
      }

      const data = await res.json();
      const deploy = data.result?.[0];
      if (!deploy) {
        console.log(`  No deployments found, retrying...`);
        await sleep(pollInterval);
        continue;
      }

      // Verify this is a recent deployment (within last 2 min of deploy start)
      const createdAt = new Date(deploy.created_on).getTime();
      if (createdAt < deployStartTime - 2 * 60 * 1000) {
        console.log(`  Latest deployment is older than expected (${deploy.created_on}), waiting for new one...`);
        await sleep(pollInterval);
        continue;
      }

      const status = deploy.latest_stage?.status;
      const stageName = deploy.latest_stage?.name || 'unknown';
      console.log(`  [${attempt}/${maxAttempts}] Stage: ${stageName}, status: ${status}`);

      if (status === 'success') {
        console.log(`  CF deployment: success`);
        return 'success';
      }
      if (status === 'failure') {
        throw new Error(`CF deployment failed at stage "${stageName}"`);
      }

      // Still in progress
      await sleep(pollInterval);
    } catch (err) {
      if (err.message.startsWith('CF deployment failed')) throw err;
      console.log(`  CF API error: ${err.message}, retrying...`);
      await sleep(pollInterval);
    }
  }

  throw new Error(`CF deployment did not complete within ${maxAttempts * pollInterval / 60000} minutes`);
}

// --- Step 2: Verify site is live ---

async function verifySiteLive(distDir) {
  console.log('\n== Verifying site is live ==');
  const report = {};

  // 2a. Discover all slugs from dist/blog/
  const blogDistDir = resolve(distDir, 'blog');
  let allSlugs = [];
  if (existsSync(blogDistDir)) {
    allSlugs = readdirSync(blogDistDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  }

  const slugsToVerify = verifySlugs || allSlugs;

  // 2b. Mandatory HTTP checks
  // Homepage
  console.log('  Verifying homepage...');
  const homeRes = await fetchWithRetry(`${SITE_URL}/`);
  if (!homeRes.ok) throw new Error(`Homepage returned ${homeRes.status}`);
  report.homepage = '200 OK';
  console.log(`    Homepage: 200 OK`);

  // Blog listing
  console.log('  Verifying blog listing...');
  const blogRes = await fetchWithRetry(`${SITE_URL}/blog/`);
  if (!blogRes.ok) throw new Error(`Blog listing returned ${blogRes.status}`);
  const blogHtml = await blogRes.text();
  report.blogListing = '200 OK';
  console.log(`    Blog listing: 200 OK`);

  // Sitemap
  console.log('  Verifying sitemap...');
  const sitemapIndexRes = await fetchWithRetry(`${SITE_URL}/sitemap-index.xml`);
  if (!sitemapIndexRes.ok) throw new Error(`Sitemap index returned ${sitemapIndexRes.status}`);
  const sitemapIndexBody = await sitemapIndexRes.text();
  const sitemapUrls = [...sitemapIndexBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  // Fetch all sub-sitemaps to collect all page URLs
  const allSitemapUrls = [];
  for (const smUrl of sitemapUrls) {
    try {
      const smRes = await fetchWithRetry(smUrl);
      if (smRes.ok) {
        const smBody = await smRes.text();
        const urls = [...smBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
        allSitemapUrls.push(...urls);
      }
    } catch {}
  }

  // Check that all dist/blog/ slugs appear in sitemap
  const sitemapSlugs = allSitemapUrls
    .filter(u => u.includes('/blog/'))
    .map(u => u.replace(/\/$/, '').split('/').pop());
  const missingSlugs = allSlugs.filter(s => !sitemapSlugs.includes(s));
  report.sitemap = `${allSlugs.length} articles (${missingSlugs.length === 0 ? 'all present' : `${missingSlugs.length} missing: ${missingSlugs.slice(0, 5).join(', ')}`})`;
  console.log(`    Sitemap: ${report.sitemap}`);
  if (missingSlugs.length > 0) {
    console.warn(`    WARNING: ${missingSlugs.length} slug(s) missing from sitemap: ${missingSlugs.slice(0, 10).join(', ')}`);
  }

  // RSS
  console.log('  Verifying RSS...');
  const rssRes = await fetchWithRetry(`${SITE_URL}/rss.xml`);
  if (!rssRes.ok) throw new Error(`RSS returned ${rssRes.status}`);
  const rssBody = await rssRes.text();
  const rssItems = rssBody.match(/<item>/g);
  const rssCount = rssItems ? rssItems.length : 0;
  report.rss = `${rssCount} items`;
  console.log(`    RSS: ${rssCount} items`);

  // 2c. Verify article pages (parallel batches of 5)
  console.log(`  Verifying articles (${slugsToVerify.length} slugs)...`);
  let articlesVerified = 0;
  const articleErrors = [];

  for (let i = 0; i < slugsToVerify.length; i += 5) {
    const batch = slugsToVerify.slice(i, i + 5);
    const results = await Promise.all(batch.map(async (slug) => {
      try {
        const res = await fetchWithRetry(`${SITE_URL}/blog/${slug}/`);
        if (!res.ok) return { slug, error: `HTTP ${res.status}` };
        return { slug, ok: true };
      } catch (err) {
        return { slug, error: err.message };
      }
    }));
    for (const r of results) {
      if (r.ok) {
        articlesVerified++;
      } else {
        articleErrors.push(`${r.slug}: ${r.error}`);
      }
    }
  }
  report.articles = `${articlesVerified}/${slugsToVerify.length} live`;
  console.log(`    Articles verified: ${report.articles}`);
  if (articleErrors.length) {
    console.warn(`    FAILED articles: ${articleErrors.join(', ')}`);
  }

  // 2d. Verify derived pages (tags, departments, use cases) from frontmatter
  const tagSet = new Set();
  const deptSet = new Set();
  const useCaseSet = new Set();
  const articleTitles = {}; // slug -> title

  const contentDir = resolve(BLOG_ROOT, 'src', 'content', 'blog');
  for (const slug of slugsToVerify) {
    // Try both .md and .mdx
    let filePath = resolve(contentDir, `${slug}.md`);
    if (!existsSync(filePath)) filePath = resolve(contentDir, `${slug}.mdx`);
    if (!existsSync(filePath)) continue;

    try {
      const content = readFileSync(filePath, 'utf-8');
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];

      const titleMatch = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (titleMatch) articleTitles[slug] = titleMatch[1];

      // Tags: handle both array formats
      const tagsInline = fm.match(/^tags:\s*\[([^\]]+)\]/m);
      const tagsBlock = fm.match(/^tags:\s*\n((?:\s+-\s+.+\n?)+)/m);
      if (tagsInline) {
        tagsInline[1].split(',').map(t => t.trim().replace(/["']/g, '')).filter(Boolean).forEach(t => tagSet.add(t));
      } else if (tagsBlock) {
        tagsBlock[1].match(/- (.+)/g)?.forEach(m => tagSet.add(m.replace(/^- /, '').trim().replace(/["']/g, '')));
      }

      const deptMatch = fm.match(/^department:\s*["']?(.+?)["']?\s*$/m);
      if (deptMatch) deptSet.add(deptMatch[1]);

      const ucMatch = fm.match(/^useCase:\s*["']?(.+?)["']?\s*$/m);
      if (ucMatch) useCaseSet.add(ucMatch[1]);
    } catch {}
  }

  // Verify tag pages
  const verifiedTags = [];
  if (tagSet.size > 0) {
    console.log(`  Verifying tag pages (${tagSet.size} tags)...`);
    const tags = [...tagSet];
    for (let i = 0; i < tags.length; i += 5) {
      const batch = tags.slice(i, i + 5);
      await Promise.all(batch.map(async (tag) => {
        try {
          const res = await fetchWithRetry(`${SITE_URL}/tags/${tag}/`);
          if (res.ok) {
            verifiedTags.push(tag);
            console.log(`    ${tag}: 200 OK`);
          } else {
            console.warn(`    ${tag}: HTTP ${res.status}`);
          }
        } catch (err) {
          console.warn(`    ${tag}: ${err.message}`);
        }
      }));
    }
  }
  report.tags = verifiedTags.length > 0 ? `${verifiedTags.join(', ')} (all OK)` : 'none';

  // Verify tags listing and category hub
  console.log('  Verifying tags listing...');
  try {
    const tagsListRes = await fetchWithRetry(`${SITE_URL}/tags/`);
    if (tagsListRes.ok) console.log('    Tags listing: 200 OK');
    else console.warn(`    Tags listing: HTTP ${tagsListRes.status}`);
  } catch (err) {
    console.warn(`    Tags listing: ${err.message}`);
  }

  console.log('  Verifying category hub...');
  try {
    const catRes = await fetchWithRetry(`${SITE_URL}/category/`);
    if (catRes.ok) console.log('    Category hub: 200 OK');
    else console.warn(`    Category hub: HTTP ${catRes.status}`);
  } catch (err) {
    console.warn(`    Category hub: ${err.message}`);
  }

  // Verify department pages
  const verifiedDepts = [];
  if (deptSet.size > 0) {
    console.log(`  Verifying department pages (${deptSet.size})...`);
    const depts = [...deptSet];
    for (let i = 0; i < depts.length; i += 5) {
      const batch = depts.slice(i, i + 5);
      await Promise.all(batch.map(async (dept) => {
        try {
          const res = await fetchWithRetry(`${SITE_URL}/category/department/${dept}/`);
          if (res.ok) {
            verifiedDepts.push(dept);
            console.log(`    ${dept}: 200 OK`);
          } else {
            console.warn(`    ${dept}: HTTP ${res.status}`);
          }
        } catch (err) {
          console.warn(`    ${dept}: ${err.message}`);
        }
      }));
    }
  }
  report.departments = verifiedDepts.length > 0 ? `${verifiedDepts.join(', ')} (all OK)` : 'none';

  // Verify use case pages
  const verifiedUseCases = [];
  if (useCaseSet.size > 0) {
    console.log(`  Verifying use case pages (${useCaseSet.size})...`);
    const ucs = [...useCaseSet];
    for (let i = 0; i < ucs.length; i += 5) {
      const batch = ucs.slice(i, i + 5);
      await Promise.all(batch.map(async (uc) => {
        try {
          const res = await fetchWithRetry(`${SITE_URL}/category/use-case/${uc}/`);
          if (res.ok) {
            verifiedUseCases.push(uc);
            console.log(`    ${uc}: 200 OK`);
          } else {
            console.warn(`    ${uc}: HTTP ${res.status}`);
          }
        } catch (err) {
          console.warn(`    ${uc}: ${err.message}`);
        }
      }));
    }
  }
  report.useCases = verifiedUseCases.length > 0 ? `${verifiedUseCases.join(', ')} (all OK)` : 'none';

  // Fail if any articles couldn't be verified
  if (articleErrors.length > 0) {
    throw new Error(`${articleErrors.length} article(s) not live: ${articleErrors.join('; ')}`);
  }

  // Fail if sitemap is missing slugs
  if (missingSlugs.length > 0) {
    throw new Error(`${missingSlugs.length} slug(s) missing from sitemap: ${missingSlugs.join(', ')}`);
  }

  console.log('\n  Site verification: all checks passed.');
  return report;
}

// --- Notify Paperclip ---

async function notifyPaperclip(success, method, detail) {
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
    ? { status: 'done', comment: `Deploy successful via ${method} (verified).\n${detail}\n\nSite live at ${SITE_URL}` }
    : { status: 'blocked', comment: `Deploy failed via ${method}.\n\nError: ${detail}` };

  const res = await fetch(`${PAPERCLIP_API_URL}/api/issues/${taskId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Paperclip API returned ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  }
  console.log(`Paperclip task ${taskId} updated: ${body.status}`);
}

// --- Build verification report ---

function formatVerificationReport(cfStatus, siteReport) {
  const lines = [];
  if (cfStatus) lines.push(`- CF deployment: ${cfStatus}`);
  if (siteReport) {
    if (siteReport.homepage) lines.push(`- Homepage: ${siteReport.homepage}`);
    if (siteReport.blogListing) lines.push(`- Blog listing: ${siteReport.blogListing}`);
    if (siteReport.sitemap) lines.push(`- Sitemap: ${siteReport.sitemap}`);
    if (siteReport.rss) lines.push(`- RSS: ${siteReport.rss}`);
    if (siteReport.articles) lines.push(`- Articles verified: ${siteReport.articles}`);
    if (siteReport.tags && siteReport.tags !== 'none') lines.push(`- Tag pages verified: ${siteReport.tags}`);
    if (siteReport.departments && siteReport.departments !== 'none') lines.push(`- Department pages verified: ${siteReport.departments}`);
    if (siteReport.useCases && siteReport.useCases !== 'none') lines.push(`- Use case pages verified: ${siteReport.useCases}`);
  }
  return lines.join('\n');
}

// --- Main ---

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
  let cfStatus = null;
  let siteReport = null;

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

    // Post-deploy verification
    if (skipVerify) {
      console.log('\n--skip-verify: skipping post-deploy verification.');
    } else {
      cfStatus = await pollCfDeployment(method);
      siteReport = await verifySiteLive(distDir);
    }

    const verificationDetail = formatVerificationReport(cfStatus, siteReport);
    await notifyPaperclip(true, method, verificationDetail);
  } catch (err) {
    try {
      await notifyPaperclip(false, method, err.message);
    } catch (e) {
      console.error(`Notify failed: ${e.message}`);
    }
    throw err;
  }
}

main().catch(err => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
