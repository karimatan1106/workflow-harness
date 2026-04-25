## サマリー

- 目的: `calculatePhaseSkips` 関数に対するユニットテストを新規追加し、BUG-4修正が引き起こした `skip-env-removal.test.ts` 内のリグレッション（`writeTaskState` モック欠如による例外）を解消する。
- 主要な決定事項:
  - 新規テストファイルは `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts` に配置する。
  - `calculatePhaseSkips` は純粋関数であるため外部依存のモックは不要。`definitions.js` から直接インポートしてテストする。
  - `skip-env-removal.test.ts` の修正は、スコープ空状態で `writeTaskState` が呼ばれるテストケースに対し、`beforeEach` 内で `vi.spyOn(stateManager, 'writeTaskState').mockImplementation(() => {})` を追加する方針とする。
  - `vi.clearAllMocks()` が `beforeEach` でリセットするため、各テストグループの `beforeEach` で再設定が必要。
- 次フェーズで必要な情報:
  - `calculatePhaseSkips` 関数シグネチャ: 第一引数は `{ affectedFiles?: string[]; files?: string[] }` 形式のオブジェクト、第二引数は省略可能な `userIntent?: string`。
  - スコープ空パス（`files.length === 0`）の場合は3フェーズ（`test_impl`・`implementation`・`refactoring`）がスキップ対象となる早期returnが存在する。
  - スコープ設定済みパスではファイル拡張子判定とテストファイルパターン判定が動作する。

---

## 概要

このタスクは、BUG-4（スコープ未設定時の早期returnパス追加）によって生じたテストカバレッジの欠如と、それに起因するリグレッションテストの失敗を修正することを目的とする。

BUG-4では `calculatePhaseSkips` 関数にスコープ空状態の早期returnパスが追加されたが、この関数自体のユニットテストが存在しなかったため、各スキップ分岐の正確な動作が保証されていない状態にあった。また、早期returnパス内で `stateManager.writeTaskState` が呼び出されるようになったにもかかわらず、`skip-env-removal.test.ts` の一部テストケースではこのメソッドがモック化されていなかった。

対処方針として、`calculatePhaseSkips` の全6スキップ分岐を網羅する専用ユニットテストファイルを新規作成し、既存テストの `writeTaskState` モック漏れを修正することで15件のリグレッションを解消する。

実装はTDDの原則に従い、まずテストを追加・修正（Red状態を解消）し、その後既存コードに変更が必要かどうかを確認する手順で進める。変更対象はテストファイル2件のみであり、`definitions.ts` や `next.ts` のソースコードには変更を加えない。

本修正はソースコードの動作を変更しないため、既存機能への影響はなく、テスト品質の向上と開発プロセスの信頼性強化が主な効果となる。

---

## 実装計画

作業は以下の順序で実施する。各ステップは独立して完結できるよう設計されている。

最初のステップとして、`calculatePhaseSkips` 関数の全スキップ分岐に対応するユニットテストを新規ファイル `calculate-phase-skips.test.ts` に記述する。この時点では既存コードは変更しないため、テストが正しく動作することを確認できる。

次のステップとして、`skip-env-removal.test.ts` を修正し、`TC-1-2` グループと `AC-1-3` テストケースに `stateManager.writeTaskState` のモック設定を追加する。これにより BUG-4 早期returnパスが発動するテストケースで例外が抑制される。

最後に `npx vitest run` を実行して15件のリグレッション解消と新規テストのパスを確認する。テスト実行は `workflow-plugin/mcp-server` ディレクトリ内で行い、ルートディレクトリに一時ファイルを作成しない。

実装上の制約として、ESM形式のインポートパス（`.js` 拡張子）を使用すること、`vi.mock()` の呼び出し順序を守ること、純粋関数テストでは外部モックを使用しないことの3点を遵守する。

---

## 変更対象ファイル

本タスクで変更・新規作成するファイルと参照のみのファイルを以下に示す。

新規作成するファイル: `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts`
このファイルに `calculatePhaseSkips` の全スキップ分岐（FR-1-1 から FR-1-7 の7テストケース）に対するユニットテストを記述する。外部依存のモックは使用せず、関数を直接インポートして入力と出力のみで検証する。

修正するファイル: `workflow-plugin/mcp-server/src/tools/__tests__/skip-env-removal.test.ts`
このファイルに対して `stateManager.writeTaskState` のモック設定を追加する。修正対象は `TC-1-2` グループ内の成功パスを通るテストと `受入条件検証` グループ内の `AC-1-3` テストである。

参照のみで変更しないファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
この参照ファイルは `calculatePhaseSkips` の実装元として確認のために読み込む。

参照のみで変更しないファイル: `workflow-plugin/mcp-server/src/tools/next.ts`
この参照ファイルは `writeTaskState` の呼び出しコンテキスト確認のために読み込む。

**ファイル**: `workflow-plugin/mcp-server/src/tools/__tests__/skip-env-removal.test.ts`

**ファイル**: `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts`

---

## 実装対象

### 新規作成: `calculate-phase-skips.test.ts`

配置先パス: `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts`

このファイルは `calculatePhaseSkips` 関数の全スキップ分岐を網羅するユニットテストを記述する。テスト対象は `definitions.js` からのnamed exportとしてインポートし、外部モジュールのモックは原則として使用しない。純粋関数であるため入力に対して一定の出力が保証される。

インポート文の構造は以下の設計に基づく。ESM形式を使用し、`require()` は禁止する。既存の `definitions.test.ts` と同様の `import { describe, it, expect } from 'vitest'` の慣例に倣う。対象関数は `import { calculatePhaseSkips } from '../definitions.js'` でインポートする。

テストの `describe` 構造は最上位に `'calculatePhaseSkips'` を配置し、その配下にスコープ空パスとスコープ設定済みパスの2グループを設ける。各グループ内に個別の `it` ブロックを記述する。

### 修正対象: `skip-env-removal.test.ts`

修正ファイルパス: `workflow-plugin/mcp-server/src/tools/__tests__/skip-env-removal.test.ts`

問題の根本原因は、BUG-4で追加されたスコープ空状態の早期returnパスが `next.ts` の `safeExecute` コールバック内で `stateManager.writeTaskState` を呼び出すにもかかわらず、当該テストケースでこのメソッドがモック化されていないことにある。

`safeExecute` は `stateManager.writeTaskState` が例外を投げると `success: false` のエラーを返すため、テストの期待値と異なる結果が生じる。

修正対象のテストグループは以下の2箇所である。
- `TC-1-2: SKIP_DESIGN_VALIDATIONが無効化されること` グループ内の各テストケース（行 183〜252）。このグループでは `mockTaskState('test_impl')` を使用するためスコープが未設定になり、早期returnパスが発動して `writeTaskState` が呼ばれる。
- `受入条件検証` グループの `AC-1-3` テストケース（行 453〜470）。同様に `mockTaskState('test_impl')` を使用しスコープが未設定のため問題が発生する。

---

## テスト設計の詳細

### FR-1-1: スコープ未設定の3フェーズスキップ検証

テスト名: `空のオブジェクトを渡した場合、test_impl・implementation・refactoringの3フェーズがスキップ対象になること`

入力: `calculatePhaseSkips({})` および `calculatePhaseSkips({ files: [] })` の2パターンを検証する。戻り値のオブジェクトに `'test_impl'`・`'implementation'`・`'refactoring'` の3キーが全て含まれることを `expect(result).toHaveProperty('test_impl')` 等で確認する。スキップ理由の文字列が空でないことも検証する。

### FR-1-2: テストキーワードによる test_impl スキップ除外

テスト名: `userIntentにテストキーワードを含む場合、test_implがスキップ対象から除外されること`

入力: `calculatePhaseSkips({}, 'テストを追加する')` を渡す。期待値は `test_impl` キーが存在せず、`implementation` と `refactoring` キーは依然として存在することを確認する。日本語キーワード `'テスト'` 以外に英語キーワード `'testing'` でも動作することを追加検証する。

### FR-1-3: 実装キーワードによる implementation・refactoring スキップ除外

テスト名: `userIntentに実装キーワードを含む場合、implementationとrefactoringがスキップ対象から除外されること`

入力: `calculatePhaseSkips({}, '実装を行う')` を渡す。期待値は `implementation` と `refactoring` キーが存在せず、`test_impl` キーは依然として存在することを確認する。英語キーワード `'implement'` や `'implementation'` でも同様の動作となることを追加検証する。

### FR-1-4: テストキーワードと実装キーワードの両方を含む場合

テスト名: `userIntentにテストキーワードと実装キーワードの両方を含む場合、3フェーズ全てがスキップ対象から除外されること`

入力: `calculatePhaseSkips({}, 'テストと実装を両方行う')` を渡す。戻り値が空オブジェクト（`{}`）となることを `expect(Object.keys(result)).toHaveLength(0)` で確認する。

### FR-1-5: コードファイルとテストファイルが両方含まれる場合

テスト名: `コードファイルとテストファイルの両方がスコープに含まれる場合、全フェーズがスキップ対象にならないこと`

入力: `calculatePhaseSkips({ files: ['src/foo.ts', 'src/foo.test.ts'] })` を渡す。コードファイル（`.ts` 拡張子でテストパターン非該当）とテストファイル（`.test.ts` パターン該当）の両方が存在するため、`hasCodeFiles` と `hasTestFiles` がいずれも true となり、スキップ対象が空マップになることを確認する。

### FR-1-6: テストファイルのみスコープに含まれる場合

テスト名: `テストファイルのみスコープに含まれる場合、implementationとrefactoringがスキップ対象になること`

入力: `calculatePhaseSkips({ files: ['src/foo.test.ts'] })` を渡す。`hasCodeFiles` が false、`hasTestFiles` が true となるため、`implementation` と `refactoring` がスキップ対象になることを確認する。`test_impl` はスキップ対象にならないことも合わせて検証する。

### FR-1-7: コードファイルのみスコープに含まれる場合

テスト名: `コードファイルのみスコープに含まれる場合、test_implがスキップ対象になること`

入力: `calculatePhaseSkips({ files: ['src/foo.ts'] })` を渡す。`hasCodeFiles` が true、`hasTestFiles` が false となるため、`test_impl` がスキップ対象になることを確認する。`implementation` と `refactoring` はスキップ対象にならないことも合わせて検証する。

---

## `skip-env-removal.test.ts` の修正箇所詳細

### TC-1-2 グループの修正（行 183〜252）

現状: `beforeEach` に `stateManager.writeTaskState` のモックがない。`mockTaskState('test_impl')` を使用するテストではスコープが空のため BUG-4 早期returnが発動し、`writeTaskState` が呼ばれる。

修正方針: `TC-1-2` グループに専用の `beforeEach` ブロックを追加し、その内部で `vi.spyOn(stateManager, 'writeTaskState').mockImplementation(() => {})` を設定する。または各テストケースの `Arrange` セクション内に個別のモック設定を追加する。`vi.clearAllMocks()` が親の `beforeEach` で呼ばれるため、グループ固有の `beforeEach` でモックを再設定することが必要。

行番号の目安: `describe('TC-1-2:...', () => {` の開始直後にネストした `beforeEach` を挿入するか、行 193 の `vi.spyOn(stateManager, 'getTaskById')` の直後に `writeTaskState` のモックを追加する。

### AC-1-3 テストの修正（行 453〜470）

現状: `mockTaskState('test_impl')` でスコープが未設定のため BUG-4 早期returnが発動するが `writeTaskState` のモックがない。

修正方針: 行 457 の `vi.spyOn(stateManager, 'getTaskById')` の後に `vi.spyOn(stateManager, 'writeTaskState').mockImplementation(() => {})` を追加する。

---

## ビルドと実行コマンド

新規テストファイル `calculate-phase-skips.test.ts` は vitest が TypeScript を直接処理するため、`npm run build` によるトランスパイルは不要である。テスト実行前のコンパイルステップを挿入しなくてよい。

`skip-env-removal.test.ts` はソースファイル（`.ts`）を直接修正するためコンパイル不要であり、vitest の `transformMode` が TypeScript ファイルを直接解釈する。型エラーを事前確認したい場合は `npx tsc --noEmit` を使用できる。

全テストを実行する場合は `workflow-plugin/mcp-server` ディレクトリに移動してから `npx vitest run` を実行すること。

```
cd C:\ツール\Workflow\workflow-plugin\mcp-server
npx vitest run
```

新規テストのみ実行する場合は、テストファイルのパスを引数に指定する。

```
cd C:\ツール\Workflow\workflow-plugin\mcp-server
npx vitest run src/phases/__tests__/calculate-phase-skips.test.ts
```

`skip-env-removal.test.ts` のリグレッション確認は以下のコマンドを使用する。

```
cd C:\ツール\Workflow\workflow-plugin\mcp-server
npx vitest run src/tools/__tests__/skip-env-removal.test.ts
```

---

## 実装上の注意事項

MCP サーバーは ESM 形式（`package.json` に `"type": "module"` が設定されている）であるため、インポートパスには `.js` 拡張子を使用する。TypeScript ソースを参照する場合も `.js` 拡張子を記述する（vitest の設定で TypeScript ファイルに解決される）。正しいインポート形式は `import { calculatePhaseSkips } from '../definitions.js'` となる。

`calculatePhaseSkips` の関数シグネチャは `scope: { affectedFiles?: string[]; files?: string[] }` を受け取る。内部では `const files = scope.affectedFiles || scope.files || []` で解決する。テストではシンプルに `files` 形式を使用するが、`affectedFiles` 形式でも同様に動作することを理解しておく必要がある。

新規テストファイルは外部依存のモックを持たないため、既存テストの `vi.mock()` 設定に影響を与えない。`calculate-phase-skips.test.ts` のファイル内には `vi.mock()` を記述しないことを原則とし、既存テストの動作安定性を維持する。

`vi.clearAllMocks()` による自動リセットが実行される環境では、グループ固有の `beforeEach` 内でモックを再設定することが必要不可欠である。この点を見落とすと TC-1-2 グループの修正後も一部テストが失敗し続ける可能性がある。

テスト実行コマンドはプロジェクトルートではなく `workflow-plugin/mcp-server` ディレクトリを基点として実行すること。ルートディレクトリへの一時ファイル作成は禁止されている。
