# Design Review — fix-hook-layer-detection

## Design Summary

`detectLayer()` を 2 分岐 (agent_id 存在 = 'worker'、不在 = 'orchestrator') に単純化し、HARNESS_LAYER env による明示 override を優先する 3 段分岐に整理する。旧実装の `agentId.startsWith('worker')` dead code を削除。

## Input Contract

- `process.env.HARNESS_LAYER`: 任意 (空文字列 / 'worker' / 'coordinator')
- `hookInput`: PreToolUse stdin JSON
  - `tool_name`: string (必須)
  - `tool_input`: object (必須)
  - `agent_id`: string (optional, opaque 16-char hex)

## Output Contract

- 戻り値: 'worker' | 'coordinator' | 'orchestrator'
- 決定フロー: env 優先 → agent_id 不在で orchestrator → それ以外は worker
- 副作用なし (pure function)

## Consistency Checks

- state-machine.mmd: 入口 EnvCheck → 分岐 3 通り → 終端 → 実装と一致
- flowchart.mmd: ReadEnv → EnvIsWorker → EnvIsCoord → AgentExists → 実装と一致
- requirements.md: AC-1〜AC-5 全て本実装で到達可能
- RTM F-001〜F-005: codeRef すべて `tool-gate.js::detectLayer` または `checkWriteEdit` を指す

## Boundary Conditions

- agent_id が空文字列 `""` の場合: `!hookInput.agent_id` は true (空文字は falsy) → orchestrator
- hookInput が null: `!hookInput` は true → orchestrator
- HARNESS_LAYER に未対応値 (例 'admin'): どの分岐にも hit せず agent_id 判定へフォールスルー

## Reviewer Concerns Addressed

- 「coordinator と worker を区別する必要はないか?」 → 2 層モデル上で差がなく統一して実害なし
- 「env override を削除すべきか?」 → debug 用途で保持が妥当、コストは 2 分岐のみ
- 「agent_id 空文字列の扱いは?」 → orchestrator にフォールバック、実害なし (Claude Code は空文字を渡さない)

## decisions

- D-001: 入出力契約を pure function として明文化する。理由: side-effect-free なら unit test が決定的になり、回帰テストが安定するため
- D-002: 境界条件 (空文字、null) は orchestrator にフォールバックさせる。理由: fail-safe 方向に倒す (orchestrator は最も制約が厳しく、誤って worker 扱いする方が危険) ため
- D-003: HARNESS_LAYER 未対応値はフォールスルーして agent_id 判定に委ねる。理由: 明示 override が機能しない場合は通常判定へ回帰させるのが自然で、例外投げは不要
- D-004: state-machine / flowchart / requirements の 3 成果物が実装と一致することをレビューで確認する。理由: 下流 phase の test_design が requirements から TC を導出するため、途切れた traceability を防ぐ
- D-005: reviewer concerns はレビュー記録として design-review.md に残し ADR-030 にも要約を含める。理由: 将来の開発者が設計判断の背景を遡れるようにする

## acDesignMapping

- AC-1: detectLayer() の 2 分岐ロジック (agent_id 存在 = 'worker') と state-machine.mmd の AgentIdCheck→Worker 遷移
- AC-2: detectLayer() の env 判定 (process.env.HARNESS_LAYER → 'worker' 分岐) と flowchart.mmd の EnvIsWorker→LayerWorker 経路
- AC-3: detectLayer() の agent_id 不在時 orchestrator 判定と state-machine.mmd の AgentIdCheck→Orchestrator 遷移
- AC-4: checkWriteEdit() の layer==='worker' && docs/workflows/ 許可ロジック (tool-gate.js L95-96)
- AC-5: workflow-harness/hooks/__tests__/tool-gate.test.js の存在とファイル構造 (vitest describe/test ブロック)

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/design-review.md (本ファイル — 設計レビュー記録)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/state-machine.mmd (入力)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/flowchart.mmd (入力)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/requirements.md (入力 — AC/RTM)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (レビュー対象、ホットパッチ済み)

## next

- test_design phase: AC-1〜AC-5 から TC-AC1-01〜TC-AC5-01 を導出
- test_impl phase: vitest でテスト実装
- implementation phase: 現行コードの最終確認
- documentation phase: ADR-030 に reviewer concerns と回答を要約
