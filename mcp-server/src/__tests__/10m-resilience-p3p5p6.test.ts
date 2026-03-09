/**
 * P3+P5+P6: Template-related 10M resilience features.
 * P3: PROCEDURE_ORDER_RULE fragment (AC-3)
 * P5: Read instruction removal from templates (AC-5)
 * P6: External trait categories via .harness.json (AC-6)
 * TDD Red phase - these features are not yet implemented.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { buildSubagentPrompt } from '../phases/definitions.js';

describe('P3: PROCEDURE_ORDER_RULE (AC-3)', () => {
  // TC-AC3-02: PROCEDURE_ORDER_RULEが定数として定義されている
  it('exports PROCEDURE_ORDER_RULE constant with 5-step order', async () => {
    // PROCEDURE_ORDER_RULE does not exist yet in definitions-shared.ts
    let PROCEDURE_ORDER_RULE: string | undefined;
    try {
      const mod = await import('../phases/definitions-shared.js');
      PROCEDURE_ORDER_RULE = (mod as any).PROCEDURE_ORDER_RULE;
    } catch {
      // Module load failure is unexpected; the module exists
    }

    expect(PROCEDURE_ORDER_RULE).toBeDefined();
    expect(typeof PROCEDURE_ORDER_RULE).toBe('string');
    // Must contain 5 steps in order: Read -> analysis -> Write -> verify Read -> report
    expect(PROCEDURE_ORDER_RULE).toContain('Read');
    expect(PROCEDURE_ORDER_RULE).toContain('Write');
    expect(PROCEDURE_ORDER_RULE).toContain('検証');
    expect(PROCEDURE_ORDER_RULE).toContain('報告');
  });

  // TC-AC3-01: buildSubagentPrompt出力に作業順序が含まれる
  it('includes PROCEDURE_ORDER_RULE content in buildSubagentPrompt output', () => {
    const prompt = buildSubagentPrompt(
      'scope_definition',
      'test-task',
      '/tmp/docs',
      '/tmp/workflow',
      'Testing PROCEDURE_ORDER expansion in subagent prompt templates',
    );

    // P3 requires that templates with {PROCEDURE_ORDER} get the rule expanded
    expect(prompt).toContain('入力ファイルをRead');
    expect(prompt).toContain('成果物をWrite');
    expect(prompt).toContain('検証Read');
  });

  // TC-AC3-03: {PROCEDURE_ORDER}プレースホルダがない場合は展開されない
  it('does not inject PROCEDURE_ORDER_RULE when placeholder is absent', () => {
    const prompt = buildSubagentPrompt(
      'refactoring',
      'test-task',
      '/tmp/docs',
      '/tmp/workflow',
      'Testing that PROCEDURE_ORDER is not injected without placeholder in template',
    );

    const hasOrderRule = prompt.includes('入力ファイルをRead') && prompt.includes('成果物をWrite');
    expect(hasOrderRule).toBe(false);
  });
});

describe('P5: Read instruction removal (AC-5)', () => {
  // TC-AC5-01: '読み込んで'パターンのRead指示行が除去される
  it('removes lines containing Read instructions with "読み込んで" pattern', () => {
    const prompt = buildSubagentPrompt(
      'design_review',
      'test-task',
      '/tmp/docs',
      '/tmp/workflow',
      'Testing Read instruction removal from subagent prompt for design review phase',
    );

    // design_review template contains '読み込んでレビュー'
    // P5 should remove such lines
    const lines = prompt.split('\n');
    const readInstructionLines = lines.filter(line => /読み込んで/.test(line));
    expect(readInstructionLines).toHaveLength(0);
  });

  // TC-AC5-02: 'ファイルを読み'パターンも除去される
  it('removes lines containing Read instructions with "ファイルを読み" pattern', () => {
    const prompt = buildSubagentPrompt(
      'implementation',
      'test-task',
      '/tmp/docs',
      '/tmp/workflow',
      'Testing Read instruction removal for implementation phase with file read patterns',
    );

    const lines = prompt.split('\n');
    const readInstructionLines = lines.filter(line => /ファイルを読み/.test(line));
    expect(readInstructionLines).toHaveLength(0);
  });

  // TC-AC5-03: Read指示以外の通常テキストは保持
  it('preserves normal text that does not contain Read instruction patterns', () => {
    const prompt = buildSubagentPrompt(
      'scope_definition',
      'test-task',
      '/tmp/docs',
      '/tmp/workflow',
      'Testing that normal template text is preserved during Read instruction removal',
    );

    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('scope_definition');
  });
});

describe('P6: External trait categories via .harness.json (AC-6)', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'p6-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // TC-AC6-01: loadTraitCategoriesがexportされていること
  it('exports loadTraitCategories function from definitions.ts', async () => {
    let loadTraitCategories: ((configDir?: string) => Record<string, string[]>) | undefined;
    try {
      const mod = await import('../phases/definitions.js');
      loadTraitCategories = (mod as any).loadTraitCategories;
    } catch {
      // Module exists but function may not be exported yet
    }

    expect(loadTraitCategories).toBeDefined();
    expect(typeof loadTraitCategories).toBe('function');

    if (loadTraitCategories) {
      // Write .harness.json with custom trait categories
      writeFileSync(
        join(testDir, '.harness.json'),
        JSON.stringify({ traitCategories: { hasUI: ['custom/ui/'] } }),
        'utf8',
      );

      const result = loadTraitCategories(testDir);
      expect(result.hasUI).toEqual(['custom/ui/']);
    }
  });

  // TC-AC6-02: .harness.json不在時にDEFAULT_TRAIT_CATEGORIESを返却
  it('returns DEFAULT_TRAIT_CATEGORIES when .harness.json does not exist', async () => {
    let loadTraitCategories: ((configDir?: string) => Record<string, string[]>) | undefined;
    try {
      const mod = await import('../phases/definitions.js');
      loadTraitCategories = (mod as any).loadTraitCategories;
    } catch {
      // expected if function not exported
    }

    expect(loadTraitCategories).toBeDefined();

    if (loadTraitCategories) {
      const result = loadTraitCategories(testDir);
      expect(result.hasUI).toBeDefined();
      expect(Array.isArray(result.hasUI)).toBe(true);
      expect(result.hasUI.length).toBeGreaterThan(1);
    }
  });

  // TC-AC6-03: .harness.jsonが不正JSONでデフォルトにフォールバック
  it('falls back to defaults when .harness.json contains invalid JSON', async () => {
    let loadTraitCategories: ((configDir?: string) => Record<string, string[]>) | undefined;
    try {
      const mod = await import('../phases/definitions.js');
      loadTraitCategories = (mod as any).loadTraitCategories;
    } catch {
      // expected if function not exported
    }

    expect(loadTraitCategories).toBeDefined();

    if (loadTraitCategories) {
      writeFileSync(join(testDir, '.harness.json'), '{invalid json', 'utf8');

      const result = loadTraitCategories(testDir);
      expect(result.hasUI).toBeDefined();
      expect(Array.isArray(result.hasUI)).toBe(true);
      expect(result.hasUI.length).toBeGreaterThan(1);
    }
  });
});
