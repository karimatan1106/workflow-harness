/**
 * harness_delegate_coordinator  ESpawn isolated coordinator process for phase work.
 * 3-layer model: Orchestrator ↁEdelegate_coordinator (Coordinator) ↁEAgent (Worker)
 * Coordinator: reads files + MCP ops + delegates file edits to workers via Agent.
 */

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { StreamProgressTracker } from './stream-progress-tracker.js';
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
import { parseToonKv, esc } from '../../state/toon-helpers.js';

const DEFAULT_DISALLOWED_TOOLS = 'mcp__harness__harness_start,mcp__harness__harness_next,mcp__harness__harness_approve,mcp__harness__harness_status,mcp__harness__harness_back,mcp__harness__harness_reset,mcp__harness__harness_delegate_coordinator,Skill,WebSearch,WebFetch,TodoWrite,NotebookEdit,EnterPlanMode,ExitPlanMode,EnterWorktree,ExitWorktree,CronCreate,CronDelete,CronList,AskUserQuestion';

// ─── Phase-aware allowed tools ────────────────────
type PhaseGuide = ReturnType<typeof buildPhaseGuide>;

/**
 * Build --allowedTools list for the coordinator subprocess.
 * Includes Agent Teams tools because coordinators (L2) manage teams:
 *   Agent (spawn L3 workers), TeamCreate/TeamDelete (team lifecycle),
 *   TaskCreate/TaskUpdate/TaskList/TaskGet (progress tracking),
 *   SendMessage (intra-team communication), ToolSearch (deferred tools).
 * This differs from writeAllowedToolsFile (manager-lifecycle.ts) which writes
 * .worker-allowed-tools for direct subagents  Ethose do NOT get Agent because
 * workers should not spawn further subagents.
 */
function buildAllowedTools(phaseGuide: PhaseGuide): string {
  const coordinatorBase = [
    'Agent', 'TeamCreate', 'TeamDelete',
    'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
    'SendMessage', 'ToolSearch', 'Read', 'Glob', 'Grep', 'Bash',
  ];
  const phaseTools = (phaseGuide as PhaseGuide & { allowedTools?: string[] }).allowedTools ?? [];
  const merged = new Set([...coordinatorBase, ...phaseTools]);
  return [...merged].join(',');
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
    'env-vars: "HARNESS_TASK_ID, HARNESS_SESSION_TOKENは環境変数から取得"',
    'worker-delegation: "ファイル書き込みが必要な場合、Bashで HARNESS_LAYER=worker claude -p \'<指示>\' --print --permission-mode bypassPermissions を実行しworkerを起動すること。Agent toolのsubagentはcoordinator権限を継承するためdocs/workflows/への書き込みにはworkerが必要"',
    'team-management: "TeamCreateでチームを作成し、Agentでworkerをspawn。TaskCreateで進捗管理。workerにはSendMessageで指示"',
    'output-format: "作業結果をTOON形式で返すこと。success: true/false, output: 作業内容, files-changed: 変更ファイル一覧"',
    'output-rule: "Agent toolの結果を受け取ったら、必ず最終テキストとして結果をまとめて出力すること。ツール呼び出しだけで終了しないこと"',
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

// ─── Worker ID allocation ─────────────────────────
let logPaneCounter = 0;

function allocateWorkerId(): string {
  return `worker-${++logPaneCounter}`;
}

// ─── Async spawn wrapper ──────────────────────────
function spawnAsync(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: Record<string, string | undefined>;
    logFile?: string;
    progressTracker?: StreamProgressTracker;
  },
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
      if (options.logFile) {
        appendFileSync(options.logFile, text);
      }
      if (options.progressTracker) {
        options.progressTracker.feed(text);
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
      if (options.progressTracker) {
        options.progressTracker.flush();
      }
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Exit code ${code}\nstderr: ${stderr}`));
    });
    child.on('error', (err) => {
      reject(err);
    });
  });
}

// ─── Extract result from stream-json output ──────
function extractResult(stdout: string): string {
  const lines = stdout.split('\n').filter(l => l.trim());

  // 1. Look for result event with non-empty result
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.type === 'result' && obj.result) return obj.result;
    } catch { /* not JSON */ }
  }

  // 2. If result is empty, reconstruct from content_block_delta text
  const textParts: string[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'content_block_delta' && obj.delta?.text) {
        textParts.push(obj.delta.text);
      }
    } catch { /* skip */ }
  }
  if (textParts.length) return textParts.join('');

  return '(no extractable result)';
}

// ─── Handler ──────────────────────────────────────
export async function handleDelegateCoordinator(
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

  const planOnly = Boolean(args.planOnly);
  const approvedPlan = args.approvedPlan ? String(args.approvedPlan) : null;

  // Phase-aware defaults
  const phaseGuide = buildPhaseGuide(task.phase);

  const files = args.files as string[] | undefined;

  // S-2: Parse instruction as TOON key-value pairs
  const parsedInstruction = parseToonKv(instruction);
  let fullInstruction: string;
  if (Object.keys(parsedInstruction).length > 0) {
    const kvLines = Object.entries(parsedInstruction)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    fullInstruction = kvLines;
  } else {
    fullInstruction = instruction;
  }
  if (files?.length) {
    fullInstruction += '\n\n対象ファイル:\n' + files.map((f: string) => '- ' + f).join('\n');
  }

  if (planOnly) {
    fullInstruction += '\n\n--- plan-only mode ---\n'
      + 'ファイル編集禁止。コードベースを調査し、実装の分解プランのみ返すこと。\n'
      + '出力形式:\n'
      + 'plan-summary: 全体方針の1行要約\n'
      + 'worker-count: 想定Worker数\n'
      + 'worker-N-task: Worker Nの担当内容\n'
      + 'worker-N-files: Worker Nの対象ファイル\n'
      + 'dependencies: Worker間の依存関係(なければ none)\n'
      + 'risks: 注意すべきリスク';
  }

  if (approvedPlan) {
    fullInstruction = '--- approved plan ---\n'
      + approvedPlan
      + '\n--- end approved plan ---\n\n'
      + '上記の承認済みプランに従って実行すること。プランから逸脱しないこと。\n\n'
      + fullInstruction;
  }

  const baseAllowedTools = buildAllowedTools(phaseGuide);
  const allowedTools = planOnly
    ? baseAllowedTools.split(',').filter(t => !['Write', 'Edit'].includes(t)).join(',')
    : baseAllowedTools;
  const disallowedTools = DEFAULT_DISALLOWED_TOOLS;
  // C-4: systemPrompt is server-side enforced, not overridable
  const systemPrompt = buildCoordinatorPrompt(task, phaseGuide);
  const model = args.model ? String(args.model) : (phaseGuide.model ?? null);
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

  // MCP config: always needed for coordinator (non-lifecycle harness MCP tools)
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

  // Allocate worker ID first, then create worker-specific log file
  const paneId = allocateWorkerId();
  const logFile = join(projectRoot, '.agent', `delegate-coordinator-${paneId}.log`);
  const progressFile = join(projectRoot, '.agent', `${paneId}-progress.md`);
  writeFileSync(logFile, '');

  // Progress tracker for real-time Markdown output
  const progressTracker = new StreamProgressTracker(progressFile, paneId);

  // Fix #3: sessionToken propagation via env
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    HARNESS_SESSION_TOKEN: String(args.sessionToken),
    HARNESS_TASK_ID: taskId,
    HARNESS_LAYER: 'coordinator',
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
    FORCE_COLOR: '1',
  };

  // Fix #4: async spawn instead of execSync
  try {
    const startTime = Date.now();
    const { stdout } = await spawnAsync('claude', cmdArgs, {
      cwd: projectRoot,
      env: childEnv,
      logFile,
      progressTracker,
    });
    const durationMs = Date.now() - startTime;

    const resultText = extractResult(stdout);

    // planOnly: return plan for human approval
    if (planOnly) {
      const toonResult = [
        `success: true`,
        `requires-approval: true`,
        `plan: ${esc(resultText.trim())}`,
        `duration-ms: ${durationMs}`,
      ].join('\n');
      return respond(toonResult);
    }

    // S-3: Parse coordinator output as TOON key-value pairs
    const parsedOutput = parseToonKv(resultText);
    if (Object.keys(parsedOutput).length > 0) {
      const success = parsedOutput['success'] !== 'false';
      if (!success) {
        return respondError(
          `Coordinator reported failure: ${parsedOutput['output'] ?? resultText.trim()}`,
        );
      }
      const toonResult = [
        `success: true`,
        `output: ${esc(parsedOutput['output'] ?? resultText.trim())}`,
        `duration-ms: ${durationMs}`,
        `files-changed: ${parsedOutput['files-changed'] ?? (files ?? []).join(', ')}`,
      ].join('\n');
      return respond(toonResult);
    }

    const toonResult = [
      `success: true`,
      `output: ${esc(resultText.trim())}`,
      `duration-ms: ${durationMs}`,
      `files-changed: ${(files ?? []).join(', ')}`,
    ].join('\n');
    return respond(toonResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return respondError(`Worker failed: ${message}`);
  }
}
