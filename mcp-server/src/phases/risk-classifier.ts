/**
 * Risk classifier - determines task size based on risk scoring
 */

import type { RiskScore, TaskSize } from '../state/types.js';

interface RiskInput {
  fileCount: number;
  hasTests: boolean;
  hasConfig: boolean;
  hasInfra: boolean;
  hasSecurity: boolean;
  hasDatabase: boolean;
  codeLineEstimate: number;
}

export function calculateRiskScore(input: RiskInput): RiskScore {
  let total = 0;
  if (input.fileCount >= 10) total += 3;
  else if (input.fileCount >= 5) total += 2;
  else if (input.fileCount >= 2) total += 1;
  
  if (input.codeLineEstimate >= 1000) total += 2;
  else if (input.codeLineEstimate >= 200) total += 1;
  
  if (input.hasConfig) total += 1;
  if (input.hasInfra) total += 2;
  if (input.hasSecurity) total += 2;
  if (input.hasDatabase) total += 1;
  if (input.hasTests) total += 1;

  return { total, factors: input };
}

export function classifySize(_score: RiskScore): TaskSize {
  return 'large';
}

export function analyzeScope(files: string[], dirs: string[]): RiskInput {
  const allPaths = [...files, ...dirs];
  const hasTests = allPaths.some(p => p.includes('test') || p.includes('spec'));
  const hasConfig = allPaths.some(p => p.endsWith('.json') || p.endsWith('.yaml') || p.endsWith('.yml') || p.endsWith('.toml'));
  const hasInfra = allPaths.some(p => p.includes('docker') || p.includes('terraform') || p.includes('k8s') || p.includes('deploy'));
  const hasSecurity = allPaths.some(p => p.includes('auth') || p.includes('security') || p.includes('crypto') || p.includes('secret'));
  const hasDatabase = allPaths.some(p => p.includes('migration') || p.includes('schema') || p.includes('database') || p.includes('prisma'));

  return {
    fileCount: files.length,
    hasTests,
    hasConfig,
    hasInfra,
    hasSecurity,
    hasDatabase,
    codeLineEstimate: files.length * 100,
  };
}
