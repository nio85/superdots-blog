---
theme: ./theme
title: Superdots — Theme Demo
info: |
  A demo deck showcasing all Superdots Slidev theme layouts.
drawings:
  persist: false
transition: slide-left
---

# Practical AI for Work

Superdots helps teams cut through the noise and work smarter with AI.

<p style="color: var(--sd-slate-400); font-size: 0.9em; margin-top: 24px;">March 2026</p>

<!--
This is the cover layout (default for the first slide).
Logo is centered. Hero pattern background with brand dot grid overlay.
-->

---
layout: section
---

# The Problem

<!--
Section divider layout. Dark navy background with hero pattern.
Use these to introduce major topic shifts.
-->

---
layout: default
---

# AI Adoption is Broken

Most teams struggle with AI because the guidance they find is either too theoretical or too generic.

- **87% of AI pilots** never make it to production
- Teams waste weeks on tools that don't fit their workflow
- Generic "prompt engineering" guides miss department-specific needs

What's needed: practical, role-specific guidance that teams can apply today.

<!--
Default content layout. Logo icon top-left. Standard padding.
Good for text-heavy content, bullet points, and mixed content.
-->

---
layout: two-cols
---

# Before & After

::left::

### Without Superdots

- Hours searching for relevant AI tips
- Trial and error with generic prompts
- No department-specific guidance
- Inconsistent results across the team

::right::

### With Superdots

- **Curated guides** for every department
- Ready-to-use techniques and prompts
- Role-specific workflows
- Consistent, measurable improvements

<!--
Two-column layout. Heading spans full width.
Use ::left:: and ::right:: slots to split content.
-->

---
layout: image-right
image: https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=600&fit=crop
---

# Built for Real Teams

Our guides are written by practitioners, not theorists.

Each article includes:
- Step-by-step walkthroughs
- Real-world examples
- Tool recommendations
- Expected time savings

<!--
Image-right layout. Text on left, image on right.
Recommended image: 16:9 or 4:3 aspect ratio, clean, high-contrast.
Set `image` in frontmatter or use the #image slot.
-->

---
layout: image-left
image: https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop
---

# Every Department Covered

From engineering to legal, from sales to HR — we cover the AI use cases that matter for each team.

- Engineering & QA
- Sales & Marketing
- HR & Operations
- Finance & Legal
- Design & Product

<!--
Image-left layout. Image on left, text on right.
Same image guidelines as image-right.
-->

---
layout: full
---

<div style="background: var(--sd-navy); color: white; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-family: var(--sd-font-display); font-size: 2em; font-weight: 700;">
  superdots.sh
</div>

<!--
Full-bleed layout. No padding, no logo.
Use for full-screen images, videos, or custom content.
-->

---
layout: fact
---

# 3.2x

Average productivity gain reported by teams using our AI guides within the first month.

<!--
Fact/stat layout. Large number in brand red, centered.
Great for key metrics, milestones, or impact numbers.
-->

---
layout: quote
---

> We stopped guessing about AI tools after finding Superdots. Every guide is something we can actually use on Monday morning.

<p class="attribution">— VP of Engineering, Series B SaaS</p>

<!--
Quote layout. Styled blockquote with attribution.
Decorative open-quote mark in brand red.
-->

---
layout: brand-assets
---

# Brand Reference

<div style="display: flex; gap: 32px; align-items: flex-start; margin-top: 24px;">
<div>
<h3>Logo Variations</h3>
<div style="display: flex; gap: 16px; align-items: center; margin-top: 12px;">
  <div style="background: white; padding: 12px 16px; border-radius: 8px; border: 1px solid #E2E8F0;">
    <img src="/superdots-logo.svg" style="height: 32px;" />
  </div>
  <div style="background: #0F172A; padding: 12px 16px; border-radius: 8px;">
    <img src="/superdots-logo-white.svg" style="height: 32px;" />
  </div>
</div>
</div>
<div>
<h3>Colors</h3>
<div class="color-grid" style="margin-top: 12px;">
  <div class="color-swatch" style="background: #E8363B;">Red<br/>#E8363B</div>
  <div class="color-swatch" style="background: #0F172A;">Navy<br/>#0F172A</div>
  <div class="color-swatch" style="background: #14B8A6;">Teal<br/>#14B8A6</div>
  <div class="color-swatch" style="background: #64748B;">Slate<br/>#64748B</div>
</div>
</div>
</div>

**Icons:** Use line-style icons with consistent stroke weight. Recommended sources: [Lucide](https://lucide.dev), [Heroicons](https://heroicons.com). Use brand red (#E8363B) or dark navy (#0F172A) for icon colors.

<!--
Brand assets reference slide. Shows logo variations, color palette, and icon guidelines.
Include this at the end of template decks for brand consistency.
-->

---
layout: end
---

# Thank you<span class="dot-accent">.</span>

superdots.sh — Practical AI for Work

<!--
End/closing layout. Dark navy with hero pattern, centered logo.
Use as the final slide in every deck.
-->
