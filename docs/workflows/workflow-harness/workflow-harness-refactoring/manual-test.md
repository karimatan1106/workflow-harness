# Manual Test Acceptance Report

Task: workflow-harness-refactoring
Phase: manual_test
Date: 2026-03-24

## Test Results

| ID | Scenario | Expected | Actual | Status |
|----|----------|----------|--------|--------|
| MT-01 | vscode-ext directory removed | ls fails with "No such file or directory" | ls: cannot access: No such file or directory | PASS |
| MT-02 | hooks directory clean (no .bak/.disabled) | Only active hook files present | 9 active files, 0 .bak/.disabled | PASS |
| MT-03 | MCP server builds | `npm run build` (tsc) exits 0 | Exit code 0, no errors | PASS |
| MT-04 | .mcp.json valid | Valid JSON with harness + serena entries | Both entries present, valid JSON | PASS |
| MT-05 | Agent definitions no Bash | coordinator.md and worker.md tools lines exclude Bash | coordinator: Read,Glob,Grep,Skill,ToolSearch; worker: Read,Write,Edit,Glob,Grep | PASS |
| MT-06 | harness_start size enum is large only | size enum: ['large'] | Confirmed: enum: ['large'] at defs-a.ts:17 | PASS |
| MT-07 | Skill docs have subphase template ref | harness_get_subphase_template present in workflow-orchestrator.md | 3 references found (lines 27, 101, 160) | PASS |

## decisions

- MT-01: vscode-ext/ ディレクトリが正常に削除されている (ファイルシステム上に存在しないことを確認)
- MT-02: hooks/ バックアップファイルが全て除去されている (稼働中hookのみ残存)
- MT-03: MCP サーバーのビルドが正常に完了する (tsc exit code 0)
- MT-04: .mcp.json が有効なJSONで harness/serena 両エントリを含む (構造検証合格)
- MT-05: coordinator.md/worker.md の tools 行に Bash が含まれていない (定義ファイル検証合格)
- MT-06: defs-a.ts の size enum が large のみ (dead code 除去確認)
- MT-07: workflow-orchestrator.md に harness_get_subphase_template 参照が3箇所存在 (skill docs 更新確認)

## artifacts

- docs/workflows/workflow-harness-refactoring/manual-test.md, report, 手動テスト7シナリオの実施結果レポート

## next

criticalDecisions: 全7シナリオ合格、ブロッカーなし
readFiles: manual-test.md
warnings: なし
