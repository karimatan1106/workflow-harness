/**
 * @spec F-003 / AC-3
 * DoD L4 openQuestions list-item count judgement tests (TDD Red).
 *
 * 現状: checkOpenQuestions は openQuestions セクション本文の文字列存在で判定し、
 *       「未解決」など散文を含むだけで fail になる。
 * 新挙動: openQuestions セクション直後の Markdown list item 件数のみで判定し、
 *         0件なら pass、1件以上で fail。本文中の「未解決」キーワードは無視する。
 * isOpenQuestion: 構造的判定 (空文字列は false / list-item 風文字列は true)。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkOpenQuestions, isOpenQuestion } from '../gates/dod-l4-requirements.js';
import { createTempDir, removeTempDir, makeMinimalState, buildValidRequirementsMd } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

// ─── checkOpenQuestions: list-item count semantics ───────────────────

describe('checkOpenQuestions list-item count', () => {
  it('TC-AC3-01: openQuestions セクション直後 list item 0件で 空判定 (passed=true / hasOpen=false 相当)', () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    // openQuestions セクションは存在するが list item 0件、
    // 本文(散文)に「未解決事項なし。」を記載 → 新挙動では pass。
    const base = buildValidRequirementsMd({ acCount: 5, hasOpenQuestions: false });
    const md = base + '\n## openQuestions\n未解決事項なし。すべて確定済み。\n';
    writeFileSync(join(docsDir, 'requirements.md'), md, 'utf8');

    const result = checkOpenQuestions(state, 'requirements', docsDir);

    expect(result.level).toBe('L4');
    expect(result.check).toBe('open_questions_section');
    expect(result.passed).toBe(true);
  });

  it('TC-AC3-02: list item 1件以上 + 本文に「未解決」混在で pass', () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    // openQuestions セクション自体は list item 0件 (空)、
    // additionalNotes など他セクションに list item と「未解決」が混在 → 新挙動では pass。
    const md = buildValidRequirementsMd({
      acCount: 5,
      hasOpenQuestions: true,
      extraContent: '- 補足事項: 過去の未解決課題は別ドキュメントで追跡済み\n- 補足事項: レビュー観点の整理',
    });
    writeFileSync(join(docsDir, 'requirements.md'), md, 'utf8');

    const result = checkOpenQuestions(state, 'requirements', docsDir);

    expect(result.passed).toBe(true);
  });

  it('TC-AC3-03: 本文に「未解決」のみ openQuestions 未配置で pass (誤検出回避)', () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    // openQuestions セクションは存在し list item 0件、
    // 本文 (decisions など) に「未解決」キーワードのみ含まれる → 新挙動では誤検出せず pass。
    const md = buildValidRequirementsMd({
      acCount: 5,
      hasOpenQuestions: true,
      extraContent: '本要件における「未解決」という単語は単なる記述であり、追跡対象ではない。',
    });
    writeFileSync(join(docsDir, 'requirements.md'), md, 'utf8');

    const result = checkOpenQuestions(state, 'requirements', docsDir);

    expect(result.passed).toBe(true);
  });
});

// ─── isOpenQuestion: structured judgement ────────────────────────────

describe('isOpenQuestion structured judgement', () => {
  it('空文字列は false', () => {
    expect(isOpenQuestion('')).toBe(false);
  });

  it('list-item風文字列は true', () => {
    expect(isOpenQuestion('- 未解決の質問: APIの認証方式は確定か?')).toBe(true);
  });
});
