/**
 * Retry prompt builder for failed artifact validation
 * @spec docs/spec/features/workflow-harness.md
 */

import type { DoDCheckResult } from '../gates/dod-types.js';
import { getActiveADRs } from './adr.js';

export interface RetryContext {
  phase: string;
  taskName: string;
  docsDir: string;
  retryCount: number;
  errorMessage: string;
  model: 'opus' | 'sonnet' | 'haiku';
}

export interface RetryPromptResult {
  prompt: string;
  suggestModelEscalation: boolean;
  suggestedModel: 'opus' | 'sonnet' | 'haiku';
  errorClass: 'FileNotFound' | 'SyntaxError' | 'LogicError' | 'Unknown'; // EAC-1
}

/** EAC-1 (S2-13): Classify validation error into 4 categories for targeted remediation */
function classifyError(msg: string): RetryPromptResult['errorClass'] {
  if (/[Ff]ile missing|not found|[Mm]issing input/i.test(msg)) return 'FileNotFound';
  if (/[Ff]orbidden|[Bb]racket placeholder|[Dd]uplicate lines|TOON parse|Markdown headers/i.test(msg)) return 'SyntaxError';
  if (/[Ss]ection density|[Cc]ontent lines|[Mm]issing required|AC-N|NOT_IN_SCOPE|OPEN_QUESTIONS|RTM entries|baseline/i.test(msg)) return 'LogicError';
  return 'Unknown';
}

/**
 * Parse validation error messages into actionable improvement instructions.
 * Maps error patterns to specific remediation recipes (OAI-6).
 */
function errorToImprovement(errorMessage: string): string[] {
  const improvements: string[] = [];

  // Forbidden patterns detected
  if (/[Ff]orbidden patterns? found/i.test(errorMessage)) {
    improvements.push('指摘された禁止語を削除し、具体的な実例に置き換えてください。禁止語を直接引用せず「バリデーターが検出した語句」等の間接参照を使うこと。');
  }

  // Section density too low
  if (/[Ss]ection density/i.test(errorMessage) || /density.*</i.test(errorMessage)) {
    improvements.push('該当セクションに実質的な内容を追加してください。構造要素（見出し・水平線・コードフェンス）ではなく、説明文・分析結果等の実質行を増やすこと。');
  }

  // Duplicate lines
  if (/[Dd]uplicate lines/i.test(errorMessage) || /times\)/i.test(errorMessage)) {
    improvements.push('繰り返されている行をそれぞれ異なる内容に書き換え、各行に文脈固有の情報を含めてください。');
  }

  // Missing required sections
  if (/[Mm]issing required sections/i.test(errorMessage)) {
    const sectionMatch = errorMessage.match(/Missing required sections:\s*(.+)/i);
    if (sectionMatch) {
      improvements.push('以下のセクションヘッダーを追加してください: ' + sectionMatch[1]);
    } else {
      improvements.push('必須セクションヘッダーが不足しています。成果物品質要件を確認してください。');
    }
  }

  // Content lines too few
  if (/[Cc]ontent lines.*</i.test(errorMessage) || /< required/i.test(errorMessage)) {
    improvements.push('成果物の実質行数を増やしてください。空行や構造要素ではなく、説明・分析・根拠等の実質行を追加すること。');
  }

  // Bracket placeholders
  if (/[Bb]racket placeholder/i.test(errorMessage)) {
    improvements.push('角括弧プレースホルダー [#xxx#] 形式を削除し、具体的な内容に置き換えてください。');
  }

  // Section content too few lines
  if (/has only \d+ content lines/i.test(errorMessage)) {
    improvements.push('各セクション内の実質行数を最低5行以上にしてください。太字ラベルのみの行や空行はカウントされません。');
  }

  // File missing
  if (/[Ff]ile missing/i.test(errorMessage)) {
    improvements.push('成果物ファイルが指定パスに存在しません。正しいパスに保存してください。');
  }

  if (/TOON parse/i.test(errorMessage) || /Markdown headers? detected/i.test(errorMessage))
    improvements.push('.toonファイルに ## ヘッダーやMarkdown記法を書かないこと。TOON形式は key: value のみ。全ての ## 行を削除し、TOON構文で書き直してください。');
  if (/non-zero exit code/i.test(errorMessage) || /exit code/i.test(errorMessage))
    improvements.push('コマンドの実行が失敗しました。エラー出力を確認し、問題を修正してください。');
  if (/RTM entries not at required status/i.test(errorMessage))
    improvements.push('RTMエントリのステータスを更新してください。harness_update_rtm_statusで各F-NNNのステータスをimplemented以上に更新すること。');
  if (/AC not met/i.test(errorMessage) || /AC still open/i.test(errorMessage))
    improvements.push('受入基準のステータスを更新してください。harness_update_ac_statusで各AC-Nのステータスをmetに更新すること。');
  if (/AC-N entries.*minimum 3/i.test(errorMessage))
    improvements.push('requirements.mdに最低3件のAC-N形式の受入基準を追加してください。形式: AC-1: <具体的な条件>');
  if (/NOT_IN_SCOPE/i.test(errorMessage) || /スコープ外/i.test(errorMessage))
    improvements.push('requirements.mdに ## NOT_IN_SCOPE セクションを追加し、スコープ外の項目を明示してください。');
  if (/OPEN_QUESTIONS/i.test(errorMessage))
    improvements.push('requirements.toonのopenQuestionsに未解決の質問が残っています。全て解決するか、openQuestions: なし に変更してください。');
  if (/No baseline captured/i.test(errorMessage))
    improvements.push('testingフェーズでharness_capture_baselineを実行してテストベースラインを記録してください。');
  // Generic fallback
  if (improvements.length === 0) {
    improvements.push('前回のバリデーション失敗を修正し、成果物品質要件を全て満たしてください。');
  }

  return improvements;
}

/**
 * Build a retry prompt for a failed subagent.
 * Includes the original error in a code block (reference only, not executable)
 * and specific improvement instructions.
 */
/** Extract structured fix instructions from DoDCheckResult[], falling back to regex */
function extractImprovements(errorMessage: string, checks?: DoDCheckResult[]): string[] {
  if (checks && checks.length > 0) {
    const fixes = checks.filter(c => !c.passed && c.fix).map(c => c.fix!);
    if (fixes.length > 0) return fixes;
  }
  return errorToImprovement(errorMessage);
}

/** Classify error using check field when available, falling back to regex */
function classifyFromChecks(errorMessage: string, checks?: DoDCheckResult[]): RetryPromptResult['errorClass'] {
  if (checks && checks.length > 0) {
    const failed = checks.filter(c => !c.passed);
    if (failed.some(c => c.check === 'output_file_exists' || c.check === 'input_files_exist')) return 'FileNotFound';
    if (failed.some(c => c.check === 'artifact_quality' || c.check === 'content_validation')) return 'SyntaxError';
    if (failed.length > 0) return 'LogicError';
  }
  return classifyError(errorMessage);
}

/** N-16: Classify error complexity for Plankton-pattern retry escalation */
export function classifyComplexity(
  checks: DoDCheckResult[],
  errorClass: RetryPromptResult['errorClass'],
): 'trivial' | 'moderate' | 'critical' {
  const failed = checks.filter(c => !c.passed);
  if (failed.length > 0) {
    if (failed.some(c => c.level === 'L1')) return 'critical';
    if (failed.some(c => c.level === 'L3')) return 'moderate';
    return 'trivial';
  }
  if (errorClass === 'FileNotFound') return 'critical';
  if (errorClass === 'LogicError') return 'moderate';
  if (errorClass === 'SyntaxError') return 'trivial';
  return 'trivial';
}

/** N-28: Map error patterns to ADR IDs for prioritized retry guidance */
export const ERROR_ADR_MAP: Record<string, string[]> = {
  'Forbidden patterns': ['ADR-FORBIDDEN'],
  'Section density': ['ADR-DENSITY'],
  'Missing required': ['ADR-STRUCTURE'],
  'File missing': ['ADR-OUTPUT'],
  'TOON parse': ['ADR-TOON'],
};

/** N-67: Format error in ERROR/WHY/FIX/EXAMPLE structure per article best practice */
export function formatStructuredError(
  error: string, file: string, adrIds: string[], fix: string,
): string {
  const adrRef = adrIds.length > 0 ? adrIds.join(', ') : 'N/A';
  return `ERROR: ${error}\n  ${file}\n  WHY: ${adrRef}\n  FIX: ${fix}`;
}

export function buildRetryPrompt(ctx: RetryContext, checks?: DoDCheckResult[]): RetryPromptResult {
  const improvements = extractImprovements(ctx.errorMessage, checks);
  const suggestModelEscalation = ctx.retryCount >= 2 && ctx.model === 'haiku';
  const errorClass = classifyFromChecks(ctx.errorMessage, checks);
  const complexity = classifyComplexity(checks ?? [], errorClass);
  const suggestedModel: 'opus' | 'sonnet' | 'haiku' =
    complexity === 'critical' ? 'opus' : complexity === 'moderate' ? 'sonnet' : 'haiku';
  const tag = '[' + complexity.toUpperCase() + ']';
  const mappedAdrIds = Object.entries(ERROR_ADR_MAP)
    .filter(([pat]) => ctx.errorMessage.includes(pat)).flatMap(([, ids]) => ids);
  let adrSection = '';
  try {
    const activeADRs = getActiveADRs();
    const prioritized = mappedAdrIds.length > 0
      ? [...activeADRs.filter(a => mappedAdrIds.includes(a.id)), ...activeADRs.filter(a => !mappedAdrIds.includes(a.id))]
      : activeADRs;
    if (prioritized.length > 0) {
      adrSection = '\n## 関連アーキテクチャ決定\n' + prioritized.slice(0, 3).map(a => `- ${a.id}: ${a.statement} — ${a.rationale}`).join('\n') + '\n';
    }
  } catch { /* ADR store unavailable — continue without */ }
  const structuredErrors = improvements.map((imp, i) => {
    return formatStructuredError(`DoD check #${i + 1} failed`, ctx.docsDir, mappedAdrIds.length > 0 ? mappedAdrIds : ['N/A'], imp);
  }).join('\n\n');
  const prompt = '# ' + tag + ' ' + ctx.phase + ' リトライ' + ctx.retryCount + '回目\n'
    + 'task:' + ctx.taskName + ' out:' + ctx.docsDir + '/\n\n'
    + '## 失敗理由(参照のみ・転記禁止)\n```\n' + ctx.errorMessage + '\n```\n'
    + '⚠️ 禁止語の転記=再失敗。間接参照のみ使用。\n\n'
    + '## 改善要求(ERROR/WHY/FIX形式)\n' + structuredErrors + '\n'
    + adrSection;
  return { prompt, suggestModelEscalation, suggestedModel, errorClass };
}
