phase: impact_analysis
task: workflow-harness-refactoring
status: complete
summary: 6項目の影響分析を完了。低リスク3件(vscode-ext削除/hookバックアップ削除/テンプレート直接取得)と中リスク3件(hearing DoD追加/Serena MCP化/small-mediumデッドコード削除)に分類し、破壊的変更2件は内部APIのため外部互換性問題なし。

impactedFiles[20]:
  - {file: workflow-harness/vscode-ext/src/extension.ts, changeType: deleted, risk: low}
  - {file: workflow-harness/vscode-ext/out/extension.js, changeType: deleted, risk: low}
  - {file: workflow-harness/vscode-ext/package.json, changeType: deleted, risk: low}
  - {file: workflow-harness/vscode-ext/tsconfig.json, changeType: deleted, risk: low}
  - {file: workflow-harness/vscode-ext/package-lock.json, changeType: deleted, risk: low}
  - {file: workflow-harness/vscode-ext/harness-log-pane-0.1.0.vsix, changeType: deleted, risk: low}
  - {file: workflow-harness/vscode-ext/node_modules/, changeType: deleted, risk: low}
  - {file: workflow-harness/hooks/pre-tool-guard.sh.bak2, changeType: deleted, risk: low}
  - {file: workflow-harness/hooks/pre-tool-guard.sh.bak3, changeType: deleted, risk: low}
  - {file: workflow-harness/hooks/pre-tool-guard.sh.disabled, changeType: deleted, risk: low}
  - {file: workflow-harness/hooks/test-guard.sh.bak4, changeType: deleted, risk: low}
  - {file: workflow-harness/STRUCTURE_REPORT.md, changeType: modified, risk: low}
  - {file: .claude/skills/workflow-harness/workflow-orchestrator.md, changeType: modified, risk: low}
  - {file: .claude/skills/workflow-harness/workflow-execution.md, changeType: modified, risk: low}
  - {file: workflow-harness/mcp-server/src/phases/registry.ts, changeType: modified, risk: medium}
  - {file: workflow-harness/mcp-server/src/phases/defs-stage1.ts, changeType: modified, risk: medium}
  - {file: workflow-harness/hooks/tool-gate.js, changeType: modified, risk: medium}
  - {file: .mcp.json, changeType: modified, risk: medium}
  - {file: workflow-harness/mcp-server/src/state/types-core.ts, changeType: modified, risk: medium}
  - {file: workflow-harness/mcp-server/src/phases/defs-a.ts, changeType: modified, risk: medium}

unaffectedModules[5]:
  - {module: hooks/hook-utils.js + block-dangerous-commands.js + context-watchdog.js + loop-detector.js + session-boundary.js, reason: hookバックアップ削除は.bakファイルのみ対象。稼働中hookファイルは変更なし}
  - {module: phases/defs-stage2.ts + defs-stage4.ts + defs-stage5.ts + defs-stage6.ts, reason: Serena統合対象外のステージ。テンプレート変更なし}
  - {module: gates/dod-l1-l2.ts + dod-l4-content.ts + dod-l4-art.ts + dod-l4-commit.ts + dod-l4-refs.ts + dod-l4-toon.ts, reason: DoDゲートは汎用処理。dodChecks追加はregistry.ts側の変更で完結}
  - {module: state/manager-lifecycle.ts + manager-records.ts, reason: 状態管理の読み書きロジックは影響範囲外}
  - {module: tools/handler.ts + handlers/delegate-coordinator.ts + handlers/approval.ts, reason: ツールハンドラは既存インターフェースを維持。API変更なし}

breakingChanges[2]:
  - {id: BC-01, description: Serena CLI廃止とMCPサーバー化。serena-query.pyベースのCLI呼び出しをMCPツール形式に全面移行, mitigation: 内部APIのため外部互換性問題なし。serena-integration.test.tsの文字列マッチ修正が必要}
  - {id: BC-02, description: small/medium TaskSize型のデッドコード削除。SIZE_SKIP_MAP/SIZE_MINLINES_FACTOR/getActivePhases/getPhaseConfigからsmall/medium分岐を除去, mitigation: lifecycle.ts L48で既にlarge固定のため実動作変更なし。5テストファイルの修正が必要}

## decisions
- IA-01: vscode-ext削除とhookバックアップ削除は低リスク。ランタイム依存ゼロかつ参照ゼロのため独立して並列実行可能
- IA-02: hearing dodChecks追加は全31フェーズで初のdodChecks利用事例。DoDCheck型定義は整備済みだがlifecycle.ts/scope-nav.tsの実行パスに実績がないため、動作確認テストを先行すべき
- IA-03: Serena MCP化はdefs-stage1.tsのテンプレート全書換を伴う。現在202行で200行制限境界のため、MCPツール形式への変更時に行数超過に注意
- IA-04: small/mediumデッドコード削除は影響範囲が最大(型定義+API定義+5テストファイル)だが、既にlarge固定運用のため論理的リスクは低い
- IA-05: 項目1-3(低リスク群)は相互依存なく並列実行可能。項目4-6(中リスク群)も順序依存なしだが個別にテスト確認を推奨
- IA-06: 破壊的変更2件(BC-01/BC-02)は内部API変更のため外部互換性問題なし。テスト修正で吸収可能
- IA-07: STRUCTURE_REPORT.md修正箇所はL38ディレクトリ一覧とL140-L148セクション2.6の2箇所に限定。他セクションへの波及なし

## artifacts
- docs/workflows/workflow-harness-refactoring/impact-analysis.md, report, 影響分析レポート

## next
- criticalDecisions: 低リスク群(1,2,3)並列実行(IA-01), hearing dodChecks初活用テスト先行(IA-02), defs-stage1.ts 200行制限注意(IA-03), デッドコード削除の5テスト修正(IA-04)
- readFiles: workflow-harness/mcp-server/src/phases/registry.ts, workflow-harness/mcp-server/src/phases/defs-stage1.ts, workflow-harness/mcp-server/src/phases/defs-stage3.ts, workflow-harness/mcp-server/src/state/types-core.ts, .mcp.json, workflow-harness/hooks/tool-gate.js, workflow-harness/mcp-server/src/tools/handlers/lifecycle.ts
- warnings: サブモジュール内操作(vscode-ext削除/hookバックアップ削除)はサブモジュール側で先にコミットしてから親リポジトリで参照更新が必要。defs-stage1.ts(202行)はSerena MCP化テンプレート書換時に200行制限超過リスクあり。dodChecks初活用は他フェーズへの波及設計を考慮すること
