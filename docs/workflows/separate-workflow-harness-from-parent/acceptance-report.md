# Acceptance Report: separate-workflow-harness-from-parent

## summary
Phase A（親資産 submodule 移管）の受入確認を実施した。対象ワークフローは separate-workflow-harness-from-parent。
全 7 件の AC がすべて met 判定、10 件の TC が全件 PASS、回帰ゼロで受入基準を満たす。
移管範囲は ADR 28 件、workflow-phases 27 件、hooks 11 本、commands 3 件、rules 2 件、.mcp.json 1 件。
submodule への追加コミットは c5f5ce1（親資産移管）および f834228（runtime state gitignore）の 2 本で、いずれも origin/main に push 済み。

## acAchievementStatus
- AC-1 (ADR 移管): met
- AC-2 (workflow-phases 移管): met
- AC-3 (hooks 移管 + 不要スクリプト除外): met
- AC-4 (commands 移管): met
- AC-5 (rules 移管): met
- AC-6 (.mcp.json の cwd 相対化): met
- AC-7 (submodule クリーン + origin 同期): met

## testSummary
- TDD Red baseline: 2/10 PASS（移管前の初期状態）
- TDD Green (testing フェーズ): 10/10 PASS
- Regression test: 10/10 PASS、baseline 2→10 への改善、既存機能の回帰ゼロ
- テストスクリプト: docs/workflows/separate-workflow-harness-from-parent/tests/run-ac-tests.sh

## verification
各 AC の検証経路を TC ID で示す。
- AC-1 ← TC-AC1-01 (workflow-harness/docs/adr/ 配下のファイル件数 >= 28 を確認)
- AC-2 ← TC-AC2-01 (workflow-harness/.claude/workflow-phases/ のファイル件数 = 27 を確認)
- AC-3 ← TC-AC3-01 (hooks 11 本の存在 + 既存 pre-tool-guard.sh / rtk-rewrite.sh の維持) + TC-AC3-02 (check_ocr.py が submodule 内に不在)
- AC-4 ← TC-AC4-01 (handoff.md, harness-report.md, recall.md の 3 件の存在)
- AC-5 ← TC-AC5-01 (code-search-policy.md の存在) + TC-AC5-02 (rtk-scope.md の存在)
- AC-6 ← TC-AC6-01 (jq にて .mcpServers["workflow-harness"].cwd == "." を確認)
- AC-7 ← TC-AC7-01 (submodule 内 git status --porcelain が空) + TC-AC7-02 (git log origin/main..HEAD が空)

## decisions
- D-AV-1 (approve): Phase A の受入を承認する。全 AC met、全 TC PASS、回帰ゼロで DoD を満たすため。
- D-AV-2 (test-bug-fix): テストスクリプトの jq キー名バグ（旧 .mcpServers.harness を新 .mcpServers["workflow-harness"] へ修正）は testing フェーズで解決済み。実装側（submodule の .mcp.json）の再修正は不要。
- D-AV-3 (gitignore-runtime): MCP runtime state（debug log, metrics, task index）は submodule の .gitignore に追加済み（f834228）。ランタイム生成物が作業ツリーに残るのはハーネスの正常挙動であり、commit 対象から外す方針が正しい。
- D-AV-4 (parent-untouched): 親リポ側の submodule hash 差分は commit しない。Phase D で親リポ全体が手動削除される予定のため、差分固定に意味がない。
- D-AV-5 (phase-sequence): Phase B（standalone clone + setup.sh 検証）、Phase C（auto-memory cleanup）、Phase D（親リポ手動削除）は Phase A の受入承認後に順次実施する。Phase D は CWD 制約のためハーネス外部の手動作業となる。

## artifacts
- submodule commit workflow-harness@c5f5ce1 (feat: import parent assets for standalone operation)
- submodule commit workflow-harness@f834228 (chore: gitignore MCP runtime state)
- docs/workflows/separate-workflow-harness-from-parent/tests/run-ac-tests.sh (AC 検証スクリプト)
- docs/workflows/separate-workflow-harness-from-parent/code-review.md (レビュー承認済み)
- docs/workflows/separate-workflow-harness-from-parent/test-design.md (10 TC の設計)
- submodule origin/main branch (両コミット push 済み)

## next
Phase A 受入承認後の進行手順を以下に示す。
1. ハーネスの commit/push 直後フェーズへ遷移し、Phase A の workflow 成果物を記録する。
2. Phase B を人手で起動する: git clone にて C:/ツール/workflow-harness/ を作成、bash setup.sh を実行、claude 起動で独立動作を確認し、STOP POINT 1 でユーザー確認を受ける。
3. Phase C にて auto-memory のクリーンアップを実施する。
4. Phase D にて親リポ C:/ツール/Workflow/ の手動削除を実施する。CWD 制約によりハーネス自身からは削除できないため、ユーザー手動オペレーションとなる。
