/**
 * N-97: Error message structure validator.
 * Ensures custom linter/rule messages follow ERROR/WHY/FIX format (N-67).
 * Article: error messages must contain actionable fix instructions with ADR refs.
 */

export interface ErrorMessageAudit {
  message: string;
  hasError: boolean;
  hasWhy: boolean;
  hasFix: boolean;
  hasAdrRef: boolean;
  valid: boolean;
  missing: string[];
}

/** Required components in structured error messages */
const REQUIRED_COMPONENTS = [
  { key: 'ERROR:', field: 'hasError' as const },
  { key: 'WHY:', field: 'hasWhy' as const },
  { key: 'FIX:', field: 'hasFix' as const },
] as const;

/** Validate a structured error message follows ERROR/WHY/FIX format */
export function validateErrorMessage(message: string): ErrorMessageAudit {
  const hasError = /ERROR:|error:/i.test(message);
  const hasWhy = /WHY:|why:/i.test(message);
  const hasFix = /FIX:|fix:/i.test(message);
  const hasAdrRef = /ADR-\w+/i.test(message);

  const missing: string[] = [];
  if (!hasError) missing.push('ERROR:');
  if (!hasWhy) missing.push('WHY:');
  if (!hasFix) missing.push('FIX:');

  return {
    message,
    hasError,
    hasWhy,
    hasFix,
    hasAdrRef,
    valid: hasError && hasWhy && hasFix,
    missing,
  };
}

/** Validate multiple error messages and return summary */
export function auditErrorMessages(messages: string[]): {
  total: number;
  valid: number;
  invalid: number;
  results: ErrorMessageAudit[];
} {
  const results = messages.map(validateErrorMessage);
  return {
    total: messages.length,
    valid: results.filter((r) => r.valid).length,
    invalid: results.filter((r) => !r.valid).length,
    results,
  };
}

/** Format audit result for display */
export function formatErrorAudit(audit: ErrorMessageAudit): string {
  if (audit.valid) return '';
  return `INVALID_ERROR_MSG: missing ${audit.missing.join(', ')} — "${audit.message.slice(0, 60)}..."`;
}
