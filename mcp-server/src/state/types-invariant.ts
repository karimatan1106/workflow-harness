/**
 * Invariant type definitions for INV-N proof tier framework.
 * @spec docs/workflows/inv-n-proof-tier/spec.toon
 */

import type { ProofTier } from './types-core.js';

export type InvariantStatus = 'open' | 'held' | 'violated';

export const INVARIANT_STATUSES: readonly InvariantStatus[] = ['open', 'held', 'violated'] as const;

export interface Invariant {
  id: string;
  description: string;
  status: InvariantStatus;
  proofTier?: ProofTier;
  verifiedAt?: string;
  evidence?: string;
}

/** Runtime-accessible sentinel for import verification in tests. */
export const Invariant = 'Invariant' as const;
