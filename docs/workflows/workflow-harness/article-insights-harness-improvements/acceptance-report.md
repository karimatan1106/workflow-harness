# Acceptance Report: article-insights-harness-improvements

phase: acceptance_verification
taskId: article-insights-harness-improvements
date: 2026-03-28
verdict: PASS (23/23 AC met)

## decisions

- AV-1: P3(AI slop検出)全5AC合格。checkAiSlopPatterns関数がdod-helpers.ts:79-98に実装され、5カテゴリ(hedging/empty_emphasis/redundant_preamble/vague_connectors/ai_buzzwords)をL4正規表現で検出。要件書の4カテゴリから5カテゴリへの拡張はパターン精度向上の合理的改善として許容。
- AV-2: P4(planningコードフェンス排除)全5AC合格。types-core.ts:171にnoCodeFences?:boolean追加、registry.ts:26のplanning定義にnoCodeFences:true設定、dod-l4-content.ts:67-81でCODE_FENCE_REGEX検出+.mmd除外を確認。
- AV-3: P5(pivot advisor)全5AC合格。pivot-advisor.ts(95行)にdetectRepeatedPattern+generatePivotSuggestionを実装。lifecycle-next.ts:28でimport、L173-174で呼出し統合。lifecycle-next.tsは198行で200行制限遵守。
- AV-4: P6(AC最低数3→5)全5AC合格。dod-l4-requirements.ts:11にMIN_ACCEPTANCE_CRITERIA=5定数定義。approval.ts:10でimport使用。ソース+ガイダンス+テスト全箇所で値5に統一済み。
- AV-5: P7(重複行除外フィルタ)全3AC合格。dod-helpers.ts:17-35のisStructuralLine関数がコードフェンス行(L21)、テーブル区切り行(L22-23)、Mermaid構文行(L28-30)を除外。checkDuplicateLinesが内部でisStructuralLineを使用。
- AV-6: 全ソースファイルが200行以下。dod-helpers.ts=152行、dod-l4-content.ts=107行、pivot-advisor.ts=95行、lifecycle-next.ts=198行、types-core.ts=199行。types-core.tsは境界値だが制限内。
- AV-7: テストファイルが全改善項目に対して存在。dod-extended.test.ts(P3/P7)、dod-code-fence.test.ts(P4)、pivot-advisor.test.ts(P5)、dod-l4-requirements.test.ts(P6)。

## acAchievementStatus

### P3: AI slopパターンL4検出

| AC | status | evidence |
|----|--------|----------|
| AC-1 | met | dod-helpers.ts:79-85にAI_SLOP_CATEGORIESオブジェクトが5カテゴリの正規表現を定義。L87-98にcheckAiSlopPatterns関数がexport |
| AC-2 | met | dod-l4-content.ts:64でslopWarningsを取得しerrorsには追加せず、L101で[WARN]プレフィックス付きevidenceとして付与。passed=trueを維持 |
| AC-3 | met | dod-l4-content.ts:64のcheckAiSlopPatterns呼出しはduplicatesチェック(L59-62)の後に配置 |
| AC-4 | met | dod-helpers.ts:88-89でextractNonCodeLines経由の非コード行のみを対象としている |
| AC-5 | met | dod-extended.test.ts:70-85にhedgingカテゴリの検出テスト(2回=警告)と閾値境界(1回=無視)テストが存在 |

### P4: planningフェーズのコード例排除

| AC | status | evidence |
|----|--------|----------|
| AC-6 | met | types-core.ts:171にnoCodeFences?: boolean追加済み |
| AC-7 | met | registry.ts:26のplanning定義にnoCodeFences: true設定済み |
| AC-8 | met | dod-l4-content.ts:67-81でconfig.noCodeFences=trueかつ非.mmdファイルにCODE_FENCE_REGEX(/^`{3,}/gm)適用。passed=true+[WARN]evidence報告 |
| AC-9 | met | dod-l4-content.ts:67のextname(outputFile) !== '.mmd'条件で.mmdファイルを検出対象外に |
| AC-10 | met | dod-code-fence.test.ts:79-132に検出/非検出(.mmd除外)/インラインコード許容のテスト4件存在 |

### P5: retry pivot(方向転換判断ロジック)

| AC | status | evidence |
|----|--------|----------|
| AC-11 | met | pivot-advisor.ts:35にdetectRepeatedPattern、L79にgeneratePivotSuggestionの2関数をexport |
| AC-12 | met | pivot-advisor.ts:35-43でErrorEntry[]から直近失敗パターンを読取り、cross-retry/consecutive検出で結果返却 |
| AC-13 | met | pivot-advisor.ts:60-72でstreak>=3の連続一致検出。generatePivotSuggestion(L79)がerrorClass別提案文字列を生成 |
| AC-14 | met | lifecycle-next.ts:28でimport、L173-174でdetectRepeatedPattern+generatePivotSuggestion呼出し。pivotSuggestionをレスポンスに含める |
| AC-15 | met | pivot-advisor.test.ts:15-163にパターン一致(3回連続)/不一致/閾値未満(2回)/cross-retry検出のテスト存在 |

### P6: AC最低数変更(3→5)

| AC | status | evidence |
|----|--------|----------|
| AC-16 | met | dod-l4-requirements.ts:11にexport const MIN_ACCEPTANCE_CRITERIA = 5定義済み |
| AC-17 | met | approval.ts:10でMIN_ACCEPTANCE_CRITERIAをdod-l4-requirements.tsからimportし、L58/L59/L64で使用 |
| AC-18 | met | toon-skeletons-a.ts、defs-stage1.ts、phase-analytics.tsの全ガイダンス箇所で旧値3→5に修正済み |
| AC-19 | met | dod-l4-requirements.test.ts:26-151に境界値テスト(acCount=4不合格/5合格)、定数確認、エラーメッセージ検証テスト存在 |
| AC-20 | met | MIN_ACCEPTANCE_CRITERIAのGrep結果で定数参照のみ(dod-l4-requirements.ts定義、approval.tsインポート、テスト、retry.ts)。リテラル直書き"3"残存なし |

### P7: 重複行除外フィルタ

| AC | status | evidence |
|----|--------|----------|
| AC-21 | met | dod-helpers.ts:21の/^`{3,}/.test(trimmed)でコードフェンス行を構造行として除外。dod-extended.test.ts:90-94でテスト検証 |
| AC-22 | met | dod-helpers.ts:28-30のMermaid構文キーワード(graph/subgraph/end/classDef等)+矢印行を構造行として除外。dod-extended.test.ts:96-101でテスト検証 |
| AC-23 | met | dod-helpers.ts:22-23のテーブルセパレータ行(/^\|[\s\-:|]+\|$/)+テーブル内容行を構造行として除外。dod-extended.test.ts:103-107でテスト検証 |

## artifacts

- workflow-harness/mcp-server/src/gates/dod-helpers.ts (152行): P3 checkAiSlopPatterns + P7 isStructuralLine
- workflow-harness/mcp-server/src/gates/dod-l4-content.ts (107行): P3/P4統合 AI slop + code fence検出
- workflow-harness/mcp-server/src/gates/dod-l4-requirements.ts: P6 MIN_ACCEPTANCE_CRITERIA=5定数
- workflow-harness/mcp-server/src/tools/handlers/approval.ts: P6 MIN_ACCEPTANCE_CRITERIA import使用
- workflow-harness/mcp-server/src/state/types-core.ts (199行): P4 noCodeFences?:boolean追加
- workflow-harness/mcp-server/src/phases/registry.ts: P4 planning noCodeFences:true設定
- workflow-harness/mcp-server/src/tools/handlers/pivot-advisor.ts (95行): P5 detectRepeatedPattern+generatePivotSuggestion
- workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts (198行): P5 pivot-advisor統合
- workflow-harness/mcp-server/src/__tests__/dod-extended.test.ts: P3/P7テスト
- workflow-harness/mcp-server/src/__tests__/dod-code-fence.test.ts: P4テスト
- workflow-harness/mcp-server/src/__tests__/pivot-advisor.test.ts: P5テスト
- workflow-harness/mcp-server/src/__tests__/dod-l4-requirements.test.ts: P6テスト

## next

criticalDecisions: types-core.ts(199行)は200行境界値。今後の変更には行数監視が必要。
readFiles: dod-helpers.ts, dod-l4-content.ts, pivot-advisor.ts, lifecycle-next.ts, types-core.ts
warnings: P3カテゴリ拡張(4→5)とP5配置変更(tools/→tools/handlers/)は要件書との乖離として記録済み。機能上の問題はなく許容。
