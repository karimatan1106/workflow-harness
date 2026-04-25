# Planning: article-insights-harness-improvements

## overview

5改善項目(P3-P7)の実装計画。実装順序はP6→P3+P7→P4→P5。全5Workerに分解し、依存関係に基づく順序制御で共有ファイル競合を回避する。types-core.ts(198行)の発見によりP4のフラグ追加は1行厳守。P7(重複行除外フィルタ)はW3に同居(dod-helpers.ts共有)。

## file-capacity-baseline

| ファイル | 現在行数 | 残余 | 状態 |
|---------|---------|------|------|
| gates/dod-helpers.ts | 123 | 77 | OK |
| gates/dod-l4-content.ts | 86 | 114 | OK |
| gates/dod-l4-requirements.ts | 166 | 34 | CAUTION |
| tools/retry.ts | 198 | 2 | CRITICAL |
| tools/handlers/lifecycle-next.ts | 198 | 2 | CRITICAL |
| tools/handlers/approval.ts | 119 | 81 | OK |
| state/types-core.ts | 198 | 2 | CRITICAL |
| phases/defs-stage2.ts | 175 | 25 | CAUTION |

base-path: workflow-harness/mcp-server/src/

## implementation-order

| 順序 | 改善 | Worker | 根拠 |
|------|------|--------|------|
| Step-1 | P6(AC数変更) | W1, W2(並列) | 独立。他項目への前提条件なし |
| Step-2 | P3(AI slop) + P7(重複行除外) | W3 | dod-helpers.ts共有。dod-l4-content.tsへの先行変更 |
| Step-3 | P4(planning制約) | W4 | P3後にdod-l4-content.tsを変更 |
| Step-4 | P5(retry pivot) | W5 | 200行制限対応のため最後に慎重実施 |

## worker-1-p6-source

### task

P6ソースコード変更: MIN_ACCEPTANCE_CRITERIA定数定義+ソース7箇所+ガイダンス6箇所の更新

### files

| ファイル | 変更内容 | 行数影響 |
|---------|---------|---------|
| gates/dod-l4-requirements.ts | MIN_ACCEPTANCE_CRITERIA=5定数定義+export、L61判定、L64-65エビデンス/fix、L69エビデンス | +1行(定数追加) |
| tools/handlers/approval.ts | MIN_ACCEPTANCE_CRITERIAインポート、L57判定、L58メッセージ、L63閾値 | +1行(import追加) |
| phases/toon-skeletons-a.ts | L147: 最低3件→最低5件 | 行数変化なし |
| phases/defs-stage1.ts | L91: 最低3件→最低5件、L96: 最低3件→最低5件 | 行数変化なし |
| phases/phase-analytics.ts | L126: 最低3件→最低5件 | 行数変化なし |
| tools/retry.ts | L93: 正規表現"minimum 3"→"minimum 5"、L94: 最低3件→最低5件 | 行数変化なし |

### steps

1. dod-l4-requirements.tsにexport const MIN_ACCEPTANCE_CRITERIA = 5を追加(L1付近、import後)
2. dod-l4-requirements.ts内のリテラル"3"をMIN_ACCEPTANCE_CRITERIA参照に更新(L61判定)
3. dod-l4-requirements.ts内のメッセージ文字列を"5"に更新(L64, L65, L69)
4. approval.tsにMIN_ACCEPTANCE_CRITERIAのimport追加+リテラル"3"を定数参照に更新(L57, L58, L63)
5. ガイダンス4ファイル6箇所のメッセージ文字列を"3"→"5"に更新
6. 全ソースファイルでgrep "minimum 3"および"最低3件"で残存確認

### constraints

- dod-l4-requirements.ts(166行)+1行=167行: OK
- approval.ts(119行)+1行=120行: OK
- retry.ts(198行): メッセージ文字列変更のみ。行数増加なし

### ac-coverage

AC-16, AC-17, AC-18(ソース+ガイダンス部分), AC-20

## worker-2-p6-test

### task

P6テスト更新: 4テストファイル13箇所以上のacCount値とアサーション更新

### files

| ファイル | 変更箇所数 | 変更内容 |
|---------|-----------|---------|
| gates/dod-l4-requirements.test.ts | 9箇所 | 説明文、acCount値(2→4, 3→5)、アサーション、TOON内AC追加 |
| tools/handlers/handler-misc-ia2.test.ts | 2箇所 | コメント、エラーメッセージ |
| tools/handlers/handler-parallel.test.ts | 1箇所 | harness_add_ac呼び出し3回→5回 |
| tools/handlers/handler-approval.test.ts | 1箇所 | harness_add_ac呼び出し3回→5回 |

### steps

1. dod-l4-requirements.test.tsの境界値テスト更新: acCount=2→4(不合格境界)、acCount=3→5(合格境界)
2. dod-l4-requirements.test.tsのアサーション文字列を"minimum 5"に更新
3. handler-misc-ia2.test.tsのコメントとエラーメッセージを更新
4. handler-parallel.test.tsのharness_add_ac呼び出し回数を5回に増加
5. handler-approval.test.tsのharness_add_ac呼び出し回数を5回に増加
6. vitest実行で全テスト合格を確認

### dependencies

W1完了後に実行(定数定義がテストの前提)

### ac-coverage

AC-18(テスト部分), AC-19

## worker-3-p3-ai-slop

### task

P3+P7実装: checkAiSlopPatterns関数+isStructuralLine関数をdod-helpers.tsに追加、dod-l4-content.tsに呼び出し統合、テスト作成

### files

| ファイル | 変更内容 | 行数影響 |
|---------|---------|---------|
| gates/dod-helpers.ts | checkAiSlopPatterns関数追加(4カテゴリ正規表現) + isStructuralLine関数追加(コードフェンス/Mermaid構文/Markdownテーブルセパレータを重複行検出から除外) | +35-45行(→158-168行) |
| gates/dod-l4-content.ts | import追加+checkAiSlopPatterns呼び出し追加+重複行検出にisStructuralLineフィルタ統合 | +5行(→91行) |
| gates/dod-extended.test.ts | AI slopパターン検出テスト+isStructuralLineフィルタテスト追加 | +40-55行 |

### steps

1. dod-helpers.tsにAI_SLOP_PATTERNSカテゴリ定義(Record型、4カテゴリ各2-5パターン)を追加
2. checkAiSlopPatterns(content: string): string[]関数を実装
   - extractNonCodeLines(content)で非コード行抽出
   - 各カテゴリのパターンでcase-insensitiveマッチ
   - 同一カテゴリ2回以上出現時にstring[]で報告
3. dod-l4-content.tsにcheckAiSlopPatternsのimport追加
4. checkL4ContentValidation内、duplicatesチェック後(L62付近)に呼び出し追加
   - 戻り値が空でない場合: passed=trueを維持、evidenceに[WARN]プレフィックス付きで追加
5. [P7] dod-helpers.tsにisStructuralLine(line: string): boolean関数を追加
   - コードフェンス行(```)を検出して除外
   - Mermaid構文行(graph, subgraph, end, -->等)を検出して除外
   - Markdownテーブルセパレータ行(|---|等)を検出して除外
6. [P7] dod-l4-content.tsの重複行検出ロジックにisStructuralLineフィルタを統合
   - 重複行カウント前にisStructuralLine判定で構造的行を除外
7. dod-extended.test.tsにテスト追加
   - 4カテゴリ各1件のパターン検出テスト
   - 閾値境界テスト(1回=無視、2回=警告)
   - コードブロック内パターン非検出テスト
   - [P7] isStructuralLineフィルタテスト(コードフェンス/Mermaid/テーブルセパレータ除外確認)

### non-block-pattern

checkAiSlopPatternsの戻り値が空でない場合の処理:
- errors配列には追加しない(ブロックしない)
- evidenceに[WARN] AI slop detected: {category}({count} occurrences)を追加
- passed=trueを維持

### constraints

- dod-helpers.ts(123行)+45行=168行: OK(余裕32行、P3+P7合算)
- dod-l4-content.ts(86行)+5行=91行: OK(余裕109行、P3+P7合算)
- 正規表現パターンはcase-insensitiveフラグ(/i)使用
- extractNonCodeLines経由でコードブロック除外(AC-4)

### ac-coverage

AC-1, AC-2, AC-3, AC-4, AC-5, AC-21, AC-22, AC-23

## worker-4-p4-code-fence

### task

P4実装: PhaseConfigにnoCodeFencesフラグ追加、planning定義設定、dod-l4-content.tsにコードフェンス検出追加、テスト作成

### files

| ファイル | 変更内容 | 行数影響 |
|---------|---------|---------|
| state/types-core.ts | PhaseConfigにnoCodeFences?: boolean追加 | +1行(→199行) |
| phases/defs-stage2.ts | planning定義にnoCodeFences: true追加 | +1行(→176行) |
| gates/dod-l4-content.ts | noCodeFencesフラグ駆動のコードフェンス検出 | +10行(→99行) |
| 新規テストファイル | コードフェンス検出テスト | 20-30行 |

### steps

1. types-core.tsのPhaseConfigインターフェースにnoCodeFences?: boolean追加(既存プロパティの末尾に1行追加)
2. defs-stage2.tsのplanning定義オブジェクトにnoCodeFences: true追加
3. dod-l4-content.tsにCODE_FENCE_REGEX定義(/^`{3,}/m)追加
4. checkL4ContentValidation内(P3のAI slop呼び出し後)にnoCodeFencesチェック追加
   - phaseConfigからnoCodeFencesフラグ取得
   - trueの場合: 各ファイルについて拡張子が.mmdでなければCODE_FENCE_REGEXで検出
   - 検出時: passed=true維持、evidenceに[WARN] Code fence detected in planning artifactを追加
5. テスト作成: コードフェンス検出/非検出(.mmd除外)/インラインコード許容

### critical-constraint

types-core.ts(198行)+1行=199行。PhaseConfigへの追加は厳密に1行のみ。コメント行の追加は不可。

### dependencies

W3完了後に実行(dod-l4-content.tsの同一関数内に追記するため、P3の変更が先行する必要あり)

### ac-coverage

AC-6, AC-7, AC-8, AC-9, AC-10

## worker-5-p5-pivot

### task

P5実装: pivot-advisor.ts新規作成、lifecycle-next.tsへの最小統合、テスト作成

### files

| ファイル | 変更内容 | 行数影響 |
|---------|---------|---------|
| tools/pivot-advisor.ts | 新規作成(detectRepeatedPattern + generatePivotSuggestion) | 60-80行(新規) |
| tools/handlers/lifecycle-next.ts | import追加+buildDoDFailureResponse内で呼び出し | +2行(→200行) |
| tools/pivot-advisor.test.ts | 単体テスト新規作成 | 40-60行(新規) |

### steps

1. pivot-advisor.ts新規作成
   - RepeatResult型定義: { isRepeated: boolean, consecutiveCount: number, pattern: string }
   - detectRepeatedPattern(docsDir: string, currentPattern: string): RepeatResult
     - phase-errors.toonから直近エントリ読み取り(readErrorToon既存API使用)
     - extractErrorPattern()で80文字パターン正規化
     - 直近3件のパターンと現在パターンを比較
     - 3回連続一致でisRepeated=true
   - generatePivotSuggestion(errorClass: string, pattern: string, phase: string): string
     - errorClass別の方向転換提案テンプレート
     - L1/L3/L4エラー分類に応じた具体的提案文
   - buildPivotResponse(docsDir: string, currentPattern: string, errorClass: string, phase: string): string | null
     - detectRepeatedPattern + generatePivotSuggestion を統合
     - isRepeated=false時はnullを返す
     - lifecycle-next.tsからはこの関数のみ呼び出し
2. lifecycle-next.tsの変更(厳密に2行のみ)
   - import { buildPivotResponse } from '../pivot-advisor.js' (1行)
   - buildDoDFailureResponse内: const pivotMsg = buildPivotResponse(docsDir, pattern, errorClass, phase) (1行付近)
   - pivotMsgがnullでなければレスポンス文字列に追記(既存の文字列結合に組込み、行数増加を最小化)

### critical-constraint

lifecycle-next.ts(198行)+2行=200行。追加は厳密に2行。ロジックは全てpivot-advisor.tsに集約。buildPivotResponseが全判断ロジックを内包し、lifecycle-next.tsはその戻り値をレスポンスに追記するのみ。

### retry-ts-no-change

retry.ts(198行)への変更なし。RetryPromptResult型拡張は回避(IA-P5-2決定)。pivot情報はbuildDoDFailureResponseのレスポンス文字列に直接注入する方式を採用。

### safe-default

phase-errors.toon不在またはパース失敗時: isRepeated=false, consecutiveCount=0を返す。ワークフロー停止しない(SR-3)。

### dependencies

W1-W4と独立して実行可能。ただし実装順序としてはStep-4(最後)を推奨(200行境界値のため慎重に実施)。

### ac-coverage

AC-11, AC-12, AC-13, AC-14, AC-15

## dependency-graph

```
W1(P6-source) ──→ W2(P6-test)
                        ↓
W3(P3+P7) ──→ W4(P4-code-fence)

W5(P5-pivot) [独立、最後に実施]
```

execution-phases:
- Phase-A: W1(P6-source) + W3(P3-ai-slop + P7-重複行除外) を並列実行
- Phase-B: W2(P6-test) + W4(P4-code-fence) を並列実行(各々の前提Worker完了後)
- Phase-C: W5(P5-pivot) を単独実行

## risk-mitigations

| リスク | 脅威ID | 対策 |
|--------|--------|------|
| lifecycle-next.ts 200行超過 | T-010 | buildPivotResponse統合関数でlifecycle-next.tsの追加を2行に限定。実装後にwc -lで検証 |
| types-core.ts 199行到達 | 新規発見 | PhaseConfigへの追加は1行のみ。コメント追加不可。実装後にwc -lで検証 |
| retry.ts 200行維持 | T-011 | RetryPromptResult型拡張を回避。retry.tsへの変更はP6メッセージ更新(行数変化なし)のみ |
| P6の22箇所変更漏れ | T-012 | W1完了後にgrep残存チェック。AC-20で検証 |
| P3/P4のdod-l4-content.ts競合 | IA-5 | W3→W4の順序制御で回避 |
| Mermaid偽陽性 | T-005 | .mmdファイル除外ロジックで対応(AC-9) |

## verification-plan

| Worker | 検証方法 |
|--------|---------|
| W1 | grep "minimum 3"および"最低3件"で残存ゼロ確認 |
| W2 | vitest --run gates/dod-l4-requirements.test.ts + 関連handler tests |
| W3 | vitest --run gates/dod-extended.test.ts (P3 AI slop + P7 重複行除外フィルタ) |
| W4 | vitest --run 新規テストファイル |
| W5 | vitest --run tools/pivot-advisor.test.ts |
| 全体 | vitest --run で全テスト合格確認 + 全変更ファイルのwc -l ≤ 200確認 |

## decisions

- [PL-1][decision] types-core.tsが198行(要件記載171行から修正)。P4のnoCodeFencesフラグ追加は1行厳守
- [PL-2][decision] P5はRetryPromptResult型拡張を回避。retry.tsの行数増加ゼロ
- [PL-3][decision] P5のlifecycle-next.ts追加は2行。buildPivotResponse統合関数でロジックを集約
- [PL-4][decision] Phase-AでW1+W3(P3+P7)を並列実行し、Phase-BでW2+W4を並列実行。Phase-CでW5単独実行
- [PL-5][decision] 全CRITICALファイル(198行)は実装後にwc -lで200行以下を検証

## artifacts

- docs/workflows/article-insights-harness-improvements/planning.md: 本実装計画

## approval

status: approved
approver: user
date: 2026-03-28
notes: 5Worker分解計画をユーザーが承認。Phase-A(W1+W3(P3+P7)並列) → Phase-B(W2+W4並列) → Phase-C(W5単独)

## next

readyForImplementation: true
firstWorkers: "W1(P6-source) + W3(P3-ai-slop + P7-重複行除外) を並列起動"
criticalChecks: "types-core.ts 199行、lifecycle-next.ts 200行の行数検証を各Worker完了時に実施"
