# P5 Retry Pivot Impact Analysis

## TOON形式分析結果

```
retry_ts_lines: 198 (200行上限の2行余裕のみ。新規ロジック追加は別ファイル分離が必須)
retry_prompt_result_fields: prompt(string), suggestModelEscalation(boolean), suggestedModel('opus'|'sonnet'|'haiku'), errorClass('FileNotFound'|'SyntaxError'|'LogicError'|'Unknown')
build_retry_prompt_signature: buildRetryPrompt(ctx: RetryContext, checks?: DoDCheckResult[]): RetryPromptResult
lifecycle_next_integration_points: L94(buildDoDFailureResponse呼出), L137-185(buildDoDFailureResponse定義内でbuildRetryPrompt呼出=L147, stashFailure呼出=L149, recordRetry/recordDoDFailure=L152-153, appendErrorToon=L163), L169-174(VDB-1警告=retryCount>=3時)
reflector_extract_pattern: string (errorMessageから最大80文字のパターン文字列を返す。9個のRegExpに順番マッチし、最初のヒットの match[0].substring(0,80) を返却。マッチなしの場合はerrorMessage先頭80文字)
tools_dir_files: ace-context.ts, ace-context-toon.ts, adr.ts, adr-generator.ts, adr-toon-io.ts, analytics-toon.ts, archgate.ts, archgate-toon-io.ts, comment-ratio.ts, context-metrics.ts, curator.ts, curator-helpers.ts, curator-toon.ts, defs-a.ts, defs-b.ts, defs-c.ts, error-message-validator.ts, error-toon.ts, garbage-collector.ts, gc.ts, handler.ts, handlers/(lifecycle-next.ts他13ファイル), handler-shared.ts, hybrid-strategy.ts, instruction-counter.ts, linter-runner.ts, llm-quality-gates.ts, metrics.ts, metrics-toon.ts, metrics-toon-io.ts, mvh-roadmap.ts, phase-analytics.ts, phase-timings.ts, progress-json.ts, reflector.ts, reflector-toon.ts, reflector-types.ts, retry.ts, token-benchmarks.ts
phase_errors_format: TOON形式。entries配列。各entryは timestamp(ISO8601), phase(string), retryCount(number), errors(string[]), checks(array of {name,passed,message,level?,fix?,example?})
new_file_impact: 下記「新規ファイル影響評価」セクション参照
```

## 新規ファイル影響評価 (pivot-advisor.ts)

### 1. モジュール構造への影響

retry.tsは198行で200行上限に到達寸前。pivot判定ロジックをretry.ts内に追加することは不可能。
pivot-advisor.tsの新規ファイル追加は200行制約上必須であり、以下の責務分離が適切:

- retry.ts: 既存のリトライプロンプト構築(buildRetryPrompt)、エラー分類(classifyError/classifyFromChecks)、複雑度分類(classifyComplexity)
- pivot-advisor.ts(新規): 同一パターン検出、方向転換判定、代替アプローチ提案

### 2. retry.tsからの呼び出し統合ポイント

buildRetryPrompt関数(L168-198)が統合候補。現在の処理フロー:
1. extractImprovements → 改善指示生成
2. classifyFromChecks → エラー分類
3. classifyComplexity → 複雑度分類
4. formatStructuredError → ERROR/WHY/FIX形式化
5. (pivot-advisor挿入点) → 同一パターン検出時にpromptを方向転換内容に差し替え

ただしretry.tsの行数制約上、呼び出し側はlifecycle-next.tsのbuildDoDFailureResponse(L137-185)が適切。
理由: retryCount情報、stashFailure呼出(=過去エラー蓄積)、VDB-1警告(L169)が全て同関数内にあり、pivot判定の文脈が揃っている。

### 3. phase-errors.toonデータ依存の安定性

phase-errors.toonはerror-toon.tsのappendErrorToon/readErrorToon経由で読み書き。
DoDFailureEntryインターフェース(error-toon.ts L10-23)が構造を定義:

安定性評価:
- 読み取りAPI: readErrorToon(docsDir)は安定。toonDecodeSafe経由でパースし、失敗時は空配列を返す
- データ構造: entries[].phase, entries[].retryCount, entries[].errorsが同一パターン検出に必要な3フィールド。全て既存フィールドであり追加不要
- 書き込みタイミング: lifecycle-next.ts L163で毎回のDoD失敗時に記録。pivot判定に必要な履歴データは自然に蓄積される
- reflector.tsのextractErrorPattern: 80文字のパターン文字列を返す。同一パターン判定に直接利用可能

リスク: phase-errors.toonが大量エントリ蓄積時の読み取りパフォーマンス。現状上限制御なし。pivot-advisorが全entries走査する場合、直近N件に制限するフィルタが必要。

### 4. 依存関係マップ

```
pivot-advisor.ts(新規)
  imports from:
    - error-toon.ts (readErrorToon, DoDFailureEntry)
    - reflector.ts (extractErrorPattern)
  imported by:
    - handlers/lifecycle-next.ts (buildDoDFailureResponse内)
  
  既存の変更不要ファイル:
    - retry.ts (変更不要。RetryPromptResultにpivot関連フィールド追加する場合のみ変更)
    - error-toon.ts (変更不要。既存APIで十分)
    - reflector.ts (変更不要。extractErrorPatternをそのまま利用)
```

### 5. 統合設計の推奨

lifecycle-next.ts L169のVDB-1警告(retryCount>=3)と、pivot判定を統合:
- retryCount>=3 かつ 同一errorPattern が3回連続 → pivot発動
- pivot-advisor.tsがRetryPromptResultを拡張するのではなく、独自のPivotAdvice型を返し、lifecycle-next.tsで応答に付加する設計が疎結合
