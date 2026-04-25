# 仕様書: docs/product → docs/spec パス変更

## 概要

プロジェクト全体で `docs/product/` を `docs/spec/` に変更する。

## 変更対象

### 1. hooks/ ディレクトリ

| ファイル | 変更内容 |
|---------|---------|
| `spec-first-guard.js` | SPEC_DIR デフォルト値 |
| `check-spec.js` | WORKFLOW_SPEC_DIR デフォルト値 |
| `check-spec-sync.js` | SPEC_DIR デフォルト値 |
| `check-workflow-artifact.js` | パス参照 |
| `loop-detector.js` | @spec コメント |
| `phase-edit-guard.js` | @spec コメント |
| `check-test-first.js` | @spec コメント |
| `hooks/__tests__/*.js` | テスト内のパス参照 |

### 2. mcp-server/src/ ディレクトリ

| ファイル | 変更内容 |
|---------|---------|
| `server.ts` | @spec コメント |
| `state/types.ts` | @spec コメント |
| `state/manager.ts` | @spec コメント |
| `phases/definitions.ts` | @spec コメント |
| `utils/*.ts` | @spec コメント |
| `tools/*.ts` | @spec コメント |

### 3. workflow-phases/ ディレクトリ

| ファイル | 変更内容 |
|---------|---------|
| `README.md` | パス参照 |
| `planning.md` | パス参照 |
| `state_machine.md` | パス参照 |
| `flowchart.md` | パス参照 |
| `design_review.md` | パス参照 |
| `implementation.md` | パス参照 |
| `test_design.md` | パス参照 |
| `test_impl.md` | パス参照 |
| `code_review.md` | パス参照 |
| `manual_test.md` | パス参照 |
| `e2e_test.md` | パス参照 |
| `docs_update.md` | パス参照 |

### 4. 設定ファイル

| ファイル | 変更内容 |
|---------|---------|
| `settings.json` | SPEC_DIR 環境変数 |
| `.claude-plugin/plugin.json` | パス参照 |
| `CLAUDE.md` | 全パス参照 |
| `README.md` | パス参照 |
| `README.en.md` | パス参照 |
| `skills/workflow/SKILL.md` | パス参照 |

### 5. ルートCLAUDE.md

プロジェクトルートの `CLAUDE.md` も同様に変更。

## 実装手順

1. フックファイルの環境変数デフォルト値を変更
2. @spec コメントを変更
3. workflow-phases/*.md のパス参照を変更
4. 設定ファイルのパス参照を変更
5. CLAUDE.md（workflow-plugin/とルート）のパス参照を変更
6. README.md / README.en.md のパス参照を変更
7. docs/product/ → docs/spec/ ディレクトリリネーム（存在する場合）

## 検証手順

```bash
# 残存確認
grep -r "docs/product/" workflow-plugin/
grep "docs/product/" CLAUDE.md

# ビルド確認
cd workflow-plugin/mcp-server && npm run build

# テスト確認
cd workflow-plugin/mcp-server && npm test
```

## 新パス構造

```
docs/
├── spec/                            # ← 旧 docs/product/
│   ├── features/                    # 機能仕様
│   ├── screens/                     # 画面設計
│   ├── api/                         # API仕様
│   ├── events/                      # イベント定義
│   ├── database/                    # DB設計
│   ├── messages/                    # メッセージ設計
│   ├── user-stories/                # ユーザーストーリー
│   ├── personas/                    # ペルソナ定義
│   ├── journeys/                    # ユーザージャーニー
│   ├── sitemap.md                   # サイトマップ
│   ├── seo/                         # SEO要件
│   ├── i18n/                        # 国際化
│   ├── design-system/               # デザインシステム
│   ├── components/                  # コンポーネント仕様
│   ├── interactions/                # インタラクション設計
│   ├── responsive/                  # レスポンシブ設計
│   ├── accessibility/               # アクセシビリティ
│   ├── wireframes/                  # ワイヤーフレーム
│   └── diagrams/                    # 設計図
├── architecture/                    # アーキテクチャ
├── security/                        # セキュリティ
├── testing/                         # テスト
├── operations/                      # 運用
└── workflows/                       # ワークフロー成果物
```
