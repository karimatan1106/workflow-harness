## サマリー

- 目的: 過去の修正セッション（FR-1〜FR-22、FR-A〜FR-D）で発生した問題の根本原因を調査し、特定された5点の未解決問題を解決するための要件を定義する
- 主要な決定事項:
  - FIX-design-validator-mock: `design-validator.test.ts` の `vi.mock('fs')` に `mkdirSync: vi.fn()` を追加してテスト警告を解消する
  - FIX-memory-fr22-frabcd: MEMORY.md に FR-22 と FR-A〜FR-D の実装記録を追記する
  - FIX-fallback-pattern: `definitions.ts` 34〜35行目のフォールバック値を現行の正しいパターン（`[#xxx#]`）に更新する
  - FIX-root-cause-doc: CLAUDE.md に「`artifact-validator.ts` が信頼できる単一情報源」である旨の明示を追加する
  - FIX-task-index-verify: MEMORY.md の `task-index.json FIX-1 Known Bug` セクションを「実装済み」に更新する
- 次フェーズで必要な情報: 各修正対象ファイルの正確なパス、修正後の内容、テスト実行コマンド

---

## 機能要件

### FR-REQ-1: design-validator.test.ts の mkdirSync モック追加

#### 背景と問題

`tests/validation/design-validator.test.ts` のテスト実行中に、`DesignValidator.persistCache()` が `fs.mkdirSync` を呼び出す際にモックが定義されていないという警告が stderr に出力される。現行の `vi.mock('fs')` は `existsSync`、`readFileSync`、`statSync` の3つしか定義していない。`mkdirSync` が未定義のため vitest が警告を出力するが、`persistCache` 内部の `catch` ブロックがエラーを吸収するためテスト自体は通過する。この警告はテスト出力を汚染し、本物のエラーとの区別を困難にする。

#### 要件内容

`tests/validation/design-validator.test.ts` の `vi.mock('fs', ...)` ブロックに `mkdirSync: vi.fn()` を追加すること。追加後、UT-5.1 と UT-5.2 の実行時に stderr へ警告が出力されなくなることを確認する。テストの合否判定は変化しないことを確認する。

#### 受け入れ基準

- 警告「Failed to persist cache: Error: [vitest] No "mkdirSync" export is defined on the "fs" mock」が出力されなくなる
- UT-5.1、UT-5.2、UT-5.3、UT-5.4 の全テストが引き続き通過する
- `vi.fn()` のみを追加し、実際のファイルシステム操作を呼び出さない

---

### FR-REQ-2: MEMORY.md への FR-22 実装記録の追記

#### 背景と問題

コミット `cd8a594`（サブモジュール、2026-02-25）で実装された FR-22 の内容が MEMORY.md に記録されていない。FR-22 では `definitions.ts` の `docs_update` フェーズのテンプレートにスコープ情報プレースホルダー（`${affectedFiles}`、`${affectedDirs}`、`${moduleName}`）が追加され、`next.ts` にプレースホルダー解決ロジックも追加された。この実装記録が欠落していると、将来のセッションで同じ調査を繰り返す可能性がある。

#### 要件内容

MEMORY.md に以下の内容を含む「FR-22 実装内容（2026-02-25 完了）」セクションを追記すること。記載内容は、`docs_update` テンプレートへのスコープ情報プレースホルダー追加、`next.ts` へのプレースホルダー解決ロジック追加、実装コミット番号（`cd8a594`）を含む。

#### 受け入れ基準

- MEMORY.md に FR-22 の実装内容が明記される
- 記録内容は調査時に特定した実装事実（コミットハッシュ、変更ファイル名、変更内容）と一致する
- 既存の MEMORY.md 項目の内容を破壊しない

---

### FR-REQ-3: MEMORY.md への FR-A〜FR-D 実装記録の追記

#### 背景と問題

コミット `90ebb69`（サブモジュール、2026-02-28）および `5c9fe36`（親リポジトリ、2026-02-28）で実装された FR-A〜FR-D の内容が MEMORY.md に記録されていない。FR-A〜FR-D はいずれも角括弧プレースホルダーパターンの説明文を正確な `[#xxx#]` 形式に修正する内容であり、今後の開発者が背景を理解するために必要な記録である。

#### 要件内容

MEMORY.md に以下の4項目を含む「FR-A〜FR-D 実装内容（2026-02-28 完了）」セクションを追記すること。FR-A（CLAUDE.md の説明更新）、FR-B（誤った「配列アクセス記法禁止」警告文の削除）、FR-C（`buildSubagentTemplate` の説明修正）、FR-D（`generateImprovementsFromError` のエラーメッセージ修正）の各内容を記述する。

#### 受け入れ基準

- MEMORY.md に FR-A、FR-B、FR-C、FR-D の各実装内容が明記される
- 各項目に変更対象ファイル名と変更の目的が記述されている
- コミットハッシュ（`90ebb69`、`5c9fe36`）が記録されている

---

### FR-REQ-4: definitions.ts フォールバック値の現行パターンへの更新

#### 背景と問題

`definitions.ts` の34〜35行目（`GLOBAL_RULES_CACHE` の初期化エラー時フォールバック値）には旧バージョンのパターンが残存している。具体的には `bracketPlaceholderRegex` が `/\[(?!関連|参考|注|例|出典)[^\]]{1,50}\]/g` という旧形式であり、`bracketPlaceholderInfo.pattern` も旧形式文字列、`allowedKeywords` も旧キーワードリストを使用している。正常系では `exportGlobalRules()` が `artifact-validator.ts` から正しい値（`/\[#[^\]]{0,50}#\]/g`）を返すため実害はないが、MCP サーバー起動時に `artifact-validator.ts` のインポートが失敗した場合、フォールバック値が使用されてパターン不整合が再発するリスクがある。

#### 要件内容

`definitions.ts` 32〜41行目の `GLOBAL_RULES_CACHE` フォールバック値において以下の3点を修正すること。第1点として `bracketPlaceholderRegex` を `/\[#[^\]]{0,50}#\]/g` に変更する。第2点として `bracketPlaceholderInfo.pattern` を `'\\[#[^\\]]{0,50}#\\]'` に変更し、`allowedKeywords` を空配列 `[]` に変更する。第3点として `bracketPlaceholderInfo.maxLength` の値（50）は変更しない。

#### 受け入れ基準

- フォールバック時のパターンが `artifact-validator.ts` の現行パターン（`/\[#[^\]]{0,50}#\]/g`）と一致する
- `allowedKeywords` が空配列になり、旧許可キーワード（「関連」「参考」「注」「例」「出典」）が含まれない
- 変更後にビルドが成功する（`npm run build` が正常終了する）

---

### FR-REQ-5: CLAUDE.md に情報源の権威性を明示する記述の追加

#### 背景と問題

調査の結果、文書化ミスが繰り返された根本原因の一つは「信頼できる単一情報源の欠如」であった。`artifact-validator.ts` が正式なパターン定義を持つ唯一の情報源であるべきだが、この関係性が CLAUDE.md に明示されていなかった。そのため、修正者が複数のファイルを個別に調べて対応し、更新漏れが生じた。今後この問題が再発しないよう、`artifact-validator.ts` の権威性を明文化することで、変更時の確認手順を標準化する必要がある。

#### 要件内容

CLAUDE.md の「禁止パターン（完全リスト）」セクションの末尾に「保守ルール」として、角括弧プレースホルダーの正式なパターン定義は `artifact-validator.ts` の `bracketPlaceholderPattern` 定数（またはそれと同等の変数）が唯一の権威ある情報源であること、`definitions.ts` のフォールバック値・テンプレート文字列・CLAUDE.md の説明文は全て `artifact-validator.ts` の定義に追従して更新すること、という2点を記述する。なお、CLAUDE.md の同セクション末尾にはすでに「保守ルール: artifact-validator.ts の FORBIDDEN_PATTERNS が変更された場合、本リストも合わせて更新すること。」という記述があるため、角括弧プレースホルダーに関する同様の保守ルールをその後に追記する形とする。

#### 受け入れ基準

- CLAUDE.md に角括弧プレースホルダーパターンの権威情報源が `artifact-validator.ts` であることが明記される
- `definitions.ts` フォールバック値・テンプレート文字列・CLAUDE.md 本文の更新義務が明記される
- 既存の FORBIDDEN_PATTERNS 保守ルールと一貫したスタイルで記述される

---

### FR-REQ-6: MEMORY.md の task-index.json 記述を実装済み状態に更新

#### 背景と問題

MEMORY.md の「task-index.json Cache Staleness (FIX-1 Known Bug)」セクションには「Root fix: MCP server should update task-index.json on every phase transition」という記述がある。しかし調査の結果、`src/state/manager.ts` の863行目（`setPhase` メソッド内）にすでに `this.updateTaskIndexForSingleTask(taskId, phase, taskState)` の呼び出しが存在し、FIX-1 は実装済みであることが確認された。現在の MEMORY.md の記述は未実装の問題として誤解を招く状態となっており、将来の開発者が解決済みの問題を再度調査する無駄が生じる可能性がある。

#### 要件内容

MEMORY.md の「task-index.json Cache Staleness (FIX-1 Known Bug)」セクションを更新し、「Root fix: MCP server should update task-index.json on every phase transition」という行を「Root fix: 実装済み（`src/state/manager.ts` 863行目の `updateTaskIndexForSingleTask` 呼び出し、FIX-1 として対応完了）」に置き換えること。セクション見出しも「(FIX-1 Known Bug)」から「(FIX-1 実装済み)」に変更すること。

#### 受け入れ基準

- MEMORY.md のセクション見出しが「(FIX-1 実装済み)」に更新されている
- 「Root fix」行が実装済みを明記する内容に更新されている
- Workaround（`task-index.json` を手動編集する方法）の記述は参考情報として残す

---

## 非機能要件

### 修正の影響範囲の限定

各修正は対象ファイルの最小限の箇所のみを変更すること。FR-REQ-1 のモック追加は `vi.mock` ブロック内の1行追加であり、他のテストケースや設定を変更しない。FR-REQ-4 のフォールバック値修正は `GLOBAL_RULES_CACHE` の catch ブロック内の特定プロパティのみを変更し、他のプロパティ（`duplicateLineThreshold`、`minSectionDensity` 等）は変更しない。

### テストの継続合格

FR-REQ-1 の修正後、既存のテスト（912件以上）が全て合格し続けること。FR-REQ-4 の修正後も同様に全テストが合格すること。リグレッションが発生した場合は修正を中断して原因を特定する。

### ビルドの正常終了

FR-REQ-4 および FR-REQ-5 の修正後、`npm run build` が正常終了すること。TypeScript の型エラーが新たに発生しないこと。

### ドキュメントの一貫性

FR-REQ-2、FR-REQ-3、FR-REQ-5、FR-REQ-6 のドキュメント変更は、既存の MEMORY.md および CLAUDE.md の記述スタイル・フォーマット・表記法と一致させること。見出しレベルや箇条書き形式を既存項目に揃える。

### 修正の原子性

FR-REQ-2 と FR-REQ-3 は同一ファイル（MEMORY.md）の変更であるため、1回の編集操作で完結させることが望ましい。ただし誤りが生じた場合の追記修正は許容する。

### 変更履歴の追跡可能性

各修正はコードコメントや MEMORY.md 記録において、対応するコミットハッシュと実施日が参照可能な形で残すこと。FIX-design-validator-mock は「テスト警告の解消」として、FIX-fallback-pattern は「フォールバック値の現行パターンへの同期」として説明コメントを追加すること。

---

## 優先度とリスク評価

### 修正の優先度

FR-REQ-1（mkdirSync モック追加）は機能影響がなく変更規模が最小であるため、最初に実施することで後続の修正への自信をつける起点とする。FR-REQ-4（フォールバック値修正）はビルドとテストへの影響があるため、ビルド確認とテスト実行が必須である。FR-REQ-2・FR-REQ-3・FR-REQ-6 はドキュメント変更のみであり、技術的リスクが最も低い。FR-REQ-5 は CLAUDE.md の変更であり、将来のセッションへの影響が大きいため内容の正確性を重視する。

### リスク評価

FR-REQ-4 のフォールバック値修正においては、修正後のフォールバック値が `artifact-validator.ts` の現行パターンと完全に一致することを実際のコードで確認してから修正すること。`artifact-validator.ts` の368行目（`/\[#[^\]]{0,50}#\]/g`）を参照元として使用する。型の変更（`allowedKeywords` を文字列配列から空配列にする）が TypeScript の型チェックを通過することを `npm run build` で確認する。

### 副作用の排除

FR-REQ-1 の `mkdirSync: vi.fn()` 追加により、実際の `mkdir` 操作が誤って呼び出された場合でも無操作となる。この挙動はテスト環境において適切である。FR-REQ-4 のフォールバック値は通常の起動では使用されないため、変更後も正常系の動作に影響しない。
