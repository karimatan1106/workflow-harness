/**
 * HMAC-SHA256 state integrity utilities
 * @spec docs/spec/features/workflow-harness.md
 */

import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const HMAC_ALGORITHM = 'sha256';

interface HmacKeys {
  version: 1;
  current: string;
  previous?: string;
  rotatedAt: string;
}

function getToonPath(stateDir: string): string {
  return join(stateDir, 'hmac-keys.toon');
}

/** Serialize HmacKeys to TOON KV format. */
function serializeHmacToon(keys: HmacKeys): string {
  const lines: string[] = [];
  lines.push(`version: ${keys.version}`);
  lines.push(`current: ${keys.current}`);
  if (keys.previous) lines.push(`previous: ${keys.previous}`);
  lines.push(`rotatedAt: ${keys.rotatedAt}`);
  return lines.join('\n') + '\n';
}

/** Parse TOON KV format into HmacKeys. */
function parseHmacToon(content: string): HmacKeys {
  const result: Partial<HmacKeys> = {};
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'version') (result as any).version = Number(v);
    else if (k === 'current') result.current = v;
    else if (k === 'previous') result.previous = v;
    else if (k === 'rotatedAt') result.rotatedAt = v;
  }
  return result as HmacKeys;
}

/**
 * Load the full HmacKeys object (current + previous) from the state directory.
 * Creates a new key file if none exists. Migrates from .json on first load.
 */
export function loadHmacKeys(stateDir: string): HmacKeys {
  const toonPath = getToonPath(stateDir);
  if (existsSync(toonPath)) {
    return parseHmacToon(readFileSync(toonPath, 'utf8'));
  }
  // Create new keys
  const dir = dirname(toonPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const newKey = randomBytes(32).toString('hex');
  const keys: HmacKeys = {
    version: 1,
    current: newKey,
    rotatedAt: new Date().toISOString(),
  };
  writeFileSync(toonPath, serializeHmacToon(keys));
  return keys;
}

export function ensureHmacKeys(stateDir: string): string {
  return loadHmacKeys(stateDir).current;
}

export function computeHmac(data: string, key: string): string {
  return createHmac(HMAC_ALGORITHM, key).update(data).digest('hex');
}

export function signState(state: Record<string, unknown>, key: string): string {
  const { stateIntegrity, ...rest } = state;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort(), 2);
  return computeHmac(canonical, key);
}

export function verifyState(state: Record<string, unknown>, key: string): boolean {
  const stored = state.stateIntegrity as string;
  if (!stored) return false;
  const computed = signState(state, key);
  return computed === stored;
}

/**
 * Verify state integrity with key rotation support.
 * Tries the current key first; if that fails and a previous key exists,
 * retries verification with the previous key.
 */
export function verifyStateWithRotation(state: Record<string, unknown>, stateDir: string): boolean {
  const keys = loadHmacKeys(stateDir);
  if (verifyState(state, keys.current)) {
    return true;
  }
  if (keys.previous) {
    if (verifyState(state, keys.previous)) return true;
  }
  // PL-D-07: structured log on verification failure
  const errorContext = !state.stateIntegrity ? 'no_integrity_field' : 'key_mismatch';
  console.error(JSON.stringify({
    event: 'hmac_verification_failed',
    taskId: state.taskId ?? 'unknown',
    keysUsed: keys.previous ? 'both' : 'current',
    stateIntegrityPresent: !!state.stateIntegrity,
    errorContext,
  }));
  return false;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateTaskId(): string {
  return randomUUID();
}
