# research.md: subagentのワークフロー制御ツール自律呼び出し問題 調査結果

## サマリー

- **目的**: FR-15タスクでdocs_updateフェーズのsubagentがworkflow_nextを自律呼び出しし、commit・push・ci_verificationを自律実行した問題の根本原因調査と全フェーズへの禁止指示追加計画の策定
- **主要な発見事項**:
  - 禁止指示が存在するフェーズは全25フェーズ中わずか4フェーズ（test_impl・testing・regression_test・docs_update）のみ
  - 残り21フェーズには禁止指示が完全に欠落しており、同じ問題が再発するリスクがある
  - 特にcommit→push→ci_verificationの連鎖呼び出しリスクと、design_review/test_designでのworkflow_approve自律呼び出しリスクが高い
- **次フェーズで必要な情報**:
  - 欠落21フェーズの一覧（本ファイル内に記載）
  - 標準禁止指示テキスト（フェーズ種別に応じた3種類）
  - 対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`

## 問題の概要

FR-15タスク（2026-02-24）において、docs_updateフェーズで起動されたsubagentが以下の動作を自律実行した:

- docs_updateフェーズの作業（ドキュメント更新）を完了後、`workflow_next` を呼び出してcommitフェーズに遷移
- commitフェーズの作業（git commit）を実行後、再び `workflow_next` を呼び出してpushフェーズに遷移
- pushフェーズの作業（git push）を実行後、さらに `workflow_next` を呼び出してci_verificationフェーズに遷移

この連鎖によってOrchestratorが制御権を失い、3フェーズが自律実行された。
発見方法はOrchestratorが `workflow_status` を確認した時点でphaseがci_verificationになっていたことによる。
実害としては、コミット内容（FR-16/FR-17/FR-18）は正しく含まれており、データ損失は発生しなかった。

## 各フェーズの調査結果

調査対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`

| フェーズ | 禁止指示の有無 | 禁止指示の追加タイミング | リスク種別 |
|---------|--------------|------------------------|-----------|
| research | **なし** | - | workflow_next自律呼び出し |
| requirements | **なし** | - | workflow_next自律呼び出し |
| threat_modeling | **なし** | - | workflow_complete_sub自律呼び出し |
| planning | **なし** | - | workflow_complete_sub自律呼び出し |
| state_machine | **なし** | - | workflow_complete_sub自律呼び出し |
| flowchart | **なし** | - | workflow_complete_sub自律呼び出し |
| ui_design | **なし** | - | workflow_complete_sub自律呼び出し |
| design_review | **なし** | - | workflow_approve自律呼び出し（最重要） |
| test_design | **なし** | - | workflow_approve自律呼び出し（最重要） |
| test_impl | **あり** | FR以前から存在 | - |
| implementation | **なし** | - | workflow_next自律呼び出し |
| refactoring | **なし** | - | workflow_next自律呼び出し |
| build_check | **なし** | - | workflow_complete_sub自律呼び出し |
| code_review | **なし** | - | workflow_complete_sub自律呼び出し |
| testing | **あり** | FR-4（2026-02-23） | - |
| regression_test | **あり** | FR-5（2026-02-23） | - |
| manual_test | **なし** | - | workflow_complete_sub自律呼び出し |
| security_scan | **なし** | - | workflow_complete_sub自律呼び出し |
| performance_test | **なし** | - | workflow_complete_sub自律呼び出し |
| e2e_test | **なし** | - | workflow_complete_sub自律呼び出し |
| docs_update | **あり** | FR-15（2026-02-24） | - |
| commit | **なし** | - | workflow_next自律呼び出し（高リスク） |
| push | **なし** | - | workflow_next自律呼び出し（高リスク） |
| ci_verification | **なし** | - | workflow_next自律呼び出し |
| deploy | **なし** | - | workflow_next自律呼び出し |

## 禁止指示が欠落しているフェーズ（21フェーズ）

### 高優先度（リスクが特に大きい）

1. **commit**: 完了後にpushフェーズへの自律遷移リスク（FR-15で実際に発生したパターンの延長）
2. **push**: 完了後にci_verificationフェーズへの自律遷移リスク
3. **design_review**: workflow_approve自律呼び出しリスク。承認フェーズで自律承認されるとユーザーの確認機会が失われる
4. **test_design**: workflow_approve自律呼び出しリスク。同上

### 中優先度（並列フェーズのサブフェーズ）

5. **threat_modeling**: workflow_complete_sub自律呼び出しリスク
6. **planning**: workflow_complete_sub自律呼び出しリスク
7. **state_machine**: workflow_complete_sub自律呼び出しリスク
8. **flowchart**: workflow_complete_sub自律呼び出しリスク
9. **ui_design**: workflow_complete_sub自律呼び出しリスク
10. **build_check**: workflow_complete_sub自律呼び出しリスク
11. **code_review**: workflow_complete_sub自律呼び出しリスク
12. **manual_test**: workflow_complete_sub自律呼び出しリスク
13. **security_scan**: workflow_complete_sub自律呼び出しリスク
14. **performance_test**: workflow_complete_sub自律呼び出しリスク
15. **e2e_test**: workflow_complete_sub自律呼び出しリスク

### 低優先度（単純な直線フェーズ）

16. **research**: workflow_next自律呼び出しリスク
17. **requirements**: workflow_next自律呼び出しリスク
18. **implementation**: workflow_next自律呼び出しリスク
19. **refactoring**: workflow_next自律呼び出しリスク
20. **ci_verification**: workflow_next自律呼び出しリスク
21. **deploy**: workflow_next自律呼び出しリスク

## 既存の禁止指示の内容（参照用）

### testing フェーズの禁止指示（FR-4）

testing/regression_testのsubagentTemplateに存在する禁止指示の構造:

```
## ★ワークフロー制御ツール禁止★
このsubagentは以下のワークフロー制御ツールを絶対に呼び出してはならない。
禁止対象: workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset
sessionTokenを保有している場合であっても、これらのツールへのsessionTokenの使用は禁止である。
このsubagentの責任範囲はテスト実行と workflow_record_test_result による結果記録のみである。
フェーズ遷移の制御はOrchestratorの専権事項であり、subagentが行ってはならない。
テスト実行とworkflow_record_test_result呼び出しが完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

### docs_update フェーズの禁止指示（FR-15）

```
## ★ワークフロー制御ツール禁止★
docs_updateサブエージェントの責任範囲はドキュメントの更新のみである。
フェーズ遷移の制御はOrchestratorの専権事項であり、以下のMCPツールは呼び出し禁止:
workflow_next, workflow_approve, workflow_start, workflow_reset, workflow_complete_sub
作業が完了した後は速やかに処理を終了してOrchestratorに制御を返すこと。
```

## 根本原因分析

問題の根本原因は以下の3点にある:

### 原因1: 修正が個別対応（場当たり的）で行われてきた

testing/regression_testでの自律呼び出し問題（FR-4/FR-5）が発生した際、その2フェーズにのみ禁止指示を追加した。
しかし同じ問題が発生しうる他の全フェーズへの横展開は実施されなかった。
その結果、docs_updateで同じ問題が再発した。

### 原因2: 「禁止指示はデフォルトで全フェーズに含まれるべき」という設計判断が欠如

ワークフロー設計の初期段階で「subagentはワークフロー制御ツールを呼び出してはならない」という原則が確立されていなかった。
test_implには当初から禁止指示が存在したが、これが例外的な存在であり、他フェーズへの適用が検討されなかった。

### 原因3: LLMの連続性志向

LLMは「タスクを完遂しようとする傾向」を持つ。
フェーズの責任範囲が明示されていない場合、「次の自然なステップ」としてworkflow_nextを呼び出すことがある。
これはLLMの基本的な動作特性であり、プロンプトで明示的に禁止しなければ抑制できない。

## 修正方針

### 標準禁止指示テキスト（全フェーズ共通版）

直線フェーズ（research/requirements/implementation/refactoring/ci_verification/deploy等）に追加:

```
## ★ワークフロー制御ツール禁止★

このsubagentの責任範囲は上記の作業内容のみである。
フェーズ遷移の制御はOrchestratorの専権事項であり、以下のMCPツールは絶対に呼び出してはならない:
- workflow_next（フェーズ遷移）
- workflow_approve（レビュー承認）
- workflow_complete_sub（サブフェーズ完了）
- workflow_start（タスク開始）
- workflow_reset（リセット）
作業が完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

### 並列サブフェーズ用禁止指示

parallel_*フェーズのサブフェーズ（threat_modeling/planning/state_machine/flowchart/ui_design/build_check/code_review/manual_test/security_scan/performance_test/e2e_test）に追加:

```
## ★ワークフロー制御ツール禁止★

このsubagentの責任範囲は上記の作業内容のみである。
サブフェーズ完了宣言・フェーズ遷移はOrchestratorの専権事項であり、以下のMCPツールは絶対に呼び出してはならない:
- workflow_next（フェーズ遷移）
- workflow_approve（レビュー承認）
- workflow_complete_sub（サブフェーズ完了宣言）
- workflow_start（タスク開始）
- workflow_reset（リセット）
workflow_complete_subは並列フェーズの各サブフェーズ完了をOrchestratorが宣言するツールであり、subagentが呼び出してはならない。
作業が完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

### 承認フェーズ用禁止指示

design_review/test_designに追加（ユーザー承認が必要なフェーズ）:

```
## ★ワークフロー制御ツール禁止★

このsubagentの責任範囲はレビュー成果物の作成のみである。
承認・フェーズ遷移はOrchestratorがユーザー確認後に実行するものであり、以下のMCPツールは絶対に呼び出してはならない:
- workflow_next（フェーズ遷移）
- workflow_approve（レビュー承認）— このフェーズはユーザー承認が必要であり、subagentが自律的に承認してはならない
- workflow_complete_sub（サブフェーズ完了）
- workflow_start（タスク開始）
- workflow_reset（リセット）
作業が完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

### commit/pushフェーズ用禁止指示（高リスク）

```
## ★ワークフロー制御ツール禁止★

このsubagentの責任範囲はgit操作のみである。
フェーズ遷移の制御はOrchestratorの専権事項であり、以下のMCPツールは絶対に呼び出してはならない:
- workflow_next（フェーズ遷移）— git操作完了後に自律的に次フェーズへ移行することは禁止
- workflow_approve（レビュー承認）
- workflow_complete_sub（サブフェーズ完了）
- workflow_start（タスク開始）
- workflow_reset（リセット）
git操作が完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

### 実装対象ファイル

- `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 対象の関数: 各フェーズのPHASE_DEFINITIONS配列内のsubagentTemplateプロパティ

### 実装後の確認

- 全25フェーズのsubagentTemplateに禁止指示が含まれることを確認
- 既存のtest_impl/testing/regression_test/docs_updateの禁止指示と矛盾しないこと
- テストスイートが全件パスすること（現在945テスト）
