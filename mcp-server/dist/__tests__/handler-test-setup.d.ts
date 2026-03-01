/**
 * Shared setup for handler integration tests.
 * NOT a test file (no .test.ts suffix) — imported by split test files.
 *
 * STATE_DIR and DOCS_DIR in manager.ts are module-level constants captured at
 * import time via process.env. We use vi.resetModules() + vi.stubEnv() and
 * dynamic imports so the manager and handler pick up our temp dirs.
 */
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
    call: (mgr: StateManagerType, name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    advanceN: (mgr: StateManagerType, taskId: string, sessionToken: string, n: number) => Promise<string>;
    advanceUntilPhase: (mgr: StateManagerType, taskId: string, sessionToken: string, targetPhase: string, maxSteps?: number) => Promise<string>;
}
export declare function setupHandlerTest(): Promise<TestCtx>;
export declare function teardownHandlerTest(ctx: TestCtx): void;
//# sourceMappingURL=handler-test-setup.d.ts.map