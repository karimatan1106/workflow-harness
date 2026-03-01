/**
 * DoD L4 Intent Accuracy checks: IA-3 (AC→design), IA-4 (AC→TC), IA-5 (AC Achievement).
 * @spec docs/spec/features/workflow-harness.md
 */
import { readFileSync, existsSync } from 'node:fs';
import { decode as toonDecode } from '@toon-format/toon';
/** IA-3: design_review artifact must contain acDesignMapping key in TOON */
export function checkAcDesignMapping(state, phase, docsDir) {
    if (phase !== 'design_review') {
        return { level: 'L4', check: 'ac_design_mapping', passed: true, evidence: 'AC→design mapping check not required for phase: ' + phase };
    }
    const filePath = docsDir + '/design-review.toon';
    if (!existsSync(filePath)) {
        return { level: 'L4', check: 'ac_design_mapping', passed: false, evidence: 'design-review.toon not found at: ' + filePath };
    }
    const content = readFileSync(filePath, 'utf8');
    let record;
    try {
        record = toonDecode(content);
    }
    catch {
        record = {};
    }
    if (!('acDesignMapping' in record)) {
        return {
            level: 'L4', check: 'ac_design_mapping', passed: false,
            evidence: 'design-review.toon is missing acDesignMapping key (IA-3)\n修正方法: design-review.toon に acDesignMapping[] キーを追加し、各AC-Nと対応する設計要素を列挙してください。',
        };
    }
    if (state.acceptanceCriteria && state.acceptanceCriteria.length > 0) {
        const raw = JSON.stringify(record['acDesignMapping'] ?? '');
        const unmapped = state.acceptanceCriteria.filter(ac => !raw.includes(ac.id)).map(ac => ac.id);
        if (unmapped.length > 0) {
            return { level: 'L4', check: 'ac_design_mapping', passed: false, evidence: 'AC→design mapping missing for: ' + unmapped.join(', ') + ' (IA-3)' };
        }
    }
    return { level: 'L4', check: 'ac_design_mapping', passed: true, evidence: 'AC→design mapping key present in design-review.toon (IA-3)' };
}
/** IA-4: test_design artifact must contain acTcMapping key in TOON */
export function checkAcTcMapping(phase, docsDir) {
    if (phase !== 'test_design') {
        return { level: 'L4', check: 'ac_tc_mapping', passed: true, evidence: 'AC→TC traceability check not required for phase: ' + phase };
    }
    const filePath = docsDir + '/test-design.toon';
    if (!existsSync(filePath)) {
        return { level: 'L4', check: 'ac_tc_mapping', passed: false, evidence: 'test-design.toon not found at: ' + filePath };
    }
    const content = readFileSync(filePath, 'utf8');
    let record;
    try {
        record = toonDecode(content);
    }
    catch {
        record = {};
    }
    const hasKey = 'acTcMapping' in record;
    return {
        level: 'L4', check: 'ac_tc_mapping', passed: hasKey,
        evidence: hasKey
            ? 'AC→TC traceability key present in test-design.toon (IA-4)'
            : 'test-design.toon is missing acTcMapping key (IA-4)\n修正方法: test-design.toon に acTcMapping[] キーを追加し、AC-N → TC-{AC#}-{連番} の対応を列挙してください。',
    };
}
/** CRV-1 (S3-30): test-design.toon must have TC count >= AC count */
export function checkTCCoverage(state, phase, docsDir) {
    if (phase !== 'test_design') {
        return { level: 'L3', check: 'tc_coverage', passed: true, evidence: 'TC coverage check not required for phase: ' + phase };
    }
    const acCount = state.requirementCount ?? state.acceptanceCriteria?.length ?? 0;
    if (acCount === 0) {
        return { level: 'L3', check: 'tc_coverage', passed: true, evidence: 'No ACs defined; TC coverage check skipped' };
    }
    const filePath = docsDir + '/test-design.toon';
    if (!existsSync(filePath)) {
        return { level: 'L3', check: 'tc_coverage', passed: false, evidence: 'test-design.toon not found for TC coverage check' };
    }
    const content = readFileSync(filePath, 'utf8');
    const tcIds = new Set((content.match(/TC-AC\d+-\d+/g) ?? []));
    const tcCount = tcIds.size;
    const passed = tcCount >= acCount;
    return {
        level: 'L3', check: 'tc_coverage', passed,
        evidence: passed
            ? `TC coverage OK: ${tcCount} unique TC entries for ${acCount} ACs (CRV-1)`
            : `TC coverage insufficient: ${tcCount} TC entries < ${acCount} ACs (CRV-1)\n修正方法: test-design.toon に各AC-Nに対して TC-ACN-01 形式のテストケースを追加してください。`,
    };
}
/** IA-5: code_review artifact must contain acAchievementStatus key with no not_met entries */
export function checkAcAchievementTable(phase, docsDir) {
    if (phase !== 'code_review') {
        return { level: 'L4', check: 'ac_achievement_table', passed: true, evidence: 'AC Achievement Status check not required for phase: ' + phase };
    }
    const filePath = docsDir + '/code-review.toon';
    if (!existsSync(filePath)) {
        return { level: 'L4', check: 'ac_achievement_table', passed: false, evidence: 'code-review.toon not found at: ' + filePath };
    }
    const content = readFileSync(filePath, 'utf8');
    let record;
    try {
        record = toonDecode(content);
    }
    catch {
        record = {};
    }
    if (!('acAchievementStatus' in record)) {
        return {
            level: 'L4', check: 'ac_achievement_table', passed: false,
            evidence: 'code-review.toon is missing acAchievementStatus key (IA-5)\n修正方法: code-review.toon に acAchievementStatus[] キーを追加し、各AC-Nのpass/fail状態を記入してください。',
        };
    }
    const entries = record['acAchievementStatus'];
    const failedACs = [];
    if (Array.isArray(entries)) {
        for (const entry of entries) {
            if (typeof entry === 'object' && entry !== null) {
                const e = entry;
                const status = String(e['status'] ?? '');
                if (/not_met/i.test(status)) {
                    const id = String(e['acId'] ?? e['id'] ?? 'unknown');
                    failedACs.push(id);
                }
            }
        }
    }
    else if (/not_met/i.test(JSON.stringify(entries ?? ''))) {
        failedACs.push('unknown AC');
    }
    if (failedACs.length > 0) {
        return { level: 'L4', check: 'ac_achievement_table', passed: false, evidence: 'AC Achievement Status has not_met entries: ' + failedACs.join(', ') + ' (IA-5)' };
    }
    return { level: 'L4', check: 'ac_achievement_table', passed: true, evidence: 'AC Achievement Status key present with no failing ACs (IA-5)' };
}
//# sourceMappingURL=dod-l4-ia.js.map