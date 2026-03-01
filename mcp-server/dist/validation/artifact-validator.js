/**
 * Artifact validation module - checks workflow output documents for quality
 * @spec docs/spec/features/workflow-harness.md
 */
const FORBIDDEN_PATTERNS = [
    'TODO', 'TBD', 'WIP', 'FIXME',
    '未定', '未確定', '要検討', '検討中',
    '対応予定', 'サンプル', 'ダミー', '仮置き',
];
const BRACKET_PLACEHOLDER_REGEX = /\[#[^\]]{0,50}#\]/g;
export function extractNonCodeLines(content) {
    const lines = content.split('\n');
    const result = [];
    let insideFence = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('```')) {
            insideFence = !insideFence;
            continue;
        }
        if (!insideFence) {
            result.push(line);
        }
    }
    return result;
}
export function removeInlineCode(line) {
    return line.replace(/`[^`]*`/g, '');
}
export function isStructuralLine(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
        return true;
    }
    if (/^[-*_]{3,}$/.test(trimmed)) {
        return true;
    }
    if (trimmed.startsWith('```')) {
        return true;
    }
    if (/^\|[\s|:\-]+\|$/.test(trimmed)) {
        return true;
    }
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if ((trimmed.match(/\|/g) || []).length >= 2) {
            return true;
        }
    }
    if (/^\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed)) {
        return true;
    }
    if (/^[-*]\s+\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed)) {
        return true;
    }
    if (/^(?:[-*]\s+)?.{1,50}[:：]\s*$/.test(trimmed)) {
        return true;
    }
    return false;
}
export function isSubstantiveLine(line) {
    const trimmed = line.trim();
    if (trimmed === '') {
        return false;
    }
    if (/^[-*_]{3,}$/.test(trimmed)) {
        return false;
    }
    if (trimmed.startsWith('```')) {
        return false;
    }
    if (/^\*\*[^*]+\*\*[:：]\s*$/.test(trimmed)) {
        return false;
    }
    if (/^[-*]\s+\*\*[^*]+\*\*[:：]\s*$/.test(trimmed)) {
        return false;
    }
    return true;
}
function parseSections(content) {
    const rawLines = content.split('\n');
    const sections = [];
    let currentSection = null;
    let insideFence = false;
    for (const line of rawLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('```')) {
            insideFence = !insideFence;
            continue;
        }
        if (!insideFence && trimmed.startsWith('## ')) {
            const name = trimmed.slice(3).trim();
            currentSection = { name, lines: [] };
            sections.push(currentSection);
            continue;
        }
        if (!insideFence && currentSection) {
            currentSection.lines.push(line);
        }
    }
    return sections;
}
function checkForbiddenPatterns(content) {
    const errors = [];
    for (const line of extractNonCodeLines(content)) {
        const cleaned = removeInlineCode(line);
        for (const pattern of FORBIDDEN_PATTERNS) {
            if (cleaned.includes(pattern)) {
                errors.push(`Forbidden pattern ${pattern} found outside code fence: ${line.trim().slice(0, 80)}`);
                break;
            }
        }
    }
    return errors;
}
function checkBracketPlaceholders(content) {
    const errors = [];
    for (const line of extractNonCodeLines(content)) {
        const cleaned = removeInlineCode(line);
        const matches = cleaned.match(BRACKET_PLACEHOLDER_REGEX);
        if (matches) {
            for (const m of matches) {
                errors.push(`Bracket placeholder ${m} is forbidden outside code fences`);
            }
        }
    }
    return errors;
}
function checkDuplicateLines(content) {
    const errors = [];
    const counts = new Map();
    for (const line of extractNonCodeLines(content)) {
        if (isStructuralLine(line)) {
            continue;
        }
        const trimmed = line.trim();
        if (trimmed === '')
            continue;
        counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
    for (const [line, count] of counts) {
        if (count >= 3) {
            errors.push(`Duplicate line appears ${count} times: ${line.slice(0, 80)}`);
        }
    }
    return errors;
}
export function validateArtifact(content, requiredSections, minLines) {
    const errors = [];
    const warnings = [];
    const allLines = content.split('\n');
    const totalLines = allLines.length;
    let insideFence = false;
    let substantiveLines = 0;
    for (const line of allLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('```')) {
            insideFence = !insideFence;
            continue;
        }
        if (!insideFence && isSubstantiveLine(line)) {
            substantiveLines++;
        }
    }
    const density = totalLines > 0 ? substantiveLines / totalLines : 0;
    const parsedSections = parseSections(content);
    const sectionStats = {};
    for (const section of parsedSections) {
        sectionStats[section.name] = section.lines.filter(l => isSubstantiveLine(l)).length;
    }
    if (totalLines < minLines) {
        errors.push(`Total lines ${totalLines} is below minimum ${minLines}`);
    }
    if (density < 0.30) {
        errors.push(`Section density ${(density * 100).toFixed(1)}% is below required 30% (${substantiveLines}/${totalLines})`);
    }
    for (const required of requiredSections) {
        const found = parsedSections.find(s => s.name === required);
        if (!found) {
            errors.push(`Required section ## ${required} is missing`);
        }
        else {
            const count = sectionStats[required] ?? 0;
            if (count < 5) {
                errors.push(`Section ## ${required} has only ${count} substantive line(s); at least 5 required`);
            }
        }
    }
    errors.push(...checkForbiddenPatterns(content));
    errors.push(...checkBracketPlaceholders(content));
    errors.push(...checkDuplicateLines(content));
    return { valid: errors.length === 0, errors, warnings, stats: { totalLines, substantiveLines, density, sections: sectionStats } };
}
//# sourceMappingURL=artifact-validator.js.map