# SuperDots Daily Status

_This file is automatically updated by the **Daily Coordination Digest Pipeline** (`scripts/pipelines/definitions/daily-coordination-digest.json`), owned by Program Manager._

## How this works

Each weekday at 18:00 (Europe/Rome), Program Manager runs the digest pipeline:
1. Reads last 14 days of digest history from vector memory
2. Pulls all issues created in last 24h by routines/pipelines
3. Searches cross-agent memory for blockers and conflicts
4. Dedupes and clusters issues by theme
5. Picks top 5-10 priorities for tomorrow
6. Replaces this file with the day's digest
7. Emails the digest to lucavittorio.bartoccini@gmail.com
8. Writes summary to vector memory tagged `pipeline:daily-coordination-digest`

## Initial state

This file will be populated by the first run on the next weekday at 18:00 Europe/Rome. Until then, this placeholder remains.

If a few days pass without updates, check:
- Is the routine `Daily Coordination Digest Pipeline` active in Paperclip?
- Has Program Manager executed any heartbeats? (`SELECT count(*) FROM heartbeat_runs WHERE agent_id = '3d6e6cdc-863c-4fec-a676-9b06dd3b3e89' AND created_at > NOW() - INTERVAL '2 days'`)
- Did the pipeline runner succeed? (Check Paperclip issues with title prefix `[YYYY-MM-DD] Coord Digest`)
