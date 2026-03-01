/**
 * DoD L3 checks: artifact quality, RTM/AC completeness, baseline required.
 * @spec docs/spec/features/workflow-harness.md
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { decode as toonDecode } from '@toon-format/toon';
import { PHASE_REGISTRY } from '../phases/registry.js';
function getStringLen(v) {
    if (v === null || v === undefined)
        return 0;
    if (typeof v === 'string')
        return v.length;
    if (typeof v === 'number' || typeof v === 'boolean')
        return String(v).length;
    if (Array.isArray(v))
        return v.reduce((acc, item) => acc + getStringLen(item), 0);
    if (typeof v === 'object')
        return Object.values(v).reduce((acc, val) => acc + getStringLen(val), 0);
    return 0;
}
function analyzeArtifact(content) {
    let obj;
    try {
        obj = toonDecode(content);
    }
    catch {
        return { totalChars: content.length, contentChars: 0, fieldCount: 0, sectionDensity: 0 };
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        const len = getStringLen(obj);
        return { totalChars: len, contentChars: len, fieldCount: 1, sectionDensity: 1 };
    }
    const record = obj;
    const CORE_KEYS = new Set(['decisions', 'artifacts', 'next', 'acceptanceCriteria', 'notInScope', 'openQuestions', 'functionalRequirements', 'nonFunctionalRequirements']);
    let totalChars = 0;
    let contentChars = 0;
    let fieldCount = 0;
    for (const [key, val] of Object.entries(record)) {
        const len = getStringLen(val);
        totalChars += len;
        fieldCount++;
        if (CORE_KEYS.has(key))
            contentChars += len;
    }
    if (totalChars === 0)
        return { totalChars: 0, contentChars: 0, fieldCount: 0, sectionDensity: 0 };
    return { totalChars, contentChars, fieldCount, sectionDensity: contentChars / totalChars };
}
export function checkL3Quality(phase, docsDir, workflowDir) {
    const config = PHASE_REGISTRY[phase];
    if (!config || !config.outputFile) {
        return { level: 'L3', check: 'artifact_quality', passed: true, evidence: 'No artifact quality check required for this phase' };
    }
    const outputFile = config.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir);
    if (!existsSync(outputFile)) {
        return { level: 'L3', check: 'artifact_quality', passed: false, evidence: `Cannot check quality: file missing: ${outputFile}` };
    }
    const content = readFileSync(outputFile, 'utf8');
    const analysis = analyzeArtifact(content);
    const minLines = config.minLines ?? 0;
    const errors = [];
    if (minLines > 0 && analysis.contentChars < minLines * 10)
        errors.push(`Content chars ${analysis.contentChars} < required ${minLines * 10} (minLines ${minLines} * 10)`);
    if (analysis.sectionDensity < 0.30)
        errors.push(`Section density ${(analysis.sectionDensity * 100).toFixed(1)}% < required 30%`);
    if (analysis.fieldCount < 3)
        errors.push(`TOON field count ${analysis.fieldCount} < required 3`);
    const passed = errors.length === 0;
    return {
        level: 'L3', check: 'artifact_quality', passed,
        evidence: passed ? `Quality OK: ${analysis.contentChars} content chars, density ${(analysis.sectionDensity * 100).toFixed(1)}%` : errors.join('; '),
    };
}
const RTM_CHECK_PHASES = ['code_review', 'acceptance_verification', 'completed'];
const RTM_PHASE_MIN_STATUS = { code_review: 'implemented', acceptance_verification: 'tested', completed: 'verified' };
const RTM_STATUS_RANK = { pending: 0, implemented: 1, tested: 2, verified: 3 };
export function checkRTMCompleteness(state, phase) {
    if (!RTM_CHECK_PHASES.includes(phase)) {
        return { level: 'L3', check: 'rtm_completeness', passed: true, evidence: 'RTM completeness check not required for phase: ' + phase };
    }
    if (!state.rtmEntries || state.rtmEntries.length === 0) {
        return { level: 'L3', check: 'rtm_completeness', passed: true, evidence: 'No RTM entries defined; RTM check skipped' };
    }
    const requiredStatus = RTM_PHASE_MIN_STATUS[phase];
    if (!requiredStatus)
        return { level: 'L3', check: 'rtm_completeness', passed: true, evidence: 'No minimum RTM status defined for phase: ' + phase };
    const requiredRank = RTM_STATUS_RANK[requiredStatus];
    const insufficient = state.rtmEntries.filter(e => RTM_STATUS_RANK[e.status] < requiredRank).map(e => `${e.id} (${e.status})`);
    const passed = insufficient.length === 0;
    return {
        level: 'L3', check: 'rtm_completeness', passed,
        evidence: passed ? `All ${state.rtmEntries.length} RTM entries meet minimum status "${requiredStatus}"` : 'RTM entries not at required status: ' + insufficient.join(', '),
    };
}
export function checkACCompleteness(state, phase) {
    const AC_CHECK_PHASES = ['acceptance_verification', 'completed'];
    if (!AC_CHECK_PHASES.includes(phase)) {
        return { level: 'L3', check: 'ac_completeness', passed: true, evidence: 'AC completeness check not required for phase: ' + phase };
    }
    if (!state.acceptanceCriteria || state.acceptanceCriteria.length === 0) {
        return { level: 'L3', check: 'ac_completeness', passed: true, evidence: 'No acceptance criteria defined; AC check skipped' };
    }
    const notMet = state.acceptanceCriteria.filter(ac => ac.status === 'not_met').map(ac => `${ac.id} (${ac.description.slice(0, 60)})`);
    const open = state.acceptanceCriteria.filter(ac => ac.status === 'open').map(ac => `${ac.id}`);
    const errors = [];
    if (notMet.length)
        errors.push('AC not met: ' + notMet.join(', '));
    if (open.length)
        errors.push('AC still open: ' + open.join(', '));
    const passed = errors.length === 0;
    return {
        level: 'L3', check: 'ac_completeness', passed,
        evidence: passed ? `All ${state.acceptanceCriteria.length} acceptance criteria are met` : errors.join('; '),
    };
}
// AFV-1: Artifact freshness validation (S2-29)
export function checkArtifactFreshness(phase, docsDir) {
    const config = PHASE_REGISTRY[phase];
    if (!config?.inputFiles || config.inputFiles.length === 0) {
        return { level: 'L3', check: 'artifact_freshness', passed: true, evidence: 'No input files to check freshness for this phase' };
    }
    const now = Date.now();
    const WARN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const BLOCK_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const stale = [];
    const warnings = [];
    for (const inputFile of config.inputFiles) {
        const filePath = inputFile.replace('{docsDir}', docsDir);
        if (!existsSync(filePath))
            continue;
        const ageMs = now - statSync(filePath).mtimeMs;
        const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        if (ageMs > BLOCK_MS)
            stale.push(`${filePath} (${ageDays}d old)`);
        else if (ageMs > WARN_MS)
            warnings.push(`${filePath} (${ageDays}d old)`);
    }
    if (stale.length > 0)
        return { level: 'L3', check: 'artifact_freshness', passed: false, evidence: `Stale artifacts (>30 days): ${stale.join(', ')}. Re-run earlier phases.` };
    const evidence = warnings.length > 0 ? `Freshness warning (>7 days): ${warnings.join(', ')}` : `All input artifacts are fresh`;
    return { level: 'L3', check: 'artifact_freshness', passed: true, evidence };
}
export function checkBaselineRequired(state, phase) {
    if (phase !== 'regression_test') {
        return { level: 'L3', check: 'baseline_required', passed: true, evidence: 'Baseline check not required for phase: ' + phase };
    }
    const hasBaseline = state.baseline && state.baseline.totalTests >= 0;
    return {
        level: 'L3', check: 'baseline_required', passed: Boolean(hasBaseline),
        evidence: hasBaseline
            ? `Baseline captured: ${state.baseline.totalTests} total, ${state.baseline.passedTests} passed`
            : 'No baseline captured. Use harness_capture_baseline in testing phase before regression_test',
    };
}
//# sourceMappingURL=dod-l3.js.map