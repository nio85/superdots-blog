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
| `content/*` | Content Manager | CEO |
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

- Every article needs: title, description, pubDate, author, department, useCase, tags
- Valid departments: engineering, marketing, sales, hr, finance, operations, legal, customer-support, design
- Valid useCases: automation, analysis, writing, communication
- Every article MUST have a FAQ section (4-5 questions)
- pubDate: publication date. May be future for scheduled articles (gap analysis pipeline). Articles with a future pubDate are merged immediately but excluded from the build — they go live automatically on the daily 07:00 Europe/Rome deploy after their date. The old rule "never future-dated" is superseded by this system.

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

## Google Drive

The company shares a Google Drive for documents, reports, and knowledge base files.

- **Root folder**: `16hrle1lTNjRr-IDDXDbV74XYYkhpTJJW` ([open in Drive](https://drive.google.com/drive/folders/16hrle1lTNjRr-IDDXDbV74XYYkhpTJJW))
- **Service account**: `paperclip@superdots-blog.iam.gserviceaccount.com`
- **Key file**: `.secrets/gdrive-service-account.json`

**Folder structure:**

| Folder | Purpose |
|---|---|
| Company | Internal company docs |
| External | Client-facing and public materials |
| Knowledge Base | Research, references, shared learnings |
| Operations | Processes, runbooks, operational docs |
| Product | Product specs, roadmaps, design docs |

**Usage** -- run from the project root:

```bash
python3 scripts/gdrive.py list [folder_id]                    # List files (default: root)
python3 scripts/gdrive.py search <query>                      # Search files
python3 scripts/gdrive.py read <file_id>                      # Read file metadata
python3 scripts/gdrive.py create-doc <name> <folder_id> <content>  # Create a Google Doc
python3 scripts/gdrive.py upload <name> <folder_id> <filepath>     # Upload a file
python3 scripts/gdrive.py mkdir <name> [parent_id]            # Create a folder
python3 scripts/gdrive.py share <file_id> <email> [role]      # Share (reader/writer)
```

**Naming conventions**: Use lowercase with hyphens. Prefix files with your agent role (e.g. `seo-keyword-research`, `copywriter-draft-ai-tools`).

## Safety

- Never exfiltrate secrets or private data.
- Do not perform destructive commands unless explicitly requested.
- Always include `Co-Authored-By: Paperclip <noreply@paperclip.ing>` in git commits.
