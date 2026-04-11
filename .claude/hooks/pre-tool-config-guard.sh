#!/bin/bash
# G-02 + N-56: PreToolUse hook - blocks Write/Edit to config files (with observability)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Normalize Windows paths
FILE_PATH=$(echo "$FILE_PATH" | sed 's|\\\\|/|g')

# N-56: Observability logging
LOG_FILE="/tmp/harness-hook-obs.log"
log_obs() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] PreToolUse config-guard file=$FILE_PATH $1" >> "$LOG_FILE" 2>/dev/null
}

# Check bypass env var
if [ "$CONFIG_GUARD_DISABLE" = "true" ]; then
  exit 0
fi

# Empty path - allow
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

# N-04: Expanded protected patterns (G-02 + N-04)
case "$BASENAME" in
  .eslintrc*|tsconfig*.json|.mcp.json|package.json|package-lock.json|.gitignore)
    log_obs "BLOCKED(config)"
    echo "[CONFIG-GUARD] 設定ファイル保護: ${BASENAME}への書き込みをブロックしました。意図的な変更の場合はCONFIG_GUARD_DISABLE=trueを設定してください"
    exit 2
    ;;
  biome.json|biome.jsonc|.biomeignore)
    log_obs "BLOCKED(biome-config)"
    echo "[CONFIG-GUARD] 設定ファイル保護: ${BASENAME}への書き込みをブロックしました。意図的な変更の場合はCONFIG_GUARD_DISABLE=trueを設定してください"
    exit 2
    ;;
  vitest.config.*|vite.config.*|jest.config.*|playwright.config.*)
    log_obs "BLOCKED(test-config)"
    echo "[CONFIG-GUARD] テスト/ビルド設定保護: ${BASENAME}への書き込みをブロックしました。意図的な変更の場合はCONFIG_GUARD_DISABLE=trueを設定してください"
    exit 2
    ;;
  .prettierrc*|.editorconfig|.npmrc|.nvmrc|.node-version)
    log_obs "BLOCKED(env-config)"
    echo "[CONFIG-GUARD] 環境設定保護: ${BASENAME}への書き込みをブロックしました。意図的な変更の場合はCONFIG_GUARD_DISABLE=trueを設定してください"
    exit 2
    ;;
  lefthook.yml|lefthook-local.yml)
    log_obs "BLOCKED(hook-config)"
    echo "[CONFIG-GUARD] Git Hook設定保護: ${BASENAME}への書き込みをブロックしました。意図的な変更の場合はCONFIG_GUARD_DISABLE=trueを設定してください"
    exit 2
    ;;
esac

# Check .husky/ path
case "$FILE_PATH" in
  *.husky/*)
    echo "[CONFIG-GUARD] Git Hook設定保護: .husky/配下への書き込みをブロックしました。意図的な変更の場合はCONFIG_GUARD_DISABLE=trueを設定してください"
    exit 2
    ;;
esac

# Check .claude/settings.json path
case "$FILE_PATH" in
  *.claude/settings.json)
    echo "[CONFIG-GUARD] 設定ファイル保護: settings.jsonへの書き込みをブロックしました。意図的な変更の場合はCONFIG_GUARD_DISABLE=trueを設定してください"
    exit 2
    ;;
esac

exit 0
