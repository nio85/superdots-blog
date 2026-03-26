#!/bin/bash
# git-safe.sh — Serialized git wrapper for Paperclip agents
#
# Prevents concurrent git operations in the shared working directory
# by using flock on a lockfile. All agents MUST use this instead of
# raw git commands for checkout, pull, push, and merge operations.
#
# Usage:
#   bash scripts/git-safe.sh pull          # git checkout main && git pull --rebase origin main
#   bash scripts/git-safe.sh checkout <branch>  # git checkout <branch>
#   bash scripts/git-safe.sh push          # git push origin <current-branch>
#   bash scripts/git-safe.sh sync          # git checkout main && git pull (quick sync for scripts)
#   bash scripts/git-safe.sh status        # show current branch and status
#
# The lock has a 120s timeout — if another agent holds it for >2 minutes,
# this invocation fails rather than waiting indefinitely.

set -euo pipefail

LOCKFILE="/tmp/.superdots-git.lock"
TIMEOUT=120
REPO="/home/luca/superdots-blog"

cd "$REPO"

# Load env for git auth
if [ -f .env ]; then
  export GH_TOKEN=$(grep '^GITHUB_TOKEN=' .env | cut -d= -f2)
fi

run_locked() {
  exec 200>"$LOCKFILE"
  if ! flock -w "$TIMEOUT" 200; then
    echo "ERROR: Could not acquire git lock after ${TIMEOUT}s. Another agent is running a git operation." >&2
    exit 1
  fi
  # Lock acquired — run the command
  "$@"
  # Lock released automatically when fd 200 closes
}

cmd_pull() {
  run_locked bash -c '
    # Stash any uncommitted changes
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
      echo "WARNING: Stashing uncommitted changes before pull"
      git stash push -m "git-safe auto-stash $(date +%Y%m%d-%H%M%S)"
    fi
    git checkout main 2>/dev/null || true
    git pull --rebase origin main
    echo "OK: main branch up to date ($(git rev-parse --short HEAD))"
  '
}

cmd_sync() {
  # Lightweight sync — just ensure main is current, used by scripts
  run_locked bash -c '
    current=$(git branch --show-current)
    if [ "$current" != "main" ]; then
      if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        echo "WARNING: On branch $current with uncommitted changes — skipping sync"
        exit 0
      fi
      git checkout main 2>/dev/null
    fi
    git pull --rebase origin main 2>/dev/null
    echo "OK: synced to $(git rev-parse --short HEAD)"
  '
}

cmd_checkout() {
  local branch="$1"
  run_locked bash -c "
    # Stash if dirty
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
      echo 'WARNING: Stashing uncommitted changes before checkout'
      git stash push -m 'git-safe auto-stash \$(date +%Y%m%d-%H%M%S)'
    fi
    git checkout '$branch'
    echo 'OK: checked out $branch'
  "
}

cmd_push() {
  run_locked bash -c '
    branch=$(git branch --show-current)
    git push origin "$branch"
    echo "OK: pushed $branch"
  '
}

cmd_status() {
  echo "Branch: $(git branch --show-current)"
  echo "Commit: $(git rev-parse --short HEAD)"
  echo "Status: $(git status --short | wc -l) modified files"
  if [ -f "$LOCKFILE" ]; then
    if flock -n 200 2>/dev/null; then
      echo "Lock: free"
      exec 200>&-
    else
      echo "Lock: HELD by another process"
    fi
    exec 200>"$LOCKFILE" 2>/dev/null || true
  fi
}

case "${1:-help}" in
  pull)     cmd_pull ;;
  sync)     cmd_sync ;;
  checkout) cmd_checkout "${2:?Usage: git-safe.sh checkout <branch>}" ;;
  push)     cmd_push ;;
  status)   cmd_status ;;
  help|*)
    echo "Usage: bash scripts/git-safe.sh <command>"
    echo "Commands: pull, sync, checkout <branch>, push, status"
    ;;
esac
