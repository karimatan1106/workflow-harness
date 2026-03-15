import * as vscode from "vscode";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Multiple log panes tracked by ID
const logTerminals = new Map<string, vscode.Terminal>();

export function activate(context: vscode.ExtensionContext) {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders) return;

	const root = folders[0].uri.fsPath;
	const signalPattern = new vscode.RelativePattern(
		join(root, ".agent"),
		"log-pane.signal",
	);

	const watcher = vscode.workspace.createFileSystemWatcher(signalPattern);
	watcher.onDidChange((uri) => handleSignal(root, uri.fsPath));
	watcher.onDidCreate((uri) => handleSignal(root, uri.fsPath));

	// Clean up map when terminals are closed manually
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
		const content = readFileSync(signalPath, "utf-8").trim();
		const signal = JSON.parse(content);
		const id: string = signal.id || "default";

		if (signal.action === "open") {
			openLogPane(root, id, signal.logFile || ".agent/delegate-work.log");
		} else if (signal.action === "close") {
			closeLogPane(id);
		} else if (signal.action === "close-all") {
			closeAllLogPanes();
		}
	} catch {
		// ignore parse errors
	}
}

async function openLogPane(root: string, id: string, logFile: string) {
	// Close existing pane with same ID
	closeLogPane(id);

	const fullPath = join(root, logFile).replace(/\\/g, "/");
	const parent =
		vscode.window.activeTerminal ??
		vscode.window.terminals.find((t) => !t.name.startsWith("Worker:"));

	const wslPath = fullPath.replace(/^([A-Za-z]):/, (_, d: string) => `/mnt/${d.toLowerCase()}`).replace(/\\/g, "/");
	const gitBashPath = fullPath.replace(/^([A-Za-z]):/, (_, d: string) => `/${d.toLowerCase()}`).replace(/\\/g, "/");
	const tailCmd = `tail -f "${wslPath}" 2>/dev/null || tail -f "${gitBashPath}"`;

	if (parent) {
		parent.show(false);
		await vscode.commands.executeCommand("workbench.action.terminal.split", {
			config: {
				name: `Worker: ${id}`,
				shellPath: "C:\\Program Files\\Git\\bin\\bash.exe",
			},
		});
		await new Promise((r) => setTimeout(r, 500));
		const term = vscode.window.activeTerminal;
		if (term) {
			term.sendText(tailCmd);
			logTerminals.set(id, term);
		}
	} else {
		const term = vscode.window.createTerminal({
			name: `Worker: ${id}`,
			location: vscode.TerminalLocation.Panel,
			shellPath: "C:\\Program Files\\Git\\bin\\bash.exe",
		});
		term.show(true);
		term.sendText(tailCmd);
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
