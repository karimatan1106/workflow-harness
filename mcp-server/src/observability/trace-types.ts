/**
 * Trace entry types for observability.
 * @spec docs/spec/features/workflow-harness.md
 */

export type TraceAxis =
  | 'tool-access'
  | 'delegation'
  | 'phase-time'
  | 'dod-retry'
  | 'context-size';

export type TraceLayer =
  | 'orchestrator'
  | 'coordinator'
  | 'worker'
  | 'system';

export type TraceEvent =
  | 'ALLOW'
  | 'BLOCK'
  | 'spawn-start'
  | 'spawn-complete'
  | 'spawn-fail'
  | 'phase-enter'
  | 'phase-exit'
  | 'PASS'
  | 'FAIL'
  | 'file-read';

export interface TraceEntry {
  timestamp: string;
  axis: TraceAxis;
  layer: TraceLayer;
  event: TraceEvent;
  detail: string;
  durationMs?: number;
  sizeBytes?: number;
}

export interface TraceHeader {
  traceVersion: number;
  taskId: string;
  createdAt: string;
}

export interface DoDCheckResult {
  checkId: string;
  passed: boolean;
  message: string;
}
