/**
 * DCI (Design-Code Index) MCP tool handlers
 * Writes/reads .toon format; migrates from .json if needed.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { buildIndex } from '../../dci/index-builder.js';
import { queryDocsForFile, queryFilesForDoc, validateIndex } from '../../dci/index-query.js';
import { serializeDCI, parseDCI } from '../../dci/dci-toon-io.js';
import type { DCIIndex } from '../../dci/types.js';
import { respond, respondError, type HandlerResult } from '../handler-shared.js';

const INDEX_TOON = '.claude/state/design-code-index.toon';
const INDEX_JSON = '.claude/state/design-code-index.json';

function getProjectRoot(): string {
  return process.cwd();
}

/** Migrate .json → .toon if only .json exists. */
function migrateIfNeeded(projectRoot: string): void {
  const toonPath = join(projectRoot, INDEX_TOON);
  const jsonPath = join(projectRoot, INDEX_JSON);
  if (existsSync(toonPath) || !existsSync(jsonPath)) return;
  try {
    const index = JSON.parse(readFileSync(jsonPath, 'utf8')) as DCIIndex;
    const dir = dirname(toonPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(toonPath, serializeDCI(index), 'utf8');
  } catch { /* migration failed — will rebuild */ }
}

function writeIndex(projectRoot: string, index: DCIIndex): void {
  const toonPath = join(projectRoot, INDEX_TOON);
  const dir = dirname(toonPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(toonPath, serializeDCI(index), 'utf8');
}

function loadOrBuildIndex(projectRoot: string): DCIIndex {
  const toonPath = join(projectRoot, INDEX_TOON);
  if (existsSync(toonPath)) {
    try { return parseDCI(readFileSync(toonPath, 'utf8')); } catch { /* rebuild */ }
  }
  migrateIfNeeded(projectRoot);
  if (existsSync(toonPath)) {
    try { return parseDCI(readFileSync(toonPath, 'utf8')); } catch { /* rebuild */ }
  }
  const index = buildIndex(projectRoot);
  writeIndex(projectRoot, index);
  return index;
}

export async function handleDciBuildIndex(args: Record<string, unknown>): Promise<HandlerResult> {
  const projectRoot = args.projectRoot ? String(args.projectRoot) : getProjectRoot();
  const index = buildIndex(projectRoot);
  writeIndex(projectRoot, index);
  const codeCount = Object.keys(index.codeToDesign).length;
  const designCount = Object.keys(index.designToCode).length;
  return respond({
    indexed: codeCount + designCount,
    codeFiles: codeCount,
    designDocs: designCount,
    orphanCode: index.orphans.codeWithoutSpec.length,
    orphanDesign: index.orphans.specWithoutCode.length,
    savedTo: INDEX_TOON,
  });
}

export async function handleDciQueryDocs(args: Record<string, unknown>): Promise<HandlerResult> {
  const filePath = String(args.filePath ?? '');
  if (!filePath) return respondError('filePath is required');
  const index = loadOrBuildIndex(getProjectRoot());
  const result = queryDocsForFile(index, filePath);
  if (!result) return respond({ filePath, found: false, specs: [], layer1: '' });
  return respond({ filePath, found: true, ...result });
}

export async function handleDciQueryFiles(args: Record<string, unknown>): Promise<HandlerResult> {
  const docPath = String(args.docPath ?? '');
  if (!docPath) return respondError('docPath is required');
  const index = loadOrBuildIndex(getProjectRoot());
  const result = queryFilesForDoc(index, docPath);
  if (!result) return respond({ docPath, found: false, implementedBy: [], testedBy: [], layer1: '' });
  return respond({ docPath, found: true, ...result });
}

export async function handleDciValidate(): Promise<HandlerResult> {
  const projectRoot = getProjectRoot();
  const index = loadOrBuildIndex(projectRoot);
  const result = validateIndex(index, projectRoot);
  return respond(result);
}
