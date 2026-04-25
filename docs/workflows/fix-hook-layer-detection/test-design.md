# Test Design — fix-hook-layer-detection

## Strategy

vitest ベースのユニットテストで detectLayer() と checkWriteEdit() を直接呼び分岐網羅する。統合テストは不要 (hook 自体は pure function の組合せ)。既存の hook-utils.test.js と同じディレクトリ `workflow-harness/hooks/__tests__/` に配置する。

## Test Cases

- TC-AC1-01: opaque hex agent_id (`"a6fb64e37fc9f196e"`) を input とした detectLayer() が `"worker"` を返すことを確認
- TC-AC1-02: 任意の 16-char hex 値 (`"0123456789abcdef"`) でも同様に `"worker"` を返すことを確認
- TC-AC2-01: `process.env.HARNESS_LAYER = "worker"` 時、hookInput の内容に関わらず detectLayer() が `"worker"` を返すことを確認
- TC-AC2-02: `process.env.HARNESS_LAYER = "coordinator"` 時、detectLayer() が `"coordinator"` を返すことを確認 (env override が保持されている証拠)
- TC-AC3-01: `hookInput = null` 時、detectLayer() が `"orchestrator"` を返すことを確認
- TC-AC3-02: `hookInput.agent_id` 不在時、detectLayer() が `"orchestrator"` を返すことを確認
- TC-AC3-03: `hookInput.agent_id = ""` (空文字) 時、detectLayer() が `"orchestrator"` を返すこと (falsy フォールバック) を確認
- TC-AC4-01: layer=`"worker"` と `filePath="docs/workflows/foo/bar.md"` で checkWriteEdit() が block 判定しないことを確認
- TC-AC4-02: layer=`"orchestrator"` と `filePath="docs/workflows/foo/bar.md"` で checkWriteEdit() が block 判定することを確認 (逆方向の健全性)
- TC-AC5-01: `workflow-harness/hooks/__tests__/tool-gate.test.js` が存在しテスト対象関数を import していることをファイル存在チェックで確認

## Coverage Matrix

- AC-1 → TC-AC1-01, TC-AC1-02 (2 件で opaque hex と任意 hex を網羅)
- AC-2 → TC-AC2-01, TC-AC2-02 (env override の両方向を網羅)
- AC-3 → TC-AC3-01, TC-AC3-02, TC-AC3-03 (null / absent / empty string の 3 境界)
- AC-4 → TC-AC4-01, TC-AC4-02 (許可と block の両方向)
- AC-5 → TC-AC5-01 (ファイル存在のみ)

## Red/Green Criteria

- Red: 旧 detectLayer() (startsWith('worker')) では TC-AC1-01, TC-AC1-02 が failure となる (expected 'worker', actual 'coordinator')
- Green: 新 detectLayer() (return 'worker') で TC-AC1-*, TC-AC2-*, TC-AC3-*, TC-AC4-* 全てが PASS
- TC-AC5-01 はファイル存在確認のみで実装前に green になりうる (test 自体の存在が検証対象)

## Test Execution

- Runner: vitest (既存プロジェクト設定を流用)
- Config: `vitest.config.ts` のデフォルトを使用
- 実行コマンド: `cd workflow-harness && pnpm test hooks/__tests__/tool-gate.test.js`
- Expected exit code: 0 (全 10 ケース PASS)

## decisions

- D-001: TC-AC1 は 2 ケース (固定値と任意 hex) で意図を示す。理由: opaque hex の「type 判別不可能性」を 2 例で明示することで、将来開発者が startsWith を再導入するのを防ぐため
- D-002: TC-AC2 は正方向 (worker override) と逆方向 (coordinator override) を両方確認する。理由: env 分岐の単一方向だけだと片側バグを見逃す可能性があるため
- D-003: TC-AC3 は null / absent / empty string の 3 境界を網羅する。理由: JavaScript の falsy 挙動を明示的に test case 化することで、将来の TypeScript 移行や型変更時の回帰を防ぐため
- D-004: TC-AC4 は checkWriteEdit の block/非 block 両方向を確認する。理由: detectLayer の修正が checkWriteEdit の動作と矛盾しないことを integration 的に検証するため
- D-005: TC-AC5 はファイル存在のみで十分とする。理由: テストの存在自体が AC-5 の要求であり、内容の詳細は TC-AC1〜TC-AC4 が担うため、多重網羅は不要

## acTcMapping

- AC-1: TC-AC1-01, TC-AC1-02
- AC-2: TC-AC2-01, TC-AC2-02
- AC-3: TC-AC3-01, TC-AC3-02, TC-AC3-03
- AC-4: TC-AC4-01, TC-AC4-02
- AC-5: TC-AC5-01

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/test-design.md (本ファイル — テスト設計記録)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/design-review.md (入出力契約と境界条件の入力)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/requirements.md (AC と RTM の入力)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (作成予定のテストファイル)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (テスト対象、ホットパッチ済み)

## next

- test_impl phase: vitest で TC-AC1-01〜TC-AC5-01 を実装しホットパッチ済みコードに対して Green を取得
- implementation phase: ホットパッチ済みコードの最終確認
- build_check phase: 追加ファイルがビルド/型チェックを通ることを確認
- testing phase: 全 10 ケース PASS を記録
- regression phase: 既存 829 テストへの影響 0 件を確認
