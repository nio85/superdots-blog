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
import { renderEmail, statCard, section, issueRow, rowTable, emptyState, BRAND } from './lib/email-shell.mjs';

const CONTENT_DIR = join(BLOG_ROOT, 'src', 'content', 'blog');
const DB_URL = process.env.PAPERCLIP_DB_URL;
if (!DB_URL) {
  console.error('Missing PAPERCLIP_DB_URL (set in .env)');
  process.exit(1);
}

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

  // HTML (branded shell)
  const C = BRAND.color;

  const statsBlock = `
  <tr><td style="padding:0 0 22px">
    <table role="presentation" width="100%" class="sd-stats" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0">
      <tr>
        ${statCard({ value: articles.length,                     label: 'Articoli',    color: C.text })}
        ${statCard({ value: taskStats.completedCount,            label: 'Task fatti',  color: C.success })}
        ${statCard({ value: taskStats.statusCounts.in_progress,  label: 'In corso',    color: C.info })}
        ${statCard({ value: taskStats.statusCounts.blocked,      label: 'Bloccati',    color: C.accent })}
      </tr>
    </table>
  </td></tr>`;

  const spendBlock = taskStats.weekSpendCents > 0 ? `
  <tr><td style="padding:0 0 22px">
    <div style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:14px 18px;text-align:center;font-family:${BRAND.font.body};font-size:13px;color:${C.muted}">
      Spesa settimana: <strong style="color:${C.text}">&euro;${(taskStats.weekSpendCents / 100).toFixed(2)}</strong>
    </div>
  </td></tr>` : '';

  const articlesBody = articles.length
    ? rowTable(articles.map(a => issueRow({
        left: a.pubDate,
        main: `<a href="${a.url}" style="color:${C.text};text-decoration:none;font-weight:600">${a.title}</a>`,
        subline: a.department || '',
      })).join(''))
    : emptyState('Nessun articolo pubblicato questa settimana.');
  const articlesSection = section({ title: 'Articoli Pubblicati', count: articles.length, body: articlesBody });

  const activeAgents = taskStats.agentStats.filter(a => a.completed > 0);
  const agentsSection = activeAgents.length
    ? section({
        title: 'Attività Agenti',
        accent: C.success,
        body: rowTable(activeAgents.map(a => issueRow({
          main: `<span style="color:${C.text};font-weight:600">${a.name}</span>`,
          right: `<strong style="color:${C.success}">${a.completed}</strong>`,
        })).join('')),
      })
    : '';

  const content = [statsBlock, spendBlock, articlesSection, agentsSection].filter(Boolean).join('\n');

  const html = renderEmail({
    preheader: `${articles.length} articoli · ${taskStats.completedCount} task completati questa settimana`,
    eyebrow: 'Weekly Recap',
    title: 'Recap Settimanale',
    subtitle: `${weekStart} &rarr; ${weekEnd}`,
    content,
    footerNote: 'Recap settimanale generato automaticamente',
  });

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
