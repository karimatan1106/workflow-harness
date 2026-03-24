/**
 * coordinator-spawn.ts - Async spawn wrapper, result extraction, and response
 * building for coordinator subprocess.
 */

import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import type { StreamProgressTracker } from './stream-progress-tracker.js';
import { toonDecodeSafe } from '../../state/toon-io-adapter.js';
import {
  respond,
  respondError,
  type HandlerResult,
} from '../handler-shared.js';

export interface SpawnOptions {
  cwd: string;
  env: Record<string, string | undefined>;
  logFile?: string;
  progressTracker?: StreamProgressTracker;
}

/** Spawn a child process and collect stdout/stderr. */
export function spawnAsync(
  command: string,
  args: string[],
  options: SpawnOptions,
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

/** Extract the final result text from stream-json output. */
export function extractResult(stdout: string): string {
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

/** Escape a value for TOON KV output. Double-quote if contains comma/newline. */
export function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Parse TOON key-value pairs from a multi-line string. */
export function parseToonKv(content: string): Record<string, string> {
  const parsed = toonDecodeSafe<Record<string, string>>(content);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = String(v);
    }
    return result;
  }
  return {};
}

/** Build the final HandlerResult from coordinator stdout. */
export function buildResponse(
  stdout: string,
  durationMs: number,
  planOnly: boolean,
  files: string[] | undefined,
): HandlerResult {
  const resultText = extractResult(stdout);

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
}
