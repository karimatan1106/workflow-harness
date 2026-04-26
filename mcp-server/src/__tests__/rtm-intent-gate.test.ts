/**
 * RTM Intent Gate tests — AC-1~AC-6
 * TDD Red: tests written before implementation
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// --- AC-3: isOpenQuestion common function ---
describe('AC-3: isOpenQuestion common function', () => {
  let isOpenQuestion: (q: unknown) => boolean;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import('../gates/dod-l4-requirements.js');
    isOpenQuestion = mod.isOpenQuestion;
  });

  it('TC-AC3-01: returns true for non-empty string question', () => {
    expect(isOpenQuestion('OQ-1: パフォーマンス要件は？')).toBe(true);
  });

  it('TC-AC3-02: returns false for "なし"', () => {
    expect(isOpenQuestion('なし')).toBe(false);
  });

  it('TC-AC3-03: returns false for empty string', () => {
    expect(isOpenQuestion('')).toBe(false);
  });

  it('TC-AC3-04: returns true for object with valid question', () => {
    expect(isOpenQuestion({ id: 'OQ-1', question: '具体的な数値は？' })).toBe(true);
  });

  it('TC-AC3-05: returns false for object with question="なし"', () => {
    expect(isOpenQuestion({ id: 'OQ-1', question: 'なし' })).toBe(false);
  });
});

// --- AC-1: checkOpenQuestions blocks non-empty ---
describe('AC-1: checkOpenQuestions blocks non-empty openQuestions', () => {
  let checkOpenQuestions: Function;
  let tmpDir: string;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import('../gates/dod-l4-requirements.js');
    checkOpenQuestions = mod.checkOpenQuestions;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtm-ac1-'));
  });

  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  function writeReqMd(oqContent: string) {
    const content = `## openQuestions\n${oqContent}\n\n## acceptanceCriteria\n- AC-1: test\n`;
    fs.writeFileSync(path.join(tmpDir, 'requirements.md'), content);
  }

  it('TC-AC1-01: list-item openQuestions with valid item → passed:false', () => {
    // F-003 / AC-3: new contract — checkOpenQuestions counts Markdown list items only.
    // Plain prose like "OQ-1: 未解決質問" without `- ` prefix is treated as 0 items (passes).
    // To represent an unresolved question, use list-item format.
    writeReqMd('- OQ-1: 未解決質問');
    const state = { phase: 'requirements', userIntent: 'test' } as any;
    const result = checkOpenQuestions(state, 'requirements', tmpDir);
    expect(result.passed).toBe(false);
  });

  it('TC-AC1-02: openQuestions array with valid items → passed:false', () => {
    const content = `## openQuestions\n- OQ-1: 未解決質問A\n- OQ-2: 未解決質問B\n\n## acceptanceCriteria\n- AC-1: test\n`;
    fs.writeFileSync(path.join(tmpDir, 'requirements.md'), content);
    const state = { phase: 'requirements', userIntent: 'test' } as any;
    const result = checkOpenQuestions(state, 'requirements', tmpDir);
    expect(result.passed).toBe(false);
  });

  it('TC-AC1-03: mixed valid and なし items → passed:false', () => {
    const content = `## openQuestions\n- OQ-1: なし\n- OQ-2: 有効な質問\n\n## acceptanceCriteria\n- AC-1: test\n`;
    fs.writeFileSync(path.join(tmpDir, 'requirements.md'), content);
    const state = { phase: 'requirements', userIntent: 'test' } as any;
    const result = checkOpenQuestions(state, 'requirements', tmpDir);
    expect(result.passed).toBe(false);
  });
});

// --- AC-2: checkOpenQuestions passes empty/なし ---
describe('AC-2: checkOpenQuestions passes empty or なし', () => {
  let checkOpenQuestions: Function;
  let tmpDir: string;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import('../gates/dod-l4-requirements.js');
    checkOpenQuestions = mod.checkOpenQuestions;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtm-ac2-'));
  });

  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('TC-AC2-01: openQuestions: なし → passed:true', () => {
    const content = `## openQuestions\nなし\n\n## acceptanceCriteria\n- AC-1: test\n`;
    fs.writeFileSync(path.join(tmpDir, 'requirements.md'), content);
    const state = { phase: 'requirements', userIntent: 'test' } as any;
    const result = checkOpenQuestions(state, 'requirements', tmpDir);
    expect(result.passed).toBe(true);
  });

  it('TC-AC2-02: openQuestions key present but empty string → passed:true', () => {
    const content = `## openQuestions\n\n## acceptanceCriteria\n- AC-1: test\n`;
    fs.writeFileSync(path.join(tmpDir, 'requirements.md'), content);
    const state = { phase: 'requirements', userIntent: 'test' } as any;
    const result = checkOpenQuestions(state, 'requirements', tmpDir);
    expect(result.passed).toBe(true);
  });
});

// --- AC-4: requirementsテンプレートにharness_add_rtm指示 ---
describe('AC-4: requirements template has harness_add_rtm instruction', () => {
  let DEFS_STAGE1: Record<string, { subagentTemplate: string }>;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import('../phases/defs-stage1.js');
    DEFS_STAGE1 = mod.DEFS_STAGE1 as typeof DEFS_STAGE1;
  });

  it('TC-AC4-01: template mentions harness_add_rtm', () => {
    const tpl = DEFS_STAGE1['requirements'].subagentTemplate;
    expect(tpl).toMatch(/harness_add_rtm/);
  });

  it('TC-AC4-02: template mentions harness_add_ac', () => {
    const tpl = DEFS_STAGE1['requirements'].subagentTemplate;
    expect(tpl).toMatch(/harness_add_ac/);
  });
});

// --- AC-5: checkAcChainContinuity function ---
describe('AC-5: checkAcChainContinuity in dod-l4-ia.ts', () => {
  let checkAcChainContinuity: Function;
  let tmpDir: string;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import('../gates/dod-l4-ia.js');
    checkAcChainContinuity = mod.checkAcChainContinuity;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtm-ac5-'));
  });

  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('TC-AC5-01: missing AC in design-review → passed:false', () => {
    // State has AC-1, AC-2 but design-review only maps AC-1
    const state = {
      phase: 'design_review',
      userIntent: 'test',
      acceptanceCriteria: [{ id: 'AC-1', status: 'open' }, { id: 'AC-2', status: 'open' }],
    } as any;
    const content = `acDesignMapping[1]{acId,designElement}:\n  AC-1, "Module X"\n`;
    fs.writeFileSync(path.join(tmpDir, 'design-review.md'), content);
    const result = checkAcChainContinuity(state, 'design_review', tmpDir);
    expect(result.passed).toBe(false);
  });

  it('TC-AC5-02: no ACs in state → passed:true (skip)', () => {
    const state = { phase: 'design_review', userIntent: 'test', acceptanceCriteria: [] } as any;
    const result = checkAcChainContinuity(state, 'design_review', tmpDir);
    expect(result.passed).toBe(true);
  });

  it('TC-AC5-03: all ACs present → passed:true', () => {
    const state = {
      phase: 'design_review',
      userIntent: 'test',
      acceptanceCriteria: [{ id: 'AC-1', status: 'open' }],
    } as any;
    const content = `acDesignMapping[1]{acId,designElement}:\n  AC-1, "Module X"\n`;
    fs.writeFileSync(path.join(tmpDir, 'design-review.md'), content);
    const result = checkAcChainContinuity(state, 'design_review', tmpDir);
    expect(result.passed).toBe(true);
  });
});

// --- AC-6: retry.ts OPEN_QUESTIONS message for .toon ---
describe('AC-6: retry.ts OPEN_QUESTIONS message updated for .toon', () => {
  let buildRetryPrompt: Function;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import('../tools/retry.js');
    buildRetryPrompt = mod.buildRetryPrompt;
  });

  it('TC-AC6-01: OPEN_QUESTIONS error references .toon format', () => {
    const ctx = {
      phase: 'requirements',
      taskName: 'test',
      docsDir: '/tmp/test',
      retryCount: 1,
      errorMessage: 'OPEN_QUESTIONS has unresolved items',
      model: 'sonnet' as const,
    };
    const result = buildRetryPrompt(ctx);
    expect(result.prompt).toMatch(/\.toon|openQuestions/);
    expect(result.prompt).not.toMatch(/requirements\.md.*##\s*OPEN_QUESTIONS/);
  });
});
