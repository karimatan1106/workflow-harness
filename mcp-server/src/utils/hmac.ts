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

function getKeysPath(stateDir: string): string {
  return join(stateDir, 'hmac-keys.json');
}

/**
 * Load the full HmacKeys object (current + previous) from the state directory.
 * Creates a new key file if none exists.
 */
export function loadHmacKeys(stateDir: string): HmacKeys {
  const keysPath = getKeysPath(stateDir);
  if (existsSync(keysPath)) {
    const raw = JSON.parse(readFileSync(keysPath, 'utf8'));
    // Support legacy array format: [{ key, generation, ... }]
    if (Array.isArray(raw) && raw.length >= 1) {
      const last = raw[raw.length - 1];
      if (last?.key) {
        const migrated: HmacKeys = {
          version: 1,
          current: last.key,
          rotatedAt: last.createdAt ?? new Date().toISOString(),
        };
        if (raw.length >= 2) {
          migrated.previous = raw[raw.length - 2].key;
        }
        writeFileSync(keysPath, JSON.stringify(migrated, null, 2));
        return migrated;
      }
    }
    // Current format: { current, previous?, rotatedAt }
    if (raw.current) {
      // Migrate: add version field if missing
      if (!raw.version) {
        raw.version = 1;
        writeFileSync(keysPath, JSON.stringify(raw, null, 2));
      }
      return raw as HmacKeys;
    }
    // Fallback: regenerate if format is unrecognized
  }
  const dir = dirname(keysPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const newKey = randomBytes(32).toString('hex');
  const keys: HmacKeys = {
    version: 1,
    current: newKey,
    rotatedAt: new Date().toISOString(),
  };
  writeFileSync(keysPath, JSON.stringify(keys, null, 2));
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
