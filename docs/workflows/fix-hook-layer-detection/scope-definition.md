# Scope Definition — fix-hook-layer-detection

## Purpose

`workflow-harness/hooks/tool-gate.js` の `detectLayer()` を修正し、opaque hex agent_id を持つ subagent が正しく worker layer として判定されるようにする。回帰テスト追加と ADR-030 による設計判断の記録を含む。

## Scope (in)

- `workflow-harness/hooks/tool-gate.js` — detectLayer() 関数の修正 (ホットパッチ済み、formalize のみ)
- `workflow-harness/hooks/__tests__/` — 新規テストファイル追加
- `docs/adr/ADR-030-hook-layer-detection.md` — ADR 新規作成

## Scope (out)

- `.claude/hooks/pre-tool-gate.sh` — thin wrapper のみのため変更不要
- 他の hook script (session-start-hook.sh, user-prompt-submit.sh 等)
- harness MCP server のコード (mcp-server/)
- 既存の workflow-harness/hooks/tool-gate.js の他の関数 (checkL1, checkWriteEdit 等)

## Constraints

- ホットパッチ済みのコードを尊重し、同一ロジックをテストで固定化する
- 既存の HARNESS_LAYER 環境変数 override 機能は後方互換で保持
- orchestrator (agent_id 不在) の判定は変更しない
- 全体 200 行ルール (core-constraints.md) を遵守

## keywords

detectLayer, agent_id, hookInput, tool-gate, PreToolUse, worker, coordinator, orchestrator, layer detection, agent_id opaque, subagent, hook, gate, phase-artifact, HARNESS_LAYER

## decisions

- D-001: scope を tool-gate.js の detectLayer() 関数に限定し、他関数 (checkL1, checkWriteEdit, checkL2, checkL3) は変更しない。理由: 本バグは detectLayer の判定ロジックに起因し、他関数の動作は正しいため影響範囲を最小化する
- D-002: テストは既存のテストディレクトリ構造 (workflow-harness/hooks/__tests__/) に配置する。理由: 既存 hook-utils.test.js と同じ場所に置くことで発見性と実行性を担保する
- D-003: ADR-030 として設計判断を記録する。理由: 本修正は「agent_id は opaque hex で layer 判別不可能」という Claude Code 側の契約に依存しており、将来の開発者が「なぜ startsWith をやめたのか」を理解できる必要があるため
- D-004: HARNESS_LAYER 環境変数 override を削除せず保持する。理由: 将来の debug/テスト/運用シナリオで層を強制できる余地を残すことで、柔軟性を失わない
- D-005: orchestrator 判定 (agent_id 不在) は変更せず維持する。理由: L1 Orchestrator の直接 Bash/Read ブロックは正しく機能しており、本バグとは独立した別機能であるため触る必要がない

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/scope-definition.md (本ファイル — scope と制約を定義)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (改修対象 — detectLayer 関数のみ)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (新規作成予定 — 回帰テスト)
- C:/ツール/Workflow/docs/adr/ADR-030-hook-layer-detection.md (新規作成予定 — 設計記録)
- C:/ツール/Workflow/.agent/hook-layer-investigation.md (参照のみ — 調査一次資料)

## next

- requirements phase: AC-1〜AC-5 を定義し、F-001〜F-005 として RTM に登録する (opaque hex → worker、HARNESS_LAYER override、orchestrator 保持、checkWriteEdit 連携、回帰テスト存在の 5 項目)
- threat_model phase: hook 破壊による security implication をレビューする
- design phase: detectLayer の責務と入出力契約を明文化する
- test_design phase: 回帰テストのテストケースを列挙する (TC-1〜TC-5)
- implementation phase: ホットパッチ済みのコードを確認し、必要に応じて微調整する
