/**
 * harness_delegate_work — Spawn isolated coordinator process for phase work.
 * 3-layer model: Orchestrator → delegate_work (Coordinator) → Agent (Worker)
 * Coordinator: reads files + MCP ops + delegates file edits to workers via Agent.
 */

import { spawn } from 'node:child_process';
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
import { getProjectRoot } from '../../utils/project-root.js';

const DEFAULT_DISALLOWED_TOOLS = 'mcp__harness__harness_start,mcp__harness__harness_next,mcp__harness__harness_approve,mcp__harness__harness_status,mcp__harness__harness_back,mcp__harness__harness_reset,mcp__harness__harness_delegate_work';
const WORKER_TIMEOUT_MS = 300_000; // 5 minutes

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
    'progress-output: "作業の各ステップでstdoutに進捗マーカーを出力すること。形式: [PROGRESS] ステップ内容"',
    'worker-progress: "Agent toolでWorkerに委譲する前後に進捗を出力。[PROGRESS] Worker開始: {内容} / [PROGRESS] Worker完了: {結果}"',
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

// ─── Async spawn wrapper ──────────────────────────
function spawnAsync(
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string | undefined> },
  extra?: { sendNotification?: (notification: any) => Promise<void> },
  progressToken?: string,
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
      process.stderr.write(text);

      // [PROGRESS]マーカーを検出してprogress通知に含める
      const progressLines = text.split('\n').filter((l: string) => l.includes('[PROGRESS]'));
      if (extra?.sendNotification && progressToken !== undefined) {
        const message = progressLines.length > 0
          ? progressLines[progressLines.length - 1].replace('[PROGRESS]', '').trim()
          : undefined;
        extra.sendNotification({
          method: 'notifications/progress',
          params: {
            progressToken,
            progress: stdout.length,
            total: 0,
            ...(message ? { message } : {}),
          }
        }).catch(() => {});
      }
    });
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
  extra?: { sendNotification?: (notification: any) => Promise<void> },
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

  // Fix #3: sessionToken propagation via env
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    HARNESS_SESSION_TOKEN: String(args.sessionToken),
    HARNESS_TASK_ID: taskId,
  };

  // Fix #4: async spawn instead of execSync
  try {
    const startTime = Date.now();
    const progressToken = (args._meta as any)?.progressToken as string | undefined;
    const { stdout } = await spawnAsync('claude', cmdArgs, {
      cwd: projectRoot,
      env: childEnv,
    }, extra, progressToken);
    const durationMs = Date.now() - startTime;

    const toonResult = [
      `success: true`,
      `output: "${stdout.trim().replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
      `duration-ms: ${durationMs}`,
      `files-changed: ${(files ?? []).join(', ')}`,
    ].join('\n');
    return respond(toonResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return respondError(`Worker failed: ${message}`);
  }
}
