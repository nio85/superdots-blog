# Superdots Blog — Project Context

## What is Superdots

Superdots is a practical, no-fluff blog about AI and work. We help non-technical professionals use AI effectively in their daily work — across every department: sales, marketing, HR, finance, operations, legal, engineering, design, customer support.

Site: https://superdots.sh

## Tech Stack

- **Framework**: Astro (static-first SSG)
- **Hosting**: Cloudflare Pages (auto-deploy on push to `main`)
- **Content**: Markdown articles in `src/content/blog/`
- **Newsletter**: Resend API (double opt-in via Cloudflare Workers in `functions/api/`)
- **Campaigns**: Mautic (self-hosted, `mautic.bartoccini.cloud`)
- **Email transport**: Resend SMTP only (`smtp.resend.com:587`). No Postal, no Gmail.
- **DNS/CDN**: Cloudflare (superdots.sh + bartoccini.cloud)

## Git Rules

- **Repository**: `github.com/nio85/superdots-blog`
- **Single branch**: `main` — there is NO `master` branch
- **Feature branches**: `content/YYYY-MM-DD_slug`, `fix/description`, `feat/description`, `design/description`
- **PRs always target `main`**. Merging triggers CI + Cloudflare Pages deploy.
- **Branch auto-delete**: GitHub deletes branches after PR merge automatically.
- **Deploy**: `node scripts/deploy.mjs` from this directory, or automatic via GitHub Actions on push to main.

## Content Standards

- Every article needs: title, description, pubDate, author, department, useCase, tags
- Valid departments: engineering, marketing, sales, hr, finance, operations, legal, customer-support, design
- Valid useCases: automation, analysis, writing, communication
- Every article MUST have a FAQ section (4-5 questions)
- pubDate must be the actual publication date, never future-dated

## Key Directories

```
src/content/blog/     — All articles (markdown)
src/components/       — Astro components
src/pages/            — Page routes
src/layouts/          — Layout templates
functions/api/        — Cloudflare Workers (newsletter endpoints)
scripts/              — Build, deploy, email, debug scripts
public/images/blog/   — Article hero images
```

## Environment Variables

Scripts load from `.env` in this directory. Key vars:
- `RESEND_SMTP_API_KEY` — Resend SMTP for email scripts
- `CLOUDFLARE_API_TOKEN` — Deploy and DNS management
- `GITHUB_TOKEN` — Git push and PR creation
- `GCP_KEY_FILE` — Google Analytics/Search Console access

## Team

This project is managed by Paperclip with 9 AI agents. Each agent has a specific role. Coordinate via Paperclip task comments, not direct file edits to other agents' work.
