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

/**
 * Fetch the last heartbeat event for a linked execution issue, for debugging.
 * Returns a string like "event_type @ timestamp: body_preview" or null.
 */
function resolveLastHeartbeatEvent(linkedIssueId) {
  if (!linkedIssueId) return null;
  const row = psql(
    `SELECT hre.event_type, hre.created_at, LEFT(hre.body::text, 300) as body ` +
    `FROM heartbeat_run_events hre ` +
    `JOIN heartbeat_runs hr ON hr.id = hre.run_id ` +
    `JOIN issues i ON i.execution_run_id = hr.id ` +
    `WHERE i.id = '${linkedIssueId}' ` +
    `ORDER BY hre.created_at DESC LIMIT 1`
  );
  if (!row || row === '|') return null;
  const [eventType, createdAt, body] = row.split('|');
  return `${eventType} @ ${createdAt}: ${body}`;
}

async function sendAlert(staleRuns) {
  if (!process.env.RESEND_SMTP_API_KEY) return;
  try {
    const nodemailer = await import('nodemailer');
    const transport = createSmtpTransport(nodemailer.default || nodemailer);
    const lines = staleRuns.map(r => {
      const lastEvent = r.lastHeartbeatEvent
        ? `\n    Last heartbeat event: ${r.lastHeartbeatEvent}`
        : '';
      return `- ${r.routineTitle} (run ${r.id.slice(0, 8)}): stuck since ${r.triggeredAt}, linked issue ${r.linkedIssueId?.slice(0, 8) || 'none'}${lastEvent}`;
    }).join('\n');
    await transport.sendMail({
      from: MAIL_FROM,
      to: TO_EMAIL,
      subject: `⚠️ Watchdog: ${staleRuns.length} stale routine run(s) cleared`,
      text: `The following routine_runs were stuck in 'issue_created' for >${STALE_MINUTES} minutes and have been marked as failed:\n\n${lines}\n\nRoot cause: agent completed work but did not mark the execution issue as done. The execution issue has been cancelled. The routine will re-trigger at its next cron schedule.`,
    });
    console.log('Alert email sent.');
  } catch (e) {
    console.error(`Failed to send alert: ${e.message}`);
  }
}

/**
 * Look up the actual end time of a crashed heartbeat run linked to a routine_run.
 * Prefers the last heartbeat_run_events timestamp, falls back to heartbeat_runs.finished_at.
 * Returns an ISO timestamp string or null if no data found.
 */
function resolveActualEndTime(run) {
  if (!run.linkedIssueId) return null;

  // Try 1: last heartbeat_run_events row for the heartbeat run linked via the issue
  const eventTime = psql(
    `SELECT MAX(hre.created_at) FROM heartbeat_run_events hre ` +
    `JOIN heartbeat_runs hr ON hr.id = hre.run_id ` +
    `JOIN issues i ON i.execution_run_id = hr.id ` +
    `WHERE i.id = '${run.linkedIssueId}'`
  );
  if (eventTime && eventTime !== '' && eventTime !== '|') return eventTime;

  // Try 2: heartbeat_runs.finished_at
  const finishedAt = psql(
    `SELECT hr.finished_at FROM heartbeat_runs hr ` +
    `JOIN issues i ON i.execution_run_id = hr.id ` +
    `WHERE i.id = '${run.linkedIssueId}' AND hr.finished_at IS NOT NULL`
  );
  if (finishedAt && finishedAt !== '') return finishedAt;

  return null;
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

    // Resolve actual crash time from heartbeat events/runs instead of using NOW()
    const actualEndTime = resolveActualEndTime(run);
    const completedAtExpr = actualEndTime
      ? `'${actualEndTime}'::timestamptz`
      : 'NOW()';
    const source = actualEndTime ? 'heartbeat events' : 'watchdog time (no heartbeat data found)';
    console.log(`    Crash time:  ${actualEndTime || 'unknown'} (from ${source})`);

    // Fetch last heartbeat event for debugging context in the alert email
    run.lastHeartbeatEvent = resolveLastHeartbeatEvent(run.linkedIssueId);
    if (run.lastHeartbeatEvent) {
      console.log(`    Last HB event: ${run.lastHeartbeatEvent.slice(0, 120)}`);
    }

    if (!DRY_RUN) {
      psqlExec(`UPDATE routine_runs SET status = 'failed', failure_reason = 'Stale lock cleared by watchdog after ${STALE_MINUTES}min timeout', completed_at = ${completedAtExpr}, updated_at = NOW() WHERE id = '${run.id}'`);
      console.log(`    → Marked as failed (completed_at from ${source})`);

      // Cancel the linked execution issue to avoid zombie open issues
      if (run.linkedIssueId) {
        psqlExec(`UPDATE issues SET status = 'cancelled', updated_at = NOW() WHERE id = '${run.linkedIssueId}' AND status NOT IN ('done', 'cancelled', 'blocked') AND origin_kind = 'routine_execution'`);
        console.log(`    → Execution issue cancelled`);
      }
    } else {
      console.log(`    → Would mark as failed (completed_at from ${source})`);
      if (run.linkedIssueId) {
        console.log(`    → Would cancel execution issue ${run.linkedIssueId.slice(0, 8)}`);
      }
    }
    console.log();
  }

  if (!DRY_RUN && staleRuns.length > 0) {
    await sendAlert(staleRuns);
  }

  console.log(`${mode}Done. ${staleRuns.length} run(s) processed.`);

  // --- Stale agent sessions ---
  await checkStaleSessions(mode);
}

async function checkStaleSessions(mode) {
  console.log(`\n${mode}Checking stale agent sessions...`);

  const rows = psql(`SELECT ars.agent_id, a.name, ars.session_id, MAX(hr.created_at) as last_heartbeat FROM agent_runtime_state ars JOIN agents a ON a.id = ars.agent_id JOIN heartbeat_runs hr ON hr.agent_id = ars.agent_id WHERE ars.session_id IS NOT NULL GROUP BY ars.agent_id, a.name, ars.session_id HAVING MAX(hr.created_at) < NOW() - INTERVAL '24 hours' ORDER BY MAX(hr.created_at)`);

  if (!rows) {
    console.log(`${mode}No stale agent sessions found. All clear.`);
    return;
  }

  const staleSessions = rows.split('\n').filter(Boolean).map(row => {
    const [agentId, name, sessionId, lastHeartbeat] = row.split('|');
    return { agentId, name, sessionId, lastHeartbeat };
  });

  console.log(`${mode}Found ${staleSessions.length} stale agent session(s):\n`);

  for (const s of staleSessions) {
    console.log(`  ${s.name}`);
    console.log(`    Agent ID:       ${s.agentId}`);
    console.log(`    Session ID:     ${s.sessionId?.slice(0, 12)}...`);
    console.log(`    Last heartbeat: ${s.lastHeartbeat}`);

    if (!DRY_RUN) {
      psqlExec(`UPDATE agent_runtime_state SET session_id = NULL WHERE agent_id = '${s.agentId}'`);
      console.log(`    → Session reset`);
    } else {
      console.log(`    → Would reset session`);
    }
    console.log();
  }

  if (!DRY_RUN && staleSessions.length > 0) {
    await sendSessionAlert(staleSessions);
  }

  console.log(`${mode}Done. ${staleSessions.length} stale session(s) processed.`);
}

async function sendSessionAlert(staleSessions) {
  if (!process.env.RESEND_SMTP_API_KEY) return;
  try {
    const nodemailer = await import('nodemailer');
    const transport = createSmtpTransport(nodemailer.default || nodemailer);
    const lines = staleSessions.map(s =>
      `- ${s.name}: last heartbeat ${s.lastHeartbeat}, session ${s.sessionId?.slice(0, 12)}...`
    ).join('\n');
    await transport.sendMail({
      from: MAIL_FROM,
      to: TO_EMAIL,
      subject: `⚠️ Watchdog: ${staleSessions.length} stale agent session(s) reset`,
      text: `The following agents had sessions older than 24h without a heartbeat and have been reset:\n\n${lines}\n\nThese agents will start a fresh session on their next heartbeat.`,
    });
    console.log('Session alert email sent.');
  } catch (e) {
    console.error(`Failed to send session alert: ${e.message}`);
  }
}

main().catch(e => {
  console.error(`Watchdog failed: ${e.message}`);
  process.exit(1);
});
