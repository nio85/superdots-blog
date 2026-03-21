# Superdots Presentations (Slidev)

Premium dark-mode presentation system built on [Slidev](https://sli.dev/) with a custom Superdots brand theme (v3).

All slides feature a red top accent line, Superdots icon watermark, gradient glows, and consistent Space Grotesk / Inter / JetBrains Mono typography.

## Quick Start

```bash
# Dev server with live reload
pnpm slidev:dev

# Export to PDF
pnpm slidev:export

# Export to PPTX
pnpm slidev:export-pptx

# Build static SPA
pnpm slidev:build
```

## Creating a New Deck

1. Create a new `.md` file in `slidev/decks/`:

```markdown
---
theme: ../../slidev/theme
title: Your Presentation Title
transition: fade
mdc: true
---

# Your Title

Subtitle text here.

::subtitle::

Extended description.

---
layout: default
---

# Content Slide

Your content here.
```

2. Run it:

```bash
npx slidev slidev/decks/your-deck.md
```

**Important**: Do NOT use `--theme` on the CLI. The theme path in the frontmatter (`theme: ../../slidev/theme`) resolves correctly relative to the deck file. The CLI flag resolves relative to the entry file and will break.

## Available Layouts

| Layout | Usage | Description |
|--------|-------|-------------|
| `cover` | default first slide | Hero glow bg, large left-aligned title, subtitle slot |
| `section` | `layout: section` | Red dot accent, centered section title with glow |
| `default` | `layout: default` | Clean navy bg, heading + content |
| `statement` | `layout: statement` | Single bold centered statement |
| `image-right` | `layout: image-right` | Text left, image right |
| `image` | `layout: image` | Full-bleed image with overlay |
| `two-cols` | `layout: two-cols` | Split columns with divider, `::right::` slot |
| `quote` | `layout: quote` | Red accent bar, large quote, author/role attrs |
| `data` | `layout: data` | Metric-heavy slides with .sd-metric cards |
| `table` | `layout: table` | Styled tables with red header accent |
| `brand` | `layout: brand` | Logo showcase and brand guidelines |
| `end` | `layout: end` | Hero glow, centered CTA |

## Data Metrics

Use `.sd-metric` class for large stat displays on any layout:

```html
<div class="grid grid-cols-3 gap-8 mt-8">
  <div class="sd-metric accent">
    <div class="value">73%</div>
    <div class="label">Description</div>
    <div class="sublabel">Context</div>
  </div>
</div>
```

- `.sd-metric` — white values by default
- `.sd-metric.accent` — red values for emphasis

## Tables

Standard markdown tables are styled automatically with red header underline and clean rows.

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Red | `#E8363B` | Primary brand, metric accent values |
| Navy Deep | `#0B1222` | All slide backgrounds |
| Teal | `#14B8A6` | Links, accents |
| Light | `#F1F5F9` | Headings (h3) |
| Slate | `#94A3B8` | Body text, labels |
| Slate Dark | `#64748B` | Muted text, sublabels |

## Typography

- **Headlines**: Space Grotesk Bold
- **Body**: Inter Regular/Medium
- **Code**: JetBrains Mono

## Exporting

```bash
# PDF
pnpm slidev:export

# PPTX
pnpm slidev:export-pptx

# Custom deck
npx slidev export slidev/decks/your-deck.md --output your-deck.pdf
npx slidev export slidev/decks/your-deck.md --format pptx --output your-deck.pptx
```

Requires `playwright-chromium` (installed as dev dependency).
