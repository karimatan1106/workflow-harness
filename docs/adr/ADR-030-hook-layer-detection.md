# ADR-030: Hook Layer Detection — agent_id presence implies worker layer

Status: accepted
Date: 2026-04-18
TaskId: 2f56774f-5ed7-47cc-b2a0-4670422f1946

## Context

PreToolUse hook の `detectLayer()` は、hookInput から得られる `agentId` を `agentId.startsWith('worker')` で判定し、名前ベースで L1 (orchestrator) / L2 (coordinator) / L3 (worker) を分類していた。しかし Claude Code の hook schema は `agent_id` を 16 文字の opaque hex として提供しており、サブエージェント名 (subagent_type) は hookInput に露出しない。結果として、全サブエージェント呼び出しが `startsWith('worker')` に一致せず "coordinator" として誤分類され、worker からの `docs/workflows/` への Write が PreToolUse ゲートで block された。30-phase ハーネスワークフローは phase artifact を worker が書き出す設計であるため、この不具合によりワークフロー自体が進行不能となっていた。調査記録は `.agent/hook-state-bug-analysis.md` に、Red/Green 証跡は `.agent/tdd-red-green-proof.md` に保存してある。

## Decision

hookInput に `agent_id` が存在する（非 null）という事実を、サブエージェント呼び出しの決定的な証拠として扱う。Claude Code のランタイムは `agent_id` をサブエージェントの tool call に対してのみ設定するため、`agent_id != null` は worker 層を示す十分条件である。コーディネーター層との区別には明示的な `HARNESS_LAYER=coordinator` 環境変数を使用する（coordinator-md のサブエージェント定義で既に設定済み）。判定順序は以下：

1. `HARNESS_LAYER` env が `coordinator` → L2
2. hookInput の `agent_id` が非 null → L3 (worker)
3. それ以外 → L1 (orchestrator)

## Rationale

- 名前ベース照合は Claude Code schema の不文律 (opaque id) に反するため本質的に壊れている。
- `agent_id` の存在は仕様上ランタイムが保証する観測可能な事実であり、文字列パターンに依存しない。
- `HARNESS_LAYER` env は subagent 定義ファイルで明示的に制御可能で、coordinator/worker の区別はユーザーコードの領分に保てる。
- L1-L4 決定的ゲート原則 (ADR-001) に適合: 判定は「env 値の等価比較」「キー存在チェック」のみで非決定性を含まない。

## Consequences

- Worker サブエージェントが `docs/workflows/**` へ書き込めるようになり、30-phase ハーネスが正常稼働する。
- coordinator / worker の区別は coordinator subagent 定義の `HARNESS_LAYER=coordinator` に依存するため、将来新たな coordinator 系 subagent を追加する際はこの env 設定を忘れないこと。
- 回帰テスト `tool-gate.test.js` (10 ケース) が AC-1..AC-5 の不変条件をロックし、層検出ロジックへの将来の変更をゲートする。
- `agent_id` を持たない非 subagent 経由の tool 呼び出し (orchestrator 自身) は従来通り L1 として扱われる。

## Alternatives considered

- 名前ベース照合 (`agentId.startsWith('worker')`) の継続 — 却下。Claude Code は hookInput schema で subagent_type を露出しておらず、名前マッチは構造的に不可能。
- すべての層判定を `HARNESS_LAYER` env 必須にする — 却下。env が親プロセスから全呼び出しに確実に plumbing される保証がなく、env 未設定時に orchestrator/worker を区別できなくなる。
- parent PID ヒューリスティック — 却下。Windows/WSL/Git Bash 間で PID 継承挙動が異なり、再現性が確保できない (ADR-001 の決定性要件に抵触)。

## References

- Phase docs: `docs/workflows/fix-hook-layer-detection/` 配下の全 30-phase 成果物
- 調査記録: `.agent/hook-state-bug-analysis.md`
- TDD 証跡: `.agent/tdd-red-green-proof.md`
- 回帰テスト: `workflow-harness/hooks/__tests__/tool-gate.test.js`
- 関連 ADR: ADR-001 (L1-L4 決定的ゲート原則)

## Notes

This record is immutable. To revise a decision, create a new ADR that supersedes this one.
