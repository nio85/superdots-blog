#!/usr/bin/env node
/**
 * Disk space alert — sends email via Resend SMTP when disk usage exceeds threshold.
 *
 * Cooldown: one alert per 4 hours max (flag file in /tmp).
 * Exit 0 always — never generates cron noise.
 *
 * Cron (every 30 min, user luca):
 *   every 30 min: cd /home/luca/superdots-blog && /usr/bin/node scripts/disk-alert.mjs >> /tmp/disk-alert.log 2>&1
 *
 * Env: DISK_ALERT_THRESHOLD (default 80), RESEND_SMTP_API_KEY, TO_EMAIL, MAIL_FROM
 */

import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { createTransport } from 'nodemailer';
import { SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM, TO_EMAIL } from './config.mjs';

const THRESHOLD = parseInt(process.env.DISK_ALERT_THRESHOLD || '80', 10);
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const FLAG_FILE = '/tmp/disk-alert-last-sent';

function getDiskUsage() {
  const out = execSync("df -BK / --output=pcent,avail", { encoding: 'utf-8' });
  const lines = out.trim().split('\n');
  const [pctStr, availStr] = lines[1].trim().split(/\s+/);
  const pct = parseInt(pctStr, 10);
  const availKB = parseInt(availStr, 10);
  if (isNaN(pct) || isNaN(availKB)) {
    throw new Error(`Unexpected df output — could not parse: "${lines[1]}"`);
  }
  const availGB = (availKB / 1024 / 1024).toFixed(1);
  return { pct, availGB };
}

function getDfOutput() {
  return execSync('df -h /', { encoding: 'utf-8' }).trim();
}

function isDueCooldown() {
  if (!existsSync(FLAG_FILE)) return true;
  try {
    const last = parseInt(readFileSync(FLAG_FILE, 'utf-8').trim(), 10);
    return Date.now() - last > COOLDOWN_MS;
  } catch {
    return true;
  }
}

async function sendAlert(pct, availGB) {
  if (!SMTP_PASS) {
    console.warn('No RESEND_SMTP_API_KEY — cannot send alert');
    return;
  }

  const transport = createTransport({
    host: SMTP_HOST,
    port: 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const dfOutput = getDfOutput();
  const subject = `DISK ALERT: / at ${pct}% on superdots-vm (${availGB}GB free)`;
  const html = `
    <h2 style="color:#ef4444">Disk Space Alert — superdots-vm</h2>
    <p>Disk usage has reached <strong>${pct}%</strong> (${availGB}GB remaining).</p>
    <pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:13px">${dfOutput}</pre>
    <h3>Quick investigation:</h3>
    <pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:13px">du -sh /home/luca/* /var/lib/docker /root/.local /root/.npm /root/.cache 2>/dev/null | sort -rh | head -20</pre>
    <p style="color:#888;font-size:12px">Automated alert — superdots-vm disk monitor</p>
  `;

  await transport.sendMail({
    from: `"Superdots Infra" <${MAIL_FROM}>`,
    to: TO_EMAIL,
    subject,
    html,
    text: `DISK ALERT: / at ${pct}% (${availGB}GB free)\n\n${dfOutput}`,
  });

  writeFileSync(FLAG_FILE, String(Date.now()));
  console.log(`Alert sent: disk at ${pct}%, ${availGB}GB free`);
}

async function main() {
  let usage;
  try {
    usage = getDiskUsage();
  } catch (err) {
    console.error('Failed to read disk usage:', err.message);
    return;
  }

  const { pct, availGB } = usage;
  console.log(`Disk usage: ${pct}% (${availGB}GB free) — threshold: ${THRESHOLD}%`);

  if (pct < THRESHOLD) return;

  if (!isDueCooldown()) {
    console.log('Alert already sent recently (cooldown active), skipping');
    return;
  }

  await sendAlert(pct, availGB);
}

main().catch(err => {
  console.error('disk-alert error:', err.message);
  // Exit 0 to avoid cron noise
});
