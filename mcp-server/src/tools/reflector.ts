/**
 * Reflector — learns from validation failures to improve future subagent prompts.
 * Stores (phase, errorPattern, lesson) tuples; injects relevant lessons into prompts.
 * Max 50 lessons kept (quality-score eviction).
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { ReflectorLesson, StashedFailure, ReflectorStore } from './reflector-types.js';
import { isV2Store, migrateV2toV3 } from './reflector-types.js';

export type { ReflectorLesson } from './reflector-types.js';

const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const REFLECTOR_PATH = join(STATE_DIR, 'reflector-log.json');
const MAX_LESSONS = 50;

/** N-07: Minimum quality score for lesson injection. Lessons below this are excluded from prompts. */
export const MIN_QUALITY_SCORE = 0.3;

export function loadStore(): ReflectorStore {
  try {
    if (existsSync(REFLECTOR_PATH)) {
      const raw = readFileSync(REFLECTOR_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      // v2 → v3 migration (transparent)
      if (isV2Store(parsed)) return migrateV2toV3(parsed);
      if (!parsed.stashedFailures) { parsed.stashedFailures = []; }
      if (!parsed.nextLessonId) { parsed.nextLessonId = parsed.lessons.length + 1; }
      return parsed as ReflectorStore;
    }
  } catch { /* corrupted file — start fresh */ }
  return { version: 3, nextLessonId: 1, lessons: [], stashedFailures: [] };
}

function saveStore(store: ReflectorStore): void {
  const dir = dirname(REFLECTOR_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(REFLECTOR_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function qualityScore(l: ReflectorLesson): number {
  if (l.helpfulCount === 0 && l.harmfulCount === 0) return 0.5;
  return l.helpfulCount / (l.helpfulCount + l.harmfulCount + 1);
}

function nextId(store: ReflectorStore): string {
  const id = `L-${String(store.nextLessonId).padStart(3, '0')}`;
  store.nextLessonId += 1;
  return id;
}

/**
 * Stash a DoD failure for later promotion when retry succeeds.
 * Called on the FAILURE path of harness_next.
 */
export function stashFailure(taskId: string, phase: string, errorMessage: string, retryCount: number): void {
  const store = loadStore();
  const pattern = extractErrorPattern(errorMessage);
  const sfIdx = store.stashedFailures.findIndex(f => f.taskId === taskId && f.phase === phase);
  const entry: StashedFailure = {
    phase, taskId, errorPattern: pattern, errorMessage: errorMessage.substring(0, 500),
    retryCount, createdAt: new Date().toISOString(),
  };
  if (sfIdx >= 0) { store.stashedFailures[sfIdx] = entry; }
  else {
    store.stashedFailures.push(entry);
    if (store.stashedFailures.length > 20) store.stashedFailures = store.stashedFailures.slice(-20);
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
export function promoteStashedFailure(taskId: string, phase: string, retryCount: number): boolean {
  const store = loadStore();
  const idx = store.stashedFailures.findIndex(f => f.taskId === taskId && f.phase === phase);
  if (idx < 0) return false;
  const stashed = store.stashedFailures[idx];
  store.stashedFailures.splice(idx, 1);

  const lesson = `リトライ${retryCount}回目で成功。失敗パターン: ${stashed.errorPattern}`;
  const existing = store.lessons.find(l => l.phase === phase && l.errorPattern === stashed.errorPattern);
  if (existing) {
    existing.lesson = lesson;
    existing.helpfulCount += 1;
    existing.hitCount = existing.helpfulCount + existing.harmfulCount;
    existing.createdAt = new Date().toISOString();
    // G-08: Generate prevention rule after 2+ successful retries
    if (existing.helpfulCount >= 2 && !existing.preventionRule) {
      existing.preventionRule = generatePreventionRule(stashed.errorPattern);
    }
  } else {
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
 * G-08: Generate a prevention rule from an error pattern.
 * Maps known error patterns to actionable prevention instructions.
 */
function generatePreventionRule(errorPattern: string): string {
  if (/Forbidden patterns? found/i.test(errorPattern)) {
    return '禁止語(TODO/WIP/FIXME等)の使用禁止。具体的な計画・説明に置き換えること。';
  }
  if (/Section density/i.test(errorPattern)) {
    return '各セクションの実質行密度30%以上を維持禁止違反。構造要素でなく説明文を追加すること。';
  }
  if (/Missing required sections/i.test(errorPattern)) {
    return '必須セクション省略禁止。テンプレートの全セクションヘッダーを維持すること。';
  }
  if (/Duplicate lines/i.test(errorPattern)) {
    return '同一行の3回以上の繰り返し禁止。各行に文脈固有の情報を含めること。';
  }
  if (/Bracket placeholder/i.test(errorPattern)) {
    return '[#xxx#]形式のプレースホルダー禁止。具体的な内容に置き換えること。';
  }
  if (/Content lines/i.test(errorPattern) || /content lines/i.test(errorPattern)) {
    return '実質行数不足禁止。空行・構造要素でなく説明・分析・根拠を追加すること。';
  }
  if (/No baseline captured/i.test(errorPattern)) {
    return 'テストベースライン未記録禁止。testingフェーズでharness_capture_baselineを実行すること。';
  }
  return `同一エラーパターン「${errorPattern.substring(0, 40)}」の再発禁止。成果物品質要件を確認すること。`;
}

/**
 * Get lessons relevant to a given phase, sorted by quality score (highest first).
 */
export function getLessonsForPhase(phase: string): ReflectorLesson[] {
  const store = loadStore();
  const relevant = store.lessons
    .filter(l => (l.phase === phase || l.phase === 'all') && qualityScore(l) >= MIN_QUALITY_SCORE);
  relevant.sort((a, b) => qualityScore(b) - qualityScore(a));
  return relevant.slice(0, 5);
}

/**
 * Format lessons as a prompt section in ACE bullet format.
 * Returns empty string if no lessons exist for the phase.
 * Includes prevention rules (G-08) when available.
 */
export function formatLessonsForPrompt(phase: string): string {
  const lessons = getLessonsForPhase(phase);
  if (lessons.length === 0) return '';
  const lines = lessons.map(l => {
    let line = `[${l.id}][${l.category}] ${l.phase}: ${l.errorPattern} → ${l.lesson}`;
    if (l.preventionRule) line += `\n  ⛔ ${l.preventionRule}`;
    return line;
  });
  return '\n\n既知の落とし穴\n' + lines.join('\n') + '\n';
}

/**
 * G-08: Get prevention rules for a phase.
 * Returns rules from lessons that have been confirmed effective (helpfulCount >= 2).
 */
export function getPreventionRules(phase: string): string[] {
  const store = loadStore();
  return store.lessons
    .filter(l => (l.phase === phase || l.phase === 'all') && l.preventionRule)
    .map(l => l.preventionRule!);
}

/**
 * Extract a short error pattern from a full error message.
 */
export function extractErrorPattern(errorMessage: string): string {
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
    if (match) return match[0].substring(0, 80);
  }
  return errorMessage.substring(0, 80).trim();
}
