/**
 * HMAC-SHA256 state integrity utilities
 * @spec docs/spec/features/workflow-harness.md
 */
interface HmacKeys {
    current: string;
    previous?: string;
    rotatedAt: string;
}
/**
 * Load the full HmacKeys object (current + previous) from the state directory.
 * Creates a new key file if none exists.
 */
export declare function loadHmacKeys(stateDir: string): HmacKeys;
export declare function ensureHmacKeys(stateDir: string): string;
export declare function computeHmac(data: string, key: string): string;
export declare function signState(state: Record<string, unknown>, key: string): string;
export declare function verifyState(state: Record<string, unknown>, key: string): boolean;
/**
 * Verify state integrity with key rotation support.
 * Tries the current key first; if that fails and a previous key exists,
 * retries verification with the previous key.
 */
export declare function verifyStateWithRotation(state: Record<string, unknown>, stateDir: string): boolean;
export declare function generateSessionToken(): string;
export declare function generateTaskId(): string;
export {};
//# sourceMappingURL=hmac.d.ts.map