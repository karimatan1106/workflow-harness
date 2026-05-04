/**
 * TDD Red — Rust backend skill content (structure + operations).
 * Verifies that workflow-project-structure.md and workflow-operations.md
 * carry Rust workspace conventions instead of TS Hono/Zod/Prisma + pnpm.
 *
 * Pre-implementation: assertions are expected to FAIL
 * (skill md still describes TS backend stack).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(__dirname, '..', '..', '..', '.claude', 'skills', 'workflow-harness');
const projectStructurePath = resolve(skillDir, 'workflow-project-structure.md');
const operationsPath = resolve(skillDir, 'workflow-operations.md');

describe('skill rust backend — workflow-project-structure.md', () => {
  const content = readFileSync(projectStructurePath, 'utf-8');

  it('TC-AC1-01: declares Cargo workspace with 4 crates (domain/application/infrastructure/presentation)', () => {
    expect(content).toContain('Cargo workspace');
    expect(content).toContain('crates/domain');
    expect(content).toContain('crates/application');
    expect(content).toContain('crates/infrastructure');
    expect(content).toContain('crates/presentation');
  });

  it('TC-AC1-02: legacy TS backend stack tokens are removed', () => {
    expect(content).not.toContain('Hono');
    expect(content).not.toContain('Zod');
    expect(content).not.toContain('Prisma');
  });
});

describe('skill rust backend — workflow-operations.md', () => {
  const content = readFileSync(operationsPath, 'utf-8');

  it('TC-AC3-01: package install guidance switched to cargo workspace crates', () => {
    expect(content).toContain('cargo add');
    expect(content).toContain('crates/');
  });

  it('TC-AC3-02: pnpm add backend guidance is removed', () => {
    expect(content).not.toContain('pnpm add');
  });

  it('TC-AC3-03: Dev Runtime section documents cargo-watch and tokio-listenfd', () => {
    expect(content).toContain('cargo-watch');
    expect(content).toContain('tokio-listenfd');
  });
});
