/**
 * Tests for gaps N-94~N-97.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateErrorMessage, auditErrorMessages, formatErrorAudit } from '../tools/error-message-validator.js';

describe('N-94: no-default-export ast-grep rule', () => {
  const rulePath = path.resolve(import.meta.dirname, '../../.astgrep/rules/no-default-export.yml');

  it('rule file exists', () => {
    expect(fs.existsSync(rulePath)).toBe(true);
  });

  it('targets export default pattern', () => {
    const content = fs.readFileSync(rulePath, 'utf-8');
    expect(content).toContain('export default');
    expect(content).toContain('language: typescript');
    expect(content).toContain('grep-ability');
  });
});

describe('N-95: file-placement ast-grep rule', () => {
  const rulePath = path.resolve(import.meta.dirname, '../../.astgrep/rules/file-placement.yml');

  it('rule file exists', () => {
    expect(fs.existsSync(rulePath)).toBe(true);
  });

  it('enforces tools directory convention', () => {
    const content = fs.readFileSync(rulePath, 'utf-8');
    expect(content).toContain('src/tools/');
    expect(content).toContain('glob-ability');
  });
});

describe('N-96: comment ratio hook integration', () => {
  const hookPath = path.resolve(import.meta.dirname, '../../../.claude/hooks/post-tool-lint.sh');

  it('hook contains comment ratio check', () => {
    // Hook is in parent repo, may not exist from submodule context
    // Use the known path relative to workspace root
    const wsHookPath = path.resolve(import.meta.dirname, '../../../../.claude/hooks/post-tool-lint.sh');
    const exists = fs.existsSync(hookPath) || fs.existsSync(wsHookPath);
    expect(exists).toBe(true);

    const content = fs.readFileSync(fs.existsSync(hookPath) ? hookPath : wsHookPath, 'utf-8');
    expect(content).toContain('COMMENT_RATIO');
    expect(content).toContain('N-96');
  });
});

describe('N-97: Error message structure validator', () => {
  it('validates complete ERROR/WHY/FIX message', () => {
    const msg = 'ERROR: Something wrong\n  WHY: ADR-001\n  FIX: Do this instead';
    const result = validateErrorMessage(msg);
    expect(result.valid).toBe(true);
    expect(result.hasAdrRef).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('detects missing WHY component', () => {
    const msg = 'ERROR: Something wrong\n  FIX: Do this';
    const result = validateErrorMessage(msg);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('WHY:');
  });

  it('detects missing FIX component', () => {
    const msg = 'ERROR: Something wrong\n  WHY: ADR-001';
    const result = validateErrorMessage(msg);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('FIX:');
  });

  it('handles completely unstructured message', () => {
    const msg = 'Just a plain error text';
    const result = validateErrorMessage(msg);
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(3);
  });

  it('audits multiple messages and returns summary', () => {
    const messages = [
      'ERROR: A\n  WHY: ADR-001\n  FIX: B',
      'Just plain text',
      'ERROR: C\n  WHY: ADR-002\n  FIX: D',
    ];
    const audit = auditErrorMessages(messages);
    expect(audit.total).toBe(3);
    expect(audit.valid).toBe(2);
    expect(audit.invalid).toBe(1);
  });

  it('formatErrorAudit returns empty for valid messages', () => {
    const msg = 'ERROR: X\n  WHY: ADR-001\n  FIX: Y';
    const result = validateErrorMessage(msg);
    expect(formatErrorAudit(result)).toBe('');
  });

  it('formatErrorAudit shows missing components', () => {
    const result = validateErrorMessage('plain error');
    const formatted = formatErrorAudit(result);
    expect(formatted).toContain('INVALID_ERROR_MSG');
    expect(formatted).toContain('ERROR:');
  });
});
