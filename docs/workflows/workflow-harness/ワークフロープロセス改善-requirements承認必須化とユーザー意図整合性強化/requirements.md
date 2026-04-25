## サマリー

このドキュメントは、ワークフロープラグインの3つのプロセス改善（FR-1: requirements承認必須化の確認・文書化、FR-2: code_reviewへのユーザー意図整合性チェック追加、FR-3: 並列フェーズ成果物クロスチェック対応）について、機能要件・非機能要件・受け入れ基準を定義する。

- 目的: 1000万ステップのAI駆動開発環境で、ワークフロープロセスの品質と整合性を向上させること
- 主要な決定事項:
  - FR-1は next.ts の既存実装（REQ-B1）で既に満たされており、今回は検証・文書化のみ行う
  - FR-2は definitions.ts の code_review subagentTemplate と artifact-validator.ts の requiredSections を変更する
  - FR-3は spec.md requiredSections への新規セクション追加ではなく、code_review のガイダンス拡張で対応する
- 次フェーズで必要な情報:
  - 変更対象ファイル: `workflow-plugin/mcp-server/src/tools/next.ts`（確認のみ）、`workflow-plugin/mcp-server/src/phases/definitions.ts`（FR-2実装）、`workflow-plugin/mcp-server/src/artifact-validator.ts`（FR-2のrequiredSections追加）
  - 実装後はMCPサーバーの再起動が必須（Node.jsモジュールキャッシュ対策）

---

## 機能要件

### FR-1: requirements承認必須化の検証と文書化

requirements フェーズから次フェーズへの遷移時に、ユーザーによる明示的な承認が必須であることを確認し、その動作を文書化する。

調査の結果、この機能は `next.ts` の 222 行目から 230 行目に REQ-B1 として既に実装されている。具体的には、`currentPhase === 'requirements'` の条件下で `taskState.approvals?.requirements` フィールドを検査し、フラグが設定されていない場合は遷移をブロックしてエラーメッセージを返す。追加実装は不要であり、本フェーズでは既存実装の確認と文書化を行う。

- FR-1-1: `workflow_next` 呼び出し時に requirementsフェーズの承認フラグが検査されること
- FR-1-2: 承認フラグが未設定の場合、遷移がブロックされ「requirements承認が必要です。workflow_approve requirements を実行してください」というエラーが返されること
- FR-1-3: `workflow_approve` に type="requirements" を渡すことで承認フラグが設定されること
- FR-1-4: 承認フラグ設定後は `workflow_next` で正常に次フェーズへ遷移できること

### FR-2: code_review成果物へのユーザー意図整合性チェック追加

code_review フェーズの成果物（code-review.md）に「ユーザー意図との整合性」を確認するセクションを追加し、実装がタスク発案時のユーザー意図を満たしているかをレビュー対象に含める。

- FR-2-1: `artifact-validator.ts` の code-review.md 向け requiredSections 配列に `'## ユーザー意図との整合性'` を追加すること
- FR-2-2: `definitions.ts` の code_review subagentTemplate に `## ユーザー意図との整合性` セクションの記述ガイダンスを追加すること
- FR-2-3: ガイダンスは以下の3観点を必須記述として定義すること:
  - userIntent に記載されたタスク目的の要約（1行）
  - 実装内容と userIntent の合致判定（合致・部分合致・乖離のいずれか）
  - 乖離がある場合はその内容と影響度の説明
- FR-2-4: 追加するセクションは各セクションの実質行数5行以上の要件を満たすこと
- FR-2-5: 変更後に既存の code_review バリデーション（設計-実装整合性・コード品質・セキュリティ・パフォーマンス）の動作が変わらないこと

### FR-3: 並列フェーズ成果物クロスチェック対応

planning フェーズと threat_modeling フェーズが並列実行される際、planning の成果物（spec.md）が threat_modeling の知見を参照・反映した形になるよう、code_review フェーズでのクロスチェックガイダンスを強化する。

調査の結果、spec.md の requiredSections に新規セクションを追加する方式ではなく、code_review サブフェーズの `## 設計-実装整合性` セクションのレビューガイダンスを拡張する方式を採用する。これにより、既存の spec.md バリデーション仕様を変更することなく、クロスチェックの観点を組み込む。

- FR-3-1: `definitions.ts` の code_review subagentTemplate において、`## 設計-実装整合性` セクションのガイダンスに「threat-model.md との整合性確認」観点を追加すること
- FR-3-2: レビュー観点として、spec.md の実装計画が threat-model.md で検出された脅威に対処しているかを確認する手順を記述すること
- FR-3-3: 対処されていない脅威が発見された場合は、implementation フェーズへの差し戻しを推奨する記述をガイダンスに含めること
- FR-3-4: 追加するガイダンスは既存の設計-実装整合性チェックリスト（spec.md・state-machine.mmd・flowchart.mmd・ui-design.md）の後に配置すること

---

## 非機能要件

### NF-1: 後方互換性の維持

既存のワークフロータスクに対して、今回の変更が悪影響を与えないこと。

- NF-1-1: FR-2 の requiredSections 追加により、変更前の code-review.md が新たなバリデーション要件を満たさなくなる場合、既存タスクの code_review フェーズは影響を受けること（これは意図した動作であり、仕様変更として受け入れる）
- NF-1-2: FR-3 のガイダンス追加は subagentTemplate のテキスト変更のみであり、バリデーション規則そのものは変更しないこと

### NF-2: MCPサーバー再起動要件

コアモジュールの変更後はMCPサーバーの再起動が必須となる。

- NF-2-1: `artifact-validator.ts` の変更後は `npm run build` によるトランスパイルを実行すること
- NF-2-2: ビルド完了後に MCPサーバープロセスを再起動すること
- NF-2-3: 再起動後に `workflow_status` で現在のフェーズが正しく返ることを確認すること

### NF-3: 成果物バリデーション要件（実装フェーズ向け）

変更後のテンプレートで生成される code-review.md が、アーティファクトバリデーターの品質要件を満たすこと。

- NF-3-1: code-review.md の全セクション（`## サマリー`・`## 設計-実装整合性`・`## コード品質`・`## セキュリティ`・`## パフォーマンス`・`## ユーザー意図との整合性`）が各5行以上の実質行を含むこと
- NF-3-2: subagentTemplate 内のガイダンスで重複行検出が発生しないよう、各行に固有の情報（FR番号、対象ファイル名など）を含めること
- NF-3-3: セクション密度（実質行数 / 総行数）が30%以上を維持すること

### NF-4: 実装影響範囲の限定

変更の影響範囲を以下の3ファイルに限定する。

- `workflow-plugin/mcp-server/src/tools/next.ts`（確認のみ、変更なし）
- `workflow-plugin/mcp-server/src/phases/definitions.ts`（code_review subagentTemplate のガイダンス追加）
- `workflow-plugin/mcp-server/src/artifact-validator.ts`（code-review.md の requiredSections への追加）

---

## 受け入れ基準

### FR-1 受け入れ基準

- `workflow_approve` を実行せずに requirements フェーズで `workflow_next` を呼び出した場合、エラーが返り遷移がブロックされること
- `workflow_approve requirements` を実行した後に `workflow_next` を呼び出すと、次フェーズ（parallel_analysis）へ遷移できること
- `next.ts` の該当コード（approvals.requirements チェック）が存在し、CLAUDE.md の承認必須化ルールと整合していること

### FR-2 受け入れ基準

- `artifact-validator.ts` の code-review.md 向け requiredSections に `'## ユーザー意図との整合性'` が追加されていること
- `definitions.ts` の code_review subagentTemplate に `## ユーザー意図との整合性` の記述ガイダンスが追加されていること
- ガイダンスに「userIntent の要約」「合致判定」「乖離がある場合の説明」の3観点が明記されていること
- 新しいテンプレートで生成された code-review.md が成果物バリデーターの全チェックをパスすること

### FR-3 受け入れ基準

- `definitions.ts` の code_review subagentTemplate の `## 設計-実装整合性` セクションガイダンスに、threat-model.md との整合性確認項目が追加されていること
- 追加されたガイダンスに「未対処の脅威が発見された場合は implementation フェーズへの差し戻しを推奨する」旨の記述が含まれていること
- spec.md の requiredSections 配列は変更されていないこと（後方互換性の維持）

### 全体の受け入れ基準

- 変更対象3ファイルのビルドが正常に完了すること（`npm run build` でエラーなし）
- MCPサーバー再起動後に `workflow_status` が正常なレスポンスを返すこと
- 既存の design_review・test_design・security_scan フェーズのバリデーション動作が変わらないこと
