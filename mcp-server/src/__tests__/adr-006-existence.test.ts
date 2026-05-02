/**
 * @spec AC-7 / TC-AC7-01
 *
 * AC-7: docs/adr/ADR-006.md が存在し、Status: Accepted と「言語前提」フレーズの両方を含む。
 *
 * TDD Red 段階: 実装(ADR-006.md 作成)前のため、ファイル自体が存在せず
 *   fs.existsSync が false を返して fail する。
 *
 * Test layout:
 *   - TC-AC7-01: ADR-006.md が存在し Status: Accepted と 言語前提 を含む
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// __dirname → mcp-server/src/__tests__/
// ../../.. → project root (workflow-harness/)
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const ADR_006_PATH = path.resolve(PROJECT_ROOT, 'docs/adr/ADR-006.md');

describe('AC-7: ADR-006 existence and content', () => {
  it('TC-AC7-01: ADR-006.md が存在し Status: Accepted と 言語前提 を含む', () => {
    expect(fs.existsSync(ADR_006_PATH)).toBe(true);
    const content = fs.readFileSync(ADR_006_PATH, 'utf-8');
    expect(content).toContain('Status: Accepted');
    expect(content).toContain('言語前提');
  });
});
