/**
 * DoD L2 hearing phase check: validate userResponse key exists.
 * Ensures hearing-worker used AskUserQuestion tool to capture user intent.
 * @spec docs/spec/features/workflow-harness.md
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolveProjectPath } from '../utils/project-root.js';
import type { DoDCheckResult } from './dod-types.js';

/** Hearing phase must contain userResponse: key to prove AskUserQuestion was used */
export function checkHearingUserResponse(phase: string, docsDir: string): DoDCheckResult {
  if (phase !== 'hearing') {
    return {
      level: 'L2',
      check: 'hearing_user_response',
      passed: true,
      evidence: 'userResponse check not required for phase: ' + phase,
    };
  }
  const outputFile = resolveProjectPath(`${docsDir}/hearing.md`);
  if (!existsSync(outputFile)) {
    return {
      level: 'L2',
      check: 'hearing_user_response',
      passed: false,
      evidence: 'Hearing artifact not found: ' + outputFile,
      fix: 'hearing.mdを作成してください。AskUserQuestionツールでユーザーに確認し、userResponse:キーに回答を記録してください。',
    };
  }
  const content = readFileSync(outputFile, 'utf8');
  const hasUserResponse = /^userResponse:/m.test(content);
  return {
    level: 'L2',
    check: 'hearing_user_response',
    passed: hasUserResponse,
    evidence: hasUserResponse
      ? 'userResponse: key found in hearing artifact'
      : 'userResponse: key missing from hearing artifact',
    ...(!hasUserResponse && {
      fix: 'hearing.mdにuserResponse:キーがありません。AskUserQuestionツールでユーザーの意図を確認し、回答をuserResponse:キーとして記録してください。',
      example: 'userResponse: ユーザーからの回答内容をここに記載',
    }),
  };
}
