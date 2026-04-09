#!/usr/bin/env node
/**
 * Postiz Public API v1 wrapper
 *
 * Interacts with Postiz managed (app.postiz.com) for social media scheduling.
 * Auth: Authorization header with POSTIZ_API_KEY (no Bearer prefix).
 *
 * Usage:
 *   node scripts/tools/postiz.mjs <command> [options]
 */

import '../config.mjs';

const POSTIZ_URL = process.env.POSTIZ_URL || 'https://api.postiz.com';
const POSTIZ_API_KEY = process.env.POSTIZ_API_KEY;

const HELP = `Usage: node postiz.mjs <command> [options]

Commands:
  status                                          Check connection
  integrations                                    List social integrations
  posts [--start YYYY-MM-DD] [--end YYYY-MM-DD]  List posts (default: current month)
  create-post <integrationId> <content> [--date ISO]  Create a post
  delete-post <id>                                Delete a post
  analytics-post <postId>                         Analytics for a post
  analytics <integration>                         Analytics for an integration
  notifications                                   List notifications
  find-slot <integrationId>                       Find next available slot
  upload-url <url>                                Upload media from URL

Options:
  --json    Output as JSON
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

async function api(method, path, body) {
  const url = `${POSTIZ_URL}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': POSTIZ_API_KEY,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const detail = typeof data === 'object' ? JSON.stringify(data) : data;
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`);
  }
  return data;
}

async function main() {
  switch (command) {
    case 'status': {
      const data = await api('GET', '/public/v1/is-connected');
      if (jsonOutput) { out(data); break; }
      log('Connected:', JSON.stringify(data));
      break;
    }
    case 'integrations': {
      const data = await api('GET', '/public/v1/integrations');
      if (jsonOutput) { out(data); break; }
      const items = Array.isArray(data) ? data : data.integrations || [];
      if (items.length === 0) { log('No integrations.'); break; }
      for (const i of items) {
        log(`  ${i.id}  ${i.name ?? i.provider ?? '?'}  (${i.type ?? i.providerName ?? '?'})`);
      }
      break;
    }
    case 'posts': {
      const start = getFlag('--start');
      const end = getFlag('--end');
      const now = new Date();
      const startDate = start || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = end || now.toISOString().slice(0, 10);
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
      if (!integrationId || !content) err('Usage: postiz.mjs create-post <integrationId> <content> [--date ISO]');
      const date = getFlag('--date');
      const post = { content, integration: integrationId };
      if (date) post.date = date;
      const data = await api('POST', '/public/v1/posts', { posts: [post] });
      if (jsonOutput) { out(data); break; }
      log('Post created:', data.id || JSON.stringify(data));
      break;
    }
    case 'delete-post': {
      const id = positional[1];
      if (!id) err('Usage: postiz.mjs delete-post <id>');
      const data = await api('DELETE', `/public/v1/posts/${id}`);
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
      if (!integration) err('Usage: postiz.mjs analytics <integration>');
      const data = await api('GET', `/public/v1/analytics/${integration}`);
      if (jsonOutput) { out(data); break; }
      log(JSON.stringify(data, null, 2));
      break;
    }
    case 'notifications': {
      const data = await api('GET', '/public/v1/notifications');
      if (jsonOutput) { out(data); break; }
      const items = Array.isArray(data) ? data : data.notifications || [];
      if (items.length === 0) { log('No notifications.'); break; }
      for (const n of items) {
        log(`  ${n.id}  ${n.type ?? ''}  ${n.message ?? n.content ?? ''}`);
      }
      break;
    }
    case 'find-slot': {
      const integrationId = positional[1];
      if (!integrationId) err('Usage: postiz.mjs find-slot <integrationId>');
      const data = await api('GET', `/public/v1/find-slot/${integrationId}`);
      if (jsonOutput) { out(data); break; }
      log('Next slot:', JSON.stringify(data));
      break;
    }
    case 'upload-url': {
      const url = positional[1];
      if (!url) err('Usage: postiz.mjs upload-url <url>');
      const data = await api('POST', '/public/v1/upload-from-url', { url });
      if (jsonOutput) { out(data); break; }
      log('Uploaded:', JSON.stringify(data));
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
