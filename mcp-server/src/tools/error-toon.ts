/**
 * Error TOON — records DoD failures to phase-errors.toon as they occur.
 * Uses @toon-format/toon via toon-io-adapter for read/write.
 * @spec docs/spec/features/workflow-harness.md
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { toonEncode, toonDecodeSafe } from '../state/toon-io-adapter.js';

export interface DoDFailureEntry {
  timestamp: string;
  phase: string;
  retryCount: number;
  errors: string[];
  checks: Array<{ name: string; passed: boolean; message?: string }>;
}

interface ErrorToonData {
  entries: DoDFailureEntry[];
}

/**
 * Append a DoD failure entry to phase-errors.toon.
 * Reads existing entries, appends the new one, and rewrites the full file.
 */
export function appendErrorToon(docsDir: string, entry: DoDFailureEntry): void {
  const outPath = join(docsDir, 'phase-errors.toon');
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const existing = readErrorToon(docsDir);
  existing.push(entry);
  const content = toonEncode({ entries: existing });
  writeFileSync(outPath, content, 'utf-8');
}

/**
 * Read and parse phase-errors.toon for analytics.
 * Returns structured failure entries.
 */
export function readErrorToon(docsDir: string): DoDFailureEntry[] {
  const outPath = join(docsDir, 'phase-errors.toon');
  if (!existsSync(outPath)) return [];

  try {
    const content = readFileSync(outPath, 'utf-8');
    const data = toonDecodeSafe<ErrorToonData>(content);
    return data?.entries ?? [];
  } catch { return []; }
}
