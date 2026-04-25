# テスト設計書: ワークフロープロセス阻害要因完全解消

## サマリー

本テスト設計書は5件のワークフロー阻害要因修正（N-1〜N-5）に対する検証テストを定義する。
テスト対象は5つのソースファイルで、合計27のテストケースを5つのテストファイルに分割して実装する。
テスト形式はNode.jsのassertモジュールを使用したカスタムテストランナーで、N-3修正の有効性検証も兼ねる構造とした。
各テストはファイル内容の文字列検索により修正適用を検証する静的解析テストであり、MCPサーバー再起動は不要である。
テストファイルはsrc/backend/tests/unit/hooks/ディレクトリに配置し、node コマンドで直接実行可能な形式とする。

## テスト方針

### テスト実行環境

テストはNode.jsのassertモジュールとfsモジュールを使用した静的ファイル検証方式を採用する。対象ファイルを読み込み、修正後に期待される文字列パターンが存在することを確認する。この方式によりMCPサーバーの起動やワークフロー状態への依存なしにテストを実行できる。

### テストランナー形式

全テストファイルは以下の共通フォーマットで出力を生成する:

```
Test Suite: {テスト名}
=============================

  ✓ {テストケース説明}
  ✗ {失敗したテストケース説明}: {エラーメッセージ}

Tests: X passed, Y failed, Z total
Time:  0.01s
```

この形式はN-3修正後のtest-authenticity.tsのカスタムランナー対応パターン（passed/failed/total）に合致する設計である。

### テストファイル一覧

| テストファイル | 対象修正 | テストケース数 | 検証対象ファイル |
|---|---|---|---|
| test-n1-scope-validator.test.ts | N-1 | 3件 | scope-validator.ts |
| test-n2-phase-edit-guard.test.ts | N-2 | 5件 | phase-edit-guard.js |
| test-n3-test-authenticity.test.ts | N-3 | 7件 | test-authenticity.ts |
| test-n4-enforce-workflow.test.ts | N-4 | 8件 | enforce-workflow.js |
| test-n5-set-scope.test.ts | N-5 | 4件 | set-scope.ts |

## テストケース一覧

### N-1: scope-validator.ts 日本語パス対応テスト

テストファイル: `src/backend/tests/unit/hooks/test-n1-scope-validator.test.ts`

| ID | テストケース | 検証内容 | 期待結果 |
|---|---|---|---|
| N1-01 | git diffコマンドにcore.quotePath=falseが含まれる | scope-validator.tsの内容に`git -c core.quotePath=false diff`が存在する | 文字列マッチ成功 |
| N1-02 | 旧コマンド形式が残存していない | `'git diff --name-only --ignore-submodules HEAD'`が単独で存在しない | 旧形式の非存在確認 |
| N1-03 | N-1修正コメントが存在する | `// N-1:`で始まるコメント行が存在する | コメント存在確認 |

### N-2: phase-edit-guard.js stderr出力完全化テスト

テストファイル: `src/backend/tests/unit/hooks/test-n2-phase-edit-guard.test.ts`

| ID | テストケース | 検証内容 | 期待結果 |
|---|---|---|---|
| N2-01 | Bashホワイトリスト違反でconsole.errorが使用される | `console.error(`Hook validation failed (Bash whitelist):`が存在 | stderr出力への変更確認 |
| N2-02 | Fail Closedのcatchにstderrメッセージがある | `console.error('Hook validation failed unexpectedly`が存在 | メッセージ追加確認 |
| N2-03 | stdinエラーハンドラにstderrメッセージがある | `console.error('Failed to read input from stdin`が存在 | メッセージ追加確認 |
| N2-04 | JSONパースエラーにstderrメッセージがある | `console.error('Invalid JSON input from stdin`が存在 | メッセージ追加確認 |
| N2-05 | N-2修正コメントが4箇所以上ある | `// N-2:`コメントの出現回数が4以上 | コメント数量確認 |

### N-3: test-authenticity.ts バリデーション緩和テスト

テストファイル: `src/backend/tests/unit/hooks/test-n3-test-authenticity.test.ts`

| ID | テストケース | 検証内容 | 期待結果 |
|---|---|---|---|
| N3-01 | MIN_OUTPUT_LENGTHが100に設定されている | `MIN_OUTPUT_LENGTH = 100`が存在する | 値変更の確認 |
| N3-02 | MIN_OUTPUT_LENGTHが200でないことを確認 | `MIN_OUTPUT_LENGTH = 200`が存在しない | 旧値の非存在確認 |
| N3-03 | TEST_OUTPUT_INDICATORSにpassedパターンがある | indicators配列に`'passed'`が含まれる | カスタムランナー成功指標の追加確認 |
| N3-04 | TEST_OUTPUT_INDICATORSにfailedパターンがある | indicators配列に`'failed'`が含まれる | カスタムランナー失敗指標の追加確認 |
| N3-05 | TEST_OUTPUT_INDICATORSにtotalパターンがある | indicators配列に`'total'`が含まれる | カスタムランナー集計指標の追加確認 |
| N3-06 | TEST_FRAMEWORK_PATTERNSにcustom runner passedがある | `/passed\s*:\s*(\d+)/i`パターンが存在 | カスタムランナー数値抽出パターンの追加確認 |
| N3-07 | N-3修正コメントが存在する | `// N-3:`で始まるコメント行が複数存在する | コメント存在確認 |

### N-4: enforce-workflow.js 拡張子追加テスト

テストファイル: `src/backend/tests/unit/hooks/test-n4-enforce-workflow.test.ts`

| ID | テストケース | 検証内容 | 期待結果 |
|---|---|---|---|
| N4-01 | test_designフェーズに.test.jsが含まれる | test_designの拡張子リストに`.test.js`が存在 | JavaScript拡張子の追加確認 |
| N4-02 | test_implフェーズに.test.jsが含まれる | test_implの拡張子リストに`.test.js`が存在 | テスト実装フェーズへの追加確認 |
| N4-03 | testingフェーズに.test.jsが含まれる | testingの拡張子リストに`.test.js`が存在 | テスト実行フェーズへの追加確認 |
| N4-04 | regression_testフェーズに.test.jsが含まれる | regression_testの拡張子リストに`.test.js`が存在 | リグレッションテストフェーズへの追加確認 |
| N4-05 | e2e_testフェーズに.spec.jsが含まれる | e2e_testの拡張子リストに`.spec.js`が存在 | E2Eテストフェーズへの追加確認 |
| N4-06 | testingフェーズに.test.jsxが含まれる | testingの拡張子リストに`.test.jsx`が存在 | JSXテスト拡張子の追加確認 |
| N4-07 | 既存の.test.ts拡張子が維持されている | test_designの拡張子リストに`.test.ts`が存在 | TypeScript互換性の維持確認 |
| N4-08 | N-4修正コメントが5箇所以上ある | `// N-4:`コメントの出現回数が5以上 | 5フェーズ全てへのコメント追加確認 |

### N-5: set-scope.ts フェーズ制限緩和テスト

テストファイル: `src/backend/tests/unit/hooks/test-n5-set-scope.test.ts`

| ID | テストケース | 検証内容 | 期待結果 |
|---|---|---|---|
| N5-01 | ALLOWED_PHASESにdocs_updateが含まれる | ALLOWED_PHASES配列に`'docs_update'`が存在 | ドキュメント更新フェーズの追加確認 |
| N5-02 | ALLOWED_PHASESにregression_testが含まれる | 配列定義内に`'regression_test'`が存在 | リグレッションテストフェーズの追加確認 |
| N5-03 | 既存6フェーズが維持されている | research, requirements, planning, implementation, refactoring, testingが全て存在 | 既存フェーズとの互換性維持確認 |
| N5-04 | N-5修正コメントが存在する | `// N-5:`で始まるコメント行が存在する | コメント存在確認 |

## テスト実装詳細

### 共通テストランナー構造

各テストファイルは以下の共通構造で実装する:

```javascript
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// テスト対象ファイルパスの解決
let rootDir = __dirname;
while (!fs.existsSync(path.join(rootDir, 'workflow-plugin'))) {
  rootDir = path.dirname(rootDir);
}
const TARGET_FILE = path.join(rootDir, '{対象ファイルパス}');

// テスト実行
console.log('');
console.log('Test Suite: {テスト名}');
console.log('=============================');
console.log('');

let passed = 0;
let failed = 0;

// テストケース実行
try {
  // assertion
  passed++;
  console.log('  ✓ {テスト説明}');
} catch (e) {
  failed++;
  console.log('  ✗ {テスト説明}: ' + e.message);
}

// 結果集計
console.log('');
console.log('Tests: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('Time:  0.01s');
process.exit(failed > 0 ? 1 : 0);
```

### N-1テスト実装の要点

scope-validator.tsをfs.readFileSyncで読み込み、以下を検証する:
- `git -c core.quotePath=false diff --name-only --ignore-submodules HEAD`という文字列が含まれること
- 旧形式の`'git diff --name-only --ignore-submodules HEAD'`が単独では存在しないこと（`-c core.quotePath=false`を含む行は除外して検索）
- `// N-1:`コメントが存在すること

### N-2テスト実装の要点

phase-edit-guard.jsをfs.readFileSyncで読み込み、以下を検証する:
- Bashホワイトリスト違反のメッセージがconsole.errorで出力されること（console.logではないこと）
- 3つのcatchブロックにconsole.errorメッセージが追加されていること
- `// N-2:`コメントが4箇所以上あること

### N-3テスト実装の要点

test-authenticity.tsをfs.readFileSyncで読み込み、以下を検証する:
- MIN_OUTPUT_LENGTHの値が100であること
- TEST_OUTPUT_INDICATORSに'passed', 'failed', 'total'が含まれること
- TEST_FRAMEWORK_PATTERNSにカスタムランナー向けの正規表現が追加されていること

### N-4テスト実装の要点

enforce-workflow.jsをfs.readFileSyncで読み込み、PHASE_EXTENSIONS定義を解析する:
- 各フェーズの拡張子リスト文字列を抽出し、.test.js, .spec.js, .test.jsx, .spec.jsxの存在を確認
- 既存の.test.ts拡張子が維持されていることも確認

### N-5テスト実装の要点

set-scope.tsをfs.readFileSyncで読み込み、ALLOWED_PHASES配列を解析する:
- 'docs_update'と'regression_test'が配列内に存在することを確認
- 既存6フェーズが全て維持されていることを確認

## テスト実行手順

### 個別実行

```bash
node src/backend/tests/unit/hooks/test-n1-scope-validator.test.ts
node src/backend/tests/unit/hooks/test-n2-phase-edit-guard.test.ts
node src/backend/tests/unit/hooks/test-n3-test-authenticity.test.ts
node src/backend/tests/unit/hooks/test-n4-enforce-workflow.test.ts
node src/backend/tests/unit/hooks/test-n5-set-scope.test.ts
```

### 一括実行

```bash
for f in src/backend/tests/unit/hooks/test-n*.test.ts; do echo "--- $f ---"; node "$f"; done
```

### 期待される初回実行結果（TDD Redフェーズ）

test_implフェーズで作成直後のテストは、修正が未適用のため全て失敗する。これはTDD Red→Greenサイクルの正常動作である。implementationフェーズで修正を適用した後に全テストが通過（Green）することを確認する。

## リグレッションテスト方針

修正適用後のリグレッション確認として、以下の既存テストも実行する:

- 既存のfix-git-quotepath.test.tsテストが引き続き通過すること
- MCPサーバーのtscコンパイルがエラーなしで完了すること（build_checkサブフェーズ）
- 既存のワークフロー操作（workflow_start, workflow_next等）が正常動作すること
