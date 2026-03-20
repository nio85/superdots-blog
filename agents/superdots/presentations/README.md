# Superdots Presentations

Slidev-powered presentation toolkit with a custom brand theme.

## Quick start

```bash
cd presentations
npm install
npm run dev        # Open dev server with hot reload
```

## Creating a new deck

1. Copy `slides.md` (or create a new `.md` file)
2. Set the theme in frontmatter:

```yaml
---
theme: ./theme
title: Your Deck Title
---
```

3. Run with: `npx slidev your-deck.md`

## Available layouts

| Layout | Frontmatter | Description |
|--------|-------------|-------------|
| `cover` | First slide default | Title slide — dark navy, hero pattern, centered logo |
| `section` | `layout: section` | Section divider — dark navy, hero pattern |
| `default` | `layout: default` | Standard content — icon top-left, padded |
| `two-cols` | `layout: two-cols` | Two columns — use `::left::` and `::right::` slots |
| `image-right` | `layout: image-right` | Text left, image right — set `image:` in frontmatter |
| `image-left` | `layout: image-left` | Image left, text right — set `image:` in frontmatter |
| `full` | `layout: full` | Full-bleed — no padding, no logo |
| `fact` | `layout: fact` | Big number/stat — `# 42%` with supporting text |
| `quote` | `layout: quote` | Styled blockquote with attribution |
| `brand-assets` | `layout: brand-assets` | Logo, color, and icon reference |
| `end` | `layout: end` | Closing slide — dark navy, hero pattern, centered logo |

## Exporting

```bash
npm run export          # Export to PDF (requires playwright-chromium)
npm run export-png      # Export slides as PNG images
```

To export a specific deck:

```bash
npx slidev export your-deck.md
npx slidev export your-deck.md --format png
```

## Brand guidelines for images

- **Aspect ratio:** 16:9 or 4:3 recommended for `image-right` / `image-left` layouts
- **Style:** Clean, high-contrast photography. Avoid busy backgrounds.
- **Placement:** Images fill their container with `object-fit: cover`
- **Alt text:** Always provide alt text for accessibility

## Brand colors

| Color | Hex | Usage |
|-------|-----|-------|
| Red | `#E8363B` | Primary brand, accents, CTAs |
| Navy | `#0F172A` | Dark backgrounds, headings |
| Teal | `#14B8A6` | Secondary accent, hover states |
| Slate | `#64748B` | Body text, muted elements |

## Typography

- **Headings:** Montserrat (Bold/ExtraBold)
- **Body:** Inter (Regular/Medium/SemiBold)
- **Code:** JetBrains Mono

## Icons and logos

- **Logo:** Centered on cover/end slides, icon-only top-left on content slides
- **Icons:** Line style, consistent stroke weight
- **Sources:** [Lucide](https://lucide.dev), [Heroicons](https://heroicons.com)
- **Colors:** Brand red or dark navy only

## Theme structure

```
theme/
├── layouts/          # 11 Vue layout components
│   ├── cover.vue
│   ├── section.vue
│   ├── default.vue
│   ├── two-cols.vue
│   ├── image-right.vue
│   ├── image-left.vue
│   ├── full.vue
│   ├── fact.vue
│   ├── quote.vue
│   ├── brand-assets.vue
│   └── end.vue
├── styles/
│   ├── base.css      # Colors, typography, hero pattern, dot grid
│   ├── layouts.css   # Layout-specific styles
│   └── index.ts      # Style entry point
├── public/           # Brand logos and icons
└── package.json      # Theme metadata
```
