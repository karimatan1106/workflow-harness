/**
 * DoD L4 requirements checks: AC format (IA-2), NOT_IN_SCOPE (IA-2), OPEN_QUESTIONS (IA-1).
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';

export function checkACFormat(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') {
    return { level: 'L4', check: 'ac_format', passed: true, evidence: 'AC format check not required for phase: ' + phase };
  }
  const reqPath = docsDir + '/requirements.md';
  if (!existsSync(reqPath)) {
    return { level: 'L4', check: 'ac_format', passed: false, evidence: 'requirements.md not found at: ' + reqPath };
  }
  const content = readFileSync(reqPath, 'utf8');
  const acCount = (content.match(/^AC-\d+:/gm) ?? []).length;
  if (acCount < 3) {
    return {
      level: 'L4', check: 'ac_format', passed: false,
      evidence: `requirements.md contains only ${acCount} AC-N entries (minimum 3 required). Format: AC-1: <description>\n修正方法: ## 受入基準 セクションに AC-1:/AC-2:/AC-3: 形式でAC項目を${3 - acCount}件追加してください。`,
    };
  }
  return { level: 'L4', check: 'ac_format', passed: true, evidence: `requirements.md contains ${acCount} AC-N entries (minimum 3 met)` };
}

export function checkNotInScope(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') {
    return { level: 'L4', check: 'not_in_scope_section', passed: true, evidence: 'NOT_IN_SCOPE check not required for phase: ' + phase };
  }
  const reqPath = docsDir + '/requirements.md';
  if (!existsSync(reqPath)) {
    return { level: 'L4', check: 'not_in_scope_section', passed: false, evidence: 'requirements.md not found at: ' + reqPath };
  }
  const content = readFileSync(reqPath, 'utf8');
  const hasNotInScope = /^##\s*(NOT_IN_SCOPE|スコープ外)/m.test(content);
  return {
    level: 'L4', check: 'not_in_scope_section', passed: hasNotInScope,
    evidence: hasNotInScope
      ? 'NOT_IN_SCOPE section found in requirements.md'
      : 'requirements.md is missing ## NOT_IN_SCOPE section\n修正方法: requirements.md に ## NOT_IN_SCOPE セクションを追加し、スコープ外の機能を列挙してください。',
  };
}

// CIC-1 (S2-28): Cross-phase intent consistency — ensure requirements.md reflects userIntent
export function checkIntentConsistency(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') {
    return { level: 'L4', check: 'intent_consistency', passed: true, evidence: 'Intent consistency check not required for phase: ' + phase };
  }
  const reqPath = docsDir + '/requirements.md';
  if (!existsSync(reqPath)) {
    return { level: 'L4', check: 'intent_consistency', passed: false, evidence: 'requirements.md not found for intent consistency check' };
  }
  const content = readFileSync(reqPath, 'utf8').toLowerCase();
  const stopWords = new Set(['する', 'ある', 'いる', 'こと', 'ため', 'から', 'まで', 'また', 'この', 'その', 'また', 'そして', 'the', 'and', 'for', 'this', 'that', 'with', 'from', 'into']);
  const keywords = state.userIntent
    .split(/[\s、。・,. ]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()))
    .slice(0, 10);
  if (keywords.length === 0) {
    return { level: 'L4', check: 'intent_consistency', passed: true, evidence: 'No extractable keywords from userIntent' };
  }
  const missing = keywords.filter(kw => !content.includes(kw.toLowerCase()));
  if (missing.length >= 3) {
    return {
      level: 'L4', check: 'intent_consistency', passed: false,
      evidence: `意図整合性警告: ${missing.length}語が requirements.md に未反映: ${missing.slice(0, 5).join(', ')}\n修正方法: requirements.md にユーザー意図の主要キーワードを反映してください。`,
    };
  }
  // CIC-1 L3: requirements.md line count must be >= userIntent.length / 5
  const rawContent = readFileSync(reqPath, 'utf8');
  const lineCount = rawContent.split('\n').length;
  const minLineCount = Math.floor(state.userIntent.length / 5);
  if (minLineCount > 0 && lineCount < minLineCount) {
    return {
      level: 'L4', check: 'intent_consistency', passed: false,
      evidence: `requirements.md が不十分な詳細度: ${lineCount}行 < 最低${minLineCount}行（userIntent長/${5}）\n修正方法: requirements.md に各機能要件・AC・制約の詳細を追記してください。`,
    };
  }
  return { level: 'L4', check: 'intent_consistency', passed: true, evidence: `Intent consistency OK: ${keywords.length - missing.length}/${keywords.length} keywords found, ${lineCount} lines (min ${minLineCount})` };
}

export function checkOpenQuestions(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') {
    return { level: 'L4', check: 'open_questions_section', passed: true, evidence: 'OPEN_QUESTIONS check not required for phase: ' + phase };
  }
  const reqPath = docsDir + '/requirements.md';
  if (!existsSync(reqPath)) {
    return { level: 'L4', check: 'open_questions_section', passed: false, evidence: 'requirements.md not found at: ' + reqPath };
  }
  const content = readFileSync(reqPath, 'utf8');
  const hasOpenQuestions = /^##\s*OPEN_QUESTIONS/m.test(content);
  return {
    level: 'L4', check: 'open_questions_section', passed: hasOpenQuestions,
    evidence: hasOpenQuestions
      ? 'OPEN_QUESTIONS section found in requirements.md'
      : 'requirements.md is missing ## OPEN_QUESTIONS section\n修正方法: requirements.md に ## OPEN_QUESTIONS セクションを追加してください。未解決の場合は「なし」と記入。',
  };
}
