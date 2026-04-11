# ワークフローフェーズプロンプト

各ワークフローフェーズのプロンプトテンプレートを格納するディレクトリです。

## フェーズ一覧（19フェーズ）

1. research.md - 調査フェーズ
2. requirements.md - 要件定義フェーズ
3. threat_modeling.md - 脅威モデリング（parallel_analysis）
4. planning.md - 計画（parallel_analysis）
5. state_machine.md - ステートマシン図作成（parallel_design）
6. flowchart.md - フローチャート作成（parallel_design）
7. ui_design.md - UI設計（parallel_design）
8. design_review.md - 設計レビュー
9. test_design.md - テスト設計
10. test_impl.md - テスト実装
11. implementation.md - 実装
12. refactoring.md - リファクタリング
13. build_check.md - ビルドチェック（parallel_quality）
14. code_review.md - コードレビュー（parallel_quality）
15. testing.md - テスト実行
16. regression_test.md - リグレッションテスト
17. manual_test.md - 手動テスト（parallel_verification）
18. security_scan.md - セキュリティスキャン（parallel_verification）
19. performance_test.md - パフォーマンステスト（parallel_verification）
20. e2e_test.md - E2Eテスト（parallel_verification）
21. docs_update.md - ドキュメント更新
22. commit.md - コミット（プロンプト参照用のみ）
23. push.md - プッシュ（プロンプト参照用のみ）
24. ci_verification.md - CI検証
25. deploy.md - デプロイ

注: commit, push, ci_verification, deployはsubagent不要（メインClaudeでインライン実行）

## 並列グループ

| グループ名 | 含まれるフェーズ |
|-----------|----------------|
| parallel_analysis | threat_modeling, planning |
| parallel_design | state_machine, flowchart, ui_design |
| parallel_quality | build_check, code_review |
| parallel_verification | manual_test, security_scan, performance_test, e2e_test |

## フェーズ順序

research → requirements → parallel_analysis（threat_modeling + planning）→ parallel_design（state_machine + flowchart + ui_design）→ design_review → test_design → test_impl → implementation → refactoring → parallel_quality（build_check + code_review）→ testing → regression_test → parallel_verification（manual_test + security_scan + performance_test + e2e_test）→ docs_update → commit → push → ci_verification → deploy → completed

## 各フェーズの責務

| フェーズ | 責務 | subagent_type | model |
|---------|------|---------------|-------|
| research | 既存コードの調査・理解 | Explore | haiku |
| requirements | 要件の明確化・仕様書作成 | general-purpose | sonnet |
| threat_modeling | セキュリティ脅威の分析 | general-purpose | sonnet |
| planning | 実装計画・設計 | Plan | sonnet |
| state_machine | ステートマシン図作成 | general-purpose | haiku |
| flowchart | フローチャート作成 | general-purpose | haiku |
| ui_design | UI/UX設計 | general-purpose | sonnet |
| design_review | 設計の承認（ユーザー確認必須） | general-purpose | haiku |
| test_design | テストケース設計 | Plan | sonnet |
| test_impl | テストコード作成（TDD Red） | general-purpose | sonnet |
| implementation | 実装（TDD Green） | general-purpose | sonnet |
| refactoring | コード品質改善（TDD Refactor） | general-purpose | haiku |
| build_check | ビルド検証 | Bash | haiku |
| code_review | コードレビュー | general-purpose | sonnet |
| testing | テスト実行・品質確認 | Bash | haiku |
| regression_test | リグレッションテスト | general-purpose | haiku |
| manual_test | 手動テスト | general-purpose | haiku |
| security_scan | セキュリティスキャン | Bash | haiku |
| performance_test | パフォーマンステスト | Bash | haiku |
| e2e_test | E2Eテスト | Bash | haiku |
| docs_update | ドキュメント更新 | general-purpose | haiku |
| commit | コミット作成 | - (インライン) | - |
| push | リモートプッシュ | - (インライン) | - |
| ci_verification | CI検証 | - (インライン) | - |
| deploy | デプロイ | - (インライン) | - |

## タスクディレクトリ構成

docs/workflows/{taskName}/ 配下に以下の成果物が生成される:
research.md, requirements.md, threat-model.md, spec.md, state-machine.mmd, flowchart.mmd, ui-design.md, test-design.md, code-review.md, regression-test.md, manual-test.md, security-scan.md, performance-test.md, e2e-test.md
