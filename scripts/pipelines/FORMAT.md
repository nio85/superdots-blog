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

## Example

See `definitions/daily-content.json` for a complete working example with 5 tasks, cross-references, and @mention handoffs.
