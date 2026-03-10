/**
 * N-61: Garbage collection agent tests.
 */
import { describe, it, expect } from 'vitest';
import { GC_RULES, shouldRunToday, getTodayRules } from '../tools/garbage-collector.js';

describe('garbage-collector (N-61)', () => {
  it('defines 5 GC rules', () => {
    expect(GC_RULES).toHaveLength(5);
  });

  it('all rules have required fields', () => {
    for (const rule of GC_RULES) {
      expect(rule.name).toBeTruthy();
      expect(rule.description.length).toBeGreaterThan(10);
      expect(['dead-code', 'unused-export', 'stale-doc', 'broken-pointer', 'duplicate-file']).toContain(rule.detector);
      expect(['warn', 'pr', 'delete']).toContain(rule.action);
      expect(['daily', 'weekly']).toContain(rule.schedule);
    }
  });

  it('daily rules run every day', () => {
    const daily = GC_RULES.find((r) => r.schedule === 'daily');
    if (daily) {
      for (let d = 0; d < 7; d++) {
        expect(shouldRunToday(daily, d)).toBe(true);
      }
    }
  });

  it('weekly rules run only on Friday (day 5)', () => {
    const weekly = GC_RULES.find((r) => r.schedule === 'weekly');
    expect(weekly).toBeDefined();
    expect(shouldRunToday(weekly!, 5)).toBe(true);
    expect(shouldRunToday(weekly!, 1)).toBe(false);
    expect(shouldRunToday(weekly!, 0)).toBe(false);
  });

  it('getTodayRules returns daily rules on non-Friday', () => {
    const monday = getTodayRules(1);
    const dailyCount = GC_RULES.filter((r) => r.schedule === 'daily').length;
    expect(monday).toHaveLength(dailyCount);
  });

  it('getTodayRules returns all rules on Friday', () => {
    const friday = getTodayRules(5);
    expect(friday).toHaveLength(GC_RULES.length);
  });

  it('broken-pointers rule runs daily', () => {
    const bp = GC_RULES.find((r) => r.name === 'broken-pointers');
    expect(bp).toBeDefined();
    expect(bp!.schedule).toBe('daily');
    expect(bp!.action).toBe('pr');
  });
});
