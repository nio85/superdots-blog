#!/usr/bin/env node
/**
 * Internal Debug Pipeline for superdots.sh
 *
 * Checks:
 *   1. Agent status — flag agents running >2h
 *   2. Content pipeline — verify today's daily content task exists (weekdays)
 *   3. Stuck tasks — in_progress >24h without comment update
 *   4. Blocked tasks — blocked >48h
 *   5. Cron execution — verify key Paperclip routines ran today
 *   6. Git deploy health — last Cloudflare Pages deploy <48h old
 *   7. Email delivery — verify SMTP auth to Gmail
 *   8. Build health — astro build dry run
 *
 * Output: JSON report to /tmp/debug-internal-latest.json
 * Exit: 0 = all pass, 1 = any failure
 */

import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import nodemailer from 'nodemailer';
import {
  BLOG_ROOT,
  PAPERCLIP_API_URL as API_URL,
  PAPERCLIP_COMPANY_ID as COMPANY_ID,
  CF_ACCOUNT_ID as CF_ACCOUNT,
  CF_PROJECT_NAME as CF_PROJECT,
  SMTP_USER, SMTP_PASS,
  REPORT_INTERNAL_PATH as REPORT_PATH,
  getPaperclipApiKey, createSmtpTransport,
} from './config.mjs';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const API_KEY = getPaperclipApiKey();
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

async function checkCronExecution() {
  // Check key Paperclip routines have run recently (replaced old /tmp log file check)
  const routineIds = {
    'Daily Content Pipeline': '02a7ad3c-4b14-498a-8164-02675f099317',
    'Daily Summary Email — Morning': '761c331b-b5cf-4346-a1db-3799d14370a7',
    'Daily Summary Email — Evening': 'fce51c1c-d6e5-4308-9903-007d478ab973',
  };
  const results = [];
  let failures = 0;

  for (const [name, id] of Object.entries(routineIds)) {
    try {
      const runs = await api('GET', `/api/routines/${id}/runs`);
      const recent = runs.find(r => r.createdAt?.startsWith(today));
      if (recent) {
        results.push(`${name}: ${recent.status}`);
        if (recent.status === 'failed') failures++;
      } else {
        // Weekend skip for weekday-only routines
        if (!isWeekday && name === 'Daily Content Pipeline') {
          results.push(`${name}: skipped (weekend)`);
        } else {
          // Check if the routine is scheduled later today before flagging failure
          const routine = await api('GET', `/api/routines/${id}`);
          const trigger = routine.triggers?.find(t => t.kind === 'schedule');
          const cronHour = trigger?.cronExpression ? parseInt(trigger.cronExpression.split(' ')[1], 10) : null;
          const currentHour = new Date().getHours();
          if (cronHour !== null && currentHour < cronHour) {
            results.push(`${name}: pending (scheduled ${cronHour}:00)`);
          } else {
            results.push(`${name}: no run today`);
            failures++;
          }
        }
      }
    } catch (e) {
      results.push(`${name}: ${e.message}`);
      failures++;
    }
  }

  if (failures) return fail('cron_execution', results.join('; '));
  return ok('cron_execution', results.join('; '));
}

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

async function checkEmailDelivery() {
  if (!SMTP_PASS) return skip('email_delivery', 'RESEND_SMTP_API_KEY not set');
  try {
    const transporter = createSmtpTransport(nodemailer);
    await transporter.verify();
    return ok('email_delivery', 'SMTP auth verified');
  } catch (e) {
    return fail('email_delivery', `SMTP auth failed: ${e.message}`);
  }
}

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

  for (const c of checks) {
    const icon = c.status === 'pass' ? 'PASS' : c.status === 'skip' ? 'SKIP' : 'FAIL';
    console.log(`[${icon}] ${c.name}: ${c.detail}`);
  }

  console.log(`\nSummary: ${report.summary.pass}/${report.summary.total} passed, ${report.summary.fail} failed, ${report.summary.skip} skipped`);

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Report written to ${REPORT_PATH}`);

  process.exit(report.summary.fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Pipeline failed:', err.message);
  process.exit(1);
});
