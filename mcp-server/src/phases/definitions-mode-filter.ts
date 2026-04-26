/**
 * Mode-aware filter helpers for buildSubagentPrompt (F-201 / AC-1).
 * Extracted from definitions.ts to keep that file ≤200 lines.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { PhaseName, TaskState } from '../state/types.js';
import { PHASE_REGISTRY, MODE_PHASES } from './registry.js';

/**
 * Compute the set of outputFile templates (e.g. '{docsDir}/threat-model.md') for
 * phases that are NOT active under state.mode. Used to filter inputFiles so that
 * a worker prompt never references artifacts produced by skipped phases.
 *
 * Returns an empty Set when state is undefined (back-compat: no filtering).
 */
export function getEffectiveSkippedOutputs(state: TaskState | undefined): Set<string> {
  if (!state || !state.mode) return new Set();
  const activePhases = new Set<string>(MODE_PHASES[state.mode] ?? []);
  const skipped = new Set<string>();
  for (const [phaseName, config] of Object.entries(PHASE_REGISTRY)) {
    if (!activePhases.has(phaseName) && config.outputFile) {
      skipped.add(config.outputFile);
    }
  }
  return skipped;
}

/** Remove every prompt line containing a skipped-phase outputFile basename. */
export function stripSkippedPhaseLines(prompt: string, state: TaskState | undefined): string {
  if (!state) return prompt;
  const skippedOutputs = getEffectiveSkippedOutputs(state);
  if (skippedOutputs.size === 0) return prompt;
  const basenames = new Set<string>();
  for (const tmpl of skippedOutputs) {
    const bn = tmpl.split('/').pop();
    if (bn) basenames.add(bn);
  }
  return prompt
    .split('\n')
    .filter(line => ![...basenames].some(bn => line.includes(bn)))
    .join('\n');
}

/** Resolve {docsDir} placeholders and filter out skipped-phase artifacts. */
export function resolveAndFilterInputFiles(
  rawInputFiles: readonly string[],
  docsDir: string,
  state: TaskState | undefined,
): string[] {
  const skipped = getEffectiveSkippedOutputs(state);
  return rawInputFiles
    .filter(f => !skipped.has(f))
    .map(f => f.replace(/\{docsDir\}/g, docsDir));
}
