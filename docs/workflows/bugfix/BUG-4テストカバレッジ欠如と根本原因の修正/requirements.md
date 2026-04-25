## サマリー

- 目的: `calculatePhaseSkips` 関数に対するユニットテストを新規追加し、BUG-4修正が引き起こした15件のテストリグレッションを解消するための要件を定義する。
- 主要な決定事項:
  - 新規テストファイルを `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts` に配置する。
  - `skip-env-removal.test.ts` における `stateManager.writeTaskState` のモック欠如を修正し、スコープ空状態の早期returnパスが発動する全テストケースで `writeTaskState` が確実にモック化されるようにする。
  - `mockTaskState` ヘルパーにデフォルトでスコープを付与するか、各テストケースで `scope` を明示的に設定する。
- 次フェーズで必要な情報:
  - `calculatePhaseSkips` の全スキップ分岐（6分岐）に対応するテストケース一覧。
  - `next.ts` 行 580〜586 の `writeTaskState` 呼び出しが発動する条件（スコープ空の場合に `phaseSkipReasons` が非空になる）。
  - 新規テストファイルの配置先パスと既存ファイルの修正箇所の確定情報。

---

## 機能要件

### FR-1: calculatePhaseSkips ユニットテストの新規追加

`workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts` を新規作成し、以下のテストケースを網羅する。

FR-1-1: スコープ未設定（空オブジェクト）の場合、`test_impl`・`implementation`・`refactoring` の3フェーズが全てスキップ対象に追加されること。
具体的には `calculatePhaseSkips({})` の戻り値に3つのエントリが含まれ、各スキップ理由文字列が定義されていることを検証する。

FR-1-2: スコープ未設定かつ `userIntent` にテストキーワード（'test', 'テスト', '試験', 'testing' のいずれかを含む文字列）を渡した場合、`test_impl` がスキップ対象から除外されること。
この時点で `implementation` と `refactoring` は依然としてスキップ対象に残り続けること。

FR-1-3: スコープ未設定かつ `userIntent` に実装キーワード（'implement', '実装', 'implementation', '開発' のいずれかを含む文字列）を渡した場合、`implementation` と `refactoring` がスキップ対象から除外されること。
この時点で `test_impl` は依然としてスキップ対象に残り続けること。

FR-1-4: スコープ未設定かつ `userIntent` にテストキーワードと実装キーワードの両方を含む文字列を渡した場合、3フェーズ全てがスキップ対象から除外され、戻り値が空マップとなること。

FR-1-5: スコープに1件以上のコードファイル（`.ts` 拡張子のソースファイル）が含まれる場合、BUG-4の早期returnパスは発動せず、通常のファイル拡張子チェックロジックが実行されること。
コードファイルとテストファイルの両方が含まれる場合はスキップ対象が空マップとなること。

FR-1-6: スコープにテストファイルのみ（`.test.ts` パターンに一致するファイル）が含まれる場合、`implementation` と `refactoring` がスキップ対象になること。

FR-1-7: スコープにコードファイルのみ（テストファイルパターンに一致しない `.ts` ファイル）が含まれる場合、`test_impl` がスキップ対象になること。

### FR-2: skip-env-removal.test.ts の既存テストのモック修正

`workflow-plugin/mcp-server/src/tools/__tests__/skip-env-removal.test.ts` の各テストケースで、スコープ空の状態（`scope` フィールドが未設定の `mockTaskState`）を使用する場合に `stateManager.writeTaskState` が `vi.fn()` または `vi.spyOn` でモック化されていることを保証する。

FR-2-1: `TC-1-2` グループの各テストケース（`SKIP_DESIGN_VALIDATION` 関連）では `stateManager.writeTaskState` のモックが設定されていないため、`safeExecute` 内でファイル書き込み例外が発生して誤った結果が返る。これらのテストにモック設定を追加する。

FR-2-2: `受入条件検証` グループの `AC-1-3` テストケースでも同様の問題が存在する。`mockTaskState('test_impl')` でスコープが未設定のため BUG-4 の早期returnパスが発動し `writeTaskState` が呼ばれるが、モックがない。モックを追加する。

FR-2-3: `AC-1-2` テストケース（`mockTaskState('research')`）は成果物チェックで早期returnするため `writeTaskState` の呼び出しには到達しない可能性が高いが、念のために確認し、必要に応じてモックを追加する。

FR-2-4: 修正方針として、各テストケースの `beforeEach` または個々のテスト内で `vi.spyOn(stateManager, 'writeTaskState').mockImplementation(() => {})` を設定する。`vi.clearAllMocks()` によるリセット後にモックが再設定されることを確保する。

---

## 非機能要件

### NFR-1: テスト技術スタックへの準拠

NFR-1-1: 新規テストファイルは TypeScript で記述し、既存テストファイルと同じ `vitest` フレームワークを使用する。
NFR-1-2: インポート文は ESM 形式（`import` 構文）のみを使用し、`require()` は使用しない。
NFR-1-3: `describe`/`it`/`expect` の構造は既存の `definitions.test.ts` や `next.test.ts` の慣例に倣う。

### NFR-2: モック宣言順序の遵守

NFR-2-1: `vi.mock()` 呼び出しはファイル先頭のインポート文の直後に配置する。既存テストで見られる `vi.mock('../../state/manager.js', ...)` の宣言順序パターンに従う。
NFR-2-2: `calculatePhaseSkips` のテストは `definitions.ts` の関数を直接インポートし、外部依存（`stateManager` 等）をモック化しない。`calculatePhaseSkips` は純粋関数であるため、モックなしで直接テスト可能であることを確認してから実装する。

### NFR-3: テスト実行の完全パス

NFR-3-1: 修正後に `npx vitest run` を実行した場合、事前に失敗していた15件のリグレッションが全て解消されること。
NFR-3-2: 新規追加した `calculate-phase-skips.test.ts` の全テストケースが正常にパスすること。
NFR-3-3: 既存テストスイートに対して新規テストの追加が負の影響を与えないこと（既存パスのテストが引き続きパスすること）。

### NFR-4: ファイル配置ルールへの準拠

NFR-4-1: 新規テストファイルのパスは `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts` とする。プロジェクトルート直下への配置は禁止する。
NFR-4-2: 一時ファイルや中間ファイルはルートディレクトリに作成しない。テスト実行時の出力は適切なディレクトリに格納する。

---

## 受け入れ基準

### AC-1: カバレッジ要件

AC-1-1: `calculatePhaseSkips` 関数の6つのスキップ分岐が全て新規テストファイルでカバーされること。
AC-1-2: スコープ空パス（FR-1-1〜FR-1-4）とスコープ設定済みパス（FR-1-5〜FR-1-7）の両方のコードパスを検証するテストが存在すること。
AC-1-3: `userIntent` によるキーワードオーバーライドロジックが単独でテストされ、そのテストが存在することを確認できること。

### AC-2: リグレッション解消要件

AC-2-1: `npx vitest run` を実行した際に失敗するテスト件数がゼロになること。
AC-2-2: 特に `skip-env-removal.test.ts` 内の全テストケースがパスすること。
AC-2-3: テストの失敗原因が `stateManager.writeTaskState` の呼び出し時の例外に起因するものが皆無であること。

### AC-3: 設計整合性要件

AC-3-1: 新規テストファイルは `@spec` コメントとして本タスクのドキュメントパスを参照する。
AC-3-2: BUG-4の動作（スコープ未設定時の3フェーズスキップ）がテストの成功によって明示的に検証・記録されること。

---

## 変更対象ファイル

修正・追加の対象となるファイルは以下の2件である。

新規追加するファイル: `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts`
この新規ファイルに `calculatePhaseSkips` の全スキップ分岐に対するユニットテストを記述する。

修正するファイル: `workflow-plugin/mcp-server/src/tools/__tests__/skip-env-removal.test.ts`
このファイルに対して `stateManager.writeTaskState` のモック設定を追加する。修正対象は `TC-1-2` グループ内の成功パスを通るテストと `受入条件検証` グループ内のテストである。

参照のみで変更しないファイルは以下の2件である。
`workflow-plugin/mcp-server/src/phases/definitions.ts` は `calculatePhaseSkips` の実装元として参照する。
`workflow-plugin/mcp-server/src/tools/next.ts` は `writeTaskState` の呼び出しコンテキスト確認のために参照する。
