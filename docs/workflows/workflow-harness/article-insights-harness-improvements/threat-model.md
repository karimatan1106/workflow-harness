# 脅威モデル: article-insights-harness-improvements

## 対象システム

workflow-harnessの4改善項目(P3-P6)に対する脅威分析。対象はCLIツール内のDoD検証・リトライ・承認フローであり、外部ネットワーク通信はない。STRIDEのうちSpoofing/Repudiation/InformationDisclosure/DoSは対象外。Tampering(検証ロジックの誤動作)とElevationOfPrivilege(フェーズ制約の迂回)に焦点を当てる。

## 脅威分析

### P3: AI slopパターンL4検出

| ID | 脅威 | 影響度 | 発生可能性 | 対策 |
|----|------|--------|-----------|------|
| T-001 | 偽陽性: 正当な成果物がAI slopとして誤検出される。技術文書で"robust"や"seamless"が適切に使用されるケースがある | 中 | 中 | 非ブロック動作(passed=true + [WARN])により偽陽性でもワークフロー停止しない。同一カテゴリ2回以上の閾値で単発使用は許容 |
| T-002 | パターン不足: 初期4カテゴリ(hedging/empty_emphasis/redundant_preamble/vague_connectors)でカバーできないAI slopパターンが存在する | 低 | 高 | 4カテゴリは記事で実証済みの高頻出パターン。パターン追加はcheckAiSlopPatternsの配列拡張のみで対応可能な設計。初期リリース後にevidenceログから未検出パターンを収集して拡張する |
| T-003 | 警告無視: 非ブロック動作のため[WARN]が出力されても改善されないリスク | 低 | 高 | 設計上の意図的トレードオフ。ブロックすると偽陽性時にワークフロー停止の害が大きい。evidenceログに蓄積されるため、将来的にパターン精度が十分になった時点でブロック動作への昇格を検討可能 |
| T-004 | extractNonCodeLines障害: コードブロック判定の不具合によりコード内パターンを誤検出する | 低 | 低 | extractNonCodeLinesは既存checkForbiddenPatternsで実績あり。AC-4でコードブロック除外を明示的にテスト検証する |

### P4: planningフェーズのコード例排除

| ID | 脅威 | 影響度 | 発生可能性 | 対策 |
|----|------|--------|-----------|------|
| T-005 | Mermaid偽陽性: planningでMermaidダイアグラム(```mermaid)を直接記述した場合、コードフェンスとして誤検出される | 中 | 中 | .mmdファイルはCODE_FENCE_REGEX検出の対象外(AC-9)。Mermaidは.mmdファイルに分離する運用ルールで回避。planning成果物の.md内にMermaidを直接記述するケースが偽陽性となるが、非ブロック動作のためワークフロー停止はしない |
| T-006 | 過剰制約: 正当なコード参照(関数名やファイルパスの記述)まで排除してしまうリスク | 低 | 低 | CODE_FENCE_REGEX(/^`{3,}/m)は行頭バックティック3個以上のみ検出。インラインコード(シングルバックティック)は検出対象外。関数名やファイルパスのインライン記述は影響を受けない |
| T-007 | noCodeFencesフラグの意図しない伝播: 他フェーズにnoCodeFences=trueが誤設定される | 低 | 低 | オプショナルフラグ(デフォルトundefined=チェック無効)のため、明示的にtrueを設定しない限り他フェーズに影響なし。planningフェーズのみdefs-stage2.tsで設定(AC-7) |

### P5: retry pivot(同一パターン失敗時の方向転換)

| ID | 脅威 | 影響度 | 発生可能性 | 対策 |
|----|------|--------|-----------|------|
| T-008 | 誤判定: 同一パターンの誤分類により不要な方向転換が提案される。extractErrorPattern()の80文字正規化で異なるエラーが同一パターンに丸められる | 高 | 中 | extractErrorPattern()は既存reflector.tsで実績あり。3回連続閾値(AC-13)により単発の偶然一致では発動しない。pivot提案は方向転換の"提案"であり強制ではないため、誤判定時もLLMが判断して無視できる |
| T-009 | phase-errors.toonデータ品質依存: phase-errors.toonが破損・不完全な場合にdetectRepeatedPatternが誤動作する | 中 | 低 | phase-errors.toonは既存readErrorToon関数で安定読み取り可能(IA-P5-3)。ファイル不在時はisRepeated=falseを返すフォールバック設計。パース失敗時も同様にsafe-default動作 |
| T-010 | 200行制限超過: lifecycle-next.ts(198行)にpivot呼び出しを追加すると200行を超過する | 高 | 高 | pivot呼び出しロジックをpivot-advisor.tsに集約し、lifecycle-next.tsからは1行import + 1行関数呼び出しのみ(IA-P5-5)。実装時に行数を監視し、超過時はlifecycle-next.ts内の既存コードをヘルパーに抽出して行数を確保する |
| T-011 | retry.ts(198行)の型拡張による超過: RetryPromptResult型にpivotフィールドを追加すると200行を超過する | 中 | 中 | IA-P5-2の分析結果に従い、RetryPromptResult型拡張を回避。pivot情報はbuildDoDFailureResponseのレスポンスに直接注入する方式を採用。retry.tsの行数増加をゼロにする |

### P6: AC最低数変更(3→5)

| ID | 脅威 | 影響度 | 発生可能性 | 対策 |
|----|------|--------|-----------|------|
| T-012 | 22箇所変更の漏れ: 機械的置換で一部の箇所が更新漏れとなり、ソース内に旧値"3"が残存する | 高 | 中 | AC-20で「リテラル直書きの"3"が残存しない」ことを明示的に検証。定数MIN_ACCEPTANCE_CRITERIAの導入(AC-16)でロジック箇所は定数参照に統一。メッセージ文字列とテストは個別更新が必要だが、変更箇所リストが要件で網羅的に列挙済み |
| T-013 | 既存テスト13件への影響: acCount閾値変更によりテストが失敗する。テスト更新漏れで偽のテスト失敗が発生する | 中 | 中 | テスト更新箇所は要件で特定済み(dod-l4-requirements.test.ts 9箇所, handler-misc-ia2.test.ts 2箇所, handler-parallel.test.ts 1箇所, handler-approval.test.ts 1箇所)。buildValidRequirementsToonヘルパー経由でacCountを5に変更するだけで大半のテスト更新が完了(IA-P6-3) |
| T-014 | retry.ts正規表現の特殊対応漏れ: L93の"minimum 3"は定数化では対応できず個別更新が必要。この特殊箇所を見落とすリスク | 中 | 中 | 要件(IA-P6-4)で明示的に識別済み。AC-18の検証対象に含まれる。実装時にretry.ts L93を個別確認するチェック項目として管理する |
| T-015 | 進行中タスクへの影響: AC最低数が3→5に変更された後、既存の進行中タスク(AC3個で定義済み)がDoD検証で失敗する | 低 | 低 | 新セッション開始時に新閾値が適用される。requirements_definitionフェーズでACを追加登録すれば対応可能(IA-P6-1)。進行中タスクは現在のセッション内では旧閾値が維持される |

## 脅威分析(STRIDE対象外の理由)

| カテゴリ | 対象外理由 |
|---------|-----------|
| Spoofing | CLIツール内部処理。外部認証なし |
| Repudiation | ローカルファイルシステム操作。監査要件なし |
| Information Disclosure | 機密データの取扱いなし。全データはローカルファイル |
| Denial of Service | シングルユーザーCLI。可用性要件なし |

## リスク優先度マトリクス

| 優先度 | ID | 脅威 | 影響度 | 発生可能性 |
|--------|-----|------|--------|-----------|
| 1 | T-010 | lifecycle-next.ts 200行超過 | 高 | 高 |
| 2 | T-008 | pivot誤判定による不要な方向転換提案 | 高 | 中 |
| 3 | T-012 | 22箇所変更の更新漏れ | 高 | 中 |
| 4 | T-011 | retry.ts 200行超過 | 中 | 中 |
| 5 | T-005 | Mermaid偽陽性 | 中 | 中 |
| 6 | T-013 | テスト13件の更新漏れ | 中 | 中 |
| 7 | T-014 | retry.ts正規表現の特殊対応漏れ | 中 | 中 |
| 8 | T-001 | AI slop偽陽性 | 中 | 中 |
| 9 | T-009 | phase-errors.toonデータ品質 | 中 | 低 |
| 10 | T-003 | 警告無視 | 低 | 高 |
| 11 | T-002 | パターン不足 | 低 | 高 |
| 12 | T-015 | 進行中タスクへの影響 | 低 | 低 |
| 13 | T-004 | extractNonCodeLines障害 | 低 | 低 |
| 14 | T-006 | 過剰制約 | 低 | 低 |
| 15 | T-007 | noCodeFencesフラグ伝播 | 低 | 低 |

## 優先対応事項

1. T-010/T-011: 200行制限超過はビルド破壊に直結する。pivot-advisor.tsへのロジック集約設計をplanning段階で確定し、行数見積りを実施する
2. T-008: pivot誤判定は3回連続閾値と提案(非強制)動作で緩和済みだが、extractErrorPattern()の正規化精度をテストで検証する
3. T-012: 22箇所の変更漏れはAC-20のリテラル残存チェックで防止。実装時にgrep "minimum 3"等で残存確認する

## セキュリティ要件

- SR-1: 全L4検出は正規表現(L4決定的ゲート)のみ使用。L5(LLM判断)は使用しない(ADR-001準拠)
- SR-2: 非ブロック動作([WARN])は偽陽性リスクのある検出(P3/P4)に限定。ブロック動作はデータ整合性に関わる検出(P6)に適用
- SR-3: phase-errors.toonの読み取り失敗時はsafe-default(isRepeated=false)を返す。障害時にワークフローを停止させない
- SR-4: 200行制限は責務分割の指標。超過時はロジック抽出で対応し、制限緩和はしない

## decisions

- [TM-1][decision] STRIDEのうちTampering/ElevationOfPrivilegeのみ分析対象。CLIツールのため他4カテゴリは対象外
- [TM-2][decision] 最高リスクはT-010(lifecycle-next.ts 200行超過)。planning段階での行数確定が必須
- [TM-3][decision] P3/P4の非ブロック動作は偽陽性リスクへの意図的トレードオフとして許容
- [TM-4][decision] P5のphase-errors.toon障害時はsafe-default動作を採用
- [TM-5][decision] P6の22箇所変更漏れ防止はAC-20のリテラル残存チェックで担保

## artifacts

- docs/workflows/article-insights-harness-improvements/threat-model.md: 本脅威モデル

## next

readyForDesign: true
designFocus: "T-010(lifecycle-next.ts 200行超過)の行数確定、T-008(pivot誤判定)のextractErrorPattern精度検証、T-012(22箇所変更漏れ)の網羅性確認"
highRiskItems: "T-010, T-008, T-012が優先対応。planning段階で具体的な行数見積りと変更箇所チェックリストを作成すること"
