# CTR Rewrite Pass — Top 10 Articles

**Hypothesis:** Rewriting title + description frontmatter for the 10 highest-impression / lowest-CTR articles will lift aggregate CTR from ~0.1% to ≥1.5% within 30 days of merge.

**PR:** https://github.com/nio85/superdots-blog/pull/285  
**Paperclip task:** SUP-1336  
**Merge date:** TBD (pending Content Manager review)  
**Review date:** 2026-05-21

## Baseline (GSC 30d as of 2026-04-21)

| URL | Impr | Clicks | CTR | Pos |
|---|---:|---:|---:|---:|
| /blog/ai-event-planning-tools/ | 2,056 | 3 | 0.1% | 10.9 |
| /blog/ai-customer-service-qa/ | 805 | 1 | 0.1% | 9.6 |
| /blog/ai-battlecard-tools-sales-teams/ | 369 | 0 | 0.0% | 8.5 |
| /blog/ai-contract-clause-extraction/ | 314 | 1 | 0.3% | 8.2 |
| /blog/ai-automation-for-business-complete-guide/ | 157 | 1 | 0.6% | 23.8 |
| /blog/ai-note-taking-apps/ | 87 | 1 | 1.1% | 12.9 |
| /blog/ai-report-writing/ | 84 | 1 | 1.2% | 10.6 |
| /blog/ai-change-management/ | 74 | 0 | 0.0% | 43.2 |
| /blog/ai-api-documentation/ | 69 | 0 | 0.0% | 6.5 |
| /blog/ai-security-scanning/ | 58 | 1 | 1.7% | 9.7 |
| **Totals** | **4,073** | **9** | **0.22%** | — |

## What Changed

Pure frontmatter changes only (title + description). No body edits.
Key changes: tool names added to titles/descriptions, pricing anchors added, query intent matched.

## Decision Criteria

- **Confirm hypothesis (→ rollout pass 2):** Aggregate CTR on these 10 URLs reaches ≥1.5% by 2026-05-21
- **Reject hypothesis (→ investigate content body):** CTR remains below 1.0% — implies content-body quality or ranking position is the real bottleneck
