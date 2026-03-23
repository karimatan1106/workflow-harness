/**
 * Tests for classifySize and analyzeScope (risk-classifier.ts)
 */

import { describe, it, expect } from 'vitest';
import { classifySize, analyzeScope } from '../phases/risk-classifier.js';

// ─── classifySize ────────────────────────────────

describe('classifySize', () => {
  it('always returns "large" regardless of total', () => {
    expect(classifySize({ total: 0, factors: {} as any })).toBe('large');
    expect(classifySize({ total: 3, factors: {} as any })).toBe('large');
    expect(classifySize({ total: 8, factors: {} as any })).toBe('large');
    expect(classifySize({ total: 100, factors: {} as any })).toBe('large');
  });
});

// ─── analyzeScope ────────────────────────────────

describe('analyzeScope', () => {
  it('returns all false flags and fileCount 0 for empty input', () => {
    const result = analyzeScope([], []);
    expect(result.fileCount).toBe(0);
    expect(result.hasTests).toBe(false);
    expect(result.hasConfig).toBe(false);
    expect(result.hasInfra).toBe(false);
    expect(result.hasSecurity).toBe(false);
    expect(result.hasDatabase).toBe(false);
    expect(result.codeLineEstimate).toBe(0);
  });

  it('detects test paths via "test" keyword in file path', () => {
    const result = analyzeScope(['src/__tests__/foo.test.ts'], []);
    expect(result.hasTests).toBe(true);
  });

  it('detects test paths via "spec" keyword in file path', () => {
    const result = analyzeScope(['src/foo.spec.ts'], []);
    expect(result.hasTests).toBe(true);
  });

  it('detects test paths via "test" keyword in directory', () => {
    const result = analyzeScope([], ['src/tests/']);
    expect(result.hasTests).toBe(true);
  });

  it('detects config paths via .json extension', () => {
    const result = analyzeScope(['package.json'], []);
    expect(result.hasConfig).toBe(true);
  });

  it('detects config paths via .yaml extension', () => {
    const result = analyzeScope(['docker-compose.yaml'], []);
    expect(result.hasConfig).toBe(true);
  });

  it('detects config paths via .yml extension', () => {
    const result = analyzeScope(['config.yml'], []);
    expect(result.hasConfig).toBe(true);
  });

  it('detects config paths via .toml extension', () => {
    const result = analyzeScope(['Cargo.toml'], []);
    expect(result.hasConfig).toBe(true);
  });

  it('detects infra paths via "docker" keyword', () => {
    const result = analyzeScope(['docker-compose.yml'], []);
    expect(result.hasInfra).toBe(true);
  });

  it('detects infra paths via "terraform" keyword in dir', () => {
    const result = analyzeScope([], ['infra/terraform/']);
    expect(result.hasInfra).toBe(true);
  });

  it('detects infra paths via "k8s" keyword', () => {
    const result = analyzeScope([], ['deploy/k8s/']);
    expect(result.hasInfra).toBe(true);
  });

  it('detects infra paths via "deploy" keyword', () => {
    const result = analyzeScope(['scripts/deploy.sh'], []);
    expect(result.hasInfra).toBe(true);
  });

  it('detects security paths via "auth" keyword', () => {
    const result = analyzeScope(['src/auth/login.ts'], []);
    expect(result.hasSecurity).toBe(true);
  });

  it('detects security paths via "security" keyword', () => {
    const result = analyzeScope([], ['src/security/']);
    expect(result.hasSecurity).toBe(true);
  });

  it('detects security paths via "crypto" keyword', () => {
    const result = analyzeScope(['src/utils/crypto.ts'], []);
    expect(result.hasSecurity).toBe(true);
  });

  it('detects security paths via "secret" keyword', () => {
    const result = analyzeScope(['src/secrets.ts'], []);
    expect(result.hasSecurity).toBe(true);
  });

  it('detects database paths via "migration" keyword', () => {
    const result = analyzeScope([], ['db/migration/']);
    expect(result.hasDatabase).toBe(true);
  });

  it('detects database paths via "schema" keyword', () => {
    const result = analyzeScope(['prisma/schema.prisma'], []);
    expect(result.hasDatabase).toBe(true);
  });

  it('detects database paths via "database" keyword', () => {
    const result = analyzeScope([], ['src/database/']);
    expect(result.hasDatabase).toBe(true);
  });

  it('detects database paths via "prisma" keyword', () => {
    const result = analyzeScope(['src/infrastructure/prisma/client.ts'], []);
    expect(result.hasDatabase).toBe(true);
  });

  it('sets fileCount to the number of files provided', () => {
    const result = analyzeScope(['a.ts', 'b.ts', 'c.ts'], []);
    expect(result.fileCount).toBe(3);
  });

  it('sets codeLineEstimate to fileCount * 100', () => {
    const result = analyzeScope(['a.ts', 'b.ts'], []);
    expect(result.codeLineEstimate).toBe(200);
  });

  it('fileCount uses only files array length, not dirs', () => {
    const result = analyzeScope(['a.ts'], ['src/', 'lib/', 'test/']);
    expect(result.fileCount).toBe(1);
    expect(result.codeLineEstimate).toBe(100);
  });

  it('detects flags from directories as well as files', () => {
    const result = analyzeScope([], ['src/auth/', 'infra/terraform/']);
    expect(result.hasSecurity).toBe(true);
    expect(result.hasInfra).toBe(true);
  });
});
