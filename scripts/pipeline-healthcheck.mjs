#!/usr/bin/env node
/**
 * Pipeline Healthcheck
 *
 * Verifies that today's expected pipeline parent issues exist in Paperclip.
 * Covers all routines that should fire today based on cron + DOW.
 * Sends a single alert email listing any missing pipelines.
 *
 * Designed to run via cron at 09:00 CET (and again at 19:00 to catch evening pipelines).
 */

import nodemailer from 'nodemailer';
import {
  PAPERCLIP_API_URL as API_URL,
  PAPERCLIP_COMPANY_ID as COMPANY_ID,
  MAIL_FROM,
  TO_EMAIL,
  createSmtpTransport,
  getPaperclipApiKey,
  AGENTS,
} from './config.mjs';

const API_KEY = getPaperclipApiKey(AGENTS.CEO);
if (!API_KEY) {
  console.error('No auth available: set PAPERCLIP_API_KEY or PAPERCLIP_AGENT_JWT_SECRET');
  process.exit(1);
}

const now = new Date();
const today = now.toISOString().split('T')[0];
const dow = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
const hour = now.getHours();

// Pipelines to verify. Each entry: { title, expectedDays (array of DOW), expectedHour (when it should have fired) }
// Title is the parent issue title; we look for `[YYYY-MM-DD] <title>` in today's date.
// routineTitle: if set, also accept a routine execution issue with this title (status=done) as valid.
// This handles intentional pauses where the routine fires but the agent skips pipeline creation.
const PIPELINES = [
  // Existing pipelines
  { title: 'Daily content pipeline', days: [1, 2, 3, 4, 5], hour: 8, routineTitle: 'Daily Content Pipeline' },
  { title: 'Daily SEO Optimization', days: [2, 3, 4, 5], hour: 11 },
  { title: 'Daily Coordination Digest', days: [1, 2, 3, 4, 5], hour: 18 },
  { title: 'Weekly Search Strategy', days: [1], hour: 9 },
  { title: 'Weekly GEO Authority', days: [1], hour: 11 },
  { title: 'Weekly Infrastructure Health', days: [3], hour: 9 },
  { title: 'Weekly Editorial Planning', days: [1], hour: 8 },
  { title: 'Weekly content review', days: [2], hour: 10 },
  { title: 'Weekly Content Gap Analysis', days: [4], hour: 16 },
];

async function searchIssues(query) {
  const res = await fetch(
    `${API_URL}/api/companies/${COMPANY_ID}/issues?q=${encodeURIComponent(query)}`,
    { headers: { 'Authorization': `Bearer ${API_KEY}` } },
  );
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return await res.json();
}

async function checkExists(expectedTitle, routineTitle) {
  const issues = await searchIssues(expectedTitle);
  const found = Array.isArray(issues) && issues.some((i) => i.title.startsWith(expectedTitle.split(']')[0] + ']'));
  if (found) return 'pipeline';

  // Fallback: check if the routine execution issue exists and completed today
  // (handles intentional pauses where agent skips pipeline creation)
  if (routineTitle) {
    const routineIssues = await searchIssues(routineTitle);
    const todayRoutine = Array.isArray(routineIssues) && routineIssues.some((i) =>
      i.title === routineTitle && i.status === 'done' && i.createdAt && i.createdAt.startsWith(today),
    );
    if (todayRoutine) return 'routine_done';
  }
  return null;
}

async function main() {
  console.log(`[${today}] Pipeline healthcheck — DOW=${dow} hour=${hour}`);

  const missing = [];
  const ok = [];
  const skipped = [];

  for (const p of PIPELINES) {
    if (!p.days.includes(dow)) {
      skipped.push(`${p.title} (not scheduled today)`);
      continue;
    }
    // Only check pipelines that should have fired by now (1h grace)
    if (hour < p.hour + 1) {
      skipped.push(`${p.title} (scheduled for ${p.hour}:00, too early to check)`);
      continue;
    }
    const expectedTitle = `[${today}] ${p.title}`;
    try {
      const result = await checkExists(expectedTitle, p.routineTitle);
      if (result === 'pipeline') ok.push(p.title);
      else if (result === 'routine_done') ok.push(`${p.title} (routine completed, no pipeline created — intentional pause)`);
      else missing.push({ title: p.title, expected: expectedTitle, scheduledFor: `${p.hour}:00` });
    } catch (err) {
      missing.push({ title: p.title, expected: expectedTitle, error: err.message });
    }
  }

  console.log(`OK: ${ok.length} | Missing: ${missing.length} | Skipped: ${skipped.length}`);
  ok.forEach((t) => console.log(`  ✅ ${t}`));
  missing.forEach((m) => console.log(`  ❌ ${m.title} (${m.error || 'not found, scheduled ' + m.scheduledFor})`));

  if (missing.length === 0) {
    console.log('All scheduled pipelines accounted for. No alert sent.');
    return;
  }

  // Send alert
  const transport = createSmtpTransport(nodemailer);
  await transport.sendMail({
    from: MAIL_FROM,
    to: TO_EMAIL,
    subject: `⚠️ Superdots: ${missing.length} pipeline(s) missing for ${today}`,
    text: [
      `Pipeline healthcheck on ${today} found ${missing.length} expected pipeline(s) missing:`,
      '',
      ...missing.map((m) => `- "${m.expected}" (${m.error ? `error: ${m.error}` : `scheduled ${m.scheduledFor}, no parent issue created`})`),
      '',
      'Possible causes:',
      '- Routine trigger disabled or paused in Paperclip',
      '- Pipeline runner failed (check agent transcripts)',
      '- Paperclip cron daemon not running',
      '- Memory layer (Ollama) catastrophic failure causing pipelines to abort',
      '',
      `Schedule check: dow=${dow} hour=${hour}.`,
      '',
      'Action:',
      '1. Check `SELECT * FROM routine_triggers WHERE last_fired_at::date != CURRENT_DATE AND enabled` in Paperclip DB',
      '2. Check `systemctl status paperclip --no-pager`',
      '3. Run pipeline manually: `cd /home/luca/superdots-blog && node scripts/pipelines/runner.mjs <slug>`',
      '',
      '— Superdots Pipeline Healthcheck',
    ].join('\n'),
  });

  console.log(`Alert email sent for ${missing.length} missing pipeline(s).`);
}

main().catch((err) => {
  console.error('Healthcheck failed:', err.message);
  process.exit(1);
});
