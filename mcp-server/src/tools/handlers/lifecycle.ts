/**
 * Lifecycle handlers: harness_start, harness_status, harness_next.
 * @spec docs/spec/features/workflow-harness.md
 */

import { execSync } from 'node:child_process';
import { existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProjectPath } from '../../utils/project-root.js';
import type { StateManager } from '../../state/manager.js';
import { runDoDChecks } from '../../gates/dod.js';
import { PHASE_REGISTRY } from '../../phases/registry.js';
import { getPhaseDefinition } from '../../phases/definitions.js';
import { buildRetryPrompt, type RetryContext } from '../retry.js';
import { stashFailure, promoteStashedFailure } from '../reflector.js';
import { runCuratorCycle } from '../curator.js';
import { respond, respondError, validateSession, buildPhaseGuide, PHASE_APPROVAL_GATES, PARALLEL_GROUPS, type HandlerResult } from '../handler-shared.js';
import { recordPhaseStart, recordPhaseEnd, recordRetry, recordDoDFailure, recordTaskCompletion } from '../metrics.js';
import { readProgressJSON } from '../../state/progress-json.js';
import { writeAllowedToolsFile } from '../../state/manager-lifecycle.js';
import { buildPhaseTimings, type PhaseTimingsResult } from '../phase-timings.js';
import { buildAnalytics } from '../phase-analytics.js';
import { writeAnalyticsToon } from '../analytics-toon.js';
import { appendErrorToon } from '../error-toon.js';
import { writeMetricsToon } from '../metrics-toon.js';
import { getTaskMetrics } from '../metrics.js';

const AMBIGUOUS_PATTERNS = [
  'とか', 'いい感じ', '適当に', 'よしなに', 'なんか', 'てきとう',
  'ちょっと', 'いろいろ', 'そのへん', 'うまく', 'ざっくり',
];

export async function handleHarnessStart(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskName = String(args.taskName ?? '');
  const userIntent = String(args.userIntent ?? '');
  if (!taskName) return respondError('taskName is required');
  if (userIntent.length < 20) return respondError('userIntent must be at least 20 characters long. Please provide a more specific description of what you want to accomplish.');
  const ambiguousFound = AMBIGUOUS_PATTERNS.filter(p => userIntent.includes(p));
  if (ambiguousFound.length !== 0) {
    return respondError(`userIntent contains ambiguous expressions: ${ambiguousFound.join(', ')}. ` +
      'Please replace with specific descriptions. Example: instead of "いい感じに修正", ' +
      'use "ログイン画面のバリデーションエラーメッセージを日本語に変更し、入力フィールドの枠線を赤く表示する"');
  }
  const files = Array.isArray(args.files) ? (args.files as string[]) : [];
  const dirs = Array.isArray(args.dirs) ? (args.dirs as string[]) : [];
  const task = sm.createTask(taskName, userIntent, files, dirs);
  // S1-3 PF-2: warn if git working tree is dirty
  let gitWarning: string | undefined;
  try {
    const dirty = execSync('git status --porcelain', { encoding: 'utf8', timeout: 3000 }).trim();
    if (dirty) gitWarning = `Git working tree has uncommitted changes (${dirty.split('\n').length} file(s)). Consider committing or stashing before starting a workflow.`;
  } catch { /* not in a git repo or git not available */ }
  try { recordPhaseStart(task.taskId, task.taskName, task.phase); } catch { /* non-blocking */ }
  try { writeAllowedToolsFile(task.phase); } catch (e) { console.error('writeAllowedToolsFile failed:', e); }
  return respond({ taskId: task.taskId, taskName: task.taskName, phase: task.phase, size: task.size, docsDir: task.docsDir, workflowDir: task.workflowDir, sessionToken: task.sessionToken, ...(gitWarning ? { gitWarning } : {}) });
}

export async function handleHarnessStatus(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = args.taskId ? String(args.taskId) : undefined;
  if (taskId) {
    const task = sm.loadTask(taskId);
    if (!task) return respondError('Task not found: ' + taskId);
    const verbose = Boolean(args.verbose ?? false);
    const core: Record<string, unknown> = {
      taskId: task.taskId, taskName: task.taskName, phase: task.phase, size: task.size,
      docsDir: task.docsDir, workflowDir: task.workflowDir, sessionToken: task.sessionToken,
    };
    if (task.integrityWarning) core.integrityWarning = true;
    if ((task as any).projectTraits) core.projectTraits = (task as any).projectTraits;
    if ((task as any).docPaths) core.docPaths = (task as any).docPaths;
    if (!verbose) return respond(core);
    const verboseData: Record<string, unknown> = {
      ...core, completedPhases: task.completedPhases, skippedPhases: task.skippedPhases,
      subPhaseStatus: task.subPhaseStatus, userIntent: task.userIntent,
      scopeFiles: task.scopeFiles, scopeDirs: task.scopeDirs, scopeGlob: task.scopeGlob,
      acceptanceCriteria: task.acceptanceCriteria, rtmEntries: task.rtmEntries,
      baseline: task.baseline, testFiles: task.testFiles, createdAt: task.createdAt, updatedAt: task.updatedAt,
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
    // Phase analytics → TOON file (non-blocking)
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

export async function handleHarnessNext(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const forceTransition = Boolean(args.forceTransition ?? false);
  const retryCount = Number(args.retryCount ?? 1);
  if (retryCount >= 1) {
    const currentRetry = sm.getRetryCount(taskId, task.phase);
    if (currentRetry >= 5) {
      return respondError('Retry limit reached (5 attempts) for phase "' + task.phase + '". ' +
        'Please ask the user for guidance. If the same validation error recurs 3+ times, ' +
        'suspect a validator bug (VDB-1) and diagnose the validator before retrying.');
    }
    sm.incrementRetryCount(taskId, task.phase);
  }
  if (!forceTransition) {
    const requiredApproval = PHASE_APPROVAL_GATES[task.phase];
    if (requiredApproval && !(task.approvals && task.approvals[requiredApproval])) {
      return respondError('Phase "' + task.phase + '" requires approval (type: "' + requiredApproval + '") before advancing. Call harness_approve first.');
    }
  }
  const docsDir: string = task.docsDir ?? ('docs/workflows/' + task.taskName);
  // P2+P4: output file existence + size pre-check before DoD
  if (!forceTransition) {
    const phaseConfig = PHASE_REGISTRY[task.phase as keyof typeof PHASE_REGISTRY];
    if (phaseConfig?.outputFile) {
      const outPath = resolveProjectPath(phaseConfig.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', task.workflowDir ?? ''));
      if (!existsSync(outPath)) {
        return respondError('成果物ファイルが存在しません: ' + outPath + '. フェーズ作業を完了してから harness_next を呼び出してください。');
      }
      const fileSize = statSync(outPath).size;
      if (fileSize < 100) {
        return respondError('成果物ファイルが空または不完全です (' + fileSize + ' bytes): ' + outPath);
      }
    }
  }
  let dodResult: Awaited<ReturnType<typeof runDoDChecks>>;
  if (!forceTransition) {
    dodResult = await runDoDChecks(task, docsDir);
    if (!dodResult.passed) {
      const registryConfig = PHASE_REGISTRY[task.phase as keyof typeof PHASE_REGISTRY];
      const retryCtx: RetryContext = { phase: task.phase, taskName: task.taskName, docsDir, retryCount, errorMessage: dodResult.errors.join('\n'), model: registryConfig?.model ?? null };
      const retryResult = buildRetryPrompt(retryCtx, dodResult.checks);
      try { stashFailure(taskId, task.phase, dodResult.errors.join('\n'), retryCount); } catch { /* non-blocking */ }
      try { recordRetry(taskId, task.phase, dodResult.errors.join('\n')); recordDoDFailure(taskId, task.phase, dodResult.errors); } catch { /* non-blocking */ }
      try { appendErrorToon(docsDir, { timestamp: new Date().toISOString(), phase: task.phase, retryCount, errors: dodResult.errors, checks: dodResult.checks.map(c => ({ name: c.check, passed: c.passed, message: c.evidence })) }); } catch { /* non-blocking */ }
      // VDB-1: Suspect validator bug after 3+ retries on same phase
      const vdb1Warning = retryCount >= 3
        ? `VDB-1: Phase "${task.phase}" failed ${retryCount} times. Same validation error recurring. Diagnose the validator before retrying. Check if the DoD check itself has a bug.`
        : undefined;
      return respond({ error: 'DoD checks failed. Fix the following issues before advancing.', dodChecks: dodResult.checks, errors: dodResult.errors, retry: { retryPrompt: retryResult.prompt, suggestModelEscalation: retryResult.suggestModelEscalation, suggestedModel: retryResult.suggestedModel }, ...(vdb1Warning ? { vdb1Warning } : {}) });
    }
  } else {
    dodResult = { passed: true, checks: [], errors: [] };
  }
  if (retryCount > 1) { try { promoteStashedFailure(taskId, task.phase, retryCount); } catch { /* non-blocking */ } }
  try { recordPhaseEnd(taskId, task.phase); } catch { /* non-blocking */ }
  sm.resetRetryCount(taskId, task.phase);
  const result = sm.advancePhase(taskId);
  if (!result.success) return respondError(result.error ?? 'Failed to advance phase');
  const nextPhase = result.nextPhase ?? '';
  const guide = buildPhaseGuide(nextPhase);
  const freshTask = sm.loadTask(taskId);
  const responseObj: Record<string, unknown> = { nextPhase, phaseGuide: guide, hasTemplate: !!getPhaseDefinition(nextPhase) };
  if (PARALLEL_GROUPS[nextPhase]) {
    responseObj.parallelSubPhases = PARALLEL_GROUPS[nextPhase].map(subPhase => ({ subPhase, model: PHASE_REGISTRY[subPhase as keyof typeof PHASE_REGISTRY]?.model ?? null }));
  }
  try { recordPhaseStart(taskId, freshTask?.taskName ?? '', nextPhase); } catch { /* non-blocking */ }
  if (nextPhase) { try { writeAllowedToolsFile(nextPhase as Parameters<typeof writeAllowedToolsFile>[0]); } catch (e) { console.error('writeAllowedToolsFile failed:', e); } }
  if (nextPhase === 'completed' && freshTask) {
    try { recordTaskCompletion(taskId); } catch { /* non-blocking */ }
    try { const r = runCuratorCycle(taskId, freshTask.taskName); responseObj.curatorReport = { lessonsBefore: r.lessonsBefore, lessonsAfter: r.lessonsAfter, actionCount: r.actions.length }; } catch { /* non-blocking */ }
    // Auto-generate phase-analytics.toon on task completion
    try {
      const progress = readProgressJSON(freshTask.docsDir);
      if (progress && freshTask.createdAt) {
        const timingsResult = buildPhaseTimings(freshTask.createdAt, progress, nextPhase);
        const analytics = buildAnalytics(freshTask, timingsResult);
        const toonPath = writeAnalyticsToon(
          freshTask.docsDir, freshTask.taskName, freshTask.taskId, analytics, timingsResult,
        );
        responseObj.analyticsFile = toonPath;
        responseObj.totalElapsed = timingsResult.totalElapsed;
      }
    } catch { /* non-blocking — omit analytics if unavailable */ }
    // Write phase-metrics.toon on completion
    try {
      const taskMetrics = getTaskMetrics(taskId);
      if (taskMetrics) {
        writeMetricsToon(freshTask.docsDir, taskMetrics);
      }
    } catch { /* non-blocking */ }
    // Generate follow-up TOON for pre-existing test failures
    try {
      if (freshTask.baseline && freshTask.baseline.failedTests.length > 0) {
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
        const followUpPath = join(followUpDir, 'follow-up-tests.toon');
        writeFileSync(followUpPath, lines.join('\n') + '\n', 'utf8');
        responseObj.followUpFile = followUpPath;
      }
    } catch { /* non-blocking */ }
  }
  return respond(responseObj);
}
