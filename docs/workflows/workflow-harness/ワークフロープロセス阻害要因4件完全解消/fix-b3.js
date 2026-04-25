/**
 * B-3修正: test-tracking.tsのベースライン記録フェーズ制限を緩和
 * researchフェーズのみ → research + testingフェーズで許可
 * @spec docs/workflows/ワ-クフロ-プロセス阻害要因4件完全解消/spec.md
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'workflow-plugin', 'mcp-server', 'src', 'tools', 'test-tracking.ts');
let content = fs.readFileSync(filePath, 'utf8');

// researchフェーズのみの制限を検索
if (!content.includes("taskState.phase !== 'research'")) {
  console.log('B-3: target text not found (may already be applied)');
  process.exit(0);
}

// 旧コード（改行を含む完全一致で置換）
const oldBlock = '  // research\u30D5\u30A7\u30FC\u30BA\u4EE5\u5916\u3067\u306F\u30A8\u30E9\u30FC\n' +
  "  if (taskState.phase !== 'research') {\n" +
  '    return {\n' +
  '      success: false,\n' +
  '      message: `\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\u8A18\u9332\u306Fresearch\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u307F\u53EF\u80FD\u3067\u3059\u3002\u73FE\u5728: ${taskState.phase}`,\n' +
  '    };\n' +
  '  }';

const newBlock = "  // B-3: research\u3068testing\u30D5\u30A7\u30FC\u30BA\u3067\u8A31\u53EF\uFF08testing\u306F\u9045\u5EF6\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\uFF09\n" +
  "  const baselineAllowedPhases = ['research', 'testing'];\n" +
  '  if (!baselineAllowedPhases.includes(taskState.phase)) {\n' +
  '    return {\n' +
  '      success: false,\n' +
  '      message: `\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\u8A18\u9332\u306Fresearch/testing\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u307F\u53EF\u80FD\u3067\u3059\u3002\u73FE\u5728: ${taskState.phase}`,\n' +
  '    };\n' +
  '  }\n' +
  '\n' +
  '  // testing\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u8A18\u9332\u6642\u306F\u8B66\u544A\u30ED\u30B0\u3092\u51FA\u529B\n' +
  "  if (taskState.phase === 'testing') {\n" +
  '    console.warn(`[\u8B66\u544A] testing\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\u8A18\u9332\uFF08\u9045\u5EF6\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\uFF09 \u30BF\u30B9\u30AF: ${taskId}`);\n' +
  '    console.warn(`\u63A8\u5968: \u4ECA\u5F8C\u306Fresearch\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u8A18\u9332\u3092\u63A8\u5968\u3057\u307E\u3059`);\n' +
  '  }';

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('B-3: test-tracking.ts updated - testing phase allowed for baseline');
} else {
  console.log('B-3: exact block not matched, trying line-based approach');
  // フォールバック: 行単位で置換
  const lines = content.split('\n');
  const markerIdx = lines.findIndex(l => l.includes("taskState.phase !== 'research'"));
  if (markerIdx === -1) {
    console.log('B-3: could not find marker line');
    process.exit(1);
  }
  // コメント行を探す (markerIdxの1行前)
  const commentIdx = markerIdx - 1;
  // 閉じ括弧を探す
  let endIdx = markerIdx;
  for (let i = markerIdx; i < lines.length; i++) {
    if (lines[i].trim() === '}') {
      endIdx = i;
      break;
    }
  }
  // 置換
  const newLines = [
    "  // B-3: research\u3068testing\u30D5\u30A7\u30FC\u30BA\u3067\u8A31\u53EF\uFF08testing\u306F\u9045\u5EF6\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\uFF09",
    "  const baselineAllowedPhases = ['research', 'testing'];",
    '  if (!baselineAllowedPhases.includes(taskState.phase)) {',
    '    return {',
    '      success: false,',
    '      message: `\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\u8A18\u9332\u306Fresearch/testing\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u307F\u53EF\u80FD\u3067\u3059\u3002\u73FE\u5728: ${taskState.phase}`,',
    '    };',
    '  }',
    '',
    '  // testing\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u8A18\u9332\u6642\u306F\u8B66\u544A\u30ED\u30B0\u3092\u51FA\u529B',
    "  if (taskState.phase === 'testing') {",
    '    console.warn(`[\u8B66\u544A] testing\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\u8A18\u9332\uFF08\u9045\u5EF6\u30D9\u30FC\u30B9\u30E9\u30A4\u30F3\uFF09 \u30BF\u30B9\u30AF: ${taskId}`);',
    '    console.warn(`\u63A8\u5968: \u4ECA\u5F8C\u306Fresearch\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u8A18\u9332\u3092\u63A8\u5968\u3057\u307E\u3059`);',
    '  }',
  ];
  lines.splice(commentIdx, endIdx - commentIdx + 1, ...newLines);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log('B-3: test-tracking.ts updated via line-based approach');
}
