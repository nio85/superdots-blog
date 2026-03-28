#!/usr/bin/env node
/**
 * Email template tool — MJML compiler for responsive emails
 *
 * Compiles MJML templates to HTML for Mautic newsletters and transactional emails.
 * Auth: none (local MJML compiler).
 *
 * Usage:
 *   node scripts/tools/email-templates.mjs <command> [options]
 */

import '../config.mjs';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { BLOG_ROOT } from '../config.mjs';

const TEMPLATES_DIR = resolve(BLOG_ROOT, 'content', 'email-templates');

const HELP = `Usage: node email-templates.mjs <command> [options]

Commands:
  build <mjml-file> [--output <path>]   Compile MJML to HTML
  validate <mjml-file>                  Check MJML syntax
  list                                  List templates in content/email-templates/

Options:
  --output <path>   Output HTML file path (default: same name with .html)
  --json            Output as JSON
  --help            Show this help`;

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
  let p = resolve(file);
  if (!existsSync(p)) p = resolve(TEMPLATES_DIR, file);
  if (!existsSync(p)) err(`File not found: ${file}`);
  return p;
}

async function compileMjml(input) {
  const mjml = (await import('mjml')).default;
  const source = readFileSync(input, 'utf-8');
  return mjml(source, {
    filePath: input,
    minify: false,
    validationLevel: 'soft',
  });
}

// ═══════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════

async function cmdBuild() {
  const file = positional[1];
  if (!file) err('Usage: email-templates.mjs build <mjml-file> [--output path]');
  const input = resolveInput(file);
  const outputExplicit = getArg('--output', null);
  const output = outputExplicit ? resolve(outputExplicit) : input.replace(extname(input), '.html');

  const result = await compileMjml(input);

  if (result.errors && result.errors.length > 0) {
    for (const e of result.errors) {
      log(`  Warning: ${e.formattedMessage || e.message}`);
    }
  }

  writeFileSync(output, result.html, 'utf-8');

  if (jsonOutput) {
    out({ input, output, errors: result.errors?.length || 0, sizeKB: Math.round(result.html.length / 1024) });
  } else {
    log(`Compiled: ${output} (${Math.round(result.html.length / 1024)}KB${result.errors?.length ? `, ${result.errors.length} warning(s)` : ''})`);
  }
}

async function cmdValidate() {
  const file = positional[1];
  if (!file) err('Usage: email-templates.mjs validate <mjml-file>');
  const input = resolveInput(file);

  const result = await compileMjml(input);

  if (jsonOutput) {
    out({ input, valid: !result.errors?.length, errors: result.errors || [] });
  } else {
    if (!result.errors?.length) {
      log(`Valid: ${input}`);
    } else {
      log(`Found ${result.errors.length} issue(s) in ${input}:\n`);
      for (const e of result.errors) {
        log(`  [${e.tagName || '?'}] ${e.formattedMessage || e.message}`);
      }
    }
  }
}

function cmdList() {
  if (!existsSync(TEMPLATES_DIR)) { log('No templates directory. Create content/email-templates/'); return; }
  const mjmlFiles = readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.mjml'));
  const htmlFiles = readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.html'));

  if (jsonOutput) {
    out({ directory: TEMPLATES_DIR, mjml: mjmlFiles, compiled: htmlFiles });
  } else {
    if (mjmlFiles.length === 0) { log('No MJML templates found in content/email-templates/'); return; }
    log(`Email templates (${mjmlFiles.length}):\n`);
    for (const f of mjmlFiles) {
      const compiled = htmlFiles.includes(f.replace('.mjml', '.html'));
      log(`  ${f}${compiled ? ' [compiled]' : ' [not compiled]'}`);
    }
  }
}

// --- Dispatch ---
switch (command) {
  case 'build':    await cmdBuild(); break;
  case 'validate': await cmdValidate(); break;
  case 'list':     cmdList(); break;
  default:         err(`Unknown command: ${command}. Run --help for usage.`);
}
