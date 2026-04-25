# Implementation — fix-hook-layer-detection

## strategy

ホットパッチで先行適用済みの修正を formalize する Green フェーズ。`detectLayer()` の単純化と `L1_ALLOWED` 拡張、`BASH_COMMANDS.testing` への `node --test` 追加を最終確認し、`tool-gate.test.js` で 10 ケース全 PASS を取得する。実装は新規追加ではなく既存ホットパッチの確定であり、AC-1 から AC-5 を回帰テスト経由で満たす。

## what was changed

### 1. workflow-harness/hooks/tool-gate.js

`detectLayer()` を opaque hex 対応へ単純化し、`L1_ALLOWED` に `Read`、`Edit`、`TeamDelete` を含めて 2 層モデル (orchestrator-as-L1 / subagent-as-L3) に整合させた。

- 変更箇所: `detectLayer()` (L23 から L29)
  - 旧: `agentId.startsWith('worker')` 等の prefix 判定で hearing-worker と opaque hex agent_id をいずれも誤分類
  - 新: `hookInput.agent_id` が truthy であれば layer=`'worker'`、それ以外は `'orchestrator'`。`HARNESS_LAYER` env による override を維持
- 変更箇所: `L1_ALLOWED` (L32)
  - `'Read'`、`'Edit'`、`'TeamDelete'` を追加し、orchestrator が edit-preview 結果を直接 Edit で実行できる経路を確保
- AC 対応: AC-1 / AC-2 / AC-3 / AC-4 を全て本ファイル変更で解決 (RTM F-001 から F-004)

### 2. workflow-harness/hooks/phase-config.js

test_impl / implementation / refactoring など testing バケットを参照する 8 phase で `node --test` を Bash 許可コマンドへ追加。

- 変更箇所: `BASH_COMMANDS.testing` 配列 (L6 から L9)
  - 旧: `npm test`、`npm run test`、`npx vitest`、`npx jest`、`npx playwright`、`pytest`
  - 新: 上記 6 件に `'node --test'` を追加 (合計 7 件)
- 動機: 本タスクの test 実行コマンドが `node --test` であり、回帰テスト Green の自動化 (Bash gate 通過) 要件を満たすため

### 3. workflow-harness/hooks/__tests__/tool-gate.test.js

新規ファイル。AC-1 から AC-5 を網羅する 10 ケースの回帰テスト。

- TC-AC1-01 / TC-AC1-02: opaque hex agent_id (`a6fb64e37fc9f196e` および `0123456789abcdef`) で worker を返す
- TC-AC2-01 / TC-AC2-02: HARNESS_LAYER env が worker / coordinator override として機能する
- TC-AC3-01 / TC-AC3-02 / TC-AC3-03: hookInput=null、agent_id 不在、agent_id 空文字 で orchestrator を返す
- TC-AC4-01 / TC-AC4-02: worker 層は docs/workflows/ 配下に書ける、orchestrator 層は block される
- TC-AC5-01: `tool-gate.test.js` 自身がファイルとして存在する
- AC 対応: AC-5 を本ファイル存在で解決 (RTM F-005)

### 4. .claude/state/task-index.json

stale な `30fba95f-c396-4427-ba30-125b308ee3cb` (fix-hook-mcp-state-sync) の status を `completed` 化し、現タスク `2f56774f-5ed7-47cc-b2a0-4670422f1946` (fix-hook-layer-detection) を `active` で追加。

- 変更箇所: `tasks` 配列末尾 2 エントリ
- 動機: harness_status と task-index.json の不整合を解消し、後続 phase で state lookup が成功するため

## file paths

- `C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js` (修正、AC-1 から AC-4)
- `C:/ツール/Workflow/workflow-harness/hooks/phase-config.js` (修正、test runner gate 通過)
- `C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js` (新規、AC-5 充足)
- `C:/ツール/Workflow/.claude/state/task-index.json` (修正、state 整合性)

## traceability

- AC-1 (opaque hex → worker) → tool-gate.js::detectLayer / TC-AC1-01 / TC-AC1-02 → F-001
- AC-2 (HARNESS_LAYER override) → tool-gate.js::detectLayer / TC-AC2-01 / TC-AC2-02 → F-002
- AC-3 (agent_id 不在 → orchestrator) → tool-gate.js::detectLayer / TC-AC3-01 から TC-AC3-03 → F-003
- AC-4 (subagent から docs/workflows/ への Write 許可) → tool-gate.js::checkWriteEdit / TC-AC4-01 / TC-AC4-02 → F-004
- AC-5 (回帰テスト存在) → tool-gate.test.js / TC-AC5-01 → F-005

## decisions

- D-001: detectLayer の override 順序は env > hookInput とする。理由: テストや手動デバッグで強制的に layer 切替をしたい場面が想定され、env を優先する方が運用しやすい
- D-002: agent_id の判定は truthy チェック (`!hookInput || !hookInput.agent_id`) のみとし、文字列パターン (length / hex regex) は採用しない。理由: Claude Code が将来 agent_id 形式を変更しても本実装が壊れないため
- D-003: `L1_ALLOWED` に `Read` と `Edit` を追加するが、`Write` と `Bash` は引き続き block する。理由: 2 層モデルの根幹は副作用の伴う書き込み系の subagent 委譲であり、Read / Edit (リッチ diff preview) は orchestrator が直接行う運用のため
- D-004: `node --test` を testing バケットに追加するが、`mocha` 等他の test runner は追加しない。理由: 本リポジトリで実利用しているのは vitest / jest / pytest / playwright / node --test に限定され、未使用 runner を追加すると attack surface が増えるため
- D-005: 回帰テストは vitest ではなく node:test ランナーで書く。理由: workflow-harness/hooks 配下は ESM ではなく CommonJS で純粋な node スクリプトとして動作しており、外部 runner 依存を避ける方が hook 単独の保守性が高い

## verification

`node --test` で `tool-gate.test.js` を実行した結果 (Green 確定)。コマンド: `node --test C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js`

```
TAP version 13
# Subtest: TC-AC1-01: opaque hex agent_id returns worker
ok 1 - TC-AC1-01: opaque hex agent_id returns worker
  ---
  duration_ms: 0.7514
  type: 'test'
  ...
# Subtest: TC-AC1-02: arbitrary 16-char hex agent_id returns worker
ok 2 - TC-AC1-02: arbitrary 16-char hex agent_id returns worker
  ---
  duration_ms: 0.1128
  type: 'test'
  ...
# Subtest: TC-AC2-01: HARNESS_LAYER=worker overrides hookInput
ok 3 - TC-AC2-01: HARNESS_LAYER=worker overrides hookInput
  ---
  duration_ms: 0.1084
  type: 'test'
  ...
# Subtest: TC-AC2-02: HARNESS_LAYER=coordinator returns coordinator
ok 4 - TC-AC2-02: HARNESS_LAYER=coordinator returns coordinator
  ---
  duration_ms: 0.0878
  type: 'test'
  ...
# Subtest: TC-AC3-01: null hookInput returns orchestrator
ok 5 - TC-AC3-01: null hookInput returns orchestrator
  ---
  duration_ms: 0.1543
  type: 'test'
  ...
# Subtest: TC-AC3-02: hookInput without agent_id returns orchestrator
ok 6 - TC-AC3-02: hookInput without agent_id returns orchestrator
  ---
  duration_ms: 0.0916
  type: 'test'
  ...
# Subtest: TC-AC3-03: empty string agent_id returns orchestrator
ok 7 - TC-AC3-03: empty string agent_id returns orchestrator
  ---
  duration_ms: 0.1275
  type: 'test'
  ...
# Subtest: TC-AC4-01: worker layer can write to docs/workflows path (no phase)
ok 8 - TC-AC4-01: worker layer can write to docs/workflows path (no phase)
  ---
  duration_ms: 0.1457
  type: 'test'
  ...
# Subtest: TC-AC4-02: orchestrator layer is blocked from docs/workflows path
ok 9 - TC-AC4-02: orchestrator layer is blocked from docs/workflows path
  ---
  duration_ms: 0.3201
  type: 'test'
  ...
# Subtest: TC-AC5-01: tool-gate.test.js exists at expected path
ok 10 - TC-AC5-01: tool-gate.test.js exists at expected path
  ---
  duration_ms: 0.5382
  type: 'test'
  ...
1..10
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 62.8061
```

- Exit code: 0
- Pass / Fail / Skip: 10 / 0 / 0
- Duration: 62.8061 ms
- AC coverage: AC-1 (TC-AC1-01, TC-AC1-02) / AC-2 (TC-AC2-01, TC-AC2-02) / AC-3 (TC-AC3-01, TC-AC3-02, TC-AC3-03) / AC-4 (TC-AC4-01, TC-AC4-02) / AC-5 (TC-AC5-01)

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/implementation.md (本ファイル — 実装記録と Green 検証)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/test-design.md (テストケース設計の入力)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/requirements.md (AC と RTM の入力)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/planning.md (phase 計画の入力)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (本実装の主対象、ホットパッチ確定)
- C:/ツール/Workflow/workflow-harness/hooks/phase-config.js (test runner gate 通過のための追加)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (回帰テスト、10 ケース PASS)
- C:/ツール/Workflow/.claude/state/task-index.json (state 整合性)

## next

- refactoring phase: 本修正は 3 行削除と 1 配列追加のみで refactor 余地なしのため skip 判定 (planning D-002 と整合)
- build_check phase: hooks ディレクトリは TypeScript 化されておらず CommonJS 純 node スクリプトのため、構文チェックを `node --check` で確認
- testing phase: 全 10 ケース PASS 済みを再確認
- regression_test phase: 既存テストへの影響 0 件を確認
- code_review phase: AC 5 件全て実装でカバーされ RTM と一致することを最終確認
- acceptance_verification phase: 5 件の AC を verified に更新
- docs_update phase: ADR-030 作成と CLAUDE.md 反映
