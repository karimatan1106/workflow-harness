# Requirements: harness-detailed-error-analytics

phase: requirements
date: 2026-03-25

## summary

phase-analytics.toonのerrorAnalysisを詳細化する要件定義。現状はフェーズ×最頻失敗1件のみだが、全DoD失敗の履歴(phase,retry,check,level,evidence)を蓄積し、事後分析可能にする。lifecycle-next.tsのDoD失敗記録部分とanalytics生成ロジックの改善を行う。

## functionalRequirements

### FR-1: phase-errors.toonへの全check結果記録

lifecycle-next.tsのDoD失敗時に、DoDCheckResultの全フィールド(level, fix, example)をchecks mappingに含めてphase-errors.toonに記録する。passed/failed両方のcheck結果を保持し、事後分析に必要な全情報を欠落なく蓄積する。

対象ファイル: lifecycle-next.ts, error-toon.ts
RTM: F-001 -> AC-1

### FR-2: buildErrorAnalysis()のpassedフィルタとlevel修正

phase-analytics.tsのbuildErrorAnalysis()で、passed=trueのchecksをfailureカウントから除外するフィルタを追加する。level値を'L1'ハードコードからDoDCheckResult.levelの実値に変更し、L1-L4の正確なlevel情報を反映する。

対象ファイル: phase-analytics.ts
RTM: F-002 -> AC-2, AC-3

### FR-3: errorHistory配列の全check詳細展開

analytics-toon.tsのwriteAnalyticsToon()で、errorHistory配列として全entry全checksを展開出力する。各要素はphase, retryCount, check, level, passed, evidenceを含む構造化データとする。既存のtopFailure出力は維持し、errorHistoryを並列追加する。

対象ファイル: analytics-toon.ts
RTM: F-003 -> AC-2

### FR-4: DoDFailureEntry型のoptionalフィールド追加

DoDFailureEntry.checksの型にlevel, fix, exampleフィールドをoptionalで追加する。toonDecodeSafeは未知フィールドを無視するため、既存phase-errors.toonファイルの読み込みに影響しない。

対象ファイル: error-toon.ts
RTM: F-004 -> AC-1, AC-4

## decisions

- DoDFailureEntry.checksの新フィールド(level, fix, example)はすべてoptionalとし、既存データとの後方互換性を保証する
- lifecycle-next.tsの200行超過はchecks mapping関数のトップレベル分離で対応する(addNextPhaseOutputFileと同じパターン)
- passed=falseフィルタの追加は既存バグの修正であり、failureカウント減少は正しい方向の変化として許容する
- level='L1'ハードコードの解消はDoDCheckResult.level直接参照に変更する(型安全性の向上)
- errorHistory配列はAnalyticsResultのoptionalフィールドとして追加し、writeAnalyticsToonで`?? []`ガードする
- 既存のerrorAnalysis(topFailure形式)は維持し、errorHistoryを並列追加する(既存出力の破壊回避)
- phase-errors.toonのサイズ増加(30-50%)は実運用上問題ない範囲と判断し、サイズ上限制御はスコープ外とする

## acceptanceCriteria

- AC-1: phase-errors.toonに全check結果(passed含む)が記録される。checksの各要素にname, passed, message, level, fix, exampleフィールドが含まれる
- AC-2: phase-analytics.toonのerrorAnalysisに全check詳細(phase, retry, check, level, passed, evidence)が出力される。topFailureだけでなくerrorHistory配列として全entry全checksを展開する
- AC-3: 既存テストが回帰なく通過する。failureカウントの変化はpassed=falseフィルタ追加による正しい方向の変化であり許容する
- AC-4: lifecycle-next.tsが200行以下を維持する。checks mapping関数の外部化により行数制約を満たす

## nonFunctionalRequirements

- NFR-1: 全変更ファイルが200行以下を維持する(error-toon.ts 61行, lifecycle-next.ts 199行以下, phase-analytics.ts 185行, analytics-toon.ts 85行)
- NFR-2: DoDFailureEntry型の後方互換性を維持する。toonDecodeSafeで既存データも新コードで正常に読み込み可能とする

## rtm

| RTM ID | Requirement | Design Ref | Code Ref |
|--------|-------------|------------|----------|
| F-001 | phase-errors.toonへの全check結果記録(level, fix, example追加) | AC-1 | lifecycle-next.ts, error-toon.ts |
| F-002 | buildErrorAnalysis()のpassedフィルタ追加とlevel修正 | AC-2, AC-3 | phase-analytics.ts |
| F-003 | errorHistory配列の全check詳細展開出力 | AC-2 | analytics-toon.ts |
| F-004 | DoDFailureEntry型のoptionalフィールド追加 | AC-1, AC-4 | error-toon.ts |

## notInScope

- phase-errors.toonのスキーマ変更(既存形式をそのまま活用)
- TOON形式自体の拡張
- errorHistoryのサイズ上限制御
- generateAdvice()やfindBottlenecks()のロジック変更(入力データの精度向上のみ)
- phase-errors.toonの過去データマイグレーション
- errorHistoryのUI表示やレポート生成

## openQuestions

なし

## changeImpact

| file | current | delta | projected | risk |
|------|---------|-------|-----------|------|
| error-toon.ts | 51 | +10 | 61 | low |
| lifecycle-next.ts | 199 | +3 | 202 | medium(要リファクタ) |
| phase-analytics.ts | 168 | +17 | 185 | medium |
| analytics-toon.ts | 65 | +20 | 85 | low |
| dod-types.ts | 21 | 0 | 21 | none |
| dod.ts | 82 | 0 | 82 | none |

## dataFlow

```
DoDCheckResult(level, check, passed, evidence, fix?, example?)
  -> lifecycle-next.ts: appendErrorToon(全フィールドmapping)
    -> phase-errors.toon: checks配列に全フィールド記録
      -> phase-analytics.ts: buildErrorAnalysis(passedフィルタ+level実値)
        -> analytics-toon.ts: errorHistory配列(全entry全checks展開)
          -> phase-analytics.toon: errorAnalysis(topFailure + errorHistory)
```
