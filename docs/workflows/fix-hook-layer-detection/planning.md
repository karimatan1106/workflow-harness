# Planning — fix-hook-layer-detection

## Execution Strategy

ホットパッチは既に適用済み (`detectLayer()` を `return 'worker'` に単純化) で動作確認済み。本タスクはこれを formalize するための後続 phase を計画する。

## Phase Sequence

- design: detectLayer の責務と入出力契約を図示 (入力 = hookInput オブジェクト、HARNESS_LAYER env、出力 = 'worker' / 'coordinator' / 'orchestrator' のいずれか)
- test_design: TC-AC1-01 (opaque hex → worker)、TC-AC2-01 (HARNESS_LAYER=worker override)、TC-AC3-01 (agent_id 不在 → orchestrator)、TC-AC4-01 (checkWriteEdit 連携)、TC-AC5-01 (テストファイル存在) を列挙
- test_impl: vitest で tool-gate.test.js を作成し Red を確認 (ホットパッチ前のロジックで再現するスナップショットを使うか、モックで agent_id を渡して期待値を確認)
- implementation: ホットパッチ済みなので実質変更不要。確認のみ
- refactoring: 本修正の範囲では実施しない (関数 3 行で refactor 余地なし)
- build_check: `pnpm build` または相当で workflow-harness/hooks/__tests__ がビルドパス通過することを確認
- code_review: 5 件の AC 全てが実装でカバーされていること、test と code の traceability が RTM と一致することをレビュー
- testing: 追加テスト実行で全 PASS を確認
- regression: 既存 829 テストへの影響 0 件を確認
- acceptance: 5 件の AC を verified に更新、受入判定
- manual_test: 手動で subagent 経由の docs/workflows/ 書き込みが通ることを確認
- security_scan: hook gate bypass リスクの再評価
- performance_test: hook overhead の計測 (本修正は分岐削減なので性能影響は期待しない)
- e2e_test: 新規 harness タスク起動 → hearing.md 書き込み成功の確認
- docs_update: CLAUDE.md、ADR-030、.claude/rules/ にデルタを反映
- deploy: 変更を git commit しリモートへ push (feature branch)

## Rollback Plan

- git revert ${commit-hash} で detectLayer を旧実装に戻す
- テストと ADR は rollback しても副作用なし
- harness タスクの state は本修正に依存しないため保持可能

## Resource Estimate

- 実装: 完了済み (3 行削除のみ)
- テスト: 新規 1 ファイル (100 行程度)
- ADR: 新規 1 ファイル (40 行程度)
- ドキュメント更新: CLAUDE.md と ADR index に数行追記
- レビュー時間: 30 分程度 (scope が小さいため)

## decisions

- D-001: TDD の Red 証拠は、ホットパッチ前のロジックを一時的にモックで再現してテストが fail することを記録する形式で担保する。理由: 実コードは既に修正済みで Red → Green の自然な順序を踏めないため、後追いの回帰テストとしての位置付けに切り替える
- D-002: refactoring phase は実施しない。理由: 本修正は 3 行の削除のみで refactor の余地がないため
- D-003: security_scan phase では gate bypass の再確認と hook の構文チェックを兼ねる。理由: T-4 mitigation として重要で、T-1〜T-3 の再評価もここで実施できるため
- D-004: performance_test では hook overhead の計測を行うが、本修正は分岐削減のため改善方向の期待値とする。理由: 分岐 1 つ削除の正味の gain は数μs オーダーで、回帰となる可能性はきわめて低い
- D-005: e2e_test では新規 harness タスクを起動し hearing.md 書き込みが通ることを END-to-END で確認する。理由: 本修正の主目的 (docs/workflows/ 書き込み deadlock 解消) を実証する最も確実な方法だから

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/planning.md (本ファイル — 実行計画の記録)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/threat-model.md (脅威評価の入力)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/requirements.md (AC と RTM の入力)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (ホットパッチ対象コード)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (追加予定のテスト)
- C:/ツール/Workflow/docs/adr/ADR-030-hook-layer-detection.md (作成予定 ADR)

## next

- design phase: 入出力契約の図示と責務境界の明文化
- test_design phase: TC-AC1-01〜TC-AC5-01 の列挙と Red/Green 基準の確定
- test_impl phase: vitest 形式でテスト実装
- implementation phase: ホットパッチ済みコードの最終確認
- documentation phase: ADR-030 作成と CLAUDE.md への反映
