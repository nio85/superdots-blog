/**
 * Weekly Recap Email for Superdots
 *
 * Runs Mondays at 08:00 CET. Summarizes the past week:
 * - Articles published in the last 7 days
 * - Paperclip task stats (completed, in progress, blocked)
 * - Agent activity
 *
 * Requires: RESEND_SMTP_API_KEY (loaded from .env via config.mjs)
 */

import nodemailer from 'nodemailer';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import {
  BLOG_ROOT, SITE_URL,
  MAIL_FROM, TO_EMAIL,
  PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID,
  createSmtpTransport, getPaperclipApiKey,
} from './config.mjs';

const CONTENT_DIR = join(BLOG_ROOT, 'src', 'content', 'blog');
const DB_URL = process.env.PAPERCLIP_DB_URL || 'postgresql://luca:a8gMWZJg9HVEFTutPDxuJ1iy225b1Wzd@localhost:5432/paperclip';

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

function getArticlesPublishedInRange(startDate, endDate) {
  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const content = readFileSync(join(CONTENT_DIR, file), 'utf-8');
    const fm = parseFrontmatter(content);
    if (fm.pubDate) {
      const pubDay = fm.pubDate.slice(0, 10);
      if (pubDay >= startDate && pubDay <= endDate) {
        const slug = file.replace(/\.md$/, '');
        articles.push({
          title: fm.title || slug,
          slug,
          url: `${SITE_URL}/blog/${slug}/`,
          pubDate: pubDay,
          department: fm.department || '',
        });
      }
    }
  }

  return articles.sort((a, b) => a.pubDate.localeCompare(b.pubDate));
}

function dbQuery(sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  const result = execSync(`psql "${DB_URL}" -t -A -F '\t' -c ${JSON.stringify(oneLine)}`, {
    encoding: 'utf-8',
    timeout: 10000,
  });
  return result.trim().split('\n').filter(Boolean).map(row => row.split('\t'));
}

function getTaskStatsViaDb(weekStart) {
  const companyId = PAPERCLIP_COMPANY_ID;

  // Completed this week
  const doneRows = dbQuery(`
    SELECT COUNT(*) FROM issues
    WHERE company_id = '${companyId}' AND hidden_at IS NULL
    AND status = 'done' AND completed_at >= '${weekStart}'
  `);
  const completedCount = parseInt(doneRows[0]?.[0] || '0', 10);

  // Currently open
  const openRows = dbQuery(`
    SELECT status, COUNT(*) FROM issues
    WHERE company_id = '${companyId}' AND hidden_at IS NULL
    AND status IN ('todo', 'in_progress', 'blocked')
    GROUP BY status
  `);
  const statusCounts = { todo: 0, in_progress: 0, blocked: 0 };
  for (const row of openRows) {
    statusCounts[row[0]] = parseInt(row[1], 10);
  }

  // Agent activity
  const agentRows = dbQuery(`
    SELECT a.name, COUNT(i.id) as done_count
    FROM agents a
    LEFT JOIN issues i ON i.assignee_agent_id = a.id
      AND i.status = 'done' AND i.completed_at >= '${weekStart}'
      AND i.hidden_at IS NULL
    WHERE a.company_id = '${companyId}'
    GROUP BY a.name
    ORDER BY done_count DESC
  `);
  const agentStats = agentRows.map(r => ({ name: r[0], completed: parseInt(r[1], 10) }));

  // Weekly spend
  const spendRows = dbQuery(`
    SELECT COALESCE(SUM(cost_cents), 0) FROM cost_events
    WHERE company_id = '${companyId}'
    AND occurred_at >= '${weekStart}'
  `);
  const weekSpendCents = parseInt(spendRows[0]?.[0] || '0', 10);

  return { completedCount, statusCounts, agentStats, weekSpendCents };
}

async function getTaskStatsViaApi(weekStart) {
  const apiKey = getPaperclipApiKey();
  if (!apiKey) return null;

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const api = async (path) => {
    const res = await fetch(`${PAPERCLIP_API_URL}${path}`, { headers });
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
  };

  try {
    const [allIssues, agents] = await Promise.all([
      api(`/api/companies/${PAPERCLIP_COMPANY_ID}/issues?limit=500`),
      api(`/api/companies/${PAPERCLIP_COMPANY_ID}/agents`),
    ]);

    const completed = allIssues.filter(i =>
      i.status === 'done' && i.completedAt && i.completedAt.slice(0, 10) >= weekStart
    );

    const statusCounts = {
      todo: allIssues.filter(i => i.status === 'todo').length,
      in_progress: allIssues.filter(i => i.status === 'in_progress').length,
      blocked: allIssues.filter(i => i.status === 'blocked').length,
    };

    const agentMap = new Map(agents.map(a => [a.id, a.name]));
    const agentCompleted = new Map();
    for (const i of completed) {
      const name = agentMap.get(i.assigneeAgentId) || 'Unassigned';
      agentCompleted.set(name, (agentCompleted.get(name) || 0) + 1);
    }
    const agentStats = [...agentCompleted.entries()]
      .map(([name, count]) => ({ name, completed: count }))
      .sort((a, b) => b.completed - a.completed);

    return { completedCount: completed.length, statusCounts, agentStats, weekSpendCents: 0 };
  } catch {
    return null;
  }
}

async function main() {
  const now = new Date();
  const weekEnd = now.toISOString().slice(0, 10);
  const weekStartDate = new Date(now);
  weekStartDate.setDate(weekStartDate.getDate() - 7);
  const weekStart = weekStartDate.toISOString().slice(0, 10);

  const articles = getArticlesPublishedInRange(weekStart, weekEnd);

  // Get task stats (try API first, fall back to DB)
  let taskStats = await getTaskStatsViaApi(weekStart);
  if (!taskStats) {
    try {
      taskStats = getTaskStatsViaDb(weekStart);
    } catch (err) {
      console.warn('Could not fetch task stats:', err.message);
      taskStats = { completedCount: 0, statusCounts: { todo: 0, in_progress: 0, blocked: 0 }, agentStats: [], weekSpendCents: 0 };
    }
  }

  console.log(`Week ${weekStart} to ${weekEnd}: ${articles.length} articles, ${taskStats.completedCount} tasks completed.`);

  // Plain text
  let text = `Superdots — Recap Settimanale (${weekStart} → ${weekEnd})\n\n`;
  text += `ARTICOLI PUBBLICATI: ${articles.length}\n`;
  for (const a of articles) {
    text += `  - [${a.pubDate}] ${a.title}\n    ${a.url}\n`;
  }
  text += `\nTASK COMPLETATI: ${taskStats.completedCount}\n`;
  text += `In coda: ${taskStats.statusCounts.todo} | In corso: ${taskStats.statusCounts.in_progress} | Bloccati: ${taskStats.statusCounts.blocked}\n`;
  if (taskStats.agentStats.length) {
    text += `\nATTIVITÀ AGENTI:\n`;
    for (const a of taskStats.agentStats) {
      text += `  - ${a.name}: ${a.completed} completati\n`;
    }
  }
  if (taskStats.weekSpendCents > 0) {
    text += `\nSpesa settimana: €${(taskStats.weekSpendCents / 100).toFixed(2)}\n`;
  }

  // HTML
  const statCard = (value, label, color) => `
    <td style="padding:0 6px">
      <div style="background:#fff;border-radius:10px;padding:16px 12px;text-align:center;border:1px solid #e5e7eb;min-width:80px">
        <div style="font-size:28px;font-weight:700;color:${color};line-height:1">${value}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
      </div>
    </td>`;

  const articleRows = articles.length ? articles.map(a => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;white-space:nowrap">${a.pubDate}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6">
        <a href="${a.url}" style="font-size:14px;font-weight:600;color:#1e293b;text-decoration:none">${a.title}</a>
        ${a.department ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${a.department}</div>` : ''}
      </td>
    </tr>`).join('') : `
    <tr><td colspan="2" style="padding:20px;text-align:center;color:#9ca3af;font-size:14px">Nessun articolo pubblicato questa settimana.</td></tr>`;

  const agentRows = taskStats.agentStats.filter(a => a.completed > 0).map(a => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#1f2937;font-weight:600">${a.name}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#22c55e;font-weight:700;text-align:right">${a.completed}</td>
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
        <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:2px">Recap Settimanale</div>
        <div style="font-size:13px;color:#94a3b8">${weekStart} &rarr; ${weekEnd}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Stats -->
  <tr><td style="padding:0 0 20px">
    <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:6px 0">
      <tr>
        ${statCard(articles.length, 'Articoli', '#8b5cf6')}
        ${statCard(taskStats.completedCount, 'Task fatti', '#22c55e')}
        ${statCard(taskStats.statusCounts.in_progress, 'In corso', '#3b82f6')}
        ${statCard(taskStats.statusCounts.blocked, 'Bloccati', '#ef4444')}
      </tr>
    </table>
  </td></tr>

  ${taskStats.weekSpendCents > 0 ? `
  <!-- Spend -->
  <tr><td style="padding:0 0 20px">
    <div style="background:#fff;border-radius:10px;padding:14px 18px;border:1px solid #e5e7eb;text-align:center;font-size:13px;color:#4b5563">
      Spesa settimana: <strong>&euro;${(taskStats.weekSpendCents / 100).toFixed(2)}</strong>
    </div>
  </td></tr>` : ''}

  <!-- Published articles -->
  <tr><td style="padding:0 0 20px">
    <div style="display:flex;align-items:center;margin-bottom:10px">
      <span style="font-size:15px;font-weight:700;color:#1e293b">Articoli Pubblicati</span>
      <span style="background:#8b5cf615;color:#8b5cf6;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;margin-left:8px">${articles.length}</span>
    </div>
    <table role="presentation" width="100%" style="border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
      ${articleRows}
    </table>
  </td></tr>

  ${agentRows ? `
  <!-- Agent leaderboard -->
  <tr><td style="padding:0 0 20px">
    <div style="display:flex;align-items:center;margin-bottom:10px">
      <span style="font-size:15px;font-weight:700;color:#1e293b">Attivit&agrave; Agenti</span>
    </div>
    <table role="presentation" width="100%" style="border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
      <tr>
        <th style="padding:8px 16px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Agente</th>
        <th style="padding:8px 16px;border-bottom:2px solid #e5e7eb;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase">Completati</th>
      </tr>
      ${agentRows}
    </table>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="padding:24px 0 0">
    <div style="text-align:center;font-size:11px;color:#9ca3af;padding-top:16px;border-top:1px solid #e5e7eb">
      Superdots Weekly Recap &middot; Generato automaticamente
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const transporter = createSmtpTransport(nodemailer);

  const subject = `Superdots Recap — ${articles.length} articoli, ${taskStats.completedCount} task completati (${weekStart} → ${weekEnd})`;

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
