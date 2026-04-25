## サマリー

- 目的: BUG-4修正に伴うテストカバレッジ欠如を解消するため、CLIインターフェース・エラーメッセージ・MCPツールのAPIレスポンス型・vitest設定ファイルの設計を明確化し、実装フェーズでの混乱を防ぐ。
- 主要な決定事項: テスト実行は `workflow-plugin/mcp-server` ディレクトリを起点とし、`npx vitest run` コマンドで実施する。vitest.config.ts の既存設定を維持しつつ、新規テストファイルが `src/**/__tests__/**/*.test.ts` グロブに一致することを確認した。MCPツールのレスポンス型は `{ success: boolean; message: string }` を基本とし、`workflowNext` 関数の戻り値がこの型に準拠していることを設計の前提とする。
- 次フェーズで必要な情報: `calculatePhaseSkips` のインポートパスは `'../definitions.js'`（ESM形式）を使用する。`stateManager.writeTaskState` のモック設定はグループ固有の `beforeEach` 内で行い、`vi.clearAllMocks()` によるリセット後に再設定する必要がある。新規テストファイルの配置先は `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts` であり、vitest設定の `include` グロブに合致している。
- 対象範囲: 純粋関数 `calculatePhaseSkips` のユニットテスト（外部モック不要）と、空スコープパスを経由する既存テストファイルの修正（`writeTaskState` モック追加）を対象とする。
- 品質基準: 新規テスト7件がすべてグリーンになること、および修正前に失敗していた15件のリグレッションが解消されることを合格条件とする。

---

## CLIインターフェース設計

このセクションでは、テスト実行時に開発者が操作するCLIコマンドとその出力形式を設計する。
vitest はTypeScriptファイルを直接処理するため、コンパイルステップを挟まずにテストを実行できる。
テスト実行はプロジェクトのサブディレクトリ内で行い、ルートディレクトリへ一時ファイルを生成しない方針を採る。

### 全テスト実行コマンド

全テストスイートを一括実行する際のコマンドは以下の形式とする。
実行基点となるディレクトリは `workflow-plugin/mcp-server` であり、この位置から `vitest` がテストファイルを検索する。
`npx vitest run` はウォッチモードを無効にした単発実行モードで動作し、CI環境に適している。

- コマンド形式: `npx vitest run`（`workflow-plugin/mcp-server` ディレクトリで実行）
- 検索対象グロブ: `src/**/__tests__/**/*.test.ts` および `tests/**/*.test.ts`
- カバレッジ出力形式: text（コンソール）・json・html の3種類
- 成功時の終了コード: 0（すべてのテストがパス）
- 失敗時の終了コード: 1（1件以上のテストが失敗）

### 新規テストファイル単体実行コマンド

`calculate-phase-skips.test.ts` のみを実行する場合、ファイルパスを引数として渡す。
この方法により、既存テストスイートへの影響を確認せずに新規テストだけを検証できる。
開発中のイテレーションが短縮されるため、TDDのRedフェーズ確認に適した実行形式である。

- コマンド形式: `npx vitest run src/phases/__tests__/calculate-phase-skips.test.ts`
- 期待される出力: 7件のテストケース（FR-1-1 から FR-1-7）がすべてパス
- 実行所要時間の目安: 外部モックが不要なため、500ms 未満で完了する見込み

### リグレッション確認コマンド

`skip-env-removal.test.ts` のモック修正後にリグレッションを確認する際のコマンド形式を示す。
修正対象は TC-1-2 グループ（行 183〜252）と AC-1-3 テストケース（行 453〜470）の2箇所であり、
これらのテストが `success: true` を返すようになったことを確認することが目的となる。

- コマンド形式: `npx vitest run src/tools/__tests__/skip-env-removal.test.ts`
- 修正前の期待される失敗数: 15件
- 修正後の期待される失敗数: 0件（全テストがパス）

### TypeScript型チェックコマンド

テスト実行前に型エラーを事前確認したい場合は `npx tsc --noEmit` を使用する。
このコマンドはトランスパイルを行わずに型検査のみを実行し、テストファイルの型整合性を検証できる。
ESM形式のインポートパス（`.js` 拡張子）を含む場合でも正しく型解決されることを確認できる。

- コマンド形式: `npx tsc --noEmit`（`workflow-plugin/mcp-server` ディレクトリで実行）
- 成功時: エラーなし（終了コード 0）
- 失敗時: 型エラーの詳細が標準エラー出力に表示される

---

## エラーメッセージ設計

このセクションでは、テスト失敗時に表示されるエラーメッセージの形式と設計方針を定義する。
vitest が出力するエラーメッセージは、失敗したアサーションの左辺・右辺の差分と
スタックトレースで構成されており、開発者が問題箇所を迅速に特定できるよう設計されている。

### `calculatePhaseSkips` 関数のテスト失敗メッセージ

スコープ空パスのテスト（FR-1-1）が失敗する場合、期待値とのプロパティ差分が表示される。
`expect(result).toHaveProperty('test_impl')` が失敗すると vitest は対象オブジェクトの内容を展開し、
存在しないプロパティへのアクセス試行が失敗したことを示すメッセージを出力する。

- エラー種別: `AssertionError - Expected object to have property "test_impl"`
- 表示形式: `received` 欄にはスキップマップの実際の内容が、`expected` 欄には期待するプロパティ名が表示される
- スタックトレース: テストファイルの `it` ブロック内の行番号が示される
- 対処方針: `calculatePhaseSkips({})` が空オブジェクトを返している場合、`definitions.ts` の早期returnロジックを確認する

### `writeTaskState` モック未設定時のエラーメッセージ

TC-1-2 グループや AC-1-3 テストでモックが設定されていない場合、`writeTaskState` が実際の実装を呼び出す。
実際の実装は `stateIntegrity` の更新やファイル書き込みを試みるため、テスト環境では例外が発生する。
このエラーはテスト出力に `TypeError` または `ENOENT` 形式で表示され、`workflowNext` が `success: false` を返す原因となる。

- エラー種別: テスト期待値のミスマッチ `Expected: true, Received: false` として現れる
- 根本原因: `success: true` を期待しているが BUG-4 早期returnパスが `writeTaskState` 例外を捕捉して `success: false` を返す
- 表示される差分: `expect(result.success).toBe(true)` に対して received が `false`
- 対処方針: `vi.spyOn(stateManager, 'writeTaskState').mockImplementation(() => {})` をグループの `beforeEach` に追加する

### vitest のウォッチモード無効時のエラー報告

`npx vitest run` による単発実行では、全テスト完了後にサマリーが表示される。
失敗したテストケース名・ファイルパス・失敗アサーション数が一覧形式でまとめて出力される。
修正前の `skip-env-removal.test.ts` では 15件の失敗が一括表示されることが見込まれる。

- サマリー形式: `Tests 15 failed | N passed (M)` の形式で表示される
- 失敗テストのグループ化: `describe` ブロック単位でネストして表示される
- ファイルパスの表示: 相対パスで `src/tools/__tests__/skip-env-removal.test.ts` が示される

---

## APIレスポンス設計

このセクションでは、テスト対象となる MCP ツール関数のレスポンス型定義と、
各ツールが返す可能性のある値の仕様を設計する。
`workflowNext` と `workflowCompleteSub` の戻り値型は、テストのアサーション設計に直接影響する。

### `workflowNext` 関数のレスポンス型

`workflowNext` 関数は同期的に実行され、`{ success: boolean; message: string }` 形式のオブジェクトを返す。
`success: true` はフェーズ遷移が正常に完了したことを示し、`success: false` は遷移が阻止されたことを示す。
テストでは `result.success` と `result.message` の両方をアサーションすることで、ツールの動作を検証する。

- 型定義: `{ success: boolean; message: string }`
- 成功時の `success`: `true`（フェーズ遷移が完了した場合）
- 失敗時の `success`: `false`（成果物チェック失敗、HMAC検証失敗、スコープ検証失敗の場合）
- `message` フィールド: 成功・失敗を問わず、処理内容の説明文字列が含まれる
- BUG-4 早期returnパスの返却値: スコープが空の場合でも `success: true` を返し、フェーズスキップ情報を `message` に含める

### `stateManager.writeTaskState` の型シグネチャ

`writeTaskState` は `TaskState` 型の引数を受け取り、戻り値を返さない void 関数である。
テスト環境では `vi.spyOn(stateManager, 'writeTaskState').mockImplementation(() => {})` でモック化し、
実際のファイルI/O処理を回避する設計とする。

- 型シグネチャ: `(state: TaskState) => void`
- モック化の目的: テスト環境でのファイルシステムへの書き込みを回避する
- モック化の適用範囲: TC-1-2 グループ全テストと AC-1-3 テストの `beforeEach` 内で設定する
- `vi.clearAllMocks()` との関係: 親の `beforeEach` で呼ばれるため、グループ固有の `beforeEach` での再設定が必須となる

### `calculatePhaseSkips` 関数のレスポンス型

`calculatePhaseSkips` は `Record<string, string>` 型のオブジェクトを返す純粋関数である。
キーはスキップ対象のフェーズ名（`'test_impl'`・`'implementation'`・`'refactoring'`）であり、
値はスキップ理由を説明する文字列である。スキップ対象がない場合は空オブジェクトを返す。

- 型定義: `Record<string, string>`（スキップフェーズ名 → スキップ理由の文字列）
- スコープ空時の戻り値: 3フェーズすべてをキーとして持つオブジェクト（早期returnパス）
- スコープ設定済みかつコード・テストが両方存在する場合の戻り値: 空オブジェクト `{}`
- 各値の文字列: 空文字列でないことを `expect(value.length).toBeGreaterThan(0)` でアサーションできる

### MCPツールが返すエラー情報の構造

`workflowNext` が `success: false` を返す際、`message` フィールドには失敗理由が含まれる。
成果物バリデーション失敗の場合、不足しているファイル名（例: `'research.md'`）とその種別（「成果物」）が
メッセージ文字列に含まれており、`toContain` アサーションで検証できる設計となっている。

- メッセージ形式の例: `'research.md が見つかりません。成果物が存在することを確認してください'`
- `toContain('research.md')` と `toContain('成果物')` の両方でアサーション可能
- HMAC検証失敗時のメッセージには `'整合性'` または `'HMAC'` という文字列が含まれる

---

## 設定ファイル設計

このセクションでは、`workflow-plugin/mcp-server/vitest.config.ts` の現行設定内容と、
BUG-4テストカバレッジ修正において変更が不要である理由を設計の観点から説明する。
新規テストファイルが既存設定の `include` グロブに合致することを確認し、設定変更を回避する判断を記録する。

### `vitest.config.ts` の現行設定内容

vitest.config.ts の `test.include` フィールドは `['src/**/__tests__/**/*.test.ts', 'tests/**/*.test.ts']` に設定されており、
新規ファイル `src/phases/__tests__/calculate-phase-skips.test.ts` はこのグロブに完全一致する。
設定ファイルへの変更は不要であり、既存のグロブパターンで新規テストが自動的に検索対象となる。

- `test.globals`: `true`（`describe`, `it`, `expect` をグローバルで使用可能）
- `test.environment`: `'node'`（ブラウザAPIではなくNode.js APIを使用）
- `test.include`: `['src/**/__tests__/**/*.test.ts', 'tests/**/*.test.ts']`
- `test.globalSetup`: `['./vitest-global-setup.ts']`（URL エンコードされたパスのスタブファイルを生成）
- `test.alias`: `{ '@/': new URL('./src/', import.meta.url).pathname }`（パスエイリアス設定）

### カバレッジ設定の詳細

カバレッジプロバイダーとして `v8` を採用しており、3種類の出力フォーマットを生成する。
`coverage.include` で `src/**/*.ts` を対象とし、テストファイルとデクラレーションファイルは除外している。
新規ファイル `src/phases/definitions.ts` のカバレッジは `calculatePhaseSkips` の各分岐が網羅されることで向上する見込みである。

- `coverage.provider`: `'v8'`（Node.jsネイティブのカバレッジ計測）
- `coverage.reporter`: `['text', 'json', 'html']`（コンソール・JSON・HTML形式で出力）
- `coverage.include`: `['src/**/*.ts']`（ソースファイルのみカバレッジ計測対象）
- `coverage.exclude`: `['src/**/__tests__/**', 'src/**/*.d.ts']`（テストファイルと型定義は除外）
- `calculatePhaseSkips` 関数のカバレッジ向上: 7テストケース追加により全6分岐がカバーされる

### ESM設定と `.js` 拡張子の使用方針

`package.json` に `"type": "module"` が設定されているため、全 `.js` ファイルは ESM として扱われる。
テストファイル内でのインポートは `.js` 拡張子を明示的に記述する必要があり、
vitest のトランスパイル設定が TypeScript ファイルへ解決する仕組みが機能している。

- 正しいインポート形式: `import { calculatePhaseSkips } from '../definitions.js'`
- 誤ったインポート形式: `require()` の使用（ESMコンテキストでは `ReferenceError` が発生する）
- `vi.mock()` のモジュールパスも `.js` 拡張子を使用する必要がある
- `vitest-global-setup.ts` の役割: URLエンコードされたパスで参照されるスタブファイルを生成し、`import()` の解決を補助する

### 設定ファイルへの変更が不要である根拠

本タスクの変更対象はテストファイル2件のみ（新規作成1件・既存修正1件）であり、vitest.config.ts への変更は一切不要である。
既存の `include` グロブが新規テストファイルのパスに合致していることを確認済みであり、
グローバル設定・エイリアス設定・カバレッジ設定のいずれも現行のままで正しく動作する。

- 変更不要の確認済み設定項目: `globals`, `environment`, `include`, `globalSetup`, `alias`, `coverage` の全項目
- 設定変更を行わない理由: 変更すると既存テストの実行環境に予期しない影響を与えるリスクがある
- カバレッジ改善効果: 設定変更なしで、`calculatePhaseSkips` 関数の全6分岐がカバレッジ計測対象となる
