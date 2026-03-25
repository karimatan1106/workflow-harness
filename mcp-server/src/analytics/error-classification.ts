/**
 * error-classification.ts — Classify errors as recurring/cascading/one-off
 * Analyzes check failures across phases to identify patterns.
 */

export interface ErrorClassification {
  recurring: string[];
  cascading: string[][];
  oneOff: string[];
}

export interface Entry {
  phase: string;
  checks: Array<{ name: string; passed: boolean }>;
}

export function classifyErrors(entries: Entry[]): ErrorClassification {
  if (entries.length === 0) {
    return { recurring: [], cascading: [], oneOff: [] };
  }

  // Map: checkName -> [phaseNumbers] where check failed
  const failureMap = new Map<string, number[]>();

  for (const entry of entries) {
    const phaseNum = extractPhaseNumber(entry.phase);
    for (const check of entry.checks) {
      if (!check.passed) {
        if (!failureMap.has(check.name)) {
          failureMap.set(check.name, []);
        }
        failureMap.get(check.name)!.push(phaseNum);
      }
    }
  }

  const recurring: string[] = [];
  const cascading: string[][] = [];
  const oneOff: string[] = [];

  for (const [checkName, phases] of failureMap.entries()) {
    const uniquePhases = Array.from(new Set(phases)).sort((a, b) => a - b);

    if (uniquePhases.length >= 3) {
      recurring.push(checkName);
    } else if (uniquePhases.length === 2) {
      if (uniquePhases[1] - uniquePhases[0] === 1) {
        cascading.push([
          checkName,
          String(uniquePhases[0]),
          String(uniquePhases[1]),
        ]);
      } else {
        oneOff.push(checkName);
      }
    } else if (uniquePhases.length === 1) {
      oneOff.push(checkName);
    }
  }

  return {
    recurring: recurring.sort(),
    cascading: cascading.sort((a, b) => a[0].localeCompare(b[0])),
    oneOff: oneOff.sort(),
  };
}

function extractPhaseNumber(phase: string): number {
  const match = phase.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}
