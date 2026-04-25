# Hearing — fix-hook-layer-detection

userResponse: User pre-authorized autonomous execution of this fix ("全部承認して") before going to sleep. All answers below are orchestrator-derived from prior investigation in .agent/hook-layer-investigation.md (Follow-up 1-3), reviewed and consolidated without direct user interaction this round. User explicitly approved applying the hot-patch first and running harness afterward to add tests and ADR-030.

## Problem

`workflow-harness/hooks/tool-gate.js` の `detectLayer()` は subagent の layer を `hookInput.agent_id.startsWith('worker')` で判定していたが、Claude Code が渡す `agent_id` は opaque hex (例: `a6fb64e37fc9f196e`) であり `'worker'` で始まらない。全 subagent が `'coordinator'` 層と誤判定され、`checkWriteEdit` の path gate が `docs/workflows/` への書き込みを block し続けていた。hearing phase 以降のタスク進行が不能になっていた。

## decisions

- D-001: detectLayer() を 2 分岐に単純化 (agent_id 存在 → worker、不在 → orchestrator)。理由: opaque hex では type 判別不可能で、現状の L1/L3 2 層モデルは「orchestrator か否か」で十分識別できるため
- D-002: HARNESS_LAYER 環境変数による明示 override は保持。理由: 将来テストや debug で層を固定したいケースに対応する既存機能であり、削除コストと得られる簡潔性のトレードオフで保持が妥当
- D-003: 既存の `checkL1` の orchestrator-only gate とは独立した判定で、coordinator 層は実質的に worker と同等扱いとする。理由: tool-delegation.md の 2 層モデル (L1 Orchestrator vs L3 Worker/Coordinator) と一致する
- D-004: 修正箇所は `workflow-harness/hooks/tool-gate.js` のみ。`.claude/hooks/pre-tool-gate.sh` は thin wrapper のため変更不要。理由: 責務分離を崩さず、改修範囲を最小化する
- D-005: 回帰テストを追加し、opaque hex agent_id で worker 判定される不変条件を固定する。理由: 本質的に Claude Code の hook 契約に依存するため、将来の agent_id 形式変更で silent regression が起きるのを防ぐ

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/hearing.md (本ファイル — 問題定義と事前回答の記録)
- C:/ツール/Workflow/.agent/hook-layer-investigation.md (Follow-up 1-3、調査経緯の一次資料)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (修正対象ファイル、ホットパッチ済み)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/ (テスト追加ディレクトリ、既存構造に準拠)
- C:/ツール/Workflow/docs/adr/ADR-030-hook-layer-detection.md (予定 — design/documentation phase で作成)

## next

- scope_definition phase: `workflow-harness/hooks/tool-gate.js` と `workflow-harness/hooks/__tests__/` を scope に登録する
- requirements phase: AC と RTM を定義する (opaque hex → worker 判定、HARNESS_LAYER override 保持、orchestrator 判定の保持)
- test_design/test_impl phase: 回帰テスト (Red → Green) を設計・実装する
- implementation phase: ホットパッチ済みのため、Red フェーズ通過後に既存実装を確認し変更不要であることを記録する
- documentation phase: ADR-030 を作成し、設計判断の経緯を記録する

## Grounded Context

- Claude Code 公式 hook schema: PreToolUse 入力には `tool_name`, `tool_input`, `agent_id` (optional) のみ含まれ、`subagent_type` は含まれない
- `agent_id` 実例: `a6fb64e37fc9f196e` (16-char hex; `.agent/.coordinator-agent-id` で確認)
- 本バグの影響: commit `92de51f` (2026-03-23) 以降、hearing-worker を含む全 subagent が docs/workflows/ に書けない状態が続いていた可能性
- ホットパッチ済み: `return 'worker'` に単純化。smoke test (worker から `.agent/hook-fix-smoke.md` への Write) で動作確認済み

## Open Items

無し — 全項目確定。修正コードはホットパッチ済みで、本タスクはテスト追加と ADR 記録により formalize する。
