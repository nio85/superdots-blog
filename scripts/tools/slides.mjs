#!/usr/bin/env node
/**
 * Slides tool — Marp CLI wrapper for branded presentations
 *
 * Renders markdown slides to PDF/PPTX/HTML using Superdots brand theme.
 * Auth: none (local Marp CLI).
 *
 * Usage:
 *   node scripts/tools/slides.mjs <command> [options]
 */

import '../config.mjs';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { BLOG_ROOT } from '../config.mjs';

const SLIDES_DIR = resolve(BLOG_ROOT, 'content', 'slides');
const THEME_PATH = resolve(BLOG_ROOT, 'scripts', 'slides', 'brand-theme.css');
const CHROME_PATH = process.env.CHROME_PATH
  || '/home/luca/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome';

const HELP = `Usage: node slides.mjs <command> [options]

Commands:
  build <markdown-file> [--format pdf|pptx|html]  Compile slides (default: pdf)
  list                                              List slide decks in content/slides/
  preview <markdown-file>                           Build HTML and print path

Options:
  --format pdf|pptx|html   Output format (default: pdf)
  --output <path>          Output file path
  --no-theme               Skip brand theme
  --json                   Output as JSON
  --help                   Show this help`;

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

function resolveInput(file) {
  // Try relative to CWD, then relative to SLIDES_DIR
  let p = resolve(file);
  if (!existsSync(p)) p = resolve(SLIDES_DIR, file);
  if (!existsSync(p)) err(`File not found: ${file} (tried ${resolve(file)} and ${resolve(SLIDES_DIR, file)})`);
  return p;
}

// ═══════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════

function cmdBuild() {
  const file = positional[1];
  if (!file) err('Usage: slides.mjs build <markdown-file> [--format pdf|pptx|html]');
  const input = resolveInput(file);
  const format = getArg('--format', 'pdf');
  const useTheme = !args.includes('--no-theme');
  const outputExplicit = getArg('--output', null);
  const output = outputExplicit ? resolve(outputExplicit) : input.replace(extname(input), `.${format}`);

  const themeArg = useTheme && existsSync(THEME_PATH) ? `--theme-set "${THEME_PATH}"` : '';
  const formatArg = format === 'pdf' ? '--pdf' : format === 'pptx' ? '--pptx' : '--html';
  const cmd = `CHROME_PATH="${CHROME_PATH}" npx @marp-team/marp-cli "${input}" ${formatArg} --output "${output}" ${themeArg} --allow-local-files`;

  try {
    execSync(cmd, { cwd: BLOG_ROOT, stdio: 'pipe', encoding: 'utf-8' });
    if (jsonOutput) {
      out({ input, output, format, theme: useTheme });
    } else {
      log(`Built: ${output} (${format}${useTheme ? ', brand theme' : ''})`);
    }
  } catch (e) {
    err(`Marp build failed: ${e.stderr || e.message}`);
  }
}

function cmdList() {
  if (!existsSync(SLIDES_DIR)) { log('No slides directory. Create content/slides/'); return; }
  const files = readdirSync(SLIDES_DIR).filter(f => f.endsWith('.md'));
  if (jsonOutput) {
    out({ directory: SLIDES_DIR, decks: files });
  } else {
    if (files.length === 0) { log('No slide decks found in content/slides/'); return; }
    log(`Slide decks (${files.length}):\n`);
    for (const f of files) log(`  ${f}`);
  }
}

function cmdPreview() {
  const file = positional[1];
  if (!file) err('Usage: slides.mjs preview <markdown-file>');
  const input = resolveInput(file);
  const output = input.replace(extname(input), '.html');

  const themeArg = existsSync(THEME_PATH) ? `--theme-set "${THEME_PATH}"` : '';
  const cmd = `npx @marp-team/marp-cli "${input}" --html --output "${output}" ${themeArg} --allow-local-files`;

  try {
    execSync(cmd, { cwd: BLOG_ROOT, stdio: 'pipe', encoding: 'utf-8' });
    if (jsonOutput) {
      out({ input, output, format: 'html' });
    } else {
      log(`Preview: ${output}`);
    }
  } catch (e) {
    err(`Marp preview failed: ${e.stderr || e.message}`);
  }
}

// --- Dispatch ---
switch (command) {
  case 'build':   cmdBuild(); break;
  case 'list':    cmdList(); break;
  case 'preview': cmdPreview(); break;
  default:        err(`Unknown command: ${command}. Run --help for usage.`);
}
