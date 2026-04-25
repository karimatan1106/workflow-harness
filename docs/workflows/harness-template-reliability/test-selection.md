# Test Selection: harness-template-reliability

taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff
phase: test_selection
size: large
intent: 3タスク横断分析に基づくハーネス信頼性改善5件 — FIX-1(hearingテンプレートにuserResponse TOONキー明示+AskUserQuestion必須化), FIX-2(baseline_captureリマインド), FIX-3(cascade-reapprove半自動化), FIX-4(TOON/MD出力形式統一), FIX-5(completed滞留アラート)

## selectedTests

全13テストケースを実装対象として選定する。

hearing-template.test.ts (3件):
- TC-AC1-01: TOON_SKELETON_HEARINGに:userResponseキーが存在する
- TC-AC2-01: hearingテンプレートにAskUserQuestion必須指示が含まれる
- TC-AC2-02: hearingテンプレートに選択肢2個以上の要求が含まれる
- TC-AC7-01: hearingテンプレートにSUMMARY_SECTIONプレースホルダが含まれる

testing-template.test.ts (1件):
- TC-AC3-01: testingテンプレートにbaseline_captureリマインドが含まれる

harness-back-cascade.test.ts (5件):
- TC-AC4-01: harness_backスキーマにcascade booleanパラメータが存在する
- TC-AC5-01: cascade=trueでPHASE_APPROVAL_GATESのフェーズのみ再承認される
- TC-AC6-01: 前提条件未達時にcascade処理が即時中断する
- TC-AC9-01: goBack後にstate.approvalsから対象フェーズが削除される
- TC-AC10-01: cascade未指定時のharness_back動作が従来と同一
- TC-AC10-02: cascade=falseでもharness_back動作が従来と同一

phase-analytics-stale.test.ts (2件):
- TC-AC8-01: completed 3600s超過フェーズに警告adviceが出力される
- TC-AC8-02: completed 3599s以下のフェーズに警告adviceが出力されない

## decisions

- TS-001: 全13テストケースを実装対象とする。static-string-matchテスト(TC-AC1-01, TC-AC2-01, TC-AC2-02, TC-AC3-01, TC-AC7-01)は各3-5行の正規表現マッチで実装コストが極めて低く、除外する理由がない。
- TS-002: integration-mockテスト(TC-AC5-01, TC-AC6-01, TC-AC9-01, TC-AC10-01, TC-AC10-02)はFIX-3のcascade-reapprove機能の安全性検証に不可欠であり、全件実装する。cascade処理の正常系/異常系/後方互換性を網羅しなければリグレッションリスクが残る。
- TS-003: unit-functionテスト(TC-AC8-01, TC-AC8-02)はFIX-5の閾値境界テストであり、3600s閾値の正確性保証に両方必須。片方のみでは境界の正しさを証明できない。
- TS-004: schema-inspectionテスト(TC-AC4-01)はcascadeパラメータのスキーマ定義を検証する。MCPツール定義の正確性はクライアント連携の前提条件であり除外不可。
- TS-005: 実装順序はhearing-template.test.ts、testing-template.test.ts、phase-analytics-stale.test.ts、harness-back-cascade.test.tsとする。静的マッチと単体テストを先に完成させ、統合テストに集中できる状態を作る。
- TS-006: FIX-4(TOON/MD出力形式統一)は既存テストでカバー済みのためtest-design(TD-006)の判断を継承し、新規テストケースは追加しない。

## artifacts

- docs/workflows/harness-template-reliability/test-selection.md: test_selection: 全13テストケースを4ファイルに分配した実装対象選定と実装順序の決定

## next

- criticalDecisions: TS-002(integration-mockテスト全件実装)がcascade-reapproveの品質保証の鍵
- readFiles: src/tools/handlers/scope-nav.ts(handleHarnessBack), src/tools/handlers/approval.ts(PHASE_APPROVAL_GATES), src/phases/toon-skeletons-a.ts(TOON_SKELETON_HEARING), src/phases/defs-stage0.ts, src/phases/defs-stage5.ts, src/tools/phase-analytics.ts
- warnings: TC-AC5-01とTC-AC6-01はapproval.tsの内部実装に依存するため、実装時にapproval.tsの現在のインターフェースを確認すること
