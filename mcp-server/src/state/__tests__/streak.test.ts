import { describe, test, expect } from 'vitest';
import { applyBumpCheckStreak, applyClearCheckStreak } from '../manager-invariant.js';

function makeState(): any {
  return { taskId: 't1', phase: 'hearing', completedPhases: [], userIntent: '', size: 'large' };
}

describe('CBR-1: check streak', () => {
  test('first bump initializes to count 1', () => {
    const s = applyBumpCheckStreak(makeState(), 'hearing', 'content_validation');
    expect(s.checkFailureStreak?.hearing).toEqual({ checkName: 'content_validation', count: 1 });
  });
  test('same check bumped twice reaches count 2', () => {
    let s = applyBumpCheckStreak(makeState(), 'hearing', 'content_validation');
    s = applyBumpCheckStreak(s, 'hearing', 'content_validation');
    expect(s.checkFailureStreak?.hearing.count).toBe(2);
  });
  test('different check resets to 1 with new name', () => {
    let s = applyBumpCheckStreak(makeState(), 'hearing', 'a');
    s = applyBumpCheckStreak(s, 'hearing', 'b');
    expect(s.checkFailureStreak?.hearing).toEqual({ checkName: 'b', count: 1 });
  });
  test('clear removes the phase entry', () => {
    let s = applyBumpCheckStreak(makeState(), 'hearing', 'a');
    s = applyClearCheckStreak(s, 'hearing');
    expect(s.checkFailureStreak?.hearing).toBeUndefined();
  });
});
