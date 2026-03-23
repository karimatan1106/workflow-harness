# Workflow-Harness ファイル構成レポート

**作成日**: 2026-03-18
**調査対象**: `/home/y/Workflow/workflow-harness`
**総ソースコード**: 19,480行（TypeScript）

---

## 1. ディレクトリ構成図

```
workflow-harness/
├── .agent/                          # エージェント設定・状態管理
├── .claude/                         # Claude IDE 設定
│   ├── hooks/                       # フック定義
│   ├── skills/                      # スキル定義（harness関連）
│   └── state/                       # ワークフロー状態保存
├── docs/                            # ドキュメンテーション
│   ├── architecture/                # アーキテクチャドキュメント
│   ├── spec/                        # 機能仕様書
│   └── workflows/                   # ワークフロー関連ドキュメント
├── hooks/                           # JavaScript フック実装
├── indexer/                         # インデックス・ビルドツール
├── mcp-server/                      # MCP サーバー実装（メイン）
│   ├── src/                         # TypeScript ソースコード
│   │   ├── __tests__/               # テストファイル
│   │   ├── dci/                     # DCI (Deterministic Case Index)
│   │   ├── gates/                   # DoD (Definition of Done) ゲート
│   │   ├── phases/                  # 30フェーズ定義
│   │   ├── state/                   # 状態管理エンジン
│   │   ├── tools/                   # MCP ツール実装
│   │   ├── utils/                   # ユーティリティ関数
│   │   ├── cli.ts                   # CLI インターフェース
│   │   └── index.ts                 # エントリーポイント
│   ├── dist/                        # ビルド出力
│   ├── tests/                       # 統合テスト
│   └── package.json                 # npm 設定
├── node_modules/                    # npm 依存パッケージ
├── indexer/.venv/                   # Python 仮想環境
├── CLAUDE.md                        # プロジェクト指示書
├── package.json                     # ルートパッケージ定義
└── setup.sh                         # セットアップスクリプト
```

---

## 2. 主要コンポーネント

### 2.1 MCP Server (`mcp-server/`)

**役割**: ワークフロー制御エンジンのメイン実装

#### 2.1.1 Core Modules

| モジュール | ファイル数 | 行数 | 役割 |
|-----------|----------|------|------|
| **dci/** (DCI) | 4 | ~800 | Deterministic Case Index - ワークフロー状態の検索・構築 |
| **gates/** (DoD) | 14 | ~6,800 | Definition of Done ゲート (L1-L4検証) |
| **phases/** | 11 | ~5,200 | 30フェーズ定義・リスク分類・テンプレート |
| **state/** | 15 | ~4,500 | 状態管理・ライフサイクル・永続化 |
| **tools/** | ? | ? | MCP ツール実装（ワークフロー制御用） |
| **utils/** | ? | ? | ユーティリティ関数群 |

#### 2.1.2 Main Entry Points

- **`cli.ts`**: コマンドラインインターフェース（`harness-inv` コマンド）
- **`index.ts`**: MCP サーバーエントリーポイント

#### 2.1.3 Test Structure

- `__tests__/`: ユニットテスト
- `tests/`: 統合テスト（api, cli, contracts, e2e, eval, hooks, infra, safety）

---

### 2.2 Hooks Layer (`hooks/`)

**役割**: ワークフロー強制・安全性検証

**主要ファイル**:
- `block-dangerous-commands.js`: 危険なコマンドをブロック
- `context-watchdog.js`: コンテキストサイズ監視
- `loop-detector.js`: 無限ループ検出
- `session-boundary.js`: セッション境界管理
- `tool-gate.js`: ツール使用の制御
- `pre-tool-guard.sh`: ツール実行前チェック
- `hook-utils.js`: フック共通ユーティリティ

---

### 2.3 Skills (``.claude/skills/harness/`)

**役割**: ワークフロー制御ガイダンス・知識ベース

**スキルドキュメント** (10ファイル):
1. **SKILL.md** - スキル概要（/harness コマンド）
2. **workflow-phases.md** - 14ステージ30フェーズ定義
3. **workflow-gates.md** - L1-L4 ゲート仕様
4. **workflow-execution.md** - Bash実行フェーズ別許可
5. **workflow-orchestrator.md** - オーケストレーター役割・テンプレート管理
6. **workflow-operations.md** - 操作コマンド一覧
7. **workflow-rules.md** - リトライ・トレーサビリティ・品質規則
8. **workflow-docs.md** - ドキュメンテーション規則
9. **workflow-api-standards.md** - API標準仕様
10. **workflow-project-structure.md** - プロジェクト構造ガイド

---

### 2.4 Documentation (`docs/`)

**構成**:
- `architecture/`: アーキテクチャ設計書
  - `overview.md` - 全体概要
  - `modules/` - モジュール詳細
  - `traceability-matrix.md` - 要件追跡マトリックス

- `spec/`: 機能仕様
  - `features/` - 機能別仕様（gate-system, mcp-tools, phase-system）

- `workflows/`: ワークフローテンプレート・事例
  - `test-inv/` - テスト連携ワークフロー
  - その他のワークフロー事例

---

### 2.5 State Management (`.claude/state/`)

**役割**: ワークフロー状態の永続化・復旧

**構成**:
- `workflows/` - 個別ワークフロー状態
  - 複数のUUID ベースディレクトリ（各ワークフロー）
  - 各ワークフロー内: `workflow-state.json`
- `task-index.json` - タスク索引
- `hmac-keys.json` - セキュリティキー

---

### 2.6 Indexer (`indexer/`)

**役割**: インデックス生成・ビルドユーティリティ

**内容**:
- Python ベースのツール
- 仮想環境（`.venv/`）
- `setup.sh` で自動セットアップ

---

## 3. Core Concepts

### 3.1 30-Phase Workflow

- **14ステージ** に分けた **30フェーズ**（large タスク）
- large タスクとして全30フェーズを実行
- 各フェーズは「成果物」を生成し次フェーズへ引き継ぎ

### 3.2 Deterministic Gates (L1-L4)

- **L1**: ファイル存在確認
- **L2**: 終了コード検証
- **L3**: 数値閾値（行数、文字数など）
- **L4**: 正規表現マッチング

### 3.3 Definition of Done (DoD)

複数レベルの検証ゲート:
- L1-L2: 基本確認
- L3: 品質メトリクス
- L4: コンテンツ検証（複数サブゲート）
  - 禁止語チェック
  - コンテンツ構造
  - 要件追跡
  - TOON形式
  - DCI生成
  - 参照検証
  - 差分検証

### 3.4 DCI (Deterministic Case Index)

- ワークフロー状態の検索・クエリ
- TOON形式の読み書き
- インデックス生成・管理

### 3.5 State Management

- ワークフロー状態の永続化
- ライフサイクル管理（start, next, approve, back, reset など）
- タスク進捗トラッキング
- セッション復旧サポート

---

## 4. Key Technologies

| テクノロジー | 用途 |
|------------|------|
| **TypeScript** | メインソースコード |
| **Model Context Protocol (MCP)** | ツール・リソース定義 |
| **Zod** | スキーマ検証 |
| **TOON Format** | ワークフロー成果物フォーマット |
| **Vitest** | ユニットテスト |
| **Biome** | コードフォーマッタ |
| **AST Grep** | コード解析 |
| **OxLint** | Linting |

---

## 5. Dependencies

**主要 npm パッケージ** (package.json):
- `@modelcontextprotocol/sdk@^1.26.0` - MCP SDK
- `@toon-format/toon@^2.1.0` - TOON形式サポート
- `zod@^3.23.0` - スキーマ検証

**開発依存**:
- TypeScript, Vitest, Biome, OxLint, AST Grep, JSCPD

---

## 6. Configuration Files

| ファイル | 用途 |
|---------|------|
| `CLAUDE.md` | プロジェクト指示書（主要ルール・禁止事項） |
| `.mcp.json` | MCP設定 |
| `.claude/settings.json` | IDE設定 |
| `mcp-server/tsconfig.json` | TypeScript設定 |
| `mcp-server/biome.json` | Biome フォーマット設定 |
| `mcp-server/vitest.config.ts` | Vitest テスト設定 |
| `.gitignore` | Git 除外設定 |

---

## 7. Workflow Execution Flow

```
ユーザー入力
    ↓
[/harness start] → CLI (cli.ts)
    ↓
[Phase Execution] → phases/ (定義)
    ↓
[State Management] → state/ (永続化)
    ↓
[DoD Validation] → gates/ (L1-L4検証)
    ↓
[Next Phase] → harness_next (ガイダンス)
    ↓
成果物生成（TOON形式）
    ↓
DCI索引生成 → dci/
    ↓
セッション復旧可能な状態で保存
```

---

## 8. Security & Control Layers

**Hooks** による多層防御:
1. **コマンド制限** - 危険なコマンドをブロック
2. **ループ検出** - 無限ループ防止
3. **コンテキスト監視** - トークン使用量監視
4. **セッション境界** - セッション跨ぎを制御
5. **ツール制御** - ツール使用を段階的に許可

---

## 9. Main Features

1. **Intent-Driven Workflow** - 意図から自動フェーズ展開
2. **Deterministic Validation** - 再現可能な品質検証
3. **State Persistence** - セッション復旧対応
4. **30-Phase Guidance** - 段階的ガイダンス・分岐制御
5. **MCP Integration** - Model Context Protocol ツール統合
6. **TOON Format Support** - 構造化成果物フォーマット
7. **Traceability** - 要件追跡 (F-NNN) と受入基準 (AC-N)
8. **Multi-Layer DoD** - L1-L4 でバージョンアップ可能な検証

---

## 10. File Size Statistics

| ファイル | 行数 |
|---------|------|
| `dod-l4-ia.ts` | ~1,000 |
| `dod-l3.ts` | ~350 |
| `registry.ts` (phases) | ~400 |
| `definitions.ts` (phases) | ~260 |
| `manager-lifecycle.ts` | ~220 |

**特徴**: 責務分離により大型ファイル（>200行）は最小限に抑制

---

## 結論

**workflow-harness** は：
- **30フェーズ** を通じたワークフロー自動化エンジン
- **決定的ゲート (L1-L4)** による品質保証
- **MCP ベース** のツール・リソース統合
- **状態永続化** によるセッション復旧対応
- **マルチレイヤーセキュリティ** を備えた制御プラットフォーム

主な用途は **Claude Code でのインテント駆動型開発フロー管理** です。
