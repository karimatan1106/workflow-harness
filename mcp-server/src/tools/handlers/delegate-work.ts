/**
 * harness_delegate_work — Spawn isolated coordinator process for phase work.
 * 3-layer model: Orchestrator → delegate_work (Coordinator) → Agent (Worker)
 * Coordinator: reads files + MCP ops + delegates file edits to workers via Agent.
 */

import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

const DEFAULT_DISALLOWED_TOOLS = 'mcp__harness__harness_start,mcp__harness__harness_next,mcp__harness__harness_approve,mcp__harness__harness_status,mcp__harness__harness_back,mcp__harness__harness_reset,mcp__harness__harness_delegate_work';
const WORKER_TIMEOUT_MS = 300_000; // 5 minutes

// ─── Phase-aware allowed tools ────────────────────
type PhaseGuide = ReturnType<typeof buildPhaseGuide>;

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
    'Role: coordinatorとしてフェーズ作業を管理。ファイル読み取りとMCP操作を行い、ファイル編集はAgentでworkerを生成して委譲。',
    `Phase: ${task.phase}`,
    `DocsDir: ${task.docsDir}`,
    'TOON format: key: value形式。カンマ含む値は引用符必須。バックスラッシュ禁止。ファイル名はハイフン区切り。',
    `AllowedExtensions: ${pg.allowedExtensions.join(', ')}`,
    `OutputFile: ${task.docsDir}/${task.phase}.toon`,
    'workerへの指示には対象ファイルパスと具体的な変更内容を含めること。',
    'MCPツール呼び出し時は環境変数 HARNESS_TASK_ID と HARNESS_SESSION_TOKEN を使用すること。',
  ];
  return lines.join('\n');
}

// ─── Project root detection ───────────────────────
function getProjectRoot(): string {
  try {
    // If running inside a submodule, get the parent project root
    const superproject = execSync('git rev-parse --show-superproject-working-tree', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (superproject) return superproject;
    // Otherwise, get the current repo root
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return process.cwd();
  }
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

// ─── Async spawn wrapper ──────────────────────────
function spawnAsync(
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string | undefined> },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Timeout'));
    }, WORKER_TIMEOUT_MS);

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Exit code ${code}\nstderr: ${stderr}`));
    });
    child.on('error', (err) => {
      clearTimeout(timer);
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

  if (mcpConfig) {
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

  // Fix #3: sessionToken propagation via env
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    HARNESS_SESSION_TOKEN: String(args.sessionToken),
    HARNESS_TASK_ID: taskId,
  };

  // Fix #4: async spawn instead of execSync
  try {
    const startTime = Date.now();
    const { stdout } = await spawnAsync('claude', cmdArgs, {
      cwd: projectRoot,
      env: childEnv,
    });
    const durationMs = Date.now() - startTime;

    return respond({
      success: true,
      output: stdout.trim(),
      durationMs,
      filesHint: files ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return respondError(`Worker failed: ${message}`);
  }
}
