/**
 * Error TOON — records DoD failures to phase-errors.toon as they occur.
 * Replaces JSON-based error recording for human-readable output.
 * @spec docs/spec/features/workflow-harness.md
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { esc } from '../state/toon-helpers.js';

export interface DoDFailureEntry {
  timestamp: string;
  phase: string;
  retryCount: number;
  errors: string[];
  checks: Array<{ name: string; passed: boolean; message?: string }>;
}

/**
 * Append a DoD failure entry to phase-errors.toon.
 * Creates the file with header on first write.
 */
export function appendErrorToon(docsDir: string, entry: DoDFailureEntry): void {
  const outPath = join(docsDir, 'phase-errors.toon');
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (!existsSync(outPath)) {
    // Write header on first entry
    const header = [
      'phase: errors',
      `createdAt: ${new Date().toISOString()}`,
      '',
    ].join('\n');
    writeFileSync(outPath, header, 'utf-8');
  }

  const failedChecks = entry.checks.filter(c => !c.passed);
  const checksStr = failedChecks
    .map(c => `${c.name}: ${c.message ?? 'failed'}`)
    .join('; ');

  const block = [
    '',
    `--- retry ${entry.retryCount} ---`,
    `timestamp: ${entry.timestamp}`,
    `phase: ${entry.phase}`,
    `retryCount: ${entry.retryCount}`,
    `failedChecks[${failedChecks.length}]{name,message}:`,
    ...failedChecks.map(c => `  ${c.name}, ${esc(c.message ?? 'failed')}`),
    `errors[${entry.errors.length}]:`,
    ...entry.errors.map(e => `  ${esc(e)}`),
  ].join('\n') + '\n';

  appendFileSync(outPath, block, 'utf-8');
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
    const entries: DoDFailureEntry[] = [];
    let current: Partial<DoDFailureEntry> | null = null;
    let mode: 'none' | 'checks' | 'errors' = 'none';

    for (const line of content.split('\n')) {
      if (line.startsWith('--- retry')) {
        if (current?.phase) {
          entries.push({
            timestamp: current.timestamp ?? '',
            phase: current.phase,
            retryCount: current.retryCount ?? 0,
            errors: current.errors ?? [],
            checks: current.checks ?? [],
          });
        }
        current = { checks: [], errors: [] };
        mode = 'none';
        continue;
      }
      if (!current) continue;

      if (line.startsWith('timestamp: ')) { current.timestamp = line.slice(11); mode = 'none'; }
      else if (line.startsWith('phase: ') && !line.startsWith('phase: errors')) { current.phase = line.slice(7); mode = 'none'; }
      else if (line.startsWith('retryCount: ')) { current.retryCount = parseInt(line.slice(12), 10); mode = 'none'; }
      else if (line.startsWith('failedChecks[')) { mode = 'checks'; }
      else if (line.startsWith('errors[')) { mode = 'errors'; }
      else if (line.startsWith('  ') && mode === 'checks') {
        const parts = line.trim().split(', ');
        const name = parts[0] ?? '';
        const message = parts.slice(1).join(', ').replace(/^"|"$/g, '').replace(/""/g, '"');
        current.checks!.push({ name, passed: false, message });
      }
      else if (line.startsWith('  ') && mode === 'errors') {
        const err = line.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
        current.errors!.push(err);
      }
    }
    // Push last entry
    if (current?.phase) {
      entries.push({
        timestamp: current.timestamp ?? '',
        phase: current.phase,
        retryCount: current.retryCount ?? 0,
        errors: current.errors ?? [],
        checks: current.checks ?? [],
      });
    }
    return entries;
  } catch { return []; }
}
