#!/usr/bin/env node
/**
 * Postiz wrapper — delegates to the official `postiz` CLI (npm install -g postiz).
 *
 * The CLI handles the managed API payload structure, auth, and versioning.
 * This script normalises the interface for Paperclip agents and adds JSON output.
 *
 * Auth: POSTIZ_API_KEY env var (loaded from .env by config.mjs).
 *
 * Usage:
 *   node scripts/tools/postiz.mjs <command> [options]
 */

import '../config.mjs';
import { execSync } from 'child_process';

const POSTIZ_API_KEY = process.env.POSTIZ_API_KEY;

const HELP = `Usage: node postiz.mjs <command> [options]

Commands:
  status                                               Check connection
  integrations                                         List social integrations
  posts [--start YYYY-MM-DD] [--end YYYY-MM-DD]        List posts (current month)
  create-post <integrationId> <content> --date ISO     Schedule a post
  create-post <integrationId> <content> --draft        Save as draft
  delete-post <id>                                     Delete a post
  analytics-post <postId>                              Analytics for a post
  analytics <integrationId>                            Analytics for an integration
  notifications                                        List notifications
  upload-file <path>                                   Upload media, returns CDN URL
  find-slot <integrationId>                            Find next available slot

Options:
  --json    Output raw JSON
  --help    Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

if (!POSTIZ_API_KEY) err('Missing env var POSTIZ_API_KEY');

// Run postiz CLI command, always request JSON output, return parsed result.
// The CLI may prepend decorative text (e.g. "🔌 Connected Integrations:\n") before the JSON.
function cli(cliArgs) {
  try {
    const raw = execSync(`postiz ${cliArgs} --json`, {
      env: { ...process.env, POSTIZ_API_KEY },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Extract the first JSON value (object or array) from the output
    const match = raw.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) { try { return JSON.parse(match[1]); } catch {} }
    return raw.trim();
  } catch (e) {
    const stderr = e.stderr?.trim() || '';
    const stdout = e.stdout?.trim() || '';
    const raw = stderr || stdout || e.message;
    const match = raw.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) { try { throw new Error(match[1]); } catch {} }
    throw new Error(raw);
  }
}

// Fallback direct API calls for endpoints not covered by the CLI.
async function api(method, path, body) {
  const url = `https://api.postiz.com${path}`;
  const opts = {
    method,
    headers: { 'Authorization': POSTIZ_API_KEY, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  switch (command) {
    case 'status': {
      const data = await api('GET', '/public/v1/is-connected');
      if (jsonOutput) { out(data); break; }
      log('Connected:', data.connected ? 'yes' : 'no');
      break;
    }

    case 'integrations': {
      const data = cli('integrations:list');
      if (jsonOutput) { out(data); break; }
      const items = Array.isArray(data) ? data : [];
      if (items.length === 0) { log('No integrations.'); break; }
      for (const i of items) log(`  ${i.id}  ${i.name}  (${i.identifier})`);
      break;
    }

    case 'posts': {
      const start = getFlag('--start');
      const end = getFlag('--end');
      const now = new Date();
      const startDate = start || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = end || now.toISOString().slice(0, 10);
      // CLI doesn't have a list command with date range — use REST directly
      const data = await api('GET', `/public/v1/posts?startDate=${startDate}&endDate=${endDate}`);
      if (jsonOutput) { out(data); break; }
      const posts = Array.isArray(data) ? data : data.posts || [];
      if (posts.length === 0) { log('No posts found.'); break; }
      for (const p of posts) {
        const date = p.publishDate || p.date || '';
        const status = p.status || '';
        const content = (p.content || '').slice(0, 60);
        log(`  ${p.id}  [${status}]  ${date}  ${content}...`);
      }
      break;
    }

    case 'create-post': {
      const integrationId = positional[1];
      const content = positional[2];
      if (!integrationId || !content) err('Usage: postiz.mjs create-post <integrationId> <content> --date ISO [--draft]');
      const date = getFlag('--date') || new Date(Date.now() + 3600000).toISOString();
      const isDraft = args.includes('--draft');
      const type = isDraft ? 'draft' : 'schedule';
      const safeContent = content.replace(/'/g, "'\\''");
      const data = cli(`posts:create -c '${safeContent}' -i '${integrationId}' -s '${date}' -t ${type}`);
      if (jsonOutput) { out(data); break; }
      const id = Array.isArray(data) ? data[0]?.postId : data?.postId || data?.id;
      log('Post created:', id || JSON.stringify(data));
      break;
    }

    case 'delete-post': {
      const id = positional[1];
      if (!id) err('Usage: postiz.mjs delete-post <id>');
      // CLI has posts:delete command
      const data = cli(`posts:delete '${id}'`);
      if (jsonOutput) { out(data); break; }
      log('Post deleted.');
      break;
    }

    case 'analytics-post': {
      const postId = positional[1];
      if (!postId) err('Usage: postiz.mjs analytics-post <postId>');
      const data = await api('GET', `/public/v1/analytics/post/${postId}`);
      if (jsonOutput) { out(data); break; }
      log(JSON.stringify(data, null, 2));
      break;
    }

    case 'analytics': {
      const integration = positional[1];
      if (!integration) err('Usage: postiz.mjs analytics <integrationId>');
      const data = cli(`analytics:platform '${integration}'`);
      if (jsonOutput) { out(data); break; }
      log(JSON.stringify(data, null, 2));
      break;
    }

    case 'notifications': {
      const data = await api('GET', '/public/v1/notifications');
      if (jsonOutput) { out(data); break; }
      const items = Array.isArray(data) ? data : data.notifications || [];
      if (items.length === 0) { log('No notifications.'); break; }
      for (const n of items) log(`  ${n.id}  ${n.type ?? ''}  ${n.message ?? n.content ?? ''}`);
      break;
    }

    case 'upload-file': {
      const filePath = positional[1];
      if (!filePath) err('Usage: postiz.mjs upload-file <path>');
      const data = cli(`upload '${filePath}'`);
      if (jsonOutput) { out(data); break; }
      log('Uploaded:', data?.url || JSON.stringify(data));
      break;
    }

    case 'find-slot': {
      const integrationId = positional[1];
      if (!integrationId) err('Usage: postiz.mjs find-slot <integrationId>');
      const data = await api('GET', `/public/v1/find-slot/${integrationId}`);
      if (jsonOutput) { out(data); break; }
      log('Next slot:', data.date || JSON.stringify(data));
      break;
    }

    default:
      err(`Unknown command: ${command}\nRun with --help for usage.`);
  }
}

main().catch(e => {
  if (jsonOutput) { out({ error: e.message }); } else { console.error(e.message); }
  process.exit(1);
});
