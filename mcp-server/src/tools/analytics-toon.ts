/**
 * TOON writer for phase analytics — outputs analysis to .toon file.
 * @spec docs/spec/features/workflow-harness.md
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import type { AnalyticsResult, ErrorHistoryEntry } from './phase-analytics.js';
import type { PhaseTimingsResult } from './phase-timings.js';
import type { OutlierResult } from '../analytics/outlier-detection.js';
import type { ErrorClassification } from '../analytics/error-classification.js';
import { toonEncode } from '../state/toon-io-adapter.js';

export function writeAnalyticsToon(
  docsDir: string,
  taskName: string,
  taskId: string,
  analytics: AnalyticsResult,
  timings?: PhaseTimingsResult,
): string {
  const result = {
    phase: 'analytics',
    task: taskName,
    taskId,
    generatedAt: new Date().toISOString(),
    ...(timings ? {
      totalElapsed: `${timings.totalElapsed.seconds}s`,
      phaseTimings: Object.fromEntries(
        Object.entries(timings.phaseTimings).map(([phase, t]) => [
          phase, { duration: `${t.seconds}s`, current: !!t.current },
        ]),
      ),
    } : {}),
    errorAnalysis: analytics.errorAnalysis.map(e => ({
      phase: e.phase,
      retries: e.retries,
      topFailure: e.failures.length > 0
        ? `${e.failures[0].check}(${e.failures[0].level}) x${e.failures[0].count}`
        : 'none',
    })),
    errorHistory: (analytics.errorHistory ?? []).map(h => ({
      phase: h.phase,
      retry: h.retryCount,
      check: h.check,
      level: h.level,
      passed: h.passed,
      evidence: h.evidence,
    })),
    bottlenecks: {
      ...(analytics.bottlenecks.slowestPhase ? {
        slowestPhase: `${analytics.bottlenecks.slowestPhase.phase} (${analytics.bottlenecks.slowestPhase.seconds}s)`,
      } : {}),
      ...(analytics.bottlenecks.mostRetried ? {
        mostRetriedPhase: `${analytics.bottlenecks.mostRetried.phase} (${analytics.bottlenecks.mostRetried.retries} retries)`,
      } : {}),
      ...(analytics.bottlenecks.mostFailedCheck ? {
        mostFailedCheck: `${analytics.bottlenecks.mostFailedCheck.check} (${analytics.bottlenecks.mostFailedCheck.count} failures)`,
      } : {}),
    },
    advice: analytics.advice,
    ...(analytics.bottlenecks.outlierPhases?.length ? {
      outlierPhases: analytics.bottlenecks.outlierPhases.map(o => ({
        phase: o.phase,
        seconds: o.seconds,
        iqrScore: Math.round(o.iqrScore * 100) / 100,
      })),
    } : {}),
    ...(analytics.errorClassification ? {
      errorClassification: {
        recurring: analytics.errorClassification.recurring,
        cascading: analytics.errorClassification.cascading,
        oneOff: analytics.errorClassification.oneOff,
      },
    } : {}),
    ...(analytics.hookObsStats ? {
      hookStats: {
        totalCalls: analytics.hookObsStats.allowed + analytics.hookObsStats.blocked,
        allowed: analytics.hookObsStats.allowed,
        blocked: analytics.hookObsStats.blocked,
        topTools: analytics.hookObsStats.top5,
      },
    } : {}),
  };
  const content = toonEncode(result);
  const outPath = join(docsDir, 'phase-analytics.toon');
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, content, 'utf-8');
  return outPath;
}
