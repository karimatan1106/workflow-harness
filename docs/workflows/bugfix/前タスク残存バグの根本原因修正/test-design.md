## サマリー

本ドキュメントは、前タスク「スコープ必須化とドキュメント階層化」で発生した4件の残存バグ（BUG-1〜BUG-4）に対するテスト設計を定義する。
テスト対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts`、`workflow-plugin/mcp-server/src/tools/set-scope.ts`、`workflow-plugin/mcp-server/src/validation/semantic-checker.ts` の3ファイルである。
各バグに対応するユニットテストをTDD（Red → Green）の順序で先に作成し、実装フェーズでテストをパスさせる。
テストフレームワークは既存プロジェクトに合わせ Vitest を使用し、テストファイルは各ソースファイルの `__tests__` サブディレクトリに配置する。
次フェーズ（implementation）では本ドキュメントのテストケース一覧を参照しながら、全テストがパスするように修正を実施すること。

---

## テスト方針

テストの種類はすべてユニットテストであり、外部依存（stateManager等）は Vitest の `vi.mock` でモック化する。
テストフレームワークは Vitest を使用し、`workflow-plugin/mcp-server` ディレクトリ内の既存設定（`vitest.config.ts`）に従って実行する。
実行コマンドは `npm test` で全テストスイートを実行し、ファイル指定で特定テストのみを実行する場合は `npx vitest run src/phases/__tests__/bug-fixes.test.ts` のようにファイルパスを指定する。

テスト実施の優先順位は spec.md の推奨作業順序に合わせ、BUG-2 → BUG-4 → BUG-3 → BUG-1 の順に設計する。
各バグは独立して修正・テストできるため、担当者が並行して作業することも可能である。

テスト設計の方針として、正常系（修正後の正しい動作の確認）と境界値テスト（エッジケースでの安全な動作確認）を中心に網羅する。
関数のシグネチャや戻り値の型は変更しないため、TypeScript コンパイルが成功することも検証対象とする。

---

## テストケース

以下に BUG-1〜BUG-4 それぞれのテストケースを定義する。テストファイルの配置先と対応するソースファイルを各バグの冒頭に明記する。

### BUG-2: workflow_set_scope 返却値への moduleName 追加

- **テストファイル**: `workflow-plugin/mcp-server/src/tools/__tests__/bug-fix-set-scope-module-name.test.ts`
- **ソースファイル**: `workflow-plugin/mcp-server/src/tools/set-scope.ts`
- **テスト対象関数**: `workflowSetScope`

BUG-2 は返却値の `scope` オブジェクトに `moduleName` フィールドが欠落している問題である。修正後は `scope.moduleName` が推定値を返すことを確認する。

| テストID | テスト概要 | 種別 |
|---------|-----------|------|
| TC-BUG2-001 | dirs指定時にscope.moduleNameが推定される | 正常系 |
| TC-BUG2-002 | scope.moduleNameの値がdirsのbasename部分と一致する | 正常系 |
| TC-BUG2-003 | messageフィールドにモジュール名が含まれる | 正常系 |
| TC-BUG2-004 | dirsが空配列のときにscope.moduleNameがundefinedになっても構造が壊れない | 境界値 |
| TC-BUG2-005 | TaskStateへの書き込みロジックは変更されない | 正常系 |

**TC-BUG2-001 詳細**

前提条件: `workflowSetScope` が呼び出し可能な状態でstateManagerがモック化されていること。
入力値: `{ taskId: "test-task-1", dirs: ["workflow-plugin/mcp-server/src/"] }` を引数に指定する。
期待結果: 返却値の `scope` オブジェクトに `moduleName` キーが存在し、値が文字列型であること。

**TC-BUG2-002 詳細**

前提条件: stateManagerのgetTaskByIdが有効なTaskStateを返すようモック化されていること。
入力値: `{ taskId: "test-task-1", dirs: ["src/backend/application/use-cases/auth/"] }` を引数に指定する。
期待結果: `scope.moduleName` の値が `"auth"` であること（dirsの先頭ディレクトリのbasename）。

**TC-BUG2-003 詳細**

前提条件: TC-BUG2-001 と同じ前提条件が満たされていること。
入力値: `{ taskId: "test-task-1", dirs: ["workflow-plugin/mcp-server/src/"] }` を引数に指定する。
期待結果: 返却値の `message` フィールドにモジュール名（`"src"`）が含まれる文字列であること。

**TC-BUG2-004 詳細**

前提条件: stateManagerのモックが正常に設定されていること。
入力値: `{ taskId: "test-task-1", dirs: [] }` を引数に指定する（空配列）。
期待結果: 返却値全体の構造が崩れず、`scope.moduleName` が `undefined` であっても例外が発生しないこと。

**TC-BUG2-005 詳細**

前提条件: stateManagerのwriteTaskStateがモック化されていること。
入力値: `{ taskId: "test-task-1", dirs: ["src/"], files: ["src/index.ts"] }` を引数に指定する。
期待結果: `writeTaskState` の呼び出し引数の `scope.moduleName` に正しい値が含まれること（TaskStateへの書き込みが変更されていないことの確認）。

---

### BUG-4: calculatePhaseSkips でスコープ空配列時のスキップ理由メッセージを追加

- **テストファイル**: `workflow-plugin/mcp-server/src/phases/__tests__/bug-fix-calculate-phase-skips.test.ts`
- **ソースファイル**: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- **テスト対象関数**: `calculatePhaseSkips`

BUG-4 はスコープが空配列のとき `phaseSkipReasons` が空オブジェクトのまま返される問題である。修正後は3つのスキップ理由が設定されることを確認する。

| テストID | テスト概要 | 種別 |
|---------|-----------|------|
| TC-BUG4-001 | affectedFilesが空のとき3つのスキップ理由が返される | 正常系 |
| TC-BUG4-002 | filesが空のとき3つのスキップ理由が返される | 正常系 |
| TC-BUG4-003 | test_implのスキップ理由メッセージが正確な日本語である | 正常系 |
| TC-BUG4-004 | implementationのスキップ理由メッセージが正確な日本語である | 正常系 |
| TC-BUG4-005 | refactoringのスキップ理由メッセージが正確な日本語である | 正常系 |
| TC-BUG4-006 | userIntentにテスト関連キーワードがある場合test_implスキップが除去される | 正常系 |
| TC-BUG4-007 | userIntentに実装関連キーワードがある場合implementationとrefactoringが除去される | 正常系 |
| TC-BUG4-008 | ファイルが1件以上ある場合は早期リターンせず拡張子ベース判定が継続する | 境界値 |
| TC-BUG4-009 | affectedFilesとfilesが両方空の場合は同等のスキップ理由が返される | 境界値 |

**TC-BUG4-001 詳細**

前提条件: `calculatePhaseSkips` が `definitions.ts` からインポートできること。
入力値: `{ affectedFiles: [], files: [] }` を引数に指定する（userIntentなし）。
期待結果: 返却値のキー数が3であり、`test_impl`・`implementation`・`refactoring` の3キーが含まれること。

**TC-BUG4-006 詳細**

前提条件: `calculatePhaseSkips` が呼び出し可能な状態であること。
入力値: `{ affectedFiles: [] }` と userIntent に `"テストを追加したい"` を指定する。
期待結果: 返却値に `test_impl` キーが含まれないこと（テスト関連キーワードによるオーバーライドが機能する）。

**TC-BUG4-007 詳細**

前提条件: `calculatePhaseSkips` が呼び出し可能な状態であること。
入力値: `{ affectedFiles: [] }` と userIntent に `"実装を修正する"` を指定する。
期待結果: 返却値に `implementation` キーと `refactoring` キーが含まれないこと。

**TC-BUG4-008 詳細**

前提条件: `calculatePhaseSkips` が呼び出し可能な状態であること。
入力値: `{ affectedFiles: ["src/index.ts"] }` を引数に指定する（1件のコードファイル）。
期待結果: 早期リターンが実行されず、拡張子ベース判定の結果が返ること（`test_impl` が含まれ `implementation` は含まれないことを確認）。

---

### BUG-3: validateLLMSemanticTraceability の関数名・JSDoc を実態と一致させる

- **テストファイル**: `workflow-plugin/mcp-server/src/validation/__tests__/bug-fix-semantic-checker-rename.test.ts`
- **ソースファイル**: `workflow-plugin/mcp-server/src/validation/semantic-checker.ts`
- **テスト対象関数**: `validateKeywordSemanticTraceability`（変更後の名前）

BUG-3 は関数名と JSDoc が実装実態（キーワードマッチング）と乖離している保守性の問題である。関数のロジックは変更しないため、テストは名称変更後のエクスポートが正しく機能することを確認する。

| テストID | テスト概要 | 種別 |
|---------|-----------|------|
| TC-BUG3-001 | validateKeywordSemanticTraceabilityという名前でエクスポートが存在する | 正常系 |
| TC-BUG3-002 | 旧名称validateLLMSemanticTraceabilityがエクスポートされない | 正常系 |
| TC-BUG3-003 | KeywordSemanticTraceabilityResultという名称のインターフェースが存在する | 正常系 |
| TC-BUG3-004 | 関数の実行ロジックが変更前と同等の結果を返す | 正常系 |
| TC-BUG3-005 | 仕様書に記載のあるキーワードを含む入力に対し検証が実行される | 正常系 |

**TC-BUG3-001 詳細**

前提条件: TypeScriptのビルドが完了しており、`semantic-checker.js` がインポートできること。
入力値: `semantic-checker.ts` のエクスポートオブジェクトを検査する（関数の引数は不要）。
期待結果: `validateKeywordSemanticTraceability` という名前の関数がエクスポートされていること。

**TC-BUG3-002 詳細**

前提条件: TC-BUG3-001 と同じビルド完了状態であること。
入力値: `semantic-checker.ts` のエクスポートオブジェクトを検査する（引数なし）。
期待結果: `validateLLMSemanticTraceability` という名前の関数がエクスポートされていないこと（旧名称の除去確認）。

**TC-BUG3-004 詳細**

前提条件: テスト用の仮の入力ファイルが一時ディレクトリに用意されていること。
入力値: 仕様書への参照キーワードを含む Markdown コンテンツと、対応するソースファイルを用意する。
期待結果: 関数が正常に完了し、`passed` または `failed` の検証結果を返すこと（ロジックの変更がないことの確認）。

---

### BUG-1: resolvePhaseGuide 内の replace をグローバル置換に変更

- **テストファイル**: `workflow-plugin/mcp-server/src/phases/__tests__/bug-fix-resolve-phase-guide.test.ts`
- **ソースファイル**: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- **テスト対象関数**: `resolvePhaseGuide`

BUG-1 は `.replace()` が文字列引数の場合に最初のマッチのみを置換する問題である。将来のプレースホルダー重複に備え、全マッチを置換する `.replaceAll()` への変更を確認する。

| テストID | テスト概要 | 種別 |
|---------|-----------|------|
| TC-BUG1-001 | outputFileに{docsDir}が1回のみ含まれる場合に正しく置換される | 正常系 |
| TC-BUG1-002 | outputFileに{docsDir}が2回含まれる場合に全て置換される | 境界値 |
| TC-BUG1-003 | inputFilesの各要素の{docsDir}が全て置換される | 正常系 |
| TC-BUG1-004 | inputFileMetadataのpath内の{docsDir}が置換される | 正常系 |
| TC-BUG1-005 | サブフェーズのoutputFileの{docsDir}が置換される | 正常系 |
| TC-BUG1-006 | サブフェーズのinputFilesの{docsDir}が全て置換される | 正常系 |
| TC-BUG1-007 | {moduleDir}プレースホルダーも全て置換される | 正常系 |
| TC-BUG1-008 | サブフェーズのinputFileMetadataのpathの{docsDir}が置換される | 正常系 |

**TC-BUG1-001 詳細**

前提条件: `resolvePhaseGuide` が `definitions.ts` からインポートできること。docsDir に `"docs/workflows/test-task"` を設定する。
入力値: `phase: "research"` と `docsDir: "docs/workflows/test-task"` を引数に指定する（1回出現の標準ケース）。
期待結果: 返却値の `outputFile` に `{docsDir}` 文字列が含まれず、`"docs/workflows/test-task"` に置換されていること。

**TC-BUG1-002 詳細**

前提条件: テスト用の PhaseGuide オブジェクトを直接構築し、`outputFile` に `"{docsDir}/sub/{docsDir}/file.md"` という形式を指定する。
入力値: 上記の PhaseGuide に対し `docsDir: "docs/workflows/task1"` を適用する。
期待結果: 返却値の `outputFile` が `"docs/workflows/task1/sub/docs/workflows/task1/file.md"` となり、2箇所とも置換されていること（`.replace` では1箇所のみ置換され失敗する）。

**TC-BUG1-005 詳細**

前提条件: サブフェーズを持つ PhaseGuide（`parallel_analysis` 等）でテストを実施できること。
入力値: `phase: "parallel_analysis"` と `docsDir: "docs/workflows/test-task"` を引数に指定する。
期待結果: 返却値のサブフェーズ（`threat_modeling` 等）の `outputFile` からも `{docsDir}` が除去され、正しい値に置換されていること。

---

## テストファイル一覧と配置先

実装フェーズで作成するテストファイルの配置先を以下に明示する。

| テストファイル | 対応バグ | 配置先 |
|-------------|---------|--------|
| `bug-fix-set-scope-module-name.test.ts` | BUG-2 | `workflow-plugin/mcp-server/src/tools/__tests__/` |
| `bug-fix-calculate-phase-skips.test.ts` | BUG-4 | `workflow-plugin/mcp-server/src/phases/__tests__/` |
| `bug-fix-semantic-checker-rename.test.ts` | BUG-3 | `workflow-plugin/mcp-server/src/validation/__tests__/` |
| `bug-fix-resolve-phase-guide.test.ts` | BUG-1 | `workflow-plugin/mcp-server/src/phases/__tests__/` |

---

## テスト実行方法

テストは `workflow-plugin/mcp-server` ディレクトリを起点として `npm test` コマンドで実行する。
特定のバグ修正テストのみを実行する場合は、ファイルパスを引数として `npx vitest run` コマンドに渡す。
ビルド確認は `npm run build` で行い、TypeScript コンパイルエラーが発生しないことをテスト実行前後に確認する。
BUG-3 のリネームはコンパイル時にのみ確認できるため、`npm run build` による検証が特に重要である。

各テストが RED 状態（修正前に失敗）であることをテスト実装フェーズで確認し、実装フェーズで GREEN（パス）に変化することを検証する。
テスト実装フェーズでは、既存テスト（`set-scope-enhanced.test.ts` 等）を参考にモック設定のパターンを踏襲する。
