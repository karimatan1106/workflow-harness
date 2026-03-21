/**
 * Tests for getDocsPath (relative) and resolveProjectPath (absolute resolution)
 *
 * getDocsPath returns RELATIVE paths. Consumers use resolveProjectPath() to
 * convert to absolute when needed.
 *
 * TC-AC2-01: getDocsPath returns relative path (default DOCS_DIR)
 * TC-AC2-02: getDocsPath returns relative path (custom DOCS_DIR)
 * TC-AC3-01: resolveProjectPath passes through already-absolute path
 * TC-AC5-01: resolveProjectPath resolves relative path to absolute under project root
 */

import { describe, it, expect, afterEach } from 'vitest';
import { isAbsolute, join } from 'node:path';
import { getDocsPath } from '../state/manager-read.js';
import { resolveProjectPath } from '../utils/project-root.js';

describe('getDocsPath returns relative path', () => {
  const origDocsDir = process.env.DOCS_DIR;

  afterEach(() => {
    if (origDocsDir === undefined) {
      delete process.env.DOCS_DIR;
    } else {
      process.env.DOCS_DIR = origDocsDir;
    }
  });

  it('TC-AC2-01: returns relative path with default DOCS_DIR', () => {
    delete process.env.DOCS_DIR;
    const result = getDocsPath('test-task');
    expect(isAbsolute(result)).toBe(false);
    expect(result).toBe(join('docs/workflows', 'test-task'));
  });

  it('TC-AC2-02: returns relative path with custom DOCS_DIR', () => {
    process.env.DOCS_DIR = 'custom/docs';
    const result = getDocsPath('test-task');
    expect(isAbsolute(result)).toBe(false);
    expect(result).toBe(join('custom/docs', 'test-task'));
  });
});

describe('resolveProjectPath handles docsDir correctly', () => {
  it('TC-AC3-01: absolute path passes through without double resolution', () => {
    const absPath = process.platform === 'win32'
      ? 'C:\\projects\\my-project\\docs'
      : '/projects/my-project/docs';
    const result = resolveProjectPath(absPath);
    expect(result).toBe(absPath);
  });

  it('TC-AC5-01: relative docsDir resolves to absolute path under project root', () => {
    const relativePath = 'docs/workflows/test-task';
    const result = resolveProjectPath(relativePath);
    expect(isAbsolute(result)).toBe(true);
    expect(result).toMatch(/docs[\\\/]workflows[\\\/]test-task$/);
  });
});
