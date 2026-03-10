/**
 * N-72: Context compression metrics.
 * Tracks token savings from MCP Tool Search and other context optimizations.
 */

export interface ContextSnapshot {
  timestamp: string;
  phase: string;
  estimatedTokens: number;
  mcpToolsLoaded: number;
  mcpToolsAvailable: number;
  savedByToolSearch: number;
}

export interface ContextMetrics {
  snapshots: ContextSnapshot[];
  totalSaved: number;
  avgCompressionRatio: number;
}

/** Estimate token count from character count (rough: 1 token ≈ 4 chars) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Calculate token savings from MCP Tool Search (85% reduction per article) */
export function calcToolSearchSavings(
  totalTools: number,
  loadedTools: number,
  avgToolDefTokens: number = 150,
): number {
  const deferredTools = totalTools - loadedTools;
  return deferredTools * avgToolDefTokens;
}

/** Calculate compression ratio */
export function compressionRatio(original: number, compressed: number): number {
  if (original === 0) return 1;
  return Math.round((1 - compressed / original) * 100) / 100;
}

/** Format context metrics summary */
export function formatContextSummary(metrics: ContextMetrics): string {
  return `Context: ${metrics.snapshots.length} snapshots, ${metrics.totalSaved} tokens saved, ${Math.round(metrics.avgCompressionRatio * 100)}% avg compression`;
}
