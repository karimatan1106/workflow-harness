/**
 * harness_delegate_work — Spawn isolated coordinator process for phase work.
 * 3-layer model: Orchestrator → delegate_work (Coordinator) → Agent (Worker)
 * Coordinator: reads files + MCP ops + delegates file edits to workers via Agent.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { StateManager } from '../../state/manager.js';
import { respond, respondError, validateSession, type HandlerResult } from '../handler-shared.js';

const DEFAULT_ALLOWED_TOOLS = 'Agent,Read,Glob,Grep';
const DEFAULT_SYSTEM_PROMPT = 'フェーズ作業を管理するcoordinatorです。ファイルの読み取りとMCPツール操作を行い、ファイル編集はAgentでworkerを生成して委譲してください。workerへの指示には対象ファイルパスと具体的な変更内容を含めてください。';
const DEFAULT_DISALLOWED_TOOLS = 'mcp__harness__harness_start,mcp__harness__harness_next,mcp__harness__harness_approve,mcp__harness__harness_status,mcp__harness__harness_back,mcp__harness__harness_reset,mcp__harness__harness_delegate_work';
const WORKER_TIMEOUT_MS = 300_000; // 5 minutes

function getProjectRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return process.cwd();
  }
}

function findMcpConfig(): string | undefined {
  const cwd = process.cwd();
  const projectRoot = getProjectRoot();
  // Check current directory first, then try git root
  const candidates = [
    join(cwd, '.mcp.json'),
  ];
  if (projectRoot !== cwd) {
    candidates.push(join(projectRoot, '.mcp.json'));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return resolve(candidate);
  }
  return undefined;
}

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

  const files = args.files as string[] | undefined;
  const allowedTools = String(args.allowedTools ?? DEFAULT_ALLOWED_TOOLS);
  const disallowedTools = String(args.disallowedTools ?? DEFAULT_DISALLOWED_TOOLS);
  const systemPrompt = String(args.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);
  const model = args.model ? String(args.model) : undefined;
  const addDirs = args.addDirs as string[] | undefined;
  const mcpConfig = args.mcpConfig ? String(args.mcpConfig) : findMcpConfig();

  // Build claude -p command
  const cmdParts: string[] = [
    'claude',
    '-p',
    JSON.stringify(instruction),
    '--print',
    '--output-format', 'text',
    '--setting-sources', 'user',
    '--disable-slash-commands',
    '--allowedTools', JSON.stringify(allowedTools),
    '--permission-mode', 'bypassPermissions',
    '--no-session-persistence',
    '--system-prompt', JSON.stringify(systemPrompt),
  ];

  if (disallowedTools) {
    cmdParts.push('--disallowedTools', JSON.stringify(disallowedTools));
  }

  if (mcpConfig) {
    cmdParts.push('--mcp-config', JSON.stringify(mcpConfig));
  }

  if (model) {
    cmdParts.push('--model', model);
  }

  if (addDirs?.length) {
    for (const dir of addDirs) {
      cmdParts.push('--add-dir', JSON.stringify(dir));
    }
  }

  const cmd = cmdParts.join(' ');
  const projectRoot = getProjectRoot();

  try {
    const startTime = Date.now();
    const output = execSync(cmd, {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: WORKER_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const durationMs = Date.now() - startTime;

    return respond({
      success: true,
      output: output.trim(),
      durationMs,
      filesHint: files ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stderr = (err as { stderr?: string | Buffer })?.stderr;
    const stderrText = stderr ? String(stderr).trim() : undefined;
    return respondError(`Worker failed: ${message}${stderrText ? `\nstderr: ${stderrText}` : ''}`);
  }
}
