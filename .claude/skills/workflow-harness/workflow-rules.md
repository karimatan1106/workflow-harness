---
name: harness-rules
description: AI directives (23 rules), prohibited actions, retry protocol, completion language, artifact quality, and bash categories.
---
> `.claude/rules/forbidden-actions.md`(禁止語・禁止アクション)、`.claude/rules/session-recovery.md`(セッション復帰) が権威仕様。本ファイルは実行時ルール詳細。

## 1. AI Directives (23 Rules)

1. researchフェーズでコードを書くな
2. 仕様書を書く前に実装を始めるな
3. テストを書く前に実装を始めるな（TDD Red → Green）
4. 「〜していいですか？」と聞くな。ワークフローに従え
5. 調査後に「すぐに修正します」は禁止。まず仕様書を書け
6. 脅威モデリングを省略するな（Largeタスク時）
7. requirements/design_review/test_design/code_review では必ず harness_approve でユーザー承認を待つ
8. 同一ファイルの繰り返し編集時は立ち止まって原因分析
9. 「実装完了」≠「タスク完了」。「できました」は completed でのみ使用可能
10. 「実行してみてください」は testing/parallel_verification 以降でのみ使用
11. 各フェーズ完了時は残りフェーズ数と次フェーズを報告
12. テスト実行時は出力先を指定（ルートに散らかすな）
13. regression_test をスキップするな。「無関係」を理由にスキップ禁止
14. リグレッションテストは適切なディレクトリに配置
15. 変更起因でない既存テスト失敗は `harness_record_known_bug` で記録。変更起因は修正必須
16. 設計したものは全て実装。「後で実装する」「今回は省略」は禁止
17. implementation開始時に spec/state-machine/flowchart/ui-design/test-design を全て読み込み確認
18. code_reviewで設計-実装差分を報告。未実装→implementationに差し戻し。勝手な追加機能も指摘
19. CRLF環境ではセマンティックチェッカーが改行n-gramを誤検出する場合あり（SEMANTIC_CHECK_STRICT=false）
20. testingフェーズで `harness_capture_baseline` でベースラインを記録
21. バリデーション失敗→Edit/Write直接修正禁止→Taskでsubagent再起動。エスカレーション: 1回目=エラーそのまま / 2回目=行番号+sonnet / 3回目+=必ずsonnet+書き換え例
22. コアモジュール変更後はMCPサーバー再起動必須
23. セッション再開後は `harness_status({taskId})` でsessionToken再取得

---

## 2. Prohibited Actions (22 Rules)

1. Skip phases — always advance via harness_next
2. Edit code during research/design/requirements
3. Implement before writing tests (TDD)
4. Edit artifacts directly on validation failure — re-launch subagent
5. Write subagent prompts from scratch — use server templates
6. Pass sessionToken to subagents except for harness_record_test_result
7. Call harness_approve without presenting artifacts to user first
8. Use LLM judgment (L5) in gate checks
9. Declare "complete" before completed terminal state
10. Run disallowed Bash commands for current phase
11. Approve requirements with non-empty OPEN_QUESTIONS (IA-1)
12. Proceed past requirements with < 3 AC-N entries (IA-2)
13. Edit same file 5+ times in 5 minutes (loop-detector)
14. Install packages in project root
15. Create test output in project root
16. Use forbidden words (12) outside code fences
17. Use bracket placeholders `[#xxx#]` outside code fences
18. Implement without reading ALL design documents first
19. Skip threat modeling on large tasks
20. Skip regression test after testing
21. Edit generated files directly (C-11) — edit source and regenerate
22. Push to main/master/release directly (C-04)

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

---

## 5. Artifact Quality

**12 Forbidden Words** (outside code fences): TODO, TBD, WIP, FIXME, 未定, 未確定, 要検討, 検討中, 対応予定, サンプル, ダミー, 仮置き
**L3**: lines >= minLines, section density >= 30%, each section >= 5 substantive lines
**L4**: 3+ identical non-structural lines = error. Required `## サマリー` + phase-specific sections
**Delta Entry**: `- [ID][category] content`. ID=phase prefix+seq. Categories: decision/constraint/risk/finding/next/dependency/assumption. Min 5 entries.
**Bracket ban**: `[#xxx#]` format only. Normal brackets/arrays/links safe.

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
