/**
 * Phase definitions - subagent templates and prompt builders
 * @spec docs/spec/features/workflow-harness.md
 */
import { PHASE_REGISTRY } from './registry.js';
import { formatLessonsForPrompt } from '../tools/reflector.js';
import { ARTIFACT_QUALITY_RULES, SUMMARY_SECTION_RULE, EXIT_CODE_RULE, bashCategoryHelp, } from './definitions-shared.js';
import { DEFS_STAGE1 } from './defs-stage1.js';
import { DEFS_STAGE2 } from './defs-stage2.js';
import { DEFS_STAGE3 } from './defs-stage3.js';
import { DEFS_STAGE4 } from './defs-stage4.js';
import { DEFS_STAGE5 } from './defs-stage5.js';
import { DEFS_STAGE6 } from './defs-stage6.js';
// ─── Phase Definitions ───────────────────────────
export const PHASE_DEFINITIONS = {
    ...DEFS_STAGE1,
    ...DEFS_STAGE2,
    ...DEFS_STAGE3,
    ...DEFS_STAGE4,
    ...DEFS_STAGE5,
    ...DEFS_STAGE6,
};
// ─── Lookup Functions ────────────────────────────
export function getPhaseDefinition(phase) {
    return PHASE_DEFINITIONS[phase] ?? null;
}
// ─── ACE TOON-first: output filename → source phase mapping ──
const OUTPUT_FILE_TO_PHASE = {
    'scope-definition.toon': 'scope_definition',
    'research.toon': 'research',
    'impact-analysis.toon': 'impact_analysis',
    'requirements.toon': 'requirements',
    'threat-model.toon': 'threat_modeling',
    'spec.toon': 'planning',
    'state-machine.mmd': 'state_machine',
    'flowchart.mmd': 'flowchart',
    'ui-design.toon': 'ui_design',
    'test-design.toon': 'test_design',
    'test-selection.toon': 'test_selection',
    'code-review.toon': 'code_review',
    'acceptance-report.toon': 'acceptance_verification',
    'manual-test.toon': 'manual_test',
    'security-scan.toon': 'security_scan',
    'performance-test.toon': 'performance_test',
    'e2e-test.toon': 'e2e_test',
};
function buildToonFirstSection(phase, docsDir) {
    const config = PHASE_REGISTRY[phase];
    const inputFiles = config?.inputFiles ?? [];
    if (inputFiles.length === 0)
        return '';
    const entries = [];
    for (const inputFile of inputFiles) {
        const basename = inputFile.replace(/^\{docsDir\}\//, '');
        const sourcePhase = OUTPUT_FILE_TO_PHASE[basename];
        if (sourcePhase) {
            entries.push(`- \`${docsDir}/${basename}\` を読む`);
        }
    }
    if (entries.length === 0)
        return '';
    return '\n\n## TOON コンテキスト読み込み（ACE）\n'
        + '前フェーズの成果物を読む際、以下のTOONファイルを読むこと（40-50%トークン効率向上）。\n'
        + entries.join('\n')
        + '\n';
}
// ─── Prompt Builder ──────────────────────────────
export function buildSubagentPrompt(phase, taskName, docsDir, workflowDir, userIntent, taskId) {
    const def = getPhaseDefinition(phase);
    if (!def)
        return `# ${phase} phase\n\nNo template defined for this phase.`;
    const config = PHASE_REGISTRY[phase];
    const categories = config?.bashCategories ?? def.bashCategories;
    let prompt = def.subagentTemplate;
    prompt = prompt.replace(/\{taskName\}/g, taskName);
    prompt = prompt.replace(/\{docsDir\}/g, docsDir);
    prompt = prompt.replace(/\{workflowDir\}/g, workflowDir);
    prompt = prompt.replace(/\{userIntent\}/g, userIntent);
    prompt = prompt.replace(/\{taskId\}/g, taskId ?? '');
    prompt = prompt.replace(/\{SUMMARY_SECTION\}/g, SUMMARY_SECTION_RULE);
    prompt = prompt.replace(/\{BASH_CATEGORIES\}/g, bashCategoryHelp(categories));
    prompt = prompt.replace(/\{ARTIFACT_QUALITY\}/g, ARTIFACT_QUALITY_RULES);
    prompt = prompt.replace(/\{EXIT_CODE_RULE\}/g, EXIT_CODE_RULE);
    // {phase} must be replaced AFTER fragment expansion (SUMMARY_SECTION contains {phase})
    prompt = prompt.replace(/\{phase\}/g, phase);
    // ACE TOON-first: inject reading instructions for TOON context handoff
    const toonFirstSection = buildToonFirstSection(phase, docsDir);
    if (toonFirstSection) {
        prompt += toonFirstSection;
    }
    // ACE Reflector: inject lessons learned from past failures
    const reflectorSection = formatLessonsForPrompt(phase);
    if (reflectorSection) {
        prompt += reflectorSection;
    }
    return prompt;
}
//# sourceMappingURL=definitions.js.map