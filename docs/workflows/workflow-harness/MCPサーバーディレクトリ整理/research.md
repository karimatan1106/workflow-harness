# MCPサーバーディレクトリ整理 - 調査結果

## 現状の問題

### ルートに散らかっているディレクトリ/ファイル

| 対象 | 種類 | 問題点 |
|------|------|--------|
| `mcp-servers/` | MCPサーバー群 | ルート直下にある（`src/`以下にあるべき） |
| `vision_ocr_mcp_server/` | Python MCPサーバー | ルート直下、命名規則も不統一 |
| `=0.18.0` | 不要ファイル | 誤って作成されたファイル |
| `nul` | 不要ファイル | 誤って作成されたファイル |
| `page1_preview.png` | テスト生成物 | ルートに配置すべきでない |
| `スクリーンショット 2026-01-19 135746.png` | スクリーンショット | ルートに配置すべきでない |

### 現状のMCPサーバー構成

```
プロジェクトルート/
├── mcp-servers/
│   └── pdf-ocr/           # Python MCPサーバー
├── vision_ocr_mcp_server/ # Python MCPサーバー（問題）
└── workflow-plugin/       # Node.js プラグイン（ルート直下でOK）
```

### 各MCPサーバーの詳細

| サーバー | 言語 | 主要ファイル |
|---------|------|-------------|
| pdf-ocr | Python | `server.py`, `http_server.py` |
| vision-ocr | Python | `server.py`, `__init__.py`, `__main__.py` |
| workflow | Node.js/TypeScript | `mcp-server/src/index.ts`, `mcp-server/src/server.ts` |

## 提案する構造

CLAUDE.mdの推奨プロジェクト構造に従い、MCPサーバーを `src/` 以下に配置する。

```
src/
├── backend/          # 既存
├── frontend/         # 既存
└── mcp-servers/      # MCPサーバー群（新規）
    ├── pdf-ocr/      # mcp-servers/pdf-ocr から移動
    └── vision-ocr/   # vision_ocr_mcp_server から移動
```

## 設定ファイルの影響

### `.mcp.json`

現在 `workflow-plugin/mcp-server/dist/index.js` を参照しており、workflow-pluginはルートに残すため変更不要。

ただし、vision-ocrサーバーを使用している場合は、パスの更新が必要になる可能性がある。

## 決定事項

- `workflow-plugin/` はルート直下に残す（ユーザー確認済み）
- `mcp-servers/` と `vision_ocr_mcp_server/` は `src/mcp-servers/` に統合
- ルートの不要ファイルは削除
