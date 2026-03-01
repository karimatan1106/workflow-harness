/**
 * Artifact validation module - checks workflow output documents for quality
 * @spec docs/spec/features/workflow-harness.md
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    stats: {
        totalLines: number;
        substantiveLines: number;
        density: number;
        sections: Record<string, number>;
    };
}
export declare function extractNonCodeLines(content: string): string[];
export declare function removeInlineCode(line: string): string;
export declare function isStructuralLine(line: string): boolean;
export declare function isSubstantiveLine(line: string): boolean;
export declare function validateArtifact(content: string, requiredSections: string[], minLines: number): ValidationResult;
//# sourceMappingURL=artifact-validator.d.ts.map