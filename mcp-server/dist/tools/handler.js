/**
 * MCP tool dispatcher - thin orchestrator importing from focused modules.
 * External interface unchanged: exports TOOL_DEFINITIONS and handleToolCall.
 * @spec docs/spec/features/workflow-harness.md
 */
import { TOOL_DEFS_A } from './defs-a.js';
import { TOOL_DEFS_B } from './defs-b.js';
import { respondError } from './handler-shared.js';
import { handleHarnessStart, handleHarnessStatus, handleHarnessNext } from './handlers/lifecycle.js';
import { handleHarnessApprove } from './handlers/approval.js';
import { handleHarnessSetScope, handleHarnessCompleteSub, handleHarnessBack, handleHarnessReset } from './handlers/scope-nav.js';
import { handleHarnessRecordProof, handleHarnessAddAc, handleHarnessAddRtm, handleHarnessRecordFeedback, handleHarnessCaptureBaseline, handleHarnessRecordTestResult, handleHarnessRecordTest } from './handlers/recording.js';
import { handleHarnessGetTestInfo, handleHarnessRecordKnownBug, handleHarnessGetKnownBugs, handleHarnessGetSubphaseTemplate, handleHarnessPreValidate, handleHarnessUpdateAcStatus, handleHarnessUpdateRtmStatus } from './handlers/query.js';
export const TOOL_DEFINITIONS = [...TOOL_DEFS_A, ...TOOL_DEFS_B];
export async function handleToolCall(name, args, stateManager) {
    try {
        switch (name) {
            case 'harness_start': return handleHarnessStart(args, stateManager);
            case 'harness_status': return handleHarnessStatus(args, stateManager);
            case 'harness_next': return handleHarnessNext(args, stateManager);
            case 'harness_approve': return handleHarnessApprove(args, stateManager);
            case 'harness_set_scope': return handleHarnessSetScope(args, stateManager);
            case 'harness_complete_sub': return handleHarnessCompleteSub(args, stateManager);
            case 'harness_back': return handleHarnessBack(args, stateManager);
            case 'harness_reset': return handleHarnessReset(args, stateManager);
            case 'harness_record_proof': return handleHarnessRecordProof(args, stateManager);
            case 'harness_add_ac': return handleHarnessAddAc(args, stateManager);
            case 'harness_add_rtm': return handleHarnessAddRtm(args, stateManager);
            case 'harness_record_feedback': return handleHarnessRecordFeedback(args, stateManager);
            case 'harness_capture_baseline': return handleHarnessCaptureBaseline(args, stateManager);
            case 'harness_record_test_result': return handleHarnessRecordTestResult(args, stateManager);
            case 'harness_record_test': return handleHarnessRecordTest(args, stateManager);
            case 'harness_get_test_info': return handleHarnessGetTestInfo(args, stateManager);
            case 'harness_record_known_bug': return handleHarnessRecordKnownBug(args, stateManager);
            case 'harness_get_known_bugs': return handleHarnessGetKnownBugs(args, stateManager);
            case 'harness_get_subphase_template': return handleHarnessGetSubphaseTemplate(args, stateManager);
            case 'harness_pre_validate': return handleHarnessPreValidate(args, stateManager);
            case 'harness_update_ac_status': return handleHarnessUpdateAcStatus(args, stateManager);
            case 'harness_update_rtm_status': return handleHarnessUpdateRtmStatus(args, stateManager);
            default: return respondError('Unknown tool: ' + name);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return respondError('Internal error in tool ' + JSON.stringify(name) + ': ' + message);
    }
}
//# sourceMappingURL=handler.js.map