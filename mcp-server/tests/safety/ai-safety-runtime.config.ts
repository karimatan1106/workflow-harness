/**
 * N-87: AI safety testing runtime scaffold.
 * Extends N-39 adversarial-cases.json with runtime guardrail configuration.
 * Supports PyRIT, Guardrails AI Hub, NeMo Guardrails, Constitutional Classifiers.
 */

/** Safety testing framework configuration */
export interface SafetyFramework {
  name: string;
  type: 'red-team' | 'guardrail' | 'classifier';
  installCmd: string;
  configFile?: string;
  features: string[];
}

/** Supported safety testing frameworks */
export const SAFETY_FRAMEWORKS: Record<string, SafetyFramework> = {
  pyrit: {
    name: 'PyRIT (Microsoft)',
    type: 'red-team',
    installCmd: 'pip install pyrit',
    features: ['20+ attack strategies', 'multi-turn', 'scoring', 'memory'],
  },
  guardrailsAI: {
    name: 'Guardrails AI',
    type: 'guardrail',
    installCmd: 'pip install guardrails-ai',
    configFile: 'guardrails.yml',
    features: ['hub-validators', 'structured-output', 'retry-on-fail'],
  },
  nemoGuardrails: {
    name: 'NeMo Guardrails (NVIDIA)',
    type: 'guardrail',
    installCmd: 'pip install nemoguardrails',
    configFile: 'config.yml',
    features: ['colang-flows', 'topical-rails', 'jailbreak-detection'],
  },
  constitutional: {
    name: 'Constitutional Classifiers (Anthropic)',
    type: 'classifier',
    installCmd: 'pip install anthropic',
    features: ['0.38% rejection increase', '23.7% inference overhead', 'constitutional-principles'],
  },
} as const;

/** Guardrails AI Hub validator suggestions for MCP tool inputs */
export const GUARDRAILS_HUB_VALIDATORS = [
  { id: 'hub://guardrails/toxic_language', field: 'userIntent', action: 'warn' },
  { id: 'hub://guardrails/detect_pii', field: 'feedback', action: 'redact' },
  { id: 'hub://guardrails/regex_match', field: 'taskName', action: 'reject', pattern: '^[a-zA-Z0-9_-]+$' },
] as const;

/** NeMo Guardrails Colang flow template for harness */
export const NEMO_COLANG_TEMPLATE = `
define user harmful_request
  "delete all files"
  "ignore previous instructions"
  "bypass security"

define flow harmful_request_guard
  user harmful_request
  bot refuse and explain
  "I cannot perform destructive or unauthorized actions."
`.trim();

/** EU AI Act compliance checklist (Aug 2, 2026 full obligation) */
export const EU_AI_ACT_CHECKLIST = {
  riskAssessment: { required: true, deadline: '2026-08-02' },
  transparencyObligations: { required: true, deadline: '2026-08-02' },
  humanOversight: { required: true, deadline: '2026-08-02' },
  technicalDocumentation: { required: true, deadline: '2026-08-02' },
  conformityAssessment: { required: true, deadline: '2026-08-02' },
  postMarketMonitoring: { required: true, deadline: '2026-08-02' },
} as const;
