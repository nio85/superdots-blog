---
title: "AI Agents at Work: What's Real and What's Marketing"
description: "Every vendor now offers 'agentic AI.' Most of it is marketing. Here's what AI agents actually do in production today, and why the gap matters before you spend budget."
pubDate: '2026-06-13'
author: "Superdots Team"
contentPillar: "the-big-picture"
tags: ["ai-agents", "enterprise-ai", "ai-adoption"]
imageHint: "abstract geometric network of interconnected nodes and branching pathways on deep navy, multiple parallel teal and amber lines converging toward a central glowing point, layered depth suggesting parallel processes running simultaneously"
heroImage: "/images/blog/ai-agents-at-work-reality-check.webp"
---

Every software company launched an "agent" in 2025.

Some of them are genuinely novel. Many are chatbots with better marketing copy. The industry has shifted from arguing about whether AI would change work to arguing about what, exactly, counts as an agent — and buyers are navigating that debate with real budget and real timelines.

This matters more than it might seem. The gap between what "agentic AI" means in a sales demo and what it means in a production environment over six months tends to be significant. Getting that gap wrong is expensive — not just in licensing costs, but in the organizational energy spent on deployments that fail to deliver what was promised.

## What Actually Changed at the Infrastructure Level

The shift that made agents architecturally possible is real, even if many of the vendor claims built on top of it are not.

Large language models became capable of something they previously couldn't do reliably: sustained, multi-step reasoning. Earlier versions of these systems were good at single-turn responses — you ask, the model answers, the interaction ends. Newer architectures can maintain context across a sequence of steps, decide what tool to call next, execute that tool call, inspect the result, update their understanding, and continue. This is a genuine capability change, not just incrementally better text generation.

What follows from this is that you can now build software systems where a language model acts as the coordinator of a workflow — receiving a high-level goal, decomposing it into constituent tasks, calling external APIs, retrieving information from databases, handing off to other models for specialized subtasks, handling errors, and returning a result. This is meaningfully different from a search bar, a summarization button, or a chatbot. Those are single-turn interfaces. Agents are systems with state, with memory (within bounds), with the ability to take actions and observe consequences.

The question isn't whether this architecture exists. It does — and it works. The question is what it can do reliably in production, at scale, over weeks and months, and at what cost. On those dimensions, the honest answers are considerably less exciting than what gets shown on stage at conferences.

## What Vendors Claim

The vendor framing, broadly, is that AI agents can handle complex, multi-step knowledge work autonomously — that you can describe a goal at a high level, walk away, and return to a completed deliverable that meets professional quality standards. The marketing often implies near-unlimited context, near-zero error rates, and seamless integration with any existing software stack through natural language alone.

Gartner's 2025 Hype Cycle for Artificial Intelligence placed AI agents among the fastest-advancing technologies on the curve — likely sitting at or very near the peak of inflated expectations. That framing is consistent with the volume of vendor announcements over the past eighteen months. Every category of enterprise software — CRM, ERP, project management, customer support platforms, HR systems — has announced agents. The word "agentic" has joined "cloud-native," "AI-powered," and "digital transformation" in the lexicon of terms that now mean approximately nothing without further specification.

The interesting question isn't whether agents are real. Some of them are, and they matter. The interesting question is what "agent" means in each specific context, and whether that definition corresponds to anything that solves the buyer's actual problem.

Vendors don't have an incentive to answer that question carefully. Buyers do.

## Three Failure Modes That Don't Show Up in Demos

Enterprise AI adoption surveys paint a more cautious picture than vendor announcements. McKinsey's Global Survey on AI has consistently found that the gap between organizations experimenting with AI and those seeing measurable, scaled ROI remains large. Deloitte's AI surveys report similar patterns: high rates of pilot activity, lower rates of production deployment, even lower rates of material business impact.

Three failure modes appear consistently in real deployments. None of them are visible in controlled demos, because controlled demos are designed around best-case inputs with known parameters — precisely the conditions that don't exist in production workflows over time.

**Context window limitations.** Agents operating on long documents, large datasets, or extended conversation histories eventually hit context limits — the point at which the model can no longer hold all relevant information in active memory. When this happens, the agent must summarize or truncate earlier context to make room. For short-horizon tasks, this is manageable. For anything requiring sustained coherence across a complex, multi-week project — a legal review of a contract portfolio, a competitive analysis spanning dozens of documents, a cross-functional workflow that accumulates state over time — context degradation is a real constraint that current architectures handle imperfectly. Vendors don't advertise this. It surfaces when the agent "forgets" a decision it made three steps ago and contradicts itself.

**Hallucination in multi-step chains.** Single-step LLM errors are well understood at this point: the model generates plausible-sounding content that isn't factually accurate. In agentic chains, this problem compounds in a way that's harder to detect. A small factual error in step two becomes an input to step three, which treats it as ground truth and builds on it. By step six or seven, the output can be internally consistent, confidently stated, and significantly wrong in ways that aren't immediately obvious. Human review is still required at every point in the chain where error propagation matters — and in most professional business contexts, that's most of the chain. The automation value is real but bounded.

**Coordination overhead.** The promise of agents is reduced human effort — fewer steps, fewer handoffs, less coordination work. The reality, in many current deployments, is that agents introduce a new coordination layer rather than replacing the old one. Someone has to define the goal precisely enough for the agent to execute it correctly. Someone has to verify the output. Someone has to handle exceptions — and current agents generate exceptions more frequently than the demos suggest. Organizations in early deployment often find that the net effect has been to redistribute human work rather than reduce it: the work shifts from executing the task to specifying, supervising, and correcting the agent. That can still be a net win, but it's a different kind of win than was advertised.

## What Isn't Changing

It's worth being precise about what agents can't change, because the marketing often implies the opposite.

Agents don't eliminate the need to define what good looks like. Before an agent can execute a task, a human has to specify the goal, the constraints, the acceptable outputs, the quality standards, and the failure conditions. This turns out to be the hardest part of most knowledge work — harder than the execution. It requires domain expertise, judgment, and accountability that don't transfer to the model. An agent that can execute a well-specified task very quickly and at low marginal cost is genuinely valuable. But the specification still requires a human who understands what the organization is actually trying to achieve.

Agents don't eliminate error rates; they shift where errors occur. In traditional workflows, errors happen when humans misunderstand instructions, make arithmetic mistakes, or skip steps under time pressure. In agentic workflows, errors happen when the agent misinterprets goals, generates incorrect facts, or makes unexpected tool calls. The error profile changes substantially. The need for review, correction, and audit doesn't disappear — it relocates and, in the short term, often requires more sophisticated monitoring than the manual workflow did.

Agents don't remove the need for thoughtful system design. The organizations seeing genuine results from agent deployments have invested in workflow architecture: careful task decomposition, well-defined handoffs between agents and humans, exception handling protocols, audit trails, logging, and monitoring infrastructure. This is engineering work. It requires time and expertise. Organizations that approach agents as a plug-and-play automation layer — expecting to describe a goal and have the system figure out the rest — tend to discover this the expensive way.

The organizations that talk most credibly about agents in production are the ones that have done this design work and are modest about what it took.

## What Real Deployments Look Like

The applications of agents that are working reliably in production today tend to share a few structural characteristics.

The task scope is narrow and well-bounded. Rather than "manage our customer support operation," the productive agent deployment handles a specific, defined subtask: classify incoming tickets by category and urgency, draft a first-response to tier-one queries for human review, extract structured information from unstructured complaints. The scope is narrow enough that the agent's context window is sufficient, the output is verifiable by a non-expert, and the exception rate is manageable.

The output is verifiable. Agents working on tasks where the output can be checked against objective criteria — did the data transform correctly? does this draft meet the template requirements? are these contract clauses flagged accurately? — outperform agents working on tasks where quality is subjective or requires deep domain judgment. This isn't a permanent limitation, but it's where the reliability bar sits now.

Human review is designed into the workflow, not bolted on as a hedge. The organizations seeing the best results treat agents as the first pass, not the final output. An agent drafts; a human reviews and approves. An agent extracts; a human verifies. An agent flags; a human decides. This is slower than the fully autonomous vision, but it's the version that works at the quality standards most professional contexts require.

And critically: they've accepted that the first deployment is a learning exercise. Production experience surfaces edge cases that weren't visible in the specification phase. The second and third iterations, informed by that experience, work substantially better. The organizations treating agent deployment as a capability they're building — rather than a product they're installing — are the ones developing durable operational advantages.

## The Market Structure That's Shaping the Claims

It helps to understand why the gap between marketing and reality is so wide right now. Part of it is the usual dynamics of a new technology category — vendors sell aspirational capabilities, buyers learn through experience. But there's a more specific structural factor at work.

The underlying LLM capabilities improved dramatically between 2022 and 2024 — faster than enterprise deployment cycles, governance frameworks, or institutional knowledge about how to use them. Vendors who built on these models saw their capabilities jump significantly between product releases. Roadmaps that were speculative in 2023 became technically feasible in late 2024. Sales teams started selling capabilities that were real in demos, real in controlled environments, and real for specific narrow use cases — but not yet ready for the full-scope applications that the demos implied.

This isn't fraud. It's the normal compression of enterprise software timelines that happens when the underlying technology moves faster than production deployment experience. The problem is that buyers don't always have the context to read the fine print, and the fine print matters.

The other factor is competitive pressure. When one vendor announces agents, the others follow. By mid-2025, not having an "agentic" product was a perceived competitive disadvantage — so everyone had one, regardless of whether the underlying capability matched the category name. This is not new behavior in enterprise software. What's new is the speed.

The net effect is that buyers are evaluating a category where the terminology is shared but the implementations vary enormously. One vendor's "agent" is a multi-step workflow with real tool-calling, memory, and error recovery. Another vendor's "agent" is a chat interface that can call one API. Both use the same word. Both show demos that look impressive in isolation. Distinguishing between them requires asking the right questions, and knowing the right questions requires understanding what agents actually do.

## The Hype Cycle's Blind Spot

The Gartner framework is useful for tracking where a technology sits relative to inflated expectations at an aggregate level. Its limitation is that it doesn't distinguish between the parts of a technology category that are real now, the parts that will become real in eighteen months, and the parts that are indefinitely speculative.

For AI agents in 2025, that breakdown looks approximately like this. Reliably productive now: narrow, structured workflows with verifiable outputs, bounded context requirements, and human review built in by design. Emerging and inconsistent: multi-domain coordination, open-ended research assistance, complex decision support. Still mostly marketing: fully autonomous knowledge work, end-to-end business process replacement, "set it and forget it" automation of anything requiring professional judgment.

The vendors selling the third category aren't necessarily being dishonest about the direction. The trajectory is probably right. But the timeline implied in the marketing doesn't match what's deployable today, and buyers making decisions on that implied timeline are making different bets than buyers who understand what exists now.

## What This Means if You're Evaluating Agents

The most useful question to ask any vendor is not "what can your agent do" but "show me a production deployment where this agent has been running unsupervised for sixty days at a client with similar requirements, and walk me through the error log." That question produces a materially different conversation than a demo.

The second useful question is about failure modes. What does the agent do when it encounters an edge case it wasn't trained for? Who gets notified? How is the error surfaced, and how is it corrected? What does the audit trail look like? Vendors who have shipped in real environments have answers to these questions that are specific and sometimes unflattering. Vendors who have only run demos in controlled conditions often don't.

This doesn't mean organizations should wait. The companies developing real experience with narrow, well-scoped agent deployments are building institutional knowledge — about goal specification, workflow architecture, error handling, monitoring, and output evaluation — that will compound in value as the underlying models improve. The advantage isn't in buying the best agent available today. It's in understanding what agents can and can't do before the decisions become larger, more expensive, and harder to reverse.

Every technology that changes how knowledge work gets done eventually gets absorbed into normal practice. The question is when, at what cost, and with how much judgment applied during the transition. On all three of those questions, the current marketing answers are optimistic.

The underlying technology is real. The specific claims made about it — the scope, the autonomy, the reliability — mostly aren't yet. That gap will close. The organizations that understand it clearly now will be better positioned when it does.

---

*Superdots runs nine specialized AI agents in production, each with defined roles, budget limits, handoff protocols, and monitoring. This piece reflects that production experience.*
