# 前回ワークフロー実行時の問題 調査結果

## サマリー

前回の「ワークフロー10M対応全問題根本原因修正」タスク実行中に発生した5つの問題について根本原因を特定した。

- 問題1: task-index.jsonの手動sync必要 → saveTaskIndex()実装済みだがMCPサーバーモジュールキャッシュにより未反映、かつdiscoverTasks()がワークフロー状態ではなくディレクトリスキャン結果を使用
- 問題2: スコープバリデーターが事前変更をブロック → git diffがタスク開始前の変更を含み、除外ロジックがない
- 問題3: ループ検出フックの間欠的エラー → stdinのerror/endイベント競合によるレース条件
- 問題4: subagentの不完全実装 → loop-detectorの編集閾値(implementation=10)が大規模実装に不十分
- 問題5: bash-whitelistにgit checkout/restoreがない → BASH_WHITELIST定義に欠落

## 調査結果

5つの問題全ての根本原因を特定した。
問題1はMCPサーバーのモジュールキャッシュによりsaveTaskIndex()の新実装が実行されていないことが原因である。
問題2はスコープバリデーターがタスク開始前の既存変更を区別できないことが原因である。
問題3はloop-detector.jsのstdinイベントハンドリングにおけるレース条件が原因である。
問題4はloop-detectorの編集閾値が大規模実装に対して低すぎることが原因である。
問題5はBASH_WHITELISTにgit checkout/restoreコマンドが登録されていないことが原因である。
いずれの問題もコードレベルの修正で解決可能であり、設計上の根本的な問題ではない。

## 既存実装の分析

### 影響を受けるファイル
- workflow-plugin/hooks/loop-detector.js: stdinエラーハンドリング、編集閾値定義
- workflow-plugin/hooks/bash-whitelist.js: BASH_WHITELIST定義
- workflow-plugin/mcp-server/src/state/manager.ts: saveTaskIndex(), updateTaskPhase()
- workflow-plugin/mcp-server/src/validation/scope-validator.ts: validateScopePostExecution()
- workflow-plugin/mcp-server/src/tools/start.ts: workflow_start時のスナップショット記録

### 既存テスト
- 772テスト全成功（前回タスクのベースライン）
- テストファイル64個

## 問題1: task-index.json手動sync問題

### 根本原因
MCP serverのモジュールキャッシュにより、コード変更が反映されない。加えて、saveTaskIndex()の実装がdiscoverTasks()を呼んでディレクトリスキャンを行うため、workflow-state.jsonの最新フェーズ情報を正しく反映できていない可能性がある。

### コード分析
- manager.ts L468-491: saveTaskIndex()はdiscoverTasks()でタスクリストを再発見してtask-index.jsonに書き込む
- manager.ts L806-814: updateTaskPhase()がフェーズ遷移時にsaveTaskIndex()を呼ぶ
- discover-tasks.js L48-85: readTaskIndexCache()がTTLチェック付きでtask-index.jsonを読む
- enforce-workflow.js: task-index.jsonからフェーズ情報を取得してHMAC検証を行う

### 発生シナリオ
1. MCP serverがdist/state/manager.jsをメモリ上に読み込む
2. ソースコード(manager.ts)を編集・コンパイルしても、既に読み込まれたモジュールは変わらない
3. workflow_next()実行時、古いsaveTaskIndex()（no-op版）が実行される
4. task-index.jsonが更新されず、hooksが古いフェーズ情報で判定する

## 問題2: スコープバリデーター事前変更ブロック

### 根本原因
scope-validator.tsのvalidateScopePostExecution()が`git diff --name-only HEAD`で全変更ファイルを取得するが、タスク開始前から存在する変更を除外するロジックがない。

### コード分析
- scope-validator.ts L734-818: git diffの結果全体をスコープチェック対象にする
- EXCLUDE_PATTERNS (L646-656): .md, package.json, .claude/state/, docs/workflows/等は除外されるが、ソースコードの事前変更は除外されない
- タスク開始時のgit statusスナップショットを記録・比較する仕組みがない

### 改善案
タスク開始時(workflow_start)にgit diff --name-onlyの結果をworkflow-state.jsonにpreExistingChangesとして記録し、validateScopePostExecution()でそれを除外する。

## 問題3: ループ検出フックの間欠的エラー

### 根本原因
loop-detector.jsのstdinイベントハンドリングでerrorとendイベントのレース条件が発生している。

### コード分析
- loop-detector.js L420-450: stdinのdata/error/endイベントをそれぞれon()で登録
- errorハンドラとendハンドラの両方がclearTimeout()とprocess.exit()を呼ぶ
- stdinパイプがclose()された際、稀にerrorイベントが先に発火し、"No stderr output"が返される

### 改善案
stdinのerrorイベントをonce()で登録し、endイベント処理後はerrorリスナーを削除する。またはerrorイベントでprocess.exit(2)ではなくprocess.exit(0)にして警告のみにする。

## 問題4: subagentの不完全実装（loop-detectorブロック）

### 根本原因
loop-detector.jsのPHASE_EDIT_LIMITS(implementation=10)が大規模実装作業に対して不十分。subagentが1つのファイルを10回以上編集するとブロックされる。

### コード分析
- loop-detector.js L81-89: PHASE_EDIT_LIMITS定義。implementationフェーズは10回が上限
- checkLoop(): 5分ウィンドウ内の同一ファイル編集回数をカウント
- subagentが大規模な変更（関数追加、クラス変更等）を段階的に行うと、1ファイルへの編集が10回を超えやすい

### 改善案
implementation/refactoringフェーズの閾値を20に引き上げる。または5分ウィンドウを10分に拡大する。

## 問題5: bash-whitelistにgit checkout/restoreがない

### 根本原因
BASH_WHITELISTのgitカテゴリにgit checkout/restoreコマンドが定義されていない。

### コード分析
- bash-whitelist.js L35-90: gitカテゴリにはgit add, commit, push, pull, fetchのみ
- git checkout/restoreはどのカテゴリにも含まれていない
- docs_updateやcommitフェーズでpre-existing変更を元に戻す手段がない

### 改善案
BASH_WHITELIST.gitにgit checkout, git restoreを追加する。ただし、git checkout -bやgit checkout <branch>等のブランチ操作は別途検討が必要。
