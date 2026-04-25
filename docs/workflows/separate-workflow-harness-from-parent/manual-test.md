# Manual Test: separate-workflow-harness-from-parent

## scope
自動テスト (run-ac-tests.sh) の 10 TC 外で人手/目視で確認すべき項目を記録する。
対象: ファイル内容の構造、実行権限、submodule 状態、Phase B で必要な検証項目。
Phase A では静的な構造確認 (performedChecks) のみ実施し、動的な実行確認 (deferredChecks) は Phase B に委ねる。

## environment
- OS: Windows 11 Home 10.0.26200
- Shell: Git Bash (MSYS2)
- rtk: 0.35.0
- Git user: karimatan1106
- Branch: feature/v2-workflow-overhaul
- 対象 submodule commit: workflow-harness@c5f5ce1, @f834228

## performedChecks
- MT-P1 [PASS] .mcp.json 構造確認: jq '.mcpServers["workflow-harness"].cwd' 出力が "." である
- MT-P2 [PASS] ADR 件数確認: workflow-harness/docs/adr/*.md の数は 28 ファイル
- MT-P3 [PASS] workflow-phases 件数確認: workflow-harness/.claude/workflow-phases/ に 27 ファイル存在
- MT-P4 [PASS] hooks 件数確認: 11 本新規 + pre-tool-guard.sh と rtk-rewrite.sh の既存 2 本
- MT-P5 [PASS] hooks 実行権限: cp -p により元の mode を保持、git index にも +x が反映
- MT-P6 [PASS] commands 3 本確認: handoff.md, harness-report.md, recall.md
- MT-P7 [PASS] rules 2 本確認: code-search-policy.md, rtk-scope.md
- MT-P8 [PASS] check_ocr.py 不在確認: AC-3 スコープ外で意図通り移植されていない
- MT-P9 [PASS] submodule push 済み: c5f5ce1 と f834228 が origin/main に反映済み
- MT-P10 [PASS] submodule git status clean: .gitignore で MCP runtime state を除外済み

## deferredChecks
Phase B で実施する項目 (このフェーズでは範囲外):
- MT-B1 standalone clone: cd C:/ツール && git clone <submodule-url> workflow-harness で独立取得できる
- MT-B2 setup.sh 実行: cd workflow-harness && bash setup.sh がエラーなく完了する
- MT-B3 MCP 認識: claude 起動時に workflow-harness が MCP サーバとして読み込まれる
- MT-B4 harness 動作: 簡単な修正タスクで harness_start → harness_next が正常遷移する
- MT-B5 hooks 発火: pre-tool-gate.sh, post-commit-auto-push.sh などが期待タイミングで起動する

## decisions
- D-MT-1: 自動テスト未到達領域のうち構造確認 10 項目を手動実施し、全 PASS を確認した
- D-MT-2: Phase B で実施する動的検証 5 件は deferredChecks に分離し、本フェーズでは実施しないことを明示した
- D-MT-3: OS 差分 (Windows 固有の CRLF/LF) の最終確認は Phase B の setup.sh 実行時にあわせて行う
- D-MT-4: hooks 実行権限は cp -p で保持しており、Windows 上では git index の mode bit で確認済み
- D-MT-5: Phase B の deferredChecks が全通過した段階で本ワークフローの完了を宣言する方針とする

## artifacts
- C:/ツール/Workflow/workflow-harness/.mcp.json (cwd=".")
- C:/ツール/Workflow/workflow-harness/docs/adr/ (28 files)
- C:/ツール/Workflow/workflow-harness/.claude/workflow-phases/ (27 files)
- C:/ツール/Workflow/workflow-harness/.claude/hooks/ (11 本追加)
- C:/ツール/Workflow/workflow-harness/.claude/commands/ (3 ファイル)
- C:/ツール/Workflow/workflow-harness/.claude/rules/ (2 ファイル)
- C:/ツール/Workflow/workflow-harness/.gitignore (MCP runtime state 除外設定)
- submodule origin/main @f834228 (最新 push 済み)

## next
残フェーズ (security_scan, performance_test, e2e_test, docs_update など harness が要求するもの) を順次進めて commit/push/health フェーズで Phase A を完了する。完了後 Phase B (新規 clone + setup.sh) を人手で実行し、deferredChecks 5 件を消化する。最終的に Phase C (auto-memory 削除)、Phase D (親リポ削除) に進み、workflow-harness の独立化を完了させる。
