phase: manual_test
status: complete
summary: FIX-1~FIX-5の実装を対象ソースコードの目視検証により全5シナリオPASS確認

## MT-S01: userResponse key placement in TOON skeleton

purpose: FIX-1 hearingスケルトンにuserResponseキーが存在し、AskUserQuestion回答をTOONに記録できること
file: mcp-server/src/phases/toon-skeletons-a.ts
line: 164

steps:
1. toon-skeletons-a.ts の TOON_SKELETON_HEARING を確認する
2. intent-analysisセクション内に :userResponse キーが存在するか確認する
3. キーの位置が :assumptions の直後にあるか確認する

expected: intent-analysisセクション内に `:userResponse [AskUserQuestionの回答全文]` が行164に存在する
actual: 行164に `:userResponse [AskUserQuestionの回答全文]` が存在し、:assumptions の直後かつ :end intent-analysis の直前に配置されている
result: PASS (userResponseキーがintent-analysisセクションの適切な位置に配置済み)

## MT-S02: AskUserQuestion mandatory instruction with 2+ options

purpose: FIX-1 hearingテンプレートにAskUserQuestion必須指示と選択肢2個以上の制約が明記されていること
file: mcp-server/src/phases/defs-stage0.ts
lines: 23-27

steps:
1. defs-stage0.ts の hearing.subagentTemplate を確認する
2. AskUserQuestion呼び出しが必須と明記されているか確認する
3. 選択肢2個以上の制約が記載されているか確認する
4. 推奨選択肢の明示ルール(Recommended)が含まれるか確認する

expected: テンプレートに「AskUserQuestion呼び出しは必須。選択肢は2個以上提示すること。」が含まれる
actual: 行24に「AskUserQuestion呼び出しは必須。選択肢は2個以上提示すること。」、行26に「技術的判断が必要な場合は推奨を(Recommended)で明示」が存在する
result: PASS (AskUserQuestion必須制約と選択肢数の下限が明記されている)

## MT-S03: baseline_capture reminder visibility in testing template

purpose: FIX-2 testingフェーズテンプレートにbaseline_capture実行タイミングの注意書きが含まれること
file: mcp-server/src/phases/defs-stage5.ts
lines: 23-24

steps:
1. defs-stage5.ts の testing.subagentTemplate を確認する
2. harness_capture_baselineの実行タイミングに関する注意文が存在するか確認する
3. 注意文がテンプレートの早い段階(作業内容の前)に配置されているか確認する

expected: 「harness_capture_baselineは実装変更前に必ず実行すること」という注意書きがテンプレート上部に存在する
actual: 行23に「重要: harness_capture_baselineは実装変更前に必ず実行すること。」、行24に未記録時の影響説明が存在し、作業内容セクションより前に配置されている
result: PASS (baselineキャプチャのタイミング警告がテンプレート上部に適切に配置済み)

## MT-S04: cascade parameter in harness_back schema

purpose: FIX-3 harness_backスキーマにcascadeパラメータが定義され、かつrequiredに含まれていないこと
files: mcp-server/src/tools/defs-a.ts (schema), mcp-server/src/tools/handlers/scope-nav.ts (logic)
lines: defs-a.ts 99-111, scope-nav.ts 82-117

steps:
1. defs-a.ts の harness_back inputSchema を確認する
2. cascade プロパティが type: boolean で定義されているか確認する
3. required 配列に cascade が含まれていないことを確認する
4. scope-nav.ts の handleHarnessBack で cascade パラメータが処理されているか確認する
5. cascade=true 時に承認ゲートの再承認ロジックが実装されているか確認する

expected: cascade は optional boolean パラメータとして定義され、handleHarnessBack内でBoolean(args.cascade ?? false)としてデフォルトfalseで処理される
actual: defs-a.ts 行108に `cascade: { type: 'boolean', description: 'Re-approve intermediate approval gates.' }` が定義され、行110の required は `['taskId', 'targetPhase', 'sessionToken']` のみ。scope-nav.ts 行86で `const cascade = Boolean(args.cascade ?? false)` としてデフォルトfalse処理、行97-116でcascade時の承認削除ロジックが実装されている
result: PASS (cascadeパラメータがoptional booleanとして正しく定義・実装されている)

## MT-S05: completed phase stale detection threshold and logic

purpose: FIX-5 completedフェーズの滞留検出が閾値ベースで実装されていること
file: mcp-server/src/tools/phase-analytics.ts
lines: 115, 146-149

steps:
1. phase-analytics.ts の COMPLETED_STALE_THRESHOLD_SEC 定数を確認する
2. 閾値が3600秒(1時間)に設定されているか確認する
3. generateAdvice関数内でcompletedフェーズの滞留検出ロジックを確認する
4. 閾値超過時のアドバイスメッセージに閾値情報が含まれるか確認する

expected: COMPLETED_STALE_THRESHOLD_SEC = 3600 が定義され、completedフェーズのseconds > 閾値の場合にアドバイスが生成される
actual: 行115に `const COMPLETED_STALE_THRESHOLD_SEC = 3600` が定義。行146-149で `phase === 'completed' && sec > COMPLETED_STALE_THRESHOLD_SEC` の条件分岐があり、超過時に `completedフェーズが${sec}s滞留 (閾値: ${COMPLETED_STALE_THRESHOLD_SEC}s)` のアドバイスが生成される
result: PASS (completedフェーズの滞留検出が閾値3600sで正しく実装されている)

## MT-S06: SUMMARY_SECTION field order specification

purpose: FIX-4 TOON出力のフィールド順序がSUMMARY_SECTION_RULEに明記されていること
file: mcp-server/src/phases/definitions-shared.ts
line: 45

steps:
1. definitions-shared.ts の SUMMARY_SECTION_RULE を確認する
2. フィールド順序の指示が明記されているか確認する
3. 順序が phase→status→summary→配列セクション→decisions→artifacts→next であるか確認する

expected: SUMMARY_SECTION_RULE内に「フィールド順序: phase→status→summary→配列セクション→decisions→artifacts→next」が含まれる
actual: 行45に「フィールド順序: phase→status→summary→配列セクション→decisions→artifacts→next」が明記されており、TOON出力時のキー配置順序がサブエージェントに伝達される
result: PASS (フィールド順序ルールがテンプレートフラグメントに明記されている)

## decisions

- MT-S01: userResponseキーはtoon-skeletons-a.ts行164のintent-analysisセクション内に正しく配置されている
- MT-S02: AskUserQuestion必須指示はdefs-stage0.ts行24に2個以上選択肢制約と共に明記されている
- MT-S03: baseline_captureリマインダーはdefs-stage5.ts行23-24でテンプレート上部の目立つ位置に配置されている
- MT-S04: cascadeパラメータはdefs-a.ts行108でoptional booleanとして定義されrequiredに含まれていない
- MT-S05: stale検出閾値はphase-analytics.ts行115で3600秒に設定され行146-149で条件分岐が実装されている
- MT-S06: フィールド順序はdefinitions-shared.ts行45でphase→status→summary→配列→decisions→artifacts→nextと明記されている

## artifacts

- docs/workflows/harness-template-reliability/manual-test.md, report, FIX-1~FIX-5の手動検証結果6シナリオ全PASS

## next

criticalDecisions: 全6シナリオPASS。FIX-1~FIX-5の実装が設計意図通りであることを目視確認済み。
readFiles: manual-test.md
warnings: なし
