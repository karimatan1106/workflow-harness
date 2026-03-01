/**
 * DoD helper utilities: forbidden patterns, structural line detection,
 * content extraction, duplicate detection, and section validation.
 * @spec docs/spec/features/workflow-harness.md
 */
export declare const FORBIDDEN_PATTERNS: string[];
export declare const BRACKET_PLACEHOLDER_REGEX: RegExp;
export declare function isStructuralLine(line: string): boolean;
export declare function extractNonCodeLines(content: string): string[];
export declare function checkForbiddenPatterns(content: string): string[];
export declare function checkBracketPlaceholders(content: string): boolean;
export declare function checkDuplicateLines(content: string): string[];
export declare function checkRequiredSections(content: string, requiredSections: string[]): string[];
//# sourceMappingURL=dod-helpers.d.ts.map