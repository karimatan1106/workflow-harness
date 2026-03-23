/**
 * Metrics TOON — writes phase metrics to phase-metrics.toon.
 * Supplements phase-analytics.toon with per-phase detail.
 * @spec docs/spec/features/workflow-harness.md
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { TaskMetrics } from './metrics.js';
import { toonEncode } from '../state/toon-io-adapter.js';

/**
 * Write task metrics to phase-metrics.toon.
 * Called on task completion or verbose status.
 */
export function writeMetricsToon(docsDir: string, metrics: TaskMetrics): string {
  const outPath = join(docsDir, 'phase-metrics.toon');
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const phases = Object.entries(metrics.phases);
  const result = {
    phase: 'metrics',
    taskName: metrics.taskName,
    startedAt: metrics.startedAt,
    completedAt: metrics.completedAt ?? 'in-progress',
    totalRetries: metrics.retries,
    totalDoDFailures: metrics.dodFailures,
    phases: Object.fromEntries(
      phases.map(([name, pm]) => [name, {
        durationSec: Math.round(pm.durationMs / 1000),
        retries: pm.retries,
        dodFailures: pm.dodFailurePatterns.length,
      }]),
    ),
    dodFailurePatterns: Object.fromEntries(
      phases
        .filter(([_, pm]) => pm.dodFailurePatterns.length > 0)
        .map(([name, pm]) => [name, pm.dodFailurePatterns]),
    ),
  };

  const content = toonEncode(result);
  writeFileSync(outPath, content, 'utf-8');
  return outPath;
}
