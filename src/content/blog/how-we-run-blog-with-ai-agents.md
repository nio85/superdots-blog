---
title: "I Run a Blog with 9 AI Agents. Here's What Actually Happens."
description: "Behind the scenes of Superdots: how 9 AI agents and one human produce a daily blog — the pipeline, the failures, and why human review makes it work."
pubDate: "2026-03-31"
author: "Luca Bartoccini"
department: "operations"
useCase: "automation"
tags: ["ai agents", "content operations", "automation", "behind the scenes", "ai workflow"]
heroImage: "/images/blog/how-we-run-blog-with-ai-agents.webp"
imageHint: "messy whiteboard with agent workflow diagrams and sticky notes in a home office"
faqs:
  - question: "Can AI agents really run a blog without human oversight?"
    answer: "No — and that's one of the main lessons. Our agents handle research, drafting, SEO optimization, image generation, and compliance checks. But every single article goes through human review before publication, and the human makes the final call on what ships. The agents are reliable at executing structured tasks, not at editorial judgment. Removing the human from the loop would mean publishing content that's technically correct but editorially flat. Human guidance also drives all the improvements — adjusting agent instructions, spotting quality patterns, killing topics that don't serve readers."
  - question: "How much does it cost to run 9 AI agents for content production?"
    answer: "Each agent runs on Claude via heartbeats — short execution windows triggered every 30-60 minutes. The total API cost varies depending on article complexity and how many revision cycles a piece needs. Honestly, we're still figuring out the true unit economics — some weeks are cheap, others spike when agents get stuck in loops. The real cost isn't the API though — it's the engineering time to build and maintain the orchestration layer."
  - question: "What AI tools do you use to coordinate the agents?"
    answer: "We built Paperclip, a custom orchestration platform that manages task assignment, agent communication, and workflow state. Each agent runs Claude Code with specialized instructions. The blog itself is Astro on Cloudflare Pages. Supporting tools include SearXNG for research, SerpBear for rank tracking, and SEOnaut for technical audits. The infrastructure requirements are minimal — the hard part is the orchestration logic and the human editorial layer on top."
  - question: "How do you maintain content quality with AI-generated articles?"
    answer: "Three layers: the Copywriter agent follows strict style guidelines and banned-pattern lists. The Content Manager agent reviews every draft against editorial standards. And a human (me) reviews every article before publication — not just spot-checks, but a genuine editorial read to decide whether the piece is worth publishing. We also run automated linters that catch duplicate FAQ sections, missing frontmatter fields, and SEO issues before merge."
  - question: "Is this approach replicable for other blogs or companies?"
    answer: "Parts of it, yes. The daily pipeline pattern — brief → draft → image → compliance → review → publish — works for any content operation. But the orchestration layer took months to build and still breaks regularly. If you're starting out, a simpler setup with one or two agents and manual coordination will get you 80% of the value at 20% of the complexity."
---

Three weeks ago, our SEO Expert agent created a content brief at 2:14 AM. By 2:47 AM, the Copywriter agent had a 2,000-word draft. At 3:12 AM, the Frontend Designer generated a hero image. At 3:38 AM, the Legal Expert flagged a GDPR concern in a paragraph about user tracking. By 4:15 AM, the Content Manager had a clean pull request ready for my review.

I woke up at 7, approved it over coffee, and the article was live by 7:20.

That's the version that sounds impressive. Here's what actually happened the same week.

## The Setup Nobody Warns You About

I run [Superdots](https://superdots.sh) with nine [AI agents](/blog/ai-agents-for-business/) that wake up on heartbeats — timed execution windows every 30 to 60 minutes — to check their assignments and do work. The infrastructure is deliberately simple: a single server, nothing fancy.

But the agents aren't the whole story. I'm in the loop every day — reviewing articles, adjusting strategy, rewriting briefs that miss the mark, and making the editorial calls that determine what we actually publish. The agents handle execution. The editorial judgment is mine.

| Agent | What it does |
|---|---|
| **CEO** | Sets strategy, reviews goals, unblocks other agents |
| **Program Manager** | Monitors task health every 30 minutes, surfaces blockers |
| **Content Manager** | Owns the editorial pipeline — assigns, reviews, merges |
| **SEO Expert** | Keyword research, briefs, competitive analysis |
| **Copywriter** | Writes every article |
| **Frontend Designer** | Hero images, design system, CSS |
| **Founding Engineer** | Infrastructure, deploys, newsletter, RSS |
| **Growth Analyst** | Traffic analysis, Search Console data, optimization |
| **Legal Expert** | GDPR checks, cookie consent, compliance |

They coordinate through [Paperclip](https://paperclip.ing), an orchestration platform I built for this. Each agent gets tasks, checks them out (literally — there's a locking mechanism so two agents don't work on the same thing), does the work, posts a comment, and moves on. It's like a very small, very weird company where nobody sleeps and everyone communicates through ticket comments.

We've published over 160 articles across nine departments in about four months — everything from [operations tooling guides](/blog/best-ai-tools-for-operations/) to sales playbooks to marketing automation walkthroughs. One article per day is the current target. Some days it works beautifully. Some days everything breaks at once.

## The Pipeline: How a Single Article Gets Made

The daily content pipeline has seven steps. I'll walk through what each one actually involves, because the gap between "seven clean steps" and reality is where the interesting stuff lives.

**Step 1: The SEO Expert writes a brief.** It pulls data from SerpBear (rank tracking), runs searches through SearXNG (a self-hosted search engine — yes, I run my own), and analyzes what's ranking for the target keyword. The brief includes: target keyword, search intent, competitor gaps, suggested headings, and internal links to existing articles.

This works well about 80% of the time. The other 20%, the brief is technically correct but editorially boring — it identifies a keyword gap that exists for a reason. Nobody is searching for "AI tools for meeting room scheduling optimization" because nobody thinks in those terms. The Content Manager catches most of these, but some slip through.

**Step 2: The Copywriter drafts the article.** That's me — or rather, the agent version of me. It follows a detailed style guide with banned openings ("In today's fast-paced..."), banned structures (the generic problem → solution → steps template), and a requirement for at least one specific example scenario per article.

The style guide exists because without it, every [content creation](/blog/ai-content-creation/) cycle produces the same article. I learned this the hard way. The first batch of articles we produced were competent and indistinguishable from each other. They hit every SEO checkbox and nobody would choose to read them.

**Step 3: The Frontend Designer creates a hero image.** This agent generates an image based on the `imageHint` field in the article frontmatter. It works on the same git branch as the article, so everything ships together.

**Step 4: The Legal Expert checks compliance.** GDPR language, cookie references, any claims that might need sourcing. For most articles this is a rubber stamp. For anything touching data privacy or European regulations, it's genuinely useful.

**Step 5: The Content Manager reviews and merges.** This is the first quality gate. The Content Manager checks the article against editorial standards, verifies SEO elements are in place, and flags anything that needs attention.

**Step 6: Human review.** This is the real quality gate — and the step that makes the difference. I read the article, check that the advice is genuinely useful, and make the call on whether it's worth publishing. Sometimes I approve it as-is. Sometimes I send it back with notes. Sometimes I kill it entirely because the topic doesn't serve our readers. The agents can tell me if a piece is structurally sound; they can't tell me if it's worth someone's time.

**Step 7: Post-publish coordination.** After I merge, the Content Manager triggers IndexNow for search engine crawling, and coordinates any social distribution.

Seven steps. Four to five agents involved per article, plus a human who makes the final call.

## What Goes Wrong (Regularly)

I could write an entire article just about failure modes. Here are the recurring ones.

### Agents talking past each other

Agents communicate through comments on tasks. They don't have a shared conversation — each one wakes up, reads the latest comments, does its thing, and goes back to sleep. This means context gets lost constantly.

The Copywriter writes an article. The Content Manager leaves a note: "The comparison table needs a pricing column." The Copywriter wakes up, reads the note, adds pricing. But by the time it commits, the SEO Expert has also woken up and left a comment on the same task about internal links. The Copywriter's next heartbeat now has two threads to reconcile, and sometimes it addresses one and misses the other.

We partially solved this with the Program Manager — an agent whose entire job is to wake up every 30 minutes and check if anything is stuck or miscommunicated. It's a bandaid, but it works better than I expected.

### The 3 AM cascade failure

One Tuesday, the database connection dropped during a Paperclip heartbeat. The agent that was running didn't crash gracefully — it left a checkout lock on a task. The next heartbeat saw the lock and skipped the task. The task after it depended on the first one, so it went to "blocked." The Program Manager woke up, saw three blocked tasks, and created escalation subtasks for each one. Those subtasks triggered more heartbeats, which tried to check out the same locked resources.

By the time I woke up, there were 14 tasks in various states of confusion. The fix took 20 minutes — clear the stale lock, cancel the duplicate escalations, restart the pipeline. But it taught me to build a watchdog script that runs every 15 minutes and cleans up stale locks automatically.

This is a good example of why the human-in-the-loop isn't optional. The agents couldn't diagnose this — they just saw "blocked" and escalated. I had to look at the whole picture, understand the root cause, and fix the system itself. That kind of judgment call happens weekly.

### Quality plateau

Around article 80, I noticed something. The articles were fine. They hit SEO targets, included the right sections, had proper structure. But reading five in a row felt like reading the same article five times with different keywords swapped in.

Let me be blunt: at that point, the blog was barely more than a content farm with decent formatting. The agents had optimized for the measurable criteria — keyword density, heading structure, FAQ sections, internal links — and converged on a template that satisfied all of them. They'd found a local maximum that was technically correct and editorially dead.

This is, I think, the most important thing I've learned: **AI agents are excellent at optimizing for explicit criteria and terrible at knowing when the criteria themselves are wrong.**

The fix was counterintuitive. I made the style guide stricter and more specific. I added banned patterns — not just banned openings, but banned article structures. I added a requirement that every article must include at least one thing the reader wouldn't find on page one of Google. I added a "gold standard" writing model with specific examples of what good looks like.

More constraints, paradoxically, produced more variety. The agents couldn't fall back on the default template anymore and had to find different approaches for each piece.

Has it solved the quality problem? Not entirely. We're still iterating. Some articles are genuinely good; others are workmanlike at best. The approach is test and learn — try something, measure whether it moves the needle, adjust, repeat. I don't think there's a final state where the system "works." There's just the current version, which is better than last month's version, and worse than next month's will be.

The point is: these improvements don't come from the agents. They come from me reading the output, noticing the pattern, and changing the instructions. The agents execute. The human steers.

### The @mention bug that silenced 7 agents

This one still makes me wince. Paperclip uses @mentions in comments to trigger agent heartbeats — if the Content Manager writes "@Copywriter please revise the opening," the Copywriter gets woken up to handle it.

For two weeks, this worked only for two of nine agents. The mention-matching regex only handled single-word names. "CEO" and "Copywriter" worked. "Content Manager," "SEO Expert," "Frontend Designer," "Growth Analyst," "Legal Expert," "Founding Engineer," "Program Manager" — all silently failed. Seven agents, unreachable by mention.

We noticed because tasks kept going stale. The Content Manager would request revisions, the Copywriter wouldn't wake up, and the task would sit until the next scheduled heartbeat (up to an hour later). The fix was two lines of code. The debugging took a full day.

## What I've Actually Learned

Four months and over 160 articles in, here's where I've landed.

**The pipeline is the product, not the articles.** Any individual article matters less than the system that produces it. Getting the pipeline right — the handoffs, the quality gates, the failure recovery — is what makes daily publishing sustainable. An article can be rewritten. A broken pipeline stops everything.

**Agents need constraints more than capabilities.** Early on, I kept giving agents more tools, more context, more flexibility. The quality went down, not up. The breakthrough came from adding restrictions: banned patterns, required elements, specific style models. Tell an agent what it *cannot* do and it gets creative within the remaining space.

**Orchestration is harder than generation.** Getting an AI to write a decent article is easy. Getting nine AIs to coordinate on producing, reviewing, optimizing, illustrating, and publishing that article without stepping on each other — that's the actual [workflow automation](/blog/ai-workflow-automation/) problem. Most of our bugs are coordination bugs, not generation bugs.

**Human review isn't the bottleneck — it's the product.** I review every article before it goes live. That review step is the slowest part of the pipeline by far — the agents can produce a complete article in under two hours, and it might sit in my review queue for a day. I've thought about removing myself from the loop, and I've decided against it. Not because the quality isn't good enough (though that's true too), but because the editorial judgment about *what's worth publishing* is exactly the part that shouldn't be automated. The agents don't know what our readers need to hear this week, what angle is getting stale, or when a technically correct article is substantively useless. That's my job, and it's the most important job in the pipeline.

**You will build more monitoring tools than you expected.** I have a watchdog for stale task locks, a linter for article frontmatter, duplicate detection for FAQ sections, and a dashboard for agent heartbeat health. None of these were in the original plan. All of them exist because something broke at 3 AM and I got tired of fixing it manually.

## The Numbers, Honestly

Here's what the operation looks like in practice:

- **over 160 articles** published across 9 departments
- **9 agents** handling execution — research, drafting, SEO, design, compliance
- **1 human** (me) doing strategy, editorial review, and every final publish decision
- **~1 article per day** current production rate
- **7-step pipeline** per article, 4-5 agents involved, human review on every piece
- **Heartbeat frequency**: every 30-60 minutes depending on the agent
- **Things that broke this month**: stale checkout locks (fixed with watchdog), duplicate FAQ sections across 32 articles (fixed with linter), agent mention matching (fixed with regex patch), author avatar rendering (CSS fix)

I'm not going to pretend the content is as good as what a skilled human writer would produce with eight hours per article. It's not — and some of it is honestly not great. The agents handle the heavy lifting of research, drafting, and optimization; I handle the editorial decisions that shape what actually gets published. What the system produces is: consistent, structured, often useful, and published daily — which is something I could never sustain alone. The quality bar keeps moving up as I learn what instructions work and which don't, but we're climbing, not there yet.

## Why I'm Writing This

There's a version of this story where I present the agent pipeline as a polished system that runs flawlessly. That version would get more "wow" reactions and fewer useful responses.

I'm more interested in the useful responses. If you're running something similar — or thinking about it — I want to know what you've figured out that I haven't. The coordination problem is largely unsolved. The quality-at-scale problem is partially solved but fragile. The monitoring-and-recovery problem is an endless treadmill.

The pitch for Superdots is that AI can make every department more effective. Running the blog this way is how we test that thesis on ourselves — not as a showcase, but as a genuine experiment where we don't know how it ends. Some days it validates the pitch beautifully. Some days it generates 14 confused escalation tasks at 3 AM. Some days I look at what we published and think, "We can do so much better than this."

That restlessness is the point. This is a test-and-learn operation. Every week we find something that's broken or mediocre, and we try to fix it. The system gets a little better each month. Whether it ever gets *good enough* — I genuinely don't know yet. But the experiment is worth running, and we'll keep sharing what we find.
