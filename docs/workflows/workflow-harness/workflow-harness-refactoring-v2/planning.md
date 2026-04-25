phase: planning
task: workflow-harness-refactoring-v2
status: complete

## decisions

- PL-01: 実装を4バッチに分割し並列性を最大化する。Batch A(Area1,4,6,7)は相互依存なく並列実行、Batch B(Area2)はindexer削除、Batch C(Area3)はdefs-stage1.tsの直列制約によりBatch B完了後に実行、Batch D(Area5)はB/Cと並列実行可能
- PL-02: 各バッチ完了時にtsc --noEmitとnpm testでビルド/テスト健全性を検証する。Batch A完了時点でhook系テスト、Batch B+C完了時点でmcp-server全テスト、Batch D完了時点で全テストを実行
- PL-03: Area3のimportパス変更は分割対象ファイルごとに「分割 -> import更新 -> tsc確認」の単位で進める。4ファイル一括分割は波及が大きいため1ファイルずつ確認
- PL-04: Area5のapprove遷移分離はapproval.tsの変更とテスト期待値修正を同一ステップで実行する。テスト修正を後回しにするとCI失敗状態が長期化するため
- PL-05: defs-stage1.tsはArea2(serena参照削除行6箇所)を先に完了しコミット後、Area3(defs-stage1a.tsへのテンプレート分離)に着手する。REQ-8の直列制約を遵守

## implementation-steps

### Step 1: Batch A - Area1 hooks分割 (REQ-1, REQ-2 / AC-1, AC-2)

1a. tool-gate.jsからPHASE_EXT(行66-95)とPHASE_BASH(行96-128)をphase-config.jsに抽出
  - phase-config.jsでmodule.exportsとしてエクスポート
  - tool-gate.jsでconst { PHASE_EXT, PHASE_BASH } = require('./phase-config')に置換
  - tool-gate.jsが200行未満であることを確認

1b. hook-utils.jsにJSON.parse統一関数がなければ確認(readStdin/parseHookInput)
  - loop-detector.js(22行目)のJSON.parse+stdin読み取りをhook-utils.parseHookInputに置換
  - context-watchdog.js(118行目)を同様に置換
  - session-boundary.js(99行目)を同様に置換
  - 各hookのexit code規約を保持(TM-5対策)

1c. hook関連テスト実行で回帰なしを確認

### Step 2: Batch A - Area4 skills参照更新 (REQ-6 / AC-6)

2a. skills/の6ファイルで"CLAUDE.md Sec"パターンをgrep検索し全箇所を特定
2b. 各参照を現行.claude/rules/配下のファイルパスに置換:
  - "CLAUDE.md Sec4" -> ".claude/rules/forbidden-actions.md"
  - 他のSecN参照も同様に対応する.claude/rules/ファイルに更新
2c. 置換後に"CLAUDE.md Sec"がゼロ件であることをgrep確認(TM-6対策)

### Step 3: Batch A - Area7 禁止語リスト統一 (REQ-7 / AC-7)

3a. workflow-rules.mdの禁止語リスト(12語)とforbidden-actions.mdの内容をdiff確認(TM-7対策)
3b. 和集合がforbidden-actions.mdに存在することを確認
3c. workflow-rules.mdの禁止語リスト12行を".claude/rules/forbidden-actions.md を参照"の1行に置換

### Step 4: Batch B - Area2 indexer削除 (REQ-3 / AC-3)

4a. indexer/ディレクトリを完全削除(serena-query.py, requirements.txt, setup.sh, .venv)
4b. defs-stage1.tsのserena参照6箇所を削除/更新
4c. package.jsonのpostinstallスクリプトからindexer関連を除去
4d. serena-integration.test.tsの3アサーションを更新(IA-02対策)
4e. tsc --noEmitで型チェック通過を確認
4f. コミット(Area3のdefs-stage1.ts作業の前提)

### Step 5: Batch C - Area3 mcp-server分割 (REQ-4 / AC-4)

5a. delegate-coordinator.ts(367行)を3ファイルに分割:
  - coordinator-spawn.ts: spawnAsync + extractResult (約76行)
  - coordinator-prompt.ts: buildCoordinatorPrompt + buildAllowedTools (約43行)
  - delegate-coordinator.ts: 本体 (約180行)、上記2ファイルをimport

5b. lifecycle.ts(243行)を2ファイルに分割:
  - lifecycle-start-status.ts: harness_start + harness_status (約115行)
  - lifecycle-next.ts: harness_next (約128行)

5c. dod-l1-l2.ts(221行)からspec関連50行をdod-spec.tsに分離

5d. defs-stage1.ts(202行)からscope_definitionテンプレート93行をdefs-stage1a.tsに分離
  - Step 4完了後のdefs-stage1.ts(serena参照削除済み)をベースにする(PL-05)

5e. importパス更新: handler.ts(3箇所), dod.ts(1箇所), definitions.ts(1箇所), テスト3件(IA-03)
5f. 各分割後にtsc --noEmitで確認(TM-2対策)、全ファイルが200行未満であることをwc -l確認

### Step 6: Batch D - Area5 approve遷移分離 (REQ-5 / AC-5)

6a. approval.ts:110のsm.advancePhase(taskId)呼び出しを削除
6b. approval.tsの戻り値からnextPhaseフィールドを削除
6c. 戻り値にnextAction: "call harness_next"フィールドを追加
6d. approval.test.tsの期待値を修正:
  - advancePhase未呼び出しの検証追加
  - nextPhaseフィールド不在の検証
  - nextActionフィールドの検証
6e. lifecycle.test.tsの関連テスト更新(TM-1対策)

### Step 7: 最終検証 (AC-8, AC-9)

7a. npm run build成功を確認(AC-8)
7b. 全テスト通過を確認(AC-9)
7c. AC-1~AC-7の個別確認:
  - tool-gate.js行数 < 200 (AC-1)
  - loop-detector/context-watchdog/session-boundaryにJSON.parseなし (AC-2)
  - indexer/ディレクトリ不在 (AC-3)
  - mcp-server/src/非テストファイル全て < 200行 (AC-4)
  - approval.tsにadvancePhase呼び出しなし、nextPhaseフィールドなし (AC-5)
  - skills/に"CLAUDE.md Sec"参照なし (AC-6)
  - workflow-rules.mdに禁止語リスト展開なし (AC-7)

## execution-order

```
Batch A (並列): Step 1 + Step 2 + Step 3
  |
Batch B (直列): Step 4 (indexer削除 + defs-stage1.ts serena参照除去)
  |
Batch C (直列): Step 5 (mcp-server分割、defs-stage1a.ts分離含む)
  |
Batch D (Batch A完了後いつでも): Step 6 (approve遷移分離)
  |
Final: Step 7 (全体検証)
```

## risk-mitigations

- TM-1(approve動作変更): Step 6でテスト期待値を同時修正、分離前後でテスト実行
- TM-2(importパス波及): Step 5で1ファイルずつtsc確認(PL-03)
- TM-3(defs-stage1.ts競合): Step 4完了+コミット後にStep 5着手(PL-05, REQ-8)
- TM-4(hook enforcement破壊): Step 1cでhookテストのベースライン+回帰確認
- TM-5(exit code差異): hook-utils.parseHookInputがエラー時exit codeを引数で受け取る設計
- TM-6(stale refs残存): Step 2cでgrep確認ゼロ件検証
- TM-7(禁止語欠落): Step 3aでdiff確認、和集合を保証

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/planning.md, plan, 7ステップ4バッチの実装計画(AC-1~AC-9対応)

## next

criticalDecisions: PL-05(defs-stage1.tsの直列制約)とPL-04(approve変更+テスト同時修正)が実装時の最重要制約
readFiles: planning.md, requirements.md, impact-analysis.md, threat-model.md
warnings: Batch Cの4ファイル分割はimportパス変更が9ファイルに波及するため1ファイルずつ検証すること。Area5のapprove分離後はスキルファイルに新しい呼び出し規約を明記すること。
