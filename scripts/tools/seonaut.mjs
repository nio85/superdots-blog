#!/usr/bin/env node
/**
 * SEOnaut DB query wrapper
 *
 * SEOnaut has no API. This script queries its MySQL database directly
 * via docker exec into the seonaut-db container.
 *
 * Usage:
 *   node scripts/tools/seonaut.mjs <command> [options]
 */

import { execSync } from 'node:child_process';
import '../config.mjs';

const DB_USER = 'seonaut';
const DB_PASS = process.env.SEONAUT_DB_PASSWORD;
const DB_NAME = 'seonaut';
const CONTAINER = 'seonaut-db';

if (!DB_PASS) { console.error('Error: Missing env var SEONAUT_DB_PASSWORD'); process.exit(1); }

const HELP = `Usage: node seonaut.mjs <command> [options]

Commands:
  schema                     Show database tables and their columns
  crawls                     List recent crawls (last 10)
  issues [crawlId]           List issues (latest crawl if no id given)
  pages [crawlId]            List pages (latest crawl if no id given)
  summary                    Latest crawl summary with issue count

Options:
  --json    Output as JSON
  --help    Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

function mysqlExec(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const cmd = `docker exec ${CONTAINER} mysql -u${DB_USER} -p'${DB_PASS}' ${DB_NAME} -e '${escaped}'`;
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`MySQL query failed: ${e.stderr || e.message}`);
  }
}

function parseMysqlTable(output) {
  const lines = output.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] === 'NULL' ? null : values[i]; });
    return row;
  });
}

function formatTable(rows) {
  if (!rows || rows.length === 0) { console.log('No results.'); return; }
  const keys = Object.keys(rows[0]);
  const widths = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)));
  const header = keys.map((k, i) => k.padEnd(widths[i])).join('  ');
  const sep = widths.map(w => '-'.repeat(w)).join('  ');
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    console.log(keys.map((k, i) => String(row[k] ?? '').padEnd(widths[i])).join('  '));
  }
}

function out(data) { console.log(JSON.stringify(data, null, 2)); }

function main() {
  switch (command) {
    case 'schema': {
      const tables = mysqlExec('SHOW TABLES;');
      const tableNames = tables.trim().split('\n').slice(1).map(l => l.trim()).filter(Boolean);
      const schema = {};
      for (const t of tableNames) {
        const desc = mysqlExec(`DESCRIBE ${t};`);
        schema[t] = parseMysqlTable(desc);
      }
      if (jsonOutput) { out(schema); break; }
      for (const [table, cols] of Object.entries(schema)) {
        console.log(`\n=== ${table} ===`);
        formatTable(cols);
      }
      break;
    }
    case 'crawls': {
      const raw = mysqlExec('SELECT * FROM crawls ORDER BY id DESC LIMIT 10;');
      const rows = parseMysqlTable(raw);
      if (jsonOutput) { out(rows); break; }
      formatTable(rows);
      break;
    }
    case 'issues': {
      let crawlId = positional[1];
      if (!crawlId) {
        const latest = mysqlExec('SELECT id FROM crawls ORDER BY id DESC LIMIT 1;');
        const rows = parseMysqlTable(latest);
        if (rows.length === 0) err('No crawls found.');
        crawlId = rows[0].id;
      }
      if (!/^\d+$/.test(String(crawlId))) err('crawlId must be a numeric integer');
      const raw = mysqlExec(`SELECT * FROM issues WHERE crawl_id=${crawlId} LIMIT 50;`);
      const rows = parseMysqlTable(raw);
      if (jsonOutput) { out(rows); break; }
      console.log(`Issues for crawl ${crawlId}:`);
      formatTable(rows);
      break;
    }
    case 'pages': {
      let crawlId = positional[1];
      if (!crawlId) {
        const latest = mysqlExec('SELECT id FROM crawls ORDER BY id DESC LIMIT 1;');
        const rows = parseMysqlTable(latest);
        if (rows.length === 0) err('No crawls found.');
        crawlId = rows[0].id;
      }
      if (!/^\d+$/.test(String(crawlId))) err('crawlId must be a numeric integer');
      const raw = mysqlExec(`SELECT * FROM pagereports WHERE crawl_id=${crawlId} LIMIT 50;`);
      const rows = parseMysqlTable(raw);
      if (jsonOutput) { out(rows); break; }
      console.log(`Pages for crawl ${crawlId}:`);
      formatTable(rows);
      break;
    }
    case 'summary': {
      const raw = mysqlExec(
        'SELECT c.*, (SELECT COUNT(*) FROM issues WHERE crawl_id=c.id) as issue_count ' +
        'FROM crawls c ORDER BY id DESC LIMIT 1;'
      );
      const rows = parseMysqlTable(raw);
      if (rows.length === 0) err('No crawls found.');
      if (jsonOutput) { out(rows[0]); break; }
      const s = rows[0];
      for (const [k, v] of Object.entries(s)) {
        console.log(`  ${k}: ${v}`);
      }
      break;
    }
    default:
      err(`Unknown command: ${command}\nRun with --help for usage.`);
  }
}

try {
  main();
} catch (e) {
  if (jsonOutput) { out({ error: e.message }); } else { console.error(e.message); }
  process.exit(1);
}
