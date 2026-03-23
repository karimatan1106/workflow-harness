/**
 * DoD L4 Intent Accuracy checks: IA-3 (AC→design), IA-4 (AC→TC), IA-5 (AC Achievement).
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';
import { resolveProjectPath } from '../utils/project-root.js';

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

/** IA-3: design_review artifact must contain acDesignMapping section */
export function checkAcDesignMapping(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'design_review') {
    return { level: 'L4', check: 'ac_design_mapping', passed: true, evidence: 'AC→design mapping check not required for phase: ' + phase };
  }
  const filePath = resolveProjectPath(docsDir) + '/design-review.md';
  if (!existsSync(filePath)) {
    return { level: 'L4', check: 'ac_design_mapping', passed: false, evidence: 'design-review.md not found at: ' + filePath, fix: 'design_reviewフェーズの成果物(design-review.md)を作成してください。' };
  }
  const content = readFileSync(filePath, 'utf8');
  const sections = parseMarkdownSections(content);
  const hasKey = Object.keys(sections).some(k => k.replace(/[_\s]/g, '').includes('acdesignmapping'));
  if (!hasKey) {
    return {
      level: 'L4', check: 'ac_design_mapping', passed: false,
      evidence: 'design-review.md is missing acDesignMapping section (IA-3)\n修正方法: design-review.md に ## acDesignMapping セクションを追加し、各AC-Nと対応する設計要素を列挙してください。',
      fix: 'design-review.mdに## acDesignMappingセクションを追加し、各AC-Nと対応する設計要素を列挙してください。',
      example: '## acDesignMapping\n- AC-1: モジュールXのインターフェース設計',
    };
  }
  if (state.acceptanceCriteria && state.acceptanceCriteria.length > 0) {
    const unmapped = state.acceptanceCriteria.filter(ac => !content.includes(ac.id)).map(ac => ac.id);
    if (unmapped.length > 0) {
      return { level: 'L4', check: 'ac_design_mapping', passed: false, evidence: 'AC→design mapping missing for: ' + unmapped.join(', ') + ' (IA-3)', fix: 'acDesignMappingセクションに未マッピングのAC-Nエントリを追加してください。' };
    }
  }
  return { level: 'L4', check: 'ac_design_mapping', passed: true, evidence: 'AC→design mapping section present in design-review.md (IA-3)' };
}

/** IA-4: test_design artifact must contain acTcMapping section */
export function checkAcTcMapping(phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'test_design') {
    return { level: 'L4', check: 'ac_tc_mapping', passed: true, evidence: 'AC→TC traceability check not required for phase: ' + phase };
  }
  const filePath = resolveProjectPath(docsDir) + '/test-design.md';
  if (!existsSync(filePath)) {
    return { level: 'L4', check: 'ac_tc_mapping', passed: false, evidence: 'test-design.md not found at: ' + filePath, fix: 'test_designフェーズの成果物(test-design.md)を作成してください。' };
  }
  const content = readFileSync(filePath, 'utf8');
  const sections = parseMarkdownSections(content);
  const hasKey = Object.keys(sections).some(k => k.replace(/[_\s]/g, '').includes('actcmapping'));
  return {
    level: 'L4', check: 'ac_tc_mapping', passed: hasKey,
    evidence: hasKey
      ? 'AC→TC traceability section present in test-design.md (IA-4)'
      : 'test-design.md is missing acTcMapping section (IA-4)\n修正方法: test-design.md に ## acTcMapping セクションを追加し、AC-N → TC-{AC#}-{連番} の対応を列挙してください。',
    ...(!hasKey && { fix: 'test-design.mdに## acTcMappingセクションを追加し、AC-N→TC-{AC#}-{連番}の対応を列挙してください。', example: '## acTcMapping\n- AC-1: TC-AC1-01' }),
  };
}

/** RTM-AC: Cross-phase AC chain continuity — verify all AC-IDs appear in phase-specific section */
export function checkAcChainContinuity(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  const acs = state.acceptanceCriteria;
  if (!acs || acs.length === 0) {
    return { level: 'L4', check: 'ac_chain_continuity', passed: true, evidence: 'No ACs defined; AC chain continuity check skipped' };
  }
  let filePath: string;
  let sectionName: string;
  if (phase === 'design_review') { filePath = resolveProjectPath(docsDir) + '/design-review.md'; sectionName = 'acDesignMapping'; }
  else if (phase === 'test_design') { filePath = resolveProjectPath(docsDir) + '/test-design.md'; sectionName = 'acTcMapping'; }
  else if (phase === 'code_review') { filePath = resolveProjectPath(docsDir) + '/code-review.md'; sectionName = 'acAchievementStatus'; }
  else { return { level: 'L4', check: 'ac_chain_continuity', passed: true, evidence: 'AC chain continuity check not required for phase: ' + phase }; }
  if (!existsSync(filePath)) {
    return { level: 'L4', check: 'ac_chain_continuity', passed: false, evidence: filePath + ' not found for AC chain continuity check', fix: phase + 'フェーズの成果物を作成してください。' };
  }
  const content = readFileSync(filePath, 'utf8');
  const missing = acs.filter(ac => !content.includes(ac.id)).map(ac => ac.id);
  if (missing.length > 0) {
    return { level: 'L4', check: 'ac_chain_continuity', passed: false, evidence: 'AC chain continuity: missing AC IDs in ' + sectionName + ': ' + missing.join(', '), fix: sectionName + 'セクションに全AC-IDのエントリを追加してください。' };
  }
  return { level: 'L4', check: 'ac_chain_continuity', passed: true, evidence: 'AC chain continuity OK: all AC IDs found in ' + sectionName };
}

/** CRV-1 (S3-30): test-design.md must have TC count >= AC count */
export function checkTCCoverage(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'test_design') {
    return { level: 'L3', check: 'tc_coverage', passed: true, evidence: 'TC coverage check not required for phase: ' + phase };
  }
  const acCount = state.requirementCount ?? state.acceptanceCriteria?.length ?? 0;
  if (acCount === 0) {
    return { level: 'L3', check: 'tc_coverage', passed: true, evidence: 'No ACs defined; TC coverage check skipped' };
  }
  const filePath = resolveProjectPath(docsDir) + '/test-design.md';
  if (!existsSync(filePath)) {
    return { level: 'L3', check: 'tc_coverage', passed: false, evidence: 'test-design.md not found for TC coverage check', fix: 'test_designフェーズの成果物(test-design.md)を作成してください。' };
  }
  const content = readFileSync(filePath, 'utf8');
  const tcIds = new Set((content.match(/TC-AC\d+-\d+/g) ?? []));
  const tcCount = tcIds.size;
  const passed = tcCount >= acCount;
  return {
    level: 'L3', check: 'tc_coverage', passed,
    evidence: passed
      ? `TC coverage OK: ${tcCount} unique TC entries for ${acCount} ACs (CRV-1)`
      : `TC coverage insufficient: ${tcCount} TC entries < ${acCount} ACs (CRV-1)\n修正方法: test-design.md に各AC-Nに対して TC-ACN-01 形式のテストケースを追加してください。`,
    ...(!passed && { fix: 'test-design.mdに各AC-Nに対してTC-ACN-01形式のテストケースを追加してください。' }),
  };
}

/** IA-5: code_review artifact must contain acAchievementStatus section with no not_met entries */
export function checkAcAchievementTable(phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'code_review') {
    return { level: 'L4', check: 'ac_achievement_table', passed: true, evidence: 'AC Achievement Status check not required for phase: ' + phase };
  }
  const filePath = resolveProjectPath(docsDir) + '/code-review.md';
  if (!existsSync(filePath)) {
    return { level: 'L4', check: 'ac_achievement_table', passed: false, evidence: 'code-review.md not found at: ' + filePath, fix: 'code_reviewフェーズの成果物(code-review.md)を作成してください。' };
  }
  const content = readFileSync(filePath, 'utf8');
  const sections = parseMarkdownSections(content);
  const sectionKey = Object.keys(sections).find(k => k.replace(/[_\s]/g, '').includes('acachievementstatus'));
  if (!sectionKey) {
    return {
      level: 'L4', check: 'ac_achievement_table', passed: false,
      evidence: 'code-review.md is missing acAchievementStatus section (IA-5)\n修正方法: code-review.md に ## acAchievementStatus セクションを追加し、各AC-Nのpass/fail状態を記入してください。',
      fix: 'code-review.mdに## acAchievementStatusセクションを追加し、各AC-Nのpass/fail状態を記入してください。',
      example: '## acAchievementStatus\n- AC-1: met',
    };
  }
  const sectionContent = sections[sectionKey];
  if (/not_met/i.test(sectionContent)) {
    // Extract AC IDs near not_met entries
    const failedLines = sectionContent.split('\n').filter(l => /not_met/i.test(l));
    const failedACs: string[] = [];
    for (const line of failedLines) {
      const acMatch = line.match(/AC-\d+/);
      if (acMatch) failedACs.push(acMatch[0]);
      else failedACs.push('unknown AC');
    }
    return { level: 'L4', check: 'ac_achievement_table', passed: false, evidence: 'AC Achievement Status has not_met entries: ' + failedACs.join(', ') + ' (IA-5)', fix: '受入基準のステータスをharness_update_ac_statusでmetに更新してください。' };
  }
  return { level: 'L4', check: 'ac_achievement_table', passed: true, evidence: 'AC Achievement Status section present with no failing ACs (IA-5)' };
}
