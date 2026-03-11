'use strict';
const fs = require('fs');
const path = require('path');
const { findProjectRoot, readStdin } = require('./hook-utils');

const THRESHOLD = 30;
const REREAD_LIMIT = 3;
const EDIT_THRESHOLD = 10;
const CHECKPOINT_MAX_AGE_MS = 10 * 60 * 1000;

function agentDir(root) { return path.join(root, '.agent'); }
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function readCounter(filePath) {
  try { return parseInt(fs.readFileSync(filePath, 'utf8').trim(), 10) || 0; }
  catch (_) { return 0; }
}

function readFileIfExists(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch (_) { return null; }
}

function fileAge(filePath) {
  try { return Date.now() - fs.statSync(filePath).mtimeMs; }
  catch (_) { return Infinity; }
}

function appendLine(filePath, line) {
  try { fs.appendFileSync(filePath, line + '\n'); } catch (_) {}
}

function injectCritical(root, count) {
  const critical = readFileIfExists(path.join(agentDir(root), 'CRITICAL.toon'));
  if (!critical) return;
  const checkpoint = readFileIfExists(path.join(agentDir(root), 'checkpoint.toon'));
  let out = '\n=== [WATCHDOG] 定期記憶リフレッシュ (' + count + '回目) ===\n';
  out += critical + '\n';
  out += '[WATCHDOG:VERIFY] 上記ルールを確認。次のツール呼び出しで遵守:\n';
  out += '  □ TOON ファイル名はハイフン区切り\n';
  out += '  □ decisions[] は5件以上\n';
  out += '  □ ## 直下に5行以上の prose\n';
  out += '  □ サブエージェント起動時は CRITICAL.toon をプロンプトに含める\n';
  if (checkpoint) {
    out += '\n--- [WATCHDOG:CHECKPOINT] 最後に記録した作業状態 ---\n';
    out += checkpoint + '\n--- [/WATCHDOG:CHECKPOINT] ---\n';
  }
  out += '=== [/WATCHDOG] ===\n';
  process.stdout.write(out);
}

function checkDuplicateRead(root, filePath) {
  const logFile = path.join(agentDir(root), '.file-read-log');
  ensureDir(agentDir(root));
  appendLine(logFile, filePath);
  const log = readFileIfExists(logFile) || '';
  const count = log.split('\n').filter(l => l === filePath).length;
  if (count >= REREAD_LIMIT) {
    const name = path.basename(filePath);
    process.stdout.write(
      '\n[WATCHDOG] 同一ファイルを' + count + '回読み込み: ' + name + '\n'
      + '[WATCHDOG] コンテキスト圧縮による記憶喪失の可能性。\n'
      + '[WATCHDOG] harness_status を呼び出して現在地を確認してください。\n\n'
    );
  }
}

function checkCheckpoint(root, editCount) {
  if (editCount % EDIT_THRESHOLD !== 0) return false;
  const cpFile = path.join(agentDir(root), 'checkpoint.toon');
  const needsCheckpoint = !fs.existsSync(cpFile) || fileAge(cpFile) > CHECKPOINT_MAX_AGE_MS;
  if (!needsCheckpoint) return false;

  process.stdout.write(
    '\n=== [WATCHDOG:CHECKPOINT-REQUIRED] ===\n'
    + 'Write/Edit が ' + editCount + ' 回実行されました。\n'
    + 'チェックポイントが古いか存在しません。\n\n'
    + '.agent/checkpoint.toon に以下のTOON形式で書き出してください:\n'
    + '  task: タスク名\n'
    + '  phase: 現在のフェーズ名\n'
    + '  done[N]{item}: 完了した作業を列挙\n'
    + '  next[N]{item}: 次にやることを列挙\n\n'
    + 'チェックポイントを書いてから作業を続行してください。\n'
    + '=== [/WATCHDOG:CHECKPOINT-REQUIRED] ===\n'
  );
  return true; // block
}

function checkPitfalls(input) {
  const content = JSON.stringify(input);
  const warnings = [];
  if (content.includes('.toon') && content.includes('\\|')) {
    warnings.push('[WATCHDOG:PITFALL] TOON にバックスラッシュ検出。エスケープ扱いされます。');
  }
  if (/scope_definition\.toon|test_design\.toon|test_selection\.toon/.test(content)) {
    warnings.push('[WATCHDOG:PITFALL] TOON ファイル名がアンダースコア区切り。ハイフン区切りにしてください。');
  }
  if ((content.includes('docs/workflows/') || content.includes('docs\\workflows\\'))
      && /未定[^義]|未確定|要検討|検討中|対応予定/.test(content)) {
    warnings.push('[WATCHDOG:PITFALL] 禁止語が含まれている可能性。');
  }
  if (warnings.length > 0) process.stdout.write('\n' + warnings.join('\n') + '\n');
}

function injectSubagentKnowledge(root) {
  const critical = readFileIfExists(path.join(agentDir(root), 'CRITICAL.toon'));
  if (!critical) return;
  process.stdout.write(
    '\n=== [WATCHDOG:SUBAGENT] サブエージェントに以下の知識を必ず伝達 ===\n'
    + critical + '\n'
    + '[WATCHDOG:SUBAGENT] 上記を prompt パラメータに含めること。\n'
    + '=== [/WATCHDOG:SUBAGENT] ===\n'
  );
}

async function runHook() {
  const raw = await readStdin();
  let inp;
  try { inp = JSON.parse(raw); } catch (_) { process.exit(0); }

  const tn = inp.tool_name || inp.tool || '';
  const ti = inp.tool_input || inp.input || {};
  const root = findProjectRoot();
  const ad = agentDir(root);
  ensureDir(ad);

  // 1. Global tool call counter
  const counterFile = path.join(ad, '.watchdog-counter');
  const count = readCounter(counterFile) + 1;
  fs.writeFileSync(counterFile, String(count));
  if (count % THRESHOLD === 0) injectCritical(root, count);

  // 2. Duplicate read detection
  if (tn === 'Read' || tn === 'read') {
    const fp = ti.file_path || ti.path || '';
    if (fp) checkDuplicateRead(root, fp);
  }

  // 3. Write/Edit: checkpoint enforcement + pitfall detection
  if (tn === 'Write' || tn === 'write' || tn === 'Edit' || tn === 'edit') {
    const targetPath = ti.file_path || ti.path || '';
    const isCheckpoint = targetPath && targetPath.includes('checkpoint.toon');

    if (!isCheckpoint) {
      const editCounterFile = path.join(ad, '.edit-counter');
      const editCount = readCounter(editCounterFile) + 1;
      fs.writeFileSync(editCounterFile, String(editCount));
      if (checkCheckpoint(root, editCount)) process.exit(2);
    }
    checkPitfalls(inp);
  }

  // 4. Subagent knowledge injection
  if (tn === 'Agent' || tn === 'agent' || tn === 'Task') {
    injectSubagentKnowledge(root);
  }

  process.exit(0);
}

runHook();
