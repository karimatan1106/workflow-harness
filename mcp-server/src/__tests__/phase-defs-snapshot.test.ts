/**
 * phase-defs-snapshot.test.ts — Snapshot guard for docs_update phase inputFiles.
 *
 * @spec F-004 / AC-4
 *
 * docs_update は permanent docs (planning/requirements) のみを参照すべきであり、
 * 一時ドキュメントである code-review.md を inputFiles に含めてはならない。
 *
 * 現状の registry.ts (Stage 12) と defs-stage6.ts は docs_update.inputFiles に
 * '{docsDir}/code-review.md' を含むため、この AC-4 テストは Red となる。
 */

import { describe, it, expect } from 'vitest';
import { PHASE_REGISTRY, MODE_PHASES, getPhaseConfig } from '../phases/registry.js';
import { DEFS_STAGE6 } from '../phases/defs-stage6.js';

describe('docs_update inputFiles snapshot (F-004 / AC-4)', () => {
  it('TC-AC4-01: small モード(express) docs_update.inputFiles に code-review.md を含まない', () => {
    expect(MODE_PHASES.express).toContain('docs_update');

    const cfg = getPhaseConfig('docs_update', undefined, 'express');
    const inputs = cfg.inputFiles ?? [];

    expect(inputs.some((p) => p.includes('code-review'))).toBe(false);
    expect(inputs).toEqual([
      '{docsDir}/planning.md',
      '{docsDir}/requirements.md',
    ]);
  });

  it('TC-AC4-02: standard モード docs_update.inputFiles に code-review.md を含まない', () => {
    expect(MODE_PHASES.standard).toContain('docs_update');

    const cfg = getPhaseConfig('docs_update', undefined, 'standard');
    const inputs = cfg.inputFiles ?? [];

    expect(inputs.some((p) => p.includes('code-review'))).toBe(false);
    expect(inputs).toEqual([
      '{docsDir}/planning.md',
      '{docsDir}/requirements.md',
    ]);
  });

  it('TC-AC4-03: PHASE_REGISTRY.docs_update も code-review.md を含まない', () => {
    const inputs = PHASE_REGISTRY.docs_update.inputFiles ?? [];
    expect(inputs.some((p) => p.includes('code-review'))).toBe(false);
    expect(inputs).toEqual([
      '{docsDir}/planning.md',
      '{docsDir}/requirements.md',
    ]);
  });

  it('TC-AC4-04: DEFS_STAGE6.docs_update も code-review.md を含まない', () => {
    const inputs = DEFS_STAGE6.docs_update.inputFiles ?? [];
    expect(inputs.some((p) => p.includes('code-review'))).toBe(false);
    expect(inputs).toEqual([
      '{docsDir}/planning.md',
      '{docsDir}/requirements.md',
    ]);
  });
});
