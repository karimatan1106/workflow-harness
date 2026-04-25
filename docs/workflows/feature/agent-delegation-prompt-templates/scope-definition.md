# Scope Definition: agent-delegation-prompt-templates

## entry_points
- .claude/skills/workflow-harness/workflow-phases.md (主要編集対象: 全30フェーズにWhy追加)
- .claude/skills/workflow-harness/workflow-delegation.md (新規作成: 4層テンプレート定義)

## affected_files

| # | ファイルパス | 種別 | 現在行数 |
|---|-------------|------|---------|
| 1 | .claude/skills/workflow-harness/workflow-phases.md | 編集 | 79行 |
| 2 | .claude/agents/coordinator.md | 編集 | 38行 |
| 3 | .claude/agents/worker.md | 編集 | 57行 |
| 4 | .claude/agents/hearing-worker.md | 編集 | 27行 |
| 5 | .claude/rules/tool-delegation.md | 編集 | 9行 |
| 6 | .claude/skills/workflow-harness/workflow-delegation.md | 新規 | 0行 |

合計: 編集5ファイル + 新規1ファイル = 6ファイル。全てMarkdown。コード変更なし。

## scope_summary

スキルファイル1本新規作成 + 既存5ファイル編集。全てMarkdown成果物のみでソースコード変更なし。workflow-phases.md(79行)が最大の編集対象で、各フェーズ説明にWhy(目的)を追加する。3つのagentファイル(coordinator/worker/hearing-worker)にはPrompt Contract節を追記。tool-delegation.mdにはテンプレート強制ルールを追記。新規workflow-delegation.mdに4層テンプレート(Why/What/How/Constraints)の3種(coordinator向け/worker向け/hearing-worker向け)とフェーズ別パラメータ表を定義する。

## decisions

- workflow-phases.md: 各フェーズ説明の冒頭にWhy 1行を追加する方式 — フェーズ説明の構造を大きく変えず、既存のDoD記述と共存させるため
- workflow-delegation.md: 200行以内に3テンプレート+パラメータ表を収める — core-constraints.mdの200行制限に従う。超過時はパラメータ表を別ファイルに分離する
- agent .md: YAML frontmatter直後にPrompt Contract節を追記する方式 — 既存のRole/Context Handoff構造を壊さず、委譲時に参照すべき契約を明示するため
- tool-delegation.md: テンプレート使用の強制ルールを既存の箇条書きに追記 — 独立ファイルにするほどの分量ではなく、委譲ルールと同一文脈で記述すべきため
- テンプレート種別: coordinator/worker/hearing-workerの3種に分離 — 各agentのツール権限とmaxTurnsが異なり、単一テンプレートでは制約が曖昧になるため

## artifacts

| ファイル | 変更種別 |
|---------|---------|
| .claude/skills/workflow-harness/workflow-phases.md | 編集(各フェーズにWhy追加) |
| .claude/agents/coordinator.md | 編集(Prompt Contract追記) |
| .claude/agents/worker.md | 編集(Prompt Contract追記) |
| .claude/agents/hearing-worker.md | 編集(Prompt Contract追記) |
| .claude/rules/tool-delegation.md | 編集(テンプレート強制ルール追記) |
| .claude/skills/workflow-harness/workflow-delegation.md | 新規(4層テンプレート3種+パラメータ表) |

## next

- researchフェーズで各ファイルの現在構造を詳細調査し、追記箇所の具体的な挿入位置を特定する
