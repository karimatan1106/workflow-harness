phase: ui_design
task: harness-template-reliability
taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff
status: complete
inputArtifact: docs/workflows/harness-template-reliability/planning.md

summary: FIX-1〜FIX-5に対応するMCPツールスキーマ、テンプレート出力形式、レスポンス構造のUI/UX設計。CLI/MCPインターフェースの変更仕様を定義する。

## decisions

- UID-001: harness_backのcascadeパラメータはoptional boolean(default: false)とし、inputSchema.requiredに含めない。既存の呼び出しがcascade未指定でも動作が変わらないことを保証する。根拠: PL-D07の後方互換性要件。defs-a.tsの現行required配列は['taskId','targetPhase','sessionToken']であり、cascadeを追加しない。

- UID-002: cascade=trueの成功レスポンスにcascadeReapproved文字列配列を追加し、再承認されたフェーズ名を返却する。cascade=falseまたは未指定時はこのフィールドを省略する。根拠: 呼び出し側が再承認結果を確認でき、省略時はレスポンスサイズを増やさない。

- UID-003: cascade再承認の前提条件未達時はcascadeFailed配列で失敗フェーズと理由を返却し、処理全体を即時中断する。部分的再承認は行わない。根拠: PL-D04の「前提条件未達時は即時中断」方針。中途半端な再承認は状態不整合を招く。

- UID-004: TOON_SKELETON_HEARINGのintent-analysisセクションにuserResponseキーを追加する配置位置は:assumptions行の直後とする。値の書式は「[AskUserQuestionの回答全文]」のプレースホルダ形式。根拠: intent-analysisの論理フローが「surfaceRequest→deepNeed→unclearPoints→assumptions→userResponse」と、抽象度の高い分析から具体的な回答データへ自然に遷移する。

- UID-005: testingテンプレートのbaseline_captureリマインドはタスク情報セクション直後、作業内容セクション直前に独立ブロックとして配置する。根拠: テンプレート冒頭のタスク情報に続く位置が最も視認性が高く、作業手順の中に埋もれない。subagentがテンプレートを上から順に処理するため、作業開始前にリマインドが到達する。

- UID-006: SUMMARY_SECTION_RULEのTOON形式ガイダンスにフィールド順序ルール(phase→status→summary→配列→decisions→artifacts→next)を明記する。根拠: PL-D06の方針に従い、hearingテンプレート以外でもTOON出力の一貫性を確保する。

- UID-007: FIX-5のcompleted滞留警告はadvice配列の既存パターンに統一し、日本語メッセージで「completedフェーズが{seconds}s滞留 (閾値: 3600s): {phase}」の形式とする。根拠: 既存adviceメッセージが全て日本語であり、フォーマットを統一する。秒数とフェーズ名を含めることで具体的な対処が可能になる。

## interface-specs

FIX-3: harness_back cascadeパラメータ

現行スキーマ(defs-a.ts 99-111行目):
  name: harness_back
  properties: taskId, targetPhase, reason, sessionToken
  required: [taskId, targetPhase, sessionToken]

追加パラメータ:
  cascade:
    type: boolean
    description: 対象範囲の承認ゲートを自動再承認する。未指定時はfalse。
    required: false
    default: false

成功レスポンス(cascade=false、現行互換):
  taskId: string (リクエスト元タスクID)
  previousPhase: string (back実行前のフェーズ名)
  targetPhase: string (back先のフェーズ名)
  rolledBack: true (単純back完了)
  reason: string (back理由テキスト)

成功レスポンス(cascade=true、再承認成功):
  taskId: string (cascade対象タスクID)
  previousPhase: string (cascade開始時のフェーズ)
  targetPhase: string (cascade完了後の遷移先フェーズ)
  rolledBack: true (cascade付きback完了)
  reason: string (cascade実行理由テキスト)
  cascadeReapproved: string[] (例: ["hearing", "requirements"])

失敗レスポンス(cascade=true、前提条件未達):
  taskId: string (cascade失敗時のタスクID)
  previousPhase: string (cascade中断時点のフェーズ)
  targetPhase: string (cascade中断により到達できなかったフェーズ)
  rolledBack: true (back自体は成功、cascade再承認が失敗)
  reason: string (cascade中断理由テキスト)
  cascadeFailed: { phase: string, reason: string }[]
  cascadeReapproved: string[] (中断前に成功したフェーズ、空配列の場合あり)

FIX-1: hearingテンプレート出力形式

TOON_SKELETON_HEARING追加キー:
  配置: :section intent-analysis内、:assumptions行の直後
  書式: :userResponse [AskUserQuestionの回答全文]

defs-stage0.ts hearingテンプレート追加指示:
  配置: 実行手順のステップ2内
  内容: AskUserQuestion呼び出し必須。選択肢は2個以上。回答はuserResponseキーに記録必須。

defs-stage0.ts SUMMARY_SECTION追加:
  配置: {ARTIFACT_QUALITY}の直前行
  書式: {SUMMARY_SECTION}

FIX-5: analytics advice警告形式

追加条件: phaseTimingsの各エントリについて、current===falseかつelapsed > 3600sのフェーズ
定数: COMPLETED_STALE_THRESHOLD_SEC = 3600
メッセージ: "completedフェーズが{seconds}s滞留 (閾値: 3600s): {phase}"
不正値ガード: Number.isFinite(seconds)がfalseの場合はスキップ

FIX-2: testingテンプレートbaseline_captureリマインド

配置: タスク情報セクション直後、「作業内容」見出し直前
文言:
  重要: harness_capture_baselineは実装変更前に必ず実行すること。
  テスト実行前にベースラインが未記録の場合、regression_testフェーズで比較基準が存在せず再実行が必要になる。

FIX-4: テンプレート出力形式統一指示

配置: SUMMARY_SECTION_RULE内、既存「ルール:」行の直後
追加内容: フィールド順序: phase→status→summary→配列セクション→decisions→artifacts→next。この順序はDoD L4チェックの走査順序と一致する。

## artifacts

- docs/workflows/harness-template-reliability/ui-design.md: FIX-1〜FIX-5のMCPツールスキーマ、テンプレート配置、レスポンス構造のUI/UX設計仕様

## next

- criticalDecisions: UID-001(cascade後方互換性)とUID-003(失敗時即時中断)がFIX-3実装の安全性を左右する。UID-004(userResponse配置位置)がhearing出力品質に直結する。
- readFiles: mcp-server/src/tools/defs-a.ts(cascade追加先), mcp-server/src/tools/handlers/scope-nav.ts(レスポンス実装先), mcp-server/src/phases/toon-skeletons-a.ts(userResponse追加先), mcp-server/src/phases/defs-stage0.ts(hearing指示追加先), mcp-server/src/phases/defs-stage5.ts(baseline_captureリマインド追加先), mcp-server/src/phases/definitions-shared.ts(フィールド順序追加先), mcp-server/src/tools/phase-analytics.ts(滞留検出追加先)
- warnings: FIX-3のcascadeReapprovedとcascadeFailedは同一レスポンスに共存する可能性がある(部分成功後に失敗した場合)。実装時はcascadeReapprovedを中断時点までの成功リストとして返却すること。
