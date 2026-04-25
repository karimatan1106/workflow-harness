## サマリー

本テスト設計書は、ワークフロープロセス改善タスク（FR-1: requirements承認必須化検証、FR-2: code_reviewへのユーザー意図整合性チェック追加、FR-3: 並列フェーズクロスチェックガイダンス追加）の実装を検証するためのテスト設計を定義する。

- 目的: 2つのファイル変更（artifact-validator.ts と definitions.ts）が仕様通りに実施され、既存の912テストが引き続き全通過することを確認する
- 主要な決定事項: 新規テストファイルは作成せず、既存の definitions.test.ts に新テストケースを追加する方針とする。FR-1は変更不要のため確認テストのみ。FR-2・FR-3は定数の文字列チェックで検証する。
- 次フェーズで必要な情報: テストは `workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts` に追記する。また `workflow-plugin/mcp-server/src/validation/__tests__/` 配下にFR-2のバリデーター変更を検証する新テストケースを追加する想定。

---

## テスト方針

### 変更の性質と対応するテスト戦略

今回の変更はTypeScriptの定数・設定値の変更（文字列配列へのエントリ追加およびテンプレート文字列の拡張）であり、アルゴリズムやロジックの変更ではない。したがって以下の戦略を採用する。

まず変更後のファイル内容に対して、期待する文字列が含まれているかを `includes` または `toContain` で検証する。これはプロジェクトの既存テストスタイル（definitions.test.ts が `toContain` や `toBe` を多用する）に合致する。

次に、既存テストスイート全体を `npm test` で実行し、全912テストが引き続き通過することを確認する。これがリグレッション防止の主要な安全網となる。

### テストファイルの配置方針

既存のテストファイル `workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts` に新テストケースを追記することを基本方針とする。このファイルはすでに definitions.ts から各種エクスポートをインポートしており、`PHASE_GUIDES` や `resolvePhaseGuide` のテストパターンが確立されている。

バリデーター変更（FR-2-1）については `workflow-plugin/mcp-server/src/validation/__tests__/` ディレクトリに既存のバリデーターテストファイル群が存在するため、そのディレクトリの慣習に従って新規テストファイルを作成するか、既存ファイルへの追記を検討する。

### テスト実行コマンド

```bash
cd workflow-plugin/mcp-server && npm test
```

テスト結果は `workflow_record_test_result` ツールで記録し、全テストが通過したことをresultに記録する。

---

## テストケース

### TC-FR2-1: artifact-validator.ts のrequiredSections検証

**対象ファイル:** `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`

**検証内容:** `code-review.md` エントリの `requiredSections` 配列に `'ユーザー意図との整合性'` が含まれていること。

**確認方法:** artifact-validator.ts をソースコードレベルで読み込み、またはビルド後の dist を import して、ARTIFACT_REQUIREMENTS という定数の `'code-review.md'` キーの `requiredSections` 配列に期待値が含まれるかを `toContain` で検証する。

**期待値（変更後の状態）:**

```typescript
// 期待するrequiredSections配列の内容
expect(requirements.requiredSections).toContain('設計-実装整合性');
expect(requirements.requiredSections).toContain('コード品質');
expect(requirements.requiredSections).toContain('セキュリティ');
expect(requirements.requiredSections).toContain('パフォーマンス');
expect(requirements.requiredSections).toContain('ユーザー意図との整合性');
// 配列長は5要素になる
expect(requirements.requiredSections.length).toBe(5);
```

**後方互換性の確認:** 既存4要素（設計-実装整合性・コード品質・セキュリティ・パフォーマンス）が引き続き存在することも同時に確認する。

### TC-FR2-2: definitions.ts のcode_review requiredSections検証

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`

**検証内容:** `PHASE_GUIDES.parallel_quality.subPhases.code_review.requiredSections` に `'## ユーザー意図との整合性'` が含まれていること。

**確認方法:** definitions.ts の `resolvePhaseGuide` 関数または `PHASE_GUIDES` 定数を直接 import して、code_review フェーズの requiredSections を検証する。

**期待値（変更後の状態）:**

```typescript
// code_reviewフェーズのrequiredSectionsに新セクションが含まれること
expect(codeReview.requiredSections).toContain('## ユーザー意図との整合性');
// 既存の5セクションが維持されていること
expect(codeReview.requiredSections).toContain('## サマリー');
expect(codeReview.requiredSections).toContain('## 設計-実装整合性');
expect(codeReview.requiredSections).toContain('## コード品質');
expect(codeReview.requiredSections).toContain('## セキュリティ');
expect(codeReview.requiredSections).toContain('## パフォーマンス');
// 配列長は6要素になる
expect(codeReview.requiredSections.length).toBe(6);
```

### TC-FR2-3: definitions.ts のsubagentTemplate 5観点ガイダンス検証

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`

**検証内容:** `code_review.subagentTemplate` に「ユーザー意図との整合性」セクション用の5観点ガイダンスが含まれていること。

**確認方法:** `PHASE_GUIDES.parallel_quality.subPhases.code_review.subagentTemplate` 文字列に対して `includes` または `toContain` で各観点キーワードが存在するかを検証する。

**期待値（変更後の状態）:**

```typescript
// subagentTemplateに5観点ガイダンスが含まれること
expect(template).toContain('userIntent');
expect(template).toContain('合致判定');
expect(template).toContain('乖離');
expect(template).toContain('追加実装');
expect(template).toContain('総合判定');
```

以下の具体的なキーワードが含まれていることで、ガイダンスとして適切な内容が提供されていることを確認できる。「userIntentに記載されたタスク目的の要約」「合致・部分合致・乖離」「追加実装の妥当性」「総合判定」の各表現が存在することを個別に検証する。

### TC-FR3-1: definitions.ts のsubagentTemplate クロスチェックガイダンス検証

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`

**検証内容:** `code_review.subagentTemplate` に threat-model.md との整合性確認ガイダンスが含まれていること。

**確認方法:** subagentTemplate 文字列に `includes` または `toContain` でthreat-model.md関連のキーワードが存在するかを検証する。

**期待値（変更後の状態）:**

```typescript
// subagentTemplateにthreat-model.mdクロスチェックガイダンスが含まれること
expect(template).toContain('threat-model.md');
// 脅威モデルとの整合性確認を指示する文言が存在すること
expect(template).toContain('脅威');
```

クロスチェックガイダンスは「設計-実装整合性セクションの行数ガイダンス」内の観点リストに追加される設計であるため、既存ガイダンスとの位置関係も確認する。

### TC-FR1: next.ts のrequirements承認チェック既存実装確認

**対象ファイル:** `workflow-plugin/mcp-server/src/tools/next.ts`

**検証内容:** requirements フェーズから parallel_analysis への遷移時に、`taskState.approvals.requirements` フラグが検査されていること。既存テスト（next.test.ts, approval-gates.test.ts）がこの動作を検証済みであることを確認する。

**確認方法:** 既存テストスイートの実行結果でこれが通過していることを確認する。新規テストは不要。requirements承認なしで workflow_next を呼び出した場合にエラーが返ることは、approve-quality-gate.test.ts や approval-gates.test.ts が既にカバーしている。

**期待値:** 既存テスト群が変更後も全通過すること。

### TC-REGRESSION: 全テストスイートリグレッション確認

**対象:** `workflow-plugin/mcp-server/` 配下の全テストファイル（75ファイル、912テスト）

**検証内容:** 今回の変更（FR-2の2ファイル変更）が既存テストに悪影響を与えていないことを確認する。

**確認方法:** 以下のコマンドを実行し、全テストが通過することを確認する。

```bash
cd workflow-plugin/mcp-server && npm test
```

**期待値:** テスト総数912以上、失敗数0。ベースラインと比較して新たな失敗が発生していないこと。

---

## テスト実装の追加先

### 新規テストケースの追加先ファイル

FR-2・FR-3のテストケースは以下のファイルに追加する。

**ファイル1: definitions.test.ts への追記**

パス: `workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts`

追加する describe ブロック:

```typescript
describe('code_review requiredSections検証（FR-2対応）', () => {
  it('ユーザー意図との整合性が含まれること', () => {
    // PHASE_GUIDESからcode_reviewのrequiredSectionsを取得して検証
  });
  it('既存5セクションが引き続き含まれること（後方互換）', () => {
    // サマリー・設計-実装整合性・コード品質・セキュリティ・パフォーマンスの存在確認
  });
  it('subagentTemplateに5観点ガイダンスが含まれること（FR-2-3）', () => {
    // userIntent要約・合致判定・乖離説明・追加実装・総合判定の各キーワード確認
  });
  it('subagentTemplateにthreat-model.mdクロスチェックガイダンスが含まれること（FR-3）', () => {
    // threat-model.md文字列と脅威キーワードの存在確認
  });
});
```

**ファイル2: 新規バリデーターテストファイルの作成**

パス: `workflow-plugin/mcp-server/src/validation/__tests__/code-review-required-sections.test.ts`

このファイルでは artifact-validator.ts の ARTIFACT_REQUIREMENTS 定数を import し、code-review.md エントリの requiredSections に `'ユーザー意図との整合性'` が含まれることを検証する。

---

## 検証観点マトリクス

各FRと対応するテストケースの関係を以下に示す。

| FR番号 | 変更内容 | テストケースID | 検証方法 |
|--------|---------|--------------|---------|
| FR-1 | next.ts 確認のみ（変更なし） | TC-FR1 | 既存テスト通過確認 |
| FR-2-1 | artifact-validator.ts requiredSections追加 | TC-FR2-1 | 配列内容の toContain |
| FR-2-2 | definitions.ts requiredSections追加 | TC-FR2-2 | 配列内容の toContain |
| FR-2-3 | definitions.ts subagentTemplate拡張（5観点） | TC-FR2-3 | 文字列の toContain |
| FR-3-1 | definitions.ts subagentTemplate拡張（脅威モデル） | TC-FR3-1 | 文字列の toContain |
| 全体 | 既存テストへの悪影響なし | TC-REGRESSION | npm test 全通過 |

---

## 実装フェーズへの申し送り事項

test_impl フェーズでは以下に注意して実装すること。

テストファイルを新規作成する場合、ファイル先頭に `@spec` コメントで本仕様書へのリンクを記載する。プロジェクトの慣習に従い `describe` / `it` / `expect` の形式で記述し、vitest の `import { describe, it, expect } from 'vitest'` を使用する。

definitions.ts から `PHASE_GUIDES` を import する際は ESM 形式を使用する。既存の definitions.test.ts が `from '../definitions.js'` と `.js` 拡張子付きで import していることに留意する。

FR-2-1 のバリデーター定数テストでは、artifact-validator.ts から `ARTIFACT_REQUIREMENTS` が export されているかどうかを事前に確認する。export されていない場合は、validateArtifact 関数を経由して code-review.md の requiredSections 不足を検出することで間接的に検証する方法も検討する。

リグレッションテストの実行は npm test であり、テスト結果は workflow_record_test_result で記録すること。テスト数の増減が発生する場合は、増分が今回追加した新テストケースであることを確認し、それ以外の変動がないことを明記する。
