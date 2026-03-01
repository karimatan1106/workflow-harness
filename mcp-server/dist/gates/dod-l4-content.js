/**
 * DoD L4 content validation: forbidden patterns, placeholders, duplicates, required sections.
 * @spec docs/spec/features/workflow-harness.md
 */
import { readFileSync, existsSync } from 'node:fs';
import { PHASE_REGISTRY } from '../phases/registry.js';
import { checkForbiddenPatterns, checkBracketPlaceholders, checkDuplicateLines, checkRequiredSections, } from './dod-helpers.js';
export function checkL4ContentValidation(phase, docsDir, workflowDir) {
    const config = PHASE_REGISTRY[phase];
    if (!config || !config.outputFile) {
        return { level: 'L4', check: 'content_validation', passed: true, evidence: 'No content validation required for this phase' };
    }
    const outputFile = config.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir);
    if (!existsSync(outputFile)) {
        return { level: 'L4', check: 'content_validation', passed: false, evidence: `Cannot validate content: file missing: ${outputFile}` };
    }
    const content = readFileSync(outputFile, 'utf8');
    const errors = [];
    const forbidden = checkForbiddenPatterns(content);
    if (forbidden.length > 0)
        errors.push(`Forbidden patterns found: ${forbidden.join(', ')}`);
    if (checkBracketPlaceholders(content))
        errors.push('Bracket placeholders [#...#] found in content');
    const duplicates = checkDuplicateLines(content);
    if (duplicates.length > 0)
        errors.push(`Duplicate lines (3+ times): ${duplicates.slice(0, 3).join('; ')}`);
    const missingSections = checkRequiredSections(content, config.requiredSections ?? []);
    if (missingSections.length > 0)
        errors.push(`Missing required sections: ${missingSections.join(', ')}`);
    const passed = errors.length === 0;
    return {
        level: 'L4', check: 'content_validation', passed,
        evidence: passed ? 'Content validation passed: no forbidden patterns, placeholders, or duplicates' : errors.join('; '),
    };
}
//# sourceMappingURL=dod-l4-content.js.map