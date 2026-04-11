#!/bin/bash
# G-01 + N-01 + N-55 + N-63: PostToolUse hook - multi-language lint after Write/Edit

INPUT=$(cat)
# N-63: Use jq for robust JSON parsing (fallback to grep if jq unavailable)
if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# Normalize Windows paths
FILE_PATH=$(echo "$FILE_PATH" | sed 's|\\\\|/|g')

# N-55: Multi-language dispatch
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx) LANG="ts" ;;
  *.py) LANG="py" ;;
  *.go) LANG="go" ;;
  *.rs) LANG="rs" ;;
  *) exit 0 ;;
esac

# N-56: Observability logging
LOG_FILE="/tmp/harness-hook-obs.log"
log_obs() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] PostToolUse lang=$LANG file=$FILE_PATH $1" >> "$LOG_FILE" 2>/dev/null
}
log_obs "start"

# === TypeScript/JavaScript ===
if [ "$LANG" = "ts" ]; then
  # Find nearest tsconfig.json by walking up
  find_tsconfig() {
    local dir="$1"
    while [ "$dir" != "/" ] && [ "$dir" != "." ] && [ -n "$dir" ]; do
      if [ -f "$dir/tsconfig.json" ]; then
        echo "$dir/tsconfig.json"
        return 0
      fi
      dir=$(dirname "$dir")
    done
    return 1
  }

  FILE_DIR=$(dirname "$FILE_PATH")
  TSCONFIG=$(find_tsconfig "$FILE_DIR")

  if [ -z "$TSCONFIG" ]; then
    echo "[POST-TOOL-LINT] tsconfig.json が見つかりません: $FILE_PATH"
    log_obs "tsc=skipped(no-tsconfig)"
    exit 0
  fi

  # Run tsc with timeout
  OUTPUT=$(timeout 5 npx tsc --noEmit -p "$TSCONFIG" --pretty false 2>&1)
  TSC_EXIT=$?

  if [ $TSC_EXIT -eq 124 ]; then
    echo "[POST-TOOL-LINT] tsc タイムアウト (5s)"
    log_obs "tsc=timeout"
  elif [ $TSC_EXIT -ne 0 ]; then
    echo "[POST-TOOL-LINT] tsc エラー検出:"
    echo "$OUTPUT"
    log_obs "tsc=error"
  else
    log_obs "tsc=pass"
  fi

  # N-01: Biome format/lint check (graceful if not installed)
  if command -v npx &>/dev/null; then
    BIOME_OUTPUT=$(timeout 3 npx @biomejs/biome check --no-errors-on-unmatched "$FILE_PATH" 2>&1)
    BIOME_EXIT=$?
    if [ $BIOME_EXIT -eq 127 ]; then
      : # biome not installed — skip silently
    elif [ $BIOME_EXIT -eq 124 ]; then
      echo "[POST-TOOL-LINT] biome タイムアウト (3s)"
      log_obs "biome=timeout"
    elif [ $BIOME_EXIT -ne 0 ]; then
      echo "[POST-TOOL-LINT] biome check 警告:"
      echo "$BIOME_OUTPUT" | head -20
      log_obs "biome=warn"
    else
      log_obs "biome=pass"
    fi

    # N-09 + N-65: Biome format --write (auto-fix, not just check)
    BIOME_FMT_OUTPUT=$(timeout 3 npx @biomejs/biome format --write --no-errors-on-unmatched "$FILE_PATH" 2>&1)
    BIOME_FMT_EXIT=$?
    if [ $BIOME_FMT_EXIT -eq 124 ]; then
      echo "[POST-TOOL-LINT] biome format タイムアウト (3s)"
    elif [ $BIOME_FMT_EXIT -ne 0 ] && [ $BIOME_FMT_EXIT -ne 127 ]; then
      echo "[POST-TOOL-LINT] biome format 警告:"
      echo "$BIOME_FMT_OUTPUT" | head -20
    fi
  fi

  # N-08: Oxlint lint check (graceful if not installed)
  if command -v npx &>/dev/null; then
    # N-31: Add no-explicit-any for non-test files only
    OXLINT_EXTRA=""
    case "$FILE_PATH" in
      *.test.*|*__tests__*) ;;
      *) OXLINT_EXTRA="--deny=no-explicit-any" ;;
    esac
    # N-64: Use --fix for auto-fix (not just --deny-only)
    OXLINT_OUTPUT=$(timeout 3 npx oxlint --fix --silent $OXLINT_EXTRA "$FILE_PATH" 2>&1)
    OXLINT_EXIT=$?
    if [ $OXLINT_EXIT -eq 127 ]; then
      : # oxlint not installed — skip silently
    elif [ $OXLINT_EXIT -eq 124 ]; then
      echo "[POST-TOOL-LINT] oxlint タイムアウト (3s)"
      log_obs "oxlint=timeout"
    elif [ $OXLINT_EXIT -ne 0 ]; then
      echo "[POST-TOOL-LINT] oxlint エラー検出:"
      echo "$OXLINT_OUTPUT" | head -20
      log_obs "oxlint=error"
    else
      log_obs "oxlint=pass"
    fi
  fi
fi

# === Python (N-55) ===
if [ "$LANG" = "py" ]; then
  # Ruff format (graceful)
  if command -v ruff &>/dev/null; then
    RUFF_FMT=$(timeout 3 ruff format "$FILE_PATH" 2>&1)
    RUFF_FMT_EXIT=$?
    if [ $RUFF_FMT_EXIT -eq 124 ]; then
      echo "[POST-TOOL-LINT] ruff format タイムアウト (3s)"
      log_obs "ruff-fmt=timeout"
    elif [ $RUFF_FMT_EXIT -ne 0 ]; then
      echo "[POST-TOOL-LINT] ruff format エラー:"
      echo "$RUFF_FMT" | head -20
      log_obs "ruff-fmt=error"
    else
      log_obs "ruff-fmt=pass"
    fi

    # Ruff check with autofix
    RUFF_OUT=$(timeout 3 ruff check --fix "$FILE_PATH" 2>&1)
    RUFF_EXIT=$?
    if [ $RUFF_EXIT -eq 124 ]; then
      echo "[POST-TOOL-LINT] ruff check タイムアウト (3s)"
      log_obs "ruff-check=timeout"
    elif [ $RUFF_EXIT -ne 0 ]; then
      echo "[POST-TOOL-LINT] ruff check エラー:"
      echo "$RUFF_OUT" | head -20
      log_obs "ruff-check=error"
    else
      log_obs "ruff-check=pass"
    fi
  else
    log_obs "ruff=not-installed"
  fi
fi

# === Go (N-55) ===
if [ "$LANG" = "go" ]; then
  FILE_DIR=$(dirname "$FILE_PATH")

  # gofumpt format (graceful)
  if command -v gofumpt &>/dev/null; then
    GOFUMPT_OUT=$(timeout 3 gofumpt -w "$FILE_PATH" 2>&1)
    GOFUMPT_EXIT=$?
    if [ $GOFUMPT_EXIT -ne 0 ] && [ $GOFUMPT_EXIT -ne 124 ]; then
      echo "[POST-TOOL-LINT] gofumpt エラー:"
      echo "$GOFUMPT_OUT" | head -20
      log_obs "gofumpt=error"
    else
      log_obs "gofumpt=pass"
    fi
  fi

  # golangci-lint (graceful)
  if command -v golangci-lint &>/dev/null; then
    GCI_OUT=$(timeout 5 golangci-lint run --fix "$FILE_DIR/..." 2>&1)
    GCI_EXIT=$?
    if [ $GCI_EXIT -eq 124 ]; then
      echo "[POST-TOOL-LINT] golangci-lint タイムアウト (5s)"
      log_obs "golangci=timeout"
    elif [ $GCI_EXIT -ne 0 ]; then
      echo "[POST-TOOL-LINT] golangci-lint エラー:"
      echo "$GCI_OUT" | head -20
      log_obs "golangci=error"
    else
      log_obs "golangci=pass"
    fi
  else
    log_obs "golangci=not-installed"
  fi
fi

# === Rust (N-55) ===
if [ "$LANG" = "rs" ]; then
  # cargo fmt (graceful)
  if command -v cargo &>/dev/null; then
    CARGO_FMT=$(timeout 5 cargo fmt -- "$FILE_PATH" 2>&1)
    if [ $? -ne 0 ] && [ $? -ne 124 ]; then
      echo "[POST-TOOL-LINT] cargo fmt エラー:"
      echo "$CARGO_FMT" | head -20
      log_obs "cargo-fmt=error"
    else
      log_obs "cargo-fmt=pass"
    fi

    # cargo clippy (graceful)
    CLIPPY_OUT=$(timeout 10 cargo clippy --fix --allow-dirty --allow-staged 2>&1)
    CLIPPY_EXIT=$?
    if [ $CLIPPY_EXIT -eq 124 ]; then
      echo "[POST-TOOL-LINT] cargo clippy タイムアウト (10s)"
      log_obs "clippy=timeout"
    elif [ $CLIPPY_EXIT -ne 0 ]; then
      echo "[POST-TOOL-LINT] cargo clippy エラー:"
      echo "$CLIPPY_OUT" | head -20
      log_obs "clippy=error"
    else
      log_obs "clippy=pass"
    fi
  else
    log_obs "cargo=not-installed"
  fi
fi

# N-96: Comment-to-code ratio check (TS/JS/Python only)
if [[ "$LANG" == "ts" || "$LANG" == "py" ]] && [ -f "$FILE_PATH" ]; then
  TOTAL=$(wc -l < "$FILE_PATH" 2>/dev/null || echo 0)
  if [ "$TOTAL" -gt 10 ]; then
    COMMENTS=$(grep -cE '^\s*(//|#|\*|/\*)' "$FILE_PATH" 2>/dev/null || echo 0)
    CODE=$(grep -cvE '^\s*$|^\s*(//|#|\*|/\*)' "$FILE_PATH" 2>/dev/null || echo 1)
    if [ "$CODE" -gt 0 ]; then
      RATIO=$((COMMENTS * 100 / CODE))
      if [ "$RATIO" -gt 50 ]; then
        echo "[POST-TOOL-LINT] COMMENT_RATIO: ${RATIO}% (${COMMENTS}/${CODE} lines) — excessive, reduce comments"
        log_obs "comment-ratio=${RATIO}%_excessive"
      fi
    fi
  fi
fi

log_obs "done"
exit 0
