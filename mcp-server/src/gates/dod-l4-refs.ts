/**
 * DoD L4 dead reference check: DRV-1 (S3-10)
 * Checks that relative markdown links in artifacts point to existing files.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { PHASE_REGISTRY } from '../phases/registry.js';
import type { PhaseConfig } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';

// Phases where dead reference check applies
const REF_CHECK_PHASES = new Set([
  'design_review', 'code_review', 'acceptance_verification',
  'planning', 'test_design',
]);

// Matches relative markdown links: [text](./path.md) or [text](../path.md)
const RELATIVE_LINK_PATTERN = /\[([^\]]*)\]\((\.[^)#?\s]+\.md)\)/g;

/** DRV-1 (S3-10): Detect dead relative markdown link references in phase artifacts */
export function checkDeadReferences(phase: string, docsDir: string, workflowDir: string): DoDCheckResult {
  if (!REF_CHECK_PHASES.has(phase)) {
    return { level: 'L4', check: 'dead_references', passed: true, evidence: 'Dead reference check not required for phase: ' + phase };
  }
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config?.outputFile) {
    return { level: 'L4', check: 'dead_references', passed: true, evidence: 'No output file for dead reference check' };
  }
  const outputFile = config.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir);
  if (!existsSync(outputFile)) {
    return { level: 'L4', check: 'dead_references', passed: true, evidence: 'Output file not found; dead reference check skipped' };
  }
  const content = readFileSync(outputFile, 'utf8');
  const fileDir = dirname(outputFile);
  const dead: string[] = [];
  const re = new RegExp(RELATIVE_LINK_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const linkPath = match[2];
    const resolved = resolve(fileDir, linkPath);
    if (!existsSync(resolved)) dead.push(linkPath);
  }
  if (dead.length > 0) {
    return {
      level: 'L4', check: 'dead_references', passed: false,
      evidence: `Dead references in ${phase} artifact: ${dead.join(', ')} (DRV-1)\n修正方法: 参照先ファイルを作成するか、リンクを修正してください。`,
    };
  }
  return { level: 'L4', check: 'dead_references', passed: true, evidence: 'No dead references detected in artifact (DRV-1)' };
}
