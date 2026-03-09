/**
 * P1: skippedPhases exclusion from inputFiles validation.
 * Tests AC-1: checkInputFilesExist with skippedPhases parameter (not yet implemented).
 * TDD Red phase - tests expect features that do not exist yet.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkInputFilesExist } from '../gates/dod-l1-l2.js';
import { createTempDir, removeTempDir } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

// OUTPUT_FILE_TO_PHASE mapping (matches definitions.ts)
const OUTPUT_FILE_TO_PHASE: Record<string, string> = {
  'state-machine.mmd': 'state_machine',
  'flowchart.mmd': 'flowchart',
  'ui-design.toon': 'ui_design',
  'spec.toon': 'planning',
  'threat-model.toon': 'threat_modeling',
};

describe('P1: checkInputFilesExist with skippedPhases', () => {
  // TC-AC1-01: skippedPhasesにscope_definitionが含まれる場合、scope-definition.toonが不在でもパス
  it('skips input file validation for files produced by skipped phases', () => {
    // design_review requires: state-machine.mmd, flowchart.mmd, ui-design.toon, spec.toon, threat-model.toon
    // Create only spec.toon and threat-model.toon (non-skipped sources)
    writeFileSync(join(docsDir, 'spec.toon'), 'phase: planning\n');
    writeFileSync(join(docsDir, 'threat-model.toon'), 'phase: threat_modeling\n');

    // P1 feature: 4th arg skippedPhases, 5th arg fileToPhaseMap
    // Current signature: checkInputFilesExist(phase, docsDir, workflowDir)
    // Expected signature: checkInputFilesExist(phase, docsDir, workflowDir, skippedPhases, fileToPhaseMap)
    const result = (checkInputFilesExist as any)(
      'design_review', docsDir, tempDir,
      ['state_machine', 'flowchart', 'ui_design'],
      OUTPUT_FILE_TO_PHASE,
    );

    // With all Stage4 phases skipped, only spec.toon and threat-model.toon should be checked
    // Both exist, so passed should be true
    expect(result.passed).toBe(true);
  });

  // TC-AC1-02: skippedPhasesが空の場合、従来通り全ファイルを検証
  it('validates all input files when skippedPhases is empty', () => {
    // Create only some files - leave state-machine.mmd missing
    writeFileSync(join(docsDir, 'spec.toon'), 'phase: planning\n');
    writeFileSync(join(docsDir, 'threat-model.toon'), 'phase: threat_modeling\n');

    const result = (checkInputFilesExist as any)(
      'design_review', docsDir, tempDir,
      [],
      OUTPUT_FILE_TO_PHASE,
    );

    // state-machine.mmd, flowchart.mmd, ui-design.toon are missing
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('state-machine.mmd');
  });

  // TC-AC1-03: smallタスクでskippedPhasesに全Stage4フェーズが含まれるとinputFiles全スキップ
  it('skips all Stage4 output files when all Stage4 phases are skipped', () => {
    writeFileSync(join(docsDir, 'spec.toon'), 'phase: planning\n');
    writeFileSync(join(docsDir, 'threat-model.toon'), 'phase: threat_modeling\n');

    const result = (checkInputFilesExist as any)(
      'design_review', docsDir, tempDir,
      ['state_machine', 'flowchart', 'ui_design'],
      OUTPUT_FILE_TO_PHASE,
    );

    expect(result.passed).toBe(true);
  });

  // TC-AC1-04: fileToPhaseMap未指定時はスキップなしで全ファイル検証
  it('does not skip any files when fileToPhaseMap is omitted', () => {
    writeFileSync(join(docsDir, 'spec.toon'), 'phase: planning\n');
    writeFileSync(join(docsDir, 'threat-model.toon'), 'phase: threat_modeling\n');

    // Call with skippedPhases but without fileToPhaseMap
    const result = (checkInputFilesExist as any)(
      'design_review', docsDir, tempDir,
      ['state_machine'],
    );

    // Without mapping, skip logic cannot determine source phase, so all files are checked
    expect(result.passed).toBe(false);
  });

  // TC-AC1-05: inputFilesが空のフェーズではskippedPhasesに関わらずpassed=true
  it('returns passed=true for phases with no input files regardless of skippedPhases', () => {
    const result = (checkInputFilesExist as any)(
      'refactoring', docsDir, tempDir,
      ['state_machine'],
      OUTPUT_FILE_TO_PHASE,
    );

    expect(result.passed).toBe(true);
    expect(result.evidence).toBe('No input files required for this phase');
  });
});
