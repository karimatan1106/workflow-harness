/**
 * Curator helper utilities — pattern normalization, scoring, and report persistence.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const CURATOR_LOG_PATH = join(STATE_DIR, 'curator-log.json');

export interface CuratorAction {
  action: 'pruned' | 'merged' | 'kept';
  phase: string;
  errorPattern: string;
  reason: string;
}

export interface CuratorReport {
  timestamp: string;
  taskId: string;
  taskName: string;
  lessonsBefore: number;
  lessonsAfter: number;
  stashedBefore: number;
  stashedAfter: number;
  actions: CuratorAction[];
}

/**
 * Compute quality score for a lesson based on helpful/harmful counts.
 * Returns 0.5 as the neutral initial score when both counts are zero.
 * For all other cases: helpfulCount / (helpfulCount + harmfulCount + 1)
 */
export function computeQualityScore(helpfulCount: number, harmfulCount: number): number {
  if (helpfulCount === 0 && harmfulCount === 0) return 0.5;
  return helpfulCount / (helpfulCount + harmfulCount + 1);
}

/**
 * Normalize an error pattern for deduplication.
 * Strips numbers, whitespace variations, and truncates.
 */
export function normalizePattern(pattern: string): string {
  return pattern
    .replace(/\d+/g, 'N')       // Replace all numbers with N
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim()
    .substring(0, 60);          // Truncate for comparison
}

/**
 * Compute similarity between two patterns (0.0 to 1.0).
 * Used to detect near-duplicate lessons during deduplication.
 */
export function computePatternSimilarity(a: string, b: string): number {
  const na = normalizePattern(a);
  const nb = normalizePattern(b);
  if (na === nb) return 1.0;
  // Simple prefix overlap ratio
  const minLen = Math.min(na.length, nb.length);
  if (minLen === 0) return 0.0;
  let matchLen = 0;
  for (let i = 0; i < minLen; i++) {
    if (na[i] === nb[i]) matchLen++;
    else break;
  }
  return matchLen / Math.max(na.length, nb.length);
}

/**
 * Save curator report to the log file (keeps last 20 reports).
 */
export function saveCuratorReport(report: CuratorReport): void {
  let reports: CuratorReport[] = [];
  try {
    if (existsSync(CURATOR_LOG_PATH)) {
      const raw = readFileSync(CURATOR_LOG_PATH, 'utf-8');
      reports = JSON.parse(raw);
    }
  } catch {
    reports = [];
  }

  reports.push(report);
  // Keep only last 20 reports
  if (reports.length > 20) {
    reports = reports.slice(-20);
  }

  try {
    const dir = dirname(CURATOR_LOG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CURATOR_LOG_PATH, JSON.stringify(reports, null, 2), 'utf-8');
  } catch {
    // Non-fatal
  }
}
