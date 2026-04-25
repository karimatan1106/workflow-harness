#!/bin/bash
# hooks/のNode.jsスクリプト動作確認コマンド

# phase-edit-guard.jsの構文確認
node --check "$(git rev-parse --show-toplevel)/workflow-harness/hooks/phase-edit-guard.js"

# hook-utils.jsの構文確認
node --check "$(git rev-parse --show-toplevel)/workflow-harness/hooks/hook-utils.js"

# phase-edit-guard.jsの行数確認（200行制限チェック）
wc -l "$(git rev-parse --show-toplevel)/workflow-harness/hooks/phase-edit-guard.js"
