# Pipeline Definition Format

This document describes how to create pipeline definitions for the Paperclip pipeline runner. Read this before creating a new routine.

## Quick start

1. Create a JSON file in `scripts/pipelines/definitions/{name}.json`
2. Test: `node scripts/pipelines/runner.mjs {name} --dry-run`
3. Run live: `node scripts/pipelines/runner.mjs {name}`

## JSON Structure

```json
{
  "pipeline": {
    "name": "my-pipeline",
    "description": "What this pipeline does",

    "vars": {
      "date": "{{TODAY}}"
    },

    "idempotency": {
      "query": "[{{date}}] My pipeline",
      "matchField": "title"
    },

    "parent": {
      "title": "[{{date}}] My pipeline",
      "assignee": "AGENT_KEY",
      "status": "todo",
      "priority": "high",
      "description": ["Line 1", "Line 2", "..."]
    },

    "tasks": [
      {
        "id": "step_one",
        "title": "[{{date}}] First step",
        "assignee": "AGENT_KEY",
        "status": "todo",
        "priority": "high",
        "description": ["Line 1", "Line 2"]
      },
      {
        "id": "step_two",
        "title": "[{{date}}] Second step",
        "assignee": "AGENT_KEY",
        "status": "blocked",
        "priority": "high",
        "blockedBy": "step_one",
        "description": ["...", "Blocked on [{{step_one.identifier}}]"]
      }
    ]
  }
}
```

## Field Reference

### Pipeline fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Pipeline identifier |
| `description` | No | Human-readable description |
| `vars` | No | Variables available via `{{var}}` in all templates |
| `idempotency` | No | Prevents duplicate creation (searches by `query`, matches `matchField`) |
| `parent` | No | Parent task that groups all subtasks |
| `tasks` | Yes | Array of task definitions (executed in order) |

### Task fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Local identifier (used for cross-references like `{{id.identifier}}`) |
| `title` | Yes | Task title (supports `{{variables}}`) |
| `assignee` | Yes | Agent key from config.mjs (see list below) |
| `status` | Yes | `todo`, `blocked`, or `in_progress` |
| `priority` | Yes | `urgent`, `high`, `medium`, or `low` |
| `description` | Yes | Array of strings (joined with newlines) or single string |
| `blockedBy` | No | ID of a task defined earlier in the array |

### Parent fields

Same as task fields except: no `id`, no `blockedBy`, no `status` (defaults to `todo`).

## Variables

### Built-in variables

| Variable | Value | Example |
|---|---|---|
| `{{TODAY}}` | Current date YYYY-MM-DD | `2026-03-25` |
| `{{NOW}}` | Current ISO timestamp | `2026-03-25T14:30:00.000Z` |
| `{{WEEKDAY}}` | Current day name | `Tuesday` |

### Custom variables

Define in `vars` section. Can reference built-ins:
```json
"vars": { "date": "{{TODAY}}" }
```

### Task cross-references

After a task is created, its Paperclip identifier and ID are available:
- `{{task_id.identifier}}` — e.g. `SUP-543`
- `{{task_id.id}}` — UUID
- `{{_parent.identifier}}` — parent task identifier

Use these in downstream task descriptions to create proper links:
```json
"Blocked on [{{step_one.identifier}}](/SUP/issues/{{step_one.identifier}})"
```

## Valid Agent Keys

| Key | Agent |
|---|---|
| `CEO` | CEO |
| `CONTENT_MANAGER` | Content Manager |
| `SEO_EXPERT` | SEO Expert |
| `COPYWRITER` | Copywriter |
| `FOUNDING_ENGINEER` | Founding Engineer |
| `FRONTEND_DESIGNER` | Frontend Designer |
| `LEGAL_EXPERT` | Legal Expert |
| `GROWTH_ANALYST` | Growth Analyst |
| `PAID_ADS_OPERATOR` | Reddit Ads Specialist |
| `PROGRAM_MANAGER` | Program Manager |

## Description format

Descriptions are arrays of strings. Each element becomes one line:

```json
"description": [
  "## Section Title",
  "",
  "Paragraph text here.",
  "",
  "## When done",
  "1. Set this task to `done`",
  "2. @mention **@Content Manager**"
]
```

An empty string `""` creates a blank line (paragraph separator in markdown).

## CLI Usage

```bash
# Run a pipeline
node scripts/pipelines/runner.mjs daily-content

# Dry run (preview without creating tasks)
node scripts/pipelines/runner.mjs daily-content --dry-run

# Override a variable
node scripts/pipelines/runner.mjs daily-content --var date=2026-03-26

# List available pipelines
node scripts/pipelines/runner.mjs --list

# Override company/project (multi-company)
node scripts/pipelines/runner.mjs daily-content --company-id=abc --project-id=def
```

## Scheduling a Pipeline as a Paperclip Routine

The JSON definition defines **what** tasks to create. To automate **when** it runs, create a Paperclip routine.

### Step-by-step

**1. Create the routine:**

```bash
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/routines" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Daily content pipeline",
    "description": "Creates the daily editorial task chain via pipeline runner",
    "assigneeAgentId": "<CONTENT_MANAGER_UUID>",
    "projectId": "<PROJECT_UUID>",
    "priority": "high",
    "status": "active",
    "concurrencyPolicy": "coalesce_if_active",
    "catchUpPolicy": "skip_missed"
  }'
```

Save the returned `routineId`.

**2. Add a schedule trigger:**

```bash
curl -sS -X POST "$PAPERCLIP_API_URL/api/routines/<routineId>/triggers" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "schedule",
    "cronExpression": "0 8 * * 1-5",
    "timezone": "Europe/Rome"
  }'
```

**3. Set the routine description** so the agent knows what to run:

The routine description should tell the assigned agent to execute the pipeline runner. Example:

```
Run the daily content pipeline:
cd /home/luca/superdots-blog && node scripts/pipelines/runner.mjs daily-content
```

When the routine fires, Paperclip creates a task assigned to the agent with this description. The agent reads it, runs the command, and the pipeline runner creates the subtasks.

### Cron expression reference

| Expression | Meaning |
|---|---|
| `0 8 * * 1-5` | Mon-Fri at 08:00 |
| `0 9 * * 1` | Mondays at 09:00 |
| `0 */6 * * *` | Every 6 hours |
| `30 19 * * *` | Daily at 19:30 |
| `0 8 1 * *` | First of every month at 08:00 |

Timezone: use IANA format (e.g. `Europe/Rome`, `Europe/Amsterdam`, `UTC`).

### Concurrency policies

| Policy | When to use |
|---|---|
| `coalesce_if_active` (default) | Pipeline takes a while to complete — don't create duplicates |
| `skip_if_active` | Same as coalesce but doesn't link to active run |
| `always_enqueue` | Every trigger must create tasks, even if previous run is ongoing |

### Catch-up policies

| Policy | When to use |
|---|---|
| `skip_missed` (default) | If server was down, don't run missed pipelines |
| `enqueue_missed_with_cap` | Run missed pipelines (up to 25) — use for critical routines |

### Trigger types

Routines support three trigger types. You can combine them on the same routine:

- **schedule** — cron expression + timezone (most common)
- **webhook** — external system POSTs to a generated URL (e.g. GitHub webhook)
- **api** — manual only, fire via `POST /api/routines/{id}/run`

### Agent access rules

- Agents can only create routines assigned to **themselves**
- To assign a routine to another agent, the **board** (Luca) must do it from UI or API
- Agents can read all routines in the company

### Managing existing routines

```bash
# List all routines
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/routines" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

# Pause a routine
curl -sS -X PATCH "$PAPERCLIP_API_URL/api/routines/<routineId>" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "paused"}'

# Update trigger schedule
curl -sS -X PATCH "$PAPERCLIP_API_URL/api/routine-triggers/<triggerId>" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cronExpression": "0 9 * * 1-5"}'

# Manual run (bypass schedule)
curl -sS -X POST "$PAPERCLIP_API_URL/api/routines/<routineId>/run" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source": "manual"}'

# View run history
curl -sS "$PAPERCLIP_API_URL/api/routines/<routineId>/runs?limit=10" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

## End-to-end checklist for creating a new routine

1. Write the JSON definition in `scripts/pipelines/definitions/{name}.json`
2. Test: `node scripts/pipelines/runner.mjs {name} --dry-run`
3. Run live once: `node scripts/pipelines/runner.mjs {name}`
4. Verify tasks created correctly in Paperclip
5. Create Paperclip routine (via API or ask board to create via UI)
6. Add schedule trigger with cron expression + timezone
7. Comment on your task with the routine ID and schedule
8. Monitor first automated run to confirm everything works

## Example

See `definitions/daily-content.json` for a complete working example with 5 tasks, cross-references, and @mention handoffs.
