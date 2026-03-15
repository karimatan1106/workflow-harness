/**
 * harness_delegate_work — Spawn isolated coordinator process for phase work.
 * 3-layer model: Orchestrator → delegate_work (Coordinator) → Agent (Worker)
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

const DEFAULT_DISALLOWED_TOOLS = 'mcp__harness__harness_start,mcp__harness__harness_next,mcp__harness__harness_approve,mcp__harness__harness_status,mcp__harness__harness_back,mcp__harness__harness_reset,mcp__harness__harness_delegate_work';

// ─── Phase-aware allowed tools ────────────────────
type PhaseGuide = ReturnType<typeof buildPhaseGuide>;

/**
 * Build --allowedTools list for the coordinator subprocess.
 * Includes Agent because coordinators spawn workers via Agent tool.
 * This differs from writeAllowedToolsFile (manager-lifecycle.ts) which writes
 * .worker-allowed-tools for direct subagents — those do NOT get Agent because
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
    'toon-rules: "key: value形式。カンマ含む値は引用符。バックスラッシュ禁止。ファイル名はハイフン区切り"',
    'instruction-format: "TOON形式で受信。key: valueペアをパースして作業内容を理解すること"',
    'env-vars: "HARNESS_TASK_ID, HARNESS_SESSION_TOKEN（環境変数から取得）"',
    'worker-delegation: "Agent toolでsubagentに委譲。instructionに具体的なファイルパスと期待する変更を含めること"',
    'output-format: "作業結果をTOON形式で返すこと。success: true/false, output: 作業内容, files-changed: 変更ファイル一覧"',
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
        appendFileSync(options.logFile, text);
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
    '--output-format', 'text',
    '--setting-sources', 'user',
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
  writeFileSync(logFile, `[${new Date().toISOString()}] delegate-work started: phase=${task.phase}\n`);

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

    const toonResult = [
      `success: true`,
      `output: "${stdout.trim().replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
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
