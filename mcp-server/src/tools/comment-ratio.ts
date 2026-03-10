/**
 * N-74: Comment-to-code ratio monitoring.
 * Detects AI-generated comment flooding (anti-pattern from article).
 */

export interface CommentRatioResult {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  ratio: number;
  status: 'good' | 'warning' | 'excessive';
}

/** Thresholds for comment-to-code ratio */
export const COMMENT_RATIO_THRESHOLDS = {
  /** Below this is healthy */
  good: 0.3,
  /** Above this triggers a warning */
  warning: 0.5,
} as const;

/** Analyze comment-to-code ratio for TypeScript/JavaScript files */
export function analyzeCommentRatio(source: string): CommentRatioResult {
  const lines = source.split('\n');
  let codeLines = 0;
  let commentLines = 0;
  let blankLines = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      blankLines++;
      continue;
    }

    if (inBlockComment) {
      commentLines++;
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      commentLines++;
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      commentLines++;
      continue;
    }

    codeLines++;
  }

  const ratio = codeLines > 0 ? Math.round((commentLines / codeLines) * 100) / 100 : 0;
  const status = ratio > COMMENT_RATIO_THRESHOLDS.warning
    ? 'excessive'
    : ratio > COMMENT_RATIO_THRESHOLDS.good
      ? 'warning'
      : 'good';

  return { totalLines: lines.length, codeLines, commentLines, blankLines, ratio, status };
}

/** Format comment ratio result for hook output */
export function formatCommentRatio(result: CommentRatioResult): string {
  if (result.status === 'good') return '';
  const pct = Math.round(result.ratio * 100);
  return `COMMENT_RATIO: ${pct}% (${result.commentLines}/${result.codeLines} lines) — ${result.status === 'excessive' ? 'EXCESSIVE: reduce comments' : 'consider reducing'}`;
}
