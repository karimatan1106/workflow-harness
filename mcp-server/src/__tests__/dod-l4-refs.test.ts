/**
 * DRV-1 (S3-10): Dead reference check tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkDeadReferences } from '../gates/dod-l4-refs.js';
import { createTempDir, removeTempDir } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

describe('DRV-1 dead reference check', () => {
  it('skips check for non-applicable phases', () => {
    const result = checkDeadReferences('research', docsDir, '');
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('not required');
  });

  it('passes when output file does not exist', () => {
    const result = checkDeadReferences('design_review', docsDir, '');
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('skipped');
  });

  it('passes when artifact has no relative markdown links', () => {
    writeFileSync(join(docsDir, 'design-review.md'),
      '## サマリー\nNo links here. Just text.\n\n## AC→設計マッピング\nContent here.\n', 'utf8');
    const result = checkDeadReferences('design_review', docsDir, '');
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('DRV-1');
  });

  it('passes when all relative links point to existing files', () => {
    writeFileSync(join(docsDir, 'spec.md'), '# Spec content', 'utf8');
    writeFileSync(join(docsDir, 'design-review.md'),
      '## サマリー\nSee [spec](./spec.md) for details.\n\n## AC→設計マッピング\nContent.\n', 'utf8');
    const result = checkDeadReferences('design_review', docsDir, '');
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('DRV-1');
  });

  it('fails when a relative link points to a missing file', () => {
    writeFileSync(join(docsDir, 'design-review.md'),
      '## サマリー\nSee [missing doc](./missing.md) for details.\n\n## AC→設計マッピング\nContent.\n', 'utf8');
    const result = checkDeadReferences('design_review', docsDir, '');
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('./missing.md');
    expect(result.evidence).toContain('DRV-1');
  });

  it('ignores absolute URLs (does not match http/https)', () => {
    writeFileSync(join(docsDir, 'design-review.md'),
      '## サマリー\nSee [example](https://example.com) and [docs](http://docs.com/page.md).\n\n## AC→設計マッピング\nContent.\n', 'utf8');
    const result = checkDeadReferences('design_review', docsDir, '');
    expect(result.passed).toBe(true);
  });

  it('reports multiple dead references at once', () => {
    writeFileSync(join(docsDir, 'design-review.md'),
      '## サマリー\nSee [a](./a.md) and [b](./b.md).\n\n## AC→設計マッピング\nContent.\n', 'utf8');
    const result = checkDeadReferences('design_review', docsDir, '');
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('./a.md');
    expect(result.evidence).toContain('./b.md');
  });

  it('checks code_review phase artifacts', () => {
    writeFileSync(join(docsDir, 'code-review.md'),
      '## サマリー\nSee [broken](./broken.md).\n\n## 設計-実装整合性\nContent.\n\n## ユーザー意図との整合性\nContent.\n', 'utf8');
    const result = checkDeadReferences('code_review', docsDir, '');
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('DRV-1');
  });

  it('ignores anchor-only links and query strings', () => {
    writeFileSync(join(docsDir, 'design-review.md'),
      '## サマリー\nSee [section](#anchor) link.\n\n## AC→設計マッピング\nContent.\n', 'utf8');
    const result = checkDeadReferences('design_review', docsDir, '');
    expect(result.passed).toBe(true);
  });
});
