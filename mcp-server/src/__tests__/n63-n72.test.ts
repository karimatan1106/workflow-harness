/**
 * Tests for gaps N-63~N-72.
 */
import { describe, it, expect } from 'vitest';
import { formatStructuredError, ERROR_ADR_MAP } from '../tools/retry.js';
import { getEffectivenessMetrics } from '../tools/metrics.js';
import { shouldRunAnimationTests, ANIMATION_TEST_TRIGGER_CMD } from '../../tests/e2e/cls-animation.patterns.js';
import { estimateTokens, calcToolSearchSavings, compressionRatio, formatContextSummary } from '../tools/context-metrics.js';
import { KUBECONFORM_CMD, OPA_POLICIES, BLOCKED_INFRA_COMMANDS } from '../../tests/infra/kubeconform.config.js';
import { TERRAFORM_TEST_CMD, TERRAFORM_TEST_STRUCTURE } from '../../tests/infra/terraform-test.config.js';

describe('N-67: ERROR/WHY/FIX/EXAMPLE format', () => {
  it('formatStructuredError includes all components', () => {
    const result = formatStructuredError(
      'Forbidden patterns found',
      'docs/workflows/test/spec.toon',
      ['ADR-FORBIDDEN'],
      'Remove forbidden words and use indirect references',
    );
    expect(result).toContain('ERROR:');
    expect(result).toContain('WHY:');
    expect(result).toContain('FIX:');
    expect(result).toContain('ADR-FORBIDDEN');
  });

  it('handles multiple ADR IDs', () => {
    const result = formatStructuredError('test', 'file.ts', ['ADR-001', 'ADR-002'], 'fix it');
    expect(result).toContain('ADR-001, ADR-002');
  });

  it('handles no ADR IDs gracefully', () => {
    const result = formatStructuredError('test', 'file.ts', [], 'fix it');
    expect(result).toContain('WHY: N/A');
  });
});

describe('N-68: Effectiveness metrics', () => {
  it('returns all effectiveness fields', () => {
    const eff = getEffectivenessMetrics();
    expect(eff).toHaveProperty('tasksPerDay');
    expect(eff).toHaveProperty('reworkRate');
    expect(eff).toHaveProperty('firstPassRate');
    expect(eff).toHaveProperty('avgRetriesPerTask');
  });

  it('rates are between 0 and 1 or reasonable numbers', () => {
    const eff = getEffectivenessMetrics();
    expect(eff.reworkRate).toBeGreaterThanOrEqual(0);
    expect(eff.firstPassRate).toBeGreaterThanOrEqual(0);
    expect(eff.firstPassRate).toBeLessThanOrEqual(1);
  });
});

describe('N-69: Animation test trigger', () => {
  it('triggers on CSS file changes', () => {
    expect(shouldRunAnimationTests(['src/styles/main.css'])).toBe(true);
    expect(shouldRunAnimationTests(['src/app.scss'])).toBe(true);
  });

  it('triggers on animation-related file changes', () => {
    expect(shouldRunAnimationTests(['src/components/animation-utils.ts'])).toBe(true);
    expect(shouldRunAnimationTests(['src/motion/spring.ts'])).toBe(true);
    expect(shouldRunAnimationTests(['src/transition-group.tsx'])).toBe(true);
  });

  it('does not trigger on unrelated changes', () => {
    expect(shouldRunAnimationTests(['src/utils/math.ts'])).toBe(false);
    expect(shouldRunAnimationTests(['package.json'])).toBe(false);
  });

  it('exports trigger command', () => {
    expect(ANIMATION_TEST_TRIGGER_CMD).toContain('git diff');
    expect(ANIMATION_TEST_TRIGGER_CMD).toContain('@animation');
  });
});

describe('N-70: kubeconform/Conftest config', () => {
  it('exports kubeconform command', () => {
    expect(KUBECONFORM_CMD).toContain('kubeconform');
    expect(KUBECONFORM_CMD).toContain('-strict');
  });

  it('defines OPA policies', () => {
    expect(Object.keys(OPA_POLICIES).length).toBeGreaterThanOrEqual(3);
  });

  it('blocks production infra commands', () => {
    expect(BLOCKED_INFRA_COMMANDS).toContain('terraform apply');
    expect(BLOCKED_INFRA_COMMANDS).toContain('kubectl apply');
  });
});

describe('N-71: Terraform test config', () => {
  it('exports terraform test command', () => {
    expect(TERRAFORM_TEST_CMD).toBe('terraform test');
  });

  it('defines test structure', () => {
    expect(TERRAFORM_TEST_STRUCTURE.testDir).toBe('tests/');
    expect(TERRAFORM_TEST_STRUCTURE.policiesDir).toContain('policies');
  });
});

describe('N-72: Context compression metrics', () => {
  it('estimateTokens returns reasonable estimate', () => {
    expect(estimateTokens('hello')).toBe(2); // 5 chars / 4 ≈ 2
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('calcToolSearchSavings calculates deferred savings', () => {
    // 20 total tools, 5 loaded, 150 tokens/tool = 15 * 150 = 2250 saved
    expect(calcToolSearchSavings(20, 5, 150)).toBe(2250);
  });

  it('compressionRatio returns correct percentage', () => {
    expect(compressionRatio(100, 20)).toBe(0.8); // 80% compression
    expect(compressionRatio(100, 100)).toBe(0);
    expect(compressionRatio(0, 0)).toBe(1);
  });

  it('formatContextSummary produces readable output', () => {
    const summary = formatContextSummary({
      snapshots: [{ timestamp: '', phase: '', estimatedTokens: 0, mcpToolsLoaded: 5, mcpToolsAvailable: 20, savedByToolSearch: 2250 }],
      totalSaved: 2250,
      avgCompressionRatio: 0.85,
    });
    expect(summary).toContain('tokens saved');
    expect(summary).toContain('85%');
  });
});
