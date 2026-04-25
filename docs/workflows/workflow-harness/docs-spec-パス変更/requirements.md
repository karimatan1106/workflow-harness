# 要件定義: docs/product → docs/spec パス変更

## 機能要件

### FR-001: パス参照の一括変更

全てのファイルにおいて、以下のパス参照を変更する:

| Before | After |
|--------|-------|
| `docs/product/` | `docs/spec/` |

**対象パターン**:
- `docs/product/features/`
- `docs/product/diagrams/`
- `docs/product/screens/`
- `docs/product/api/`
- `docs/product/components/`
- `docs/product/database/`
- `docs/product/events/`
- `docs/product/messages/`
- `docs/product/user-stories/`
- `docs/product/personas/`
- `docs/product/journeys/`
- `docs/product/sitemap.md`
- `docs/product/seo/`
- `docs/product/i18n/`
- `docs/product/design-system/`
- `docs/product/interactions/`
- `docs/product/responsive/`
- `docs/product/accessibility/`
- `docs/product/wireframes/`

### FR-002: 環境変数デフォルト値の変更

フック内の環境変数デフォルト値を更新:

| ファイル | 変数 | Before | After |
|---------|------|--------|-------|
| `spec-first-guard.js` | SPEC_DIR | `docs/product/features` | `docs/spec/features` |
| `check-spec.js` | WORKFLOW_SPEC_DIR | `docs/product/features` | `docs/spec/features` |
| `check-spec-sync.js` | SPEC_DIR | `docs/product/features` | `docs/spec/features` |
| `settings.json` | SPEC_DIR | `docs/product/features` | `docs/spec/features` |

### FR-003: @spec コメントの更新

全ての `@spec` コメントのパスを更新:
- `@spec docs/product/features/xxx.md` → `@spec docs/spec/features/xxx.md`

### FR-004: ディレクトリ構造の変更

既存の `docs/product/` ディレクトリがある場合は `docs/spec/` にリネーム。

## 非機能要件

### NFR-001: 後方互換性

環境変数によるオーバーライドは引き続きサポート:
- `SPEC_DIR` でカスタムパスを指定可能

### NFR-002: 一貫性

全てのファイルで同一のパス表記を使用:
- 末尾スラッシュの有無を統一
- 大文字小文字を統一

## 受け入れ基準

### AC-001: 全参照の置換

- [ ] `docs/product/` を含むファイルが0件になること
- [ ] `grep -r "docs/product/" workflow-plugin/` が結果を返さないこと
- [ ] ルート `CLAUDE.md` 内にも `docs/product/` がないこと

### AC-002: テスト通過

- [ ] MCPサーバーのビルドが成功すること
- [ ] 既存テストが全て通過すること

### AC-003: 動作確認

- [ ] ワークフロー開始ができること
- [ ] フックが正常に動作すること

## スコープ外

- 実際のドキュメントファイルの移動（既に `docs/product/` 下にファイルがある場合の物理的移動）は本タスクでは行わない
- 新規ドキュメント構造の設計変更は含まない
