/**
 * harness_delegate_coordinator - Spawn isolated coordinator process for phase work.
 * 3-layer model: Orchestrator -> delegate_coordinator (Coordinator) -> Agent (Worker)
 * Coordinator: reads files + MCP ops + delegates file edits to workers via Agent.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { StreamProgressTracker } from './stream-progress-tracker.js';
import { spawnAsync, buildResponse, parseToonKv } from './coordinator-spawn.js';
import {
  buildAllowedTools,
  buildCoordinatorPrompt,
  buildCmdArgs,
} from './coordinator-prompt.js';
import type { StateManager } from '../../state/manager.js';
import {
  buildPhaseGuide,
  respondError,
  validateSession,
  type HandlerResult,
} from '../handler-shared.js';
import { getProjectRoot } from '../../utils/project-root.js';

const DEFAULT_DISALLOWED_TOOLS = 'mcp__harness__harness_start,mcp__harness__harness_next,mcp__harness__harness_approve,mcp__harness__harness_status,mcp__harness__harness_back,mcp__harness__harness_reset,mcp__harness__harness_delegate_coordinator,Skill,WebSearch,WebFetch,TodoWrite,NotebookEdit,EnterPlanMode,ExitPlanMode,EnterWorktree,ExitWorktree,CronCreate,CronDelete,CronList,AskUserQuestion';

// ---- MCP config detection ----
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

// ---- Worker ID allocation ----
let logPaneCounter = 0;

function allocateWorkerId(): string {
  return `worker-${++logPaneCounter}`;
}

// ---- Build full instruction from args ----
function buildFullInstruction(
  instruction: string,
  files: string[] | undefined,
  planOnly: boolean,
  approvedPlan: string | null,
): string {
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
    fullInstruction += '\n\n対象ファイル:\n'
      + files.map((f: string) => '- ' + f).join('\n');
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

  return fullInstruction;
}

// ---- Handler ----
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

  const fullInstruction = buildFullInstruction(
    instruction, files, planOnly, approvedPlan,
  );

  const baseAllowedTools = buildAllowedTools(phaseGuide);
  const allowedTools = planOnly
    ? baseAllowedTools.split(',')
        .filter(t => !['Write', 'Edit'].includes(t))
        .join(',')
    : baseAllowedTools;
  // C-4: systemPrompt is server-side enforced, not overridable
  const systemPrompt = buildCoordinatorPrompt(task, phaseGuide);
  const model = args.model ? String(args.model) : (phaseGuide.model ?? null);
  const addDirs = args.addDirs as string[] | undefined;
  const mcpConfig = args.mcpConfig ? String(args.mcpConfig) : findMcpConfig();

  const cmdArgs = buildCmdArgs({
    fullInstruction,
    allowedTools,
    disallowedTools: DEFAULT_DISALLOWED_TOOLS,
    systemPrompt,
    model,
    mcpConfig,
    addDirs,
  });

  const projectRoot = getProjectRoot();

  // Allocate worker ID first, then create worker-specific log file
  const paneId = allocateWorkerId();
  const logFile = join(projectRoot, '.agent', `delegate-coordinator-${paneId}.log`);
  const progressFile = join(projectRoot, '.agent', `${paneId}-progress.md`);
  writeFileSync(logFile, '');

  const progressTracker = new StreamProgressTracker(progressFile, paneId);

  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    HARNESS_SESSION_TOKEN: String(args.sessionToken),
    HARNESS_TASK_ID: taskId,
    HARNESS_LAYER: 'coordinator',
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
    FORCE_COLOR: '1',
  };

  try {
    const startTime = Date.now();
    const { stdout } = await spawnAsync('claude', cmdArgs, {
      cwd: projectRoot,
      env: childEnv,
      logFile,
      progressTracker,
    });
    const durationMs = Date.now() - startTime;
    return buildResponse(stdout, durationMs, planOnly, files);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return respondError(`Worker failed: ${message}`);
  }
}
