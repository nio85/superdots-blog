#!/usr/bin/env node
/**
 * generate-social-video.mjs — Generate short social video via image-to-video AI.
 *
 * Pipeline: brand image (existing or generated) → image-to-video AI → MP4 → Postiz CDN.
 * Ensures brand consistency by starting from a Superdots-branded static image.
 *
 * Uses Replicate API (same auth as Flux image generation).
 * Default model: kling-video/v1.6-standard (image-to-video).
 *
 * Usage:
 *   node scripts/tools/generate-social-video.mjs \
 *     --slug <slug> \
 *     --department <dept> \
 *     --title "<title>" \
 *     [--source-image <path-or-url>]   # Use existing image as first frame
 *     [--duration 5|10]                 # Duration in seconds (default: 5)
 *     [--motion zoom-in|pan-left|ambient|particle]  # Motion type hint
 *     [--platform linkedin|facebook]    # Determines aspect ratio (default: linkedin)
 *     [--dry-run]
 *
 * If --source-image is not provided, generates a new image via generate-social-image.mjs first.
 *
 * Output: Postiz CDN URL for the video to stdout.
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
const TMP_DIR = join(tmpdir(), 'superdots-video');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

// Sanitize slug for safe file paths
function sanitizeSlug(s) { return s.replace(/[^a-zA-Z0-9_-]/g, '_'); }

const slug = getFlag('--slug');
const department = getFlag('--department') || 'marketing';
const title = getFlag('--title');
const sourceImage = getFlag('--source-image');
const duration = parseInt(getFlag('--duration') || '5');
const motion = getFlag('--motion') || 'ambient';
const platform = getFlag('--platform') || 'linkedin';

if (!slug || !title) {
  console.error('Usage: generate-social-video.mjs --slug <slug> --title "<title>" --department <dept> [--source-image <url>] [--duration 5|10] [--motion zoom-in|pan-left|ambient|particle] [--platform linkedin|facebook] [--dry-run]');
  process.exit(1);
}

const safeSlug = sanitizeSlug(slug);

const MOTION_PROMPTS = {
  'zoom-in': 'Slow cinematic zoom-in revealing layered geometric details, warm red glow intensifying as camera moves in, subtle dot-grid pattern becoming visible in the background',
  'pan-left': 'Smooth horizontal pan from right to left, elegant reveal of bold geometric shapes, warm ambient glow shifting across deep navy backdrop, dot-grid texture drifting with parallax',
  'ambient': 'Subtle ambient movement, gentle floating geometric particles drifting over dot-grid texture, warm radial glow pulsing softly from bottom-left, atmospheric and sophisticated',
  'particle': 'Dynamic dot particles emerging from the focal point in ascending pattern, red and amber accent glows radiating outward, energetic motion against deep navy, brand mark energy',
};

const ASPECT_RATIO = platform === 'facebook' ? '1:1' : '16:9';

// Video generation timeout: 5 minutes max (Kling can take 1-3 min)
const VIDEO_TIMEOUT_MS = 5 * 60 * 1000;

// ── Main pipeline ──────────────────────────────────────────────────────────

async function main() {
  mkdirSync(TMP_DIR, { recursive: true });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token && !DRY_RUN) {
    console.error('Error: REPLICATE_API_TOKEN not set');
    process.exit(1);
  }

  // Step 1: Get or generate source image
  let imageUrl = sourceImage;

  if (!imageUrl) {
    console.error('[VIDEO] No source image provided, generating one...');
    try {
      // Use execFile — no shell interpolation of user-controlled values
      const { stdout: output } = await execFileAsync(
        'node',
        [join(__dirname, 'generate-social-image.mjs'), '--platform', platform, '--slug', slug, '--department', department, '--title', title],
        { encoding: 'utf-8', timeout: 120000 }
      );
      // First line is the CDN URL
      imageUrl = output.trim().split('\n')[0];
      console.error(`[VIDEO] Generated source image: ${imageUrl}`);
    } catch (e) {
      console.error(`[ERROR] Failed to generate source image: ${e.message}`);
      process.exit(1);
    }
  }

  const motionPrompt = MOTION_PROMPTS[motion] || MOTION_PROMPTS.ambient;
  const prompt = `${motionPrompt}. Bold abstract composition on deep navy background (#0B1222). Warm geometric shapes with layered depth. Dot-grid texture overlay. Soft warm red glow from bottom-left. Professional, modern, confident brand identity. No text, no letters, no logos.`;

  console.error(`[VIDEO] Source: ${imageUrl}`);
  console.error(`[VIDEO] Motion: ${motion} (${duration}s)`);
  console.error(`[VIDEO] Prompt: ${prompt}`);

  if (DRY_RUN) {
    console.error('[DRY RUN] Skipping video generation and upload.');
    process.exit(0);
  }

  // Step 2: Generate video via Replicate image-to-video (with timeout)
  const Replicate = (await import('replicate')).default;
  const replicate = new Replicate({ auth: token });

  console.error('[VIDEO] Generating video via Replicate (this may take 1-3 minutes)...');

  const videoPath = join(TMP_DIR, `${safeSlug}-video.mp4`);

  try {
    let videoUrl;
    try {
      // Try Kling first (best for image-to-video with brand consistency)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), VIDEO_TIMEOUT_MS);

      const output = await replicate.run('kwaivgi/kling-v1-6-standard', {
        input: {
          prompt,
          image: imageUrl,
          duration: String(duration),
          aspect_ratio: ASPECT_RATIO,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (typeof output === 'string' && output.startsWith('http')) {
        videoUrl = output;
      } else if (output && typeof output.url === 'function') {
        videoUrl = output.url();
      } else if (Array.isArray(output) && output[0]) {
        videoUrl = typeof output[0] === 'string' ? output[0] : output[0].url?.() || String(output[0]);
      } else {
        videoUrl = String(output);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        console.error(`[ERROR] Kling timed out after ${VIDEO_TIMEOUT_MS / 1000}s`);
      } else {
        console.error(`[WARN] Kling failed: ${e.message}. Trying Stable Video Diffusion...`);
      }

      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), VIDEO_TIMEOUT_MS);

        const output = await replicate.run('stability-ai/stable-video-diffusion', {
          input: {
            input_image: imageUrl,
            motion_bucket_id: motion === 'ambient' ? 80 : 127,
            fps: 24,
            num_frames: duration * 24,
          },
          signal: controller2.signal,
        });
        clearTimeout(timeoutId2);

        videoUrl = typeof output === 'string' ? output : String(output);
      } catch (e2) {
        console.error(`[ERROR] All video models failed: ${e2.message}`);
        process.exit(1);
      }
    }

    console.error(`[VIDEO] Generated video: ${videoUrl}`);

    // Step 3: Download video
    const res = await fetch(videoUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      console.error(`[ERROR] Failed to download video: ${res.status}`);
      process.exit(1);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(videoPath, buffer);
    console.error(`[VIDEO] Downloaded: ${videoPath} (${Math.round(buffer.length / 1024)}KB)`);

    // Step 4: Upload to Postiz CDN (using execFile — no shell)
    try {
      const { stdout: uploadResult } = await execFileAsync(
        'node',
        [join(__dirname, 'postiz.mjs'), 'upload-file', videoPath, '--json'],
        { encoding: 'utf-8', timeout: 30000 }
      );
      const parsed = JSON.parse(uploadResult.trim());
      const cdnUrl = parsed.path || parsed.url || '';
      if (!cdnUrl) throw new Error('No URL in upload response');

      console.log(cdnUrl);
      console.error(`[VIDEO] Uploaded to CDN: ${cdnUrl}`);
    } catch (e) {
      console.error(`[ERROR] Failed to upload video: ${e.message}`);
      process.exit(1);
    }
  } finally {
    // Always clean up temp files
    try { unlinkSync(videoPath); } catch {}
  }
}

main().catch(e => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
