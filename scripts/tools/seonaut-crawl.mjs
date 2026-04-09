#!/usr/bin/env node
/**
 * SEOnaut crawl trigger — curl-based automation
 *
 * SEOnaut has no REST API. This script automates the web login flow
 * and triggers a new crawl via HTTP, using a session cookie.
 *
 * Usage:
 *   node scripts/tools/seonaut-crawl.mjs [--project-id 1]
 *
 * Required env vars (in .env):
 *   SEONAUT_EMAIL     — login email for the SEOnaut web UI
 *   SEONAUT_PASSWORD  — password for the SEOnaut web UI
 *   SEONAUT_PROJECT_ID — project ID to crawl (default: 1)
 *
 * Exit codes:
 *   0 — crawl started successfully
 *   1 — authentication failed or crawl not triggered
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import '../config.mjs';

const BASE_URL = 'http://localhost:9000';
const EMAIL = process.env.SEONAUT_EMAIL;
const PASSWORD = process.env.SEONAUT_PASSWORD;
const PROJECT_ID = process.argv.includes('--project-id')
  ? process.argv[process.argv.indexOf('--project-id') + 1]
  : (process.env.SEONAUT_PROJECT_ID || '1');

if (!EMAIL || !PASSWORD) {
  console.error('Error: SEONAUT_EMAIL and SEONAUT_PASSWORD must be set in .env');
  console.error('Add them to /home/luca/superdots-blog/.env:');
  console.error('  SEONAUT_EMAIL=your@email.com');
  console.error('  SEONAUT_PASSWORD=yourpassword');
  process.exit(1);
}

const COOKIE_FILE = join(tmpdir(), `seonaut-cookies-${process.pid}.txt`);

function curl(args) {
  try {
    return execSync(
      `curl -s -c "${COOKIE_FILE}" -b "${COOKIE_FILE}" ${args}`,
      { encoding: 'utf8', timeout: 30000 }
    );
  } catch (err) {
    throw new Error(`curl failed: ${err.message}`);
  }
}

function cleanup() {
  if (existsSync(COOKIE_FILE)) unlinkSync(COOKIE_FILE);
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

function isActiveCrawl() {
  try {
    const result = execSync(
      `docker exec seonaut-db mysql -u seonaut -p'seo-naut-Jf3kL9vB' seonaut ` +
      `-N -e "SELECT COUNT(*) FROM crawls WHERE project_id = ${PROJECT_ID} AND end IS NULL;"`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    return parseInt(result, 10) > 0;
  } catch {
    console.warn('Warning: could not check for active crawls — proceeding anyway');
    return false;
  }
}

async function run() {
  console.log(`SEOnaut crawl trigger — project ${PROJECT_ID}`);

  // Step 0: Guard against concurrent crawls
  if (isActiveCrawl()) {
    console.log('⏭ Active crawl already running — skipping to avoid stuck crawls.');
    process.exit(0);
  }

  // Step 1: Sign in
  // Note: do NOT use -X POST — curl infers POST from --data-urlencode automatically.
  // Using -X POST with -L causes curl to keep POST on redirects (→ 405 on GET-only routes).
  const signInResult = curl(
    `"${BASE_URL}/signin" ` +
    `-H "Content-Type: application/x-www-form-urlencoded" ` +
    `-H "Origin: ${BASE_URL}" ` +
    `--data-urlencode "email=${EMAIL}" ` +
    `--data-urlencode "password=${PASSWORD}" ` +
    `-L -o /dev/null -w "%{http_code} %{url_effective}"`
  ).trim();

  const [statusCode, finalUrl] = signInResult.split(' ');

  if (finalUrl && finalUrl.includes('/signin')) {
    console.error('Authentication failed — redirected back to signin. Check SEONAUT_EMAIL and SEONAUT_PASSWORD.');
    process.exit(1);
  }

  if (statusCode !== '200') {
    console.error(`Unexpected signin response: ${statusCode} ${finalUrl}`);
    process.exit(1);
  }

  console.log('✓ Authenticated');

  // Step 2: Start crawl — do NOT follow redirect (-L omitted intentionally).
  // Success = 303 (SEOnaut redirects regardless of destination after starting).
  // The correct URL is /crawl/start?pid=<id>, not /crawl/start (no pid = auth error).
  const startResult = curl(
    `"${BASE_URL}/crawl/start?pid=${PROJECT_ID}" ` +
    `-o /dev/null -w "%{http_code} %{redirect_url}"`
  ).trim();

  const [startStatus, redirectTarget] = startResult.split(' ');

  if (startStatus === '303') {
    console.log(`✓ Crawl started (→ ${redirectTarget || 'home'})`);
    console.log(`Live view: ${BASE_URL}/crawl/live?pid=${PROJECT_ID}`);
    process.exit(0);
  }

  console.error(`Crawl start failed: HTTP ${startStatus} (expected 303)`);
  process.exit(1);
}

run().catch((err) => {
  console.error('Error:', err.message);
  cleanup();
  process.exit(1);
});
