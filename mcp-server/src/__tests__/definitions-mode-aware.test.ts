/**
 * @spec F-201 / AC-1
 * buildSubagentPrompt mode-aware input filter (TDD Red).
 *
 * Goal: when state.mode is set (e.g. 'small'), the prompt's `in:` line
 * (and any artifact-first ACE block) must omit references to skipped-phase
 * artifacts. Without `state`, behavior must be unchanged (back-compat).
 */

import { describe, it, expect } from 'vitest';

import { buildSubagentPrompt } from '../phases/definitions.js';
import type { TaskState } from '../state/types.js';

const TASK_NAME = 'mode-aware-test';
const DOCS_DIR = '/tmp/mode-aware-test/docs';
const WORKFLOW_DIR = '/tmp/mode-aware-test/.workflow';
const USER_INTENT = 'mode-aware filter validation';
const TASK_ID = 'task-mode-aware-001';

/** Build a minimal TaskState fixture used purely to drive the filter. */
function makeStateWithMode(mode: TaskState['mode']): Partial<TaskState> {
  return {
    taskId: TASK_ID,
    taskName: TASK_NAME,
    version: 4,
    phase: 'planning',
    completedPhases: [],
    skippedPhases: [],
    size: 'large',
    riskScore: { security: 0, performance: 0, ux: 0, total: 0 },
    userIntent: USER_INTENT,
    openQuestions: [],
    notInScope: [],
    scopeFiles: [],
    scopeDirs: [],
    plannedFiles: [],
    acceptanceCriteria: [],
    rtmEntries: [],
    proofLog: [],
    invariants: [],
    checkpoint: { lastCheckpointAt: '', completedSteps: [] } as unknown as TaskState['checkpoint'],
    docsDir: DOCS_DIR,
    workflowDir: WORKFLOW_DIR,
    sessionToken: 'test-token',
    stateIntegrity: 'test-hmac',
    createdAt: '2026-04-26T00:00:00Z',
    updatedAt: '2026-04-26T00:00:00Z',
    mode,
  };
}

describe('buildSubagentPrompt mode-aware input filter', () => {
  it('TC-AC1-01: state.mode=small で planning phase の inputFiles から skipped phase 由来 (threat-model.md / impact-analysis.md / state-machine.mmd / flowchart.mmd) が消える', () => {
    // Note: 'small' mode does not yet exist in WorkflowMode; the implementation
    // is expected to introduce it (or treat any non-'full' mode as filtering).
    // For TDD Red we cast through unknown to assert the future-shape contract.
    const state = makeStateWithMode('small' as unknown as TaskState['mode']);

    const prompt = (buildSubagentPrompt as unknown as (
      phase: string,
      taskName: string,
      docsDir: string,
      workflowDir: string,
      userIntent: string,
      taskId?: string,
      projectTraits?: Record<string, boolean>,
      refinedIntent?: string,
      docPaths?: string[],
      state?: Partial<TaskState>,
    ) => string)(
      'planning',
      TASK_NAME,
      DOCS_DIR,
      WORKFLOW_DIR,
      USER_INTENT,
      TASK_ID,
      undefined,
      undefined,
      undefined,
      state,
    );

    // Skipped-phase artifacts must NOT leak into the prompt's input list.
    expect(prompt).not.toContain('threat-model.md');
    expect(prompt).not.toContain('impact-analysis.md');
    expect(prompt).not.toContain('state-machine.mmd');
    expect(prompt).not.toContain('flowchart.mmd');
  });

  it('TC-AC1-02: state を渡さない時 従来通り全 inputFiles が保持される (後方互換)', () => {
    const prompt = buildSubagentPrompt(
      'planning',
      TASK_NAME,
      DOCS_DIR,
      WORKFLOW_DIR,
      USER_INTENT,
      TASK_ID,
    );

    // planning phase の inputFiles は ['{docsDir}/requirements.md', '{docsDir}/threat-model.md']
    // state 未指定なら従来通りどちらも prompt に含まれる
    expect(prompt).toContain('requirements.md');
    expect(prompt).toContain('threat-model.md');
  });
});
