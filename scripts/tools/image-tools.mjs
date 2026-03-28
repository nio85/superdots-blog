#!/usr/bin/env node
/**
 * Image audit and optimization tool for Superdots blog hero images.
 *
 * Uses Sharp for image processing. Brand standards from image-style-config.json.
 * Auth: none (local filesystem only).
 *
 * Usage:
 *   node scripts/tools/image-tools.mjs <command> [options]
 */

import '../config.mjs';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { BLOG_ROOT } from '../config.mjs';

const CONTENT_DIR = join(BLOG_ROOT, 'src', 'content', 'blog');
const IMAGE_DIR = join(BLOG_ROOT, 'public', 'images', 'blog');
const STYLE_CONFIG_PATH = join(BLOG_ROOT, 'scripts', 'image-style-config.json');

const styleConfig = JSON.parse(readFileSync(STYLE_CONFIG_PATH, 'utf-8'));
const BRAND_WIDTH = styleConfig.imageSize.width;   // 1200
const BRAND_HEIGHT = styleConfig.imageSize.height;  // 630
const BRAND_QUALITY = styleConfig.outputQuality;    // 85
const MAX_SIZE_BYTES = 200 * 1024; // 200KB

const HELP = `Usage: node image-tools.mjs <command> [options]

Commands:
  audit                  Scan all articles for image issues
  optimize <path>        Optimize a single image (resize + WebP)
  optimize-all           Batch optimize all non-compliant images
  info <path>            Image metadata (dimensions, format, size)
  missing                List articles without hero image
  stats                  Image inventory summary

Options:
  --json      Output as JSON
  --help      Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

// --- Parse frontmatter (same pattern as generate-ai-images.mjs) ---

function parseFrontmatter(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"')))
        val = val.slice(1, -1);
      fm[m[1]] = val;
    }
  }
  return fm;
}

// --- Collect articles ---

function getArticles() {
  return readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const slug = f.replace(/\.md$/, '');
      const fm = parseFrontmatter(join(CONTENT_DIR, f));
      const webpPath = join(IMAGE_DIR, `${slug}.webp`);
      const svgPath = join(IMAGE_DIR, `${slug}.svg`);
      const hasWebp = existsSync(webpPath);
      const hasSvg = existsSync(svgPath);
      return { slug, fm, webpPath, svgPath, hasWebp, hasSvg, mdPath: join(CONTENT_DIR, f) };
    });
}

// --- Get image metadata via Sharp ---

async function getImageMeta(path) {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(path).metadata();
  const stat = statSync(path);
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    channels: meta.channels,
    hasAlpha: meta.hasAlpha,
    sizeBytes: stat.size,
    sizeKB: Math.round(stat.size / 1024),
  };
}

// ═══════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════

async function cmdAudit() {
  const articles = getArticles();
  const issues = [];

  for (const a of articles) {
    if (!a.hasWebp && !a.hasSvg) {
      issues.push({ slug: a.slug, type: 'missing_image', detail: 'No hero image (webp or svg)' });
      continue;
    }
    if (!a.hasWebp && a.hasSvg) {
      issues.push({ slug: a.slug, type: 'svg_only', detail: 'Has SVG but no WebP (should generate AI image)' });
    }
    if (a.hasWebp) {
      try {
        const meta = await getImageMeta(a.webpPath);
        if (meta.sizeBytes > MAX_SIZE_BYTES)
          issues.push({ slug: a.slug, type: 'oversized', detail: `${meta.sizeKB}KB > 200KB limit` });
        if (meta.width !== BRAND_WIDTH || meta.height !== BRAND_HEIGHT)
          issues.push({ slug: a.slug, type: 'wrong_dimensions', detail: `${meta.width}x${meta.height} (expected ${BRAND_WIDTH}x${BRAND_HEIGHT})` });
        if (meta.format !== 'webp')
          issues.push({ slug: a.slug, type: 'wrong_format', detail: `Format: ${meta.format} (expected webp)` });
      } catch (e) {
        issues.push({ slug: a.slug, type: 'read_error', detail: e.message });
      }
    }
    if (!a.fm?.imageHint) {
      issues.push({ slug: a.slug, type: 'no_imageHint', detail: 'Missing imageHint in frontmatter' });
    }
  }

  const summary = {
    totalArticles: articles.length,
    totalIssues: issues.length,
    missing: issues.filter(i => i.type === 'missing_image').length,
    svgOnly: issues.filter(i => i.type === 'svg_only').length,
    oversized: issues.filter(i => i.type === 'oversized').length,
    wrongDimensions: issues.filter(i => i.type === 'wrong_dimensions').length,
    wrongFormat: issues.filter(i => i.type === 'wrong_format').length,
    noImageHint: issues.filter(i => i.type === 'no_imageHint').length,
    readErrors: issues.filter(i => i.type === 'read_error').length,
  };

  if (jsonOutput) {
    out({ summary, issues });
  } else {
    log(`Image Audit — ${articles.length} articles scanned\n`);
    if (issues.length === 0) {
      log('✓ All images compliant. No issues found.');
    } else {
      log(`Found ${issues.length} issue(s):\n`);
      for (const i of issues) log(`  [${i.type}] ${i.slug}: ${i.detail}`);
      log(`\nSummary: ${summary.missing} missing, ${summary.svgOnly} svg-only, ${summary.oversized} oversized, ${summary.wrongDimensions} wrong-size, ${summary.noImageHint} no-hint`);
    }
  }
}

async function cmdOptimize() {
  const target = positional[1];
  if (!target) err('Usage: image-tools.mjs optimize <path>');
  if (!existsSync(target)) err(`File not found: ${target}`);

  const sharp = (await import('sharp')).default;
  const beforeStat = statSync(target);
  const beforeKB = Math.round(beforeStat.size / 1024);

  await sharp(target)
    .resize(BRAND_WIDTH, BRAND_HEIGHT, { fit: 'cover' })
    .webp({ quality: BRAND_QUALITY })
    .toFile(target + '.tmp');

  const { renameSync } = await import('node:fs');
  renameSync(target + '.tmp', target);

  const afterStat = statSync(target);
  const afterKB = Math.round(afterStat.size / 1024);
  const saved = beforeKB - afterKB;

  if (jsonOutput) {
    out({ path: target, beforeKB, afterKB, savedKB: saved });
  } else {
    log(`Optimized: ${target}`);
    log(`  Before: ${beforeKB}KB → After: ${afterKB}KB (saved ${saved}KB)`);
  }
}

async function cmdOptimizeAll() {
  const articles = getArticles();
  let processed = 0, skipped = 0, totalSaved = 0;
  const sharp = (await import('sharp')).default;

  for (const a of articles) {
    if (!a.hasWebp) { skipped++; continue; }
    try {
      const meta = await getImageMeta(a.webpPath);
      if (meta.width === BRAND_WIDTH && meta.height === BRAND_HEIGHT && meta.sizeBytes <= MAX_SIZE_BYTES) {
        skipped++;
        continue;
      }
      const beforeSize = meta.sizeBytes;
      await sharp(a.webpPath)
        .resize(BRAND_WIDTH, BRAND_HEIGHT, { fit: 'cover' })
        .webp({ quality: BRAND_QUALITY })
        .toFile(a.webpPath + '.tmp');
      const { renameSync } = await import('node:fs');
      renameSync(a.webpPath + '.tmp', a.webpPath);
      const afterSize = statSync(a.webpPath).size;
      totalSaved += (beforeSize - afterSize);
      processed++;
      log(`  Optimized: ${a.slug} (saved ${Math.round((beforeSize - afterSize) / 1024)}KB)`);
    } catch (e) {
      log(`  Failed: ${a.slug}: ${e.message}`);
    }
  }

  if (jsonOutput) {
    out({ processed, skipped, totalSavedKB: Math.round(totalSaved / 1024) });
  } else {
    log(`\nBatch optimization complete: ${processed} processed, ${skipped} skipped, ${Math.round(totalSaved / 1024)}KB saved`);
  }
}

async function cmdInfo() {
  const target = positional[1];
  if (!target) err('Usage: image-tools.mjs info <path>');
  if (!existsSync(target)) err(`File not found: ${target}`);

  const meta = await getImageMeta(target);
  if (jsonOutput) {
    out({ path: target, ...meta });
  } else {
    log(`Image: ${target}`);
    log(`  Dimensions: ${meta.width}x${meta.height}`);
    log(`  Format: ${meta.format}`);
    log(`  Size: ${meta.sizeKB}KB (${meta.sizeBytes} bytes)`);
    log(`  Channels: ${meta.channels}, Alpha: ${meta.hasAlpha}`);
    log(`  Brand compliant: ${meta.width === BRAND_WIDTH && meta.height === BRAND_HEIGHT && meta.format === 'webp' && meta.sizeBytes <= MAX_SIZE_BYTES ? 'YES' : 'NO'}`);
  }
}

function cmdMissing() {
  const articles = getArticles();
  const missing = articles.filter(a => !a.hasWebp);

  if (jsonOutput) {
    out({ total: missing.length, slugs: missing.map(a => a.slug), hasSvg: missing.filter(a => a.hasSvg).map(a => a.slug) });
  } else {
    log(`Articles without WebP hero image: ${missing.length}\n`);
    for (const a of missing) {
      log(`  ${a.slug}${a.hasSvg ? ' (has SVG fallback)' : ''}`);
    }
  }
}

async function cmdStats() {
  const articles = getArticles();
  const webpFiles = articles.filter(a => a.hasWebp);
  const svgFiles = articles.filter(a => a.hasSvg && !a.hasWebp);
  const noImage = articles.filter(a => !a.hasWebp && !a.hasSvg);

  let totalSize = 0;
  let sizes = [];
  for (const a of webpFiles) {
    try {
      const s = statSync(a.webpPath).size;
      totalSize += s;
      sizes.push(s);
    } catch {}
  }
  const avgSize = sizes.length ? Math.round(totalSize / sizes.length / 1024) : 0;

  // Count all files in image dir
  const allFiles = existsSync(IMAGE_DIR) ? readdirSync(IMAGE_DIR) : [];
  const formats = {};
  for (const f of allFiles) {
    const ext = extname(f).slice(1) || 'unknown';
    formats[ext] = (formats[ext] || 0) + 1;
  }

  const result = {
    totalArticles: articles.length,
    images: {
      webp: webpFiles.length,
      svgOnly: svgFiles.length,
      missing: noImage.length,
    },
    files: {
      totalInDir: allFiles.length,
      formatBreakdown: formats,
    },
    avgSizeKB: avgSize,
    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 10) / 10,
    brandSpec: { width: BRAND_WIDTH, height: BRAND_HEIGHT, format: 'webp', maxSizeKB: 200 },
  };

  if (jsonOutput) {
    out(result);
  } else {
    log(`Image Stats — ${articles.length} articles\n`);
    log(`  WebP images:  ${webpFiles.length}`);
    log(`  SVG only:     ${svgFiles.length}`);
    log(`  No image:     ${noImage.length}`);
    log(`  Files in dir: ${allFiles.length} (${Object.entries(formats).map(([k,v]) => `${v} ${k}`).join(', ')})`);
    log(`  Avg size:     ${avgSize}KB`);
    log(`  Total size:   ${result.totalSizeMB}MB`);
    log(`  Brand spec:   ${BRAND_WIDTH}x${BRAND_HEIGHT} WebP ≤200KB`);
  }
}

// --- Dispatch ---

switch (command) {
  case 'audit':        await cmdAudit(); break;
  case 'optimize':     await cmdOptimize(); break;
  case 'optimize-all': await cmdOptimizeAll(); break;
  case 'info':         await cmdInfo(); break;
  case 'missing':      cmdMissing(); break;
  case 'stats':        await cmdStats(); break;
  default:             err(`Unknown command: ${command}. Run --help for usage.`);
}
