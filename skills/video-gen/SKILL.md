---
name: video-gen
description: >
  AI video generation for social media using Kling v1.6 (image-to-video) and Stable Video
  Diffusion (fallback). Motion types, artistic direction, brand-specific prompting,
  parameter mastery. Used by Frontend Designer for social video posts.
---

# Video Generation — Social Video Creative Director

## Core Principle

Generate short-form (5-10s) brand-consistent social videos by animating existing Superdots-branded
static images. The image-to-video pipeline ensures brand consistency: the first frame IS a Superdots
image, so the video inherits the brand DNA automatically.

## Pipeline

```
Brand image (existing or generated) → Image-to-video AI → MP4 → Postiz CDN
```

Script: `node scripts/tools/generate-social-video.mjs`

## When to Use

- Social post format is `video`
- Growth Analyst recommends video format for high-engagement topics
- Creating Stories/Reels content
- Animating existing carousel or hero images for repurposing

## Quick Start

```bash
cd /home/luca/superdots-blog

# Generate video from existing image
node scripts/tools/generate-social-video.mjs \
  --slug "<slug>" \
  --department "<dept>" \
  --title "<article title>" \
  --source-image "<cdn-url-of-existing-image>" \
  --motion ambient \
  --duration 5 \
  --platform linkedin

# Generate video with auto-generated first frame
node scripts/tools/generate-social-video.mjs \
  --slug "<slug>" \
  --department "<dept>" \
  --title "<article title>" \
  --motion zoom-in \
  --platform facebook
```

Output: Postiz CDN URL to stdout.

## Models

### Kling v1.6 Standard (Primary)

Model: `kwaivgi/kling-v1-6-standard` via Replicate

The primary model for all social video generation. Image-to-video with strong motion control.

| Parameter | Values | Effect |
|---|---|---|
| `prompt` | text (required) | Describes the MOTION, not the scene (the image defines the scene) |
| `image` | URL (required) | Source image — the first frame. Brand consistency starts here. |
| `duration` | `"5"` or `"10"` | **5s**: social feeds, loops well. **10s**: longer narratives. |
| `aspect_ratio` | `16:9`, `1:1`, `9:16` | **16:9** LinkedIn. **1:1** Facebook. **9:16** Stories/Reels. |

**Cost**: ~$0.30/video. **Time**: 1-3 minutes.

**Prompt strategy for Kling:**
- Focus on MOTION description, not scene description (the image already defines the scene)
- Be specific about direction: "slow zoom-in", "smooth pan left-to-right"
- Describe what MOVES vs what stays still
- Include brand texture references: "dot-grid pattern", "warm glow pulsing"
- Keep prompts under 50 words — Kling responds better to concise motion descriptions

### Stable Video Diffusion (Fallback)

Model: `stability-ai/stable-video-diffusion` via Replicate

Used when Kling fails (timeout, API error). Lower quality but reliable.

| Parameter | Values | Effect |
|---|---|---|
| `input_image` | URL (required) | Source image |
| `motion_bucket_id` | 1-255 | **40-80**: subtle ambient. **100-127**: moderate. **180+**: dramatic. |
| `fps` | 6-30 | Always **24** for cinematic feel. |
| `num_frames` | 14-150 | Calculate: `duration × fps`. |

**Cost**: ~$0.10/video. **Time**: 30-90 seconds.

## Motion Types

### `ambient` — Default, General Purpose
Best for: atmosphere, mood pieces, most social posts.
```
Subtle ambient movement, gentle floating geometric particles drifting over dot-grid
texture, warm radial glow pulsing softly from bottom-left, atmospheric and sophisticated
```
SVD `motion_bucket_id`: 60-80

### `zoom-in` — Data Reveals, Insight Moments
Best for: data articles, analysis pieces, reveal moments.
```
Slow cinematic zoom-in revealing layered geometric details, warm red glow intensifying
as camera moves in, subtle dot-grid pattern becoming visible in the background
```
SVD `motion_bucket_id`: 80-100

### `pan-left` — Process, Workflow, Sequences
Best for: how-to articles, step-by-step guides, process descriptions.
```
Smooth horizontal pan from right to left, elegant reveal of bold geometric shapes,
warm ambient glow shifting across deep navy backdrop, dot-grid texture drifting with parallax
```
SVD `motion_bucket_id`: 100-120

### `particle` — Launches, Announcements, Energy
Best for: new product announcements, high-energy topics, growth posts.
```
Dynamic dot particles emerging from the focal point in ascending pattern, red and
amber accent glows radiating outward, energetic motion against deep navy, brand mark energy
```
SVD `motion_bucket_id`: 120-150

## Department-Specific Direction

| Department | Accent | Recommended Motion | Mood |
|---|---|---|---|
| Marketing | #E8363B red | `particle` or `zoom-in` | Energetic, bold, upward momentum |
| Sales | #F59E0B amber | `ambient` or `pan-left` | Warm, trust-building, flowing |
| Engineering | #14B8A6 teal | `zoom-in` or `ambient` | Precise, structured, clean |
| HR | #14B8A6 teal | `ambient` | Connected, people-centered |
| Finance | #F59E0B amber | `pan-left` | Orderly, precise, flowing |
| Operations | #14B8A6 teal | `pan-left` | Systematic, interlocking, smooth |
| Legal | #E8363B red | `ambient` | Balanced, authoritative, calm |
| Design | #E8363B red | `zoom-in` | Creative, intentional, revealing |
| Customer Support | #F59E0B amber | `ambient` | Warm, responsive, radiating |
| Strategy | #E8363B red | `zoom-in` or `particle` | Visionary, decisive, high-level |
| Technology | #14B8A6 teal | `zoom-in` or `ambient` | Innovative, clean, capable |

## Brand DNA in Video Prompts

Every video prompt MUST reference these brand elements:

1. **Deep navy** — the background is always #0B1222 (inherited from source image)
2. **Dot-grid texture** — mention "dot-grid pattern" or "dot texture" in motion description
3. **Warm glow** — "warm red glow" or "warm radial glow" — never cold blue
4. **Bold shapes** — "geometric shapes", "layered planes", "confident composition"
5. **No text** — "no text, no letters, no logos" (prevent text artifacts in video)

## Tips for Better Results

### Source Image Quality = 80% of Video Quality
Invest in getting the right first frame. If the static image is wrong, the video will be wrong.

### 5s > 10s for Social
5-second videos loop seamlessly on LinkedIn and Facebook feeds. 10s only when the motion
narrative needs the extra time.

### Budget for 1-2 Generations
Cost is ~$0.30/video. Generate once, review. If the motion is wrong, adjust the motion type
or prompt and regenerate once. Don't iterate more than twice — diminishing returns.

### Avoid Over-Describing
Kling works best with concise motion prompts. Don't describe the scene (the image does that).
Don't describe colors or composition. Focus purely on: what moves, how fast, in what direction.

### Fallback Strategy
If Kling times out (5-minute limit) or returns an error, the script automatically tries
Stable Video Diffusion. SVD produces shorter, lower-quality videos but is more reliable.
The agent should report which model was used in their comment.

## Timeout and Error Handling

- **Kling timeout**: 5 minutes max (configurable via `VIDEO_TIMEOUT_MS`)
- **SVD timeout**: 5 minutes max (same)
- **Download timeout**: 60 seconds for video download
- **Upload timeout**: 30 seconds for Postiz CDN upload
- If both models fail, report the error and suggest retrying later or using a static image instead
