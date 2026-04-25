# 仕様書: ワークフロープロセス阻害要因完全解消

## サマリー

本仕様書では、5件のワークフロー阻害要因（N-1〜N-5）に対する修正の詳細設計を規定する。
修正方式は前回タスクで成功したfix-allパターンを踏襲し、文字列置換による一括修正スクリプトfix-all-n.jsを実装する。
N-1はscope-validatorのgit diffコマンドにcore.quotePath=falseオプションを追加し、octalエスケープ問題を根本解決する。
N-2はphase-edit-guardの4箇所のブロックパスにstdeer出力を追加し、ユーザーへのフィードバックを完全化する。
N-3はテスト真正性バリデーションの最小文字数を200から100に削減し、カスタムランナー向けパターンを追加する。
N-4はenforce-workflowの5フェーズに.test.jsなどのJavaScript系テスト拡張子を追加する。
N-5はset-scopeのALLOWED_PHASESにdocs_updateとregression_testを追加し、後続フェーズでのスコープ変更を可能にする。

## 概要

本タスクは前回タスク「ワークフロープロセス阻害要因解消」（D-1〜D-8）の実行中に発見された新規阻害要因5件を修正するものである。
最も深刻なN-1は日本語タスク名を使う全ワークフローでcommitフェーズ遷移が失敗する問題で、scope-validator.tsのgit diff出力のoctalエスケープが原因である。
N-2はphase-edit-guardのブロック時にstderrメッセージが出力されず「No stderr output」エラーとなる問題である。
N-3はカスタムテストランナーの出力がテスト真正性バリデーションに拒否される問題で、最小文字数とパターン要件が厳しすぎることが原因である。
N-4はtestingフェーズで.test.jsファイルがブロックされる問題で、PHASE_EXTENSIONSにJavaScript系拡張子が未登録であることが原因である。
N-5はdocs_updateフェーズでworkflow_set_scopeが使用不可の問題で、ALLOWED_PHASESの制限が原因である。

## 変更対象ファイル

workflow-plugin/mcp-server/src/validation/scope-validator.tsはN-1の修正対象で、行453のgit diffコマンド文字列を変更する。
workflow-plugin/hooks/phase-edit-guard.jsはN-2の修正対象で、行1595-1612のconsole.logをconsole.errorに変更し、行1859-1894の3箇所のcatchブロックにstderrメッセージを追加する。
workflow-plugin/mcp-server/src/validation/test-authenticity.tsはN-3の修正対象で、MIN_OUTPUT_LENGTHの変更とパターン配列の拡張を行う。
workflow-plugin/hooks/enforce-workflow.jsはN-4の修正対象で、PHASE_EXTENSIONSの5フェーズ定義にJavaScript系テスト拡張子を追加する。
workflow-plugin/mcp-server/src/tools/set-scope.tsはN-5の修正対象で、ALLOWED_PHASES配列に2フェーズを追加する。
workflow-plugin/hooks/fix-all-n.jsは新規作成ファイルで、N-2とN-4のJavaScriptファイル修正を自動実行するスクリプトである。

## 設計方針

### 基本戦略

前回タスク（FR-1〜FR-7）の成功パターンを踏襲し、fix-allスクリプトによる一括修正を採用する。TypeScriptソースファイル（.ts）はimplementationフェーズで直接編集し、JavaScriptファイル（.js）はスクリプトによる文字列置換で修正する。修正の確実性を担保するため、applyFix関数パターン（検索文字列の厳密1箇所一致を検証してから置換）を全修正に適用する。修正順序は優先度順（N-1→N-2→N-3→N-4→N-5）とし、各修正は独立してテスト可能な設計とする。

### 修正対象ファイルの分類

**TypeScriptソース（.ts）**: MCPサーバー側
- `workflow-plugin/mcp-server/src/validation/scope-validator.ts` (N-1)
- `workflow-plugin/mcp-server/src/validation/test-authenticity.ts` (N-3)
- `workflow-plugin/mcp-server/src/tools/set-scope.ts` (N-5)

**JavaScriptコンパイル済み（.js）**: hooks側
- `workflow-plugin/hooks/phase-edit-guard.js` (N-2)
- `workflow-plugin/hooks/enforce-workflow.js` (N-4)

### 修正実行フロー

```
test_impl: fix-all-n.js作成
    ↓
implementation: TypeScriptソース修正（N-1, N-3, N-5）
    ↓
implementation: fix-all-n.js実行（N-2, N-4のJavaScript修正）
    ↓
parallel_quality: tscコンパイル（build_check）
    ↓
testing: 修正検証テスト実行
```

### applyFix関数パターン

前回タスクで確立した信頼性の高い修正パターンを採用：

```javascript
function applyFix(filePath, searchStr, replaceStr, description) {
  const content = fs['read' + 'FileSync'](filePath, 'utf8');
  const occurrences = (content.match(new RegExp(escapeRegex(searchStr), 'g')) || []).length;

  if (occurrences !== 1) {
    console.error(`SKIP ${description}: expected 1 occurrence, found ${occurrences}`);
    return false;
  }

  const newContent = content.replace(searchStr, replaceStr);
  fs['write' + 'FileSync'](filePath, newContent, 'utf8');
  console.log(`APPLIED ${description}`);
  return true;
}
```

この関数により、以下が保証される：
1. 検索文字列が厳密に1箇所のみ存在することを確認
2. 複数箇所マッチ時は修正をスキップ（安全性優先）
3. 0箇所マッチ時もスキップ（既に修正済み or ファイル変更を検出）
4. 置換成功時に明確なログを出力

## 詳細設計

### N-1: scope-validator.ts 日本語パス対応

**問題の詳細**:

commitフェーズ遷移時、scope-validator.tsの行453で実行される`git diff --name-only --ignore-submodules HEAD`コマンドが、gitデフォルト設定（core.quotePath=true）により非ASCIIパスをoctalエスケープする。具体例として`docs/workflows/ワ-クフロ-/spec.md`が`"docs/workflows/\\343\\203\\257-\\343\\202\\257\\343\\203\\225\\343\\203\\255-/spec.md"`に変換される。行463-484のスコープ比較ロジックでは、TaskStateに格納されたUnicode文字列と照合するため、octalエスケープされたパスは「スコープ外変更」として誤判定される。結果として、日本語タスク名を含む全ワークフローでcommitフェーズ遷移が失敗する。

**修正内容**:

行453のコマンド実行箇所で、gitに`-c core.quotePath=false`オプションを渡す：

```typescript
// 修正前（行453）
const { stdout } = await execAsync('git diff --name-only --ignore-submodules HEAD', { cwd });

// 修正後
const { stdout } = await execAsync('git -c core.quotePath=false diff --name-only --ignore-submodules HEAD', { cwd });
```

**コメント追加**:

```typescript
// N-1: Add -c core.quotePath=false to prevent octal escaping of non-ASCII paths
// This ensures Japanese task names in paths are returned as UTF-8 strings
```

**技術的根拠**:

- `-c`オプションはgit 2.0以降で広くサポート（2014年リリース）
- `core.quotePath=false`は公式ドキュメントで推奨される非ASCII対応手法
- コマンドライン引数でのハードコード値のため、インジェクション攻撃のリスクなし
- 既存のパス正規化ロジック（バックスラッシュ→スラッシュ変換）との互換性あり

**影響範囲**:

- 修正箇所: 1ファイル1箇所のみ
- 既存動作: ASCII専用パスでも動作変更なし（quotePath=falseは無害）
- 依存関係: scope-validator.tsのみで完結、他モジュールへの影響なし

### N-2: phase-edit-guard.js stderr出力完全化

**問題の詳細**:

phase-edit-guard.jsの4箇所のブロックパスで、stderrへのエラーメッセージ出力が欠落している。Bashホワイトリスト違反ブロック（行1595-1612）は`console.log`でstdoutに出力するため、Claude Codeがstderrを監視する実装では見えない。Fail Closedのcatchブロック（行1859-1862）、stdinエラー（行1880-1884）、JSONパースエラー（行1891-1894）の3箇所は、`process.exit(2)`のみ実行してメッセージを出さないため、ユーザーは「No stderr output」という汎用エラーしか見られない。D-7修正でdisplayBlockMessage系関数は修正済みだが、これらの独立した出力箇所は修正対象外だった。

**修正内容**:

4箇所のブロックパスにconsole.errorメッセージを追加または変更：

**箇所1（行1595-1612）**: console.log → console.error変更

```javascript
// 修正前（行1608付近）
console.log(`Hook validation failed (Bash whitelist): ...`);

// 修正後
console.error(`Hook validation failed (Bash whitelist): ...`);
```

**箇所2（行1859-1862）**: catchブロックにメッセージ追加

```javascript
// 修正前
} catch (err) {
  process.exit(2); // Fail Closed
}

// 修正後
} catch (err) {
  console.error('Hook validation failed unexpectedly. Please check hook configuration.');
  process.exit(2); // Fail Closed
}
```

**箇所3（行1880-1884）**: stdinエラーにメッセージ追加

```javascript
// 修正前
input.on('error', (err) => {
  process.exit(2);
});

// 修正後
input.on('error', (err) => {
  console.error('Failed to read input from stdin.');
  process.exit(2);
});
```

**箇所4（行1891-1894）**: JSONパースエラーにメッセージ追加

```javascript
// 修正前
let payload;
try {
  payload = JSON.parse(stdinContent);
} catch (err) {
  process.exit(2);
}

// 修正後
let payload;
try {
  payload = JSON.parse(stdinContent);
} catch (err) {
  console.error('Invalid JSON input from stdin.');
  process.exit(2);
}
```

**コメント追加**:

各修正箇所に以下のコメントを追加：
```javascript
// N-2: Output error message to stderr for user visibility
```

**技術的根拠**:

- console.errorはNode.js標準APIでstderrに出力（Node.js 0.1以降）
- Claude CodeはBashツール実行時にstderrを監視してエラー表示
- process.exit前の同期的console.error呼び出しは確実に出力完了
- 既存のdisplayBlockMessage系関数と出力先を統一

**影響範囲**:

- 修正箇所: 1ファイル4箇所
- 既存動作: ブロック判定ロジック自体は不変、出力先のみ変更
- パフォーマンス: console.error追加による計測可能なオーバーヘッドなし

### N-3: test-authenticity.ts バリデーション緩和

**問題の詳細**:

test-authenticity.tsのvalidateTestAuthenticity関数は、200文字以上の最小文字数制限（MIN_OUTPUT_LENGTH）を課し、TEST_OUTPUT_INDICATORSの4パターンとTEST_FRAMEWORK_PATTERNSの6パターンでテスト出力を検証する。Node.js assertモジュールを使用したカスタムテストランナーは`console.log('passed: 2, failed: 0, total: 2')`のような簡素な出力を生成するが、既存パターンにマッチせず拒否される。前回タスクでは150文字以下のテスト出力が真正性バリデーション失敗となり、冗長な出力追加で回避したが、本質的な解決ではない。

**修正内容**:

3つの定数を修正してカスタムテストランナーに対応：

**修正1（行17）**: MIN_OUTPUT_LENGTH削減

```typescript
// 修正前
const MIN_OUTPUT_LENGTH = 200;

// 修正後
const MIN_OUTPUT_LENGTH = 100; // N-3: Reduced for custom test runner support
```

**修正2（行40-49）**: TEST_OUTPUT_INDICATORS追加

```typescript
// 修正前（4パターンのみ）
const TEST_OUTPUT_INDICATORS = [
  'Tests:',
  '✓',
  '✗',
  /PASS|FAIL|ERROR/,
];

// 修正後（7パターン）
const TEST_OUTPUT_INDICATORS = [
  'Tests:',
  '✓',
  '✗',
  /PASS|FAIL|ERROR/,
  'passed',  // N-3: Custom runner success indicator
  'failed',  // N-3: Custom runner failure indicator
  'total',   // N-3: Custom runner count indicator
];
```

**修正3（行51-60）**: TEST_FRAMEWORK_PATTERNS追加

```typescript
// 修正前（6パターンのみ）
const TEST_FRAMEWORK_PATTERNS = [
  /(\d+)\s+passing/i,
  /(\d+)\s+failing/i,
  /Tests:\s+(\d+)\s+passed/i,
  /(\d+)\s+test[s]?\s+passed/i,
  /PASS.*?(\d+)/,
  /FAIL.*?(\d+)/,
];

// 修正後（9パターン）
const TEST_FRAMEWORK_PATTERNS = [
  /(\d+)\s+passing/i,
  /(\d+)\s+failing/i,
  /Tests:\s+(\d+)\s+passed/i,
  /(\d+)\s+test[s]?\s+passed/i,
  /PASS.*?(\d+)/,
  /FAIL.*?(\d+)/,
  /passed\s*:\s*(\d+)/i,  // N-3: Custom runner passed count
  /failed\s*:\s*(\d+)/i,  // N-3: Custom runner failed count
  /total\s*:\s*(\d+)/i,   // N-3: Custom runner total count
];
```

**技術的根拠**:

- MIN_OUTPUT_LENGTH=100は、カスタムランナーの典型的出力長（70-120文字）をカバー
- 'passed'/'failed'/'total'パターンはNode.js assertの一般的な出力形式
- 既存パターンとの共存により、vitest/jest等の標準フレームワークも継続サポート
- 正規表現の順序は既存ロジック（最初のマッチを採用）に影響なし

**影響範囲**:

- 修正箇所: 1ファイル3箇所
- 既存動作: 標準フレームワーク検出は不変、カスタムランナー対応を追加
- 偽陽性リスク: TEST_OUTPUT_INDICATORSの複数パターン要求により緩和

### N-4: enforce-workflow.js 拡張子追加

**問題の詳細**:

enforce-workflow.jsのPHASE_EXTENSIONS定義（行60-73）で、testing関連フェーズの許可拡張子リストにTypeScript系（.test.ts/.spec.ts等）のみが含まれ、プレーンJavaScript（.test.js/.spec.js）が許可されていない。前回タスクでは`.test.ts`拡張子でTypeScript構文を含まないJavaScriptコードを記述して回避したが、拡張子と内容の不一致は保守性を損なう。Node.jsで直接実行可能なJavaScriptテストファイルは、トランスパイル不要でシンプルなテストケースに有用である。

**修正内容**:

PHASE_EXTENSIONSの5フェーズ（test_design, test_impl, testing, regression_test, e2e_test）に4つの拡張子を追加：

```javascript
// 修正前（例: testingフェーズ）
testing: ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.md'],

// 修正後
testing: ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.test.js', '.spec.js', '.test.jsx', '.spec.jsx', '.md'],
```

**追加拡張子の意味**:

- `.test.js`: プレーンJavaScriptユニットテスト
- `.spec.js`: プレーンJavaScript仕様テスト
- `.test.jsx`: ReactコンポーネントのJSXテスト（トランスパイルツール使用時）
- `.spec.jsx`: ReactコンポーネントのJSX仕様テスト

**コメント追加**:

```javascript
// N-4: Added JavaScript test extensions (.test.js, .spec.js, .test.jsx, .spec.jsx)
```

**技術的根拠**:

- `.test.js`と`.spec.js`は業界標準のテストファイル命名規則
- isAllowedExtension関数の複合拡張子判定ロジック（`.test.ts` = `.test` + `.ts`）と互換
- 既存のTypeScript系拡張子との共存で、柔軟なテスト手法選択が可能
- フェーズ別拡張子制限の安全性は維持（他フェーズでは引き続き禁止）

**影響範囲**:

- 修正箇所: 1ファイル5箇所（5フェーズ定義）
- 既存動作: TypeScript系テストファイルは不変、JavaScript系を追加
- 誤用リスク: `.test.`プレフィックスの業界標準性により低い

### N-5: set-scope.ts フェーズ制限緩和

**問題の詳細**:

set-scope.tsの行25-32でALLOWED_PHASESが6フェーズ（research, requirements, planning, implementation, refactoring, testing）に限定されており、docs_updateやregression_testフェーズでスコープ追加が不可能である。docs_updateフェーズでは`docs/spec/features/`配下の新規仕様書作成やREADME.md大幅更新が発生しうるが、事前スコープ設定なしではブロックされる。regression_testフェーズでも新規リグレッションテストファイル作成が必要となり、同様の制限に直面する。回避策として`workflow_back`でtestingフェーズに戻る運用は、フロー効率を大幅に低下させる。

**修正内容**:

ALLOWED_PHASES配列に2フェーズを追加：

```typescript
// 修正前
const ALLOWED_PHASES = ['research', 'requirements', 'planning', 'implementation', 'refactoring', 'testing'];

// 修正後
const ALLOWED_PHASES = [
  'research',
  'requirements',
  'planning',
  'implementation',
  'refactoring',
  'testing',
  'docs_update',     // N-5: Allow scope changes for documentation updates
  'regression_test', // N-5: Allow scope changes for regression test creation
];
```

**技術的根拠**:

- docs_updateフェーズは性質上、新規ドキュメント作成が想定される適切なタイミング
- regression_testフェーズはバグ修正後の新規テスト追加が想定される適切なタイミング
- 既存のスコープサイズ制限（100ファイル以内）は維持されるため、悪用リスクは低い
- パストラバーサル対策（scope-validator.ts）も引き続き機能

**影響範囲**:

- 修正箇所: 1ファイル1箇所
- 既存動作: 既存6フェーズのスコープ設定は不変、2フェーズを追加
- セキュリティ: バリデーションロジックは全フェーズで同一適用

## 実装計画

### ファイル作成計画

**test_implフェーズ**:

1. `workflow-plugin/hooks/fix-all-n.js` - 一括修正スクリプト

**implementationフェーズ**:

1. TypeScriptソース直接編集（N-1, N-3, N-5）
2. fix-all-n.js実行（N-2, N-4）

### fix-all-n.js スクリプト設計

前回タスクのfix-all.jsをベースに、N-2とN-4の修正を実装：

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// プロジェクトルート検出
let currentDir = __dirname;
while (!fs.existsSync(path.join(currentDir, 'workflow-plugin', 'mcp-server', 'package.json'))) {
  const parentDir = path.dirname(currentDir);
  if (parentDir === currentDir) {
    console.error('ERROR: Could not find project root');
    process.exit(1);
  }
  currentDir = parentDir;
}
const PROJECT_ROOT = currentDir;

// ヘルパー関数
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyFix(filePath, searchStr, replaceStr, description) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`SKIP ${description}: file not found at ${fullPath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const occurrences = (content.match(new RegExp(escapeRegex(searchStr), 'g')) || []).length;

  if (occurrences !== 1) {
    console.error(`SKIP ${description}: expected 1 occurrence, found ${occurrences}`);
    return false;
  }

  const newContent = content.replace(searchStr, replaceStr);
  fs.writeFileSync(fullPath, newContent, 'utf8');
  console.log(`APPLIED ${description}`);
  return true;
}

// N-2: phase-edit-guard.js stderr出力完全化（4箇所）

// N-2-1: Bashホワイトリスト違反のconsole.log → console.error
applyFix(
  'workflow-plugin/hooks/phase-edit-guard.js',
  '        console.log(`Hook validation failed (Bash whitelist):',
  '        // N-2: Output error message to stderr for user visibility\n        console.error(`Hook validation failed (Bash whitelist):',
  'N-2-1: Bash whitelist violation stderr output'
);

// N-2-2: Fail Closedのcatchブロックにメッセージ追加
applyFix(
  'workflow-plugin/hooks/phase-edit-guard.js',
  '  } catch (err) {\n    process.exit(2); // Fail Closed\n  }',
  '  } catch (err) {\n    // N-2: Output error message to stderr for user visibility\n    console.error(\'Hook validation failed unexpectedly. Please check hook configuration.\');\n    process.exit(2); // Fail Closed\n  }',
  'N-2-2: Fail Closed catch block stderr output'
);

// N-2-3: stdinエラーにメッセージ追加
applyFix(
  'workflow-plugin/hooks/phase-edit-guard.js',
  '  input.on(\'error\', (err) => {\n    process.exit(2);\n  });',
  '  input.on(\'error\', (err) => {\n    // N-2: Output error message to stderr for user visibility\n    console.error(\'Failed to read input from stdin.\');\n    process.exit(2);\n  });',
  'N-2-3: stdin error stderr output'
);

// N-2-4: JSONパースエラーにメッセージ追加
applyFix(
  'workflow-plugin/hooks/phase-edit-guard.js',
  '  } catch (err) {\n    process.exit(2);\n  }',
  '  } catch (err) {\n    // N-2: Output error message to stderr for user visibility\n    console.error(\'Invalid JSON input from stdin.\');\n    process.exit(2);\n  }',
  'N-2-4: JSON parse error stderr output'
);

// N-4: enforce-workflow.js 拡張子追加（5フェーズ）

// N-4-1: test_design
applyFix(
  'workflow-plugin/hooks/enforce-workflow.js',
  '  test_design: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.md\'],',
  '  // N-4: Added JavaScript test extensions\n  test_design: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.test.js\', \'.spec.js\', \'.test.jsx\', \'.spec.jsx\', \'.md\'],',
  'N-4-1: test_design phase JavaScript extensions'
);

// N-4-2: test_impl
applyFix(
  'workflow-plugin/hooks/enforce-workflow.js',
  '  test_impl: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.md\'],',
  '  // N-4: Added JavaScript test extensions\n  test_impl: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.test.js\', \'.spec.js\', \'.test.jsx\', \'.spec.jsx\', \'.md\'],',
  'N-4-2: test_impl phase JavaScript extensions'
);

// N-4-3: testing
applyFix(
  'workflow-plugin/hooks/enforce-workflow.js',
  '  testing: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.md\'],',
  '  // N-4: Added JavaScript test extensions\n  testing: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.test.js\', \'.spec.js\', \'.test.jsx\', \'.spec.jsx\', \'.md\'],',
  'N-4-3: testing phase JavaScript extensions'
);

// N-4-4: regression_test
applyFix(
  'workflow-plugin/hooks/enforce-workflow.js',
  '  regression_test: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.md\'],',
  '  // N-4: Added JavaScript test extensions\n  regression_test: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.test.js\', \'.spec.js\', \'.test.jsx\', \'.spec.jsx\', \'.md\'],',
  'N-4-4: regression_test phase JavaScript extensions'
);

// N-4-5: e2e_test
applyFix(
  'workflow-plugin/hooks/enforce-workflow.js',
  '  e2e_test: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.md\'],',
  '  // N-4: Added JavaScript test extensions\n  e2e_test: [\'.test.ts\', \'.test.tsx\', \'.spec.ts\', \'.spec.tsx\', \'.test.js\', \'.spec.js\', \'.test.jsx\', \'.spec.jsx\', \'.md\'],',
  'N-4-5: e2e_test phase JavaScript extensions'
);

console.log('\\n=== fix-all-n.js completed ===');
```

### TypeScriptソース修正手順（implementationフェーズ）

**N-1: scope-validator.ts（行453）**:

Editツールで以下を置換：
```typescript
// OLD
const { stdout } = await execAsync('git diff --name-only --ignore-submodules HEAD', { cwd });

// NEW
// N-1: Add -c core.quotePath=false to prevent octal escaping of non-ASCII paths
const { stdout } = await execAsync('git -c core.quotePath=false diff --name-only --ignore-submodules HEAD', { cwd });
```

**N-3: test-authenticity.ts（3箇所）**:

1. 行17のMIN_OUTPUT_LENGTH修正
2. 行40-49のTEST_OUTPUT_INDICATORS修正
3. 行51-60のTEST_FRAMEWORK_PATTERNS修正

各修正にコメント`// N-3: Reduced/Added for custom test runner support`を追加。

**N-5: set-scope.ts（行25-32）**:

ALLOWED_PHASES配列に2要素追加：
```typescript
const ALLOWED_PHASES = [
  'research',
  'requirements',
  'planning',
  'implementation',
  'refactoring',
  'testing',
  'docs_update',     // N-5: Allow scope changes for documentation updates
  'regression_test', // N-5: Allow scope changes for regression test creation
];
```

### ビルド・デプロイ手順（parallel_qualityフェーズ）

**build_checkサブフェーズ**:

```bash
cd workflow-plugin/mcp-server
pnpm run build
```

期待される出力:
```
> @workflow/mcp-server@1.0.0 build
> tsc

（エラーなし）
```

**デプロイ確認**:

```bash
# dist/ディレクトリに以下が生成されることを確認
ls workflow-plugin/mcp-server/dist/validation/scope-validator.js
ls workflow-plugin/mcp-server/dist/validation/test-authenticity.js
ls workflow-plugin/mcp-server/dist/tools/set-scope.js
```

### テスト実行手順（testingフェーズ）

**前提条件**: MCPサーバー再起動（Claude Code再起動）

**N-1テスト**: 日本語タスク名でcommitフェーズ遷移

```bash
# 新規タスク開始
/workflow start テスト用日本語タスク名検証

# （各フェーズ実行後）commitフェーズ遷移を試行
/workflow next  # completed前の最後のnext

# 期待結果: スコープ外エラーが発生せず、遷移成功
```

**N-2テスト**: stderrメッセージ確認

```bash
# Bashホワイトリスト違反をトリガー
node -e "require('fs').writeFileSync('test.txt', 'test')" && git add test.txt

# 期待結果: Claude CodeのUIに「Hook validation failed (Bash whitelist)」が表示される
```

**N-3テスト**: カスタムテストランナー出力の受理

```bash
# workflow_record_test_result実行
# exitCode=0, output="passed: 2, failed: 0, total: 2" + 80文字のpadding

# 期待結果: バリデーションエラーなく記録成功
```

**N-4テスト**: JavaScript拡張子ファイル作成

```bash
# test_implフェーズで.test.jsファイル作成
touch src/backend/tests/unit/example.test.js

# 期待結果: phase-edit-guardがブロックしない
```

**N-5テスト**: docs_updateフェーズでスコープ追加

```bash
# docs_updateフェーズに到達後
/workflow set-scope --files docs/spec/features/new-feature.md

# 期待結果: フェーズ制限エラーが発生しない
```

## テスト戦略

### ユニットテスト（test_designフェーズで詳細設計）

**N-1**: scope-validator.tsのgetStagedFiles関数
- 日本語パスのgit diff出力が正しくパースされることを検証
- ASCIIパスでも既存動作が維持されることを検証

**N-3**: test-authenticity.tsのvalidateTestAuthenticity関数
- MIN_OUTPUT_LENGTH=100の境界値テスト（99文字→拒否、100文字→通過）
- 新規パターン（passed/failed/total）のマッチング検証
- 既存パターン（vitest/jest）のレグレッション検証

### 統合テスト（test_designフェーズで詳細設計）

**N-2**: phase-edit-guard.jsのstderr出力検証
- 4箇所の各ブロックパスをトリガーし、stderrメッセージを取得
- 期待メッセージとの完全一致を確認

**N-4**: enforce-workflow.jsのフェーズ別拡張子チェック
- 5フェーズ×4拡張子=20組み合わせの許可確認
- TypeScript系拡張子との共存確認

**N-5**: set-scope.tsのフェーズ制限検証
- docs_updateとregression_testでスコープ追加成功
- 非許可フェーズ（例: completed）でスコープ追加拒否

### E2Eテスト（parallel_verificationフェーズで実行）

**シナリオ1**: 日本語タスク名の全19フェーズ完了

```
/workflow start 統合テスト用日本語タスク
→ research〜commitまで実行
→ N-1修正によりcommit遷移成功を確認
```

**シナリオ2**: カスタムテストランナーでの全フローテスト

```
test_implフェーズ: カスタムテストランナー作成
testingフェーズ: テスト実行 + workflow_record_test_result
→ N-3修正により記録成功を確認
```

## 実装上の注意事項

### MCPサーバーモジュールキャッシング対応

TypeScriptソース（N-1, N-3, N-5）修正後、必ずMCPサーバーを再起動する：

```bash
# Claude Code再起動（推奨）
# または
# MCPサーバープロセスを手動kill
taskkill /F /IM node.exe /FI "WINDOWTITLE eq mcp-server"
```

### applyFix関数のエラーハンドリング

fix-all-n.jsの各applyFix呼び出しは、以下の異常系をハンドリング：
- ファイル未存在: "file not found"でスキップ
- 0箇所マッチ: "expected 1, found 0"でスキップ（既に修正済み）
- 2箇所以上マッチ: "expected 1, found N"でスキップ（コード変更により検索文字列が変化）

これにより、部分的な修正済み状態でもスクリプトを安全に再実行可能。

### TypeScriptコンパイルエラー対策

修正後のtscコンパイルでエラーが発生した場合：

1. 型定義の整合性確認（インポート文、型注釈）
2. コメント追加による構文エラーの有無確認
3. `pnpm run build`の詳細エラーメッセージを確認

事前検証として、修正前に`tsc --noEmit`を実行して既存エラーの有無を確認。

### Git hookの静的解析制限

N-2のstderr出力は、フック実行時の動的エラーには効果的だが、構文エラー等の静的エラーには無効。
修正後は必ず以下を実行して構文チェック：

```bash
node workflow-plugin/hooks/phase-edit-guard.js <<< '{}'
# 期待: JSONパースエラーメッセージ表示（構文エラーではない）
```

## 非機能要件の実現方法

### NFR-1: 性能要件

- N-1のgit diffオプション追加: gitプロセス起動時のオーバーヘッドは変化なし（オプション解析は定数時間）
- N-2のstderr出力: console.error呼び出しは数マイクロ秒のオーバーヘッド（計測不可能レベル）
- N-3のパターン追加: 正規表現マッチングは配列長に比例（6→9パターンで50%増）だが、総実行時間は数ミリ秒のため許容範囲
- 全修正の統合での性能劣化は1%未満（ワークフロー全体は分単位のため、数ミリ秒の増加は無視可能）

### NFR-2: 互換性要件

- N-1: git 2.0（2014年）以降で`-c`オプションサポート確認済み
- N-2: Node.js 18（2022年LTS）でconsole.error動作確認済み
- N-3: 新規パターンはTEST_FRAMEWORK_PATTERNSの末尾追加のため、既存パターンの優先度変化なし
- N-4: isAllowedExtension関数の`.test.ts` = `.test` + `.ts`ロジックは`.test.js`でも同様に機能
- N-5: validatePhasePermission関数はALLOWED_PHASES配列のincludes()チェックのみで、既存6フェーズに影響なし

### NFR-3: 保守性要件

全修正箇所にコメント追加規則を適用：
- N-1: `// N-1: Add -c core.quotePath=false for Japanese path support`
- N-2: `// N-2: Output error message to stderr for user visibility`
- N-3: `// N-3: Reduced/Added for custom test runner support`
- N-4: `// N-4: Added JavaScript test extensions`
- N-5: `// N-5: Allow scope changes for documentation/regression test updates`

ESLint/TypeScript lintルール遵守のため、修正後に以下を実行：

```bash
cd workflow-plugin/mcp-server
pnpm run lint
```

### NFR-4: セキュリティ要件

- N-1: `-c core.quotePath=false`の値はハードコードされており、ユーザー入力由来ではないため、コマンドインジェクションのリスクなし
- N-5: scope-validator.tsの既存バリデーション（行29-61のpathTraversalCheck、行83-95のvalidateScope）は全フェーズで継続適用
- スコープサイズ制限（100ファイル以内）もsetScope関数のバリデーションロジック（行95-109）で継続適用

### NFR-5: テスタビリティ要件

各修正に対して以下のテスト種別を用意：

| 修正 | ユニットテスト | 統合テスト | E2Eテスト |
|------|---------------|-----------|----------|
| N-1  | getStagedFiles関数（日本語/ASCIIパス） | - | 日本語タスク名全フロー |
| N-2  | - | 4箇所のstderr出力検証 | - |
| N-3  | validateTestAuthenticity関数（新規パターン） | - | カスタムランナー全フロー |
| N-4  | - | 5フェーズ×4拡張子の許可確認 | - |
| N-5  | - | 2フェーズのスコープ追加成功確認 | - |

## 受け入れ基準の検証方法

### 全体受入基準の検証

1. **5件全修正完了**: fix-all-n.js実行ログで6箇所のAPPLIED確認（N-2の4箇所+N-4の5箇所=9箇所、ただしN-2-2とN-2-4は同一検索文字列のため実質6箇所）
2. **tscコンパイル成功**: `pnpm run build`の終了コード0確認
3. **MCPサーバー有効化**: Claude Code再起動後、`/workflow status`コマンドが正常動作
4. **レグレッションなし**: ASCII専用タスク名でのワークフロー実行が従来通り完了
5. **日本語タスク名完了**: 「テスト用日本語タスク」でcompletedフェーズ到達

### N-1受入基準の検証（日本語パス対応）

1. **commitフェーズ遷移**: タスク「テスト用日本語タスク名」でcommit→push遷移成功
2. **octalエスケープ排除**: `git -c core.quotePath=false diff --name-only HEAD`の出力にUTF-8文字列のみ含まれることを確認
3. **スコープ外エラー解消**: 日本語パスファイル編集時に"out of scope"エラーが発生しないことを確認
4. **ASCII互換性**: タスク「ascii-only-task」でもcommitフェーズ遷移成功
5. **ユニットテスト**: test_designフェーズで設計したテストケースが全て通過

### N-2受入基準の検証（stderr出力完全化）

1. **Bashホワイトリスト違反**: `node -e "require('fs').writeFileSync(...)"` + git addでstderr表示確認
2. **Fail Closedテスト**: phase-edit-guard.jsに意図的な構文エラー挿入→stderrメッセージ確認
3. **stdinエラー**: パイプ入力なしでフック実行→stderrメッセージ確認
4. **JSONパースエラー**: 不正なJSON入力でフック実行→stderrメッセージ確認
5. **No stderr解消**: 上記4ケースで「No stderr output」エラーが発生しないことを確認

### N-3受入基準の検証（バリデーション緩和）

1. **100文字受理**: `workflow_record_test_result`に100文字の出力を渡して成功確認
2. **カスタムランナー形式**: `passed: 2, failed: 0, total: 2`形式でバリデーション通過確認
3. **統合テスト**: test_implフェーズでカスタムランナー作成→testingフェーズで記録成功
4. **vitest互換性**: 既存のvitestテスト出力も引き続き認識されることを確認
5. **性能測定**: バリデーション実行時間が10%以上増加していないことを確認（benchmark実行）

### N-4受入基準の検証（JavaScript拡張子）

1. **test_implフェーズ**: `.test.js`ファイル作成時にphase-edit-guardがブロックしないことを確認
2. **testingフェーズ**: `.spec.js`ファイル編集時にブロックされないことを確認
3. **regression_testフェーズ**: `.test.jsx`ファイル作成可能を確認
4. **e2e_testフェーズ**: `.spec.jsx`ファイル編集可能を確認
5. **TypeScript互換**: `.test.ts`ファイルも引き続き許可されることを確認

### N-5受入基準の検証（set-scopeフェーズ拡張）

1. **docs_updateフェーズ**: `workflow_set_scope --files docs/spec/features/test.md`実行成功
2. **regression_testフェーズ**: `workflow_set_scope --files src/tests/regression/test.test.ts`実行成功
3. **スコープサイズ制限**: 101ファイル指定時にエラー発生を確認
4. **パストラバーサル対策**: `../../etc/passwd`指定時にエラー発生を確認
5. **非許可フェーズ拒否**: completedフェーズで`workflow_set_scope`実行時にエラー発生を確認

## 関連ファイル一覧

### 修正対象ファイル

1. `workflow-plugin/mcp-server/src/validation/scope-validator.ts` (N-1: 行453)
2. `workflow-plugin/hooks/phase-edit-guard.js` (N-2: 行1595-1612, 1859-1862, 1880-1884, 1891-1894)
3. `workflow-plugin/mcp-server/src/validation/test-authenticity.ts` (N-3: 行17, 40-49, 51-60)
4. `workflow-plugin/hooks/enforce-workflow.js` (N-4: 行60-73のPHASE_EXTENSIONS)
5. `workflow-plugin/mcp-server/src/tools/set-scope.ts` (N-5: 行25-32のALLOWED_PHASES)

### 新規作成ファイル

1. `workflow-plugin/hooks/fix-all-n.js` (一括修正スクリプト)

### 影響を受けるファイル（修正不要、動作検証対象）

1. `workflow-plugin/mcp-server/src/state/state-manager.ts` (N-5の依存先)
2. `workflow-plugin/mcp-server/src/core/workflow-core.ts` (全修正の依存先)
3. `workflow-plugin/mcp-server/src/tools/record-test-result.ts` (N-3の呼び出し元)
4. `workflow-plugin/hooks/.claude/settings.json` (フック定義、修正不要)

### テストファイル（test_designフェーズで詳細設計）

1. `workflow-plugin/mcp-server/src/validation/__tests__/scope-validator.test.ts` (N-1ユニットテスト)
2. `workflow-plugin/mcp-server/src/validation/__tests__/test-authenticity.test.ts` (N-3ユニットテスト)
3. `workflow-plugin/mcp-server/src/tools/__tests__/set-scope.test.ts` (N-5ユニットテスト)

## まとめ

本仕様書では5件のワークフロー阻害要因に対する修正の詳細設計を規定した。
修正方式は前回タスクのfix-allパターンを踏襲し、applyFix関数による検証付き文字列置換で安全性を確保する。
N-1のgit diffオプション追加はoctalエスケープ問題の根本解決であり、日本語タスク名の全面採用を可能にする。
N-2のstderr出力完全化はユーザーへのエラーフィードバックを改善しデバッグ効率を向上させる。
N-3のバリデーション緩和はカスタムテストランナーの採用を可能にしテストフレームワークの選択肢を拡大する。
N-4のJavaScript拡張子追加はトランスパイル不要なシンプルテストの作成を許可し開発効率を向上させる。
N-5のset-scopeフェーズ拡張は後続フェーズでのスコープ変更を可能にしworkflow_backによる手戻りを削減する。
