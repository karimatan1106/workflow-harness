phase: code_review
taskId: article-insights-harness-improvements
reviewer: external-perspective (SRB-1)
date: 2026-03-28

scope: P3(AI slop L4検出), P4(planning コードフェンス排除), P5(pivot advisor), P6(AC最低数3→5), P7(重複行除外フィルタ)

ac-status-table:
  AC-1, 合格, dod-helpers.ts:79-98 checkAiSlopPatterns関数が5カテゴリ(hedging/empty_emphasis/redundant_preamble/vague_connectors/ai_buzzwords)を正規表現で検出
  AC-2, 合格, dod-l4-content.ts:64+101 slopWarningsはerrorsに追加されずevidenceに[WARN]付与。passed=true維持
  AC-3, 合格, dod-l4-content.ts:64 checkAiSlopPatternsがduplicatesチェック(L59-62)の後(L64)で呼び出される
  AC-4, 合格, dod-helpers.ts:88-89 extractNonCodeLines経由でコードブロック除外済み
  AC-5, 合格, dod-extended.test.ts:70-85 hedgingカテゴリの検出テスト(2回=警告)+閾値境界(1回=無視)テスト存在
  AC-6, 合格, types-core.ts:171 PhaseConfigにnoCodeFences?: boolean追加済み
  AC-7, 合格, registry.ts:26 planningフェーズ定義にnoCodeFences: true設定済み
  AC-8, 合格, dod-l4-content.ts:67-81 noCodeFences=trueかつ.mmd以外でCODE_FENCE_REGEX検出しpassed=true+[WARN]evidence報告
  AC-9, 合格, dod-l4-content.ts:67 extname(outputFile) !== '.mmd' 条件で.mmdファイル除外
  AC-10, 合格, dod-code-fence.test.ts:79-132 検出/非検出(.mmd除外)/インラインコード許容/ファイル名+行番号のテスト4件存在
  AC-11, 合格, pivot-advisor.ts:35+79 detectRepeatedPatternとgeneratePivotSuggestionの2関数をexport
  AC-12, 合格, pivot-advisor.ts:35-43 ErrorEntry[]から直近失敗パターン読取りしconsecutive/cross-retry検出で{isRepeated相当,consecutiveCount相当,pattern}返却
  AC-13, 合格, pivot-advisor.ts:60-72 detectConsecutivePattern内で3回連続一致(streak>=3)でパターン返却。generatePivotSuggestionがerrorClass別提案文字列生成
  AC-14, 合格, lifecycle-next.ts:28+173-174 pivot-advisor.tsをimportしbuildDoDFailureResponse内でdetectRepeatedPattern+generatePivotSuggestion呼出しpivotSuggestionをレスポンスに含める
  AC-15, 合格, pivot-advisor.test.ts:15-163 パターン一致(3回連続)/不一致/閾値未満(2回)/cross-retry検出のテスト存在
  AC-16, 合格, dod-l4-requirements.ts:11 export const MIN_ACCEPTANCE_CRITERIA = 5 定義済み
  AC-17, 合格, approval.ts:10 MIN_ACCEPTANCE_CRITERIAをdod-l4-requirements.tsからimportし使用(L58,L59,L64)
  AC-18, 合格, toon-skeletons-a.ts, defs-stage1.ts, phase-analytics.tsの旧値3→5修正済み
  AC-19, 合格, dod-l4-requirements.test.ts:26-151 境界値テスト(acCount=4不合格/5合格)、MIN_ACCEPTANCE_CRITERIA=5確認、エラーメッセージ検証テスト存在
  AC-20, 合格, 全箇所で"最低5件"に統一修正済み
  AC-21, 合格, dod-helpers.ts:21 /^`{3,}/.test(trimmed)でコードフェンス行を構造行として除外。dod-extended.test.ts:90-94でテスト検証
  AC-22, 合格, dod-helpers.ts:28-30 Mermaid構文(graph/subgraph/end/classDef等)キーワード行+矢印行を構造行として除外。dod-extended.test.ts:96-101でテスト検証
  AC-23, 合格, dod-helpers.ts:22-23 テーブルセパレータ行(/^\|[\s\-:|]+\|$/)とテーブル内容行を構造行として除外。dod-extended.test.ts:103-107でテスト検証

finding-1-p6-guidance-residual:
  severity: resolved
  description: AC-18/AC-20は合格(全AC達成)。P6のガイダンスファイル4箇所の旧値"最低3件"は全て"最低5件"に修正済み。toon-skeletons-a.ts、defs-stage1.ts、phase-analytics.tsの全箇所で統一完了。
  action: 対応完了。修正確認済み。

finding-2-p3-category-drift:
  severity: low
  description: 要件書(requirements.md)ではP3の4カテゴリをhedging/empty_emphasis/redundant_preamble/vague_connectorsと定義しているが、実装(dod-helpers.ts:79-85)では5カテゴリ(ai_buzzwordsが追加)に拡張されている。また各カテゴリ内のパターンが要件書と異なる。hedgingは要件書の"it is important to note that"ではなく"it seems like/perhaps/maybe"等に変更されている。empty_emphasisは要件書の"delve/tapestry/seamless/holistic/robust"ではなく"it is important to note/it is worth noting"に再分類されている。
  action: 設計判断として許容可能(パターン精度向上の合理的改善)だが、要件書との乖離を記録として残す。要件書にはなかった5番目のカテゴリai_buzzwordsの追加は機能追加であり、planning段階の意思決定記録がない。

finding-3-p5-architecture-deviation:
  severity: low
  description: planning.mdではpivot-advisor.tsはtools/直下に配置予定(tools/pivot-advisor.ts)だったが、実装ではtools/handlers/pivot-advisor.tsに配置されている。また要件書ではdetectRepeatedPatternの入力がphase-errors.toonファイル読取り+extractErrorPattern()を使用する設計だったが、実装ではErrorEntry[]配列を直接受け取るインメモリ方式に変更されている。
  action: インメモリ方式はテスタビリティが高く合理的な改善。ファイルパス変更もhandlersディレクトリへの配置が規約と一致する。設計書との乖離は許容だが記録として残す。

finding-4-p5-lifecycle-integration:
  severity: info
  description: planning.mdではlifecycle-next.tsへの追加を"2行のみ"(import 1行+呼出1行)と厳密に規定していた。実装ではimport行(L28)は1行、呼出部分はL173-174の2行(detectRepeatedPattern+generatePivotSuggestion)で合計3行追加。ただしlifecycle-next.tsは198行に収まっており200行制限は遵守。buildPivotResponse統合関数ではなく2関数直接呼出しに変更された。

finding-5-line-counts:
  severity: info
  description: 全ソースファイルが200行以下。types-core.ts=199行(境界値だが制限内)、lifecycle-next.ts=198行(制限内)。T-010(lifecycle-next.ts超過)リスクは回避済み。

finding-6-security-requirements:
  severity: pass
  description: SR-1(L4正規表現のみ)遵守。全検出ロジックはRegExpベース。SR-2(非ブロック動作)遵守。P3/P4は[WARN]evidence。SR-3(safe-default)はpivot-advisor.tsが3エントリ未満でnull返却し安全。SR-4(200行制限)全ファイル遵守。

verdict: 合格(全AC達成)
reason: AC-1〜AC-23の全23件が合格。P3カテゴリ拡張(finding-2)とP5アーキテクチャ変更(finding-3)は許容(ブロックしない)。

## decisions
- CR-1: AC-18/AC-20はガイダンス4箇所修正により合格 (ガイダンス4箇所の旧値残存T-012は修正完了。全箇所で最低5件に統一済み)
- CR-2: P3のカテゴリ拡張(4→5)と内部パターン変更は許容 (パターン精度向上の合理的改善。非ブロック動作のため偽陽性リスクも低い)
- CR-3: P5のファイル配置変更(tools/→tools/handlers/)とインメモリ方式変更は許容 (テスタビリティ向上の合理的改善。handlersディレクトリ配置は既存規約と一致)
- CR-4: types-core.ts 199行は許容するが追加変更には注意 (200行制限の1行手前。今後の変更で超過リスクあり)
- CR-5: 全セキュリティ要件(SR-1〜SR-4)は遵守を確認 (L4正規表現のみ使用+非ブロック動作+safe-default+200行制限の全4要件を充足)

## artifacts
artifacts[8]{path,role,summary}:
  workflow-harness/mcp-server/src/gates/dod-helpers.ts, 実装, P3 checkAiSlopPatterns + P7 isStructuralLine (152行)
  workflow-harness/mcp-server/src/gates/dod-l4-content.ts, 実装, P3/P4統合 AI slop + code fence検出 (107行)
  workflow-harness/mcp-server/src/gates/dod-l4-requirements.ts, 実装, P6 MIN_ACCEPTANCE_CRITERIA=5定数 (160行)
  workflow-harness/mcp-server/src/tools/handlers/approval.ts, 実装, P6 MIN_ACCEPTANCE_CRITERIA import使用 (120行)
  workflow-harness/mcp-server/src/state/types-core.ts, 実装, P4 noCodeFences?:boolean追加 (199行)
  workflow-harness/mcp-server/src/phases/registry.ts, 実装, P4 planning noCodeFences:true設定 (157行)
  workflow-harness/mcp-server/src/tools/handlers/pivot-advisor.ts, 実装, P5 detectRepeatedPattern+generatePivotSuggestion (95行)
  workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts, 実装, P5 pivot-advisor統合 (198行)

## next
next:
  criticalDecisions: CR-4(types-core.ts 199行監視)
  readFiles: toon-skeletons-a.ts, defs-stage1.ts, phase-analytics.ts
  warnings: finding-2(P3カテゴリ拡張)とfinding-3(P5配置変更)は許容済み。要件書との乖離を記録として保持。

## acAchievementStatus
AC-1: met
AC-2: met
AC-3: met
AC-4: met
AC-5: met
AC-6: met
AC-7: met
AC-8: met
AC-9: met
AC-10: met
AC-11: met
AC-12: met
AC-13: met
AC-14: met
AC-15: met
AC-16: met
AC-17: met
AC-18: met
AC-19: met
AC-20: met
AC-21: met
AC-22: met
AC-23: met
