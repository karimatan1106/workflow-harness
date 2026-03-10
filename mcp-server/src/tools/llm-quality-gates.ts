/**
 * N-51: LLM-as-Judge quality gate thresholds.
 * Defines minimum quality standards for LLM-generated artifacts.
 */

export interface QualityGate {
  metric: string;
  threshold: number;
  direction: 'gte' | 'lte'; // greater-than-or-equal / less-than-or-equal
  description: string;
}

export interface GateResult {
  gate: QualityGate;
  score: number;
  passed: boolean;
}

export interface EvaluationResult {
  passed: boolean;
  results: GateResult[];
}

export const LLM_QUALITY_GATES: QualityGate[] = [
  {
    metric: 'faithfulness',
    threshold: 0.85,
    direction: 'gte',
    description: 'Output faithfulness to source material',
  },
  {
    metric: 'hallucination_rate',
    threshold: 0.05,
    direction: 'lte',
    description: 'Maximum hallucination rate (5%)',
  },
  {
    metric: 'relevance',
    threshold: 0.80,
    direction: 'gte',
    description: 'Output relevance to input prompt',
  },
  {
    metric: 'toxicity',
    threshold: 0.01,
    direction: 'lte',
    description: 'Maximum toxicity score (1%)',
  },
  {
    metric: 'instruction_following',
    threshold: 0.90,
    direction: 'gte',
    description: 'Instruction adherence rate',
  },
];

/**
 * Evaluate a set of scores against all quality gates.
 * Missing metrics default to 0 (will fail 'gte' gates).
 */
export function evaluateGates(scores: Record<string, number>): EvaluationResult {
  const results: GateResult[] = LLM_QUALITY_GATES.map(gate => {
    const score = scores[gate.metric] ?? 0;
    const passed =
      gate.direction === 'gte' ? score >= gate.threshold : score <= gate.threshold;
    return { gate, score, passed };
  });

  return {
    passed: results.every(r => r.passed),
    results,
  };
}

/** Get only the gates that failed evaluation */
export function getFailedGates(scores: Record<string, number>): GateResult[] {
  return evaluateGates(scores).results.filter(r => !r.passed);
}

/** Format evaluation results as a human-readable summary */
export function formatEvaluationSummary(result: EvaluationResult): string {
  const lines = result.results.map(r => {
    const status = r.passed ? 'PASS' : 'FAIL';
    const dir = r.gate.direction === 'gte' ? '>=' : '<=';
    return `[${status}] ${r.gate.metric}: ${r.score} (${dir} ${r.gate.threshold})`;
  });
  const overall = result.passed ? 'ALL GATES PASSED' : 'GATES FAILED';
  return `${overall}\n${lines.join('\n')}`;
}
