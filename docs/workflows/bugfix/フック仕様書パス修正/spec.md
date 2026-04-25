# 仕様書: フック仕様書パス修正

## 1. 修正対象一覧

### 1.1 フックファイル

| ファイル | 行 | 修正内容 |
|---------|-----|---------|
| `hooks/spec-first-guard.js` | 43 | `'docs/specs'` → `'docs/product/features'` |
| `hooks/check-spec-sync.js` | 43 | `'docs/specs'` → `'docs/product/features'` |
| `hooks/check-spec.js` | 45 | `'docs/specs/features'` → `'docs/product/features'` |
| `hooks/check-workflow-artifact.js` | 多数 | `docs/specs/` → 適切なパス |
| `hooks/loop-detector.js` | 11 | `@spec` コメント修正 |
| `hooks/phase-edit-guard.js` | 12 | `@spec` コメント修正 |
| `hooks/check-test-first.js` | 13 | `@spec` コメント修正 |

### 1.2 設定ファイル

| ファイル | 行 | 修正内容 |
|---------|-----|---------|
| `settings.json` | 85 | `"docs/specs"` → `"docs/product/features"` |
| `.claude-plugin/plugin.json` | 35, 80 | `docs/specs` → `docs/product/features` |

### 1.3 ドキュメント

| ファイル | 修正内容 |
|---------|---------|
| `README.md` | 全ての `docs/specs` 参照を修正 |
| `README.en.md` | 全ての `docs/specs` 参照を修正 |
| `workflow-phases/design_review.md` | パス参照修正 |
| `workflow-phases/code_review.md` | パス参照修正 |
| `workflow-phases/manual_test.md` | パス参照修正 |
| `workflow-phases/implementation.md` | パス参照修正 |
| `workflow-phases/docs_update.md` | パス参照修正 |
| `workflow-phases/e2e_test.md` | パス参照修正 |
| `workflow-phases/test_impl.md` | パス参照修正 |
| `workflow-phases/README.md` | パス参照修正 |
| `workflow-phases/state_machine.md` | パス参照修正 |
| `workflow-phases/flowchart.md` | パス参照修正 |
| `workflow-phases/test_design.md` | パス参照修正 |
| `workflow-phases/planning.md` | パス参照修正 |

### 1.4 MCPサーバー

| ファイル | 修正内容 |
|---------|---------|
| `mcp-server/src/server.ts` | `@spec` コメント修正 |
| `mcp-server/src/tools/*.ts` | `@spec` コメント修正 |
| `mcp-server/src/state/*.ts` | `@spec` コメント修正 |
| `mcp-server/src/phases/*.ts` | `@spec` コメント修正 |
| `mcp-server/src/utils/*.ts` | `@spec` コメント修正 |
| `mcp-server/src/**/__tests__/*.ts` | パス定義修正 |

### 1.5 仕様書ファイルの移動

| 移動元 | 移動先 |
|--------|--------|
| `docs/specs/domains/workflow/mcp-server.md` | `docs/product/features/workflow-mcp-server.md` |
| `docs/specs/` ディレクトリ | 削除（移動後） |

## 2. パス変換ルール

```
docs/specs                          → docs/product/features
docs/specs/features                 → docs/product/features
docs/specs/domains/{domain}/        → docs/product/features/
docs/specs/{name}.state-machine.mmd → docs/product/diagrams/{name}.state-machine.mmd
docs/specs/{name}.flowchart.mmd     → docs/product/diagrams/{name}.flowchart.mmd
docs/specs/CODE_MAPPING.md          → 削除（不要）
docs/specs/INDEX.json               → 削除（不要）
```

## 3. 実装手順

### Step 1: 仕様書ファイルの移動

```bash
# docs/specs/domains/workflow/mcp-server.md を移動
mv docs/specs/domains/workflow/mcp-server.md docs/product/features/workflow-mcp-server.md
```

### Step 2: フックファイルの修正

1. `spec-first-guard.js` の修正
2. `check-spec-sync.js` の修正
3. `check-spec.js` の修正
4. `check-workflow-artifact.js` の修正
5. その他フックの `@spec` コメント修正

### Step 3: 設定ファイルの修正

1. `settings.json` の修正
2. `.claude-plugin/plugin.json` の修正

### Step 4: ドキュメントの修正

1. `README.md` の修正
2. `README.en.md` の修正
3. `workflow-phases/*.md` の修正

### Step 5: MCPサーバーの修正

1. 全ての `@spec` コメント修正
2. テストファイルのパス定義修正

### Step 6: 確認

```bash
# 残存する docs/specs 参照を確認（ゼロになるべき）
grep -r "docs/specs" --include="*.js" --include="*.ts" --include="*.json" --include="*.md" .
```

## 4. ロールバック手順

問題が発生した場合：

1. Git で変更を取り消し: `git checkout -- .`
2. 環境変数で旧パスを設定: `SPEC_DIR=docs/specs`
