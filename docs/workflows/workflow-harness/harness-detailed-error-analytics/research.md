# Research: harness-detailed-error-analytics

phase: research
date: 2026-03-25

## summary

phase-analytics.toon生成時のerrorAnalysis詳細化に必要な6ファイルのコード調査を完了した。情報欠落ポイントは3箇所に集中しており、型拡張の後方互換性も確認済み。

## findings

### データフロー全体像

```
runDoDChecks() -> DoDResult { checks: DoDCheckResult[] }
  | (lifecycle-next.ts)
  +-> appendErrorToon(): checks全件記録(level/fix/example欠落)
  +-> recordDoDResults(): checks全件(observability-trace.toon)
  +-> response: dodChecks全件返却
      | (phase-analytics.ts)
      readErrorToon() -> buildErrorAnalysis()
        -> passedフィルタなし + level='L1'固定
          | (analytics-toon.ts)
          writeAnalyticsToon() -> topFailure先頭1件のみ出力
```

### 情報欠落ポイント

ポイント1: lifecycle-next.ts 160-168行 appendErrorToon呼び出し
- DoDCheckResult.level, fix, exampleがmapping時に脱落
- `{ name: c.check, passed: c.passed, message: c.evidence }` のみ変換
- DoDFailureEntry.checksの型が `{ name, passed, message? }` で情報不足

ポイント2: phase-analytics.ts buildErrorAnalysis() 44行目
- checksイテレート時にpassedフィルタがなく、passed=trueもfailure扱いでカウント
- level情報は'L1'にハードコード(47行目)、実際のlevelが反映されない

ポイント3: analytics-toon.ts 31-37行 errorAnalysis出力
- failures配列の先頭1件のみをtopFailureとして文字列化
- 2件目以降のfailure詳細と個別check情報が完全に脱落

### 型定義の現状

DoDCheckResult型 (dod-types.ts):
- level: 'L1' | 'L2' | 'L3' | 'L4'
- check: string
- passed: boolean
- evidence: string
- fix?: string
- example?: string

DoDFailureEntry型 (error-toon.ts):
- timestamp: string
- phase: string
- retryCount: number
- errors: string[]
- checks: Array<{ name: string; passed: boolean; message?: string }>

PhaseErrorStats型 (phase-analytics.ts):
- phase: string
- retries: number
- failures: CheckFailure[] (check, level, count)

### ファイル行数と変更インパクト

| file | current | estimated-delta | risk |
|------|---------|-----------------|------|
| error-toon.ts | 51行 | +10行(checksにlevel/fix/example追加) | low |
| phase-analytics.ts | 167行 | +15行(errorHistory構築+passedフィルタ修正) | medium(182行) |
| analytics-toon.ts | 65行 | +20行(errorHistory配列のTOON出力) | low(85行) |
| lifecycle-next.ts | 199行 | +3行(DoDCheckResult全フィールドのmapping) | medium(202行超過注意) |
| dod-types.ts | 21行 | 0行(変更不要) | none |
| dod.ts | 83行 | 0行(変更不要) | none |

## decisions

- lifecycle-next.tsのappendErrorToon呼び出しでDoDCheckResult全フィールド(level, fix, example)をmappingに含める(ソースデータの充実化が最優先)
- DoDFailureEntry.checksの型をDoDCheckResultの全フィールドに拡張し、新フィールドはoptionalとする(後方互換性維持)
- phase-analytics.ts buildErrorAnalysis()でpassed=falseのchecksのみfailureカウントし、level情報も保持する(既存バグの修正)
- analytics-toon.tsにerrorHistory配列を追加し、全entry全checksを展開出力する(topFailure単体の制限を解消)
- lifecycle-next.tsが200行超過する場合、appendErrorToon呼び出し部分のmapping関数を外部化してインライン行数を削減する
- dod-types.tsとdod.tsは変更不要(DoDCheckResult型は既に必要な全フィールドを持つ)
- phase-analytics.tsのerrorHistory構築ロジックはbuildErrorAnalysis()内に配置し、新関数分離は行わない(182行で200行以内)

## artifacts

- research.md: 本ドキュメント(コード調査結果と設計判断)
- research-code-analysis.md: ファイル別詳細調査結果(中間成果物)

## next

- planningフェーズでDoDFailureEntry型拡張の詳細設計を行う
- lifecycle-next.tsの200行制限対応方針を確定する(mapping関数外部化 vs インライン維持)
- errorHistory配列のTOON出力形式(analytics-toon.ts)の具体構造を設計する
- buildErrorAnalysis()のpassedフィルタ修正とlevel保持の実装手順を定義する
- phase-analytics.tsとanalytics-toon.tsの変更順序(依存関係)を整理する
