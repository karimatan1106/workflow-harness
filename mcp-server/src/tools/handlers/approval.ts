/**
 * Approval handler: harness_approve.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { StateManager } from '../../state/manager.js';
import { respond, respondError, validateSession, PHASE_APPROVAL_GATES, type HandlerResult } from '../handler-shared.js';

const APPROVAL_ARTIFACT_MAP: Record<string, string> = {
  requirements: '/requirements.md', design: '/design-review.md',
  test_design: '/test-design.md', code_review: '/code-review.md',
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
  // IA-1: Block requirements approval when OPEN_QUESTIONS exist
  if (approvalType === 'requirements' && task.docsDir) {
    try {
      const { readFileSync: readFS, existsSync: existFS } = await import('node:fs');
      const reqPath = task.docsDir + '/requirements.md';
      if (existFS(reqPath)) {
        const reqContent = readFS(reqPath, 'utf8');
        const oqMatch = reqContent.match(/##\s*OPEN_QUESTIONS[\s\S]*?(?=\n##|\n$|$)/i);
        if (oqMatch) {
          const oqLines = oqMatch[0].split('\n').slice(1).filter(l => {
            const t = l.trim();
            return t && t !== 'なし' && t !== '- なし' && !t.startsWith('##');
          });
          if (oqLines.length !== 0) {
            return respondError('Cannot approve requirements: OPEN_QUESTIONS section is non-empty (' + oqLines.length + ' items). ' +
              'Resolve all open questions with the user before approving. ' +
              'Items: ' + oqLines.slice(0, 3).map(l => l.trim()).join('; '));
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
