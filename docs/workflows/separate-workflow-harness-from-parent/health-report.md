# Health Report: separate-workflow-harness-from-parent

## summary
Phase A（親から submodule への資産移管）完了後の健康状態観察記録。全 7 AC met、10 TC PASS、回帰ゼロ。submodule 独立化の下準備が整った段階。

## observations
- OB-1 submodule commit c5f5ce1（parent assets import）が origin/main に push 済み
- OB-2 submodule commit f834228（gitignore runtime state）が origin/main に push 済み
- OB-3 run-ac-tests.sh は 10/10 PASS、exit code 0 を確認
- OB-4 submodule 側 git status は clean、MCP runtime state は gitignore 済み
- OB-5 親リポジトリは submodule hash 差分のみ dirty、Phase D での削除を前提に放置
- OB-6 auto-memory ディレクトリ ~/.claude/projects/C------Workflow/ は Phase C で削除対象
- OB-7 Phase B-D は別セッション/人手で実施されるため本 Phase のスコープ外

## metrics
- M-1 ADR 移管件数: 28
- M-2 workflow-phases 移管件数: 27
- M-3 hooks 移管件数: 11
- M-4 commands 移管件数: 3
- M-5 rules 移管件数: 2
- M-6 AC met: 7/7
- M-7 TC PASS: 10/10
- M-8 regression count: 0
- M-9 submodule commits pushed: 2

## decisions
- D-HO-1: Phase A は健全に完了したと判断し、Phase B へ進む準備完了とする
- D-HO-2: 親リポの dirty state は Phase D で親ディレクトリごと削除するため本 Phase では触らない
- D-HO-3: hooks の Git mode bits (100644) 問題は Phase B の setup.sh 実行時に確認する
- D-HO-4: MCP runtime state は gitignore で除外済みのため、再汚染リスクは低いと評価
- D-HO-5: 本 Phase をもって separate-workflow-harness-from-parent のハーネス内フェーズを完了とする

## artifacts
- workflow-harness@c5f5ce1 (parent assets import commit)
- workflow-harness@f834228 (gitignore runtime state commit)
- docs/workflows/separate-workflow-harness-from-parent/ ドキュメント一式
- docs/workflows/separate-workflow-harness-from-parent/tests/run-ac-tests.sh
- docs/workflows/separate-workflow-harness-from-parent/acceptance-report.md

## next
Phase B（standalone clone + setup.sh 実行 + 独立動作確認）を人手で起動する。具体手順:
1. cd C:/ツール && git clone <submodule url> workflow-harness
2. cd workflow-harness && bash setup.sh
3. claude 起動で MCP サーバ認識を確認
4. STOP POINT 1 でユーザー確認を取得
5. Phase C: ~/.claude/projects/C------Workflow/ auto-memory ディレクトリを削除
6. Phase D: 親 C:/ツール/Workflow/ の手動削除（CWD 制約で本セッションからは実行不可）
