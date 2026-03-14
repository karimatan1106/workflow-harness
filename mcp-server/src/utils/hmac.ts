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

function getLegacyJsonPath(stateDir: string): string {
  return join(stateDir, 'hmac-keys.json');
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

/** Migrate legacy JSON (array or object) to TOON. Returns HmacKeys or null. */
function migrateFromJson(stateDir: string): HmacKeys | null {
  const jsonPath = getLegacyJsonPath(stateDir);
  if (!existsSync(jsonPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
    let keys: HmacKeys | null = null;
    // Legacy array format: [{ key, generation, createdAt, ... }]
    if (Array.isArray(raw) && raw.length >= 1) {
      const last = raw[raw.length - 1];
      if (last?.key) {
        keys = {
          version: 1,
          current: last.key,
          rotatedAt: last.createdAt ?? new Date().toISOString(),
        };
        if (raw.length >= 2) keys.previous = raw[raw.length - 2].key;
      }
    }
    // V1 object format: { current, previous?, rotatedAt, version? }
    if (!keys && raw.current) {
      keys = {
        version: 1,
        current: raw.current,
        previous: raw.previous,
        rotatedAt: raw.rotatedAt,
      };
      if (!keys.previous) delete keys.previous;
    }
    if (keys) {
      const toonPath = getToonPath(stateDir);
      writeFileSync(toonPath, serializeHmacToon(keys));
      return keys;
    }
  } catch { /* corrupted JSON — skip */ }
  return null;
}

/**
 * Load the full HmacKeys object (current + previous) from the state directory.
 * Creates a new key file if none exists. Migrates from .json on first load.
 */
export function loadHmacKeys(stateDir: string): HmacKeys {
  const toonPath = getToonPath(stateDir);
  // 1. Try TOON file first
  if (existsSync(toonPath)) {
    return parseHmacToon(readFileSync(toonPath, 'utf8'));
  }
  // 2. Migrate from legacy JSON if it exists
  const migrated = migrateFromJson(stateDir);
  if (migrated) return migrated;
  // 3. Create new keys
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
