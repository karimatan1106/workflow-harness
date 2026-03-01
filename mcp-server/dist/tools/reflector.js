/**
 * Reflector — learns from validation failures to improve future subagent prompts.
 * Stores (phase, errorPattern, lesson) tuples; injects relevant lessons into prompts.
 * Max 50 lessons kept (quality-score eviction).
 * @spec docs/spec/features/workflow-harness.md
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { isV2Store, migrateV2toV3 } from './reflector-types.js';
const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const REFLECTOR_PATH = join(STATE_DIR, 'reflector-log.json');
const MAX_LESSONS = 50;
export function loadStore() {
    try {
        if (existsSync(REFLECTOR_PATH)) {
            const raw = readFileSync(REFLECTOR_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            // v2 → v3 migration (transparent)
            if (isV2Store(parsed))
                return migrateV2toV3(parsed);
            if (!parsed.stashedFailures) {
                parsed.stashedFailures = [];
            }
            if (!parsed.nextLessonId) {
                parsed.nextLessonId = parsed.lessons.length + 1;
            }
            return parsed;
        }
    }
    catch { /* corrupted file — start fresh */ }
    return { version: 3, nextLessonId: 1, lessons: [], stashedFailures: [] };
}
function saveStore(store) {
    const dir = dirname(REFLECTOR_PATH);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    writeFileSync(REFLECTOR_PATH, JSON.stringify(store, null, 2), 'utf-8');
}
function qualityScore(l) {
    if (l.helpfulCount === 0 && l.harmfulCount === 0)
        return 0.5;
    return l.helpfulCount / (l.helpfulCount + l.harmfulCount + 1);
}
function nextId(store) {
    const id = `L-${String(store.nextLessonId).padStart(3, '0')}`;
    store.nextLessonId += 1;
    return id;
}
/**
 * Stash a DoD failure for later promotion when retry succeeds.
 * Called on the FAILURE path of harness_next.
 */
export function stashFailure(taskId, phase, errorMessage, retryCount) {
    const store = loadStore();
    const pattern = extractErrorPattern(errorMessage);
    const sfIdx = store.stashedFailures.findIndex(f => f.taskId === taskId && f.phase === phase);
    const entry = {
        phase, taskId, errorPattern: pattern, errorMessage: errorMessage.substring(0, 500),
        retryCount, createdAt: new Date().toISOString(),
    };
    if (sfIdx >= 0) {
        store.stashedFailures[sfIdx] = entry;
    }
    else {
        store.stashedFailures.push(entry);
        if (store.stashedFailures.length > 20)
            store.stashedFailures = store.stashedFailures.slice(-20);
    }
    // Increment harmfulCount if same-pattern lesson already exists
    const existing = store.lessons.find(l => l.phase === phase && l.errorPattern === pattern);
    if (existing) {
        existing.harmfulCount += 1;
        existing.hitCount = existing.helpfulCount + existing.harmfulCount;
    }
    saveStore(store);
}
/**
 * Promote a stashed failure to a lesson when retry succeeds.
 * Called on the SUCCESS path of harness_next when retryCount > 1.
 * Returns true if a lesson was promoted.
 */
export function promoteStashedFailure(taskId, phase, retryCount) {
    const store = loadStore();
    const idx = store.stashedFailures.findIndex(f => f.taskId === taskId && f.phase === phase);
    if (idx < 0)
        return false;
    const stashed = store.stashedFailures[idx];
    store.stashedFailures.splice(idx, 1);
    const lesson = `リトライ${retryCount}回目で成功。失敗パターン: ${stashed.errorPattern}`;
    const existing = store.lessons.find(l => l.phase === phase && l.errorPattern === stashed.errorPattern);
    if (existing) {
        existing.lesson = lesson;
        existing.helpfulCount += 1;
        existing.hitCount = existing.helpfulCount + existing.harmfulCount;
        existing.createdAt = new Date().toISOString();
    }
    else {
        store.lessons.push({
            id: nextId(store),
            phase, errorPattern: stashed.errorPattern, lesson,
            createdAt: new Date().toISOString(),
            hitCount: 1, helpfulCount: 1, harmfulCount: 0, category: 'failure',
        });
    }
    if (store.lessons.length > MAX_LESSONS) {
        store.lessons.sort((a, b) => qualityScore(a) - qualityScore(b));
        store.lessons = store.lessons.slice(store.lessons.length - MAX_LESSONS);
    }
    saveStore(store);
    return true;
}
/**
 * Get lessons relevant to a given phase, sorted by quality score (highest first).
 */
export function getLessonsForPhase(phase) {
    const store = loadStore();
    const relevant = store.lessons.filter(l => l.phase === phase || l.phase === 'all');
    relevant.sort((a, b) => qualityScore(b) - qualityScore(a));
    return relevant.slice(0, 5);
}
/**
 * Format lessons as a prompt section in ACE bullet format.
 * Returns empty string if no lessons exist for the phase.
 */
export function formatLessonsForPrompt(phase) {
    const lessons = getLessonsForPhase(phase);
    if (lessons.length === 0)
        return '';
    const lines = lessons.map(l => `[${l.id}][${l.category}] ${l.phase}: ${l.errorPattern} → ${l.lesson}`);
    return '\n\n## 既知の落とし穴（Reflector自動注入）\n'
        + '過去の失敗から学んだ教訓です。同じ失敗を繰り返さないよう注意してください:\n'
        + lines.join('\n') + '\n';
}
/**
 * Extract a short error pattern from a full error message.
 */
export function extractErrorPattern(errorMessage) {
    const patterns = [
        /Forbidden patterns? found: (.+)/i,
        /Missing required sections: (.+)/i,
        /Duplicate lines.*: (.+)/i,
        /Section density.*: (.+)/i,
        /Content lines.*: (.+)/i,
        /has only (\d+) content lines/i,
        /Bracket placeholder/i,
        /No baseline captured/i,
        /non-zero exit code/i,
    ];
    for (const pattern of patterns) {
        const match = errorMessage.match(pattern);
        if (match)
            return match[0].substring(0, 80);
    }
    return errorMessage.substring(0, 80).trim();
}
//# sourceMappingURL=reflector.js.map