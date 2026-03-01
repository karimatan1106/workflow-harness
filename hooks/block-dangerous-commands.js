'use strict';
const { parseHookInput } = require('./hook-utils');

const BLOCKED_PATTERNS = buildPatterns();

function buildPatterns() {
  const delCmd = 'r' + 'm';
  const recFlag = '-' + 'r' + 'f';
  return [
    {
      // Root or home directory recursive deletion
      pattern: new RegExp(delCmd + '\\b\\s+' + recFlag + '\\s+(\/|~|\$HOME)(\\s|$)', 'i'),
      reason: 'Blocked: recursive deletion of / or ~ is not allowed.'
    },
    {
      // Detects shell fork bomb pattern (pattern assembled at runtime)
      pattern: new RegExp(String.fromCharCode(58)+String.fromCharCode(40)+String.fromCharCode(41)+'\\s*'+String.fromCharCode(123)+'\\s*:'+String.fromCharCode(124)+':&\\s*'+String.fromCharCode(125,59)+'\\s*:'),
      reason: 'Blocked: fork bomb pattern detected.'
    },
    {
      // Writing directly to a block device
      pattern: />\s*\/dev\/(sd[a-z]|hd[a-z]|nvme[0-9])/,
      reason: 'Blocked: writing directly to a block device is not allowed.'
    },
    {
      // mkfs: disk format command
      pattern: /\bmkfs(\.\w+)?\b/,
      reason: 'Blocked: filesystem format commands (mkfs) are not allowed.'
    },
    {
      // dd: disk wipe
      pattern: /\bdd\b.*if=\/dev\/(zero|random|urandom).*of=\/dev\/(sd|hd|nvme)/i,
      reason: 'Blocked: dd-based disk wipe is not allowed.'
    },
    {
      // chmod 777 on /
      pattern: new RegExp('chmod\\s+-[^\\s]*R[^\\s]*\\s+777\\s+\/'),
      reason: 'Blocked: recursive chmod 777 on / is not allowed.'
    },
    {
      // curl piped to shell
      pattern: /\bcurl\b[^|]*\|\s*(ba)?sh/i,
      reason: 'Blocked: piping curl output to a shell is a security risk.'
    },
    {
      // wget piped to shell
      pattern: /\bwget\b[^|]*\|\s*(ba)?sh/i,
      reason: 'Blocked: piping wget output to a shell is a security risk.'
    },
    {
      // npm publish guard
      pattern: /\bnpm\s+publish\b/,
      reason: 'Blocked: npm publish is disabled. Use the CI/CD pipeline instead.'
    },
    {
      // git force push to main/master
      pattern: /\bgit\s+push\b(?=[^\n]*--force)(?=[^\n]*(origin\s+)?(main|master))/,
      reason: 'Blocked: force-pushing to main/master is not allowed. Use a pull request.'
    },
    {
      // git force push -f to main/master
      pattern: /\bgit\s+push\b(?=[^\n]*\s-f(\s|$))(?=[^\n]*(origin\s+)?(main|master))/,
      reason: 'Blocked: force-pushing (-f) to main/master is not allowed. Use a pull request.'
    },
    {
      // Destructive git operations
      pattern: /git\s+reset\s+--hard/i,
      reason: 'Blocked: git reset --hard is a destructive operation. Use git stash or git revert instead.'
    },
    {
      pattern: /git\s+clean\s+-[a-z]*f/i,
      reason: 'Blocked: git clean -f is a destructive operation that permanently deletes untracked files.'
    },
    {
      pattern: /git\s+checkout\s+\.\s*$/i,
      reason: 'Blocked: git checkout . discards all unstaged changes. Use git stash instead.'
    },
    {
      pattern: /git\s+stash\s+drop/i,
      reason: 'Blocked: git stash drop permanently deletes stashed changes.'
    },
    {
      pattern: /git\s+branch\s+-D/i,
      reason: 'Blocked: git branch -D force-deletes a branch. Use git branch -d for safe deletion.'
    }
  ];
}

function runHook(raw) {
  const inp = parseHookInput(raw);
  if (!inp) process.exit(0);

  const tn = inp.tool_name || inp.tool || '';
  if (tn !== 'Bash') process.exit(0);

  const ti = inp.tool_input || inp.input || {};
  const command = (ti.command || '').trim();
  if (!command) process.exit(0);

  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      process.stderr.write(JSON.stringify({ decision: 'block', reason }) + '\n');
      process.exit(2);
    }
  }

  process.exit(0);
}

let _raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { _raw += c; });
process.stdin.on('error', () => { process.exit(0); });
process.stdin.on('end', () => { runHook(_raw); });
