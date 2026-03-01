/**
 * DoD L4 Intent Accuracy checks: IA-3 (AC→design), IA-4 (AC→TC), IA-5 (AC Achievement).
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';

/** IA-3: design_review artifact must contain ## AC→設計マッピング section */
export function checkAcDesignMapping(state: TaskState, phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'design_review') {
    return { level: 'L4', check: 'ac_design_mapping', passed: true, evidence: 'AC→design mapping check not required for phase: ' + phase };
  }
  const filePath = docsDir + '/design-review.md';
  if (!existsSync(filePath)) {
    return { level: 'L4', check: 'ac_design_mapping', passed: false, evidence: 'design-review.md not found at: ' + filePath };
  }
  const content = readFileSync(filePath, 'utf8');
  if (!/^##\s*AC→設計マッピング/m.test(content)) {
    return {
      level: 'L4', check: 'ac_design_mapping', passed: false,
      evidence: 'design-review.md is missing ## AC→設計マッピング section (IA-3)\n修正方法: design-review.md に ## AC→設計マッピング セクションを追加し、各AC-Nと対応する設計要素を列挙してください。',
    };
  }
  if (state.acceptanceCriteria && state.acceptanceCriteria.length > 0) {
    const lines = content.split('\n');
    let inSection = false;
    const mentioned = new Set<string>();
    for (const line of lines) {
      if (/^##\s*AC→設計マッピング/.test(line)) { inSection = true; continue; }
      if (inSection && /^##\s/.test(line)) break;
      if (inSection) { for (const ac of state.acceptanceCriteria) { if (line.includes(ac.id)) mentioned.add(ac.id); } }
    }
    const unmapped = state.acceptanceCriteria.filter(ac => !mentioned.has(ac.id)).map(ac => ac.id);
    if (unmapped.length > 0) {
      return { level: 'L4', check: 'ac_design_mapping', passed: false, evidence: 'AC→design mapping missing for: ' + unmapped.join(', ') + ' (IA-3)' };
    }
  }
  return { level: 'L4', check: 'ac_design_mapping', passed: true, evidence: 'AC→design mapping section present in design-review.md (IA-3)' };
}

/** IA-4: test_design artifact must contain ## AC→TC traceability section */
export function checkAcTcMapping(phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'test_design') {
    return { level: 'L4', check: 'ac_tc_mapping', passed: true, evidence: 'AC→TC traceability check not required for phase: ' + phase };
  }
  const filePath = docsDir + '/test-design.md';
  if (!existsSync(filePath)) {
    return { level: 'L4', check: 'ac_tc_mapping', passed: false, evidence: 'test-design.md not found at: ' + filePath };
  }
  const content = readFileSync(filePath, 'utf8');
  const hasSection = /^##\s*AC→TC/m.test(content);
  return {
    level: 'L4', check: 'ac_tc_mapping', passed: hasSection,
    evidence: hasSection
      ? 'AC→TC traceability section present in test-design.md (IA-4)'
      : 'test-design.md is missing ## AC→TC 追跡マトリクス section (IA-4)\n修正方法: test-design.md に ## AC→TC 追跡マトリクス セクションを追加し、AC-N → TC-{AC#}-{連番} の対応を列挙してください。',
  };
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
  const filePath = docsDir + '/test-design.md';
  if (!existsSync(filePath)) {
    return { level: 'L3', check: 'tc_coverage', passed: false, evidence: 'test-design.md not found for TC coverage check' };
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
  };
}

/** IA-5: code_review artifact must contain ## AC Achievement Status table with no not_met entries */
export function checkAcAchievementTable(phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'code_review') {
    return { level: 'L4', check: 'ac_achievement_table', passed: true, evidence: 'AC Achievement Status check not required for phase: ' + phase };
  }
  const filePath = docsDir + '/code-review.md';
  if (!existsSync(filePath)) {
    return { level: 'L4', check: 'ac_achievement_table', passed: false, evidence: 'code-review.md not found at: ' + filePath };
  }
  const content = readFileSync(filePath, 'utf8');
  if (!/^##\s*AC Achievement Status/im.test(content)) {
    return {
      level: 'L4', check: 'ac_achievement_table', passed: false,
      evidence: 'code-review.md is missing ## AC Achievement Status section (IA-5)\n修正方法: code-review.md に ## AC Achievement Status セクションを追加し、各AC-Nのpass/fail状態を記入してください。',
    };
  }
  const lines = content.split('\n');
  let inTable = false;
  const failedACs: string[] = [];
  for (const line of lines) {
    if (/^##\s*AC Achievement Status/i.test(line)) { inTable = true; continue; }
    if (inTable && /^##\s/.test(line)) break;
    if (inTable && /not_met/i.test(line)) { const m = line.match(/AC-\d+/); failedACs.push(m ? m[0] : line.trim().substring(0, 30)); }
  }
  if (failedACs.length > 0) {
    return { level: 'L4', check: 'ac_achievement_table', passed: false, evidence: 'AC Achievement Status has not_met entries: ' + failedACs.join(', ') + ' (IA-5)' };
  }
  return { level: 'L4', check: 'ac_achievement_table', passed: true, evidence: 'AC Achievement Status table present with no failing ACs (IA-5)' };
}
