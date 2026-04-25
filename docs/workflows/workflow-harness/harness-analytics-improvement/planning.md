# Planning: harness-analytics-improvement

phase: planning
date: 2026-03-26

## summary

phase-analytics.toonの分析精度を4軸で改善する。(1) topFailure集計をcount降順ソートしMap挿入順バイアスを解消、(2) IQR外れ値検出でセッション中断による壁時計時間異常値をフラグ付け、(3) tdd_red_evidence向けadviceルール追加、(4) エラー分類(recurring/cascading/one-off)の導入。新規2ファイル(outlier-detection.ts, error-classification.ts)にロジックを分離し、phase-analytics.tsを199行から170行程度に削減する。

## architecture

### dataFlow

```
DoDFailureEntry[] (phase-errors.toon)
  -> phase-analytics.ts: buildErrorAnalysis()
    -> failures配列をcount降順ソート + level重み付け (FR-1)
  -> phase-analytics.ts: findBottlenecks()
    -> outlier-detection.ts: detectOutliers() (FR-2)
      -> BottleneckResult.outlierPhases に外れ値フラグ
  -> phase-analytics.ts: generateAdvice()
    -> ADVICE_RULES に tdd_red_evidence ルール追加 (FR-3)
    -> 閾値ルール: 同一チェック5回以上で改善提案
    -> 外れ値フェーズに「セッション中断の可能性」表示
  -> error-classification.ts: classifyErrors() (FR-4)
    -> AnalyticsResult.errorClassification に3分類結果
  -> analytics-toon.ts: writeAnalyticsToon() (FR-5)
    -> outlierPhases + errorClassification セクション出力
```

### fileChanges

| file | current | delta | projected | change |
|------|---------|-------|-----------|--------|
| src/tools/phase-analytics.ts | 199 | -29 | 170 | failures配列ソート、outlier/classification呼び出し追加、型拡張 |
| src/tools/analytics-toon.ts | 74 | +16 | 90 | outlierPhases + errorClassification 出力追加 |
| src/analytics/outlier-detection.ts | 0 | +70 | 70 | IQR外れ値検出(新規) |
| src/analytics/error-classification.ts | 0 | +70 | 70 | 失敗パターン3分類(新規) |
| src/__tests__/phase-analytics.test.ts | 147 | +53 | 200 | ソート検証、advice検証テスト追加 |
| src/__tests__/outlier-detection.test.ts | 0 | +60 | 60 | IQR検出テスト(新規) |
| src/__tests__/error-classification.test.ts | 0 | +60 | 60 | 分類テスト(新規) |

## detailedChanges

### outlier-detection.ts (FR-2, 新規作成)

配置先: `workflow-harness/mcp-server/src/analytics/outlier-detection.ts`

IQR法(四分位範囲)による外れ値検出。phase-analytics.tsの内部型に依存しない独自インターフェース設計(TM-D4)。

```typescript
export interface OutlierResult {
  phase: string;
  seconds: number;
  iqrScore: number;
  isOutlier: boolean;
}

export function detectOutliers(
  timings: Record<string, { seconds: number; current?: boolean }>,
): OutlierResult[] {
  // currentフェーズを除外して完了済みフェーズのみ対象
  const entries = Object.entries(timings)
    .filter(([, t]) => !t.current)
    .map(([phase, t]) => ({ phase, seconds: t.seconds }));
  if (entries.length < 4) return []; // TM-D3: 統計的に四分位数計算に最低4データ点必要
  const sorted = entries.map(e => e.seconds).sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const upperFence = q3 + 1.5 * iqr;
  return entries.map(e => ({
    phase: e.phase,
    seconds: e.seconds,
    iqrScore: iqr > 0 ? (e.seconds - q3) / iqr : 0,
    isOutlier: e.seconds > upperFence,
  })).filter(r => r.isOutlier);
}
```

### error-classification.ts (FR-4, 新規作成)

配置先: `workflow-harness/mcp-server/src/analytics/error-classification.ts`

DoDFailureEntry型を直接importせず、最小限のインターフェースで受け取る(TM-D4)。フェーズ番号抽出は末尾数字パターン `\d+$` を使用(TM-D6)。

```typescript
export interface ErrorClassification {
  recurring: string[];
  cascading: string[][];
  oneOff: string[];
}

interface FailureInput {
  phase: string;
  checks: Array<{ name: string; passed: boolean }>;
}

export function classifyErrors(entries: FailureInput[]): ErrorClassification {
  // チェック名ごとの出現フェーズを集計
  const checkPhases = new Map<string, Set<string>>();
  for (const entry of entries) {
    for (const check of entry.checks) {
      if (check.passed) continue;
      if (!checkPhases.has(check.name)) checkPhases.set(check.name, new Set());
      checkPhases.get(check.name)!.add(entry.phase);
    }
  }
  const recurring: string[] = [];
  const cascadeCandidates = new Map<string, number[]>();
  // recurring: 同一check.nameが3エントリ以上
  for (const [check, phases] of checkPhases) {
    if (phases.size >= 3) recurring.push(check);
    // フェーズ番号抽出(末尾数字パターン)
    const nums: number[] = [];
    for (const p of phases) {
      const m = p.match(/(\d+)$/);
      if (m) nums.push(parseInt(m[1], 10));
    }
    if (nums.length >= 2) cascadeCandidates.set(check, nums.sort((a, b) => a - b));
  }
  // cascading: 連続するフェーズ番号で同系統の失敗
  const cascading: string[][] = [];
  for (const [check, nums] of cascadeCandidates) {
    const chain: number[] = [nums[0]];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === chain[chain.length - 1] + 1) chain.push(nums[i]);
      else if (chain.length >= 2) break;
      else { chain.length = 0; chain.push(nums[i]); }
    }
    if (chain.length >= 2) cascading.push([check, ...chain.map(String)]);
  }
  // one-off: recurring/cascadingのいずれにも該当しない
  const categorized = new Set([...recurring, ...cascading.map(c => c[0])]);
  const oneOff = [...checkPhases.keys()].filter(c => !categorized.has(c));
  return { recurring, cascading, oneOff };
}
```

### phase-analytics.ts (FR-1, FR-2呼び出し, FR-3, FR-4呼び出し)

変更対象: `workflow-harness/mcp-server/src/tools/phase-analytics.ts`

1. import追加(2行増):
```typescript
import { detectOutliers, type OutlierResult } from '../analytics/outlier-detection.js';
import { classifyErrors, type ErrorClassification } from '../analytics/error-classification.js';
```

2. BottleneckResult型にoutlierPhases追加(1行増):
```typescript
export interface BottleneckResult {
  slowestPhase?: { phase: string; seconds: number };
  mostRetried?: { phase: string; retries: number };
  mostFailedCheck?: { check: string; count: number };
  outlierPhases?: OutlierResult[];  // NEW: IQR外れ値 (D-RQ-5 optional)
}
```

3. AnalyticsResult型にerrorClassification追加(1行増):
```typescript
export interface AnalyticsResult {
  errorAnalysis: PhaseErrorStats[];
  errorHistory?: ErrorHistoryEntry[];
  bottlenecks: BottleneckResult;
  advice: string[];
  hookObsStats?: HookObsStats;
  errorClassification?: ErrorClassification;  // NEW (D-RQ-5 optional)
}
```

4. buildErrorAnalysis内のfailures配列をcount降順ソート(変更、行数増減なし):
```typescript
// 変更前 (L82):
failures: Array.from(data.checks.entries()).map(([c, v]) => ({ check: c, level: v.level, count: v.count })),
// 変更後:
failures: Array.from(data.checks.entries())
  .map(([c, v]) => ({ check: c, level: v.level, count: v.count }))
  .sort((a, b) => b.count - a.count || (a.level === 'L1' ? 1 : 0) - (b.level === 'L1' ? 1 : 0)),
```

ソート規則: count降順。同countの場合、L1チェックを後方に配置(L2+チェックを優先)。

5. findBottlenecks内でdetectOutliers呼び出し追加(3行増):
```typescript
// L91のtimingsブロック末尾に追加:
if (timings) {
  // ... 既存のslowestPhase検出 ...
  const outliers = detectOutliers(timings.phaseTimings);
  if (outliers.length > 0) r.outlierPhases = outliers;
}
```

6. ADVICE_RULESにtdd_red_evidenceルール追加(1行増):
```typescript
{ pattern: 'tdd_red_evidence', message: 'テスト設計の見直しを推奨: red phase失敗が頻発' },
```

7. generateAdvice内に閾値ルールと外れ値アドバイス追加(6行増):
```typescript
// 閾値ルール: 同一チェック5回以上
for (const f of allFails) {
  if (f.count >= 5) advice.push(`テンプレート改善を推奨: ${f.check} (${f.count}回失敗)`);
}
```

外れ値フェーズアドバイスはfindBottlenecksの結果をbuildAnalyticsで受け取りadviceに追加:
```typescript
// buildAnalytics内(generateAdvice呼び出し後):
if (bottlenecks.outlierPhases) {
  for (const o of bottlenecks.outlierPhases) {
    advice.push(`セッション中断の可能性: ${o.phase} (${o.seconds}s, IQR=${o.iqrScore.toFixed(1)})`);
  }
}
```

8. buildAnalytics内でclassifyErrors呼び出し追加(3行増):
```typescript
const docsDir = task.docsDir ?? ('docs/workflows/' + task.taskName);
const toonErrors = readErrorToon(docsDir);
const errorClassification = toonErrors.length > 0 ? classifyErrors(toonErrors) : undefined;
return { errorAnalysis, errorHistory, bottlenecks, advice, errorClassification, ...(hookObsStats ? { hookObsStats } : {}) };
```

9. buildErrorHistory関数削除(-18行): readErrorToonの二重呼び出しを解消。buildAnalytics内でtoonErrorsを直接errorHistory構築に使用する。

```typescript
// buildErrorHistory削除 -> buildAnalytics内でインライン構築
const errorHistory: ErrorHistoryEntry[] = [];
for (const entry of toonErrors) {
  for (const check of entry.checks) {
    errorHistory.push({
      phase: entry.phase, retryCount: entry.retryCount,
      check: check.name, level: check.level ?? 'L1',
      passed: check.passed, evidence: check.message ?? '',
    });
  }
}
```

行数変動: +2(import) +1(BottleneckResult) +1(AnalyticsResult) +2(sort展開) +3(outlier呼び出し) +1(advice rule) +6(閾値+外れ値advice) +3(classification呼び出し) -18(buildErrorHistory削除) -1(readErrorToon二重呼び出し削除) = -0行、ただしbuildAnalytics統合で更に圧縮可能。目標170行。

### analytics-toon.ts (FR-5)

変更対象: `workflow-harness/mcp-server/src/tools/analytics-toon.ts`

1. import追加(1行増):
```typescript
import type { OutlierResult } from '../analytics/outlier-detection.js';
import type { ErrorClassification } from '../analytics/error-classification.js';
```

2. bottlenecksセクションにoutlierPhases出力追加(D-RQ-6: 空時省略):
```typescript
bottlenecks: {
  // ... 既存フィールド ...
  ...(analytics.bottlenecks.outlierPhases?.length ? {
    outlierPhases: analytics.bottlenecks.outlierPhases.map(o => ({
      phase: o.phase, seconds: o.seconds, iqrScore: Number(o.iqrScore.toFixed(1)),
    })),
  } : {}),
},
```

3. errorClassificationセクション追加(D-RQ-6: 空時省略):
```typescript
...(analytics.errorClassification ? {
  errorClassification: {
    ...(analytics.errorClassification.recurring.length > 0
      ? { recurring: analytics.errorClassification.recurring } : {}),
    ...(analytics.errorClassification.cascading.length > 0
      ? { cascading: analytics.errorClassification.cascading } : {}),
    ...(analytics.errorClassification.oneOff.length > 0
      ? { oneOff: analytics.errorClassification.oneOff } : {}),
  },
} : {}),
```

行数変動: +1(import) +5(outlierPhases) +10(errorClassification) = +16行。74行 -> 90行。

## workerDecomposition

### Worker-1: 新規ファイル作成 (outlier-detection.ts + error-classification.ts)

依存: なし(独立した新規モジュール)
変更ファイル:
- workflow-harness/mcp-server/src/analytics/outlier-detection.ts (新規, 70行)
- workflow-harness/mcp-server/src/analytics/error-classification.ts (新規, 70行)
作業内容:
- analyticsディレクトリ作成(存在しない場合)
- OutlierResult型 + detectOutliers関数
- ErrorClassification型 + classifyErrors関数
検証: TypeScriptコンパイルエラーなし、独立テスト実行可能

### Worker-2: テスト作成 (outlier-detection.test.ts + error-classification.test.ts)

依存: Worker-1完了後(テスト対象モジュールが必要)
変更ファイル:
- workflow-harness/mcp-server/src/__tests__/outlier-detection.test.ts (新規, 60行)
- workflow-harness/mcp-server/src/__tests__/error-classification.test.ts (新規, 60行)
作業内容:
- detectOutliers: データ点4未満で空配列、正常分布、外れ値検出の3パターン
- classifyErrors: recurring(3回以上)、cascading(連続フェーズ)、one-off、空入力の4パターン
検証: vitest実行で全テストpass

### Worker-3: phase-analytics.ts改修 (FR-1, FR-2呼び出し, FR-3, FR-4呼び出し)

依存: Worker-1完了後(import対象モジュールが必要)
変更ファイル:
- workflow-harness/mcp-server/src/tools/phase-analytics.ts
作業内容:
- import追加(outlier-detection, error-classification)
- BottleneckResult型 + AnalyticsResult型にフィールド追加
- buildErrorAnalysis: failures配列のcount降順ソート + L1後方配置
- findBottlenecks: detectOutliers呼び出し追加
- ADVICE_RULES: tdd_red_evidenceルール追加
- generateAdvice: 閾値ルール(5回以上)追加
- buildAnalytics: classifyErrors呼び出し、外れ値advice追加、buildErrorHistory統合
- buildErrorHistory関数削除(buildAnalyticsに統合)
検証: 170行以下、既存テスト回帰なし

### Worker-4: analytics-toon.ts出力拡張 + phase-analytics.test.ts追加テスト

依存: Worker-3完了後(AnalyticsResult型拡張が必要)
変更ファイル:
- workflow-harness/mcp-server/src/tools/analytics-toon.ts
- workflow-harness/mcp-server/src/__tests__/phase-analytics.test.ts
作業内容:
- analytics-toon.ts: outlierPhases + errorClassification出力追加(空時省略)
- phase-analytics.test.ts: ソート検証テスト、tdd_red_evidence adviceテスト追加
検証: 全テストpass、analytics-toon.ts 90行以下

## executionOrder

```
Worker-1 (outlier-detection.ts + error-classification.ts: 新規モジュール)
  |
  +--> Worker-2 (テスト: outlier-detection.test.ts + error-classification.test.ts)
  |
  +--> Worker-3 (phase-analytics.ts: 型拡張 + ソート + 呼び出し統合)
         |
         v
       Worker-4 (analytics-toon.ts出力 + phase-analytics.test.ts追加)
```

Worker-2とWorker-3はWorker-1完了後に並列実行可能。Worker-4はWorker-3完了後に直列実行。

## risks

| risk | mitigation |
|------|-----------|
| phase-analytics.ts 200行超過 | buildErrorHistory削除(-18行)とreadErrorToon統合で170行目標。changeTargets表で行数予測を管理 |
| IQR計算のデータ点不足 | 4データ点未満ガード(TM-D3)で空配列返却。既存動作への影響なし |
| cascading判定のフェーズ名パース誤り | 末尾数字パターン(\d+$)に限定、数字なしフェーズ名は対象外(TM-D6) |
| 循環依存 | analytics/ -> tools/方向のimportなし。phase-analytics.tsがanalytics/を一方向参照(TM-D4) |
| topFailureソート変更の後方互換 | 意図された改善(TM-D2)。analytics-toon.tsのtopFailure表示はfailures[0]参照のため自動追従 |
| analytics-toon.ts出力肥大化 | 空セクション省略(D-RQ-6)。outlierPhasesは通常0-2件 |

## acceptanceCriteria

- AC-1: failures配列がcount降順でソートされ、topFailureが最頻失敗チェックを反映する。同countの場合L2+チェックがL1より優先される
- AC-2: detectOutliers()がIQR法で外れ値を検出し、データ点4未満では空配列を返す
- AC-3: tdd_red_evidence失敗パターンに対してテスト設計見直しのadviceが生成される。同一チェック5回以上で閾値ルールが発火する
- AC-4: classifyErrors()がrecurring(3回以上)/cascading(連続フェーズ)/one-offの3分類を正しく返す
- AC-5: 全変更対象ファイルが200行以下を維持する(phase-analytics.ts: 170行以下)

## rtm

| RTM ID | Requirement | Worker | Code Ref |
|--------|-------------|--------|----------|
| F-001 | topFailure count降順ソート + L1後方配置 | Worker-3 | phase-analytics.ts buildErrorAnalysis |
| F-002 | IQR外れ値検出(1.5x IQR閾値) | Worker-1, Worker-3 | outlier-detection.ts, phase-analytics.ts findBottlenecks |
| F-003 | tdd_red_evidence adviceルール + 閾値ルール | Worker-3 | phase-analytics.ts ADVICE_RULES, generateAdvice |
| F-004 | 失敗パターン3分類(recurring/cascading/one-off) | Worker-1, Worker-3 | error-classification.ts, phase-analytics.ts buildAnalytics |
| F-005 | analytics-toon出力拡張(outlierPhases + errorClassification) | Worker-4 | analytics-toon.ts writeAnalyticsToon |
| F-006 | ファイル分割による200行制約維持 | Worker-1, Worker-3 | outlier-detection.ts, error-classification.ts |

## decisions

- PL-D1: 新規ファイルの配置先をsrc/analytics/ディレクトリとする。src/tools/はMCPツールハンドラ用であり、汎用分析ロジックはanalytics/に分離して責務境界を明確化する(D-RQ-4)
- PL-D2: buildErrorHistory関数を削除しbuildAnalyticsに統合する。readErrorToonの二重呼び出し(buildErrorAnalysisとbuildErrorHistory)を解消し、toonErrors変数を共有することで行数削減と効率化を両立する
- PL-D3: Worker-1(新規モジュール)完了後、Worker-2(テスト)とWorker-3(既存改修)を並列実行する。新規モジュールのテストと既存ファイル改修は独立しており並列化が可能
- PL-D4: failures配列のソートをcount降順+L1後方配置の2段階とする。単純なcount降順では同数時にMap挿入順が残るため、L1チェック(output_file_existsなど情報価値が低い)を明示的に後方配置する(D-RQ-2)
- PL-D5: outlier-detection.tsとerror-classification.tsはphase-analytics.tsの内部型を直接importしない。独自のインターフェース(timings Record, FailureInput)で受け取り、型結合を回避して独立テスト可能にする(TM-D4)
- PL-D6: generateAdviceの外れ値アドバイスはbuildAnalytics内でbottlenecks.outlierPhasesから生成する。generateAdvice関数にBottleneckResultを渡す代わりに、buildAnalyticsが事後的にadvice配列に追加する構成でシグネチャ変更を最小化する
- PL-D7: analytics-toon.tsのOutlierResult/ErrorClassification型importはtype importとする。実行時依存を作らずコンパイル時のみの型参照に限定する

## artifacts

- docs/workflows/harness-analytics-improvement/planning.md: 本計画書。4Worker構成、7ファイル変更の詳細設計
- docs/workflows/harness-analytics-improvement/requirements.md: 入力。機能要件6件とAC5件
- docs/workflows/harness-analytics-improvement/threat-model.md: 入力。6脅威のSTRIDE分析と7判断

## next

criticalPath: "Worker-1(新規モジュール2件) -> Worker-2(テスト) + Worker-3(phase-analytics.ts改修) -> Worker-4(analytics-toon.ts + 追加テスト)"
readFiles: "docs/workflows/harness-analytics-improvement/planning.md, docs/workflows/harness-analytics-improvement/requirements.md"
warnings: "phase-analytics.tsは199行からの削減が必須。buildErrorHistory削除(-18行)を確実に実施すること。Worker-3実行時にimport追加と関数削除を同時に行い170行以下を達成する"
