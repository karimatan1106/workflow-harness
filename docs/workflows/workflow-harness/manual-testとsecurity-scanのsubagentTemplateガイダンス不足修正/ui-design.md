## サマリー

本UI設計書は、FR-11（manual_test総合評価ガイダンス追加）およびFR-12（security_scan行数計算ロジック追加）の実装において、MCPサーバーが提供するインターフェースの観点から設計を定義する。

- 目的: definitions.tsのsubagentTemplateフィールドへのガイダンス追加が、ツール呼び出し・エラーメッセージ・APIレスポンス・設定構造に与える影響を明確化する。
- 主要な決定事項: CLIはworkflow_complete_subツール経由でバリデーション結果を返す。エラーメッセージは「{フェーズ名}のサブフェーズ{名前}のバリデーションに失敗しました」形式を採用する。APIレスポンスはsuccessフラグとvalidationErrors配列で構成する。設定ファイルは改行コード `\n` 文字列結合形式を維持する。
- 次フェーズで必要な情報: 挿入位置の正確なold_string（`## 出力\n${docsDir}/manual-test.md` および `## 出力\n${docsDir}/security-scan.md` の直前）、ガイダンスブロックのテンプレート形式仕様。
- 修正対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（subagentTemplate文字列の追記のみ）
- テスト追加ファイル: `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts`（FR-11・FR-12の検証テスト3件）


## CLIインターフェース設計

### workflow_complete_subツールの呼び出し形式

MCPサーバーが提供する `workflow_complete_sub` ツールは、parallel_verificationフェーズの各サブフェーズ完了時にOrchestratorが呼び出すエントリーポイントである。FR-11・FR-12の実装後も呼び出し形式に変更はなく、後方互換性が維持される。

```
workflow_complete_sub({
  subPhase: "manual_test",   // または "security_scan"
  taskId: "タスクID文字列"
})
```

呼び出し時の内部処理として、MCPサーバーは対象サブフェーズの成果物ファイルを読み込み、artifact-validatorでバリデーションを実行する。バリデーション通過時は成功レスポンスを返し、失敗時はエラー詳細を含むレスポンスを返す。

### バリデーション失敗時のOrchestratorへの通知形式

バリデーションが失敗した場合、ツールのレスポンスにエラー情報が埋め込まれてOrchestratorに返される。Orchestratorはこのエラー情報を元にサブエージェントを再起動する。通知形式の設計は以下のとおりである。

成功時のステータスフィールドは `success: true` で、エラー配列は空となる。失敗時のステータスフィールドは `success: false` で、エラー配列に具体的な違反内容が格納される。エラーフィールドには行番号・違反種別・修正ガイダンスの3要素が含まれるべき構造である。

### workflow_nextツールとの連携ポイント

parallel_verificationフェーズでは、4つのサブフェーズ（manual_test・security_scan・performance_test・e2e_test）が全て完了した後にOrchestratorが `workflow_next` を呼び出す。FR-11・FR-12はsubagentTemplateの文字列のみを変更するため、workflow_nextの呼び出し形式やフェーズ遷移ロジックへの影響はない。

Orchestratorはworkflow_complete_subの成功レスポンスを確認してから次のサブフェーズを完了させることが推奨される手順である。全4サブフェーズの完了確認後にworkflow_nextを呼び出すことで、parallel_verificationフェーズが正常に終了する。


## エラーメッセージ設計

### セクション実質行数不足エラーのメッセージ形式

artifact-validatorがminSectionLines（5行）を下回る実質行数を検出した場合に返すエラーメッセージの形式を定義する。

```
ValidationError: セクション「{セクション名}」の実質行数が不足しています。
  現在の実質行数: {N}行
  必要な実質行数: 5行以上
  実質行にカウントされない行: 空行・水平線・コードフェンス内・ラベルのみ行
  推奨対応: 各ラベル行のコロン後に具体的なコンテンツを追記してください。
```

このエラーが発生した場合、Orchestratorはサブエージェントの再起動プロンプトに上記エラーメッセージを「前回のバリデーション失敗理由」セクションとして埋め込む。FR-11追加後は `## 総合評価` セクションで5行未満となる可能性が低下するため、このエラーの発生頻度が減少する見込みである。

### 全体行数不足エラーのメッセージ形式

成果物全体のminLines（20行）を下回る非空行数を検出した場合のエラーメッセージ形式は以下のとおりである。

```
ValidationError: 成果物の非空行数が不足しています。
  現在の非空行数: {N}行
  必要な非空行数: 20行以上（minLines設定）
  計算式（security_scan）: 必須3セクション × 5行 = 15行、残り5行は総合評価等で確保
  推奨対応: 各セクションのコンテンツを充実させ、合計20行以上を確保してください。
```

FR-12のガイダンス追加により、security_scanサブエージェントは15行（3セクション × 5行）に加えて追加5行の確保方法を理解できる。結果として、このエラーメッセージを受け取る前に自己修正できるケースが増加することが期待される。

### 禁止語検出エラーのメッセージ形式

コードフェンス外に禁止語が含まれる行を検出した場合のエラーメッセージは、禁止語そのものを含まず間接参照で記述される。

```
ValidationError: 禁止パターンが検出されました。
  検出位置: {行番号}行目
  対応: バリデーターが検出するパターンを間接参照（「該当する語句」等）に置き換えてください。
  注意: エラーメッセージ内の語句を成果物に転記するとフィードバックループが発生します。
```

エラーメッセージ自体にも禁止語が含まれないよう設計されており、転記防止の観点から間接参照形式を採用している点が重要である。


## APIレスポンス設計

### workflow_complete_sub成功レスポンスの構造

subagentが成果物ファイルを出力し、Orchestratorがworkflow_complete_subを呼び出した際に、バリデーション通過時に返されるレスポンスの構造を定義する。

```
{
  success: true,
  subPhase: "manual_test",
  validationResult: {
    passed: true,
    lineCount: {実際の非空行数},
    sectionResults: {
      "## テストシナリオ": { lineCount: N, passed: true },
      "## テスト結果": { lineCount: N, passed: true },
      "## サマリー": { lineCount: N, passed: true }
    }
  },
  message: "manual_testサブフェーズが正常に完了しました"
}
```

FR-11追加後、`## 総合評価` セクションが成果物に含まれる場合は `sectionResults` に同セクションの行数が追加で記録されるが、このセクションはrequiredSectionsに含まれないため合否判定への影響はない。

### workflow_complete_subバリデーション失敗レスポンスの構造

バリデーションが失敗した場合のレスポンス構造は以下のとおりである。Orchestratorはこのレスポンスを受信したとき、リトライプロンプトを作成してサブエージェントを再起動する。

```
{
  success: false,
  subPhase: "security_scan",
  validationResult: {
    passed: false,
    lineCount: {現在の非空行数},
    errors: [
      {
        type: "SECTION_LINE_COUNT",
        section: "## 検出された問題",
        currentCount: 2,
        requiredCount: 5,
        message: "セクション実質行数不足: 2行（必要: 5行以上）"
      }
    ]
  },
  message: "security_scanサブフェーズのバリデーションに失敗しました。errors配列を参照してください"
}
```

FR-12のガイダンス追加により、`## 検出された問題` セクションの実質行数不足エラーの発生件数が減少する見込みである。

### workflow_nextレスポンスとsubagentTemplateフィールドの関係

workflow_nextはフェーズ遷移を実行するAPIであり、parallel_verificationフェーズへの遷移時にsubagentTemplateを含むphaseGuideを返す。FR-11・FR-12のsubagentTemplate変更はworkflow_nextのレスポンス構造には影響しない。

subagentTemplateフィールドはworkflow_nextのレスポンスに含まれるが、workflow_statusはスリムガイドを返す設計のため、subagentTemplateを取得するにはworkflow_nextのレスポンスまたはworkflow_get_subphase_templateを使用すること。Orchestratorはworkflow_get_subphase_templateでサブフェーズテンプレートを個別に取得でき、FR-11・FR-12のガイダンスブロックが確実に含まれているかをテスト段階で確認できる。


## 設定ファイル設計

### definitions.tsのsubagentTemplateフィールドの構造規約

`workflow-plugin/mcp-server/src/phases/definitions.ts` において、subagentTemplateフィールドはシングルクォートで囲まれた改行コード `\n` 文字列結合形式として定義される。この構造規約はFR-11・FR-12の追加後も変更しない。

FR-11追加後のmanual_testテンプレートの末尾構造は以下のとおりである。

```
subagentTemplate: '...既存のガイダンス...\n'
  + '\n## ★ 総合評価セクションの記述指針（FR-11）\n\n'
  + '`## 総合評価` セクションには、以下の5観点それぞれについて...\n'
  + '（5観点の説明行）\n'
  + '...\n'
  + '各観点について1行以上の実質行を記述し、合計5行以上の実質行を確保すること。\n'
  + '\n## 出力\n${docsDir}/manual-test.md'
```

実際のdefinitions.tsではシングルクォートの単一文字列として表現されるため、上記の連結は視覚的な説明目的の擬似表記である。

### FR-11追加後のmanual_testテンプレート構造

FR-11のガイダンスブロックを追加した後のmanual_testサブフェーズのsubagentTemplateフィールドは以下の順序でセクションが並ぶ設計である。

- フェーズタイトル行（`# manual_testフェーズ`）で始まり、タスク情報・作業内容・行数カウント仕様が先行する。
- 禁止語転記防止・重複行回避・サマリーセクションガイダンスが中間に位置する。
- テストシナリオ・テスト結果セクションのガイダンスが続く。
- 評価結論フレーズ重複回避・実行日時環境情報の一意化ガイダンスがその後に位置する。
- FR-11として追加する `## ★ 総合評価セクションの記述指針（FR-11）` ブロックが末尾直前に挿入される。
- 最後に `## 出力` と出力先パスが来る構造となる。

この順序を守ることで、既存ガイダンスの内容を変更することなく、新規ガイダンスを追加できる。

### FR-12追加後のsecurity_scanテンプレート構造

FR-12のガイダンスブロックを追加した後のsecurity_scanサブフェーズのsubagentTemplateフィールドは以下の順序でセクションが並ぶ設計である。

- フェーズタイトル行（`# security_scanフェーズ`）で始まり、タスク情報・作業内容が先行する。
- 行数カウント仕様と転記防止・重複行回避・サマリーセクションガイダンスが中間に位置する。
- 脆弱性スキャン結果・検出された問題セクションのガイダンスが続く。
- サブヘッダー多用時のセクション密度確保（FR-2）がその後に位置する。
- FR-12として追加する `## ★ 行数確保の記述指針（FR-12）` ブロックが末尾直前に挿入される。
- 最後に `## 出力` と出力先パスが来る構造となる。

FR-12のガイダンスブロックには「3セクション × 5行 = 15行、残り5行は追加セクションで確保」という定量的な計算式を含め、subagentが行数目標20行に向けたコンテンツ量を算出できるよう設計する。

### テストファイルへの追加テストの構造規約

`definitions-subagent-template.test.ts` における新規テストスイートの配置は、既存FR-10テストブロックの後に続く形式を採用する。テンプレート取得の手順は `resolvePhaseGuide('parallel_verification', docsDir)` で親フェーズのガイドを取得し、`?.subPhases?.manual_test?.subagentTemplate` または `?.subPhases?.security_scan?.subagentTemplate` でサブフェーズのテンプレート文字列を抽出する形式を維持する。

TC-11-1は `toContain('総合評価')` で文字列の存在を確認し、TC-11-2は `toContain('全テストシナリオ')` でFR-11の具体的な観点記述が含まれることを確認する。TC-12-1は `toContain('20行')` でFR-12の定量的な計算根拠が明示されていることを確認する。テスト追加後の総件数は912件（現在）から915件以上となる予定である。
