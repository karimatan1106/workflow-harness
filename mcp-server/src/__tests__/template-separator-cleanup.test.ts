/**
 * TDD Red tests for template-separator-cleanup task.
 * Verifies that === separators and ## Markdown headers are absent
 * from all subagent templates and buildSubagentPrompt output.
 * These tests FAIL against the current (unmodified) codebase.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARTIFACT_QUALITY_RULES,
  SUMMARY_SECTION_RULE,
  EXIT_CODE_RULE,
  PROCEDURE_ORDER_RULE,
  bashCategoryHelp,
} from '../phases/definitions-shared.js';
import { buildSubagentPrompt } from '../phases/definitions.js';
import { PHASE_DEFINITIONS } from '../phases/definitions.js';

const SEP_RE = /^={3,}\s/gm;
const HEADER_RE = /^#{2,}\s/gm;

// --- AC-1: Static separator removal in shared constants ---

describe('AC-1: shared constants have no === separators', () => {
  it('TC-AC1-01: ARTIFACT_QUALITY_RULES has no separator', () => {
    expect(ARTIFACT_QUALITY_RULES).not.toMatch(SEP_RE);
  });

  it('TC-AC1-01: SUMMARY_SECTION_RULE has no separator', () => {
    expect(SUMMARY_SECTION_RULE).not.toMatch(SEP_RE);
  });

  it('TC-AC1-01: EXIT_CODE_RULE has no separator', () => {
    expect(EXIT_CODE_RULE).not.toMatch(SEP_RE);
  });

  it('TC-AC1-01: PROCEDURE_ORDER_RULE has no separator', () => {
    expect(PROCEDURE_ORDER_RULE).not.toMatch(SEP_RE);
  });

  it('TC-AC1-01: bashCategoryHelp output has no separator', () => {
    const output = bashCategoryHelp(['readonly', 'testing']);
    expect(output).not.toMatch(SEP_RE);
  });
});

// --- AC-1: buildToonFirstSection separator (via buildSubagentPrompt) ---

describe('AC-1: buildToonFirstSection has no separator', () => {
  it('TC-AC1-02: planning phase output has no TOON入力 separator', () => {
    const output = buildSubagentPrompt(
      'design_review', 'test-task', 'docs/workflows/test-task',
      '.harness/workflows/test-task', 'test intent',
    );
    // buildToonFirstSection adds TOON入力(ACE) section for phases with TOON inputs
    if (output.includes('TOON')) {
      expect(output).not.toMatch(/^={3,}.*TOON/gm);
    }
  });
});

// --- AC-2: Dynamic conversion logic removed ---

describe('AC-2: dynamic conversion logic removed', () => {
  it('TC-AC2-01: definitions.ts source has no header-to-separator replaceAll', () => {
    const src = readFileSync(
      join(__dirname, '..', 'phases', 'definitions.ts'), 'utf8',
    );
    // The current code has: prompt.replace(/^## /gm, '=== ')
    const dynamicConversion = /\.replace\(\/\^## \/gm/;
    expect(src).not.toMatch(dynamicConversion);
  });

  it('TC-AC2-02: buildSubagentPrompt output has no === separators', () => {
    const output = buildSubagentPrompt(
      'scope_definition', 'test-task', 'docs/workflows/test-task',
      '.harness/workflows/test-task', 'test intent',
    );
    expect(output).not.toMatch(SEP_RE);
  });
});

// --- AC-3: Template headers replaced with bold labels ---

describe('AC-3: templates have no Markdown headers', () => {
  const representativePhases = [
    'scope_definition', 'research', 'requirements',
    'threat_modeling', 'planning',
    'state_machine', 'flowchart', 'ui_design',
    'design_review', 'test_design',
    'performance_test', 'e2e_test', 'docs_update',
    'health_observation',
  ];

  for (const phase of representativePhases) {
    it(`TC-AC3: ${phase} template has no ## or ### headers`, () => {
      const def = PHASE_DEFINITIONS[phase as keyof typeof PHASE_DEFINITIONS];
      if (!def) return; // skip if no template
      expect(def.subagentTemplate).not.toMatch(HEADER_RE);
    });
  }

  it('TC-AC3-05: all buildSubagentPrompt outputs have no separators or headers', () => {
    for (const phase of Object.keys(PHASE_DEFINITIONS)) {
      const output = buildSubagentPrompt(
        phase, 'test-task', 'docs/workflows/test-task',
        '.harness/workflows/test-task', 'test intent',
      );
      expect(output).not.toMatch(SEP_RE);
      expect(output).not.toMatch(HEADER_RE);
    }
  });
});

// --- AC-1/AC-3: defs-stage6 docs_update separator ---

describe('AC-1: defs-stage6 docs_update has no separator', () => {
  it('TC-AC1-03: docs_update template has no === separator', () => {
    const def = PHASE_DEFINITIONS['docs_update' as keyof typeof PHASE_DEFINITIONS];
    expect(def).toBeDefined();
    expect(def!.subagentTemplate).not.toMatch(SEP_RE);
  });
});

// --- Edge cases ---

describe('Edge cases', () => {
  it('TD-EC2: buildSubagentPrompt does not throw for any phase', () => {
    for (const phase of Object.keys(PHASE_DEFINITIONS)) {
      expect(() => buildSubagentPrompt(
        phase, 'test-task', 'docs/workflows/test-task',
        '.harness/workflows/test-task', 'test intent',
      )).not.toThrow();
    }
  });

  it('TD-EC3: strip processing regex lines exist in definitions.ts', () => {
    const src = readFileSync(
      join(__dirname, '..', 'phases', 'definitions.ts'), 'utf8',
    );
    expect(src).toContain("replace(/## タスク情報");
    expect(src).toContain("replace(/## 入力");
    expect(src).toContain("replace(/## 出力");
  });

  it('TD-EC4: expanded fragments in final output have no separators', () => {
    // scope_definition uses all fragments: SUMMARY_SECTION, BASH_CATEGORIES, etc.
    const output = buildSubagentPrompt(
      'scope_definition', 'test-task', 'docs/workflows/test-task',
      '.harness/workflows/test-task', 'test intent',
    );
    // After fragment expansion, no === should remain
    expect(output).not.toMatch(SEP_RE);
  });
});
