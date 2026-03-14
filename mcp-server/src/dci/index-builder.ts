/**
 * DCI Index Builder - scans project for @spec comments and builds index
 * @spec docs/spec/features/workflow-harness.md
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { DCIIndex, DCICodeEntry, DCIDesignEntry } from './types.js';

const SPEC_REGEX = /[/*]\s*@spec\s+(\S+)/g;
const RELATED_FILES_REGEX = /@related-files?\s+(.+)/g;
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.claude', '.agent', 'coverage']);
const MAX_SCAN_LINES = 50;

function walkDir(dir: string, extensions: string[], result: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return result; }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) { walkDir(full, extensions, result); }
    else if (extensions.some(ext => entry.endsWith(ext))) { result.push(full); }
  }
  return result;
}

function extractSpecs(filePath: string): { specs: string[]; layer1: string } {
  let content: string;
  try { content = readFileSync(filePath, 'utf8'); } catch { return { specs: [], layer1: '' }; }
  const lines = content.split('\n').slice(0, MAX_SCAN_LINES);
  const header = lines.join('\n');
  const specs: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(SPEC_REGEX.source, 'g');
  while ((match = regex.exec(header)) !== null) {
    const spec = match[1].replace(/\*\/$/, '');
    if (spec && !specs.includes(spec)) specs.push(spec);
  }
  // Extract layer1 from JSDoc description (first non-tag line after /*)
  let layer1 = '';
  for (const line of lines) {
    const trimmed = line.replace(/^\s*\*?\s*/, '').trim();
    if (trimmed.startsWith('/**') || trimmed === '*/' || trimmed === '') continue;
    if (trimmed.startsWith('@')) continue;
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) break;
    if (!layer1 && trimmed.length > 0) { layer1 = trimmed; break; }
  }
  return { specs, layer1 };
}

function isTestFile(filePath: string): boolean {
  const name = filePath.split(/[/\\]/).pop() ?? '';
  return name.includes('.test.') || name.includes('.spec.') || name.startsWith('test-');
}

function findSpecWithoutCode(
  projectRoot: string,
  codeToDesign: Record<string, DCICodeEntry>,
): string[] {
  const specDir = join(projectRoot, 'docs', 'spec');
  if (!existsSync(specDir)) return [];
  const specFiles = walkDir(specDir, ['.md']);
  const linkedSpecs = new Set(
    Object.values(codeToDesign).flatMap(e => e.specs),
  );
  const result: string[] = [];
  for (const absPath of specFiles) {
    const relPath = relative(projectRoot, absPath).replace(/\\/g, '/');
    if (linkedSpecs.has(relPath)) continue;
    // Check if spec references code files via @related-files
    let content: string;
    try { content = readFileSync(absPath, 'utf8'); } catch { continue; }
    const header = content.split('\n').slice(0, MAX_SCAN_LINES).join('\n');
    const regex = new RegExp(RELATED_FILES_REGEX.source, 'g');
    let match: RegExpExecArray | null;
    let hasValidRef = false;
    while ((match = regex.exec(header)) !== null) {
      const paths = match[1].split(/[,\s]+/).filter(Boolean);
      for (const p of paths) {
        if (existsSync(join(projectRoot, p))) { hasValidRef = true; break; }
      }
      if (hasValidRef) break;
    }
    if (!hasValidRef) result.push(relPath);
  }
  return result;
}

export function buildIndex(projectRoot: string, opts?: { extensions?: string[] }): DCIIndex {
  const extensions = opts?.extensions ?? DEFAULT_EXTENSIONS;
  const files = walkDir(join(projectRoot, 'src'), extensions);
  const codeToDesign: Record<string, DCICodeEntry> = {};
  const designToCode: Record<string, DCIDesignEntry> = {};
  const codeWithoutSpec: string[] = [];

  for (const absPath of files) {
    const relPath = relative(projectRoot, absPath).replace(/\\/g, '/');
    const { specs, layer1 } = extractSpecs(absPath);
    const isTest = isTestFile(relPath);

    if (specs.length > 0) {
      if (!isTest) {
        codeToDesign[relPath] = { specs, layer1 };
      }
      for (const spec of specs) {
        if (!designToCode[spec]) {
          designToCode[spec] = { implementedBy: [], testedBy: [], layer1: '' };
        }
        if (isTest) {
          if (!designToCode[spec].testedBy.includes(relPath)) designToCode[spec].testedBy.push(relPath);
        } else {
          if (!designToCode[spec].implementedBy.includes(relPath)) designToCode[spec].implementedBy.push(relPath);
          if (!designToCode[spec].layer1 && layer1) designToCode[spec].layer1 = layer1;
        }
      }
    } else if (!isTest) {
      codeWithoutSpec.push(relPath);
    }
  }

  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    projectRoot,
    codeToDesign,
    designToCode,
    orphans: {
      codeWithoutSpec,
      specWithoutCode: findSpecWithoutCode(projectRoot, codeToDesign),
    },
  };
}
