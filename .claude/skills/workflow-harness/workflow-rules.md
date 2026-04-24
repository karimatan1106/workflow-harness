---
name: harness-rules
description: Consolidated AI directives (15 keeps + 3 merged groups = 18 rules), retry protocol, completion language, artifact quality, and bash categories.
---
> `.claude/rules/forbidden-actions.md` (禁止語・禁止アクション)、`.claude/rules/session-recovery.md` (セッション復帰) が権威仕様。本ファイルは実行時ルール詳細と、hook で強制済みルールの 1-line ポインタを提供。

## 1. Rules (18)

Rules are either **behavioral** (enforced only by LLM prose) or **hook-enforced** (enforced in code; prose is pointer only).

### Behavioral (LLM-only enforcement)

**R1 「許可を請うな」**: 「〜していいですか？」と聞かずワークフローに従う。調査後に「すぐに修正します」は禁止、まず仕様書を書く。
(元 AI #4, #5)

**R2 承認ゲート宣言**: requirements / design_review / test_design / code_review / acceptance_verification / hearing では必ず `harness_approve` でユーザー承認を待つ。承認前に artifact をユーザーに提示する。
(元 AI #7 + 禁則 #7)

**R3 完了語彙規律**: 「実装完了」≠「タスク完了」。「できました」「ready to use」「task complete」は `completed` phase 以外で使用禁止。「実行してみてください」は testing/parallel_verification 以降のみ。各フェーズ完了時は `【{phase}フェーズ完了】次: {next} / 残り{N}フェーズ` の正確な書式で報告。下流ツールが regex 依存のため**文字列を変えない**。
(元 AI #9, #10, #11 + 禁則 #9)

**R4 設計-実装 parity**: implementation 開始時に spec/state-machine/flowchart/ui-design/test-design を全て Read で読む。code_review では設計-実装差分を報告、未実装を implementation に差し戻し、勝手な追加機能も指摘。設計したものは全て実装し「後で」「今回は省略」は禁止。
(元 AI #16, #17, #18 + 禁則 #18)

**R5 Template 原則**: subagent prompts をゼロから書かない。`harness_next` / `harness_get_subphase_template` が返す server templates を VERBATIM で使う。
(元 禁則 #5)

**R6 sessionToken セキュリティ**: sessionToken を subagent に渡さない。例外は `harness_record_test_result` のみ。
(元 禁則 #6)

**R7 Known-bug 判断**: 既存テスト失敗が変更起因でないものは `harness_record_known_bug` で記録。変更起因なら修正必須。**この判断基準を flatten しない** (generic pointer 化禁止)。
(元 AI #15)

**R8 Baseline capture**: testing フェーズで `harness_capture_baseline` でベースラインを記録してからテスト実行。
(元 AI #20)

**R9 MCP 再起動**: コアモジュール (tools/handlers/*, gates/*, phases/*) 変更後は MCP サーバー再起動必須。
(元 AI #22)

**R10 出力先規律**: テスト出力・成果物をプロジェクトルートに散らかさない。`docs/workflows/{taskName}/` または `__tests__/`, `tests/` 等適切な配置へ。テストの配置はリグレッションテストも同様。
(元 AI #12, #14 + 禁則 #15)

**R11 パッケージ設置場所**: `npm install` / `pnpm add` を project root に対して実行しない。対象モジュール (workflow-harness/mcp-server 等) の package.json ある dir に対してのみ。
(元 禁則 #14)

**R12 Generated file 非編集**: 自動生成ファイル (例: build 出力, generated TS types, vitest snapshots) を直接編集しない。ソースを編集して再生成する。C-11 tag。
(元 禁則 #21)

### Hook-enforced (1-line pointers; the rule exists in code)

**R13 Phase-artifact 規律**: `research/design/requirements` でコード編集禁止、test を書く前に実装開始禁止、禁止 Bash コマンド実行禁止。**強制: `workflow-harness/hooks/phase-config.js` の `PHASE_EXT` / `PHASE_BASH`**。
(元 AI #1, #2, #3 + 禁則 #2, #3, #10)

**R14 Validation-failure protocol**: DoD 失敗時は直接 Edit/Write で artifact を修正しない。`Agent(subagent_type=...)` で subagent 再起動。**強制: L1 guard が Write/Edit blocks**。再起動時のエスカレーション手順は下記 §3 参照。
(元 AI #21 + 禁則 #4)

**R15 Loop detection**: 同一ファイルを 5分間に 5 回以上編集しない。**強制: `hooks/loop-detector.js`**。
(元 AI #8 + 禁則 #13)

**R16 Dangerous Bash**: `git push --force` to main/master, `git reset --hard`, `rm -rf /`, fork bomb 等を実行しない。**強制: `hooks/block-dangerous-commands.js`**。
(元 禁則 #22)

**R17 Forbidden vocabulary**: TODO/TBD/WIP/FIXME/未定/未確定/要検討/検討中/対応予定/サンプル/ダミー/仮置き はコードフェンス外で使用禁止。`[#xxx#]` bracket placeholder も同様。**強制: DoD L4 validator (`content_validation`)**。
(元 禁則 #16, #17)

**R18 Phase skip/approve gate**: `harness_next` で state machine に従い順次進行、スキップ禁止。Requirements 承認は `OPEN_QUESTIONS` が空 かつ `AC-N` が 3件以上必要。Threat modeling は Large タスクで必須。**強制: `harness_next` state machine + DoD gates (IA-1, IA-2)**。
(元 AI #6, #13 + 禁則 #1, #11, #12, #19, #20)

---

## 2. UI Policy (3 behavioral + 3 hook-enforced pointers)

`workflow-gates.md` §UI-1..UI-7 参照。behavioral-only:
- **UI-3** (requirements 承認前に NFR 定量定義)
- **UI-4** (承認後の追加 → `record_feedback` → back/new task)
- **UI-5** (code_review intent alignment: userIntent keyword 反映 + NOT_IN_SCOPE 不混入)
- **UI-6** (`record_feedback` を Q&A ペアで記録)

Hook-enforced: UI-1 (userIntent ≥ 20 chars), UI-2 (曖昧表現), UI-7 (目的不在警告)。`mcp-server/src/server/prompt-filters.ts` で強制。

---

## 3. Retry Protocol

When harness_next returns DoD failure: **NEVER edit directly.** Re-launch subagent with error + improvement instructions.

| Attempt | Action |
|---------|--------|
| 1 | Same model, pass error via buildRetryPrompt |
| 2 | Read artifact, identify problem lines; haiku→sonnet escalation |
| 3+ | Force sonnet; quoted problem sections + rewrite examples |
| 5+ | Halt, ask user (RLM-1) |

**Diagnosis (CAN-2)**: Full rewrite succeeds→expression failure / also fails→understanding failure / same error 3×→VDB-1
**Edit strategy (CAN-1)**: ≤400 lines→Write (full rewrite) / >400 lines→Edit, fallback Read+Write

---

## 4. Completion Language

| Phase Range | Allowed | Prohibited |
|------------|---------|------------|
| scope_definition ~ implementation | "phase complete", "moving to next" | "done", "finished", "try it" |
| refactoring ~ regression_test | "tests passed", "refactoring complete" | "all done", "ready to use" |
| acceptance ~ deploy | "verification complete" | "task complete" |
| **completed only** | "Task complete", "ready to use" | - |

Report: `【{phase}フェーズ完了】次: {next} / 残り{N}フェーズ`

Note: R3 の書式指定と整合。

---

## 5. Artifact Quality

**12 Forbidden Words** (outside code fences): TODO, TBD, WIP, FIXME, 未定, 未確定, 要検討, 検討中, 対応予定, サンプル, ダミー, 仮置き
**L3**: lines >= minLines, section density >= 30%, each section >= 5 substantive lines
**L4**: 3+ identical non-structural lines = error. Required `## サマリー` + phase-specific sections
**Delta Entry**: `- [ID][category] content`. ID=phase prefix+seq. Categories: decision/constraint/risk/finding/next/dependency/assumption. Min 5 entries.
**Bracket ban**: `[#xxx#]` format only. Normal brackets/arrays/links safe.

Note: R17 forbidden vocabulary はここに列挙されたリストと同一。

---

## 6. Bash Categories

| Category | Commands |
|----------|---------|
| readonly | ls, pwd, cat, head, tail, grep, find, wc, git status/log/diff/show, npm list, node --version |
| testing | npm test, npm run test, npx vitest/jest/playwright, pytest |
| implementation | npm install, pnpm add, npm run build, mkdir, rm, git add, git commit |
| security | npm audit, npx audit-ci, npx snyk test, npx semgrep, semgrep, trivy fs/image/config |
| git | git add, git commit, git push, git tag |

**Redirect caution**: `> ` preceded by non-`=` is blocked. Use `>= 1` not `> 0`. `=>` is safe.
**commit phase**: NO implementation category. File deletions in implementation/refactoring only.

Note: R13 hook-enforced により、カテゴリ外の Bash は L3 worker でブロックされる。
