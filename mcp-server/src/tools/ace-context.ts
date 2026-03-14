/**
 * ACE cross-task knowledge store.
 * Promotes high-quality lessons (quality score >= 0.6) to a persistent
 * ace-context.json for injection into future tasks (OpenSage-style).
 * All operations are non-blocking — exceptions are caught and not re-thrown.
 * @spec docs/spec/features/workflow-harness.md
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { ReflectorLesson } from './reflector-types.js';
import { computeQualityScore } from './curator-helpers.js';
import { serializeBullets, parseBullets } from './ace-context-toon.js';

const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const ACE_TOON_PATH = join(STATE_DIR, 'ace-context.toon');
const ACE_JSON_PATH = join(STATE_DIR, 'ace-context.json');
const PROMOTE_THRESHOLD = 0.6;

export interface AceBullet {
  id: string;
  content: string;
  category: 'failure' | 'strategy' | 'constraint';
  phase: string;
  helpfulCount: number;
  harmfulCount: number;
  createdAt: string;
}

/** Migrate ace-context.json → ace-context.toon if needed. */
function migrateJsonToToon(): void {
  try {
    if (!existsSync(ACE_TOON_PATH) && existsSync(ACE_JSON_PATH)) {
      const raw = readFileSync(ACE_JSON_PATH, 'utf-8');
      const bullets = JSON.parse(raw) as AceBullet[];
      mkdirSync(STATE_DIR, { recursive: true });
      writeFileSync(ACE_TOON_PATH, serializeBullets(bullets), 'utf-8');
    }
  } catch {
    // Non-fatal
  }
}

function loadBullets(): AceBullet[] {
  try {
    migrateJsonToToon();
    const raw = readFileSync(ACE_TOON_PATH, 'utf-8');
    return parseBullets(raw);
  } catch {
    return [];
  }
}

function saveBullets(bullets: AceBullet[]): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(ACE_TOON_PATH, serializeBullets(bullets), 'utf-8');
  } catch {
    // Non-fatal: never propagate fs errors
  }
}

/**
 * Extract lessons with quality score >= 0.6 and store them as cross-task bullets.
 * Merges with existing bullets (dedup by id), then persists.
 */
export function extractAndStoreBullets(lessons: ReflectorLesson[]): void {
  try {
    const eligible = lessons.filter(l => {
      const score = (l.helpfulCount === 0 && l.harmfulCount === 0)
        ? 0.5
        : computeQualityScore(l.helpfulCount, l.harmfulCount);
      return score >= PROMOTE_THRESHOLD;
    });
    if (eligible.length === 0) return;

    const existing = loadBullets();
    const existingIds = new Set(existing.map(b => b.id));

    for (const l of eligible) {
      if (existingIds.has(l.id)) {
        // Update counts on existing bullet
        const b = existing.find(x => x.id === l.id);
        if (b) { b.helpfulCount = l.helpfulCount; b.harmfulCount = l.harmfulCount; }
      } else {
        existing.push({
          id: l.id,
          content: `${l.phase}: ${l.errorPattern} → ${l.lesson}`,
          category: l.category,
          phase: l.phase,
          helpfulCount: l.helpfulCount,
          harmfulCount: l.harmfulCount,
          createdAt: l.createdAt,
        });
        existingIds.add(l.id);
      }
    }
    saveBullets(existing);
  } catch {
    // Non-fatal
  }
}

/**
 * Return the top-n cross-task bullets sorted by quality score descending.
 * Returns an empty array if ace-context.toon is missing or unreadable.
 */
export function getTopCrossTaskBullets(n: number): AceBullet[] {
  try {
    const bullets = loadBullets();
    bullets.sort((a, b) => {
      const sa = computeQualityScore(a.helpfulCount, a.harmfulCount);
      const sb = computeQualityScore(b.helpfulCount, b.harmfulCount);
      return sb - sa;
    });
    return bullets.slice(0, n);
  } catch {
    return [];
  }
}
