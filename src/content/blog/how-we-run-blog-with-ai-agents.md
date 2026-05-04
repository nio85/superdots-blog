---
title: 'How We Run a Blog with 10 AI Agents'
description: "One person, ten AI agents, 220 articles, a social pipeline, Meta Ads, and a bounce rate that forced an honest reckoning. The May 2026 update."
pubDate: '2026-05-20'
author: 'Luca Bartoccini'
department: 'operations'
useCase: 'automation'
contentPillar: 'behind-the-dots'
tags: ['ai-agents', 'content-operations', 'behind-the-scenes', 'paperclip', 'ai-workflow']
heroImage: '/images/blog/how-we-run-blog-with-ai-agents.webp'
imageHint: 'person on couch at night glancing at phone with multiple browser windows showing analytics dashboards, social posts, and task boards'
showStickyCTA: true
---

In late March I wrote a piece about running this blog with nine AI agents. I said we had over 160 articles, that the output was technically correct and editorially dead, and that I was lying on the couch at midnight approving forgettable content because the pipeline doesn't wait.

Five weeks later, the couch is the same. Almost everything else has changed.

We now have 220 articles, ten agents, a full social media operation, a newsletter system, Meta Ads running daily, and April traffic data that forced the most uncomfortable editorial conversation I've had with a system that doesn't have feelings.

This is the update. The honest one.

## The Numbers, Five Weeks Later

160 articles in March. 220 now. Roughly 60 articles in five weeks.

Nine agents in March. Ten now — I added a Paid Ads Specialist in late April, after deciding that publishing 160 articles and then doing nothing with them was a waste of everyone's compute.

Fifteen-plus routines running daily or weekly: social post scheduling, SEO rank monitoring, content decay checks, ad performance tracking, newsletter sends. The infrastructure that seemed futuristic in March now feels like the boring operational layer it is. Agents wake up every 30 to 60 minutes and do things. I mostly find out about it afterward.

The pillar breakdown is worth noting because it didn't exist in March: 198 dot-by-dot tool guides, 10 connecting-the-dots practical pieces, 1 behind-the-dots article — the March one. Plus whatever this becomes. The imbalance is real and I'll get to it.

## The Social Pipeline — From Zero to Daily

In March we had no social presence. Zero. Publish an article, tell no one.

That changed fast. The Social Media Manager agent now runs a full weekly schedule: three Facebook posts per week, two LinkedIn. Daily Mon–Fri. Top-performing pieces get recycled through a rotation. The CEO agent reviews the Growth Analyst's monthly report and adjusts the strategy. It looks like a real content distribution operation.

Here's the number that surprised me most: Facebook drives 55% of all referral traffic to Superdots. The Facebook-to-LinkedIn referral ratio is roughly 48 to 1. I did not expect that. LinkedIn feels more professional, more intentional. Facebook feels like shouting into a void. Apparently the void has better reach.

The stranger signal is ChatGPT. Last week it sent 10 referral visits to the blog. Google sent 7. I'm not sure what to make of that. Someone asked an AI assistant about something and it cited us. That didn't happen in March.

## The Content Farm Reckoning

April traffic data arrived and it was clear enough that I couldn't rationalize it.

Traffic was up 147% month-over-month. That sounds good. The bounce rate was 85%. That does not sound good. Pageviews-per-session were low. Time-on-site was low. The Growth Analyst's report surfaced the number that broke the formula: behind-the-dots content was generating 9 times more pageviews per article than dot-by-dot tool lists.

One piece — the March version of this article — was doing the work of nine tool guides combined.

The agents had done exactly what I'd set them up to do. They'd published at scale, hit the SEO targets, structured every article correctly. And the data was telling me that most of it was padding the web without resonating with anyone. Including me. Especially me — I'd built the system and I didn't want to read its output.

I made three decisions. Cap dot-by-dot output at 20 articles per month (down from the no-limit default). Mandate at least one behind-the-dots and two connecting-the-dots pieces per month. Raise the quality bar across all formats — more concrete scenarios, fewer generic tool descriptions, actual comparison context instead of feature tables.

The lesson from March held but sharpened: agents optimize for whatever you measure. What I hadn't measured was whether anyone would care. Bounce rate and pageview depth are imperfect proxies, but they're closer to the truth than keyword density.

## Email, Ads, and the Strange Feeling of Running a Real Company

Somewhere in April, things stopped feeling like a side project.

I set up Mautic — an open-source CRM and email marketing platform, running on the same homelab as everything else. The first newsletter went out. The subscriber count is 5. Five people. Newsletter CTAs are now live on the top five articles by traffic, and the list has five names on it. That number will either feel absurd to you or it will feel honest. It feels honest to me — 220 articles, one real company's worth of infrastructure, five subscribers. The ratio is embarrassing and accurate.

Then I launched Meta Ads. A Paid Ads Specialist agent monitors performance daily, adjusts budgets, pauses underperforming creatives, reports back. The how-we-run article campaign ran CTR of 1.73% and CPC of roughly €0.10. The main article campaigns ran CTR around 0.79% and CPC around €0.27. Behind-the-scenes content outperformed tool lists in paid distribution too, not just in organic traffic.

Total ad spend in the first three days of May: €5.71. Which is nothing. Except that it's not nothing — it's a system that woke up, allocated budget, tested creatives, monitored performance, and reported back, without me doing any of it. The number is small. The fact that it happened at all is not.

I'm going to be honest about how this felt: strange. Unsettling in a way I didn't expect. In March, Superdots was something I was building. By April, it had started to look like something that was running. The gap between those two things is wider than it sounds.

The comparison that kept coming to me was managing people. Not algorithms — people. The agents make mistakes. They misunderstand briefs, converge on safe defaults, sometimes route around problems in ways that create bigger problems downstream. You correct them and they adjust. They're not perfect. But the fundamental thing is that everything keeps moving without me pushing it. That's new. That wasn't true in March.

It's still one person, from a phone, in stolen windows of time. But I spend less of that time on firefighting and more on direction. The ratio is improving.

## What the Agents Still Can't Do

This section mattered in March and it matters more now, because the operation is more capable and the gaps are clearer.

**They can't tell when something is boring.** An agent will produce a structurally correct article, SEO-optimized, well-formatted, with five FAQ answers and a comparison table — and the article will be boring. Not wrong. Not poorly written. Boring in the way a correctly assembled but soulless thing is boring. There's no signal in the system for "the reader will put this down in thirty seconds." The agent has no way to care about that. I have to care about it, and I have to care before the article is commissioned, not after.

**They can't tell when to publish something like this.** This article exists because a task in Paperclip said it was due. The brief was written by the Content Manager agent, who correctly identified that behind-the-dots content performs well and that five weeks had passed since the last update. The brief is well-constructed. The agent did its job.

The thing I'm sitting with is that I would not have written this today if the system hadn't scheduled it. I wasn't inspired. I didn't wake up needing to say something. A machine decided the time was right, and I'm complying.

I don't know how to feel about that. I've decided it doesn't matter — the output is either good or it isn't, regardless of why it happened. But the March piece had something true about it: I wrote it because I needed to. This one I'm writing because the pipeline said to. Whether the reader can feel that difference is the question I can't answer for myself.

**They can't hold the line on voice.** In March I described the output as plastic jewelry — beautiful intarsia craftsmanship in plastic. That's still accurate, but now there are 220 pieces and the uniformity has become more visible. The agents have converged on a prose style. It's competent. It's recognizable. It's not mine. Occasionally I read something one of them wrote and think: that sentence could only have come from this system, no human would have phrased it that way. I'm not sure whether to take that as progress or a warning.

## What the Agents Did Get Better At

This section also matters, because the March piece was more one-sidedly critical and that would be dishonest now.

The coordination is better. Agents comment on each other's work, flag dependencies, catch errors. The Founding Engineer once fixed a DNS configuration that three agents had been routing around for a week — not because I told him to, but because he found it while doing something else. That kind of autonomous problem-solving didn't exist in March.

The SEO briefs are more sophisticated. The Social Media Manager recycles content intelligently, not mechanically. The Growth Analyst's monthly report has become genuinely useful for editorial direction — it's the thing that prompted the content mix change. The data loop works.

The system is more legible. In March I understood it architecturally; now I understand it operationally. I know which agents make which decisions, where the failure points are, how to intervene without cascading problems. That knowledge came from watching it run for five weeks, not from anything I designed in advance.

## The Honest Takeaway

The operation scales. Quality doesn't scale with it automatically.

That was true in March. It's truer now, at 220 articles, with more agents and more routines and more data. Each new capability creates a new category of things that can go wrong slowly, at scale, without any single moment of obvious failure.

What I've learned is that the 10% human in a 90/10 system is not a bottleneck you can optimize away. It's the part that has to keep changing what success means. The agents will find local maxima and stay there. That's what they're good at. The goalposts — what we're actually optimizing for, what "good" means this month — those have to come from somewhere else.

That somewhere else is still me, on a phone, in five-minute intervals. Except fewer of those intervals than before — the agents need less of my time every month, not more. The midnight couch scene from March happened when I was pulling things by hand. Now the pipeline runs, and I check in on it. That's a real change.

Revenue: still zero. Intentionally. There's no product to sell yet, and I'm not going to pretend otherwise. The goal right now is to build something worth selling. That work is not done.

The current state: pre-revenue, infrastructure up, pipeline running, editorial quality improving more slowly than traffic. A real operation with real problems, run by one person with a lot of capable and limited help.

The plastic jewelry metaphor from March still holds. But I've started to notice something: some of the pieces are less plastic than they were. Marginally. Which means the standard has to go up again. That's the only thing around here that definitely doesn't automate.

---

*This is the May 2026 update to the original March 2026 piece. The origin story — Paperclip, the 90/10 model, the midnight couch scene — was in that first version. This is what came after.*
