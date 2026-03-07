/**
 * Recording handlers: record_proof, add_ac, add_rtm, record_feedback,
 * capture_baseline, record_test_result, record_test.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { StateManager } from '../../state/manager.js';
import type { PhaseName, ProofEntry, ControlLevel, AcceptanceCriterion, RTMEntry } from '../../state/types.js';
import { respond, respondError, validateSession, type HandlerResult } from '../handler-shared.js';

export async function handleHarnessRecordProof(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const entry: ProofEntry = { phase: task.phase as PhaseName, level: String(args.level ?? 'L1') as ControlLevel, check: String(args.check ?? ''), result: Boolean(args.result), evidence: String(args.evidence ?? ''), timestamp: new Date().toISOString() };
  const ok = sm.addProof(taskId, entry);
  if (!ok) return respondError('Failed to record proof entry');
  return respond({ recorded: true, entry });
}

export async function handleHarnessAddAc(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const id = String(args.id ?? '');
  const description = String(args.description ?? '');
  if (!taskId) return respondError('taskId is required');
  if (!id) return respondError('id is required');
  if (!description) return respondError('description is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const criterion: AcceptanceCriterion = { id, description, status: 'open' };
  const acOk = sm.addAcceptanceCriterion(taskId, criterion);
  if (!acOk) return respondError('Failed to add acceptance criterion');
  sm.addProof(taskId, { phase: task.phase as PhaseName, level: 'L4' as ControlLevel, check: 'AC defined: ' + id, result: true, evidence: description, timestamp: new Date().toISOString() });
  return respond({ taskId, ac: criterion, added: true });
}

export async function handleHarnessAddRtm(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const id = String(args.id ?? '');
  const requirement = String(args.requirement ?? '');
  if (!taskId) return respondError('taskId is required');
  if (!id) return respondError('id is required');
  if (!requirement) return respondError('requirement is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const rtmEntry: RTMEntry = { id, requirement, designRef: args.designRef ? String(args.designRef) : '', codeRef: args.codeRef ? String(args.codeRef) : '', testRef: args.testRef ? String(args.testRef) : '', status: 'pending' };
  const rtmOk = sm.addRTMEntry(taskId, rtmEntry);
  if (!rtmOk) return respondError('Failed to add RTM entry');
  sm.addProof(taskId, { phase: task.phase as PhaseName, level: 'L4' as ControlLevel, check: 'RTM entry: ' + id, result: true, evidence: JSON.stringify(rtmEntry), timestamp: new Date().toISOString() });
  return respond({ taskId, rtmEntry, added: true });
}

export async function handleHarnessRecordFeedback(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const feedback = String(args.feedback ?? '');
  if (!taskId) return respondError('taskId is required');
  if (!feedback) return respondError('feedback is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const fbOk = sm.recordFeedback(taskId, feedback);
  if (!fbOk) return respondError('Failed to record feedback');
  sm.addProof(taskId, { phase: task.phase as PhaseName, level: 'L4' as ControlLevel, check: 'user feedback appended', result: true, evidence: feedback, timestamp: new Date().toISOString() });
  return respond({ taskId, feedbackAppended: true, feedbackSnippet: feedback.slice(0, 100) });
}

export async function handleHarnessCaptureBaseline(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const totalTests = Number(args.totalTests ?? 0);
  const passedTests = Number(args.passedTests ?? 0);
  const failedTests = Array.isArray(args.failedTests) ? (args.failedTests as string[]) : [];
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const blOk = sm.recordBaseline(taskId, totalTests, passedTests, failedTests);
  if (!blOk) return respondError('Failed to record baseline');
  const baseline = { totalTests, passedTests, failedTests, capturedAt: new Date().toISOString() };
  sm.addProof(taskId, { phase: task.phase as PhaseName, level: 'L2' as ControlLevel, check: 'test baseline captured', result: true, evidence: JSON.stringify(baseline), timestamp: new Date().toISOString() });
  return respond({ taskId, baseline, recorded: true });
}

export async function handleHarnessRecordTestResult(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const exitCode = Number(args.exitCode ?? -1);
  const output = String(args.output ?? '');
  const summary = args.summary ? String(args.summary) : '';
  if (output.length < 50) return respondError('output must be at least 50 characters long');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const trOk = sm.recordTestResult(taskId, exitCode, output, summary || undefined);
  if (!trOk) return respondError('Failed to record test result');
  sm.addProof(taskId, { phase: task.phase as PhaseName, level: 'L2' as ControlLevel, check: 'test execution (exitCode=' + exitCode + ')', result: exitCode === 0, evidence: summary ? (summary + '\n\n' + output.slice(0, 500)) : output.slice(0, 500), timestamp: new Date().toISOString() });
  return respond({ taskId, exitCode, passed: exitCode === 0, summary, recorded: true });
}

export async function handleHarnessRecordTest(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const testFile = String(args.testFile ?? '');
  if (!taskId) return respondError('taskId is required');
  if (!testFile) return respondError('testFile is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const ok = sm.recordTestFile(taskId, testFile);
  if (!ok) return respondError('Failed to record test file');
  return respond({ taskId, testFile, recorded: true });
}

