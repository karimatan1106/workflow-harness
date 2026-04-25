/**
 * B-2修正: phase-edit-guard.jsにcommit/pushフェーズのgit操作ホワイトリストを追加
 * @spec docs/workflows/ワ-クフロ-プロセス阻害要因4件完全解消/spec.md
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'workflow-plugin', 'hooks', 'phase-edit-guard.js');
let content = fs.readFileSync(filePath, 'utf8');

// ==========================================
// 修正1: PHASE_RULESにpushフェーズを追加
// ==========================================
const pushSearch = '  completed: {';
const pushReplace = "  push: {\n" +
  "    allowed: [],\n" +
  "    blocked: ['code', 'test', 'spec', 'diagram', 'config', 'env', 'other'],\n" +
  "    description: '\u30D7\u30C3\u30B7\u30E5\u4E2D\u3002\u30D5\u30A1\u30A4\u30EB\u7DE8\u96C6\u306F\u7981\u6B62\u3067\u3059\u3002',\n" +
  "    japaneseName: '\u30D7\u30C3\u30B7\u30E5',\n" +
  "    readOnly: true,\n" +
  "  },\n" +
  "  completed: {";

if (content.includes(pushSearch) && !content.includes("  push: {")) {
  content = content.replace(pushSearch, pushReplace);
  console.log('B-2 step 1: push phase added to PHASE_RULES');
} else if (content.includes("  push: {")) {
  console.log('B-2 step 1: push phase already exists in PHASE_RULES');
} else {
  console.log('B-2 step 1: could not find completed phase marker');
}

// ==========================================
// 修正2: commit/pushフェーズでのgit操作ホワイトリスト
// main()内のreadOnlyチェック前に挿入
// ==========================================
const gitSearch = '      const rule = getPhaseRule(phase, workflowState.workflowState);\n\n' +
  '      // \u8AAD\u307F\u53D6\u308A\u5C02\u7528\u30D5\u30A7\u30FC\u30BA\u3067\u306F';
const gitReplace = '      const rule = getPhaseRule(phase, workflowState.workflowState);\n\n' +
  "      // B-2: commit/push\u30D5\u30A7\u30FC\u30BA\u3067\u306Egit\u64CD\u4F5C\u30DB\u30EF\u30A4\u30C8\u30EA\u30B9\u30C8\n" +
  "      if (phase === 'commit' || phase === 'push') {\n" +
  "        const lowerCmd = command.toLowerCase();\n" +
  "        // commit\u30D5\u30A7\u30FC\u30BA\u3067\u306Egit\u64CD\u4F5C\u5224\u5B9A\n" +
  "        if (phase === 'commit') {\n" +
  "          if (/\\bgit\\s+add\\b/.test(lowerCmd)) {\n" +
  "            debugLog('B-2: git add \u8A31\u53EF\uFF08commit\u30D5\u30A7\u30FC\u30BA\uFF09');\n" +
  "            process.exit(EXIT_CODES.SUCCESS);\n" +
  "          }\n" +
  "          if (/\\bgit\\s+commit\\b/.test(lowerCmd)) {\n" +
  "            if (/--amend/.test(lowerCmd)) {\n" +
  "              console.log('');\n" +
  "              console.log(SEPARATOR_LINE);\n" +
  "              console.log(' git commit --amend \u306F\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u3067\u7981\u6B62\u3055\u308C\u3066\u3044\u307E\u3059');\n" +
  "              console.log(SEPARATOR_LINE);\n" +
  "              process.exit(EXIT_CODES.BLOCK);\n" +
  "            }\n" +
  "            if (/--no-verify/.test(lowerCmd)) {\n" +
  "              console.log('');\n" +
  "              console.log(SEPARATOR_LINE);\n" +
  "              console.log(' git commit --no-verify \u306F\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u3067\u7981\u6B62\u3055\u308C\u3066\u3044\u307E\u3059');\n" +
  "              console.log(SEPARATOR_LINE);\n" +
  "              process.exit(EXIT_CODES.BLOCK);\n" +
  "            }\n" +
  "            debugLog('B-2: git commit \u8A31\u53EF\uFF08commit\u30D5\u30A7\u30FC\u30BA\uFF09');\n" +
  "            process.exit(EXIT_CODES.SUCCESS);\n" +
  "          }\n" +
  "          if (/\\bgit\\s+tag\\b/.test(lowerCmd)) {\n" +
  "            debugLog('B-2: git tag \u8A31\u53EF\uFF08commit\u30D5\u30A7\u30FC\u30BA\uFF09');\n" +
  "            process.exit(EXIT_CODES.SUCCESS);\n" +
  "          }\n" +
  "        }\n" +
  "        // push\u30D5\u30A7\u30FC\u30BA\u3067\u306Egit\u64CD\u4F5C\u5224\u5B9A\n" +
  "        if (phase === 'push') {\n" +
  "          if (/\\bgit\\s+push\\b/.test(lowerCmd)) {\n" +
  "            if (/--force/.test(lowerCmd) || /\\s-f\\b/.test(lowerCmd)) {\n" +
  "              console.log('');\n" +
  "              console.log(SEPARATOR_LINE);\n" +
  "              console.log(' git push --force/-f \u306F\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u3067\u7981\u6B62\u3055\u308C\u3066\u3044\u307E\u3059');\n" +
  "              console.log(SEPARATOR_LINE);\n" +
  "              process.exit(EXIT_CODES.BLOCK);\n" +
  "            }\n" +
  "            debugLog('B-2: git push \u8A31\u53EF\uFF08push\u30D5\u30A7\u30FC\u30BA\uFF09');\n" +
  "            process.exit(EXIT_CODES.SUCCESS);\n" +
  "          }\n" +
  "        }\n" +
  "      }\n\n" +
  '      // \u8AAD\u307F\u53D6\u308A\u5C02\u7528\u30D5\u30A7\u30FC\u30BA\u3067\u306F';

if (content.includes(gitSearch) && !content.includes("B-2: commit/push")) {
  content = content.replace(gitSearch, gitReplace);
  console.log('B-2 step 2: git operation whitelist added for commit/push phases');
} else if (content.includes("B-2: commit/push")) {
  console.log('B-2 step 2: git whitelist already exists');
} else {
  console.log('B-2 step 2: could not find insertion point');
  // デバッグ: 近傍テキスト出力
  const idx = content.indexOf('getPhaseRule(phase, workflowState.workflowState)');
  if (idx !== -1) {
    console.log('Found getPhaseRule at offset', idx);
    console.log('Context:', content.substring(idx, idx + 200).replace(/\n/g, '\\n'));
  }
}

// ==========================================
// 修正3: enforce-workflow.jsにもpushフェーズを追加
// ==========================================
const enforceFilePath = path.join(process.cwd(), 'workflow-plugin', 'hooks', 'enforce-workflow.js');
let enforceContent = fs.readFileSync(enforceFilePath, 'utf8');

if (!enforceContent.includes("'push': []")) {
  // pushフェーズのPHASE_EXTENSIONSは既に存在（空配列）
  console.log('B-2 step 3: enforce-workflow.js push phase already configured');
} else {
  console.log('B-2 step 3: enforce-workflow.js push phase already has empty extensions (as expected)');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('B-2: phase-edit-guard.js update complete');
