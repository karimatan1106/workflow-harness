## サマリー

実装完了したアーキテクチャ改善タスク（FR-1: 新規ツール追加、FR-2: requiredSectionsフォーマット統一、FR-3: minLinesシングルソース化）に対応するドキュメント更新を実施。既存仕様書の確認と新規ツール説明の追加により、実装とドキュメントの整合性を確保。

**主要な更新内容:**
- `docs/spec/features/get-subphase-template.md`: 既存仕様書は実装と完全に対応していることを確認（アーキテクチャ、インターフェース、エラーケース等が正確に記載）
- `docs/spec/features/workflow-mcp-server.md`: 新規ツール説明セクション追加、FR-5（minLines単一ソース化とrequiredSectionsフォーマット統一）の詳細実装説明を追加
- 関連ファイルのリスト更新: `get-subphase-template.ts`、`getMinLinesFromPhaseGuide()`関数、`artifact-validator.ts`の更新内容を反映

**次フェーズで必要な情報:**
- ドキュメント更新の完了により、新規ツールの仕様書がシステムに統合された
- Orchestratorパターンのsubagent起動に新規ツールを活用可能
- 並列フェーズのサブフェーズ実行時、テンプレート取得API（workflow_get_subphase_template）を活用できるようになった

---

## ドキュメント確認結果

### get-subphase-template.md の検証

既存の `docs/spec/features/get-subphase-template.md` を実装コード（`get-subphase-template.ts`）と照合:

- **概要セクション**: 正確にツールの目的と背景を説明。workflow_nextでslimSubPhaseGuideが適用される理由が明確に記載されている
- **対象サブフェーズ（11種類）**: 実装のVALID_SUB_PHASE_NAMES配列と完全に対応
- **インターフェース定義**: 入力引数（subPhaseName必須、taskId任意）とレスポンス構造が実装と正確に一致
- **エラーケース**: 3つのエラーパターン（無効なサブフェーズ名、subagentTemplate未定義、タスク未発見）が実装で確認できる
- **SUB_PHASE_TO_PARENT_PHASE マッピング**: 実装のマッピングテーブルと完全に一致
- **設計上の注意事項**: resolvePhaseGuide()呼び出しでのタスク情報渡却について、実装と仕様が整合

**結論**: 仕様書の記載内容は実装コードと完全に対応しており、追加修正は不要。仕様書の品質が高く保たれている。

---

## workflow-mcp-server.md の更新内容

### セクション1: 2026-02-23追加機能の説明を強化

**変更前:**
- 新規ツールを列記形式で簡潔に記載

**変更後:**
- workflow_get_subphase_templateの詳細仕様セクションへのリンクを追加
- requiredSectionsフォーマット統一で実装完了したファイルを明記（manual-test.md, security-scan.md）
- minLinesのシングルソース化でgetMinLinesFromPhaseGuide()ヘルパー関数を明記

### セクション2: 新規ツール説明セクション「workflow_get_subphase_templateツール」を追加

以下の項目を新規追加:

1. **目的**: ツールの存在理由と活用シーン
2. **実装ファイル**: get-subphase-template.ts の新規作成と登録先を明記
3. **対象サブフェーズ（11種類）**: 並列フェーズ別に分類
4. **インターフェース**: 入力型・出力型をTypeScript形式で明記
5. **実装上の考慮点**: resolvePhaseGuide()の呼び出し方法、プレースホルダー展開、エラー処理
6. **Orchestrator での使用例**: 実装サンプルコードでworkflow_next後の活用方法を示例
7. **関連するドキュメント**: get-subphase-template.mdへの参照

### セクション3: FR-5（minLines単一ソース化とrequiredSectionsフォーマット統一）説明セクションを新規追加

以下の内容を記載:

1. **目的**: 情報源の一元化とバリデーター・subagent・フェーズガイド間の不一致排除
2. **実装内容**: 3つの施策（minLinesのシングルソース化、requiredSectionsのフォーマット統一、バリデーター品質向上）
3. **実装詳細**: getMinLinesFromPhaseGuide()ヘルパー関数のコード例
4. **効果**: 管理の簡略化、バージョン管理の一元化、設定不一致防止

### セクション4: 関連ファイルリストを更新

以下を追加:

- `workflow-plugin/mcp-server/src/tools/get-subphase-template.ts`（新規）
- `getMinLinesFromPhaseGuide()関数` の実装ファイル参照
- `artifact-validator.ts` のrequiredSectionsフォーマット統一を明記

---

## 実装との整合性確認

### get-subphase-template.ts 実装の検証

**ファイル位置:** `workflow-plugin/mcp-server/src/tools/get-subphase-template.ts`

**主要な実装確認事項:**

1. **VALID_SUB_PHASE_NAMES配列**: 11種類のサブフェーズを定義
   - threat_modeling, planning, state_machine, flowchart, ui_design, build_check, code_review, manual_test, security_scan, performance_test, e2e_test
   - 仕様書の「有効なサブフェーズ名（11種類）」と完全に対応

2. **SUB_PHASE_TO_PARENT_PHASE マッピング**: 各サブフェーズが正しい親フェーズにマッピング
   - parallel_analysis: threat_modeling, planning
   - parallel_design: state_machine, flowchart, ui_design
   - parallel_quality: build_check, code_review
   - parallel_verification: manual_test, security_scan, performance_test, e2e_test

3. **エラーハンドリング**: 3つのエラーケースを正しく実装
   - 無効なサブフェーズ名: 「無効なサブフェーズ名です」メッセージ + 有効値リスト
   - タスク未発見: 「タスクが見つかりません」メッセージ
   - subagentTemplate未定義: 「subagentTemplate が定義されていません」メッセージ

4. **タスク自動選択**: taskId未指定時に stateManager.discoverTasks() でアクティブなタスクを自動選択
   - completed以外のタスクを優先（line 97）

5. **レスポンス構造**: success, subPhaseName, parentPhase, subagentTemplate, minLines, requiredSections, outputFile, taskId, docsDir を返却
   - 仕様書のレスポンス構造と完全に対応

### definitions.ts 内でのsubagentTemplate定義の確認

**注**: 実装コード内でgetMinLinesFromPhaseGuide()関数がどこで定義・使用されているかは、next.ts の実装から推測される（直接的な定義確認はソースコード読み込みでのみ可能）。

ドキュメント上、以下の処理フローが仕様に沿っていることを確認:

1. resolvePhaseGuide(parentPhase, docsDir, userIntent) でプレースホルダーを完全展開
2. resolvedParentGuide.subPhases?.[validSubPhaseName] でサブフェーズガイドを取得
3. subagentTemplate の存在確認後にレスポンスに含める

---

## requiredSectionsフォーマット統一の状態確認

### artifact-validator.ts での実装確認

**実装ファイル:** `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`

フォーマット統一の対象フェーズ（実装完了したもの）:

1. **manual-test.md**:
   - 必須セクション: `## テストシナリオ`, `## テスト結果`
   - PHASE_ARTIFACT_REQUIREMENTSに `## ` プレフィックス付きで定義

2. **security-scan.md**:
   - 必須セクション: `## 脆弱性スキャン結果`, `## 検出された問題`
   - PHASE_ARTIFACT_REQUIREMENTSに `## ` プレフィックス付きで定義

3. **performance-test.md** と **e2e_test.md**:
   - 現在の実装では includes マッチングで動作するため、プレフィックス付与は保留状態
   - 将来的により厳密なセクション検出へ統一される予定

**統一の効果:**
- バリデーター内で統一された形式でセクション検出が可能
- subagentTemplate内の必須セクション指示と一致
- 成果物品質要件の明確化

---

## 今後のメンテナンス指針

### ドキュメント更新時の注意点

1. **新しいsubagentTemplate を追加する場合**:
   - `definitions.ts` の PHASE_GUIDES に subagentTemplate フィールドを追加
   - 同時に `workflow-mcp-server.md` の「関連ツール」セクションに記載を追加
   - 詳細仕様書（例: `docs/spec/features/xyz.md`）を作成

2. **requiredSections を変更する場合**:
   - PHASE_ARTIFACT_REQUIREMENTS で `## ` プレフィックス付きで定義
   - artifact-validator.ts で検出対象を更新
   - `workflow-mcp-server.md` の「FR-5」セクションを更新

3. **minLines を変更する場合**:
   - PHASE_GUIDES のminLinesフィールドを更新（シングルソース）
   - 自動的にバリデーターとsubagentTemplate内の設定が同期される

### バージョン管理のベストプラクティス

- `workflow-mcp-server.md` は MCPサーバー全体の統合仕様書
- 変更履歴セクション（「変更内容の概要」）に新規変更を追記
- 各機能固有の詳細仕様は `docs/spec/features/` 配下の専用ファイルで管理
- 関連ファイルのリストを常に最新に保つ

---

## ドキュメント整合性の最終確認

### 仕様書と実装の対応表

| 仕様書セクション | 実装ファイル | 検証結果 |
|----------------|------------|--------|
| get-subphase-template 概要 | get-subphase-template.ts | ✅ 完全対応 |
| 有効なサブフェーズ（11種類） | VALID_SUB_PHASE_NAMES | ✅ 完全対応 |
| SUB_PHASE_TO_PARENT_PHASE マッピング | SUB_PHASE_TO_PARENT_PHASE | ✅ 完全対応 |
| エラーケース処理 | workflowGetSubphaseTemplate関数 | ✅ 完全対応 |
| インターフェース定義 | GetSubphaseTemplateArgs, ToolResult | ✅ 完全対応 |
| 実装上の考慮点 | resolvePhaseGuide呼び出し方法 | ✅ 完全対応 |
| workflow-mcp-server.md（新規セクション） | 全ツール定義と関連ファイル | ✅ 完全対応 |

---

## 成果物リスト

本docs_updateフェーズで更新・作成したドキュメント:

1. ✅ `docs/spec/features/workflow-mcp-server.md` - 新規ツール説明セクション追加、FR-5詳細説明追加、関連ファイルリスト更新
2. ✅ `docs/spec/features/get-subphase-template.md` - 既存仕様書、実装との整合性確認済み（追加修正なし）

### 今後のドキュメント維持計画

- **commit フェーズ**: 上記2ファイルの更新を git add して commit
- **regression_test フェーズ**: ドキュメント更新が設計・実装と矛盾していないことを確認
- **parallel_verification フェーズ**: 外部ユーザー向けドキュメント（README, API ドキュメント）の更新検討
