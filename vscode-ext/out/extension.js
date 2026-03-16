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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const panes = new Map();
let watcher;
function activate(context) {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws)
        return;
    const signalPath = path.join(ws.uri.fsPath, ".agent", "log-pane.signal");
    const pattern = new vscode.RelativePattern(vscode.Uri.file(path.join(ws.uri.fsPath, ".agent")), "log-pane.signal");
    watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const handle = () => {
        try {
            const raw = fs.readFileSync(signalPath, "utf8").trim();
            if (!raw)
                return;
            const sig = JSON.parse(raw);
            if (sig.action === "open" && sig.id && sig.logFile)
                openLogPane(sig.id, sig.logFile);
            else if (sig.action === "close" && sig.id)
                closeLogPane(sig.id);
            else if (sig.action === "close-all") {
                for (const [id] of panes)
                    closeLogPane(id);
            }
        }
        catch { }
    };
    watcher.onDidChange(handle);
    watcher.onDidCreate(handle);
    context.subscriptions.push(watcher);
    // Clean up panes map when terminal is closed externally
    context.subscriptions.push(vscode.window.onDidCloseTerminal((t) => {
        for (const [id, term] of panes) {
            if (term === t) {
                panes.delete(id);
                break;
            }
        }
    }));
}
function openLogPane(id, logFile) {
    if (panes.has(id))
        return;
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
function closeLogPane(id) {
    const t = panes.get(id);
    if (t) {
        t.dispose();
        panes.delete(id);
    }
}
function deactivate() {
    watcher?.dispose();
    for (const [, t] of panes)
        t.dispose();
    panes.clear();
}
