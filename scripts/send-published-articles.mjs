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
import matter from 'gray-matter';
import {
  BLOG_ROOT, SITE_URL,
  MAIL_FROM, TO_EMAIL,
  createSmtpTransport,
} from './config.mjs';
import { renderEmail, section, issueRow, rowTable, BRAND } from './lib/email-shell.mjs';
import { sendBrandedMail } from './lib/email-safety.mjs';

const CONTENT_DIR = join(BLOG_ROOT, 'src', 'content', 'blog');

function getArticlesPublishedToday() {
  const today = new Date().toISOString().slice(0, 10);
  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const raw = readFileSync(join(CONTENT_DIR, file), 'utf-8');
    const { data: fm } = matter(raw);
    if (!fm.pubDate) continue;
    const pubDay = (fm.pubDate instanceof Date ? fm.pubDate.toISOString() : String(fm.pubDate)).slice(0, 10);
    if (pubDay !== today) continue;
    const slug = file.replace(/\.md$/, '');
    articles.push({
      title: fm.title || slug,
      slug,
      url: `${SITE_URL}/blog/${slug}/`,
      department: fm.department || '',
      useCase: fm.useCase || '',
    });
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

  // HTML (branded shell)
  const C = BRAND.color;
  const pluralSuffix = articles.length === 1 ? 'o' : 'i';

  const countCard = `
  <tr><td style="padding:0 0 22px">
    <div style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:20px 18px;text-align:center">
      <span style="font-family:${BRAND.font.display};font-size:36px;font-weight:700;color:${C.accent};line-height:1">${articles.length}</span>
      <span style="font-family:${BRAND.font.body};font-size:14px;color:${C.muted};margin-left:10px">articol${pluralSuffix} pubblicat${pluralSuffix} oggi</span>
    </div>
  </td></tr>`;

  const articleRowsHtml = articles.map(a => issueRow({
    main: `<a href="${a.url}" style="color:${C.text};text-decoration:none;font-weight:600">${a.title}</a>`,
    subline: a.department ? `${a.department}${a.useCase ? ' · ' + a.useCase : ''}` : '',
    right: `<a href="${a.url}" style="color:${C.accent};text-decoration:none;font-weight:600">Leggi &rarr;</a>`,
  })).join('');

  const articlesSection = section({
    title: 'Articoli',
    count: articles.length,
    body: rowTable(articleRowsHtml),
  });

  const content = [countCard, articlesSection].join('\n');

  const html = renderEmail({
    preheader: `${articles.length} articol${pluralSuffix} pubblicat${pluralSuffix} oggi su superdots.sh`,
    eyebrow: 'Published Articles',
    title: 'Articoli Pubblicati Oggi',
    subtitle: today,
    content,
    footerNote: 'Digest giornaliero della publicazione',
  });

  const transporter = createSmtpTransport(nodemailer);

  const subject = `Superdots — ${articles.length} articol${articles.length === 1 ? 'o' : 'i'} pubblicat${articles.length === 1 ? 'o' : 'i'} oggi (${today})`;

  const info = await sendBrandedMail({
    transporter,
    script: 'send-published-articles',
    message: {
      from: `"Superdots" <${MAIL_FROM}>`,
      to: TO_EMAIL,
      subject,
      text,
      html,
    },
  });

  console.log(`Email sent: ${info.messageId}`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
