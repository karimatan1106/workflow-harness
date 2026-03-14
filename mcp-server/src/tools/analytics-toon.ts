/**
 * TOON writer for phase analytics — outputs analysis to .toon file.
 * @spec docs/spec/features/workflow-harness.md
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import type { AnalyticsResult, PhaseErrorStats } from './phase-analytics.js';
import type { PhaseTimingsResult } from './phase-timings.js';

// ─── TOON Line Builders ─────────────────────────

function esc(v: string): string {
  return v.includes(',') || v.includes('"') ? `"${v}"` : v;
}

function headerBlock(taskName: string, taskId: string): string {
  return [
    'phase: analytics',
    `task: ${esc(taskName)}`,
    `taskId: ${taskId}`,
    `generatedAt: ${new Date().toISOString()}`,
  ].join('\n');
}

function timingsBlock(timings: PhaseTimingsResult): string {
  const lines: string[] = ['', `totalElapsed: ${timings.totalElapsed.display}`];
  const entries = Object.entries(timings.phaseTimings);
  if (entries.length === 0) return lines.join('\n');
  lines.push('', `phaseTimings[${entries.length}]{phase,duration,current}:`);
  for (const [phase, t] of entries) {
    lines.push(`  ${phase}, ${t.display}, ${!!t.current}`);
  }
  return lines.join('\n');
}

function errorBlock(errors: PhaseErrorStats[]): string {
  if (errors.length === 0) return '';
  const lines: string[] = ['', `errorAnalysis[${errors.length}]{phase,retries,topFailure}:`];
  for (const e of errors) {
    const top = e.failures.length > 0
      ? `${e.failures[0].check}(${e.failures[0].level}) x${e.failures[0].count}`
      : 'none';
    lines.push(`  ${e.phase}, ${e.retries}, ${esc(top)}`);
  }
  return lines.join('\n');
}

function bottleneckBlock(a: AnalyticsResult): string {
  const b = a.bottlenecks;
  if (!b.slowestPhase && !b.mostRetried && !b.mostFailedCheck) return '';
  const lines: string[] = ['', 'bottlenecks:'];
  if (b.slowestPhase) lines.push(`  slowestPhase: ${b.slowestPhase.phase} (${b.slowestPhase.display})`);
  if (b.mostRetried) lines.push(`  mostRetriedPhase: ${b.mostRetried.phase} (${b.mostRetried.retries} retries)`);
  if (b.mostFailedCheck) lines.push(`  mostFailedCheck: ${b.mostFailedCheck.check} (${b.mostFailedCheck.count} failures)`);
  return lines.join('\n');
}

function adviceBlock(advice: string[]): string {
  if (advice.length === 0) return '';
  const lines: string[] = ['', `advice[${advice.length}]:`];
  for (const a of advice) lines.push(`  ${esc(a)}`);
  return lines.join('\n');
}

function hookBlock(a: AnalyticsResult): string {
  const h = a.hookObsStats;
  if (!h) return '';
  const total = h.allowed + h.blocked;
  const lines: string[] = [
    '', 'hookStats:',
    `  totalCalls: ${total}`,
    `  allowed: ${h.allowed}`,
    `  blocked: ${h.blocked}`,
  ];
  if (h.top5.length > 0) {
    lines.push(`  topTools[${h.top5.length}]{tool,count}:`);
    for (const t of h.top5) lines.push(`    ${t.tool}, ${t.count}`);
  }
  return lines.join('\n');
}

// ─── Public API ──────────────────────────────────

export function writeAnalyticsToon(
  docsDir: string,
  taskName: string,
  taskId: string,
  analytics: AnalyticsResult,
  timings?: PhaseTimingsResult,
): string {
  const parts: string[] = [headerBlock(taskName, taskId)];
  if (timings) parts.push(timingsBlock(timings));
  parts.push(errorBlock(analytics.errorAnalysis));
  parts.push(bottleneckBlock(analytics));
  parts.push(adviceBlock(analytics.advice));
  parts.push(hookBlock(analytics));
  const content = parts.filter(Boolean).join('\n') + '\n';
  const outPath = join(docsDir, 'phase-analytics.toon');
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, content, 'utf-8');
  return outPath;
}
