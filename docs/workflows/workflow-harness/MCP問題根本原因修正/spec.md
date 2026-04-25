# MCP問題根本原因修正 - 仕様書

## サマリー

本仕様書はworkflow-pluginの6件の問題を修正するための技術仕様を定義する。
BUG-2はartifact-validator.tsの密度計算式を構造行除外方式に変更する修正である。
BUG-3はbash-whitelist.jsとenforce-workflow.jsにワークフロー成果物ディレクトリの操作許可を追加する修正である。
SEC-ENV-1はbash-whitelist.jsにインライン環境変数設定の検出ロジックを追加する修正である。
SEC-TIME-1はmanager.tsのセッショントークン比較をcrypto.timingSafeEqual()に変更する修正である。
SEC-LOG-1はphase-edit-guard.jsにコマンドログのマスキング処理を追加する修正である。
修正対象は5ファイルで、全てworkflow-pluginディレクトリ内のファイルである。
後方互換性を維持し、既存のワークフロー動作に影響を与えないことを最優先とする。

## 概要

workflow-pluginは19フェーズのワークフローをMCPサーバーとhookシステムで制御する開発支援ツールである。
前回のレビュー指摘事項修正タスクで3つの実行時問題と3つのセキュリティ課題が発生した。
問題の根本原因は密度計算の設計欠陥、hookシステムの設定不足、セキュリティチェックの不完全さにある。
本仕様書では各問題に対する最小限かつ効果的な修正方針を定義する。
全ての修正は既存の動作を壊さず、新たなセキュリティリスクを生まないことを保証する。

## 実装計画

実装は以下の順序で5ファイルを修正する。
第1ステップでartifact-validator.tsの密度計算式を修正する（BUG-2）。
第2ステップでbash-whitelist.jsにmkdirホワイトリストとインライン環境変数検出を追加する（BUG-3、SEC-ENV-1）。
第3ステップでenforce-workflow.jsのWORKFLOW_CONFIG_PATTERNSにdocs/workflows/パターンを追加する（BUG-3）。
第4ステップでmanager.tsのisSessionTokenValid()をtimingSafeEqual()に変更する（SEC-TIME-1）。
第5ステップでphase-edit-guard.jsにmaskSensitiveInfo()関数を追加する（SEC-LOG-1）。
各ステップは独立しており、個別にテスト可能な単位である。

## 技術仕様

SPEC-1（BUG-2）はartifact-validator.tsのcheckSectionDensity()関数を修正する。
現在の密度計算式 substantiveCount / totalLines を substantiveCount / (totalLines - structuralCount) に変更する。
structuralCountは空行とisStructuralLine()がtrueの行をカウントした値である。
effectiveTotalが0以下の場合は密度を0とし、minSubstantiveLinesチェックで捕捉する。
MIN_SECTION_DENSITYのデフォルト値0.3は維持する（計算式変更で実質緩和されるため）。
SPEC-2（BUG-3）はbash-whitelist.jsのreadonlyホワイトリストにmkdir -pを追加する。
validateMkdirTarget()関数を新設し、docs/workflows/、docs/security/、.claude/state/へのパスのみ許可する。
enforce-workflow.jsのWORKFLOW_CONFIG_PATTERNSにdocs/workflows/パターンを追加する。
SPEC-3（SEC-ENV-1）はbash-whitelist.jsにcheckInlineEnvAssignment()関数を新設する。
正規表現でVAR=value command形式を検出し、SECURITY_ENV_VARSに含まれる変数をブロックする。
SPEC-4（SEC-TIME-1）はmanager.tsのisSessionTokenValid()をcrypto.timingSafeEqual()に変更する。
Buffer.from()でUTF-8バッファに変換し、長さチェック後にtimingSafeEqual()で比較する。
SPEC-5（SEC-LOG-1）はphase-edit-guard.jsにmaskSensitiveInfo()関数を新設する。
パスワード、トークン、APIキー等の機密パターンをREDACTEDに置換する。

## 変更対象ファイル

workflow-plugin/mcp-server/src/validation/artifact-validator.ts のcheckSectionDensity関数内の密度計算ロジックを6行程度変更する。
workflow-plugin/hooks/bash-whitelist.js のreadonly配列にmkdir -pを追加しvalidateMkdirTargetとcheckInlineEnvAssignment関数を新設する。
workflow-plugin/hooks/enforce-workflow.js のWORKFLOW_CONFIG_PATTERNS配列に1行のパターンを追加する。
workflow-plugin/mcp-server/src/state/manager.ts のisSessionTokenValid関数内の比較を4行変更しimport文にtimingSafeEqualを追加する。
workflow-plugin/hooks/phase-edit-guard.js のmaskSensitiveInfo関数を新設しログ記録箇所を修正する。
テストはworkflow-plugin/mcp-server/src/validation/__tests__/ ディレクトリに追加する。

## 影響範囲

BUG-2の修正により以前バリデーション失敗していた正当な文書がパスするようになる。
BUG-3の修正によりワークフロー実行中のmkdir/Write操作がユーザー確認なしで実行される。
SEC-ENV-1の修正によりインライン環境変数設定のコマンドがブロックされるようになる。
SEC-TIME-1の修正はAPI動作に変更なし（内部比較方式のみ変更）である。
SEC-LOG-1の修正によりログに記録されるコマンド文字列の一部がマスキングされる。
既存のテストスイートに影響を与える変更はなく新規テストを追加して検証する。
