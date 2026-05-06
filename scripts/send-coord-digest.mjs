#!/usr/bin/env node
/**
 * Send Daily Coordination Digest email — branded template.
 *
 * Used by the Daily Coordination Digest Pipeline (Program Manager, weekday 18:00).
 * Reads markdown content from a file (typically /tmp/coord-digest-YYYY-MM-DD-XXXXXX.md from the Coord Digest pipeline) and sends
 * a branded HTML email matching other Superdots internal mails (daily summary,
 * weekly recap, etc.).
 *
 * Usage:
 *   node scripts/send-coord-digest.mjs <markdown-file>
 *
 * Requires: RESEND_SMTP_API_KEY in .env
 *
 * Exit codes:
 *   0 — sent successfully
 *   1 — usage / config error
 *   2 — send failure (SMTP, file IO, etc.)
 */

import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
import {
  MAIL_FROM,
  TO_EMAIL,
  SMTP_PASS,
  createSmtpTransport,
} from './config.mjs';
import { renderEmail, section, BRAND } from './lib/email-shell.mjs';
import { sendBrandedMail } from './lib/email-safety.mjs';

const C = BRAND.color;

// ----- Lightweight markdown → HTML for the digest body -----
//
// The digest content is structured (h1 title, h2 sections, lists/paragraphs).
// Full markdown parser is overkill — handle the subset the Coord Digest
// pipeline actually produces.

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, `<code style="background:${C.surfaceAlt};color:${C.text};padding:2px 6px;border-radius:4px;font-size:13px">$1</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${C.text}">$1</strong>`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="color:${C.accent};text-decoration:none">$1</a>`);
  return s;
}

function paragraphHtml(buffer) {
  const items = buffer.filter(Boolean);
  if (items.length === 0) return '';
  const isBullet = items.every((l) => /^\s*[-*]\s/.test(l));
  const isOrdered = items.every((l) => /^\s*\d+\.\s/.test(l));
  if (isBullet) {
    const lis = items
      .map((l) => `<li style="margin:6px 0;color:${C.text}">${renderInline(l.replace(/^\s*[-*]\s/, ''))}</li>`)
      .join('');
    return `<ul style="margin:0;padding:18px 22px 18px 38px;color:${C.text}">${lis}</ul>`;
  }
  if (isOrdered) {
    const lis = items
      .map((l) => `<li style="margin:6px 0;color:${C.text}">${renderInline(l.replace(/^\s*\d+\.\s/, ''))}</li>`)
      .join('');
    return `<ol style="margin:0;padding:18px 22px 18px 38px;color:${C.text}">${lis}</ol>`;
  }
  return `<div style="padding:18px 22px;color:${C.text};line-height:1.6">${items.map((l) => renderInline(l)).join('<br>')}</div>`;
}

function markdownToSections(md) {
  const lines = md.split('\n');
  let title = 'Daily Coordination Digest';
  let subtitle = '';
  const sections = [];
  let currentSection = null;
  let currentBody = [];
  let buffer = [];

  function flushBuffer() {
    if (buffer.length && currentSection) {
      currentBody.push(paragraphHtml(buffer));
      buffer = [];
    }
  }
  function flushSection() {
    flushBuffer();
    if (currentSection) {
      sections.push({ title: currentSection, body: currentBody.join('\n') });
      currentSection = null;
      currentBody = [];
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('_') && line.endsWith('_') && !subtitle && !currentSection) {
      subtitle = line.slice(1, -1).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      flushSection();
      currentSection = line.slice(3).trim();
      continue;
    }
    if (line === '') {
      flushBuffer();
      continue;
    }
    buffer.push(line);
  }
  flushSection();

  return { title, subtitle, sections };
}

// ----- Main -----

async function main() {
  if (!SMTP_PASS) {
    console.error('Missing RESEND_SMTP_API_KEY');
    process.exit(1);
  }
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/send-coord-digest.mjs <markdown-file>');
    process.exit(1);
  }

  let md;
  try {
    md = readFileSync(file, 'utf-8').trim();
  } catch (err) {
    console.error(`Cannot read ${file}: ${err.message}`);
    process.exit(1);
  }
  if (!md) {
    console.error('Markdown file is empty');
    process.exit(1);
  }

  const { title, subtitle, sections } = markdownToSections(md);

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const sectionsHtml = sections
    .map((s) => section({ title: s.title, body: s.body }))
    .join('');

  const html = renderEmail({
    preheader: `Coordination digest — ${sections.length} sections`,
    eyebrow: 'Coord · Digest',
    title,
    subtitle: subtitle || today,
    content: sectionsHtml,
    footerNote: 'Generato automaticamente dal Program Manager',
  });

  // Plain text fallback: original markdown
  const text = md;

  const transporter = createSmtpTransport(nodemailer);
  const subject = `Superdots digest — ${title}`;

  const info = await sendBrandedMail({
    transporter,
    script: 'send-coord-digest',
    message: {
      from: `"Superdots" <${MAIL_FROM}>`,
      to: TO_EMAIL,
      subject,
      text,
      html,
    },
  });

  console.log(`Email sent: ${info.messageId || '(no id)'}`);
}

main().catch((err) => {
  console.error('send-coord-digest failed:', err.message);
  process.exit(2);
});
