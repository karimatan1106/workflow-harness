# Acceptance Report — fix-hook-layer-detection

## summary

本タスクは hooks 層判定ロジックの修正 (tool-gate.js::detectLayer / phase-config.js の BASH_COMMANDS.testing 拡張) と対応する単体テスト追加を完了した。acceptance_verification phase では AC-1 から AC-5 の 5 件全てに対して実装・テストケース・RTM 行の 1 対 1 対応を再確認し、status=met と判定できる証跡が揃った。hooks 単体テストは tool-gate 10 件と hook-utils 7 件の合計 17 件が Green (exit code 0) で、regression_test phase で記録した baseline 失敗 10 件はいずれも本タスクと無関係な既存 failure (hearing-worker-rules.test.ts / first-pass-improvement.test.ts) であり、新規 regression は 0 件である。本 phase 記録に基づき acceptance gate を approve し manual_test phase へ進む判断を下す。

## ac achievement status

| AC | 内容 | 判定 | 検証テストケース | 検証エビデンス |
|----|------|------|----------------|--------------|
| AC-1 | opaque hex agent_id を worker と判定 | met | TC-AC1-01 / TC-AC1-02 | tool-gate.js::detectLayer が agent_id truthy で worker を返すことを 2 ケースで確認 (testing.md TAP 行 ok 8-9) |
| AC-2 | HARNESS_LAYER env が override として機能 | met | TC-AC2-01 / TC-AC2-02 | env 値 worker / coordinator いずれも hookInput より優先されることを確認 (testing.md TAP 行 ok 10-11) |
| AC-3 | agent_id 不在時は orchestrator を返す | met | TC-AC3-01 / TC-AC3-02 / TC-AC3-03 | null hookInput / agent_id 欠落 / 空文字列の 3 ケース全てで orchestrator を返却 (testing.md TAP 行 ok 12-14) |
| AC-4 | worker は docs/workflows 配下を Write 可、orchestrator は block | met | TC-AC4-01 / TC-AC4-02 | checkWriteEdit が worker 層で allow / orchestrator 層で block を返すことを確認 (testing.md TAP 行 ok 15-16) |
| AC-5 | 回帰テストファイルが所定パスに存在 | met | TC-AC5-01 | hooks/__tests__/tool-gate.test.js の存在と 10 ケース構造を fs.statSync で検証 (testing.md TAP 行 ok 17) |

合計 5 件 / 5 件 met。未達ゼロ。

## rtm status

| RTM | 要件 | 判定 | コード参照 | テスト参照 |
|-----|------|------|----------|----------|
| F-001 | AC-1: opaque hex agent_id で worker | tested | workflow-harness/hooks/tool-gate.js L23-29 | hooks/__tests__/tool-gate.test.js TC-AC1-01/02 |
| F-002 | AC-2: HARNESS_LAYER env override | tested | workflow-harness/hooks/tool-gate.js L24-26 | hooks/__tests__/tool-gate.test.js TC-AC2-01/02 |
| F-003 | AC-3: fallback orchestrator | tested | workflow-harness/hooks/tool-gate.js L27 | hooks/__tests__/tool-gate.test.js TC-AC3-01/02/03 |
| F-004 | AC-4: worker の docs/workflows 書込許可 | tested | workflow-harness/hooks/tool-gate.js::checkWriteEdit | hooks/__tests__/tool-gate.test.js TC-AC4-01/02 |
| F-005 | AC-5: 回帰テストファイル配置 | tested | workflow-harness/hooks/__tests__/tool-gate.test.js (新規) | hooks/__tests__/tool-gate.test.js TC-AC5-01 |

合計 5 件 / 5 件 tested。

## regression summary

- hook 単体テスト: tool-gate.test.js 10 件 + hook-utils.test.js 7 件 = 17 件 Green (node --test、exit code 0、duration 70.0368 ms)
- vitest baseline: 864 ケース中 854 pass / 10 fail (unchanged)
- baseline 失敗 10 件の内訳: hearing-worker-rules.test.ts 3 件、first-pass-improvement.test.ts 7 件
- 本タスク由来の新規失敗: 0 件 (baseline と差分なし、build-check.md D-004 と regression-test.md D-001 で記録済み)
- baseline 失敗は本タスクのスコープ外 (planning.md の scope 境界で確定) であり、別タスクで扱う

## decisions

- D-001: acceptance_verification gate を approve し deployment 候補として受理する。理由: 5 件全ての AC が実装・テスト・RTM 3 軸で met であり、新規 regression が 0 件であるため
- D-002: 次 phase は manual_test に進める。理由: hooks 層の動作は自動テストで Green を取得済みだが、実ハーネス実行下で orchestrator/worker 層判定の挙動を手動で再確認する価値があるため
- D-003: ADR-030 の本文起草は docs_update phase で行う。理由: acceptance_verification 段階では受入判断に集中し、アーキテクチャ根拠の固定は別 phase で取り扱うため (testing.md D-001 と整合)
- D-004: baseline 失敗 10 件の triage は別タスク化する。理由: hearing-worker.md / coordinator.md / worker.md の prompt 再編に起因し、本タスクの hook 修正とは独立した文脈であるため
- D-005: 本 phase での追加コード変更は行わない。理由: AC-1 から AC-5 全件が met で、追加変更は実装スコープの肥大化リスクになるため (planning.md scope と整合)

## artifacts

前 phase 成果物 (16 件):

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/hearing.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/scope-definition.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/research.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/impact-analysis.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/requirements.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/threat-model.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/planning.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/ui-design.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/design-review.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/test-design.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/test-selection.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/implementation.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/refactoring.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/build-check.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/code-review.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/testing.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/regression-test.md

本 phase 記録先:

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/acceptance-report.md (本ファイル)

修正コードファイル:

- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (detectLayer L23-29、L1_ALLOWED L32)
- C:/ツール/Workflow/workflow-harness/hooks/phase-config.js (BASH_COMMANDS.testing の node --test 許可)

追加テストファイル:

- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (10 ケース、新規)

## next

- acceptance_verification gate を approve し manual_test phase へ advance する
- manual_test phase: 実ハーネス環境下で orchestrator / worker / coordinator 層判定と Write 権限制御を手動で確認
- docs_update phase: ADR-030 本文 (hook 層判定を agent_id 存在のみで判断する設計根拠) を新規作成し、CLAUDE.md の関連記述を更新
- baseline 失敗 10 件は別タスクとして切り出し、本タスクのクロージング後に個別 triage
