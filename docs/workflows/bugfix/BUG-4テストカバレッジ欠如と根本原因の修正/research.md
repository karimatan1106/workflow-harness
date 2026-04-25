## サマリー

- 目的: BUG-4（`calculatePhaseSkips` のスコープ未設定時における3フェーズスキップ処理）のテストカバレッジが欠如している根本原因を特定し、修正に必要な設計情報を収集する。
- 主要な決定事項:
  - `calculatePhaseSkips` 関数は `definitions.ts` に存在し、現状ユニットテストが存在しない（`definitions.test.ts` はこの関数をインポートしていない）。
  - テストリグレッションの根本原因は「既存テストの `createMockTaskState` がスコープを持つ状態を返す一方で、`skip-env-removal.test.ts` の `mockTaskState` はスコープを持たない（またはスコープなし設定）状態を生成しているため、BUG-4の早期returnパスが発動し、`writeTaskState` が呼ばれるが、一部テストでそれがモック化されていない」ことによる。
  - 修正方針: 既存テストのモックに対してスコープ有りのデフォルト値を保証しつつ、`calculatePhaseSkips` 専用ユニットテストを追加する。
- 次フェーズで必要な情報:
  - `calculatePhaseSkips` の全テストケース一覧（スコープ空、コードファイルのみ、テストファイルのみ、両方、userIntentオーバーライド）。
  - `next.ts` 行 580-586 の `writeTaskState` 呼び出しに関するモック要件の整理。
  - 新規テストファイルの配置先: `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts`

---

## 調査結果

### Step 1: calculatePhaseSkips の実装全体

ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（行 511〜585）

関数シグネチャ:
```
export function calculatePhaseSkips(
  scope: { affectedFiles?: string[]; files?: string[] },
  userIntent?: string
): Record<string, string>
```

戻り値の型は「スキップすべきフェーズ名 → スキップ理由文字列」のマップ。

BUG-4修正箇所（行 518〜537）の動作は以下の通り:
- `files.length === 0`（スコープ未設定）の場合、`test_impl`/`implementation`/`refactoring` の3フェーズをスキップ理由マップに追加して早期returnする。
- 早期returnより前に `userIntent` キーワードチェックを実行し、TESTキーワードがあれば `test_impl` を削除、IMPLキーワードがあれば `implementation` と `refactoring` を削除する。
- スコープが存在する場合（files.length > 0）はコードファイル有無とテストファイル有無をチェックし、該当しないフェーズをスキップ対象に追加する。

関数の全スキップロジックは次の6分岐に分類される:
1. スコープ空 → 3フェーズスキップ（BUG-4追加ロジック）
2. スコープ空 + TESTキーワード → `test_impl` を復活
3. スコープ空 + IMPLキーワード → `implementation`/`refactoring` を復活
4. コードファイルなし → `implementation`/`refactoring` スキップ
5. テストファイルなし → `test_impl` スキップ
6. コードもテストもなし → `testing`/`regression_test` もスキップ

### Step 2: next.ts における phaseSkipReasons の処理フロー

ファイル: `workflow-plugin/mcp-server/src/tools/next.ts`

行 521-523 で `calculatePhaseSkips` を呼び出す:
```
const phaseSkipReasons = calculatePhaseSkips(taskState.scope || {}, taskState.userIntent);
```

`taskState.scope` が未設定または空の場合（`scope || {}`）、空のオブジェクトが渡るため `affectedFiles` が存在せず、`files.length === 0` となり BUG-4 の早期returnパスが実行される。その結果 `phaseSkipReasons` に3エントリが追加される。

行 580-586 では `phaseSkipReasons` が非空の場合に `stateManager.writeTaskState` を呼び出す:
```
if (Object.keys(phaseSkipReasons).length > 0) {
  const updatedState = { ...taskState, phaseSkipReasons };
  stateManager.writeTaskState(taskState.workflowDir, updatedState);
}
```

`safeExecute` 関数（`helpers.ts` 行 82-94）はラムダ内の例外をキャッチして `{success: false, message: ...}` を返す仕組みである。`writeTaskState` がモック化されていない場合、実際のファイル書き込みが試みられ、テスト環境のパス（`/path/to/workflow` 等）が存在しないため例外が発生し、`success: false` が返る。これが15件のテストリグレッションを引き起こした根本原因である。

### Step 3: 既存テストファイルのモック構造の比較

`next.test.ts` の `createMockTaskState`（行 209-225）では `scope.affectedFiles` に `['workflow-plugin/mcp-server/src/placeholder.ts']` を設定しており、BUG-4のスコープ空パスは発動しない。

`session-token.test.ts` の `createMockTaskState`（行 60-84）も `scope.affectedFiles` に同様のダミーファイルを設定しており、BUG-4パスは発動しない。

`next-artifact-check.test.ts` の `createMockTaskState`（行 118-136）も `scope.affectedFiles` に値を設定しており、問題ない。

`skip-env-removal.test.ts` の `mockTaskState`（行 73-88）では `scope` フィールドが設定されていない（`...overrides` で上書きされる可能性はあるが、通常のテストケースではスコープなしの状態が使われている）。このファイルのテストが `stateManager.writeTaskState` のモックを持たないケースで BUG-4 パスが発動すると、`safeExecute` が例外をキャッチしてフェーズ遷移が失敗する。

`stateManager.writeTaskState` はモックの `vi.mock('../../state/manager.js', ...)` ブロックで `vi.fn()` として定義されているファイルとそうでないファイルに分かれており、定義が不完全なケースがある。

### Step 4: テストファイル全体像の把握

`workflow-plugin/mcp-server/src/tools/__tests__/` 配下には32個のテストファイルが存在する。
`workflow-plugin/mcp-server/src/phases/__tests__/` 配下には3個のテストファイルが存在する:
- `dependencies.test.ts`: サブフェーズ依存関係のテスト
- `phase-definitions-cjs.test.ts`: CommonJS互換テスト
- `definitions.test.ts`: フェーズ定義テスト（`calculatePhaseSkips` はインポートされていない）

`calculatePhaseSkips` をインポートしてテストしているファイルは現在のコードベースには存在しない。これがテストカバレッジ欠如の直接的な証拠である。

---

## 既存実装の分析

### calculatePhaseSkips テストカバレッジの欠如

`definitions.test.ts` のインポート文（行 10-22）には `calculatePhaseSkips` が含まれていない。同関数がエクスポートされているにもかかわらず（行 511: `export function calculatePhaseSkips`）、専用のユニットテストが一切存在しない。

BUG-4 で追加された「スコープ未設定時の早期return」ロジックは、以下の5つのテストシナリオを必要とする:
- スコープが空配列の場合: 3フェーズが全てスキップされること
- スコープ空 + TESTキーワード付き userIntent: `test_impl` スキップが解除されること
- スコープ空 + IMPLキーワード付き userIntent: `implementation`/`refactoring` スキップが解除されること
- スコープ空 + 両キーワード付き userIntent: 全スキップが解除されること
- スコープが空でない場合: BUG-4の早期returnパスは発動せず通常のファイル拡張子チェックが実行されること

既存の `definitions.test.ts` は `getNextPhase`、`isValidTaskSize`、`getPhaseCount`、`getPhaseIndex`、`isParallelPhase`、`requiresApproval`、`PHASE_DESCRIPTIONS`、`PHASE_EXTENSIONS`、`resolvePhaseGuide`、`PHASE_GUIDES` をテストしているが、`calculatePhaseSkips` は対象外になっている。

### writeTaskState のモック欠如によるリグレッション

`skip-env-removal.test.ts`（及びリグレッションが発生した他のテストファイル）では `stateManager.writeTaskState` が `vi.fn()` として定義されていないか、`vi.clearAllMocks()` 後に再設定されていない。

`vi.mock('../../state/manager.js', ...)` の定義が不完全なモックオブジェクトを返す場合、`writeTaskState` が `vi.fn()` でない実装を呼び出し、パス存在チェックで例外が発生する。`safeExecute` がその例外を捕捉して `success: false` を返すため、本来成功すべきテストケースが失敗する。

修正方針は2段階となる:
1. `calculatePhaseSkips` 専用ユニットテストを追加し（新規ファイル）、全スキップロジックをカバーする。
2. リグレッションしたテストファイルのモック定義に `writeTaskState: vi.fn()` を確実に追加するか、`createMockTaskState` がデフォルトでスコープを持つようにする。

### safeExecute の動作と波及範囲

`safeExecute` は例外を `{success: false, message: ...}` に変換して返す。これにより、モック未設定の状態でもテストがクラッシュせず「失敗」として結果が返るため、原因の特定が難しくなっていた。

テストが `stateManager.writeTaskState` の呼び出しを期待していない場合でも、スコープ空の状態で `workflowNext` を呼び出すと必ず `writeTaskState` が呼び出されるため、全てのテストケースでモックが必要になる。

### 影響を受けるテストファイルの確認

前タスクで特定された4ファイル:
- `next.test.ts`: `writeTaskState: vi.fn()` がモックに含まれており、現在は問題なし（スコープ付きのデフォルト設定に変更済み）。
- `session-token.test.ts`: `writeTaskState: vi.fn()` がモックに含まれており、スコープ付き状態を使用しているため問題なし。
- `skip-env-removal.test.ts`: `mockTaskState` がスコープなし、`writeTaskState` がモックに含まれていない可能性が高い（調査で確認済み）。
- `next-artifact-check.test.ts`: スコープ付き状態を使用しているため BUG-4 パスは発動しない。

### 修正に向けたスコープ設定情報

新規追加するユニットテストファイルのパス:
`workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts`

修正が必要な既存ファイル（モック定義の修正）:
`workflow-plugin/mcp-server/src/tools/__tests__/skip-env-removal.test.ts`

調査を通じて変更対象として特定されたファイル一覧:
- `workflow-plugin/mcp-server/src/phases/definitions.ts`（読み取り専用・修正なし）
- `workflow-plugin/mcp-server/src/tools/next.ts`（読み取り専用・修正なし）
- `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts`（新規追加）
- `workflow-plugin/mcp-server/src/tools/__tests__/skip-env-removal.test.ts`（モック修正）
- `workflow-plugin/mcp-server/src/tools/__tests__/next.test.ts`（必要に応じてモック確認）
- `workflow-plugin/mcp-server/src/tools/__tests__/session-token.test.ts`（必要に応じてモック確認）
- `workflow-plugin/mcp-server/src/tools/__tests__/next-artifact-check.test.ts`（必要に応じてモック確認）
