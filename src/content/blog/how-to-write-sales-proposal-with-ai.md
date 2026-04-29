---
title: "How to Write a Sales Proposal With AI (That Actually Gets Signed)"
description: "Most reps write proposals from memory, not from what the buyer said. The 5-step Note-to-Proposal Workflow turns your discovery call notes into a personalized proposal in under an hour."
pubDate: "2026-05-06"
author: "Superdots Team"
contentPillar: "connecting-the-dots"
department: "sales"
useCase: "writing"
tags: ["ai-writing", "sales", "proposals", "ai-tools", "sales-workflow"]
imageHint: "sales rep at a laptop with a split screen showing discovery call notes on one side and a polished proposal document on the other"
faqs:
  - question: "Can AI write an entire sales proposal from scratch?"
    answer: "AI can write a full proposal from scratch, but proposals written without discovery context tend to be generic and fail to address what the buyer actually said on the call. The highest-value use of AI is working from your discovery call notes — that's where AI produces proposals that sound like they were written for a specific buyer. Starting from scratch produces text that could apply to any company."
  - question: "Which AI tool is best for writing sales proposals?"
    answer: "For the workflow in this article, any general-purpose LLM works well — Claude (free at claude.ai, or $20/month Pro), ChatGPT (free or $20/month Plus), or Gemini (free). The quality difference between tools is smaller than the quality difference between prompts. Giving any model your discovery call transcript will outperform a generic prompt in any dedicated proposal tool."
  - question: "How do I make an AI-generated proposal sound less robotic?"
    answer: "Feed the AI your prospect's exact words from the discovery call. If they said 'our biggest issue is that deals keep stalling in procurement,' use that phrase in your prompt. AI mirrors back the language you give it — input their words, get output that sounds like it was written for them specifically. Robotic proposals usually mean robotic inputs, not a model problem."
  - question: "How long should a sales proposal be?"
    answer: "Two to five pages for most B2B deals. AI tends to over-generate — the prompt templates in this guide deliberately cap the executive summary at one paragraph. A shorter, more personalized proposal typically outperforms a longer generic one. If you need detailed pricing or technical specs, consider a two-document format: a short proposal plus a separate appendix."
  - question: "What's the biggest mistake when using AI for sales proposals?"
    answer: "Skipping the discovery context entirely. Prompting AI with 'write a proposal for [company name]' gives you a Wikipedia article about their industry. Prompting with their actual pain points, budget signals, and decision timeline — in their own words — gives you something that maps to their real situation. The discovery call is the most valuable input in the entire workflow."
heroImage: "/images/blog/how-to-write-sales-proposal-with-ai.webp"
---

Most reps write their proposals from memory, not from what the prospect actually said on the call. That's the problem — and it explains why so many AI-generated proposals get deleted without a reply.

Practitioners commonly report spending 2+ hours on proposals that still fail to capture what the buyer actually said on the call. The rest gets filled in from assumptions, product templates, and generic AI output. The buyer reads it, recognizes it could have been written for any company, and files it in the "not urgent" folder.

**The fix isn't a better AI tool. It's a better input.** The 45 minutes you spent on that call — their exact words, their specific problem, their urgency signals — is the raw material that makes a proposal land. Without it, you're just generating polished boilerplate faster.

This guide covers the Note-to-Proposal Workflow: 5 steps from discovery call to a personalized proposal that quotes the buyer back to themselves.

## What most reps get wrong

Most advice about AI and proposals focuses on the wrong variable. It recommends tools (Jasper, Proposify, PandaDoc) when the problem is inputs, not tools.

Three failure modes account for nearly every rejected AI proposal:

- **No discovery context.** The proposal describes what the seller offers, not what the buyer said they need. These proposals feel like product brochures — accurate, irrelevant.
- **Generic tone.** AI produces grammatically correct, professionally bland text by default. "We understand your challenges" sounds sincere the first time a buyer reads it. By the third proposal in a week, it reads like a mail merge.
- **Missed language.** Buyers trust proposals that use their own words back at them. If they said "our pipeline is leaking in the middle stages," a winning proposal says that — it doesn't translate it into "improving mid-funnel conversion rates."

All three problems have the same root cause: the AI was given company-level information, not call-level information.

## The Note-to-Proposal Workflow

The workflow at a glance:

1. Capture the call (transcript or reconstructed notes)
2. Extract buyer pain points using a specific prompt
3. Draft the executive summary
4. Customize the pricing and ROI section
5. Run the objection check before sending

Each step is a 5–10 minute task. The total workflow — from raw notes to a proposal ready to send — runs 45–60 minutes for a typical deal.

## Step 1 — Capture the discovery call (even if you didn't record it)

The transcript is the input for everything that follows. The quality of your proposal directly reflects the quality of the transcript.

**If you record calls**, three tools cover this reliably:

- **Gong** ($1,200+/user/year, enterprise): Full transcription, talk-time analytics, deal intelligence. Best for teams that want call analysis alongside transcription.
- **Fireflies.ai** (free for 3 seats with limits; $19/user/month for unlimited): Works in Google Meet, Zoom, and Teams. The free tier covers most individual reps.
- **Otter.ai** (free for 300 minutes/month; $16.99/user/month Pro): Simpler interface than Fireflies, strong for one-on-one calls. The free tier covers 4–5 standard discovery calls per month.

Connect whichever tool you use to your meeting platform. After the call, you'll have a transcript within 5–10 minutes. Copy the full text into your AI chat window.

If you want to maximize what you capture during the call itself, [AI for Sales Call Prep](/blog/ai-for-sales-call-prep) covers how to build a discovery question framework with AI — the better the call, the richer the transcript input.

**If you didn't record the call**, use this prompt immediately after hanging up, while the context is fresh:

> *"I just finished a discovery call. I need to reconstruct the key points for a proposal. Based on my answers below, give me a structured summary I can use as proposal input:*
>
> *1. What company are they and what do they do?*
> *2. What were the 2–3 biggest problems they described?*
> *3. What have they tried before and why didn't it work?*
> *4. What does success look like for them in 6 months?*
> *5. What did they say about budget, timeline, or decision process?*
> *6. Any specific phrases or numbers they used that stood out?*
>
> *My answers: [fill in]*"

The reconstructed summary won't be as rich as a live transcript, but it captures the most proposal-relevant information in a usable format.

## Step 2 — Extract buyer pain points (the most important step)

This is where the proposal either wins or loses. Your goal: surface the buyer's exact problems, in their exact words, ranked by urgency.

Paste the transcript (or your Step 1 summary) into Claude, ChatGPT, or Gemini. Then run this prompt:

> *"From this discovery call transcript, list the 3 main business problems this buyer mentioned. Rank them by urgency based on the language they used — urgency signals include: 'right now,' 'this quarter,' 'we've already tried,' 'it's costing us.' For each problem, quote the exact words they used to describe it."*

**What good output looks like:**

```
1. [High urgency] Deals stalling in procurement
   Buyer's words: "We keep losing deals in the last stage — it's been three quarters in a row"

2. [Medium urgency] No visibility into deal health until it's too late
   Buyer's words: "By the time we find out a deal is at risk, there's usually nothing we can do"

3. [Lower urgency] Manual forecasting consuming too much time
   Buyer's words: "Our RevOps team spends two days a month just pulling the forecast together"
```

**Why quoting their exact words matters:** your proposal will use their language back at them. This is not a stylistic choice — it's the #1 signal that you listened. Buyers who recognize their own words in a proposal describe it as "feeling like it was written for us."

Save this output. It's the foundation for Steps 3 and 4.

## Step 3 — Draft the executive summary

The executive summary is the first — and sometimes only — section a senior buyer reads. It needs to open with their #1 pain, describe the cost of not acting, and position your solution in one paragraph.

AI is particularly strong here because the executive summary follows a predictable persuasive structure. Given the right inputs, any major LLM produces a solid draft in under 60 seconds.

Use this prompt, filling in the variables from Step 2:

> *"Write an executive summary for a B2B sales proposal. It should:*
> *- Open with this buyer's #1 pain point, using their own language: [paste problem #1 and their quote]*
> *- Describe the cost of continued inaction in one sentence (financial or competitive impact)*
> *- Introduce [your company name] as the solution in one sentence*
> *- Keep the entire summary to 1 paragraph, maximum 5 sentences*
> *- Write in first person plural: 'We understand…', 'Our approach…'*
> *- Avoid: 'leverage,' 'synergies,' 'best-in-class,' 'innovative solution'"*

Review the draft critically: does the first sentence match something the buyer actually said? If it starts with generic framing ("In today's competitive landscape..."), run the prompt again with more specific context from the transcript.

This draft takes under a minute to generate and 3–5 minutes to edit. The editing is where you add the judgment layer — context only you have from the call, any political nuance you picked up, and the specific outcome they care about most.

## Step 4 — Customize the pricing and ROI section

This is the section where human judgment is non-negotiable. AI doesn't know your margins, your deal terms, or what you agreed on during the call. What it can do is build the ROI framing — the narrative that makes your pricing feel like an investment rather than a cost.

Use this prompt after filling in the specifics:

> *"Write an ROI framing paragraph for a sales proposal. Context:*
> *- The buyer's main problem: [their problem in their words]*
> *- Estimated cost of that problem: [use anything they mentioned — time, headcount, revenue impact]*
> *- Our proposed solution: [2-sentence description]*
> *- Our price: [your actual number]*
>
> *Frame this as a payback period: 'At [their cost estimate], [solution name] pays for itself in [timeframe].' Keep it to 2–3 sentences. Don't fabricate numbers I haven't provided."*

The instruction not to fabricate numbers matters — without it, models will sometimes generate plausible-sounding figures. Always verify the output contains only the numbers you supplied.

Add the actual pricing table and deal terms manually. These require human input and often final negotiation context that only you have. For a comparison of AI tools purpose-built for proposal generation (including some that pull pricing directly from your CRM), [AI Proposal Generator: 8 Tools Compared](/blog/ai-proposal-generator) covers the dedicated options.

## Step 5 — Run the objection check before you hit send

This is the step most reps skip. It's also the step that catches the most preventable rejections.

Once your proposal draft is complete, paste the full text and run this prompt:

> *"Read this sales proposal as a skeptical buyer. List the 3 most likely objections this proposal doesn't preemptively address. For each objection, tell me: (1) what the buyer might think that isn't answered, and (2) where in the proposal I should add a sentence or two to address it."*

**What you're looking for:** gaps between what the proposal claims and what a skeptical reader would need to hear. Common catches:

- Implementation concerns that aren't addressed ("how long does this actually take to set up?")
- Pricing that's presented without context ("why does it cost this much?")
- Claims about outcomes that aren't connected to the buyer's specific situation from the call

Fix each flagged gap before sending. This review takes 10–15 minutes and removes the objections that kill deals in procurement — the ones the buyer never actually voices out loud. For teams that want purpose-built tools for this step, [AI Sales Objection Handling Tools](/blog/ai-sales-objection-handling-tools) covers options that integrate objection detection directly with CRM data.

## Try this today

Open claude.ai (free). Find the notes from your most recent discovery call — rough bullet points are fine.

Paste them with this exact prompt:

> *"From these discovery call notes, list the 3 main business problems this buyer mentioned. Rank them by urgency. For each problem, quote the closest thing to their exact words."*

Read the output. If it surfaces a problem you remember but didn't emphasize in the proposal you sent — or a phrase they used that you paraphrased in your own language — that's the leverage you left on the table. Use it in your follow-up.

This takes 5 minutes. If you haven't sent a proposal yet for this deal, use the output to run the full Note-to-Proposal Workflow above before you do.

Once the proposal goes out, the follow-up is where most deals stall — not because the buyer lost interest, but because the check-in emails don't reference what was actually said. [AI for Sales Follow-Up Emails](/blog/ai-sales-emails) covers how to apply the same transcript-based approach to every follow-up.

For how AI applies across the full sales funnel — prospecting, call prep, proposals, close — [AI for Sales: The Complete Guide](/blog/ai-for-sales-complete-guide) covers every stage.

