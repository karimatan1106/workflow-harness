/**
 * Metrics TOON — writes phase metrics to phase-metrics.toon.
 * Supplements phase-analytics.toon with per-phase detail.
 * @spec docs/spec/features/workflow-harness.md
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { TaskMetrics } from './metrics.js';
import { esc } from '../state/toon-helpers.js';

/**
 * Write task metrics to phase-metrics.toon.
 * Called on task completion or verbose status.
 */
export function writeMetricsToon(docsDir: string, metrics: TaskMetrics): string {
  const outPath = join(docsDir, 'phase-metrics.toon');
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const phases = Object.entries(metrics.phases);
  const lines: string[] = [
    'phase: metrics',
    `taskName: ${esc(metrics.taskName)}`,
    `startedAt: ${metrics.startedAt}`,
    `completedAt: ${metrics.completedAt ?? 'in-progress'}`,
    `totalRetries: ${metrics.retries}`,
    `totalDoDFailures: ${metrics.dodFailures}`,
  ];

  if (phases.length > 0) {
    lines.push('');
    lines.push(`phases[${phases.length}]{phase,durationSec,retries,dodFailures}:`);
    for (const [name, pm] of phases) {
      const durSec = Math.round(pm.durationMs / 1000);
      const failCount = pm.dodFailurePatterns.length;
      lines.push(`  ${name}, ${durSec}, ${pm.retries}, ${failCount}`);
    }
  }

  // DoD failure patterns detail
  const phasesWithFailures = phases.filter(([_, pm]) => pm.dodFailurePatterns.length > 0);
  if (phasesWithFailures.length > 0) {
    lines.push('');
    lines.push('dodFailurePatterns:');
    for (const [name, pm] of phasesWithFailures) {
      lines.push(`  ${name}:`);
      for (const pattern of pm.dodFailurePatterns) {
        lines.push(`    ${esc(pattern)}`);
      }
    }
  }

  lines.push('');
  const content = lines.join('\n');
  writeFileSync(outPath, content, 'utf-8');
  return outPath;
}
