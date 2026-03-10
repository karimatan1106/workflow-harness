/**
 * N-61: Garbage collection agent configuration.
 * Defines rules for automated stale code detection and refactoring PR generation.
 * Requires: Codex cloud or scheduled CI job to execute.
 */

export interface GCRule {
  name: string;
  description: string;
  detector: 'dead-code' | 'unused-export' | 'stale-doc' | 'broken-pointer' | 'duplicate-file';
  action: 'warn' | 'pr' | 'delete';
  schedule: string;
}

/** Pre-configured garbage collection rules */
export const GC_RULES: GCRule[] = [
  {
    name: 'dead-exports',
    description: 'Find exported functions/types with zero importers',
    detector: 'unused-export',
    action: 'pr',
    schedule: 'weekly',
  },
  {
    name: 'stale-docs',
    description: 'Detect .md files not updated in 90+ days with code references',
    detector: 'stale-doc',
    action: 'warn',
    schedule: 'weekly',
  },
  {
    name: 'broken-pointers',
    description: 'Find CLAUDE.md/SKILL.md references to non-existent files',
    detector: 'broken-pointer',
    action: 'pr',
    schedule: 'daily',
  },
  {
    name: 'ghost-files',
    description: 'Detect duplicate/near-duplicate file basenames',
    detector: 'duplicate-file',
    action: 'warn',
    schedule: 'weekly',
  },
  {
    name: 'dead-code',
    description: 'Find unreachable code paths via ts-prune/knip',
    detector: 'dead-code',
    action: 'pr',
    schedule: 'weekly',
  },
];

/** Check if a GC rule should run today */
export function shouldRunToday(rule: GCRule, dayOfWeek: number): boolean {
  if (rule.schedule === 'daily') return true;
  if (rule.schedule === 'weekly') return dayOfWeek === 5; // Friday
  return false;
}

/** Get rules that should run today */
export function getTodayRules(dayOfWeek: number = new Date().getDay()): GCRule[] {
  return GC_RULES.filter((r) => shouldRunToday(r, dayOfWeek));
}
