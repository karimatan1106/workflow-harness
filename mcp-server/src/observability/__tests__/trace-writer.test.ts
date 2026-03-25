import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initTraceFile, appendTrace, recordDoDResults } from '../trace-writer.js';
import type { TraceEntry, DoDCheckResult } from '../trace-types.js';

const TEST_DIR = join(tmpdir(), 'trace-writer-test');

function ensureClean(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
}

describe('trace-writer', () => {
  beforeEach(() => {
    ensureClean();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('TC-AC6-01: appendTrace appends a TOON-format entry', () => {
    const filePath = join(TEST_DIR, 'trace.toon');
    initTraceFile(filePath, 'TASK-001');

    const entry: TraceEntry = {
      timestamp: '2026-03-25T10:00:00Z',
      axis: 'phase-time',
      layer: 'system',
      event: 'phase-enter',
      detail: 'Executed trace-writer tests',
    };
    appendTrace(filePath, entry);

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('axis: phase-time');
    expect(content).toContain('event: phase-enter');
    expect(content).toContain('detail: Executed trace-writer tests');
  });

  it('TC-AC6-02: initTraceFile writes header with traceVersion and taskId', () => {
    const filePath = join(TEST_DIR, 'trace-header.toon');
    initTraceFile(filePath, 'TASK-002');

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('traceVersion: 1');
    expect(content).toContain('taskId: TASK-002');
  });

  it('TC-AC4-01: recordDoDResults records 3 entries in bulk', () => {
    const filePath = join(TEST_DIR, 'trace-dod.toon');
    initTraceFile(filePath, 'TASK-003');

    const results: DoDCheckResult[] = [
      { checkId: 'CHK-1', passed: true, message: 'OK' },
      { checkId: 'CHK-2', passed: false, message: 'Failed validation' },
      { checkId: 'CHK-3', passed: true, message: 'OK' },
    ];
    recordDoDResults(filePath, results);

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('checkId: CHK-1');
    expect(content).toContain('checkId: CHK-2');
    expect(content).toContain('checkId: CHK-3');
  });

  it('TC-AC6-03: rejects path traversal attempts', () => {
    const maliciousPath = TEST_DIR + '/../../etc/trace.toon';
    const entry: TraceEntry = {
      timestamp: '2026-03-25T10:00:00Z',
      axis: 'tool-access',
      layer: 'system',
      event: 'BLOCK',
      detail: 'Should be rejected',
    };

    expect(() => appendTrace(maliciousPath, entry)).toThrow('TRACE_PATH_VIOLATION');
  });

  it('TC-AC6-04: skips append when file exceeds 10MB', () => {
    const filePath = join(TEST_DIR, 'trace-large.toon');
    const tenMB = 10 * 1024 * 1024;
    const largeContent = 'x'.repeat(tenMB + 1);
    writeFileSync(filePath, largeContent, 'utf-8');

    const entry: TraceEntry = {
      timestamp: '2026-03-25T10:00:00Z',
      axis: 'tool-access',
      layer: 'system',
      event: 'ALLOW',
      detail: 'Should be skipped',
    };
    appendTrace(filePath, entry);

    const content = readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('event: ALLOW');
  });
});
