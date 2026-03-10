import { describe, it, expect } from 'vitest';
import {
  MVH_ROADMAP,
  getMVHProgress,
  getMilestonesByStage,
  getPendingMilestones,
} from '../tools/mvh-roadmap.js';

describe('MVH Roadmap', () => {
  it('has 17 milestones across 4 stages', () => {
    expect(MVH_ROADMAP).toHaveLength(17);
    const stages = new Set(MVH_ROADMAP.map(m => m.stage));
    expect(stages.size).toBe(4);
    expect(stages).toContain('week1');
    expect(stages).toContain('week2-4');
    expect(stages).toContain('month2-3');
    expect(stages).toContain('month3+');
  });

  it('all milestones have unique IDs', () => {
    const ids = MVH_ROADMAP.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all milestones have non-empty evidence', () => {
    for (const m of MVH_ROADMAP) {
      expect(m.evidence.length).toBeGreaterThan(0);
    }
  });

  it('getMVHProgress returns correct counts', () => {
    const progress = getMVHProgress();
    expect(progress.total).toBe(17);
    expect(progress.implemented).toBeGreaterThan(10);
    expect(progress.percentage).toBeGreaterThan(50);
    expect(progress.implemented).toBeLessThanOrEqual(progress.total);
  });

  it('getMVHProgress byStage sums to total', () => {
    const progress = getMVHProgress();
    const stageTotal = Object.values(progress.byStage).reduce(
      (sum, s) => sum + s.total,
      0,
    );
    expect(stageTotal).toBe(progress.total);
  });

  it('week1 milestones are all implemented', () => {
    const week1 = MVH_ROADMAP.filter(m => m.stage === 'week1');
    expect(week1.length).toBe(4);
    expect(week1.every(m => m.implemented)).toBe(true);
  });

  it('getMilestonesByStage filters correctly', () => {
    const week1 = getMilestonesByStage('week1');
    expect(week1.length).toBe(4);
    expect(week1.every(m => m.stage === 'week1')).toBe(true);
  });

  it('getPendingMilestones returns only not-implemented', () => {
    const pending = getPendingMilestones();
    expect(pending.every(m => !m.implemented)).toBe(true);
    expect(pending.length).toBe(2); // MVH-07, MVH-17
  });
});
