/**
 * Metrics — collects harness performance data for continuous improvement.
 * Records phase timing, retry counts, DoD failure patterns, task completion.
 * Data persisted as JSON for analysis.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const METRICS_PATH = join(STATE_DIR, 'metrics.json');

export interface PhaseMetrics {
  startedAt: string;
  endedAt?: string;
  durationMs: number;
  retries: number;
  dodFailurePatterns: string[];
}

export interface TaskMetrics {
  taskName: string;
  phases: Record<string, PhaseMetrics>;
  retries: number;
  dodFailures: number;
  startedAt: string;
  completedAt: string | null;
}

export interface AggregateMetrics {
  totalTasks: number;
  completedTasks: number;
  totalRetries: number;
  totalDoDFailures: number;
  phaseTimings: Record<string, { count: number; totalMs: number; avgMs: number }>;
}

export interface MetricsStore {
  version: 1;
  tasks: Record<string, TaskMetrics>;
  aggregate: AggregateMetrics;
}

export function loadMetrics(): MetricsStore {
  try {
    if (existsSync(METRICS_PATH)) {
      return JSON.parse(readFileSync(METRICS_PATH, 'utf-8')) as MetricsStore;
    }
  } catch { /* corrupted — start fresh */ }
  return {
    version: 1,
    tasks: {},
    aggregate: { totalTasks: 0, completedTasks: 0, totalRetries: 0, totalDoDFailures: 0, phaseTimings: {} },
  };
}

function saveMetrics(store: MetricsStore): void {
  const dir = dirname(METRICS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(METRICS_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function ensureTask(store: MetricsStore, taskId: string, taskName?: string): TaskMetrics {
  if (!store.tasks[taskId]) {
    store.tasks[taskId] = {
      taskName: taskName || taskId,
      phases: {},
      retries: 0,
      dodFailures: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    store.aggregate.totalTasks += 1;
  }
  return store.tasks[taskId];
}

function ensurePhase(task: TaskMetrics, phase: string): PhaseMetrics {
  if (!task.phases[phase]) {
    task.phases[phase] = { startedAt: new Date().toISOString(), durationMs: 0, retries: 0, dodFailurePatterns: [] };
  }
  return task.phases[phase];
}

export function recordPhaseStart(taskId: string, taskName: string, phase: string): void {
  const store = loadMetrics();
  const task = ensureTask(store, taskId, taskName);
  const pm = ensurePhase(task, phase);
  pm.startedAt = new Date().toISOString();
  saveMetrics(store);
}

export function recordPhaseEnd(taskId: string, phase: string): void {
  const store = loadMetrics();
  const task = ensureTask(store, taskId);
  const pm = ensurePhase(task, phase);
  pm.endedAt = new Date().toISOString();
  pm.durationMs = new Date(pm.endedAt).getTime() - new Date(pm.startedAt).getTime();
  if (pm.durationMs < 0) pm.durationMs = 0;
  // Update aggregate phase timing
  if (!store.aggregate.phaseTimings[phase]) {
    store.aggregate.phaseTimings[phase] = { count: 0, totalMs: 0, avgMs: 0 };
  }
  const pt = store.aggregate.phaseTimings[phase];
  pt.count += 1;
  pt.totalMs += pm.durationMs;
  pt.avgMs = Math.round(pt.totalMs / pt.count);
  saveMetrics(store);
}

export function recordRetry(taskId: string, phase: string, errorMessage: string): void {
  const store = loadMetrics();
  const task = ensureTask(store, taskId);
  const pm = ensurePhase(task, phase);
  task.retries += 1;
  pm.retries += 1;
  store.aggregate.totalRetries += 1;
  saveMetrics(store);
}

export function recordDoDFailure(taskId: string, phase: string, errors: string[]): void {
  const store = loadMetrics();
  const task = ensureTask(store, taskId);
  const pm = ensurePhase(task, phase);
  task.dodFailures += 1;
  store.aggregate.totalDoDFailures += 1;
  for (const err of errors) {
    if (!pm.dodFailurePatterns.includes(err)) {
      pm.dodFailurePatterns.push(err);
    }
  }
  saveMetrics(store);
}

export function recordTaskCompletion(taskId: string): void {
  const store = loadMetrics();
  const task = ensureTask(store, taskId);
  task.completedAt = new Date().toISOString();
  store.aggregate.completedTasks += 1;
  saveMetrics(store);
}

export function getTaskMetrics(taskId: string): TaskMetrics | undefined {
  const store = loadMetrics();
  return store.tasks[taskId];
}

export function getAggregateMetrics(): AggregateMetrics {
  return loadMetrics().aggregate;
}
