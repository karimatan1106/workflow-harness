phase: scope_definition
task: workflow-harness-refactoring
status: complete

summary:
  purpose: workflow-harnessのvscode-ext削除、hookバックアップ掃除、subagentテンプレート直接取得、hearing DoD強化、Serena CLI全フェーズ統合
  rootCause: 不要コンポーネント蓄積とオーケストレーターのコンテキスト非効率
  reporter: user

scopeFiles[20]:
  - path: workflow-harness/vscode-ext/src/extension.ts, role: vscode拡張メインソース, lines: 77, changeType: deleted
  - path: workflow-harness/vscode-ext/out/extension.js, role: vscode拡張ビルド出力, lines: N/A, changeType: deleted
  - path: workflow-harness/vscode-ext/package.json, role: vscode拡張パッケージ定義, lines: 27, changeType: deleted
  - path: workflow-harness/vscode-ext/tsconfig.json, role: vscode拡張TS設定, lines: 12, changeType: deleted
  - path: workflow-harness/vscode-ext/package-lock.json, role: vscode拡張ロックファイル, lines: N/A, changeType: deleted
  - path: workflow-harness/vscode-ext/harness-log-pane-0.1.0.vsix, role: vscode拡張ビルド成果物, lines: N/A, changeType: deleted
  - path: workflow-harness/vscode-ext/node_modules/, role: vscode拡張依存パッケージ, lines: N/A, changeType: deleted
  - path: workflow-harness/hooks/pre-tool-guard.sh.bak2, role: hookバックアップ, lines: N/A, changeType: deleted
  - path: workflow-harness/hooks/pre-tool-guard.sh.bak3, role: hookバックアップ, lines: N/A, changeType: deleted
  - path: workflow-harness/hooks/pre-tool-guard.sh.disabled, role: hook無効化ファイル, lines: N/A, changeType: deleted
  - path: workflow-harness/hooks/test-guard.sh.bak4, role: hookバックアップ, lines: N/A, changeType: deleted
  - path: workflow-harness/STRUCTURE_REPORT.md, role: プロジェクト構造ドキュメント, lines: 318, changeType: modified
  - path: .claude/skills/workflow-harness/workflow-orchestrator.md, role: オーケストレータースキル定義, lines: 186, changeType: modified
  - path: .claude/skills/workflow-harness/workflow-execution.md, role: 実行フロースキル定義, lines: 71, changeType: modified
  - path: workflow-harness/mcp-server/src/phases/registry.ts, role: フェーズ登録・DoD定義, lines: 153, changeType: modified
  - path: workflow-harness/mcp-server/src/phases/defs-stage0.ts, role: hearing等Stage0テンプレート, lines: 42, changeType: modified
  - path: workflow-harness/mcp-server/src/phases/defs-stage1.ts, role: scope/research等Stage1テンプレート, lines: 202, changeType: modified
  - path: workflow-harness/mcp-server/src/phases/defs-stage2.ts, role: threat/planning等Stage2テンプレート, lines: 175, changeType: modified
  - path: workflow-harness/mcp-server/src/phases/defs-stage4.ts, role: test_design等Stage4テンプレート, lines: 185, changeType: modified
  - path: workflow-harness/mcp-server/src/phases/defs-stage5.ts, role: implementation等Stage5テンプレート, lines: 153, changeType: modified

## decisions
- SD-01: vscode-ext/ディレクトリを全削除する (他モジュールからの実行時依存なし。grep調査でSTRUCTURE_REPORT.mdと過去workflow-state.toonのみ参照。ユーザー明示指示)
- SD-02: STRUCTURE_REPORT.mdからvscode-ext記載を除去する (L38のディレクトリ一覧とL140-L148のセクション2.6を削除。実体がなくなるためドキュメント整合性を維持)
- SD-03: hooks/バックアップ4ファイルを削除する (git履歴で復元可能。.bak2/.bak3/.disabled/.bak4は運用上不要)
- SD-04: workflow-orchestrator.mdのテンプレート取得フローをcoordinator直接呼び出しに変更する (現在のorchestrator経由フローはコンテキストを余分に消費。coordinatorがMCP経由でharness_get_subphase_templateを直接呼べば中間転送が不要になる)
- SD-05: hearingフェーズDoDにuserResponse存在チェックを追加する (AskUserQuestionの使用を間接的に強制し、ユーザー意図の取得漏れを防止。registry.tsのdodChecksが空配列のため追加が必要)
- SD-06: Serena CLI統合をresearchとtest_designフェーズに優先拡大する (依存パス調査とテスト対象シンボル検索はSerenaのコードインテリジェンスが直接活用できる。scope_definitionとimpact_analysisは統合済み)
- SD-07: workflow-state.toon内のvscode-ext参照は過去記録として残す (過去タスク状態を書き換えると履歴追跡性が損なわれる。実行時に参照されないため影響なし)

## artifacts
- docs/workflows/workflow-harness-refactoring/scope-definition.md: スコープ定義

## next
- criticalDecisions: vscode-ext全削除(SD-01)、hookバックアップ削除(SD-03)、テンプレート取得フロー変更(SD-04)、hearing DoD追加(SD-05)、Serena CLI統合拡大(SD-06)
- readFiles: workflow-harness/vscode-ext/src/extension.ts, workflow-harness/STRUCTURE_REPORT.md, workflow-harness/hooks/pre-tool-guard.sh.bak2, .claude/skills/workflow-harness/workflow-orchestrator.md, .claude/skills/workflow-harness/workflow-execution.md, workflow-harness/mcp-server/src/phases/registry.ts, workflow-harness/mcp-server/src/phases/defs-stage0.ts, workflow-harness/mcp-server/src/phases/defs-stage1.ts, workflow-harness/mcp-server/src/phases/defs-stage2.ts, workflow-harness/mcp-server/src/phases/defs-stage4.ts, workflow-harness/mcp-server/src/phases/defs-stage5.ts, workflow-harness/mcp-server/src/gates/dod-l4-content.ts
- warnings: vscode-ext削除はサブモジュール内操作のため、サブモジュール側でコミットしてから親リポジトリで参照更新が必要
