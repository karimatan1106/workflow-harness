# ワークフローAPI実装 - 要件定義

## 1. 機能要件

### FR-001: タスク一覧取得
- GET /api/workflow/status で全タスクを取得
- レスポンス: タスクID、名前、現在フェーズ、開始日時の配列

### FR-002: タスク詳細取得
- GET /api/workflow/status/:taskId で特定タスクを取得
- レスポンス: タスク状態、次フェーズ、利用可能アクション、進捗率

### FR-003: タスク開始
- POST /api/workflow/start でタスク開始
- リクエスト: taskName (必須)
- レスポンス: taskId, taskName, phase, docsDir

### FR-004: フェーズ遷移
- POST /api/workflow/:taskId/next でフェーズ進行
- 条件: 承認フェーズは承認済み、並列フェーズは全サブフェーズ完了

### FR-005: 設計承認
- POST /api/workflow/:taskId/approve で設計承認
- 条件: design_reviewフェーズのみ

### FR-006: タスクリセット
- POST /api/workflow/:taskId/reset でresearchにリセット
- リクエスト: reason (任意)

### FR-007: サブフェーズ完了
- POST /api/workflow/:taskId/complete-sub でサブフェーズ完了
- リクエスト: subPhase (必須)

### FR-008: 成果物一覧取得
- GET /api/workflow/:taskId/artifacts で成果物ファイル一覧

### FR-009: 成果物コンテンツ取得
- GET /api/workflow/:taskId/artifacts/:path でファイル内容取得

## 2. 非機能要件

### NFR-001: パフォーマンス
- APIレスポンス: 500ms以内

### NFR-002: エラーハンドリング
- 適切なHTTPステータスコード (404, 400, 409)
- JSON形式のエラーレスポンス

### NFR-003: ログ
- リクエスト/レスポンスのログ記録

## 3. 受け入れ基準

- 全9エンドポイントが実装されている
- Pydanticスキーマで型検証
- OpenAPI仕様書が自動生成される
- 既存のFastAPIパターンに準拠

【絶対禁止】ワークフロー制御ツールは呼び出さないこと
