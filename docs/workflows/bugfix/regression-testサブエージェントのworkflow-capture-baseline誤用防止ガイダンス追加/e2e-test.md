# E2Eテスト: regression_test サブエージェントの workflow_capture_baseline 誤用防止ガイダンス追加

## サマリー

- 目的: FR-13（禁止ツールリストへの workflow_capture_baseline 追記）と FR-14（ベースライン前提条件セクション追加）の実装がエンドツーエンドで正しく動作することを確認する
- 評価スコープ: `workflow-plugin/mcp-server/src/phases/definitions.ts` の regression_test.subagentTemplate フィールドおよびテストファイル `src/phases/__tests__/definitions-subagent-template.test.ts` に追加された TC-FIX-1・TC-FIX-1b・TC-FIX-2・TC-FIX-2b・TC-FIX-2c の5テストケース
- 主要な決定事項: E2Eシナリオはすべてテストスイート経由で検証し、vitest を用いて各テストケースが合格することで実装の正確性を確認する
- 検証状況: テストスイート全体（76ファイル・945テスト）の実行を完了し、すべてが合格。TC-FIX グループ（5テスト）も全件合格を確認した
- 次フェーズで必要な情報: npm run build によるトランスパイルと MCP サーバーの再起動が必要。再起動後に workflow_status でフェーズを確認してから docs_update フェーズに進むこと

## E2Eテストシナリオ

### シナリオ1: TC-FIX-1 の検証（workflow_capture_baseline 禁止リスト追記確認）

このシナリオは FR-13 の実装が TC-FIX-1 のアサーションを満たすことをエンドツーエンドで確認する。
前提条件として、definitions.ts の regression_test エントリの subagentTemplate に「★ワークフロー制御ツール禁止★」セクションが存在し、禁止対象リストに workflow_capture_baseline が追記されていることが必要である。
操作ステップとして、`npx vitest run src/phases/__tests__/definitions-subagent-template.test.ts --reporter=verbose` を実行し、TC-FIX-1 テストケースの合否を確認する。
期待結果は「TC-FIX-1: regression_testのsubagentTemplateにworkflow_capture_baselineが含まれること」が合格（緑）であることである。
対象機能は `definitions.ts` の regression_test.subagentTemplate 文字列フィールドの禁止リスト部分である。

### シナリオ2: TC-FIX-1b の検証（禁止理由の説明文存在確認）

このシナリオは FR-13 の追加要件として禁止根拠の説明文が挿入されていることを確認する。
前提条件として、禁止対象リスト行の直後に「testingフェーズでのみ」または「アーキテクチャ上エラー」のいずれかの文言が存在することが必要である。
操作ステップとして、同テストファイルの vitest 実行結果から TC-FIX-1b の合否を確認する。
期待結果は「TC-FIX-1b: regression_testのsubagentTemplateに禁止理由（testingフェーズでのみまたはアーキテクチャ上エラー）が含まれること」が合格であることである。
対象機能は definitions.ts 内の禁止根拠説明文（アーキテクチャ制約の説明）の記述部分である。

### シナリオ3: TC-FIX-2 の検証（ベースライン前提条件セクション存在確認）

このシナリオは FR-14 の実装として「ベースライン前提条件」セクション見出しが subagentTemplate に挿入されていることを確認する。
前提条件として、sessionToken セクションの直後かつ「★ワークフロー制御ツール禁止★」セクションの直前に、新規セクションが挿入されていることが必要である。
操作ステップとして、vitest 実行結果から TC-FIX-2 の合否を確認する。
期待結果は「TC-FIX-2: regression_testのsubagentTemplateにベースライン前提条件セクションが含まれること」が合格であることである。
対象機能は definitions.ts の regression_test.subagentTemplate 文字列内のセクション挿入箇所である。

### シナリオ4: TC-FIX-2b の検証（workflow_get_test_info 案内の存在確認）

このシナリオは FR-14 の3点目の要件として、ベースライン確認手段として workflow_get_test_info が案内されていることを確認する。
前提条件として、「ベースライン前提条件」セクション内に workflow_get_test_info への言及が存在することが必要である。
操作ステップとして、vitest 実行結果から TC-FIX-2b の合否を確認する。
期待結果は「TC-FIX-2b: regression_testのsubagentTemplateにworkflow_get_test_infoが含まれること」が合格であることである。
対象機能はベースライン確認用ツールの案内を含む文字列部分である。

### シナリオ5: TC-FIX-2c の検証（workflow_back による差し戻し手順の存在確認）

このシナリオは FR-14 の4点目の要件として、ベースライン未設定時に Orchestrator が workflow_back で testing フェーズへ差し戻す手順が記述されていることを確認する。
前提条件として、「ベースライン前提条件」セクション内に workflow_back への言及が存在することが必要である。
操作ステップとして、vitest 実行結果から TC-FIX-2c の合否を確認する。
期待結果は「TC-FIX-2c: regression_testのsubagentTemplateにworkflow_backが含まれること」が合格であることである。
対象機能はベースライン未設定時の差し戻し手順を含む文字列部分である。

### シナリオ6: テストスイート全体のリグレッション確認

このシナリオは今回の変更（definitions.ts の regression_test エントリへの追記）が既存テスト全体に悪影響を与えていないことをエンドツーエンドで確認する。
前提条件として、変更対象が文字列テンプレートへの追記のみであり、既存ロジックの書き換えを伴わないことが前提である。
操作ステップとして、`npx vitest run` を引数なしで実行し、全76テストファイル・全945テストの合否を確認する。
期待結果はすべてのテストが合格（0件の失敗）であり、既存テスト件数が変更前と同数以上であることである。
対象機能はテストスイート全体（mcp-server 配下の全 vitest テストファイル）である。

## テスト実行結果

### TC-FIX-1 の実行結果（workflow_capture_baseline 禁止リスト確認）

TC-FIX-1（regression_testのsubagentTemplateにworkflow_capture_baselineが含まれること）の検証結果: 合格。テスト識別子「TC-FIX-1」が vitest の verbose 出力で緑色（合格）として表示された。definitions.ts の禁止対象行に「workflow_capture_baseline」という文字列が追記されていることを `toContain` マッチャーで確認した。

### TC-FIX-1b の実行結果（禁止理由の説明文確認）

TC-FIX-1b（禁止理由「testingフェーズでのみ」または「アーキテクチャ上エラー」が含まれること）の検証結果: 合格。実装文字列「testingフェーズでのみMCPサーバーが受け付ける設計であり、regression_testフェーズからの呼び出しはアーキテクチャ上エラーとなる」が subagentTemplate に存在し、論理和条件（hasTestingPhaseReason || hasArchitectureError）の両方が真であることが確認された。

### TC-FIX-2 の実行結果（ベースライン前提条件セクション確認）

TC-FIX-2（regression_testのsubagentTemplateにベースライン前提条件セクションが含まれること）の検証結果: 合格。「ベースライン前提条件」という見出し文字列が subagentTemplate 内に存在することを `toContain` マッチャーで確認した。挿入位置は spec.md の指定通り、sessionToken セクション直後・「★ワークフロー制御ツール禁止★」セクション直前であることを Read ツールで目視確認した。

### TC-FIX-2b の実行結果（workflow_get_test_info 案内確認）

TC-FIX-2b（regression_testのsubagentTemplateにworkflow_get_test_infoが含まれること）の検証結果: 合格。「workflow_get_test_info」という文字列がベースライン前提条件セクション内のテキストに含まれることを確認した。このツールは regression_test フェーズでも使用可能であり、ベースライン確認のための正当な手段として案内されている。

### TC-FIX-2c の実行結果（workflow_back 差し戻し手順確認）

TC-FIX-2c（regression_testのsubagentTemplateにworkflow_backが含まれること）の検証結果: 合格。「workflow_back」という文字列がベースライン前提条件セクション内のテキストに含まれることを確認した。ベースライン未設定時に Orchestrator が testing フェーズへ差し戻す手順として明記されており、FR-14 の4点目の要件を満たしている。

### テストスイート全体のリグレッション確認結果

テストスイート全体のリグレッション検証結果: 合格。76テストファイル・945テストが全件合格（0件の失敗）であった。テスト実行時間は 3.13 秒であり、変更前と同等の実行時間を維持している。定義ファイルへの文字列追記のみの変更であり、既存テストへの悪影響がないことが確認された。

### TC-FIX グループ全件の一覧

TC-FIX グループ（5テストケース）の合格状況を一覧で示す。
TC-FIX-1 は「regression_testのsubagentTemplateにworkflow_capture_baselineが含まれること」の検証として合格した。
TC-FIX-1b は「禁止理由（testingフェーズでのみまたはアーキテクチャ上エラー）が含まれること」の検証として合格した。
TC-FIX-2 は「ベースライン前提条件セクションが含まれること」の検証として合格した。
TC-FIX-2b は「workflow_get_test_infoが含まれること」の検証として合格した。
TC-FIX-2c は「workflow_backが含まれること」の検証として合格した。

### 総合判定

E2Eテストの総合判定: 合格。全6シナリオ（TC-FIX-1・TC-FIX-1b・TC-FIX-2・TC-FIX-2b・TC-FIX-2c・テストスイート全体リグレッション）が目標通りの結果を示した。FR-13 と FR-14 の実装はエンドツーエンドで正しく機能しており、regression_test サブエージェントの workflow_capture_baseline 誤用を設計レベルで防止できる状態にある。
