/**
 * ワークフロー残存阻害要因C1-C3修正 検証テスト
 * @spec docs/workflows/ワ-クフロ-残存阻害要因C1-C3修正/test-design.md
 *
 * TDD Red-Green: 修正前は失敗、修正後は成功する
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const HOOKS_DIR = path.resolve(__dirname, '../../../workflow-plugin/hooks');
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
    console.log('[PASS] ' + name);
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message });
    console.log('[FAIL] ' + name + ': ' + e.message);
  }
}

// ファイル内容を読み込み（CRLF正規化）
function readHook(filename) {
  const filePath = path.join(HOOKS_DIR, filename);
  return fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
}

const enforceContent = readHook('enforce-workflow.js');
const bashContent = readHook('bash-whitelist.js');
const phaseEditContent = readHook('phase-edit-guard.js');

// TC-1: PHASE_EXTENSIONSにdocs_updateエントリが存在する
test('TC-1: PHASE_EXTENSIONS has docs_update entry', function() {
  assert.ok(
    enforceContent.includes("'docs_update'") || enforceContent.includes('"docs_update"'),
    'docs_update key should exist in PHASE_EXTENSIONS'
  );
  assert.ok(
    enforceContent.includes("'.md'") || enforceContent.includes('".md"'),
    'docs_update should include .md extension'
  );
  assert.ok(
    enforceContent.includes("'.mdx'") || enforceContent.includes('".mdx"'),
    'docs_update should include .mdx extension'
  );
});

// TC-2: PHASE_EXTENSIONSにci_verificationエントリが存在する
test('TC-2: PHASE_EXTENSIONS has ci_verification entry', function() {
  assert.ok(
    enforceContent.includes("'ci_verification'") || enforceContent.includes('"ci_verification"'),
    'ci_verification key should exist in PHASE_EXTENSIONS'
  );
});

// TC-3a: BASH_BLACKLISTにregex型パターンが存在する
test('TC-3a: BASH_BLACKLIST has regex type entry', function() {
  assert.ok(
    bashContent.includes("type: 'regex'") || bashContent.includes('type: "regex"'),
    'BASH_BLACKLIST should contain a regex type entry'
  );
});

// TC-3b: matchesBlacklistEntryにregex caseが存在する
test('TC-3b: matchesBlacklistEntry has regex case', function() {
  assert.ok(
    bashContent.includes("case 'regex'") || bashContent.includes('case "regex"'),
    'matchesBlacklistEntry switch should have regex case'
  );
  assert.ok(
    bashContent.includes('.test(command)') || bashContent.includes('.test('),
    'regex case should use .test() method'
  );
});

// TC-3c: アロー関数がブラックリスト検出されないことの検証
test('TC-3c: Arrow functions not blocked by redirect pattern', function() {
  // contains型の '> ' パターンが残っていないことを確認
  // regex型に変更されていれば、contains型の '> ' は存在しない
  const lines = bashContent.split('\n');
  let hasContainsRedirect = false;
  for (const line of lines) {
    if (line.includes("pattern: '> '") && line.includes("type: 'contains'")) {
      hasContainsRedirect = true;
    }
    if (line.includes('pattern: "> "') && line.includes('type: "contains"')) {
      hasContainsRedirect = true;
    }
  }
  assert.ok(
    !hasContainsRedirect,
    'Redirect pattern "> " should NOT use contains type (should be regex)'
  );
});

// TC-4a: PHASE_RULESにregression_testエントリが存在する
test('TC-4a: PHASE_RULES has regression_test entry', function() {
  // regression_testがPHASE_RULESオブジェクト内に定義されているか確認
  const regTestMatch = phaseEditContent.match(/regression_test\s*:\s*\{[\s\S]*?allowed\s*:\s*\[([\s\S]*?)\]/);
  assert.ok(regTestMatch, 'regression_test should exist in PHASE_RULES with allowed array');
  const allowedStr = regTestMatch[1];
  assert.ok(
    allowedStr.includes("'spec'") || allowedStr.includes('"spec"'),
    'regression_test allowed should include spec'
  );
  assert.ok(
    allowedStr.includes("'test'") || allowedStr.includes('"test"'),
    'regression_test allowed should include test'
  );
});

// TC-4b: PHASE_RULESにci_verificationエントリが存在する
test('TC-4b: PHASE_RULES has ci_verification entry', function() {
  const ciMatch = phaseEditContent.match(/ci_verification\s*:\s*\{[\s\S]*?allowed\s*:\s*\[([\s\S]*?)\]/);
  assert.ok(ciMatch, 'ci_verification should exist in PHASE_RULES with allowed array');
  const allowedStr = ciMatch[1];
  assert.ok(
    allowedStr.includes("'spec'") || allowedStr.includes('"spec"'),
    'ci_verification allowed should include spec'
  );
});

// TC-4c: PHASE_RULESにdeployエントリが存在する
test('TC-4c: PHASE_RULES has deploy entry in PHASE_RULES', function() {
  // deployがPHASE_RULESのコンテキストでallowed/blockedを持つことを確認
  const deployMatch = phaseEditContent.match(/deploy\s*:\s*\{[\s\S]*?allowed\s*:\s*\[([\s\S]*?)\][\s\S]*?blocked\s*:\s*\[([\s\S]*?)\]/);
  assert.ok(deployMatch, 'deploy should exist in PHASE_RULES with allowed and blocked arrays');
  const allowedStr = deployMatch[1];
  assert.ok(
    allowedStr.includes("'spec'") || allowedStr.includes('"spec"'),
    'deploy allowed should include spec'
  );
});

// TC-5: 全フックファイルが構文エラーなしでロードできる
test('TC-5: All hook files load without syntax errors', function() {
  // require()でロードして構文エラーがないことを確認
  const enforceModule = require(path.join(HOOKS_DIR, 'enforce-workflow.js'));
  assert.ok(enforceModule !== undefined, 'enforce-workflow.js should load successfully');
  const bashModule = require(path.join(HOOKS_DIR, 'bash-whitelist.js'));
  assert.ok(bashModule !== undefined, 'bash-whitelist.js should load successfully');
  const phaseEditModule = require(path.join(HOOKS_DIR, 'phase-edit-guard.js'));
  assert.ok(phaseEditModule !== undefined, 'phase-edit-guard.js should load successfully');
});

// 結果サマリー
console.log('\n--- Test Results ---');
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log('Passed: ' + passed + '/' + results.length);
console.log('Failed: ' + failed + '/' + results.length);
process.exit(failed > 0 ? 1 : 0);
