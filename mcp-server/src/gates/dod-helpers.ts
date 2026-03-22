/**
 * DoD helper utilities: forbidden patterns, structural line detection,
 * content extraction, duplicate detection, and section validation.
 * @spec docs/spec/features/workflow-harness.md
 */

import { existsSync } from 'fs';
import { resolve, basename } from 'path';

export const FORBIDDEN_PATTERNS: string[] = [
  'TODO', 'TBD', 'WIP', 'FIXME',
  '未定', '未確定', '要検討', '検討中', '対応予定', 'サンプル', 'ダミー', '仮置き',
];

export const BRACKET_PLACEHOLDER_REGEX = /\[#[^\]]{0,50}#\]/;

export function isStructuralLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^#{1,6}\s/.test(trimmed)) return true;
  if (/^[-*_]{3,}\s*$/.test(trimmed)) return true;
  if (/^`{3,}/.test(trimmed)) return true;
  if (/^\|[\s\-:|]+\|$/.test(trimmed)) return true;
  if (/^\|.+\|.+\|/.test(trimmed)) return true;
  if (/^\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed)) return true;
  if (/^[-*]\s+\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed)) return true;
  if (/^(?:[-*]\s+)?.{1,50}[:：]\s*$/.test(trimmed)) return true;
  return false;
}

export function extractNonCodeLines(content: string): string[] {
  const lines = content.split('\n');
  const result: string[] = [];
  let inCodeFence = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^`{3,}/.test(trimmed)) { inCodeFence = !inCodeFence; continue; }
    if (!inCodeFence) result.push(trimmed.replace(/`[^`]+`/g, ''));
  }
  return result;
}

function isInNegationContext(line: string, pattern: string): boolean {
  const idx = line.indexOf(pattern);
  if (idx < 0) return false;
  const before = line.slice(Math.max(0, idx - 20), idx);
  const negations = [
    'ない', 'なし', 'ゼロ', '不要', '無し', 'なく', 'ません',
    'not ', 'no ', "don't", 'avoid', 'never',
  ];
  return negations.some(n => before.includes(n));
}

export function checkForbiddenPatterns(content: string): string[] {
  const nonCodeLines = extractNonCodeLines(content);
  return FORBIDDEN_PATTERNS.filter(p =>
    nonCodeLines.some(line => {
      if (!line.includes(p)) return false;
      if (isInNegationContext(line, p)) return false;
      if (/^[A-Z]+$/.test(p)) {
        return new RegExp(`\\b${p}\\b`).test(line);
      }
      return true;
    })
  );
}

export function checkBracketPlaceholders(content: string): boolean {
  return BRACKET_PLACEHOLDER_REGEX.test(extractNonCodeLines(content).join('\n'));
}

export function checkDuplicateLines(content: string): string[] {
  const nonCodeLines = extractNonCodeLines(content);
  const countMap = new Map<string, number>();
  for (const line of nonCodeLines) {
    const trimmed = line.trim();
    if (!trimmed || isStructuralLine(trimmed)) continue;
    countMap.set(trimmed, (countMap.get(trimmed) ?? 0) + 1);
  }
  const duplicates: string[] = [];
  for (const [line, count] of countMap) {
    if (count >= 3) duplicates.push(`"${line.substring(0, 60)}..." (${count}x)`);
  }
  return duplicates;
}

export function checkRequiredSections(content: string, requiredSections: string[]): string[] {
  const lines = content.split('\n');
  return requiredSections.filter(section => {
    const sectionText = section.replace(/^#+\s*/, '');
    return !lines.some(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('#') && trimmed.replace(/^#+\s*/, '') === sectionText;
    });
  });
}

/** N-29: Check if file content exceeds line limit */
export function checkFileLineLimit(content: string, limit = 200): { exceeded: boolean; lineCount: number } {
  const lineCount = content.split('\n').length;
  return { exceeded: lineCount > limit, lineCount };
}

/** N-30: Parse TOON artifacts[] paths and check existence */
export function checkBrokenPointers(content: string, basePath: string): string[] {
  const broken: string[] = [];
  const artifactMatch = content.match(/artifacts\[.*?\].*?:\n((?:\s+.+\n)*)/);
  if (!artifactMatch) return broken;
  const lines = artifactMatch[1].split('\n').filter(l => l.trim());
  for (const line of lines) {
    const pathMatch = line.match(/^\s+(\S+),/);
    if (pathMatch) {
      const fullPath = resolve(basePath, pathMatch[1]);
      if (!existsSync(fullPath)) broken.push(pathMatch[1]);
    }
  }
  return broken;
}

/** N-32: Detect ghost files (new files with same basename as existing) */
export function detectGhostFiles(newFiles: string[], existingFiles: string[]): string[] {
  const existingBaseNames = new Set(existingFiles.map(f => basename(f)));
  return newFiles.filter(f => existingBaseNames.has(basename(f)));
}
