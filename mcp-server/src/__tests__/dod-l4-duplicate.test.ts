/**
 * DoD gate tests: L4 duplicate line detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runDoDChecks } from '../gates/dod.js';
import { createTempDir, removeTempDir, makeMinimalState, buildValidArtifact } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

/**
 * Build a TOON file with N identical decision rows (same id, statement, rationale).
 * This produces N identical raw lines in the TOON text, triggering duplicate detection.
 */
function buildToonWithDuplicateRows(count: number): string {
  const dupRow = '  DUP-001,This exact duplicate line appears multiple times in the document and is very problematic,Duplicate rationale text for testing purposes only';
  const rows = Array(count).fill(dupRow).join('\n');
  return [
    'phase: research',
    'taskId: test-task-id',
    'ts: "2026-03-01T00:00:00Z"',
    `decisions[${count}]{id,statement,rationale}:`,
    rows,
    'artifacts[1]{path,role,summary}:',
    '  docs/output.toon,spec,Primary output artifact for this phase containing all decisions',
    'next:',
    '  criticalDecisions[1]: DUP-001',
    '  readFiles[1]: docs/output.toon',
    '  warnings[0]:',
  ].join('\n');
}

// ─── L4: Duplicate Line Detection ─────────────────

describe('L4 duplicate line detection', () => {
  it('fails L4 when the same non-structural line appears 3 or more times', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.toon'), buildToonWithDuplicateRows(3), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('3x');
  });

  it('does NOT fail L4 when a line appears only twice', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.toon'), buildToonWithDuplicateRows(2), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });

  it('does NOT flag structural TOON lines as duplicates even when repeated', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });

  it('does NOT flag short separator lines as duplicates', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    // Valid TOON content with no duplicates should always pass
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });
});
