/**
 * Lifecycle handler: harness_next (phase advancement with DoD checks).
 * @spec docs/spec/features/workflow-harness.md
 */

import { existsSync, statSync } from 'node:fs';
import { resolveProjectPath } from '../../utils/project-root.js';
import type { StateManager } from '../../state/manager.js';
import { runDoDChecks } from '../../gates/dod.js';
import { PHASE_REGISTRY } from '../../phases/registry.js';
import { getPhaseDefinition } from '../../phases/definitions.js';
import { buildRetryPrompt, type RetryContext } from '../retry.js';
import { stashFailure, promoteStashedFailure } from '../reflector.js';
import {
  respond, respondError, validateSession, buildPhaseGuide,
  PHASE_APPROVAL_GATES, shouldRequireApproval, PARALLEL_GROUPS,
  type HandlerResult,
} from '../handler-shared.js';
import {
  recordPhaseStart, recordPhaseEnd, recordRetry, recordDoDFailure,
} from '../metrics.js';
import { writeAllowedToolsFile } from '../../state/manager-lifecycle.js';
import { appendErrorToon } from '../error-toon.js';
import { handleTaskCompletion } from './lifecycle-completion.js';

export async function handleHarnessNext(
  args: Record<string, unknown>,
  sm: StateManager,
): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const retryCount = Number(args.retryCount ?? 1);
  if (retryCount >= 1) {
    const currentRetry = sm.getRetryCount(taskId, task.phase);
    if (currentRetry >= 5) {
      return respondError(
        'Retry limit reached (5 attempts) for phase "' + task.phase + '". '
        + 'Please ask the user for guidance. If the same validation error recurs 3+ times, '
        + 'suspect a validator bug (VDB-1) and diagnose the validator before retrying.',
      );
    }
    sm.incrementRetryCount(taskId, task.phase);
  }
  if (shouldRequireApproval(
    task.phase, task.size,
    task.acceptanceCriteria.length,
    (task as any).openQuestions?.length ?? 0,
  )) {
    const requiredApproval = PHASE_APPROVAL_GATES[task.phase];
    if (requiredApproval && !(task.approvals && task.approvals[requiredApproval])) {
      return respondError(
        'Phase "' + task.phase + '" requires approval (type: "'
        + requiredApproval + '") before advancing. Call harness_approve first.',
      );
    }
  }
  const docsDir: string = task.docsDir ?? ('docs/workflows/' + task.taskName);
  // P2+P4: output file existence + size pre-check before DoD
  const phaseConfig = PHASE_REGISTRY[task.phase as keyof typeof PHASE_REGISTRY];
  if (phaseConfig?.outputFile) {
    const outPath = resolveProjectPath(
      phaseConfig.outputFile
        .replace('{docsDir}', docsDir)
        .replace('{workflowDir}', task.workflowDir ?? ''),
    );
    if (!existsSync(outPath)) {
      return respondError(
        '成果物ファイルが存在しません: ' + outPath
        + '. フェーズ作業を完了してから harness_next を呼び出してください。',
      );
    }
    const fileSize = statSync(outPath).size;
    if (fileSize < 100) {
      return respondError(
        '成果物ファイルが空または不完全です (' + fileSize + ' bytes): ' + outPath,
      );
    }
  }
  const dodResult = await runDoDChecks(task, docsDir);
  if (!dodResult.passed) {
    return buildDoDFailureResponse(task, docsDir, retryCount, dodResult, taskId);
  }
  if (retryCount > 1) {
    try { promoteStashedFailure(taskId, task.phase, retryCount); } catch { /* non-blocking */ }
  }
  try { recordPhaseEnd(taskId, task.phase); } catch { /* non-blocking */ }
  sm.resetRetryCount(taskId, task.phase);
  const result = sm.advancePhase(taskId);
  if (!result.success) return respondError(result.error ?? 'Failed to advance phase');
  const nextPhase = result.nextPhase ?? '';
  const freshTask = sm.loadTask(taskId);
  const responseObj: Record<string, unknown> = {
    nextPhase,
    phaseGuide: buildPhaseGuide(nextPhase),
    hasTemplate: !!getPhaseDefinition(nextPhase),
  };
  addNextPhaseOutputFile(responseObj, nextPhase, freshTask, docsDir, task);
  if (PARALLEL_GROUPS[nextPhase]) {
    responseObj.parallelSubPhases = PARALLEL_GROUPS[nextPhase].map(subPhase => ({
      subPhase,
      model: PHASE_REGISTRY[subPhase as keyof typeof PHASE_REGISTRY]?.model ?? null,
    }));
  }
  try {
    recordPhaseStart(taskId, freshTask?.taskName ?? '', nextPhase);
  } catch { /* non-blocking */ }
  if (nextPhase) {
    try {
      writeAllowedToolsFile(nextPhase as Parameters<typeof writeAllowedToolsFile>[0]);
    } catch (e) { console.error('writeAllowedToolsFile failed:', e); }
  }
  if (nextPhase === 'completed' && freshTask) {
    handleTaskCompletion(responseObj, taskId, freshTask);
  }
  return respond(responseObj);
}

function buildDoDFailureResponse(
  task: any, docsDir: string, retryCount: number,
  dodResult: any, taskId: string,
): HandlerResult {
  const registryConfig = PHASE_REGISTRY[task.phase as keyof typeof PHASE_REGISTRY];
  const retryCtx: RetryContext = {
    phase: task.phase, taskName: task.taskName, docsDir, retryCount,
    errorMessage: dodResult.errors.join('\n'),
    model: registryConfig?.model ?? null,
  };
  const retryResult = buildRetryPrompt(retryCtx, dodResult.checks);
  try {
    stashFailure(taskId, task.phase, dodResult.errors.join('\n'), retryCount);
  } catch { /* non-blocking */ }
  try {
    recordRetry(taskId, task.phase, dodResult.errors.join('\n'));
    recordDoDFailure(taskId, task.phase, dodResult.errors);
  } catch { /* non-blocking */ }
  try {
    appendErrorToon(docsDir, {
      timestamp: new Date().toISOString(), phase: task.phase, retryCount,
      errors: dodResult.errors,
      checks: dodResult.checks.map((c: any) => ({
        name: c.check, passed: c.passed, message: c.evidence,
      })),
    });
  } catch { /* non-blocking */ }
  const vdb1Warning = retryCount >= 3
    ? `VDB-1: Phase "${task.phase}" failed ${retryCount} times. `
      + 'Same validation error recurring. '
      + 'Diagnose the validator before retrying. '
      + 'Check if the DoD check itself has a bug.'
    : undefined;
  return respond({
    error: 'DoD checks failed. Fix the following issues before advancing.',
    dodChecks: dodResult.checks, errors: dodResult.errors,
    retry: {
      retryPrompt: retryResult.prompt,
      suggestModelEscalation: retryResult.suggestModelEscalation,
      suggestedModel: retryResult.suggestedModel,
    },
    ...(vdb1Warning ? { vdb1Warning } : {}),
  });
}

function addNextPhaseOutputFile(
  responseObj: Record<string, unknown>, nextPhase: string,
  freshTask: any, docsDir: string, task: any,
): void {
  const nextPhaseConfig = PHASE_REGISTRY[nextPhase as keyof typeof PHASE_REGISTRY];
  if (nextPhaseConfig?.outputFile) {
    const resolvedDocsDir = freshTask?.docsDir ?? docsDir;
    responseObj.expectedOutputFile = nextPhaseConfig.outputFile
      .replace('{docsDir}', resolvedDocsDir)
      .replace('{workflowDir}', freshTask?.workflowDir ?? task.workflowDir ?? '');
  }
}
