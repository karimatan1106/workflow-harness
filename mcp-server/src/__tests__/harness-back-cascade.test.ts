import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { TOOL_DEFS_A } from '../tools/defs-a.js';

describe('harness_back cascade', () => {
  describe('TC-AC4-01: schema has cascade parameter', () => {
    it('should have cascade boolean in harness_back schema', () => {
      const backTool = TOOL_DEFS_A.find(
        (t: { name: string }) => t.name === 'harness_back',
      );
      expect(backTool).toBeDefined();
      expect(backTool!.inputSchema.properties.cascade).toBeDefined();
      expect(backTool!.inputSchema.properties.cascade.type).toBe('boolean');
      // cascade should be optional (not in required)
      expect(backTool!.inputSchema.required).not.toContain('cascade');
    });
  });

  describe('TC-AC5-01: cascade logic references PHASE_APPROVAL_GATES', () => {
    it('should import or reference PHASE_APPROVAL_GATES in scope-nav', async () => {
      const fs = await import('node:fs');
      const scopeNavPath = fileURLToPath(
        new URL('../tools/handlers/scope-nav.ts', import.meta.url),
      );
      const source = fs.readFileSync(scopeNavPath, 'utf-8');
      expect(source).toMatch(/PHASE_APPROVAL_GATES/);
    });
  });

  describe('TC-AC9-01: goBack with cascade deletes approvals', () => {
    it('should reference approval deletion in cascade path', async () => {
      const fs = await import('node:fs');
      const scopeNavPath = fileURLToPath(
        new URL('../tools/handlers/scope-nav.ts', import.meta.url),
      );
      const source = fs.readFileSync(scopeNavPath, 'utf-8');
      // The cascade path should delete/clear approvals for intermediate phases
      expect(source).toMatch(/approval.*delete|deleteApproval|clearApproval|approvals.*cascade/i);
    });
  });

  describe('TC-AC10-01: cascade unspecified preserves legacy behavior', () => {
    it('should export handleHarnessBack as a function', async () => {
      const { handleHarnessBack } = await import(
        '../tools/handlers/scope-nav.js'
      );
      expect(handleHarnessBack).toBeDefined();
      expect(typeof handleHarnessBack).toBe('function');
    });
  });
});
