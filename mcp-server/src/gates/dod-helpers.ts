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
  if (/^(?:[-*]\s+)?[A-Z]{1,5}-[A-Z0-9]{1,5}(?:-\d{1,4})?[:：]/.test(trimmed)) return true;
  if (/^#{1,6}\s/.test(trimmed)) return true;
  if (/^[-*_]{3,}\s*$/.test(trimmed)) return true;
  if (/^`{3,}/.test(trimmed)) return true;
  if (/^\|[\s\-:|]+\|$/.test(trimmed)) return true;
  if (/^\|.+\|.+\|/.test(trimmed)) return true;
  if (/^\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed)) return true;
  if (/^[-*]\s+\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed)) return true;
  if (/^(?:[-*]\s+)?.{1,50}[:：]\s*$/.test(trimmed)) return true;
  // F-001 / AC-1: short hyphen-bullet body (<=40 chars total, no terminating punctuation) is structural
  if (/^-\s+\S/.test(trimmed) && trimmed.length <= 40 && !/[.。!?！？]\s*$/.test(trimmed)) return true;
  // Mermaid syntax keywords
  if (/^(graph|subgraph|end|classDef|class |pie|gantt|sequenceDiagram|flowchart)\b/.test(trimmed)) return true;
  // Mermaid arrows
  if (/^\S+\s*-->/.test(trimmed) || /^\S+\s*---/.test(trimmed)) return true;
  // HTML tags
  if (/^<\/?[a-z]/i.test(trimmed)) return true;
  // Shell commands
  if (/^(#!\/|\$\s)/.test(trimmed)) return true;
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

const AI_SLOP_CATEGORIES: Record<string, RegExp> = {
  hedging: /\b(it seems like|perhaps|maybe|might be|could potentially|it appears that)\b/gi,
  empty_emphasis: /\b(it is important to note|it is worth noting|it should be noted)\b/gi,
  redundant_preamble: /\b(as mentioned (earlier|above|before|previously))\b/gi,
  vague_connectors: /\b(in terms of|with respect to|in the context of)\b/gi,
  ai_buzzwords: /\b(delve|tapestry|intricate|landscape|leverag(?:e|ing)|comprehensive|robust|holistic|synerg(?:y|ies|istic))\b/gi,
};

export function checkAiSlopPatterns(content: string): string[] {
  const textLines = extractNonCodeLines(content);
  const text = textLines.join('\n');
  const warnings: string[] = [];
  for (const [category, regex] of Object.entries(AI_SLOP_CATEGORIES)) {
    const matches = text.match(regex);
    if (matches && matches.length >= 2) {
      warnings.push(`AI hedging: ${category} pattern found ${matches.length} times`);
    }
  }
  return warnings;
}

const DUPLICATE_THRESHOLD = 5;

export function checkDuplicateLines(content: string): string[] {
  // Split content by section headers (## )
  const sections = content.split(/(?=^##\s)/m);
  const duplicates: string[] = [];

  for (const section of sections) {
    const nonCodeLines = extractNonCodeLines(section);
    const countMap = new Map<string, number>();

    for (const line of nonCodeLines) {
      const trimmed = line.trim();
      if (!trimmed || isStructuralLine(trimmed)) continue;
      countMap.set(trimmed, (countMap.get(trimmed) ?? 0) + 1);
    }

    for (const [line, count] of countMap) {
      if (count >= DUPLICATE_THRESHOLD) {
        duplicates.push(`"${line.substring(0, 60)}..." (${count}x)`);
      }
    }
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
