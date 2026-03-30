/**
 * AC-1: readonly phase Write/Edit exclusion in buildAllowedTools.
 * TDD Red: TC-AC1-01 expected to fail (current code does not filter).
 */

import { describe, it, expect } from 'vitest';
import { buildAllowedTools } from '../tools/handlers/coordinator-prompt.js';
import { buildPhaseGuide } from '../tools/handler-shared.js';

type PhaseGuide = ReturnType<typeof buildPhaseGuide>;

function makeGuide(overrides: Partial<PhaseGuide> = {}): PhaseGuide {
  return {
    model: 'sonnet',
    bashCategories: ['readonly'],
    allowedExtensions: ['.md'],
    requiredSections: [],
    minLines: 0,
    skillFiles: [],
    ...overrides,
  };
}

describe('AC-1: buildAllowedTools readonly filtering', () => {
  it('TC-AC1-01: readonly-only phase with Write/Edit in allowedTools excludes them', () => {
    const guide = makeGuide({
      bashCategories: ['readonly'],
    });
    (guide as any).allowedTools = ['Write', 'Edit', 'Read'];
    const tools = buildAllowedTools(guide);
    const toolList = tools.split(',');
    expect(toolList).not.toContain('Write');
    expect(toolList).not.toContain('Edit');
    expect(toolList).toContain('Read');
  });

  it('TC-AC1-02: mixed categories with Write/Edit keep them', () => {
    const guide = makeGuide({
      bashCategories: ['readonly', 'testing'],
    });
    (guide as any).allowedTools = ['Write', 'Edit'];
    const tools = buildAllowedTools(guide);
    const toolList = tools.split(',');
    expect(toolList).toContain('Write');
    expect(toolList).toContain('Edit');
  });

  it('TC-AC1-03: planOnly + readonly double exclusion is idempotent', () => {
    const guide = makeGuide({ bashCategories: ['readonly'] });
    (guide as any).allowedTools = ['Write', 'Edit'];
    const base = buildAllowedTools(guide);
    const planFiltered = base.split(',')
      .filter(t => !['Write', 'Edit'].includes(t))
      .join(',');
    const toolList = planFiltered.split(',');
    expect(toolList).not.toContain('Write');
    expect(toolList).not.toContain('Edit');
  });
});
