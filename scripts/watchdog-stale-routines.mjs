#!/usr/bin/env node
/**
 * Watchdog: detect and clean stale routine_runs
 *
 * Runs via cron every 15 minutes. Checks for routine_runs stuck in
 * 'issue_created' status for >30 minutes (indicating a crashed heartbeat
 * left a stale execution lock). Marks them as 'failed' so the routine
 * can be re-triggered.
 *
 * Usage:
 *   node scripts/watchdog-stale-routines.mjs              # Run and fix
 *   node scripts/watchdog-stale-routines.mjs --dry-run    # Preview only
 */

import { execSync } from 'node:child_process';
import './config.mjs';
import { createSmtpTransport, MAIL_FROM, TO_EMAIL } from './config.mjs';

const STALE_MINUTES = 30;
const DRY_RUN = process.argv.includes('--dry-run');

function psql(query) {
  const cmd = `psql -U luca -d paperclip -t -A -F '|' -c ${JSON.stringify(query)}`;
  try {
    return execSync(cmd, { encoding: 'utf-8', uid: 1000 }).trim();
  } catch (e) {
    console.error(`psql error: ${e.message}`);
    return '';
  }
}

function psqlExec(query) {
  const cmd = `psql -U luca -d paperclip -c ${JSON.stringify(query)}`;
  try {
    return execSync(cmd, { encoding: 'utf-8', uid: 1000 }).trim();
  } catch (e) {
    console.error(`psql error: ${e.message}`);
    return '';
  }
}

async function sendAlert(staleRuns) {
  if (!process.env.RESEND_SMTP_API_KEY) return;
  try {
    const nodemailer = await import('nodemailer');
    const transport = createSmtpTransport(nodemailer.default || nodemailer);
    const lines = staleRuns.map(r =>
      `- ${r.routineTitle} (run ${r.id.slice(0, 8)}): stuck since ${r.triggeredAt}, linked issue ${r.linkedIssueId?.slice(0, 8) || 'none'}`
    ).join('\n');
    await transport.sendMail({
      from: MAIL_FROM,
      to: TO_EMAIL,
      subject: `⚠️ Watchdog: ${staleRuns.length} stale routine run(s) cleared`,
      text: `The following routine_runs were stuck in 'issue_created' for >${STALE_MINUTES} minutes and have been marked as failed:\n\n${lines}\n\nThis typically means a heartbeat crashed mid-execution (e.g. API 500). The routine will re-trigger at its next cron schedule.`,
    });
    console.log('Alert email sent.');
  } catch (e) {
    console.error(`Failed to send alert: ${e.message}`);
  }
}

async function main() {
  const mode = DRY_RUN ? '[DRY RUN] ' : '';

  // Find stale routine_runs
  const rows = psql(`SELECT rr.id, r.title, rr.triggered_at, rr.linked_issue_id, rr.status FROM routine_runs rr JOIN routines r ON rr.routine_id = r.id WHERE rr.status = 'issue_created' AND rr.triggered_at < NOW() - INTERVAL '${STALE_MINUTES} minutes' ORDER BY rr.triggered_at`);

  if (!rows) {
    console.log(`${mode}No stale routine_runs found. All clear.`);
    return;
  }

  const staleRuns = rows.split('\n').filter(Boolean).map(row => {
    const [id, routineTitle, triggeredAt, linkedIssueId, status] = row.split('|');
    return { id, routineTitle, triggeredAt, linkedIssueId, status };
  });

  console.log(`${mode}Found ${staleRuns.length} stale routine_run(s):\n`);

  for (const run of staleRuns) {
    console.log(`  ${run.routineTitle}`);
    console.log(`    Run ID:      ${run.id}`);
    console.log(`    Triggered:   ${run.triggeredAt}`);
    console.log(`    Linked issue: ${run.linkedIssueId || 'none'}`);
    console.log(`    Status:      ${run.status} (stale >${STALE_MINUTES}min)`);

    if (!DRY_RUN) {
      psqlExec(`UPDATE routine_runs SET status = 'failed', failure_reason = 'Stale lock cleared by watchdog after ${STALE_MINUTES}min timeout', completed_at = NOW(), updated_at = NOW() WHERE id = '${run.id}'`);
      console.log(`    → Marked as failed`);
    } else {
      console.log(`    → Would mark as failed`);
    }
    console.log();
  }

  if (!DRY_RUN && staleRuns.length > 0) {
    await sendAlert(staleRuns);
  }

  console.log(`${mode}Done. ${staleRuns.length} run(s) processed.`);
}

main().catch(e => {
  console.error(`Watchdog failed: ${e.message}`);
  process.exit(1);
});
