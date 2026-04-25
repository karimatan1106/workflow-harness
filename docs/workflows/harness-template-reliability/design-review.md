# Design Review: harness-template-reliability

phase: design_review
task: harness-template-reliability
taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff

## AC-to-Step Traceability

| AC | Planning Step | Coverage |
|----|--------------|----------|
| AC-1 | PL-01 (toon-skeletons-a.ts userResponseキー追加) | Complete — :section intent-analysis内配置を明示 |
| AC-2 | PL-02 (defs-stage0.ts AskUserQuestion必須指示) | Complete — 選択肢2個以上の要求文言を含む |
| AC-3 | PL-05 (defs-stage5.ts baseline_captureリマインド) | Complete — 冒頭配置で視覚的警告を実現 |
| AC-4 | PL-07 (defs-a.ts cascadeパラメータ追加) | Complete — optional boolean, required配列に含めない |
| AC-5 | PL-09 (scope-nav.ts cascade-reapproveロジック) | Complete — PHASE_APPROVAL_GATES走査で対象特定 |
| AC-6 | PL-09 (scope-nav.ts cascade中断処理) | Complete — IA-1/IA-2/IA-6未達時に即時中断 |
| AC-7 | PL-03 (defs-stage0.ts SUMMARY_SECTION追加) | Complete — {ARTIFACT_QUALITY}直前に配置 |
| AC-8 | PL-06 (phase-analytics.ts completed滞留検出) | Complete — 3600s閾値、Number.isFinite()ガード |
| AC-9 | PL-08 (scope-nav.ts approval削除処理) | Complete — goBack後にtargetPhase以降のapproval削除 |
| AC-10 | PL-07 (defs-a.ts cascade=false後方互換) | Complete — undefined→false正規化、分岐分離 |

全10件のACがplanningのstepsに対応付けられている。未カバーACなし。

## FIX-3 Cascade-Reapprove vs Threat Model

| 脅威 | 緩和策(threat-model) | 実装設計(planning/state-machine) | 整合性 |
|------|---------------------|--------------------------------|--------|
| TM-001 Spoofing | approval.tsのhandleHarnessApprove経由必須 | PL-09/SM-003: handleHarnessApprove直接呼出、独自ロジック禁止 | OK |
| TM-002 Tampering | 削除対象をPHASE_APPROVAL_GATESかつ未complete限定 | PL-08/SM-002/FC-006: 同一条件で削除範囲を制約 | OK |
| TM-003 DoS | 前提条件未達で即時中断 | PL-D04/SM-004/FC-004: 中断しユーザー通知 | OK |
| TM-004 EoP | completedPhases直接操作禁止 | SM-005: 明示的に禁止、lifecycle-next.tsに委ねる | OK |
| TM-005 Tampering | cascade=false時の動作不変 | PL-D07/SM-001/FC-003: Boolean正規化で完全分離 | OK |
| TM-006 InfoDisclosure | Number.isFinite()で不正値スキップ | PL-06/FC-005: 定数COMPLETED_STALE_THRESHOLD_SEC + 検証 | OK |
| TM-007 Tampering | userResponseとSUMMARY_SECTIONの配置位置非重複 | PL-D02: intent-analysis内 vs ARTIFACT_QUALITY直前 | OK |

全7脅威に対する緩和策がplanning/state-machine/flowchartの3成果物で一貫して反映されている。

## State Machine vs Flowchart Consistency

状態遷移図(state-machine.mmd)の遷移パスとフローチャート(flowchart.mmd)の分岐を照合した結果:

- cascade=false分岐: SM-001(CurrentPhase→CurrentPhase)がFC-003(DEFAULT_PATH)に対応。整合。
- ApprovalCleared→PhaseRewound: SM-002のapproval削除がFC-006のPHASE_APPROVAL_GATES判定に対応。整合。
- ReapprovalLoop→CascadeFailed: SM-004の前提条件未達中断がFC-004のABORT_CASCADEに対応。整合。
- ReapprovalLoop→ReapprovalComplete: SM-003の全フェーズ承認完了がFC内のNEXT_GATE→No→CASCADE_DONEに対応。整合。

差異: 状態遷移図にはBackRequested→CascadeFailed(targetPhase未到達)の遷移があるが、フローチャートにはgoBack自体の失敗分岐が明示されていない。goBackの既存エラーハンドリングで処理されると推定されるが、フローチャートに明示するとより正確になる。重大な不整合ではない。

## 200-Line Compliance Estimate

| ファイル | 変更種別 | 追加行数見込み | 元ファイル行数(推定) | 超過リスク |
|---------|---------|--------------|-------------------|-----------|
| toon-skeletons-a.ts | テンプレート文言追加 | +1行 | 低 | なし |
| defs-stage0.ts | テンプレート指示追加 + SUMMARY_SECTION | +5-8行 | テンプレート文字列のため200行超過の可能性あり | 要確認 |
| defs-stage5.ts | リマインド文言追加 | +3行 | 低 | なし |
| definitions-shared.ts | ガイダンス文言追加 | +2行 | 低 | なし |
| phase-analytics.ts | 定数+ロジック追加 | +10-15行 | 要確認(145行目付近に追加) | 中 |
| defs-a.ts | スキーマプロパティ追加 | +4行 | 低 | なし |
| scope-nav.ts | cascade分岐+reapproveループ | +30-50行 | 要確認(現在の行数次第) | 高 |

scope-nav.tsとphase-analytics.tsは200行超過リスクがある。実装フェーズでcascade処理を別ファイル(cascade-reapprove.ts等)に分離する判断が必要になる可能性がある。

## Testability Assessment

- FIX-1(PL-01/PL-02/PL-03): テンプレート文字列のスナップショットテストまたは正規表現マッチで検証可能。dod-l2-hearingの既存テストパターンを流用できる。テスト容易性: 高。
- FIX-2(PL-05): テンプレート文字列にリマインド文言が含まれることの静的検証。テスト容易性: 高。
- FIX-4(PL-04): 定数値の内容検証。テスト容易性: 高。
- FIX-5(PL-06): generateAdvice関数にモック状態を入力し、returned adviceに滞留警告が含まれることを検証。Number.isFinite()ガードの境界値(NaN, Infinity, -1)もテスト可能。テスト容易性: 高。
- FIX-3(PL-07/PL-08/PL-09): cascade=true/false/undefinedの3パターン、前提条件達成/未達の2パターン、approval削除範囲の正確性を検証する必要がある。handleHarnessApproveのモック化が必要で、テストセットアップの複雑度が最も高い。テスト容易性: 中。cascade処理を独立関数に切り出すことでモック境界が明確になり、テスト容易性が向上する。

## decisions

- DR-001: AC-to-Step全件マッピング完了。AC-1〜AC-10の全てがPL-01〜PL-09のいずれかに対応付けられており、未カバーACは存在しない。レビュー結果: 合格。
- DR-002: FIX-3のcascade-reapproveは脅威モデルTM-001〜TM-005の全緩和策がplanning(PL-D03/PL-D04/PL-D07)、状態遷移図(SM-001〜SM-007)、フローチャート(FC-003/FC-004/FC-006)で一貫して反映されている。レビュー結果: 合格。
- DR-003: 状態遷移図とフローチャート間に1件の軽微な差異を検出。goBack自体の失敗分岐がフローチャートに未記載。既存エラーハンドリングでカバーされるため実装への影響はないが、フローチャートへの追記を推奨する。レビュー結果: 軽微な指摘付き合格。
- DR-004: scope-nav.tsの200行制限超過リスクが高い。cascade-reapproveロジック(+30-50行)の追加により超過する場合、cascade処理を独立ファイル(例: cascade-reapprove.ts)に分離すること。この判断は実装フェーズで現在の行数を確認した上で行う。レビュー結果: 条件付き合格。
- DR-005: FIX-3のテスト容易性を向上させるため、cascade処理を独立関数に切り出すことを推奨する。handleHarnessBack内にインライン実装すると、handleHarnessApproveのモック化が困難になり、テストのセットアップコストが増大する。レビュー結果: 推奨事項。
- DR-006: PL-04(FIX-4)はACに直接対応するものがない。requirements.mdのAC定義にFIX-4専用のACが存在しない。テンプレート品質改善の一環として実施されるが、受入基準による検証が不可能。PL-04完了の判断基準をDoDで補完する必要がある。レビュー結果: 指摘事項。
- DR-007: ui-design.mdのUID-003で「部分的再承認は行わない」と定義されているが、同ドキュメントの失敗レスポンス仕様ではcascadeReapproved(中断前に成功したフェーズ)が空配列ではなく値を持ちうると記述されている。これは部分的にapproval削除後、再承認ループの途中で失敗した場合に発生する。UID-003の「部分的再承認は行わない」はapproval削除からの自動ロールバックを意味するのか、再承認ループの中断を意味するのかを明確化する必要がある。SM-004/FC-004は「部分承認状態でユーザーに手動対応を通知」としており、UID-003の文言と若干の齟齬がある。レビュー結果: 要明確化。

## acDesignMapping

- AC-1: toon-skeletons-a.tsのTOON_SKELETON_HEARINGにuserResponseキー追加 (UID-004配置位置設計)
- AC-2: defs-stage0.tsのhearingテンプレートにAskUserQuestion必須+選択肢2個以上指示追加 (UID-005配置設計)
- AC-3: defs-stage5.tsのtestingテンプレートにbaseline_captureリマインド追加 (UID-005配置設計)
- AC-4: defs-a.tsのharness_backスキーマにcascade boolean追加 (UID-001スキーマ設計)
- AC-5: scope-nav.tsのcascade-reapproveロジックがPHASE_APPROVAL_GATESを参照 (SM状態遷移設計)
- AC-6: scope-nav.tsのcascade処理がapproval.tsのIA-1/IA-2/IA-6チェックをバイパスしない (TM-003緩和策)
- AC-7: defs-stage0.tsのhearingテンプレートにSUMMARY_SECTION追加 (UID-006フィールド順序設計)
- AC-8: phase-analytics.tsのgenerateAdvice関数に3600s滞留検出ルール追加 (UID-007メッセージ形式設計)
- AC-9: manager-lifecycle.tsのgoBack後にstate.approvalsから対象エントリ削除 (SM-004状態遷移設計)
- AC-10: cascade未指定時のharness_back動作が従来と同一 (UID-001 default:false設計)

## artifacts

- docs/workflows/harness-template-reliability/design-review.md: 設計成果物全体のレビュー結果。AC-Step対応表、脅威モデル充足確認、状態遷移/フローチャート整合性、200行制限見込み、テスト容易性評価、DR-001〜DR-007を含む。

## next

- criticalDecisions: DR-004(scope-nav.ts 200行制限対応の実装時判断), DR-007(UID-003の部分再承認ポリシー明確化)
- actions: DR-003のフローチャート軽微修正(goBack失敗分岐追加)はimplementation前の任意タイミングで実施可能。DR-006のPL-04用AC補完はDoD定義時に対応する。
- readFiles: mcp-server/src/tools/handlers/scope-nav.ts(現在の行数確認), mcp-server/src/tools/phase-analytics.ts(現在の行数確認)
