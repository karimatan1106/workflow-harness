# MCPサーバーディレクトリ整理 - 仕様書

## 実行計画

### Phase 1: ディレクトリ作成

```bash
mkdir -p src/mcp-servers
```

### Phase 2: MCPサーバー移動

1. `mcp-servers/pdf-ocr/` → `src/mcp-servers/pdf-ocr/`
2. `vision_ocr_mcp_server/` → `src/mcp-servers/vision-ocr/`

### Phase 3: 不要ファイル削除

```bash
rm "=0.18.0"
rm "nul"
rm "page1_preview.png"
rm "スクリーンショット 2026-01-19 135746.png"
```

### Phase 4: 空ディレクトリ削除

```bash
rmdir mcp-servers  # 空になったら削除
```

### Phase 5: CLAUDE.md更新

MCPサーバーの配置ルールを追記：

```markdown
## MCPサーバー配置ルール

MCPサーバーは `src/mcp-servers/` 以下に配置する。

| ディレクトリ | 説明 |
|-------------|------|
| `src/mcp-servers/pdf-ocr/` | PDF OCR処理サーバー |
| `src/mcp-servers/vision-ocr/` | Vision OCRサーバー |

※ `workflow-plugin/` はプラグイン全体のパッケージとしてルート直下に配置
```

## ディレクトリ構造（変更後）

```
project/
├── src/
│   ├── backend/
│   ├── frontend/
│   └── mcp-servers/          # 新規
│       ├── pdf-ocr/          # 移動
│       └── vision-ocr/       # 移動・改名
├── workflow-plugin/          # 変更なし
└── ...
```
