#!/bin/bash
# handoff-reader.sh — セッション開始時に HANDOFF.toon を強制注入
# トリガー: user-prompt-submit（ユーザーの最初の発言時に実行）
# 仕組み: マーカーファイルが30分以上古い or 存在しない → HANDOFF.toon を注入

HANDOFF_FILE=".agent/handoff/HANDOFF.toon"
MARKER_FILE=".agent/.handoff-session-marker"

# HANDOFF.toon が存在しなければ何もしない
if [ ! -f "$HANDOFF_FILE" ]; then
  exit 0
fi

# マーカーファイルの鮮度チェック（30分 = 1800秒）
INJECT=false
if [ ! -f "$MARKER_FILE" ]; then
  INJECT=true
else
  # マーカーの更新時刻と現在時刻を比較
  if command -v stat >/dev/null 2>&1; then
    MARKER_TIME=$(stat -c %Y "$MARKER_FILE" 2>/dev/null || stat -f %m "$MARKER_FILE" 2>/dev/null || echo 0)
    CURRENT_TIME=$(date +%s)
    ELAPSED=$(( CURRENT_TIME - MARKER_TIME ))
    if [ "$ELAPSED" -gt 1800 ]; then
      INJECT=true
    fi
  else
    # stat が使えない場合は常に注入
    INJECT=true
  fi
fi

if [ "$INJECT" = true ]; then
  echo ""
  echo "=== [HANDOFF] 前回セッションの引き継ぎ情報 ==="
  cat "$HANDOFF_FILE"
  echo ""

  # HANDOFF.toon の品質チェック（Gap 4: 品質保証）
  VALIDATOR=".claude/hooks/handoff-validator.sh"
  if [ -f "$VALIDATOR" ]; then
    VALIDATION_OUTPUT=$(bash "$VALIDATOR" "$HANDOFF_FILE" 2>&1)
    VALIDATION_EXIT=$?
    if [ $VALIDATION_EXIT -ne 0 ]; then
      echo "[HANDOFF:WARNING] 引き継ぎ情報に品質問題があります:"
      echo "$VALIDATION_OUTPUT"
      echo "[HANDOFF:WARNING] /handoff で再作成を検討してください。"
      echo ""
    fi
  fi

  echo "=== [/HANDOFF] 上記を踏まえて作業を継続してください ==="
  echo ""

  # N-05: 4-step startup routine
  echo "=== [STARTUP] 環境チェック ==="

  # Step 1: Git status + log check (N-66: git log as session bridge)
  GIT_STATUS=$(timeout 3 git status --porcelain 2>/dev/null | head -5)
  GIT_BRANCH=$(timeout 3 git branch --show-current 2>/dev/null)
  if [ -n "$GIT_STATUS" ]; then
    GIT_COUNT=$(echo "$GIT_STATUS" | wc -l)
    echo "[STARTUP:1/5] Git: branch=$GIT_BRANCH, uncommitted=${GIT_COUNT}件"
  else
    echo "[STARTUP:1/5] Git: branch=$GIT_BRANCH, clean"
  fi

  # N-66: Git log — most trustworthy "what happened" record
  GIT_LOG=$(timeout 3 git log --oneline -20 2>/dev/null)
  if [ -n "$GIT_LOG" ]; then
    echo "[STARTUP:2/5] Recent commits:"
    echo "$GIT_LOG" | head -10 | sed 's/^/  /'
  fi

  # Step 2: Dependency integrity check
  if [ -f "package.json" ]; then
    if [ -d "node_modules" ]; then
      echo "[STARTUP:3/5] Dependencies: node_modules exists"
    else
      echo "[STARTUP:3/5] Dependencies: node_modules missing. Run npm install."
    fi
  else
    echo "[STARTUP:3/5] Dependencies: no package.json"
  fi

  # Step 3: Test readiness check
  VITEST_CONFIG=$(find . -maxdepth 3 -name "vitest.config.*" 2>/dev/null | head -1)
  if [ -n "$VITEST_CONFIG" ]; then
    echo "[STARTUP:4/5] Test: vitest configured ($VITEST_CONFIG)"
  else
    echo "[STARTUP:4/5] Test: no vitest config found"
  fi

  # Step 4: Progress recovery
  PROGRESS_FILE=".claude/state/claude-progress.json"
  if [ -f "$PROGRESS_FILE" ]; then
    CURRENT_PHASE=$(timeout 2 grep -o '"currentPhase":"[^"]*"' "$PROGRESS_FILE" | head -1 | sed 's/.*"currentPhase":"//;s/"$//')
    TASK_ID=$(timeout 2 grep -o '"taskId":"[^"]*"' "$PROGRESS_FILE" | head -1 | sed 's/.*"taskId":"//;s/"$//')
    echo "[STARTUP:5/5] Progress: taskId=${TASK_ID:-none}, phase=${CURRENT_PHASE:-none}"
  else
    echo "[STARTUP:5/5] Progress: no active task"
  fi

  echo "=== [/STARTUP] ==="
  echo ""

  # マーカーを更新（次回以降は注入しない）
  touch "$MARKER_FILE"

  # watchdog カウンターとファイル読み込みログをリセット（新セッション）
  echo "0" > ".agent/.watchdog-counter"
  rm -f ".agent/.file-read-log"
  rm -f ".agent/.coordinator-ids"
fi

exit 0
