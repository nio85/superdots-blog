---
name: image-prompts
description: >
  AI image prompt engineering for BFL Flux models (Flux 1.1 Pro via Replicate, Flux 2 via BFL API)
  and Ideogram v2. Covers prompt formula, model selection, hex color precision, no-negative-prompt
  patterns, JSON structured prompting, brand DNA integration. Adapted for Superdots brand.
---

# Image Prompts — AI Image Generation Creative Director

## Core Principle

Act as a **Creative Director** that constructs optimized prompts for image generation.
Never pass raw text directly to the image generation script. Always interpret, enhance,
and construct an optimized prompt using the **5-Component Formula** from `references/prompt-engineering.md`.

## Superdots Brand Constraints (MANDATORY)

These constraints override any domain mode defaults:

- **Color palette**: warm tones (reds, ambers, teals) on deep navy backgrounds
- **Style**: abstract geometric — NOT photorealistic, NOT stock photo
- **Banned subjects**: robots, AI clichés, generic tech imagery
- **Allowed domain modes**: Editorial, Abstract, UI/Web ONLY
- **Image generation**: use `scripts/generate-ai-images.mjs --slug <slug>` for hero images
- **Social images**: use `scripts/tools/generate-social-image.mjs --platform [linkedin|facebook]`
- **Image differentiation**: when generating multiple images in a batch, each MUST have visually distinct composition (vary perspective, color emphasis, subject)

## The 5-Component Prompt Formula

Before constructing ANY prompt, read `references/prompt-engineering.md` for full details.

### Quick Reference

1. **SUBJECT** — Who/what is the primary focus. Be specific: physical characteristics, material, texture. Never "a person" or "an abstract shape."
2. **ACTION** — What the subject is doing or its visual state. Use strong present-tense verbs.
3. **LOCATION/CONTEXT** — Where the scene takes place. Environmental details, atmosphere.
4. **COMPOSITION** — Camera perspective, framing, spatial relationships. "tight close-up", "bird's-eye view", "medium shot centered."
5. **STYLE** — Visual register, aesthetic, lighting. Reference real cameras, art movements, publications.

### Critical Prompt Rules

- Name real cameras for photorealistic looks: "Sony A7R IV", "Canon EOS R5"
- Include micro-details: textures, reflections, material qualities
- Use prestigious context anchors for quality: "National Geographic cover", "Kinfolk editorial"
- **NEVER** use: "8K", "masterpiece", "ultra-realistic", "high resolution"
- **NEVER** describe the concept — describe the SCENE
- For critical constraints use ALL CAPS: "MUST contain exactly three elements"
- Write as natural narrative paragraphs, NOT comma-separated keyword lists

## Domain Modes (Superdots-approved only)

### Editorial Mode
- Publication refs: Kinfolk, Monocle, Wired, MIT Technology Review
- Styling: clean, minimal, warm tones, geometric elements
- Composition: intentional whitespace, rule of thirds, strong focal point

### Abstract Mode
- Forms: geometric patterns, flowing gradients, data-inspired shapes
- Colors: Superdots palette (amber #F59E0B, teal #14B8A6, navy #0F172A, red #EF4444)
- Techniques: overlapping shapes, depth layers, motion blur, light trails

### UI/Web Mode
- Styles: flat vector, isometric 3D, line art, glassmorphism
- Backgrounds: deep navy or transparent
- Sizing: design at 2x for retina

## Aspect Ratios

| Use Case | Ratio | Dimensions |
|----------|-------|------------|
| Blog hero image | 16:9 | 1920×1080 |
| LinkedIn landscape | 1.91:1 | 1200×630 |
| Facebook square | 1:1 | 1080×1080 |
| Story/Reel | 9:16 | 1080×1920 |
| Instagram portrait | 4:5 | 1080×1350 |
| Pinterest pin | 2:3 | 1000×1500 |

## Prompt Templates

### Abstract/Geometric (primary for Superdots)
```
A [geometric composition] of [abstract elements with specific shapes/forms],
featuring [color palette from Superdots brand] with [texture/material quality].
[Depth and layering description]. [Lighting: warm directional light creating
shadows and depth]. [Mood: sophisticated, modern, tech-forward without clichés].
```

### Editorial/Conceptual
```
A [editorial-style composition] showing [conceptual subject related to article topic],
[arrangement and spatial relationship]. [Warm tones: amber highlights, teal accents
on deep navy]. [Lighting setup]. In the style of [publication reference].
```

## Post-Processing

After generation, if needed:
```bash
# Crop to exact dimensions
magick input.png -resize 1200x630^ -gravity center -extent 1200x630 output.png

# Convert format
magick input.png output.webp

# Resize for specific platform
magick input.png -resize 1080x1080 instagram.png
```

## Reference Documentation

Load on-demand — do NOT load all at startup:
- `references/prompt-engineering.md` — Domain mode details, modifier libraries, advanced techniques
- `references/post-processing.md` — ImageMagick pipeline recipes

## Quality Checklist

Before submitting any generated image:
- [ ] No text artifacts or garbled characters
- [ ] Specific to the article topic (not generic)
- [ ] Matches Superdots brand (warm tones, abstract/geometric, no robots)
- [ ] Correct aspect ratio for intended platform
- [ ] Visually distinct from other images in the same batch

---

## Flux Model Mastery (BFL)

### Critical Flux Rules

1. **NO negative prompts** — Flux does not support them. Describe what you WANT, not what to avoid. See "Positive Alternatives" below.
2. **Prose over keywords** — Write descriptive narrative paragraphs. `"woman, portrait, beautiful, 8k"` produces worse results than a flowing description.
3. **Lighting is king** — Lighting has the single biggest impact on output quality. Always specify it.
4. **Word order matters** — Flux prioritizes elements that appear earlier in the prompt. Front-load the most important subject.
5. **Hex colors work** — Use `#RRGGBB (color name)` for precise brand color matching. Always pair hex with a human-readable name.
6. **Optimal length** — 30-80 words. Too short = generic. Too long = unfocused.

### Prompt Structure Formula

```
[Subject] + [Action/Pose] + [Style/Medium] + [Context/Setting] + [Lighting] + [Camera/Technical]
```

Example for Superdots:
```
Bold geometric composition of overlapping angular planes in #E8363B (brand red)
and #F59E0B (warm amber), arranged with confident layered depth on deep navy
background #0B1222. Subtle dot-grid texture visible in darker areas. Warm
radial glow from bottom-left edge. Flat design with generous negative space.
Centered focal point filling 60% of frame. No text, no letters.
```

### Model Selection

We use Flux 1.1 Pro via Replicate (default). For future BFL API direct access:

| Model | Best for | Speed | Cost |
|---|---|---|---|
| Flux 1.1 Pro | Production social images (our default) | Medium | $0.04/img |
| FLUX.2 [klein] 4B | Fast drafts, previews, iteration | Fastest | $0.014/img |
| FLUX.2 [pro] | Production balanced (upgrade path) | Medium | $0.03/MP |
| FLUX.2 [max] | Maximum quality, complex compositions | Slowest | $0.07/MP |
| FLUX.2 [flex] | Typography rendering (text-on-image) | Medium | $0.05/MP |

**Current setup**: `REPLICATE_API_TOKEN` → Flux 1.1 Pro. If `BFL_API_KEY` is set, consider using FLUX.2 [pro] or [max] for better results.

### Flux Parameters (via Replicate)

| Parameter | Default | Range | Effect |
|---|---|---|---|
| `guidance_scale` | 3.5 | 1.5-5.0 | Prompt adherence. **2.0-3.0**: more creative/atmospheric. **3.5-4.0**: balanced (our default). **4.5-5.0**: strict literal interpretation. |
| `num_inference_steps` | 28 | 20-50 | Quality vs speed. **20-25**: fast drafts. **28**: production default. **35-50**: maximum detail (diminishing returns past 35). |
| `output_format` | webp | webp/png/jpg | Always `webp` for social (best quality/size). Use `png` only for transparency needs. |
| `output_quality` | 85 | 1-100 | WebP quality. **85**: our standard (good balance). **95**: when fine detail matters. |
| `seed` | random | 0-2^32 | Reproducibility. Set a seed to regenerate the same image. Useful for A/B variants — keep seed, change one prompt element. |

### Hex Color Precision

Flux accurately renders hex colors. Always pair with a descriptive name:

```
Good: dominant accent in #E8363B (brand red), background #0B1222 (deep navy)
Bad:  #E8363B background #0B1222
```

For Superdots brand palette:
```
#0B1222 (deep navy) — background, always
#E8363B (brand red) — primary accent for marketing, legal, design, strategy
#14B8A6 (teal) — primary accent for engineering, operations, hr, technology; also used for secondary UI elements (badges, links) across all departments
#F59E0B (warm amber) — primary accent for sales, finance, customer-support
```

Limit to 3-5 colors per prompt. Associate each color with a specific object or area. The department accent color from `image-style-config.json` is the authoritative source — always check it.

### Positive Alternatives (No-Negative-Prompt Patterns)

| Instead of | Use |
|---|---|
| "no text, no letters" | "clean unmarked surfaces, text-free composition" |
| "no people" | "empty, solitary, deserted" |
| "not photorealistic" | "abstract geometric illustration, flat design" |
| "no blue" | "warm tones: red, amber on deep navy" |
| "not cluttered" | "minimal, generous negative space, clean composition" |
| "no robots" | "abstract shapes, human-centered geometric forms" |

### JSON Structured Prompting (Advanced)

For complex compositions, use JSON to plan then flatten to prose:

```json
{
  "scene": {
    "setting": "abstract brand composition",
    "mood": "confident, bold, modern"
  },
  "subjects": [{
    "type": "geometric",
    "description": "overlapping angular planes with layered depth",
    "position": "center, filling 60% of frame"
  }],
  "colors": {
    "primary": "#E8363B (brand red)",
    "background": "#0B1222 (deep navy)",
    "accent": "#F59E0B (warm amber)"
  },
  "technical": {
    "texture": "subtle dot-grid pattern in background",
    "lighting": "warm radial glow from bottom-left",
    "composition": "centered, generous negative space"
  }
}
```

Flatten to natural language before sending to the model.

### Superdots Brand DNA in Every Prompt

Every generated image MUST include these brand signatures in the prompt:

1. **Deep navy background** `#0B1222` — never pure black, never gray, never blue
2. **Dot-grid texture** — subtle radial dot pattern (1.5px dots, 18px spacing) visible in background. Use: "subtle dot-grid texture overlay"
3. **Warm red glow** — soft radial gradient from bottom-left, brand red at 12% opacity. Use: "warm radial glow from bottom-left edge"
4. **Bold geometric shapes** — confident, layered, with clear depth hierarchy
5. **Generous negative space** — compositions breathe, not cluttered. Use: "minimal, generous negative space"
6. **Department accent as PRIMARY color** — not a subtle hint, the dominant visual element
7. **No text, letters, logos** — ever. If text artifacts appear, regenerate immediately. Use: "clean unmarked surfaces, text-free composition"
