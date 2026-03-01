/**
 * DoD L4 commit-phase checks: DEP-1 (S3-9) package.json/lock sync.
 * @spec docs/spec/features/workflow-harness.md
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
const SYNC_TOLERANCE_MS = 60_000; // 60 seconds tolerance
/**
 * DEP-1 (S3-9): Detect when package.json is newer than package-lock.json.
 * Accepts optional cwd for testability.
 */
export function checkPackageLockSync(phase, cwd) {
    if (phase !== 'commit') {
        return { level: 'L4', check: 'package_lock_sync', passed: true, evidence: 'Package lock sync check only applicable for commit phase' };
    }
    const root = cwd ?? process.cwd();
    const pkgPath = join(root, 'package.json');
    const lockPath = join(root, 'package-lock.json');
    if (!existsSync(pkgPath) || !existsSync(lockPath)) {
        return { level: 'L4', check: 'package_lock_sync', passed: true, evidence: 'package.json or package-lock.json not found; sync check skipped' };
    }
    const pkgMtime = statSync(pkgPath).mtimeMs;
    const lockMtime = statSync(lockPath).mtimeMs;
    const deltaMs = pkgMtime - lockMtime;
    if (deltaMs > SYNC_TOLERANCE_MS) {
        return {
            level: 'L4', check: 'package_lock_sync', passed: false,
            evidence: `package.json modified ${Math.round(deltaMs / 1000)}s after package-lock.json. Run npm install to sync lock file. (DEP-1)`,
        };
    }
    return { level: 'L4', check: 'package_lock_sync', passed: true, evidence: 'package.json and package-lock.json are synchronized (DEP-1)' };
}
//# sourceMappingURL=dod-l4-commit.js.map