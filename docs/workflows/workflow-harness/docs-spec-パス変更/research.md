# 調査結果: docs/product → docs/spec パス変更

## 概要

`docs/product/` を `docs/spec/` に変更する。

## 変更対象

### 統計

| 対象 | ファイル数 | 箇所数 |
|------|-----------|--------|
| workflow-plugin/ | 44 | 142 |
| CLAUDE.md（ルート） | 1 | 40 |
| **合計** | **45** | **182** |

### 変更対象ファイル一覧

#### workflow-plugin/

1. `CLAUDE.md` - 43箇所
2. `workflow-phases/design_review.md` - 9箇所
3. `workflow-phases/README.md` - 8箇所
4. `README.md` - 7箇所
5. `README.en.md` - 7箇所
6. `workflow-phases/planning.md` - 5箇所
7. `workflow-phases/flowchart.md` - 3箇所
8. `workflow-phases/state_machine.md` - 3箇所
9. `mcp-server/src/state/manager.ts` - 3箇所
10. `docs/product/features/workflow-mcp-server.md` - 3箇所
11. `skills/workflow/SKILL.md` - 3箇所
12. `hooks/check-workflow-artifact.js` - 9箇所
13. `hooks/check-spec.js` - 3箇所
14. `hooks/check-spec-sync.js` - 2箇所
15. `hooks/spec-first-guard.js` - 2箇所
16. `.claude-plugin/plugin.json` - 2箇所
17. `workflow-phases/implementation.md` - 2箇所
18. `workflow-phases/docs_update.md` - 2箇所
19. その他（各1箇所）: 26ファイル

#### ルート

- `CLAUDE.md` - 40箇所

## 変更内容

| Before | After |
|--------|-------|
| `docs/product/features/` | `docs/spec/features/` |
| `docs/product/diagrams/` | `docs/spec/diagrams/` |
| `docs/product/screens/` | `docs/spec/screens/` |
| `docs/product/api/` | `docs/spec/api/` |
| `docs/product/components/` | `docs/spec/components/` |
| `docs/product/database/` | `docs/spec/database/` |
| `docs/product/events/` | `docs/spec/events/` |
| `docs/product/` | `docs/spec/` |

## 影響範囲

### フック

- `spec-first-guard.js`: SPEC_DIRのデフォルト値
- `check-spec.js`: WORKFLOW_SPEC_DIRのデフォルト値
- `check-spec-sync.js`: SPEC_DIRのデフォルト値
- `check-workflow-artifact.js`: パス参照

### MCPサーバー

- `@spec`コメント内のパス
- ドキュメント参照

### ドキュメント

- CLAUDE.md（プロジェクト全体の設定）
- README.md / README.en.md
- workflow-phases/*.md（フェーズガイド）

### 設定ファイル

- `settings.json`: SPEC_DIR環境変数
- `.claude-plugin/plugin.json`

## 実ディレクトリの移動

`docs/product/` が存在する場合は `docs/spec/` にリネームも必要。

```bash
# 確認
ls -la docs/product/
# 移動（必要に応じて）
mv docs/product docs/spec
```
