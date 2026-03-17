#!/usr/bin/env node
/**
 * Internal Debug Pipeline for superdots.sh
 *
 * Checks:
 *   1. Agent status — flag agents running >2h
 *   2. Content pipeline — verify today's daily content task exists (weekdays)
 *   3. Stuck tasks — in_progress >24h without comment update
 *   4. Blocked tasks — blocked >48h
 *   5. Cron execution — check /tmp log files have today's entries
 *   6. Git deploy health — last Cloudflare Pages deploy <48h old
 *   7. Email delivery — verify SMTP auth to Gmail
 *   8. Build health — astro build dry run
 *
 * Auth: uses PAPERCLIP_API_KEY if set, otherwise generates JWT from
 * PAPERCLIP_AGENT_JWT_SECRET (loaded from ~/.paperclip/instances/default/.env).
 *
 * Output: JSON report to /tmp/debug-internal-latest.json
 * Exit: 0 = all pass, 1 = any failure
 */

import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import nodemailer from 'nodemailer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_ROOT = resolve(__dirname, '..');

// Load paperclip .env for JWT secret
const PAPERCLIP_ENV_PATH = resolve(homedir(), '.paperclip', 'instances', 'default', '.env');
try {
  const envFile = readFileSync(PAPERCLIP_ENV_PATH, 'utf-8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

// Load blog .env for GMAIL_APP_PASSWORD, CLOUDFLARE_API_TOKEN
try {
  const envFile = readFileSync(join(BLOG_ROOT, '.env'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

const API_URL = process.env.PAPERCLIP_API_URL || 'http://localhost:3100';
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || 'cdb3c45d-c7df-4ea0-b495-26426a1e9df4';
const CEO_ID = 'ce91a8d9-14e5-4d4b-a9bc-aae3e20a405b';
const CF_ACCOUNT = '2013b526ab724299e028e1fcfe5a5c62';
const CF_PROJECT = 'superdots-blog';
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SMTP_USER = 'lucavittorio.bartoccini@gmail.com';
const SMTP_PASS = process.env.GMAIL_APP_PASSWORD;
const REPORT_PATH = '/tmp/debug-internal-latest.json';

// --- Auth ---

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

let API_KEY = process.env.PAPERCLIP_API_KEY;
if (!API_KEY && process.env.PAPERCLIP_AGENT_JWT_SECRET) {
  API_KEY = createJwt(process.env.PAPERCLIP_AGENT_JWT_SECRET, CEO_ID, COMPANY_ID);
}
if (!API_KEY) {
  console.error('No auth available: set PAPERCLIP_API_KEY or PAPERCLIP_AGENT_JWT_SECRET');
  process.exit(1);
}

async function api(method, path) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${method} ${path} returned ${res.status}`);
  return res.json();
}

// --- Helpers ---

function ok(name, detail = '') { return { name, status: 'pass', detail }; }
function fail(name, detail = '') { return { name, status: 'fail', detail }; }
function skip(name, detail = '') { return { name, status: 'skip', detail }; }

const now = Date.now();
const today = new Date().toISOString().split('T')[0];
const isWeekday = ![0, 6].includes(new Date().getDay());

// --- Checks ---

/** 1. Agent status — flag any agent running >2h */
async function checkAgentStatus() {
  try {
    const agents = await api('GET', `/api/companies/${COMPANY_ID}/agents`);
    const stale = agents.filter(a => {
      if (a.status !== 'running' || !a.lastHeartbeatAt) return false;
      const hbAge = now - new Date(a.lastHeartbeatAt).getTime();
      return hbAge > 2 * 60 * 60 * 1000;
    });
    if (stale.length) {
      const names = stale.map(a => `${a.name} (${Math.round((now - new Date(a.lastHeartbeatAt).getTime()) / 3600000)}h)`);
      return fail('agent_status', `${stale.length} agent(s) running >2h: ${names.join(', ')}`);
    }
    const running = agents.filter(a => a.status === 'running').length;
    return ok('agent_status', `${agents.length} agents, ${running} running, none stale`);
  } catch (e) {
    return fail('agent_status', e.message);
  }
}

/** 2. Content pipeline ran today (weekdays only) */
async function checkContentPipeline() {
  if (!isWeekday) return skip('content_pipeline', 'Weekend — skipped');
  try {
    const issues = await api('GET', `/api/companies/${COMPANY_ID}/issues?q=${encodeURIComponent(`[${today}] Daily content pipeline`)}`);
    const found = Array.isArray(issues) && issues.some(i => i.title === `[${today}] Daily content pipeline`);
    if (found) return ok('content_pipeline', `Today's pipeline task exists`);
    return fail('content_pipeline', `No "[${today}] Daily content pipeline" task found`);
  } catch (e) {
    return fail('content_pipeline', e.message);
  }
}

/** 3. Stuck tasks — in_progress >24h without comment update */
async function checkStuckTasks() {
  try {
    const issues = await api('GET', `/api/companies/${COMPANY_ID}/issues?status=in_progress&limit=100`);
    const stuck = [];
    for (const issue of issues) {
      const age = now - new Date(issue.updatedAt).getTime();
      if (age > 24 * 60 * 60 * 1000) {
        stuck.push(`${issue.identifier} (${Math.round(age / 3600000)}h)`);
      }
    }
    if (stuck.length) return fail('stuck_tasks', `${stuck.length} task(s) in_progress >24h: ${stuck.slice(0, 5).join(', ')}`);
    return ok('stuck_tasks', `${issues.length} in_progress tasks, none stuck`);
  } catch (e) {
    return fail('stuck_tasks', e.message);
  }
}

/** 4. Blocked tasks >48h */
async function checkBlockedTasks() {
  try {
    const issues = await api('GET', `/api/companies/${COMPANY_ID}/issues?status=blocked&limit=100`);
    const old = [];
    for (const issue of issues) {
      const age = now - new Date(issue.updatedAt).getTime();
      if (age > 48 * 60 * 60 * 1000) {
        old.push(`${issue.identifier} (${Math.round(age / 3600000)}h)`);
      }
    }
    if (old.length) return fail('blocked_tasks', `${old.length} task(s) blocked >48h: ${old.slice(0, 5).join(', ')}`);
    return ok('blocked_tasks', `${issues.length} blocked tasks, none >48h`);
  } catch (e) {
    return fail('blocked_tasks', e.message);
  }
}

/** 5. Cron execution — check /tmp log files for today's entries */
async function checkCronExecution() {
  const logs = [
    'daily-content-pipeline.log',
    'daily-summary-email.log',
    'daily-proposals-email.log',
  ];
  const results = [];
  let failures = 0;

  for (const log of logs) {
    const path = `/tmp/${log}`;
    try {
      const content = readFileSync(path, 'utf-8');
      if (content.includes(today)) {
        results.push(`${log}: OK`);
      } else {
        results.push(`${log}: no entry for ${today}`);
        failures++;
      }
    } catch {
      results.push(`${log}: file not found`);
      failures++;
    }
  }

  if (failures) return fail('cron_execution', results.join('; '));
  return ok('cron_execution', results.join('; '));
}

/** 6. Git deploy health — last CF Pages deploy <48h old */
async function checkDeployHealth() {
  if (!CF_TOKEN) return skip('deploy_health', 'CLOUDFLARE_API_TOKEN not set');
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/pages/projects/${CF_PROJECT}/deployments?per_page=1`,
      { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
    );
    if (!res.ok) return fail('deploy_health', `CF API ${res.status}`);
    const data = await res.json();
    const deploy = data.result?.[0];
    if (!deploy) return fail('deploy_health', 'No deployments found');

    const deployAge = now - new Date(deploy.created_on).getTime();
    const hoursAgo = Math.round(deployAge / 3600000);
    const status = deploy.latest_stage?.status || 'unknown';

    if (deployAge > 48 * 60 * 60 * 1000) {
      return fail('deploy_health', `Last deploy ${hoursAgo}h ago (${status}) — exceeds 48h threshold`);
    }
    if (status !== 'success') {
      return fail('deploy_health', `Last deploy ${hoursAgo}h ago, status: ${status}`);
    }
    return ok('deploy_health', `Last deploy ${hoursAgo}h ago, status: ${status}`);
  } catch (e) {
    return fail('deploy_health', e.message);
  }
}

/** 7. Email delivery — verify SMTP auth to Gmail */
async function checkEmailDelivery() {
  if (!SMTP_PASS) return skip('email_delivery', 'GMAIL_APP_PASSWORD not set');
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.verify();
    return ok('email_delivery', 'SMTP auth verified');
  } catch (e) {
    return fail('email_delivery', `SMTP auth failed: ${e.message}`);
  }
}

/** 8. Build health — astro build dry run */
async function checkBuildHealth() {
  try {
    execSync('npx astro build', {
      cwd: BLOG_ROOT,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return ok('build_health', 'astro build succeeded');
  } catch (e) {
    const stderr = e.stderr?.slice(-300) || e.message;
    return fail('build_health', `astro build failed: ${stderr}`);
  }
}

// --- Main ---

async function main() {
  console.log(`Internal debug pipeline — ${new Date().toISOString()}`);
  console.log(`Company: ${COMPANY_ID}\n`);

  // Run API checks in parallel, then sequential checks
  const [agentStatus, contentPipeline, stuckTasks, blockedTasks, cronExec, deployHealth, emailDelivery] =
    await Promise.all([
      checkAgentStatus(),
      checkContentPipeline(),
      checkStuckTasks(),
      checkBlockedTasks(),
      checkCronExecution(),
      checkDeployHealth(),
      checkEmailDelivery(),
    ]);

  // Build check runs separately (slow, CPU-intensive)
  const buildHealth = await checkBuildHealth();

  const checks = [agentStatus, contentPipeline, stuckTasks, blockedTasks, cronExec, deployHealth, emailDelivery, buildHealth];

  const report = {
    timestamp: new Date().toISOString(),
    company: COMPANY_ID,
    checks,
    summary: {
      total: checks.length,
      pass: checks.filter(c => c.status === 'pass').length,
      fail: checks.filter(c => c.status === 'fail').length,
      skip: checks.filter(c => c.status === 'skip').length,
    },
  };

  // Print results
  for (const c of checks) {
    const icon = c.status === 'pass' ? 'PASS' : c.status === 'skip' ? 'SKIP' : 'FAIL';
    console.log(`[${icon}] ${c.name}: ${c.detail}`);
  }

  console.log(`\nSummary: ${report.summary.pass}/${report.summary.total} passed, ${report.summary.fail} failed, ${report.summary.skip} skipped`);

  // Write report
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Report written to ${REPORT_PATH}`);

  // Exit code
  process.exit(report.summary.fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Pipeline failed:', err.message);
  process.exit(1);
});
