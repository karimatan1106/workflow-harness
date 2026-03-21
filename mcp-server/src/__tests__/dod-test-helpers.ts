/**
 * Shared helpers for dod.ts test files.
 * Import these into each dod-*.test.ts file.
 */

import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encode as toonEncode } from '@toon-format/toon';
import type { TaskState } from '../state/types.js';

export function createTempDir(): { tempDir: string; docsDir: string } {
  const tempDir = mkdtempSync(join(tmpdir(), 'dod-test-'));
  const docsDir = join(tempDir, 'docs');
  mkdirSync(docsDir, { recursive: true });
  return { tempDir, docsDir };
}

export function removeTempDir(tempDir: string): void {
  rmSync(tempDir, { recursive: true, force: true });
}

export function makeMinimalState(phase: string, workflowDir: string, docsDir: string): TaskState {
  return {
    taskId: '00000000-0000-4000-8000-000000000001',
    taskName: 'test-task',
    version: 4,
    phase: phase as any,
    completedPhases: [],
    skippedPhases: [],
    size: 'medium',
    riskScore: { total: 0, factors: { fileCount: 0, hasTests: false, hasConfig: false, hasInfra: false, hasSecurity: false, hasDatabase: false, codeLineEstimate: 0 } },
    userIntent: 'This is a test task with sufficient user intent text',
    openQuestions: [],
    notInScope: [],
    scopeFiles: [],
    scopeDirs: [],
    plannedFiles: [],
    acceptanceCriteria: [],
    rtmEntries: [],
    proofLog: [],
    invariants: [],
    checkpoint: {
      taskId: '00000000-0000-4000-8000-000000000001',
      phase: phase as any,
      completedPhases: [],
      timestamp: new Date().toISOString(),
      sha256: '',
      userIntent: 'This is a test task with sufficient user intent text',
      scopeFiles: [],
      acceptanceCriteria: [],
      rtmEntries: [],
    },
    docsDir,
    workflowDir,
    sessionToken: 'a'.repeat(64),
    stateIntegrity: 'fake-integrity-for-tests',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Build a valid TOON artifact with the specified keys and enough content
 * to pass L3 quality checks (minLines threshold via content chars).
 */
export function buildValidArtifact(keys: string[], linesPerSection: number = 20): string {
  const decisions: Array<{ id: string; statement: string; rationale: string }> = [];
  const keyNames = keys.map(k => k.replace(/^#+\s*/, '').replace(/\s+/g, '_'));
  for (let i = 1; i <= Math.max(linesPerSection, 5); i++) {
    decisions.push({
      id: `D-${String(i).padStart(3, '0')}`,
      statement: `Decision ${i} for ${keyNames[0]}: providing real substantive information about the topic in detail`,
      rationale: `Rationale ${i}: context and reasoning for decision ${i} in the artifact content`,
    });
  }
  const artifacts: Array<{ path: string; role: string; summary: string }> = [
    { path: 'docs/output.toon', role: 'spec', summary: 'Primary output artifact for this phase containing all decisions' },
  ];
  const obj: Record<string, unknown> = {
    phase: keyNames[0] ?? 'unknown',
    taskId: 'test-task-id',
    ts: new Date().toISOString(),
    decisions,
    artifacts,
    next: {
      criticalDecisions: decisions.slice(0, 3).map(d => d.id),
      readFiles: ['docs/output.toon'],
      warnings: ['No warnings for this test artifact'],
    },
  };
  return toonEncode(obj);
}

/**
 * Build a TOON artifact for requirements phase with acceptanceCriteria, notInScope, openQuestions.
 */
export function buildValidRequirementsToon(opts: {
  acCount?: number;
  hasNotInScope?: boolean;
  hasOpenQuestions?: boolean;
  extraContent?: string;
  userIntent?: string;
}): string {
  const { acCount = 3, hasNotInScope = true, hasOpenQuestions = true } = opts;
  const decisions: Array<{ id: string; statement: string; rationale: string }> = [];
  for (let i = 1; i <= 5; i++) {
    decisions.push({
      id: `REQ-${String(i).padStart(3, '0')}`,
      statement: `Requirement ${i}: system shall validate input and handle errors correctly`,
      rationale: `Rationale ${i}: security and reliability require this validation step`,
    });
  }
  const acceptanceCriteria: Array<{ id: string; criterion: string }> = [];
  for (let i = 1; i <= acCount; i++) {
    acceptanceCriteria.push({ id: `AC-${i}`, criterion: `Acceptance criterion ${i}: verifiable condition for requirement` });
  }
  const obj: Record<string, unknown> = {
    phase: 'requirements',
    taskId: 'test-task-id',
    ts: new Date().toISOString(),
    decisions,
    acceptanceCriteria,
  };
  if (hasNotInScope) {
    (obj as any).notInScope = [
      { item: 'Mobile application development is excluded from this scope' },
      { item: 'Third-party authentication integration is not included' },
    ];
  }
  if (hasOpenQuestions) {
    (obj as any).openQuestions = [];
  }
  const ui = opts.userIntent ?? '';
  if (ui) {
    const kws = ui.split(/\s+/).filter(w => w.length >= 3);
    decisions.push({
      id: 'REQ-KW',
      statement: `Keywords: ${kws.join(' ')} are all addressed in this requirements document`,
      rationale: 'Intent consistency requirement',
    });
  }
  (obj as any).artifacts = [
    { path: 'docs/requirements.toon', role: 'spec', summary: 'Requirements definition with AC and scope' },
  ];
  (obj as any).next = {
    criticalDecisions: ['REQ-001', 'REQ-002'],
    readFiles: ['docs/requirements.toon'],
    warnings: ['No open questions remain'],
  };
  if (opts.extraContent) {
    (obj as any).additionalNotes = opts.extraContent;
  }
  return toonEncode(obj);
}
