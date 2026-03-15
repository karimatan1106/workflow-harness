'use strict';
const fs = require('fs');
const path = require('path');
const { findProjectRoot, readStdin } = require('./hook-utils');

const MARKER_STALE_MS = 30 * 60 * 1000;

const END_KEYWORDS = [
  '終わり', 'おわり', '終了', 'ありがとう', 'また今', 'また明',
  'お疲れ', 'おつかれ', 'bye', 'quit', 'exit', 'done for today',
  'wrap up', 'closing'
];

function agentDir(root) { return path.join(root, '.agent'); }
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function readFileIfExists(fp) {
  try { return fs.readFileSync(fp, 'utf8'); } catch (_) { return null; }
}

function validateHandoff(content) {
  const errors = [];
  const required = [
    '## 使用ツール', '## 現在のタスクと進捗', '## 試したこと・結果',
    '## ハーネス運用で学んだこと', '## 次のセッションで最初にやること', '## 注意点・ブロッカー'
  ];
  for (const s of required) {
    if (!content.includes(s)) errors.push('欠落: ' + s);
  }
  const contentLines = content.split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---')).length;
  if (contentLines < 10) errors.push('内容が少なすぎます (' + contentLines + '行)');
  if (content.includes('タスク名：現在の状況')) errors.push('テンプレートの例文がそのまま');
  return errors;
}

function injectHandoff(root) {
  const ad = agentDir(root);
  const handoffFile = path.join(ad, 'handoff', 'HANDOFF.toon');
  const markerFile = path.join(ad, '.handoff-session-marker');

  const handoff = readFileIfExists(handoffFile);
  if (!handoff) return;

  let shouldInject = false;
  if (!fs.existsSync(markerFile)) {
    shouldInject = true;
  } else {
    try {
      const age = Date.now() - fs.statSync(markerFile).mtimeMs;
      if (age > MARKER_STALE_MS) shouldInject = true;
    } catch (_) { shouldInject = true; }
  }

  if (!shouldInject) return;

  let out = '\n=== [HANDOFF] 前回セッションの引き継ぎ情報 ===\n';
  out += handoff + '\n';

  const errors = validateHandoff(handoff);
  if (errors.length > 0) {
    out += '[HANDOFF:WARNING] 引き継ぎ情報に品質問題:\n';
    for (const e of errors) out += '  - ' + e + '\n';
    out += '[HANDOFF:WARNING] /handoff で再作成を検討してください。\n\n';
  }

  out += '=== [/HANDOFF] 上記を踏まえて作業を継続してください ===\n';
  process.stdout.write(out);

  // Reset session state
  ensureDir(ad);
  fs.writeFileSync(markerFile, '');
  try { fs.writeFileSync(path.join(ad, '.watchdog-counter'), '0'); } catch (_) {}
  try { fs.writeFileSync(path.join(ad, '.edit-counter'), '0'); } catch (_) {}
  try { fs.unlinkSync(path.join(ad, '.file-read-log')); } catch (_) {}
}

function checkSessionEnd(userInput) {
  const lower = userInput.toLowerCase();
  for (const kw of END_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      process.stdout.write(
        '\n[SESSION-END] セッション終了前に /handoff を実行して引き継ぎ情報を保存してください。\n'
      );
      return;
    }
  }
}

async function runHook() {
  const raw = await readStdin();
  const root = findProjectRoot();

  injectHandoff(root);

  // UserPromptSubmit stdin may be JSON or plain text
  let userMessage = raw;
  try {
    const parsed = JSON.parse(raw);
    userMessage = parsed.user_message || parsed.message || parsed.content || raw;
  } catch (_) {}
  checkSessionEnd(userMessage);

  process.exit(0);
}

runHook();
