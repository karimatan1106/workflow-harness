/**
 * DoD spec-path validation checks.
 * Extracted from dod-l1-l2.ts for 200-line compliance.
 * @spec docs/spec/features/workflow-harness.md
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';

const SPEC_REGEX = /[/*]\s*@spec\s+(\S+)/g;
const SPEC_CHECK_PHASES = new Set([
  'implementation', 'refactoring', 'build_check', 'code_review',
]);

/** Resolve @spec path: try CWD first, then ancestor directories of the source file */
function resolveSpecPath(specPath: string, sourceFile: string): boolean {
  if (existsSync(specPath)) return true;
  // Walk up from source file's directory to find subproject root
  let dir = dirname(sourceFile);
  const seen = new Set<string>();
  while (dir && !seen.has(dir)) {
    seen.add(dir);
    if (existsSync(join(dir, specPath))) return true;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

/** Validate that @spec paths in scope files actually exist on filesystem */
export function checkSpecPathsExist(state: TaskState, phase: string): DoDCheckResult {
  if (!SPEC_CHECK_PHASES.has(phase)) {
    return { level: 'L1', check: 'spec_paths_exist', passed: true, evidence: '@spec path check not required for phase: ' + phase };
  }
  const scopeFiles = state.scopeFiles ?? [];
  if (scopeFiles.length === 0) {
    return { level: 'L1', check: 'spec_paths_exist', passed: true, evidence: 'No scope files to check' };
  }
  const broken: string[] = [];
  for (const filePath of scopeFiles) {
    if (!existsSync(filePath)) continue;
    let content: string;
    try { content = readFileSync(filePath, 'utf8'); } catch { continue; }
    const lines = content.split('\n').slice(0, 50).join('\n');
    const regex = new RegExp(SPEC_REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(lines)) !== null) {
      const specPath = match[1].replace(/\*\/$/, '');
      if (specPath && !resolveSpecPath(specPath, filePath)) {
        broken.push(`${filePath} → @spec ${specPath}`);
      }
    }
  }
  const passed = broken.length === 0;
  return {
    level: 'L1',
    check: 'spec_paths_exist',
    passed,
    evidence: passed
      ? `All @spec paths in ${scopeFiles.length} scope files are valid`
      : `Broken @spec references: ${broken.join('; ')}`,
    ...(!passed && { fix: '@specコメントが参照するファイルが存在しません。パスを修正するか、仕様書を作成してください。' }),
  };
}
