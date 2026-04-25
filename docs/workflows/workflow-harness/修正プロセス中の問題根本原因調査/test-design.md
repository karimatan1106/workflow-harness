## サマリー

本ドキュメントは、6件の未解決問題（FR-REQ-1〜FR-REQ-6）に対するテスト設計を定義する。
各修正の検証方針・テストケース・実行コマンドを体系的に整理し、実装フェーズで安全に変更を進められるようにする。

- 目的: FR-REQ-1〜FR-REQ-6 の各修正が正しく適用されたことを自動・手動の両面から検証する
- 主要な決定事項:
  - FR-REQ-1（テストモック修正）: 既存ユニットテスト UT-5.1〜UT-5.4 の通過 + stderr 警告消失を確認する
  - FR-REQ-4（フォールバック値更新）: ビルド正常終了 + 全テストスイート（912件以上）の継続合格を確認する
  - FR-REQ-2・FR-REQ-3・FR-REQ-6（MEMORY.md 変更）: ファイル内容の目視確認で行う
  - FR-REQ-5（CLAUDE.md 変更）: ファイル内容の目視確認で行う
  - テスト実行コマンドは `C:\ツール\Workflow\workflow-plugin\mcp-server` ディレクトリ配下で実行する
- 次フェーズで必要な情報:
  - テスト対象ファイル: `tests/validation/design-validator.test.ts`（FR-REQ-1）
  - 実装対象ファイル: `src/phases/definitions.ts` の34〜35行目（FR-REQ-4）
  - 変更後に `npm run build` → `npm test` の順で実行すること（FR-REQ-4 の検証手順）

---

## テスト方針

### 全体方針

このタスクの修正は、コードファイル 2件（FR-REQ-1・FR-REQ-4）とドキュメントファイル 4件（FR-REQ-2・FR-REQ-3・FR-REQ-5・FR-REQ-6）に分類される。
コードファイルの変更には自動テストによる検証が必要であり、ドキュメントファイルの変更には内容の目視確認が必要である。
修正の実施順序は、コード変更（テスト・ビルド確認が必要なもの）を先に行い、ドキュメント変更を後に行うことを推奨する。

### テスト種別と適用範囲

FR-REQ-1 のテスト: `design-validator.test.ts` のユニットテスト実行による自動検証が中心となる。
FR-REQ-4 のテスト: TypeScript コンパイル（`npm run build`）+ 全テストスイート実行（`npm test`）による自動検証が必要である。
FR-REQ-2・FR-REQ-3・FR-REQ-6 のテスト: MEMORY.md ファイルを Read ツールで読み込み、追記内容の存在と整合性を確認する目視検証となる。
FR-REQ-5 のテスト: CLAUDE.md ファイルの指定箇所を Read ツールで読み込み、追記内容の存在と既存文の保全を確認する目視検証となる。

### リグレッション防止方針

FR-REQ-1 の修正（1行追加）が既存テストケース UT-5.2・UT-5.3 の動作を変えないことを確認する。
FR-REQ-4 の修正（フォールバック値2行変更）が正常起動時の動作に影響しないことを、全テストスイートの継続合格で確認する。
ドキュメント変更（FR-REQ-2・FR-REQ-3・FR-REQ-5・FR-REQ-6）は既存のコードや他のテストに影響を与えないため、コードのリグレッションテストは不要である。

### テストの実行環境

テストコマンドはすべて `C:\ツール\Workflow\workflow-plugin\mcp-server` ディレクトリで実行する。
vitest を使用するため、`npx vitest run` または `npm test` を使用する。
特定ファイルのみを実行する場合は `npx vitest run tests/validation/design-validator.test.ts` を使用する。

---

## テストケース

### FR-REQ-1: design-validator.test.ts の mkdirSync モック追加

#### 対象ファイル

`C:\ツール\Workflow\workflow-plugin\mcp-server\tests\validation\design-validator.test.ts`

#### TC-1-1: 正常系 — 既存テスト UT-5.1 の継続合格確認

- 前提条件: `vi.mock('fs')` ブロックに `mkdirSync: vi.fn()` が追加されていること
- 操作: `npx vitest run tests/validation/design-validator.test.ts` を実行する
- 期待結果: UT-5.1「全ファイル存在時にpassedがtrueになる」が PASS となること
- 確認方法: vitest の標準出力に「✓ UT-5.1: 全項目実装済み」が含まれること

#### TC-1-2: 正常系 — 既存テスト UT-5.2 の継続合格確認

- 前提条件: `vi.mock('fs')` ブロックに `mkdirSync: vi.fn()` が追加されていること
- 操作: `npx vitest run tests/validation/design-validator.test.ts` を実行する
- 期待結果: UT-5.2「ファイル欠損時にpassedがfalseになる」が PASS となること
- 確認方法: vitest の標準出力に「✓ UT-5.2: 一部未実装」が含まれること

#### TC-1-3: 正常系 — 既存テスト UT-5.3 の継続合格確認

- 前提条件: `vi.mock('fs')` ブロックに `mkdirSync: vi.fn()` が追加されていること
- 操作: `npx vitest run tests/validation/design-validator.test.ts` を実行する
- 期待結果: UT-5.3 の2ケース（設計書なし・workflowDir なし）が PASS となること
- 確認方法: vitest の標準出力に「✓ UT-5.3: 設計書なし」が含まれること

#### TC-1-4: 副作用確認 — stderr への警告出力が消失することの確認

- 前提条件: `vi.mock('fs')` ブロックに `mkdirSync: vi.fn()` が追加されていること
- 操作: `npx vitest run tests/validation/design-validator.test.ts 2>&1` を実行する（stderr もキャプチャする）
- 期待結果: 出力に `No "mkdirSync" export is defined on the "fs" mock` という文字列が含まれないこと
- 確認方法: 出力テキストに上記の警告文字列が存在しないことを目視で確認する

#### TC-1-5: 境界値 — モックブロックの構造が保全されていることの確認

- 前提条件: `vi.mock('fs')` ブロックの編集が完了していること
- 操作: `tests/validation/design-validator.test.ts` を Read ツールで読み込む
- 期待結果: `vi.mock('fs', () => ({` ブロックに `existsSync`・`readFileSync`・`statSync`・`mkdirSync` の4つのモックが定義されていること
- 確認方法: ファイル内容に4つのキーが全て含まれていることを確認する

#### 実行コマンド（FR-REQ-1）

```bash
cd C:\ツール\Workflow\workflow-plugin\mcp-server
npx vitest run tests/validation/design-validator.test.ts
```

---

### FR-REQ-4: definitions.ts フォールバック値の現行パターンへの更新

#### 対象ファイル

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`（34〜35行目）

#### TC-4-1: 正常系 — TypeScript ビルドの成功確認

- 前提条件: `definitions.ts` の34・35行目が新パターンに更新されていること
- 操作: `npm run build` を実行する
- 期待結果: ビルドが正常終了し、終了コードが 0 であること
- 確認方法: コマンドの出力に `error` が含まれないことを確認する

#### TC-4-2: 正常系 — 型チェック通過の確認（allowedKeywords の空配列化）

- 前提条件: `bracketPlaceholderInfo.allowedKeywords` が `[]`（空配列）に変更されていること
- 操作: `npm run build` を実行し、TypeScript の型エラーを確認する
- 期待結果: `allowedKeywords: string[]` の型定義と `[]` が適合し、型エラーが出ないこと
- 確認方法: ビルド出力に TypeScript の型エラーメッセージが含まれないことを確認する

#### TC-4-3: 正常系 — 全テストスイートの継続合格確認

- 前提条件: `definitions.ts` の変更とビルドが完了していること
- 操作: `npm test` または `npx vitest run` を実行する
- 期待結果: 912件以上のテストが全て PASS となること。FAIL が 0 件であること
- 確認方法: vitest の最終サマリー行に `0 failed` と表示されることを確認する

#### TC-4-4: 内容確認 — 変更後のフォールバック値の正確性

- 前提条件: `definitions.ts` の変更が完了していること
- 操作: `definitions.ts` の34・35行目を Read ツールで読み込む
- 期待結果（34行目）: `bracketPlaceholderRegex: /\[#[^\]]{0,50}#\]/g,` となっていること
- 期待結果（35行目）: `bracketPlaceholderInfo: { pattern: '\\[#[^\\]]{0,50}#\\]', allowedKeywords: [], maxLength: 50 },` となっていること
- 確認方法: Read ツールの出力で2行の内容を目視確認する

#### TC-4-5: 境界値 — 変更対象外プロパティの保全確認

- 前提条件: `definitions.ts` の変更が完了していること
- 操作: `definitions.ts` の32〜42行目を Read ツールで読み込む
- 期待結果: `duplicateLineThreshold: 3`・`minSectionDensity: 0.3`・`forbiddenPatterns` 等の他プロパティが変更されていないこと
- 確認方法: Read ツールの出力で上記プロパティの値が仕様書の変更前内容と一致することを確認する

#### TC-4-6: 異常系 — フォールバック値が旧パターンのままの場合の検出

- 前提条件: 変更前の状態（旧パターンが残存している状態）を想定したシナリオ
- 操作: `definitions.ts` の34行目を Read ツールで確認する
- 期待結果: `(?!関連|参考|注|例|出典)` の文字列が34行目に含まれていないことを確認する
- 確認方法: 旧パターン文字列が存在しない（削除済みである）ことを目視で確認する

#### 実行コマンド（FR-REQ-4）

```bash
cd C:\ツール\Workflow\workflow-plugin\mcp-server
npm run build
npx vitest run
```

---

### FR-REQ-2: MEMORY.md への FR-22 実装記録の追記

#### 対象ファイル

`C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md`

#### TC-2-1: 正常系 — FR-22 実装記録セクションの存在確認

- 前提条件: MEMORY.md への追記が完了していること
- 操作: MEMORY.md を Read ツールで読み込む
- 期待結果: ファイル内に「FR-22 実装内容」または「FR-22」という見出しが存在すること
- 確認方法: ファイル内容に追記されたセクション見出しが含まれることを確認する

#### TC-2-2: 正常系 — FR-22 記録の必須情報含有確認

- 前提条件: MEMORY.md への追記が完了していること
- 操作: MEMORY.md を Read ツールで読み込む
- 期待結果: 追記されたセクションに `docs_update`・`affectedFiles`・`cd8a594` の各キーワードが含まれること
- 確認方法: 3つのキーワードが全て追記セクション内に存在することを目視で確認する

#### TC-2-3: 整合性確認 — 既存セクションが破損していないことの確認

- 前提条件: MEMORY.md への追記が完了していること
- 操作: MEMORY.md を Read ツールで読み込む
- 期待結果: 既存の「FR-19 実装内容」「FR-16・FR-17・FR-18 実装内容」等のセクションが削除・改変されていないこと
- 確認方法: 既存のセクション見出しが存在し、内容が保全されていることを確認する

---

### FR-REQ-3: MEMORY.md への FR-A〜FR-D 実装記録の追記

#### 対象ファイル

`C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md`

#### TC-3-1: 正常系 — FR-A〜FR-D 実装記録セクションの存在確認

- 前提条件: MEMORY.md への追記が完了していること
- 操作: MEMORY.md を Read ツールで読み込む
- 期待結果: ファイル内に「FR-A」「FR-B」「FR-C」「FR-D」の各記録が含まれるセクションが存在すること
- 確認方法: ファイル内容に4項目それぞれへの言及が含まれることを確認する

#### TC-3-2: 正常系 — FR-A〜FR-D の各記録内容の確認

- 前提条件: MEMORY.md への追記が完了していること
- 操作: MEMORY.md を Read ツールで読み込む
- 期待結果（FR-A）: CLAUDE.md の角括弧プレースホルダー説明更新に関する記述が含まれること
- 期待結果（FR-B）: `performance_test` および `e2e_test` テンプレートの配列記法警告削除に関する記述が含まれること
- 期待結果（FR-C）: `buildSubagentTemplate` 関数の説明文修正に関する記述が含まれること
- 期待結果（FR-D）: `generateImprovementsFromError` のエラーメッセージ修正に関する記述が含まれること

#### TC-3-3: 正常系 — コミットハッシュの正確性確認

- 前提条件: MEMORY.md への追記が完了していること
- 操作: MEMORY.md を Read ツールで読み込む
- 期待結果: サブモジュール `90ebb69` と親リポジトリ `5c9fe36` の両コミットハッシュが記録されていること
- 確認方法: 2つのハッシュ値がファイル内に含まれることを目視で確認する

---

### FR-REQ-5: CLAUDE.md 保守ルール行への権威情報源追記

#### 対象ファイル

`C:\ツール\Workflow\CLAUDE.md`

#### TC-5-1: 正常系 — 追記内容の存在確認

- 前提条件: CLAUDE.md への追記が完了していること
- 操作: CLAUDE.md の「禁止パターン（完全リスト）」セクション末尾付近を Read ツールで読み込む
- 期待結果: `bracketPlaceholderRegex` という語句を含む保守ルール文が追記されていること
- 確認方法: `bracketPlaceholderRegex` の文字列がファイル内の保守ルール付近に存在することを確認する

#### TC-5-2: 正常系 — 既存保守ルール文の保全確認

- 前提条件: CLAUDE.md への追記が完了していること
- 操作: CLAUDE.md の保守ルール付近を Read ツールで読み込む
- 期待結果: 「保守ルール: artifact-validator.ts の FORBIDDEN_PATTERNS が変更された場合、本リストも合わせて更新すること。」という既存の文が削除されていないこと
- 確認方法: 既存の保守ルール文が完全な形で残っていることを確認する

#### TC-5-3: 整合性確認 — 追記文の内容が仕様書の意図と一致することの確認

- 前提条件: CLAUDE.md への追記が完了していること
- 操作: CLAUDE.md を Read ツールで読み込む
- 期待結果: 追記文に `definitions.ts`・`CLAUDE.md`・`artifact-validator.ts` の3つの更新対象ファイルへの言及が含まれること
- 確認方法: 3つのファイル名が追記された保守ルール文内に存在することを確認する

---

### FR-REQ-6: MEMORY.md の task-index.json 記述を実装済み状態に更新

#### 対象ファイル

`C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md`

#### TC-6-1: 正常系 — セクション見出しの更新確認

- 前提条件: MEMORY.md の見出し変更が完了していること
- 操作: MEMORY.md を Read ツールで読み込む
- 期待結果: 「task-index.json Cache Staleness (FIX-1 実装済み)」という見出しが存在すること
- 確認方法: 更新後の見出し文字列がファイル内に含まれることを確認する

#### TC-6-2: 正常系 — Root fix 行の内容更新確認

- 前提条件: MEMORY.md の Root fix 行変更が完了していること
- 操作: MEMORY.md の該当セクションを Read ツールで読み込む
- 期待結果: `updateTaskIndexForSingleTask` という語句を含む更新後の Root fix 行が存在すること
- 確認方法: 更新後のテキストがファイル内に含まれることを確認する

#### TC-6-3: 整合性確認 — Workaround の記述が削除されていないことの確認

- 前提条件: MEMORY.md の変更が完了していること
- 操作: MEMORY.md の task-index.json セクションを Read ツールで読み込む
- 期待結果: `Workaround` または `Edit task-index.json` に関する記述が残存していること
- 確認方法: Workaround に関する既存記述が削除されていないことを確認する

#### TC-6-4: 境界値 — 旧見出し文字列が残存していないことの確認

- 前提条件: MEMORY.md の見出し変更が完了していること
- 操作: MEMORY.md を Read ツールで読み込む
- 期待結果: 「FIX-1 Known Bug」という旧表記がセクション見出しに含まれていないこと
- 確認方法: 旧見出し文字列が存在しない（上書きされた）ことを確認する

---

## テスト実行順序と統合確認

### 推奨実行順序

修正とテストは以下の順序で実施することを推奨する。

第1フェーズ（コード変更とテスト検証）として、FR-REQ-1 の修正（1行追加）を実施し、`npx vitest run tests/validation/design-validator.test.ts` で TC-1-1 から TC-1-5 を確認する。
続けて FR-REQ-4 の修正（2行更新）を実施し、`npm run build` で TC-4-1 と TC-4-2 を確認した後、`npm test` で TC-4-3 を確認する。

第2フェーズ（ドキュメント変更と目視確認）として、FR-REQ-2 の追記を実施し Read ツールで TC-2-1 から TC-2-3 を確認する。
FR-REQ-3 の追記を実施し Read ツールで TC-3-1 から TC-3-3 を確認する。
FR-REQ-5 の追記を実施し Read ツールで TC-5-1 から TC-5-3 を確認する。
最後に FR-REQ-6 の変更を実施し Read ツールで TC-6-1 から TC-6-4 を確認する。

### 最終統合確認コマンド

```bash
cd C:\ツール\Workflow\workflow-plugin\mcp-server
npx vitest run
```

全テストスイートを実行し、以下の条件が成立することを確認する。

- 合格件数が 912件以上であること（FR-REQ-4 によるリグレッションが発生していないことの証明）
- 失敗件数が 0件であること
- `design-validator.test.ts` 内の全テストケースが PASS であること（FR-REQ-1 の正常化の証明）

### 検証完了の判断基準

コード変更分（FR-REQ-1・FR-REQ-4）の検証が完了したと判断できる条件は以下の通りである。
vitest の出力に `0 failed` が表示されること、ビルドコマンドが正常終了（終了コード 0）していること、および `design-validator.test.ts` の全テストが PASS していること。

ドキュメント変更分（FR-REQ-2・FR-REQ-3・FR-REQ-5・FR-REQ-6）の検証が完了したと判断できる条件は、各 TC の「期待結果」に記述した内容が MEMORY.md と CLAUDE.md の実際のファイル内容と一致していることである。
