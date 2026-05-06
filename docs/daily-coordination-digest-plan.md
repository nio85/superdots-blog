> ⚠ **DEPRECATED 2026-05-06**: This plan was authored before PR #478 changed the publish step from git/PR to PATCH parent issue description. The new flow is in scripts/pipelines/definitions/daily-coordination-digest.json — read THAT, not this plan. This file remains as historical artifact only.

# Daily Coordination Digest — Execution Plan for 2026-05-06

**Program Manager** | *Schedule: 18:00 Europe/Rome*

## Overview
The Daily Coordination Digest aggregates one day of operational output, identifies patterns, and provides CEO with prioritized guidance. This is a 7-step sequential pipeline executed by the Program Manager.

## Pre-Execution Checklist (by 17:45)

- [ ] **Memory tool**: Test recall with simple query (Ollama health check)
- [ ] **Database**: Verify connectivity to paperclip DB
- [ ] **GitHub**: Confirm git access + GH token valid
- [ ] **Resend SMTP**: Test email configuration
- [ ] **Doc access**: Verify write access to docs/daily-status.md

## Execution Steps (18:00-19:30 target)

### Step 1: read_history (Estimated: 5 min)
```bash
node scripts/tools/pipeline-memory.mjs recall daily-coordination-digest 'recurring conflicts, blockers, patterns' --limit 14 --days 14
```
**Deliverable**: Identify items flagged in prior 14 days that remain unresolved  
**Outcome**: Comment with 3-bullet summary of recurring themes  
**Fallback**: If Ollama down, post warning comment and continue with current data only

### Step 2: gather_outputs (Estimated: 5 min)
**Logic**: Monday → 3-day lookback. Other days → 1-day lookback  
Today is Tuesday → 1-day lookback

```bash
psql -U luca -d paperclip -tc "
SELECT row_to_json(t) FROM (
  SELECT i.identifier, i.title, a.name AS assignee, i.priority, i.status, i.created_at::date 
  FROM issues i 
  LEFT JOIN agents a ON a.id = i.assignee_agent_id 
  WHERE i.company_id = 'cdb3c45d-c7df-4ea0-b495-26426a1e9df4' 
    AND i.created_at > NOW() - INTERVAL '1 day' 
  ORDER BY i.created_at DESC
) t"
```
**Deliverable**: Structured table: total count, grouped by pipeline source, by priority  
**Outcome**: Comment with grouped summary

### Step 3: cross_agent_memory (Estimated: 8 min)
```bash
node scripts/tools/memory-harvest.mjs recall 'blocked, waiting, conflict, cannot proceed, regression' 2>&1 | head -100
```
**Deliverable**: Any agent explicitly blocked/waiting (cross-check against current issues)  
**Outcome**: Comment listing blocked agents + what they're waiting on  
**Fallback**: If Ollama down, note degraded and continue

### Step 4: dedupe_cluster (Estimated: 8 min)
**Logic**: Examine issues from step 2. Assign to theme buckets:
- search-performance
- content-production
- ai-visibility
- infra-health
- paid-ads
- social
- coordination
- editorial-quality

Identify duplicate pairs (same asset, same agent, same error).

**Deliverable**: Theme clusters with count, dupe pairs marked for closure  
**Outcome**: Comment with structured clusters

### Step 5: prioritize (Estimated: 5 min)
**Criteria** (in order):
1. Urgent priority items still open
2. Items blocking other agents (query all `blockedByIssueIds`)
3. Items mentioned in escalation memory (>2 days unresolved)
4. CEO-owned items currently in in_review/in_progress

**Deliverable**: Ranked list of top 5-10  
**Outcome**: Comment with list + 1-line rationale per item

### Step 6: publish (Estimated: 15 min)
**Part A: Compose docs/daily-status.md**
```markdown
# SuperDots Daily Status — 2026-05-06

_Updated by Program Manager via daily-coordination-digest pipeline._

## Top priorities for tomorrow
1. <item> (why)
2. <item> (why)
...

## Yesterday by the numbers
- N issues created across M pipelines
- X urgent | Y high | Z medium | W low
- Dupe pairs closed: N

## Active blockers
- <agent> blocked on <thing> (since <date>)

## Theme clusters
- search-performance: N issues
- content-production: N issues
- ...

## Escalations to CEO
- <item> (waiting since <date>)
```

**Part B: Open PR**
```bash
git checkout -b coord/digest-$(date +%Y-%m-%d)
# edit docs/daily-status.md
git add docs/daily-status.md
git commit -m "coord: daily status digest $(date +%Y-%m-%d)"
git push -u origin coord/digest-$(date +%Y-%m-%d)
gh pr create --base main --reviewer nio85 --title "coord: daily status digest $(date +%Y-%m-%d)" --body "Daily Coordination Digest"
```
**Note**: Do NOT auto-merge. Founding Engineer or CEO reviews before merge.

**Part C: Email Luca**
Send markdown digest via Resend SMTP to inbox@lucavittorio.me with subject "SuperDots digest 2026-05-06"

### Step 7: write_history (Estimated: 5 min)
**Part A**: Update yesterday's memory outcome (if previous run exists)
```bash
node scripts/tools/pipeline-memory.mjs update-outcome-latest daily-coordination-digest good
```
(Auto-finds yesterday's entry, marks as good/neutral/negative)

**Part B**: Write today's entry
```bash
node scripts/tools/pipeline-memory.mjs write daily-coordination-digest \
  --content <(cat <<'EOF'
# Daily Coordination Digest — 2026-05-06

## Top issues moved
- ...

## Persistent blockers
- ...

## Patterns to watch
- ...

## Coordination wins / fails
- ...

## Predictions for tomorrow
- ...
EOF
  ) \
  --outcome pending \
  --agent PROGRAM_MANAGER \
  --tag domain:coord
```

## Contingencies

| Failure | Fallback |
|---------|----------|
| Ollama unavailable (read_history/cross_agent_memory) | Post degraded warning, continue with current data |
| SQL query fails (gather_outputs) | Set task blocked, escalate to Founding Engineer |
| GitHub unreachable (publish step) | Set task blocked, email Luca manually instead |
| Email send fails | Note error but mark step done (PR is primary deliverable) |
| Memory write fails (step 7) | Set task blocked, escalate to Founding Engineer (losing learnings = critical) |

## Success Criteria

✅ All 7 steps completed (or gracefully degraded)  
✅ PR opened with daily status  
✅ Email sent to Luca  
✅ Today's memory saved  
✅ No issues left blocked due to digest delays

## Timing Target
- Start: 18:00
- Target completion: 19:30
- Hard stop: 20:00 (CEO email goes out at 20:00 regardless)
