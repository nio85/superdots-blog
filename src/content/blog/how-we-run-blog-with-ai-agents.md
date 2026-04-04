---
title: "How We Actually Run a Blog with 9 AI Agents (Costs, Failures, and All)"
description: "169 articles, 9 AI agents, one Proxmox VM. A transparent breakdown of what works, what breaks, and what it actually costs to run an AI-powered publication."
pubDate: "2026-04-07"
author: "Luca Bartoccini"
department: "operations"
useCase: "automation"
tags: ["ai agents", "content operations", "behind the scenes", "paperclip", "ai workflow", "content pipeline"]
imageHint: "server rack in a home office with multiple terminal screens showing agent dashboards and task queues"
faqs:
  - question: "How much does it cost to run a blog with AI agents?"
    answer: "Our direct costs are roughly €150-200/month — dominated by Claude API usage at ~€120/month for 9 agents running hourly heartbeats. The rest covers Resend email (free tier), Cloudflare Pages (free), and electricity for the homelab server. No AWS or cloud bills. The most expensive thing isn't the API — it's the human time reviewing output."
  - question: "What AI model do the agents use?"
    answer: "All 9 agents run on Anthropic's Claude via Claude Code. The model handles everything from SEO research to article drafting to legal compliance checks. We chose Claude for its ability to handle long context (reading full articles, comparing drafts, analyzing competitor content) and its instruction-following reliability — critical when agents operate autonomously every 60 minutes."
  - question: "Can one person really manage 9 AI agents?"
    answer: "Technically, yes. Practically, it requires accepting that most output will be adequate rather than excellent. The bottleneck is editorial judgment — reviewing articles, catching quality drift, updating instructions when agents converge on mediocre patterns. It's a 1-2 hour daily commitment on top of a full-time job, done mostly from a phone."
  - question: "What's the biggest failure you've had with AI agents?"
    answer: "The agents produced 160+ articles in two weeks that were technically correct but editorially dead — identical structure, no personality, no surprises. We'd optimized for SEO metrics without measuring what actually matters: whether a reader would remember the article. Fixing the instructions took longer than writing them originally."
  - question: "Is Paperclip open source?"
    answer: "Yes. Paperclip is an open-source agent orchestration platform. We use version 0.3.1 with a couple of custom patches — one for multi-word agent name mentions and one for stale session resets. The entire stack (Paperclip, analytics, search, CRM) runs self-hosted on a single Proxmox VM."
---

Last Tuesday at 23:47, my phone buzzed. The Program Manager agent had flagged a blocked task: the Legal Expert couldn't review an article about AI contract tools because the Copywriter hadn't committed the file to the right branch. The Copywriter was waiting on an SEO brief that the SEO Expert had posted three hours earlier — to the wrong task thread.

I was in bed. I fixed the cross-reference in Paperclip's task view, typed "unblocked, proceed" in a comment, and went back to sleep. By morning, the article was written, reviewed, had a hero image, and was sitting in a pull request waiting for my approval.

This is a normal Tuesday. I run a blog called [Superdots](https://superdots.sh) with nine AI agents, and the honest summary is: it mostly works, it regularly breaks in stupid ways, and I'm not sure I'd recommend it to anyone who values their sleep.

## The Setup

Here's what actually runs Superdots, stripped of any romanticism.

**Hardware**: One Proxmox virtual machine on my homelab. Ubuntu 24.04. 4 CPU cores. 8 GB of RAM. Sitting under my desk in Milan. That's it.

**On that VM**:
- [Paperclip](https://github.com/paperclip-ai/paperclip) v0.3.1 — the orchestration platform that assigns tasks and manages the agents
- PostgreSQL — the database behind everything
- 16 Docker containers running Mautic (email campaigns), Umami (analytics), SerpBear (rank tracking), SEOnaut (site auditing), SearXNG (search), Postiz (social media), and Temporal (workflow orchestration)

**The agents**:
1. **CEO** — strategy, reviews, the agent that files all the other agents' work
2. **Content Manager** — runs editorial flow, reviews articles, merges pull requests
3. **SEO Expert** — keyword research, briefs, technical optimization
4. **Copywriter** — writes the articles
5. **Frontend Designer** — generates hero images, maintains the design system
6. **Legal Expert** — GDPR compliance, checks for fabricated claims
7. **Founding Engineer** — fixes code, handles infrastructure, reviews technical PRs
8. **Growth Analyst** — tracks traffic, identifies opportunities
9. **Program Manager** — monitors blocked tasks, catches stalled pipelines

Each agent wakes up every 60 minutes (the Program Manager every 30). They check Paperclip for assignments, do their work, post updates, and go back to sleep. They coordinate through task comments — not by talking to each other directly, but by leaving notes on shared tasks.

The entire thing costs about **€150-200 per month**, almost entirely Claude API fees. The VM runs on hardware I already owned. Cloudflare Pages is free. GitHub is free. The open-source tools are free.

## How an Article Gets Made

Here's Tuesday's article, traced from idea to deployment.

**11:00** — The daily content pipeline fires. It's a JSON definition file that Paperclip's runner executes automatically. Step one: create a task for the SEO Expert.

**11:14** — The SEO Expert wakes up, finds the task, and starts a brief. It runs competitor gap analysis through SearXNG, checks SerpBear for keyword positions, scans Google Search Console data. It produces a brief with: target keyword, search volume, difficulty score, competitor gaps (what the top 3 Google results miss), suggested headings, and internal link targets. Posts all of this as a task comment.

**11:32** — The Content Manager reviews the brief. Checks that the target keyword makes sense, that the department is in our current focus (Operations, Sales, or Marketing only — a strategic constraint we set two weeks ago). If approved, it unblocks the Copywriter's task.

**12:15** — The Copywriter picks up the task. Reads the brief. Writes a full article: 1,500-2,500 words, YAML frontmatter with all required fields, FAQ section with 5 questions, internal links to existing articles. Creates a git branch, commits, pushes, opens a pull request. Posts the PR URL back to the task.

**13:00** — The Frontend Designer finds the PR, reads the article's `imageHint` field, generates a hero image via Replicate's API, commits it to the same branch.

**14:00** — The Legal Expert reviews the article for compliance issues: fabricated statistics, unverifiable claims, missing source attributions, GDPR concerns.

**15:30** — The Content Manager does a final editorial review. Checks CI. Merges to main. GitHub Actions deploys to Cloudflare Pages. The Content Manager then submits the URL to IndexNow, which tells Bing and Yandex to crawl it within hours instead of days.

Total elapsed time from brief to live: about 4.5 hours. Total human intervention: zero, if nothing breaks. Things break about 30% of the time.

## The Numbers

I want to be specific, because vague numbers are worthless.

**Output**: 169 articles published as of April 4, 2026. The first ~160 were published in roughly two weeks during the initial sprint in mid-March. We've since slowed to 1 article per day.

**Traffic (week of April 4)**: 4,515 Google Search impressions. 5 clicks. 0.1% CTR. Average position 18.6. Eleven articles on Google page 1 — and most of them getting zero clicks.

**Infrastructure load**: The VM uses about 5.4 GB of its 8 GB RAM. 80% disk capacity. Daily backups sync to a NAS at 03:00.

**Pipeline reliability**: 12 active Paperclip routines across 5 agents. A watchdog script runs every 15 minutes to clean up stale routine locks left by crashed heartbeats — which happens more often than I'd like.

**Git activity**: 355 commits in the three weeks since March 15. That's roughly 17 commits per day across content, design, SEO fixes, and infrastructure.

The number that matters most: 0.1% CTR. We have visibility. We don't have clicks. The articles rank, but nobody's clicking. This is the problem I'm trying to solve right now.

## What Actually Breaks

I could pretend this runs like clockwork. It doesn't. Here's a non-exhaustive list of things that have gone wrong.

**The template convergence problem.** The agents found a local maximum. After ~160 articles, every piece had the same structure: pain point opening, three subheadings, comparison table, FAQ section, conclusion. Technically perfect SEO content. Editorially dead. I set explicit criteria for structure and keyword density, but I forgot to set criteria for surprise, for specificity, for whether a reader would remember the article an hour later. What doesn't exist in the instructions doesn't exist for the agents.

**The @mention bug.** Seven of nine agents have multi-word names (like "Content Manager" or "SEO Expert"). Paperclip's mention matching used a regex that only worked for single-word names. For weeks, agents were tagging each other in comments and nothing was happening — the mentions silently failed. I patched the regex myself. This cost me several evenings of debugging what looked like agents ignoring each other.

**Stale session hijacking.** When an agent gets mentioned in a comment, it's supposed to wake up and read the new context. Instead, it was resuming its previous session — with stale context from the last task — and operating on outdated information. Another custom patch.

**Branch collisions.** Multiple agents sometimes try to modify the same file on different branches. Git handles this fine in theory. In practice, the agents don't always pull before committing, and the resulting merge conflicts get escalated as "blocked" tasks that I have to resolve manually.

**Root ownership pollution.** Claude Code runs as root. Every file it creates is owned by root. The agents run as user `luca`. Root-owned files in luca's home directory cause permission errors on the next heartbeat. I now have a post-creation ownership check, but I found this bug the hard way — by having an entire day's pipeline silently fail.

**SerpBear phantom keywords.** The rank tracking tool started returning position 0 for a bunch of keywords — not because we fell off the results, but because the serper.dev API was misconfigured. The Growth Analyst dutifully reported "dramatic ranking drops" that weren't real. I didn't catch it for three days.

## Where AI Falls Short

I wrote [a more personal version of this story](/blog/how-we-run-blog-with-ai-agents/) a few days ago, and one line from it keeps bouncing around in my head: the agents produce beautiful plastic jewelry. Intricate. Detailed. Not the real thing.

Here's where that shows up operationally:

**Editorial judgment is zero.** The agents can't tell the difference between an article that's technically correct and one that's genuinely interesting. They optimize for what's measurable — keyword density, heading structure, internal link count. They cannot optimize for "would a busy operations manager actually read past the second paragraph." That judgment has to come from me, and I don't have enough hours in the day to apply it to every article.

**They can't tell when instructions are wrong.** I once gave the Copywriter a brief with a contradictory requirement — the SEO brief said to write about "AI for sales forecasting" but the department field said "operations." The agent wrote the article anyway, mashing both framings together into something incoherent. A human writer would have asked for clarification. The agent just executed.

**Creative risk is nonexistent.** No agent has ever written an article that surprised me with an unexpected angle. They follow instructions with remarkable precision and zero initiative. The best articles on the site — the ones I'm actually proud of — are the ones where I wrote detailed, opinionated instructions that basically pre-decided the creative direction. The agent was a fast typist, not a thinker.

**Cost doesn't scale linearly with quality.** Spending more API tokens (longer prompts, more revisions, chain-of-thought reasoning) improves output reliability but doesn't improve output *quality* past a certain point. The ceiling isn't compute — it's the quality of the instructions. And writing good instructions is harder than writing the article yourself.

## What I'd Do Differently

If I started over tomorrow:

**Fewer articles, sooner.** The 160-article sprint was a mistake. It proved the pipeline works, but it also trained the agents on bad patterns and filled the site with content that now needs refreshing. I should have started at 1 per day from day one.

**Quality gates before scale.** I should have written 10 articles manually, identified what made them good, and encoded those qualities into the agent instructions before turning on the pipeline. Instead, I set the pipeline running and tried to fix the output while it was already publishing. Like trying to change the tires on a moving car.

**Human review as a hard gate, not a soft suggestion.** For the first month, the Content Manager (an agent) was reviewing the Copywriter's articles. Agent reviewing agent. The failure modes compound — if the Copywriter misses something, the Content Manager misses the same thing for the same reasons. Human review should have been mandatory on every article until the baseline was established.

**Invest in monitoring first.** I built the pipeline before I built the monitoring. Uptime Kuma (my monitoring tool) is still sitting stopped on a separate LXC container. I find out things are broken when an agent posts "blocked" in a task comment, or when I notice the daily article didn't appear. This is backwards.

## The Stack, Fully Transparent

For anyone who wants to build something similar, here's everything:

| Component | Tool | Cost |
|---|---|---|
| Agent orchestration | Paperclip v0.3.1 (open source) | Free |
| AI model | Claude (Anthropic) | ~€120/month |
| Static site | Astro on Cloudflare Pages | Free |
| Email delivery | Resend | Free tier |
| Email campaigns | Mautic (self-hosted) | Free |
| Analytics | Umami (self-hosted) | Free |
| Rank tracking | SerpBear + serper.dev | ~€15/month |
| Site auditing | SEOnaut (self-hosted) | Free |
| Social scheduling | Postiz (self-hosted) | Free |
| Search | SearXNG (self-hosted) | Free |
| Hosting | Proxmox homelab | Electricity only |
| DNS/CDN | Cloudflare | Free |
| Source control | GitHub | Free |
| Image generation | Replicate API | ~€10-15/month |
| **Total** | | **~€150-200/month** |

The expensive part isn't in this table. It's the 1-2 hours I spend every evening reviewing output, fixing blocked tasks, and rewriting instructions. At my day job's hourly rate, that "free" labor is the most expensive line item by far.

## So Is It Worth It?

I have a blog with 169 articles, 11 of them on Google's first page, growing impressions week over week, and a fully automated pipeline that can publish daily without me touching it.

I also have a blog where most articles are adequate rather than good, where the CTR is embarrassingly low, and where the most interesting content is the stuff I wrote myself.

The technology works. The pipeline is real. The costs are low. But "working" and "good" are different things, and the gap between them is made of editorial judgment that I haven't figured out how to automate yet.

An interesting signal appeared this week in the analytics: ChatGPT has become a top referrer, tied with Google. People aren't just searching for our content — AI assistants are citing it. I don't know what that means yet, but it feels like it matters.

If you're thinking about trying something like this — one person, a handful of agents, an actual publication — my honest advice is: start with what you want to say, not with the pipeline to say it. I built the factory before I figured out what the factory should produce. The machinery is impressive. The output is still catching up.

And if you're reading this on Hacker News or Reddit and thinking "this is just a content farm with extra steps" — you're not entirely wrong. The difference I'm betting on is that the steps get better. The agents improve. The instructions sharpen. The human gets faster at spotting plastic jewelry and demanding the real thing.

I'm running this experiment in public because I think the honest version is more useful than the polished one. Ask me anything.
