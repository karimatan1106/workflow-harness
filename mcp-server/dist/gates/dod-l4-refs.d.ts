/**
 * DoD L4 dead reference check: DRV-1 (S3-10)
 * Checks that relative markdown links in artifacts point to existing files.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { DoDCheckResult } from './dod-types.js';
/** DRV-1 (S3-10): Detect dead relative markdown link references in phase artifacts */
export declare function checkDeadReferences(phase: string, docsDir: string, workflowDir: string): DoDCheckResult;
//# sourceMappingURL=dod-l4-refs.d.ts.map