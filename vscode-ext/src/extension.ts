import * as vscode from 'vscode';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const logTerminals = new Map<string, vscode.Terminal>();

export function activate(context: vscode.ExtensionContext) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;

  const root = folders[0].uri.fsPath;
  const signalPattern = new vscode.RelativePattern(
    join(root, '.agent'),
    'log-pane.signal',
  );

  const watcher = vscode.workspace.createFileSystemWatcher(signalPattern);
  watcher.onDidChange((uri) => handleSignal(root, uri.fsPath));
  watcher.onDidCreate((uri) => handleSignal(root, uri.fsPath));

  vscode.window.onDidCloseTerminal((t) => {
    for (const [id, term] of logTerminals) {
      if (term === t) {
        logTerminals.delete(id);
        break;
      }
    }
  });

  context.subscriptions.push(watcher);
}

function handleSignal(root: string, signalPath: string) {
  if (!existsSync(signalPath)) return;

  try {
    const content = readFileSync(signalPath, 'utf-8').trim();
    const signal = JSON.parse(content);
    const id: string = signal.id || 'default';

    if (signal.action === 'open') {
      openLogPane(root, id, signal.logFile || '.agent/delegate-work.log');
    } else if (signal.action === 'close') {
      closeLogPane(id);
    } else if (signal.action === 'close-all') {
      closeAllLogPanes();
    }
  } catch {
    // ignore parse errors
  }
}

async function openLogPane(_root: string, id: string, _logFile: string) {
  closeLogPane(id);

  const watchCmd = 'node .agent/log-watcher.js';

  // Split from active terminal
  const parent = vscode.window.activeTerminal
    ?? vscode.window.terminals.find((t) => !t.name.startsWith('Worker:'));

  if (parent) {
    parent.show(false);
    await vscode.commands.executeCommand('workbench.action.terminal.split');
    await new Promise((r) => setTimeout(r, 600));
    const term = vscode.window.activeTerminal;
    if (term && term !== parent) {
      term.sendText(watchCmd);
      logTerminals.set(id, term);
      // Rename terminal
      await vscode.commands.executeCommand('workbench.action.terminal.renameWithArg', { name: `Worker: ${id}` });
    }
  } else {
    const term = vscode.window.createTerminal({
      name: `Worker: ${id}`,
      location: vscode.TerminalLocation.Panel,
    });
    term.show(true);
    term.sendText(watchCmd);
    logTerminals.set(id, term);
  }
}

function closeLogPane(id: string) {
  const term = logTerminals.get(id);
  if (term) {
    term.dispose();
    logTerminals.delete(id);
  }
}

function closeAllLogPanes() {
  for (const term of logTerminals.values()) {
    term.dispose();
  }
  logTerminals.clear();
}

export function deactivate() {
  closeAllLogPanes();
}
