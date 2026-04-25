:toon hearing v1
:summary workflow-harness 4領域(hooks/indexer/mcp-server/skills)の重複・肥大化・不要コード整理リファクタリング

:section intent-analysis
:surfaceRequest workflow-harnessの追加リファクタリング。hooks/スクリプトの重複・肥大化整理、indexer/の不要コード整理、mcp-server/src/の200行超ファイル分割・重複排除・型改善、skills/ドキュメントの重複・古い記述整理。
:deepNeed ADR-009(v1リファクタリング)で大枠を整理した後に残る技術的負債の解消。200行制限(core-constraints)への準拠、重複ロジックによる保守コスト削減、Serena MCP導入後のindexer/の役割再評価。
:unclearPoints
  - indexer/を完全削除するか、serena-query.pyだけ残すか
  - hooks/のtest-guard.sh(263行)はテストファイルだが200行制限の対象か
  - skills/の"CLAUDE.md SecN"参照が古い場合、参照を削除するか更新するか
  - 4領域の優先順位(並列実行か順次か)
:assumptions
  - ADR-009のAC全件metが前提(v1完了済み)
  - Serena MCPが.mcp.jsonに登録済みでindexer/のCLIラッパーは代替可能
  - 200行制限はテストファイルには適用しない(core-constraintsは"ソースファイル"と規定)
  - hooks/のtest-guard.shはテストなので200行制限対象外だがリファクタリング推奨
userResponse: (hearing phaseでの質問不要 - ユーザーが4領域を明示指定済み)
:end intent-analysis

:section findings
:area hooks
  files: 9, total_lines: 1135
  over_200: test-guard.sh(263), tool-gate.js(237)
  duplication: JSON.parse/state-loading pattern in loop-detector.js, session-boundary.js, context-watchdog.js (hook-utils.jsに集約可能)
  issue: fs/path require重複、readStdin/parseHookInput呼び出しパターンの散在
:area indexer
  files: 3 (excluding .venv), total_lines: 321
  over_200: serena-query.py(276)
  issue: Serena MCPが直接利用可能になったため、CLIラッパーの必要性が低下
  note: .venvディレクトリ(大量のpipパッケージ)が残存
:area mcp-server-src
  files_over_200: delegate-coordinator.ts(367), lifecycle.ts(243), dod-l1-l2.ts(221), defs-stage1.ts(202)
  total_ts_files: 約90(テスト含む)
  non_test_total: 9944 lines
  critical: delegate-coordinator.tsが367行で最大の違反
:area skills
  files: 11, total_lines: 1038
  duplication: workflow-rules.md内の禁止語リストがforbidden-actions.md(.claude/rules/)と重複
  stale_refs: 複数ファイルが"CLAUDE.md SecN"形式で参照(現在のCLAUDE.mdにセクション番号なし)
  overlap: workflow-gates.mdとcore-constraints.mdのL1-L4記述が部分重複
:end findings

:section implementation-plan
:approach 4領域を独立したサブタスクとして並列実行可能な粒度で分割。各領域の変更は他領域に依存しない。
:estimatedScope
  hooks: 4-5ファイル変更(tool-gate.js分割、hook-utils.jsへの集約、test-guard.sh分割)
  indexer: 1-3ファイル変更または削除判断
  mcp-server: 4ファイル分割(delegate-coordinator.ts, lifecycle.ts, dod-l1-l2.ts, defs-stage1.ts)
  skills: 5-6ファイル更新(重複削除、stale参照修正)
  合計: 15-20ファイル変更
:risks
  - hooks/の共有ユーティリティ変更がClaude Code hook連携に影響する可能性
  - mcp-server/のファイル分割でimportパスが変わりテストが壊れる可能性
  - indexer/削除後にserena-query.pyに依存する外部スクリプトがあれば破損
  - skills/の記述削除で情報が失われるリスク(重複と思ったが実は補足情報だった場合)
:end implementation-plan

:section decisions
:decision [D-HR-1] 4領域を独立サブタスクとして扱う :reason 各領域間の依存が低く、並列作業で効率化できるため
:decision [D-HR-2] 200行超ファイルの分割を最優先とする :reason core-constraintsの200行制限はhookで強制されるルールであり、違反状態の解消が最も明確な成果
:decision [D-HR-3] indexer/の扱いはscope_definitionで確定する :reason Serena MCP直接利用との棲み分けを調査した上で削除/存続を判断する必要がある
:decision [D-HR-4] skills/のstale参照はCLAUDE.md現行構造に合わせて更新する :reason 参照先が存在しない記述はLLMの誤解を招くため
:end decisions

:section artifacts
:artifact hearing.md :status complete
:end artifacts

:section next
:next scope_definition :input hearing.md
:end next

result{phase,status,artifact,lines}: hearing,complete,C:\ツール\Workflow\docs\workflows\workflow-harness-refactoring-v2\hearing.md,78
