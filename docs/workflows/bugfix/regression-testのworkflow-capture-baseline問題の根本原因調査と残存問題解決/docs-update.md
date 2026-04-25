## サマリー

このdocs_updateフェーズでは、前回のregressionテスト問題対応によるCLAUDE.mdの変更内容が、永続的なエンタープライズドキュメント（docs/spec/, docs/architecture/等）への反映を必要とするかどうかを評価しました。

CLAUDE.mdのルール20に追記された2行（700-701行目）は、workflow_capture_baseline呼び出し時の制御フロー・フェーズスキップロジック・強制遷移時の潜在的リスクに関する詳細な説明です。
この内容は、Orchestratorへの手続き的な指示（ワークフロー制御ロジック・フェーズ間の依存関係）であり、システムアーキテクチャ・API仕様・機能仕様などの永続的な実装設計に影響しません。

評価結果として、永続ドキュメント（docs/spec/features/, docs/spec/api/, docs/architecture/modules/ 等）に対する更新は不要と判断されました。

## 更新対象の確認

永続ドキュメント群の各カテゴリについて、CLAUDE.mdのルール20追記による影響を評価しました。

### 機能仕様書（docs/spec/features/）への影響評価
このプロジェクトのdocs/spec/features/ディレクトリには、ワークフロー機能（workflow-dashboard.md, test-tracking.md, known-bugs.md）およびシステム機能（artifact-validator.md, hmac-key-management.md, bash-whitelist.md等）の仕様書が配置されています。
ルール20の追記内容（calculatePhaseSkips設計・forceTransition使用時の注意）は、MCP内部のワークフロー制御ロジックに関する手続き説明であり、ユーザー向けの機能仕様には該当しません。
したがって、機能仕様書への更新は不要です。

### API仕様書（docs/spec/api/）への影響評価
CLAUDE.mdのルール20は、workflow_capture_baselineとworkflow_backという既存MCP API の呼び出しタイミング・前提条件に関する説明です。
APIシグネチャ自体の変更（入力・出力パラメータの変更、新しいエンドポイントの追加）がないため、workflow-api.mdへの更新は不要です。

### アーキテクチャ設計書（docs/architecture/）への影響評価
docs/architecture/modules/ 以下のモジュール設計書は、システムコンポーネントの責務・インターフェース・アーキテクチャパターンを記述します。
ルール20の追記（faseスキップ設計とforceTransition安全性）は、既にMCPサーバー側で実装済みのロジックの説明であり、新しいアーキテクチャ判断や設計パターンの追加ではありません。
したがって、アーキテクチャ設計書への更新は不要です。

### ワークフロー設計書（docs/architecture/workflow）への影響評価
本プロジェクトにはdocs/architecture/workflow/ ディレクトリが存在しません。
ワークフロー全体の運用設計はCLAUDE.mdで一元管理されているため、ドキュメント分散による重複は回避されています。
したがって、新しいドキュメント作成は不要です。

### テスト計画・テスト結果（docs/testing/）への影響評価
ルール20はregression_testフェーズの実行条件・前提条件に関する説明ですが、これはテスト計画書（docs/testing/plans/）の作成段階では既に記述されるべき事項です。
テスト計画書において、「ベースラインが前提条件となる」「強制遷移時の注意」などはテストシナリオの前提条件として盛り込まれています。
したがって、既存テスト計画への追加・修正は不要です。

### セキュリティ設計（docs/security/）への影響評価
ルール20の追記内容はセキュリティに関わるロジックではなく、フェーズ制御・テスト実行の前提条件です。
脅威モデル・セキュリティ対策・HMAC整合性などの記述は既にdocs/security/threat-models/ で管理されています。
したがって、セキュリティドキュメントへの更新は不要です。

## 更新結果

上記の評価に基づき、以下の結論に達しました：

CLAUDE.mdのルール20追記は、既にMCPサーバー側で実装済みの内部制御ロジック（faseスキップの自動化、forceTransition時のベースライン必須化）に関する説明を追加したものです。
この追記は、Orchestratorが正しくワークフロー制御を行うための手続き的なガイダンスであり、ユーザー向けの永続的な仕様・アーキテクチャ・API定義の変更を伴いません。

したがって、docs/spec/, docs/architecture/, docs/security/, docs/testing/ の各カテゴリの永続ドキュメントに対する更新は必要ありません。
CLAUDE.mdの変更のみで、Orchestratorへの指示は充分に伝達されます。

このdocs_updateフェーズの終了により、前回のregression_test問題対応によるドキュメント整備プロセスは完結します。

