#!/bin/bash
# context-watchdog.sh — コンテキスト喪失を検出し、記憶を自動再注入する
# トリガー: PreToolCall（全ツール呼び出し前に実行）
#
# 検出メカニズム:
#   1. ツール呼び出しカウンター（N回ごとにアクティブ検証付き再注入）
#   2. 同一ファイル重複読み込み検出（忘却シグナル）
#   3. 既知ピットフォールのパターン検出（ミス発生前ブロック）
#   4. Agent サブエージェント起動時の知識強制注入

CRITICAL_FILE=".agent/CRITICAL.md"
COUNTER_FILE=".agent/.watchdog-counter"
FILE_LOG=".agent/.file-read-log"
EDIT_COUNTER_FILE=".agent/.edit-counter"
CHECKPOINT_FILE=".agent/checkpoint.toon"
THRESHOLD=30  # N回ごとに再注入
REREAD_LIMIT=3  # 同一ファイルN回以上で警告
EDIT_THRESHOLD=10  # Write/Edit N回ごとにチェックポイント強制
CHECKPOINT_MAX_AGE=600  # チェックポイントの有効期限（秒）= 10分

# --- stdin からツール呼び出し情報を読み取り ---
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//')

# --- 1. ツール呼び出しカウンター ---
COUNT=0
if [ -f "$COUNTER_FILE" ]; then
  COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
fi
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

# [穴3対策] N回ごとにアクティブ検証プロンプト付き再注入
if [ $((COUNT % THRESHOLD)) -eq 0 ] && [ -f "$CRITICAL_FILE" ]; then
  echo "=== [WATCHDOG] 定期記憶リフレッシュ (${COUNT}回目) ==="
  cat "$CRITICAL_FILE"
  echo "[WATCHDOG:VERIFY] 確認: TOONハイフン区切り / decisions≥5 / ##直下prose≥5行 / サブエージェントにCRITICAL.md伝達"
  # チェックポイントがあれば現在地も注入
  if [ -f "$CHECKPOINT_FILE" ]; then
    echo ""
    echo "--- [WATCHDOG:CHECKPOINT] 最後に記録した作業状態 ---"
    cat "$CHECKPOINT_FILE"
    echo "--- [/WATCHDOG:CHECKPOINT] ---"
  fi
  echo "=== [/WATCHDOG] ==="
  echo ""
fi

# --- 2. 同一ファイル重複読み込み検出 ---
if [ "$TOOL_NAME" = "Read" ] || [ "$TOOL_NAME" = "read" ]; then
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
  if [ -n "$FILE_PATH" ]; then
    echo "$FILE_PATH" >> "$FILE_LOG"
    READ_COUNT=$(grep -cF "$FILE_PATH" "$FILE_LOG" 2>/dev/null || echo 0)
    if [ "$READ_COUNT" -ge "$REREAD_LIMIT" ]; then
      echo ""
      echo "[WATCHDOG] 同一ファイルを${READ_COUNT}回読み込んでいます: $(basename "$FILE_PATH")"
      echo "[WATCHDOG] コンテキスト圧縮による記憶喪失の可能性があります。"
      echo "[WATCHDOG] /recall コマンドで記憶を復元してください。"
      echo ""
    fi
  fi
fi

# --- 3. チェックポイント強制 ---
if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "write" ] || [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "edit" ]; then
  # チェックポイントファイル自体への書き込みはカウントしない
  TARGET_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
  IS_CHECKPOINT=false
  if echo "$TARGET_PATH" | grep -qF "checkpoint.toon"; then
    IS_CHECKPOINT=true
  fi

  if [ "$IS_CHECKPOINT" = false ]; then
    # Write/Edit カウンター更新
    EDIT_COUNT=0
    if [ -f "$EDIT_COUNTER_FILE" ]; then
      EDIT_COUNT=$(cat "$EDIT_COUNTER_FILE" 2>/dev/null || echo 0)
    fi
    EDIT_COUNT=$((EDIT_COUNT + 1))
    echo "$EDIT_COUNT" > "$EDIT_COUNTER_FILE"

    # N回ごとにチェックポイント鮮度を検査
    if [ $((EDIT_COUNT % EDIT_THRESHOLD)) -eq 0 ]; then
      NEED_CHECKPOINT=false
      if [ ! -f "$CHECKPOINT_FILE" ]; then
        NEED_CHECKPOINT=true
      else
        # チェックポイントの鮮度チェック
        if command -v stat >/dev/null 2>&1; then
          CP_TIME=$(stat -c %Y "$CHECKPOINT_FILE" 2>/dev/null || stat -f %m "$CHECKPOINT_FILE" 2>/dev/null || echo 0)
          NOW=$(date +%s)
          CP_AGE=$(( NOW - CP_TIME ))
          if [ "$CP_AGE" -gt "$CHECKPOINT_MAX_AGE" ]; then
            NEED_CHECKPOINT=true
          fi
        fi
      fi

      if [ "$NEED_CHECKPOINT" = true ]; then
        echo ""
        echo "=== [WATCHDOG:CHECKPOINT-REQUIRED] ==="
        echo "Write/Edit が ${EDIT_COUNT} 回実行されました。"
        echo "チェックポイントが古いか存在しません。"
        echo ""
        echo ".agent/checkpoint.toon に以下のTOON形式で書き出してください:"
        echo "  task: タスク名"
        echo "  phase: 現在のフェーズ名"
        echo "  done[N]{item}: 完了した作業を列挙"
        echo "  next[N]{item}: 次にやることを列挙"
        echo ""
        echo "チェックポイントを書いてから作業を続行してください。"
        echo "=== [/WATCHDOG:CHECKPOINT-REQUIRED] ==="
        echo ""
        exit 2
      fi
    fi
  fi

  # --- 4. 既知ピットフォール検出 ---
  CONTENT="$INPUT"

  # TOON バックスラッシュ検出
  if echo "$CONTENT" | grep -q '\.toon' && echo "$CONTENT" | grep -q '\\|'; then
    echo "[WATCHDOG:PITFALL] TOONにバックスラッシュ。引用符か別表現を使用。"
  fi
  # TOON アンダースコアファイル名検出
  if echo "$CONTENT" | grep -qE 'scope_definition\.toon|test_design\.toon|test_selection\.toon'; then
    echo "[WATCHDOG:PITFALL] TOONファイル名はハイフン区切り: scope-definition.toon"
  fi
  # 禁止語検出（docs/workflows 配下）
  if echo "$CONTENT" | grep -q 'docs/workflows/'; then
    if echo "$CONTENT" | grep -qE '未定[^義]|未確定|要検討|検討中|対応予定'; then
      echo "[WATCHDOG:PITFALL] 禁止語検出。「未定」系は使用禁止。"
    fi
  fi
fi

# --- 5. (Removed: オーケストレーター過剰探索検出 — pre-tool-guard が完全ブロックするため不要) ---

# --- 6. [穴1対策] Agent サブエージェント起動時の知識強制注入 ---
if [ "$TOOL_NAME" = "Agent" ] || [ "$TOOL_NAME" = "agent" ]; then
  if [ -f "$CRITICAL_FILE" ]; then
    echo ""
    echo "=== [WATCHDOG:SUBAGENT] サブエージェントに以下の知識を必ず伝達してください ==="
    cat "$CRITICAL_FILE"
    echo ""
    echo "[WATCHDOG:SUBAGENT] 上記を Agent の prompt パラメータに含めること。"
    echo "  特に重要: TOON ハイフン区切り / decisions 5件 / ## 直下 prose 5行 / 禁止語12個"
    echo "=== [/WATCHDOG:SUBAGENT] ==="
    echo ""
  fi
fi

exit 0
