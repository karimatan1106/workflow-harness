# 実装仕様書: 前回ワークフロー実行時の問題根本原因修正

## サマリー

5つの修正（FIX-1からFIX-5）の実装仕様を定義する。
FIX-1はMCPサーバー再起動とビルド確認の運用手順である。
FIX-2はstart.tsでのpreExistingChanges記録とscope-validator.tsでの除外ロジック追加である。
FIX-3はloop-detector.jsのstdinイベントハンドリング改善である。
FIX-4はloop-detector.jsの編集閾値を10から20に引き上げる変更である。
FIX-5はbash-whitelist.jsにgit checkout/restoreを追加しブランチ操作をブラックリスト化する変更である。

## 概要

前回のワークフロータスク実行時に発生した5つの問題の根本原因を修正する仕様書である。
修正対象はhooksファイル2つ（loop-detector.js、bash-whitelist.js）とMCPサーバーのTypeScriptファイル3つ（start.ts、scope-validator.ts、next.ts）である。
FIX-1はコード変更不要の運用手順であり、FIX-2からFIX-5はコード修正が必要である。
既存の772テストを全て維持しつつ、新たなテストケースを追加する方針である。
修正は低リスクのFIX-4/5から順に実装し、最もリスクの高いFIX-2を最後に実装する。

## 実装計画

### FIX-1: task-index.json sync修正（運用手順）

MCP serverのモジュールキャッシュが原因のためコード変更は不要である。
MCPサーバーを再起動してsaveTaskIndex()の新実装を有効化する。
ビルド後のdist/state/manager.jsにsaveTaskIndex()の実装が含まれていることを確認する。
再起動後にworkflow_next()を実行しtask-index.jsonが自動更新されることを検証する。

### FIX-2: スコープバリデーター事前変更除外

修正1としてstart.tsでのpreExistingChanges記録ロジックを追加する。
workflow_start実行時にgit diff --name-only --ignore-submodules HEADを実行する。
結果をtaskState.scope.preExistingChangesに保存する。
git diffの実行に失敗した場合は空配列をセットし警告ログを出力する。

修正2としてscope-validator.tsの除外ロジックを追加する。
validateScopePostExecution()の引数にpreExistingChanges配列を追加する。
changedFilesループ内でpreExistingChangesに含まれるファイルをスキップする。

修正3としてnext.tsのコールサイトを更新する。
validateScopePostExecution()の呼び出し箇所でtaskState.scope.preExistingChangesを渡す。

### FIX-3: loop-detector stdinエラー修正

loop-detector.jsのstdinイベントハンドリングを修正する。
eventHandledフラグを導入しerror/endイベントの重複処理を防止する。
process.stdin.on('error')をprocess.stdin.once('error')に変更する。
handleExit()関数でclearTimeout()とprocess.exit()を一元管理する。

### FIX-4: loop-detector編集閾値引き上げ

PHASE_EDIT_LIMITSのimplementationを10から20に変更する。
PHASE_EDIT_LIMITSのrefactoringを10から20に変更する。
他のフェーズの閾値は変更しない（research=3, requirements=3, test_impl=7, default=5）。

### FIX-5: bash-whitelist git checkout/restore追加

BASH_WHITELIST.gitに'git checkout --'と'git restore'を追加する。
安全策として以下のパターンをブラックリスト化する。
git checkout -bはブランチ作成のため禁止する。
git checkout .は全変更破棄のため禁止する。
git restore .は全ファイル復元のため禁止する。

## 変更対象ファイル

### 変更が必要なファイル

workflow-plugin/mcp-server/src/tools/start.ts: FIX-2のpreExistingChanges記録ロジック追加。
workflow-plugin/mcp-server/src/validation/scope-validator.ts: FIX-2の除外ロジック追加。
workflow-plugin/mcp-server/src/tools/next.ts: FIX-2のコールサイト更新。
workflow-plugin/hooks/loop-detector.js: FIX-3のstdinエラー修正とFIX-4の閾値引き上げ。
workflow-plugin/hooks/bash-whitelist.js: FIX-5のgit checkout/restore追加。

### 確認のみのファイル

workflow-plugin/mcp-server/src/state/manager.ts: FIX-1の動作確認。
workflow-plugin/mcp-server/dist/state/manager.js: FIX-1のビルド結果確認。
workflow-plugin/hooks/lib/discover-tasks.js: FIX-1のキャッシュ読み込み確認。

## テスト戦略

既存772テスト全成功を維持する。
FIX-2のユニットテストとしてscope-validatorにpreExistingChanges除外テストを追加する。
FIX-2の統合テストとしてタスク開始時のpreExistingChanges記録を検証する。
FIX-4のテストとしてloop-detectorの閾値変更後の動作確認を行う。
FIX-5のテストとしてbash-whitelistにgit checkout/restoreの許可と拒否テストを追加する。
リグレッションテストとしてベースラインの772テストとの差分がないことを確認する。

## 実装順序

Phase1としてFIX-4（閾値引き上げ）とFIX-5（git checkout/restore追加）を実装する。数値変更と配列要素追加のみであり低リスクである。
Phase2としてFIX-3（stdinエラー修正）を実装する。イベントハンドリングの改善であり中リスクである。
Phase3としてFIX-2（スコープバリデーター事前変更除外）を実装する。start.ts、scope-validator.ts、next.tsの3ファイル修正が必要であり最もリスクが高い。
FIX-1（task-index.json sync）は運用手順のみでありコード変更は不要である。MCPサーバー再起動で対応する。
全修正完了後にnpm run buildを実行しTypeScriptコンパイルエラーがないことを確認する。
