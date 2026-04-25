# E2E Test: separate-workflow-harness-from-parent

## scope
Phase A の end-to-end 検証。submodule 内で全 10 TC の PASS を再確認し、commit/push 状態と外部同期を end-to-end で確認する。claude 起動を伴う動作検証は Phase B の standalone clone 後に実施する。

## scenarios
- E2E-1: run-ac-tests.sh 全 10 TC 実行 (10/10 PASS 目標)
- E2E-2: submodule commit history に c5f5ce1 と f834228 が含まれる
- E2E-3: submodule git status clean
- E2E-4: submodule origin/main との同期（git log origin/main..HEAD 空）
- E2E-5: submodule 内の .mcp.json を読み harness.cwd == "." を確認
- E2E-6: submodule 内の hooks 13 本の存在確認（ls .claude/hooks/*.sh）

## results
- R-E2E-1 [PASS] run-ac-tests.sh exit=0, Passed 10/10, Failed 0/10
- R-E2E-2 [PASS] git log --oneline -5 に c5f5ce1 と f834228 を先頭 2 件として含む
- R-E2E-3 [PASS] git status --porcelain 出力空（clean）
- R-E2E-4 [PASS] git log origin/main..HEAD 出力空（origin と完全同期）
- R-E2E-5 [PASS] .mcp.json の workflow-harness.cwd = "."
- R-E2E-6 [PASS] .claude/hooks/*.sh 13 本存在

## observations
- O-E2E-1: submodule は Phase A の全変更を反映し独立した実行準備が整っている
- O-E2E-2: 親リポは submodule hash 差分を index に持つが Phase A の commit 対象外（Phase D で削除予定）
- O-E2E-3: MCP server 実動作は Phase B の claude 起動で最終確認する
- O-E2E-4: TC-AC7-01 と TC-AC7-02 の両方が PASS のため submodule push 済みが担保されている

## decisions
- D-E2E-1: 本 Phase の e2e 範囲は submodule の静的状態確認と AC テスト再実行までとする
- D-E2E-2: claude 起動の動作確認は Phase B の standalone clone 後に実施する方針で合意
- D-E2E-3: ACCEPT — Phase A 内の全テスト項目 10/10 クリアにより次フェーズ進行可
- D-E2E-4: 親リポの dirty 状態は Phase D の削除対象のため本 Phase では触らない
- D-E2E-5: e2e 通過をもって Phase A の検証工程を完了扱いとする

## risks
- R-RX-1 [LOW]: Phase B の standalone 起動で setup.sh 実行時に想定外事象が起こる可能性
- R-RX-2 [LOW]: Windows/Linux 間で改行差分が混入する可能性（git autocrlf 依存）
- R-RX-3 [LOW]: hooks 実行権限は git mode で記録されているため Linux 環境では chmod 調整が必要な場合あり

## artifacts
- workflow-harness@c5f5ce1 (parent assets import)
- workflow-harness@f834228 (gitignore runtime state)
- docs/workflows/separate-workflow-harness-from-parent/tests/run-ac-tests.sh
- docs/workflows/separate-workflow-harness-from-parent/acceptance-report.md
- docs/workflows/separate-workflow-harness-from-parent/e2e-test.md

## next
docs_update フェーズで関連ドキュメント（CLAUDE.md の workflow-harness 参照など）を確認し、必要なら更新する。その後 commit, push, health_observation を経て Phase A を完了する。Phase B 以降で standalone clone と claude 起動の実動作検証を行う。
