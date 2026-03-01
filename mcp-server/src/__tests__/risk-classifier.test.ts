/**
 * Tests for calculateRiskScore (risk-classifier.ts)
 */

import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../phases/risk-classifier.js';

// ─── calculateRiskScore ──────────────────────────

describe('calculateRiskScore', () => {
  it('returns total 0 for a completely empty input', () => {
    const result = calculateRiskScore({
      fileCount: 0,
      hasTests: false,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(0);
  });

  it('adds 1 point when fileCount is between 2 and 4 (inclusive)', () => {
    const result = calculateRiskScore({
      fileCount: 2,
      hasTests: false,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(1);
  });

  it('adds 2 points when fileCount is between 5 and 9 (inclusive)', () => {
    const result = calculateRiskScore({
      fileCount: 5,
      hasTests: false,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(2);
  });

  it('adds 3 points when fileCount is 10 or more', () => {
    const result = calculateRiskScore({
      fileCount: 10,
      hasTests: false,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(3);
  });

  it('adds 0 fileCount points when fileCount is 1', () => {
    const result = calculateRiskScore({
      fileCount: 1,
      hasTests: false,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(0);
  });

  it('adds 2 points for infrastructure flag', () => {
    const result = calculateRiskScore({
      fileCount: 0,
      hasTests: false,
      hasConfig: false,
      hasInfra: true,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(2);
  });

  it('adds 2 points for security flag', () => {
    const result = calculateRiskScore({
      fileCount: 0,
      hasTests: false,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: true,
      hasDatabase: false,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(2);
  });

  it('adds 1 point for database flag', () => {
    const result = calculateRiskScore({
      fileCount: 0,
      hasTests: false,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: true,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(1);
  });

  it('adds 1 point for config flag', () => {
    const result = calculateRiskScore({
      fileCount: 0,
      hasTests: false,
      hasConfig: true,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(1);
  });

  it('adds 1 point for hasTests flag', () => {
    const result = calculateRiskScore({
      fileCount: 0,
      hasTests: true,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 0,
    });
    expect(result.total).toBe(1);
  });

  it('adds 1 point for codeLineEstimate between 200 and 999', () => {
    const result = calculateRiskScore({
      fileCount: 0,
      hasTests: false,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 200,
    });
    expect(result.total).toBe(1);
  });

  it('adds 2 points for codeLineEstimate of 1000 or more', () => {
    const result = calculateRiskScore({
      fileCount: 0,
      hasTests: false,
      hasConfig: false,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 1000,
    });
    expect(result.total).toBe(2);
  });

  it('accumulates all factors correctly', () => {
    const result = calculateRiskScore({
      fileCount: 10,   // +3
      hasTests: true,  // +1
      hasConfig: true, // +1
      hasInfra: true,  // +2
      hasSecurity: true, // +2
      hasDatabase: true, // +1
      codeLineEstimate: 1000, // +2
    });
    expect(result.total).toBe(12);
  });

  it('includes the input factors in the result', () => {
    const input = {
      fileCount: 3,
      hasTests: false,
      hasConfig: true,
      hasInfra: false,
      hasSecurity: false,
      hasDatabase: false,
      codeLineEstimate: 50,
    };
    const result = calculateRiskScore(input);
    expect(result.factors).toEqual(input);
  });
});
