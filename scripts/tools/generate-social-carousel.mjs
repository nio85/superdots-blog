#!/usr/bin/env node
/**
 * generate-social-carousel.mjs — Render branded carousel slides and upload to Postiz CDN.
 *
 * Takes a template (key-takeaways, stat-highlight, step-by-step) and structured
 * slide content as JSON. Renders each slide via Puppeteer at 1080x1080, uploads
 * to Postiz CDN, and outputs comma-separated CDN URLs for use with social-draft.mjs.
 *
 * Usage:
 *   node scripts/tools/generate-social-carousel.mjs \
 *     --slug <slug> \
 *     --template key-takeaways|stat-highlight|step-by-step \
 *     --slides '<JSON array>' \
 *     --department <dept> \
 *     [--dry-run]
 *
 * Slide JSON formats:
 *
 *   key-takeaways:
 *     [{"type":"hook","title":"..."},{"type":"point","title":"...","body":"..."},...]
 *
 *   stat-highlight:
 *     [{"type":"hero-stat","number":"73%","label":"...","source":"..."},
 *      {"type":"stat","value":"2.4x","context":"...","detail":"..."},...]
 *
 *   step-by-step:
 *     [{"type":"hook","title":"How to ..."},{"type":"step","title":"...","detail":"..."},...]
 *
 *   All templates: last entry can be {"type":"cta"} (auto-added if missing).
 *
 * Output: comma-separated Postiz CDN URLs (one per slide) to stdout.
 */

import '../config.mjs';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { BLOG_ROOT } from '../config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(BLOG_ROOT, 'content', 'graphics', 'carousel');
const TMP_DIR = join(tmpdir(), 'superdots-carousel');

// Department accent colors (same as image-style-config.json)
const DEPT_COLORS = {
  operations: '#F59E0B',    // amber
  sales: '#14B8A6',         // teal
  marketing: '#E8363B',     // red
  hr: '#6366F1',            // purple
  finance: '#14B8A6',       // teal
  engineering: '#14B8A6',   // teal
  legal: '#94A3B8',         // gray
  design: '#E8363B',        // red
  'customer-support': '#F59E0B', // amber
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const slug = getFlag('--slug');
const template = getFlag('--template');
const slidesJson = getFlag('--slides');
const department = getFlag('--department') || 'marketing';

// Sanitize slug for safe file paths (only allow alphanumeric, hyphens, underscores)
function sanitizeSlug(s) { return s.replace(/[^a-zA-Z0-9_-]/g, '_'); }

if (!slug || !template || !slidesJson) {
  console.error('Usage: generate-social-carousel.mjs --slug <slug> --template key-takeaways|stat-highlight|step-by-step --slides \'<JSON>\' --department <dept> [--dry-run]');
  process.exit(1);
}

const VALID_TEMPLATES = ['key-takeaways', 'stat-highlight', 'step-by-step'];
if (!VALID_TEMPLATES.includes(template)) {
  console.error(`Unknown template: ${template}. Valid: ${VALID_TEMPLATES.join(', ')}`);
  process.exit(1);
}

let slides;
try {
  slides = JSON.parse(slidesJson);
  if (!Array.isArray(slides) || slides.length < 2) throw new Error('Need at least 2 slides');
} catch (e) {
  console.error(`Invalid --slides JSON: ${e.message}`);
  process.exit(1);
}

// Auto-add CTA slide if last entry isn't one
if (slides[slides.length - 1].type !== 'cta') {
  slides.push({ type: 'cta' });
}

const accentColor = '#E8363B';  // Brand red — ALWAYS dominant
const deptColor = DEPT_COLORS[department] || '#E8363B';
const totalSlides = slides.length;

// ── Template rendering ──────────────────────────────────────────────────────

const templateHtml = readFileSync(join(TEMPLATES_DIR, `${template}.html`), 'utf-8');

function renderSlideHtml(slide, index) {
  let html = templateHtml;

  // Global replacements
  html = html.replace(/\{\{accentColor\}\}/g, accentColor);
  html = html.replace(/\{\{deptColor\}\}/g, deptColor);
  html = html.replace(/\{\{department\}\}/g, department);
  html = html.replace(/\{\{slug\}\}/g, escapeHtml(slug));
  html = html.replace(/\{\{totalSlides\}\}/g, String(totalSlides));
  html = html.replace(/\{\{slideNumber\}\}/g, String(index + 1));

  // Show only the relevant slide section via CSS (no JS needed — Puppeteer renders immediately)
  const slideType = slide.type === 'hero-stat' ? 'hero-stat' : slide.type;

  // For hook slides
  if (slide.type === 'hook') {
    html = html.replace(/\{\{hookTitle\}\}/g, escapeHtml(slide.title || ''));
  }

  // For point slides (key-takeaways)
  if (slide.type === 'point') {
    const pointNum = slides.filter((s, i) => s.type === 'point' && i <= index).length;
    html = html.replace(/\{\{pointNumber\}\}/g, String(pointNum));
    html = html.replace(/\{\{pointTitle\}\}/g, escapeHtml(slide.title || ''));
    html = html.replace(/\{\{pointBody\}\}/g, escapeHtml(slide.body || ''));
  }

  // For stat slides (stat-highlight)
  if (slide.type === 'hero-stat') {
    html = html.replace(/\{\{heroStatNumber\}\}/g, escapeHtml(slide.number || ''));
    html = html.replace(/\{\{heroStatLabel\}\}/g, escapeHtml(slide.label || ''));
    html = html.replace(/\{\{heroStatSource\}\}/g, escapeHtml(slide.source || ''));
  }
  if (slide.type === 'stat') {
    html = html.replace(/\{\{statValue\}\}/g, escapeHtml(slide.value || ''));
    html = html.replace(/\{\{statContext\}\}/g, escapeHtml(slide.context || ''));
    html = html.replace(/\{\{statDetail\}\}/g, escapeHtml(slide.detail || ''));
  }

  // For CTA slides — customizable heading
  if (slide.type === 'cta') {
    const ctaHeading = slide.heading || 'Read the full breakdown';
    html = html.replace(/\{\{ctaHeading\}\}/g, escapeHtml(ctaHeading));
  }

  // For step slides (step-by-step)
  if (slide.type === 'step') {
    const stepNum = slides.filter((s, i) => s.type === 'step' && i <= index).length;
    html = html.replace(/\{\{stepNumber\}\}/g, String(stepNum));
    html = html.replace(/\{\{stepTitle\}\}/g, escapeHtml(slide.title || ''));
    html = html.replace(/\{\{stepDetail\}\}/g, escapeHtml(slide.detail || ''));
  }

  // Show only the matching slide via CSS — no script needed, instant render
  const hideStyle = `<style>[data-slide] { display: none !important; } [data-slide="${slideType}"] { display: flex !important; }</style>`;
  html = html.replace('</head>', hideStyle + '\n</head>');

  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Cleanup helper ────────────────────────────────────────────────────────

function cleanupFiles(files) {
  for (const f of files) {
    try { unlinkSync(f); } catch { /* best-effort */ }
  }
}

// ── Main pipeline ──────────────────────────────────────────────────────────

async function main() {
  mkdirSync(TMP_DIR, { recursive: true });

  const slideFiles = [];
  const pngFiles = [];
  const cdnUrls = [];

  console.error(`[CAROUSEL] Template: ${template}, Slides: ${totalSlides}, Dept: ${department}`);

  // 1. Generate HTML file for each slide
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const html = renderSlideHtml(slide, i);
    const tmpFile = join(TMP_DIR, `${sanitizeSlug(slug)}-slide-${i + 1}.html`);
    writeFileSync(tmpFile, html, 'utf-8');
    slideFiles.push(tmpFile);
    console.error(`[CAROUSEL] Slide ${i + 1}/${totalSlides}: type=${slide.type}`);
  }

  if (DRY_RUN) {
    console.error('[DRY RUN] Skipping render and upload.');
    console.error(`Temp files: ${slideFiles.join(', ')}`);
    cleanupFiles(slideFiles);
    process.exit(0);
  }

  // 2. Render all slides to PNG via Puppeteer — reuse a single browser instance
  const outputDir = join(TMP_DIR, sanitizeSlug(slug));
  mkdirSync(outputDir, { recursive: true });

  let browser;
  try {
    const puppeteer = (await import('puppeteer')).default;
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    for (let i = 0; i < slideFiles.length; i++) {
      const outFile = join(outputDir, `slide-${i + 1}.png`);
      pngFiles.push(outFile);
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1080, height: 1080 });
        const fileUrl = `file://${slideFiles[i]}`;
        await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });
        await page.screenshot({ path: outFile, type: 'png' });
        console.error(`[CAROUSEL] Rendered slide ${i + 1}: ${outFile}`);
      } finally {
        await page.close();
      }
    }
  } catch (e) {
    // If Puppeteer fails, fall back to graphics.mjs per-slide rendering
    console.error(`[CAROUSEL] Puppeteer direct failed (${e.message}), falling back to graphics.mjs...`);
    for (let i = 0; i < slideFiles.length; i++) {
      const outFile = join(outputDir, `slide-${i + 1}.png`);
      if (!pngFiles.includes(outFile)) pngFiles.push(outFile);
      try {
        execSync(
          `PUPPETEER_CACHE_DIR=/home/luca/.cache/puppeteer node ${join(__dirname, 'graphics.mjs')} render "${slideFiles[i]}" --width 1080 --height 1080 --format png --output "${outFile}"`,
          { encoding: 'utf-8', timeout: 30000 }
        );
        console.error(`[CAROUSEL] Rendered slide ${i + 1} (fallback): ${outFile}`);
      } catch (e2) {
        console.error(`[ERROR] Failed to render slide ${i + 1}: ${e2.message}`);
        cleanupFiles([...slideFiles, ...pngFiles]);
        process.exit(1);
      }
    }
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* best-effort */ }
    }
  }

  // 3. Upload each slide to Postiz CDN — track for rollback on failure
  try {
    for (let i = 0; i < pngFiles.length; i++) {
      const pngFile = pngFiles[i];
      try {
        const uploadResult = execSync(
          `node ${join(__dirname, 'postiz.mjs')} upload-file "${pngFile}" --json`,
          { encoding: 'utf-8', timeout: 15000 }
        ).trim();
        const parsed = JSON.parse(uploadResult);
        const url = parsed.path || parsed.url || '';
        if (!url) throw new Error('No URL in upload response');
        cdnUrls.push(url);
        console.error(`[CAROUSEL] Uploaded slide ${i + 1}: ${url}`);
      } catch (e) {
        console.error(`[ERROR] Failed to upload slide ${i + 1}: ${e.message}`);
        if (cdnUrls.length > 0) {
          console.error(`[WARN] ${cdnUrls.length} slides were uploaded before failure. CDN URLs (orphaned): ${cdnUrls.join(', ')}`);
        }
        cleanupFiles([...slideFiles, ...pngFiles]);
        process.exit(1);
      }
    }
  } finally {
    // 4. Always clean up temp files
    cleanupFiles([...slideFiles, ...pngFiles]);
  }

  // 5. Output: comma-separated CDN URLs
  console.log(cdnUrls.join(','));
  console.error(`[CAROUSEL] Done. ${cdnUrls.length} slides uploaded.`);
}

main().catch(e => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
