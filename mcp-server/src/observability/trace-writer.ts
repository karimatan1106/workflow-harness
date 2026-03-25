/**
 * Trace file writer for observability.
 * @spec docs/spec/features/workflow-harness.md
 */

import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve, normalize } from 'node:path';
import type { TraceEntry, DoDCheckResult } from './trace-types.js';

const MAX_TRACE_BYTES = 10 * 1024 * 1024;

function validatePath(filePath: string): string {
  const normalized = normalize(resolve(filePath));
  if (filePath.includes('..')) {
    throw new Error('TRACE_PATH_VIOLATION: path traversal detected: ' + filePath);
  }
  return normalized;
}

function formatEntry(entry: TraceEntry): string {
  const parts = [
    `timestamp: ${entry.timestamp}`,
    `axis: ${entry.axis}`,
    `layer: ${entry.layer}`,
    `event: ${entry.event}`,
    `detail: ${entry.detail}`,
  ];
  if (entry.durationMs !== undefined) {
    parts.push(`durationMs: ${entry.durationMs}`);
  }
  if (entry.sizeBytes !== undefined) {
    parts.push(`sizeBytes: ${entry.sizeBytes}`);
  }
  return parts.join(', ');
}

export function initTraceFile(filePath: string, taskId: string): void {
  const safePath = validatePath(filePath);
  const dir = dirname(safePath);
  mkdirSync(dir, { recursive: true });
  const header = [
    'traceVersion: 1',
    `taskId: ${taskId}`,
    `createdAt: ${new Date().toISOString()}`,
    '',
  ].join('\n');
  writeFileSync(safePath, header, 'utf-8');
}

export function appendTrace(filePath: string, entry: TraceEntry): void {
  const safePath = validatePath(filePath);
  try {
    if (existsSync(safePath)) {
      const size = statSync(safePath).size;
      if (size > MAX_TRACE_BYTES) {
        console.error('TRACE_SIZE_EXCEEDED: ' + safePath + ' (' + size + ' bytes)');
        return;
      }
    }
  } catch (err) {
    console.error('appendTrace stat error:', err);
    return;
  }
  try {
    appendFileSync(safePath, formatEntry(entry) + '\n', 'utf-8');
  } catch (err) {
    console.error('appendTrace write error:', err);
  }
}

export function recordDoDResults(
  filePath: string,
  results: DoDCheckResult[],
  retryCount?: number,
): void {
  try {
    for (const result of results) {
      const detail = `checkId: ${result.checkId}, passed: ${result.passed}, message: ${result.message}`;
      appendTrace(filePath, {
        timestamp: new Date().toISOString(),
        axis: 'dod-retry',
        layer: 'system',
        event: result.passed ? 'PASS' : 'FAIL',
        detail: retryCount !== undefined ? `retry:${retryCount} ${detail}` : detail,
      });
    }
  } catch (err) {
    console.error('recordDoDResults error:', err);
  }
}
