/**
 * StateManager — thin orchestrator delegating to manager-read / manager-write
 * @spec docs/spec/features/workflow-harness.md
 */
import { ensureHmacKeys } from '../utils/hmac.js';
import { PHASE_REGISTRY, getNextPhase } from '../phases/registry.js';
import { loadTaskFromDisk, listTasksFromDisk } from './manager-read.js';
import { persistState, ensureStateDirs, writeTaskIndex, createTaskState, signAndPersist, updateCheckpoint, applyAddAC, applyAddRTM, applyUpdateACStatus, applyUpdateRTMStatus, appendProgressLog, } from './manager-write.js';
const STATE_DIR = process.env.STATE_DIR || '.claude/state';
export class StateManager {
    hmacKey;
    constructor() { this.hmacKey = ensureHmacKeys(STATE_DIR); }
    createTask(taskName, userIntent, files = [], dirs = []) {
        const state = createTaskState(taskName, userIntent, this.hmacKey, files, dirs);
        persistState(state);
        ensureStateDirs(state);
        writeTaskIndex();
        return state;
    }
    loadTask(taskId) { return loadTaskFromDisk(taskId); }
    advancePhase(taskId) {
        const state = this.loadTask(taskId);
        if (!state)
            return { success: false, error: 'Task not found or HMAC verification failed' };
        const nextPhase = getNextPhase(state.phase, state.size);
        if (!nextPhase)
            return { success: false, error: 'No next phase available' };
        const prevPhase = state.phase;
        state.completedPhases.push(state.phase);
        state.phase = nextPhase;
        state.updatedAt = new Date().toISOString();
        updateCheckpoint(state, nextPhase);
        signAndPersist(state, this.hmacKey);
        writeTaskIndex();
        appendProgressLog(state, prevPhase, nextPhase);
        return { success: true, nextPhase };
    }
    approveGate(taskId, approvalType) {
        const state = this.loadTask(taskId);
        if (!state)
            return { success: false, error: 'Task not found' };
        if (!state.approvals)
            state.approvals = {};
        state.approvals[approvalType] = { approvedAt: new Date().toISOString() };
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        writeTaskIndex();
        return { success: true };
    }
    completeSubPhase(taskId, subPhase) {
        const state = this.loadTask(taskId);
        if (!state)
            return { success: false, error: 'Task not found' };
        if (!state.subPhaseStatus)
            state.subPhaseStatus = {};
        if (state.subPhaseStatus[subPhase]?.status === 'completed')
            return { success: false, error: `Sub-phase "${subPhase}" is already completed (PCM-1)` };
        const phaseConfig = PHASE_REGISTRY[subPhase];
        if (phaseConfig?.dependencies?.length) {
            for (const dep of phaseConfig.dependencies) {
                const ds = state.subPhaseStatus[dep];
                if (!ds || ds.status !== 'completed')
                    return { success: false, error: `Dependency "${dep}" must be completed before "${subPhase}"` };
            }
        }
        state.subPhaseStatus[subPhase] = { name: subPhase, status: 'completed', completedAt: new Date().toISOString() };
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        writeTaskIndex();
        return { success: true };
    }
    goBack(taskId, targetPhase) {
        const state = this.loadTask(taskId);
        if (!state)
            return { success: false, error: 'Task not found' };
        const idx = state.completedPhases.indexOf(targetPhase);
        if (idx === -1 && state.phase !== targetPhase)
            return { success: false, error: 'Target phase was not in completed phases' };
        if (idx !== -1)
            state.completedPhases = state.completedPhases.slice(0, idx);
        state.phase = targetPhase;
        state.updatedAt = new Date().toISOString();
        updateCheckpoint(state, targetPhase);
        signAndPersist(state, this.hmacKey);
        writeTaskIndex();
        return { success: true };
    }
    resetTask(taskId, targetPhase, reason) {
        const state = this.loadTask(taskId);
        if (!state)
            return { success: false, error: 'Task not found' };
        state.completedPhases = [];
        state.subPhaseStatus = {};
        state.phase = targetPhase;
        state.updatedAt = new Date().toISOString();
        updateCheckpoint(state, targetPhase);
        if (!state.resetHistory)
            state.resetHistory = [];
        state.resetHistory.push({ reason, resetAt: state.updatedAt, targetPhase });
        signAndPersist(state, this.hmacKey);
        writeTaskIndex();
        return { success: true };
    }
    addAcceptanceCriterion(taskId, criterion) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        applyAddAC(state, criterion);
        signAndPersist(state, this.hmacKey);
        return true;
    }
    addRTMEntry(taskId, entry) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        applyAddRTM(state, entry);
        signAndPersist(state, this.hmacKey);
        return true;
    }
    recordFeedback(taskId, feedback) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        if (!state.feedbackLog)
            state.feedbackLog = [];
        state.feedbackLog.push({ feedback, recordedAt: new Date().toISOString() });
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        return true;
    }
    recordBaseline(taskId, totalTests, passedTests, failedTests) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        state.baseline = { capturedAt: new Date().toISOString(), totalTests, passedTests, failedTests };
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        return true;
    }
    recordTestResult(taskId, exitCode, output, summary) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        if (!state.testResults)
            state.testResults = [];
        state.testResults.push({ recordedAt: new Date().toISOString(), phase: state.phase, exitCode, output: output.slice(0, 5000), summary });
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        return true;
    }
    addProof(taskId, entry) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        state.proofLog.push(entry);
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        return true;
    }
    updateScope(taskId, files, dirs, glob, addMode = false) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        if (addMode) {
            state.scopeFiles = [...new Set([...state.scopeFiles, ...files])];
            state.scopeDirs = [...new Set([...state.scopeDirs, ...dirs])];
        }
        else {
            state.scopeFiles = files;
            state.scopeDirs = dirs;
        }
        if (glob)
            state.scopeGlob = glob;
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        return true;
    }
    listTasks() { return listTasksFromDisk(); }
    recordTestFile(taskId, testFile) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        if (!state.testFiles)
            state.testFiles = [];
        if (!state.testFiles.includes(testFile))
            state.testFiles.push(testFile);
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        return true;
    }
    getTestInfo(taskId) {
        const state = this.loadTask(taskId);
        if (!state)
            return null;
        return { testFiles: state.testFiles ?? [], baseline: state.baseline ?? null };
    }
    updateAcceptanceCriterionStatus(taskId, acId, status, testCaseId) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        if (!applyUpdateACStatus(state, acId, status, testCaseId))
            return false;
        signAndPersist(state, this.hmacKey);
        writeTaskIndex();
        return true;
    }
    updateRTMEntryStatus(taskId, rtmId, status, codeRef, testRef) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        if (!applyUpdateRTMStatus(state, rtmId, status, codeRef, testRef))
            return false;
        signAndPersist(state, this.hmacKey);
        writeTaskIndex();
        return true;
    }
    recordKnownBug(taskId, bug) {
        const state = this.loadTask(taskId);
        if (!state)
            return false;
        if (!state.knownBugs)
            state.knownBugs = [];
        state.knownBugs.push({ ...bug, severity: bug.severity, recordedAt: new Date().toISOString() });
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        return true;
    }
    getKnownBugs(taskId) {
        const state = this.loadTask(taskId);
        if (!state)
            return [];
        return state.knownBugs ?? [];
    }
    incrementRetryCount(taskId, phase) {
        const state = this.loadTask(taskId);
        if (!state)
            return -1;
        if (!state.retryCount)
            state.retryCount = {};
        state.retryCount[phase] = (state.retryCount[phase] ?? 0) + 1;
        state.updatedAt = new Date().toISOString();
        signAndPersist(state, this.hmacKey);
        return state.retryCount[phase];
    }
    getRetryCount(taskId, phase) {
        const state = this.loadTask(taskId);
        if (!state)
            return 0;
        return state.retryCount?.[phase] ?? 0;
    }
    resetRetryCount(taskId, phase) {
        const state = this.loadTask(taskId);
        if (!state)
            return;
        if (state.retryCount?.[phase]) {
            delete state.retryCount[phase];
            state.updatedAt = new Date().toISOString();
            signAndPersist(state, this.hmacKey);
        }
    }
    recordArtifactHash(taskId, fp, hash) { const s = this.loadTask(taskId); if (!s)
        return false; if (!s.artifactHashes)
        s.artifactHashes = {}; s.artifactHashes[fp] = hash; s.updatedAt = new Date().toISOString(); signAndPersist(s, this.hmacKey); return true; }
}
//# sourceMappingURL=manager.js.map