# E2E Test: harness-report-fb-fixes

phase: e2e_test
task: harness-report-fb-fixes
date: 2026-03-30
runner: npx vitest run

## summary

4件のFB修正（FB-1+5, FB-2, FB-4, FB-6）がエンドツーエンドで正しく動作することを確認した。
全テストスイート実行で802パス、39件は既知の無関係な失敗。FB関連テストは35件全てパス。

## E2E-1: FB-1+5 readonlyフェーズ統合検証

target: coordinator-prompt.ts buildAllowedTools() と PHASE_REGISTRY readonly bashCategories の連携
file: delegate-coordinator-readonly.test.ts
result-e2e1: 3件全パス（TC-AC1-01, TC-AC1-02, TC-AC1-03）
detail: readonlyフェーズでWrite/Editが除外され、mixed categoriesでは保持、planOnly+readonlyの二重除外が冪等に動作

## E2E-2: FB-2 content_validation統合検証

target: dod-helpers.ts isStructuralLine() と checkDuplicateLines() の連携
file: dod-extended.test.ts
result-e2e2: 16件全パス（TC-AC1-01, TC-AC5-01, TC-AC21-01〜TC-AC23-01, TC-AC2-01〜TC-AC2-04 他）
detail: テストケースID行・コードフェンス・Mermaid構文・テーブルセパレータが構造行として正しく除外される

## E2E-3: FB-4 RTMライフサイクル統合検証

target: manager-write.ts applyAddRTM() upsert と harness_add_rtm MCPツールの連携
file: manager-write-rtm.test.ts
result-e2e3: 3件全パス（TC-AC3-01, TC-AC3-02, TC-AC3-03）
detail: 新規IDのpush、既存IDの上書き（配列長不変）、upsert後のステータス更新が正しく動作

## E2E-4: FB-6 harness_back統合検証

target: manager-lifecycle.ts goBack() artifactHashesクリアとロールバックフロー
file: manager-lifecycle-reset.test.ts
result-e2e4: 13件全パス（TC-AC4-01, TC-AC4-02, TC-AC4-03 他10件）
detail: artifactHashesクリア、retryCountクリア、completedPhasesスライス、サブフェーズ依存関係チェックが統合的に動作

## E2E-5: 全テストスイート統合実行

command: npx vitest run
total-files: 125
passed-files: 94
failed-files: 31（既知の無関係な失敗）
total-tests: 841
passed-tests: 802
failed-tests: 39（既知の無関係な失敗）
duration: 8.73s
fb-related-tests: 35件全パス（delegate-coordinator-readonly 3 + dod-extended 16 + manager-write-rtm 3 + manager-lifecycle-reset 13）

## decisions

- E2E-001: 全4件のFB修正が統合レベルで正しく動作することをvitest実行で確認した
- E2E-002: PHASE_REGISTRYのreadonly bashCategoriesがbuildAllowedToolsに正しく伝搬されることを検証した
- E2E-003: isStructuralLineのテストケースIDパターン認識がcheckDuplicateLinesの偽陽性を防止することを確認した
- E2E-004: applyAddRTMのupsertロジックが新規追加と既存上書きの両方で正しく動作することを検証した
- E2E-005: goBackのartifactHashesクリアがcompletedPhasesスライスやretryCountリセットと整合的に動作することを確認した
- E2E-006: 39件の既知失敗はFB修正と無関係であり、リグレッションは発生していないと判断した

## artifacts

- docs/workflows/harness-report-fb-fixes/e2e-test.md（本ファイル）

## next

- 全フェーズ完了。harness_complete_sub で e2e_test サブフェーズを完了する
