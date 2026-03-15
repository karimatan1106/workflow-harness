"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs_1 = require("fs");
const path_1 = require("path");
// Multiple log panes tracked by ID
const logTerminals = new Map();
function activate(context) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders)
        return;
    const root = folders[0].uri.fsPath;
    const signalPattern = new vscode.RelativePattern((0, path_1.join)(root, ".agent"), "log-pane.signal");
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
function handleSignal(root, signalPath) {
    if (!(0, fs_1.existsSync)(signalPath))
        return;
    try {
        const content = (0, fs_1.readFileSync)(signalPath, "utf-8").trim();
        const signal = JSON.parse(content);
        const id = signal.id || "default";
        if (signal.action === "open") {
            openLogPane(root, id, signal.logFile || ".agent/delegate-work.log");
        }
        else if (signal.action === "close") {
            closeLogPane(id);
        }
        else if (signal.action === "close-all") {
            closeAllLogPanes();
        }
    }
    catch {
        // ignore parse errors
    }
}
async function openLogPane(root, id, logFile) {
    // Close existing pane with same ID
    closeLogPane(id);
    const fullPath = (0, path_1.join)(root, logFile).replace(/\\/g, "/");
    const parent = vscode.window.activeTerminal ??
        vscode.window.terminals.find((t) => !t.name.startsWith("Worker:"));
    const wslPath = fullPath.replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`).replace(/\\/g, "/");
    const gitBashPath = fullPath.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`).replace(/\\/g, "/");
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
    }
    else {
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
function closeLogPane(id) {
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
function deactivate() {
    closeAllLogPanes();
}
