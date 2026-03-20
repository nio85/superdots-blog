# Superdots Brand Mark — Usage Guidelines

## The Logo

The Superdots logo consists of two elements:
1. **The Dot Mark** — three ascending red dots (#E8363B) arranged in a diagonal, from bottom-left to top-right. Each dot increases in size, representing growth and upward momentum. Clean, flat, bold.
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

No gradients. Each dot is always a single flat color.

## Mark Geometry

- **ViewBox**: 64×64
- **Three circles on a diagonal** (bottom-left to top-right):
  - Small dot: center (14, 50), radius 6
  - Medium dot: center (32, 32), radius 8
  - Large dot: center (50, 14), radius 10
- The dots ascend from bottom-left to top-right, increasing in size

### Favicon

- **ViewBox**: 32×32
- Navy rounded rectangle background (rx=6)
- Three dots scaled to half size: (7, 25) r=3, (16, 16) r=4, (25, 7) r=5

## Clear Space

Maintain clear space equal to 12px (at default 64px height) around all sides of the logo. No other elements should intrude into this zone.

```
┌─────────────────────────────┐
│         clear space         │
│   ┌─────────────────────┐   │
│   │  ∴   superdots       │   │
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
- Don't change the dot proportions, positions, or relative sizes
- Don't use the wordmark without the icon mark (use icon-only or full logo)
- Don't place the logo on busy backgrounds without sufficient contrast
- Don't stretch or distort the logo
- Don't recolor outside the brand palette
- Don't reduce the three dots to a single circle
- Don't rearrange the dot order (smallest is always bottom-left, largest top-right)

## The Superdot Element

In the design system, a single red dot (`.superdot` class, 8-10px) is used as a recurring brand accent throughout the UI — in navigation, section dividers, badges, and decorative elements. This single dot is a simplified derivative of the mark.

## File Formats

- **SVG** — primary format for web, print, and all digital use
- **PNG** — generated as needed for contexts that don't support SVG (social media, email)

Recommended PNG export sizes: 32px, 64px, 128px, 256px, 512px, 1024px.
