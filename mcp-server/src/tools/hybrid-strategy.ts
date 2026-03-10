/**
 * N-62: Codex hybrid strategy configuration.
 * Defines the Claude Code (plan) → Codex (execute) → Claude Code (review) pattern.
 */

export type AgentRole = 'planner' | 'executor' | 'reviewer';
export type Platform = 'claude-code' | 'codex';

export interface HybridStage {
  role: AgentRole;
  platform: Platform;
  description: string;
  capabilities: string[];
}

/** The 3-stage hybrid workflow pattern from the article */
export const HYBRID_STAGES: HybridStage[] = [
  {
    role: 'planner',
    platform: 'claude-code',
    description: 'Plan and design with Hooks quality gates',
    capabilities: ['plan-mode', 'extended-thinking', 'hooks', 'mcp-tools'],
  },
  {
    role: 'executor',
    platform: 'codex',
    description: 'Parallel execution in isolated sandboxes',
    capabilities: ['async-tasks', 'cloud-sandbox', 'network-isolation', 'parallel'],
  },
  {
    role: 'reviewer',
    platform: 'claude-code',
    description: 'Review, improve, and merge with deterministic checks',
    capabilities: ['hooks', 'post-tool-lint', 'stop-enforcer', 'config-guard'],
  },
];

/** Decision framework: when to use which platform */
export const DECISION_FRAMEWORK = {
  qualityFirst: {
    primary: 'claude-code' as Platform,
    reason: 'Hooks provide deterministic quality gates with no alternative',
  },
  throughputFirst: {
    primary: 'codex' as Platform,
    reason: 'Async sandbox parallel execution with no alternative',
  },
  balanced: {
    primary: 'claude-code' as Platform,
    secondary: 'codex' as Platform,
    reason: 'Build harness in Claude Code, scale execution via Codex',
  },
} as const;

/** Get recommended stage for a task type */
export function getRecommendedPlatform(
  priority: 'quality' | 'throughput' | 'balanced',
): { primary: Platform; secondary?: Platform } {
  return DECISION_FRAMEWORK[priority === 'quality' ? 'qualityFirst' : priority === 'throughput' ? 'throughputFirst' : 'balanced'];
}
