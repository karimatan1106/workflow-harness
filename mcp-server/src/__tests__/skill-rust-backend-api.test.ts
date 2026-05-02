/**
 * Verification tests for Rust backend API skill content (AC-2, AC-4).
 * Expected to fail (TDD Red) until workflow-api-standards.md and SKILL.md
 * are updated to Rust (axum/utoipa/sqlx/validator/serde) stack.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const SKILLS_DIR = join(__dirname, '../../../.claude/skills/workflow-harness');
const API_STANDARDS_PATH = join(SKILLS_DIR, 'workflow-api-standards.md');
const SKILL_MD_PATH = join(SKILLS_DIR, 'SKILL.md');

describe('Rust backend API skill content', () => {
  it('TC-AC2-01: workflow-api-standards.md contains Rust stack keywords', () => {
    const content = readFileSync(API_STANDARDS_PATH, 'utf-8');
    expect(content).toContain('axum');
    expect(content).toContain('utoipa');
    expect(content).toContain('sqlx');
    expect(content).toContain('validator');
    expect(content).toContain('serde');
  });

  it('TC-AC2-02: workflow-api-standards.md does not contain TypeScript stack keywords', () => {
    const content = readFileSync(API_STANDARDS_PATH, 'utf-8');
    expect(content).not.toContain('Hono');
    expect(content).not.toContain('Zod');
    expect(content).not.toContain('Prisma');
    expect(content).not.toContain('@hono/zod-openapi');
  });

  it('TC-AC4-01: SKILL.md workflow-api-standards row contains Rust keywords', () => {
    const content = readFileSync(SKILL_MD_PATH, 'utf-8');
    const rows = content.split(/\r?\n/).filter((line) => line.includes('workflow-api-standards'));
    expect(rows.length).toBeGreaterThan(0);
    const joined = rows.join('\n');
    expect(joined).toContain('axum');
    expect(joined).toContain('utoipa');
  });

  it('TC-AC4-02: SKILL.md workflow-api-standards row does not contain TypeScript keywords', () => {
    const content = readFileSync(SKILL_MD_PATH, 'utf-8');
    const rows = content.split(/\r?\n/).filter((line) => line.includes('workflow-api-standards'));
    expect(rows.length).toBeGreaterThan(0);
    const joined = rows.join('\n');
    expect(joined).not.toContain('Hono');
    expect(joined).not.toContain('Zod');
  });
});
