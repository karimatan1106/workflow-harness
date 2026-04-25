# テスト設計書: 全フェーズへのワークフロー制御ツール呼び出し禁止指示追加

## サマリー

- **目的**: FR-19-1〜FR-19-4（計21フェーズへの禁止指示追加）の実装を検証するテスト設計書である。`workflow-plugin/mcp-server/src/phases/definitions.ts` の変更を対象とし、各フェーズのsubagentTemplateに「★ワークフロー制御ツール禁止★」セクションが正しく追加されることをテストする。
- **主要な決定事項**: 既存の `definitions-subagent-template.test.ts` ファイルに新規テストスイートを追加するアプローチを採用する。新規テストファイルを作成する方法も考えられるが、既存のテストファイルに追加することでテストの凝集性を維持できる。テストはTDD Redフェーズで先に作成し、implementationフェーズでの実装後にGreenとなることを確認する。
- **次フェーズで必要な情報**: テストファイルのパス（`workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts`）および対象ソースファイルのパス（`workflow-plugin/mcp-server/src/phases/definitions.ts`）。実装フェーズではFR-19-1の直線フェーズから順に実装を進めることを推奨する。

## テスト方針

### 対象ファイルと変更範囲

実装対象のソースファイルは以下の1ファイルのみである。
- ソースファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（現在の行数: 1595行）
- テストファイル: `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts`（既存ファイルに追記）

テスト対象は `resolvePhaseGuide` 関数を通じて取得できる各フェーズの `subagentTemplate` プロパティである。
`resolvePhaseGuide` はすでにexportされており、テストからimportして使用できる状態にある。

### テスト種別の定義

FR-19の変更は文字列への追記のみであるため、以下の2種別に絞ってテストを設計する。

ユニットテストとして、各フェーズの `subagentTemplate` に禁止指示セクションのヘッダー文字列が含まれることを `toContain` で検証する。
リグレッションテストとして、既存の禁止指示が存在する4フェーズ（`test_impl`・`testing`・`regression_test`・`docs_update`）の禁止指示内容が変更されていないことを検証する。

### テスト実行コマンド

テストスイート全体を実行するコマンドは以下のとおりである。
```
cd workflow-plugin/mcp-server && npm test -- --run
```

個別のテストファイルのみを実行する場合は以下のコマンドを使用する。
```
cd workflow-plugin/mcp-server && npm test -- --run src/phases/__tests__/definitions-subagent-template.test.ts
```

### テスト合格判定基準

全テスト件数（既存945件以上 + 新規追加分）が全件パスすることを合格基準とする。
特に、新規追加する21フェーズ分のテスト（FR-19-1〜FR-19-4）が全件合格すること。
既存の4フェーズ（リグレッションテスト対象）のテストが引き続き合格すること。

## テストケース

### FR-19-1: 直線フェーズ（6フェーズ）への禁止指示追加テスト

対象フェーズは `research`・`requirements`・`implementation`・`refactoring`・`ci_verification`・`deploy` の6フェーズである。
各フェーズのsubagentTemplateに「★ワークフロー制御ツール禁止★」ヘッダーが含まれることを検証する。
禁止ツールの列挙（`workflow_next`・`workflow_approve`・`workflow_complete_sub`・`workflow_start`・`workflow_reset`）が含まれることも検証する。

**TC-19-1-1: researchフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('research', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」という文字列が含まれること
- 正常系: テンプレートに「workflow_next」が含まれること（禁止ツールのリストとして）
- 異常系: テンプレートが空文字列またはundefinedでないこと（フェーズ定義自体が壊れていないことの確認）

**TC-19-1-2: requirementsフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('requirements', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」という文字列が含まれること
- 正常系: テンプレートに「workflow_next」が含まれること
- 既存機能の保持確認: テンプレートに「requirements.md」が含まれること（既存の入力ファイル指示が消えていないことを確認する）

**TC-19-1-3: implementationフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('implementation', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」という文字列が含まれること
- 正常系: テンプレートに「workflow_next」が含まれること
- 既存機能の保持確認: テンプレートに「TDD Green」が含まれること（既存のTDD指示が消えていないことを確認する）

**TC-19-1-4: refactoringフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('refactoring', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」という文字列が含まれること
- 正常系: テンプレートに「workflow_next」が含まれること
- 既存機能の保持確認: テンプレートに「リファクタリング」または「Refactor」が含まれること（既存のリファクタリング指示が消えていないことを確認する）

**TC-19-1-5: ci_verificationフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('ci_verification', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」という文字列が含まれること
- 正常系: テンプレートに「workflow_next」が含まれること

**TC-19-1-6: deployフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('deploy', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」という文字列が含まれること
- 正常系: テンプレートに「workflow_next」が含まれること

### FR-19-2: 並列サブフェーズ（11フェーズ）への禁止指示追加テスト

対象フェーズは `threat_modeling`・`planning`・`state_machine`・`flowchart`・`ui_design`・`build_check`・`code_review`・`manual_test`・`security_scan`・`performance_test`・`e2e_test` の11フェーズである。
並列サブフェーズは親フェーズの `subPhases` プロパティ配下に定義されているため、`resolvePhaseGuide` で親フェーズを取得してから `subPhases` 経由でアクセスする。
並列サブフェーズ用禁止指示は `workflow_complete_sub` に特別な説明が追加される点が直線フェーズ用と異なる。

**TC-19-2-1: threat_modelingサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_analysis', 'docs/workflows/test')?.subPhases?.threat_modeling?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること（並列フェーズ特有の禁止ツールとして）
- 既存機能の保持確認: テンプレートに「threat-model.md」が含まれること（既存の出力ファイル指示が消えていないことを確認する）

**TC-19-2-2: planningサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_analysis', 'docs/workflows/test')?.subPhases?.planning?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること
- 既存機能の保持確認: テンプレートに「spec.md」が含まれること（既存の出力ファイル指示が消えていないことを確認する）

**TC-19-2-3: state_machineサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_design', 'docs/workflows/test')?.subPhases?.state_machine?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること

**TC-19-2-4: flowchartサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_design', 'docs/workflows/test')?.subPhases?.flowchart?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること

**TC-19-2-5: ui_designサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_design', 'docs/workflows/test')?.subPhases?.ui_design?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること

**TC-19-2-6: build_checkサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_quality', 'docs/workflows/test')?.subPhases?.build_check?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること

**TC-19-2-7: code_reviewサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_quality', 'docs/workflows/test')?.subPhases?.code_review?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること
- 既存機能の保持確認: テンプレートに「設計-実装整合性」が含まれること（既存のコードレビュー指示が消えていないことを確認する）

**TC-19-2-8: manual_testサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_verification', 'docs/workflows/test')?.subPhases?.manual_test?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること
- 既存機能の保持確認: テンプレートに「総合評価」が含まれること（FR-11で追加された既存ガイダンスが消えていないことを確認する）

**TC-19-2-9: security_scanサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_verification', 'docs/workflows/test')?.subPhases?.security_scan?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること
- 既存機能の保持確認: テンプレートに「20行」が含まれること（FR-12で追加された既存ガイダンスが消えていないことを確認する）

**TC-19-2-10: performance_testサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_verification', 'docs/workflows/test')?.subPhases?.performance_test?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること
- 既存機能の保持確認: テンプレートに「総合評価」が含まれること（FR-9で追加された既存ガイダンスが消えていないことを確認する）

**TC-19-2-11: e2e_testサブフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('parallel_verification', 'docs/workflows/test')?.subPhases?.e2e_test?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_complete_sub」が含まれること
- 既存機能の保持確認: テンプレートに「e2e-test.md」が含まれること（既存の出力ファイル指示が消えていないことを確認する）

### FR-19-3: 承認フェーズ（2フェーズ）への禁止指示追加テスト

対象フェーズは `design_review` と `test_design` の2フェーズである。
承認フェーズ用禁止指示は `workflow_approve` への特別な説明として「このフェーズはユーザー承認が必要」という文言が追加される点が直線フェーズ用と異なる。
これにより、subagentが設計レビューやテスト設計のレビュー結果を自律的に承認するリスクを防止できる。

**TC-19-3-1: design_reviewフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('design_review', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_approve」が含まれること（承認ツールの禁止として）
- 正常系: テンプレートに「ユーザー承認」が含まれること（承認フェーズ特有の説明として）

**TC-19-3-2: test_designフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('test_design', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_approve」が含まれること
- 正常系: テンプレートに「ユーザー承認」が含まれること

### FR-19-4: git操作フェーズ（2フェーズ）への禁止指示追加テスト

対象フェーズは `commit` と `push` の2フェーズである。
git操作フェーズ用禁止指示は `workflow_next` への特別な説明として「git操作完了後に自律的に次フェーズへ移行することは禁止」という文言が追加される。
さらに、FR-15で実際に発生した連鎖パターン（commitがworkflow_nextを呼び出し→push→ci_verification）を具体的に記述することで、subagentが禁止理由を理解しやすくする。

**TC-19-4-1: commitフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('commit', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_next」が含まれること（連鎖禁止の説明として）
- 正常系: テンプレートに「git操作」が含まれること（git操作フェーズ特有の説明として）
- 既存機能の保持確認: テンプレートに「git status」が含まれること（既存のコミット手順が消えていないことを確認する）

**TC-19-4-2: pushフェーズの禁止指示追加確認**
- テスト対象: `resolvePhaseGuide('push', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること
- 正常系: テンプレートに「workflow_next」が含まれること
- 正常系: テンプレートに「git操作」が含まれること
- 既存機能の保持確認: テンプレートに「ブランチ」が含まれること（既存のブランチ確認手順が消えていないことを確認する）

### AC-5: 既存フェーズ非干渉テスト（リグレッション防止）

このテストグループは既存の禁止指示が変更されていないことを検証するリグレッションテストである。
既存4フェーズ（`test_impl`・`testing`・`regression_test`・`docs_update`）の禁止指示テキストが今回の変更によって変化していないことを確認する。

**TC-AC5-1: test_implフェーズの既存禁止指示が変更されていないことの確認**
- テスト対象: `resolvePhaseGuide('test_impl', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「TDD Red」が含まれること（既存テストの継続確認）
- 正常系: テンプレートに「workflow_record_test」が含まれること（既存の記録手順が保持されていることの確認）
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること（既存の禁止指示が消えていないことの確認）

**TC-AC5-2: testingフェーズの既存禁止指示が変更されていないことの確認**
- テスト対象: `resolvePhaseGuide('testing', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「workflow_capture_baseline」が含まれること（既存テストの継続確認）
- 正常系: テンプレートに「workflow_record_test_result」が含まれること（既存の結果記録手順が保持されていることの確認）
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること（既存の禁止指示が消えていないことの確認）
- 正常系: テンプレートに「sessionToken」が含まれること（FR-2で追加されたsessionToken制限が保持されていることの確認）

**TC-AC5-3: regression_testフェーズの既存禁止指示が変更されていないことの確認**
- テスト対象: `resolvePhaseGuide('regression_test', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「ベースライン前提条件」が含まれること（既存テストの継続確認）
- 正常系: テンプレートに「workflow_capture_baseline」が含まれること（既存の禁止対象リストが保持されていることの確認）
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること（既存の禁止指示が消えていないことの確認）
- 正常系: テンプレートに「workflow_back」が含まれること（FR-FIXで追加された差し戻し手順が保持されていることの確認）

**TC-AC5-4: docs_updateフェーズの既存禁止指示が変更されていないことの確認**
- テスト対象: `resolvePhaseGuide('docs_update', 'docs/workflows/test')?.subagentTemplate`
- 正常系: テンプレートに「ドキュメントを更新してください」が含まれること（既存テストの継続確認）
- 正常系: テンプレートに「MEMORY.md」が含まれること（既存の更新禁止ファイル指示が保持されていることの確認）
- 正常系: テンプレートに「★ワークフロー制御ツール禁止★」が含まれること（既存の禁止指示が消えていないことの確認）

### AC-1〜AC-4: カバレッジ・テキスト長・統合確認テスト

**TC-AC1: 全21フェーズへの禁止指示追加の網羅確認**
- テスト対象: 直線フェーズ6 + 並列サブフェーズ11 + 承認フェーズ2 + git操作フェーズ2 = 合計21フェーズ
- 正常系: 上記TC-19-1-1〜TC-19-4-2の全21テストが合格すること
- 正常系: 全21フェーズのsubagentTemplateが非空文字列であること（フェーズ定義が削除されていないことの確認）

**TC-AC2: フェーズ分類と禁止指示テンプレート種別の正確性確認**
- 直線フェーズ用禁止指示（FR-19-1）は `workflow_complete_sub` に特別な説明がないことを確認する（直線フェーズは並列サブフェーズではないため）
- 並列サブフェーズ用禁止指示（FR-19-2）は `workflow_complete_sub` に「このツールは並列フェーズの各サブフェーズ完了をOrchestratorが宣言するためのものであり」という説明が含まれることを確認する
- 承認フェーズ用禁止指示（FR-19-3）は `workflow_approve` に「ユーザー承認が必要」という説明が含まれることを確認する
- git操作フェーズ用禁止指示（FR-19-4）は `workflow_next` に「連鎖」または「連続して」という説明が含まれることを確認する

**TC-AC4: 禁止指示テキストの長さ確認（50文字超過）**
- 各フェーズの禁止指示テキストが50文字を超えることを確認する（仕様書AC-4の要件）
- 「★ワークフロー制御ツール禁止★」のヘッダー文字列自体が14文字であり、禁止ツールのリストと終了指示を合わせると必然的に50文字を超える設計となっているため、このテストは実装後に自然と合格する

### 境界値テスト・エラーハンドリングテスト

**TC-BV-1: resolvePhaseGuideに無効なフェーズ名を渡した場合の動作確認**
- テスト対象: `resolvePhaseGuide('invalid_phase_name', 'docs/workflows/test')`
- 正常系: 戻り値が `null` または `undefined` であること（存在しないフェーズ名への安全な対応）
- このテストは既存のテストスイートで検証済みであるため、リグレッション確認として実施する

**TC-BV-2: resolvePhaseGuideに空文字列のdocsDirを渡した場合の動作確認**
- テスト対象: `resolvePhaseGuide('research', '')`
- 正常系: 例外をスローするか、出力ファイルパスが空文字を含む形式になること（実装に依存する）
- このテストは既存のテストスイートで検証済みであるため、リグレッション確認として実施する

**TC-BV-3: 全25フェーズのsubagentTemplateが非空文字列であることの確認**
- テスト対象: PHASE_GUIDESに定義されている全フェーズ（直線フェーズおよびサブフェーズを含む）
- 正常系: 全フェーズの `subagentTemplate` プロパティが空文字列でないこと
- 目的: FR-19の変更による意図しない文字列の切断や削除が発生していないことを確認する
