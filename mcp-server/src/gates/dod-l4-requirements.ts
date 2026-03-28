/**
 * DoD L4 requirements checks: AC format (IA-2), NOT_IN_SCOPE (IA-2), OPEN_QUESTIONS (IA-1).
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';
import { resolveProjectPath } from '../utils/project-root.js';

export const MIN_ACCEPTANCE_CRITERIA = 5;

/** Parse Markdown content into sections keyed by heading text (lowercased). */
function parseMarkdownSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split('\n');
  let currentSection = '';
  let currentContent: string[] = [];
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (currentSection) {
        sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
      }
      currentSection = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentSection) {
    sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
  }
  return sections;
}

interface ReqFileResult {
  reqPath: string;
  content: string;
  sections: Record<string, string>;
}

/** Load requirements.md: read file and parse sections. Returns null if missing/unparseable. */
function loadRequirementsFile(docsDir: string): ReqFileResult | null {
  const reqPath = resolveProjectPath(docsDir) + '/requirements.md';
  if (!existsSync(reqPath)) return null;
  const content = readFileSync(reqPath, 'utf8');
  const sections = parseMarkdownSections(content);
  if (Object.keys(sections).length === 0) return null;
  return { reqPath, content, sections };
}

/** Build a skip result for non-requirements phases. */
function skipForNonRequirements(check: string, phase: string): DoDCheckResult {
  return { level: 'L4', check, passed: true, evidence: `${check} check not required for phase: ${phase}` };
}

/** Build a fail result when requirements.md is missing or unparseable. */
function reqFileMissing(check: string, docsDir: string): DoDCheckResult {
  const reqPath = resolveProjectPath(docsDir) + '/requirements.md';
  return {
    level: 'L4', check, passed: false,
    evidence: `requirements.md not found or unparseable at: ${reqPath}`,
    fix: 'requirementsフェーズの成果物(requirements.md)を作成し、## ヘッダーでセクションを定義してください。',
  };
}

export function checkACFormat(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') return skipForNonRequirements('ac_format', phase);
  const req = loadRequirementsFile(docsDir);
  if (!req) return reqFileMissing('ac_format', docsDir);
  const acMatches = req.content.match(/AC-\d+/g) ?? [];
  const acCount = new Set(acMatches).size;
  if (acCount < MIN_ACCEPTANCE_CRITERIA) {
    return {
      level: 'L4', check: 'ac_format', passed: false,
      evidence: `requirements.md contains only ${acCount} acceptanceCriteria entries (minimum ${MIN_ACCEPTANCE_CRITERIA} required)\n修正方法: acceptanceCriteriaセクションにAC項目を${MIN_ACCEPTANCE_CRITERIA - acCount}件追加してください。`,
      fix: `最低${MIN_ACCEPTANCE_CRITERIA}件のAC-N形式の受入基準を追加してください。`,
      example: '## acceptanceCriteria\n- AC-1: 機能Xが正常に動作すること',
    };
  }
  return { level: 'L4', check: 'ac_format', passed: true, evidence: `requirements.md contains ${acCount} acceptanceCriteria entries (minimum ${MIN_ACCEPTANCE_CRITERIA} met)` };
}

export function checkNotInScope(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') return skipForNonRequirements('not_in_scope_section', phase);
  const req = loadRequirementsFile(docsDir);
  if (!req) return reqFileMissing('not_in_scope_section', docsDir);
  const hasNotInScope = Object.keys(req.sections).some(k => k.replace(/[_\s]/g, '').includes('notinscope'));
  return {
    level: 'L4', check: 'not_in_scope_section', passed: hasNotInScope,
    evidence: hasNotInScope
      ? 'notInScope section found in requirements.md'
      : 'requirements.md is missing notInScope section\n修正方法: requirements.md に ## notInScope セクションを追加し、スコープ外の機能を列挙してください。',
    ...(!hasNotInScope && { fix: 'notInScopeセクションを追加し、スコープ外の項目を明示してください。', example: '## notInScope\n- パフォーマンス最適化' }),
  };
}

// CIC-1 (S2-28): Cross-phase intent consistency — ensure requirements.md reflects userIntent
// Note: this check reads raw content only (no section parsing needed), so it bypasses loadRequirementsFile.
export function checkIntentConsistency(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') return skipForNonRequirements('intent_consistency', phase);
  const reqPath = resolveProjectPath(docsDir) + '/requirements.md';
  if (!existsSync(reqPath)) return reqFileMissing('intent_consistency', docsDir);
  const rawContent = readFileSync(reqPath, 'utf8').toLowerCase();
  const stopWords = new Set(['する', 'ある', 'いる', 'こと', 'ため', 'から', 'まで', 'また', 'この', 'その', 'また', 'そして', 'the', 'and', 'for', 'this', 'that', 'with', 'from', 'into']);
  const keywords = state.userIntent
    .split(/[\s、。・,. ]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()))
    .slice(0, 10);
  if (keywords.length === 0) {
    return { level: 'L4', check: 'intent_consistency', passed: true, evidence: 'No extractable keywords from userIntent' };
  }
  const missing = keywords.filter(kw => !rawContent.includes(kw.toLowerCase()));
  if (missing.length >= 3) {
    return {
      level: 'L4', check: 'intent_consistency', passed: false,
      evidence: `意図整合性警告: ${missing.length}語が requirements.md に未反映: ${missing.slice(0, 5).join(', ')}\n修正方法: requirements.md にユーザー意図の主要キーワードを反映してください。`,
      fix: 'requirements.mdにユーザー意図の主要キーワードを反映してください。',
    };
  }
  const lineCount = rawContent.split('\n').length;
  const minLineCount = Math.floor(state.userIntent.length / 5);
  if (minLineCount > 0 && lineCount < minLineCount) {
    return {
      level: 'L4', check: 'intent_consistency', passed: false,
      evidence: `requirements.md が不十分な詳細度: ${lineCount}行 < 最低${minLineCount}行（userIntent長/${5}）\n修正方法: requirements.md に各機能要件・AC・制約の詳細を追記してください。`,
      fix: 'requirements.mdに各機能要件・AC・制約の詳細を追記してください。',
    };
  }
  return { level: 'L4', check: 'intent_consistency', passed: true, evidence: `Intent consistency OK: ${keywords.length - missing.length}/${keywords.length} keywords found, ${lineCount} lines (min ${minLineCount})` };
}

export function isOpenQuestion(q: unknown): boolean {
  if (q === null || q === undefined) return false;
  if (typeof q === 'string') return q !== '' && q !== 'なし';
  if (typeof q === 'object' && !Array.isArray(q)) {
    const obj = q as Record<string, unknown>;
    const question = obj['question'];
    if (typeof question === 'string') return question !== '' && question !== 'なし';
  }
  return false;
}

export function checkOpenQuestions(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') return skipForNonRequirements('open_questions_section', phase);
  const req = loadRequirementsFile(docsDir);
  if (!req) return reqFileMissing('open_questions_section', docsDir);
  const oqKey = Object.keys(req.sections).find(k => k.replace(/[_\s]/g, '').includes('openquestions'));
  if (!oqKey) {
    return { level: 'L4', check: 'open_questions_section', passed: false, evidence: 'requirements.md is missing openQuestions section\n修正方法: requirements.md に ## openQuestions セクションを追加してください。未解決の場合は空にしてください。', fix: 'openQuestionsセクションを追加してください。不明点がなければ空セクション。', example: '## openQuestions\n' };
  }
  const content = req.sections[oqKey];
  // Empty or "なし" means no open questions (resolved)
  const hasOpen = content !== '' && content !== 'なし' && content.trim().length > 0;
  if (hasOpen) {
    return { level: 'L4', check: 'open_questions_section', passed: false, evidence: 'openQuestionsに未解決の質問が残っています。全て解決するか、セクションを空にしてください。', fix: 'openQuestionsの未解決質問を解決してください。' };
  }
  return { level: 'L4', check: 'open_questions_section', passed: true, evidence: 'openQuestions section found in requirements.md with no open items' };
}
