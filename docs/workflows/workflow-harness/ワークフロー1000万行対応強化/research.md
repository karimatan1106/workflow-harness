# 調査結果: ワークフロー1000万行対応強化

## 致命的な問題（優先度A）

### P1: テスト結果偽造が可能
- `workflowRecordTestResult`はAIの自己申告を受け入れる
- exitCode=0と書くだけでテスト成功と記録される
- output文字列も任意の内容で通る（50文字以上あれば）
- **対策**: テスト実行をMCPツール内で行い、出力を直接キャプチャ

### P2: 設計検証がパターンマッチのみ
- `design-validator.ts`はクラス名・メソッド名の正規表現マッチ
- 空のクラスや空のメソッドでもパスする
- ステートマシン/フローチャートは要素数カウントのみ
- **対策**: TypeScript Compiler APIによるAST解析

### P3: スコープの正当性検証がない
- AIが`workflowSetScope(taskId, ["dummy.ts"], [])`で通過可能
- 依存関係の静的解析がない
- implementation/refactoring以外のフェーズではスコープチェックなし
- **対策**: import/export解析による依存グラフ構築

### P4: 環境変数バイパス7個+FAIL_OPEN
- SKIP_PHASE_GUARD, SKIP_SPEC_GUARD, SKIP_LOOP_DETECTION, SKIP_DESIGN_VALIDATION, SKIP_ARTIFACT_CHECK, SKIP_TEST_FIRST_CHECK, SKIP_SPEC_SYNC_CHECK
- FAIL_OPEN=trueで全フックのFail Closed無効化
- 使用時の監査ログがない
- **対策**: バイパス使用のログ記録+自動復帰+回数制限

## 構造的弱点（優先度B）

### B1: implementation/refactoring/parallel_qualityで全ファイル編集可能
### B2: Bashコマンドの迂回（base64, 変数間接参照, 別言語）
### B3: ループ検出がファイル間ローテーションを検出不能
### B4: 成果物チェック(check-workflow-artifact)が警告止まり
### B5: parallel_qualityのbuild_checkでスコープ外ファイル編集可能

## 既存の検証ポイント一覧

| 遷移 | チェック内容 |
|------|-----------|
| design_review→test_design | ユーザー承認必須 |
| parallel_analysis→parallel_design | スコープ必須 |
| test_impl→implementation | 設計整合性検証 |
| refactoring→parallel_quality | 設計整合性検証 |
| testing→regression_test | テスト結果exitCode=0必須 |
| regression_test→parallel_verification | テスト結果exitCode=0必須 |
