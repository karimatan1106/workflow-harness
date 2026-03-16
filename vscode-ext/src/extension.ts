import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const panes = new Map<string, vscode.Terminal>();
let watcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
	const ws = vscode.workspace.workspaceFolders?.[0];
	if (!ws) return;

	const signalPath = path.join(ws.uri.fsPath, ".agent", "log-pane.signal");
	const pattern = new vscode.RelativePattern(
		vscode.Uri.file(path.join(ws.uri.fsPath, ".agent")),
		"log-pane.signal",
	);
	watcher = vscode.workspace.createFileSystemWatcher(pattern);

	const handle = () => {
		try {
			const raw = fs.readFileSync(signalPath, "utf8").trim();
			if (!raw) return;
			const sig = JSON.parse(raw);
			if (sig.action === "open" && sig.id && sig.logFile)
				openLogPane(sig.id, sig.logFile);
			else if (sig.action === "close" && sig.id) closeLogPane(sig.id);
			else if (sig.action === "close-all") {
				for (const [id] of panes) closeLogPane(id);
			}
		} catch {}
	};

	watcher.onDidChange(handle);
	watcher.onDidCreate(handle);
	context.subscriptions.push(watcher);

	// Clean up panes map when terminal is closed externally
	context.subscriptions.push(
		vscode.window.onDidCloseTerminal((t) => {
			for (const [id, term] of panes) {
				if (term === t) {
					panes.delete(id);
					break;
				}
			}
		}),
	);
}

function openLogPane(id: string, logFile: string) {
	if (panes.has(id)) return;

	const active = vscode.window.activeTerminal;
	const terminal = vscode.window.createTerminal({
		name: "Worker " + id,
		env: { FORCE_COLOR: "1" },
		location: active
			? { parentTerminal: active }
			: vscode.TerminalLocation.Panel,
	});
	terminal.sendText("node .agent/log-watcher.js " + logFile + " ; exit");
	panes.set(id, terminal);
}

function closeLogPane(id: string) {
	const t = panes.get(id);
	if (t) {
		t.dispose();
		panes.delete(id);
	}
}

export function deactivate() {
	watcher?.dispose();
	for (const [, t] of panes) t.dispose();
	panes.clear();
}
