#!/usr/bin/env bash
# merge-when-green.sh — Wait for CI to pass, then merge a PR
#
# Usage:
#   bash scripts/merge-when-green.sh <PR_NUMBER> [--auto]
#
# Default behavior: polls gh pr checks every 30s (max 5 min), merges when green.
# With --auto: enables GitHub auto-merge and returns immediately (GitHub merges
# the PR when CI passes). Preferred for heartbeat agents.
#
# Exit codes:
#   0 — PR merged (or auto-merge enabled)
#   1 — CI failed
#   2 — timeout (CI still pending after max wait)
#   3 — usage error

set -euo pipefail

REPO="nio85/superdots-blog"
MAX_WAIT=300   # 5 minutes
POLL_INTERVAL=30

if [ -z "${1:-}" ]; then
  echo "Usage: merge-when-green.sh <PR_NUMBER> [--auto]" >&2
  exit 3
fi

PR_NUMBER="$1"
AUTO_MODE="${2:-}"

cd /home/luca/superdots-blog
if [ -f .env ]; then
  export GH_TOKEN=$(grep '^GITHUB_TOKEN=' .env | cut -d= -f2)
fi

if [ "$AUTO_MODE" = "--auto" ]; then
  echo "Enabling auto-merge for PR #${PR_NUMBER}..."
  gh pr merge "$PR_NUMBER" --auto --merge --repo "$REPO"
  echo "Auto-merge enabled. GitHub will merge PR #${PR_NUMBER} when CI passes."
  exit 0
fi

echo "Waiting for CI on PR #${PR_NUMBER} (max ${MAX_WAIT}s)..."

ELAPSED=0
while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  CHECKS=$(gh pr checks "$PR_NUMBER" --repo "$REPO" 2>&1) || true

  if echo "$CHECKS" | grep -qi "fail"; then
    echo "CI FAILED for PR #${PR_NUMBER}:" >&2
    echo "$CHECKS" >&2
    exit 1
  fi

  if ! echo "$CHECKS" | grep -qi "pending"; then
    echo "CI passed. Merging PR #${PR_NUMBER}..."
    gh pr merge "$PR_NUMBER" --merge --repo "$REPO"
    echo "PR #${PR_NUMBER} merged."
    exit 0
  fi

  echo "  CI pending... (${ELAPSED}s elapsed)"
  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

echo "Timeout: CI still pending after ${MAX_WAIT}s for PR #${PR_NUMBER}" >&2
echo "Enabling auto-merge as fallback..."
gh pr merge "$PR_NUMBER" --auto --merge --repo "$REPO" 2>/dev/null && {
  echo "Auto-merge enabled as fallback. GitHub will merge when CI passes."
  exit 0
}
exit 2
