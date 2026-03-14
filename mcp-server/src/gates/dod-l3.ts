/**
 * DoD L3 checks: artifact quality, RTM/AC completeness, baseline required.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { decode as toonDecode } from '@toon-format/toon';
import type { TaskState, PhaseConfig, RTMEntry } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import type { DoDCheckResult } from './dod-types.js';

/** L3 artifact quality: TOON parse check only. Content quality is validated by L4. */
export function checkL3Quality(phase: string, docsDir: string, workflowDir: string): DoDCheckResult {
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config || !config.outputFile) {
    return { level: 'L3', check: 'artifact_quality', passed: true, evidence: 'No artifact quality check required for this phase' };
  }
  const outputFile = config.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir);
  if (!existsSync(outputFile)) {
    return { level: 'L3', check: 'artifact_quality', passed: false, evidence: `Cannot check quality: file missing: ${outputFile}`, fix: '成果物ファイルが指定パスに存在しません。正しいパスに保存してください。' };
  }
  const content = readFileSync(outputFile, 'utf8');
  // Only check TOON parsability — content/density/fieldCount checks removed (L4 covers these via required keys)
  try {
    toonDecode(content);
  } catch (e) {
    const lines = content.split('\n');
    const mdHeaders = lines.filter(l => /^#{1,6}\s/.test(l));
    const parseError = mdHeaders.length > 0
      ? `TOON parse failed: ${mdHeaders.length} Markdown headers (##) found. TOON uses "key: value", not Markdown. First: "${mdHeaders[0].slice(0, 60)}"`
      : `TOON parse failed: ${e instanceof Error ? e.message.slice(0, 150) : 'unknown error'}`;
    return { level: 'L3', check: 'artifact_quality', passed: false, evidence: parseError, fix: '.toonファイルに ## ヘッダーやMarkdown記法を書かないこと。TOON形式は key: value のみ。', example: 'decisions[5]{id,statement,rationale}:\n  SD-1, "要件を明確化する", "ユーザー意図との整合性確保のため"' };
  }
  return { level: 'L3', check: 'artifact_quality', passed: true, evidence: 'TOON parse OK' };
}

const RTM_CHECK_PHASES = ['code_review', 'acceptance_verification', 'completed'];
const RTM_PHASE_MIN_STATUS: Record<string, RTMEntry['status']> = { code_review: 'implemented', acceptance_verification: 'tested', completed: 'verified' };
const RTM_STATUS_RANK: Record<RTMEntry['status'], number> = { pending: 0, implemented: 1, tested: 2, verified: 3 };

export function checkRTMCompleteness(state: TaskState, phase: string): DoDCheckResult {
  if (!RTM_CHECK_PHASES.includes(phase)) {
    return { level: 'L3', check: 'rtm_completeness', passed: true, evidence: 'RTM completeness check not required for phase: ' + phase };
  }
  if (!state.rtmEntries || state.rtmEntries.length === 0) {
    return { level: 'L3', check: 'rtm_completeness', passed: true, evidence: 'No RTM entries defined; RTM check skipped' };
  }
  const requiredStatus = RTM_PHASE_MIN_STATUS[phase];
  if (!requiredStatus) return { level: 'L3', check: 'rtm_completeness', passed: true, evidence: 'No minimum RTM status defined for phase: ' + phase };
  const requiredRank = RTM_STATUS_RANK[requiredStatus];
  const insufficient = state.rtmEntries.filter(e => RTM_STATUS_RANK[e.status] < requiredRank).map(e => `${e.id} (${e.status})`);
  const passed = insufficient.length === 0;
  return {
    level: 'L3', check: 'rtm_completeness', passed,
    evidence: passed ? `All ${state.rtmEntries.length} RTM entries meet minimum status "${requiredStatus}"` : 'RTM entries not at required status: ' + insufficient.join(', '),
    ...(!passed && { fix: 'RTMエントリのステータスをharness_update_rtm_statusで更新してください。' }),
  };
}

export function checkACCompleteness(state: TaskState, phase: string): DoDCheckResult {
  const AC_CHECK_PHASES = ['acceptance_verification', 'completed'];
  if (!AC_CHECK_PHASES.includes(phase)) {
    return { level: 'L3', check: 'ac_completeness', passed: true, evidence: 'AC completeness check not required for phase: ' + phase };
  }
  if (!state.acceptanceCriteria || state.acceptanceCriteria.length === 0) {
    return { level: 'L3', check: 'ac_completeness', passed: true, evidence: 'No acceptance criteria defined; AC check skipped' };
  }
  const notMet = state.acceptanceCriteria.filter(ac => ac.status === 'not_met').map(ac => `${ac.id} (${ac.description.slice(0, 60)})`);
  const open = state.acceptanceCriteria.filter(ac => ac.status === 'open').map(ac => `${ac.id}`);
  const errors: string[] = [];
  if (notMet.length) errors.push('AC not met: ' + notMet.join(', '));
  if (open.length) errors.push('AC still open: ' + open.join(', '));
  const passed = errors.length === 0;
  return {
    level: 'L3', check: 'ac_completeness', passed,
    evidence: passed ? `All ${state.acceptanceCriteria.length} acceptance criteria are met` : errors.join('; '),
    ...(!passed && { fix: '受入基準のステータスをharness_update_ac_statusでmetに更新してください。' }),
  };
}

// AFV-1: Artifact freshness validation (S2-29)
export function checkArtifactFreshness(phase: string, docsDir: string): DoDCheckResult {
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config?.inputFiles || config.inputFiles.length === 0) {
    return { level: 'L3', check: 'artifact_freshness', passed: true, evidence: 'No input files to check freshness for this phase' };
  }
  const now = Date.now();
  const WARN_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
  const BLOCK_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
  const stale: string[] = [];
  const warnings: string[] = [];
  for (const inputFile of config.inputFiles) {
    const filePath = inputFile.replace('{docsDir}', docsDir);
    if (!existsSync(filePath)) continue;
    const ageMs = now - statSync(filePath).mtimeMs;
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    if (ageMs > BLOCK_MS) stale.push(`${filePath} (${ageDays}d old)`);
    else if (ageMs > WARN_MS) warnings.push(`${filePath} (${ageDays}d old)`);
  }
  if (stale.length > 0) return { level: 'L3', check: 'artifact_freshness', passed: false, evidence: `Stale artifacts (>30 days): ${stale.join(', ')}. Re-run earlier phases.`, fix: '30日以上前の成果物が検出されました。該当する前フェーズを再実行して成果物を更新してください。' };
  const evidence = warnings.length > 0 ? `Freshness warning (>7 days): ${warnings.join(', ')}` : `All input artifacts are fresh`;
  return { level: 'L3', check: 'artifact_freshness', passed: true, evidence };
}

export function checkInvariantCompleteness(state: TaskState, phase: string): DoDCheckResult {
  const INV_CHECK_PHASES = ['acceptance_verification', 'completed'];
  if (!INV_CHECK_PHASES.includes(phase)) {
    return { level: 'L3', check: 'invariant_completeness', passed: true,
      evidence: 'Invariant completeness check not required for phase: ' + phase };
  }
  if (!state.invariants || state.invariants.length === 0) {
    return { level: 'L3', check: 'invariant_completeness', passed: true,
      evidence: 'No invariants defined; invariant check skipped' };
  }
  const notHeld = state.invariants.filter(inv => inv.status !== 'held')
    .map(inv => `${inv.id} (${inv.status})`);
  const passed = notHeld.length === 0;
  return {
    level: 'L3', check: 'invariant_completeness', passed,
    evidence: passed
      ? `All ${state.invariants.length} invariants are held`
      : 'Invariants not held: ' + notHeld.join(', '),
    ...(!passed && { fix: '不変条件が満たされていません。該当する不変条件を確認し、コードまたは成果物を修正してください。' }),
  };
}

/** RTM-REQ: requirements phase must have at least one RTM entry referencing an AC-N */
export function checkRTMRequired(state: TaskState, phase: string): DoDCheckResult {
  if (phase !== 'requirements') {
    return { level: 'L3', check: 'rtm_required', passed: true, evidence: 'RTM required check not applicable for phase: ' + phase };
  }
  if (!state.rtmEntries || state.rtmEntries.length === 0) {
    return {
      level: 'L3', check: 'rtm_required', passed: false,
      evidence: 'requirements phase requires at least one F-NNN RTM entry',
      fix: 'harness_add_rtm で少なくとも1つの F-NNN RTMエントリを登録してください。',
      example: 'harness_add_rtm({ id: "F-001", requirement: "AC-1: ...", designRef: "-", codeRef: "-", testRef: "-" })',
    };
  }
  // Verify at least one RTM entry references an AC-N
  const acIds = (state.acceptanceCriteria ?? []).map(ac => ac.id);
  if (acIds.length > 0) {
    const acPattern = /AC-\d+/g;
    const referencedACs = new Set<string>();
    for (const entry of state.rtmEntries) {
      const matches = entry.requirement.match(acPattern);
      if (matches) matches.forEach(m => referencedACs.add(m));
    }
    const unreferenced = acIds.filter(id => !referencedACs.has(id));
    if (unreferenced.length > 0) {
      return {
        level: 'L3', check: 'rtm_required', passed: false,
        evidence: 'RTM entries do not reference these ACs: ' + unreferenced.join(', '),
        fix: 'RTMエントリの requirement フィールドに対応する AC-N ID を含めてください。',
        example: 'harness_add_rtm({ id: "F-001", requirement: "AC-1: ユーザーがログインできる", ... })',
      };
    }
  }
  return { level: 'L3', check: 'rtm_required', passed: true, evidence: `${state.rtmEntries.length} RTM entries with AC-N references present` };
}

export function checkBaselineRequired(state: TaskState, phase: string): DoDCheckResult {
  if (phase !== 'regression_test') {
    return { level: 'L3', check: 'baseline_required', passed: true, evidence: 'Baseline check not required for phase: ' + phase };
  }
  const hasBaseline = state.baseline && state.baseline.totalTests >= 0;
  return {
    level: 'L3', check: 'baseline_required', passed: Boolean(hasBaseline),
    evidence: hasBaseline
      ? `Baseline captured: ${state.baseline!.totalTests} total, ${state.baseline!.passedTests} passed`
      : 'No baseline captured. Use harness_capture_baseline in testing phase before regression_test',
    ...(!hasBaseline && { fix: 'harness_capture_baselineを実行してテストベースラインを記録してください。' }),
  };
}
