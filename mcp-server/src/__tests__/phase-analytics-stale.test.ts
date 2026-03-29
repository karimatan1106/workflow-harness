import { describe, it, expect } from 'vitest';
import type { AnalyticsResult } from '../tools/phase-analytics.js';

// buildAnalytics requires a full TaskState + timings, so we test the output format
// by calling buildAnalytics with a mock that has a completed phase exceeding 3600s

describe('completed phase stale detection', () => {
  describe('TC-AC8-01: completed phase >3600s triggers warning', () => {
    it('should output stale warning for completed phase exceeding 3600s', async () => {
      const { buildAnalytics } = await import('../tools/phase-analytics.js');

      // Minimal TaskState mock with a completed task
      const mockTask = {
        taskId: 'test-id',
        taskName: 'test-task',
        currentPhase: 'completed',
        docsDir: 'docs/workflows/test-task',
        phases: {},
      } as any;

      // PhaseTimingsResult mock with completed phase at 4000s
      const mockTimings = {
        phaseTimings: {
          completed: { duration: 4000, current: false },
        },
        totalElapsed: 4000,
      } as any;

      const result: AnalyticsResult = buildAnalytics(mockTask, mockTimings);
      const adviceText = result.advice.join('\n');
      expect(adviceText).toMatch(/滞留|stale|3600/);
    });
  });

  describe('TC-AC8-02: completed phase <=3599s does not trigger warning', () => {
    it('should not output stale warning for completed phase at 3599s', async () => {
      const { buildAnalytics } = await import('../tools/phase-analytics.js');

      const mockTask = {
        taskId: 'test-id',
        taskName: 'test-task',
        currentPhase: 'completed',
        docsDir: 'docs/workflows/test-task',
        phases: {},
      } as any;

      const mockTimings = {
        phaseTimings: {
          completed: { duration: 3599, current: false },
        },
        totalElapsed: 3599,
      } as any;

      const result: AnalyticsResult = buildAnalytics(mockTask, mockTimings);
      const adviceText = result.advice.join('\n');
      expect(adviceText).not.toMatch(/滞留.*3600|stale.*3600/);
    });
  });
});
