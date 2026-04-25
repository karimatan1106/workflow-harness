# CRITICAL — 定期再注入用の絶対知識

watchdog 30回毎注入。全ルール無条件遵守。

## TOON
- T-1〜5: カンマ値引用/バックスラッシュ禁止/ハイフン区切り/decisions≥5件/必須キー(decisions/artifacts/next)

## バリデータ
- V-1〜3: ###は親content外/各##直下prose≥5行/表行content外
- V-4/5/6: 禁止語12個(TODO/TBD/WIP/FIXME/未定/未確定/要検討/検討中/対応予定/サンプル/ダミー/仮置き)。「未定義」→「設定されていない」。同一接頭辞3回で重複
- V-7/11: decisions≥5件`- `形式。code-review.mdはMarkdownリスト必須
- V-8/9: mcp-server/もpackage_lock_sync。artifact_driftはharness_back再承認
- V-12/13: AC重複はfind()バグ(1フェーズのみadd_acか直接編集)。delegate_coordinatorに.claude/agents/渡すな

## TDD Red-Green
1. harness_record_test_result(exitCode=1)→Red  2. harness_record_proof(result=true)→Green。Red evidenceは`result:false`必須

## ガード
- C-1: docs/workflows/**直接Edit禁止→Agent経由。G-1: 3層(Orchestrator/Coordinator/Worker)。G-2: --setting-sources user必須
- G-3/5/6/8/10: hook変更はmv .bak。claude -pはstdin:ignore。WSLはGit Bash Node。settings.jsonはsed直接

## Hook位相/submodule
- H-1: task-index.json phase欄はMCP stateと乖離、Edit手動同期必要(commit/push遷移時)
- H-2: PHASE_BASH commit/pushは['readonly','git']に拡張済(以前`cd`不可)
- H-3: submodule→mainでcommit→親feature branchでポインタbump順序厳守
