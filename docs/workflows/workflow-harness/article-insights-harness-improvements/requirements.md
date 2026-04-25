# Requirements: article-insights-harness-improvements

## overview

Anthropic記事の知見から5つの改善をハーネスに追加する。(P3) AI slopパターンL4正規表現チェックで検出する。(P4) planningフェーズからコード例排除ルールを導入する。(P5) retryの改善として同一パターン失敗に対する方向転換判断ロジック(pivot)を追加する。(P6) AC数下限を3→5に引き上げる。(P7) L4重複行チェック(checkDuplicateLines)に構造パターン除外フィルタを追加し、コードフェンス行/Mermaid構文行/テーブル区切り行を重複カウントから除外する。各項目にAC 5個以上(合計23個)とRTM F-001〜F-009を策定。全改善はL1-L4決定的ゲートの枠内で実装し、ADR-001(L5禁止)を遵守する。

## P3: AI slopパターンL4検出

### 要件

- dod-helpers.tsにcheckAiSlopPatterns関数を追加する
- 初期4カテゴリの正規表現パターンを実装する
  - hedging: "it is important to note that", "it should be noted that"
  - empty_emphasis: delve, tapestry, seamless(ly), holistic(ally), robust
  - redundant_preamble: certainly/absolutely/of course/great question(行頭), "as an ai"
  - vague_connectors: "in today's digital/modern/fast-paced", "landscape of"
- 同一カテゴリのパターンが2回以上出現した場合に警告する
- 非ブロック動作: passed=true + evidenceに[WARN]プレフィックス付きで報告
- extractNonCodeLines経由でコードブロック内は検出対象外
- dod-l4-content.tsのcheckL4ContentValidation内、duplicatesチェック後に呼び出し統合

### AC

| ID | 条件 | RTM |
|----|------|-----|
| AC-1 | dod-helpers.tsにcheckAiSlopPatterns関数が存在し、hedging/empty_emphasis/redundant_preamble/vague_connectorsの4カテゴリを正規表現で検出する | F-001 |
| AC-2 | AI slopパターンが同一カテゴリで2回以上出現した場合、passed=trueかつevidenceに[WARN]プレフィックス付きで報告する(非ブロック動作) | F-002 |
| AC-3 | dod-l4-content.tsのcheckL4ContentValidation内でcheckAiSlopPatternsがduplicatesチェック後に呼び出される | F-003 |
| AC-4 | checkAiSlopPatternsはextractNonCodeLines経由で非コード行のみを対象とし、コードブロック内のパターンを検出しない | F-001 |
| AC-5 | AI slopパターンの検出テストが存在し、各4カテゴリの検出/非検出/閾値境界(1回=無視, 2回=警告)を検証する | F-001, F-002 |

### 変更ファイル

| ファイル | 変更種別 | 推定行数 |
|---------|---------|---------|
| dod-helpers.ts | 関数追加 | +20-30行 |
| dod-l4-content.ts | import追加+呼び出し追加 | +3行 |
| dod-extended.test.ts | テスト追加 | +30-40行 |

### 制約

- L4正規表現のみ使用。L5(LLM判断)は使用しない(ADR-001)
- 既存checkForbiddenPatternsと同一パイプライン構造(extractNonCodeLines -> パターン適用 -> string[]返却)
- dod-helpers.ts合計行数が200行以下であること(現在124行 + 推定30行 = 154行)

---

## P4: planningフェーズのコード例排除

### 要件

- PhaseConfig型(types-core.ts)にnoCodeFences?: booleanオプショナルフラグを追加する
- planningフェーズ定義(defs-stage2.ts)でnoCodeFences: trueを設定する
- dod-l4-content.tsでnoCodeFences=trueのフェーズに対し、CODE_FENCE_REGEX(/^`{3,}/m)でコードフェンスを検出する
- 検出時はpassed=true + [WARN]evidenceで非ブロック報告する
- .mmdファイル(Mermaid)はコードフェンス検出の対象外とする
- インラインコード(シングルバックティック)は検出対象外(CODE_FENCE_REGEXが行頭3+条件のため自然に除外)

### AC

| ID | 条件 | RTM |
|----|------|-----|
| AC-6 | PhaseConfig型(types-core.ts)にnoCodeFences?: booleanオプショナルフラグが追加される | F-004 |
| AC-7 | planningフェーズ定義(defs-stage2.ts)でnoCodeFences: trueが設定される | F-005 |
| AC-8 | dod-l4-content.tsでnoCodeFences=trueのフェーズに対しCODE_FENCE_REGEX(/^`{3,}/m)でコードフェンスを検出し、passed=true + [WARN]evidenceで報告する | F-005 |
| AC-9 | .mmdファイル(Mermaid)はコードフェンス検出の対象外となる | F-005 |
| AC-10 | planningフェーズのコードフェンス検出テストが存在し、検出/非検出(.mmd除外)/インラインコード許容を検証する | F-005 |

### 変更ファイル

| ファイル | 変更種別 | 推定行数 |
|---------|---------|---------|
| types-core.ts | フラグ追加 | +1行 |
| defs-stage2.ts | planning設定追加 | +1行 |
| dod-l4-content.ts | フラグ駆動のコードフェンス検出追加 | +10行 |
| workflow-phases.md | planningセクションに制約記述追加 | +3行 |
| 新規テストファイル | テスト追加 | +20-30行 |

### 制約

- noCodeFencesはオプショナルフラグ。他フェーズはデフォルトundefined(チェック無効)で破壊的変更なし
- dodChecks配列は引き続き空のまま。PhaseConfigフラグ経由でdod-l4-content.tsの共通処理に組込む
- ADR-004(Why/What/How 3層分離)の具体的適用: planningはWhatに限定しHowをimplementationに委ねる

---

## P5: retry pivot(同一パターン失敗時の方向転換)

### 要件

- pivot-advisor.tsを新規作成する(mcp-server/src/toolsディレクトリ)
- detectRepeatedPattern関数: phase-errors.toonから直近失敗パターンを読み取り、現在のエラーパターンと比較する
  - 戻り値: { isRepeated: boolean, consecutiveCount: number, pattern: string }
- generatePivotSuggestion関数: errorClass別の方向転換提案文字列を生成する
- 同一L4エラーパターンが3回連続で検出された場合に方向転換提案を生成する
- lifecycle-next.tsのbuildDoDFailureResponse内からpivot-advisor.tsを呼び出し、pivot情報をレスポンスに含める
- pivot呼び出しロジックをpivot-advisor.tsに集約し、lifecycle-next.tsからは1行のimport + 1行の関数呼び出しのみにする

### AC

| ID | 条件 | RTM |
|----|------|-----|
| AC-11 | pivot-advisor.tsが新規作成され、detectRepeatedPatternとgeneratePivotSuggestionの2関数をエクスポートする | F-006 |
| AC-12 | detectRepeatedPatternはphase-errors.toonから直近失敗パターンを読み取り、現在のエラーパターンと比較して{isRepeated, consecutiveCount, pattern}を返す | F-006 |
| AC-13 | 同一L4エラーパターンが3回連続で検出された場合、generatePivotSuggestionがerrorClass別の方向転換提案文字列を生成する | F-006 |
| AC-14 | lifecycle-next.tsのbuildDoDFailureResponse内からpivot-advisor.tsが呼び出され、pivot情報がレスポンスに含まれる | F-007 |
| AC-15 | pivot-advisor.tsの単体テストが存在し、パターン一致(3回連続)/不一致/閾値未満(2回)のシナリオを検証する | F-006 |

### 変更ファイル

| ファイル | 変更種別 | 推定行数 |
|---------|---------|---------|
| pivot-advisor.ts | 新規作成 | 60-80行 |
| lifecycle-next.ts | import+呼び出し追加 | +2行 |
| pivot-advisor.test.ts | テスト新規作成 | +40-60行 |

### 制約

- retry.ts(198行)に直接ロジック追加不可。pivot-advisor.tsに分離して責務分割する
- lifecycle-next.ts(198行)も200行境界値。pivot呼び出しはpivot-advisor.tsにロジック集約し、lifecycle-next.tsからは最小限(import 1行+呼び出し1行)にする
- phase-errors.toonは既存APIで安定利用可能。追加データストア不要
- extractErrorPattern()(reflector.ts)を利用してエラーパターンを80文字に正規化する

### リスク

- 200行制限: retry.ts(198行)+lifecycle-next.ts(198行)が境界値。実装時に行数監視が必要
- 行数超過時の対策: lifecycle-next.tsからのpivot呼び出しロジックをpivot-advisor.tsに集約するアーキテクチャで回避

---

## P6: AC最低数変更(3→5)

### 要件

- dod-l4-requirements.tsにMIN_ACCEPTANCE_CRITERIA = 5定数を定義しエクスポートする
- approval.tsがMIN_ACCEPTANCE_CRITERIAをインポートして使用する
- ソースコード7箇所のロジック/メッセージを更新する
  - dod-l4-requirements.ts: L61判定, L64-65エビデンス/fix文字列, L69エビデンス
  - approval.ts: L57判定, L58エラーメッセージ, L63閾値
- ガイダンス6箇所のメッセージ文字列を更新する
  - toon-skeletons-a.ts L147, defs-stage1.ts L91/L96, phase-analytics.ts L126, retry.ts L93/L94
- テスト9箇所以上のacCount値とアサーションを更新する
  - dod-l4-requirements.test.ts(9箇所), handler-misc-ia2.test.ts(2箇所), handler-parallel.test.ts(1箇所), handler-approval.test.ts(1箇所)

### AC

| ID | 条件 | RTM |
|----|------|-----|
| AC-16 | MIN_ACCEPTANCE_CRITERIA = 5定数がdod-l4-requirements.tsに定義され、エクスポートされる | F-008 |
| AC-17 | approval.tsがMIN_ACCEPTANCE_CRITERIAをdod-l4-requirements.tsからインポートして使用する | F-008 |
| AC-18 | ソース7箇所とガイダンス6箇所のリテラル"3"が全て値"5"または定数参照に更新される | F-008 |
| AC-19 | テスト9箇所以上のacCount値とアサーションが閾値5に対応するよう更新される | F-008 |
| AC-20 | ソースコード内にAC最低数に関するリテラル直書きの"3"が残存しない(定数またはメッセージ文字列内の"5"に統一) | F-008 |

### 変更ファイル

| ファイル | 変更種別 | 変更箇所数 |
|---------|---------|-----------|
| dod-l4-requirements.ts | 定数定義+ロジック更新 | 5箇所 |
| approval.ts | インポート追加+ロジック更新 | 3箇所 |
| toon-skeletons-a.ts | メッセージ更新 | 1箇所 |
| defs-stage1.ts | メッセージ更新 | 2箇所 |
| phase-analytics.ts | メッセージ更新 | 1箇所 |
| retry.ts | 正規表現+メッセージ更新 | 2箇所 |
| dod-l4-requirements.test.ts | テスト更新 | 9箇所 |
| handler-misc-ia2.test.ts | テスト更新 | 2箇所 |
| handler-parallel.test.ts | テスト更新 | 1箇所 |
| handler-approval.test.ts | テスト更新 | 1箇所 |

### 制約

- retry.ts L93の正規表現パターン内"minimum 3"は定数化では対応不可。個別の文字列更新が必要
- 変更パターンが均一(リテラル3→5)のため機械的一括更新で対応可能

---

## P7: 重複行除外フィルタ(構造パターン除外)

### 要件

- dod-helpers.tsのcheckDuplicateLines関数(またはその前処理)に構造パターン除外フィルタを追加する
- 除外対象の構造パターン3種を定義する
  - コードフェンス行: バッククォート3つ以上で始まる行(```で始まる行)
  - Mermaid構文行: graph, subgraph, end, -->等のMermaid固有キーワード行
  - Markdownテーブル区切り行: |---|パターンを含む行
- 除外パターンはL4正規表現で判定する
- 既存のcheckDuplicateLinesの動作を変更せず、フィルタを前段に追加する形で実装する

### AC

| ID | 条件 | RTM |
|----|------|-----|
| AC-21 | L4重複行チェック(checkDuplicateLines)がコードフェンス行(```で始まる行)を重複カウントから除外すること | F-009 |
| AC-22 | L4重複行チェックがMermaid構文行(graph, subgraph, end, -->等)を重複カウントから除外すること | F-009 |
| AC-23 | L4重複行チェックがMarkdownテーブル区切り行(|---|等)を重複カウントから除外すること | F-009 |

### 変更ファイル

| ファイル | 変更種別 | 推定行数 |
|---------|---------|---------|
| dod-helpers.ts | フィルタ関数追加 | +10-15行 |
| dod-extended.test.ts | テスト追加 | +20-30行 |

### 制約

- L4正規表現のみ使用。L5(LLM判断)は使用しない(ADR-001)
- 既存checkDuplicateLinesのインターフェースは変更しない
- dod-helpers.ts合計行数が200行以下であること

---

## acceptanceCriteria

| ID | 対象 | 条件 | RTM |
|----|------|------|-----|
| AC-1 | P3 | dod-helpers.tsにcheckAiSlopPatterns関数が存在し、hedging/empty_emphasis/redundant_preamble/vague_connectorsの4カテゴリを正規表現で検出する | F-001 |
| AC-2 | P3 | AI slopパターンが同一カテゴリで2回以上出現した場合、passed=trueかつevidenceに[WARN]プレフィックス付きで報告する(非ブロック動作) | F-002 |
| AC-3 | P3 | dod-l4-content.tsのcheckL4ContentValidation内でcheckAiSlopPatternsがduplicatesチェック後に呼び出される | F-003 |
| AC-4 | P3 | checkAiSlopPatternsはextractNonCodeLines経由で非コード行のみを対象とし、コードブロック内のパターンを検出しない | F-001 |
| AC-5 | P3 | AI slopパターンの検出テストが存在し、各4カテゴリの検出/非検出/閾値境界(1回=無視, 2回=警告)を検証する | F-001, F-002 |
| AC-6 | P4 | PhaseConfig型(types-core.ts)にnoCodeFences?: booleanオプショナルフラグが追加される | F-004 |
| AC-7 | P4 | planningフェーズ定義(defs-stage2.ts)でnoCodeFences: trueが設定される | F-005 |
| AC-8 | P4 | dod-l4-content.tsでnoCodeFences=trueのフェーズに対しCODE_FENCE_REGEX(/^`{3,}/m)でコードフェンスを検出し、passed=true + [WARN]evidenceで報告する | F-005 |
| AC-9 | P4 | .mmdファイル(Mermaid)はコードフェンス検出の対象外となる | F-005 |
| AC-10 | P4 | planningフェーズのコードフェンス検出テストが存在し、検出/非検出(.mmd除外)/インラインコード許容を検証する | F-005 |
| AC-11 | P5 | pivot-advisor.tsが新規作成され、detectRepeatedPatternとgeneratePivotSuggestionの2関数をエクスポートする | F-006 |
| AC-12 | P5 | detectRepeatedPatternはphase-errors.toonから直近失敗パターンを読み取り、現在のエラーパターンと比較して{isRepeated, consecutiveCount, pattern}を返す | F-006 |
| AC-13 | P5 | 同一L4エラーパターンが3回連続で検出された場合、generatePivotSuggestionがerrorClass別の方向転換提案文字列を生成する | F-006 |
| AC-14 | P5 | lifecycle-next.tsのbuildDoDFailureResponse内からpivot-advisor.tsが呼び出され、pivot情報がレスポンスに含まれる | F-007 |
| AC-15 | P5 | pivot-advisor.tsの単体テストが存在し、パターン一致(3回連続)/不一致/閾値未満(2回)のシナリオを検証する | F-006 |
| AC-16 | P6 | MIN_ACCEPTANCE_CRITERIA = 5定数がdod-l4-requirements.tsに定義され、エクスポートされる | F-008 |
| AC-17 | P6 | approval.tsがMIN_ACCEPTANCE_CRITERIAをdod-l4-requirements.tsからインポートして使用する | F-008 |
| AC-18 | P6 | ソース7箇所とガイダンス6箇所のリテラル"3"が全て値"5"または定数参照に更新される | F-008 |
| AC-19 | P6 | テスト9箇所以上のacCount値とアサーションが閾値5に対応するよう更新される | F-008 |
| AC-20 | P6 | ソースコード内にAC最低数に関するリテラル直書きの"3"が残存しない(定数またはメッセージ文字列内の"5"に統一) | F-008 |
| AC-21 | P7 | L4重複行チェック(checkDuplicateLines)がコードフェンス行(```で始まる行)を重複カウントから除外すること | F-009 |
| AC-22 | P7 | L4重複行チェックがMermaid構文行(graph, subgraph, end, -->等)を重複カウントから除外すること | F-009 |
| AC-23 | P7 | L4重複行チェックがMarkdownテーブル区切り行(|---|等)を重複カウントから除外すること | F-009 |

## 横断要件

### 実装順序

| 順序 | 改善 | 根拠 |
|------|------|------|
| Phase 1(並列可) | P6(AC数変更) | 独立。他項目への前提条件 |
| Phase 2(順序制御) | P3(AI slop) → P4(planning制約) | dod-l4-content.ts共有。P3先行 |
| Phase 3(独立) | P5(retry pivot) | 200行制限対応のため慎重に実施 |

### 共有ファイル競合マップ

| ファイル | 変更元 | 対策 |
|---------|--------|------|
| dod-l4-content.ts | P3, P4 | P3→P4の順序制御 |
| retry.ts | P5(型参照), P6(メッセージ) | 異なる箇所のため競合なし |

### 200行制限監視対象

| ファイル | 現在行数 | 追加見込 | 対策 |
|---------|---------|---------|------|
| dod-helpers.ts | 124 | +20-30 | 余裕あり |
| dod-l4-content.ts | 87 | +13 | 余裕あり |
| retry.ts | 198 | +0(メッセージ変更のみ) | 行数増加なし |
| lifecycle-next.ts | 198 | +2 | pivot呼出をpivot-advisor.tsに集約 |
| types-core.ts | 171 | +1 | 余裕あり |

## notInScope

- Playwright MCP統合
- few-shot calibration
- assumptionタグ(P1: 別タスク)
- code_review独立分離(P2: 別タスク)
- delegate-coordinator.tsの全面リファクタリング
- AI slopパターンのL5(LLM判断)検出

## openQuestions

## decisions

- [RQ-1][decision] AC最低5個を全改善項目に適用(P6のself-apply)。合計20個のACを策定
- [RQ-2][decision] RTM F-001〜F-008で全ACをトレース可能にする
- [RQ-3][decision] P3/P4の非ブロック動作はpassed=true + [WARN]evidenceパターンで統一
- [RQ-4][decision] P5はpivot-advisor.ts新規ファイルに分離(retry.ts 200行制限)
- [RQ-5][decision] P6はMIN_ACCEPTANCE_CRITERIA定数化でソース変更箇所を集約
- [RQ-6][dependency] 実装順序: P6 -> P3 -> P4 -> P5

## RTM

| ID | 要件 | AC | コード | テスト |
|----|------|----|--------|--------|
| F-001 | AC-1, AC-4, AC-5: P3 checkAiSlopPatterns関数実装(L4正規表現チェック) | AC-1, AC-4, AC-5 | dod-helpers.ts | dod-extended.test.ts |
| F-002 | AC-2, AC-5: P3 非ブロック警告動作([WARN]evidence) | AC-2, AC-5 | dod-helpers.ts, dod-l4-content.ts | dod-extended.test.ts |
| F-003 | AC-3: P3 dod-l4-content.ts呼び出し統合 | AC-3 | dod-l4-content.ts | dod-extended.test.ts |
| F-004 | AC-6: P4 noCodeFencesフラグ型拡張 | AC-6 | types-core.ts | - |
| F-005 | AC-7, AC-8, AC-9, AC-10: P4 planningコードフェンス検出(コード例排除ルール) | AC-7, AC-8, AC-9, AC-10 | defs-stage2.ts, dod-l4-content.ts | 新規テスト |
| F-006 | AC-11, AC-12, AC-13, AC-15: P5 pivot-advisor.ts新規作成 | AC-11, AC-12, AC-13, AC-15 | pivot-advisor.ts | pivot-advisor.test.ts |
| F-007 | AC-14: P5 lifecycle-next.ts統合 | AC-14 | lifecycle-next.ts | pivot-advisor.test.ts |
| F-008 | AC-16, AC-17, AC-18, AC-19, AC-20: P6 MIN_ACCEPTANCE_CRITERIA定数化+全22箇所更新 | AC-16, AC-17, AC-18, AC-19, AC-20 | dod-l4-requirements.ts, approval.ts他 | 4テストファイル |
| F-009 | AC-21, AC-22, AC-23: P7 構造パターン除外フィルタ(checkDuplicateLines) | AC-21, AC-22, AC-23 | dod-helpers.ts | dod-extended.test.ts |

## artifacts

- docs/workflows/article-insights-harness-improvements/requirements.md: 本要件定義

## next

readyForPlanning: true
planningFocus: "P3 AI slopパターンの詳細正規表現設計、P5 pivot-advisor.tsの関数シグネチャ詳細化、P3→P4のdod-l4-content.ts変更計画"
warnings: "P5のlifecycle-next.ts(198行)は200行境界値。planning段階で行数見積りを確定すること"
