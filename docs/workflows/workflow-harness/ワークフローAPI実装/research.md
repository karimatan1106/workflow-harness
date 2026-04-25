# ワークフローAPI実装 - 調査結果

## 1. 現状のバックエンド構造

src/backend/はFastAPI(Python)で構築済み。Clean Architecture採用。

```
src/backend/
├── domain/                  # ビジネスロジック
├── application/use_cases/   # ユースケース
├── infrastructure/          # 実装詳細
└── presentation/controllers/ # APIコントローラ
```

既存のconvert_controller.pyが参考になる実装パターン。

## 2. MCPサーバーツール

workflow-plugin/mcp-server で7つのツールが利用可能:
- workflow_status: タスク状態取得
- workflow_start: タスク開始
- workflow_next: フェーズ遷移
- workflow_approve: 設計承認
- workflow_reset: リセット
- workflow_list: 一覧取得
- workflow_complete_sub: サブフェーズ完了

状態管理: .claude/state/workflows/{taskId}_{taskName}/

## 3. 実装するAPIエンドポイント

| Method | Endpoint | 目的 |
|--------|----------|-----|
| GET | /api/workflow/status | 全タスク一覧 |
| GET | /api/workflow/status/:taskId | タスク詳細 |
| POST | /api/workflow/start | タスク開始 |
| POST | /api/workflow/:taskId/next | フェーズ遷移 |
| POST | /api/workflow/:taskId/approve | 設計承認 |
| POST | /api/workflow/:taskId/reset | リセット |
| POST | /api/workflow/:taskId/complete-sub | サブフェーズ完了 |
| GET | /api/workflow/:taskId/artifacts | 成果物一覧 |
| GET | /api/workflow/:taskId/artifacts/:path | 成果物取得 |

## 4. 技術的アプローチ

### 推奨構造
```
src/backend/
├── presentation/controllers/workflow_controller.py (NEW)
├── presentation/schemas/workflow_schemas.py (NEW)
└── infrastructure/workflow/workflow_adapter.py (NEW)
```

### 実装方針
1. MCPサーバーの状態ファイル(.claude/state/)を直接読み取り
2. FastAPIコントローラでHTTPエンドポイント提供
3. Pydanticモデルでリクエスト/レスポンス型定義
4. 既存のconvert_controller.pyのパターンを踏襲

## 5. 依存関係

追加ライブラリ不要（既存のFastAPIスタックを使用）

## 6. 制約事項

【絶対禁止】ワークフロー制御ツール(workflow_start, workflow_next等)は呼び出さないこと
- APIは読み取り・状態提供のみ
- 制御操作はClaude Code側で実行
- MCPサーバーへの直接呼び出しは避ける
- JSONファイルから状態を読み取る設計とする

## 7. ワークフロー状態ファイル構造

MCPサーバーが管理する状態ファイル:
- `.claude/state/workflows/` - タスク毎のディレクトリ
- `{taskId}_{taskName}/workflow-state.json` - 現在の状態
- `{taskId}_{taskName}/artifacts/` - 成果物ファイル

APIは読み取り専用でこのファイルシステムにアクセス。
