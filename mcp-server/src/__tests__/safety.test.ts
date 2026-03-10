/**
 * TDD Red tests for sanitizeTaskName (AC-6: input sanitization).
 * sanitizeTaskName does not exist yet — tests fail at import time.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeTaskName } from '../state/manager-write.js';

describe('sanitizeTaskName', () => {
  it('TC-AC6-01: path traversal (../) is removed', () => {
    const result = sanitizeTaskName('../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
  });

  it('TC-AC6-02: special characters (:*?<>|) are removed', () => {
    const result = sanitizeTaskName('task:name*with?special<chars>|here');
    expect(result).not.toMatch(/[:*?<>|]/);
    // Should preserve safe characters
    expect(result).toContain('task');
    expect(result).toContain('name');
  });

  it('TC-AC6-03: name exceeding 10000 chars throws error', () => {
    const longName = 'a'.repeat(10001);
    expect(() => sanitizeTaskName(longName)).toThrow();
  });

  it('TC-AC6-04: XSS payload (<script>) is sanitized', () => {
    const result = sanitizeTaskName('<script>alert("xss")</script>task');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
    expect(result).toContain('task');
  });

  it('TC-AC6-05: SQL injection payload is safely handled', () => {
    const result = sanitizeTaskName("'; DROP TABLE tasks; --");
    expect(result).not.toContain("'");
    expect(result).not.toContain(';');
    // Should still produce a non-empty sanitized string
    expect(result.length).toBeGreaterThan(0);
  });
});
