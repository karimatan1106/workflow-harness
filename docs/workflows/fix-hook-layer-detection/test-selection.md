# Test Selection — fix-hook-layer-detection

## Selected Test Suite

vitest を runner として採用。workflow-harness 配下の既存 vitest.config を流用。テスト配置は `workflow-harness/hooks/__tests__/tool-gate.test.js` (既存 `hook-utils.test.js` と同ディレクトリ)。

## Selected Cases

- TC-AC1-01, TC-AC1-02 (opaque hex → worker)
- TC-AC2-01, TC-AC2-02 (HARNESS_LAYER override)
- TC-AC3-01, TC-AC3-02, TC-AC3-03 (orchestrator 境界)
- TC-AC4-01, TC-AC4-02 (checkWriteEdit 連携)
- TC-AC5-01 (テストファイル存在)

## Excluded Cases

- E2E テスト: harness 起動から hearing.md 書き込みまでの actual run は e2e_test phase で別途行うためここでは除外
- UI テスト: 対象 UI がないため除外
- Integration テスト: detectLayer と checkWriteEdit を直接 import して呼べるため不要

## Runner Configuration

- Command: `cd workflow-harness && pnpm test hooks/__tests__/tool-gate.test.js`
- Isolation: 各 test 内で process.env.HARNESS_LAYER を beforeEach/afterEach でクリアして干渉を防ぐ
- Parallelism: vitest デフォルト並列を使用

## decisions

- D-001: vitest を選択する。理由: workflow-harness 既存テスト群と runner を統一できるため
- D-002: `__tests__/` ディレクトリに配置する。理由: 既存 `hook-utils.test.js` の慣例に従い発見性を高めるため
- D-003: E2E / UI / Integration を除外する。理由: ユニットテストで分岐網羅が可能で、統合観点は e2e_test phase に委ねるため
- D-004: process.env は beforeEach でリセットする。理由: テスト間の状態漏れを防ぎ並列実行時の安定性を担保するため
- D-005: TC-AC5-01 はファイル存在チェックのみで十分。理由: テストの存在自体が AC-5 要件であり、内容は他 TC が担保するため

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/test-selection.md (本ファイル)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/test-design.md (入力 — TC 一覧)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (作成予定)
- C:/ツール/Workflow/workflow-harness/vitest.config.ts (既存 config)

## next

- test_impl phase: 選択された 10 TC を vitest 形式で実装
- implementation phase: ホットパッチ済みコード確認
- testing phase: 全 PASS 記録
