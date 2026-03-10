/**
 * N-76: JSON progress format for session state.
 * JSON is preferred over Markdown — LLMs less likely to inappropriately edit JSON.
 * Article Section 6: "Use JSON over Markdown for progress files."
 */

export interface ProgressEntry {
  phase: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  timestamp: string;
  notes?: string;
}

export interface ProgressJSON {
  version: 1;
  taskId: string;
  taskName: string;
  currentPhase: string;
  startedAt: string;
  updatedAt: string;
  entries: ProgressEntry[];
}

/** Create a new progress JSON structure */
export function createProgressJSON(taskId: string, taskName: string, phase: string): ProgressJSON {
  const now = new Date().toISOString();
  return {
    version: 1,
    taskId,
    taskName,
    currentPhase: phase,
    startedAt: now,
    updatedAt: now,
    entries: [{ phase, status: 'in_progress', timestamp: now }],
  };
}

/** Add a progress entry */
export function addProgressEntry(
  progress: ProgressJSON, phase: string, status: ProgressEntry['status'], notes?: string,
): ProgressJSON {
  const now = new Date().toISOString();
  return {
    ...progress,
    currentPhase: phase,
    updatedAt: now,
    entries: [...progress.entries, { phase, status, timestamp: now, ...(notes ? { notes } : {}) }],
  };
}

/** Format progress JSON for display */
export function formatProgress(progress: ProgressJSON): string {
  const completed = progress.entries.filter((e) => e.status === 'completed').length;
  const total = progress.entries.length;
  return `[${progress.taskName}] Phase: ${progress.currentPhase} (${completed}/${total} entries)`;
}
