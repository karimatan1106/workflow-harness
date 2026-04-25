# Test Design: harness-template-reliability

taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff
phase: test_design
size: large
intent: 3タスク横断分析に基づくハーネス信頼性改善5件 — FIX-1(hearingテンプレートにuserResponse TOONキー明示+AskUserQuestion必須化), FIX-2(baseline_captureリマインド), FIX-3(cascade-reapprove半自動化), FIX-4(TOON/MD出力形式統一), FIX-5(completed滞留アラート)

## テストファイル構成

hearing-template.test.ts: FIX-1関連テスト(AC-1, AC-2, AC-7)。TOON_SKELETON_HEARINGとdefs-stage0.tsのhearingテンプレート文字列を検証。
testing-template.test.ts: FIX-2関連テスト(AC-3)。defs-stage5.tsのtestingテンプレートにbaseline_captureリマインドが含まれることを検証。
harness-back-cascade.test.ts: FIX-3関連テスト(AC-4, AC-5, AC-6, AC-9, AC-10)。handleHarnessBack関数のcascadeオプションを統合テストで検証。
phase-analytics-stale.test.ts: FIX-5関連テスト(AC-8)。generateAdvice関数のcompleted滞留検出を単体テストで検証。

## テストケース一覧

TC-AC1-01: TOON_SKELETON_HEARINGに:userResponseキーが存在する。テスト種別: static-string-match。setup: toon-skeletons-a.tsからTOON_SKELETON_HEARINGをimport。期待: /userResponse/がスケルトン文字列にマッチ。

TC-AC2-01: hearingテンプレートにAskUserQuestion必須指示が含まれる。テスト種別: static-string-match。setup: defs-stage0.tsからhearing定義をimport。期待: /AskUserQuestion/iと/必須/がテンプレート文字列にマッチ。

TC-AC2-02: hearingテンプレートに選択肢2個以上の要求が含まれる。テスト種別: static-string-match。setup: defs-stage0.tsからhearing定義をimport。期待: /選択肢.*2|2.*選択肢|options.*2/iがマッチ。

TC-AC3-01: testingテンプレートにbaseline_captureリマインドが含まれる。テスト種別: static-string-match。setup: defs-stage5.tsからtesting定義をimport。期待: /baseline_capture|harness_capture_baseline/がマッチ。

TC-AC4-01: harness_backスキーマにcascade booleanパラメータが存在する。テスト種別: schema-inspection。setup: defs-a.tsからharness_backスキーマをimport。期待: properties.cascadeが{type: 'boolean'}で定義され、requiredに含まれない。

TC-AC5-01: cascade=trueでPHASE_APPROVAL_GATESのフェーズのみ再承認される。テスト種別: integration-mock。setup: handleHarnessBack関数にstate/cascadeを渡す。期待: PHASE_APPROVAL_GATESに登録されたゲートフェーズのみapproval再実行。

TC-AC6-01: 前提条件未達時にcascade処理が即時中断する。テスト種別: integration-mock。setup: handleHarnessBackにIA前提条件が未達のstateを渡す。期待: cascadeFailed配列に失敗理由が含まれ、後続の再承認はスキップ。

TC-AC7-01: hearingテンプレートにSUMMARY_SECTIONプレースホルダが含まれる。テスト種別: static-string-match。setup: defs-stage0.tsからhearing定義をimport。期待: /{SUMMARY_SECTION}/がテンプレート文字列にマッチ。

TC-AC8-01: completed 3600s超過フェーズに警告adviceが出力される。テスト種別: unit-function。setup: generateAdvice関数にcompleted: 4000sのphaseTimingsを渡す。期待: advice配列に滞留警告メッセージが含まれる。

TC-AC8-02: completed 3599s以下のフェーズに警告adviceが出力されない。テスト種別: unit-function。setup: generateAdvice関数にcompleted: 3599sのphaseTimingsを渡す。期待: advice配列に滞留警告が含まれない。

TC-AC9-01: goBack後にstate.approvalsから対象フェーズが削除される。テスト種別: integration-mock。setup: state.approvalsに承認済みエントリを設定しgoBack実行。期待: goBack対象フェーズのapprovalエントリが削除されている。

TC-AC10-01: cascade未指定時のharness_back動作が従来と同一。テスト種別: integration-mock。setup: handleHarnessBackにcascade未指定で呼び出し。期待: レスポンスにcascadeReapproved/cascadeFailedフィールドが存在しない。

TC-AC10-02: cascade=falseでもharness_back動作が従来と同一。テスト種別: integration-mock。setup: handleHarnessBackにcascade=falseで呼び出し。期待: レスポンスが従来形式と同一。

## acTcMapping

- AC-1: TC-AC1-01
- AC-2: TC-AC2-01, TC-AC2-02
- AC-3: TC-AC3-01
- AC-4: TC-AC4-01
- AC-5: TC-AC5-01
- AC-6: TC-AC6-01
- AC-7: TC-AC7-01
- AC-8: TC-AC8-01, TC-AC8-02
- AC-9: TC-AC9-01
- AC-10: TC-AC10-01, TC-AC10-02

## decisions

- TD-001: テストケースを4ファイルに分配し、FIX単位でテストの独立性を確保する。hearing-template(FIX-1), testing-template(FIX-2), harness-back-cascade(FIX-3), phase-analytics-stale(FIX-5)。
- TD-002: FIX-1/2/4のテンプレート検証はstatic-string-matchとし、正規表現でテンプレート文字列の存在を検証する。テンプレートレンダリングではなく定義文字列を直接テストすることでテスト安定性を確保する。
- TD-003: FIX-3のcascade-reapproveテストはintegration-mockとし、handleHarnessBack関数にモックstateを渡して統合テストする。approval.tsの実関数はモックせず前提条件チェックの通過/失敗を検証する。
- TD-004: FIX-5のcompleted滞留テストはunit-functionとし、generateAdvice関数に直接phaseTimingsを渡して出力を検証する。閾値境界テスト(3599s/3600s)を含める。
- TD-005: AC-10は2テストケース(未指定/false明示)でカバーし、default値の後方互換性を確実に検証する。
- TD-006: FIX-4(TOON/MD出力形式統一)はdefinitions-shared.tsのSUMMARY_SECTION_RULE内の文字列変更であり、既存のhandler-templates-validation.test.tsでカバーされるため新規テストケースは追加しない。
- TD-007: 各AC最低1テストケース、AC-2/AC-8/AC-10は2テストケースでカバーし、合計13テストケースとする。

## artifacts

- docs/workflows/harness-template-reliability/test-design.md: test: AC-1〜AC-10に対する13テストケースを4ファイルに分配したテスト設計仕様

## next

- criticalDecisions: TD-003(FIX-3のintegration-mockテスト設計)がcascade-reapproveの安全性検証の核心
- readFiles: src/tools/handlers/scope-nav.ts(handleHarnessBack), src/tools/handlers/approval.ts(PHASE_APPROVAL_GATES), src/phases/toon-skeletons-a.ts(TOON_SKELETON_HEARING), src/phases/defs-stage0.ts, src/phases/defs-stage5.ts, src/tools/phase-analytics.ts
- warnings: TC-AC5-01とTC-AC6-01はapproval.tsの内部実装に依存するため、approval.tsの変更時にテストの更新が必要
