/**
 * Tests for gaps N-73~N-87.
 */
import { describe, it, expect } from 'vitest';
import { analyzeCommentRatio, formatCommentRatio, COMMENT_RATIO_THRESHOLDS } from '../tools/comment-ratio.js';
import { createProgressJSON, addProgressEntry, formatProgress } from '../tools/progress-json.js';
import { FREEZE_ANIMATIONS_CSS, VIEWPORT_PRESETS, CI_VISUAL_REGRESSION } from '../../tests/e2e/visual-regression-ci.helper.js';
import { MCP_CONSUMER_CONTRACTS, PACT_BROKER_CONFIG, ASYNC_CONTRACTS } from '../../tests/contracts/pact-scaffold.config.js';
import { INTERACTIVE_CLI_TESTS, PEXPECT_TEMPLATE, EXPECT_TEMPLATE, BASH_TESTABLE_PATTERN } from '../../tests/cli/pexpect-scaffold.config.js';
import { AGENT_EVAL_PLATFORMS, HARNESS_EVAL_METRICS } from '../../tests/eval/agent-eval-scaffold.config.js';
import { SAFETY_FRAMEWORKS, GUARDRAILS_HUB_VALIDATORS, NEMO_COLANG_TEMPLATE, EU_AI_ACT_CHECKLIST } from '../../tests/safety/ai-safety-runtime.config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('N-73: ast-grep YAML rules', () => {
  const rulesDir = path.resolve(import.meta.dirname, '../../.astgrep/rules');

  it('rules directory exists with YAML files', () => {
    expect(fs.existsSync(rulesDir)).toBe(true);
    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.yml'));
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it('each rule has required fields (id, language, rule, message)', () => {
    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.yml'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(rulesDir, file), 'utf-8');
      expect(content).toContain('id:');
      expect(content).toContain('language:');
      expect(content).toContain('rule:');
      expect(content).toContain('message:');
    }
  });

  it('no-any-type rule targets TypeScript', () => {
    const content = fs.readFileSync(path.join(rulesDir, 'no-any-type.yml'), 'utf-8');
    expect(content).toContain('language: typescript');
    expect(content).toContain('any');
  });
});

describe('N-74: Comment-to-code ratio', () => {
  it('detects healthy ratio', () => {
    const source = 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\n// comment\n';
    const result = analyzeCommentRatio(source);
    expect(result.codeLines).toBe(4);
    expect(result.commentLines).toBe(1);
    expect(result.status).toBe('good');
  });

  it('detects excessive comments', () => {
    const code = 'const a = 1;\n';
    const comments = '// c\n'.repeat(5);
    const result = analyzeCommentRatio(code + comments);
    expect(result.status).toBe('excessive');
    expect(result.ratio).toBeGreaterThan(COMMENT_RATIO_THRESHOLDS.warning);
  });

  it('handles block comments', () => {
    const source = '/* block\n * comment\n */\nconst a = 1;\n';
    const result = analyzeCommentRatio(source);
    expect(result.commentLines).toBe(3);
    expect(result.codeLines).toBe(1);
  });

  it('formatCommentRatio returns empty for good ratio', () => {
    const source = 'const a = 1;\nconst b = 2;\n';
    const result = analyzeCommentRatio(source);
    expect(formatCommentRatio(result)).toBe('');
  });

  it('formatCommentRatio returns warning for excessive', () => {
    const source = 'const a = 1;\n' + '// c\n'.repeat(10);
    const result = analyzeCommentRatio(source);
    expect(formatCommentRatio(result)).toContain('COMMENT_RATIO');
  });
});

describe('N-76: Progress JSON format', () => {
  it('creates valid progress structure', () => {
    const p = createProgressJSON('t1', 'test-task', 'scope_definition');
    expect(p.version).toBe(1);
    expect(p.taskId).toBe('t1');
    expect(p.currentPhase).toBe('scope_definition');
    expect(p.entries).toHaveLength(1);
  });

  it('adds entries immutably', () => {
    const p1 = createProgressJSON('t1', 'test', 'scope');
    const p2 = addProgressEntry(p1, 'requirements', 'completed', 'All AC met');
    expect(p2.entries).toHaveLength(2);
    expect(p1.entries).toHaveLength(1); // immutable
    expect(p2.currentPhase).toBe('requirements');
  });

  it('formats progress for display', () => {
    const p = createProgressJSON('t1', 'my-task', 'impl');
    const display = formatProgress(p);
    expect(display).toContain('my-task');
    expect(display).toContain('impl');
  });
});

describe('N-78: Pact v4 contract scaffold', () => {
  it('defines consumer contracts for MCP tools', () => {
    expect(MCP_CONSUMER_CONTRACTS.length).toBeGreaterThanOrEqual(3);
    expect(MCP_CONSUMER_CONTRACTS[0].description).toContain('harness_start');
  });

  it('configures Pact broker with spec v4', () => {
    expect(PACT_BROKER_CONFIG.specVersion).toBe(4);
    expect(PACT_BROKER_CONFIG.consumerName).toBeTruthy();
    expect(PACT_BROKER_CONFIG.providerName).toBeTruthy();
  });

  it('defines async contracts for phase transitions', () => {
    expect(ASYNC_CONTRACTS.phaseTransition.content).toHaveProperty('taskId');
    expect(ASYNC_CONTRACTS.phaseTransition.content).toHaveProperty('from');
  });
});

describe('N-81: pexpect/expect CLI scaffold', () => {
  it('defines interactive CLI test cases', () => {
    expect(INTERACTIVE_CLI_TESTS.length).toBeGreaterThanOrEqual(2);
    expect(INTERACTIVE_CLI_TESTS[0].interactions.length).toBeGreaterThanOrEqual(2);
  });

  it('provides pexpect Python template', () => {
    expect(PEXPECT_TEMPLATE).toContain('pexpect.spawn');
    expect(PEXPECT_TEMPLATE).toContain('child.expect');
  });

  it('provides expect Tcl template', () => {
    expect(EXPECT_TEMPLATE).toContain('#!/usr/bin/expect');
    expect(EXPECT_TEMPLATE).toContain('spawn');
  });

  it('provides bash testable pattern (run_main)', () => {
    expect(BASH_TESTABLE_PATTERN).toContain('run_main');
    expect(BASH_TESTABLE_PATTERN).toContain('BASH_SOURCE');
  });
});

describe('N-83: Visual regression CI helpers', () => {
  it('provides freeze animations CSS', () => {
    expect(FREEZE_ANIMATIONS_CSS).toContain('animation: none !important');
    expect(FREEZE_ANIMATIONS_CSS).toContain('transition: none !important');
  });

  it('defines viewport presets', () => {
    expect(VIEWPORT_PRESETS.mobile.width).toBe(375);
    expect(VIEWPORT_PRESETS.desktop.width).toBe(1280);
    expect(VIEWPORT_PRESETS.widescreen.width).toBe(1920);
  });

  it('configures CI provider actions', () => {
    expect(CI_VISUAL_REGRESSION.argosGitHubAction.uses).toContain('argos-ci');
    expect(CI_VISUAL_REGRESSION.chromaticGitHubAction.uses).toContain('chromaui');
  });
});

describe('N-86: Agent evaluation platforms', () => {
  it('defines 4+ evaluation platforms', () => {
    expect(Object.keys(AGENT_EVAL_PLATFORMS).length).toBeGreaterThanOrEqual(4);
  });

  it('each platform has required fields', () => {
    for (const [, platform] of Object.entries(AGENT_EVAL_PLATFORMS)) {
      expect(platform.name).toBeTruthy();
      expect(platform.type).toMatch(/tracing|evaluation|both/);
      expect(platform.apiKeyEnv).toBeTruthy();
      expect(platform.features.length).toBeGreaterThan(0);
    }
  });

  it('defines harness-specific eval metrics', () => {
    expect(Object.keys(HARNESS_EVAL_METRICS).length).toBeGreaterThanOrEqual(4);
    expect(HARNESS_EVAL_METRICS.phaseCompletionRate.threshold).toBe(0.7);
    expect(HARNESS_EVAL_METRICS.intentAccuracy.threshold).toBe(0.85);
  });
});

describe('N-87: AI safety runtime scaffold', () => {
  it('defines 4 safety frameworks', () => {
    expect(Object.keys(SAFETY_FRAMEWORKS).length).toBeGreaterThanOrEqual(4);
    expect(SAFETY_FRAMEWORKS.pyrit.type).toBe('red-team');
    expect(SAFETY_FRAMEWORKS.nemoGuardrails.type).toBe('guardrail');
  });

  it('provides Guardrails Hub validators', () => {
    expect(GUARDRAILS_HUB_VALIDATORS.length).toBeGreaterThanOrEqual(3);
    expect(GUARDRAILS_HUB_VALIDATORS[0].id).toContain('hub://');
  });

  it('provides NeMo Colang template', () => {
    expect(NEMO_COLANG_TEMPLATE).toContain('define user');
    expect(NEMO_COLANG_TEMPLATE).toContain('define flow');
  });

  it('includes EU AI Act checklist with deadline', () => {
    expect(EU_AI_ACT_CHECKLIST.riskAssessment.deadline).toBe('2026-08-02');
    expect(Object.keys(EU_AI_ACT_CHECKLIST).length).toBeGreaterThanOrEqual(6);
  });
});
