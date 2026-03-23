import { describe, it, expect } from 'vitest';
import { PHASE_ORDER, getNextPhase, getActivePhases } from '../phases/registry.js';

describe('Phase transition invariants - dogfooding (AC-6)', () => {
  it('TC-AC6-01: INV-1 test_impl precedes implementation in PHASE_ORDER', () => {
    const testImplIdx = PHASE_ORDER.indexOf('test_impl');
    const implIdx = PHASE_ORDER.indexOf('implementation');
    expect(testImplIdx).toBeGreaterThan(-1);
    expect(implIdx).toBeGreaterThan(-1);
    expect(testImplIdx).toBeLessThan(implIdx);
  });

  it('TC-AC6-02: INV-2 completed is terminal (no next phase)', () => {
    const next = getNextPhase('completed', 'large');
    expect(next).toBeNull();
  });

  it('TC-AC6-04: INV-4 getNextPhase always advances forward', () => {
    const sizes = ['large'] as const;
    for (const size of sizes) {
      const active = getActivePhases(size);
      for (let i = 0; i < active.length - 1; i++) {
        const next = getNextPhase(active[i], size);
        if (next) {
          const currentIdx = active.indexOf(active[i]);
          const nextIdx = active.indexOf(next);
          expect(nextIdx).toBeGreaterThan(currentIdx);
        }
      }
    }
  });
});
