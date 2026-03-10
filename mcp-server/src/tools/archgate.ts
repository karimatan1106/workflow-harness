/**
 * Archgate — executable architecture rules linked to ADRs.
 * Each rule is checked during DoD to enforce architecture decisions.
 * Rules are automatically skipped when their linked ADR is deprecated/superseded.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { isADRActive } from './adr.js';

const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const ARCHGATE_PATH = join(STATE_DIR, 'archgate-rules.json');

export type ArchCheckType = 'line_count' | 'pattern_absent' | 'pattern_required';

export interface ArchRule {
  id: string;
  adrId: string;
  description: string;
  checkType: ArchCheckType;
  threshold?: number;
  pattern?: string;
  glob?: string;
  createdAt: string;
}

export interface ArchRuleInput {
  id: string;
  adrId: string;
  description: string;
  checkType: ArchCheckType;
  threshold?: number;
  pattern?: string;
  glob?: string;
}

export interface ArchGateCheck {
  ruleId: string;
  adrId: string;
  passed: boolean;
  evidence: string;
}

export interface ArchGateResult {
  passed: boolean;
  checks: ArchGateCheck[];
}

export interface FileInfo {
  path: string;
  lineCount?: number;
  content?: string;
}

interface ArchRuleStore {
  version: 1;
  rules: ArchRule[];
}

function loadRuleStore(): ArchRuleStore {
  try {
    if (existsSync(ARCHGATE_PATH)) {
      return JSON.parse(readFileSync(ARCHGATE_PATH, 'utf-8')) as ArchRuleStore;
    }
  } catch { /* corrupted */ }
  return { version: 1, rules: [] };
}

function saveRuleStore(store: ArchRuleStore): void {
  const dir = dirname(ARCHGATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(ARCHGATE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export function registerArchRule(input: ArchRuleInput): ArchRule {
  const store = loadRuleStore();
  const rule: ArchRule = { ...input, createdAt: new Date().toISOString() };
  store.rules.push(rule);
  saveRuleStore(store);
  return rule;
}

export function getArchRules(): ArchRule[] {
  return loadRuleStore().rules;
}

function matchGlob(filePath: string, glob: string): boolean {
  const pattern = glob.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
  return new RegExp('^' + pattern + '$').test(filePath);
}

/**
 * Run architecture gate checks against file information.
 * @param fileInfos - Files with line counts (for line_count rules)
 * @param contentInfos - Files with content (for pattern rules)
 */
export function runArchGateChecks(
  fileInfos: FileInfo[],
  contentInfos?: FileInfo[],
): ArchGateResult {
  const store = loadRuleStore();
  const checks: ArchGateCheck[] = [];

  for (const rule of store.rules) {
    // Skip rules whose ADR is no longer active
    if (!isADRActive(rule.adrId)) continue;

    if (rule.checkType === 'line_count' && rule.threshold !== undefined) {
      const relevant = rule.glob
        ? fileInfos.filter(f => matchGlob(f.path, rule.glob!))
        : fileInfos;
      const violations = relevant.filter(f => (f.lineCount ?? 0) > rule.threshold!);
      if (violations.length > 0) {
        checks.push({
          ruleId: rule.id,
          adrId: rule.adrId,
          passed: false,
          evidence: `${rule.description}: ${violations.map(f => `${f.path} (${f.lineCount} lines)`).join(', ')}`,
        });
      }
    }

    if (rule.checkType === 'pattern_absent' && rule.pattern) {
      const files = contentInfos ?? [];
      const regex = new RegExp(rule.pattern);
      const violations = files.filter(f => f.content && regex.test(f.content));
      if (violations.length > 0) {
        checks.push({
          ruleId: rule.id,
          adrId: rule.adrId,
          passed: false,
          evidence: `${rule.description}: pattern found in ${violations.map(f => f.path).join(', ')}`,
        });
      }
    }

    if (rule.checkType === 'pattern_required' && rule.pattern) {
      const files = contentInfos ?? [];
      const regex = new RegExp(rule.pattern);
      const missing = files.filter(f => f.content && !regex.test(f.content));
      if (missing.length > 0) {
        checks.push({
          ruleId: rule.id,
          adrId: rule.adrId,
          passed: false,
          evidence: `${rule.description}: pattern missing in ${missing.map(f => f.path).join(', ')}`,
        });
      }
    }
  }

  return {
    passed: checks.length === 0,
    checks,
  };
}
