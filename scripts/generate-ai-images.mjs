#!/usr/bin/env node
/**
 * Generate AI hero images for Superdots blog posts using Flux Pro via Replicate.
 *
 * Usage:
 *   node generate-ai-images.mjs                        # Generate for all posts missing AI images
 *   node generate-ai-images.mjs --slug ai-budgeting-tools  # Generate for one post
 *   node generate-ai-images.mjs --all                  # Regenerate ALL posts (overwrite existing)
 *   node generate-ai-images.mjs --dry-run              # Show prompts without calling API
 *
 * Requires: REPLICATE_API_TOKEN env var
 * Falls back to existing SVG hero images if API call fails.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { BLOG_ROOT } from './config.mjs';

// --- Paths ---

const CONTENT_DIR = join(BLOG_ROOT, 'src', 'content', 'blog');
const IMAGE_DIR = join(BLOG_ROOT, 'public', 'images', 'blog');
const STYLE_CONFIG_PATH = join(BLOG_ROOT, 'scripts', 'image-style-config.json');

// Ensure output directory exists
if (!existsSync(IMAGE_DIR)) mkdirSync(IMAGE_DIR, { recursive: true });

// --- Load style config ---

const styleConfig = JSON.parse(readFileSync(STYLE_CONFIG_PATH, 'utf-8'));

// --- Parse CLI args ---

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const REGEN_ALL = args.includes('--all');
const slugIdx = args.indexOf('--slug');
const TARGET_SLUG = slugIdx !== -1 ? args[slugIdx + 1] : null;

// --- Parse article frontmatter ---

function parseFrontmatter(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) {
      let val = m[2].trim();
      // Strip quotes
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1);
      }
      fm[m[1]] = val;
    }
  }
  return { frontmatter: fm, raw: content };
}

// --- Build prompt from article metadata + style config ---

function extractHeadings(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    // Remove frontmatter
    const body = content.replace(/^---[\s\S]*?---/, '');
    const headings = [];
    for (const line of body.split('\n')) {
      const m = line.match(/^#{2,3}\s+(.+)/);
      if (m && !m[1].toLowerCase().includes('faq')) headings.push(m[1].trim());
    }
    return headings.slice(0, 5).join(', ');
  } catch { return ''; }
}

function buildPrompt(article) {
  const { title, description, department, useCase, imageHint, filePath } = article;
  const dept = styleConfig.departments[department] || styleConfig.departments.operations;
  const useCaseHint = styleConfig.useCases[useCase] || '';
  const headings = extractHeadings(filePath);

  const parts = [
    styleConfig.brandStyle.basePrompt,
    `Topic: ${title}.`,
    imageHint ? `Scene: ${imageHint}.` : '',
    description ? `Context: ${description.slice(0, 120)}.` : '',
    headings ? `Key sections: ${headings}.` : '',
    `Department visual style: ${dept.promptHint}.`,
    `Accent color: ${dept.accent}.`,
    useCaseHint ? `Visual motifs: ${useCaseHint}.` : '',
    'Aspect ratio 1200x630, widescreen banner composition. Centered focal point with breathing room.',
  ];

  return parts.filter(Boolean).join(' ');
}

// --- Call Replicate API ---

async function generateImage(prompt) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN env var is required. Set it before running.');
  }

  // Dynamic import to avoid load-time crash if not installed
  const Replicate = (await import('replicate')).default;
  const replicate = new Replicate({ auth: token });

  const output = await replicate.run(styleConfig.model, {
    input: {
      prompt,
      width: styleConfig.imageSize.width,
      height: styleConfig.imageSize.height,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      output_format: 'webp',
      output_quality: styleConfig.outputQuality,
    },
  });

  // Replicate returns a URL (string) or ReadableStream for flux models
  if (typeof output === 'string') {
    const res = await fetch(output);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  // If it returns a stream or buffer directly
  if (Buffer.isBuffer(output)) return output;

  // flux-1.1-pro returns a FileOutput URL object
  if (output && typeof output.url === 'function') {
    const url = output.url();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  // Handle as URL-like object with toString
  const url = String(output);
  if (url.startsWith('http')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error(`Unexpected Replicate output type: ${typeof output}`);
}

// --- Optimize with Sharp ---

async function optimizeImage(buffer) {
  const sharp = (await import('sharp')).default;
  return sharp(buffer)
    .resize(styleConfig.imageSize.width, styleConfig.imageSize.height, { fit: 'cover' })
    .webp({ quality: styleConfig.outputQuality })
    .toBuffer();
}

// --- Update frontmatter heroImage path ---

function updateFrontmatter(filePath, newImagePath) {
  const content = readFileSync(filePath, 'utf-8');

  // Replace existing heroImage line or add one
  if (content.match(/^heroImage:/m)) {
    const updated = content.replace(
      /^heroImage:.*$/m,
      `heroImage: "${newImagePath}"`
    );
    writeFileSync(filePath, updated, 'utf-8');
  } else {
    // Insert before closing ---
    const updated = content.replace(
      /\n---\n/,
      `\nheroImage: "${newImagePath}"\n---\n`
    );
    writeFileSync(filePath, updated, 'utf-8');
  }
}

// --- Collect articles to process ---

function getArticles() {
  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const slug = file.replace('.md', '');
    const filePath = join(CONTENT_DIR, file);
    const parsed = parseFrontmatter(filePath);
    if (!parsed) continue;

    const { frontmatter } = parsed;
    const aiImagePath = join(IMAGE_DIR, `${slug}.webp`);
    const hasAiImage = existsSync(aiImagePath);

    articles.push({
      slug,
      filePath,
      title: frontmatter.title || slug,
      description: frontmatter.description || '',
      department: frontmatter.department || 'operations',
      useCase: frontmatter.useCase || 'automation',
      imageHint: frontmatter.imageHint || '',
      heroImage: frontmatter.heroImage || '',
      hasAiImage,
    });
  }

  return articles;
}

// --- Rate limit delay ---

const RATE_LIMIT_DELAY_MS = 11_000; // ~6 req/min Replicate limit
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- Main ---

async function main() {
  console.log('Superdots AI Image Generator');
  console.log('============================\n');

  const articles = getArticles();
  console.log(`Found ${articles.length} articles total.\n`);

  // Filter articles to process
  let toProcess;
  if (TARGET_SLUG) {
    toProcess = articles.filter(a => a.slug === TARGET_SLUG);
    if (toProcess.length === 0) {
      console.error(`Article not found: ${TARGET_SLUG}`);
      process.exit(1);
    }
  } else if (REGEN_ALL) {
    toProcess = articles;
  } else {
    // Only articles without AI-generated images
    toProcess = articles.filter(a => !a.hasAiImage);
  }

  console.log(`Processing ${toProcess.length} article(s)${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  let success = 0;
  let failed = 0;

  for (const article of toProcess) {
    const prompt = buildPrompt(article);

    console.log(`[${article.slug}]`);
    console.log(`  Dept: ${article.department} | Use case: ${article.useCase}`);

    if (DRY_RUN) {
      console.log(`  Prompt: ${prompt}\n`);
      success++;
      continue;
    }

    try {
      // Rate limit: wait between API calls to avoid 429s
      if (success + failed > 0) {
        console.log(`  Waiting ${RATE_LIMIT_DELAY_MS / 1000}s (rate limit)...`);
        await sleep(RATE_LIMIT_DELAY_MS);
      }

      console.log('  Generating with Flux Pro...');
      const rawBuffer = await generateImage(prompt);
      console.log(`  Raw image: ${(rawBuffer.length / 1024).toFixed(0)} KB`);

      console.log('  Optimizing with Sharp...');
      const optimized = await optimizeImage(rawBuffer);
      console.log(`  Optimized: ${(optimized.length / 1024).toFixed(0)} KB`);

      const outPath = join(IMAGE_DIR, `${article.slug}.webp`);
      writeFileSync(outPath, optimized);
      console.log(`  Saved: ${outPath}`);

      // Update frontmatter to point to new webp image
      const newHeroPath = `/images/blog/${article.slug}.webp`;
      updateFrontmatter(article.filePath, newHeroPath);
      console.log(`  Updated frontmatter: heroImage → ${newHeroPath}\n`);

      success++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      console.log(`  Keeping existing SVG fallback.\n`);
      failed++;
    }
  }

  console.log('============================');
  console.log(`Done. ${success} succeeded, ${failed} failed.`);

  if (!process.env.REPLICATE_API_TOKEN && !DRY_RUN) {
    console.log('\nWARNING: REPLICATE_API_TOKEN not set. Set it to generate images.');
    console.log('  export REPLICATE_API_TOKEN=r8_...');
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
