/**
 * Phase analytics — DoD failure analysis, bottleneck detection, advice.
 * @spec docs/spec/features/workflow-harness.md
 */
import { existsSync, readFileSync } from 'fs';
import type { TaskState } from '../state/types.js';
import type { PhaseTimingsResult } from './phase-timings.js';
import { getTaskMetrics, type TaskMetrics } from './metrics.js';
import { readErrorToon } from './error-toon.js';
import { detectOutliers, type OutlierResult } from '../analytics/outlier-detection.js';
import { classifyErrors, type ErrorClassification } from '../analytics/error-classification.js';

export interface CheckFailure { check: string; level: string; count: number }
export interface PhaseErrorStats { phase: string; retries: number; failures: CheckFailure[] }
export interface BottleneckResult {
  slowestPhase?: { phase: string; seconds: number };
  mostRetried?: { phase: string; retries: number };
  mostFailedCheck?: { check: string; count: number };
  outlierPhases?: OutlierResult[];
}
export interface HookObsStats {
  toolCounts: Record<string, number>;
  allowed: number; blocked: number;
  top5: Array<{ tool: string; count: number }>;
}
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
  errorHistory?: ErrorHistoryEntry[];
  bottlenecks: BottleneckResult;
  advice: string[];
  hookObsStats?: HookObsStats;
  errorClassification?: ErrorClassification;
}

// ─── DoD Failure Analysis ────────────────────────
type PhaseData = { retries: number; checks: Map<string, { level: string; count: number }> };

function buildErrorAnalysis(task: TaskState, toonErrors: ReturnType<typeof readErrorToon>, metrics?: TaskMetrics): PhaseErrorStats[] {
  const pm = new Map<string, PhaseData>();
  const ensure = (p: string) => {
    if (!pm.has(p)) pm.set(p, { retries: 0, checks: new Map() });
    return pm.get(p)!;
  };
  for (const entry of toonErrors) {
    const pd = ensure(entry.phase);
    for (const check of entry.checks) {
      if (check.passed) continue;
      const ex = pd.checks.get(check.name);
      if (ex) ex.count += 1;
      else pd.checks.set(check.name, { level: check.level ?? 'L1', count: 1 });
    }
  }
  // Fallback: proofLog for legacy data
  for (const entry of task.proofLog ?? []) {
    if (entry.result) continue;
    const pd = ensure(entry.phase);
    const ex = pd.checks.get(entry.check);
    if (ex) ex.count += 1;
    else pd.checks.set(entry.check, { level: entry.level, count: 1 });
  }
  for (const [phase, count] of Object.entries(task.retryCount ?? {})) {
    ensure(phase).retries = count;
  }
  if (metrics) {
    for (const [phase, m] of Object.entries(metrics.phases)) {
      const pd = ensure(phase);
      if (m.retries > pd.retries) pd.retries = m.retries;
    }
  }
  const result: PhaseErrorStats[] = [];
  for (const [phase, data] of pm) {
    if (data.retries === 0 && data.checks.size === 0) continue;
    result.push({
      phase, retries: data.retries,
      failures: Array.from(data.checks.entries())
        .map(([c, v]) => ({ check: c, level: v.level, count: v.count }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          const levelOrder = (l: string) => l === 'L1' ? 0 : 1;
          return levelOrder(b.level) - levelOrder(a.level);
        }),
    });
  }
  return result.sort((a, b) => b.retries - a.retries);
}

function findBottlenecks(errors: PhaseErrorStats[], timings?: PhaseTimingsResult): BottleneckResult {
  const r: BottleneckResult = {};
  if (timings) {
    let maxSec = 0;
    for (const [phase, t] of Object.entries(timings.phaseTimings)) {
      if (!t.current && t.seconds > maxSec) {
        maxSec = t.seconds;
        r.slowestPhase = { phase, seconds: t.seconds };
      }
    }
  }
  let maxRetries = 0;
  for (const e of errors) {
    if (e.retries > maxRetries) { maxRetries = e.retries; r.mostRetried = { phase: e.phase, retries: e.retries }; }
  }
  const checkTotals = new Map<string, number>();
  for (const e of errors) for (const f of e.failures) checkTotals.set(f.check, (checkTotals.get(f.check) ?? 0) + f.count);
  let maxC = 0;
  for (const [check, count] of checkTotals) {
    if (count > maxC) { maxC = count; r.mostFailedCheck = { check, count }; }
  }
  return r;
}

const ADVICE_RULES: Array<{ pattern: string; message: string }> = [
  { pattern: 'toon_safety', message: 'TOONスケルトンのフィールド定義を確認' },
  { pattern: 'toon_field_count', message: 'カンマ含む値の引用符忘れ' },
  { pattern: 'dci_orphan_code', message: '@specアノテーション付与をテンプレートに追加' },
  { pattern: 'dci_broken_links', message: '仕様書パスの確認' },
  { pattern: 'exit_code_zero', message: 'Bashコマンドの事前検証' },
  { pattern: 'rtm_required', message: 'requirements作成時にF-NNNエントリを同時登録' },
  { pattern: 'ac_format', message: 'AC-N形式の最低5件を確認' },
];

function generateAdvice(errors: PhaseErrorStats[], timings?: PhaseTimingsResult): string[] {
  const advice: string[] = [];
  const seen = new Set<string>();
  const allFails = errors.flatMap(e => e.failures);
  for (const rule of ADVICE_RULES) {
    if (allFails.some(f => f.check.includes(rule.pattern)) && !seen.has(rule.pattern)) {
      advice.push(rule.message);
      seen.add(rule.pattern);
    }
  }
  const tddTotal = allFails.filter(f => f.check === 'tdd_red_evidence').reduce((s, f) => s + f.count, 0);
  if (tddTotal >= 3) advice.push(`tdd_red_evidence ${tddTotal}回失敗: record_test_result(exitCode=1)とrecord_proof(tdd_red_evidence)の両方が必要です`);
  for (const e of errors) {
    if (e.retries >= 3) advice.push(`テンプレートの改善が必要: ${e.phase} (${e.retries}回リトライ)`);
  }
  if (timings) {
    for (const [phase, t] of Object.entries(timings.phaseTimings)) {
      if (!t.current && t.seconds > 600) advice.push(`フェーズ分割またはスコープ縮小を検討: ${phase} (${t.seconds}s)`);
    }
    if (timings.totalElapsed.seconds > 1800) {
      advice.push(`タスクサイズの見直しを推奨 (総所要時間: ${timings.totalElapsed.seconds}s)`);
    }
  }
  return advice;
}

// ─── Hook obs log parsing ────────────────────────
const HOOK_OBS_LOG = '/tmp/harness-hook-obs.log';

function parseHookObsLog(): HookObsStats | undefined {
  try {
    if (!existsSync(HOOK_OBS_LOG)) return undefined;
    const lines = readFileSync(HOOK_OBS_LOG, 'utf-8').split('\n').filter(Boolean);
    if (lines.length === 0) return undefined;
    const toolCounts: Record<string, number> = {};
    let allowed = 0, blocked = 0;
    for (const line of lines) {
      const tm = line.match(/tool=(\S+)/);
      const vm = line.match(/verdict=(ALLOWED|BLOCKED)/i);
      if (tm) toolCounts[tm[1]] = (toolCounts[tm[1]] ?? 0) + 1;
      if (vm) { if (vm[1].toUpperCase() === 'ALLOWED') allowed++; else blocked++; }
    }
    const top5 = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tool, count]) => ({ tool, count }));
    return { toolCounts, allowed, blocked, top5 };
  } catch { return undefined; }
}

export function buildAnalytics(task: TaskState, timings?: PhaseTimingsResult): AnalyticsResult {
  const docsDir = task.docsDir ?? ('docs/workflows/' + task.taskName);
  const toonErrors = readErrorToon(docsDir);
  const metrics = getTaskMetrics(task.taskId);
  const errorAnalysis = buildErrorAnalysis(task, toonErrors, metrics ?? undefined);
  const bottlenecks = findBottlenecks(errorAnalysis, timings);
  if (timings) {
    const outliers = detectOutliers(timings.phaseTimings);
    if (outliers.length > 0) bottlenecks.outlierPhases = outliers;
  }
  const advice = generateAdvice(errorAnalysis, timings);
  const hookObsStats = parseHookObsLog();
  const history: ErrorHistoryEntry[] = [];
  for (const entry of toonErrors) {
    for (const check of entry.checks) {
      history.push({ phase: entry.phase, retryCount: entry.retryCount, check: check.name,
        level: check.level ?? 'L1', passed: check.passed, evidence: check.message ?? '' });
    }
  }
  const classEntries = toonErrors.map(e => ({ phase: e.phase, checks: e.checks.map(c => ({ name: c.name, passed: c.passed })) }));
  const ec = classifyErrors(classEntries);
  const hasClass = ec.recurring.length > 0 || ec.cascading.length > 0 || ec.oneOff.length > 0;
  return { errorAnalysis, errorHistory: history, bottlenecks, advice,
    ...(hookObsStats ? { hookObsStats } : {}), ...(hasClass ? { errorClassification: ec } : {}) };
}
