---
title: "How to Write a Business Continuity Plan with AI: Step-by-Step Prompts and Tools (2026)"
description: "Write a complete business continuity plan using Claude or ChatGPT. Five exact prompts, one per BCP section, plus honest takes on what AI can't do for you."
pubDate: "2026-04-16"
author: "Superdots Team"
department: "operations"
useCase: "writing"
tags: ["ai-tools", "operations", "business-continuity", "chatgpt-prompts", "risk-management"]
imageHint: "operations manager reviewing printed business continuity plan at desk with laptop showing AI chat window open"
faqs:
  - question: "Can AI write a business continuity plan for me?"
    answer: "AI can draft the structure and language of every BCP section — but it cannot supply the actual content. Your recovery procedures, contact lists, backup credentials, and RTO/RPO targets must come from you. A Claude- or ChatGPT-assisted BCP takes 3–4 hours to produce a complete draft. That is the starting point, not the finished plan — you spend another 1–2 hours replacing AI placeholders with your actual data and procedures."
  - question: "What should a business continuity plan include?"
    answer: "A complete BCP covers five sections: Business Impact Analysis (which functions are critical and what downtime costs), Risk Assessment (likely threats ranked by probability and impact), Recovery Strategies (step-by-step restoration procedures), Communication Plan (who notifies who, in what order, on what channel), and Testing Procedure (how you validate the plan before you need it). Skip any section and the gap shows up in an actual incident."
  - question: "How often should a business continuity plan be updated?"
    answer: "At minimum annually — and immediately after any significant change: new vendor, new office, key hire or departure, or any incident that activated part of the plan. The communication section goes stale fastest (phone numbers change, people leave). Most SMBs find a 2-hour annual review sufficient if contact lists are updated continuously throughout the year."
  - question: "What is the difference between a BCP and a disaster recovery plan?"
    answer: "A business continuity plan covers how your entire organization keeps operating during any disruption — staff communications, customer notifications, supply chain alternatives. A disaster recovery plan (DRP) is a subset focused specifically on restoring IT systems and data after a technical failure. BCP is broader; DRP goes deeper on the technology side. Start with a BCP — it forces you to identify which systems matter before you plan how to recover them."
  - question: "Do small businesses need a business continuity plan?"
    answer: "If any of these apply, yes: you have contracts with enterprise clients (many now require vendor BCPs during procurement), you are pursuing SOC 2 or ISO 27001 certification, your business has a single critical point of failure, or you carry business interruption insurance. For everyone else: the AI-assisted process now takes a day instead of a week, and one prevented crisis pays for that time many times over."
---

Most small businesses don't have a business continuity plan. Not for lack of risk — for lack of a realistic process to create one.

The standard BCP guide assumes you have a dedicated risk team, a compliance consultant, and two weeks to populate a 40-page Word template. That's not realistic for the operations manager at a 30-person company who also handles vendor contracts, office logistics, and whatever caught fire this week.

AI changes that. Here's how to write a complete, five-section BCP in three to four hours using Claude or ChatGPT — with exact prompts for each section.

## What a BCP actually needs to include

A **business continuity plan** is a documented process that defines how your organization keeps operating during and after a disruption — a cyberattack, a flood, a key employee leaving suddenly, a supplier collapse. Without a plan, you're improvising under pressure. With one, you're executing a procedure.

Every complete BCP has five sections. Skip one and the plan fails when you actually need it.

1. **Business Impact Analysis (BIA)** — Which functions are critical, what downtime costs per hour, and how long each function can be offline before the damage becomes irreversible.
2. **Risk Assessment** — The specific threats your business faces (data breach, power outage, supplier failure, key person departure), ranked by likelihood and impact.
3. **Recovery Strategies** — Step-by-step procedures for restoring each critical function after each type of disruption. This is where the actual work lives.
4. **Communication Plan** — Who calls who, in what order, using what channels, when a disruption occurs.
5. **Testing Procedure** — How you verify the plan works before you need it in a real emergency.

Most AI-generated BCPs — and most BCP templates — skip sections 4 and 5 entirely, or fill them with generic placeholders. The prompts below prevent that.

Before starting, gather: your list of core business functions, key vendor names and contact information, your IT setup (cloud vs. on-premise, backup frequency and location), and your team directory with roles.

---

## The 5-prompt workflow

Use Claude Pro ($20/month) or ChatGPT Plus ($20/month). Claude tends to produce cleaner structured tables; ChatGPT handles rapid iteration and back-and-forth refinement well. Either works for this.

### Prompt 1 — Business Impact Analysis

Paste this prompt, replacing the bracketed sections with your company's specifics:

> You are a business continuity consultant helping a [e.g. "30-person B2B SaaS company"] write its Business Impact Analysis for a BCP.
>
> Our core business functions are: [list them — e.g., "customer support via Zendesk, product access for customers, payroll via Gusto, billing via Stripe, internal communications via Slack"].
>
> For each function:
> 1. Estimate the financial or operational impact of 1 hour of downtime, 4 hours, and 24 hours.
> 2. Define the Maximum Tolerable Downtime (MTD) — the longest we can be offline before causing irreversible harm (contract breach, customer churn, regulatory exposure).
> 3. Define the Recovery Time Objective (RTO) — the target time to restore each function.
>
> Format as a table: Function | 1-hour impact | 4-hour impact | MTD | RTO

**What good output looks like:** a table with plausible impact descriptions specific to your industry. The AI will estimate ranges — review them against your actual contract penalties and customer SLAs.

**What you must add manually:** actual dollar figures (only you know your revenue per hour), specific contract SLA clauses, and interdependencies between functions (if customer support goes down, does billing follow?).

---

### Prompt 2 — Risk Assessment

> Using the business functions from our BIA, create a Risk Assessment section for our BCP.
>
> Our company: [size, location, industry, remote or office-based, key infrastructure dependencies — e.g., "25 employees, Austin TX, SaaS, hybrid work, primary systems on AWS, third-party payment processor Stripe"].
>
> For each of these risk categories, identify the 2–3 most relevant specific threats. For each threat: estimate likelihood (1–5), estimate impact (1–5), calculate risk score (likelihood × impact), and suggest a primary mitigation.
>
> Categories: Cybersecurity | Physical/facility | Key person dependency | Supplier/vendor failure | Utility/infrastructure | Natural disaster
>
> Format as a table: Threat | Likelihood | Impact | Risk Score | Mitigation

**What good output looks like:** specific, plausible threats — not "hackers might attack." The highest-scoring threats become the focus of Section 3.

**What you must add manually:** your actual cyber insurance coverage, your building's redundancy (backup generator, secondary ISP), and any industry-specific regulatory risks the AI may not know about.

---

### Prompt 3 — Recovery Strategies

> Based on our Risk Assessment, create Recovery Strategies for our three highest-risk threats: [paste the top 3 rows from your risk table].
>
> For each threat, provide:
> 1. Immediate response actions (first 0–4 hours)
> 2. Short-term recovery steps (4–48 hours)
> 3. Full recovery steps (48 hours+)
> 4. Who is responsible for each stage (use role titles, not names)
> 5. What tools or vendors are needed
>
> Also include:
> - Data backup verification procedure
> - Work-from-home activation procedure
> - Temporary vendor alternative process if our primary vendor is unavailable

**What good output looks like:** step-by-step procedures with explicit role ownership. "IT lead triggers cloud backup restore from [provider]" is useful. "Restore backups" is not.

**What you must add manually:** actual backup credentials and locations, specific vendor contact information, and any procedures specific to your IT stack. This is where the plan becomes real — AI cannot access your systems or know your actual recovery sequence.

---

### Prompt 4 — Communication Plan

> Create a Communication Plan section for our BCP. Our team has [X] people. Key external stakeholders: [clients, investors, key vendors, regulatory bodies if applicable].
>
> Provide:
> 1. Internal communication cascade: who is notified first, who notifies them, what information is included in the initial alert, what channels are used if Slack and email are down.
> 2. Client communication templates for: cyber incident, physical disruption, service outage.
> 3. Vendor notification procedure.
> 4. Media/PR protocol if the incident becomes public: what we say, who speaks, who approves messaging.
>
> Include a decision tree: "If [disruption type], notify [role] within [time] via [channel]. If that channel is unavailable, use [backup]."

**What good output looks like:** a cascade with named roles and specific backup channels. Decision tree format is critical — in an actual crisis, people follow decision trees, not paragraph prose.

**What you must add manually:** actual names and mobile phone numbers. Never store the only copy of this list in a document that lives on a server that might be the thing that went down.

---

### Prompt 5 — Testing Procedure

> Create a Testing Procedure section for our BCP. We want to validate the plan annually before we need it.
>
> Design:
> 1. An annual tabletop exercise: a scenario walkthrough with the leadership team, no real systems activated. Duration: 2 hours. Provide a facilitator guide and 3 scenario options based on our risk assessment.
> 2. A quarterly communication test: verify the notification cascade actually reaches everyone.
> 3. A semi-annual data recovery test: verify backups can actually be restored to a functional state.
>
> For each test: objective, participants, duration, pass/fail criteria, and how findings update the main plan.

**What good output looks like:** runnable procedures with clear pass/fail criteria. A test with no defined pass criteria is theater, not validation.

**What you must add manually:** schedule the first tabletop exercise right now — put it in your calendar before closing this document. Assign the person responsible. A plan that has never been tested has unknown failure modes.

---

## Where to store and maintain your BCP

The best BCP is one your team can find in an emergency. Most plans fail not because they were poorly written, but because they lived in a folder no one remembered on a drive that required VPN access — which was down because the VPN server was the thing that failed.

Three options, in order of reliability:

- **Notion** (free–$10/month) — A dedicated BCP workspace with linked databases for contacts, vendors, and procedures. Easy to update, mobile-accessible. Strong if your team is already in Notion.
- **Google Workspace** (free–$6/month) — A shared Google Doc works fine. Advantage: everyone knows how to use it, and it's accessible when internal systems are down. Make the link explicitly public or share it with everyone's personal email, not just work accounts.
- **Printed offline backup** — Print the communication cascade and store it in a physical binder accessible to whoever opens the office. This sounds outdated. It is not. Fires, floods, and extended power outages make every digital-first plan useless at exactly the wrong moment.

Set a calendar event for the annual review. When a significant change happens — new vendor, new office location, key role changing hands — update the relevant section immediately. Don't save it for the annual review.

For a broader view of AI tools that support ongoing operations management, see our guide to the [best AI tools for operations](/blog/best-ai-tools-for-operations/).

---

## When paid BCP software makes sense

For most SMBs, the free AI workflow above is sufficient. The table below covers when dedicated platforms start earning their cost:

| | Free AI workflow | Paid BCP software (e.g. Kuali Ready, Continuity2) |
|---|---|---|
| **Cost** | $20–$40/month (Claude/ChatGPT) | $150–$500+/month |
| **Time to first draft** | 3–4 hours | 1–2 hours (guided templates) |
| **Compliance-ready** | No — requires professional review | Often yes — designed for SOC 2, ISO 22301 |
| **Requires IT involvement** | No | Sometimes |
| **Best for** | Under 50 employees, basic client or insurance requirements | Companies with audit mandates, 50+ employees, or recurring compliance cycles |

Triggers that justify the upgrade:
- You're pursuing SOC 2, ISO 22301, or similar certification
- Enterprise clients require BCP evidence as part of vendor qualification
- You've had an actual incident and the plan failed a real test
- Your team has grown to the point where manual updates are a genuine maintenance burden (typically 50+ employees)

Kuali Ready (from approximately $150/month, based on publicly available pricing) and Continuity2 (custom pricing, mid-market focus) are the two platforms most frequently mentioned in SMB operations discussions. Neither is worth the cost for a 20-person company unless compliance is specifically mandated.

---

## What AI can't do — the part most guides skip

This section matters more than the prompts above.

**AI produces structure, not substance.** A prompt asking AI to write your Recovery Strategies will return a procedure that says "restore from cloud backup." Your team must fill in: which provider, which bucket or repository, what credentials, what restore order, what to do if the primary contact is unavailable. The skeleton is useful. A skeleton with empty placeholders creates false confidence.

**AI cannot know your real contact lists.** Every communication plan it generates uses role titles and placeholder names. Replace every placeholder with an actual person and their mobile number — not their work email, which may be inaccessible during the incident that just took down your systems.

**AI will estimate RTO and RPO targets, not derive them.** Recovery Time Objectives and Recovery Point Objectives depend on your actual infrastructure and contracts. A backup system that runs every 24 hours gives you an RPO of 24 hours regardless of what the AI suggests as a target. Know your actual baseline before you commit targets in the plan.

**AI won't catch your implicit assumptions.** It won't flag that your "restore backups" step assumes someone has access to the admin console managed by the employee currently traveling internationally. Human review — ideally by someone who has run a BCP tabletop before — surfaces the assumptions baked into AI-generated procedures. At minimum, have someone who was not involved in writing the plan read and annotate it.

---

## What most operations managers get wrong

Even with a strong workflow, a few patterns consistently appear in plans that fail when actually used:

**Building a plan no one has read.** A BCP that only the person who wrote it has reviewed is a liability, not an asset. At minimum: leadership team reads it, key role-owners confirm their sections are accurate.

**Keeping the only contact list inside the plan.** If your contact list lives exclusively in the BCP document, and the BCP is on a server that just went down, you have no way to call anyone. Maintain a separate, offline-accessible emergency contact list — in a physical folder, on a personal phone, somewhere outside your primary systems.

**Skipping the tabletop exercise.** A plan that has never been walked through has unknown failure modes. Run a 2-hour scenario exercise before you need the plan in a real incident. One tabletop will surface more gaps than a week of document revisions.

**Treating the first AI draft as final.** The prompts above produce a strong first draft. Your team needs to annotate every section where a placeholder or generic instruction maps to something specific in your environment. That annotation process is where the plan becomes real and usable.

---

Three to four hours is a realistic investment for a first draft that covers all five sections. That's less time than most operations managers spend recovering from a minor incident they didn't see coming. The prompts are reusable: run through them once to build the plan, then update section by section as your company changes.

Start with Section 1 — the Business Impact Analysis — before anything else. Knowing which functions matter most shapes every other section.
