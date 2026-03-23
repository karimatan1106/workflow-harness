/**
 * Shared helpers for dod.ts test files.
 * Import these into each dod-*.test.ts file.
 */

import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
 * Build a valid Markdown artifact with the specified keys and enough content
 * to pass L3 quality checks (minLines threshold via content chars).
 */
export function buildValidArtifact(keys: string[], linesPerSection: number = 20): string {
  const keyNames = keys.map(k => k.replace(/^#+\s*/, '').replace(/\s+/g, '_'));
  const lines: string[] = [];
  const count = Math.max(linesPerSection, 5);
  for (const key of keyNames) {
    lines.push(`## ${key}`);
    if (key === 'decisions') {
      for (let i = 1; i <= count; i++) {
        lines.push(`- D-${String(i).padStart(3, '0')}: Decision ${i} for ${keyNames[0]}: providing real substantive information about the topic in detail (Rationale ${i}: context and reasoning for decision ${i} in the artifact content)`);
      }
    } else if (key === 'artifacts') {
      lines.push(`- docs/output.md: spec - Primary output artifact for this phase containing all decisions`);
    } else if (key === 'next') {
      lines.push(`- criticalDecisions: ${Array.from({ length: Math.min(3, count) }, (_, j) => `D-${String(j + 1).padStart(3, '0')}`).join(', ')}`);
      lines.push(`- readFiles: docs/output.md`);
      lines.push(`- warnings: No warnings for this test artifact`);
    } else {
      for (let i = 1; i <= count; i++) {
        lines.push(`Content line ${i} for ${key}: providing real substantive information about the topic in detail`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Build a Markdown artifact for requirements phase with acceptanceCriteria, notInScope, openQuestions.
 */
export function buildValidRequirementsMd(opts: {
  acCount?: number;
  hasNotInScope?: boolean;
  hasOpenQuestions?: boolean;
  extraContent?: string;
  userIntent?: string;
}): string {
  const { acCount = 3, hasNotInScope = true, hasOpenQuestions = true } = opts;
  const lines: string[] = [];
  lines.push('## decisions');
  for (let i = 1; i <= 5; i++) {
    lines.push(`- REQ-${String(i).padStart(3, '0')}: Requirement ${i}: system shall validate input and handle errors correctly (Rationale ${i}: security and reliability require this validation step)`);
  }
  lines.push('');
  lines.push('## acceptanceCriteria');
  for (let i = 1; i <= acCount; i++) {
    lines.push(`- AC-${i}: Acceptance criterion ${i}: verifiable condition for requirement`);
  }
  lines.push('');
  if (hasNotInScope) {
    lines.push('## notInScope');
    lines.push('- Mobile application development is excluded from this scope');
    lines.push('- Third-party authentication integration is not included');
    lines.push('');
  }
  if (hasOpenQuestions) {
    lines.push('## openQuestions');
    lines.push('');
  }
  const ui = opts.userIntent ?? '';
  if (ui) {
    const kws = ui.split(/\s+/).filter(w => w.length >= 3);
    lines.push(`- REQ-KW: Keywords: ${kws.join(' ')} are all addressed in this requirements document (Intent consistency requirement)`);
    lines.push('');
  }
  lines.push('## artifacts');
  lines.push('- docs/requirements.md: spec - Requirements definition with AC and scope');
  lines.push('');
  lines.push('## next');
  lines.push('- criticalDecisions: REQ-001, REQ-002');
  lines.push('- readFiles: docs/requirements.md');
  lines.push('- warnings: No open questions remain');
  lines.push('');
  if (opts.extraContent) {
    lines.push('## additionalNotes');
    lines.push(opts.extraContent);
    lines.push('');
  }
  return lines.join('\n');
}

/** @deprecated Use buildValidRequirementsMd instead */
export const buildValidRequirementsToon = buildValidRequirementsMd;
