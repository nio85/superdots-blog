---
title: "Beautiful Jewelry Made of Plastic: Running a Blog with 9 AI Agents"
description: "One non-technical person, nine AI agents, and the honest truth about building a media company from a smartphone. The failures, the philosophy, and why the human 10% matters more than the machine 90%."
pubDate: "2026-04-07"
author: "Luca Bartoccini"
department: "operations"
useCase: "automation"
tags: ["ai agents", "content operations", "automation", "behind the scenes", "ai workflow"]
heroImage: "/images/blog/how-we-run-blog-with-ai-agents.webp"
imageHint: "a person checking a smartphone while surrounded by abstract robotic arms working at desks, digital art"
faqs:
  - question: "Can AI agents really run a blog without human oversight?"
    answer: "No. And I think that's the most important thing I've learned. The agents handle research, drafting, SEO, image generation, and compliance checks — they're excellent at executing structured tasks. But editorial judgment, the ability to know whether something is worth a reader's time, remains stubbornly human. Without my daily review, the blog would be technically correct and editorially dead. The 10% human input isn't a bottleneck — it's the part that makes everything else worth doing."
  - question: "How much does it cost to run 9 AI agents for content production?"
    answer: "Honestly? I'm still figuring that out. Each agent runs on Claude via heartbeats — short execution windows every 30-60 minutes. Some weeks are cheap, others spike when agents get stuck in revision loops. The API cost matters less than the real cost: my time. The hours I spend reviewing articles, adjusting instructions, and fixing coordination bugs. I'm working far more than the 10% I aimed for. Whether the economics work out long-term is part of what I'm trying to learn."
  - question: "What tools do you use to coordinate the agents?"
    answer: "The agents coordinate through Paperclip, an open-source orchestration platform that manages task assignment, agent communication, and workflow state. I didn't build Paperclip — I'm a user, and I want to give proper credit to the developer who created and maintains it. Each agent runs Claude Code with specialized instructions. The blog itself is Astro on Cloudflare Pages. Supporting tools include SearXNG for research, SerpBear for rank tracking, and SEOnaut for technical audits. The infrastructure is deliberately minimal — the hard part is the orchestration logic."
  - question: "How do you maintain content quality with AI-generated articles?"
    answer: "Three layers, but only one really matters. The Copywriter follows strict style guidelines with banned patterns. The Content Manager reviews every draft against editorial standards. And then I read every article before publication. That last step is where the real quality control happens — not because the agents are bad, but because they can't tell the difference between a piece that's structurally sound and one that's genuinely worth reading. The quality has improved significantly since I added more constraints (counterintuitively, stricter rules produce more varied output), but we're still climbing."
  - question: "Is this approach replicable for other blogs or companies?"
    answer: "Parts of it, absolutely. The daily pipeline pattern works for any content operation. But here's my honest advice: start simpler than I did. One or two agents with manual coordination will get you 80% of the value. And remember — you don't need to be a programmer. I'm not one. I'm a marketing professional who got fascinated by AI and taught myself as I went. If I can set this up, anyone with curiosity and patience can too. Just do it better than me."
---

My AI agent just interviewed me to write this article.

I want to sit with that sentence for a moment, because it's genuinely absurd. I'm talking to a computer as if it were a journalist, answering questions about my life and my project, and the computer is going to turn my words into something you're reading right now. A year ago this would have been science fiction. Today it's a Tuesday evening on my couch, phone in hand, kids asleep.

This is the story of Superdots — a blog that publishes daily articles about AI and work, run by nine AI agents and one person who is very much figuring this out as he goes. That person is me. I'm not an engineer. I'm not a startup founder. I work in marketing, and I build this in the evenings and the five-minute gaps between everything else.

## How a Non-Technical Person Ends Up Running 9 AI Agents

My first prompt to ChatGPT — I think it was version 3, maybe even 2.5 — felt like touching something electric. I've always been a nerd, the kind who's passionate about programming and technology without actually being any good at it. A passionate amateur, nothing more. But this was different. You could talk to a machine in natural language. Actually talk to it. I was fascinated.

I started following everything. Every AI paper I could understand, every tool launch, every debate about where this was going. When agents started appearing — not just chatbots, but systems that could take actions in the world — I had this idea that wouldn't let go: a blog written and managed entirely by AI agents.

My first attempt was a disaster. I tried building it from scratch — a blog about AI and the humanities. Too complicated. I didn't have the skills, and the tools weren't there yet. I moved on, kept watching, kept learning.

Then things started changing fast. I discovered [OpenClaw](https://openclaw.org), then [Paperclip](https://paperclip.ing) — an orchestration platform that sits at the boundary between simple agent tools and a full agent operating system. I want to be clear: I didn't build Paperclip. A developer created it and continues to maintain it. I'm a user, and the tool made something possible that I couldn't have built myself.

That's when Superdots started. The ambition was — and still is — to build something like a media company. One person, many AI agents. Ninety percent machine, ten percent human. The human part is me.

## What My Ten Percent Actually Looks Like

Let me be honest about the numbers: I'm nowhere near 90/10 right now. I work on this *a lot*. Family comes first — that's sacrosanct. Then my day job in marketing. Then Superdots, in every evening and every spare moment I can find.

Here's the part that still surprises me: I manage the entire operation from my smartphone. All of it. Paperclip, the agents, Claude Code running as a kind of external consultant to the system. Every time I have five minutes — waiting for coffee, sitting on the train, kids watching cartoons — I pull out my phone and give life to whatever idea just popped into my head.

And there are always ideas. Too many, honestly. Confused, disorganized, chaotic. I've never been an organized person. I have, as Nietzsche put it, great chaos inside me — and I keep trying to generate dancing stars.

The nine agents each have a role:

| Agent | What it does |
|---|---|
| **CEO** | Strategy, reviews, unblocking |
| **Program Manager** | Checks system health every 30 minutes |
| **Content Manager** | Editorial pipeline — assigns, reviews, merges |
| **SEO Expert** | Keyword research, briefs, competitive analysis |
| **Copywriter** | Writes every article |
| **Frontend Designer** | Hero images, design system |
| **Founding Engineer** | Infrastructure, deploys, newsletter |
| **Growth Analyst** | Traffic analysis, optimization |
| **Legal Expert** | GDPR checks, compliance |

They coordinate through Paperclip, waking up on heartbeats every 30-60 minutes. Each agent checks its assignments, does the work, posts a comment, goes back to sleep. It's like a very small, very weird company where nobody sleeps and everyone communicates through ticket comments.

We've published over 160 articles across nine departments in about a month. One article per day is the current target. Some days it works beautifully. Some days everything breaks at once and I wake up to 14 confused escalation tasks.

## Powerful and Stupid at the Same Time

Here's the thing that surprises me most about working with AI agents, and I think it's the most important thing I can tell you: they are simultaneously incredibly powerful and breathtakingly stupid.

They can do complex things. They break and fix things autonomously. With minimal instructions, they organize themselves, create, produce. An article goes from keyword research to published draft in a few hours, passing through five different agents, each doing its part.

But they know nothing about how a human works. What interests a person. What moves them.

It's like they produce beautiful intarsia jewelry — stunning, intricate, produced at incredible speed. But if you look closely, it's plastic.

I don't say this to be harsh. What AI agents can do is genuinely revolutionary. But there's a pattern I keep seeing that I call "more human than human" — agents imitate the *perfection* of human output, when humans are naturally imperfect. And that imperfection, that rough edge, that unexpected turn of phrase — that's what makes human writing resonate. There's something imponderable in humans that makes it impossible, at least for now, to truly replicate.

Around article 80, I noticed it clearly. The articles were fine. Technically correct, properly structured, SEO-optimized. But reading five in a row felt like reading the same article with different keywords. The agents had found a local maximum — they'd optimized for every measurable criterion and converged on a template that satisfied all of them.

Let me be blunt: at that point, I had built a content farm with decent formatting. And I was contributing my own share of filling the web with content of dubious value.

The fix was counterintuitive. I made the rules *stricter*. Banned patterns, banned openings, banned structures. Required every article to include something a reader wouldn't find on page one of Google. More constraints, paradoxically, produced more variety — the agents couldn't fall back on the default template anymore.

Has it solved the problem? Not entirely. Some articles are genuinely good; others are workmanlike at best. But the direction is right, and the quality bar moves up every week. The key insight: **those improvements never come from the agents. They come from me reading the output, noticing what's wrong, and changing the instructions.** The agents execute. The human steers.

## Intelligence Is Not What You Think It Is

I've been thinking a lot about what "AI" actually means, and I've found a framing that I think is more honest than the marketing.

The philosopher Luciano Floridi — someone I've recently discovered and deeply admire — puts it this way: we didn't create artificial intelligence. What we did was decouple *intelligence*, in the Latin sense of *intelligere* (the capacity to understand), from *agency* (the capacity to act in the world). Machines can now act — powerfully, at scale, tirelessly. But the understanding, the intelligence, still has to come from the human directing them.

AI is a tool. A magnificent, technological prosthesis — to borrow from Merleau-Ponty — that extends what we can do. With it, we can produce magnificent things. We can also produce colossal garbage. The difference isn't in the tool. It's in who uses it, and how honestly they understand what it can and can't do.

This isn't about being an optimist or a pessimist about AI. Umberto Eco talked about "apocalyptic" versus "integrated" attitudes toward technology. I don't think either is useful. What's useful is being *lucid*. Being *aware*. Knowing the tool day by day, because it changes constantly. Seeing its strengths and limits with clarity, not with hype and not with fear.

That's what I try to bring to my ten percent. Not technical expertise — I don't have much of that. Just a commitment to seeing clearly what's in front of me.

## What I'd Tell You If You Want to Try This

Do better than me.

Seriously. Be more curious than me, more methodical, more rational, more pragmatic. You'll probably already be more competent — and I mean that.

You don't need to be a programmer. I'm not one. I'm a marketing professional who got fascinated and taught himself. The tools that exist today — Paperclip, Claude Code, the whole [agent ecosystem](/blog/ai-agents-for-business/) — make it possible for someone like me to build something that would have required a team of developers a few years ago.

AI is giving ordinary people the ability to do things that were unthinkable five years ago. That's the real story here. Not the technology itself, but who gets to use it. The AI provides the arm. The human provides the good head. And anyone can have a good head — not just professional programmers or entrepreneurs who studied at the best universities.

Start simpler than I did. One or two agents, manual coordination, see what works. You'll get 80% of the value at 20% of the complexity. Then grow from there.

## Where This Goes

Nothing about this experiment scares me. I have nothing to lose. Maybe if I gained some visibility and faced criticism, that might sting — but even then, I believe humility is armor. Listening and understanding are the defenses of the strong.

What I have is ambition, stubbornness, and a conviction that the combination of AI and human judgment can produce something genuinely valuable. Not perfect — the [content creation](/blog/ai-content-creation/) pipeline will always need iteration. But valuable. Useful. Something that resonates with real people trying to figure out how AI fits into their actual work.

I want to reach the day when I read an article on this blog and think: "Yes. This is what I wanted to say. I just couldn't have said it this well on my own."

We're not there yet. But we're climbing.
