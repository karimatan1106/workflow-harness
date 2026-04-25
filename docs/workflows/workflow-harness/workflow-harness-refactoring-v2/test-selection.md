phase: test_selection
task: workflow-harness-refactoring-v2
status: complete

## decisions

- TS-1: import path変更によるテスト影響は6ファイル。全て既存テストのimportパス修正で対応。
- TS-2: approval.test.ts は advancePhase 呼び出しと nextPhase レスポンス期待値の更新が必要。
- TS-3: serena-integration.test.ts は indexer 存在チェックのアサーション削除または更新が必要。
- TS-4: 新規テスト追加は不要。既存テストスイート + 構造チェック(grep/wc)で検証可能。
- TS-5: テスト実行は npm test in workflow-harness/mcp-server/ で統一。

## affected-tests

### import path変更 (3ファイル)

delegate-coordinator.ts からimportしているテストファイル3件。
リファクタリング後の新パスへimport文を書き換える。

### import path変更 (個別)

lifecycle.ts からimportしているテストファイル。新モジュールパスへ修正。
dod-l1-l2.ts からimportしているテストファイル。新モジュールパスへ修正。
defs-stage1.ts からimportしているテストファイル。新モジュールパスへ修正。

### 期待値変更

approval.test.ts: advancePhase呼び出しとnextPhaseレスポンスの期待値を更新。
serena-integration.test.ts: indexer存在チェックのアサーションを削除または更新。

### 新規テスト

なし。既存テストスイートと構造チェック(grep/wc)でカバレッジ十分。

## test-execution

command: npm test
cwd: workflow-harness/mcp-server/

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/test-selection.md, spec, テスト選定

## next

criticalDecisions: TS-1(import path一括修正), TS-2(approval期待値更新), TS-3(serena indexerアサーション削除)
readFiles: docs/workflows/workflow-harness-refactoring-v2/test-selection.md
warnings: approval.test.tsとserena-integration.test.tsは単純なimport修正ではなくロジック期待値の変更を伴う
