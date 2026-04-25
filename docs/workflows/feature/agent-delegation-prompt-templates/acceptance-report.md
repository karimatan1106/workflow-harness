# Acceptance Report: agent-delegation-prompt-templates

task: dd7e439b-4097-4736-b78c-0673274da7e0
phase: acceptance_verification
date: 2026-03-28

## サマリー

Agent委譲プロンプトテンプレートの全6受入基準を検証完了。workflow-delegation.mdに3テンプレート(coordinator/worker-write/worker-verify)と23フェーズパラメータ表を定義し、workflow-phases.mdに8ステージのWhy追記、3つのagent定義ファイルにPrompt Contractセクションを配置、5つの障害パターンを制約として反映、全ファイル200行以下を達成。全AC PASS。

## AC Achievement Status

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 | PASS | workflow-delegation.md (125 lines): coordinator template L13-37, worker-write template L39-62, worker-verify template L64-88. Each contains Why/What/How/Constraints 4-layer structure |
| AC-2 | PASS | workflow-delegation.md L92-117: Parameter table with 23 phases. Columns: Phase, Template, Role, Required Sections, Common Failures |
| AC-3 | PASS | workflow-phases.md (86 lines): 8 Why lines at Stage 0 L12, Stage 1 L16, Stage 2 L23, Stage 3 L33, Stage 4 L42, Stage 5 L50, Stage 6 L57, Stage 7 L69 |
| AC-4 | PASS | Prompt Contract section: coordinator.md L17 (43 lines), worker.md L16 (62 lines), hearing-worker.md L17 (32 lines). All reference workflow-delegation.md with Why/Context as decision axis |
| AC-5 | PASS | 5 failure patterns reflected: (1) decisions欠落 -> L120 "decisions: every artifact needs 5+ items", (2) tdd_red_evidence API誤用 -> L106 "use harness_record_test_result(exitCode=1), NOT harness_record_proof", (3) 重複行 -> L121 "No duplicate lines: same text 3+ times triggers DoD failure", (4) TOON/Markdown不整合 -> L109 "content_validation: write in Markdown format, NOT TOON", (5) 必須セクション欠落 -> L124 "Section completeness: verify all Output spec sections exist before submitting" |
| AC-6 | PASS | Line counts: workflow-delegation.md=125, workflow-phases.md=86, coordinator.md=43, worker.md=62, hearing-worker.md=32, tool-delegation.md=9. All under 200 |

Overall: 6/6 PASS

## RTM Status

| RTM | Description | Status |
|-----|-------------|--------|
| F-001 | 4-layer template definition | PASS (AC-1) |
| F-002 | Phase parameter table | PASS (AC-2) |
| F-003 | Why addition to phases | PASS (AC-3) |
| F-004 | Prompt Contract in agent definitions | PASS (AC-4) |
| F-005 | Failure pattern reflection | PASS (AC-5) |
| F-006 | 200-line limit compliance | PASS (AC-6) |

## decisions

- AC-1 template structure: 3テンプレートをcoordinator/worker-write/worker-verifyに分類 -- agent役割ごとに必要な委譲情報が異なるため
- AC-2 phase coverage: 23フェーズを網羅しhearingフェーズは専用worker経由のため除外 -- hearing-workerは独自プロトコルを持ち汎用テンプレート適用外
- AC-3 Why配置: 各ステージ冒頭にWhy 1行を追記しフェーズ詳細の前に配置 -- LLMがステージ目的を先に認識することで委譲精度が向上する
- AC-4 Prompt Contract: 3 agent定義全てにworkflow-delegation.md参照とWhy/Context判断軸を明記 -- agent起動時にテンプレート選択根拠が自動ロードされる
- AC-5 failure pattern mapping: 5パターンをCommon Failures列とCommon Constraints節に分散配置 -- フェーズ固有はパラメータ表、横断的は共通制約として構造化
- AC-6 line count verification: wc -lで全6ファイルの行数を計測し最大125行を確認 -- 200行制限はcore-constraints.mdの責務分離指標

## artifacts

| # | File | Lines | Status |
|---|------|-------|--------|
| 1 | .claude/skills/workflow-harness/workflow-delegation.md | 125 | new, AC-1/2/5 verified |
| 2 | .claude/skills/workflow-harness/workflow-phases.md | 86 | edited, AC-3 verified |
| 3 | .claude/agents/coordinator.md | 43 | edited, AC-4 verified |
| 4 | .claude/agents/worker.md | 62 | edited, AC-4 verified |
| 5 | .claude/agents/hearing-worker.md | 32 | edited, AC-4 verified |
| 6 | .claude/rules/tool-delegation.md | 9 | edited, AC-6 verified |

## next

- workflow-delegation.mdの実運用フィードバックを収集し、テンプレート精度を継続改善する
- 新規フェーズ追加時にパラメータ表の行追加手順をスキルファイルに記載する
