/**
 * Reflector — learns from validation failures to improve future subagent prompts.
 * Stores (phase, errorPattern, lesson) tuples; injects relevant lessons into prompts.
 * Max 50 lessons kept (quality-score eviction).
 * Persistence: TOON format (reflector-log.toon).
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { ReflectorLesson, StashedFailure, ReflectorStore } from './reflector-types.js';
import { isV2Store, migrateV2toV3 } from './reflector-types.js';
import { serializeStore, parseStore } from './reflector-toon.js';

export type { ReflectorLesson } from './reflector-types.js';

const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const REFLECTOR_PATH = join(STATE_DIR, 'reflector-log.toon');
const LEGACY_JSON_PATH = join(STATE_DIR, 'reflector-log.json');
const MAX_LESSONS = 50;

/** N-07: Minimum quality score for lesson injection. */
export const MIN_QUALITY_SCORE = 0.3;

/* ── Load / Save ── */

export function loadStore(): ReflectorStore {
  try {
    // Migration: JSON → TOON
    if (!existsSync(REFLECTOR_PATH) && existsSync(LEGACY_JSON_PATH)) {
      const raw = readFileSync(LEGACY_JSON_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      const migrated = isV2Store(parsed) ? migrateV2toV3(parsed) : parsed as ReflectorStore;
      if (!migrated.stashedFailures) migrated.stashedFailures = [];
      if (!migrated.nextLessonId) migrated.nextLessonId = migrated.lessons.length + 1;
      saveStore(migrated);
      return migrated;
    }
    if (existsSync(REFLECTOR_PATH)) {
      return parseStore(readFileSync(REFLECTOR_PATH, 'utf-8'));
    }
  } catch { /* corrupted file — start fresh */ }
  return { version: 3, nextLessonId: 1, lessons: [], stashedFailures: [] };
}

function saveStore(store: ReflectorStore): void {
  const dir = dirname(REFLECTOR_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(REFLECTOR_PATH, serializeStore(store), 'utf-8');
}

/* ── Core logic (unchanged signatures) ── */

function qualityScore(l: ReflectorLesson): number {
  if (l.helpfulCount === 0 && l.harmfulCount === 0) return 0.5;
  return l.helpfulCount / (l.helpfulCount + l.harmfulCount + 1);
}

function nextId(store: ReflectorStore): string {
  const id = `L-${String(store.nextLessonId).padStart(3, '0')}`;
  store.nextLessonId += 1;
  return id;
}

export function stashFailure(taskId: string, phase: string, errorMessage: string, retryCount: number): void {
  const store = loadStore();
  const pattern = extractErrorPattern(errorMessage);
  const sfIdx = store.stashedFailures.findIndex(f => f.taskId === taskId && f.phase === phase);
  const entry: StashedFailure = {
    phase, taskId, errorPattern: pattern, errorMessage: errorMessage.substring(0, 500),
    retryCount, createdAt: new Date().toISOString(),
  };
  if (sfIdx >= 0) store.stashedFailures[sfIdx] = entry;
  else {
    store.stashedFailures.push(entry);
    if (store.stashedFailures.length > 20) store.stashedFailures = store.stashedFailures.slice(-20);
  }
  const existing = store.lessons.find(l => l.phase === phase && l.errorPattern === pattern);
  if (existing) {
    existing.harmfulCount += 1;
    existing.hitCount = existing.helpfulCount + existing.harmfulCount;
  }
  saveStore(store);
}

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
    if (existing.helpfulCount >= 2 && !existing.preventionRule) {
      existing.preventionRule = generatePreventionRule(stashed.errorPattern);
    }
  } else {
    store.lessons.push({
      id: nextId(store), phase, errorPattern: stashed.errorPattern, lesson,
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

const PREVENTION_RULES: Array<[RegExp, string]> = [
  [/Forbidden patterns? found/i, '禁止語(TODO/WIP/FIXME等)の使用禁止。具体的な計画・説明に置き換えること。'],
  [/Section density/i, '実質行密度30%未満禁止。各セクションの密度30%以上を維持し、構造要素でなく説明文を追加すること。'],
  [/Missing required sections/i, '必須セクション省略禁止。テンプレートの全セクションヘッダーを維持すること。'],
  [/Duplicate lines/i, '同一行の3回以上の繰り返し禁止。各行に文脈固有の情報を含めること。'],
  [/Bracket placeholder/i, '[#xxx#]形式のプレースホルダー禁止。具体的な内容に置き換えること。'],
  [/[Cc]ontent lines/i, '実質行数不足禁止。空行・構造要素でなく説明・分析・根拠を追加すること。'],
  [/No baseline captured/i, 'テストベースライン未記録禁止。testingフェーズでharness_capture_baselineを実行すること。'],
];

function generatePreventionRule(errorPattern: string): string {
  const match = PREVENTION_RULES.find(([re]) => re.test(errorPattern));
  return match ? match[1] : `同一エラーパターン「${errorPattern.substring(0, 40)}」の再発禁止。成果物品質要件を確認すること。`;
}

export function getLessonsForPhase(phase: string): ReflectorLesson[] {
  const store = loadStore();
  const relevant = store.lessons
    .filter(l => (l.phase === phase || l.phase === 'all') && qualityScore(l) >= MIN_QUALITY_SCORE);
  relevant.sort((a, b) => qualityScore(b) - qualityScore(a));
  return relevant.slice(0, 5);
}

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

export function getPreventionRules(phase: string): string[] {
  const store = loadStore();
  return store.lessons
    .filter(l => (l.phase === phase || l.phase === 'all') && l.preventionRule)
    .map(l => l.preventionRule!);
}

export function extractErrorPattern(errorMessage: string): string {
  const patterns = [
    /Forbidden patterns? found: (.+)/i, /Missing required sections: (.+)/i,
    /Duplicate lines.*: (.+)/i, /Section density.*: (.+)/i,
    /Content lines.*: (.+)/i, /has only (\d+) content lines/i,
    /Bracket placeholder/i, /No baseline captured/i, /non-zero exit code/i,
  ];
  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) return match[0].substring(0, 80);
  }
  return errorMessage.substring(0, 80).trim();
}
