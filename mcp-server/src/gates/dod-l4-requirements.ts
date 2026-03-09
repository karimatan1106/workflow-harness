/**
 * DoD L4 requirements checks: AC format (IA-2), NOT_IN_SCOPE (IA-2), OPEN_QUESTIONS (IA-1).
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { decode as toonDecode } from '@toon-format/toon';
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';

function readRequirementsToon(docsDir: string): Record<string, unknown> | null {
  const reqPath = docsDir + '/requirements.toon';
  if (!existsSync(reqPath)) return null;
  try {
    const obj = toonDecode(readFileSync(reqPath, 'utf8'));
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function checkACFormat(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') {
    return { level: 'L4', check: 'ac_format', passed: true, evidence: 'AC format check not required for phase: ' + phase };
  }
  const reqPath = docsDir + '/requirements.toon';
  if (!existsSync(reqPath)) {
    return { level: 'L4', check: 'ac_format', passed: false, evidence: 'requirements.toon not found at: ' + reqPath, fix: 'requirementsフェーズの成果物(requirements.toon)を作成してください。' };
  }
  const toon = readRequirementsToon(docsDir);
  if (!toon) {
    return { level: 'L4', check: 'ac_format', passed: false, evidence: 'requirements.toon could not be decoded at: ' + reqPath, fix: '.toonファイルに ## ヘッダーやMarkdown記法を書かないこと。TOON形式は key: value のみ。' };
  }
  const acs = toon['acceptanceCriteria'];
  const acCount = Array.isArray(acs) ? acs.length : 0;
  if (acCount < 3) {
    return {
      level: 'L4', check: 'ac_format', passed: false,
      evidence: `requirements.toon contains only ${acCount} acceptanceCriteria entries (minimum 3 required)\n修正方法: acceptanceCriteria[N]{id,criterion}: テーブルにAC項目を${3 - acCount}件追加してください。`,
      fix: '最低3件のAC-N形式の受入基準を追加してください。',
      example: 'acceptanceCriteria[0]{id,criterion}:\n  AC-1\n  機能Xが正常に動作すること',
    };
  }
  return { level: 'L4', check: 'ac_format', passed: true, evidence: `requirements.toon contains ${acCount} acceptanceCriteria entries (minimum 3 met)` };
}

export function checkNotInScope(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') {
    return { level: 'L4', check: 'not_in_scope_section', passed: true, evidence: 'NOT_IN_SCOPE check not required for phase: ' + phase };
  }
  const reqPath = docsDir + '/requirements.toon';
  if (!existsSync(reqPath)) {
    return { level: 'L4', check: 'not_in_scope_section', passed: false, evidence: 'requirements.toon not found at: ' + reqPath, fix: 'requirementsフェーズの成果物(requirements.toon)を作成してください。' };
  }
  const toon = readRequirementsToon(docsDir);
  if (!toon) {
    return { level: 'L4', check: 'not_in_scope_section', passed: false, evidence: 'requirements.toon could not be decoded at: ' + reqPath, fix: '.toonファイルに ## ヘッダーやMarkdown記法を書かないこと。TOON形式は key: value のみ。' };
  }
  const hasNotInScope = 'notInScope' in toon;
  return {
    level: 'L4', check: 'not_in_scope_section', passed: hasNotInScope,
    evidence: hasNotInScope
      ? 'notInScope key found in requirements.toon'
      : 'requirements.toon is missing notInScope key\n修正方法: requirements.toon に notInScope[N]{item}: テーブルを追加し、スコープ外の機能を列挙してください。',
    ...(!hasNotInScope && { fix: 'notInScopeセクションを追加し、スコープ外の項目を明示してください。', example: 'notInScope[0]{item}:\n  パフォーマンス最適化' }),
  };
}

// CIC-1 (S2-28): Cross-phase intent consistency — ensure requirements.toon reflects userIntent
export function checkIntentConsistency(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') {
    return { level: 'L4', check: 'intent_consistency', passed: true, evidence: 'Intent consistency check not required for phase: ' + phase };
  }
  const reqPath = docsDir + '/requirements.toon';
  if (!existsSync(reqPath)) {
    return { level: 'L4', check: 'intent_consistency', passed: false, evidence: 'requirements.toon not found for intent consistency check', fix: 'requirementsフェーズの成果物(requirements.toon)を作成してください。' };
  }
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
      evidence: `意図整合性警告: ${missing.length}語が requirements.toon に未反映: ${missing.slice(0, 5).join(', ')}\n修正方法: requirements.toon にユーザー意図の主要キーワードを反映してください。`,
      fix: 'requirements.toonにユーザー意図の主要キーワードを反映してください。',
    };
  }
  const lineCount = rawContent.split('\n').length;
  const minLineCount = Math.floor(state.userIntent.length / 5);
  if (minLineCount > 0 && lineCount < minLineCount) {
    return {
      level: 'L4', check: 'intent_consistency', passed: false,
      evidence: `requirements.toon が不十分な詳細度: ${lineCount}行 < 最低${minLineCount}行（userIntent長/${5}）\n修正方法: requirements.toon に各機能要件・AC・制約の詳細を追記してください。`,
      fix: 'requirements.toonに各機能要件・AC・制約の詳細を追記してください。',
    };
  }
  return { level: 'L4', check: 'intent_consistency', passed: true, evidence: `Intent consistency OK: ${keywords.length - missing.length}/${keywords.length} keywords found, ${lineCount} lines (min ${minLineCount})` };
}

export function checkOpenQuestions(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'requirements') {
    return { level: 'L4', check: 'open_questions_section', passed: true, evidence: 'OPEN_QUESTIONS check not required for phase: ' + phase };
  }
  const reqPath = docsDir + '/requirements.toon';
  if (!existsSync(reqPath)) {
    return { level: 'L4', check: 'open_questions_section', passed: false, evidence: 'requirements.toon not found at: ' + reqPath, fix: 'requirementsフェーズの成果物(requirements.toon)を作成してください。' };
  }
  const toon = readRequirementsToon(docsDir);
  if (!toon) {
    return { level: 'L4', check: 'open_questions_section', passed: false, evidence: 'requirements.toon could not be decoded at: ' + reqPath, fix: '.toonファイルに ## ヘッダーやMarkdown記法を書かないこと。TOON形式は key: value のみ。' };
  }
  const hasOpenQuestions = 'openQuestions' in toon;
  return {
    level: 'L4', check: 'open_questions_section', passed: hasOpenQuestions,
    evidence: hasOpenQuestions
      ? 'openQuestions key found in requirements.toon'
      : 'requirements.toon is missing openQuestions key\n修正方法: requirements.toon に openQuestions[N]{id,question}: テーブルを追加してください。未解決の場合は空配列にしてください。',
    ...(!hasOpenQuestions && { fix: 'openQuestionsセクションを追加してください。不明点がなければ空配列。', example: 'openQuestions[0]{id,question}:\n  OQ-1\n  パフォーマンス要件の具体的な数値は？' }),
  };
}
