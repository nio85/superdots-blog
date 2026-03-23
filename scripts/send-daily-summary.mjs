/**
 * Daily Summary Email for Superdots
 *
 * Two modes:
 *   1. API mode (within heartbeats): uses PAPERCLIP_API_URL + PAPERCLIP_API_KEY
 *   2. DB-direct mode (system cron): uses PAPERCLIP_DB_URL to query postgres directly
 *
 * Requires: RESEND_SMTP_API_KEY (loaded from .env if not in env)
 * Optional: PAPERCLIP_COMPANY_ID
 */

import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from blog root
try {
  const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

const SMTP_HOST = 'smtp.resend.com';
const SMTP_USER = 'resend';
const SMTP_PASS = process.env.RESEND_SMTP_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || 'notifications@superdots.sh';
const TO_EMAIL = process.env.TO_EMAIL || 'lucavittorio.bartoccini@gmail.com';
const DB_URL = process.env.PAPERCLIP_DB_URL || 'postgresql://luca:a8gMWZJg9HVEFTutPDxuJ1iy225b1Wzd@localhost:5432/paperclip';

if (!SMTP_PASS) {
  console.error('Missing RESEND_SMTP_API_KEY');
  process.exit(1);
}

// --- Data layer ---

function dbQuery(sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  const result = execSync(`psql "${DB_URL}" -t -A -F '\t' -c ${JSON.stringify(oneLine)}`, {
    encoding: 'utf-8',
    timeout: 10000,
  });
  return result.trim().split('\n').filter(Boolean).map(row => row.split('\t'));
}

async function fetchDataViaApi(apiUrl, apiKey, companyId) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const api = async (path) => {
    const res = await fetch(`${apiUrl}${path}`, { headers });
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
  };
  const [dashboard, allIssues, agents] = await Promise.all([
    api(`/api/companies/${companyId}/dashboard`),
    api(`/api/companies/${companyId}/issues?limit=200`),
    api(`/api/companies/${companyId}/agents`),
  ]);
  return { dashboard, allIssues, agents };
}

function fetchDataViaDb(companyId) {
  // Get company ID if not provided
  if (!companyId) {
    const rows = dbQuery("SELECT id FROM companies LIMIT 1");
    companyId = rows[0]?.[0];
  }

  // Issues
  const issueRows = dbQuery(`
    SELECT id, identifier, title, status, priority, assignee_agent_id, completed_at
    FROM issues
    WHERE company_id = '${companyId}' AND hidden_at IS NULL
    ORDER BY created_at DESC
    LIMIT 200
  `);
  const allIssues = issueRows.map(r => ({
    id: r[0], identifier: r[1], title: r[2], status: r[3],
    priority: r[4], assigneeAgentId: r[5] || null, completedAt: r[6] || null,
  }));

  // Agents
  const agentRows = dbQuery(`
    SELECT id, name, status FROM agents WHERE company_id = '${companyId}'
  `);
  const agents = agentRows.map(r => ({ id: r[0], name: r[1], status: r[2] }));

  // Dashboard stats
  const active = agents.filter(a => a.status === 'active' || a.status === 'running').length;
  const running = agents.filter(a => a.status === 'running').length;
  const open = allIssues.filter(i => i.status === 'todo' || i.status === 'backlog').length;
  const inProg = allIssues.filter(i => i.status === 'in_progress').length;
  const blockedCount = allIssues.filter(i => i.status === 'blocked').length;
  const doneCount = allIssues.filter(i => i.status === 'done').length;

  // Monthly spend
  const spendRows = dbQuery(`
    SELECT COALESCE(SUM(cost_cents), 0) FROM cost_events
    WHERE company_id = '${companyId}'
    AND occurred_at >= date_trunc('month', now())
  `);
  const monthSpendCents = parseInt(spendRows[0]?.[0] || '0', 10);

  const dashboard = {
    tasks: { open, inProgress: inProg, blocked: blockedCount, done: doneCount },
    agents: { active, running },
    costs: { monthSpendCents },
  };

  return { dashboard, allIssues, agents };
}

// --- Debug reports ---

function loadDebugReport(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

// --- Presentation layer ---

function timeLabel() {
  const h = new Date().getHours();
  if (h < 12) return 'Mattina';
  if (h < 18) return 'Pomeriggio';
  return 'Sera';
}

function agentName(agents, id) {
  const a = agents.find(a => a.id === id);
  return a ? a.name : 'Non assegnato';
}

function priorityDot(p) {
  const colors = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#94a3b8' };
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[p] || '#94a3b8'};margin-right:6px;vertical-align:middle"></span>`;
}

function statCard(value, label, color) {
  return `<td style="padding:0 6px">
    <div style="background:#fff;border-radius:10px;padding:16px 12px;text-align:center;border:1px solid #e5e7eb;min-width:80px">
      <div style="font-size:28px;font-weight:700;color:${color};line-height:1">${value}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
    </div>
  </td>`;
}

function issueRow(issue, agents) {
  const agent = agentName(agents, issue.assigneeAgentId);
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top">
      ${priorityDot(issue.priority)}
      <span style="font-weight:600;color:#374151;font-size:13px">${issue.identifier}</span>
    </td>
    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#1f2937;font-size:13px">${issue.title}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:12px;white-space:nowrap">${agent}</td>
  </tr>`;
}

function sectionBlock(title, icon, color, issues, agents) {
  if (!issues.length) return '';
  return `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;margin-bottom:10px">
        <span style="font-size:16px;margin-right:6px">${icon}</span>
        <span style="font-size:15px;font-weight:700;color:${color}">${title}</span>
        <span style="background:${color}15;color:${color};font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;margin-left:8px">${issues.length}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
        ${issues.map(i => issueRow(i, agents)).join('')}
      </table>
    </div>`;
}

function debugReportSection(reports) {
  if (!reports.length) return '';

  const rows = [];
  for (const { label, report } of reports) {
    if (!report) {
      rows.push(`<tr><td colspan="3" style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#9ca3af;font-size:13px">${label}: report non disponibile</td></tr>`);
      continue;
    }
    const age = report.timestamp ? new Date(report.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '?';
    for (const check of report.checks) {
      const color = check.status === 'pass' ? '#22c55e' : check.status === 'skip' ? '#94a3b8' : '#ef4444';
      const badge = `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${color}15;color:${color}">${check.status.toUpperCase()}</span>`;
      const detail = check.status === 'fail' ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">${check.detail}</div>` : '';
      rows.push(`<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top">${badge}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151">${check.name}${detail}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#9ca3af;white-space:nowrap">${label} ${age}</td>
      </tr>`);
    }
  }

  return `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;margin-bottom:10px">
        <span style="font-size:15px;font-weight:700;color:#1e293b">Salute del Sistema</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
        ${rows.join('')}
      </table>
    </div>`;
}

function debugReportText(reports) {
  const lines = ['SALUTE DEL SISTEMA:'];
  for (const { label, report } of reports) {
    if (!report) { lines.push(`  ${label}: report non disponibile`); continue; }
    for (const check of report.checks) {
      const icon = check.status === 'pass' ? 'OK' : check.status === 'skip' ? 'SKIP' : 'FAIL';
      lines.push(`  [${icon}] ${check.name}${check.status === 'fail' ? ': ' + check.detail : ''}`);
    }
  }
  return lines.join('\n');
}

// --- Main ---

async function main() {
  const apiUrl = process.env.PAPERCLIP_API_URL;
  const apiKey = process.env.PAPERCLIP_API_KEY;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;

  let data;
  if (apiUrl && apiKey && companyId) {
    console.log('Using API mode');
    data = await fetchDataViaApi(apiUrl, apiKey, companyId);
  } else {
    console.log('Using DB-direct mode');
    data = fetchDataViaDb(companyId);
  }

  const { dashboard, allIssues, agents } = data;

  const inProgress = allIssues.filter(i => i.status === 'in_progress');
  const todo = allIssues.filter(i => i.status === 'todo');
  const blocked = allIssues.filter(i => i.status === 'blocked');
  const today = new Date().toISOString().slice(0, 10);
  const recentDone = allIssues
    .filter(i => i.status === 'done' && i.completedAt && i.completedAt.slice(0, 10) === today)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  // Load debug reports
  const debugReports = [
    { label: 'Interno', report: loadDebugReport('/tmp/debug-internal-latest.json') },
    { label: 'Esterno', report: loadDebugReport('/tmp/debug-external-latest.json') },
  ];

  const label = timeLabel();
  const spendEur = (dashboard.costs.monthSpendCents / 100).toFixed(2);

  // Plain text fallback
  const fmtIssueTxt = (i) => `  - [${i.priority}] ${i.identifier} — ${i.title} (${agentName(agents, i.assigneeAgentId)})`;
  let text = `Superdots — Aggiornamento ${label} (${today})\n\n`;
  text += `Dashboard: ${dashboard.tasks.open} aperte, ${dashboard.tasks.inProgress} in corso, ${dashboard.tasks.blocked} bloccate, ${dashboard.tasks.done} completate\n`;
  text += `Agenti: ${dashboard.agents.active} attivi (${dashboard.agents.running} running) | Spesa: EUR ${spendEur}\n\n`;
  if (recentDone.length) { text += `COMPLETATI OGGI:\n${recentDone.map(fmtIssueTxt).join('\n')}\n\n`; }
  if (inProgress.length) { text += `IN LAVORAZIONE:\n${inProgress.map(fmtIssueTxt).join('\n')}\n\n`; }
  if (blocked.length) { text += `BLOCCATI:\n${blocked.map(fmtIssueTxt).join('\n')}\n\n`; }
  if (todo.length) { text += `IN CODA:\n${todo.map(fmtIssueTxt).join('\n')}\n\n`; }
  text += debugReportText(debugReports) + '\n\n';

  // HTML email
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
        <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:2px">Aggiornamento ${label}</div>
        <div style="font-size:13px;color:#94a3b8">${today}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Stats -->
  <tr><td style="padding:0 0 20px">
    <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:6px 0">
      <tr>
        ${statCard(dashboard.tasks.inProgress, 'In corso', '#3b82f6')}
        ${statCard(blocked.length, 'Bloccate', '#ef4444')}
        ${statCard(recentDone.length, 'Fatte oggi', '#22c55e')}
        ${statCard(dashboard.tasks.open, 'Aperte', '#8b5cf6')}
      </tr>
    </table>
  </td></tr>

  <!-- Agent & spend bar -->
  <tr><td style="padding:0 0 20px">
    <div style="background:#fff;border-radius:10px;padding:14px 18px;border:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:13px;color:#4b5563">
      <span><strong>${dashboard.agents.active}</strong> agenti attivi &middot; <strong>${dashboard.agents.running}</strong> in esecuzione</span>
      <span style="float:right">Spesa mese: <strong>&euro;${spendEur}</strong></span>
    </div>
  </td></tr>

  <!-- Issue sections -->
  <tr><td>
    ${sectionBlock('In lavorazione', '🔵', '#3b82f6', inProgress, agents)}
    ${sectionBlock('Bloccati', '🔴', '#ef4444', blocked, agents)}
    ${sectionBlock('Completati oggi', '✅', '#22c55e', recentDone, agents)}
    ${sectionBlock('In coda', '🟣', '#8b5cf6', todo, agents)}
    ${(!inProgress.length && !blocked.length && !recentDone.length && !todo.length) ? '<div style="text-align:center;padding:32px;color:#9ca3af;font-size:14px">Nessuna attivit&agrave; aperta al momento.</div>' : ''}
    ${debugReportSection(debugReports)}
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 0 0">
    <div style="text-align:center;font-size:11px;color:#9ca3af;padding-top:16px;border-top:1px solid #e5e7eb">
      Superdots Daily &middot; Generato automaticamente dal CEO Agent
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const subject = `Superdots ${label} — ${inProgress.length} in corso, ${recentDone.length} completati, ${blocked.length} bloccati`;

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
