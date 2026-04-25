## サマリー

本仕様書は、過去の修正セッション（FR-1〜FR-22、FR-A〜FR-D）で発生した問題を受けて特定された
6件の未解決問題（FR-REQ-1〜FR-REQ-6）の実装仕様を定義する。
各修正は影響範囲を最小化し、既存テストのリグレッションを発生させないことを原則とする。

- 目的: 特定された未解決問題を解消し、テスト品質・ドキュメント整合性・フォールバック値の信頼性を向上させる
- 主要な決定事項:
  - FR-REQ-1: `vi.mock('fs')` ブロックへの `mkdirSync: vi.fn()` 追加（1行追加のみ）
  - FR-REQ-2: MEMORY.md へ FR-22 実装記録を追記（コミット cd8a594 の内容）
  - FR-REQ-3: MEMORY.md へ FR-A〜FR-D 実装記録を追記（コミット 90ebb69・5c9fe36 の内容）
  - FR-REQ-4: `definitions.ts` 34〜35行目のフォールバック値を現行パターン `/\[#[^\]]{0,50}#\]/g` に更新
  - FR-REQ-5: CLAUDE.md の保守ルール行に角括弧プレースホルダーの権威情報源を明記
  - FR-REQ-6: MEMORY.md の「task-index.json FIX-1 Known Bug」を「実装済み」状態に更新
- 次フェーズで必要な情報:
  - 各修正対象ファイルの絶対パス（下記「変更対象ファイル」セクションを参照）
  - `definitions.ts` 34行目と35行目の具体的なフォールバック値（本仕様書に記載済み）
  - CLAUDE.md 319行目の保守ルール行の正確な文言（本仕様書に記載済み）

---

## 概要

### タスクの背景

FR-1〜FR-22 にわたる修正セッションで、各機能の品質向上が段階的に実施されてきた。
しかしその過程でいくつかの問題が未解決のまま残存していることが調査により明らかになった。

残存問題は以下の5カテゴリに分類される。

1. テストコードの不完全なモック定義（FR-REQ-1）により、テスト出力に不要な警告が混入している
2. 最近完了した FR-22 と FR-A〜FR-D の実装記録が MEMORY.md に欠落している（FR-REQ-2・FR-REQ-3）
3. `definitions.ts` のフォールバック値が旧パターンのまま放置されており、起動エラー時に不整合が起きるリスクがある（FR-REQ-4）
4. `artifact-validator.ts` が角括弧プレースホルダーパターンの唯一の権威情報源であることが CLAUDE.md に明記されていない（FR-REQ-5）
5. MEMORY.md に「FIX-1 が未実装」との誤解を招く記述が残っており、将来の開発者が二重調査を行うリスクがある（FR-REQ-6）

### 修正方針

各修正は独立して実施可能であり、相互に干渉しない。
修正の実施順序は FR-REQ-1 → FR-REQ-4 → FR-REQ-2 → FR-REQ-3 → FR-REQ-5 → FR-REQ-6 を推奨する。
この順序は「コード変更（テスト確認が必要）→ コード変更（ビルド確認が必要）→ ドキュメント変更」の優先度に基づく。

---

## 実装計画

### FR-REQ-1: design-validator.test.ts の mkdirSync モック追加

#### 対象ファイル

`C:\ツール\Workflow\workflow-plugin\mcp-server\tests\validation\design-validator.test.ts`

#### 問題の詳細

現在の `vi.mock('fs', ...)` ブロックは以下の3つのみをモック定義している。

- `existsSync: vi.fn()`
- `readFileSync: vi.fn()`
- `statSync: vi.fn(() => ({ isDirectory: () => false }))`

`DesignValidator.persistCache()` メソッドは内部で `fs.mkdirSync` を呼び出すが、
このモック定義が欠落しているため vitest が警告を stderr へ出力する。
`persistCache` の `catch` ブロックがエラーを吸収するためテストは通過するが、
テスト出力が汚染され、本物のエラーとの区別が困難になる。

#### 実装内容

`vi.mock('fs', () => ({` ブロック内に `mkdirSync: vi.fn(),` を追加する。
追加位置は既存の `statSync` 定義の直後が適切である。

修正後の `vi.mock` ブロックは以下の形式になる。

```typescript
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(() => ({ isDirectory: () => false })),
  mkdirSync: vi.fn(),
}));
```

#### 検証方法

修正後にテストを実行し、UT-5.1・UT-5.2・UT-5.3・UT-5.4 が全て通過すること、
および stderr に `No "mkdirSync" export is defined on the "fs" mock` 警告が
出力されないことを確認する。

#### 影響範囲

この修正は `vi.mock('fs')` ブロックへの1行追加のみであり、
テストケースのロジックや既存モック定義には変更を加えない。
`mkdirSync: vi.fn()` はモック環境において実際のファイルシステム操作を実行しない。

---

### FR-REQ-4: definitions.ts フォールバック値の現行パターンへの更新

#### 対象ファイル

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

#### 問題の詳細

34〜35行目のフォールバック値には旧バージョンのパターンが残存している。
具体的には以下の問題がある。

- `bracketPlaceholderRegex` が旧形式 `/\[(?!関連|参考|注|例|出典)[^\]]{1,50}\]/g` である
- `bracketPlaceholderInfo.pattern` が旧形式文字列 `'\\[(?!関連|参考|注|例|出典)[^\\]]{1,50}\\]'` である
- `bracketPlaceholderInfo.allowedKeywords` に旧許可キーワード `['関連', '参考', '注', '例', '出典']` が含まれる

正常系では `exportGlobalRules()` が `artifact-validator.ts` から正しい値を返すため実害はないが、
MCP サーバー起動時に `artifact-validator.ts` のインポートが失敗した場合にこのフォールバック値が使用され、
パターン不整合によるバリデーション誤動作が再発するリスクがある。

#### 実装内容

`definitions.ts` の34行目と35行目を以下のように変更する。

変更前（34行目）:
```
bracketPlaceholderRegex: /\[(?!関連|参考|注|例|出典)[^\]]{1,50}\]/g,
```

変更後（34行目）:
```
bracketPlaceholderRegex: /\[#[^\]]{0,50}#\]/g,
```

変更前（35行目）:
```
bracketPlaceholderInfo: { pattern: '\\[(?!関連|参考|注|例|出典)[^\\]]{1,50}\\]', allowedKeywords: ['関連', '参考', '注', '例', '出典'], maxLength: 50 },
```

変更後（35行目）:
```
bracketPlaceholderInfo: { pattern: '\\[#[^\\]]{0,50}#\\]', allowedKeywords: [], maxLength: 50 },
```

`maxLength` の値（50）は変更しない。
`duplicateLineThreshold`・`minSectionDensity` 等、その他のプロパティも変更しない。

#### 検証方法

修正後に `npm run build` を実行してビルドが正常終了することを確認する。
TypeScript の型エラーが発生しないことを確認する（特に `allowedKeywords` の型変更について）。
その後に全テストスイートを実行し、912件以上のテストが引き続き全て合格することを確認する。

#### 影響範囲

この修正は `GLOBAL_RULES_CACHE` 初期化の `catch` ブロック内のフォールバック値のみを変更する。
正常起動時（`artifact-validator.ts` が正常にインポートされる場合）には、
フォールバック値は使用されないため、日常的な動作には影響しない。

---

### FR-REQ-2: MEMORY.md への FR-22 実装記録の追記

#### 対象ファイル

`C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md` — FR-22 実装記録の追記対象

#### 問題の詳細

コミット `cd8a594`（サブモジュール、2026-02-25）で実装された FR-22 の内容が MEMORY.md に記録されていない。
この実装記録が欠落していると、将来のセッションで同じ調査を繰り返す可能性がある。

#### 実装内容

MEMORY.md に「FR-22 実装内容（2026-02-25 完了）」セクションを追記する。
追記内容は以下の項目を含める。

追記するセクションの構成:

- 対象: `docs_update` フェーズのテンプレートへのスコープ情報プレースホルダー追加
- 追加されたプレースホルダー: `${affectedFiles}`・`${affectedDirs}`・`${moduleName}`
- `next.ts` にプレースホルダー解決ロジックを追加
- 実装コミット: `cd8a594`（サブモジュール）
- 目的: `docs_update` サブエージェントがスコープ情報を自動的に受け取れるようにする

MEMORY.md の末尾または「FR-19 実装内容」セクションの直後に追記すること。

#### 検証方法

MEMORY.md を読み込んで FR-22 の記録が存在することを確認する。
既存の他の FR 実装記録セクションが破損していないことを確認する。

---

### FR-REQ-3: MEMORY.md への FR-A〜FR-D 実装記録の追記

#### 対象ファイル

`C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md` — FR-A〜FR-D 実装記録の追記対象

#### 問題の詳細

コミット `90ebb69`（サブモジュール、2026-02-28）および `5c9fe36`（親リポジトリ、2026-02-28）で
実装された FR-A〜FR-D の内容が MEMORY.md に記録されていない。

#### 実装内容

MEMORY.md に「FR-A〜FR-D 実装内容（2026-02-28 完了）」セクションを追記する。
4項目の内容は以下の通り。

FR-A の内容:
- 対象: `CLAUDE.md` の「角括弧プレースホルダー禁止」説明文を更新
- 変更内容: 禁止されるのは `[#xxx#]` 形式のハッシュ記号付きプレースホルダーのみであることを明確化

FR-B の内容:
- 対象: `definitions.ts` の `performance_test` および `e2e_test` テンプレート
- 変更内容: 誤った「配列アクセス記法禁止」「配列の要素を参照する場合は...」という警告文を削除
- 理由: 実際に禁止されているのは `[#xxx#]` 形式のみであり、配列記法は禁止対象ではなかった

FR-C の内容:
- 対象: `definitions.ts` の `buildSubagentTemplate` 関数内の角括弧プレースホルダー説明
- 変更内容: 説明文を `[#xxx#]` 形式の禁止に限定した内容に修正

FR-D の内容:
- 対象: `definitions.ts` の `generateImprovementsFromError` 関数のエラーメッセージ
- 変更内容: エラーメッセージの説明を `[#xxx#]` 形式のプレースホルダーに限定した表現に修正

実装コミット: サブモジュール `90ebb69`、親リポジトリ `5c9fe36`

#### 検証方法

MEMORY.md を読み込んで FR-A、FR-B、FR-C、FR-D の各記録が存在することを確認する。
コミットハッシュが正確に記録されていることを確認する。

---

### FR-REQ-5: CLAUDE.md 保守ルール行への角括弧プレースホルダー権威情報源の追記

#### 対象ファイル

`C:\ツール\Workflow\CLAUDE.md`

#### 問題の詳細

CLAUDE.md の「禁止パターン（完全リスト）」セクションの末尾に以下の保守ルールが存在する。

```
保守ルール: artifact-validator.ts の FORBIDDEN_PATTERNS が変更された場合、本リストも合わせて更新すること。
```

この記述は FORBIDDEN_PATTERNS についてのみ言及しており、角括弧プレースホルダーパターン
（`bracketPlaceholderRegex`）の権威情報源についての記述がない。
調査によりパターン不整合が繰り返し発生した根本原因の一つが、この情報源の不明確さであると確認された。

#### 実装内容

CLAUDE.md の319行目（既存の保守ルール行）の直後に、以下の文を追記する。

追記内容:
```
同様に、角括弧プレースホルダーの検出パターン（bracketPlaceholderRegex）が変更された場合は、definitions.ts のフォールバック値・テンプレート文字列・CLAUDE.md 本文の説明文を全て artifact-validator.ts の定義に追従して更新すること。
```

この追記により、保守ルール行は以下の2文から構成される。

1. FORBIDDEN_PATTERNS に関する既存の保守ルール文
2. bracketPlaceholderRegex に関する新規追記の保守ルール文

#### 検証方法

CLAUDE.md を読み込んで追記内容が319行目直後に存在することを確認する。
既存の保守ルール文が破損していないことを確認する。

---

### FR-REQ-6: MEMORY.md の task-index.json 記述を実装済み状態に更新

#### 対象ファイル

`C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md` — FIX-1 記述の更新対象

#### 問題の詳細

MEMORY.md の「task-index.json Cache Staleness (FIX-1 Known Bug)」セクションに以下の記述がある。

```
Root fix: MCP server should update task-index.json on every phase transition
```

しかし調査の結果、`workflow-plugin/mcp-server/src/state/manager.ts` の863行目の `setPhase` メソッド内に
`this.updateTaskIndexForSingleTask(taskId, phase, taskState)` の呼び出しが
既に存在しており、FIX-1 は実装済みであることが確認された。
現在の MEMORY.md の記述は未実装の問題として誤解を招く状態となっている。

#### 実装内容

MEMORY.md に対して以下の2点を変更する。

変更点1（セクション見出し）:
- 変更前: `### task-index.json Cache Staleness (FIX-1 Known Bug)`
- 変更後: `### task-index.json Cache Staleness (FIX-1 実装済み)`

変更点2（Root fix 行）:
- 変更前: `- Root fix: MCP server should update task-index.json on every phase transition`
- 変更後: `- Root fix: 実装済み（src/state/manager.ts 863行目の updateTaskIndexForSingleTask 呼び出し、FIX-1 として対応完了）`

Workaround の記述（`Edit task-index.json to update the phase field manually` 等）は
参考情報として残し、削除しない。

#### 検証方法

MEMORY.md を読み込んでセクション見出しと Root fix 行が更新されていることを確認する。
Workaround の記述が削除されずに残っていることを確認する。

---

## 変更対象ファイル

### コードファイル（ビルド・テスト確認が必要）

| 優先度 | ファイルパス | 変更内容 |
|--------|-------------|---------|
| 1 | `C:\ツール\Workflow\workflow-plugin\mcp-server\tests\validation\design-validator.test.ts` | `vi.mock` ブロックに `mkdirSync: vi.fn()` を追加（FR-REQ-1） |
| 2 | `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts` | 34〜35行目フォールバック値を現行パターンに更新（FR-REQ-4） |

### ドキュメントファイル（内容確認のみ）

| 優先度 | ファイルパス | 変更内容 |
|--------|-------------|---------|
| 3 | `C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md` | FR-22 実装記録追記（FR-REQ-2） |
| 4 | `C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md` | FR-A〜FR-D 実装記録追記（FR-REQ-3） |
| 5 | `C:\ツール\Workflow\CLAUDE.md` | 保守ルールへの角括弧プレースホルダー権威情報源の明記（FR-REQ-5） |
| 6 | `C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md` | FIX-1 記述を実装済み状態に更新（FR-REQ-6） |

### 変更不要ファイル（参照のみ）

- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\artifact-validator.ts`（権威情報源として参照のみ）
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\state\manager.ts`（FIX-1 実装確認のみ）

---

## 非機能要件と制約

### テスト継続合格の義務

FR-REQ-1 の修正後、既存テスト（912件以上）が全て合格し続けること。
FR-REQ-4 の修正後も同様に全テストが合格すること。
リグレッションが発生した場合は修正を中断し、原因を特定してから再実施する。

### ビルド正常終了の義務

FR-REQ-4 の修正後、`npm run build` が正常終了すること。
`allowedKeywords` を空配列に変更する際、TypeScript の型検査を通過することを確認する。
変更対象の型定義は `GlobalRules` インターフェース内の `bracketPlaceholderInfo.allowedKeywords: string[]` である。

### ドキュメントの一貫性

FR-REQ-2・FR-REQ-3・FR-REQ-6 の変更は既存 MEMORY.md の記述スタイルと一致させる。
見出しレベル（`###` 形式）、箇条書き形式（`- **項目**: 内容` 形式）を既存項目に揃える。
FR-REQ-5 の追記は既存の保守ルール文と同じ文体・フォーマットを使用する。

### 修正の原子性

FR-REQ-2・FR-REQ-3・FR-REQ-6 は全て MEMORY.md への変更であるため、
1回の編集セッションでまとめて実施することが望ましい。
ただし変更量が多い場合は分割実施も許容する。

### 影響範囲の限定

FR-REQ-1 のモック追加は `vi.mock` ブロック内の1行追加に限定し、他のテストケースを変更しない。
FR-REQ-4 のフォールバック値修正は `bracketPlaceholderRegex` と `bracketPlaceholderInfo` の
2プロパティのみを変更し、他のフォールバックプロパティ（`duplicateLineThreshold` 等）は変更しない。
