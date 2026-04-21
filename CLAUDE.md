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

## Git Publishing Procedure (mandatory for ALL agents)

### Repository
- **Repo**: `github.com/nio85/superdots-blog`
- **Default branch**: `main` — there is NO `master` branch
- **Deploy**: merge to `main` → GitHub Actions → Cloudflare Pages → https://superdots.sh
- **Branch auto-delete**: GitHub deletes branches after PR merge automatically.

### Authentication
Before any `gh` or `git push` command:
```bash
source /home/luca/superdots-blog/.env
export GH_TOKEN="$GITHUB_TOKEN"
```

### Branch naming
| Change type | Prefix | Example |
|---|---|---|
| Blog article | `content/YYYY-MM-DD_slug` | `content/2026-03-25_ai-email-assistant` |
| Bug fix | `fix/description` | `fix/broken-rss-feed` |
| Feature | `feat/description` | `feat/newsletter-double-optin` |
| Design/CSS | `design/description` | `design/new-article-layout` |

### The Procedure

**NEVER commit directly to `main`. NEVER push to `main`. ALL changes go through branch → PR → review → merge.**

Step 1 — Start clean.
```bash
cd /home/luca/superdots-blog
git checkout main && git pull origin main
```

Step 2 — Create a feature branch.
```bash
git checkout -b <prefix>/<name>
```

Step 3 — Do your work. Stage ONLY the files you changed:
```bash
git add <specific-files>
```

Step 4 — Commit.
```bash
git commit -m "<type>: <short description> (SUP-XXX)"
```

Step 5 — Push and open PR.
```bash
source .env && export GH_TOKEN="$GITHUB_TOKEN"
git push -u origin <branch>
gh pr create --repo nio85/superdots-blog --base main \
  --title "<type>: <short description> (SUP-XXX)" \
  --body "Paperclip task: SUP-XXX"
```

Step 6 — If CI fails, fix on your branch and push again.

Step 7 — Post PR URL as comment on Paperclip task. Set status to `in_review`.

Step 8 — You do NOT merge your own PRs. In your task comment, @mention the designated reviewer (see review matrix below) with the PR URL so they are notified. Example: `@Founding Engineer PR ready for review: https://github.com/nio85/superdots-blog/pull/41`

Step 9 (post-merge, reviewer only) — After merging a PR, submit the new URLs to IndexNow for instant indexing on Bing/Yandex:
```bash
source .env
node scripts/tools/indexnow.mjs submit-url https://superdots.sh/blog/<slug>
```
This notifies Bing, Yandex, and other search engines to crawl the new page within hours instead of days.

### Multi-agent collaboration on the same PR
Multiple agents may work on the same branch/PR sequentially (e.g. Copywriter writes article, then Designer adds images on the same branch). When working on another agent's branch:
```bash
git fetch origin
git checkout <existing-branch>
git pull origin <existing-branch>
# do your work, commit, push
```

### Review and merge matrix
| PR type | Reviewer | Fallback |
|---|---|---|
| `content/*` (dot-by-dot pillar) | Content Manager | CEO |
| `content/*` (connecting-the-dots, the-big-picture, behind-the-dots) | CEO (Luca) | Content Manager |
| `fix/*`, `feat/*` | Founding Engineer | CEO |
| `design/*` | Founding Engineer | Content Manager |
| Legal pages | CEO | Founding Engineer |

Reviewers: merge only after CI passes. Verify deploy at https://superdots.sh.

### Hotfix exception (CEO only)
The CEO may commit directly to `main` ONLY for critical production fixes that cannot wait.
Must: git pull first, commit as `hotfix: description (SUP-XXX)`, push, document why in task comment.

### Workspace conflict prevention
- Always start from `git checkout main && git pull origin main`
- Never leave uncommitted work on `main`
- If checkout fails due to another agent's uncommitted changes: `git stash` first
- If rebase conflicts: set task to `blocked`, comment with conflict details

## Content Standards

- Every article needs: title, description, pubDate, author, contentPillar, tags
- Valid contentPillars: `dot-by-dot` (default), `connecting-the-dots`, `the-big-picture`, `behind-the-dots`
- Valid departments: engineering, marketing, sales, hr, finance, operations, legal, customer-support, design
  - `department` is **required** for `dot-by-dot` and `connecting-the-dots` articles
  - `department` is **optional** for `the-big-picture` and `behind-the-dots` articles
- Valid useCases: automation, analysis, writing, communication
  - `useCase` is **required** for `dot-by-dot` articles
  - `useCase` is **optional** for all other pillars
- Every `dot-by-dot` article MUST have a FAQ section (4-5 questions). FAQ is recommended but optional for other pillars.
- **Note:** The `pillar: boolean` field (marks "complete guide" pages like "AI for HR") is a separate concept from `contentPillar` (editorial series). Don't confuse them.
- pubDate: publication date. Can be today or any future date. Future-dated articles are merged and deployed normally but invisible to readers — they go live automatically at the daily 07:00 Europe/Rome rebuild on their date. Use future pubDates whenever spacing content makes sense: gap analysis batches, seasonal pieces, campaign series, event-driven articles. The Content Manager decides the date; the Copywriter sets it in frontmatter.

## Editorial Principles (mandatory for ALL agents)

These three principles are our promise to readers. They override any other content consideration. Every agent — whether writing, reviewing, optimizing, or designing — must apply them.

### 1. Specific, not generic
Tool names, pricing, step-by-step instructions. If a reader can't act on it today, we haven't done our job. Never write "consider using an AI tool" — name the tool, state the price, show the steps. Vague content has zero value.

### 2. Honest about AI
We tell readers what AI does well, where it falls short, and when the old way is still better. No cheerleading, no hype, no "AI will revolutionize everything." If a tool is mediocre, say so. If AI isn't the right solution for a use case, say that too. When we haven't personally tested a tool, we say "based on documentation and user reviews" — never imply hands-on experience we don't have.

### 3. Transparent process
Our content is AI-assisted and human-edited. We say so openly. We never pretend content was handwritten when it wasn't. We never fabricate testimonials, fake statistics, or invent case studies. Every claim must be verifiable. If we cite a number, it needs a source. If we make a recommendation, it must be based on evidence we can point to.

**These principles apply to everything we publish**: articles, social posts, newsletter content, landing pages, and email campaigns. No exceptions.

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

## Safety

- Never exfiltrate secrets or private data.
- Do not perform destructive commands unless explicitly requested.
- Always include `Co-Authored-By: Paperclip <noreply@paperclip.ing>` in git commits.
