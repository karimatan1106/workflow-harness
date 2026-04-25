# scope-analysis: workflow-harness-refactoring

## 1. D-HR-1: vscode-ext/ 全削除 + 参照掃除

### 対象ディレクトリ
- `workflow-harness/vscode-ext/` (存在確認済み: src/, out/, node_modules/, package.json, tsconfig.json, .vsix)

### 参照箇所 (grep結果)

| ファイル | 行番号 | 内容 |
|---------|--------|------|
| `workflow-harness/STRUCTURE_REPORT.md` | L38 | `vscode-ext/` ディレクトリ構造記載 |
| `workflow-harness/STRUCTURE_REPORT.md` | L140-L148 | セクション 2.6 VS Code Extension 解説 |
| `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/workflows/27a3413e.../workflow-state.toon` | L23, L34 | scopeFiles に vscode-ext パス含む |
| `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/workflows/a0e87be6.../workflow-state.toon` | L18, L34 | userIntent に vscode-ext 削除意図記載 |

### 注意
- setup.sh, .gitignore, package.json(root) にはvscode-ext参照なし
- workflow-state.toon内の参照は過去タスク状態。削除後もtoon内の文字列は残して構わない（過去記録）

---

## 2. D-HR-3: hooks/ バックアップファイル削除

### 対象ファイル (4件)
| ファイル | パス |
|---------|------|
| pre-tool-guard.sh.bak2 | `workflow-harness/hooks/pre-tool-guard.sh.bak2` |
| pre-tool-guard.sh.bak3 | `workflow-harness/hooks/pre-tool-guard.sh.bak3` |
| pre-tool-guard.sh.disabled | `workflow-harness/hooks/pre-tool-guard.sh.disabled` |
| test-guard.sh.bak4 | `workflow-harness/hooks/test-guard.sh.bak4` |

### 注意
- 他にバックアップファイルなし（.old, *backup* も未検出）

---

## 3. D-HR-4: harness_get_subphase_template スキルドキュメント更新

### 現状の記述箇所

| ファイル | 行番号 | 内容 |
|---------|--------|------|
| `workflow-orchestrator.md` | L27 | `b. If hasTemplate: harness_get_subphase_template → get prompt` |
| `workflow-orchestrator.md` | L28 | `c. Agent(subagent_type="coordinator", prompt=template)` |
| `workflow-orchestrator.md` | L101 | `NEVER construct prompts from scratch. Get from harness_next or harness_get_subphase_template.` |
| `workflow-orchestrator.md` | L160 | ツール一覧表に harness_get_subphase_template 記載 |
| `workflow-execution.md` | L71 | `必須キー: フェーズごとのDoD要件（harness_get_subphase_template で取得可能）` |

### 変更方針
- L27-L28: coordinatorがMCP経由で直接テンプレートを取得する旨に更新
- L101: 同様に更新
- 現在のフローは「orchestrator → harness_get_subphase_template → template → coordinator」だが、「coordinator → harness_get_subphase_template → template」に変更

---

## 4. D-HR-5: hearingフェーズDoD userResponse必須チェック

### 現状
- `registry.ts` L10: hearing定義に `dodChecks: []` (空配列)
- `defs-stage0.ts` L12-L41: hearingテンプレートにAskUserQuestion手順あるが、DoDにuserResponse検証なし
- `dod-l4-delta.ts` L19: hearingはdelta_entry_format対象に含まれている
- gates/ 配下にhearing固有のDoDチェッカーは存在しない
- `types-core.ts` L89: APPROVAL_GATES に `hearing: 'hearing'` は既に存在

### 必要な変更
- hearingのDoDにuserResponse存在チェック（L4 content check）を追加する必要あり
- 実装先候補: `gates/dod-l4-content.ts` または新規ファイル

---

## 5. Serena CLI統合状況 (フェーズテンプレート)

### 統合済みフェーズ
| ファイル | フェーズ | Serena統合 |
|---------|---------|-----------|
| `defs-stage1.ts` | scope_definition | 統合済み (L27-L48: 検索/依存追跡) |
| `defs-stage1.ts` | impact_analysis | 統合済み (L131-L132: 逆依存グラフ) |

### 未統合フェーズ
| ファイル | フェーズ | 備考 |
|---------|---------|------|
| `defs-stage0.ts` | hearing | コードベース事前調査あるがSerena未統合 |
| `defs-stage1.ts` | research | 関連コード分析あるがSerena未統合 |
| `defs-stage1.ts` | requirements | コード参照なし |
| `defs-stage2.ts` | threat_modeling, planning | Serena未統合 |
| `defs-stage3.ts` | state_machine, flowchart, ui_design, design_review | Serena未統合 |
| `defs-stage4.ts` | test_design, test_selection | Serena未統合 |
| `defs-stage5.ts` | test_impl, implementation, refactoring | Serena未統合 |
| `defs-stage6.ts` | build_check, code_review以降 | Serena未統合 |

### 統合拡大の優先度
- 高: research (依存パス調査), test_design (テスト対象シンボル検索)
- 中: hearing (事前調査), planning (設計参照)
- 低: requirements, threat_modeling, design系 (主にドキュメント生成)

---

## 6. プロジェクト性質判定

| 性質 | 判定 | 根拠 |
|------|------|------|
| hasUI | false | UI FW (React/Vue/Angular/Svelte) 不使用。vscode-ext削除予定 |
| hasAPI | true | MCP Server (mcp-server/) がツールAPI提供 |
| hasDB | false | DB層 (Prisma/TypeORM等) 不使用。ファイルベース状態管理 |
| hasEvents | false | EventEmitter/MQ/WebSocket 不使用 |
| hasI18n | false | 国際化FW不使用 |
| hasDesignSystem | false | デザインシステム不使用 |

---

## 7. スコープファイル一覧

### 削除対象
- `workflow-harness/vscode-ext/` (ディレクトリ全体)
- `workflow-harness/hooks/pre-tool-guard.sh.bak2`
- `workflow-harness/hooks/pre-tool-guard.sh.bak3`
- `workflow-harness/hooks/pre-tool-guard.sh.disabled`
- `workflow-harness/hooks/test-guard.sh.bak4`

### 参照掃除対象
- `workflow-harness/STRUCTURE_REPORT.md` (L38, L140-L148)

### スキルドキュメント更新対象
- `.claude/skills/workflow-harness/workflow-orchestrator.md` (L27-L28, L101, L160)
- `.claude/skills/workflow-harness/workflow-execution.md` (L71)

### DoD追加対象
- `workflow-harness/mcp-server/src/phases/registry.ts` (L10: dodChecks)
- `workflow-harness/mcp-server/src/gates/` (新規または既存ファイル)

### Serena CLI統合対象 (テンプレート更新)
- `workflow-harness/mcp-server/src/phases/defs-stage0.ts` (hearing)
- `workflow-harness/mcp-server/src/phases/defs-stage1.ts` (research)
- `workflow-harness/mcp-server/src/phases/defs-stage2.ts`
- `workflow-harness/mcp-server/src/phases/defs-stage3.ts`
- `workflow-harness/mcp-server/src/phases/defs-stage4.ts`
- `workflow-harness/mcp-server/src/phases/defs-stage5.ts`
- `workflow-harness/mcp-server/src/phases/defs-stage6.ts`

---

## 8. リスク評価

| リスク | レベル | 軽減策 |
|--------|--------|--------|
| vscode-ext削除でworkflow-state.toon内の参照が壊れる | 低 | 過去記録なので影響なし |
| STRUCTURE_REPORT.md更新漏れ | 低 | grep結果が2箇所のみで明確 |
| hearing DoD追加でfalse-positiveブロック | 中 | userResponse検出ロジックの正確な設計が必要 |
| Serena CLI統合拡大で既存テンプレートが肥大化 | 中 | 200行制限に注意。必要ならファイル分割 |
