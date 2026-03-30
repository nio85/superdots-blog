# Superdots Brand Guidelines

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary Red** | `#E8363B` | Brand mark, CTAs, accent elements, decorative dots |
| **Navy** | `#0B1222` | Dark backgrounds, body text on light backgrounds |
| **Black** | `#080E1A` | Deep backgrounds, high-contrast text |
| **White** | `#FFFFFF` | Text on dark backgrounds, reversed logo |
| **Teal** | `#14B8A6` | Links, interactive elements, guide-specific content only |

### Color Rules

- **Superdots is primarily red and black.** Red is the signature accent color across all brand touchpoints.
- **Green/teal is reserved for guides.** Do not use teal (`#14B8A6`) or any green tone in decorative elements like gradient lines, borders, or backgrounds — unless the context is specifically a guide or educational content.
- **Gradient lines** should use red-to-dark or red variations (e.g., `#E8363B` to `#8B1A1D`), never red-to-green.
- **The red dot** (`.superdot`) is the signature brand element. Use it at the end of key headlines and section titles.

## Typography

| Role | Font | Weight |
|------|------|--------|
| Headings | Space Grotesk | 600–700 |
| Body text | Inter | 400–500 |
| Wordmark | Space Grotesk Bold | 700 |

- Wordmark is always lowercase with tight letter-spacing (-0.02em).
- Safe fallback stack: `'Space Grotesk', Arial, sans-serif` / `'Inter', Arial, Helvetica, sans-serif`.

## Design Principles

1. **Dark-first** — The brand identity leans into dark mode. Navy and black backgrounds with white/light text.
2. **Bold simplicity** — Clean layouts, generous whitespace, no clutter.
3. **Red accents** — Use red sparingly but consistently as the accent color. The red dot at end of headlines is a signature element.
4. **No green in decorative elements** — Teal/green appears only in links and guide-specific contexts.
5. **Professional but with character** — Avoid generic/standard design patterns. Find creative, distinctive solutions.

## Logo Usage

See [USAGE.md](USAGE.md) for detailed logo specifications, geometry, and rules.

## Email / Newsletter Specifics

- Dark theme (navy body) to match website dark mode.
- Red accent elements only — no teal/green in gradients or borders.
- ESP compatibility is critical: all visual effects must degrade gracefully.
- Use Mautic tokens correctly: `{unsubscribe_url}` for URLs, `{unsubscribe_text}` for full HTML blocks.
