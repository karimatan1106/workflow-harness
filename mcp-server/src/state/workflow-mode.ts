/**
 * Workflow execution mode (CBR-2 / express phase path).
 * @see workflow-harness/mcp-server/src/phases/registry.ts MODE_PHASES
 */
import { z } from 'zod';

export type WorkflowMode = 'express' | 'standard' | 'full';

export const WorkflowModeSchema = z.enum(['express', 'standard', 'full']);
