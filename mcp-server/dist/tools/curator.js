/**
 * Curator — prunes stale/duplicate memory entries after task completion.
 * Inspired by ACE paper (arXiv 2510.04618) Generator→Reflector→Curator pipeline.
 *
 * Design:
 * - Triggered after harness_next returns "completed" phase
 * - Scans reflector-log.json for stale lessons (old, low quality score)
 * - Deduplicates lessons with similar errorPatterns (fuzzy threshold 0.7)
 * - Prunes lessons that reference deleted phases or obsolete patterns
 * - Keeps reflector-log.json lean for fast injection
 *
 * @spec docs/spec/features/workflow-harness.md
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { computePatternSimilarity, computeQualityScore, saveCuratorReport } from './curator-helpers.js';
import { extractAndStoreBullets } from './ace-context.js';
const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const REFLECTOR_PATH = join(STATE_DIR, 'reflector-log.json');
const MAX_LESSONS_AFTER_CURATION = 40; // More aggressive than reflector's 50
const STALE_THRESHOLD_DAYS = 30;
const FUZZY_DEDUP_THRESHOLD = 0.7;
/**
 * Run the Curator cycle. Called when a task reaches "completed" phase.
 * Returns a report of actions taken for logging.
 */
export function runCuratorCycle(taskId, taskName) {
    const report = {
        timestamp: new Date().toISOString(),
        taskId, taskName,
        lessonsBefore: 0, lessonsAfter: 0,
        stashedBefore: 0, stashedAfter: 0,
        actions: [],
    };
    if (!existsSync(REFLECTOR_PATH))
        return report;
    let store;
    try {
        const raw = readFileSync(REFLECTOR_PATH, 'utf-8');
        store = JSON.parse(raw);
        if (!store.lessons)
            store.lessons = [];
        if (!store.stashedFailures)
            store.stashedFailures = [];
    }
    catch {
        return report;
    }
    report.lessonsBefore = store.lessons.length;
    report.stashedBefore = store.stashedFailures.length;
    // Step 1: Prune stale lessons (older than threshold with low hitCount)
    const now = Date.now();
    const staleCutoff = now - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    store.lessons = store.lessons.filter((lesson) => {
        const created = new Date(lesson.createdAt).getTime();
        if (created < staleCutoff && (lesson.hitCount ?? 0) <= 1) {
            report.actions.push({
                action: 'pruned', phase: lesson.phase, errorPattern: lesson.errorPattern,
                reason: 'Stale: older than ' + STALE_THRESHOLD_DAYS + ' days with hitCount <= 1',
            });
            return false;
        }
        return true;
    });
    // Step 2: Fuzzy dedup — merge lessons with similarity >= FUZZY_DEDUP_THRESHOLD
    const deduped = [];
    for (const lesson of store.lessons) {
        let merged = false;
        for (const kept of deduped) {
            if (lesson.phase !== kept.phase)
                continue;
            const sim = computePatternSimilarity(lesson.errorPattern, kept.errorPattern);
            if (sim >= FUZZY_DEDUP_THRESHOLD) {
                // Merge counts into kept
                kept.helpfulCount = (kept.helpfulCount ?? 0) + (lesson.helpfulCount ?? 0);
                kept.harmfulCount = (kept.harmfulCount ?? 0) + (lesson.harmfulCount ?? 0);
                kept.hitCount = kept.helpfulCount + kept.harmfulCount;
                report.actions.push({
                    action: 'merged', phase: lesson.phase, errorPattern: lesson.errorPattern,
                    reason: `Fuzzy dedup: similarity ${sim.toFixed(2)} >= ${FUZZY_DEDUP_THRESHOLD}`,
                });
                merged = true;
                break;
            }
        }
        if (!merged)
            deduped.push(lesson);
    }
    store.lessons = deduped;
    // Step 3: Clean up completed-task stashed failures
    store.stashedFailures = store.stashedFailures.filter((f) => {
        if (f.taskId === taskId)
            return false;
        const created = new Date(f.createdAt).getTime();
        return now - created < 7 * 24 * 60 * 60 * 1000;
    });
    // Step 4: Trim to max lessons — remove lowest quality score first
    if (store.lessons.length > MAX_LESSONS_AFTER_CURATION) {
        store.lessons.sort((a, b) => computeQualityScore(a.helpfulCount ?? 0, a.harmfulCount ?? 0) -
            computeQualityScore(b.helpfulCount ?? 0, b.harmfulCount ?? 0));
        const removed = store.lessons.splice(0, store.lessons.length - MAX_LESSONS_AFTER_CURATION);
        for (const r of removed) {
            report.actions.push({
                action: 'pruned', phase: r.phase, errorPattern: r.errorPattern,
                reason: 'Exceeded max lessons after curation (' + MAX_LESSONS_AFTER_CURATION + ')',
            });
        }
    }
    // Mark remaining as kept
    for (const lesson of store.lessons) {
        report.actions.push({
            action: 'kept', phase: lesson.phase, errorPattern: lesson.errorPattern,
            reason: 'Active lesson: hitCount=' + lesson.hitCount,
        });
    }
    report.lessonsAfter = store.lessons.length;
    report.stashedAfter = store.stashedFailures.length;
    // Save cleaned store
    try {
        const dir = dirname(REFLECTOR_PATH);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        writeFileSync(REFLECTOR_PATH, JSON.stringify(store, null, 2), 'utf-8');
    }
    catch { /* Non-fatal: store might be locked */ }
    saveCuratorReport(report);
    extractAndStoreBullets(store.lessons);
    return report;
}
//# sourceMappingURL=curator.js.map