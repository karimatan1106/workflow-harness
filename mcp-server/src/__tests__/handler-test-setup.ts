/**
 * Shared setup for handler integration tests.
 * NOT a test file (no .test.ts suffix) — imported by split test files.
 *
 * STATE_DIR and DOCS_DIR in manager.ts are module-level constants captured at
 * import time via process.env. We use vi.resetModules() + vi.stubEnv() and
 * dynamic imports so the manager and handler pick up our temp dirs.
 */

import { vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { StateManager as StateManagerType } from '../state/manager.js';
import type { handleToolCall as HandleToolCallType } from '../tools/handler.js';
import type { TOOL_DEFINITIONS as ToolDefinitionsType } from '../tools/handler.js';

export interface TestCtx {
  TEMP_DIR: string;
  STATE_DIR: string;
  DOCS_DIR: string;
  StateManagerClass: typeof StateManagerType;
  handleToolCall: typeof HandleToolCallType;
  TOOL_DEFINITIONS: typeof ToolDefinitionsType;
  createMgr: () => StateManagerType;
  call: (
    mgr: StateManagerType,
    name: string,
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  advanceN: (
    mgr: StateManagerType,
    taskId: string,
    sessionToken: string,
    n: number,
  ) => Promise<string>;
  advanceUntilPhase: (
    mgr: StateManagerType,
    taskId: string,
    sessionToken: string,
    targetPhase: string,
    maxSteps?: number,
  ) => Promise<string>;
}

export async function setupHandlerTest(): Promise<TestCtx> {
  const TEMP_DIR = mkdtempSync(join(tmpdir(), 'handler-test-'));
  const STATE_DIR = join(TEMP_DIR, 'state');
  const DOCS_DIR = join(TEMP_DIR, 'docs');
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(DOCS_DIR, { recursive: true });

  vi.stubEnv('STATE_DIR', STATE_DIR);
  vi.stubEnv('DOCS_DIR', DOCS_DIR);
  vi.stubEnv('HARNESS_TEST_MODE', '1');
  vi.resetModules();

  const managerMod = await import('../state/manager.js');
  const StateManagerClass = managerMod.StateManager;

  const handlerMod = await import('../tools/handler.js');
  const handleToolCall = handlerMod.handleToolCall;
  const TOOL_DEFINITIONS = handlerMod.TOOL_DEFINITIONS;

  function createMgr(): StateManagerType {
    return new StateManagerClass();
  }

  function parseResponse(
    result: Awaited<ReturnType<typeof HandleToolCallType>>,
  ): unknown {
    const text = result.content[0].text;
    return JSON.parse(text);
  }

  async function call(
    mgr: StateManagerType,
    name: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await handleToolCall(name, args, mgr);
    return parseResponse(result) as Record<string, unknown>;
  }

  async function advanceN(
    mgr: StateManagerType,
    taskId: string,
    sessionToken: string,
    n: number,
  ): Promise<string> {
    let token = sessionToken;
    for (let i = 0; i < n; i++) {
      const res = await call(mgr, 'harness_next', {
        taskId,
        sessionToken: token,
        forceTransition: true,
      });
      if (res.error) {
        throw new Error(`advanceN failed at step ${i}: ${res.error}`);
      }
      const status = await call(mgr, 'harness_status', { taskId });
      token = (status as Record<string, unknown>).sessionToken as string;
    }
    return token;
  }

  async function advanceUntilPhase(
    mgr: StateManagerType,
    taskId: string,
    sessionToken: string,
    targetPhase: string,
    maxSteps = 15,
  ): Promise<string> {
    let token = sessionToken;
    for (let i = 0; i < maxSteps; i++) {
      const status = await call(mgr, 'harness_status', { taskId });
      if (status.phase === targetPhase) return token;
      const res = await call(mgr, 'harness_next', {
        taskId,
        sessionToken: token,
        forceTransition: true,
      });
      if (res.error) {
        throw new Error(`advanceUntilPhase failed at step ${i}: ${res.error}`);
      }
      const freshStatus = await call(mgr, 'harness_status', { taskId });
      token = freshStatus.sessionToken as string;
    }
    const finalStatus = await call(mgr, 'harness_status', { taskId });
    if (finalStatus.phase !== targetPhase) {
      throw new Error(
        `advanceUntilPhase: reached ${finalStatus.phase} instead of ${targetPhase} after ${maxSteps} steps`,
      );
    }
    return token;
  }

  return {
    TEMP_DIR,
    STATE_DIR,
    DOCS_DIR,
    StateManagerClass,
    handleToolCall,
    TOOL_DEFINITIONS,
    createMgr,
    call,
    advanceN,
    advanceUntilPhase,
  };
}

export function teardownHandlerTest(ctx: TestCtx): void {
  vi.unstubAllEnvs();
  if (ctx.TEMP_DIR) rmSync(ctx.TEMP_DIR, { recursive: true, force: true });
}
