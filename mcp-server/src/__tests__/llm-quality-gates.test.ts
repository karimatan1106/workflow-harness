import { describe, it, expect } from 'vitest';
import {
  LLM_QUALITY_GATES,
  evaluateGates,
  getFailedGates,
  formatEvaluationSummary,
} from '../tools/llm-quality-gates.js';

describe('LLM Quality Gates', () => {
  it('has 5 quality gates defined', () => {
    expect(LLM_QUALITY_GATES).toHaveLength(5);
  });

  it('all gates have required fields', () => {
    for (const gate of LLM_QUALITY_GATES) {
      expect(gate.metric).toBeTruthy();
      expect(gate.threshold).toBeGreaterThan(0);
      expect(['gte', 'lte']).toContain(gate.direction);
      expect(gate.description).toBeTruthy();
    }
  });

  it('all passing scores → passed:true', () => {
    const scores = {
      faithfulness: 0.95,
      hallucination_rate: 0.02,
      relevance: 0.90,
      toxicity: 0.005,
      instruction_following: 0.95,
    };
    const result = evaluateGates(scores);
    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(5);
    expect(result.results.every(r => r.passed)).toBe(true);
  });

  it('failing faithfulness → passed:false', () => {
    const scores = {
      faithfulness: 0.50,
      hallucination_rate: 0.02,
      relevance: 0.90,
      toxicity: 0.005,
      instruction_following: 0.95,
    };
    const result = evaluateGates(scores);
    expect(result.passed).toBe(false);
    const faithfulness = result.results.find(
      r => r.gate.metric === 'faithfulness',
    )!;
    expect(faithfulness.passed).toBe(false);
  });

  it('high hallucination rate → passed:false', () => {
    const scores = {
      faithfulness: 0.95,
      hallucination_rate: 0.15,
      relevance: 0.90,
      toxicity: 0.005,
      instruction_following: 0.95,
    };
    const result = evaluateGates(scores);
    expect(result.passed).toBe(false);
  });

  it('missing metrics default to 0 and fail gte gates', () => {
    const result = evaluateGates({});
    expect(result.passed).toBe(false);
    const gteGates = result.results.filter(
      r => r.gate.direction === 'gte',
    );
    expect(gteGates.every(r => !r.passed)).toBe(true);
  });

  it('getFailedGates returns only failures', () => {
    const scores = {
      faithfulness: 0.50,
      hallucination_rate: 0.02,
      relevance: 0.90,
      toxicity: 0.005,
      instruction_following: 0.95,
    };
    const failed = getFailedGates(scores);
    expect(failed).toHaveLength(1);
    expect(failed[0].gate.metric).toBe('faithfulness');
  });

  it('formatEvaluationSummary includes all metrics', () => {
    const scores = {
      faithfulness: 0.95,
      hallucination_rate: 0.02,
      relevance: 0.90,
      toxicity: 0.005,
      instruction_following: 0.95,
    };
    const result = evaluateGates(scores);
    const summary = formatEvaluationSummary(result);
    expect(summary).toContain('ALL GATES PASSED');
    expect(summary).toContain('faithfulness');
    expect(summary).toContain('PASS');
  });
});
