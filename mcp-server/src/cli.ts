#!/usr/bin/env node
/**
 * CLI entry point for invariant operations.
 * Replaces MCP tools harness_add_invariant and harness_update_invariant_status.
 * @spec docs/spec/features/workflow-harness.md
 */

import { parseArgs } from 'node:util';
import { StateManager } from './state/manager.js';
import { validateSession } from './tools/handler-shared.js';
import type { Invariant } from './state/types-invariant.js';
import type { InvariantStatus, ProofTier } from './state/types.js';

export interface CliResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export async function runCli(argv: string[]): Promise<CliResult> {
  const subcommand = argv[0];
  if (!subcommand) return { success: false, error: 'No subcommand. Use: add-invariant | update-invariant-status' };

  const rest = argv.slice(1);

  switch (subcommand) {
    case 'add-invariant': return handleAddInvariant(rest);
    case 'update-invariant-status': return handleUpdateInvariantStatus(rest);
    default: return { success: false, error: 'Unknown subcommand: ' + subcommand };
  }
}

function handleAddInvariant(argv: string[]): CliResult {
  const { values } = parseArgs({
    args: argv,
    options: {
      taskId: { type: 'string' },
      id: { type: 'string' },
      description: { type: 'string' },
      proofTier: { type: 'string' },
      sessionToken: { type: 'string' },
    },
    strict: true,
  });

  if (!values.taskId || !values.id || !values.description || !values.sessionToken) {
    return { success: false, error: 'Required: --taskId, --id, --description, --sessionToken' };
  }

  const sm = new StateManager();
  const task = sm.loadTask(values.taskId);
  if (!task) return { success: false, error: 'Task not found: ' + values.taskId };

  const sessionErr = validateSession(task, values.sessionToken);
  if (sessionErr) return { success: false, error: sessionErr };

  const invariant: Invariant = { id: values.id, description: values.description, status: 'open' };
  if (values.proofTier) invariant.proofTier = values.proofTier as ProofTier;

  const ok = sm.addInvariant(values.taskId, invariant);
  if (!ok) return { success: false, error: 'Failed to add invariant (duplicate id?)' };

  return { success: true, data: { taskId: values.taskId, invariant, added: true } };
}

function handleUpdateInvariantStatus(argv: string[]): CliResult {
  const { values } = parseArgs({
    args: argv,
    options: {
      taskId: { type: 'string' },
      id: { type: 'string' },
      status: { type: 'string' },
      evidence: { type: 'string' },
      sessionToken: { type: 'string' },
    },
    strict: true,
  });

  if (!values.taskId || !values.id || !values.status || !values.sessionToken) {
    return { success: false, error: 'Required: --taskId, --id, --status, --sessionToken' };
  }

  if (!['open', 'held', 'violated'].includes(values.status)) {
    return { success: false, error: 'status must be open, held, or violated' };
  }

  const sm = new StateManager();
  const task = sm.loadTask(values.taskId);
  if (!task) return { success: false, error: 'Task not found: ' + values.taskId };

  const sessionErr = validateSession(task, values.sessionToken);
  if (sessionErr) return { success: false, error: sessionErr };

  const ok = sm.updateInvariantStatus(values.taskId, values.id, values.status as InvariantStatus, values.evidence);
  if (!ok) return { success: false, error: 'Invariant not found: ' + values.id };

  return { success: true, data: { taskId: values.taskId, id: values.id, status: values.status, updated: true } };
}

/* istanbul ignore next -- CLI entry point */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const result = await runCli(process.argv.slice(2));
  if (result.success) {
    process.stdout.write(JSON.stringify(result.data) + '\n');
  } else {
    process.stderr.write(JSON.stringify({ error: result.error }) + '\n');
    process.exitCode = 1;
  }
}
