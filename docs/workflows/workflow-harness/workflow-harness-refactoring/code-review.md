phase: code_review
task: workflow-harness-refactoring
status: complete
reviewer: external
inputArtifacts: [planning.md, requirements.md, threat-model.md]

scope: 8件のACに対して実装済みファイルを検査し、要件/脅威モデルとの整合性を検証する。

## decisions

- CR-1: AC-1 PASS - workflow-harness/vscode-ext/ ディレクトリは存在しない。STRUCTURE_REPORT.mdにvscode-ext参照なし。grep -r vscode-ext の結果はworkflow-state.toon(内部状態ファイル)のみでプロダクションコードへの残存参照なし。F-001/TM-03緩和を満たす。
- CR-2: AC-2 PASS - workflow-harness/hooks/ 配下に .bak2/.bak3/.disabled/.bak4 ファイルなし。稼働hookファイル8件(pre-tool-guard.sh, test-guard.sh, hook-utils.js, block-dangerous-commands.js, context-watchdog.js, loop-detector.js, session-boundary.js, tool-gate.js)の存在を確認。F-002/TM-04緩和を満たす。
- CR-3: AC-3 PASS - build_check.mdでnpm run build成功を確認済み(前フェーズで検証完了)。NF-001を満たす。
- CR-4: AC-4 PASS - 774/774テスト通過(前フェーズで検証完了)。NF-002を満たす。
- CR-5: AC-5 PASS(条件付き) - .mcp.jsonにserenaエントリが存在する。ただしcwdフィールドが未設定。TM-D1/SR-1では「.mcp.jsonのserenaエントリにプロジェクトルートを明示的に設定」を要求している。serena-agentのデフォルト動作がcwd=起動ディレクトリであれば実質的に問題ないが、脅威モデルの緩和策が明示的に実装されていない。severity: low, recommendation: serenaエントリにcwdフィールドを追加するか、SR-1の緩和根拠をドキュメント化する。
- CR-6: AC-6 PASS - workflow-harness/mcp-server/src/tools/defs-a.ts(requirements.mdではsrc/phases/defs-a.tsと記載されていたがsrc/tools/が正しいパス)にsmall/mediumの文字列なし。F-006/TM-05緩和を満たす。パス記載の不一致はrequirements.md/planning.md内のドキュメントエラーだが実装には影響なし。
- CR-7: AC-7 FAIL - coordinator.md tools行に「Bash」が含まれている(Read, Glob, Grep, Bash, Skill, ToolSearch)。worker.md tools行にも「Bash」が含まれている(Read, Write, Edit, Glob, Grep, Bash)。requirements.md REQ-01で「実施済み3件(項目7: Bash削除)」と記載されているが、実際には未実施。本タスクのスコープ外(確認のみ)とされていたが前提条件が不成立。severity: medium, recommendation: Bashをtools行から削除するか、AC-7の前提(実施済み)を修正する。
- CR-8: AC-8 PASS - workflow-orchestrator.md L27-L28にharness_get_subphase_templateによるテンプレート取得手順が記載されている。L101にテンプレートはharness_next/harness_get_subphase_templateから取得する旨の記述あり。L160にMCPツール一覧としてharness_get_subphase_templateが記載されている。F-003を満たす。

acStatusTable:
  AC-1: PASS, vscode-ext/不在、STRUCTURE_REPORT.md参照除去済み
  AC-2: PASS, hooks/バックアップファイル不在、稼働hook8件存在確認
  AC-3: PASS, npm run build成功(build_checkフェーズで検証済み)
  AC-4: PASS, 774/774テスト通過(build_checkフェーズで検証済み)
  AC-5: PASS(条件付き), serenaエントリ存在、cwd未設定(SR-1の明示的緩和なし)
  AC-6: PASS, defs-a.tsにsmall/medium文字列なし
  AC-7: FAIL, coordinator.md/worker.mdのtools行にBashが残存
  AC-8: PASS, coordinator直接取得手順が3箇所に記載

findingsSummary:
  total: 3
  pass: 6
  conditionalPass: 1
  fail: 1

openFindings[3]:
  - {id: CR-F1, severity: medium, ac: AC-7, description: coordinator.md/worker.mdのtools行にBashが残存。REQ-01で実施済みと記載されているが未実施, recommendation: tools行からBashを削除する。ただし本タスクのスコープ判断により対応要否はオーケストレーター判断}
  - {id: CR-F2, severity: low, ac: AC-5, description: serenaエントリにcwdフィールドが未設定。TM-D1/SR-1の緩和策が明示的に実装されていない, recommendation: cwd追加またはデフォルト動作による緩和の根拠をドキュメント化}
  - {id: CR-F3, severity: info, ac: AC-6, description: requirements.md/planning.mdでdefs-a.tsのパスがsrc/phases/defs-a.tsと記載されているが正しくはsrc/tools/defs-a.ts, recommendation: ドキュメント修正は任意(実装に影響なし)}

## artifacts

- docs/workflows/workflow-harness-refactoring/code-review.md, review, コードレビュー結果(AC検証8件、Finding3件)

## next

- CR-F1(AC-7 FAIL)の対応判断: スコープ内で修正するか、別タスクとして切り出すか
- CR-F2(AC-5条件付き)の対応判断: cwd追加するか、現状を許容するか
- 全ACがPASSになった時点でcode_reviewフェーズ完了
