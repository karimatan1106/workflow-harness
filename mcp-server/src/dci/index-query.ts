/**
 * DCI Index Query and Validation
 * @spec docs/spec/features/workflow-harness.md
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DCIIndex } from './types.js';

export function queryDocsForFile(
  index: DCIIndex, filePath: string,
): { specs: string[]; layer1: string } | null {
  const entry = index.codeToDesign[filePath];
  if (!entry) return null;
  return { specs: entry.specs, layer1: entry.layer1 };
}

export function queryFilesForDoc(
  index: DCIIndex, docPath: string,
): { implementedBy: string[]; testedBy: string[]; layer1: string } | null {
  const entry = index.designToCode[docPath];
  if (!entry) return null;
  return { implementedBy: entry.implementedBy, testedBy: entry.testedBy, layer1: entry.layer1 };
}

export function validateIndex(
  index: DCIIndex, projectRoot: string,
): { ok: boolean; orphanCode: string[]; orphanDesign: string[]; brokenLinks: string[] } {
  const brokenLinks: string[] = [];
  // Check all spec paths in codeToDesign
  for (const [codePath, entry] of Object.entries(index.codeToDesign)) {
    for (const spec of entry.specs) {
      if (!existsSync(join(projectRoot, spec))) {
        brokenLinks.push(`${codePath} → ${spec} (NOT FOUND)`);
      }
    }
  }
  // Check all code paths in designToCode
  for (const [docPath, entry] of Object.entries(index.designToCode)) {
    for (const codePath of [...entry.implementedBy, ...entry.testedBy]) {
      if (!existsSync(join(projectRoot, codePath))) {
        brokenLinks.push(`${docPath} → ${codePath} (NOT FOUND)`);
      }
    }
  }
  return {
    ok: brokenLinks.length === 0 && index.orphans.codeWithoutSpec.length === 0,
    orphanCode: index.orphans.codeWithoutSpec,
    orphanDesign: index.orphans.specWithoutCode,
    brokenLinks,
  };
}
