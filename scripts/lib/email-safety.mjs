/**
 * Email send wrapper: pre-flight SMTP check, audit log, Paperclip P0 issue on failure.
 *
 * Usage:
 *   import { sendBrandedMail } from './lib/email-safety.mjs';
 *   await sendBrandedMail({ transporter, message, script: 'send-daily-summary' });
 *
 * Behavior:
 *   1. `transporter.verify()` before send — catches AUTH issues without body
 *   2. Send; on success append JSON line to logs/email-sends.log
 *   3. On failure: log failure, best-effort open Paperclip P0 issue, rethrow
 *
 * The Paperclip issue creation is wrapped in try/catch so a schema drift
 * can't mask the original SMTP error — the wrapper always rethrows.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { BLOG_ROOT, AGENTS, PAPERCLIP_COMPANY_ID } from '../config.mjs';

const LOG_DIR = resolve(BLOG_ROOT, 'logs');
const LOG_FILE = resolve(LOG_DIR, 'email-sends.log');

async function appendLog(entry) {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.warn(`[email-safety] Could not write log: ${err.message}`);
  }
}

function openPaperclipIssue({ script, subject, errorMessage }) {
  const dbUrl = process.env.PAPERCLIP_DB_URL;
  if (!dbUrl) {
    console.warn('[email-safety] No PAPERCLIP_DB_URL — skipping issue creation');
    return null;
  }

  const title = `Email send failed: ${script}`;
  const description = [
    `Script: ${script}`,
    `Subject: ${subject}`,
    `Error: ${errorMessage}`,
    '',
    `Timestamp: ${new Date().toISOString()}`,
    '',
    'Check logs/email-sends.log for the full failure record.',
  ].join('\n');

  // Single statement with CTE: increment counter + insert issue atomically.
  // Uses dollar-quoted strings to avoid escaping hell in the shell command.
  const sql = `
    WITH bumped AS (
      UPDATE companies SET issue_counter = issue_counter + 1
      WHERE id = $c$${PAPERCLIP_COMPANY_ID}$c$
      RETURNING issue_counter, issue_prefix
    )
    INSERT INTO issues (
      company_id, title, description, status, priority,
      assignee_agent_id, issue_number, identifier, origin_kind
    )
    SELECT
      $c$${PAPERCLIP_COMPANY_ID}$c$,
      $t$${title}$t$,
      $t$${description}$t$,
      'todo', 'critical',
      $c$${AGENTS.FOUNDING_ENGINEER}$c$,
      bumped.issue_counter,
      bumped.issue_prefix || '-' || bumped.issue_counter,
      'manual'
    FROM bumped
    RETURNING identifier;`;

  try {
    const out = execSync(`psql "${dbUrl}" -t -A -c ${JSON.stringify(sql)}`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    return out || null;
  } catch (err) {
    console.warn(`[email-safety] Could not open Paperclip issue: ${err.message}`);
    return null;
  }
}

export async function sendBrandedMail({ transporter, message, script }) {
  const subject = message.subject || '(no subject)';

  // Pre-flight: verify SMTP credentials without sending.
  try {
    await transporter.verify();
  } catch (err) {
    const errMsg = `SMTP verify failed: ${err.message}`;
    await appendLog({
      ts: new Date().toISOString(),
      script, subject, status: 'verify_failed', error: err.message,
    });
    const issueId = openPaperclipIssue({ script, subject, errorMessage: errMsg });
    if (issueId) console.warn(`[email-safety] Opened Paperclip issue ${issueId}`);
    throw err;
  }

  try {
    const info = await transporter.sendMail(message);
    await appendLog({
      ts: new Date().toISOString(),
      script, subject, status: 'sent', messageId: info.messageId,
    });
    return info;
  } catch (err) {
    const errMsg = `sendMail failed: ${err.message}`;
    await appendLog({
      ts: new Date().toISOString(),
      script, subject, status: 'send_failed', error: err.message,
    });
    const issueId = openPaperclipIssue({ script, subject, errorMessage: errMsg });
    if (issueId) console.warn(`[email-safety] Opened Paperclip issue ${issueId}`);
    throw err;
  }
}
