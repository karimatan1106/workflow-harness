/**
 * N-50: MVH (Minimum Viable Harness) Roadmap Tracker.
 * Tracks harness maturity across 4 stages per MVH concept.
 */

export interface MVHMilestone {
  id: string;
  stage: 'week1' | 'week2-4' | 'month2-3' | 'month3+';
  description: string;
  implemented: boolean;
  evidence: string;
}

export const MVH_ROADMAP: MVHMilestone[] = [
  // Week 1: Foundation
  { id: 'MVH-01', stage: 'week1', description: 'CLAUDE.md/AGENTS.md (<50 lines pointers)', implemented: true, evidence: 'CLAUDE.md 13 lines' },
  { id: 'MVH-02', stage: 'week1', description: 'Lefthook pre-commit (lint+format+typecheck)', implemented: true, evidence: 'lefthook.yml' },
  { id: 'MVH-03', stage: 'week1', description: 'PostToolUse Hook auto-format', implemented: true, evidence: 'post-tool-lint.sh' },
  { id: 'MVH-04', stage: 'week1', description: 'First ADR', implemented: true, evidence: 'ADR store in archgate' },

  // Week 2-4: Core Workflow
  { id: 'MVH-05', stage: 'week2-4', description: 'Test/linter rule per agent mistake', implemented: true, evidence: 'FORBIDDEN_PATTERNS, archgate rules' },
  { id: 'MVH-06', stage: 'week2-4', description: 'Plan→approve→execute workflow', implemented: true, evidence: '30-phase harness lifecycle' },
  { id: 'MVH-07', stage: 'week2-4', description: 'E2E tool integration', implemented: false, evidence: 'Playwright scaffold only (N-35)' },
  { id: 'MVH-08', stage: 'week2-4', description: 'Stop Hook test gate', implemented: true, evidence: 'stop-test-enforcer.sh' },
  { id: 'MVH-09', stage: 'week2-4', description: 'Standardized session startup', implemented: true, evidence: 'handoff-reader.sh' },

  // Month 2-3: Advanced Quality
  { id: 'MVH-10', stage: 'month2-3', description: 'Custom linter with fix instructions (ADR-linked)', implemented: true, evidence: 'archgate + ERROR_ADR_MAP' },
  { id: 'MVH-11', stage: 'month2-3', description: 'ADR↔linter rule tying', implemented: true, evidence: 'archgate.ts ADR+rule pattern' },
  { id: 'MVH-12', stage: 'month2-3', description: 'Narrative doc→test/ADR migration', implemented: true, evidence: 'skill-rules.test.ts (N-17)' },
  { id: 'MVH-13', stage: 'month2-3', description: 'PreToolUse safety gates', implemented: true, evidence: 'pre-tool-config-guard.sh' },

  // Month 3+: Scale & Optimize
  { id: 'MVH-14', stage: 'month3+', description: 'Advanced Plankton feedback loops', implemented: true, evidence: 'classifyComplexity + routing (N-26)' },
  { id: 'MVH-15', stage: 'month3+', description: 'Garbage collection process', implemented: true, evidence: 'gc.ts' },
  { id: 'MVH-16', stage: 'month3+', description: 'Multi-agent parallelism', implemented: true, evidence: 'Orchestrator + parallel groups' },
  { id: 'MVH-17', stage: 'month3+', description: 'Quantify harness ROI', implemented: false, evidence: 'promptfoo scaffold only (N-38)' },
];

export interface MVHProgress {
  total: number;
  implemented: number;
  percentage: number;
  byStage: Record<string, { total: number; done: number }>;
}

export function getMVHProgress(): MVHProgress {
  const total = MVH_ROADMAP.length;
  const implemented = MVH_ROADMAP.filter(m => m.implemented).length;
  const byStage: Record<string, { total: number; done: number }> = {};

  for (const m of MVH_ROADMAP) {
    if (!byStage[m.stage]) byStage[m.stage] = { total: 0, done: 0 };
    byStage[m.stage].total++;
    if (m.implemented) byStage[m.stage].done++;
  }

  return {
    total,
    implemented,
    percentage: Math.round((implemented / total) * 100),
    byStage,
  };
}

/** Get milestones filtered by stage */
export function getMilestonesByStage(stage: MVHMilestone['stage']): MVHMilestone[] {
  return MVH_ROADMAP.filter(m => m.stage === stage);
}

/** Get all not-yet-implemented milestones */
export function getPendingMilestones(): MVHMilestone[] {
  return MVH_ROADMAP.filter(m => !m.implemented);
}
