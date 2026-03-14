/**
 * Phase timing calculations for harness_status verbose output.
 * Computes per-phase durations from progress-json transitions.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { ProgressData } from '../state/progress-json.js';

export interface PhaseTiming {
  seconds: number;
  display: number;
  current?: boolean;
}

export interface PhaseTimingsResult {
  phaseTimings: Record<string, PhaseTiming>;
  totalElapsed: { seconds: number; display: number };
}

/**
 * Build phase timings from createdAt + transitions.
 * @param createdAt - task creation timestamp (ISO string)
 * @param progress - progress data with transitions array
 * @param currentPhase - the phase currently active
 */
export function buildPhaseTimings(
  createdAt: string,
  progress: ProgressData,
  currentPhase: string,
): PhaseTimingsResult {
  const timings: Record<string, PhaseTiming> = {};
  const transitions = progress.transitions;
  const now = Date.now();

  if (transitions.length === 0) {
    // No transitions yet — only the initial phase is active
    const elapsed = Math.max(0, (now - new Date(createdAt).getTime()) / 1000);
    const sec = Math.round(elapsed);
    timings[currentPhase] = { seconds: sec, display: sec, current: true };
    return { phaseTimings: timings, totalElapsed: { seconds: sec, display: sec } };
  }

  // First phase: createdAt → first transition timestamp
  const firstTs = new Date(transitions[0].timestamp).getTime();
  const firstDur = Math.max(0, (firstTs - new Date(createdAt).getTime()) / 1000);
  const firstPhase = transitions[0].from;
  timings[firstPhase] = { seconds: Math.round(firstDur), display: Math.round(firstDur) };

  // Middle phases: transition[n].timestamp → transition[n+1].timestamp
  for (let i = 0; i < transitions.length - 1; i++) {
    const phase = transitions[i].to;
    const start = new Date(transitions[i].timestamp).getTime();
    const end = new Date(transitions[i + 1].timestamp).getTime();
    const dur = Math.max(0, (end - start) / 1000);
    timings[phase] = { seconds: Math.round(dur), display: Math.round(dur) };
  }

  // Last transition → now = current phase elapsed
  const lastT = transitions[transitions.length - 1];
  const lastTs = new Date(lastT.timestamp).getTime();
  const currentDur = Math.max(0, (now - lastTs) / 1000);
  const activePhase = lastT.to;
  timings[activePhase] = { seconds: Math.round(currentDur), display: Math.round(currentDur), current: true };

  // Total elapsed
  const totalSec = Math.max(0, (now - new Date(createdAt).getTime()) / 1000);
  return {
    phaseTimings: timings,
    totalElapsed: { seconds: Math.round(totalSec), display: Math.round(totalSec) },
  };
}
