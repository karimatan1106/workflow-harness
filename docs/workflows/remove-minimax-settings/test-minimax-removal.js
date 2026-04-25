#!/usr/bin/env node
// Tests for MiniMax removal — TC-AC1-01..TC-AC5-01
const fs = require('fs');

const targets = [
  {
    id: 'TC-AC1-01',
    ac: 'AC-1',
    file: 'C:/ツール/Workflow/CLAUDE.md',
    kind: 'patternAbsent',
    pattern: /## workflow-harness\/\.claude\/settings\.json 注意事項/,
  },
  {
    id: 'TC-AC2-01',
    ac: 'AC-2',
    file: 'C:/Users/owner/.claude/projects/C------Workflow/memory/feedback/feedback_no-minimax.md',
    kind: 'fileAbsent',
  },
  {
    id: 'TC-AC3-01',
    ac: 'AC-3',
    file: 'C:/Users/owner/.claude/projects/C------Workflow/memory/MEMORY.md',
    kind: 'patternAbsent',
    pattern: /feedback_no-minimax/,
  },
  {
    id: 'TC-AC4-01',
    ac: 'AC-4',
    file: 'C:/Users/owner/.claude/projects/C------Workflow/memory/patterns/canboluk.md',
    kind: 'patternAbsent',
    pattern: /MiniMax/,
  },
];

let failed = 0;
const results = [];

for (const t of targets) {
  if (t.kind === 'fileAbsent') {
    if (fs.existsSync(t.file)) {
      results.push(`FAIL ${t.id} (${t.ac}): file still exists at ${t.file}`);
      failed++;
    } else {
      results.push(`PASS ${t.id} (${t.ac}): file absent`);
    }
  } else if (t.kind === 'patternAbsent') {
    if (!fs.existsSync(t.file)) {
      results.push(`FAIL ${t.id} (${t.ac}): target file missing`);
      failed++;
      continue;
    }
    const content = fs.readFileSync(t.file, 'utf-8');
    if (t.pattern.test(content)) {
      results.push(`FAIL ${t.id} (${t.ac}): pattern still present`);
      failed++;
    } else {
      results.push(`PASS ${t.id} (${t.ac}): pattern absent`);
    }
  }
}

// TC-AC5-01: Integrated 4-file grep for any MiniMax keyword
const integratedFiles = [
  'C:/ツール/Workflow/CLAUDE.md',
  'C:/Users/owner/.claude/projects/C------Workflow/memory/feedback/feedback_no-minimax.md',
  'C:/Users/owner/.claude/projects/C------Workflow/memory/MEMORY.md',
  'C:/Users/owner/.claude/projects/C------Workflow/memory/patterns/canboluk.md',
];
const combined = integratedFiles
  .filter(f => fs.existsSync(f))
  .map(f => fs.readFileSync(f, 'utf-8'))
  .join('\n');
if (/minimax|m2\.7|ミニマックス/i.test(combined)) {
  results.push('FAIL TC-AC5-01 (AC-5): MiniMax keyword found in at least one target file');
  failed++;
} else {
  results.push('PASS TC-AC5-01 (AC-5): no MiniMax keyword in any target file');
}

console.log(results.join('\n'));
console.log(`\nTotal: ${results.length}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
