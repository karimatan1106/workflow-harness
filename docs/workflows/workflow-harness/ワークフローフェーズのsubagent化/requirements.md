# 要件定義: ワークフローフェーズのsubagent化

## 1. 背景と目的

### 1.1 背景

現在のworkflow-pluginは、18フェーズのワークフローを1つのClaudeセッションで順次実行している。この方式には以下の問題がある：

1. **コンテキスト肥大化**: 長いセッションでcompactingが発生し、前フェーズの詳細が失われる
2. **並列フェーズの未実現**: `parallel_*`フェーズは概念のみで実際は順次実行
3. **再実行の困難さ**: フェーズ単位での再実行ができない

### 1.2 目的

各ワークフローフェーズをsubagent（Task tool）で実行することで：

1. **コンテキスト分離**: 各フェーズが独立したコンテキストで実行される
2. **並列実行の実現**: parallel_*フェーズで実際に並列実行
3. **再実行可能性**: 失敗フェーズのみ再実行可能
4. **コスト最適化**: フェーズごとに適切なモデル（haiku/sonnet）を選択

---

## 2. 機能要件

### 2.1 フェーズ実行のsubagent化

#### FR-001: 各フェーズをsubagentとして実行
- メインのClaudeはOrchestratorとして動作
- 各フェーズはTask toolで個別のsubagentとして起動
- subagentはフェーズの作業を完了し、成果物をファイルに出力

#### FR-002: フェーズ間のコンテキスト引き継ぎ
- 前フェーズの成果物は `docs/workflows/{taskName}/` に保存
- 次フェーズのsubagentは前フェーズの成果物をReadで読み込み
- 構造化されたファイル形式（Markdown、Mermaid）を使用

#### FR-003: 並列フェーズの同時実行
- `parallel_analysis`: threat_modelingとplanningを並列実行
- `parallel_design`: state_machine, flowchart, ui_designを並列実行
- `parallel_quality`: build_checkとcode_reviewを並列実行
- `parallel_verification`: manual_test, security_scan, performance_test, e2e_testを並列実行

### 2.2 プロンプトテンプレート

#### FR-004: フェーズ別プロンプトテンプレート
- 各フェーズ用のプロンプトテンプレートを `skills/workflow/phases/` に配置
- テンプレートには以下を含む：
  - フェーズの目的と成果物
  - 入力ファイルの読み込み指示
  - 出力ファイルの書き込み指示
  - 品質基準

#### FR-005: subagent_typeとmodelの選択基準
| フェーズ種別 | subagent_type | model |
|-------------|---------------|-------|
| 調査・探索 | Explore | haiku |
| 設計・計画 | Plan | sonnet |
| 実装 | general-purpose | sonnet |
| ビルド・テスト実行 | Bash | haiku |
| レビュー | general-purpose | sonnet |
| ドキュメント更新 | general-purpose | haiku |

### 2.3 状態管理

#### FR-006: MCPサーバーとの連携
- subagentはフェーズ完了後に `workflow_complete_sub` または `workflow_next` を呼び出す
- Orchestratorがsubagent完了を検知して次フェーズを開始
- 状態管理は既存のMCPサーバーを継続使用

#### FR-007: エラーハンドリング
- subagentが失敗した場合、Orchestratorにエラーを返す
- Orchestratorはユーザーに失敗を通知し、再実行を提案
- 成功したフェーズの成果物は保持される

---

## 3. 非機能要件

### 3.1 パフォーマンス

#### NFR-001: 並列実行による効率化
- parallel_*フェーズでは複数subagentを同時起動
- 個別フェーズより全体の実行時間を短縮

### 3.2 コスト

#### NFR-002: モデル選択によるコスト最適化
- 単純なタスク（ビルド、テスト実行）はhaikuを使用
- 複雑なタスク（設計、実装）はsonnetを使用
- 重要なレビューはsonnet/opusを使用

### 3.3 保守性

#### NFR-003: プロンプトテンプレートの独立管理
- 各フェーズのプロンプトは独立したファイルで管理
- テンプレートの修正が容易

#### NFR-004: 後方互換性
- 既存のMCPサーバーは変更なし
- 既存のワークフロー状態ファイルとの互換性維持

---

## 4. 受け入れ基準

### AC-001: subagent実行の動作確認
- [ ] researchフェーズがsubagentとして実行できる
- [ ] subagentの出力がdocs/workflows/に保存される
- [ ] 次フェーズのsubagentが前フェーズの成果物を読み込める

### AC-002: 並列実行の動作確認
- [ ] parallel_analysisで2つのsubagentが同時起動される
- [ ] 両方のsubagent完了後にworkflow_nextが呼び出せる
- [ ] 並列実行の結果が正しくマージされる

### AC-003: エラーハンドリングの確認
- [ ] subagent失敗時にエラーが適切に報告される
- [ ] 失敗フェーズの再実行が可能
- [ ] 成功フェーズの成果物が保持される

### AC-004: コスト最適化の確認
- [ ] 単純フェーズでhaikuが使用される
- [ ] 複雑フェーズでsonnetが使用される
- [ ] モデル指定がTask toolに正しく渡される

---

## 5. 制約事項

### 5.1 技術的制約
- Claude CodeのTask toolの仕様に依存
- subagent間の直接通信は不可（ファイル経由のみ）
- バックグラウンド実行のsubagentは結果確認が必要

### 5.2 運用上の制約
- subagentはOrchestratorのコンテキストを共有しない
- 各subagentは独立して完結する必要がある
- ユーザー確認が必要なフェーズ（design_review）はOrchestratorで処理

---

## 6. 用語定義

| 用語 | 定義 |
|------|------|
| Orchestrator | フェーズ間の制御を行うメインのClaude |
| subagent | Task toolで起動される個別のClaude |
| フェーズ成果物 | 各フェーズで生成されるMarkdown/Mermaidファイル |
| parallel_*フェーズ | 複数のサブフェーズを並列実行するフェーズ |
