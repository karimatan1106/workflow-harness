/**
 * N-86: Agent evaluation platform scaffold.
 * Multi-agent tracing and evaluation beyond promptfoo.
 * Supports Maxim AI, LangSmith, Arize Phoenix, Langfuse.
 */

/** Evaluation platform configuration */
export interface AgentEvalPlatform {
  name: string;
  type: 'tracing' | 'evaluation' | 'both';
  endpoint: string;
  apiKeyEnv: string;
  features: string[];
}

/** Supported agent evaluation platforms */
export const AGENT_EVAL_PLATFORMS: Record<string, AgentEvalPlatform> = {
  langfuse: {
    name: 'Langfuse',
    type: 'both',
    endpoint: process.env['LANGFUSE_HOST'] ?? 'https://cloud.langfuse.com',
    apiKeyEnv: 'LANGFUSE_SECRET_KEY',
    features: ['tracing', 'scoring', 'datasets', 'prompt-management', 'self-hosted'],
  },
  langsmith: {
    name: 'LangSmith',
    type: 'both',
    endpoint: 'https://api.smith.langchain.com',
    apiKeyEnv: 'LANGSMITH_API_KEY',
    features: ['tracing', 'evaluation', 'datasets', 'hub', 'annotation-queues'],
  },
  arize: {
    name: 'Arize Phoenix',
    type: 'both',
    endpoint: process.env['PHOENIX_HOST'] ?? 'http://localhost:6006',
    apiKeyEnv: 'PHOENIX_API_KEY',
    features: ['tracing', 'evals', 'embeddings', 'drift-detection', 'local-mode'],
  },
  maxim: {
    name: 'Maxim AI',
    type: 'evaluation',
    endpoint: 'https://api.getmaxim.ai',
    apiKeyEnv: 'MAXIM_API_KEY',
    features: ['agent-evaluation', 'workflow-testing', 'regression-testing'],
  },
} as const;

/** Trace span structure for harness phase transitions */
export interface HarnessTraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  phase: string;
  taskId: string;
  startTime: string;
  endTime?: string;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
}

/** Evaluation metric definitions for harness quality */
export const HARNESS_EVAL_METRICS = {
  phaseCompletionRate: {
    name: 'Phase Completion Rate',
    description: 'Percentage of phases that pass DoD on first attempt',
    type: 'percentage' as const,
    threshold: 0.7,
  },
  retryEfficiency: {
    name: 'Retry Efficiency',
    description: 'Ratio of successful retries to total retries',
    type: 'percentage' as const,
    threshold: 0.8,
  },
  intentAccuracy: {
    name: 'Intent Accuracy',
    description: 'How well the final output matches the original user intent',
    type: 'score' as const,
    threshold: 0.85,
  },
  artifactQuality: {
    name: 'Artifact Quality',
    description: 'L1-L4 gate pass rate across all artifacts',
    type: 'percentage' as const,
    threshold: 0.9,
  },
} as const;
