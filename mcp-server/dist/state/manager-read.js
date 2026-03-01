/**
 * State manager — read operations (load, list, query)
 * @spec docs/spec/features/workflow-harness.md
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { verifyStateWithRotation } from '../utils/hmac.js';
const STATE_DIR = process.env.STATE_DIR || '.claude/state';
export function getStatePath(taskId, taskName) {
    return join(STATE_DIR, 'workflows', `${taskId}_${taskName}`, 'workflow-state.json');
}
export function getDocsPath(taskName) {
    const DOCS_DIR = process.env.DOCS_DIR || 'docs/workflows';
    return join(DOCS_DIR, taskName);
}
export function loadTaskFromDisk(taskId) {
    const workflowsDir = join(STATE_DIR, 'workflows');
    if (!existsSync(workflowsDir))
        return null;
    const entries = readdirSync(workflowsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith(taskId)) {
            const statePath = join(workflowsDir, entry.name, 'workflow-state.json');
            if (existsSync(statePath)) {
                const raw = readFileSync(statePath, 'utf8');
                const state = JSON.parse(raw);
                if (verifyStateWithRotation(state, STATE_DIR)) {
                    return state;
                }
                return null;
            }
        }
    }
    return null;
}
export function listTasksFromDisk() {
    const workflowsDir = join(STATE_DIR, 'workflows');
    if (!existsSync(workflowsDir))
        return [];
    const results = [];
    const entries = readdirSync(workflowsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const statePath = join(workflowsDir, entry.name, 'workflow-state.json');
            if (existsSync(statePath)) {
                try {
                    const raw = readFileSync(statePath, 'utf8');
                    const state = JSON.parse(raw);
                    if (!verifyStateWithRotation(state, STATE_DIR))
                        continue;
                    if (state.phase !== 'completed') {
                        results.push({ taskId: state.taskId, taskName: state.taskName, phase: state.phase, size: state.size });
                    }
                }
                catch { }
            }
        }
    }
    return results;
}
export function buildTaskIndex(STATE_DIR_PARAM) {
    const workflowsDir = join(STATE_DIR_PARAM, 'workflows');
    if (!existsSync(workflowsDir))
        return [];
    const tasks = [];
    try {
        const entries = readdirSync(workflowsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const statePath = join(workflowsDir, entry.name, 'workflow-state.json');
                if (existsSync(statePath)) {
                    try {
                        const raw = readFileSync(statePath, 'utf8');
                        const state = JSON.parse(raw);
                        tasks.push({
                            taskId: state.taskId,
                            taskName: state.taskName,
                            phase: state.phase,
                            size: state.size,
                            status: state.phase === 'completed' ? 'completed' : 'active',
                        });
                    }
                    catch { }
                }
            }
        }
    }
    catch { }
    return tasks;
}
//# sourceMappingURL=manager-read.js.map