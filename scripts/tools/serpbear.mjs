#!/usr/bin/env node
/**
 * SerpBear API wrapper
 *
 * Interacts with SerpBear (localhost:3005) for SERP rank tracking.
 * Auth: Bearer token from SERPBEAR_API_KEY env var.
 *
 * Usage:
 *   node scripts/tools/serpbear.mjs <command> [options]
 */

import '../config.mjs';
import { execSync } from 'child_process';

const SERPBEAR_URL = process.env.SERPBEAR_URL || 'http://localhost:3005';
const SERPBEAR_API_KEY = process.env.SERPBEAR_API_KEY;
const SERPBEAR_USER = process.env.SERPBEAR_USER || 'luca';
const SERPBEAR_PASSWORD = process.env.SERPBEAR_PASSWORD || '';

const HELP = `Usage: node serpbear.mjs <command> [options]

Commands:
  domains                              List tracked domains
  keywords <domain> [--tags <t1,t2>]   List keywords for a domain (optionally filter by tags)
  keyword <id>                         Get keyword with full history
  refresh <id>                         Refresh a single keyword position
  scrape                               Trigger full scrape of all keywords
  add-keywords <domain> <json>         Add keywords (JSON array: [{"keyword":"...","tags":"t1,t2","country":"US","device":"desktop"}])
  delete-keywords <id1,id2,...>         Delete keywords by comma-separated IDs
  search-console <domain>              Search Console data for domain
  insight <domain>                     GSC insights for domain
  health                               Healthcheck JSON (container + API + scraper queue)

Options:
  --json    Output as JSON
  --tags    Filter keywords by tag (comma-separated)
  --help    Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

if (!SERPBEAR_API_KEY) err('Missing env var SERPBEAR_API_KEY');

// Session cookie cache for write operations (SerpBear requires session auth for POST/DELETE)
let _sessionCookie = null;

async function getSessionCookie() {
  if (_sessionCookie) return _sessionCookie;
  if (!SERPBEAR_PASSWORD) err('Write operations require SERPBEAR_PASSWORD env var (session auth).');
  const res = await fetch(`${SERPBEAR_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: SERPBEAR_USER, password: SERPBEAR_PASSWORD }),
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/token=([^;]+)/);
  if (!match) throw new Error('Failed to get session cookie from SerpBear login');
  _sessionCookie = `token=${match[1]}`;
  return _sessionCookie;
}

async function api(method, path, body) {
  const url = `${SERPBEAR_URL}${path}`;
  const needsSession = method !== 'GET';
  const headers = { 'Content-Type': 'application/json' };

  if (needsSession) {
    // POST/PUT/DELETE require session cookie auth
    const cookie = await getSessionCookie();
    headers['Cookie'] = cookie;
  } else {
    // GET works with Bearer token
    headers['Authorization'] = `Bearer ${SERPBEAR_API_KEY}`;
  }

  const opts = { method, headers };
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
    case 'domains': {
      const data = await api('GET', '/api/domains');
      if (jsonOutput) { out(data); break; }
      const domains = Array.isArray(data) ? data : data.domains || [];
      if (domains.length === 0) { log('No domains tracked.'); break; }
      for (const d of domains) {
        log(`  ${d.id ?? '-'}  ${d.domain}  (keywords: ${d.keywordCount ?? d.keyword_count ?? '?'})`);
      }
      break;
    }
    case 'keywords': {
      const domain = positional[1];
      if (!domain) err('Usage: serpbear.mjs keywords <domain>');
      const data = await api('GET', `/api/keywords?domain=${encodeURIComponent(domain)}`);
      let kws = Array.isArray(data) ? data : data.keywords || [];
      const tagsFilter = getArg('--tags', '');
      if (tagsFilter) {
        const filterTags = tagsFilter.split(',').map(t => t.trim().toLowerCase());
        kws = kws.filter(k => {
          const raw = k.tags || '';
          const kwTags = Array.isArray(raw) ? raw.map(t => t.toLowerCase()) : raw.split(',').map(t => t.trim().toLowerCase());
          return filterTags.some(ft => kwTags.includes(ft));
        });
      }
      if (jsonOutput) { out(kws); break; }
      if (kws.length === 0) { log('No keywords found.'); break; }
      for (const k of kws) {
        const rawTags = k.tags || '';
        const tagsStr = Array.isArray(rawTags) ? rawTags.join(',') : rawTags;
        const tags = tagsStr ? ` [${tagsStr}]` : '';
        log(`  ${k.ID || k.id}  pos:${k.position ?? '-'}  ${k.keyword}${tags}`);
      }
      log(`\n  Total: ${kws.length} keywords`);
      break;
    }
    case 'keyword': {
      const id = positional[1];
      if (!id) err('Usage: serpbear.mjs keyword <id>');
      const data = await api('GET', `/api/keyword?id=${id}`);
      if (jsonOutput) { out(data); break; }
      log(JSON.stringify(data, null, 2));
      break;
    }
    case 'refresh': {
      const id = positional[1];
      if (!id) err('Usage: serpbear.mjs refresh <id>');
      const data = await api('POST', `/api/refresh?id=${id}`);
      if (jsonOutput) { out(data); break; }
      log('Refresh triggered.');
      if (data) log(JSON.stringify(data, null, 2));
      break;
    }
    case 'scrape': {
      const data = await api('POST', '/api/cron');
      if (jsonOutput) { out(data); break; }
      log('Full scrape triggered.');
      if (data) log(JSON.stringify(data, null, 2));
      break;
    }
    case 'add-keywords': {
      const domain = positional[1];
      const jsonArg = positional[2];
      if (!domain || !jsonArg) err('Usage: serpbear.mjs add-keywords <domain> \'[{"keyword":"...","tags":"t1,t2","country":"US","device":"desktop"}]\'');
      let keywords;
      try { keywords = JSON.parse(jsonArg); } catch { err('Invalid JSON. Expected array of keyword objects.'); }
      if (!Array.isArray(keywords)) err('Expected a JSON array of keyword objects.');
      // Ensure each keyword has required fields
      for (const kw of keywords) {
        if (!kw.keyword) err(`Missing "keyword" field in: ${JSON.stringify(kw)}`);
        kw.domain = kw.domain || domain;
        kw.device = kw.device || 'desktop';
        kw.country = kw.country || 'US';
        kw.tags = kw.tags || '';
      }
      const data = await api('POST', '/api/keywords', { keywords });
      if (jsonOutput) { out(data); break; }
      log(`Added ${keywords.length} keyword(s) to ${domain}`);
      for (const kw of keywords) log(`  + ${kw.keyword} [${kw.tags || 'no tags'}] (${kw.country}, ${kw.device})`);
      break;
    }
    case 'delete-keywords': {
      const ids = positional[1];
      if (!ids) err('Usage: serpbear.mjs delete-keywords <id1,id2,...>');
      const data = await api('DELETE', `/api/keywords?id=${ids}`);
      if (jsonOutput) { out(data); break; }
      log(`Deleted keyword(s): ${ids}`);
      break;
    }
    case 'insight': {
      const domain = positional[1];
      if (!domain) err('Usage: serpbear.mjs insight <domain>');
      const data = await api('GET', `/api/insight?domain=${encodeURIComponent(domain)}`);
      if (jsonOutput) { out(data); break; }
      log(JSON.stringify(data, null, 2));
      break;
    }
    case 'health': {
      const report = {
        status: 'ok',
        container_running: false,
        api_reachable: false,
        domains_count: 0,
        keywords_total: 0,
        failed_queue_size: null,
        last_scrape_age_hours: null,
        db_last_modified: null,
        scraper_errors_24h: null,
        keywords_with_errors: 0,
        errors: [],
      };

      const safeExec = (cmd) => {
        try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
        catch (e) { return null; }
      };

      // 1. Container running
      const running = safeExec("docker inspect serpbear --format '{{.State.Running}}'");
      report.container_running = running === 'true';
      if (!report.container_running) {
        report.status = 'down';
        report.errors.push('container not running');
      }

      // 2. API reachable + domains/keyword count (via keywords endpoint for accuracy)
      let allKeywords = [];
      try {
        const domains = await api('GET', '/api/domains');
        report.api_reachable = true;
        const list = Array.isArray(domains) ? domains : (domains.domains || []);
        report.domains_count = list.length;
        // Fetch actual keywords — domain.keywordCount is stale (set at creation, never updated)
        for (const d of list) {
          const kwResp = await api('GET', `/api/keywords?domain=${encodeURIComponent(d.domain)}`);
          const kws = Array.isArray(kwResp?.keywords) ? kwResp.keywords : (Array.isArray(kwResp) ? kwResp : []);
          allKeywords.push(...kws);
        }
        report.keywords_total = allKeywords.length;
      } catch (e) {
        report.api_reachable = false;
        report.errors.push(`api: ${e.message}`);
        if (report.status === 'ok') report.status = 'down';
      }

      // 3. failed_queue size
      if (report.container_running) {
        const fq = safeExec("docker exec serpbear cat /app/data/failed_queue.json");
        if (fq !== null) {
          try { report.failed_queue_size = JSON.parse(fq).length; }
          catch { report.errors.push('failed_queue.json parse error'); }
        }
      }

      // 4. last scrape age (db mtime)
      if (report.container_running) {
        const epoch = safeExec("docker exec serpbear stat -c %Y /app/data/database.sqlite");
        if (epoch) {
          const ts = parseInt(epoch, 10) * 1000;
          report.db_last_modified = new Date(ts).toISOString();
          report.last_scrape_age_hours = +((Date.now() - ts) / 3600000).toFixed(2);
        }
      }

      // 5. scraper errors in last 24h (kept for trending, not used as degraded signal)
      if (report.container_running) {
        const errCount = safeExec("docker logs serpbear --since 24h 2>&1 | grep -c lastUpdateError");
        if (errCount !== null) report.scraper_errors_24h = parseInt(errCount, 10) || 0;
      }

      // 5b. Keywords with current errors (accurate signal from API state)
      report.keywords_with_errors = allKeywords.filter(k => k.lastUpdateError).length;

      // 6. Derive degraded status
      if (report.status === 'ok') {
        const degraded = [];
        if (report.failed_queue_size !== null && report.failed_queue_size > 20) degraded.push(`failed_queue=${report.failed_queue_size}`);
        if (report.keywords_with_errors > 10) degraded.push(`active_errors=${report.keywords_with_errors}`);
        if (report.last_scrape_age_hours !== null && report.last_scrape_age_hours > 30) degraded.push(`scrape_age=${report.last_scrape_age_hours}h`);
        if (degraded.length) {
          report.status = 'degraded';
          report.errors.push(...degraded);
        }
      }

      out(report);
      process.exit(report.status === 'down' ? 2 : report.status === 'degraded' ? 1 : 0);
    }
    case 'search-console': {
      const domain = positional[1];
      if (!domain) err('Usage: serpbear.mjs search-console <domain>');
      const data = await api('GET', `/api/searchconsole?domain=${encodeURIComponent(domain)}`);
      if (jsonOutput) { out(data); break; }
      log(JSON.stringify(data, null, 2));
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
