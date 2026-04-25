## サマリー

harness-reporting-fixes タスクの2件の修正対象を調査した。

P1: dod-l1-l2.ts の checkTDDRedEvidence 関数は scopeFiles の拡張子を一切検査していない。
scopeFiles は string[] 型で任意のパスが入るが、test_impl フェーズで .md や .json など
テストファイルでないものが scopeFiles に含まれている場合でも TDD Red 判定に影響しない。
現状の checkTDDRedEvidence は proofLog のみを参照しており、scopeFiles は参照していない。
つまり P1 の修正は「scopeFiles に .ts/.js/.tsx/.jsx 以外が含まれる場合の警告またはフィルタリング」
を checkTDDRedEvidence に追加する変更となる。

P2: definitions-shared.ts の ARTIFACT_QUALITY_RULES は現在3つの品質ルールを定義している。
- セクション実質行>=5、密度>=30%、同一行3回以上繰り返し禁止
- 禁止語リスト
- bracket-placeholder形式禁止
「全行ユニーク制約」は checkDuplicateLines (dod-helpers.ts) が L4 ゲートで既に実装済み
(3回以上の重複を検出)だが、ARTIFACT_QUALITY_RULES テンプレート文字列にはこの制約が
明示されていない。P2 の修正は ARTIFACT_QUALITY_RULES に全行ユニーク制約を追記して、
subagent がテンプレートから制約を認識できるようにする変更となる。

## ユーザー意図の分析

ユーザーの意図は「ハーネスのレポーティング品質を向上させる2件の修正」である。

P1 の意図: checkTDDRedEvidence は現在 proofLog だけを検査しているが、scopeFiles に
テストと無関係なファイル(設定ファイル、ドキュメント等)が含まれている場合にそれを
検出する手段がない。拡張子チェックを追加することで、スコープ内にテスト対象の
ソースコードファイルが存在することを確認し、TDD Red エビデンスの信頼性を高める。

P2 の意図: ARTIFACT_QUALITY_RULES はテンプレートとして subagent に渡される品質ルール
文字列である。checkDuplicateLines がバックエンドで全行ユニーク制約を検証しているが、
subagent がこの制約を認識していないため、重複行を含む成果物を生成してしまい DoD で
リジェクトされるケースがある。制約をテンプレートに明示することで事前回避を促す。

## 対象コード分析

P1 対象: workflow-harness/mcp-server/src/gates/dod-l1-l2.ts (167行)
- checkTDDRedEvidence 関数 (L76-96)
- 引数: state: TaskState, phase: string
- 現在の処理: phase が test_impl でなければスキップ、proofLog から test_impl の L2 エントリを
  フィルタし、result=false のエントリが1件以上あれば TDD Red エビデンスありと判定
- scopeFiles は state.scopeFiles (string[]) で参照可能だが現在未使用
- 拡張子チェック追加箇所: 関数冒頭の phase チェック後、proofLog チェック前に
  scopeFiles のソースコード拡張子存在確認を挿入

P2 対象: workflow-harness/mcp-server/src/phases/definitions-shared.ts (135行)
- ARTIFACT_QUALITY_RULES 定数 (L26-29)
- 現在の3行の品質ルール文字列に全行ユニーク制約を追記する
- バックエンド実装: dod-helpers.ts の checkDuplicateLines (L100-113) が
  非構造行の3回以上重複を検出済み
- ARTIFACT_QUALITY_RULES はテンプレートフラグメントとして各フェーズ定義から参照される

## 型・インターフェース確認

TaskState.scopeFiles: string[] (types.ts L81, types-core.ts L17)
- 必須フィールド、デフォルト値は空配列
- createTask 時に files 引数から設定 (manager-write.ts L66)
- updateScope で追加・上書き可能 (manager.ts L86-90)
- dod-l4-dci.ts, dod-spec.ts が既に scopeFiles を参照しているため、
  dod-l1-l2.ts からの参照追加はパターンとして一貫している

## テスト構造確認

既存テスト: dod-tdd.test.ts (79行)
- runDoDChecks 経由と checkTDDRedEvidence 直接呼び出しの両方を使用
- dod-test-helpers.ts の makeMinimalState で scopeFiles: [] がデフォルト
- P1 修正に対応するテストケース追加が必要:
  - scopeFiles にソースコード拡張子が含まれない場合の挙動
  - scopeFiles にソースコード拡張子が含まれる場合の挙動

既存テスト: dod-l4-duplicate.test.ts (81行)
- buildMdWithDuplicateRows で重複行生成
- P2 はテンプレート文字列の変更のみなので、既存テストへの影響はない

## decisions

- D-001: P1 の scopeFiles 拡張子チェックは warning レベルとし、passed を false にしない。scopeFiles 未設定(空配列)のタスクが多数存在し、hard fail にすると既存ワークフローが破壊される。
- D-002: チェック対象の拡張子は .ts, .tsx, .js, .jsx, .mts, .cts, .mjs, .cjs とする。TypeScript/JavaScript プロジェクトが主対象。将来の拡張は定数配列の追加で対応可能。
- D-003: P2 の ARTIFACT_QUALITY_RULES 追記は「全行ユニーク(同一内容の行は2回まで)」と明示する。checkDuplicateLines の閾値(3回以上で fail)と整合させ、subagent に具体的な数値で制約を伝える。
- D-004: P1 のチェック結果は evidence フィールドに拡張子情報を含めて返す。デバッグ容易性の確保。どのファイルがスコープに含まれているか可視化する。
- D-005: 両修正とも既存テストの pass/fail を変更しない(後方互換性維持)。warning 追加と文字列追記であり、既存の判定ロジックに影響を与えない設計とする。
- D-006: definitions-shared.ts の行数は追記後も135行+1行=136行で200行制限内に収まる。core-constraints の200行制限を遵守。

## artifacts

- docs/workflows/harness-reporting-fixes/research.md: spec: research フェーズ調査結果

## next

criticalDecisions: D-001(warning レベル), D-003(閾値整合)
readFiles: workflow-harness/mcp-server/src/gates/dod-l1-l2.ts, workflow-harness/mcp-server/src/phases/definitions-shared.ts, workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts
warnings: P1 は scopeFiles が空の場合のフォールバック処理が必須。hard fail を避けること。
