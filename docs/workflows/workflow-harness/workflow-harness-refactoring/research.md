phase: research
task: workflow-harness-refactoring
status: complete
inputArtifact: docs/workflows/workflow-harness-refactoring/scope-definition.md

existingPatterns[5]:
  - {id: EP-01, pattern: hookガードによる3層ツールアクセス制御, location: workflow-harness/hooks/tool-gate.js, description: L1/L2/L3のツール権限をフェーズ別に制限。HARNESS_LAYER環境変数で層判定。coordinator(L2)は非ライフサイクルMCPを呼び出し可能}
  - {id: EP-02, pattern: テンプレートSerena-first + Grep fallback, location: workflow-harness/mcp-server/src/phases/defs-stage1.ts, description: Step 0でSerena利用可否チェック、Step 1でLSP検索、失敗時にGrep/Globにフォールバック。scope_definitionとimpact_analysisで適用済み}
  - {id: EP-03, pattern: dodChecks空配列 + gates/一括DoD実行, location: workflow-harness/mcp-server/src/phases/registry.ts + gates/, description: 全31フェーズでdodChecks=[]。DoDはgates/配下の14モジュール(dod-l1-l2.ts, dod-l4-content.ts等)で一括実行。フェーズ固有チェックは未使用}
  - {id: EP-04, pattern: hook-utils.js共通ユーティリティ, location: workflow-harness/hooks/hook-utils.js, description: findProjectRoot/getCurrentPhase/isBypassPath/parseHookInput/readStdinを5つのhookファイルから共有。全hookの基盤モジュール(82行)}
  - {id: EP-05, pattern: ステージ別テンプレートファイル分割, location: workflow-harness/mcp-server/src/phases/defs-stage0.ts - defs-stage6.ts, description: 7ファイルに30フェーズを分割。各ファイル42-202行で200行制限をほぼ遵守}

magicNumbers[11]:
  - {value: 30, location: context-watchdog.js L6, purpose: ツール呼び出し閾値で記憶リフレッシュ注入, rationale: コンテキスト劣化防止の経験的閾値}
  - {value: 3, location: context-watchdog.js L7, purpose: 同一ファイル重複Read検出上限, rationale: 3回以上の同一Read=コンテキスト喪失の兆候}
  - {value: 10, location: context-watchdog.js L8, purpose: Write/Edit回数ごとのチェックポイント確認, rationale: 編集集中時の中間保存強制}
  - {value: 600000, location: context-watchdog.js L9, purpose: チェックポイント有効期限(10分), rationale: 10分以上経過でチェックポイント再取得}
  - {value: 5, location: loop-detector.js L7, purpose: 5分間の同一ファイル編集上限, rationale: 5回超=無限ループの可能性}
  - {value: 300000, location: loop-detector.js L8, purpose: ループ検出ウィンドウ(5分), rationale: MAX_EDITS_IN_WINDOWと対}
  - {value: 1800000, location: session-boundary.js L6, purpose: ハンドオフ再注入間隔(30分), rationale: セッション長期化時の定期リマインド}
  - {value: 100, location: defs-stage1.ts L33/L47, purpose: Serena search/referencing結果上限, rationale: 大規模コードベースでの出力制限}
  - {value: 50, location: defs-stage1.ts L38, purpose: Serena find_symbol結果上限, rationale: シンボル検索の出力制限}
  - {value: 10, location: defs-stage1.ts L50, purpose: 依存追跡の最大ホップ数, rationale: 循環依存や深い依存チェーンの打ち切り}
  - {value: 20, location: registry.ts L150, purpose: minLines下限値, rationale: 成果物の最低品質保証}

implicitConstraints[5]:
  - {id: IC-01, constraint: coordinator(L2)はライフサイクルMCP以外を呼び出し可能, source: tool-gate.js L48-L56, impact: テンプレート直接取得(SD-04)はhook変更不要で実現可能}
  - {id: IC-02, constraint: dodChecks配列は型定義済みだが全フェーズ未使用, source: registry.ts全31フェーズ + types-core.ts L6-L9, impact: hearing DoD追加(SD-05)は初のdodChecks利用事例となり、他フェーズへの波及可能性あり}
  - {id: IC-03, constraint: defs-stage3.tsがスコープ定義に未記載だが実在, source: research-analysis.md セクション3, impact: design_review/test_design/test_selectionのテンプレートもSerena統合対象に含める必要あり}
  - {id: IC-04, constraint: test-guard.sh(263行)が200行制限超過, source: research-analysis.md RD-08, impact: 本タスクスコープ外だが将来の分割対象}
  - {id: IC-05, constraint: 環境変数TOOL_GUARD_DISABLEで全hookバイパス可能, source: pre-tool-guard.sh L21, impact: テスト時のバイパス手段として存在。本番運用では未設定が前提}

fileAnalysis[14]:
  - {path: workflow-harness/vscode-ext/src/extension.ts, lines: 77, keyFindings: VSCode拡張メインソース。ランタイム依存ゼロ。削除安全}
  - {path: workflow-harness/vscode-ext/package.json, lines: 27, keyFindings: harness-log-paneパッケージ定義。外部依存なし}
  - {path: workflow-harness/vscode-ext/tsconfig.json, lines: 12, keyFindings: TS設定。他tsconfig.jsonから参照なし}
  - {path: workflow-harness/STRUCTURE_REPORT.md, lines: 318, keyFindings: L38ディレクトリ一覧とL140-L148セクション2.6にvscode-ext記載。2箇所修正必要}
  - {path: workflow-harness/hooks/hook-utils.js, lines: 82, keyFindings: 5hookから共有される基盤。変更対象外}
  - {path: workflow-harness/hooks/tool-gate.js, lines: 237, keyFindings: 3層ツール制御。coordinator MCP呼び出し許可確認済み。200行超だがスコープ外}
  - {path: workflow-harness/mcp-server/src/phases/registry.ts, lines: 153, keyFindings: 全31フェーズ登録。dodChecks全空。hearing DoD追加対象}
  - {path: workflow-harness/mcp-server/src/phases/defs-stage0.ts, lines: 42, keyFindings: hearingテンプレート。Serena統合なし}
  - {path: workflow-harness/mcp-server/src/phases/defs-stage1.ts, lines: 202, keyFindings: Serena統合済み(scope_definition/impact_analysis)。research未統合}
  - {path: workflow-harness/mcp-server/src/phases/defs-stage2.ts, lines: 175, keyFindings: threat_modeling-ui_design。Serena未統合。分析/設計フェーズ}
  - {path: workflow-harness/mcp-server/src/phases/defs-stage3.ts, lines: 130, keyFindings: design_review/test_design/test_selection。スコープ定義で言及漏れ。追加対象}
  - {path: workflow-harness/mcp-server/src/phases/defs-stage4.ts, lines: 185, keyFindings: test_impl/implementation/refactoring/build_check/code_review。Serena未統合}
  - {path: workflow-harness/mcp-server/src/phases/defs-stage5.ts, lines: 153, keyFindings: testing-security_scan。Serena未統合}
  - {path: .claude/skills/workflow-harness/workflow-orchestrator.md, lines: 186, keyFindings: L27-L28テンプレート取得フロー、L101 VERBATIM制約。coordinator直接取得への変更対象}

## decisions
- R-01: vscode-ext/はランタイム依存ゼロ。STRUCTURE_REPORT.md L38とL140-L148の2箇所修正のみで安全に全削除可能
- R-02: hookバックアップ4ファイル(bak2/bak3/disabled/bak4)は他ファイルから参照なし。git履歴で復元可能。削除安全
- R-03: hook-utils.jsは全5hookファイルの共通基盤(82行)。本タスクでは変更対象外
- R-04: dodChecks配列は全31フェーズで空だが型定義(DoDCheck)は整備済み。hearing用にuserResponse存在チェックを追加可能。選択肢AまたはCを採用
- R-05: tool-gate.js L48-L56により、coordinatorはharness_get_subphase_templateを既に呼び出し可能。hook変更不要でテンプレート直接取得を実現
- R-06: Serena CLIはscope_definition/impact_analysisのみ統合済み。research/test_designへの拡大はdefs-stage1.tsとdefs-stage3.tsのテンプレート追記で対応
- R-07: defs-stage3.ts(130行)がスコープ定義で言及漏れ。design_review/test_design/test_selectionを含むため、スコープに追加
- R-08: Serena MCPサーバー化を採用。CLI廃止し.mcp.jsonにserenaエントリを追加。テンプレート内のSerenaコマンド記述をMCPツール呼び出し形式に統一
- R-09: coordinator/workerからBash削除は実施済み。tool-gate.jsのL2/L3許可リストとの整合性を確認済み
- R-10: test-guard.sh(263行)は200行制限超過だが、テストファイルのため本タスクスコープ外として扱う

## artifacts
- docs/workflows/workflow-harness-refactoring/research.md: research調査レポート

## next
- criticalDecisions: vscode-ext全削除安全性確認(R-01)、hearing dodChecks初活用(R-04)、coordinator直接テンプレート取得はhook変更不要(R-05)、Serena MCPサーバー化(R-08)、defs-stage3.tsスコープ追加(R-07)
- readFiles: workflow-harness/mcp-server/src/phases/registry.ts, workflow-harness/mcp-server/src/phases/defs-stage1.ts, workflow-harness/mcp-server/src/phases/defs-stage3.ts, .claude/skills/workflow-harness/workflow-orchestrator.md, .claude/skills/workflow-harness/workflow-execution.md, workflow-harness/STRUCTURE_REPORT.md, .mcp.json, workflow-harness/mcp-server/src/gates/dod-l4-content.ts
- warnings: vscode-ext削除はサブモジュール内操作のためサブモジュール側で先にコミットが必要。dodChecks初活用は他フェーズへの波及設計を考慮すること。defs-stage1.ts(202行)は200行制限境界のためSerena統合追記時に行数超過注意
