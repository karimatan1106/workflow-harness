/**
 * Approval handler: harness_approve.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { StateManager } from '../../state/manager.js';
import { respond, respondError, validateSession, PHASE_APPROVAL_GATES, type HandlerResult } from '../handler-shared.js';

const APPROVAL_ARTIFACT_MAP: Record<string, string> = {
  requirements: '/requirements.toon', design: '/design-review.toon',
  test_design: '/test-design.toon', code_review: '/code-review.toon',
};

export async function handleHarnessApprove(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const approvalType = String(args.type ?? '');
  if (!taskId) return respondError('taskId is required');
  if (!approvalType) return respondError('type is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const expectedGate = PHASE_APPROVAL_GATES[task.phase];
  if (!expectedGate) {
    return respondError('Current phase ' + JSON.stringify(task.phase) +
      ' does not have an approval gate. Expected one of: ' + Object.keys(PHASE_APPROVAL_GATES).join(', '));
  }
  if (expectedGate !== approvalType) {
    return respondError('Approval type ' + JSON.stringify(approvalType) +
      ' does not match current phase gate ' + JSON.stringify(expectedGate) + ' (phase: ' + task.phase + ')');
  }
  // IA-1: Block requirements approval when OPEN_QUESTIONS exist (TOON format)
  if (approvalType === 'requirements' && task.docsDir) {
    try {
      const { decode: toonDec } = await import('@toon-format/toon');
      const reqPath = task.docsDir + '/requirements.toon';
      if (existsSync(reqPath)) {
        const toon = toonDec(readFileSync(reqPath, 'utf8'));
        if (typeof toon === 'object' && toon !== null && !Array.isArray(toon)) {
          const oq = (toon as Record<string, unknown>)['openQuestions'];
          const items = Array.isArray(oq) ? oq.filter(q => q && String(q) !== 'なし') : [];
          if (items.length !== 0) {
            return respondError('Cannot approve requirements: openQuestions has ' + items.length + ' item(s). ' +
              'Resolve all open questions before approving. ' +
              'Items: ' + items.slice(0, 3).map(q => typeof q === 'object' ? JSON.stringify(q) : String(q)).join('; '));
          }
        }
      }
    } catch { /* skip check on file read failure */ }
  }
  // IA-2: Block requirements approval when AC count < 3
  if (approvalType === 'requirements') {
    const acCount = task.acceptanceCriteria?.length ?? 0;
    if (acCount < 3) {
      return respondError('Cannot approve requirements: at least 3 acceptance criteria (AC-N) are required, ' +
        'but only ' + acCount + ' found. Use harness_add_ac to add more criteria.');
    }
  }
  // Generate refinedIntent from AC descriptions after IA-2 validation
  if (approvalType === 'requirements' && task.acceptanceCriteria && task.acceptanceCriteria.length >= 3) {
    sm.setRefinedIntent(taskId, task.acceptanceCriteria.map(ac => ac.description).join(' / '));
  }
  const approvalResult = sm.approveGate(taskId, approvalType);
  if (!approvalResult.success) return respondError(approvalResult.error ?? 'Failed to record approval');
  // ART-1 (S2-6): Record SHA-256 of approved artifact for drift detection
  const artSuffix = APPROVAL_ARTIFACT_MAP[approvalType];
  if (artSuffix && task.docsDir) {
    try {
      const filePath = task.docsDir + artSuffix;
      if (existsSync(filePath)) sm.recordArtifactHash(taskId, filePath, createHash('sha256').update(readFileSync(filePath)).digest('hex'));
    } catch { /* non-blocking */ }
  }
  const result = sm.advancePhase(taskId);
  if (!result.success) return respondError(result.error ?? 'Failed to advance after approval');
  return respond({ approved: true, approvalType, previousPhase: task.phase, nextPhase: result.nextPhase });
}
