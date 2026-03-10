/**
 * N-59: Tests for LLM evaluation pipeline runner.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { collectMetrics, runEvalPipeline, writeReport } from '../../tests/eval/eval-runner.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('eval-runner', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('collectMetrics returns all 5 gate metrics', () => {
    const metrics = collectMetrics('test-case');
    expect(Object.keys(metrics)).toEqual(
      expect.arrayContaining([
        'faithfulness',
        'hallucination_rate',
        'relevance',
        'toxicity',
        'instruction_following',
      ]),
    );
    for (const v of Object.values(metrics)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('runEvalPipeline processes all test cases', () => {
    const report = runEvalPipeline(['case-a', 'case-b', 'case-c']);
    expect(report.totalCases).toBe(3);
    expect(report.passed + report.failed).toBe(3);
    expect(report.timestamp).toBeTruthy();
    expect(report.results).toHaveLength(3);
  });

  it('runEvalPipeline marks passing cases correctly', () => {
    const report = runEvalPipeline(['passing-case']);
    // Default metrics should pass all gates
    expect(report.results[0].pass).toBe(true);
    expect(report.passed).toBe(1);
  });

  it('writeReport creates JSON file on disk', () => {
    const report = runEvalPipeline(['write-test']);
    const reportPath = writeReport(report, tmpDir);
    expect(fs.existsSync(reportPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    expect(content.totalCases).toBe(1);
  });

  it('report format includes all required fields', () => {
    const report = runEvalPipeline(['format-test']);
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('totalCases');
    expect(report).toHaveProperty('passed');
    expect(report).toHaveProperty('failed');
    expect(report).toHaveProperty('results');
    expect(report.results[0]).toHaveProperty('testCase');
    expect(report.results[0]).toHaveProperty('metrics');
    expect(report.results[0]).toHaveProperty('gateResults');
    expect(report.results[0]).toHaveProperty('pass');
  });
});
