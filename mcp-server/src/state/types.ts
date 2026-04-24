/**
 * TaskState type definition + re-exports from types-core.ts
 * @spec docs/spec/features/workflow-harness.md
 */

export type {
  ControlLevel,
  DoDCheck,
  DoDExemptionType,
  InputFileMode,
  GateContext,
  PhaseName,
  TaskSize,
  RiskScore,
  ParallelGroupName,
  ApprovalType,
  RTMEntry,
  AcceptanceCriterion,
  ProofEntry,
  Checkpoint,
  SubPhaseStatus,
  PhaseConfig,
  ProofTier,
  ProjectTraits,
} from './types-core.js';

export {
  PHASE_NAMES,
  PARALLEL_GROUPS,
  APPROVAL_GATES,
  TaskSizeSchema,
  PhaseNameSchema,
  ApprovalTypeSchema,
  TaskStateSchema,
  PROOF_TIERS,
} from './types-core.js';

export type { Invariant, InvariantStatus } from './types-invariant.js';
export { INVARIANT_STATUSES } from './types-invariant.js';

import type {
  PhaseName,
  TaskSize,
  RiskScore,
  AcceptanceCriterion,
  RTMEntry,
  ProofEntry,
  Checkpoint,
  SubPhaseStatus,
  ProjectTraits,
} from './types-core.js';

import type { Invariant } from './types-invariant.js';

// ─── Task State v4 ──────────────────────────────
export interface TaskState {
  // Identity
  taskId: string;
  taskName: string;
  version: 4;

  // Phase tracking
  phase: PhaseName;
  completedPhases: PhaseName[];
  skippedPhases: PhaseName[];

  // Parallel phase tracking
  subPhaseStatus?: Record<string, SubPhaseStatus>;

  // Size & risk
  size: TaskSize;
  riskScore: RiskScore;

  // User intent
  userIntent: string;
  refinedIntent?: string;
  openQuestions: string[];
  notInScope: string[];

  // Scope
  scopeFiles: string[];
  scopeDirs: string[];
  scopeGlob?: string;
  plannedFiles: string[];

  // Traceability
  acceptanceCriteria: AcceptanceCriterion[];
  rtmEntries: RTMEntry[];
  proofLog: ProofEntry[];

  // Invariants (INV-N)
  invariants: Invariant[];

  // Checkpoints
  checkpoint: Checkpoint;

  // Paths
  docsDir: string;
  workflowDir: string;

  // Extended state (optional)
  approvals?: Record<string, { approvedAt: string }>;
  feedbackLog?: Array<{ feedback: string; recordedAt: string }>;
  baseline?: { capturedAt: string; totalTests: number; passedTests: number; failedTests: string[] };
  testResults?: Array<{ recordedAt: string; phase: PhaseName; exitCode: number; output: string; summary?: string; failedTests?: string[] }>;
  resetHistory?: Array<{ reason: string; resetAt: string; targetPhase: string }>;
  testFiles?: string[];
  knownBugs?: Array<{ testName: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; targetPhase?: string; issueUrl?: string; recordedAt: string }>;

  // Project traits (dynamic doc categories)
  projectTraits?: ProjectTraits;

  // Sprint 1-2 additions
  retryCount?: Record<string, number>;                  // RLM-1: phase name → retry count
  /** Per-phase streak of consecutive failures by the same DoD check. Tags with CBR-1. */
  checkFailureStreak?: Record<string, { checkName: string; count: number }>;
  artifactTimestamps?: Record<string, number>;           // AFV-1: artifact path → mtime epoch ms
  requirementCount?: number;                             // IA-2: number of AC-N entries
  artifactHashes?: Record<string, string>;               // ART-1: artifact path → SHA-256 hash
  parallelPhaseBackupLog?: string[];                     // PHA-1: rollback candidates after parallel failure


  // Integrity
  integrityWarning?: boolean; // true when HMAC verification failed but data is readable

  // Security
  sessionToken: string;
  stateIntegrity: string; // HMAC-SHA256

  // Metadata
  createdAt: string;
  updatedAt: string;
  parentTaskId?: string;
  childTaskIds?: string[];
}
