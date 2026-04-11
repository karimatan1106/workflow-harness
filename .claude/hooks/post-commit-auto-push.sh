#!/usr/bin/env bash
# PostToolUse hook: auto-push after git commit
# Toggle: env AUTO_PUSH=true (in .claude/settings.json)
# Matches Bash tool — checks if command contained "git commit"

if [[ "${AUTO_PUSH:-}" != "true" ]]; then
  exit 0
fi

# Read tool input from stdin (JSON with tool_input.command)
input="$(cat)"
cmd="$(echo "$input" | sed -n 's/.*"command"\s*:\s*"\([^"]*\)".*/\1/p')"

# Only trigger on git commit commands (not amend-only or other git subcommands)
if ! echo "$cmd" | grep -qE 'git\s+commit'; then
  exit 0
fi

# Detect submodule: if we're in a submodule dir, push there first
cwd="$(pwd)"
# Push current repo
git push 2>/dev/null || true

# If there's a parent repo with this as a submodule, update and push parent too
parent_dir="$(git rev-parse --show-superproject-working-tree 2>/dev/null)"
if [[ -n "$parent_dir" ]]; then
  cd "$parent_dir"
  git push 2>/dev/null || true
fi

exit 0
