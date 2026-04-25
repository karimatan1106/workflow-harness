# Research — fix-hook-layer-detection

## Claude Code Hook Schema

Claude Code の PreToolUse hook は以下の JSON stdin を受け取る:

```json
{
  "tool_name": "Write",
  "tool_input": { "file_path": "...", "content": "..." },
  "agent_id": "a6fb64e37fc9f196e"
}
```

- `tool_name`: 呼び出されたツール名 (必須)
- `tool_input`: ツールの引数 (必須)
- `agent_id`: subagent 呼び出し時のみ含まれる opaque 16-char hex (L1 orchestrator からの直接呼び出しでは不在)
- `subagent_type`: 公式 schema には含まれない (Claude Code の内部識別子は外部に露出しない)

## Current detectLayer Behavior

改修前 (コミット `92de51f` 以降):

```js
function detectLayer() {
  const env = (process.env.HARNESS_LAYER || '').toLowerCase();
  if (env === 'worker') return 'worker';
  if (env === 'coordinator') return 'coordinator';
  if (!hookInput || !hookInput.agent_id) return 'orchestrator';
  // カスタムエージェント名で判別
  var agentId = hookInput.agent_id || '';
  if (agentId.startsWith('worker')) return 'worker';
  return 'coordinator';
}
```

問題点: `agentId` は opaque hex のため `startsWith('worker')` は常に false。全 subagent が `'coordinator'` に落ちる。

## Path Gate Interaction

`checkWriteEdit` (L95-96):

```js
if (layer !== 'worker' && filePath.includes('docs/workflows/')) {
  return { decision: 'block', reason: 'Direct editing of phase artifacts is forbidden. Delegate to workers.' };
}
```

layer が `'coordinator'` の場合、docs/workflows/ への書き込みが全て block される。結果、hearing phase の artifact を書けない deadlock が発生していた。

## Observability Trace Evidence

`.agent/.coordinator-agent-id` に実 agent_id が保存されており、値は `a6fb64e37fc9f196e` のような opaque hex。`observability-events.toon` および `hook-errors.log` でも同じ形式が確認できる。

## 修正方針

agent_id が存在 = subagent 呼び出し (coordinator または worker どちらか) であり、両者とも `docs/workflows/` 配下への書き込みが必要なため、layer=`'worker'` として扱うのが 2 層モデル (L1/L3) と整合する。

```js
function detectLayer() {
  const env = (process.env.HARNESS_LAYER || '').toLowerCase();
  if (env === 'worker') return 'worker';
  if (env === 'coordinator') return 'coordinator';
  if (!hookInput || !hookInput.agent_id) return 'orchestrator';
  return 'worker';
}
```

## Risk Assessment

- coordinator が worker と同等扱いになるが、tool-delegation.md の 2 層モデル (L1 Orchestrator vs L3 Worker/Coordinator) と一致する
- orchestrator (agent_id 不在) の判定は変更しないため L1 ブロックは影響なし
- HARNESS_LAYER 環境変数 override は保持されるため手動層指定は機能する
- ホットパッチ済みで smoke test (worker から .agent/hook-fix-smoke.md Write 成功) で動作確認済み

## decisions

- D-001: 公式 hook schema に subagent_type は含まれないため、agent_id の存在有無でのみ orchestrator/subagent を識別する。理由: 他の信頼できる識別フィールドが存在しないため
- D-002: coordinator と worker は agent_id 形式で区別不可能だが、実運用では両者とも docs/workflows/ 配下への書き込みが必要なため区別する必要がない。理由: 2 層モデルと一致し、実害がない
- D-003: HARNESS_LAYER 環境変数による明示 override は保持する。理由: 将来の debug/テスト/運用シナリオで層を強制できる余地を残す
- D-004: orchestrator 判定 (agent_id 不在) は変更しない。理由: L1 Orchestrator の直接 Bash/Read ブロックは正しく機能しており触る必要がない
- D-005: 修正は detectLayer() 関数のみで完結し、checkWriteEdit 等の path gate は変更不要。理由: path gate 側のロジックは正しく、単に入力の layer 分類が誤っていただけのため

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/research.md (本ファイル — 調査結果と修正方針の記録)
- C:/ツール/Workflow/.agent/hook-layer-investigation.md (Follow-up 1-3 の生データ一次資料)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (調査対象および修正対象、ホットパッチ済み)
- C:/ツール/Workflow/.claude/hooks/pre-tool-gate.sh (thin wrapper、変更不要を確認済み)
- C:/ツール/Workflow/.agent/.coordinator-agent-id (agent_id 実例のソース)

## next

- requirements phase: AC-1〜AC-5 を定義し、F-001〜F-005 として RTM に登録する
- threat_model phase: hook 修正による security implication をレビューする (gate bypass なしを確認)
- design phase: detectLayer の入出力契約を正式化する
- test_design phase: 回帰テストケース TC-AC1-01 〜 TC-AC5-01 を列挙する
- documentation phase: ADR-030 として調査結果と設計判断を記録する
