# Planning: harness-detailed-error-analytics

phase: planning
date: 2026-03-25

## summary

phase-analytics.toonのerrorAnalysisを詳細化する。4ファイルを変更し、DoD失敗時の全check情報(level, fix, example)をphase-errors.toonに記録、buildErrorAnalysis()のバグ修正(passedフィルタ追加、levelハードコード解消)、errorHistory配列の全展開出力を実装する。

## architecture

### dataFlow

```
DoDCheckResult(level, check, passed, evidence, fix?, example?)
  -> lifecycle-next.ts: appendErrorToon(全フィールドmapping)
    -> phase-errors.toon: checks配列に全フィールド記録
      -> phase-analytics.ts: buildErrorAnalysis(passedフィルタ+level実値)
        -> analytics-toon.ts: errorHistory配列(全entry全checks展開)
          -> phase-analytics.toon: errorAnalysis(topFailure + errorHistory)
```

### fileChanges

| file | current | delta | projected | change |
|------|---------|-------|-----------|--------|
| error-toon.ts | 51 | +18 | 69 | DoDFailureEntry型拡張 + mapChecksForErrorToon関数追加 |
| lifecycle-next.ts | 199 | -5 | 194 | checks mapping削除(外部化) + mapChecksForErrorToon呼び出し |
| phase-analytics.ts | 168 | +10 | 178 | passedフィルタ追加 + level実値使用 + errorHistory型追加 |
| analytics-toon.ts | 66 | +17 | 83 | errorHistory配列展開出力追加 |

## detailedChanges

### error-toon.ts (FR-4 + FR-1部分)

1. DoDFailureEntry.checksの型にoptionalフィールド追加:
```typescript
checks: Array<{
  name: string;
  passed: boolean;
  message?: string;
  level?: string;    // NEW: L1|L2|L3|L4
  fix?: string;      // NEW: actionable fix instruction
  example?: string;  // NEW: correct output format example
}>;
```

2. mapChecksForErrorToon関数を新規追加(lifecycle-next.tsから外部化):
```typescript
export function mapChecksForErrorToon(
  checks: Array<{ check: string; passed: boolean; evidence: string; level?: string; fix?: string; example?: string }>
): DoDFailureEntry[checks] {
  return checks.map((c) => ({
    name: c.check,
    passed: c.passed,
    message: c.evidence,
    level: c.level,
    fix: c.fix,
    example: c.example,
  }));
}
```

### lifecycle-next.ts (FR-1)

1. importにmapChecksForErrorToonを追加:
```typescript
import { appendErrorToon, mapChecksForErrorToon } from ../error-toon.js;
```

2. buildDoDFailureResponse内のappendErrorToon呼び出しを簡素化:
変更前(行164-166):
```typescript
checks: dodResult.checks.map((c: any) => ({
  name: c.check, passed: c.passed, message: c.evidence,
})),
```
変更後:
```typescript
checks: mapChecksForErrorToon(dodResult.checks),
```

効果: 3行のインラインmapを1行の関数呼び出しに置換。199行 -> 194行(200行制約を余裕で維持)。

### phase-analytics.ts (FR-2 + FR-3部分)

1. buildErrorAnalysis内のtoonErrorsループでpassedフィルタ追加:
変更前(行44-48):
```typescript
for (const check of entry.checks) {
  const ex = pd.checks.get(check.name);
  if (ex) ex.count += 1;
  else pd.checks.set(check.name, { level: L1, count: 1 });
}
```
変更後:
```typescript
for (const check of entry.checks) {
  if (check.passed) continue;  // passed=trueはfailureカウント対象外
  const ex = pd.checks.get(check.name);
  if (ex) ex.count += 1;
  else pd.checks.set(check.name, { level: check.level ?? L1, count: 1 });
}
```

2. AnalyticsResult interfaceにerrorHistory追加:
```typescript
export interface ErrorHistoryEntry {
  phase: string;
  retryCount: number;
  check: string;
  level: string;
  passed: boolean;
  evidence: string;
}

export interface AnalyticsResult {
  errorAnalysis: PhaseErrorStats[];
  errorHistory?: ErrorHistoryEntry[];  // NEW
  bottlenecks: BottleneckResult;
  advice: string[];
  hookObsStats?: HookObsStats;
}
```

3. buildAnalytics関数でerrorHistoryを構築:
```typescript
const errorHistory = buildErrorHistory(task);
return { errorAnalysis, errorHistory, bottlenecks, advice, ...(hookObsStats ? { hookObsStats } : {}) };
```

4. buildErrorHistory関数を新規追加:
```typescript
function buildErrorHistory(task: TaskState): ErrorHistoryEntry[] {
  const docsDir = task.docsDir ?? (docs/workflows/ + task.taskName);
  const entries = readErrorToon(docsDir);
  const history: ErrorHistoryEntry[] = [];
  for (const entry of entries) {
    for (const check of entry.checks) {
      history.push({
        phase: entry.phase,
        retryCount: entry.retryCount,
        check: check.name,
        level: check.level ?? L1,
        passed: check.passed,
        evidence: check.message ?? ,
      });
    }
  }
  return history;
}
```

### analytics-toon.ts (FR-3)

1. ErrorHistoryEntryのimport追加:
```typescript
import type { AnalyticsResult, ErrorHistoryEntry } from ./phase-analytics.js;
```

2. writeAnalyticsToon内のresultオブジェクトにerrorHistory展開を追加(既存errorAnalysisの後):
```typescript
errorHistory: (analytics.errorHistory ?? []).map(h => ({
  phase: h.phase,
  retry: h.retryCount,
  check: h.check,
  level: h.level,
  passed: h.passed,
  evidence: h.evidence,
})),
```

## workerDecomposition

### Worker-1: 型定義と関数外部化 (error-toon.ts)

依存: なし(他ファイルの基盤)
変更ファイル: workflow-harness/mcp-server/src/tools/error-toon.ts
作業内容:
- DoDFailureEntry.checksの型にlevel, fix, exampleをoptionalで追加
- mapChecksForErrorToon関数を新規追加(export)
検証: TypeScriptコンパイルエラーなし

### Worker-2: 呼び出し元とanalytics (lifecycle-next.ts + phase-analytics.ts)

依存: Worker-1完了後(mapChecksForErrorToon関数を使用)
変更ファイル:
- workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts
- workflow-harness/mcp-server/src/tools/phase-analytics.ts
作業内容:
- lifecycle-next.ts: importにmapChecksForErrorToon追加、インラインmap削除
- phase-analytics.ts: passedフィルタ追加、level実値使用、ErrorHistoryEntry型追加、buildErrorHistory関数追加、AnalyticsResultにerrorHistory追加
検証: lifecycle-next.tsが194行以下であること

### Worker-3: TOON出力 (analytics-toon.ts)

依存: Worker-2完了後(ErrorHistoryEntry型とerrorHistoryフィールドを使用)
変更ファイル: workflow-harness/mcp-server/src/tools/analytics-toon.ts
作業内容:
- ErrorHistoryEntryのimport追加
- errorHistory配列の展開出力追加
検証: 66行 -> 83行以下であること

## executionOrder

```
Worker-1 (error-toon.ts: 型+関数)
  |
  v
Worker-2 (lifecycle-next.ts + phase-analytics.ts: 呼び出し元+analytics)
  |
  v
Worker-3 (analytics-toon.ts: TOON出力)
```

Worker-2とWorker-3は直列実行が必要(ErrorHistoryEntry型の依存)。Worker-1完了後にWorker-2を開始し、Worker-2完了後にWorker-3を開始する。

## risks

| risk | mitigation |
|------|-----------|
| lifecycle-next.tsが200行超過 | mapChecksForErrorToon外部化で5行削減(199->194行) |
| 後方互換性破壊 | 全新フィールドをoptionalにし、toonDecodeSafeの未知フィールド無視を活用 |
| passedフィルタによるfailureカウント変化 | 既存バグの修正であり、数値減少は正しい方向の変化 |
| errorHistoryのサイズ増加 | 最大450KB(TM-01分析済み)、実運用上問題なし |

## acceptanceCriteria

- AC-1: phase-errors.toonに全check結果(passed含む)がlevel, fix, example付きで記録される
- AC-2: phase-analytics.toonにerrorHistory配列として全entry全checksが展開出力される
- AC-3: 既存テストが回帰なく通過する
- AC-4: lifecycle-next.tsが200行以下を維持する(予測: 194行)

## rtm

| RTM ID | Requirement | Worker | Code Ref |
|--------|-------------|--------|----------|
| F-001 | 全check結果記録(level, fix, example) | Worker-1, Worker-2 | error-toon.ts, lifecycle-next.ts |
| F-002 | passedフィルタ+level修正 | Worker-2 | phase-analytics.ts |
| F-003 | errorHistory配列展開出力 | Worker-2, Worker-3 | phase-analytics.ts, analytics-toon.ts |
| F-004 | DoDFailureEntry型optional拡張 | Worker-1 | error-toon.ts |

## decisions

- PL-D1: checks mapping関数はerror-toon.tsに配置する。lifecycle-next.tsの行数削減が主目的であり、error-toon.tsが型定義とmapping両方を持つことで凝集度が高まる
- PL-D2: Worker間は直列実行とする。型定義(Worker-1)→使用箇所(Worker-2)→出力(Worker-3)の依存チェーンがあり並列化不可
- PL-D3: ErrorHistoryEntry型はphase-analytics.tsに定義する。analytics-toon.tsからimportする構成とし、AnalyticsResultと同じモジュールに凝集させる
- PL-D4: buildErrorHistory関数はphase-analytics.tsのモジュール内関数(非export)とする。外部からの呼び出し不要であり公開APIを最小化する
- PL-D5: errorHistory配列は空配列をデフォルトとする。analytics.errorHistory ?? []ガードで値なし時も安全に処理する

## artifacts

- docs/workflows/harness-detailed-error-analytics/planning.md: 本計画書。3Worker直列構成、4ファイル変更の詳細設計
- docs/workflows/harness-detailed-error-analytics/requirements.md: 入力。機能要件4件とAC4件
- docs/workflows/harness-detailed-error-analytics/threat-model.md: 入力。5脅威のSTRIDE分析と7判断

## next

criticalPath: "Worker-1(error-toon.ts型+関数) -> Worker-2(lifecycle-next.ts+phase-analytics.ts) -> Worker-3(analytics-toon.ts)"
readFiles: "docs/workflows/harness-detailed-error-analytics/planning.md, docs/workflows/harness-detailed-error-analytics/requirements.md"
warnings: "lifecycle-next.tsは現在199行。Worker-2実行時にmapChecksForErrorToon外部化を確実に実施すること"
