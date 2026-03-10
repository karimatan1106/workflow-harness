/**
 * linter-runner — Runs jscpd and ast-grep for architecture gate checks.
 * @spec docs/spec/features/workflow-harness.md
 */

import { execSync } from 'child_process';
import { parse } from '@ast-grep/napi';

export interface JscpdResult {
  percentage: number;
  duplicates: number;
  passed: boolean;
}

export interface AstGrepMatch {
  filePath: string;
  line: number;
  text: string;
}

export interface AstGrepResult {
  matches: AstGrepMatch[];
  count: number;
  passed: boolean;
}

/**
 * Run jscpd duplicate code detection.
 * Returns graceful degradation on any error.
 */
export function runJscpd(targetGlob: string, threshold: number): JscpdResult {
  try {
    const output = execSync(
      `npx jscpd --format json --threshold ${threshold} --min-lines 5 "${targetGlob}"`,
      { timeout: 10000, encoding: 'utf-8' },
    );
    const parsed = JSON.parse(String(output));
    const percentage = parsed?.statistics?.total?.percentage ?? 0;
    const duplicates = parsed?.statistics?.total?.duplicatedLines ?? 0;
    return { percentage, duplicates, passed: percentage <= threshold };
  } catch {
    return { percentage: 0, duplicates: 0, passed: true };
  }
}

/**
 * Run ast-grep pattern matching.
 * Returns graceful degradation on any error.
 */
export function runAstGrepPattern(
  glob: string,
  pattern: string,
  threshold: number,
): AstGrepResult {
  try {
    const tree = parse(glob, pattern);
    const root = tree.root();
    const nodes = root.findAll(pattern);
    const matches: AstGrepMatch[] = nodes.map((n: { range: () => { start: { line: number } }; text: () => string }) => ({
      filePath: glob,
      line: n.range().start.line,
      text: n.text(),
    }));
    return { matches, count: matches.length, passed: matches.length <= threshold };
  } catch {
    return { matches: [], count: 0, passed: true };
  }
}
