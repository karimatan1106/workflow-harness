## サマリー

本仕様書は、ワークフロープラグインの3つのプロセス改善（FR-1: requirements承認必須化の検証・文書化、FR-2: code_reviewへのユーザー意図整合性チェック追加、FR-3: 並列フェーズクロスチェックガイダンス追加）の実装仕様を定義する。

- 目的: code_review フェーズにおけるレビュー品質を向上させ、ユーザー意図との整合性および脅威モデルとの整合性を確認可能にすること
- 主要な決定事項:
  - FR-1 は `next.ts` の既存実装（REQ-B1, lines 222-229）で既に要件を満たしており、変更は不要。文書化のみ行う。
  - FR-2 は `artifact-validator.ts` の requiredSections 追加と `definitions.ts` のテンプレート拡張の2ファイルを変更する。
  - FR-3 は `definitions.ts` の code_review subagentTemplate のみを変更し、spec.md の requiredSections には手を加えない。
- 次フェーズで必要な情報: 変更対象ファイルは2つ（definitions.ts と artifact-validator.ts）。変更後は必ず `npm run build` を実行し MCPサーバーを再起動すること。

---

## 概要

### 背景

ワークフロープロセスにおいて、code_review フェーズの成果物（code-review.md）はコード品質・セキュリティ・パフォーマンスの観点のみを含んでいた。ユーザーが発案したタスクの意図と実際の実装内容が合致しているかの確認が不足していた。また、parallel_analysis で並列実行される threat_modeling の知見が code_review で参照されていないため、セキュリティ観点が分断されていた。

### 設計方針

3つのFRを以下の方針で設計する。FR-1は既存実装の確認と文書化にとどめ、実装コストを最小化する。FR-2はバリデーション要件とテンプレートの両方を変更し、整合性を保つ。FR-3はテンプレート変更のみとし、バリデーション要件の変更による既存タスクへの影響を避ける。

### 影響範囲

変更対象は以下の2ファイルに限定する（いずれもMCPサーバーのコアモジュールであり、変更後は `npm run build` とサーバー再起動が必要）:
- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`（FR-2のrequiredSections追加）
- `workflow-plugin/mcp-server/src/phases/definitions.ts`（FR-2のテンプレートガイダンス追加・FR-3のクロスチェックガイダンス追加）

---

## 実装計画

### FR-1: requirements承認必須化の文書化（変更なし）

`next.ts` の lines 222-229 に REQ-B1 として実装済みの動作を確認する。

実装内容の確認:
- `currentPhase === 'requirements'` の条件下で `taskState.approvals?.requirements` フィールドを検査している
- フラグが設定されていない場合、`'requirements承認が必要です。workflow_approve requirements を実行してください'` を返して遷移をブロックしている
- `workflow_approve` ツールに `type="requirements"` を渡すことで `taskState.approvals.requirements` が `true` に設定される
- フラグ設定後は `workflow_next` で parallel_analysis フェーズへ正常に遷移できる

この実装は requirements.md に定義された FR-1-1 から FR-1-4 の全要件を満たしており、追加実装は不要である。

### FR-2: code_reviewへのユーザー意図整合性チェック追加

#### 2-1: artifact-validator.ts の変更

`workflow-plugin/mcp-server/src/validation/artifact-validator.ts` の 246-249 行目の `'code-review.md'` エントリを変更する。

変更前:
```typescript
'code-review.md': {
  minLines: 30,
  requiredSections: ['設計-実装整合性', 'コード品質', 'セキュリティ', 'パフォーマンス'],
},
```

変更後:
```typescript
'code-review.md': {
  minLines: 30,
  requiredSections: ['設計-実装整合性', 'コード品質', 'セキュリティ', 'パフォーマンス', 'ユーザー意図との整合性'],
},
```

この変更により、code-review.md に `## ユーザー意図との整合性` セクションが存在しない場合にバリデーションエラーが発生するようになる。

#### 2-2: definitions.ts の変更（code_review テンプレート拡張）

`workflow-plugin/mcp-server/src/phases/definitions.ts` の code_review サブフェーズ定義を変更する。

変更対象: `code_review.requiredSections` 配列に `'## ユーザー意図との整合性'` を追加する。

変更前:
```typescript
requiredSections: ['## サマリー', '## 設計-実装整合性', '## コード品質', '## セキュリティ', '## パフォーマンス'],
```

変更後:
```typescript
requiredSections: ['## サマリー', '## 設計-実装整合性', '## コード品質', '## セキュリティ', '## パフォーマンス', '## ユーザー意図との整合性'],
```

変更対象: `code_review.subagentTemplate` の末尾に `## ユーザー意図との整合性` セクションのガイダンスを追加する。

追加するガイダンス文字列（既存テンプレート末尾の `## 出力\n${docsDir}/code-review.md` の直前に挿入）:

```
## ユーザー意図との整合性セクションの行数ガイダンス
「## ユーザー意図との整合性」セクションには必ず5行以上の実質行を記述すること。以下の3観点を各1行以上で記述すること。
- userIntentに記載されたタスク目的の要約（タスク名および意図の要旨を1行で記述する）
- 実装内容とuserIntentの合致判定（合致・部分合致・乖離のいずれかを明示し、判定理由を記述する）
- 乖離がある場合の詳細説明（乖離が存在しない場合は「乖離なし、全機能がuserIntentを実現している」と明記する）
- 追加実装の妥当性（userIntentの範囲外に実装された機能がある場合はその影響度を記述する）
- 総合判定（ユーザー意図の実現度をパーセンテージまたは定性評価で記述する）
```

### FR-3: 並列フェーズクロスチェックガイダンス追加

`workflow-plugin/mcp-server/src/phases/definitions.ts` の code_review サブフェーズの `subagentTemplate` を変更する。

変更内容: 既存の `## 設計-実装整合性セクションの行数ガイダンス` の末尾（5つの観点の後）に、threat-model.md との整合性確認ガイダンスを追加する。

追加するガイダンス（既存の5観点リストの後に配置）:
```
- threat-model.mdとの整合性確認（threat_modelingフェーズで検出された脅威が実装で対処されているかを確認した結果を記述する。未対処の脅威が発見された場合はimplementationフェーズへの差し戻しを推奨する）
```

この追加により、コードレビュアーである subagent が threat_modeling の成果物と実装の整合性を確認する手順が明示される。spec.md の requiredSections は変更しないため、既存タスクのバリデーション動作に影響を与えない。

---

## 変更対象ファイル

変更が必要なファイルは以下の2ファイルである。

| ファイルパス | 変更内容 | FR |
|-------------|---------|-----|
| `workflow-plugin/mcp-server/src/validation/artifact-validator.ts` | code-review.md の requiredSections に `'ユーザー意図との整合性'` を追加 | FR-2 |
| `workflow-plugin/mcp-server/src/phases/definitions.ts` | code_review の requiredSections に `'## ユーザー意図との整合性'` を追加。subagentTemplate にユーザー意図整合性ガイダンスとクロスチェックガイダンスを追加 | FR-2, FR-3 |

変更しないファイル:
- `workflow-plugin/mcp-server/src/tools/next.ts`: FR-1 は既存実装で要件を満たしており変更不要

### ビルドおよび再起動手順

実装後は以下の手順でMCPサーバーを再起動すること。
1. `cd workflow-plugin/mcp-server && npm run build` でトランスパイルを実行する
2. `dist/` ディレクトリの更新日時を確認し、ビルドが完了したことを確認する
3. MCPサーバープロセスを再起動し、`workflow_status` で現在のフェーズが正常に返ることを確認する
4. 既存タスクに対して `workflow_next` が正常に動作することを確認する

### 受け入れ確認ポイント

FR-2 の実装後確認: `artifact-validator.ts` の code-review.md エントリに `'ユーザー意図との整合性'` が含まれていること。`definitions.ts` の code_review requiredSections に `'## ユーザー意図との整合性'` が含まれていること。subagentTemplate に userIntent の要約・合致判定・乖離説明の3観点ガイダンスが記述されていること。

FR-3 の実装後確認: `definitions.ts` の code_review subagentTemplate の設計-実装整合性ガイダンスに threat-model.md との確認項目が追加されていること。spec.md の requiredSections が変更されていないこと（後方互換性の維持）。
