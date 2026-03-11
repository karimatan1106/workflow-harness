/**
 * Core type definitions for workflow-harness state management
 * @spec docs/spec/features/workflow-harness.md
 */

import { z } from 'zod';

// ─── Control Levels ─────────────────────────────
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
] as const;

export type PhaseName = typeof PHASE_NAMES[number];

// ─── Task Size ──────────────────────────────────
export type TaskSize = 'small' | 'medium' | 'large';

export interface RiskScore {
  total: number;
  factors: {
    fileCount: number; hasTests: boolean; hasConfig: boolean;
    hasInfra: boolean; hasSecurity: boolean; hasDatabase: boolean;
    codeLineEstimate: number;
  };
}

// ─── Project Traits (dynamic doc categories) ────
export interface ProjectTraits {
  hasUI: boolean; hasAPI: boolean; hasDB: boolean;
  hasEvents: boolean; hasI18n: boolean; hasDesignSystem: boolean;
}

// ─── Parallel Phase Groups ──────────────────────
export const PARALLEL_GROUPS = {
  parallel_analysis: ['threat_modeling', 'planning'],
  parallel_design: ['state_machine', 'flowchart', 'ui_design'],
  parallel_quality: ['build_check', 'code_review'],
  parallel_verification: ['manual_test', 'security_scan', 'performance_test', 'e2e_test'],
} as const;

export type ParallelGroupName = keyof typeof PARALLEL_GROUPS;

// ─── Approval Gates ─────────────────────────────
export const APPROVAL_GATES = {
  requirements: 'requirements',
  design_review: 'design',
  test_design: 'test_design',
  code_review: 'code_review',
  acceptance_verification: 'acceptance',
} as const;

export type ApprovalType = typeof APPROVAL_GATES[keyof typeof APPROVAL_GATES];

// ─── RTM (Requirements Traceability Matrix) ─────
export interface RTMEntry {
  id: string;          // F-001, F-002, ...
  requirement: string; // requirement description
  designRef: string;   // spec.md section reference
  codeRef: string;     // source file path
  testRef: string;     // test file path
  status: 'pending' | 'implemented' | 'tested' | 'verified';
}

// ─── Proof Tier ─────────────────────────────────
export type ProofTier = 'T1' | 'T2' | 'T3' | 'T4';
export const PROOF_TIERS: readonly ProofTier[] = ['T1', 'T2', 'T3', 'T4'] as const;

// ─── Acceptance Criteria ────────────────────────
export interface AcceptanceCriterion {
  id: string;          // AC-1, AC-2, ...
  description: string;
  testCaseId?: string; // TC-AC1-01, TC-AC2-01, ...
  status: 'open' | 'met' | 'not_met';
  proofTier?: ProofTier;
}

// ─── Proof Log ──────────────────────────────────
export interface ProofEntry {
  phase: PhaseName;
  timestamp: string;
  level: ControlLevel;
  check: string;
  result: boolean;
  evidence: string;   // e.g., "exit code 0", "file exists at path/to/file"
}

// ─── Checkpoint (Compacting Resilience) ─────────
export interface Checkpoint {
  taskId: string;
  phase: PhaseName;
  completedPhases: PhaseName[];
  timestamp: string;
  sha256: string;      // hash of completed artifacts
  userIntent: string;
  scopeFiles: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  rtmEntries: RTMEntry[];
}

// ─── Sub-phase Status ───────────────────────────
export interface SubPhaseStatus {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  completedAt?: string;
}

export type DoDExemptionType = 'exit_code_zero' | 'tdd_red_evidence';
// ─── Phase Configuration ────────────────────────
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
  dodExemptions?: DoDExemptionType[];
  approvalRequired?: ApprovalType;
  parallelGroup?: ParallelGroupName;
  dependencies?: PhaseName[];
}

// ─── Zod Schemas for Validation ─────────────────
export const TaskSizeSchema = z.enum(['small', 'medium', 'large']);

export const PhaseNameSchema = z.enum(PHASE_NAMES as unknown as [string, ...string[]]);

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
