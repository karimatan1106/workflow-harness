/**
 * N-62: Codex hybrid strategy tests.
 */
import { describe, it, expect } from 'vitest';
import {
  HYBRID_STAGES,
  DECISION_FRAMEWORK,
  getRecommendedPlatform,
} from '../tools/hybrid-strategy.js';

describe('hybrid-strategy (N-62)', () => {
  it('defines 3 hybrid stages (plan→execute→review)', () => {
    expect(HYBRID_STAGES).toHaveLength(3);
    expect(HYBRID_STAGES[0].role).toBe('planner');
    expect(HYBRID_STAGES[1].role).toBe('executor');
    expect(HYBRID_STAGES[2].role).toBe('reviewer');
  });

  it('planner and reviewer use claude-code', () => {
    expect(HYBRID_STAGES[0].platform).toBe('claude-code');
    expect(HYBRID_STAGES[2].platform).toBe('claude-code');
  });

  it('executor uses codex', () => {
    expect(HYBRID_STAGES[1].platform).toBe('codex');
  });

  it('all stages have capabilities array', () => {
    for (const stage of HYBRID_STAGES) {
      expect(stage.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('quality priority recommends claude-code', () => {
    const result = getRecommendedPlatform('quality');
    expect(result.primary).toBe('claude-code');
  });

  it('throughput priority recommends codex', () => {
    const result = getRecommendedPlatform('throughput');
    expect(result.primary).toBe('codex');
  });

  it('balanced priority uses both platforms', () => {
    const result = getRecommendedPlatform('balanced');
    expect(result.primary).toBe('claude-code');
    expect(result.secondary).toBe('codex');
  });

  it('decision framework has rationale for each strategy', () => {
    for (const strategy of Object.values(DECISION_FRAMEWORK)) {
      expect(strategy.reason.length).toBeGreaterThan(10);
    }
  });
});
