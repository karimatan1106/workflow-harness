/**
 * DCI (Design-Code Index) MCP tool handlers
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { buildIndex } from '../../dci/index-builder.js';
import { queryDocsForFile, queryFilesForDoc, validateIndex } from '../../dci/index-query.js';
import type { DCIIndex } from '../../dci/types.js';
import { respond, respondError, type HandlerResult } from '../handler-shared.js';

const INDEX_PATH = '.claude/state/design-code-index.json';

function getProjectRoot(): string {
  return process.cwd();
}

function loadOrBuildIndex(projectRoot: string): DCIIndex {
  const indexPath = join(projectRoot, INDEX_PATH);
  if (existsSync(indexPath)) {
    try { return JSON.parse(readFileSync(indexPath, 'utf8')); } catch { /* rebuild */ }
  }
  const index = buildIndex(projectRoot);
  const dir = dirname(indexPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  return index;
}

export async function handleDciBuildIndex(args: Record<string, unknown>): Promise<HandlerResult> {
  const projectRoot = args.projectRoot ? String(args.projectRoot) : getProjectRoot();
  const index = buildIndex(projectRoot);
  const indexPath = join(projectRoot, INDEX_PATH);
  const dir = dirname(indexPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  const codeCount = Object.keys(index.codeToDesign).length;
  const designCount = Object.keys(index.designToCode).length;
  return respond({
    indexed: codeCount + designCount,
    codeFiles: codeCount,
    designDocs: designCount,
    orphanCode: index.orphans.codeWithoutSpec.length,
    orphanDesign: index.orphans.specWithoutCode.length,
    savedTo: INDEX_PATH,
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
