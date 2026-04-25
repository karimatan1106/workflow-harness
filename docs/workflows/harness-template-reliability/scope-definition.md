# Scope Definition: harness-template-reliability

taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff
phase: scope_definition

## decisions

- SD-001: FIX-1はTOON_SKELETON_HEARINGにuserResponse TOONキーの記述例を追加する。toon-skeletons-a.ts L151-186のスケルトン定義にuserResponse行を追記し、hearing-workerが出力形式を正しく認識できるようにする。
- SD-002: FIX-2はdod-l3.tsのcheckBaselineRequired(L178-190)がregression_testフェーズでのみチェックする現行設計を維持しつつ、testingフェーズのテンプレート(defs-stage5.ts L17-30)にbaseline_capture実行の明示的リマインドを強化する。
- SD-003: FIX-3はhandleHarnessBack(scope-nav.ts L82-96)にcascadeオプションを追加する。defs-a.ts L99-110のスキーマにcascadeプロパティを追加し、goBack後にPHASE_APPROVAL_GATES対象フェーズの再承認を自動実行するロジックを組み込む。
- SD-004: FIX-4はdefs-stage0.tsのhearingテンプレートにSUMMARY_SECTIONフラグメントを追加し、TOON/MD出力形式の統一ガイダンスを他フェーズと同等にする。現在hearingはARTIFACT_QUALITYのみでSUMMARY_SECTIONが欠落している。
- SD-005: FIX-5はphase-analytics.ts(tools/phase-analytics.ts)のgenerateAdvice関数(L129-153)にcompleted滞留検出ルールを追加する。timingsからcompletedフェーズの経過時間を取得し3600s超過でadvice警告を出力する。
- SD-006: FIX-3のcascade-reapproveはapproval.ts(handlers/approval.ts)のhandleHarnessApprove関数との連携が必要。approveGate呼び出しをループで実行するため、各承認ゲートの前提条件(IA-1/IA-2/IA-6)をスキップしない設計とする。
- SD-007: FIX-1とFIX-4は同一テンプレート群(defs-stage0.ts + toon-skeletons-a.ts + definitions-shared.ts)への変更であり、セットで実装してコンフリクトを回避する。

## artifacts

- docs/workflows/harness-template-reliability/scope-definition.md: spec: スコープ定義。FIX-1〜FIX-5の影響範囲と変更対象ファイルを特定。
- docs/workflows/harness-template-reliability/hearing.md: spec: ユーザーヒアリング結果。FIX-3はcascade-reapprove方式、FIX-5は3600s閾値で合意済み。

## next

- criticalDecisions: SD-003(cascade-reapproveはapproveGateの前提条件チェックを維持する設計), SD-006(承認ループでIA-1/IA-2/IA-6をスキップしない)
- readFiles: src/tools/handlers/scope-nav.ts, src/tools/handlers/approval.ts, src/tools/phase-analytics.ts, src/phases/defs-stage0.ts, src/phases/toon-skeletons-a.ts, src/phases/definitions-shared.ts, src/phases/definitions.ts, src/gates/dod-l3.ts, src/gates/dod-l2-hearing.ts, src/tools/defs-a.ts, src/tools/handler-shared.ts, src/phases/defs-stage5.ts, src/state/manager-lifecycle.ts
- warnings: FIX-3のcascade-reapproveはhandler-shared.tsのPHASE_APPROVAL_GATESマップに依存するため、承認対象フェーズの特定ロジックが正確であることを確認する必要がある。goBack後のcompletedPhases配列のスライスにより承認済みゲートが消失するため、再承認対象の特定にはgoBack前の状態との差分計算が必要。

## scopeFiles

- src/phases/toon-skeletons-a.ts: FIX-1 userResponse TOONキー例示をTOON_SKELETON_HEARINGに追加
- src/phases/defs-stage0.ts: FIX-4 hearingテンプレートにSUMMARY_SECTIONフラグメント参照を追加
- src/phases/defs-stage5.ts: FIX-2 testingフェーズテンプレートにbaseline_capture実行リマインドを強化
- src/gates/dod-l3.ts: FIX-2 checkBaselineRequired関数のエラーメッセージ改善(既存ロジック維持)
- src/tools/handlers/scope-nav.ts: FIX-3 handleHarnessBackにcascadeオプションと再承認ループを追加
- src/tools/defs-a.ts: FIX-3 harness_backのinputSchemaにcascadeプロパティを追加
- src/tools/phase-analytics.ts: FIX-5 generateAdvice関数にcompleted滞留(3600s)検出ルールを追加
- src/tools/handler-shared.ts: FIX-3 PHASE_APPROVAL_GATESのエクスポートを再承認ロジックから参照
- src/state/manager-lifecycle.ts: FIX-3 goBack関数の戻り値に承認済みフェーズ情報を追加

## scopeDirs

- src/phases/: FIX-1, FIX-2, FIX-4のテンプレート・スケルトン変更
- src/tools/handlers/: FIX-3のscope-nav.ts(harness_back)変更
- src/tools/: FIX-3のdefs-a.ts(スキーマ)とFIX-5のphase-analytics.ts変更
- src/gates/: FIX-2のdod-l3.ts(baseline_required)エラーメッセージ改善
- src/state/: FIX-3のmanager-lifecycle.ts(goBack戻り値拡張)
- src/__tests__/: FIX-1〜FIX-5の各変更に対応するテストファイル追加・更新
