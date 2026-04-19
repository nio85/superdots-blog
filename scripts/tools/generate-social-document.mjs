#!/usr/bin/env node
/**
 * generate-social-document.mjs — Generate branded PDF document for LinkedIn document posts.
 *
 * Takes structured slide content (same JSON as carousel) and generates a PDF
 * via Marp with the Superdots brand theme. Uploads to Postiz CDN.
 *
 * Usage:
 *   node scripts/tools/generate-social-document.mjs \
 *     --slug <slug> \
 *     --slides '<JSON array>' \
 *     --department <dept> \
 *     [--dry-run]
 *
 * Slide JSON format (same as carousel):
 *   [{"type":"hook","title":"..."},{"type":"point","title":"...","body":"..."},...]
 *   or
 *   [{"type":"hook","title":"..."},{"type":"step","title":"...","detail":"..."},...]
 *   or
 *   [{"type":"hero-stat","number":"73%","label":"..."},{"type":"stat","value":"2x","context":"..."},...]
 *
 * Output: Postiz CDN URL for the PDF to stdout.
 */

import '../config.mjs';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = join(tmpdir(), 'superdots-document');

// Department accent colors for Marp directives
const DEPT_COLORS = {
  operations: '#F59E0B',
  sales: '#14B8A6',
  marketing: '#E8363B',
  hr: '#6366F1',
  finance: '#14B8A6',
  engineering: '#14B8A6',
  legal: '#94A3B8',
  design: '#E8363B',
  'customer-support': '#F59E0B',
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

// Sanitize slug for safe file paths (only allow alphanumeric, hyphens, underscores)
function sanitizeSlug(s) { return s.replace(/[^a-zA-Z0-9_-]/g, '_'); }

// Escape text for safe Marp markdown embedding
function escapeMarp(text) {
  if (!text) return '';
  return text
    .replace(/---/g, '\\-\\-\\-')     // prevent slide breaks
    .replace(/<!--/g, '&lt;!--')      // prevent HTML comments (Marp directives)
    .replace(/<\/?[a-z]/gi, (m) => `\\${m}`)  // escape HTML-like tags
    .replace(/^(#+)\s/gm, '\\$1 ');   // escape heading markers at line start
}

const slug = getFlag('--slug');
const slidesJson = getFlag('--slides');
const department = getFlag('--department') || 'marketing';

if (!slug || !slidesJson) {
  console.error('Usage: generate-social-document.mjs --slug <slug> --slides \'<JSON>\' --department <dept> [--dry-run]');
  process.exit(1);
}

const safeSlug = sanitizeSlug(slug);

let slides;
try {
  slides = JSON.parse(slidesJson);
  if (!Array.isArray(slides) || slides.length < 2) throw new Error('Need at least 2 slides');
} catch (e) {
  console.error(`Invalid --slides JSON: ${e.message}`);
  process.exit(1);
}

// Auto-add CTA slide if missing
if (slides[slides.length - 1].type !== 'cta') {
  slides.push({ type: 'cta' });
}

const accentColor = DEPT_COLORS[department] || '#E8363B';

// ── Generate Marp markdown ──────────────────────────────────────────────────

function generateMarpMarkdown() {
  const lines = [];

  // Marp frontmatter
  lines.push('---');
  lines.push('marp: true');
  lines.push('theme: default');
  lines.push('size: 4:3');
  lines.push(`style: |`);
  lines.push(`  section {`);
  lines.push(`    background: #0B1222;`);
  lines.push(`    color: #FFFFFF;`);
  lines.push(`    font-family: 'Inter', system-ui, sans-serif;`);
  lines.push(`  }`);
  lines.push(`  h1, h2 {`);
  lines.push(`    font-family: 'Space Grotesk', system-ui, sans-serif;`);
  lines.push(`    color: #FFFFFF;`);
  lines.push(`  }`);
  lines.push(`  h1 { font-size: 2.4em; letter-spacing: -0.02em; }`);
  lines.push(`  h2 { font-size: 1.8em; letter-spacing: -0.01em; }`);
  lines.push(`  .accent { color: ${accentColor}; }`);
  lines.push(`  .muted { color: #94A3B8; font-size: 0.8em; }`);
  lines.push(`  .stat { font-size: 4em; font-weight: 700; color: ${accentColor}; }`);
  lines.push(`  footer { color: #94A3B8; font-size: 0.6em; }`);
  lines.push('---');
  lines.push('');

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];

    if (i > 0) {
      lines.push('---');
      lines.push('');
    }

    switch (slide.type) {
      case 'hook':
        lines.push(`<!-- _class: lead -->`);
        lines.push('');
        lines.push(`# ${escapeMarp(slide.title)}`);
        lines.push('');
        lines.push(`<span class="muted">${escapeMarp(department.toUpperCase())} · superdots.sh</span>`);
        break;

      case 'point':
        lines.push(`## ${escapeMarp(slide.title)}`);
        lines.push('');
        if (slide.body) lines.push(escapeMarp(slide.body));
        break;

      case 'step': {
        const stepNum = slides.filter((s, j) => s.type === 'step' && j <= i).length;
        lines.push(`## Step ${stepNum}: ${escapeMarp(slide.title)}`);
        lines.push('');
        if (slide.detail) lines.push(escapeMarp(slide.detail));
        break;
      }

      case 'hero-stat':
        lines.push(`<!-- _class: lead -->`);
        lines.push('');
        lines.push(`<div class="stat">${escapeMarp(slide.number)}</div>`);
        lines.push('');
        lines.push(`## ${escapeMarp(slide.label)}`);
        if (slide.source) lines.push(`\n<span class="muted">${escapeMarp(slide.source)}</span>`);
        break;

      case 'stat':
        lines.push(`<div class="stat" style="font-size:3em">${escapeMarp(slide.value)}</div>`);
        lines.push('');
        lines.push(`## ${escapeMarp(slide.context)}`);
        if (slide.detail) lines.push(`\n${escapeMarp(slide.detail)}`);
        break;

      case 'cta':
        lines.push(`<!-- _class: lead -->`);
        lines.push('');
        lines.push(`## Read the full guide`);
        lines.push('');
        lines.push(`<span class="accent">superdots.sh/blog/${safeSlug}</span>`);
        break;
    }

    lines.push('');
    lines.push(`<!-- footer: superdots.sh/blog/${safeSlug} · ${i + 1}/${slides.length} -->`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(TMP_DIR, { recursive: true });

  const mdContent = generateMarpMarkdown();
  const mdFile = join(TMP_DIR, `${safeSlug}-document.md`);
  const pdfFile = join(TMP_DIR, `${safeSlug}-document.pdf`);

  writeFileSync(mdFile, mdContent, 'utf-8');
  console.error(`[DOCUMENT] Generated Marp markdown: ${mdFile} (${slides.length} slides)`);

  if (DRY_RUN) {
    console.error('[DRY RUN] Skipping build and upload.');
    console.error(`Content:\n${mdContent}`);
    try { unlinkSync(mdFile); } catch {}
    process.exit(0);
  }

  try {
    // Build PDF via slides.mjs (using execFile — no shell)
    try {
      await execFileAsync(
        'node',
        [join(__dirname, 'slides.mjs'), 'build', mdFile, '--format', 'pdf', '--output', pdfFile],
        { encoding: 'utf-8', timeout: 30000 }
      );
      console.error(`[DOCUMENT] Built PDF: ${pdfFile}`);
    } catch (e) {
      console.error(`[ERROR] Failed to build PDF: ${e.message}`);
      process.exit(1);
    }

    // Upload to Postiz CDN (using execFile — no shell)
    try {
      const { stdout: uploadResult } = await execFileAsync(
        'node',
        [join(__dirname, 'postiz.mjs'), 'upload-file', pdfFile, '--json'],
        { encoding: 'utf-8', timeout: 15000 }
      );
      const parsed = JSON.parse(uploadResult.trim());
      const url = parsed.path || parsed.url || '';
      if (!url) throw new Error('No URL in upload response');

      console.log(url);
      console.error(`[DOCUMENT] Uploaded PDF: ${url}`);
    } catch (e) {
      console.error(`[ERROR] Failed to upload PDF: ${e.message}`);
      process.exit(1);
    }
  } finally {
    // Always clean up temp files
    try { unlinkSync(mdFile); } catch {}
    try { unlinkSync(pdfFile); } catch {}
  }
}

main().catch(e => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
