/**
 * N-92: Token efficiency benchmark reference data.
 * Article-cited measurements for E2E testing tool selection.
 * These are reference values — not runtime measurements.
 */

/** Token consumption per E2E testing approach (article Section 5) */
export const E2E_TOKEN_BENCHMARKS = {
  /** Playwright MCP (Microsoft): ~114,000 tokens per typical task */
  playwrightMCP: {
    tool: 'Playwright MCP',
    tokensPerTask: 114_000,
    strengths: ['mature ecosystem', '3 sub-agents', 'CI-compatible'],
    weaknesses: ['MCP Tax (26+ tool definitions)', 'full a11y tree (3000+ nodes)'],
  },
  /** Playwright CLI (@playwright/cli): ~27,000 tokens (~4x better) */
  playwrightCLI: {
    tool: 'Playwright CLI',
    tokensPerTask: 27_000,
    efficiency: '4x vs MCP',
    strengths: ['CLI shell commands', 'file-system snapshots', 'long session friendly'],
  },
  /** agent-browser (Vercel Labs): ~5,500 chars for 6 tests (5.7x better) */
  agentBrowser: {
    tool: 'agent-browser',
    charsPerSixTests: 5_500,
    efficiency: '5.7x vs Playwright MCP',
    strengths: ['element references (@e1)', 'Rust CLI', 'token-constrained scenarios'],
    limitations: ['2 months old', 'rough on Windows'],
  },
} as const;

/** SWE-bench harness variance (Morph analysis, article Section 7) */
export const HARNESS_VARIANCE = {
  /** Same model, different harness = 22-point SWE-bench variance */
  harnessImpact: 22,
  /** Different model, same harness = ~1 point variance */
  modelImpact: 1,
  source: 'Morph analysis (article Section 7)',
} as const;

/** IFScale research: instruction following degradation thresholds */
export const IFSCALE_THRESHOLDS = {
  /** Primacy bias begins at 150-200 instructions */
  degradationStart: 150,
  degradationEnd: 200,
  /** Recommended CLAUDE.md target */
  recommendedLines: 50,
  /** Hard limit per Anthropic docs */
  hardLimit: 200,
  source: 'IFScale research (article Section 3)',
} as const;

/** Constitutional Classifiers overhead (article Section 5) */
export const CONSTITUTIONAL_OVERHEAD = {
  /** Additional rejection rate */
  rejectionIncrease: 0.0038,
  /** Inference overhead percentage */
  inferenceOverhead: 0.237,
  source: 'Anthropic Constitutional Classifiers paper',
} as const;

/** MCP Tool Search context savings (article Section 7) */
export const TOOL_SEARCH_SAVINGS = {
  /** Percentage reduction with opt-in loading */
  contextReduction: 0.85,
  /** Average tokens per tool definition */
  avgTokensPerTool: 150,
  source: 'Claude Code MCP Tool Search (article Section 7)',
} as const;
