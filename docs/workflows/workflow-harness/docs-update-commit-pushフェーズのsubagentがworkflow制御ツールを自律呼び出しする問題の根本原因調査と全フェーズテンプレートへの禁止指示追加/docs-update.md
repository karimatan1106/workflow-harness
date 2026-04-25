# docs_updateフェーズ 成果物

## サマリー

- 目的: FR-19の実装内容（全25フェーズのsubagentTemplateへのワークフロー制御ツール禁止セクション追加）をプロジェクト永続ドキュメントに反映する
- 評価スコープ: `docs/spec/features/subagent-rules-matrix.md` および `docs/spec/features/workflow-mcp-server.md` の2ファイルを対象とした
- 主要な決定事項: 今回の変更はTypeScriptテンプレート文字列への追記のみであり、外部向けAPIや画面への影響がないため、機能仕様書の新規作成は不要と判断した
- 検証状況: 更新対象ファイルの確認と更新を実施済み
- 次フェーズで必要な情報: commitフェーズでは `workflow-plugin/mcp-server/src/phases/definitions.ts`・`docs/spec/features/subagent-rules-matrix.md`・`docs/spec/features/workflow-mcp-server.md` の3ファイルをステージング対象とする

## 更新対象ドキュメントの確認

永続ドキュメントの存在確認を実施した結果、以下のファイルが更新対象として特定された。

`docs/spec/features/subagent-rules-matrix.md` は全フェーズのルール伝達状況を体系的にまとめた仕様書であり、Orchestrator行動ルールのセクションがFR-19の変更内容を反映する必要があった。
`docs/spec/features/workflow-mcp-server.md` はMCPサーバーの機能仕様と変更履歴を記録するファイルであり、FR-19の実装記録を変更履歴セクションへ追加する必要があった。
`docs/architecture/modules/` 配下にはworkflow-pluginのsubagentTemplateに関する独立したアーキテクチャ文書は存在しなかった。

## 実施した更新内容

### subagent-rules-matrix.md への追記

「5.2 ルール別伝達状況マトリクス」内の「Orchestrator行動ルール」テーブルの直後に、新規セクション「subagentワークフロー制御ツール禁止ルール（FR-19実装）」を追加した。
追加した内容は5行のルール行（workflow_next・workflow_approve・workflow_complete_sub・workflow_start・workflow_reset の各禁止ルール）と、FR-19実装の背景説明および伝達チャネルの説明文である。
各ルールの「PhaseGuide」欄を「全25フェーズのsubagentTemplateに禁止セクション追記（FR-19）」と記載し、状態を「subagentTemplate経由で伝達済み」とした。
この更新により、FR-4/FR-5で先行対応したtesting/regression_testフェーズの記録と整合性が取れ、FR-19による全フェーズ対応完了が文書化された。

### workflow-mcp-server.md への変更履歴追記

変更履歴セクションにFR-19の実装記録を新規追加した。
記録の内容は変更の目的・問題の背景・実装内容・対象フェーズ数・変更の性質・効果の6項目で構成した。
特に「変更の性質」の項目で「TypeScriptのテンプレート文字列への純粋な追記のみ」と明記し、APIインターフェース・バリデーションルール・フェーズ遷移ロジックへの影響がないことを記録した。
既存の変更履歴（FR-5等）との時系列順を維持するため、FR-5の記録より前に挿入した。

## 更新不要と判断したドキュメント

以下の理由により、他の永続ドキュメントへの更新は不要と判断した。

`docs/spec/features/` 配下のその他の仕様書（artifact-validator.md・design-validator.md等）は、今回の変更（definitions.tsのテンプレート文字列追記）とは直接関係しないため更新対象外とした。
`docs/architecture/` 配下の2ファイル（converter-service.md・workflow-dashboard.md）はworkflow-pluginのsubagentTemplate設計を扱う文書ではないため更新不要と判断した。
CHANGELOG.mdおよびREADME.mdはプロジェクトルートに存在するが、今回の変更は内部実装のテンプレート追記であり外部向けの変更ではないため更新を省略した。
