/**
 * DoD gate tests: L4 AC format validation (IA-2), L4 NOT_IN_SCOPE section validation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runDoDChecks } from '../gates/dod.js';
import { createTempDir, removeTempDir, makeMinimalState } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

const BASE_REQ_SECTIONS = [
  '## サマリー',
  'Requirements summary with detailed explanation of all functional needs.',
  'Further details about the scope and objectives of the requirements.',
  'Additional context about the requirements gathering process used.',
  'Background information about stakeholder consultation results.',
  'Key assumptions that underpin the requirements specification.',
  'Expected outcomes from implementing these requirements.',
  '',
  '## 機能要件',
  'The system shall validate user input before processing.',
  'The system shall display appropriate error messages.',
  'All inputs must be sanitized against injection attacks.',
  'Response time must be under 200ms for all operations.',
  'The system must support concurrent user sessions.',
  'Audit logging must be enabled for all state changes.',
  '',
  '## 非機能要件',
  'Performance: Response time under 200ms for critical operations.',
  'Security: All data must be encrypted in transit and at rest.',
  'Availability: System uptime must be at least 99.9 percent.',
  'Scalability: Must handle 1000 concurrent connections minimum.',
  'Maintainability: Code must adhere to clean architecture principles.',
  'Testability: Minimum 80 percent code coverage required.',
  '',
];

const NOT_IN_SCOPE_SECTION = [
  '## NOT_IN_SCOPE',
  'Mobile application development is excluded from this scope.',
  'Third-party authentication integration is not included.',
  'Legacy system migration is handled in a separate project.',
  'Performance optimization beyond the stated requirements.',
  'Internationalization and localization support.',
  '',
  '## OPEN_QUESTIONS',
  'なし',
];

// ─── L4: AC Format Validation (IA-2) ─────────────

describe('L4 AC format validation', () => {
  it('fails when requirements.md has fewer than 3 AC-N entries', async () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    const content = [
      ...BASE_REQ_SECTIONS,
      '## 受入基準',
      'AC-1: User input is validated with proper error messages.',
      'AC-2: Sanitization prevents all known injection vectors.',
      '',
      ...NOT_IN_SCOPE_SECTION,
    ].join('\n');
    writeFileSync(join(docsDir, 'requirements.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const acFmt = result.checks.find(c => c.check === 'ac_format')!;
    expect(acFmt.passed).toBe(false);
    expect(acFmt.evidence).toContain('only 2');
  });

  it('passes when requirements.md has 3 or more AC-N entries', async () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    const content = [
      ...BASE_REQ_SECTIONS,
      '## 受入基準',
      'AC-1: User input is validated with proper error messages on invalid entries.',
      'AC-2: Sanitization prevents all known injection vectors including XSS.',
      'AC-3: Response time is under 200ms for 95th percentile of requests.',
      '',
      ...NOT_IN_SCOPE_SECTION,
    ].join('\n');
    writeFileSync(join(docsDir, 'requirements.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const acFmt = result.checks.find(c => c.check === 'ac_format')!;
    expect(acFmt.passed).toBe(true);
    expect(acFmt.evidence).toContain('3');
  });

  it('skips AC format check for non-requirements phases', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const acFmt = result.checks.find(c => c.check === 'ac_format')!;
    expect(acFmt.passed).toBe(true);
    expect(acFmt.evidence).toContain('not required');
  });
});

// ─── L4: NOT_IN_SCOPE Section Validation ─────────

describe('L4 NOT_IN_SCOPE section validation', () => {
  it('fails when requirements.md lacks NOT_IN_SCOPE section', async () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    const content = [
      '## サマリー',
      'Requirements summary with detailed explanation of all functional needs.',
      'Further details about the scope and objectives of the requirements.',
      'Additional context about the requirements gathering process used.',
      'Background information about stakeholder consultation results.',
      'Key assumptions that underpin the requirements specification.',
      'Expected outcomes from implementing these requirements.',
      '',
      '## 受入基準',
      'AC-1: First acceptance criterion with verifiable condition.',
      'AC-2: Second acceptance criterion with measurable outcome.',
      'AC-3: Third acceptance criterion with specific threshold.',
      '',
      '## OPEN_QUESTIONS',
      'なし',
    ].join('\n');
    writeFileSync(join(docsDir, 'requirements.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const nis = result.checks.find(c => c.check === 'not_in_scope_section')!;
    expect(nis.passed).toBe(false);
    expect(nis.evidence).toContain('missing');
  });

  it('passes when requirements.md contains NOT_IN_SCOPE section', async () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    const content = [
      '## サマリー',
      'Requirements summary with detailed explanation of all functional needs.',
      'Further details about the scope and objectives of the requirements.',
      'Additional context about the requirements gathering process used.',
      'Background information about stakeholder consultation results.',
      'Key assumptions that underpin the requirements specification.',
      'Expected outcomes from implementing these requirements.',
      '',
      '## NOT_IN_SCOPE',
      'Mobile app development is excluded from current scope.',
      'Third-party integrations are handled separately.',
      'Legacy data migration is not part of this project.',
      'Performance tuning beyond stated requirements is excluded.',
      'Documentation translation is not in scope for this release.',
      '',
      '## OPEN_QUESTIONS',
      'なし',
    ].join('\n');
    writeFileSync(join(docsDir, 'requirements.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const nis = result.checks.find(c => c.check === 'not_in_scope_section')!;
    expect(nis.passed).toBe(true);
  });
});

// ─── L4: Intent Consistency (CIC-1) ──────────────

describe('L4 intent consistency check (CIC-1)', () => {
  it('fails when 3+ userIntent keywords are absent from requirements.md', async () => {
    const state = { ...makeMinimalState('requirements', tempDir, docsDir), userIntent: 'postgresql kubernetes elasticsearch microservice containerization orchestration' };
    writeFileSync(join(docsDir, 'requirements.md'), [...BASE_REQ_SECTIONS, ...NOT_IN_SCOPE_SECTION].join('\n'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const ic = result.checks.find(c => c.check === 'intent_consistency')!;
    expect(ic.passed).toBe(false);
    expect(ic.evidence).toContain('未反映');
  });

  it('fails when requirements.md line count is below userIntent depth threshold', async () => {
    const longIntent = 'authentication authorization validation sanitization performance security availability '.repeat(3);
    const state = { ...makeMinimalState('requirements', tempDir, docsDir), userIntent: longIntent };
    const shortContent = '## サマリー\nauthentication authorization validation sanitization performance security availability details.\n\n## 受入基準\nAC-1: x.\nAC-2: y.\nAC-3: z.\n\n## NOT_IN_SCOPE\nNone.\n\n## OPEN_QUESTIONS\nなし';
    writeFileSync(join(docsDir, 'requirements.md'), shortContent, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const ic = result.checks.find(c => c.check === 'intent_consistency')!;
    expect(ic.passed).toBe(false);
    expect(ic.evidence).toContain('不十分な詳細度');
  });

  it('passes when keywords are present and requirements.md has sufficient lines', async () => {
    const state = { ...makeMinimalState('requirements', tempDir, docsDir), userIntent: 'performance security availability scalability testability maintainability' };
    writeFileSync(join(docsDir, 'requirements.md'), [...BASE_REQ_SECTIONS, ...NOT_IN_SCOPE_SECTION].join('\n'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const ic = result.checks.find(c => c.check === 'intent_consistency')!;
    expect(ic.passed).toBe(true);
  });
});
