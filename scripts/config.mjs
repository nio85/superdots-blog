/**
 * Centralized configuration for all blog scripts.
 *
 * Constants live here. Secrets stay in env vars (loaded from .env).
 * Every script imports from this file instead of hardcoding values.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const BLOG_ROOT = resolve(__dirname, '..');
export const MONO_ROOT = BLOG_ROOT;  // blog is now a standalone worktree, not nested in monorepo

// --- Load .env files (blog + paperclip) into process.env ---

function loadEnv(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}

loadEnv(resolve(BLOG_ROOT, '.env'));
loadEnv(resolve(homedir(), '.paperclip', 'instances', 'default', '.env'));

// --- Cloudflare ---

export const CF_ACCOUNT_ID = '2013b526ab724299e028e1fcfe5a5c62';
export const CF_PROJECT_NAME = 'superdots-blog';

// --- GitHub ---

export const GH_REMOTE = 'origin';
export const GH_REPO_URL = 'https://github.com/nio85/superdots-blog.git';

// --- Site ---

export const SITE_URL = 'https://superdots.sh';
export const SITE_HOST = 'superdots.sh';

// --- Paperclip ---

export const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL || 'http://localhost:3100';
export const PAPERCLIP_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || 'cdb3c45d-c7df-4ea0-b495-26426a1e9df4';
export const PAPERCLIP_PROJECT_ID = 'd4fe361f-bdeb-4f81-9238-2d6795a54dbc';

// --- Agent IDs ---

export const AGENTS = {
  CEO: 'ce91a8d9-14e5-4d4b-a9bc-aae3e20a405b',
  CONTENT_MANAGER: '4e20f5d2-69a0-4406-98fa-797de097792e',
  SEO_EXPERT: 'af76f46b-658d-4216-adf5-a9ef8653157a',
  COPYWRITER: 'c19687c9-1bbd-4f5e-a220-fac60ae547c6',
  FOUNDING_ENGINEER: '11e3188a-5eda-49d8-acd4-8815456d9a0f',
  FRONTEND_DESIGNER: 'b0c5b442-9c6d-428f-ba39-03fe4a1029fd',
  LEGAL_EXPERT: '3e55560f-f486-45d3-8a52-7a31036003d7',
  GROWTH_ANALYST: '18fb8cff-39cc-429a-bbfc-5005e064d536',
  PROGRAM_MANAGER: '3d6e6cdc-863c-4fec-a676-9b06dd3b3e89',
};

// --- SMTP (Resend) ---

export const SMTP_HOST = 'smtp.resend.com';
export const SMTP_PORT = 587;
export const SMTP_USER = 'resend';
export const SMTP_PASS = process.env.RESEND_SMTP_API_KEY;
export const MAIL_FROM = process.env.MAIL_FROM || 'notifications@superdots.sh';
export const TO_EMAIL = process.env.TO_EMAIL || 'lucavittorio.bartoccini@gmail.com';

// --- Syndication ---

export const DEVTO_ORG_ID = '12722';

// --- Debug report paths ---

export const REPORT_INTERNAL_PATH = '/tmp/debug-internal-latest.json';
export const REPORT_EXTERNAL_PATH = '/tmp/debug-external-latest.json';

// --- Paperclip Auth Helper ---

import { createHmac, randomUUID } from 'node:crypto';

export function createPaperclipJwt(agentId = AGENTS.CEO, companyId = PAPERCLIP_COMPANY_ID) {
  const secret = process.env.PAPERCLIP_AGENT_JWT_SECRET;
  if (!secret) return null;
  const b64url = (s) => Buffer.from(s, 'utf8').toString('base64url');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    sub: agentId, company_id: companyId, adapter_type: 'claude_local',
    run_id: randomUUID(), iat: now, exp: now + 3600, iss: 'paperclip', aud: 'paperclip-api',
  }));
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export function getPaperclipApiKey(agentId = AGENTS.CEO) {
  return process.env.PAPERCLIP_API_KEY || createPaperclipJwt(agentId) || null;
}

// --- SMTP Helper (Resend) ---

export function createSmtpTransport(nodemailer) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}
