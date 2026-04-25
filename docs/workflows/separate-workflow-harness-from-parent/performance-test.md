# Performance Test: separate-workflow-harness-from-parent

## scope
Phase A で追加された 72 ファイル + 1 gitignore 変更の性能影響評価。移管のみでロジック変更なし。

## measurements
- PF-1 docs/adr サイズ: 132K
- PF-2 workflow-phases サイズ: 128K
- PF-3 hooks サイズ: 69K
- PF-4 commands サイズ: 12K
- PF-5 rules サイズ: 24K
- PF-6 commit c5f5ce1 統計: 72 files changed, 5711 insertions(+), 1 deletion(-)
- PF-7 commit f834228 統計: 6 files changed, 4 insertions(+), 60524 deletions(-)
- PF-8 run-ac-tests.sh real 時間: 0m0.792s
- PF-9 テスト件数: 10 TC / 10 PASS

## baseline
- pre-migration の submodule サイズは記録対象外（移管分のみ PF-1..PF-5 で計上）
- pre-migration テスト実行時間は TDD Red 実行時で sub-second オーダー
- 合計追加容量は約 365K（PF-1..PF-5 の和）でリポジトリ全体への影響は軽微

## analysis
- A-PF-1 追加はテキストのみ。バイナリや node_modules 追加なし
- A-PF-2 run-ac-tests.sh は ls/jq/git status の軽量チェックで 1 秒未満
- A-PF-3 hooks 11 本追加は claude code 起動時の shell 初期化に軽微影響（実測は Phase B）
- A-PF-4 MCP server の cwd="." 化でパス解決が短縮される可能性
- A-PF-5 f834228 の巨大 deletion は runtime state 除外であり、Phase A の通常運用には影響しない

## decisions
- D-PF-1: 自動ベンチマーク harness は本 Phase の対象外
- D-PF-2: ファイルサイズ delta は情報参考値として記録、SLA 抵触なし
- D-PF-3: ACCEPT — 性能劣化要因なし
- D-PF-4: hooks 起動影響は Phase B の claude 起動時間で最終確認
- D-PF-5: 本 Phase の結果は informational、blocker なし

## risks
- R-PF-1 [LOW]: テキストファイル追加による disk I/O 増加は無視可能
- R-PF-2 [LOW]: 大量 hooks 発火時のオーバーヘッドは既存 submodule と同等レベル
- R-PF-3 [LOW]: run-ac-tests.sh の実行時間は 1 秒未満で影響軽微
- R-PF-4 [LOW]: 移管後 sparse-checkout 等の最適化は別 Phase へ

## artifacts
- workflow-harness@c5f5ce1 (parent assets import)
- workflow-harness@f834228 (gitignore runtime state)
- docs/workflows/separate-workflow-harness-from-parent/tests/run-ac-tests.sh

## next
e2e_test フェーズに進み、submodule の end-to-end 状態（全 TC 再実行 + git 状態）を確認する。その後 docs_update, commit, push, health_observation を経て Phase A 完了。
