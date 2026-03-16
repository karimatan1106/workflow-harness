/**
 * harness_delegate_work  ESpawn isolated coordinator process for phase work.
 * 3-layer model: Orchestrator ↁEdelegate_work (Coordinator) ↁEAgent (Worker)
 * Coordinator: reads files + MCP ops + delegates file edits to workers via Agent.
 */

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { StateManager } from '../../state/manager.js';
import type { TaskState } from '../../state/types.js';
import {
  buildPhaseGuide,
  respond,
  respondError,
  validateSession,
  type HandlerResult,
} from '../handler-shared.js';
import { getProjectRoot } from '../../utils/project-root.js';

const DEFAULT_DISALLOWED_TOOLS = 'mcp__harness__harness_start,mcp__harness__harness_next,mcp__harness__harness_approve,mcp__harness__harness_status,mcp__harness__harness_back,mcp__harness__harness_reset,mcp__harness__harness_delegate_work,Skill,WebSearch,WebFetch,TodoWrite,NotebookEdit,Agent,EnterPlanMode,ExitPlanMode,EnterWorktree,ExitWorktree,CronCreate,CronDelete,CronList,AskUserQuestion,ToolSearch';

// ─── Phase-aware allowed tools ────────────────────
type PhaseGuide = ReturnType<typeof buildPhaseGuide>;

/**
 * Build --allowedTools list for the coordinator subprocess.
 * Includes Agent because coordinators spawn workers via Agent tool.
 * This differs from writeAllowedToolsFile (manager-lifecycle.ts) which writes
 * .worker-allowed-tools for direct subagents  Ethose do NOT get Agent because
 * workers should not spawn further subagents.
 */
function buildAllowedTools(phaseGuide: PhaseGuide): string {
  const cats = phaseGuide.bashCategories;
  const needsEdit = cats.some(
    (c) => c === 'implementation' || c === 'testing' || c === 'git',
  );
  return needsEdit
    ? 'Agent,Read,Glob,Grep,Write,Edit,Bash'
    : 'Agent,Read,Glob,Grep';
}

// ─── Phase-aware coordinator system prompt ────────
function buildCoordinatorPrompt(task: TaskState, pg: PhaseGuide): string {
  const lines: string[] = [
    'role: coordinator',
    `phase: ${task.phase}`,
    `docs-dir: ${task.docsDir}`,
    `allowed-extensions: ${pg.allowedExtensions.join(', ')}`,
    `output-file: ${task.docsDir}/${task.phase}.toon`,
    'toon-rules: "key: value形式。カンマ含む値は引用符。バチE��スラチE��ュ禁止。ファイル名�Eハイフン区刁E��"',
    'instruction-format: "TOON形式で受信。key: valueペアをパースして作業冁E��を理解すること"',
    'env-vars: "HARNESS_TASK_ID, HARNESS_SESSION_TOKEN�E�環墁E��数から取得！E',
    'worker-delegation: "Agent toolでsubagentに委譲。instructionに具体的なファイルパスと期征E��る変更を含めること"',
    'output-format: "作業結果をTOON形式で返すこと。success: true/false, output: 作業冁E��, files-changed: 変更ファイル一覧"',
  ];
  return lines.join('\n');
}

// ─── MCP config detection ─────────────────────────
function findMcpConfig(): string | undefined {
  const cwd = process.cwd();
  const projectRoot = getProjectRoot();
  const candidates = [join(cwd, '.mcp.json')];
  if (projectRoot !== cwd) {
    candidates.push(join(projectRoot, '.mcp.json'));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return resolve(candidate);
  }
  return undefined;
}

// ─── Log pane signal (VS Code extension) ─────────
let logPaneCounter = 0;

function writeSignal(signalPath: string, data: Record<string, unknown>): void {
  // Delete then recreate to trigger VS Code FileSystemWatcher onDidCreate event
  if (existsSync(signalPath)) {
    unlinkSync(signalPath);
  }
  writeFileSync(signalPath, JSON.stringify(data));
}

function openLogPane(logFile: string): string {
  const id = `worker-${++logPaneCounter}`;
  const projectRoot = getProjectRoot();
  const signalPath = join(projectRoot, '.agent', 'log-pane.signal');
  try {
    writeSignal(signalPath, { action: 'open', id, logFile });
  } catch {
    // best-effort
  }
  return id;
}

function closeLogPane(id: string): void {
  const projectRoot = getProjectRoot();
  const signalPath = join(projectRoot, '.agent', 'log-pane.signal');
  try {
    writeSignal(signalPath, { action: 'close', id });
  } catch {
    // best-effort
  }
}

// ─── Human-readable log formatting ────────────────
function formatTimestamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatContentItem(ts: string, item: Record<string, unknown>): string {
  if (item.type === 'thinking') {
    const chars = typeof item.thinking === 'string' ? (item.thinking as string).length : 0;
    return `[${ts}] thinking... (${chars} chars)
`;
  }
  if (item.type === 'tool_use') {
    const name = String(item.name ?? 'unknown');
    const inputStr = JSON.stringify(item.input ?? {});
    const truncated = inputStr.length > 80 ? inputStr.slice(0, 80) + '...' : inputStr;
    return `[${ts}] tool_use: ${name}(${truncated})
`;
  }
  if (item.type === 'text') {
    const txt = String(item.text ?? '');
    const truncated = txt.length > 80 ? txt.slice(0, 80) + '...' : txt;
    return `[${ts}] text: ${truncated}
`;
  }
  return '';
}

function formatStreamJsonLine(text: string): string {
  const ts = formatTimestamp();
  try {
    const obj = JSON.parse(text);

    if (obj.type === 'system' && obj.subtype === 'init') {
      const model = obj.model ?? 'unknown';
      const tools = Array.isArray(obj.tools) ? obj.tools.length : 0;
      return `[${ts}] init: model=${model}, tools=${tools}
`;
    }

    if (obj.type === 'assistant' && Array.isArray(obj.message?.content)) {
      const lines = (obj.message.content as Record<string, unknown>[])
        .map((item) => formatContentItem(ts, item))
        .filter((l) => l.length > 0);
      return lines.length > 0 ? lines.join('') : `[${ts}] assistant: (empty content)
`;
    }

    if (obj.type === 'user') {
      const content = obj.message?.content;
      if (Array.isArray(content)) {
        for (const item of content as Record<string, unknown>[]) {
          if (item.type === 'tool_result') {
            const output = typeof item.content === 'string'
              ? item.content
              : JSON.stringify(item.content ?? '');
            const truncated = output.length > 80 ? output.slice(0, 80) + '...' : output;
            return `[${ts}] tool_result: ${truncated}
`;
          }
        }
      }
      return `[${ts}] user: (message)
`;
    }

    if (obj.type === 'rate_limit_event') {
      const status = String(obj.status ?? obj.subtype ?? 'unknown');
      return `[${ts}] rate_limit: status=${status}
`;
    }

    if (obj.type === 'result') {
      const result = String(obj.result ?? '');
      const truncated = result.length > 100 ? result.slice(0, 100) + '...' : result;
      return `[${ts}] result: ${truncated}
`;
    }

    const truncated = text.length > 120 ? text.slice(0, 120) + '...' : text;
    return `[${ts}] ${truncated}
`;
  } catch {
    const truncated = text.length > 120 ? text.slice(0, 120) + '...' : text;
    return `[${ts}] ${truncated}
`;
  }
}

// ─── Async spawn wrapper ──────────────────────────
function spawnAsync(
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string | undefined>; logFile?: string },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      process.stderr.write(chunk);
      if (options.logFile) {
        const lines = text.split('\n').filter((l) => l.trim());
        for (const line of lines) {
          appendFileSync(options.logFile, formatStreamJsonLine(line));
        }
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (options.logFile) {
        appendFileSync(options.logFile, text);
      }
    });

    child.on('close', (code: number | null) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Exit code ${code}\nstderr: ${stderr}`));
    });
    child.on('error', (err) => {
      reject(err);
    });
  });
}

// ─── stream-json result extraction ────────────────
/**
 * Parse stream-json (JSON Lines) output from `claude --output-format stream-json`.
 * Each line is a JSON object with a `type` field.
 * We extract the final result text from {type:"result", result:"..."} lines.
 * Falls back to raw stdout if parsing fails.
 */
function extractResultFromStreamJson(stdout: string): string {
  const lines = stdout.split('\n').filter((l) => l.trim());
  // Try to find a "result" type line (last one wins)
  let resultText: string | undefined;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'result' && typeof obj.result === 'string') {
        resultText = obj.result;
      }
    } catch {
      // skip non-JSON lines
    }
  }
  return resultText ?? stdout;
}

// ─── Handler ──────────────────────────────────────
export async function handleDelegateWork(
  args: Record<string, unknown>,
  sm: StateManager,
): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);

  const instruction = String(args.instruction ?? '');
  if (!instruction) return respondError('instruction is required');

  // Phase-aware defaults (Fix #1, #2, #5, #6, #7)
  const phaseGuide = buildPhaseGuide(task.phase);

  const files = args.files as string[] | undefined;

  let fullInstruction = instruction;
  if (files?.length) {
    fullInstruction += '\n\n対象ファイル:\n' + files.map((f: string) => '- ' + f).join('\n');
  }

  // C-3: allowedTools/disallowedTools are server-side enforced, not overridable
  const allowedTools = buildAllowedTools(phaseGuide);
  const disallowedTools = DEFAULT_DISALLOWED_TOOLS;
  // C-4: systemPrompt is server-side enforced, not overridable
  const systemPrompt = buildCoordinatorPrompt(task, phaseGuide);
  const model = args.model ? String(args.model) : phaseGuide.model;
  const addDirs = args.addDirs as string[] | undefined;
  const mcpConfig = args.mcpConfig ? String(args.mcpConfig) : findMcpConfig();

  // Build claude -p command args
  const cmdArgs: string[] = [
    '-p',
    fullInstruction,
    '--print',
    '--verbose',
    '--output-format', 'stream-json',
    '--setting-sources', 'project',
    '--disable-slash-commands',
    '--allowedTools', allowedTools,
    '--permission-mode', 'bypassPermissions',
    '--no-session-persistence',
    '--system-prompt', systemPrompt,
  ];

  if (disallowedTools) {
    cmdArgs.push('--disallowedTools', disallowedTools);
  }

  // MCP config: only for phases that need MCP tools
  const needsMcp = phaseGuide.bashCategories?.some(
    (c: string) => ['implementation', 'testing', 'git'].includes(c)
  ) ?? false;
  if (needsMcp && mcpConfig) {
    cmdArgs.push('--mcp-config', mcpConfig);
  }

  if (model) {
    cmdArgs.push('--model', model);
  }

  if (addDirs?.length) {
    for (const dir of addDirs) {
      cmdArgs.push('--add-dir', dir);
    }
  }

  const projectRoot = getProjectRoot();

  // Initialize log file for coordinator output
  const logFile = join(projectRoot, '.agent', 'delegate-work.log');
  appendFileSync(logFile, `
--- delegate-work session ---
`);
  appendFileSync(logFile, `[${new Date().toISOString()}] delegate-work started: phase=${task.phase}\n`);

  // Fix #3: sessionToken propagation via env
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    HARNESS_SESSION_TOKEN: String(args.sessionToken),
    HARNESS_TASK_ID: taskId,
    HARNESS_LAYER: 'worker',
  };

  // Signal log pane open (VS Code extension watches signal file)
  const paneId = openLogPane('.agent/delegate-work.log');

  // Fix #4: async spawn instead of execSync
  try {
    const startTime = Date.now();
    const { stdout } = await spawnAsync('claude', cmdArgs, {
      cwd: projectRoot,
      env: childEnv,
      logFile,
    });
    const durationMs = Date.now() - startTime;

    closeLogPane(paneId);

    const resultText = extractResultFromStreamJson(stdout);
    const toonResult = [
      `success: true`,
      `output: "${resultText.trim().replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
      `duration-ms: ${durationMs}`,
      `files-changed: ${(files ?? []).join(', ')}`,
    ].join('\n');
    return respond(toonResult);
  } catch (err) {
    closeLogPane(paneId);
    const message = err instanceof Error ? err.message : String(err);
    return respondError(`Worker failed: ${message}`);
  }
}
