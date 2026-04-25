# Impact Analysis: agent-delegation-prompt-templates

## 影響範囲サマリー

委譲プロンプトにWhy/What/How/Constraintsの4層テンプレートを導入する変更は、スキルファイル2つ(phases.md変更+delegation.md新規)、エージェント定義3つ(coordinator/worker/hearing-worker)、ルール1つ(tool-delegation.md)の計6ファイルに影響する。
SKILL.mdのFile Index(9ファイル→10ファイル)とFile Routing表への追記が必須の波及的変更となる。
workflow-execution.mdの「subagent委譲時の必須コンテキスト」セクションとの責務重複リスクがあり、整理が必要。

## 依存関係グラフ

### 変更ファイル → 参照元

| 変更ファイル | 参照元 |
|-------------|--------|
| workflow-phases.md (79行) | SKILL.md File Index(行数記載), SKILL.md File Routing表, workflow-harness/CLAUDE.md(Phases/sizing), workflow-harness/STRUCTURE_REPORT.md, ADR-013 |
| workflow-delegation.md (新規) | なし(新規のため参照元はゼロ。追加後にSKILL.mdから参照される必要あり) |
| coordinator.md (38行) | workflow-orchestrator.md(Agent Teams表), ADR-009 |
| worker.md (57行) | workflow-orchestrator.md(Agent Teams表), ADR-009 |
| hearing-worker.md (27行) | workflow-orchestrator.md(Agent Teams表) |
| tool-delegation.md (8行) | workflow-harness/CLAUDE.md, workflow-execution.md(権威仕様参照) |

### 波及的に更新が必要なファイル

| ファイル | 更新内容 | 理由 |
|---------|---------|------|
| SKILL.md File Index (48-60行) | 行数を9→10ファイルに更新、workflow-delegation.md行を追加、workflow-phases.md行数を78→更新値 | ファイル追加・行数変更の反映 |
| SKILL.md File Routing (22-43行) | delegation.mdの読み込みタイミング行を追加 | 新規ファイルのルーティング定義 |
| workflow-execution.md (64-71行) | 「subagent委譲時の必須コンテキスト」との責務分離を明確化 | delegation.mdと内容が重複する可能性 |

## 行数制限への影響

| ファイル | 変更前 | 変更後(予測) | 200行制限との余裕 |
|---------|--------|------------|-----------------|
| workflow-phases.md | 79行 | 約120行[推測] | 80行の余裕。安全 |
| workflow-delegation.md | 0行(新規) | 80-150行[推測] | 50-120行の余裕。初期は安全だが上限域に注意 |
| coordinator.md | 38行 | 約41行 | 159行の余裕。安全 |
| worker.md | 57行 | 約60行 | 140行の余裕。安全 |
| hearing-worker.md | 27行 | 約30行 | 170行の余裕。安全 |
| tool-delegation.md | 8行 | 約9行 | 191行の余裕。安全 |
| SKILL.md | 113行 | 約118行 | 82行の余裕。安全 |

全ファイルが200行制限に対して十分な余裕を持つ。最もリスクが高いのはworkflow-delegation.md(新規)で、テンプレートの記述量次第で150行に達する可能性がある。

## コンテキスト消費への影響

### 新規ファイル追加によるトークン増加

- workflow-delegation.md: 80-150行 = 約2,000-4,000トークン[推測]
- SKILL.md File Routing により条件付き読み込みが適用されるため、常時読み込みではない
- delegation.mdの読み込みタイミング: subagent起動時(execution.mdと同時)と想定

### 既存ファイルの増加

- workflow-phases.md: +41行 = 約1,000トークン増加[推測]
- coordinator.md/worker.md/hearing-worker.md: 合計+9行 = 約200トークン増加(常時読み込み)
- tool-delegation.md: +1行 = 無視可能(常時読み込み)

### 合計影響

- 常時消費増: 約200トークン(エージェント定義ファイル3つ)
- 条件付き消費増: 約3,000-5,000トークン(phases.md + delegation.md、subagent起動時のみ)
- SKILL.mdのルール「1フェーズで読むファイルは最大4つ」に抵触しない(delegation.mdはexecution.mdと同タイミングで読む設計)

## リスク

### R-1: workflow-execution.mdとの責務重複 (中)
workflow-execution.md 64-71行「subagent委譲時の必須コンテキスト」セクションに、taskId/sessionToken/docsDir/Markdown形式/ファイル名/DoDテンプレート取得の記載がある。新規workflow-delegation.mdのWhy/What/How/Constraintsテンプレートがこれと重複し、どちらが権威かが不明確になるリスク。対策: execution.mdの該当セクションをdelegation.mdへの参照に置換する。

### R-2: テンプレート自作禁止ルールとの衝突 (低)
forbidden-actions.mdに「テンプレート自作禁止。ハーネスが提供するテンプレートと乖離し、DoDゲートを通過できなくなるため。」とある。この禁止はフェーズ成果物テンプレート(harness_get_subphase_template)に関するものだが、「テンプレート」という語が4層委譲テンプレートにも適用されると誤解されるリスク。対策: 委譲テンプレートはスキルファイルが定義するものであり、ハーネスのDoD成果物テンプレートとは別であることを明記する。

### R-3: SKILL.md File Routing表の「最大4ファイル」制約 (低)
現状のFile Routing表で最大4ファイルを読むフェーズが複数ある(implementation, test_impl等)。delegation.mdが追加されても、subagent起動時の設定ファイルとしてexecution.mdと同時読み込みとなるため、フェーズ作業用ファイル数カウントには含まれない。ただし、File Routing表のルール解釈を明確にする必要がある。

### R-4: workflow-orchestrator.mdのTemplate Rulesとの整合性 (低)
orchestrator.md 101行「NEVER construct prompts from scratch」ルールは、ハーネスのharness_get_subphase_templateから取得したテンプレートをそのまま使うことを要求する。4層テンプレートがこの「VERBATIM」ルールに対して追加的な構造化を求める形になるため、両者の関係を明確にする必要がある。

## decisions

- workflow-delegation.md: 新規スキルファイルとして作成 -- phases.mdに委譲テンプレートを追加すると責務混在(フェーズ定義 vs 委譲プロトコル)になるため
- workflow-execution.md 64-71行: delegation.mdへの参照に置換 -- 単一ソース原則。委譲コンテキストの権威をdelegation.mdに集約
- SKILL.md File Routing: delegation.mdをexecution.mdと同行(subagent起動時)に追加 -- 独立した読み込みタイミングではなく、execution.mdの補完として位置づけ
- phases.mdへのWhy追加: 各フェーズ説明にWhy(なぜこのフェーズで行うか)を1行追加する形式 -- 散文ではなく行末コメント形式で行数増加を最小化
- エージェント定義(coordinator/worker/hearing-worker): 委譲テンプレートの4層構造を受け取る旨の記載を追加 -- エージェントがテンプレート構造を認識し適切に処理するため
- tool-delegation.md: Coordinator/Workerの責務欄に「4層テンプレート準拠」を追記 -- 委譲プロトコルの参照先を明示するため

## artifacts

調査で確認したファイル一覧:

| ファイル | パス | 行数 |
|---------|------|------|
| SKILL.md | .claude/skills/workflow-harness/SKILL.md | 113 |
| workflow-orchestrator.md | .claude/skills/workflow-harness/workflow-orchestrator.md | 187 |
| workflow-execution.md | .claude/skills/workflow-harness/workflow-execution.md | 72 |
| workflow-phases.md | .claude/skills/workflow-harness/workflow-phases.md | 79 |
| coordinator.md | .claude/agents/coordinator.md | 38 |
| worker.md | .claude/agents/worker.md | 57 |
| hearing-worker.md | .claude/agents/hearing-worker.md | 27 |
| tool-delegation.md | .claude/rules/tool-delegation.md | 8 |
| workflow-harness/CLAUDE.md | workflow-harness/CLAUDE.md | 37 |
| workflow-rules.md | .claude/skills/workflow-harness/workflow-rules.md | 禁則41行にテンプレート関連記載 |

## next

- requirementsフェーズでAC定義
