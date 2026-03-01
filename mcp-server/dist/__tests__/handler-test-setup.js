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
export async function setupHandlerTest() {
    const TEMP_DIR = mkdtempSync(join(tmpdir(), 'handler-test-'));
    const STATE_DIR = join(TEMP_DIR, 'state');
    const DOCS_DIR = join(TEMP_DIR, 'docs');
    mkdirSync(STATE_DIR, { recursive: true });
    mkdirSync(DOCS_DIR, { recursive: true });
    vi.stubEnv('STATE_DIR', STATE_DIR);
    vi.stubEnv('DOCS_DIR', DOCS_DIR);
    vi.resetModules();
    const managerMod = await import('../state/manager.js');
    const StateManagerClass = managerMod.StateManager;
    const handlerMod = await import('../tools/handler.js');
    const handleToolCall = handlerMod.handleToolCall;
    const TOOL_DEFINITIONS = handlerMod.TOOL_DEFINITIONS;
    function createMgr() {
        return new StateManagerClass();
    }
    function parseResponse(result) {
        const text = result.content[0].text;
        return JSON.parse(text);
    }
    async function call(mgr, name, args) {
        const result = await handleToolCall(name, args, mgr);
        return parseResponse(result);
    }
    async function advanceN(mgr, taskId, sessionToken, n) {
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
            token = status.sessionToken;
        }
        return token;
    }
    async function advanceUntilPhase(mgr, taskId, sessionToken, targetPhase, maxSteps = 15) {
        let token = sessionToken;
        for (let i = 0; i < maxSteps; i++) {
            const status = await call(mgr, 'harness_status', { taskId });
            if (status.phase === targetPhase)
                return token;
            const res = await call(mgr, 'harness_next', {
                taskId,
                sessionToken: token,
                forceTransition: true,
            });
            if (res.error) {
                throw new Error(`advanceUntilPhase failed at step ${i}: ${res.error}`);
            }
            const freshStatus = await call(mgr, 'harness_status', { taskId });
            token = freshStatus.sessionToken;
        }
        const finalStatus = await call(mgr, 'harness_status', { taskId });
        if (finalStatus.phase !== targetPhase) {
            throw new Error(`advanceUntilPhase: reached ${finalStatus.phase} instead of ${targetPhase} after ${maxSteps} steps`);
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
export function teardownHandlerTest(ctx) {
    vi.unstubAllEnvs();
    if (ctx.TEMP_DIR)
        rmSync(ctx.TEMP_DIR, { recursive: true, force: true });
}
//# sourceMappingURL=handler-test-setup.js.map