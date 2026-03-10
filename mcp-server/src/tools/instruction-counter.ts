/**
 * N-93: IFScale instruction count checker.
 * Article: "150〜200 instructions cause primacy bias degradation."
 * Audits CLAUDE.md / AGENTS.md for instruction density.
 */

export interface InstructionAudit {
  file: string;
  totalLines: number;
  instructionLines: number;
  estimatedInstructions: number;
  status: 'good' | 'warning' | 'danger';
  recommendation?: string;
}

/** IFScale thresholds */
const THRESHOLDS = {
  good: 50,
  warning: 150,
  danger: 200,
} as const;

/** Patterns that count as instructions (imperative/directive sentences) */
const INSTRUCTION_PATTERNS = [
  /^[-*]\s+/,           // bullet points
  /^\d+\.\s+/,          // numbered lists
  /^[A-Z].*[.!:]\s*$/,  // imperative sentences
  /必ず|禁止|すること|してはいけない|しない|MUST|SHALL|NEVER|ALWAYS|DO NOT/i,
  /^\|.*\|$/,           // table rows (each row = ~1 instruction)
];

/** Count estimated instructions in a file */
export function countInstructions(content: string): number {
  const lines = content.split('\n');
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;
    if (INSTRUCTION_PATTERNS.some((p) => p.test(trimmed))) {
      count++;
    }
  }

  return count;
}

/** Audit a CLAUDE.md or AGENTS.md file */
export function auditInstructionFile(file: string, content: string): InstructionAudit {
  const totalLines = content.split('\n').length;
  const instructionLines = content.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).length;
  const estimatedInstructions = countInstructions(content);

  let status: InstructionAudit['status'];
  let recommendation: string | undefined;

  if (estimatedInstructions <= THRESHOLDS.good) {
    status = 'good';
  } else if (estimatedInstructions <= THRESHOLDS.warning) {
    status = 'warning';
    recommendation = `${estimatedInstructions} instructions detected. IFScale: degradation begins at ${THRESHOLDS.warning}. Consider consolidating.`;
  } else {
    status = 'danger';
    recommendation = `${estimatedInstructions} instructions exceeds IFScale danger zone (${THRESHOLDS.danger}). Refactor to pointer-based design (50 lines target).`;
  }

  return { file, totalLines, instructionLines, estimatedInstructions, status, recommendation };
}

/** Format audit result for display */
export function formatAudit(audit: InstructionAudit): string {
  const icon = audit.status === 'good' ? 'OK' : audit.status === 'warning' ? 'WARN' : 'DANGER';
  return `[${icon}] ${audit.file}: ${audit.estimatedInstructions} instructions (${audit.totalLines} lines)${audit.recommendation ? ` — ${audit.recommendation}` : ''}`;
}
