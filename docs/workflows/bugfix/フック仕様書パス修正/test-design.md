# テスト設計: フック仕様書パス修正

## 1. テスト方針

パス参照の修正が正しく行われたことを確認するため、以下のテストを実施する。

## 2. テストケース

### TC-1: 残存パス確認

| ID | テスト内容 | 期待結果 |
|----|-----------|---------|
| TC-1.1 | grep で `docs/specs` を検索（.js, .ts, .json, .md） | コメント以外でゼロヒット |
| TC-1.2 | `settings.json` の `SPEC_DIR` 値を確認 | `docs/product/features` |
| TC-1.3 | `plugin.json` のデフォルト値を確認 | `docs/product/features` |

### TC-2: フック動作確認

| ID | テスト内容 | 期待結果 |
|----|-----------|---------|
| TC-2.1 | `spec-first-guard.js` のパス判定 | `docs/product/features/*.md` を仕様書と認識 |
| TC-2.2 | `check-spec-sync.js` のパス判定 | 正しいディレクトリをチェック |
| TC-2.3 | `check-spec.js` の動作 | 正しいディレクトリをチェック |

### TC-3: ビルド確認

| ID | テスト内容 | 期待結果 |
|----|-----------|---------|
| TC-3.1 | MCPサーバーのビルド | エラーなし |
| TC-3.2 | TypeScript コンパイル | エラーなし |

### TC-4: 既存テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|---------|
| TC-4.1 | `mcp-server` の既存テスト実行 | 全テスト通過 |
| TC-4.2 | フックのテスト実行（存在する場合） | 全テスト通過 |

## 3. テスト手順

### Step 1: 残存パス確認

```bash
cd workflow-plugin
grep -r "docs/specs" --include="*.js" --include="*.ts" --include="*.json" . | grep -v node_modules | grep -v "// " | grep -v "* "
```

期待結果: 出力なし

### Step 2: 設定ファイル確認

```bash
cat settings.json | grep SPEC_DIR
cat .claude-plugin/plugin.json | grep -A1 "SPEC_DIR"
```

期待結果: `docs/product/features` が表示される

### Step 3: MCPサーバービルド

```bash
cd mcp-server
npm run build
```

期待結果: ビルド成功

### Step 4: テスト実行

```bash
cd mcp-server
npm test
```

期待結果: 全テスト通過

## 4. 受け入れ基準

| 基準 | 確認方法 |
|------|---------|
| `docs/specs` 参照がゼロ | grep による検索 |
| ビルド成功 | npm run build |
| テスト通過 | npm test |
| `@spec` コメントが有効なパスを参照 | ファイル存在確認 |

## 5. テスト環境

- Node.js: 現在のプロジェクトバージョン
- OS: Windows (MINGW64)
- 作業ディレクトリ: `C:\ツール\Workflow\workflow-plugin`
