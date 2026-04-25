# UI Design: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: ui_design
scope: 内部MCP API変更のみ。ユーザー向けUI変更なし。

## P1: checkTDDRedEvidence 戻り値変更

対象: gates/dod-l1-l2.ts checkTDDRedEvidence(state: TaskState, phase: string): DoDCheckResult

- 現在の挙動: test_impl以外は passed:true で即返却。test_impl では proofLog のみを検査。
- 変更後の挙動: test_impl かつ scopeFiles が全て .md/.mmd の場合、proofLog 検査をスキップし passed:true で即返却する。

変更する戻り値パターン(DoDCheckResult):
- 条件: phase === 'test_impl' かつ scopeFiles.length > 0 かつ scopeFiles の全要素が .md または .mmd で終わる
- level: 'L2'
- check: 'tdd_red_evidence'
- passed: true
- evidence: 免除理由を含む文字列。scopeFiles の拡張子一覧を含めてデバッグ容易性を確保する。
- fix: 不要(passed:true のため省略)

既存の3つの戻り値パターンは変更しない:
- phase !== 'test_impl' の場合: そのまま維持
- proofLog が空の場合: そのまま維持(scopeFiles にコードファイルがある場合はここに到達)
- proofLog に Red 証拠がある/ない場合: そのまま維持

scopeFiles が空配列の場合の扱い:
- 免除判定に入らず、既存ロジックに委譲する(requirements D-004)
- 空配列は「スコープ未設定」を意味し、拡張子判定が不可能であるため安全側に倒す

判定に使用する拡張子定数:
- DOC_ONLY_EXTENSIONS = ['.md', '.mmd'] を関数スコープまたはモジュールスコープで定義
- 将来の拡張は配列への要素追加で対応可能

ロジック挿入位置:
- phase !== 'test_impl' チェック(L77)の直後、proofLog フィルタ(L80)の直前
- 条件: scopeFiles.length > 0 かつ every() で全ファイルが DOC_ONLY_EXTENSIONS に該当

## P2: ARTIFACT_QUALITY_RULES 文字列定数変更

対象: phases/definitions-shared.ts ARTIFACT_QUALITY_RULES (export const)

- 現在の内容(3行):
  - セクション実質行>=5、密度>=30%、同一行3回以上繰り返し禁止
  - 禁止語リスト
  - bracket-placeholder形式禁止
- 変更: 1行追記して4行にする
- 追記内容: 全行ユニーク制約を明示する行を追加
- 追記文言: 「同一内容の行は2回まで(3回以上の重複でDoD不合格)」に相当する表現
- 追記位置: 既存の1行目(セクション実質行>=5の行)の直後、または末尾
- checkDuplicateLines の閾値(3回以上)と数値を一致させる

この変更は純粋な文字列追記であり:
- 型やインターフェースの変更なし
- エクスポートの変更なし
- 他モジュールの import に影響なし
- テンプレートフラグメントとして各フェーズ定義に自動伝播する

## 影響範囲

P1 が影響するモジュール:
- dod-l1-l2.ts: checkTDDRedEvidence に分岐追加(直接変更)
- dod-tdd.test.ts: 新規テストケース追加が必要(scopeFiles ドキュメントのみの場合)
- dod-test-helpers.ts の makeMinimalState: scopeFiles フィールドのデフォルトは空配列で変更不要

P2 が影響するモジュール:
- definitions-shared.ts: ARTIFACT_QUALITY_RULES に1行追記(直接変更)
- handler-templates-validation.test.ts: テンプレート文字列を検証するテストが存在する場合は確認が必要

影響しないモジュール:
- dod-types.ts: DoDCheckResult インターフェースに変更なし。既存フィールド(level, check, passed, evidence, fix, example)で十分
- types.ts / types-core.ts: TaskState.scopeFiles の型は string[] のまま変更なし
- manager-write.ts / manager.ts: タスク生成・更新ロジックに変更なし

## decisions

- D-001: DoDCheckResult インターフェースにフィールドを追加しない。既存の evidence: string に免除理由を含めることで十分であり、型変更による影響範囲拡大を回避する。
- D-002: DOC_ONLY_EXTENSIONS 定数をモジュールスコープの配列として定義する。関数内リテラルでは将来の拡張時に修正箇所が増えるため、定数として外出しする。
- D-003: scopeFiles の拡張子判定は path.extname ではなく endsWith で実装する。dod-l1-l2.ts は現在 path モジュールを import しておらず、endsWith で十分な精度が得られるため、不要な import 追加を避ける。
- D-004: ARTIFACT_QUALITY_RULES の追記行は既存1行目の「同一行3回以上繰り返し禁止」と相補的な表現にする。1行目は構造的繰り返し(連続)、追記行は全体での重複(非連続含む)を対象とし、subagent が両方の制約を区別できるようにする。
- D-005: P1 の免除条件は strict equality(全ファイルがドキュメント拡張子)とする。1つでもコードファイルが含まれていれば免除しない。mixed スコープでの誤免除を防止するため。
- D-006: evidence 文字列にはスコープ内の拡張子一覧を列挙する。例: "Document-only scope exemption: extensions=[.md, .mmd]"。proofLog 解析時にどの拡張子で免除判定されたかを追跡可能にする。
- D-007: テストケース追加は以下の3パターンを網羅する。(a) scopeFiles が .md のみ -> passed:true, (b) scopeFiles が .md と .ts の混合 -> 既存ロジック適用, (c) scopeFiles が空配列 -> 既存ロジック適用。

## artifacts

- docs/workflows/harness-reporting-fixes/ui-design.md: spec: 内部MCP API変更仕様(P1: checkTDDRedEvidence免除ロジック、P2: ARTIFACT_QUALITY_RULES追記)

## next

- test_design フェーズでテストケース設計を実施する
- P1: scopeFiles ドキュメントのみ/混合/空配列の3パターンのテストケース
- P2: ARTIFACT_QUALITY_RULES 文字列に全行ユニーク制約が含まれることの検証
- 既存テスト全件パスの回帰確認
