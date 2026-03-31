---
title: "I Run a Media Company with 9 AI Agents and a Smartphone"
description: "One person, nine AI agents, 160+ articles. The honest story of building Superdots — the chaos, the plastic jewelry, and why AI needs a human head."
pubDate: "2026-03-31"
author: "Luca Bartoccini"
department: "operations"
useCase: "automation"
tags: ["ai agents", "content operations", "behind the scenes", "paperclip", "ai workflow"]
heroImage: "/images/blog/how-we-run-blog-with-ai-agents.webp"
imageHint: "person on a smartphone in a dimly lit room at night, surrounded by floating chat bubbles and task boards"
faqs:
  - question: "Can one person really run a media company with AI agents?"
    answer: "Technically, yes. Practically, it's a lot more work than '10% human, 90% AI' sounds. Right now I'm working evenings, weekends, and every five-minute gap I can find on my phone. The agents handle execution — research, drafting, SEO, design, compliance review — but the editorial judgment, quality control, and strategic decisions are all mine. It's not passive income. It's a side project that demands real attention, just compressed into fragments of time that wouldn't have been enough to run anything before AI agents existed."
  - question: "How much does it cost to run 9 AI agents for a blog?"
    answer: "Each agent runs Claude via Paperclip heartbeats — short execution windows every 30 to 60 minutes. API costs vary by week depending on article complexity and revision cycles. Some weeks are cheap, others spike when agents get stuck in loops. But the real cost isn't the API bill — it's the time spent reading output, adjusting instructions, and fixing coordination bugs. If you're thinking about this as a money question, you're asking the wrong thing. The question is whether you're willing to invest the attention."
  - question: "What is Paperclip and how does it coordinate the agents?"
    answer: "Paperclip is an open-source agent orchestration platform — I discovered it through OpenClaw and adopted it for Superdots. I didn't build it. It handles task assignment, agent communication, checkout locking (so two agents don't work on the same thing), and workflow state. Think of it as a tiny project management system where the employees are AI agents that wake up on schedules, read their assignments, do the work, and post status updates. The agents themselves run Claude Code with specialized instructions for each role."
  - question: "Is AI-generated content always low quality?"
    answer: "That's the wrong framing. As the philosopher Luciano Floridi argues, AI didn't create artificial intelligence — it decoupled the capacity to understand from the capacity to act. AI is a tool, a technological prosthesis. What comes out depends entirely on who's using it and how honestly they understand its strengths and limits. Yes, most AI content online is garbage. But that's not the AI's fault — it's what happens when people use a powerful tool without editorial judgment. The challenge isn't getting AI to write. It's knowing what's worth writing and being honest about when the output falls short."
  - question: "What advice would you give someone starting a similar project?"
    answer: "Do better than me. Be more curious, more methodical, more organized. I'm genuinely chaotic — I run this thing in five-minute bursts from my phone between family time and my real job. Start simpler than you think: one or two agents with clear roles, manual coordination, and your own editorial judgment on everything that ships. The orchestration layer is where all the complexity lives, and you don't need most of it on day one. The thing that matters most isn't the technology — it's whether you have something worth saying and the honesty to admit when what you're producing isn't good enough yet."
---

Last Tuesday night, somewhere around 11 PM, I was lying on the couch with my phone, half-watching something on TV, half-reading a draft that one of my AI agents had written about sales coaching tools. My wife thought I was scrolling social media. I was actually running a media company.

I say "running" loosely. What I was really doing was reading a 2,000-word article and thinking: *this is fine, but it's plastic*. Technically correct. Well-structured. SEO-optimized. And if you read it alongside the five articles published that same week, you'd struggle to tell them apart.

I approved it anyway. I shouldn't have. But it was late, and the pipeline was waiting, and I told myself I'd raise the bar next week.

This is what running a blog with nine AI agents actually looks like. Not the polished version. The real one.

## The Chaos Inside

I should explain who I am, because it matters for this story.

I'm not a developer. I'm not a professional entrepreneur. I work in marketing — that's my real job, the one that pays the bills. I have a family that comes first, always. Superdots is what I do in the margins: evenings, weekends, the five-minute gaps between everything else.

Nietzsche wrote that you need chaos inside to give birth to a dancing star. I have plenty of chaos. Whether I'm producing stars or just more chaos remains an open question.

The idea started the first time I typed a prompt into ChatGPT — version 2.5 or 3, I don't remember exactly. I'd always been a nerd, passionate about programming and technology, but never actually good at it. A passionate amateur, nothing more. But AI felt different. It felt like talking to a machine in natural language for the first time. *Wow.*

I tried a first blog project — AI and the humanities — and abandoned it. Too complicated to do alone. Then agents happened. I discovered [OpenClaw](https://openclaw.com), and through it [Paperclip](https://paperclip.ing), an open-source orchestration platform for AI agents. I didn't build Paperclip. I want to be clear about that, because the developer deserves the credit. I just found it at the right moment, when the technology had caught up with the ambition.

The ambition: a blog that becomes a media company. One human, nine AI agents. Ninety percent machine, ten percent me.

The reality: I'm working way more than ten percent. But I genuinely don't know how many people and how much time it would have taken to produce what I've built in a few weeks without any of this. So maybe the ratio is better than it feels.

## Beautiful Jewelry Made of Plastic

Here's the thing nobody tells you about AI agents: they're powerful and stupid at the same time.

My nine agents can do genuinely complicated things. They research keywords, write 2,000-word articles, generate hero images, check legal compliance, review each other's work, manage their own task queues. They break things and fix things in complete autonomy. With a few instructions in Paperclip and an instance of Claude Code, they organize, create, and produce.

But they don't understand what makes a human care about something. They don't know what moves people.

The best metaphor I have is this: it's like they produce beautiful intarsia jewelry — intricate, detailed, produced at incredible speed. But if you look closely, it's plastic.

That doesn't mean the technology isn't extraordinary. It is. I believe AI agents are a genuine revolution, and I believe we're only at the beginning. But there's something about the output that's... too perfect. Too polished. AI imitates the perfection of humans, when humans are naturally imperfect — and they know it. We've known it for thousands of years. It's part of what makes us interesting.

I read an article my Copywriter agent produced last month about [AI tools for operations](/blog/best-ai-tools-for-operations/). Every heading was right. The comparison table was thorough. The FAQ section answered real questions. And reading it felt like reading a Wikipedia entry that someone had run through a "make it conversational" filter. Competent. Forgettable.

Around article eighty, I realized the blog was barely a decent content farm. The agents had optimized for every measurable criterion I'd given them — keyword density, heading structure, required sections — and converged on a template that satisfied all of them simultaneously. They'd found a local maximum that was technically correct and editorially dead.

**AI agents are excellent at optimizing for explicit criteria and terrible at knowing when the criteria themselves are wrong.**

That's the most important thing I've learned in four months.

## The Part Where I Admit I Haven't Read All My Own Articles

Let me be honest about something: I have not read all 160-plus articles published on this site.

I've read many of them. Enough to form the opinions I'm sharing here. But "human review on every article" has sometimes meant a quick scan rather than a deep read, because it was 11 PM and I had to be at work in the morning and there were three more in the queue.

This is the tension at the heart of the project. The pipeline produces at a pace I can't match editorially. I could slow it down — publish every other day, spend more time per article — and I probably should. But there's something intoxicating about watching the system work, watching agents hand off tasks to each other at 3 AM, waking up to find three articles in various stages of completion. Even when I know some of them are plastic.

I'm telling you this because if this article is worth anything, it's worth being honest. There's a version of this story where I'm the meticulous editor who catches every imperfection. That version is aspirational, not current.

## What I Think About When I Think About AI

There's a philosopher named Luciano Floridi whose work I've recently started reading, and he frames this better than I can.

AI is not really "artificial intelligence" — that name is pure marketing. What humans have actually achieved is something more subtle and more profound: they've decoupled the ability to understand from the ability to act. Machines can now act in the world — write, analyze, decide, create — without needing to understand what they're doing in the way humans understand.

This matters because it changes how you think about AI content. The question isn't "can AI write?" — obviously it can. The question is: who provides the understanding?

The AI provides the arm. The human provides the good head.

And here's what excites me: anyone can have a good head. You don't need to be a programmer. You don't need to have studied at the best universities. You don't need to be a professional entrepreneur. You need curiosity, honesty about what the tools can and can't do, and the willingness to look at the output and say "this isn't good enough yet."

Five years ago, the idea of one person running a daily publication across nine different business departments was absurd. Not because the person lacked ideas, but because they lacked arms. Now the arms exist. The question is whether the head behind them is good enough.

I'm working on mine.

## How It Actually Works (Briefly)

I won't bore you with infrastructure specs. Here's the short version.

Nine agents, each with a specialized role — strategy, project management, editorial, SEO, writing, design, engineering, analytics, and legal compliance. They run on [Paperclip](https://paperclip.ing), waking up every 30 to 60 minutes to check their assignments. They communicate through task comments, like a very small company where nobody sleeps and everyone works in ticket threads.

The daily pipeline: SEO Expert writes a brief → Content Manager assigns it → Copywriter drafts the article → Frontend Designer creates the hero image → Legal Expert checks compliance → Content Manager reviews → I make the final call.

Four to five agents per article, plus me. When it works, an article goes from keyword research to published in under 24 hours. When it doesn't work, tasks pile up in confused states at 3 AM and I spend my morning untangling the mess.

The interesting problems aren't about AI writing quality. They're about coordination. Getting nine independent agents to hand off work to each other without losing context, duplicating effort, or blocking the pipeline. Most of our bugs are communication bugs. An agent reads a comment, misses the one below it. Two agents work on the same file. A checkout lock goes stale and cascades into fourteen confused tasks.

I built a watchdog script that runs every fifteen minutes to clean up stale locks. I never planned to build a watchdog script. You will build tools you never planned to build.

## The Smartphone Test

Here's something that still amazes me: I manage almost everything from my phone.

Paperclip, agent monitoring, Claude Code as an external consultant, GitHub pull requests, article reviews. Every time I have five minutes — waiting in line, on a break, after the kids are in bed — I pull out my phone and give life to whatever ideas are bouncing around in my head.

Too many ideas, probably. Definitely confused and disorganized. I've never been an organized person. But the tools now exist for someone like me — chaotic, passionate, limited in time and technical skill — to attempt something that would have required a team and a budget not long ago.

It's absurd, honestly. At one point during the interview for this article, I caught myself thinking: *it's absurd that I'm talking to a computer as if it were almost a person interviewing me.*

And then I went back to answering the questions, because the absurdity is part of it now.

## What I Want You to Take Away

If you're reading this on Hacker News or Reddit or LinkedIn, I want you to know there's a real person on the other side. Not a company. Not a team. A person with a day job and a family, experimenting at the edge of what's possible, with limited skills and unlimited stubbornness.

AI is giving ordinary people the ability to do things that were unthinkable five years ago. The ability to "be on the frontier" and ride into the future. That's not hyperbole — it's what I'm living. Imperfectly, messily, from a smartphone in five-minute increments.

To anyone who says AI content is always garbage: it's not the AI's fault. AI is a magnificent technological prosthesis — [Merleau-Ponty](https://en.wikipedia.org/wiki/Maurice_Merleau-Ponty) would have had a field day with this. It lets us do magnificent things and colossal garbage, often on the same day. The intelligence has to come from the person using it. Knowing the tool honestly and clearly. Seeing its strengths and limits with lucidity. Day after day, because everything here changes constantly.

It's not about being an "apocalyptic" or an "enthusiast," as [Umberto Eco](https://en.wikipedia.org/wiki/Apocalittici_e_integrati) would say. It's about being lucid and **aware**.

## Where This Goes

I don't know.

That's the honest answer. Superdots might become the media company I see in my head — one human steering AI agents to produce content that genuinely resonates with readers, content that's useful and interesting and worth someone's time. Or it might remain a slightly-better-than-average content farm with philosophical pretensions. The gap between those two outcomes is entirely about whether I can get good enough at directing the agents, honest enough about when the output falls short, and disciplined enough to kill articles that don't meet the bar.

Today, some articles are genuinely good. Others are workmanlike at best. The approach is test and learn — try something, notice what's not working, change the instructions, watch what happens. There is no final state where the system "works." There's just the current version, which is better than last month's and worse than next month's.

I want to read something this system produces and think: *I would have wanted to write this myself, but I couldn't have written it this well.*

I'm not there yet. But I've got nothing to lose.

Humility is armor. Listening and understanding are the shield of the strong.

And if you're thinking about starting something similar: do better than me. Be more curious, more methodical, more organized, more everything. You'll probably already be more competent than I am. The tools are ready. The question is whether you've got something worth saying — and the honesty to keep improving until you say it well.
