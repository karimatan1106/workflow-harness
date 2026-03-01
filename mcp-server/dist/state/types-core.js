/**
 * Core type definitions for workflow-harness state management
 * @spec docs/spec/features/workflow-harness.md
 */
import { z } from 'zod';
// ─── Phase Names ────────────────────────────────
export const PHASE_NAMES = [
    'scope_definition',
    'research',
    'impact_analysis',
    'requirements',
    'threat_modeling',
    'planning',
    'state_machine',
    'flowchart',
    'ui_design',
    'design_review',
    'test_design',
    'test_selection',
    'test_impl',
    'implementation',
    'refactoring',
    'build_check',
    'code_review',
    'testing',
    'regression_test',
    'acceptance_verification',
    'manual_test',
    'security_scan',
    'performance_test',
    'e2e_test',
    'docs_update',
    'commit',
    'push',
    'ci_verification',
    'deploy',
    'health_observation',
    'completed',
];
// ─── Parallel Phase Groups ──────────────────────
export const PARALLEL_GROUPS = {
    parallel_analysis: ['threat_modeling', 'planning'],
    parallel_design: ['state_machine', 'flowchart', 'ui_design'],
    parallel_quality: ['build_check', 'code_review'],
    parallel_verification: ['manual_test', 'security_scan', 'performance_test', 'e2e_test'],
};
// ─── Approval Gates ─────────────────────────────
export const APPROVAL_GATES = {
    requirements: 'requirements',
    design_review: 'design',
    test_design: 'test_design',
    code_review: 'code_review',
    acceptance_verification: 'acceptance',
};
// ─── Zod Schemas for Validation ─────────────────
export const TaskSizeSchema = z.enum(['small', 'medium', 'large']);
export const PhaseNameSchema = z.enum(PHASE_NAMES);
export const ApprovalTypeSchema = z.enum([
    'requirements',
    'design',
    'test_design',
    'code_review',
    'acceptance',
]);
export const TaskStateSchema = z.object({
    taskId: z.string().uuid(),
    taskName: z.string().min(1),
    version: z.literal(4),
    phase: PhaseNameSchema,
    size: TaskSizeSchema,
    userIntent: z.string().min(20),
    sessionToken: z.string().min(32),
    stateIntegrity: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).passthrough();
//# sourceMappingURL=types-core.js.map