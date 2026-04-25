/**
 * ワークフロー残存阻害要因C1-C3修正スクリプト
 * @spec docs/workflows/ワ-クフロ-残存阻害要因C1-C3修正/spec.md
 *
 * 6件の修正を3つのフックファイルに適用する。
 * C-1: enforce-workflow.js PHASE_EXTENSIONS に docs_update 追加
 * C-2: enforce-workflow.js PHASE_EXTENSIONS に ci_verification 追加
 * C-3: bash-whitelist.js BASH_BLACKLIST のリダイレクトパターンを regex 型に変更
 * H-1a: phase-edit-guard.js PHASE_RULES に regression_test 追加
 * H-1b: phase-edit-guard.js PHASE_RULES に ci_verification 追加
 * H-1c: phase-edit-guard.js PHASE_RULES に deploy 追加
 */
const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(process.cwd(), 'workflow-plugin', 'hooks');
let successCount = 0;
let failCount = 0;

function applyFix(label, filePath, searchStr, replaceStr) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  if (!content.includes(searchStr)) {
    console.log('[SKIP] ' + label + ': search string not found');
    failCount++;
    return;
  }
  const occurrences = content.split(searchStr).length - 1;
  if (occurrences !== 1) {
    console.log('[SKIP] ' + label + ': search string found ' + occurrences + ' times (expected 1)');
    failCount++;
    return;
  }
  const newContent = content.replace(searchStr, replaceStr);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log('[OK] ' + label);
  successCount++;
}

// === C-1 + C-2: enforce-workflow.js PHASE_EXTENSIONS ===
const enforceFile = path.join(HOOKS_DIR, 'enforce-workflow.js');
applyFix(
  'C-1+C-2: Add docs_update and ci_verification to PHASE_EXTENSIONS',
  enforceFile,
  "  'e2e_test': ['.md', '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'],\n  'commit': [],",
  "  'e2e_test': ['.md', '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'],\n  'docs_update': ['.md', '.mdx'],\n  'ci_verification': ['.md'],\n  'commit': [],"
);

// === C-3a: bash-whitelist.js BASH_BLACKLIST pattern change ===
const bashFile = path.join(HOOKS_DIR, 'bash-whitelist.js');
applyFix(
  'C-3a: Change redirect pattern from contains to regex',
  bashFile,
  "  { pattern: '> ', type: 'contains' },",
  "  { pattern: /(?<!=)> /, type: 'regex' },"
);

// === C-3b: bash-whitelist.js matchesBlacklistEntry regex case ===
applyFix(
  'C-3b: Add regex case to matchesBlacklistEntry',
  bashFile,
  "    case 'contains':\n      // 部分一致（コマンド全体で検査）\n      return command.includes(entry.pattern);",
  "    case 'regex':\n      return entry.pattern.test(command);\n\n    case 'contains':\n      // 部分一致（コマンド全体で検査）\n      return command.includes(entry.pattern);"
);

// === H-1a + H-1b + H-1c: phase-edit-guard.js PHASE_RULES ===
const phaseEditFile = path.join(HOOKS_DIR, 'phase-edit-guard.js');
applyFix(
  'H-1a+H-1b+H-1c: Add regression_test, ci_verification, deploy to PHASE_RULES',
  phaseEditFile,
  "    japaneseName: '\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8\u66F4\u65B0',\n  },\n  commit: {",
  "    japaneseName: '\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8\u66F4\u65B0',\n  },\n  regression_test: {\n    allowed: ['spec', 'test'],\n    blocked: ['code', 'diagram', 'config', 'env', 'other'],\n    description: '\u30EA\u30B0\u30EC\u30C3\u30B7\u30E7\u30F3\u30C6\u30B9\u30C8\u4E2D\u3002\u30C6\u30B9\u30C8\u30D5\u30A1\u30A4\u30EB\u3068\u4ED5\u69D8\u66F8\u306E\u7DE8\u96C6\u304C\u53EF\u80FD\u3002',\n    japaneseName: '\u30EA\u30B0\u30EC\u30C3\u30B7\u30E7\u30F3\u30C6\u30B9\u30C8',\n  },\n  ci_verification: {\n    allowed: ['spec'],\n    blocked: ['code', 'test', 'diagram', 'config', 'env', 'other'],\n    description: 'CI\u691C\u8A3C\u4E2D\u3002\u4ED5\u69D8\u66F8\u306E\u307F\u7DE8\u96C6\u53EF\u80FD\u3002',\n    japaneseName: 'CI\u691C\u8A3C',\n  },\n  deploy: {\n    allowed: ['spec'],\n    blocked: ['code', 'test', 'diagram', 'config', 'env', 'other'],\n    description: '\u30C7\u30D7\u30ED\u30A4\u4E2D\u3002\u4ED5\u69D8\u66F8\u306E\u307F\u7DE8\u96C6\u53EF\u80FD\u3002',\n    japaneseName: '\u30C7\u30D7\u30ED\u30A4',\n  },\n  commit: {"
);

console.log('\n--- Fix Results ---');
console.log('Success: ' + successCount + '/4');
console.log('Failed: ' + failCount + '/4');
if (failCount > 0) {
  process.exit(1);
}
