/**
 * Lifecycle handlers: harness_start, harness_status.
 * @spec docs/spec/features/workflow-harness.md
 */

import { execSync } from 'node:child_process';
import type { StateManager } from '../../state/manager.js';
import type { TaskSize } from '../../state/types.js';
import { PHASE_REGISTRY } from '../../phases/registry.js';
import { respond, respondError, buildPhaseGuide, type HandlerResult } from '../handler-shared.js';
import { recordPhaseStart } from '../metrics.js';
import { readProgressJSON } from '../../state/progress-json.js';
import { writeAllowedToolsFile } from '../../state/manager-lifecycle.js';
import { buildPhaseTimings, type PhaseTimingsResult } from '../phase-timings.js';
import { buildAnalytics } from '../phase-analytics.js';
import { writeAnalyticsToon } from '../analytics-toon.js';
import { initTraceFile } from '../../observability/trace-writer.js';

const AMBIGUOUS_PATTERNS = [
  'とか', 'いい感じ', '適当に', 'よしなに', 'なんか', 'てきとう',
  'ちょっと', 'いろいろ', 'そのへん', 'うまく', 'ざっくり',
];

export async function handleHarnessStart(
  args: Record<string, unknown>,
  sm: StateManager,
): Promise<HandlerResult> {
  const taskName = String(args.taskName ?? '');
  const userIntent = String(args.userIntent ?? '');
  if (!taskName) return respondError('taskName is required');
  if (userIntent.length < 20) {
    return respondError(
      'userIntent must be at least 20 characters long. '
      + 'Please provide a more specific description of what you want to accomplish.',
    );
  }
  const ambiguousFound = AMBIGUOUS_PATTERNS.filter(p => userIntent.includes(p));
  if (ambiguousFound.length !== 0) {
    return respondError(
      `userIntent contains ambiguous expressions: ${ambiguousFound.join(', ')}. `
      + 'Please replace with specific descriptions. Example: instead of "いい感じに修正", '
      + 'use "ログイン画面のバリデーションエラーメッセージを日本語に変更し、入力フィールドの枠線を赤く表示する"',
    );
  }
  const files = Array.isArray(args.files) ? (args.files as string[]) : [];
  const dirs = Array.isArray(args.dirs) ? (args.dirs as string[]) : [];
  const size: TaskSize = 'large'; // Always force large — small/medium abolished
  // GC abandoned tasks (created == updated, older than 24h)
  let gcCount = 0;
  try { gcCount = sm.gcAbandonedTasks(); } catch { /* non-blocking */ }
  const task = sm.createTask(taskName, userIntent, files, dirs, size);
  try {
    initTraceFile(task.docsDir + '/observability-trace.toon', task.taskId);
  } catch { /* non-blocking: trace init failure must not stop harness */ }
  // S1-3 PF-2: warn if git working tree is dirty
  let gitWarning: string | undefined;
  try {
    const dirty = execSync('git status --porcelain', {
      encoding: 'utf8',
      timeout: 3000,
    }).trim();
    if (dirty) {
      gitWarning = `Git working tree has uncommitted changes (${dirty.split('\n').length} file(s)). `
        + 'Consider committing or stashing before starting a workflow.';
    }
  } catch { /* not in a git repo or git not available */ }
  try {
    recordPhaseStart(task.taskId, task.taskName, task.phase);
  } catch { /* non-blocking */ }
  try {
    writeAllowedToolsFile(task.phase);
  } catch (e) { console.error('writeAllowedToolsFile failed:', e); }
  return respond({
    taskId: task.taskId, taskName: task.taskName,
    phase: task.phase, size: task.size,
    docsDir: task.docsDir, workflowDir: task.workflowDir,
    sessionToken: task.sessionToken,
    ...(gitWarning ? { gitWarning } : {}),
    ...(gcCount > 0 ? { gcCleaned: gcCount } : {}),
  });
}

export async function handleHarnessStatus(
  args: Record<string, unknown>,
  sm: StateManager,
): Promise<HandlerResult> {
  const taskId = args.taskId ? String(args.taskId) : undefined;
  if (taskId) {
    const task = sm.loadTask(taskId);
    if (!task) return respondError('Task not found: ' + taskId);
    const verbose = Boolean(args.verbose ?? false);
    const core: Record<string, unknown> = {
      taskId: task.taskId, taskName: task.taskName,
      phase: task.phase, size: task.size,
      docsDir: task.docsDir, workflowDir: task.workflowDir,
      sessionToken: task.sessionToken,
    };
    // Add expectedOutputFile for current phase
    const statusPhaseConfig = PHASE_REGISTRY[task.phase as keyof typeof PHASE_REGISTRY];
    if (statusPhaseConfig?.outputFile) {
      const resolvedDocsDir = task.docsDir ?? ('docs/workflows/' + task.taskName);
      core.expectedOutputFile = statusPhaseConfig.outputFile
        .replace('{docsDir}', resolvedDocsDir)
        .replace('{workflowDir}', task.workflowDir ?? '');
    }
    if (task.integrityWarning) core.integrityWarning = true;
    if ((task as any).projectTraits) core.projectTraits = (task as any).projectTraits;
    if ((task as any).docPaths) core.docPaths = (task as any).docPaths;
    if (!verbose) return respond(core);
    const verboseData: Record<string, unknown> = {
      ...core, completedPhases: task.completedPhases,
      skippedPhases: task.skippedPhases,
      subPhaseStatus: task.subPhaseStatus, userIntent: task.userIntent,
      scopeFiles: task.scopeFiles, scopeDirs: task.scopeDirs,
      scopeGlob: task.scopeGlob,
      acceptanceCriteria: task.acceptanceCriteria,
      rtmEntries: task.rtmEntries,
      baseline: task.baseline, testFiles: task.testFiles,
      createdAt: task.createdAt, updatedAt: task.updatedAt,
    };
    // Phase timings from progress-json (non-blocking)
    let timingsResult: PhaseTimingsResult | undefined;
    try {
      const progress = readProgressJSON(task.docsDir);
      if (progress && task.createdAt) {
        timingsResult = buildPhaseTimings(task.createdAt, progress, task.phase);
        verboseData.phaseTimings = timingsResult.phaseTimings;
        verboseData.totalElapsed = timingsResult.totalElapsed;
      }
    } catch { /* non-blocking — omit timings if unavailable */ }
    // Phase analytics -> TOON file (non-blocking)
    try {
      const analytics = buildAnalytics(task, timingsResult);
      const toonPath = writeAnalyticsToon(
        task.docsDir, task.taskName, task.taskId, analytics, timingsResult,
      );
      verboseData.analyticsFile = toonPath;
    } catch { /* non-blocking — omit analytics if unavailable */ }
    return respond(verboseData);
  }
  return respond({ tasks: sm.listTasks() });
}
