# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

#### workflow-harness-refactoring: 不要コード・設定の削除
- vscode-ext/ ディレクトリ全削除 (F-001)
- hooks/ 配下のバックアップファイル4件削除 (F-002)
- TaskSize型からsmall/medium分岐を除去、largeのみに統一 (F-006)

### Changed

#### workflow-harness-refactoring: インターフェース更新
- Serena CLIをMCPサーバー化し.mcp.jsonに登録 (F-005)
- workflow-orchestrator.mdのテンプレート取得フローをcoordinator直接MCP呼び出しに更新 (F-003)
- hearing フェーズにdodChecks(userResponse存在チェック)を追加 (F-004)

### Added

#### harness-reporting-fixes: DoDチェック改善とテンプレート品質制約強化
- checkTDDRedEvidence関数にscopeFilesドキュメント免除ロジックを追加(dod-l1-l2.ts)。scopeFilesが全て.md/.mmdの場合、test_implフェーズでTDD Red証拠チェックをpassed:trueで免除する。DOC_ONLY_EXTENSIONS定数とpath.extnameによる拡張子判定を使用。
- ARTIFACT_QUALITY_RULESに全行ユニーク制約を明示追記(definitions-shared.ts)。同一内容の行は最大2回まで、3回以上出現でDoD L4失敗となる旨をsubagentテンプレートに伝達。

#### FR-9: performance_testフェーズのサブエージェントテンプレート拡張（総合評価セクション）
- **対象ファイル**: `workflow-harness/mcp-server/src/phases/definitions.ts`
- **内容**: performance_test フェーズの subagentTemplate に「## 総合評価」セクションのガイダンスを追加しました
- **詳細説明**:
  - 総合評価セクションは、パフォーマンステスト実施後の全体的な評価を記述するセクションです
  - 実質行数5行以上の要件を明示し、十分な説明を求めることで成果物品質を向上させます
  - 評価観点として以下の5つをガイダンス：レスポンス時間、メモリ使用量、スループット、リソース効率、スケーラビリティ
  - サブエージェントがテンプレートを読み込む際に、これらの観点に基づいて構造化された評価結果を生成できるようになります

#### FR-10: performance_testフェーズのサブエージェントテンプレート拡張（テスト実行証拠セクション）
- **対象ファイル**: `workflow-harness/mcp-server/src/phases/definitions.ts`
- **内容**: performance_test フェーズの subagentTemplate に「## テスト実行証拠」セクション（任意）の記述ガイダンスを追加しました
- **詳細説明**:
  - テスト実行証拠は、実際の計測結果（標準出力、ログファイル、JSON結果、スクリーンショット）を貼付するセクションです
  - 任意セクションとすることで、不要な場合はスキップでき、必要な場合は詳細な再現性情報を提供できます
  - 検証者による結果の追認と、後続フェーズでのボトルネック分析を支援します

#### FR-11: パフォーマンステストガイダンス検証テストの追加
- **対象ファイル**: `workflow-harness/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts`
- **テストケース追加**:
  - TC-9-1: performance_testTemplate に総合評価セクションへの言及が含まれていることを検証
  - TC-9-2: 総合評価セクション内で5行以上の実質行要件が明記されていることを検証
  - TC-9-3: 総合評価セクション内で5つの評価観点（全体的なパフォーマンス達成状況）が言及されていることを検証
  - TC-10-1: performance_testTemplate にテスト実行証拠セクションへの言及が含まれていることを検証
  - TC-10-2: テスト実行証拠セクションが任意セクションであることが明記されていることを検証
- **テスト設計思想**:
  - TDD Red フェーズで先行作成されたテストケースを、implementation フェーズで fulfil することで、template 品質を段階的に向上させます
  - リグレッション防止テスト（TC-R-*）も含め、既存機能の安定性を確保します

### Changed

#### performance_testサブエージェントテンプレートの充実化
- **背景**: 並列検証（parallel_verification）フェーズにおいて、performance_test サブフェーズは複数の計測観点を扱う複雑なフェーズです
- **改善内容**: サブエージェントに対し、より具体的な成果物構造（総合評価＋テスト実行証拠）をガイダンスすることで、以下のメリットが得られます：
  - 成果物の構造化が進み、後続フェーズ（ci_verification, deploy, completed）での参照効率が向上
  - サブエージェントが自動的に品質要件を理解し、必要な情報密度を満たす成果物を生成
  - バリデーター（artifact-validator.ts）への合格率が向上

## [Previous Releases]

### Version History
このプロジェクトは継続的にワークフロー機能を改善しており、以下のマイナー改善が過去に実装されています（詳細は Git commit log を参照してください）：
- 4フェーズ承認要件の導入（requirements, design_review, test_design, code_review）
- TDD サイクルと CDD サイクルの統合
- リグレッションテスト・脅威モデリング機能の強化
- バリデーター・プリンター機能の高度化

---

## Notes

- 全変更内容は `git log` で確認できます
- タスク毎の詳細なワークフロー履歴は `docs/workflows/` ディレクトリ配下に保存されます（.gitignore による）
- 製品仕様の永続ドキュメントは `docs/spec/`, `docs/architecture/`, `docs/security/`, `docs/testing/` 配下に管理されます
