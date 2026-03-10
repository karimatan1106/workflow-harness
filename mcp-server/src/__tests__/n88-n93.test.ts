/**
 * Tests for gaps N-88~N-93.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { E2E_TOKEN_BENCHMARKS, HARNESS_VARIANCE, IFSCALE_THRESHOLDS, TOOL_SEARCH_SAVINGS } from '../tools/token-benchmarks.js';
import { countInstructions, auditInstructionFile, formatAudit } from '../tools/instruction-counter.js';

describe('N-88: .golangci.yml config', () => {
  const configPath = path.resolve(import.meta.dirname, '../../configs/.golangci.yml');

  it('config file exists', () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it('enables all 8 article-recommended linters', () => {
    const content = fs.readFileSync(configPath, 'utf-8');
    const linters = ['staticcheck', 'gosec', 'errcheck', 'revive', 'govet', 'gofumpt', 'gci', 'modernize'];
    for (const linter of linters) {
      expect(content).toContain(`- ${linter}`);
    }
  });

  it('excludes gosec from test files', () => {
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('_test\\.go');
    expect(content).toContain('gosec');
  });
});

describe('N-89: Cargo.toml Clippy pedantic scaffold', () => {
  const configPath = path.resolve(import.meta.dirname, '../../configs/Cargo.clippy.toml');

  it('config file exists', () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it('denies allow_attributes', () => {
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('allow_attributes');
    expect(content).toContain('"deny"');
  });

  it('denies unwrap_used and expect_used', () => {
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('unwrap_used');
    expect(content).toContain('expect_used');
    expect(content).toContain('dbg_macro');
  });
});

describe('N-90: biome.json config', () => {
  const configPath = path.resolve(import.meta.dirname, '../../biome.json');

  it('config file exists with schema', () => {
    expect(fs.existsSync(configPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(content.$schema).toContain('biomejs.dev');
  });

  it('enables formatter with single quotes', () => {
    const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(content.javascript.formatter.quoteStyle).toBe('single');
  });

  it('enforces noExplicitAny at error level', () => {
    const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(content.linter.rules.suspicious.noExplicitAny).toBe('error');
  });
});

describe('N-91: GitHub Actions CI scaffold', () => {
  const configPath = path.resolve(import.meta.dirname, '../../configs/github-actions-ci.yml');

  it('config file exists', () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it('includes lint, test, and type-check steps', () => {
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('tsc --noEmit');
    expect(content).toContain('biome check');
    expect(content).toContain('vitest run');
  });

  it('includes DeepEval scaffold (commented)', () => {
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('deepeval');
  });
});

describe('N-92: Token efficiency benchmarks', () => {
  it('Playwright MCP: ~114K tokens', () => {
    expect(E2E_TOKEN_BENCHMARKS.playwrightMCP.tokensPerTask).toBe(114_000);
  });

  it('Playwright CLI: ~27K tokens (4x better)', () => {
    expect(E2E_TOKEN_BENCHMARKS.playwrightCLI.tokensPerTask).toBe(27_000);
    expect(E2E_TOKEN_BENCHMARKS.playwrightCLI.efficiency).toContain('4x');
  });

  it('agent-browser: 5.7x better than MCP', () => {
    expect(E2E_TOKEN_BENCHMARKS.agentBrowser.charsPerSixTests).toBe(5_500);
    expect(E2E_TOKEN_BENCHMARKS.agentBrowser.efficiency).toContain('5.7x');
  });

  it('Morph: harness = 22pt, model = 1pt', () => {
    expect(HARNESS_VARIANCE.harnessImpact).toBe(22);
    expect(HARNESS_VARIANCE.modelImpact).toBe(1);
  });

  it('IFScale: degradation at 150-200', () => {
    expect(IFSCALE_THRESHOLDS.degradationStart).toBe(150);
    expect(IFSCALE_THRESHOLDS.degradationEnd).toBe(200);
    expect(IFSCALE_THRESHOLDS.recommendedLines).toBe(50);
  });

  it('Tool Search: 85% context reduction', () => {
    expect(TOOL_SEARCH_SAVINGS.contextReduction).toBe(0.85);
  });
});

describe('N-93: IFScale instruction counter', () => {
  it('counts bullet points as instructions', () => {
    const content = '- Do X\n- Do Y\n- Do Z\n';
    expect(countInstructions(content)).toBe(3);
  });

  it('counts numbered lists', () => {
    const content = '1. First\n2. Second\n3. Third\n';
    expect(countInstructions(content)).toBe(3);
  });

  it('skips headers and blank lines', () => {
    const content = '# Title\n\n- One instruction\n\n## Subtitle\n';
    expect(countInstructions(content)).toBe(1);
  });

  it('detects imperative patterns (MUST/NEVER/禁止)', () => {
    const content = 'You MUST follow this rule.\nNEVER do that.\n禁止事項あり。\n';
    expect(countInstructions(content)).toBe(3);
  });

  it('audits CLAUDE.md as good (under 50)', () => {
    const content = '# Rules\n- Rule 1\n- Rule 2\n';
    const audit = auditInstructionFile('CLAUDE.md', content);
    expect(audit.status).toBe('good');
    expect(audit.estimatedInstructions).toBe(2);
  });

  it('audits bloated file as danger', () => {
    const lines = Array.from({ length: 250 }, (_, i) => `- Instruction ${i + 1}`).join('\n');
    const audit = auditInstructionFile('BLOATED.md', lines);
    expect(audit.status).toBe('danger');
    expect(audit.recommendation).toContain('IFScale');
  });

  it('formats audit result', () => {
    const audit = auditInstructionFile('test.md', '- Rule\n');
    const formatted = formatAudit(audit);
    expect(formatted).toContain('[OK]');
    expect(formatted).toContain('test.md');
  });
});
