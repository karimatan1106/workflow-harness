/**
 * TOON serializer/parser for DCI (Design-Code Index).
 * Converts DCIIndex to/from .toon format.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { DCIIndex, DCICodeEntry, DCIDesignEntry } from './types.js';
import { esc, splitRow, parseKV, parseTableHeader, parseListHeader } from '../state/toon-io.js';

export function serializeDCI(index: DCIIndex): string {
  const L: string[] = [];
  L.push(`version: ${index.version}`);
  L.push(`updatedAt: ${index.generatedAt}`);
  L.push(`projectRoot: ${esc(index.projectRoot)}`);
  L.push('');

  const c2d = Object.entries(index.codeToDesign);
  L.push(`codeToDesign[${c2d.length}]{codePath,specs,layer1}:`);
  for (const [path, entry] of c2d) {
    const specs = entry.specs.join(';');
    L.push(`  ${esc(path)}, ${esc(specs)}, ${esc(entry.layer1)}`);
  }
  L.push('');

  const d2c = Object.entries(index.designToCode);
  L.push(`designToCode[${d2c.length}]{docPath,implementedBy,testedBy,layer1}:`);
  for (const [path, entry] of d2c) {
    const impl = entry.implementedBy.join(';');
    const tested = entry.testedBy.join(';');
    L.push(`  ${esc(path)}, ${esc(impl)}, ${esc(tested)}, ${esc(entry.layer1)}`);
  }
  L.push('');

  const orphanCode = index.orphans.codeWithoutSpec;
  L.push(`orphanCodeWithoutSpec[${orphanCode.length}]:`);
  for (const p of orphanCode) L.push(`  ${p}`);
  L.push('');

  const orphanSpec = index.orphans.specWithoutCode;
  L.push(`orphanSpecWithoutCode[${orphanSpec.length}]:`);
  for (const p of orphanSpec) L.push(`  ${p}`);
  L.push('');

  return L.join('\n');
}

export function parseDCI(content: string): DCIIndex {
  const index: DCIIndex = {
    version: '1',
    generatedAt: '',
    projectRoot: '',
    codeToDesign: {},
    designToCode: {},
    orphans: { codeWithoutSpec: [], specWithoutCode: [] },
  };
  const lines = content.split('\n');
  let section = '';
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '') { section = ''; continue; }

    // Table headers with columns
    const tbl = parseTableHeader(line);
    if (tbl) { section = tbl.name; continue; }

    // List headers without columns
    const lst = parseListHeader(line);
    if (lst) { section = lst.name; continue; }

    // Indented row = table/list data
    if (line.startsWith('  ') && section) {
      const trimmed = line.trim();
      if (section === 'codeToDesign') {
        const cells = splitRow(trimmed);
        if (cells.length >= 2) {
          index.codeToDesign[cells[0]] = {
            specs: cells[1] ? cells[1].split(';').filter(Boolean) : [],
            layer1: cells[2] ?? '',
          };
        }
      } else if (section === 'designToCode') {
        const cells = splitRow(trimmed);
        if (cells.length >= 2) {
          index.designToCode[cells[0]] = {
            implementedBy: cells[1] ? cells[1].split(';').filter(Boolean) : [],
            testedBy: cells[2] ? cells[2].split(';').filter(Boolean) : [],
            layer1: cells[3] ?? '',
          };
        }
      } else if (section === 'orphanCodeWithoutSpec') {
        index.orphans.codeWithoutSpec.push(trimmed);
      } else if (section === 'orphanSpecWithoutCode') {
        index.orphans.specWithoutCode.push(trimmed);
      }
      continue;
    }

    // Key-value pairs
    const kv = parseKV(line);
    if (kv) {
      const [k, v] = kv;
      if (k === 'version') index.version = v;
      else if (k === 'updatedAt') index.generatedAt = v;
      else if (k === 'projectRoot') index.projectRoot = v;
    }
  }
  return index;
}
