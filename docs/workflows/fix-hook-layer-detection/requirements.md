# Requirements — fix-hook-layer-detection

## Purpose

`workflow-harness/hooks/tool-gate.js::detectLayer()` の subagent layer 誤判定を修正し、全 subagent (coordinator/worker/hearing-worker) が正しく worker 層として扱われるようにする。回帰テストと ADR-030 によって設計判断を formalize する。

## background

本修正は 2026-03-23 の commit `92de51f` (hearing-worker を L1 Agent whitelist に追加) 以降、`detectLayer()` の更新漏れにより潜在化していたバグを解消する。本来は同 commit で detectLayer も更新されるべきだったが、`agentId.startsWith('worker')` が `hearing-worker` に対してマッチしない点のみならず、`agent_id` 自体が Claude Code からは opaque hex で渡されるため、type prefix 判定自体が成立しないことが後の調査で判明した。

ホットパッチは既に適用済み (`return 'worker'` への単純化) で、worker subagent から `.agent/hook-fix-smoke.md` への書き込みが block されないことを smoke test で確認済みである。本タスクはこれをテストと ADR によって formalize することが目的である。

本バグは `detectLayer()` が `agent_id` を opaque hex ではなく `"worker"` prefix で判定していたため発生した。

## scope

- keywords: detectLayer, agent_id, hookInput, tool-gate, PreToolUse, opaque hex, layer, worker, coordinator, orchestrator, hook, gate, phase-artifact, checkWriteEdit, HARNESS_LAYER, 2-layer model, L1, L3, docs/workflows, hearing, regression test

## acceptanceCriteria

- AC-1: opaque hex agent_id を入力した detectLayer() は 'worker' を返す
- AC-2: HARNESS_LAYER=worker 環境変数が設定されているとき detectLayer() は 'worker' を返す
- AC-3: agent_id が不在 (L1 orchestrator 呼び出し) のとき detectLayer() は 'orchestrator' を返す
- AC-4: subagent (agent_id 存在) から docs/workflows/ 配下への Write が checkWriteEdit で block されない
- AC-5: 回帰テスト tool-gate.test.js が存在し AC-1 から AC-3 の不変条件を検証している

## rtm

- F-001: AC-1 opaque hex agent_id が worker 層判定される → workflow-harness/hooks/tool-gate.js::detectLayer / workflow-harness/hooks/__tests__/tool-gate.test.js::TC-AC1-01
- F-002: AC-2 HARNESS_LAYER 環境変数 override が機能する → workflow-harness/hooks/tool-gate.js::detectLayer / workflow-harness/hooks/__tests__/tool-gate.test.js::TC-AC2-01
- F-003: AC-3 agent_id 不在時の orchestrator 判定を保持する → workflow-harness/hooks/tool-gate.js::detectLayer / workflow-harness/hooks/__tests__/tool-gate.test.js::TC-AC3-01
- F-004: AC-4 subagent からの docs/workflows/ 書き込みが許可される → workflow-harness/hooks/tool-gate.js::checkWriteEdit / workflow-harness/hooks/__tests__/tool-gate.test.js::TC-AC4-01
- F-005: AC-5 回帰テストファイルが存在する → workflow-harness/hooks/__tests__/tool-gate.test.js / workflow-harness/hooks/__tests__/tool-gate.test.js

## decisions

- D-001: AC は 5 件に絞る (opaque hex, HARNESS_LAYER, orchestrator, path gate 連携, 回帰テスト存在)。理由: 本修正の不変条件を過不足なく捕捉するのに十分で、余分な AC は保守コストを上げるだけ
- D-002: RTM は AC 1 対 1 で F-001 から F-005 を定義する。理由: traceability を単純化し、AC 充足 = RTM 充足の関係を保つ
- D-003: scope の keywords に 2-layer model, L1, L3 を明示的に含める。理由: 本修正の核心が tool-delegation.md の 2 層モデルと一致させることだから
- D-004: openQuestions は空とする (全項目確定済み)。理由: ホットパッチ動作確認と investigator 調査により全不確定事項が解消されている
- D-005: AC-5 は回帰テストの「存在」のみ要求し、テストケースの細部は test_design phase で定める。理由: requirements phase は What を定義する phase であり、How は後続 phase に委ねる

## notInScope

- `.claude/hooks/pre-tool-gate.sh` の内部実装変更 (thin wrapper のため不要)
- 他 hook script (session-start-hook.sh, user-prompt-submit.sh 等) の変更
- harness MCP server コード (mcp-server/) の変更
- workflow-harness/hooks/tool-gate.js 内の他関数 (checkL1, checkWriteEdit の path match ロジック等) の変更
- Claude Code 本体への PR 等 agent_id を type 判別できる形に変える提案

## openQuestions

