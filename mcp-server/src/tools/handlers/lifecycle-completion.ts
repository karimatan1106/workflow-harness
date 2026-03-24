/**
 * Task completion handling: analytics, metrics, follow-up, ADR generation.
 * Extracted from lifecycle-next to stay under 200-line limit.
 * @spec docs/spec/features/workflow-harness.md
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProjectPath } from '../../utils/project-root.js';
import { runCuratorCycle } from '../curator.js';
import { recordTaskCompletion, getTaskMetrics } from '../metrics.js';
import { readProgressJSON } from '../../state/progress-json.js';
import { buildPhaseTimings } from '../phase-timings.js';
import { buildAnalytics } from '../phase-analytics.js';
import { writeAnalyticsToon } from '../analytics-toon.js';
import { writeMetricsToon } from '../metrics-toon.js';
import { generateTaskAdr } from '../adr-generator.js';

export function handleTaskCompletion(
  responseObj: Record<string, unknown>,
  taskId: string,
  freshTask: any,
): void {
  try { recordTaskCompletion(taskId); } catch { /* non-blocking */ }
  try {
    const r = runCuratorCycle(taskId, freshTask.taskName);
    responseObj.curatorReport = {
      lessonsBefore: r.lessonsBefore,
      lessonsAfter: r.lessonsAfter,
      actionCount: r.actions.length,
    };
  } catch { /* non-blocking */ }
  generateCompletionAnalytics(responseObj, freshTask);
  generateCompletionMetrics(responseObj, taskId, freshTask);
  generateFollowUpTests(responseObj, freshTask);
  generateCompletionAdr(responseObj, freshTask);
}

function generateCompletionAnalytics(
  responseObj: Record<string, unknown>,
  freshTask: any,
): void {
  try {
    const progress = readProgressJSON(freshTask.docsDir);
    if (progress && freshTask.createdAt) {
      const timingsResult = buildPhaseTimings(
        freshTask.createdAt, progress, 'completed',
      );
      const analytics = buildAnalytics(freshTask, timingsResult);
      const toonPath = writeAnalyticsToon(
        freshTask.docsDir, freshTask.taskName, freshTask.taskId,
        analytics, timingsResult,
      );
      responseObj.analyticsFile = toonPath;
      responseObj.totalElapsed = timingsResult.totalElapsed;
    }
  } catch { /* non-blocking */ }
}

function generateCompletionMetrics(
  responseObj: Record<string, unknown>,
  taskId: string,
  freshTask: any,
): void {
  try {
    const taskMetrics = getTaskMetrics(taskId);
    if (taskMetrics) writeMetricsToon(freshTask.docsDir, taskMetrics);
  } catch { /* non-blocking */ }
}

function generateFollowUpTests(
  responseObj: Record<string, unknown>,
  freshTask: any,
): void {
  try {
    if (!freshTask.baseline || freshTask.baseline.failedTests.length === 0) return;
    const followUpDir = resolveProjectPath(freshTask.docsDir);
    mkdirSync(followUpDir, { recursive: true });
    const now = new Date().toISOString();
    const lines = [
      '## follow-up',
      `taskId: ${freshTask.taskId}`,
      `taskName: ${freshTask.taskName}`,
      `generatedAt: ${now}`,
      `type: pre-existing-test-failures`,
      `count: ${freshTask.baseline.failedTests.length}`,
      '',
      `failedTests: ${freshTask.baseline.failedTests.join('; ')}`,
      '',
      '## action',
      'These tests were already failing before the task started.',
      'They should be investigated and fixed in a separate task.',
    ];
    const followUpPath = join(followUpDir, 'follow-up-tests.md');
    writeFileSync(followUpPath, lines.join('\n') + '\n', 'utf8');
    responseObj.followUpFile = followUpPath;
  } catch { /* non-blocking */ }
}

function generateCompletionAdr(
  responseObj: Record<string, unknown>,
  freshTask: any,
): void {
  try {
    const adrPath = generateTaskAdr(freshTask);
    if (adrPath) responseObj.adrFile = adrPath;
  } catch { /* non-blocking */ }
}
