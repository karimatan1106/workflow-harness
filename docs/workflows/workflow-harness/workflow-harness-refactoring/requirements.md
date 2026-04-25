phase: requirements
task: workflow-harness-refactoring
status: complete
inputArtifacts: [research.md, impact-analysis.md]

functionalRequirements[6]:
  - {id: F-001, description: vscode-ext/ディレクトリを全削除し、STRUCTURE_REPORT.md L38およびL140-L148の参照を除去する, source: SD-01/R-01/IA-01, priority: must}
  - {id: F-002, description: hooks/配下のバックアップファイル4件(pre-tool-guard.sh.bak2/bak3/disabled, test-guard.sh.bak4)を削除する, source: SD-02/R-02/IA-01, priority: must}
  - {id: F-003, description: workflow-orchestrator.mdのテンプレート取得フローをcoordinatorによるMCP直接呼び出し手順に更新する, source: SD-04/R-05/IC-01, priority: must}
  - {id: F-004, description: hearing フェーズのdodChecksにuserResponse存在チェックを追加する(registry.tsのhearing定義), source: SD-05/R-04/IC-02/IA-02, priority: must}
  - {id: F-005, description: Serena CLIを廃止しMCPサーバー化する。.mcp.jsonにserenaエントリを追加し、テンプレート内のCLIコマンドをMCPツール呼び出し形式に統一する, source: SD-06/R-08/BC-01/IA-03, priority: must}
  - {id: F-006, description: defs-a.tsのTaskSize型からsmall/mediumを削除し、SIZE_SKIP_MAP/SIZE_MINLINES_FACTOR/getActivePhases/getPhaseConfigのsmall/medium分岐を除去する, source: SD-07/BC-02/IA-04, priority: should}

nonFunctionalRequirements[4]:
  - {id: NF-001, category: build, description: npm run buildが成功すること, threshold: exit code 0}
  - {id: NF-002, category: test, description: 既存テストが全て通過すること, threshold: vitest pass rate 100%}
  - {id: NF-003, category: codeSize, description: 変更対象ファイルが200行制限を遵守すること, threshold: 全変更ファイル200行以下}
  - {id: NF-004, category: submodule, description: サブモジュール内変更はサブモジュール側で先にコミットし親リポジトリで参照更新すること, threshold: git submodule statusが正常}

## acceptanceCriteria
- AC-1: vscode-ext/ディレクトリが存在しないこと
- AC-2: hooks/配下にバックアップファイル(.bak2, .bak3, .disabled, .bak4)が存在しないこと
- AC-3: npm run build が成功すること
- AC-4: 既存テストが全て通過すること
- AC-5: .mcp.jsonにSerena MCPサーバーが登録されていること
- AC-6: defs-a.tsのsize enumにsmall/mediumが含まれないこと
- AC-7: coordinator.md/worker.mdのtools行にBashが含まれないこと(実施済み確認)
- AC-8: workflow-orchestrator.mdにcoordinatorのテンプレート直接取得手順が記載されていること

rtm[8]:
  - {ac: AC-1, req: F-001, verification: ls workflow-harness/vscode-ext/ が失敗すること}
  - {ac: AC-2, req: F-002, verification: ls workflow-harness/hooks/*.bak* workflow-harness/hooks/*.disabled が失敗すること}
  - {ac: AC-3, req: NF-001, verification: npm run build exit code 0}
  - {ac: AC-4, req: NF-002, verification: npm test exit code 0}
  - {ac: AC-5, req: F-005, verification: .mcp.jsonにserenaキーが存在すること}
  - {ac: AC-6, req: F-006, verification: grep -c small defs-a.ts が0を返すこと}
  - {ac: AC-7, req: confirmed, verification: grep Bash coordinator.md worker.md のtools行がヒットしないこと}
  - {ac: AC-8, req: F-003, verification: workflow-orchestrator.mdにharness_get_subphase_template記述が存在すること}

## NOT_IN_SCOPE
- mcp-serverの大規模リファクタリング
- 新フェーズの追加
- テストの新規追加(既存テストの修正のみ)
- test-guard.sh(263行)の200行制限対応(IC-04)
- tool-gate.js(237行)の200行制限対応
- Serena統合のresearch/test_design/design_reviewフェーズへの拡大(R-06/R-07は将来タスク)
- defs-stage2.ts/defs-stage4.ts/defs-stage5.ts/defs-stage6.tsの変更

## OPEN_QUESTIONS
なし

## decisions
- REQ-01: 実施済み3件(項目7: Bash削除, 項目8: hearing enum追加, 項目9: 型エラー修正)は要件から除外し、AC-7で確認のみ行う
- REQ-02: 低リスク群(F-001, F-002, F-003)は相互依存なく並列実行可能(IA-01/IA-05に基づく)
- REQ-03: 中リスク群(F-004, F-005, F-006)は個別にテスト確認を行う(IA-05に基づく)
- REQ-04: hearing dodChecks追加(F-004)は全31フェーズで初のdodChecks利用事例。DoDCheck型定義は整備済みのため実装リスクは低いが、実行パスの動作確認を先行する(IA-02)
- REQ-05: Serena MCP化(F-005)でdefs-stage1.ts(現202行)のテンプレート書換時に200行制限超過リスクあり。必要に応じてファイル分割で対応(IA-03)
- REQ-06: small/mediumデッドコード削除(F-006)は影響範囲が最大(型定義+API+5テストファイル)だが、lifecycle.ts L48でlarge固定のため論理的リスクは低い(IA-04/BC-02)
- REQ-07: 破壊的変更2件(BC-01: Serena CLI廃止, BC-02: small/medium削除)は内部API変更のため外部互換性問題なし(IA-06)

## artifacts
- docs/workflows/workflow-harness-refactoring/requirements.md, spec, 要件定義

## next
- criticalDecisions: 低リスク群並列実行(REQ-02), hearing dodChecks動作確認先行(REQ-04), defs-stage1.ts行数超過対策(REQ-05)
- readFiles: workflow-harness/mcp-server/src/phases/registry.ts, workflow-harness/mcp-server/src/phases/defs-stage1.ts, workflow-harness/mcp-server/src/state/types-core.ts, workflow-harness/mcp-server/src/phases/defs-a.ts, .mcp.json, .claude/skills/workflow-harness/workflow-orchestrator.md, workflow-harness/STRUCTURE_REPORT.md
- warnings: サブモジュール内操作はサブモジュール側で先にコミットが必要。defs-stage1.ts(202行)は200行制限境界
