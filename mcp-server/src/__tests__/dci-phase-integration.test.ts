/**
 * DCI phase integration tests
 * AC-1~AC-4: Template content verification
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

let DEFS_STAGE1: Record<string, { subagentTemplate: string }>;
let DEFS_STAGE4: Record<string, { subagentTemplate: string }>;
let DEFS_STAGE6: Record<string, { subagentTemplate: string }>;

beforeAll(async () => {
  vi.resetModules();
  const s1 = await import('../phases/defs-stage1.js');
  DEFS_STAGE1 = s1.DEFS_STAGE1 as typeof DEFS_STAGE1;
  const s4 = await import('../phases/defs-stage4.js');
  DEFS_STAGE4 = s4.DEFS_STAGE4 as typeof DEFS_STAGE4;
  const s6 = await import('../phases/defs-stage6.js');
  DEFS_STAGE6 = s6.DEFS_STAGE6 as typeof DEFS_STAGE6;
});

// ─── AC-1: scope_definition has DCI query instruction ─────────
describe('AC-1: scope_definition DCI integration', () => {
  it('TC-AC1-01: template mentions dci_query_docs or DCI for scope files', () => {
    const tpl = DEFS_STAGE1['scope_definition'].subagentTemplate;
    expect(tpl).toMatch(/dci_query_docs|dci_build_index|DCI|design-code-index/);
  });

  it('TC-AC1-02: template mentions relatedDesignDocs or related design', () => {
    const tpl = DEFS_STAGE1['scope_definition'].subagentTemplate;
    expect(tpl).toMatch(/relatedDesignDocs|関連設計書/);
  });
});

// ─── AC-2: impact_analysis has designDocsToReview ─────────────
describe('AC-2: impact_analysis DCI integration', () => {
  it('TC-AC2-01: template mentions designDocsToReview or design docs to review', () => {
    const tpl = DEFS_STAGE1['impact_analysis'].subagentTemplate;
    expect(tpl).toMatch(/designDocsToReview|更新.*設計書|古くなる.*設計書|dci_query_docs/);
  });
});

// ─── AC-3: implementation has @spec instruction ───────────────
describe('AC-3: implementation @spec instruction', () => {
  it('TC-AC3-01: template mentions @spec comment requirement', () => {
    const tpl = DEFS_STAGE4['implementation'].subagentTemplate;
    expect(tpl).toMatch(/@spec/);
  });

  it('TC-AC3-02: template specifies new .ts files must have @spec', () => {
    const tpl = DEFS_STAGE4['implementation'].subagentTemplate;
    expect(tpl).toMatch(/新規.*@spec|@spec.*新規|@spec.*コメント/);
  });
});

// ─── AC-4: docs_update has DCI query instruction ──────────────
describe('AC-4: docs_update DCI integration', () => {
  it('TC-AC4-01: template mentions dci_query_docs for identifying docs to update', () => {
    const tpl = DEFS_STAGE6['docs_update'].subagentTemplate;
    expect(tpl).toMatch(/dci_query_docs|dci_query_files|DCI/);
  });
});
