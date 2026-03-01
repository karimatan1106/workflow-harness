/**
 * DoD L4 content validation: forbidden patterns, placeholders, duplicates, required sections.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { decode as toonDecode } from '@toon-format/toon';
import type { PhaseConfig } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import {
  checkForbiddenPatterns,
  checkBracketPlaceholders,
  checkDuplicateLines,
} from './dod-helpers.js';
import type { DoDCheckResult } from './dod-types.js';

function checkRequiredToonKeys(content: string, requiredKeys: string[]): string[] {
  if (requiredKeys.length === 0) return [];
  let obj: unknown;
  try {
    obj = toonDecode(content);
  } catch {
    return requiredKeys;
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return requiredKeys;
  const record = obj as Record<string, unknown>;
  return requiredKeys.filter(key => !(key in record));
}

export function checkL4ContentValidation(phase: string, docsDir: string, workflowDir: string): DoDCheckResult {
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config || !config.outputFile) {
    return { level: 'L4', check: 'content_validation', passed: true, evidence: 'No content validation required for this phase' };
  }
  const outputFile = config.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir);
  if (!existsSync(outputFile)) {
    return { level: 'L4', check: 'content_validation', passed: false, evidence: `Cannot validate content: file missing: ${outputFile}` };
  }
  const content = readFileSync(outputFile, 'utf8');
  const errors: string[] = [];

  const forbidden = checkForbiddenPatterns(content);
  if (forbidden.length > 0) errors.push(`Forbidden patterns found: ${forbidden.join(', ')}`);

  if (checkBracketPlaceholders(content)) errors.push('Bracket placeholders [#...#] found in content');

  const duplicates = checkDuplicateLines(content);
  if (duplicates.length > 0) errors.push(`Duplicate lines (3+ times): ${duplicates.slice(0, 3).join('; ')}`);

  const missingKeys = checkRequiredToonKeys(content, config.requiredSections ?? []);
  if (missingKeys.length > 0) errors.push(`Missing required TOON keys: ${missingKeys.join(', ')}`);

  const passed = errors.length === 0;
  return {
    level: 'L4', check: 'content_validation', passed,
    evidence: passed ? 'Content validation passed: no forbidden patterns, placeholders, or duplicates' : errors.join('; '),
  };
}
