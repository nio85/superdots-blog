# Superdots Brand Mark — Usage Guidelines

## The Logo

The Superdots logo consists of two elements:
1. **The Convergence Mark** — two overlapping circles of different sizes, positioned diagonally. The larger circle (bottom-left) carries a navy-to-red gradient; the smaller circle (upper-right) carries a bright red gradient with slight transparency. The overlap creates visual depth and sophistication. Represents convergence, focus, and the coming-together of AI and work.
2. **The Wordmark** — "superdots" set in Space Grotesk Bold, lowercase, with tight letter-spacing (-0.02em).

## Logo Variants

| File | Use case |
|------|----------|
| `superdots-logo.svg` | Primary — dark text on light backgrounds |
| `superdots-logo-white.svg` | Reversed — white text on dark/navy backgrounds (gradient mark preserved) |
| `superdots-icon.svg` | Icon only — gradient, for favicons, social avatars, small spaces |
| `superdots-icon-navy.svg` | Icon only — navy monochrome, for light backgrounds where color isn't appropriate |
| `superdots-icon-white.svg` | Icon only — white monochrome, for dark backgrounds |

## Color & Gradients

### Brand Colors

- **Primary Red**: `#E8363B` — core brand color
- **Bright Red**: `#F04048` — highlight/gradient accent
- **Deep Red**: `#C42D31` — gradient anchor
- **Navy**: `#0B1222` — wordmark, dark backgrounds, gradient anchor
- **Mid Navy**: `#1A2744` — gradient mid-tone
- **White**: `#FFFFFF` — reversed wordmark

### Gradient Specifications

**Large circle (bottom-left):** Linear gradient, bottom-left → top-right
- 0%: Navy `#0B1222`
- 40%: Mid Navy `#1A2744`
- 100%: Primary Red `#E8363B`

**Small circle (upper-right):** Linear gradient, top-right → bottom-left
- 0%: Bright Red `#F04048`
- 100%: Deep Red `#C42D31`
- Opacity: 88%

### Monochrome Fallbacks

When gradients cannot be used (e.g., single-color printing), use the navy or white monochrome variants. The smaller circle renders at 60% opacity to preserve the overlapping depth.

## Mark Geometry

- **ViewBox**: 64×64
- **Large circle**: center (22, 36), radius 20
- **Small circle**: center (42, 24), radius 16
- Circles overlap diagonally (bottom-left to upper-right)

## Clear Space

Maintain clear space equal to 12px (at default 64px height) around all sides of the logo. No other elements should intrude into this zone.

```
┌─────────────────────────────┐
│         clear space         │
│   ┌─────────────────────┐   │
│   │  ◉◌ superdots       │   │
│   │                     │   │
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
- Don't add drop shadows, outlines, or effects beyond the defined gradients
- Don't change the circle proportions, sizes, or overlap
- Don't use the wordmark without the icon mark (use icon-only or full logo)
- Don't place the logo on busy backgrounds without sufficient contrast
- Don't stretch or distort the logo
- Don't recolor the gradients outside the brand palette
- Don't separate the two circles (they must always overlap)

## The Superdot Element

In the design system, a single red dot (`.superdot` class, 8-10px) is used as a recurring brand accent throughout the UI — in navigation, section dividers, badges, and decorative elements. This single dot is a simplified derivative of the Convergence mark.

## Concept Alternatives

Four concepts were developed during the redesign (files in `concepts/` directory):

| Concept | Description | Files |
|---------|-------------|-------|
| **A: Eclipse** | Two offset circles with diagonal gradients | `concept-a-eclipse*.svg` |
| **B: Halo** | Single circle with radial gradient + open arc ring | `concept-b-halo*.svg` |
| **C: Convergence** ★ | Two overlapping gradient circles (selected) | `concept-c-convergence*.svg` |
| **D: Focus** | Single circle with sfumatura gradient + diagonal line | `concept-d-focus*.svg` |

Each concept includes default (gradient), white, and navy monochrome variants.

## File Formats

- **SVG** — primary format for web, print, and all digital use
- **PNG** — generated as needed for contexts that don't support SVG (social media, email)

Recommended PNG export sizes: 32px, 64px, 128px, 256px, 512px, 1024px.
