# Superdots — Brand Identity & Design System

## Brand Essence

**Superdots** helps non-technical employees use AI to work better. Our content is practical, direct, and human. We cut through hype to deliver techniques people can use today.

### Brand Personality

| Trait          | What it means                                          | What it's NOT                    |
|----------------|--------------------------------------------------------|----------------------------------|
| **Bold**       | We take clear positions. No hedging or "it depends."   | Aggressive, confrontational      |
| **Human**      | Warm, conversational, like a smart colleague helping    | Corporate, stiff, jargon-heavy   |
| **Trustworthy**| Accurate, cited, no exaggeration                       | Preachy, self-important          |
| **No-fluff**   | Every sentence earns its place                         | Terse, cold, robotic             |
| **Unexpected** | We surprise with insight, not gimmicks                 | Quirky for its own sake          |

---

## Visual Identity

### The Superdots Mark

Three ascending red dots in a diagonal — our signature mark. It appears:
- Next to the wordmark in navigation (header, footer, mobile menu)
- As the icon mark (favicon, small contexts below 140px)
- Represents progression, growth, and the leveling-up that AI enables at work

The single red dot (`.superdot`) is used as:
- A period accent on key headlines (`Work smarter.`)
- A visual separator and brand element throughout the site
- A single point of clarity — cutting through the noise to the thing that matters.

### Color Palette

#### Primary

| Token               | Hex       | Usage                                         |
|----------------------|-----------|-----------------------------------------------|
| `--sd-red`           | `#E8363B` | Primary actions, brand accents, the dot        |
| `--sd-red-dark`      | `#CC2D32` | Hover states for primary elements              |
| `--sd-red-light`     | `#FEE2E2` | Department badge backgrounds, light accents    |

#### Secondary

| Token               | Hex       | Usage                                         |
|----------------------|-----------|-----------------------------------------------|
| `--sd-teal`          | `#14B8A6` | Secondary actions, use-case badges, links      |
| `--sd-teal-dark`     | `#0D9488` | Hover states for secondary elements            |
| `--sd-teal-light`    | `#CCFBF1` | Use-case badge backgrounds                     |

#### Accent

| Token               | Hex       | Usage                                         |
|----------------------|-----------|-----------------------------------------------|
| `--sd-amber`         | `#F59E0B` | Highlights, warnings, callout accents          |
| `--sd-amber-light`   | `#FEF3C7` | Highlight backgrounds                          |

#### Neutrals

| Token               | Hex       | Usage                                         |
|----------------------|-----------|-----------------------------------------------|
| `--sd-navy`          | `#0B1222` | Headings, strong text, dark backgrounds        |
| `--sd-navy-light`    | `#1E293B` | Body text                                      |
| `--sd-gray-50`       | `#F8FAFC` | Subtle backgrounds                             |
| `--sd-gray-100`      | `#F1F5F9` | Code backgrounds, card backgrounds             |
| `--sd-gray-200`      | `#E2E8F0` | Borders                                        |
| `--sd-gray-300`      | `#CBD5E1` | Strong borders                                 |
| `--sd-gray-400`      | `#94A3B8` | Placeholder text                               |
| `--sd-gray-500`      | `#64748B` | Muted text, captions                           |
| `--sd-gray-600`      | `#475569` | Secondary text                                 |
| `--sd-gray-700`      | `#334155` | Dark mode text                                 |
| `--sd-gray-800`      | `#1E293B` | Dark mode surfaces                             |
| `--sd-gray-900`      | `#0F172A` | Dark mode backgrounds                          |

### Why Red + Teal?

Most AI content defaults to cold blue or purple palettes. We deliberately go warmer — red signals energy, directness, and humanity. Teal provides a cool counterbalance that still feels approachable rather than corporate. The unexpected pairing makes us instantly recognizable.

---

### Typography

#### Font Stack

| Role      | Font              | Fallback                                                  | Usage                     |
|-----------|-------------------|-----------------------------------------------------------|---------------------------|
| Display   | **Space Grotesk** | -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif | Headings, nav, buttons    |
| Body      | **Inter**         | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto     | Body text, paragraphs     |
| Code      | **JetBrains Mono**| 'Fira Code', 'Cascadia Code', monospace                   | Code blocks, inline code  |

#### Type Scale (Major Third — 1.25 ratio)

| Token        | Size     | Pixels | Usage              |
|--------------|----------|--------|--------------------|
| `--text-xs`  | 0.75rem  | 12px   | Badges, fine print |
| `--text-sm`  | 0.875rem | 14px   | Captions, nav      |
| `--text-base`| 1rem     | 16px   | Body (mobile)      |
| `--text-lg`  | 1.125rem | 18px   | Body (desktop)     |
| `--text-xl`  | 1.25rem  | 20px   | Card headings      |
| `--text-2xl` | 1.5rem   | 24px   | Section headings   |
| `--text-3xl` | 1.875rem | 30px   | Page headings      |
| `--text-4xl` | 2.25rem  | 36px   | Article titles     |
| `--text-5xl` | 3rem     | 48px   | Hero headings      |

#### Heading Style

- Font: Space Grotesk Bold
- Negative letter-spacing: `-0.02em` to `-0.03em`
- Line height: `1.2`
- Color: `--sd-navy` (near-black, warm)

#### Body Style

- Font: Inter Regular
- Size: 18px desktop, 16px mobile
- Line height: `1.6` (body), `1.75` (long-form prose)
- Color: `--sd-navy-light`

---

### Spacing System

4px base unit. Consistent spatial rhythm throughout.

| Token         | Value    | Pixels |
|---------------|----------|--------|
| `--space-1`   | 0.25rem  | 4px    |
| `--space-2`   | 0.5rem   | 8px    |
| `--space-3`   | 0.75rem  | 12px   |
| `--space-4`   | 1rem     | 16px   |
| `--space-5`   | 1.25rem  | 20px   |
| `--space-6`   | 1.5rem   | 24px   |
| `--space-8`   | 2rem     | 32px   |
| `--space-10`  | 2.5rem   | 40px   |
| `--space-12`  | 3rem     | 48px   |
| `--space-16`  | 4rem     | 64px   |
| `--space-20`  | 5rem     | 80px   |

---

### Layout Grid

| Breakpoint   | Max Width | Columns | Usage            |
|--------------|-----------|---------|------------------|
| Prose        | 720px     | 1       | Article content  |
| Content      | 960px     | 1-2     | Pages, cards     |
| Wide         | 1200px    | 2-3     | Showcase, hero   |

Content is horizontally centered with `var(--space-4)` (16px) side padding.

#### Responsive Breakpoints

| Name    | Width   | Behavior                           |
|---------|---------|------------------------------------|
| Mobile  | <480px  | Single column, smaller headings    |
| Tablet  | ≥640px  | Two-column post grids              |
| Desktop | ≥720px  | Full typography, wider spacing     |

---

### Component Patterns

#### Buttons

Three variants, two sizes:

- **Primary** (`.btn-primary`): Red background, white text. The main CTA.
- **Secondary** (`.btn-secondary`): Red border, red text. Converts to primary on hover.
- **Ghost** (`.btn-ghost`): Gray border, dark text. Low-emphasis actions.
- **Large** (`.btn-lg`): For hero sections.
- **Small** (`.btn-sm`): For inline actions.

#### Cards

- **Card** (`.card`): White background, border, hover lifts with shadow and red border.
- **Flat Card** (`.card-flat`): Dim background, no border. For secondary content.

#### PostCard

Article preview cards with:
- Department + use-case badges
- Date (right-aligned)
- Title (Space Grotesk, transitions to red on hover)
- Description (2-line clamp)
- "Read article →" link
- Red left-border reveal on hover (0 → 100% height)
- Card lifts 2px on hover

#### Badges

Pill-shaped, uppercase, tiny text:
- **Department** (`.badge-dept`): Red-light background, dark red text
- **Use case** (`.badge-usecase`): Teal-light background, dark teal text
- **Tag** (`.badge-tag`): Gray background, gray text

#### The Dot Element

```html
<span class="superdot"></span>     <!-- 8px red dot -->
<span class="superdot-lg"></span>  <!-- 12px red dot -->
```

Used as a brand signature element throughout the UI.

---

### Dark Mode

Dark mode is supported via `prefers-color-scheme: dark` and automatically swaps all semantic color tokens. Brand colors (red, teal, amber) remain unchanged — they're already chosen for contrast in both modes.

---

### Imagery Guidelines

- **No stock photos.** If we use imagery, it's screenshots, diagrams, or custom illustrations.
- **Illustrations** should be simple, geometric, using the brand palette.
- **Screenshots** should be clean, annotated, and show real tools.
- **Icons** should be simple line-style, consistent stroke weight.

---

### Email Design Rules

Email clients (Gmail, Outlook, Apple Mail) strip or ignore many CSS features. Follow these rules for all email templates.

#### Logo in Email
- **Use the inline SVG logo** from `content/email-templates/newsletter-base.mjml` (lines 46-48). It renders the three ascending dots at 24x24px with MSO Unicode fallback. Copy this block — do not reinvent it.
- **Never use**: external SVG files (Gmail blocks them), PNG with alpha transparency (renders as white square on dark backgrounds in Gmail iOS/Android).
- **If PNG is required** (e.g., for a non-MJML template): composite the logo onto `#0B1222` background first, eliminating transparency. Use `scripts/tools/graphics.mjs` to flatten.
- **Logo sizing**: 24px inline with wordmark for headers, 20px for footers. Do not exceed 40px.

#### Email Colors
Same dark palette as web:

| Element | Color |
|---------|-------|
| Body background | `#080E1A` |
| Section background | `#0B1222` |
| Card background | `#111827` |
| Primary text | `#E2E8F0` |
| Secondary text | `#94A3B8` |
| Default text | `#CBD5E1` |
| CTA button background | `#E8363B` |
| CTA button text | `#FFFFFF` |
| Links | `#E8363B`, no underline (add underline on hover) |

No gradients in CTA buttons — Outlook ignores them.

#### Email Typography
- Headings: Space Grotesk via Google Fonts (`mj-font` import). Fallback: `Arial, Helvetica, sans-serif`.
- Body: Inter via Google Fonts. Same fallback.
- Outlook ignores web font imports and always uses fallback. Design must look acceptable in Arial.

#### Template Reuse Rule (Mandatory)
Before creating any new email, check existing templates:
```bash
node scripts/tools/email-templates.mjs list
```

| Template | Purpose | When to use |
|----------|---------|-------------|
| `newsletter-base.mjml` | Weekly newsletter (1 featured + 3 secondary articles) | All regular newsletters |
| `welcome.mjml` | New subscriber welcome email | Onboarding sequences |

If the new email fits an existing template's structure, **fork and customize it**. Create from scratch only when the layout is fundamentally different.

---

### PDF Design Rules

#### Orientation
| Content type | Orientation | Page size flag |
|---|---|---|
| Tables with 4+ columns | **Landscape** | `--page-size a4-landscape` |
| Cheatsheets, comparison grids | **Landscape** | `--page-size a4-landscape` |
| Single-column text, guides | Portrait | `--page-size a4` |

**Rule of thumb**: if the content's natural width exceeds ~700px, use landscape. Portrait A4 has ~595px of printable width — wide tables will be compressed and unreadable.

#### PDF Rendering
```bash
node scripts/tools/graphics.mjs pdf <html-file> --page-size a4-landscape
```

- **Typography**: Space Grotesk (headings) + Inter (body), same as web. Minimum 14px body text for print readability.
- **Colors**: Dark theme (navy background) by default for brand consistency. Use light theme (white background, navy text) only if the PDF will be printed on paper.
- **Fonts**: Embed via Google Fonts CSS import in the HTML template.

---

### Template & Deliverable Registry

Before creating any visual deliverable (email, PDF, social graphic, slide deck), always check existing templates first.

| Directory | Contains | List command |
|-----------|----------|--------------|
| `content/email-templates/` | MJML email templates | `node scripts/tools/email-templates.mjs list` |
| `content/graphics/` | HTML templates for PDF/PNG rendering | `ls content/graphics/` |
| `content/slides/` | Marp slide decks | `ls content/slides/` |

**Mandatory workflow:**
1. Run the list command for the relevant directory
2. Read the closest existing template
3. If the new deliverable fits an existing template's structure, fork it
4. Only create from scratch when no template is structurally similar
5. Name new templates descriptively (e.g., `single-cta-announcement.mjml`, not `email2.mjml`)

---

### Tone of Voice in Design

| Do                                          | Don't                                      |
|---------------------------------------------|--------------------------------------------|
| Use direct, active headlines                | Use vague, passive language                |
| End key headlines with a red period (`.`)   | Overuse the dot — one per heading max      |
| Keep whitespace generous                    | Cram content together                      |
| Use bold color for one element per section  | Make everything colorful                   |
| Let typography do the heavy lifting         | Rely on decorative elements                |

---

### File Reference

| File                          | Purpose                           |
|-------------------------------|-----------------------------------|
| `src/styles/global.css`       | All design tokens and base styles |
| `src/components/Header.astro` | Navigation with sticky blur       |
| `src/components/Footer.astro` | Footer with brand mark            |
| `src/components/PostCard.astro`| Article preview cards            |
| `src/layouts/BlogPost.astro`  | Article page layout + prose       |
| `src/layouts/Base.astro`      | Base page wrapper                 |
| `src/pages/design-system.astro`| Design system showcase page      |
