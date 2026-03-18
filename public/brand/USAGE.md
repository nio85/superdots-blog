# Superdots Brand Mark — Usage Guidelines

## The Logo

The Superdots logo consists of two elements:
1. **The Dot Mark** — a single, solid circle in brand red (#E8363B). Clean, flat, bold. Represents precision and focus — the singular "dot" in Superdots.
2. **The Wordmark** — "superdots" set in Space Grotesk Bold, lowercase, with tight letter-spacing (-0.02em).

## Logo Variants

| File | Use case |
|------|----------|
| `superdots-logo.svg` | Primary — dark text on light backgrounds |
| `superdots-logo-white.svg` | Reversed — white text on dark/navy backgrounds |
| `superdots-icon.svg` | Icon only — brand red, for favicons, social avatars, small spaces |
| `superdots-icon-navy.svg` | Icon only — navy monochrome, for light backgrounds where color isn't appropriate |
| `superdots-icon-white.svg` | Icon only — white monochrome, for dark backgrounds |

## Color

### Brand Colors

- **Primary Red**: `#E8363B` — the mark color
- **Navy**: `#0B1222` — wordmark, dark backgrounds
- **White**: `#FFFFFF` — reversed wordmark, white monochrome mark

No gradients. The mark is always a single flat color.

## Mark Geometry

- **ViewBox**: 64×64
- **Circle**: center (32, 32), radius 24
- Centered, symmetrical

## Clear Space

Maintain clear space equal to 12px (at default 64px height) around all sides of the logo. No other elements should intrude into this zone.

```
┌─────────────────────────────┐
│         clear space         │
│   ┌─────────────────────┐   │
│   │    ●  superdots      │   │
│   └─────────────────────┘   │
│         clear space         │
└─────────────────────────────┘
```

## Minimum Sizes

| Variant | Minimum width | Minimum height |
|---------|--------------|----------------|
| Full logo (icon + wordmark) | 140px | 32px |
| Icon mark only | 24px | 24px |
| Favicon | 16px | 16px |

Below these sizes, use the icon mark only — never the full logo.

## Don'ts

- Don't rotate the logo or icon mark
- Don't add drop shadows, outlines, gradients, or effects
- Don't change the circle proportions or size
- Don't use the wordmark without the icon mark (use icon-only or full logo)
- Don't place the logo on busy backgrounds without sufficient contrast
- Don't stretch or distort the logo
- Don't recolor outside the brand palette
- Don't add multiple circles or overlapping shapes

## The Superdot Element

In the design system, a single red dot (`.superdot` class, 8-10px) is used as a recurring brand accent throughout the UI — in navigation, section dividers, badges, and decorative elements. This single dot is a direct derivative of the mark.

## File Formats

- **SVG** — primary format for web, print, and all digital use
- **PNG** — generated as needed for contexts that don't support SVG (social media, email)

Recommended PNG export sizes: 32px, 64px, 128px, 256px, 512px, 1024px.
