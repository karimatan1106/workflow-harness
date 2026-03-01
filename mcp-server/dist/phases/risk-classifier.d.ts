/**
 * Risk classifier - determines task size based on risk scoring
 */
import type { RiskScore, TaskSize } from '../state/types.js';
interface RiskInput {
    fileCount: number;
    hasTests: boolean;
    hasConfig: boolean;
    hasInfra: boolean;
    hasSecurity: boolean;
    hasDatabase: boolean;
    codeLineEstimate: number;
}
export declare function calculateRiskScore(input: RiskInput): RiskScore;
export declare function classifySize(score: RiskScore): TaskSize;
export declare function analyzeScope(files: string[], dirs: string[]): RiskInput;
export {};
//# sourceMappingURL=risk-classifier.d.ts.map