#!/usr/bin/env node
/**
 * generate-social-image.mjs — Generate platform-specific social images for Superdots posts.
 *
 * Separate from generate-ai-images.mjs (blog hero). Social images need different
 * dimensions and a bold, stop-the-scroll aesthetic vs. the atmospheric hero style.
 *
 * Uses Flux 1.1 Pro via Replicate (default) or Ideogram v2 (when IDEOGRAM_API_KEY is set).
 *
 * Output: Generates image → uploads to Postiz CDN → prints CDN URL to stdout.
 *
 * Usage:
 *   node scripts/tools/generate-social-image.mjs \
 *     --platform linkedin \
 *     --slug ai-marketing-attribution-tools \
 *     --department marketing \
 *     --title "AI Marketing Attribution Tools" \
 *     [--description "Optional subtitle or lead"] \
 *     [--provider flux|ideogram]  # default: ideogram if key set, else flux
 *     [--dry-run]                 # print prompt, skip API calls
 *
 * Platform dimensions:
 *   linkedin  → 1200 × 630 (1.91:1 landscape)
 *   facebook  → 1080 × 1080 (1:1 square)
 *
 * Output URL is printed to stdout (last line). All other output goes to stderr.
 */

import '../config.mjs';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_ROOT = join(__dirname, '..', '..');
const STYLE_CONFIG_PATH = join(BLOG_ROOT, 'scripts', 'image-style-config.json');
const styleConfig = JSON.parse(readFileSync(STYLE_CONFIG_PATH, 'utf-8'));

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const platform  = getFlag('--platform');
const slug      = getFlag('--slug');
const dept      = getFlag('--department') ?? 'marketing';
const title     = getFlag('--title');
const desc      = getFlag('--description') ?? '';
const provider  = getFlag('--provider') ??
  (process.env.IDEOGRAM_API_KEY ? 'ideogram' : 'flux');

if (!platform || !slug || !title) {
  console.error('Usage: generate-social-image.mjs --platform linkedin|facebook --slug <slug> --department <dept> --title "<title>" [--description "<desc>"] [--provider flux|ideogram] [--dry-run]');
  process.exit(1);
}

if (!['linkedin', 'facebook'].includes(platform)) {
  console.error(`Unknown platform: ${platform}. Supported: linkedin, facebook`);
  process.exit(1);
}

// ── Platform config ───────────────────────────────────────────────────────────

const PLATFORM_CONFIG = {
  linkedin: {
    width: 1200,
    height: 630,
    layoutHint: 'Landscape widescreen composition. Bold element positioned at left third, generous negative space on right side for potential text overlay.',
    ideogramRatio: 'ASPECT_16_9',
  },
  facebook: {
    width: 1080,
    height: 1080,
    layoutHint: 'Square 1:1 composition. Single dominant element centered. Ultra-bold, maximum impact within a square frame.',
    ideogramRatio: 'ASPECT_1_1',
  },
};

const pc = PLATFORM_CONFIG[platform];

// ── Prompt building ───────────────────────────────────────────────────────────

function buildSocialPrompt() {
  const deptCfg = styleConfig.departments[dept] || styleConfig.departments.marketing;
  const accent = deptCfg.accent;

  // Social prompt is intentionally different from blog hero:
  // - Bold, high-contrast, single dominant element
  // - "Stop the scroll" energy, not atmospheric decoration
  // - Red or teal as DOMINANT color, not just accent
  const parts = [
    'Bold graphic composition for social media feed.',
    'Single dominant visual element, ultra high contrast.',
    `Deep navy background (#0B1222).`,
    pc.layoutHint,
    `Dominant brand color: ${accent}. Use it as the PRIMARY color, not just an accent.`,
    `Topic: ${title}.`,
    desc ? `Context: ${desc.slice(0, 100)}.` : '',
    `Visual style hint: ${deptCfg.promptHint}`,
    'Stop-the-scroll energy. Bold, not atmospheric. Modern brand design aesthetic.',
    'No text, no words, no letters, no logos, no watermarks.',
    'Abstract but BOLD — confident shapes, strong composition, not vague or decorative.',
  ];

  return parts.filter(Boolean).join(' ');
}

// ── Flux via Replicate ────────────────────────────────────────────────────────

async function generateWithFlux(prompt) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN not set');

  const Replicate = (await import('replicate')).default;
  const replicate = new Replicate({ auth: token });

  const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
    input: {
      prompt,
      width: pc.width,
      height: pc.height,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      output_format: 'webp',
      output_quality: 85,
    },
  });

  // Handle various output shapes Replicate uses
  let url;
  if (typeof output === 'string' && output.startsWith('http')) url = output;
  else if (output && typeof output.url === 'function') url = output.url();
  else url = String(output);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download Flux output: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Ideogram v2 ───────────────────────────────────────────────────────────────

async function generateWithIdeogram(prompt) {
  const key = process.env.IDEOGRAM_API_KEY;
  if (!key) throw new Error('IDEOGRAM_API_KEY not set');

  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_request: {
        prompt,
        aspect_ratio: pc.ideogramRatio,
        model: 'V_2',
        magic_prompt_option: 'OFF', // use our prompt as-is
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ideogram API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL in Ideogram response');

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download Ideogram image: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

// ── Upload to Postiz CDN ──────────────────────────────────────────────────────

function uploadToPostiz(filePath) {
  // Uses postiz.mjs upload-file which calls the Postiz CLI
  const result = execSync(
    `node "${join(__dirname, 'postiz.mjs')}" upload-file "${filePath}" --json`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let data;
  try { data = JSON.parse(result); } catch { data = {}; }

  // Postiz CLI returns { path: '...', url: '...' } or just prints the URL
  const url = data?.url || data?.path || result.trim();
  if (!url || !url.startsWith('http')) {
    throw new Error(`Unexpected upload response: ${result.trim()}`);
  }
  return url;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const prompt = buildSocialPrompt();

  console.error(`\nSuperdots Social Image Generator`);
  console.error(`Platform: ${platform} (${pc.width}×${pc.height})`);
  console.error(`Provider: ${provider}`);
  console.error(`Slug: ${slug}`);
  console.error(`\nPrompt:\n${prompt}\n`);

  if (DRY_RUN) {
    console.error('[DRY RUN] Skipping API call and upload.');
    console.log('https://dry-run.example/social-image.webp'); // stdout placeholder
    return;
  }

  // Generate
  console.error(`Generating image with ${provider}...`);
  let buffer;
  if (provider === 'ideogram') {
    buffer = await generateWithIdeogram(prompt);
  } else {
    buffer = await generateWithFlux(prompt);
  }
  console.error(`Generated: ${(buffer.length / 1024).toFixed(0)} KB`);

  // Optimize with sharp if available
  try {
    const sharp = (await import('sharp')).default;
    buffer = await sharp(buffer)
      .resize(pc.width, pc.height, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();
    console.error(`Optimized: ${(buffer.length / 1024).toFixed(0)} KB`);
  } catch {
    console.error('sharp not available, using raw output');
  }

  // Save to temp file
  const tmpPath = join(tmpdir(), `social-${slug}-${platform}-${Date.now()}.webp`);
  writeFileSync(tmpPath, buffer);
  console.error(`Saved temp: ${tmpPath}`);

  // Upload to Postiz CDN
  console.error('Uploading to Postiz CDN...');
  let cdnUrl;
  try {
    cdnUrl = uploadToPostiz(tmpPath);
  } finally {
    try { unlinkSync(tmpPath); } catch {}
  }

  console.error(`CDN URL: ${cdnUrl}`);
  console.error('\nDone. Pass this URL to social-draft.mjs --image-url');

  // Print URL to stdout (agents capture this)
  console.log(cdnUrl);
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
