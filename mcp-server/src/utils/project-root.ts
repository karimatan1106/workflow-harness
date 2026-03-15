/**
 * Shared utility: detect the project root directory.
 * Handles submodule detection (uses superproject root when inside a submodule).
 */

import { execSync } from 'node:child_process';

export function getProjectRoot(): string {
  try {
    // If running inside a submodule, get the parent project root
    const superproject = execSync('git rev-parse --show-superproject-working-tree', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (superproject) return superproject;
    // Otherwise, get the current repo root
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return process.cwd();
  }
}
