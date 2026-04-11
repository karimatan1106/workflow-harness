#!/bin/bash
# handoff-validator.sh — HANDOFF.toon の品質を検証する
# 他のスクリプトから source して使う or 単体実行で検証結果を出力

HANDOFF_FILE="${1:-.agent/handoff/HANDOFF.toon}"

if [ ! -f "$HANDOFF_FILE" ]; then
  echo "[HANDOFF-VALIDATOR] HANDOFF.toon が見つかりません: $HANDOFF_FILE"
  exit 1
fi

ERRORS=0
WARNINGS=0

# --- 必須セクション存在チェック ---
REQUIRED_SECTIONS=(
  "## 使用ツール"
  "## 現在のタスクと進捗"
  "## 試したこと・結果"
  "## ハーネス運用で学んだこと"
  "## 次のセッションで最初にやること"
  "## 注意点・ブロッカー"
)

for section in "${REQUIRED_SECTIONS[@]}"; do
  if ! grep -qF "$section" "$HANDOFF_FILE"; then
    echo "[HANDOFF-VALIDATOR:ERROR] 必須セクション欠落: $section"
    ERRORS=$((ERRORS + 1))
  fi
done

# --- 各セクションの内容量チェック（見出し行の次に最低1行の実質内容） ---
CONTENT_LINES=$(grep -cvE '^(#|$|---|\s*$)' "$HANDOFF_FILE" 2>/dev/null || echo 0)
if [ "$CONTENT_LINES" -lt 10 ]; then
  echo "[HANDOFF-VALIDATOR:ERROR] 内容が少なすぎます (${CONTENT_LINES}行 < 最低10行)"
  ERRORS=$((ERRORS + 1))
fi

# --- テンプレートそのまま検出 ---
if grep -qF 'タスク名：現在の状況' "$HANDOFF_FILE"; then
  echo "[HANDOFF-VALIDATOR:ERROR] テンプレートの例文がそのまま残っています"
  ERRORS=$((ERRORS + 1))
fi

# --- 「次のセッションで最初にやること」のアクション性チェック ---
NEXT_SECTION=$(sed -n '/## 次のセッション/,/^## /p' "$HANDOFF_FILE" | grep -cvE '^(#|$|\s*$)')
if [ "$NEXT_SECTION" -lt 1 ]; then
  echo "[HANDOFF-VALIDATOR:WARNING] 「次のセッションで最初にやること」に具体的アクションがありません"
  WARNINGS=$((WARNINGS + 1))
fi

# --- 検証可能な参照（コミットハッシュ or タスクID）の存在チェック ---
if ! grep -qE '[0-9a-f]{7,}|[0-9a-f]{8}-' "$HANDOFF_FILE"; then
  echo "[HANDOFF-VALIDATOR:WARNING] コミットハッシュやタスクIDの参照がありません"
  WARNINGS=$((WARNINGS + 1))
fi

# --- 結果サマリー ---
if [ "$ERRORS" -gt 0 ]; then
  echo "[HANDOFF-VALIDATOR] 品質チェック不合格: ${ERRORS}件のエラー, ${WARNINGS}件の警告"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo "[HANDOFF-VALIDATOR] 品質チェック合格（警告あり）: ${WARNINGS}件の警告"
  exit 0
else
  echo "[HANDOFF-VALIDATOR] 品質チェック合格"
  exit 0
fi
