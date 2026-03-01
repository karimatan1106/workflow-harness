/**
 * Definition of Done (DoD) gate system - orchestrator.
 * Delegates to dod-l1-l2.ts, dod-l3.ts, dod-l4-*.ts modules.
 * @spec docs/spec/features/workflow-harness.md
 */
import { checkL1FileExists, checkL2ExitCode, checkInputFilesExist, checkTDDRedEvidence } from './dod-l1-l2.js';
import { checkL3Quality, checkRTMCompleteness, checkACCompleteness, checkBaselineRequired, checkArtifactFreshness } from './dod-l3.js';
import { checkL4ContentValidation } from './dod-l4-content.js';
import { checkACFormat, checkNotInScope, checkOpenQuestions, checkIntentConsistency } from './dod-l4-requirements.js';
import { checkDeltaEntryFormat } from './dod-l4-delta.js';
import { checkAcDesignMapping, checkAcTcMapping, checkAcAchievementTable, checkTCCoverage } from './dod-l4-ia.js';
import { checkArtifactDrift } from './dod-l4-art.js';
import { checkPackageLockSync } from './dod-l4-commit.js';
import { checkDeadReferences } from './dod-l4-refs.js';
/**
 * Run all DoD checks for the current phase of a task.
 * Returns a DoDResult with individual check results and an overall passed flag.
 */
export async function runDoDChecks(state, docsDir) {
    const { phase, workflowDir } = state;
    const checks = [];
    const errors = [];
    const push = (c, prefix) => {
        checks.push(c);
        if (!c.passed)
            errors.push(`[${prefix}] ${c.evidence}`);
    };
    push(checkL1FileExists(phase, docsDir, workflowDir), 'L1');
    push(checkInputFilesExist(phase, docsDir, workflowDir), 'L1');
    push(checkL2ExitCode(state), 'L2');
    push(checkL3Quality(phase, docsDir, workflowDir), 'L3');
    push(checkL4ContentValidation(phase, docsDir, workflowDir), 'L4');
    push(checkRTMCompleteness(state, phase), 'L3');
    push(checkACCompleteness(state, phase), 'L3');
    push(checkACFormat(state, phase, docsDir), 'L4');
    push(checkNotInScope(state, phase, docsDir), 'L4');
    push(checkOpenQuestions(state, phase, docsDir), 'L4');
    push(checkIntentConsistency(state, phase, docsDir), 'L4');
    push(checkBaselineRequired(state, phase), 'L3');
    push(checkArtifactFreshness(phase, docsDir), 'L3');
    push(checkDeltaEntryFormat(phase, docsDir, workflowDir), 'L4');
    push(checkAcDesignMapping(state, phase, docsDir), 'L4');
    push(checkAcTcMapping(phase, docsDir), 'L4');
    push(checkAcAchievementTable(phase, docsDir), 'L4');
    push(checkTCCoverage(state, phase, docsDir), 'L3');
    push(checkArtifactDrift(state, phase), 'L4');
    push(checkPackageLockSync(phase), 'L4');
    push(checkTDDRedEvidence(state, phase), 'L2');
    push(checkDeadReferences(phase, docsDir, workflowDir ?? ''), 'L4');
    return { passed: errors.length === 0, checks, errors };
}
export function formatDoDResult(result) {
    const lines = [`DoD Check: ${result.passed ? 'PASSED' : 'FAILED'}`, ''];
    for (const check of result.checks) {
        lines.push(`  [${check.level}] ${check.passed ? 'OK' : 'NG'} ${check.check}: ${check.evidence}`);
    }
    if (result.errors.length > 0) {
        lines.push('', 'Errors:');
        for (const err of result.errors)
            lines.push(`  - ${err}`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=dod.js.map