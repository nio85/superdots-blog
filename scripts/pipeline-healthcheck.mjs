#!/usr/bin/env node
/**
 * Pipeline Healthcheck
 *
 * Checks if today's daily content pipeline task exists in Paperclip.
 * If not, sends an alert email via Resend SMTP.
 *
 * Designed to run via cron at 09:00 CET (1 hour after the pipeline cron).
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

const today = new Date().toISOString().split('T')[0];
const expectedTitle = `[${today}] Daily content pipeline`;

async function main() {
  console.log(`[${today}] Checking if daily pipeline task exists...`);

  // Search for today's pipeline task
  const res = await fetch(
    `${API_URL}/api/companies/${COMPANY_ID}/issues?q=${encodeURIComponent(expectedTitle)}`,
    { headers: { 'Authorization': `Bearer ${API_KEY}` } },
  );

  if (!res.ok) {
    console.error(`API error: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const issues = await res.json();
  const found = Array.isArray(issues) && issues.some(i => i.title === expectedTitle);

  if (found) {
    console.log(`Pipeline task "${expectedTitle}" exists. All good.`);
    return;
  }

  // Pipeline task missing — send alert
  console.warn(`Pipeline task "${expectedTitle}" NOT FOUND. Sending alert...`);

  const transport = createSmtpTransport(nodemailer);
  await transport.sendMail({
    from: MAIL_FROM,
    to: TO_EMAIL,
    subject: `⚠️ Superdots: Daily pipeline missing for ${today}`,
    text: [
      `The daily content pipeline task was not created for ${today}.`,
      '',
      `Expected task: "${expectedTitle}"`,
      '',
      'Possible causes:',
      '- Cron job did not fire (machine was off?)',
      '- Script failed (check /tmp/daily-pipeline.log)',
      '- Paperclip API was unreachable',
      '',
      'Action: Run manually from /home/luca/superdots-blog:',
      '  node scripts/daily-content-pipeline.mjs',
      '',
      '— Superdots Pipeline Healthcheck',
    ].join('\n'),
  });

  console.log('Alert email sent.');
}

main().catch(err => {
  console.error('Healthcheck failed:', err.message);
  process.exit(1);
});
