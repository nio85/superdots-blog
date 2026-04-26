#!/usr/bin/env python3
"""
Add imageHint frontmatter field to articles that are missing it.
Run from the project root: python3 scripts/add-imagehints.py
"""
import re
import os

BLOG_DIR = "src/content/blog"

# Map of filename (without .md) -> imageHint
IMAGE_HINTS = {
    "ai-accounting-software": "accountant reviewing financial dashboard on laptop with invoices on desk",
    "ai-accounts-receivable": "finance professional reviewing unpaid invoices on dual-monitor workstation",
    "ai-ad-copy-tools": "marketer reviewing multiple ad copy variations on screen with analytics sidebar",
    "ai-agents-for-business": "business professional overseeing multiple AI agent task cards on digital dashboard",
    "ai-api-documentation": "developer reading auto-generated API docs on dark-theme code editor",
    "ai-audit-preparation": "auditor organizing evidence folders with AI tool surfacing relevant documents",
    "ai-automation-for-business-complete-guide": "operations manager setting up automated workflow on laptop with process diagram",
    "ai-automation-guide": "non-technical professional dragging and dropping workflow steps in no-code builder",
    "ai-brand-identity-tools": "entrepreneur reviewing AI-generated logo variations and color palettes on screen",
    "ai-brand-monitoring": "marketing manager viewing real-time brand mention feed and sentiment graph",
    "ai-budgeting-tools": "non-finance team member reviewing department spending breakdown with AI chart",
    "ai-cash-flow-forecasting": "CFO looking at 90-day cash flow forecast chart with confidence intervals",
    "ai-change-management": "team leader facilitating AI adoption workshop with digital roadmap on screen",
    "ai-chatbot-builder": "product manager configuring AI chatbot conversation flow in visual drag-drop editor",
    "ai-code-generation-tools": "developer with AI autocomplete generating function code in dark IDE",
    "ai-code-migration": "engineer reviewing legacy code alongside AI-refactored version in split screen",
    "ai-code-review-tools": "developer reading AI-annotated pull request with inline suggestions highlighted",
    "ai-cold-outreach": "sales rep reading AI-personalized cold email draft with prospect research panel open",
    "ai-color-palette-generator": "designer comparing brand-matched color swatches generated from company logo",
    "ai-compensation-benchmarking": "HR manager comparing salary ranges across roles on compensation benchmark tool",
    "ai-competitive-analysis": "sales professional reviewing AI-generated competitor comparison report before a call",
    "ai-competitive-intelligence-sales": "sales team reviewing competitor intel dashboard with win/loss analysis",
    "ai-compliance-tools": "compliance officer reviewing flagged regulatory requirements on digital dashboard",
    "ai-content-creation": "content marketer reviewing AI-drafted blog post with editing toolbar visible",
    "ai-contract-clause-extraction": "lawyer reviewing extracted contract clauses in structured table on screen",
    "ai-contract-management": "legal ops professional reviewing contract status pipeline in lifecycle management tool",
    "ai-contract-review-non-lawyers": "business professional reviewing AI-highlighted contract risk areas without legal background",
    "ai-conversation-intelligence": "sales manager reviewing call transcript with AI-tagged key moments and coaching tips",
    "ai-crm-tools": "sales rep viewing AI-suggested next actions in CRM activity feed",
    "ai-customer-feedback-analysis": "CX analyst viewing AI-categorized customer feedback themes and sentiment trend chart",
    "ai-customer-journey-mapping": "UX researcher reviewing AI-generated customer journey map with touchpoints and pain points",
    "ai-customer-onboarding": "customer success manager reviewing automated onboarding checklist with progress indicators",
    "ai-customer-retention": "retention analyst viewing churn risk scores and recommended intervention actions",
    "ai-customer-self-service": "customer typing question into self-service portal and receiving instant AI answer",
    "ai-customer-sentiment-dashboard": "CX team viewing real-time sentiment heatmap with positive and negative score trends",
    "ai-customer-service-chatbot": "support team configuring chatbot conversation flow without writing any code",
    "ai-customer-service-qa": "QA manager reviewing AI-scored support ticket quality against rubric checklist",
    "ai-data-analysis-for-non-technical-teams": "non-technical professional typing plain English query into AI analytics tool to get chart",
    "ai-database-management": "database administrator reviewing AI query optimization suggestions in terminal",
    "ai-data-cleaning-tools": "analyst watching AI tool auto-fix duplicate entries and format errors in spreadsheet",
    "ai-data-entry-automation": "office worker watching AI automatically populate fields from scanned document",
    "ai-data-visualization-tools": "analyst selecting chart type from AI-recommended visualization options for business data",
    "ai-deal-intelligence": "sales manager viewing deal risk alert with contributing signals listed in sidebar",
    "ai-debugging-guide": "developer using AI to trace error message back to root cause in code",
    "ai-design-handoff": "developer and designer reviewing annotated component specs in design handoff tool",
    "ai-design-systems": "design team member browsing AI-organized component library with usage guidelines",
    "ai-design-tools-non-designers": "non-designer creating professional social media graphic using AI template builder",
    "ai-devops-tools": "DevOps engineer viewing AI-generated deployment pipeline with anomaly detection alerts",
    "ai-diversity-hiring": "HR recruiter reviewing anonymized candidate profiles with bias-reduction filter applied",
    "ai-document-management": "knowledge worker searching company document archive using natural language query",
    "ai-document-summarizer": "professional reading one-paragraph AI summary of lengthy contract document",
    "ai-ediscovery-tools": "legal team reviewing AI-prioritized relevant documents for litigation case",
    "ai-email-marketing": "email marketer reviewing AI-generated campaign copy with subject line A/B options",
    "ai-employee-engagement": "HR professional reviewing engagement score dashboard with department breakdown",
    "ai-employee-offboarding": "HR coordinator tracking departing employee task checklist with automated reminders",
    "ai-employee-onboarding": "new hire completing personalized AI-guided onboarding checklist on first day",
    "ai-employee-training": "employee completing adaptive AI training module with progress bar and quiz",
    "ai-employee-wellness": "HR manager reviewing team wellness indicators and burnout risk alerts on dashboard",
    "ai-expense-reports": "employee photographing receipt with phone while AI auto-fills expense report",
    "ai-facilities-management": "facilities manager viewing predictive maintenance alerts and building sensor data",
    "ai-financial-forecasting": "finance analyst reviewing AI-generated revenue forecast with confidence range chart",
    "ai-fleet-management": "fleet manager viewing real-time vehicle location map with route optimization overlay",
    "ai-for-customer-service-complete-guide": "customer support team reviewing AI-assisted ticket queue with resolution suggestions",
    "ai-for-hr": "HR director reviewing AI-powered people analytics dashboard with workforce insights",
    "ai-for-marketing-complete-guide": "marketing team reviewing AI content calendar and campaign performance side by side",
    "ai-for-recruiting": "recruiter reviewing AI-ranked shortlist of candidates with scoring breakdown",
    "ai-for-sales-call-prep": "sales rep reading AI-generated prospect brief five minutes before video call",
    "ai-for-sales-complete-guide": "sales team using AI deal intelligence and pipeline forecasting on multiple screens",
    "ai-for-small-business": "small business owner using AI assistant on laptop in coffee shop setting",
    "ai-fraud-detection": "finance analyst reviewing AI-flagged suspicious transaction with risk score breakdown",
    "ai-generated-art-for-commercial-use": "designer reviewing AI-generated image options alongside licensing information panel",
    "ai-grammar-checker-business": "professional reviewing polished business email with grammar suggestions accepted",
    "ai-help-desk-software": "support agent viewing AI-suggested solution while handling customer ticket",
    "ai-hr-chatbot": "employee typing HR question to AI chatbot and receiving instant policy answer",
    "ai-image-editing-tools": "marketer using AI background removal and image enhancement tools on product photo",
    "ai-image-generation-marketing": "marketing team reviewing AI-generated campaign image options for social media post",
    "ai-incident-management": "on-call engineer reviewing AI-triaged incident with automated root cause analysis",
    "ai-infrastructure-monitoring": "SRE viewing AI anomaly detection alert with correlated metrics on monitoring dashboard",
    "ai-internal-communications": "internal comms manager composing targeted employee announcement in AI tool",
    "ai-interview-scheduling": "recruiter watching AI automatically book interview slots across multiple calendars",
    "ai-inventory-management": "warehouse manager reviewing AI reorder recommendations and stock level predictions",
    "ai-invoice-processing": "AP team member watching AI automatically extract and validate invoice data from PDF",
    "ai-ip-management": "IP lawyer reviewing patent portfolio map with AI renewal reminders and risk flags",
    "ai-knowledge-base-for-teams": "team member typing question and receiving instant AI-sourced answer from company docs",
    "ai-knowledge-base-generator": "support team watching AI turn resolved tickets into searchable knowledge base articles",
    "ai-landing-page-builder": "marketer previewing AI-generated landing page with headline variations side by side",
    "ai-lead-scoring": "sales manager reviewing AI-ranked leads list with scoring factors explained in sidebar",
    "ai-legal-billing": "lawyer reviewing AI-generated time entry suggestions from calendar and email activity",
    "ai-legal-document-review": "legal professional reviewing AI-annotated contract with risk areas highlighted in red",
    "ai-legal-research": "attorney reviewing AI-compiled case law summary with source citations listed",
    "ai-logo-design": "founder reviewing four AI-generated logo concepts for their startup brand",
    "ai-market-research": "strategist reviewing AI-compiled market size report with competitor landscape summary",
    "ai-meeting-notes-summaries-action-items": "professional reviewing AI-generated meeting summary with action items and owner names",
    "ai-motion-graphics-tools": "video editor reviewing AI-generated motion graphic template in timeline editor",
    "ai-note-taking-apps": "professional reviewing structured AI notes from meeting with key decisions highlighted",
    "ai-omnichannel-support": "support manager viewing unified inbox showing email chat and social tickets in one view",
    "ai-pair-programming": "two developers collaborating with AI pair programmer suggesting code refactoring",
    "ai-performance-reviews": "manager drafting performance review with AI suggesting specific evidence and ratings",
    "ai-pitch-deck-generator": "startup founder reviewing AI-generated investor pitch slide with market size and traction",
    "ai-policy-writing": "HR professional reviewing AI-drafted remote work policy with suggested compliance checks",
    "ai-presentation-maker": "professional polishing AI-generated slide deck with branded template applied",
    "ai-pricing-optimization": "pricing analyst reviewing AI-recommended price adjustments with revenue impact forecast",
    "ai-process-mining": "operations manager viewing process map with AI-identified bottleneck highlighted in red",
    "ai-procurement-tools": "procurement manager reviewing AI-scored vendor options with contract terms comparison",
    "ai-productivity-guide": "knowledge worker reviewing personal AI productivity dashboard with time savings metrics",
    "ai-project-management-features-guide": "project manager using AI to auto-assign tasks and surface blockers in kanban board",
    "ai-prompt-engineering-for-business": "business professional testing refined AI prompt and comparing output quality improvement",
    "ai-proposal-generator": "sales professional reviewing AI-generated client proposal with company branding applied",
    "ai-regulatory-compliance-monitoring": "compliance officer viewing AI regulatory change alert with impact assessment summary",
    "ai-report-generator": "analyst reviewing AI-compiled business report with charts and executive summary",
    "ai-report-writing": "business professional reviewing structured AI-written report draft with section outlines",
    "ai-resume-screening": "recruiter viewing AI-ranked candidate list with match scores and key criteria met",
    "ai-revenue-recognition": "accounting team reviewing AI-automated revenue waterfall chart for ASC 606 compliance",
    "ai-risk-management": "risk manager reviewing AI-generated risk matrix with probability and impact scores",
    "ai-sales-emails": "sales rep reviewing AI-personalized cold email draft with tone and structure suggestions",
    "ai-sales-forecasting": "VP of Sales reviewing AI revenue forecast dashboard with pipeline confidence scores",
    "ai-sales-prospecting": "SDR reviewing AI-identified prospect list with fit scores and contact details",
    "ai-sales-territory-planning": "sales ops manager viewing AI-optimized territory map with revenue potential heatmap",
    "ai-scheduling-assistant": "busy professional watching AI book team meeting across multiple conflicting calendars",
    "ai-security-scanning": "security engineer reviewing AI-prioritized vulnerability list with remediation steps",
    "ai-seo-tools": "SEO specialist reviewing AI keyword opportunity report with content gap analysis",
    "ai-skills-gap-analysis": "L&D manager reviewing AI skills gap heatmap by role and department",
    "ai-social-media-content-calendar": "social media manager reviewing AI-populated monthly content calendar on screen",
    "ai-sop-generator": "operations manager reviewing AI-drafted standard operating procedure with numbered steps",
    "ai-spreadsheet-tools": "analyst typing plain-English formula request and watching AI generate spreadsheet formula",
    "ai-supply-chain-management": "supply chain analyst viewing AI risk alert for supplier disruption with mitigation options",
    "ai-tax-preparation": "accountant reviewing AI-extracted tax data from documents alongside blank return",
    "ai-test-generation": "QA engineer reviewing AI-generated unit test suite with edge case coverage listed",
    "ai-ticket-routing": "support operations manager viewing AI automatic ticket assignment with confidence scores",
    "ai-tools-for-business-guide": "business professional browsing department-organized AI tools grid on computer screen",
    "ai-tools-for-data-entry": "office worker reviewing automated data entry output compared to original source document",
    "ai-transcription-tools": "professional reviewing accurate AI transcript of recorded meeting with speaker labels",
    "ai-translation-tools-business": "global business team reviewing AI-translated contract in side-by-side bilingual view",
    "ai-translation-tools": "content team reviewing AI-translated marketing copy across multiple language versions",
    "ai-ux-design-tools": "UX designer reviewing AI-generated user flow diagram with usability suggestions",
    "ai-vendor-management": "procurement team reviewing AI vendor scorecard with performance and risk metrics",
    "ai-video-marketing-tools": "marketer watching AI-generated product demo video with captions and b-roll inserts",
    "ai-voice-assistant-customer-service": "customer talking to AI voice assistant while support agent monitors quality in background",
    "ai-wireframing-tools": "product manager viewing AI-generated wireframe from text description in browser",
    "ai-workflow-automation": "operations professional building automated approval workflow with drag-and-drop tool",
    "ai-workforce-planning": "HR strategist reviewing AI headcount forecast by department with hiring timeline",
    "ai-writing-assistant-keep-your-voice": "writer reviewing AI-suggested edits that preserve original tone and sentence style",
    "automate-email-triage-with-ai": "professional's inbox showing AI-sorted priority emails with labels and auto-replies",
    "best-ai-tools-for-design": "designer at workstation with multiple AI design tools open across two monitors",
    "best-ai-tools-for-engineering": "software engineer reviewing AI code suggestions and testing tools on dark IDE",
    "best-ai-tools-for-finance": "finance professional reviewing top AI accounting and forecasting tools on screen",
    "best-ai-tools-for-legal": "lawyer at desk reviewing AI legal research and contract review tools on laptop",
    "best-ai-tools-for-operations": "operations manager reviewing AI workflow automation and analytics tools on dashboard",
    "best-ai-video-editing-tools": "video editor reviewing AI-automated cut and caption options in timeline editor",
    "best-ai-writing-tools": "professional writer comparing AI writing assistant outputs side by side on screen",
    "how-to-implement-ai-in-your-business": "business leader presenting AI adoption roadmap to team with project phases on screen",
    "manage-email-faster-with-ai": "professional processing inbox rapidly with AI-suggested labels and one-click replies",
    "writing-better-docs-with-ai": "technical writer reviewing AI-improved documentation draft with clarity suggestions",
}


def insert_imagehint(filepath, hint):
    """Insert imageHint into frontmatter after the tags line."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Skip if already has imageHint
    if "imageHint:" in content:
        return False, "already has imageHint"

    # Find the closing --- of frontmatter and insert before it
    # Strategy: insert after tags line if it exists, otherwise before closing ---
    lines = content.split("\n")

    # Find frontmatter bounds
    front_start = None
    front_end = None
    dash_count = 0
    for i, line in enumerate(lines):
        if line.strip() == "---":
            dash_count += 1
            if dash_count == 1:
                front_start = i
            elif dash_count == 2:
                front_end = i
                break

    if front_end is None:
        return False, "no frontmatter found"

    # Insert imageHint before closing ---
    insert_line = f'imageHint: "{hint}"'
    lines.insert(front_end, insert_line)

    new_content = "\n".join(lines)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)

    return True, "added"


def main():
    blog_dir = BLOG_DIR
    updated = 0
    skipped = 0
    errors = []

    for slug, hint in IMAGE_HINTS.items():
        filepath = os.path.join(blog_dir, f"{slug}.md")
        if not os.path.exists(filepath):
            errors.append(f"File not found: {filepath}")
            continue

        ok, reason = insert_imagehint(filepath, hint)
        if ok:
            updated += 1
            print(f"  ✓ {slug}")
        else:
            skipped += 1
            print(f"  - {slug}: {reason}")

    print(f"\nDone: {updated} updated, {skipped} skipped, {len(errors)} errors")
    if errors:
        for e in errors:
            print(f"  ERROR: {e}")


if __name__ == "__main__":
    main()
