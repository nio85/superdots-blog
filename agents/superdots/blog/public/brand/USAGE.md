# Superdots Brand Mark — Usage Guidelines

## The Logo

The Superdots logo consists of two elements:
1. **The Dot Mark** — three ascending dots arranged diagonally (bottom-left to top-right), increasing in size. Represents progression, growth, and the "leveling up" that AI enables in work.
2. **The Wordmark** — "superdots" set in Space Grotesk Bold, lowercase, with tight letter-spacing (-0.02em).

## Logo Variants

| File | Use case |
|------|----------|
| `superdots-logo.svg` | Primary — dark text on light backgrounds |
| `superdots-logo-white.svg` | Reversed — light text on dark/navy backgrounds |
| `superdots-icon.svg` | Icon only — red, for favicons, social avatars, small spaces |
| `superdots-icon-navy.svg` | Icon only — navy, for light backgrounds where red isn't appropriate |
| `superdots-icon-white.svg` | Icon only — white, for dark backgrounds |

## Color

- **Primary Red**: `#E8363B` — the dot mark is always red in primary/reversed variants
- **Navy**: `#0B1222` — wordmark color on light backgrounds
- **White**: `#FFFFFF` — wordmark color on dark backgrounds

Never recolor the dots to a non-brand color. The red dots are the most recognizable element of the identity.

## Clear Space

Maintain clear space equal to the diameter of the smallest dot (12px at default 64px height) around all sides of the logo. No other elements should intrude into this zone.

```
┌─────────────────────────────┐
│         clear space         │
│   ┌─────────────────────┐   │
│   │  ·  superdots       │   │
│   │ ·                   │   │
│   │·                    │   │
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
- Don't add drop shadows, outlines, or effects
- Don't change the dot proportions or spacing
- Don't use the wordmark without the icon mark (use icon-only or full logo)
- Don't place the logo on busy backgrounds without sufficient contrast
- Don't stretch or distort the logo
- Don't rearrange the dots (the ascending diagonal is the canonical orientation)

## The Superdot Element

In the design system, a single red dot (`.superdot` class, 8-10px) is used as a recurring brand accent throughout the UI — in navigation, section dividers, badges, and decorative elements. This single dot is a simplified derivative of the full three-dot mark.

## File Formats

- **SVG** — primary format for web, print, and all digital use
- **PNG** — generated as needed for contexts that don't support SVG (social media, email)

Recommended PNG export sizes: 32px, 64px, 128px, 256px, 512px, 1024px.
