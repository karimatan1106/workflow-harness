/**
 * Core type definitions for workflow-harness state management
 * @spec docs/spec/features/workflow-harness.md
 */
import { z } from 'zod';
export type ControlLevel = 'L1' | 'L2' | 'L3' | 'L4';
export interface DoDCheck {
    level: ControlLevel;
    description: string;
    check: (context: GateContext) => boolean | Promise<boolean>;
}
export interface GateContext {
    taskId: string;
    phase: PhaseName;
    docsDir: string;
    workflowDir: string;
    scopeFiles: string[];
    proofLog: ProofEntry[];
}
export declare const PHASE_NAMES: readonly ["scope_definition", "research", "impact_analysis", "requirements", "threat_modeling", "planning", "state_machine", "flowchart", "ui_design", "design_review", "test_design", "test_selection", "test_impl", "implementation", "refactoring", "build_check", "code_review", "testing", "regression_test", "acceptance_verification", "manual_test", "security_scan", "performance_test", "e2e_test", "docs_update", "commit", "push", "ci_verification", "deploy", "health_observation", "completed"];
export type PhaseName = typeof PHASE_NAMES[number];
export type TaskSize = 'small' | 'medium' | 'large';
export interface RiskScore {
    total: number;
    factors: {
        fileCount: number;
        hasTests: boolean;
        hasConfig: boolean;
        hasInfra: boolean;
        hasSecurity: boolean;
        hasDatabase: boolean;
        codeLineEstimate: number;
    };
}
export declare const PARALLEL_GROUPS: {
    readonly parallel_analysis: readonly ["threat_modeling", "planning"];
    readonly parallel_design: readonly ["state_machine", "flowchart", "ui_design"];
    readonly parallel_quality: readonly ["build_check", "code_review"];
    readonly parallel_verification: readonly ["manual_test", "security_scan", "performance_test", "e2e_test"];
};
export type ParallelGroupName = keyof typeof PARALLEL_GROUPS;
export declare const APPROVAL_GATES: {
    readonly requirements: "requirements";
    readonly design_review: "design";
    readonly test_design: "test_design";
    readonly code_review: "code_review";
    readonly acceptance_verification: "acceptance";
};
export type ApprovalType = typeof APPROVAL_GATES[keyof typeof APPROVAL_GATES];
export interface RTMEntry {
    id: string;
    requirement: string;
    designRef: string;
    codeRef: string;
    testRef: string;
    status: 'pending' | 'implemented' | 'tested' | 'verified';
}
export interface AcceptanceCriterion {
    id: string;
    description: string;
    testCaseId?: string;
    status: 'open' | 'met' | 'not_met';
}
export interface ProofEntry {
    phase: PhaseName;
    timestamp: string;
    level: ControlLevel;
    check: string;
    result: boolean;
    evidence: string;
}
export interface Checkpoint {
    taskId: string;
    phase: PhaseName;
    completedPhases: PhaseName[];
    timestamp: string;
    sha256: string;
    userIntent: string;
    scopeFiles: string[];
    acceptanceCriteria: AcceptanceCriterion[];
    rtmEntries: RTMEntry[];
}
export interface SubPhaseStatus {
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    completedAt?: string;
}
export interface PhaseConfig {
    name: PhaseName;
    stage: number;
    model: 'opus' | 'sonnet' | 'haiku';
    inputFiles: string[];
    outputFile?: string;
    requiredSections?: string[];
    minLines?: number;
    allowedExtensions: string[];
    bashCategories: string[];
    dodChecks: DoDCheck[];
    approvalRequired?: ApprovalType;
    parallelGroup?: ParallelGroupName;
    dependencies?: PhaseName[];
}
export declare const TaskSizeSchema: z.ZodEnum<["small", "medium", "large"]>;
export declare const PhaseNameSchema: z.ZodEnum<[string, ...string[]]>;
export declare const ApprovalTypeSchema: z.ZodEnum<["requirements", "design", "test_design", "code_review", "acceptance"]>;
export declare const TaskStateSchema: z.ZodObject<{
    taskId: z.ZodString;
    taskName: z.ZodString;
    version: z.ZodLiteral<4>;
    phase: z.ZodEnum<[string, ...string[]]>;
    size: z.ZodEnum<["small", "medium", "large"]>;
    userIntent: z.ZodString;
    sessionToken: z.ZodString;
    stateIntegrity: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    taskId: z.ZodString;
    taskName: z.ZodString;
    version: z.ZodLiteral<4>;
    phase: z.ZodEnum<[string, ...string[]]>;
    size: z.ZodEnum<["small", "medium", "large"]>;
    userIntent: z.ZodString;
    sessionToken: z.ZodString;
    stateIntegrity: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    taskId: z.ZodString;
    taskName: z.ZodString;
    version: z.ZodLiteral<4>;
    phase: z.ZodEnum<[string, ...string[]]>;
    size: z.ZodEnum<["small", "medium", "large"]>;
    userIntent: z.ZodString;
    sessionToken: z.ZodString;
    stateIntegrity: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
//# sourceMappingURL=types-core.d.ts.map