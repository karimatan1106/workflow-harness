# MCPサーバーディレクトリ整理 - 要件定義

## 機能要件

### FR-1: MCPサーバーを `src/mcp-servers/` に統合

| ID | 要件 |
|----|------|
| FR-1.1 | `mcp-servers/pdf-ocr/` を `src/mcp-servers/pdf-ocr/` に移動 |
| FR-1.2 | `vision_ocr_mcp_server/` を `src/mcp-servers/vision-ocr/` に移動（命名規則統一） |
| FR-1.3 | 移動後、元のディレクトリを削除 |

### FR-2: 不要ファイルの削除

| ID | 要件 |
|----|------|
| FR-2.1 | `=0.18.0` ファイルを削除 |
| FR-2.2 | `nul` ファイルを削除 |
| FR-2.3 | `page1_preview.png` を削除（または適切な場所に移動） |
| FR-2.4 | `スクリーンショット 2026-01-19 135746.png` を削除（または適切な場所に移動） |

### FR-3: CLAUDE.mdの更新

| ID | 要件 |
|----|------|
| FR-3.1 | MCPサーバーの配置ルールを明記 |

## 非機能要件

### NFR-1: 既存機能への影響なし

- 移動後もMCPサーバーが正常に動作すること
- 設定ファイル（`.mcp.json`等）のパス参照が正しいこと

## 対象外

- `workflow-plugin/` の移動（ユーザー確認済みでルート直下のまま）
- `.mcp.json` の変更（workflow以外のMCPサーバーは現在未使用の可能性）

## 受け入れ基準

- [ ] `src/mcp-servers/pdf-ocr/` にpdf-ocrサーバーが存在する
- [ ] `src/mcp-servers/vision-ocr/` にvision-ocrサーバーが存在する
- [ ] プロジェクトルートに `mcp-servers/`, `vision_ocr_mcp_server/` が存在しない
- [ ] プロジェクトルートに不要ファイル（`=0.18.0`, `nul`, `*.png`）が存在しない
- [ ] CLAUDE.mdにMCPサーバー配置ルールが明記されている
