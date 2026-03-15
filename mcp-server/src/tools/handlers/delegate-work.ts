/**
 * harness_delegate_work — Spawn isolated claude -p worker for file operations.
 * Provides context-isolated execution for implementation/editing tasks.
 */

import { execSync } from 'node:child_process';
import { respond, respondError, type HandlerResult } from '../handler-shared.js';

const DEFAULT_ALLOWED_TOOLS = 'Read,Edit,Write,Bash,Glob,Grep';
const DEFAULT_SYSTEM_PROMPT = '指定されたファイルを読み書きするworkerです。指示通りに正確に実行し、結果のみ報告してください。';
const WORKER_TIMEOUT_MS = 300_000; // 5 minutes

export async function handleDelegateWork(
  args: Record<string, unknown>,
): Promise<HandlerResult> {
  const instruction = String(args.instruction ?? '');
  if (!instruction) return respondError('instruction is required');

  const files = args.files as string[] | undefined;
  const allowedTools = String(args.allowedTools ?? DEFAULT_ALLOWED_TOOLS);
  const systemPrompt = String(args.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);
  const model = args.model ? String(args.model) : undefined;
  const addDirs = args.addDirs as string[] | undefined;

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

  if (model) {
    cmdParts.push('--model', model);
  }

  if (addDirs?.length) {
    for (const dir of addDirs) {
      cmdParts.push('--add-dir', JSON.stringify(dir));
    }
  }

  const cmd = cmdParts.join(' ');

  try {
    const startTime = Date.now();
    const output = execSync(cmd, {
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
    // Extract stderr if available
    const stderr = (err as { stderr?: string | Buffer })?.stderr;
    const stderrText = stderr ? String(stderr).trim() : undefined;
    return respondError(`Worker failed: ${message}${stderrText ? `\nstderr: ${stderrText}` : ''}`);
  }
}
