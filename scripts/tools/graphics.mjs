#!/usr/bin/env node
/**
 * Graphics renderer — HTML/CSS to PNG/PDF via Puppeteer
 *
 * Renders HTML templates to images (social media, OG) or PDF (print, brochure).
 * Auth: none (local Puppeteer + Chrome).
 *
 * Usage:
 *   node scripts/tools/graphics.mjs <command> [options]
 */

import '../config.mjs';
import { existsSync, statSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { BLOG_ROOT } from '../config.mjs';

const PUPPETEER_CACHE = process.env.PUPPETEER_CACHE_DIR || '/home/luca/.cache/puppeteer';

const SOCIAL_SIZES = {
  linkedin:  { width: 1200, height: 628 },
  twitter:   { width: 1200, height: 675 },
  x:         { width: 1200, height: 675 },
  instagram: { width: 1080, height: 1080 },
  facebook:  { width: 1200, height: 630 },
  og:        { width: 1200, height: 630 },
};

const PAGE_SIZES = {
  a4:     { width: '210mm', height: '297mm' },
  a5:     { width: '148mm', height: '210mm' },
  letter: { width: '8.5in', height: '11in' },
};

const HELP = `Usage: node graphics.mjs <command> [options]

Commands:
  render <html-file>              Render HTML to PNG or PDF
  social <html-file> --platform <name>  Render at social media dimensions
  pdf <html-file>                 Render to print-ready PDF

Options:
  --output <path>      Output file path (default: same name as input with new extension)
  --width <px>         Width in pixels (default: 1200)
  --height <px>        Height in pixels (default: 630)
  --format png|pdf     Output format for render (default: png)
  --platform <name>    Social platform: linkedin, twitter, x, instagram, facebook, og
  --page-size <size>   PDF page size: a4, a5, letter (default: a4)
  --json               Output metadata as JSON
  --help               Show this help`;

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

async function launchBrowser() {
  const puppeteer = (await import('puppeteer')).default;
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    env: { ...process.env, PUPPETEER_CACHE_DIR: PUPPETEER_CACHE },
  });
}

function resolveInput(file) {
  const p = resolve(BLOG_ROOT, file);
  if (!existsSync(p)) err(`File not found: ${p}`);
  return p;
}

function resolveOutput(input, ext, explicit) {
  if (explicit) return resolve(BLOG_ROOT, explicit);
  return input.replace(extname(input), ext);
}

// ═══════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════

async function cmdRender() {
  const file = positional[1];
  if (!file) err('Usage: graphics.mjs render <html-file> [--width N] [--height N] [--format png|pdf] [--output path]');
  const input = resolveInput(file);
  const format = getArg('--format', 'png');
  const width = parseInt(getArg('--width', '1200'));
  const height = parseInt(getArg('--height', '630'));
  const output = resolveOutput(input, `.${format}`, getArg('--output', null));

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(`file://${input}`, { waitUntil: 'networkidle0', timeout: 30000 });

    if (format === 'pdf') {
      await page.pdf({ path: output, width: `${width}px`, height: `${height}px`, printBackground: true });
    } else {
      await page.screenshot({ path: output, type: 'png', fullPage: false });
    }

    const size = statSync(output).size;
    if (jsonOutput) {
      out({ input, output, format, width, height, sizeKB: Math.round(size / 1024) });
    } else {
      log(`Rendered: ${output} (${format}, ${width}x${height}, ${Math.round(size / 1024)}KB)`);
    }
  } finally {
    await browser.close();
  }
}

async function cmdSocial() {
  const file = positional[1];
  const platform = getArg('--platform', '');
  if (!file) err('Usage: graphics.mjs social <html-file> --platform linkedin|twitter|instagram|facebook|og');
  if (!platform || !SOCIAL_SIZES[platform]) err(`Unknown platform: ${platform}. Valid: ${Object.keys(SOCIAL_SIZES).join(', ')}`);
  const input = resolveInput(file);
  const { width, height } = SOCIAL_SIZES[platform];
  const output = resolveOutput(input, `-${platform}.png`, getArg('--output', null));

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(`file://${input}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: output, type: 'png', fullPage: false });

    const size = statSync(output).size;
    if (jsonOutput) {
      out({ input, output, platform, width, height, sizeKB: Math.round(size / 1024) });
    } else {
      log(`Social graphic: ${output} (${platform}, ${width}x${height}, ${Math.round(size / 1024)}KB)`);
    }
  } finally {
    await browser.close();
  }
}

async function cmdPdf() {
  const file = positional[1];
  if (!file) err('Usage: graphics.mjs pdf <html-file> [--page-size a4|a5|letter] [--output path]');
  const input = resolveInput(file);
  const pageSize = getArg('--page-size', 'a4');
  if (!PAGE_SIZES[pageSize]) err(`Unknown page size: ${pageSize}. Valid: ${Object.keys(PAGE_SIZES).join(', ')}`);
  const { width, height } = PAGE_SIZES[pageSize];
  const output = resolveOutput(input, '.pdf', getArg('--output', null));

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`file://${input}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.pdf({ path: output, width, height, printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });

    const size = statSync(output).size;
    if (jsonOutput) {
      out({ input, output, pageSize, sizeKB: Math.round(size / 1024) });
    } else {
      log(`PDF: ${output} (${pageSize}, ${Math.round(size / 1024)}KB)`);
    }
  } finally {
    await browser.close();
  }
}

// --- Dispatch ---
switch (command) {
  case 'render': await cmdRender(); break;
  case 'social': await cmdSocial(); break;
  case 'pdf':    await cmdPdf(); break;
  default:       err(`Unknown command: ${command}. Run --help for usage.`);
}
