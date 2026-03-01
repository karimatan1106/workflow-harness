/**
 * DoD helper utilities: forbidden patterns, structural line detection,
 * content extraction, duplicate detection, and section validation.
 * @spec docs/spec/features/workflow-harness.md
 */
export const FORBIDDEN_PATTERNS = [
    'TODO', 'TBD', 'WIP', 'FIXME',
    '未定', '未確定', '要検討', '検討中', '対応予定', 'サンプル', 'ダミー', '仮置き',
];
export const BRACKET_PLACEHOLDER_REGEX = /\[#[^\]]{0,50}#\]/;
export function isStructuralLine(line) {
    const trimmed = line.trim();
    if (/^#{1,6}\s/.test(trimmed))
        return true;
    if (/^[-*_]{3,}\s*$/.test(trimmed))
        return true;
    if (/^`{3,}/.test(trimmed))
        return true;
    if (/^\|[\s\-:|]+\|$/.test(trimmed))
        return true;
    if (/^\|.+\|.+\|/.test(trimmed))
        return true;
    if (/^\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed))
        return true;
    if (/^[-*]\s+\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed))
        return true;
    if (/^(?:[-*]\s+)?.{1,50}[:：]\s*$/.test(trimmed))
        return true;
    return false;
}
export function extractNonCodeLines(content) {
    const lines = content.split('\n');
    const result = [];
    let inCodeFence = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^`{3,}/.test(trimmed)) {
            inCodeFence = !inCodeFence;
            continue;
        }
        if (!inCodeFence)
            result.push(trimmed.replace(/`[^`]+`/g, ''));
    }
    return result;
}
export function checkForbiddenPatterns(content) {
    const nonCodeLines = extractNonCodeLines(content);
    return FORBIDDEN_PATTERNS.filter(p => nonCodeLines.some(line => line.includes(p)));
}
export function checkBracketPlaceholders(content) {
    return BRACKET_PLACEHOLDER_REGEX.test(extractNonCodeLines(content).join('\n'));
}
export function checkDuplicateLines(content) {
    const nonCodeLines = extractNonCodeLines(content);
    const countMap = new Map();
    for (const line of nonCodeLines) {
        const trimmed = line.trim();
        if (!trimmed || isStructuralLine(trimmed))
            continue;
        countMap.set(trimmed, (countMap.get(trimmed) ?? 0) + 1);
    }
    const duplicates = [];
    for (const [line, count] of countMap) {
        if (count >= 3)
            duplicates.push(`"${line.substring(0, 60)}..." (${count}x)`);
    }
    return duplicates;
}
export function checkRequiredSections(content, requiredSections) {
    const lines = content.split('\n');
    return requiredSections.filter(section => {
        const sectionText = section.replace(/^#+\s*/, '');
        return !lines.some(line => {
            const trimmed = line.trim();
            return trimmed.startsWith('#') && trimmed.replace(/^#+\s*/, '') === sectionText;
        });
    });
}
//# sourceMappingURL=dod-helpers.js.map