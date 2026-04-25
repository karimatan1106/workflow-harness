/**
 * Combined fix script for B-1, B-2, B-3
 * Handles Windows \r\n line endings
 * @spec docs/workflows/ワ-クフロ-プロセス阻害要因4件完全解消/spec.md
 */
const fs = require('fs');
const path = require('path');

function readNormalized(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

// ==========================================
// B-1: discover-tasks.js - taskId descending sort
// ==========================================
function fixB1() {
  const filePath = path.join(process.cwd(), 'workflow-plugin', 'hooks', 'lib', 'discover-tasks.js');
  let content = readNormalized(filePath);

  if (content.includes('B-1:')) {
    console.log('B-1: already applied');
    return;
  }

  const search = '    return tasks;\n  } catch {';
  if (!content.includes(search)) {
    console.log('B-1: ERROR - search text not found even after normalizing');
    // Debug: show what's around "return tasks"
    const idx = content.indexOf('return tasks;');
    if (idx !== -1) {
      console.log('Found "return tasks;" at offset', idx);
      const ctx = content.substring(Math.max(0, idx - 20), idx + 40);
      console.log('Context:', JSON.stringify(ctx));
    }
    return;
  }

  const replace = [
    '    // B-1: taskId descending sort (newest first)',
    '    // taskId is YYYYMMDD_HHMMSS format, string comparison preserves chronological order',
    "    tasks.sort((a, b) => (b.taskId || '').localeCompare(a.taskId || ''));",
    '',
    '    return tasks;',
    '  } catch {',
  ].join('\n');

  content = content.replace(search, replace);
  writeFile(filePath, content);
  console.log('B-1: discover-tasks.js updated - taskId descending sort added');
}

// ==========================================
// B-2: phase-edit-guard.js - push phase + git whitelist
// ==========================================
function fixB2() {
  const filePath = path.join(process.cwd(), 'workflow-plugin', 'hooks', 'phase-edit-guard.js');
  let content = readNormalized(filePath);

  // Step 1: Add push phase to PHASE_RULES
  if (!content.includes('  push: {')) {
    const completedSearch = '  completed: {';
    const pushPhase = "  push: {\n" +
      "    allowed: [],\n" +
      "    blocked: ['code', 'test', 'spec', 'diagram', 'config', 'env', 'other'],\n" +
      "    description: '\u30D7\u30C3\u30B7\u30E5\u4E2D\u3002\u30D5\u30A1\u30A4\u30EB\u7DE8\u96C6\u306F\u7981\u6B62\u3067\u3059\u3002',\n" +
      "    japaneseName: '\u30D7\u30C3\u30B7\u30E5',\n" +
      "    readOnly: true,\n" +
      "  },\n" +
      "  completed: {";

    if (content.includes(completedSearch)) {
      content = content.replace(completedSearch, pushPhase);
      console.log('B-2 step 1: push phase added to PHASE_RULES');
    } else {
      console.log('B-2 step 1: ERROR - completed phase not found');
    }
  } else {
    console.log('B-2 step 1: push phase already exists');
  }

  // Step 2: Add git operation whitelist for commit/push phases
  if (!content.includes('B-2: commit/push')) {
    // Find the second occurrence of getPhaseRule in analyzeBashCommand (line ~1601)
    const searchBlock = "      const rule = getPhaseRule(phase, workflowState.workflowState);\n\n" +
      "      // \u8AAD\u307F\u53D6\u308A\u5C02\u7528\u30D5\u30A7\u30FC\u30BA\u3067\u306F";

    if (content.includes(searchBlock)) {
      const gitWhitelist = "      const rule = getPhaseRule(phase, workflowState.workflowState);\n\n" +
        "      // B-2: commit/push\u30D5\u30A7\u30FC\u30BA\u3067\u306Egit\u64CD\u4F5C\u30DB\u30EF\u30A4\u30C8\u30EA\u30B9\u30C8\n" +
        "      if (phase === 'commit' || phase === 'push') {\n" +
        "        const lowerCmd = command.toLowerCase();\n" +
        "        if (phase === 'commit') {\n" +
        "          if (/\\bgit\\s+add\\b/.test(lowerCmd)) {\n" +
        "            debugLog('B-2: git add allowed (commit phase)');\n" +
        "            process.exit(EXIT_CODES.SUCCESS);\n" +
        "          }\n" +
        "          if (/\\bgit\\s+commit\\b/.test(lowerCmd)) {\n" +
        "            if (/--amend/.test(lowerCmd)) {\n" +
        "              console.log('');\n" +
        "              console.log(SEPARATOR_LINE);\n" +
        "              console.log(' git commit --amend is blocked by workflow');\n" +
        "              console.log(SEPARATOR_LINE);\n" +
        "              process.exit(EXIT_CODES.BLOCK);\n" +
        "            }\n" +
        "            if (/--no-verify/.test(lowerCmd)) {\n" +
        "              console.log('');\n" +
        "              console.log(SEPARATOR_LINE);\n" +
        "              console.log(' git commit --no-verify is blocked by workflow');\n" +
        "              console.log(SEPARATOR_LINE);\n" +
        "              process.exit(EXIT_CODES.BLOCK);\n" +
        "            }\n" +
        "            debugLog('B-2: git commit allowed (commit phase)');\n" +
        "            process.exit(EXIT_CODES.SUCCESS);\n" +
        "          }\n" +
        "          if (/\\bgit\\s+tag\\b/.test(lowerCmd)) {\n" +
        "            debugLog('B-2: git tag allowed (commit phase)');\n" +
        "            process.exit(EXIT_CODES.SUCCESS);\n" +
        "          }\n" +
        "        }\n" +
        "        if (phase === 'push') {\n" +
        "          if (/\\bgit\\s+push\\b/.test(lowerCmd)) {\n" +
        "            if (/--force/.test(lowerCmd) || /\\s-f\\b/.test(lowerCmd)) {\n" +
        "              console.log('');\n" +
        "              console.log(SEPARATOR_LINE);\n" +
        "              console.log(' git push --force/-f is blocked by workflow');\n" +
        "              console.log(SEPARATOR_LINE);\n" +
        "              process.exit(EXIT_CODES.BLOCK);\n" +
        "            }\n" +
        "            debugLog('B-2: git push allowed (push phase)');\n" +
        "            process.exit(EXIT_CODES.SUCCESS);\n" +
        "          }\n" +
        "        }\n" +
        "      }\n\n" +
        "      // \u8AAD\u307F\u53D6\u308A\u5C02\u7528\u30D5\u30A7\u30FC\u30BA\u3067\u306F";

      content = content.replace(searchBlock, gitWhitelist);
      console.log('B-2 step 2: git operation whitelist added');
    } else {
      console.log('B-2 step 2: ERROR - insertion point not found');
      // Debug
      const idx = content.indexOf('getPhaseRule(phase, workflowState.workflowState)');
      if (idx !== -1) {
        // Find the second occurrence (analyzeBashCommand context)
        const idx2 = content.indexOf('getPhaseRule(phase, workflowState.workflowState)', idx + 1);
        if (idx2 !== -1) {
          const ctx = content.substring(idx2, idx2 + 200);
          console.log('Second getPhaseRule context:', JSON.stringify(ctx));
        }
      }
    }
  } else {
    console.log('B-2 step 2: git whitelist already exists');
  }

  writeFile(filePath, content);
  console.log('B-2: phase-edit-guard.js update complete');
}

// ==========================================
// B-3: test-tracking.ts - allow testing phase for baseline
// ==========================================
function fixB3() {
  const filePath = path.join(process.cwd(), 'workflow-plugin', 'mcp-server', 'src', 'tools', 'test-tracking.ts');
  let content = readNormalized(filePath);

  if (!content.includes("taskState.phase !== 'research'")) {
    console.log('B-3: already applied or target not found');
    return;
  }

  // Use line-based approach for robustness
  const lines = content.split('\n');
  const markerIdx = lines.findIndex(l => l.includes("taskState.phase !== 'research'"));
  if (markerIdx === -1) {
    console.log('B-3: ERROR - marker line not found');
    return;
  }

  // Find comment line above (should be markerIdx - 1)
  const commentIdx = markerIdx - 1;
  // Find closing brace
  let endIdx = markerIdx;
  for (let i = markerIdx; i < lines.length; i++) {
    if (lines[i].trim() === '}') {
      endIdx = i;
      break;
    }
  }

  const newLines = [
    "  // B-3: research and testing phases allowed (testing = deferred baseline)",
    "  const baselineAllowedPhases = ['research', 'testing'];",
    '  if (!baselineAllowedPhases.includes(taskState.phase)) {',
    '    return {',
    '      success: false,',
    '      message: `\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\u8A18\u9332\u306Fresearch/testing\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u307F\u53EF\u80FD\u3067\u3059\u3002\u73FE\u5728: ${taskState.phase}`,',
    '    };',
    '  }',
    '',
    '  // Warning log for testing phase baseline recording',
    "  if (taskState.phase === 'testing') {",
    '    console.warn(`[warning] Testing phase baseline recording (deferred baseline) task: ${taskId}`);',
    '    console.warn(`Recommendation: record baseline during research phase in the future`);',
    '  }',
  ];

  lines.splice(commentIdx, endIdx - commentIdx + 1, ...newLines);
  writeFile(filePath, lines.join('\n'));
  console.log('B-3: test-tracking.ts updated - testing phase allowed for baseline');
}

// Execute all fixes
try {
  fixB1();
} catch (e) {
  console.log('B-1 ERROR:', e.message);
}

try {
  fixB2();
} catch (e) {
  console.log('B-2 ERROR:', e.message);
}

try {
  fixB3();
} catch (e) {
  console.log('B-3 ERROR:', e.message);
}

console.log('All fixes attempted.');
