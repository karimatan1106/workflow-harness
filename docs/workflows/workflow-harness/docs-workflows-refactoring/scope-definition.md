userResponse: ヒアリング5項目すべて承認。半角カタカナ重複削除、カテゴリ整理、旧タスク完全削除、ルーズ.md移動、ディレクトリ名とタスク内容ベースのカテゴリ分類。

## decisions

- D-001: 半角カタカナ重複ディレクトリ23件を削除し、全角版を正とする
- D-002: 旧プロジェクト関連ディレクトリ32件を完全削除（PDF/OCR/Remotion/pachinko等）
- D-003: 残存211ディレクトリをカテゴリ別サブディレクトリに再配置（bugfix/workflow-harness/investigation）
- D-004: ルート散在.mdファイル14件を個別タスクディレクトリ化
- D-005: カテゴリ分類はディレクトリ名・タスク内容に基づく自動判定を使用

## artifacts

- scope-definition.md (本ファイル): スコープ定義と全アクション一覧
- 実装時に生成されるもの:
  - docs/workflows/bugfix/ (新規サブディレクトリ)
  - docs/workflows/workflow-harness/ (新規サブディレクトリ, 既存の同名タスクディレクトリとは別)
  - docs/workflows/investigation/ (新規サブディレクトリ)

## next

1. requirements フェーズで AC (受入基準) を定義
2. 実装は3段階: (a) 半角重複+旧タスク削除 (b) カテゴリディレクトリ作成+移動 (c) ルーズ.md移動
3. 各段階で git commit を分割し、ロールバック可能にする
