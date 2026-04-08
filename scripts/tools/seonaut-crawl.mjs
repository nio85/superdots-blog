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

async function run() {
  console.log(`SEOnaut crawl trigger — project ${PROJECT_ID}`);

  // Step 1: Sign in
  const signInResult = curl(
    `-X POST "${BASE_URL}/signin" ` +
    `-H "Content-Type: application/x-www-form-urlencoded" ` +
    `--data-urlencode "email=${EMAIL}" ` +
    `--data-urlencode "password=${PASSWORD}" ` +
    `-L -o /dev/null -w "%{http_code} %{url_effective}"`
  ).trim();

  const [statusCode, finalUrl] = signInResult.split(' ');

  if (finalUrl && finalUrl.includes('/signin')) {
    console.error('Authentication failed — redirected back to signin. Check SEONAUT_EMAIL and SEONAUT_PASSWORD.');
    process.exit(1);
  }

  if (statusCode !== '200' && statusCode !== '302') {
    console.error(`Unexpected signin response: ${statusCode} ${finalUrl}`);
    process.exit(1);
  }

  console.log('✓ Authenticated');

  // Step 2: Authenticate for the specific project
  const authResult = curl(
    `"${BASE_URL}/crawl/auth?id=${PROJECT_ID}" ` +
    `-L -o /dev/null -w "%{http_code} %{url_effective}"`
  ).trim();

  console.log(`✓ Project auth: ${authResult}`);

  // Step 3: Start crawl
  const startResult = curl(
    `"${BASE_URL}/crawl/start" ` +
    `-L -o /dev/null -w "%{http_code} %{url_effective}"`
  ).trim();

  const [startStatus, startUrl] = startResult.split(' ');

  if (startUrl && startUrl.includes('/crawl/live')) {
    console.log('✓ Crawl started — live at ' + startUrl);
    process.exit(0);
  }

  if (startStatus === '200' || startStatus === '302') {
    // Might still be starting — check if we landed on the live page
    console.log(`Crawl trigger sent (${startStatus} → ${startUrl})`);
    console.log('Verify at http://localhost:9000/crawl/live?pid=' + PROJECT_ID);
    process.exit(0);
  }

  console.error(`Crawl start failed: ${startStatus} ${startUrl}`);
  process.exit(1);
}

run().catch((err) => {
  console.error('Error:', err.message);
  cleanup();
  process.exit(1);
});
