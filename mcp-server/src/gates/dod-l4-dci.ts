/**
 * DoD L4 gate: DCI (Design-Code Index) validation.
 * Checks @spec bidirectional links at code_impl/code_review completion.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';
import { buildIndex } from '../dci/index-builder.js';
import { validateIndex } from '../dci/index-query.js';

const DCI_PHASES = ['code_impl', 'code_review'];

/**
 * Check DCI validation for code_impl and code_review phases.
 * - orphanCode: L4 failure (passed: false) - code files without @spec
 * - brokenLinks: L4 failure (passed: false) - broken @spec references
 * - specWithoutCode: L4 failure (passed: false) - spec files without implementation
 */
export function checkDCIValidation(
  state: TaskState,
  phase: string,
): DoDCheckResult[] {
  if (!DCI_PHASES.includes(phase)) {
    return [{ level: 'L4', check: 'dci_validation', passed: true, evidence: 'skip: not a DCI phase' }];
  }

  const hasScope = (state.scopeFiles?.length ?? 0) > 0 || (state.scopeDirs?.length ?? 0) > 0;
  if (!hasScope) {
    return [{ level: 'L4', check: 'dci_validation', passed: true, evidence: 'skip: no scope files/dirs set' }];
  }

  const projectRoot = state.docsDir.replace(/[/\\]\.harness[/\\]docs$/, '');
  let index;
  try {
    index = buildIndex(projectRoot);
  } catch {
    return [{ level: 'L4', check: 'dci_validation', passed: true, evidence: 'skip: buildIndex failed' }];
  }

  const validation = validateIndex(index, projectRoot);
  const results: DoDCheckResult[] = [];

  // Filter to scope-relevant orphans
  const scopeOrphans = filterByScope(validation.orphanCode, state);
  if (scopeOrphans.length > 0) {
    results.push({
      level: 'L4',
      check: 'dci_orphan_code',
      passed: false,
      evidence: `${scopeOrphans.length} code file(s) without @spec: ${scopeOrphans.slice(0, 5).join(', ')}`,
      fix: 'Add @spec annotations to the listed code files pointing to their design documents.',
    });
  }

  // Broken links are failures
  const scopeBroken = filterByScope(
    validation.brokenLinks.map(l => l.split(' → ')[0]),
    state,
  );
  const scopeBrokenLinks = validation.brokenLinks.filter(l =>
    scopeBroken.includes(l.split(' → ')[0]),
  );
  if (scopeBrokenLinks.length > 0) {
    results.push({
      level: 'L4',
      check: 'dci_broken_links',
      passed: false,
      evidence: `${scopeBrokenLinks.length} broken @spec link(s): ${scopeBrokenLinks.slice(0, 5).join('; ')}`,
      fix: 'Fix or remove broken @spec references in the listed files.',
    });
  }

  // specWithoutCode is a failure - blocks phase transition
  if (validation.orphanDesign.length > 0) {
    results.push({
      level: 'L4',
      check: 'dci_spec_without_code',
      passed: false,
      evidence: `${validation.orphanDesign.length} spec(s) without implementation: ${validation.orphanDesign.slice(0, 5).join(', ')}`,
      fix: 'Implement code for the listed specs or remove unused spec entries.',
    });
  }

  if (results.length === 0) {
    results.push({
      level: 'L4',
      check: 'dci_validation',
      passed: true,
      evidence: `ok: ${Object.keys(index.codeToDesign).length} files indexed, no issues`,
    });
  }

  return results;
}

function filterByScope(paths: string[], state: TaskState): string[] {
  const scopeFiles = new Set(state.scopeFiles ?? []);
  const scopeDirs = state.scopeDirs ?? [];
  return paths.filter(p =>
    scopeFiles.has(p) || scopeDirs.some(d => p.startsWith(d)),
  );
}
