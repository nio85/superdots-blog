#!/usr/bin/env node
/**
 * Send email via Resend SMTP — general-purpose tool for agents
 *
 * Auth: RESEND_SMTP_API_KEY from .env (auto-loaded)
 *
 * Usage:
 *   node scripts/tools/send-email.mjs --subject "..." --body "markdown body"
 *   node scripts/tools/send-email.mjs --subject "..." --body-file /tmp/report.md
 *   echo "body" | node scripts/tools/send-email.mjs --subject "..." --stdin
 *
 * Options:
 *   --subject <text>    Email subject (required)
 *   --body <text>       Email body as markdown string
 *   --body-file <path>  Read body from file (markdown)
 *   --stdin             Read body from stdin
 *   --to <email>        Recipient (default: lucavittorio.bartoccini@gmail.com)
 *   --from <email>      Sender (default: notifications@superdots.sh)
 *   --html              Treat body as raw HTML instead of markdown
 *   --json              Output result as JSON
 */

import '../config.mjs';
import { readFileSync } from 'node:fs';
import { createTransport } from 'nodemailer';
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  TO_EMAIL,
} from '../config.mjs';

const args = process.argv.slice(2);

if (args.includes('--help') || args.length === 0) {
  console.log(`Usage: node send-email.mjs --subject "..." --body "..." [--to email] [--from email]
       node send-email.mjs --subject "..." --body-file /tmp/report.md
       echo "body" | node send-email.mjs --subject "..." --stdin

Options:
  --subject <text>    Email subject (required)
  --body <text>       Markdown body text
  --body-file <path>  Read body from file
  --stdin             Read body from stdin
  --to <email>        Recipient (default: ${TO_EMAIL})
  --from <email>      Sender (default: ${MAIL_FROM})
  --html              Body is raw HTML
  --json              JSON output`);
  process.exit(0);
}

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const jsonOutput = args.includes('--json');
const subject = getArg('--subject');
const to = getArg('--to') || TO_EMAIL;
const from = getArg('--from') || MAIL_FROM;
const isHtml = args.includes('--html');

if (!subject) {
  console.error('Error: --subject is required');
  process.exit(1);
}

if (!SMTP_PASS) {
  console.error('Error: RESEND_SMTP_API_KEY not found in environment or .env');
  process.exit(1);
}

// Resolve body content
let body = '';

if (getArg('--body')) {
  body = getArg('--body');
} else if (getArg('--body-file')) {
  const file = getArg('--body-file');
  try {
    body = readFileSync(file, 'utf-8');
  } catch (e) {
    console.error(`Error: cannot read file ${file}: ${e.message}`);
    process.exit(1);
  }
} else if (args.includes('--stdin')) {
  body = readFileSync('/dev/stdin', 'utf-8');
} else {
  console.error('Error: provide --body, --body-file, or --stdin');
  process.exit(1);
}

if (!body.trim()) {
  console.error('Error: email body is empty');
  process.exit(1);
}

// Convert markdown to simple HTML if not raw HTML
function markdownToHtml(md) {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```[\s\S]*?```/g, (m) => {
      const code = m.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
      return `<pre style="background:#f5f5f5;padding:12px;border-radius:4px;overflow-x:auto"><code>${code}</code></pre>`;
    })
    // Inline code
    .replace(/`(.+?)`/g, '<code style="background:#f5f5f5;padding:2px 4px;border-radius:2px">$1</code>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Line breaks → paragraphs
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Simple table support
  html = html.replace(/(<br>\|.+\|<br>)+/g, (block) => {
    const rows = block.split('<br>').filter(r => r.trim().startsWith('|'));
    if (rows.length < 2) return block;
    let table = '<table style="border-collapse:collapse;width:100%;margin:12px 0">';
    rows.forEach((row, i) => {
      if (row.includes('---')) return; // separator row
      const cells = row.split('|').filter(Boolean).map(c => c.trim());
      const tag = i === 0 ? 'th' : 'td';
      const style = 'style="border:1px solid #ddd;padding:8px;text-align:left"';
      table += `<tr>${cells.map(c => `<${tag} ${style}>${c}</${tag}>`).join('')}</tr>`;
    });
    table += '</table>';
    return table;
  });

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#333">
<p>${html}</p>
<hr style="margin-top:32px;border:none;border-top:1px solid #eee">
<p style="font-size:12px;color:#999">Sent by Superdots · <a href="https://superdots.sh">superdots.sh</a></p>
</body></html>`;
}

const htmlBody = isHtml ? body : markdownToHtml(body);

const transport = createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

try {
  const info = await transport.sendMail({
    from,
    to,
    subject,
    html: htmlBody,
    text: body, // plain-text fallback
  });

  if (jsonOutput) {
    console.log(JSON.stringify({ ok: true, messageId: info.messageId, to, subject }));
  } else {
    console.log(`Email sent: ${info.messageId}`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
  }
} catch (e) {
  if (jsonOutput) {
    console.log(JSON.stringify({ ok: false, error: e.message }));
  } else {
    console.error(`Failed to send email: ${e.message}`);
  }
  process.exit(1);
}
