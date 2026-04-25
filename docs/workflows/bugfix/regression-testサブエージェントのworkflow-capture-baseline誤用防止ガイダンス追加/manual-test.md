# 手動テスト結果: regression_test サブエージェントの workflow_capture_baseline 誤用防止ガイダンス追加

## サマリー

- 目的: FR-13（禁止ツールリストへの workflow_capture_baseline 追記）と FR-14（ベースライン前提条件セクション追加）が definitions.ts の regression_test.subagentTemplate に正しく実装されていることを、ファイルの直接読み込みにより確認する手動テストを実施した
- 評価スコープ: `workflow-plugin/mcp-server/src/phases/definitions.ts` の regression_test エントリの subagentTemplate フィールド、testing フェーズの subagentTemplate フィールド（変更対象外であることの確認）、および `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts` の TC-FIX テストケース群
- 主要な決定事項: 全5シナリオが合格判定となり、FR-13・FR-14 の実装内容が spec.md の要件と完全に一致していることを確認した
- 検証状況: Read ツールおよび Grep ツールで definitions.ts の内容を直接確認し、5件のテストシナリオを実施して全て合格した
- 次フェーズで必要な情報: npm run build によるトランスパイルと MCP サーバー再起動の完了確認が security_scan フェーズ以降の前提条件となる

## テストシナリオ

### シナリオ1: FR-13 の禁止対象リストへの workflow_capture_baseline 追記確認

シナリオ1のシナリオID: TC-MANUAL-1（FR-13 禁止リスト追記の確認）

シナリオ1のテスト目的: definitions.ts の regression_test.subagentTemplate にある「★ワークフロー制御ツール禁止★」セクションの禁止対象リストに「workflow_capture_baseline」が追記されているかを確認する。

シナリオ1の前提条件として、FR-13 の実装が implementation フェーズで完了していること、および definitions.ts がビルド可能な状態であることが必要である。

シナリオ1の操作手順として、Grep ツールで `workflow_capture_baseline` を definitions.ts 内で検索し、regression_test の subagentTemplate に該当文字列が出現することを確認した。次に Read ツールで 880-888 行の内容を読み込み、禁止対象行の文字列が「workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset, workflow_capture_baseline」を含む形式になっていることを目視確認した。

シナリオ1の期待結果として、禁止対象行に「workflow_capture_baseline」が含まれており、禁止根拠の説明文（testingフェーズでのみ MCP サーバーが受け付けるという趣旨）も禁止対象行の直後に記述されていること。

### シナリオ2: FR-13 の禁止根拠説明文の存在確認

シナリオ2のシナリオID: TC-MANUAL-2（FR-13 禁止根拠説明文の確認）

シナリオ2のテスト目的: 禁止対象行の直後に「testingフェーズでのみMCPサーバーが受け付ける設計であり、regression_testフェーズからの呼び出しはアーキテクチャ上エラーとなる」という趣旨の説明文が挿入されているかを確認する。

シナリオ2の前提条件として、シナリオ1が合格していること、および Read ツールで当該行範囲を読み込める状態であることが必要である。

シナリオ2の操作手順として、Read ツールで definitions.ts の 887 行の subagentTemplate 文字列を確認し、「testingフェーズでのみMCPサーバーが受け付ける設計であり、regression_testフェーズからの呼び出しはアーキテクチャ上エラーとなる」という文字列が禁止対象リストの直後に出現することを確認した。

シナリオ2の期待結果として、禁止理由の説明文が存在し「testingフェーズでのみ」または「アーキテクチャ上エラー」のいずれかの文言が含まれていること。

### シナリオ3: FR-14 のベースライン前提条件セクション存在確認

シナリオ3のシナリオID: TC-MANUAL-3（FR-14 新規セクション挿入確認）

シナリオ3のテスト目的: regression_test.subagentTemplate 内に「ベースライン前提条件」という見出しを持つセクションが spec.md で指定された位置（sessionToken セクション直後・ワークフロー制御禁止セクション直前）に挿入されているかを確認する。

シナリオ3の前提条件として、FR-14 の実装が implementation フェーズで完了していること、および Grep ツールが文字列検索に利用可能であることが必要である。

シナリオ3の操作手順として、Grep ツールで「ベースライン前提条件」を definitions.ts 内で検索し、regression_test の subagentTemplate 行（887 行）に該当文字列が出現することを確認した。また Read ツールで文字列の前後を確認し、sessionToken セクションと「★ワークフロー制御ツール禁止★」セクションの間に位置していることを目視確認した。

シナリオ3の期待結果として、「ベースライン前提条件」セクションが存在し、spec.md が要求する4点の記述（testing フェーズ記録済み前提・再記録不要・workflow_get_test_info 案内・workflow_back 手順）が全て含まれていること。

### シナリオ4: FR-14 の必須記述要素の確認

シナリオ4のシナリオID: TC-MANUAL-4（FR-14 必須記述要素の個別確認）

シナリオ4のテスト目的: spec.md が FR-14 として要求する4点の記述要素がベースライン前提条件セクション内に全て存在することを個別に確認する。

シナリオ4の前提条件として、シナリオ3が合格していること、および Read ツールで subagentTemplate 文字列全体を参照できることが必要である。

シナリオ4の操作手順として、Read ツールで regression_test の subagentTemplate 文字列（887 行）を読み込み、以下の4要素を個別に目視確認した。第1要素として「testingフェーズでworkflow_capture_baselineを呼び出して記録済みであることが前提条件」、第2要素として「再度呼び出す必要はなく、呼び出してもMCPサーバーがアーキテクチャ上エラーを返す」、第3要素として「workflow_get_test_infoを使用すること」、第4要素として「Orchestratorはworkflow_backを使用してtestingフェーズへ差し戻す必要がある」の各文字列が存在することを確認した。

シナリオ4の期待結果として、4要素が全て subagentTemplate 内に存在し、spec.md の要件と一致していること。

### シナリオ5: testing フェーズの subagentTemplate が変更されていないことの確認

シナリオ5のシナリオID: TC-MANUAL-5（他フェーズへの影響なし確認）

シナリオ5のテスト目的: testing フェーズの subagentTemplate が今回の変更対象外であり、regression_test フェーズと独立して管理されていることを確認する。具体的には、testing フェーズの「★ワークフロー制御ツール禁止★」セクションの禁止対象リストに workflow_capture_baseline が含まれていないことを確認する（testing フェーズでは workflow_capture_baseline は許可されるべき操作であるため）。

シナリオ5の前提条件として、definitions.ts の testing エントリと regression_test エントリが別々のオブジェクトとして管理されていること。

シナリオ5の操作手順として、Read ツールで 878 行の testing.subagentTemplate 文字列を読み込み、「★ワークフロー制御ツール禁止★」セクションの禁止対象行が「workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset」のみであり、workflow_capture_baseline が含まれていないことを確認した。また testing フェーズでは workflow_capture_baseline の呼び出しが「## workflow_capture_baseline 呼び出し（ベースライン記録）」セクションで積極的に推奨されている記述があることも確認した。

シナリオ5の期待結果として、testing フェーズの禁止対象リストに workflow_capture_baseline が含まれておらず、むしろベースライン記録を促す専用セクションが存在すること。

## テスト結果

### TC-MANUAL-1（FR-13 禁止リスト追記）の実施結果

TC-MANUAL-1 の実施日時: 2026-02-24、対象ファイルは definitions.ts の 887 行目の regression_test.subagentTemplate フィールド

Read ツールで 880-888 行を読み込み、regression_test.subagentTemplate 文字列内の「★ワークフロー制御ツール禁止★」セクションを確認した。禁止対象行の文字列として「禁止対象: workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset, workflow_capture_baseline」が存在することを確認した。

TC-MANUAL-1 のシナリオ合否判定: 合格、禁止対象リスト末尾に workflow_capture_baseline が追記されていることを目視で確認できた。

### TC-MANUAL-2（FR-13 禁止根拠説明文）の実施結果

TC-MANUAL-2 の実施日時: 2026-02-24、対象ファイルは definitions.ts の 887 行目の regression_test.subagentTemplate フィールド（TC-MANUAL-1 と同一行）

禁止対象行の直後の文字列として「workflow_capture_baselineはtestingフェーズでのみMCPサーバーが受け付ける設計であり、regression_testフェーズからの呼び出しはアーキテクチャ上エラーとなる。」という説明文が存在することを Read ツールで確認した。この文字列は「testingフェーズでのみ」と「アーキテクチャ上エラー」の両方を含んでおり、TC-FIX-1b テストケースの論理和条件を満たす。

TC-MANUAL-2 のシナリオ合否判定: 合格、禁止根拠説明文が仕様通りの文言で挿入されていることを確認した。

### TC-MANUAL-3（FR-14 新規セクション挿入位置）の実施結果

TC-MANUAL-3 の実施日時: 2026-02-24、対象ファイルは definitions.ts の 887 行目の regression_test.subagentTemplate フィールド

Grep ツールで「ベースライン前提条件」を検索した結果、887 行（regression_test の subagentTemplate）に該当文字列が出現することを確認した。Read ツールで文字列の前後を確認し、「## sessionTokenの取得方法と使用制限」セクションの直後かつ「## ★ワークフロー制御ツール禁止★」セクションの直前に「## ベースライン前提条件」セクションが配置されていることを確認した。この配置は spec.md の FR-14 が指定する挿入位置と一致している。

TC-MANUAL-3 のシナリオ合否判定: 合格、ベースライン前提条件セクションが spec.md で指定された挿入位置に正確に配置されていることを確認した。

### TC-MANUAL-4（FR-14 必須記述要素）の実施結果

TC-MANUAL-4 の実施日時: 2026-02-24、対象ファイルは definitions.ts の 887 行目の regression_test.subagentTemplate フィールド

4つの必須要素を個別に確認した結果は以下の通りである。第1要素「testingフェーズでworkflow_capture_baselineを呼び出して記録済みであることが前提条件」: 「ベースラインはtestingフェーズで workflow_capture_baseline を呼び出して記録済みであることが前提条件である。」という文字列が存在することを確認した。第2要素「再記録不要・アーキテクチャ上エラー」: 「regression_testフェーズでは workflow_capture_baseline を再度呼び出す必要はなく、呼び出してもMCPサーバーがアーキテクチャ上エラーを返す。」という文字列が存在することを確認した。第3要素「workflow_get_test_info案内」: Grep ツールで「workflow_get_test_info」が 887 行に出現することを確認し、Read ツールで「workflow_get_test_info を使用すること。このツールはregression_testフェーズでも使用可能である。」という文字列が存在することを確認した。第4要素「workflow_back手順」: 「Orchestratorはworkflow_backを使用してtestingフェーズへ差し戻す必要がある。」という文字列が存在することを確認した。

TC-MANUAL-4 のシナリオ合否判定: 合格、spec.md が要求する4点の必須記述要素が全てベースライン前提条件セクション内に存在することを確認した。

### TC-MANUAL-5（他フェーズへの影響なし）の実施結果

TC-MANUAL-5 の実施日時: 2026-02-24、対象ファイルは definitions.ts の 878 行目の testing.subagentTemplate フィールドおよび 887 行目の regression_test.subagentTemplate フィールド

Read ツールで 878 行の testing.subagentTemplate 文字列を確認した結果、「★ワークフロー制御ツール禁止★」セクションの禁止対象行が「禁止対象: workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset」のみであり、workflow_capture_baseline が含まれていないことを確認した。さらに testing フェーズの subagentTemplate には「## workflow_capture_baseline 呼び出し（ベースライン記録）」という専用セクションが存在し、testing フェーズでは workflow_capture_baseline の呼び出しが必須であることが明示されていた。

TC-MANUAL-5 のシナリオ合否判定: 合格、testing フェーズの subagentTemplate が変更されておらず、testing フェーズのベースライン記録機能が引き続き正常に機能する状態であることを確認した。

## 総合評価

全5シナリオを実施した結果の合否サマリーとして、実施件数5件・合格件数5件・不合格件数0件であり、FR-13 および FR-14 の実装が仕様通りであることが確認された。

検出された問題の有無として、今回の手動テストで検出された不具合は存在しない。変更内容はテンプレート文字列への追記のみであり、既存機能への影響がないことも TC-MANUAL-5 で確認できた。

未実施シナリオの有無として、計画した5件のシナリオを全て実施完了した。実施できなかったシナリオは存在せず、全シナリオ実施済みである。

次フェーズへの引き継ぎ事項として、npm run build によるトランスパイルと MCP サーバー再起動の完了確認が security_scan フェーズ以降の前提条件となる。また、テスト実行フェーズで TC-FIX-1・TC-FIX-1b・TC-FIX-2・TC-FIX-2b・TC-FIX-2c の新規テストケースを含む全テストスイートの合格確認が必要である。

全体的な品質評価として、全5シナリオが合格判定であり、FR-13・FR-14 の実装が spec.md の受入条件を完全に満たしていることが確認されたため、このフェーズの品質評価は「合格」と判定する。
