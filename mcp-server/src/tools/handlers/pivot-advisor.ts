/**
 * Pivot advisor: detect repeated DoD failure patterns and suggest direction changes.
 * P5 resilience — prevents infinite retry loops by recommending alternative approaches.
 * @spec docs/spec/features/workflow-harness.md
 */

export interface ErrorEntry {
  check: string;
  evidence: string;
  retryCount?: number;
}

export interface PivotSuggestion {
  shouldPivot: boolean;
  currentPattern: string;
  suggestion: string;
  rationale: string;
}

const SUGGESTION_TEMPLATES: Record<string, string> = {
  content_validation: '成果物の構造を根本的に見直す',
  artifact_quality: '出力フォーマットを変更する',
  tdd_red_evidence: 'テスト対象の関数シグネチャを確認する',
};

const DEFAULT_SUGGESTION = '異なるアプローチで再実装する';

/**
 * Detect a check name that fails across 3+ different retry attempts.
 * When entries have retryCount, groups by retryCount and finds checks
 * that appear in 3+ distinct retry groups.
 * Falls back to consecutive-streak detection when no retryCount is present.
 * Returns the repeated check name, or null if no such pattern exists.
 */
export function detectRepeatedPattern(errors: ErrorEntry[]): string | null {
  if (errors.length < 3) return null;

  const hasRetryInfo = errors.some(e => e.retryCount !== undefined);
  if (hasRetryInfo) {
    return detectCrossRetryPattern(errors);
  }
  return detectConsecutivePattern(errors);
}

function detectCrossRetryPattern(errors: ErrorEntry[]): string | null {
  const checkRetries = new Map<string, Set<number>>();
  for (const entry of errors) {
    const retry = entry.retryCount ?? 0;
    if (!checkRetries.has(entry.check)) {
      checkRetries.set(entry.check, new Set());
    }
    checkRetries.get(entry.check)!.add(retry);
  }
  for (const [check, retries] of checkRetries) {
    if (retries.size >= 3) return check;
  }
  return null;
}

function detectConsecutivePattern(errors: ErrorEntry[]): string | null {
  let currentCheck = errors[0].check;
  let streak = 1;
  for (let i = 1; i < errors.length; i++) {
    if (errors[i].check === currentCheck) {
      streak++;
      if (streak >= 3) return currentCheck;
    } else {
      currentCheck = errors[i].check;
      streak = 1;
    }
  }
  return null;
}

/**
 * Generate a pivot suggestion for a detected repeated failure pattern.
 * Provides category-specific remediation advice.
 */
export function generatePivotSuggestion(
  pattern: string,
  errors: ErrorEntry[],
): PivotSuggestion {
  const matchingErrors = errors.filter(e => e.check === pattern);
  const occurrences = matchingErrors.length;
  const suggestion = SUGGESTION_TEMPLATES[pattern] ?? DEFAULT_SUGGESTION;

  return {
    shouldPivot: true,
    currentPattern: `"${pattern}" が ${occurrences} 回連続で失敗`,
    suggestion,
    rationale:
      `同一チェック "${pattern}" が ${occurrences} 回連続失敗しており、`
      + '現在のアプローチでは解決困難と判断。方向転換を推奨。',
  };
}
