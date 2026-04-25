## サマリー

- 目的: code_reviewフェーズのsubagentTemplateに「評価結論フレーズの重複回避（特化ガイダンス）」セクションを追加し、前回ワークフローで発生した5回のリトライを再発させない
- 主要な決定事項: 修正対象は `workflow-plugin/mcp-server/src/phases/definitions.ts` のcode_review.subagentTemplate（1箇所のみ）。問題2・問題3はコード修正不要と判断済み
- 次フェーズで必要な情報: 追加するガイダンスの具体的なNG/OK例（FR番号を含む識別子を行に含める形式）、および既存のparallel_verificationテンプレートとの一貫性確保

---

## 背景と問題の経緯

前回ワークフロー「修正効果の全体検証と残存問題の根本原因解決」では、FR-3として parallel_verification の4サブフェーズ（manual_test・security_scan・performance_test・e2e_test）のsubagentTemplateに評価結論フレーズの重複回避ガイダンスを追加した。

しかし、このFR-3の適用対象にcode_reviewフェーズが含まれていなかった。その結果、code_reviewサブエージェントが複数のFR（FR-1・FR-2・FR-3）について同一フォーマットの整合性確認フレーズを3回以上使用した際にバリデーターの重複行検出が発火し、初回から5回のリトライが必要となった。

今回のタスクはこの「漏れ」を根本的に修正し、code_reviewフェーズのテンプレートにも同様のガイダンスを追加することで、同種のリトライ多発を防止することを目的とする。

---

## 機能要件

### FR-1: code_review.subagentTemplateへのガイダンスセクション追加

`workflow-plugin/mcp-server/src/phases/definitions.ts` の `code_review` フェーズ定義内にある `subagentTemplate` 文字列の末尾（「## 出力」セクションの直前）に、以下の内容を含む「## 評価結論フレーズの重複回避（特化ガイダンス）」セクションを追加する。

追加するガイダンスには以下の3要素を含めること。

- 問題の説明: 複数のFR・修正箇所・ファイルを同一フォーマットで評価する場合にバリデーターの重複行検出によりエラーが発生するという事実の説明
- NG例: 「spec.mdの要件確認結果は以下のとおりである。」という同一フレーズをFR-1・FR-2・FR-3で繰り返す形式が3回以上の同一行としてエラーになること
- OK例: 「FR-1（対象の具体的な変更内容）に関するspec.md要件の確認結果は以下のとおりである。」のように、FR番号とファイル名・関数名などの識別子を行に含めて各行を一意にすること

### FR-2: 既存テンプレートとの一貫性確保

追加するガイダンスのセクション名・構造・表現スタイルを、manual_testフェーズのsubagentTemplateに既に含まれている「## 評価結論フレーズの重複回避（特化ガイダンス）」セクションと一致させること。

code_review特有の文脈（複数のFRや修正ファイルを評価する状況）に合わせてNG/OK例の具体的な内容は異なるが、セクション名と構造は統一する。

### FR-3: definitions.tsの変更内容の妥当性

追加するガイダンスは `subagentTemplate` 文字列内に既存のセクション（「## パフォーマンスセクションの行数ガイダンス」等）と同じMarkdown形式で記述する。

「## 出力」セクションの直前に配置することで、既存のサマリー・設計-実装整合性・コード品質・セキュリティ・パフォーマンスの各ガイダンスセクションとの並びが維持される。

---

## 非機能要件

### NFR-1: 既存テストスイートの維持

`workflow-plugin/mcp-server/src/phases/definitions.ts` の変更後、既存のユニットテスト一式（61件以上のテストファイルに含まれる全テスト）がすべてパスすること。

definitions.ts を直接テストする `src/phases/__tests__/definitions.test.ts` の全テストケースも引き続きパスすること。定義するソースコードの構造（PHASES_LARGE・PHASE_GUIDES・resolvePhaseGuide等のエクスポート）に変更を加えないため、既存テストへの影響は発生しない想定である。

### NFR-2: MCP サーバー再起動の実施

`definitions.ts` はコアモジュールであり、Node.jsのモジュールキャッシュにより変更後の再起動が必要である。実装フェーズでの変更完了後は、CLAUDE.md ルール22に従い以下の手順を実施すること。

- `cd workflow-plugin/mcp-server && npm run build` でトランスパイルを実行する
- Claude Desktop側でMCPサーバーの再起動操作を行う
- 再起動後に `workflow_status` で現在のフェーズを確認し、同フェーズから作業を再開する

### NFR-3: テンプレートの文字列長に関する制約

`subagentTemplate` はTypeScriptソースコード内の文字列リテラルとして定義されている。ガイダンスセクションの追加によって文字列長が増加するが、JavaScript/TypeScriptの文字列長制限（実用上の上限は数百万文字）には達しない範囲であるため、問題は生じない。

追加するガイダンスセクションの行数は20行以内とし、コンパクトに記述することで保守性を維持すること。

### NFR-4: ガイダンスの実効性

追加するガイダンスは、code_reviewサブエージェントが複数のFRを評価する際に具体的な行動変容を促せる内容であること。禁止パターン（バリデーターが検出するパターン）の説明に禁止語そのものを成果物本文に記述しないよう、間接参照を使用する表現にすること。

---

## 影響範囲

### 変更対象ファイル（1ファイルのみ）

- `workflow-plugin/mcp-server/src/phases/definitions.ts`: code_reviewサブフェーズ定義内の `subagentTemplate` プロパティに1セクションを追加する

### 変更対象外

- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`: バリデーターのロジックには変更しない
- `workflow-plugin/mcp-server/src/state/state-manager.ts`: 状態管理には変更しない
- parallel_verificationの4サブフェーズ（manual_test・security_scan・performance_test・e2e_test）: 前回FR-3で修正済みのため変更不要
- テストファイル: 新規テストケースは test_impl フェーズで作成する（requirements フェーズではコード変更禁止）

---

## 受け入れ基準

- `definitions.ts` の `code_review.subagentTemplate` に「## 評価結論フレーズの重複回避（特化ガイダンス）」セクションが存在すること
- セクション内にFR番号・ファイル名等の識別子を含む一意化の方法を示すNG例とOK例が含まれていること
- セクション名がmanual_testフェーズのテンプレートに存在するセクション名と一致していること
- 既存のユニットテスト一式がすべてパスすること（testingフェーズで確認）
- MCPサーバー再起動後にworkflow_statusが正常に応答すること
