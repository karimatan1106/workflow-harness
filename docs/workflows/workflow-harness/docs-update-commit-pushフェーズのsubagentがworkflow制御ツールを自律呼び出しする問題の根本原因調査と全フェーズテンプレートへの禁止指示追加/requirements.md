# requirements.md: 全フェーズへのワークフロー制御ツール呼び出し禁止指示追加

## サマリー

- **目的**: docs_updateフェーズのsubagentがworkflow_nextを自律呼び出しした問題（FR-15）を受けて、definitions.tsの全25フェーズsubagentTemplateに禁止指示を追加する
- **主要な決定事項**:
  - フェーズ種別に応じた4種類の禁止指示テキストを定義する（直線フェーズ用・並列サブフェーズ用・承認フェーズ用・git操作フェーズ用）
  - 実装対象は `workflow-plugin/mcp-server/src/phases/definitions.ts` の全25フェーズのsubagentTemplateプロパティ
  - 既存の禁止指示（test_impl・testing・regression_test・docs_update）は変更せず、欠落している21フェーズに新規追加する
- **次フェーズで必要な情報**:
  - 禁止指示テキスト4種類の確定版（本ファイル内に記載）
  - 21フェーズの分類と各フェーズに適用する禁止指示の種別
  - テストスイートの現在の件数（945件）と合格基準

---

## 機能要件

### FR-19-1: 直線フェーズへの禁止指示追加

対象フェーズは research・requirements・implementation・refactoring・ci_verification・deploy の6フェーズである。
これらのフェーズのsubagentTemplateに以下の禁止指示テキストを追加すること。

禁止指示の内容として、以下の5点を必ず含めること:

- 当該subagentの責任範囲が「上記の作業内容のみ」であることの明示
- フェーズ遷移の制御はOrchestratorの専権事項であるという原則の記述
- workflow_next・workflow_approve・workflow_complete_sub・workflow_start・workflow_resetの5ツールが呼び出し禁止であることの列挙
- 各禁止ツールの用途説明（括弧書きで何をするツールか明記）
- 作業完了後は速やかに処理を終了してOrchestratorに制御を返す旨の指示

テキストの長さは50文字以上であること（明確性の担保）。
各禁止ツール名の記述方法は既存フェーズと同一フォーマット（箇条書き、コロン後に用途説明）を維持すること。

### FR-19-2: 並列サブフェーズへの禁止指示追加

対象フェーズは threat_modeling・planning・state_machine・flowchart・ui_design・build_check・code_review・manual_test・security_scan・performance_test・e2e_test の11フェーズである。
これらのフェーズのsubagentTemplateに並列サブフェーズ用の禁止指示テキストを追加すること。

禁止指示の内容として、以下の6点を必ず含めること:

- 当該subagentの責任範囲が「上記の作業内容のみ」であることの明示
- サブフェーズ完了宣言・フェーズ遷移はOrchestratorの専権事項であるという原則の記述
- workflow_next・workflow_approve・workflow_complete_sub・workflow_start・workflow_resetの5ツールが呼び出し禁止であることの列挙
- workflow_complete_subについて「並列フェーズの各サブフェーズ完了をOrchestratorが宣言するツールであり、subagentが呼び出してはならない」という特別な説明の追記
- 各禁止ツールの用途説明（括弧書きで何をするツールか明記）
- 作業完了後は速やかに処理を終了してOrchestratorに制御を返す旨の指示

テキストの長さは50文字以上であること。
workflow_complete_subへの特別な説明は直線フェーズ用よりも詳細にすることで、subagentが誤解しやすい点を補足すること。

### FR-19-3: 承認フェーズへの禁止指示追加

対象フェーズは design_review・test_design の2フェーズである。
これらのフェーズのsubagentTemplateに承認フェーズ用の禁止指示テキストを追加すること。

禁止指示の内容として、以下の6点を必ず含めること:

- 当該subagentの責任範囲が「レビュー成果物の作成のみ」であることの明示
- 承認・フェーズ遷移はOrchestratorがユーザー確認後に実行するものであるという原則の記述
- workflow_next・workflow_approve・workflow_complete_sub・workflow_start・workflow_resetの5ツールが呼び出し禁止であることの列挙
- workflow_approveについて「このフェーズはユーザー承認が必要であり、subagentが自律的に承認してはならない」という特別な説明の追記
- 各禁止ツールの用途説明（括弧書きで何をするツールか明記）
- 作業完了後は速やかに処理を終了してOrchestratorに制御を返す旨の指示

テキストの長さは50文字以上であること。
ユーザー承認が必要なフェーズであることを特に強調し、自律承認によるユーザーの確認機会の喪失リスクを明記すること。

### FR-19-4: git操作フェーズへの禁止指示追加

対象フェーズは commit・push の2フェーズである。
これらのフェーズのsubagentTemplateにgit操作フェーズ用の禁止指示テキストを追加すること。

禁止指示の内容として、以下の6点を必ず含めること:

- 当該subagentの責任範囲が「git操作のみ」であることの明示
- フェーズ遷移の制御はOrchestratorの専権事項であるという原則の記述
- workflow_next・workflow_approve・workflow_complete_sub・workflow_start・workflow_resetの5ツールが呼び出し禁止であることの列挙
- workflow_nextについて「git操作完了後に自律的に次フェーズへ移行することは禁止」という特別な説明の追記
- 各禁止ツールの用途説明（括弧書きで何をするツールか明記）
- 作業完了後は速やかに処理を終了してOrchestratorに制御を返す旨の指示

テキストの長さは50文字以上であること。
FR-15で実際に発生したパターン（commit完了後にpushへ自律遷移、push完了後にci_verificationへ自律遷移）を防止することを目的として、workflow_nextへの特別な禁止理由を明記すること。

### FR-19-5: 既存禁止指示との整合性確保

既存の禁止指示が存在する4フェーズ（test_impl・testing・regression_test・docs_update）の禁止指示は変更しないこと。
新規追加する21フェーズの禁止指示は、既存の禁止指示と矛盾しない文言・フォーマットを使用すること。
具体的には以下の基準を満たすこと:

- セクションヘッダーは「## ★ワークフロー制御ツール禁止★」の形式に統一する
- 禁止ツールの列挙順序はworkflow_next・workflow_approve・workflow_complete_sub・workflow_start・workflow_resetの順序に統一する
- 各ツールの後に括弧書きで用途説明を付記する形式に統一する

### FR-19-6: テストスイートの全件パス確認

実装完了後に既存のテストスイートを実行し、全件がパスすることを確認すること。
テスト実行前の件数は945件であり、実装後も同件数が合格すること。
実装によって新規テストが追加された場合は、追加分を含めた全件がパスすること。
テストスイートのパスはimplementationフェーズの完了条件として必須であり、1件でも失敗があればimplementationフェーズを完了してはならない。

---

## 非機能要件

### NFR-1: 禁止指示テキストの一貫性（保守性）

全21フェーズに追加する禁止指示テキストは、フェーズ種別ごとに同一のフォーマットを使用すること。
一貫したフォーマットにより、将来の修正・追加が容易になり、保守コストを低減する。
具体的には以下の形式要素を全禁止指示に統一する:

- セクションヘッダーの記述形式（「## ★ワークフロー制御ツール禁止★」）
- 禁止ツールの箇条書き形式（ハイフン始まり、ツール名後にコロンと用途説明）
- 締めの文（「作業が完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。」）

### NFR-2: 新規フェーズへの適用可能性（拡張性）

今後新しいフェーズがdefinitions.tsに追加される場合も、禁止指示が必ず含まれる設計にすること。
具体的な実現方法として、以下のいずれかを採用すること:

- 各フェーズのsubagentTemplateを生成する関数・テンプレートに禁止指示セクションを組み込む
- フェーズ種別を判定するロジックに基づいて自動的に禁止指示を付加する仕組みを用意する
- 少なくとも、コードレビュー時のチェックリストに「新規フェーズの禁止指示確認」を追加する

この非機能要件はimplementationフェーズでの設計判断に委ねるが、planning/test_designフェーズでの検討事項として記録する。

### NFR-3: 禁止指示の視認性

各フェーズのsubagentTemplateにおいて、禁止指示セクションが十分に目立つ位置・形式で配置されること。
subagentがプロンプトを読む際に見落とさないよう、テンプレートの末尾（出力要件より後）に配置することを推奨する。
セクションヘッダーに星マーク（★）を含めることで視覚的な注意喚起を行う。

### NFR-4: 影響範囲の最小化

本タスクの変更対象はdefinitions.tsのsubagentTemplateプロパティのみとする。
フェーズの定義（対象ファイル・出力ファイル・フェーズ順序等）は変更しないこと。
既存のテスト（945件）がすべてパスすることにより、変更の影響が禁止指示テキストの追加のみであることを担保する。

---

## 受入条件

以下の全条件を満たした場合に本タスクが完了したと判定する。

### AC-1: 全フェーズカバレッジ

definitions.tsに定義された全25フェーズのsubagentTemplateに禁止指示が含まれること。
実装前から禁止指示が存在する4フェーズ（test_impl・testing・regression_test・docs_update）を含め、全フェーズで「## ★ワークフロー制御ツール禁止★」セクションが確認できること。

### AC-2: フェーズ分類の正確性

各フェーズに適用する禁止指示の種別が以下の分類に従っていること:

- 直線フェーズ用（FR-19-1）: research・requirements・implementation・refactoring・ci_verification・deploy
- 並列サブフェーズ用（FR-19-2）: threat_modeling・planning・state_machine・flowchart・ui_design・build_check・code_review・manual_test・security_scan・performance_test・e2e_test
- 承認フェーズ用（FR-19-3）: design_review・test_design
- git操作フェーズ用（FR-19-4）: commit・push

### AC-3: テスト全件パス

テストスイートを実行した際に、全テストがパスすること。
実装前の件数（945件）以上のテストが合格状態であること。
テスト失敗が1件でもある場合は受入条件を満たさない。

### AC-4: 禁止指示テキストの長さ

追加する各禁止指示テキストが50文字以上であること。
50文字未満の短い禁止指示は明確性が不十分とみなし、受入条件を満たさない。

### AC-5: 既存フェーズとの非干渉

実装後もtest_impl・testing・regression_test・docs_updateの既存禁止指示が変更されていないこと。
既存の禁止指示の文言・フォーマットが保持されていること。
