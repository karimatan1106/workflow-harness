# 調査結果: フック仕様書パス修正

## 概要

CLAUDE.md で定義されているドキュメント構成と、ワークフロープラグインのフック/設定ファイルが参照しているパスに不整合がある。

## 現状の不整合

### CLAUDE.md の定義

| カテゴリ | パス |
|---------|-----|
| 機能仕様 | `docs/product/features/` |
| 画面仕様 | `docs/product/screens/` |
| API仕様 | `docs/product/api/` |
| ワークフロー成果物 | `docs/workflows/{taskName}/` |
| 脅威モデル | `docs/security/threat-models/` |
| テスト計画 | `docs/testing/plans/` |

**注意**: `docs/specs` は CLAUDE.md で定義されていない。

### フック/プラグインの実装（現状）

`docs/specs` を参照しており、CLAUDE.md の構成と一致していない。

## 影響を受けるファイル一覧

### 1. フックファイル

| ファイル | 行番号 | 内容 |
|---------|--------|------|
| `hooks/spec-first-guard.js` | 43 | `SPEC_DIR = 'docs/specs'` |
| `hooks/check-spec-sync.js` | 43 | `SPEC_DIR = 'docs/specs'` |
| `hooks/check-spec.js` | 45 | `SPEC_DIR = 'docs/specs/features'` |
| `hooks/check-workflow-artifact.js` | 多数 | `docs/specs/` への反映チェック |

### 2. 設定ファイル

| ファイル | 行番号 | 内容 |
|---------|--------|------|
| `settings.json` | 85 | `"SPEC_DIR": "docs/specs"` |
| `.claude-plugin/plugin.json` | 80 | デフォルト値 `docs/specs` |

### 3. ドキュメント

| ファイル | 影響 |
|---------|------|
| `README.md` | 多数の `docs/specs` 参照 |
| `README.en.md` | 多数の `docs/specs` 参照 |
| `workflow-phases/*.md` | 各フェーズのドキュメント内参照 |
| `docs/specs/domains/workflow/mcp-server.md` | 仕様書自体 |

### 4. MCPサーバー

| ファイル | 影響 |
|---------|------|
| `mcp-server/src/**/*.ts` | `@spec docs/specs/...` コメント |
| `mcp-server/src/**/__tests__/*.ts` | テスト内のパス定義 |

## 修正方針

CLAUDE.md の構成に合わせてフック/プラグインを修正する。

### パスマッピング

| 現状 | 修正後 |
|-----|--------|
| `docs/specs` | `docs/product/features` |
| `docs/specs/features` | `docs/product/features` |
| `docs/specs/domains/{domain}/` | `docs/product/features/` |
| `docs/specs/{domain}/{name}.state-machine.mmd` | `docs/product/diagrams/{name}.state-machine.mmd` |
| `docs/specs/{domain}/{name}.flowchart.mmd` | `docs/product/diagrams/{name}.flowchart.mmd` |

### 環境変数のデフォルト値変更

| 変数 | 現状 | 修正後 |
|-----|-----|--------|
| `SPEC_DIR` | `docs/specs` | `docs/product/features` |
| `WORKFLOW_SPEC_DIR` | `docs/specs/features` | `docs/product/features` |

## 修正対象ファイル数

- フック: 4ファイル
- 設定: 2ファイル
- ドキュメント: 約10ファイル
- MCPサーバー: 約15ファイル
- テスト: 約5ファイル

**合計**: 約36ファイル

## リスク

1. 既存のプロジェクトで `docs/specs` を使用している場合、動作しなくなる
   - 対策: 環境変数でオーバーライド可能なため、移行期間を設ける

2. MCPサーバーの `@spec` コメントが実在しないパスを参照することになる
   - 対策: `docs/specs/domains/workflow/` を `docs/product/features/` に移動

## 次のステップ

1. requirements フェーズで要件を定義
2. planning フェーズで詳細な修正計画を策定
3. 実装フェーズで一括修正
