# 調査結果: ワークフローフェーズのsubagent化

## 調査日: 2026-01-18

## 1. 現状アーキテクチャ

### 1.1 全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                     現状のアーキテクチャ                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   User ←→ Claude (Main) ←→ MCP Server (workflow-plugin)    │
│                 │                      │                    │
│                 │                      ↓                    │
│                 │              .claude/state/workflows/     │
│                 │              (状態管理ファイル)            │
│                 │                                           │
│                 ↓                                           │
│           docs/workflows/{taskName}/                        │
│           (成果物ファイル)                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 MCPサーバー構成

**ファイル構成:**
```
mcp-server/src/
├── index.ts           # エントリーポイント
├── server.ts          # MCPサーバー定義（ツール公開）
├── phases/
│   └── definitions.ts # フェーズ定義（18フェーズ）
├── state/
│   ├── types.ts       # 型定義
│   └── manager.ts     # 状態管理
├── tools/
│   ├── start.ts       # workflow_start
│   ├── next.ts        # workflow_next
│   ├── status.ts      # workflow_status
│   ├── approve.ts     # workflow_approve
│   ├── complete-sub.ts # workflow_complete_sub
│   ├── list.ts        # workflow_list
│   ├── switch.ts      # workflow_switch
│   └── reset.ts       # workflow_reset
└── utils/
    ├── errors.ts      # エラー処理
    └── retry.ts       # リトライ機能
```

### 1.3 現状の問題点

| 問題 | 詳細 |
|------|------|
| コンテキスト肥大化 | 18フェーズを1セッションで実行するとcompactingが発生 |
| 並列実行の未実装 | `parallel_*`フェーズは概念のみで実際は順次実行 |
| 失敗時の再実行困難 | フェーズ単位での再実行ができない |
| 前フェーズの詳細喪失 | compacting後に調査結果等が失われる可能性 |

---

## 2. Claude Codeのsubagent機能

### 2.1 Task Tool仕様

Claude Codeは`Task`ツールでsubagentを起動できる:

```typescript
// Task toolのパラメータ
{
  prompt: string;           // タスク内容
  description: string;      // 3-5語の説明
  subagent_type: string;    // エージェントタイプ
  model?: string;           // sonnet/opus/haiku
  run_in_background?: boolean; // バックグラウンド実行
}
```

### 2.2 利用可能なsubagent_type

| タイプ | 用途 |
|--------|------|
| `Bash` | コマンド実行 |
| `general-purpose` | 汎用タスク |
| `Explore` | コードベース探索 |
| `Plan` | 設計・計画 |

### 2.3 subagentの特性

1. **独立したコンテキスト**: 各subagentは独自のコンテキストを持つ
2. **ファイル経由の引き継ぎ**: 結果はファイルに書き出して引き継ぐ
3. **並列実行可能**: 複数のTask呼び出しを同時に行える
4. **結果の返却**: 完了時に結果をメインAgentに返す

---

## 3. subagent化の設計方針

### 3.1 基本アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                   subagent化後のアーキテクチャ               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   User ←→ Claude (Orchestrator)                            │
│                 │                                           │
│                 ├── Task[research] → docs/workflows/research.md
│                 │                                           │
│                 ├── Task[requirements] → docs/workflows/requirements.md
│                 │                                           │
│                 ├── Task[parallel_analysis]                 │
│                 │      ├── Task[threat_modeling] (並列)     │
│                 │      └── Task[planning] (並列)            │
│                 │                                           │
│                 ├── Task[parallel_design]                   │
│                 │      ├── Task[state_machine] (並列)       │
│                 │      ├── Task[flowchart] (並列)           │
│                 │      └── Task[ui_design] (並列)           │
│                 │                                           │
│                 └── ... (以降のフェーズ)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 フェーズ別subagent設計

| フェーズ | subagent_type | モデル | 入力 | 出力 |
|---------|---------------|--------|------|------|
| research | Explore | haiku | - | research.md |
| requirements | general-purpose | sonnet | research.md | requirements.md |
| threat_modeling | general-purpose | sonnet | requirements.md | threat-model.md |
| planning | Plan | sonnet | requirements.md | spec.md |
| state_machine | general-purpose | haiku | spec.md | state-machine.mmd |
| flowchart | general-purpose | haiku | spec.md | flowchart.mmd |
| ui_design | general-purpose | sonnet | spec.md | ui-design.md |
| test_design | Plan | sonnet | spec.md, *.mmd | test-design.md |
| test_impl | general-purpose | sonnet | test-design.md | *.test.ts |
| implementation | general-purpose | sonnet | test-design.md, *.test.ts | *.ts |
| refactoring | general-purpose | haiku | *.ts | *.ts (改善版) |
| build_check | Bash | haiku | - | build結果 |
| code_review | general-purpose | sonnet | *.ts | code-review.md |
| testing | Bash | haiku | - | テスト結果 |
| manual_test | general-purpose | haiku | - | manual-test.md |
| security_scan | Bash | haiku | - | security-scan.md |
| performance_test | Bash | haiku | - | performance-test.md |
| e2e_test | Bash | haiku | - | e2e-test.md |
| docs_update | general-purpose | haiku | 全成果物 | 更新ドキュメント |
| commit | Bash | haiku | - | commit結果 |
| push | Bash | haiku | - | push結果 |

### 3.3 コンテキスト引き継ぎ方式

**ファイルベース引き継ぎ:**
```
docs/workflows/{taskName}/
├── research.md          # researchフェーズの出力
├── requirements.md      # requirementsフェーズの出力
├── spec.md              # planningの出力
├── threat-model.md      # threat_modelingの出力
├── state-machine.mmd    # state_machineの出力
├── flowchart.mmd        # flowchartの出力
├── ui-design.md         # ui_designの出力
└── test-design.md       # test_designの出力
```

各subagentは:
1. 前フェーズの成果物をReadツールで読み込む
2. 自身の成果物をWriteツールで書き出す
3. MCPのworkflow_nextで次フェーズへ遷移

### 3.4 並列フェーズの実行

**parallel_analysis:**
```typescript
// 2つのTaskを同時に起動
Task[threat_modeling] + Task[planning]
// 両方完了後に workflow_complete_sub を2回呼び出し
// 全完了後に workflow_next
```

**parallel_design:**
```typescript
// 3つのTaskを同時に起動
Task[state_machine] + Task[flowchart] + Task[ui_design]
```

**parallel_quality:**
```typescript
// 2つのTaskを同時に起動
Task[build_check] + Task[code_review]
```

**parallel_verification:**
```typescript
// 4つのTaskを同時に起動
Task[manual_test] + Task[security_scan] + Task[performance_test] + Task[e2e_test]
```

---

## 4. 実装計画

### 4.1 変更箇所

1. **CLAUDE.md**: subagent実行の指示を追加
2. **skills/workflow/**: フェーズ別プロンプトテンプレート追加
3. **MCPサーバー**: 変更なし（状態管理は現状維持）

### 4.2 実装優先度

| 優先度 | 内容 |
|--------|------|
| P1 | CLAUDE.mdにsubagent実行ガイドライン追加 |
| P2 | 各フェーズ用のプロンプトテンプレート作成 |
| P3 | 並列フェーズの同時実行対応 |

### 4.3 リスクと対策

| リスク | 対策 |
|--------|------|
| subagent間の整合性 | 成果物の形式を厳密に定義 |
| 失敗時のリカバリ | 各フェーズの成果物をチェックポイントとして保存 |
| コスト増加 | haiku使用可能なフェーズはhaikuを指定 |

---

## 5. 結論

### 実現可能性: 高

- Claude CodeのTask toolで各フェーズをsubagentとして実行可能
- ファイルベースの引き継ぎで状態管理は現状のMCPサーバーを活用
- parallel_*フェーズは複数Taskの同時起動で実現

### 推奨アプローチ

1. CLAUDE.mdにsubagent実行のルールを追加
2. 各フェーズ用のプロンプトテンプレートをskills/配下に作成
3. Orchestratorパターンでメインのクラウドがsubagentを統括
