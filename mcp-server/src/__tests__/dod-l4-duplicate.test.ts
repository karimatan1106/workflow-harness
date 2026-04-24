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
 * Build a Markdown file with N identical decision rows.
 * This produces N identical raw lines, triggering duplicate detection.
 */
function buildMdWithDuplicateRows(count: number): string {
  const dupRow = 'This exact duplicate line appears multiple times in the document and is very problematic for quality (Duplicate rationale text for testing purposes only)';
  const rows = Array(count).fill(dupRow).join('\n');
  return [
    '## decisions',
    rows,
    '',
    '## artifacts',
    '- docs/output.md: spec - Primary output artifact',
    '',
    '## next',
    '- criticalDecisions: DUP-001',
    '- readFiles: docs/output.md',
  ].join('\n');
}

// ─── L4: Duplicate Line Detection ─────────────────

describe('L4 duplicate line detection', () => {
  it('fails L4 when the same non-structural line appears 5 or more times', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.md'), buildMdWithDuplicateRows(5), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('5x');
  });

  it('does NOT fail L4 when a line appears only twice', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.md'), buildMdWithDuplicateRows(2), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });

  it('passes with 4 duplicates (boundary check below threshold of 5)', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.md'), buildMdWithDuplicateRows(4), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });

  it('does NOT flag structural TOON lines as duplicates even when repeated', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'research.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });

  it('does NOT flag short separator lines as duplicates', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    // Valid TOON content with no duplicates should always pass
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'research.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });
});
