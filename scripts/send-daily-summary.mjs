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
import { renderEmail, statCard, section, issueRow, rowTable, emptyState, BRAND } from './lib/email-shell.mjs';

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
const DB_URL = process.env.PAPERCLIP_DB_URL;

if (!SMTP_PASS) {
  console.error('Missing RESEND_SMTP_API_KEY');
  process.exit(1);
}
if (!DB_URL) {
  console.error('Missing PAPERCLIP_DB_URL');
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

  // Token usage today per agent (subscription plan: cost_cents=0, use tokens for estimation)
  const tokenRows = dbQuery(`
    SELECT a.name, COALESCE(SUM(ce.input_tokens),0), COALESCE(SUM(ce.output_tokens),0)
    FROM cost_events ce JOIN agents a ON a.id = ce.agent_id
    WHERE ce.company_id = '${companyId}'
      AND ce.occurred_at >= CURRENT_DATE
    GROUP BY a.name ORDER BY SUM(ce.output_tokens) DESC
  `);
  const tokensByAgent = tokenRows.map(r => ({
    name: r[0],
    inputK: Math.round(parseInt(r[1], 10) / 1000),
    outputK: Math.round(parseInt(r[2], 10) / 1000),
  }));
  const dashboard = {
    tasks: { open, inProgress: inProg, blocked: blockedCount, done: doneCount },
    agents: { active, running },
    costs: { monthSpendCents: 0, tokensByAgent },
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

const PRIORITY_COLOR = {
  critical: BRAND.color.accent,
  high:     '#F97316',
  medium:   '#FACC15',
  low:      '#64748B',
};

function priorityDot(p) {
  const c = PRIORITY_COLOR[p] || PRIORITY_COLOR.low;
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:8px;vertical-align:middle"></span>`;
}

function issueToRow(issue, agents) {
  const agent = agentName(agents, issue.assigneeAgentId);
  const main = `${priorityDot(issue.priority)}<span style="font-family:${BRAND.font.body};font-size:13px;color:${BRAND.color.muted};font-weight:600;margin-right:8px">${issue.identifier}</span><span style="color:${BRAND.color.text}">${issue.title}</span>`;
  return issueRow({ main, right: agent });
}

function issueSection(title, issues, agents, accent) {
  if (!issues.length) return '';
  const rows = issues.map(i => issueToRow(i, agents)).join('');
  return section({ title, count: issues.length, body: rowTable(rows), accent });
}

function debugSection(reports) {
  if (!reports.length) return '';
  const STATUS = {
    pass: { color: BRAND.color.success, label: 'OK' },
    skip: { color: BRAND.color.muted,   label: 'SKIP' },
    fail: { color: BRAND.color.accent,  label: 'FAIL' },
  };
  const rowsHtml = [];
  for (const { label, report } of reports) {
    if (!report) {
      rowsHtml.push(issueRow({ main: `<span style="color:${BRAND.color.muted}">${label}: report non disponibile</span>` }));
      continue;
    }
    const age = report.timestamp ? new Date(report.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '?';
    for (const check of report.checks) {
      const s = STATUS[check.status] || STATUS.skip;
      const badge = `<span style="display:inline-block;padding:2px 9px;border-radius:10px;font-family:${BRAND.font.body};font-size:10px;font-weight:700;letter-spacing:0.5px;background:${s.color}22;color:${s.color};margin-right:10px">${s.label}</span>`;
      const subline = check.status === 'fail' ? check.detail : '';
      rowsHtml.push(issueRow({
        main: `${badge}<span style="color:${BRAND.color.text}">${check.name}</span>`,
        right: `${label} ${age}`,
        subline,
      }));
    }
  }
  return section({ title: 'Salute del Sistema', body: rowTable(rowsHtml.join('')), accent: BRAND.color.info });
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

const MORNING_ROUTINE_ID = '761c331b-b5cf-4346-a1db-3799d14370a7';

// Close any stale open issue from a previous crashed run of this routine.
// Without this, the next run fails with "duplicate key value violates unique constraint
// issues_open_routine_execution_uq" because Paperclip won't create a new routine issue
// while the previous one is still open.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function closeStaleRoutineIssue() {
  try {
    const rows = dbQuery(`
      SELECT id, identifier FROM issues
      WHERE origin_kind = 'routine_execution'
        AND origin_id = '${MORNING_ROUTINE_ID}'
        AND status IN ('backlog','todo','in_progress','in_review','blocked')
        AND created_at < NOW() - INTERVAL '90 minutes'
    `);
    // Close ALL stale issues (not just the first) — multiple can accumulate from consecutive crashes
    for (const stale of rows) {
      const id = stale[0];
      if (!UUID_RE.test(id)) {
        console.warn(`Skipping stale issue with invalid UUID: ${id}`);
        continue;
      }
      dbQuery(`UPDATE issues SET status='done', completed_at=NOW(), updated_at=NOW() WHERE id = '${id}'`);
      console.log(`Stale issue closed (${stale[1]}) — marked done before new run`);
    }
  } catch (err) {
    // Non-fatal: log and continue. If the DB query fails, let the run proceed normally.
    console.warn('Pre-flight stale issue check failed (non-fatal):', err.message);
  }
}

async function main() {
  const apiUrl = process.env.PAPERCLIP_API_URL;
  const apiKey = process.env.PAPERCLIP_API_KEY;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;

  // Pre-flight: close stale open issue from any previous crashed run (DB mode only)
  if (!apiUrl || !apiKey) {
    closeStaleRoutineIssue();
  }

  let data;
  if (apiUrl && apiKey && companyId) {
    console.log('Using API mode');
    data = await fetchDataViaApi(apiUrl, apiKey, companyId);
  } else {
    console.log('Using DB-direct mode');
    data = fetchDataViaDb(companyId);
  }

  const { dashboard, allIssues, agents } = data;

  // Normalize cost fields — API mode doesn't return tokensByAgent
  if (!dashboard.costs.tokensByAgent) dashboard.costs.tokensByAgent = [];

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
  const { tokensByAgent } = dashboard.costs;
  const totalInputK = tokensByAgent.reduce((s, a) => s + a.inputK, 0);
  const totalOutputK = tokensByAgent.reduce((s, a) => s + a.outputK, 0);

  // Plain text fallback
  const fmtIssueTxt = (i) => `  - [${i.priority}] ${i.identifier} — ${i.title} (${agentName(agents, i.assigneeAgentId)})`;
  let text = `Superdots — Aggiornamento ${label} (${today})\n\n`;
  text += `Dashboard: ${dashboard.tasks.open} aperte, ${dashboard.tasks.inProgress} in corso, ${dashboard.tasks.blocked} bloccate, ${dashboard.tasks.done} completate\n`;
  text += `Agenti: ${dashboard.agents.active} attivi (${dashboard.agents.running} running) | Token oggi: ${totalInputK}k in / ${totalOutputK}k out\n\n`;
  if (recentDone.length) { text += `COMPLETATI OGGI:\n${recentDone.map(fmtIssueTxt).join('\n')}\n\n`; }
  if (inProgress.length) { text += `IN LAVORAZIONE:\n${inProgress.map(fmtIssueTxt).join('\n')}\n\n`; }
  if (blocked.length) { text += `BLOCCATI:\n${blocked.map(fmtIssueTxt).join('\n')}\n\n`; }
  if (todo.length) { text += `IN CODA:\n${todo.map(fmtIssueTxt).join('\n')}\n\n`; }
  text += debugReportText(debugReports) + '\n\n';

  // HTML email (branded shell)
  const C = BRAND.color;
  const metaBar = `
  <tr><td style="padding:0 0 22px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.border};border-radius:12px">
      <tr>
        <td style="padding:14px 18px;font-family:${BRAND.font.body};font-size:13px;color:${C.muted}">
          <strong style="color:${C.text}">${dashboard.agents.active}</strong> agenti attivi
          <span style="color:${C.border};margin:0 8px">&middot;</span>
          <strong style="color:${C.text}">${dashboard.agents.running}</strong> in esecuzione
        </td>
        <td style="padding:14px 18px;font-family:${BRAND.font.body};font-size:13px;color:${C.muted};text-align:right">
          Token oggi: <strong style="color:${C.text}">${totalInputK}k in</strong>
          <span style="color:${C.border};margin:0 6px">&middot;</span>
          <strong style="color:${C.text}">${totalOutputK}k out</strong>
        </td>
      </tr>
    </table>
  </td></tr>`;

  const statsBlock = `
  <tr><td style="padding:0 0 22px">
    <table role="presentation" width="100%" class="sd-stats" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0">
      <tr>
        ${statCard({ value: dashboard.tasks.inProgress, label: 'In corso',    color: C.info })}
        ${statCard({ value: blocked.length,              label: 'Bloccate',    color: C.accent })}
        ${statCard({ value: recentDone.length,           label: 'Fatte oggi',  color: C.success })}
        ${statCard({ value: dashboard.tasks.open,        label: 'Aperte',      color: C.text })}
      </tr>
    </table>
  </td></tr>`;

  const empty = (!inProgress.length && !blocked.length && !recentDone.length && !todo.length)
    ? `<tr><td style="padding:0 0 22px"><div style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:28px;text-align:center;font-family:${BRAND.font.body};font-size:14px;color:${C.muted}">Nessuna attivit&agrave; aperta al momento.</div></td></tr>`
    : '';

  const content = [
    statsBlock,
    metaBar,
    issueSection('In lavorazione',   inProgress,  agents, C.info),
    issueSection('Bloccati',         blocked,     agents, C.accent),
    issueSection('Completati oggi',  recentDone,  agents, C.success),
    issueSection('In coda',          todo,        agents, C.muted),
    empty,
    debugSection(debugReports),
  ].filter(Boolean).join('\n');

  const html = renderEmail({
    preheader: `${dashboard.tasks.inProgress} in corso · ${recentDone.length} fatte oggi · ${blocked.length} bloccati`,
    eyebrow: `Daily · ${label}`,
    title: `Aggiornamento ${label}`,
    subtitle: today,
    content,
    footerNote: 'Generato automaticamente dal CEO Agent',
  });

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
