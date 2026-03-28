/**
 * DoD L4 content validation: forbidden patterns, placeholders, duplicates, required sections.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { extname } from 'node:path';
import { resolveProjectPath } from '../utils/project-root.js';
import { decode as toonDecode } from '@toon-format/toon';
import type { PhaseConfig } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import {
  checkForbiddenPatterns,
  checkBracketPlaceholders,
  checkDuplicateLines,
  checkAiSlopPatterns,
} from './dod-helpers.js';
import type { DoDCheckResult } from './dod-types.js';

interface ToonKeyCheckResult { missingKeys: string[]; parseError?: string }

function checkRequiredToonKeys(content: string, requiredKeys: string[]): ToonKeyCheckResult {
  if (requiredKeys.length === 0) return { missingKeys: [] };
  let obj: unknown;
  try {
    obj = toonDecode(content);
  } catch (e) {
    // Detect common TOON parse errors and provide actionable guidance
    const msg = e instanceof Error ? e.message : String(e);
    const lines = content.split('\n');
    const mdHeaders = lines.filter(l => /^#{1,6}\s/.test(l));
    if (mdHeaders.length > 0) {
      return { missingKeys: requiredKeys, parseError: `TOON parse error: Markdown headers detected (${mdHeaders.length} lines starting with #). TOON uses "key: value" format, not Markdown. Remove all ## headers and use TOON key syntax instead. First offending line: "${mdHeaders[0].slice(0, 60)}"` };
    }
    return { missingKeys: requiredKeys, parseError: `TOON parse error: ${msg.slice(0, 200)}. Ensure file uses TOON format (key: value), not Markdown or JSON.` };
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return { missingKeys: requiredKeys };
  const record = obj as Record<string, unknown>;
  return { missingKeys: requiredKeys.filter(key => !(key in record)) };
}

export function checkL4ContentValidation(phase: string, docsDir: string, workflowDir: string): DoDCheckResult {
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config || !config.outputFile) {
    return { level: 'L4', check: 'content_validation', passed: true, evidence: 'No content validation required for this phase' };
  }
  const outputFile = resolveProjectPath(config.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir));
  if (!existsSync(outputFile)) {
    return { level: 'L4', check: 'content_validation', passed: false, evidence: `Cannot validate content: file missing: ${outputFile}`, fix: '成果物ファイルが指定パスに存在しません。正しいパスに保存してください。' };
  }
  const content = readFileSync(outputFile, 'utf8');
  const errors: string[] = [];

  const forbidden = checkForbiddenPatterns(content);
  if (forbidden.length > 0) errors.push(`Forbidden patterns found: ${forbidden.join(', ')}`);

  if (checkBracketPlaceholders(content)) errors.push('Bracket placeholders [#...#] found in content');

  if (extname(outputFile) !== '.mmd') {
    const duplicates = checkDuplicateLines(content);
    if (duplicates.length > 0) errors.push(`Duplicate lines (3+ times): ${duplicates.slice(0, 3).join('; ')}`);
  }

  const slopWarnings = checkAiSlopPatterns(content);

  // Code fence check: phases with noCodeFences=true must not contain fenced code blocks
  if (config.noCodeFences && extname(outputFile) !== '.mmd') {
    const CODE_FENCE_REGEX = /^`{3,}/gm;
    const lines = content.split('\n');
    const fenceLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (CODE_FENCE_REGEX.test(lines[i])) {
        fenceLines.push(`line ${i + 1}`);
      }
      CODE_FENCE_REGEX.lastIndex = 0;
    }
    if (fenceLines.length > 0) {
      const fenceBasename = outputFile.split(/[\\/]/).pop() ?? outputFile;
      slopWarnings.push(`[WARN] Code fences found in ${fenceBasename}: at ${fenceLines.join(', ')}`);
    }
  }

  // TOON key checks only apply to .toon files; skip for .mmd and other non-TOON formats
  if (extname(outputFile) === '.toon') {
    const toonCheck = checkRequiredToonKeys(content, config.requiredSections ?? []);
    if (toonCheck.parseError) errors.push(toonCheck.parseError);
    else if (toonCheck.missingKeys.length > 0) errors.push(`Missing required TOON keys: ${toonCheck.missingKeys.join(', ')}`);
  }

  // Markdown section checks for .md phase artifacts (DJ-1)
  if (extname(outputFile) === '.md') {
    const requiredSections = config.requiredSections ?? [];
    if (requiredSections.length > 0) {
      const headings = content.split('\n').filter(l => /^#{1,3}\s/.test(l)).map(l => l.replace(/^#+\s*/, '').trim().toLowerCase());
      const missing = requiredSections.filter(s => !headings.includes(s.toLowerCase()));
      if (missing.length > 0) errors.push(`Missing required Markdown sections: ${missing.join(', ')}`);
    }
  }

  const passed = errors.length === 0;
  const warnSuffix = slopWarnings.length > 0 ? ` [WARN] ${slopWarnings.join('; ')}` : '';
  return {
    level: 'L4', check: 'content_validation', passed,
    evidence: (passed ? 'Content validation passed: no forbidden patterns, placeholders, or duplicates' : errors.join('; ')) + warnSuffix,
    ...(!passed && { fix: errors.some(e => e.includes('Forbidden')) ? '指摘された禁止語を削除し、具体的な実例に置き換えてください。' : errors.some(e => e.includes('Duplicate')) ? '繰り返されている行をそれぞれ異なる内容に書き換えてください。' : errors.some(e => e.includes('Missing required TOON')) ? '必須TOONキー(decisions/artifacts/next)を成果物に追加してください。' : errors.some(e => e.includes('Missing required Markdown')) ? '必須セクション(## decisions/## artifacts/## next)を追加してください。' : errors.some(e => e.includes('TOON parse')) ? '.toonファイルに ## ヘッダーやMarkdown記法を書かないこと。TOON形式は key: value のみ。' : '指摘された内容バリデーションエラーを修正してください。' }),
  };
}
