/**
 * Retry prompt builder for failed artifact validation
 * @spec docs/spec/features/workflow-harness.md
 */
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
    errorClass: 'FileNotFound' | 'SyntaxError' | 'LogicError' | 'Unknown';
}
/**
 * Build a retry prompt for a failed subagent.
 * Includes the original error in a code block (reference only, not executable)
 * and specific improvement instructions.
 */
export declare function buildRetryPrompt(ctx: RetryContext): RetryPromptResult;
//# sourceMappingURL=retry.d.ts.map