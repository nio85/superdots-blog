/**
 * Published Articles Email for Superdots
 *
 * Runs Mon-Fri at 13:00 CET. Scans blog content for articles published today
 * and emails the list to the board.
 *
 * Requires: RESEND_SMTP_API_KEY (loaded from .env via config.mjs)
 */

import nodemailer from 'nodemailer';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  BLOG_ROOT, SITE_URL,
  MAIL_FROM, TO_EMAIL,
  createSmtpTransport,
} from './config.mjs';

const CONTENT_DIR = join(BLOG_ROOT, 'src', 'content', 'blog');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*"?([^"]*)"?$/);
    if (m) fm[m[1]] = m[2];
  }
  return fm;
}

function getArticlesPublishedToday() {
  const today = new Date().toISOString().slice(0, 10);
  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const content = readFileSync(join(CONTENT_DIR, file), 'utf-8');
    const fm = parseFrontmatter(content);
    if (fm.pubDate && fm.pubDate.slice(0, 10) === today) {
      const slug = file.replace(/\.md$/, '');
      articles.push({
        title: fm.title || slug,
        slug,
        url: `${SITE_URL}/blog/${slug}/`,
        department: fm.department || '',
        useCase: fm.useCase || '',
      });
    }
  }

  return articles.sort((a, b) => a.title.localeCompare(b.title));
}

async function main() {
  const articles = getArticlesPublishedToday();
  const today = new Date().toISOString().slice(0, 10);

  if (!articles.length) {
    console.log(`No articles published today (${today}). Skipping email.`);
    return;
  }

  console.log(`Found ${articles.length} article(s) published today.`);

  // Plain text
  let text = `Superdots — Articoli pubblicati oggi (${today})\n\n`;
  text += `${articles.length} articol${articles.length === 1 ? 'o' : 'i'} pubblicat${articles.length === 1 ? 'o' : 'i'} oggi:\n\n`;
  for (const a of articles) {
    text += `- ${a.title}\n  ${a.url}\n`;
    if (a.department) text += `  Dipartimento: ${a.department}\n`;
  }

  // HTML
  const articleRows = articles.map(a => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6">
        <a href="${a.url}" style="font-size:14px;font-weight:600;color:#1e293b;text-decoration:none">${a.title}</a>
        ${a.department ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${a.department}${a.useCase ? ' · ' + a.useCase : ''}</div>` : ''}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap">
        <a href="${a.url}" style="font-size:12px;color:#3b82f6;text-decoration:none">Leggi &rarr;</a>
      </td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
<table role="presentation" width="100%" style="background:#f8fafc;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" style="max-width:600px;width:100%">

  <!-- Header -->
  <tr><td style="padding:0 0 20px">
    <table role="presentation" width="100%" style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:14px;overflow:hidden">
      <tr><td style="padding:28px 24px">
        <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px">Superdots</div>
        <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:2px">Articoli Pubblicati Oggi</div>
        <div style="font-size:13px;color:#94a3b8">${today}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Count badge -->
  <tr><td style="padding:0 0 20px">
    <div style="background:#fff;border-radius:10px;padding:14px 18px;border:1px solid #e5e7eb;text-align:center">
      <span style="font-size:28px;font-weight:700;color:#22c55e">${articles.length}</span>
      <span style="font-size:14px;color:#6b7280;margin-left:8px">articol${articles.length === 1 ? 'o' : 'i'} pubblicat${articles.length === 1 ? 'o' : 'i'}</span>
    </div>
  </td></tr>

  <!-- Articles table -->
  <tr><td style="padding:0 0 20px">
    <table role="presentation" width="100%" style="border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
      ${articleRows}
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 0 0">
    <div style="text-align:center;font-size:11px;color:#9ca3af;padding-top:16px;border-top:1px solid #e5e7eb">
      Superdots Published Articles &middot; Generato automaticamente
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const transporter = createSmtpTransport(nodemailer);

  const subject = `Superdots — ${articles.length} articol${articles.length === 1 ? 'o' : 'i'} pubblicat${articles.length === 1 ? 'o' : 'i'} oggi (${today})`;

  const info = await transporter.sendMail({
    from: `"Superdots" <${MAIL_FROM}>`,
    to: TO_EMAIL,
    subject,
    text,
    html,
  });

  console.log(`Email sent: ${info.messageId}`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
