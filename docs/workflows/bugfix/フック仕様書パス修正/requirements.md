# 要件定義: フック仕様書パス修正

## 1. 背景

ワークフロープラグインのフック・設定ファイルが参照している仕様書パス（`docs/specs`）と、CLAUDE.md で定義されているドキュメント構成（`docs/product/features/` 等）に不整合がある。

## 2. 目的

フック・プラグインの参照パスを CLAUDE.md の定義に合わせることで、一貫性のあるドキュメント管理を実現する。

## 3. 機能要件

### FR-1: フックファイルのパス修正

| ID | 要件 |
|----|------|
| FR-1.1 | `spec-first-guard.js` の `SPEC_DIR` デフォルト値を `docs/product/features` に変更 |
| FR-1.2 | `check-spec-sync.js` の `SPEC_DIR` デフォルト値を `docs/product/features` に変更 |
| FR-1.3 | `check-spec.js` の `WORKFLOW_SPEC_DIR` デフォルト値を `docs/product/features` に変更 |
| FR-1.4 | `check-workflow-artifact.js` 内の `docs/specs/` 参照を適切なパスに変更 |

### FR-2: 設定ファイルの修正

| ID | 要件 |
|----|------|
| FR-2.1 | `settings.json` の `SPEC_DIR` を `docs/product/features` に変更 |
| FR-2.2 | `.claude-plugin/plugin.json` のデフォルト値を `docs/product/features` に変更 |

### FR-3: ドキュメントの修正

| ID | 要件 |
|----|------|
| FR-3.1 | `README.md` 内の `docs/specs` 参照を修正 |
| FR-3.2 | `README.en.md` 内の `docs/specs` 参照を修正 |
| FR-3.3 | `workflow-phases/*.md` 内の参照を修正 |

### FR-4: MCPサーバーの修正

| ID | 要件 |
|----|------|
| FR-4.1 | `@spec` コメントのパスを修正 |
| FR-4.2 | テストファイル内のパス定義を修正 |

### FR-5: 仕様書ファイルの移動

| ID | 要件 |
|----|------|
| FR-5.1 | `docs/specs/domains/workflow/mcp-server.md` を `docs/product/features/workflow-mcp-server.md` に移動 |

## 4. 非機能要件

### NFR-1: 後方互換性

- 環境変数 `SPEC_DIR` によるオーバーライドは引き続きサポート
- 既存プロジェクトが `docs/specs` を使用している場合、環境変数で対応可能

### NFR-2: ドキュメント整合性

- CLAUDE.md と全てのファイルで同一のパス構成を参照する

## 5. 受け入れ基準

| ID | 基準 |
|----|------|
| AC-1 | grep で `docs/specs` を検索しても、コメント以外でヒットしない |
| AC-2 | 全てのフックが正常に動作する（テスト通過） |
| AC-3 | MCP サーバーのビルドが成功する |
| AC-4 | `@spec` コメントが実在するファイルを参照している |

## 6. スコープ外

- CLAUDE.md 自体の修正（既に正しい構成）
- 新規フックの追加
- 既存機能の変更（パス以外）

## 7. 影響範囲

### 修正対象ファイル

```
hooks/
├── spec-first-guard.js
├── check-spec-sync.js
├── check-spec.js
├── check-workflow-artifact.js
├── loop-detector.js（@spec コメント）
├── phase-edit-guard.js（@spec コメント）
└── check-test-first.js（@spec コメント）

settings.json
.claude-plugin/plugin.json

README.md
README.en.md

workflow-phases/
├── design_review.md
├── code_review.md
├── manual_test.md
├── implementation.md
├── docs_update.md
├── e2e_test.md
├── test_impl.md
├── README.md
├── state_machine.md
├── flowchart.md
├── test_design.md
└── planning.md

mcp-server/src/
├── server.ts
├── tools/*.ts
├── state/*.ts
├── phases/*.ts
├── utils/*.ts
└── **/__tests__/*.ts

docs/specs/domains/workflow/mcp-server.md → 移動
```
