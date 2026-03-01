/**
 * Phase registry - defines all 30+ phases and their configurations
 * @spec docs/spec/features/workflow-phases.md
 */
import type { PhaseConfig, PhaseName, TaskSize, ParallelGroupName } from '../state/types.js';
export declare const PHASE_REGISTRY: Record<PhaseName, PhaseConfig>;
export declare const PHASE_ORDER: PhaseName[];
export declare const SIZE_SKIP_MAP: Record<TaskSize, PhaseName[]>;
export declare function getActivePhases(size: TaskSize): PhaseName[];
export declare function getNextPhase(currentPhase: PhaseName, size: TaskSize): PhaseName | null;
export declare function getParallelGroup(phase: PhaseName): ParallelGroupName | null;
export declare function getPhasesInGroup(group: ParallelGroupName): PhaseName[];
export declare function isParallelPhase(phase: PhaseName): boolean;
export declare function getActiveParallelGroups(size: TaskSize): ParallelGroupName[];
export declare function getPhaseConfig(phase: PhaseName): PhaseConfig;
//# sourceMappingURL=registry.d.ts.map