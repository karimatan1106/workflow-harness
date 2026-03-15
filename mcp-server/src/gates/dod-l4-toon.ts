/**
 * DoD L4 TOON safety checks: pre-parse validation for common TOON format errors.
 * Checks colon spacing and tabular array field count mismatches.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { normalize } from 'node:path';
import type { PhaseConfig } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import type { DoDCheckResult } from './dod-types.js';

/** Count fields in a tabular array row, respecting quoted strings. */
function countFields(row: string): number {
  let count = 1;
  let inQuotes = false;
  for (const ch of row) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) count++;
  }
  return count;
}

/** Check A: Missing space after colon in key:value lines. */
function checkColonSpacing(lines: string[]): DoDCheckResult | null {
  const offending: string[] = [];
  for (const line of lines) {
    if (/^\s/.test(line)) continue; // skip indented array rows
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*:[^\s]/.test(line)) continue;
    // Exclude URLs in the value portion
    const colonIdx = line.indexOf(':');
    const afterColon = line.slice(colonIdx);
    if (afterColon.startsWith('://')) continue;
    offending.push(line);
    if (offending.length >= 3) break;
  }
  if (offending.length === 0) return null;
  const evidence = `Missing space after colon in ${offending.length} line(s): ${offending.map(l => `"${l.slice(0, 80)}"`).join(', ')}`;
  return {
    level: 'L4', check: 'toon_safety', passed: false, evidence,
    fix: 'TOONの "key: value" 形式ではコロンの後にスペースが必要です。"key:value" → "key: value" に修正してください。',
  };
}

/** Check B+C: Tabular array field count mismatch with quoting hint. */
function checkFieldCount(lines: string[]): DoDCheckResult | null {
  const headerRe = /^(\w+)\[(\d+)]\{([^}]+)}:/;
  const mismatches: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = headerRe.exec(lines[i]);
    if (!m) continue;
    const arrayName = m[1];
    const declaredFields = m[3].split(',').length;
    // Check indented rows below
    let rowNum = 0;
    for (let j = i + 1; j < lines.length; j++) {
      if (!/^\s/.test(lines[j])) break;
      if (lines[j].trim() === '') continue;
      rowNum++;
      const actual = countFields(lines[j].trim());
      if (actual !== declaredFields) {
        mismatches.push(`テーブル配列 "${arrayName}" の行${rowNum}: フィールド数 ${actual} != 宣言数 ${declaredFields}`);
      }
    }
  }
  if (mismatches.length === 0) return null;
  const evidence = mismatches.slice(0, 3).join('; ');
  return {
    level: 'L4', check: 'toon_safety', passed: false, evidence,
    fix: 'テーブル配列のフィールド数がヘッダー宣言と一致しません。各行のカンマ区切りフィールド数を確認してください。値にカンマが含まれる場合は "..." で囲んでください。',
  };
}

/**
 * Run TOON pre-parse safety checks on the phase output file.
 * Returns the FIRST failure found (A prioritized over B).
 */
export function checkToonSafety(phase: string, docsDir: string, workflowDir: string): DoDCheckResult {
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config || !config.outputFile) {
    return { level: 'L4', check: 'toon_safety', passed: true, evidence: 'No output file for this phase' };
  }
  const outputFile = normalize(config.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir));
  if (!existsSync(outputFile)) {
    return { level: 'L4', check: 'toon_safety', passed: true, evidence: 'Output file not found; skipped (L1 handles)' };
  }
  const content = readFileSync(outputFile, 'utf8');
  const lines = content.split('\n');

  // Check A: colon spacing (prioritized)
  const colonResult = checkColonSpacing(lines);
  if (colonResult) return colonResult;

  // Check B+C: field count mismatch
  const fieldResult = checkFieldCount(lines);
  if (fieldResult) return fieldResult;

  return { level: 'L4', check: 'toon_safety', passed: true, evidence: 'TOON pre-parse safety OK' };
}
