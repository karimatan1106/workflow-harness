/**
 * MCP tool dispatcher - thin orchestrator importing from focused modules.
 * External interface unchanged: exports TOOL_DEFINITIONS and handleToolCall.
 * @spec docs/spec/features/workflow-harness.md
 */

import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { StateManager } from '../state/manager.js';
import { TOOL_DEFS_A } from './defs-a.js';
import { TOOL_DEFS_B } from './defs-b.js';
import { TOOL_DEFS_C } from './defs-c.js';
import { respondError } from './handler-shared.js';
import { handleHarnessStart, handleHarnessStatus, handleHarnessNext } from './handlers/lifecycle.js';
import { handleHarnessApprove } from './handlers/approval.js';
import { handleHarnessSetScope, handleHarnessCompleteSub, handleHarnessBack, handleHarnessReset } from './handlers/scope-nav.js';
import { handleHarnessRecordProof, handleHarnessAddAc, handleHarnessAddRtm, handleHarnessRecordFeedback, handleHarnessCaptureBaseline, handleHarnessRecordTestResult, handleHarnessRecordTest } from './handlers/recording.js';
import { handleHarnessGetTestInfo, handleHarnessRecordKnownBug, handleHarnessGetKnownBugs, handleHarnessGetSubphaseTemplate, handleHarnessPreValidate, handleHarnessUpdateAcStatus, handleHarnessUpdateRtmStatus } from './handlers/query.js';
import { handleDciBuildIndex, handleDciQueryDocs, handleDciQueryFiles, handleDciValidate } from './handlers/dci.js';
import { handleDelegateCoordinator } from './handlers/delegate-coordinator.js';

export const TOOL_DEFINITIONS = [...TOOL_DEFS_A, ...TOOL_DEFS_B, ...TOOL_DEFS_C];

const LOG_PATH = join(process.cwd(), '.agent', 'mcp-debug.log');

function logMcpDebug(entry: {
  timestamp: string;
  toolName: string;
  requestSize: number;
  responseSize: number;
  durationMs: number;
  error: boolean;
}): void {
  try {
    mkdirSync(join(process.cwd(), '.agent'), { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // ログ書き込み失敗はツール実行に影響させない
  }
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  stateManager: StateManager,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const start = Date.now();
  const requestSize = JSON.stringify(args).length;
  let isError = false;
  let result: { content: Array<{ type: string; text: string }> } = respondError('Unknown tool: ' + name);
  try {
    switch (name) {
      case 'harness_start':              result = await handleHarnessStart(args, stateManager); break;
      case 'harness_status':             result = await handleHarnessStatus(args, stateManager); break;
      case 'harness_next':               result = await handleHarnessNext(args, stateManager); break;
      case 'harness_approve':            result = await handleHarnessApprove(args, stateManager); break;
      case 'harness_set_scope':          result = await handleHarnessSetScope(args, stateManager); break;
      case 'harness_complete_sub':       result = await handleHarnessCompleteSub(args, stateManager); break;
      case 'harness_back':               result = await handleHarnessBack(args, stateManager); break;
      case 'harness_reset':              result = await handleHarnessReset(args, stateManager); break;
      case 'harness_record_proof':       result = await handleHarnessRecordProof(args, stateManager); break;
      case 'harness_add_ac':             result = await handleHarnessAddAc(args, stateManager); break;
      case 'harness_add_rtm':            result = await handleHarnessAddRtm(args, stateManager); break;
      case 'harness_record_feedback':    result = await handleHarnessRecordFeedback(args, stateManager); break;
      case 'harness_capture_baseline':   result = await handleHarnessCaptureBaseline(args, stateManager); break;
      case 'harness_record_test_result': result = await handleHarnessRecordTestResult(args, stateManager); break;
      case 'harness_record_test':        result = await handleHarnessRecordTest(args, stateManager); break;
      case 'harness_get_test_info':      result = await handleHarnessGetTestInfo(args, stateManager); break;
      case 'harness_record_known_bug':   result = await handleHarnessRecordKnownBug(args, stateManager); break;
      case 'harness_get_known_bugs':     result = await handleHarnessGetKnownBugs(args, stateManager); break;
      case 'harness_get_subphase_template': result = await handleHarnessGetSubphaseTemplate(args, stateManager); break;
      case 'harness_pre_validate':       result = await handleHarnessPreValidate(args, stateManager); break;
      case 'harness_update_ac_status':   result = await handleHarnessUpdateAcStatus(args, stateManager); break;
      case 'harness_update_rtm_status':  result = await handleHarnessUpdateRtmStatus(args, stateManager); break;
      case 'dci_build_index':            result = await handleDciBuildIndex(args); break;
      case 'dci_query_docs':             result = await handleDciQueryDocs(args); break;
      case 'dci_query_files':            result = await handleDciQueryFiles(args); break;
      case 'dci_validate':               result = await handleDciValidate(); break;
      case 'harness_delegate_coordinator': result = await handleDelegateCoordinator(args, stateManager); break;
    }
  } catch (err) {
    isError = true;
    const message = err instanceof Error ? err.message : String(err);
    result = respondError('Internal error in tool ' + JSON.stringify(name) + ': ' + message);
  }
  logMcpDebug({
    timestamp: new Date().toISOString(),
    toolName: name,
    requestSize,
    responseSize: JSON.stringify(result).length,
    durationMs: Date.now() - start,
    error: isError,
  });
  return result;
}
