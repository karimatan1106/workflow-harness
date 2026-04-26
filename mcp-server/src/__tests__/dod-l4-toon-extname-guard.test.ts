/**
 * @spec F-204 / AC-4
 *
 * DoD L4 TOON extname guard test (TDD Red).
 *
 * F-204 ゴール:
 *   checkToonSafety は、対象出力ファイルが TOON (.toon) 以外
 *   （現状の harness は .md / .mmd を採用）の場合は、TOON 固有の
 *   colon-spacing / 列数チェックをスキップして passed=true を返す。
 *
 * 現状実装 (Red 期待):
 *   - 拡張子に関わらず TOON 検査を行うため、
 *     正規 Markdown でも colon-spacing 検出に引っかかる場合がある。
 *   - TC-AC4-04 (MD skip) は現状 fail。fix 後に pass する。
 *   - TC-AC4-05 (.toon は従来通り検査) は regression。
 *
 * 期待する fix 後の挙動 (Green 想定):
 *   - resolveProjectPath で得た outputFile の拡張子が `.toon` でなければ
 *     即座に passed=true (evidence に "skip" / "non-TOON" を含む) を返す。
 *   - `.toon` の場合のみ従来の checkColonSpacing / checkFieldCount を実行。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkToonSafety } from '../gates/dod-l4-toon.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import { createTempDir, removeTempDir } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

describe('@spec F-204 / AC-4 dod-l4-toon checkToonSafety extname guard', () => {
  it('TC-AC4-04: MD ファイルパスを渡すと passed=true で早期 return (skip TOON checks)', () => {
    // research phase の outputFile は `{docsDir}/research.md` (拡張子 .md)
    // 正規の Markdown だが、TOON の colon-spacing 検査の正規表現
    // (^[a-zA-Z_][a-zA-Z0-9_]*:[^\s]) に偶発的にマッチする行を含む。
    // 例: 「phase:research」「note:Inline」のような Markdown 内の前置語。
    // .md 拡張子なら extname guard で TOON 検査はスキップされ passed=true。
    const mdContent = [
      'phase:research',
      'note:InlineNoteWithoutSpaceLooksLikeBrokenToonButThisIsMarkdown',
      '',
      '## decisions',
      '- D-001: Decision one for research providing real substantive context for the topic',
      '- D-002: Decision two for research providing real substantive context for the topic',
      '',
      '## artifacts',
      '- docs/research.md: spec - Primary output artifact for this phase',
      '',
      '## next',
      '- criticalDecisions: D-001, D-002',
      '- readFiles: docs/research.md',
      '- warnings: No warnings for this test artifact',
      '',
    ].join('\n');

    const mdFilePath = join(docsDir, 'research.md');
    writeFileSync(mdFilePath, mdContent, 'utf8');

    // Sanity: research phase の outputFile は .md 拡張子であること
    expect(PHASE_REGISTRY.research.outputFile).toMatch(/\.md$/);

    const result = checkToonSafety('research', docsDir, tempDir);

    expect(result.passed).toBe(true);
    // extname guard が効いていることを示すエビデンス
    expect(result.evidence.toLowerCase()).toMatch(/skip|non[- ]?toon|extension|extname|\.md/);
  });

  it('TC-AC4-05: .toon ファイルパスを渡すと従来の TOON 検査を継続する (regression)', () => {
    // .toon 拡張子に対しては従来通り colon-spacing / 列数不一致を検出すること。
    // PHASE_REGISTRY には .toon を outputFile に持つ phase が存在しないため、
    // 拡張子による分岐ロジックを直接検証するために、resolveProjectPath が返す
    // 実ファイル位置に意図的に壊れた TOON を書き出した上で、
    // outputFile を一時的に .toon にすげ替えた phase config を経由して呼ぶ。
    const originalConfig = PHASE_REGISTRY.research;
    const originalOutputFile = originalConfig.outputFile;

    try {
      // research phase の outputFile を .toon に差し替える (テスト中のみ)
      (PHASE_REGISTRY.research as { outputFile?: string }).outputFile =
        '{docsDir}/research.toon';

      // 列数不一致の壊れた TOON を出力
      const brokenToon = [
        'phase: research',
        'taskId: test-id',
        'items[2]{id,name,desc}:',
        '  1, foo',
        '  2, bar',
        '',
      ].join('\n');

      const toonFilePath = join(docsDir, 'research.toon');
      writeFileSync(toonFilePath, brokenToon, 'utf8');

      const result = checkToonSafety('research', docsDir, tempDir);

      // .toon は従来通りチェックされ、列数不一致を検出して fail する
      expect(result.passed).toBe(false);
      expect(result.evidence).toMatch(
        /フィールド数|tabular|field count|列数/i,
      );
    } finally {
      // registry を元に戻す
      (PHASE_REGISTRY.research as { outputFile?: string }).outputFile =
        originalOutputFile;
    }
  });
});
