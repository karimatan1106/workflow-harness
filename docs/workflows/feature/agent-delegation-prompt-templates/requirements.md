# Requirements: agent-delegation-prompt-templates

## ユーザー意図との整合性確認

| 意図キーワード (hearing) | 対応AC |
|------------------------|--------|
| 4層テンプレート(Why/What/How/Constraints)を3種定義 | AC-1 |
| 約20フェーズ分のパラメータ表(Output spec) | AC-2 |
| 全30フェーズにWhy追加(ステージ共通+固有) | AC-3 |
| エージェント定義にPrompt Contract追記 | AC-4 |
| 3つの評価レポートの失敗パターン反映 | AC-5 |
| 全ファイル200行以下 | AC-6 |

deep意図: DoDリトライの根本原因「Workerが何を書くべきか知らない」を解消し、ハーネス実行時間を削減する。
本タスクはWorker/Coordinator/hearing-workerへの委譲時プロンプトにWhy/What/How/Constraintsの4層テンプレートを導入し、DoDリトライを削減する。3つのハーネス評価レポートの失敗パターン(test_design 5回リトライ、decisions欠落、tdd_red_evidence API誤用、重複行パターン等)を全てテンプレートに反映する。

## acceptanceCriteria

- AC-1: workflow-delegation.mdが新規作成され、4層テンプレート(Why/What/How/Constraints)が3種(coordinator/worker-write/worker-verify)定義されている
  - 検証: ファイル存在確認 + 各テンプレートに4セクション(Why/What/How/Constraints)が含まれること
  - 検証: 3種のテンプレートがそれぞれ委譲先パターン名(coordinator/worker-write/worker-verify)で区別されていること
- AC-2: 約20の委譲対象フェーズのパラメータ表が存在し、各フェーズのOutput spec(必須セクション+中身の書き方)が定義されている
  - 検証: パラメータ表にフェーズ名、テンプレート種別、Output spec(必須セクション列挙+記述指針)、よくある失敗の列が存在すること
  - 検証: 委譲対象フェーズ(hearing以外の約20フェーズ)が網羅されていること
- AC-3: workflow-phases.mdの全フェーズにステージ共通Why(8個)+フェーズ固有補足が追加されている
  - 検証: 8ステージそれぞれに共通Whyが定義されていること
  - 検証: 各フェーズ記述にWhy(目的)が含まれていること
- AC-4: coordinator.md/worker.md/hearing-worker.mdにPrompt Contract(テンプレート構造の参照+判断の軸としてWhy/Contextを使う指示)が追記されている
  - 検証: 3ファイルそれぞれにPrompt Contract節が存在し、workflow-delegation.mdへの参照を含むこと
  - 検証: Why/Contextを判断の軸とする指示が明記されていること
- AC-5: 3つのハーネス評価レポートの失敗パターン(decisions欠落、tdd_red_evidence API誤用、重複行、TOON/Markdown不整合等)がテンプレートのConstraintsまたはHowに反映されている
  - 検証: 以下の失敗パターンがConstraintsまたはHowのいずれかに記載されていること
    - decisionsセクション欠落(レポート1: 5フェーズで発生)
    - tdd_red_evidence API誤用(レポート2: harness_record_proofではなくharness_record_test_result使用)
    - 重複行パターン(レポート3 FB-2: scope_definition/manual_test/e2e_testで発生)
    - TOON/Markdown不整合(レポート3 FB-3: code-review.mdのフォーマット)
    - 必須セクション欠落(レポート1: artifact_quality L3失敗)
- AC-6: 全変更ファイルが200行以下を維持している
  - 検証: 6ファイル全てが200行以下であること(行数はimpact-analysisの予測範囲内)

## notInScope

- FB-1 RTM重複防止のコード修正(別タスク)
- FB-4 承認待ち分離のコード修正(別タスク)
- harness_get_subphase_templateの修正(FB-3、別タスク)
- SKILL.md File Index更新(今回のスコープ外)
- SKILL.md File Routing表の更新(今回のスコープ外)
- workflow-execution.mdの既存「subagent委譲時の必須コンテキスト」セクション削除(別タスクで対応、R-1リスク参照)
- workflow-orchestrator.mdのTemplate Rulesとの整合性修正(R-4リスク、別タスクで対応)
- prompt-masterのスキル常駐(hearing時点で不採用決定済み)

## openQuestions

## decisions

- テンプレート定義方式: 3種の共通テンプレート+フェーズ別パラメータ表 — 20フェーズ分の個別テンプレートは冗長でメンテナンス困難であり、200行制限にも収まらない
- Why追加方式: ステージ共通Why(8個)+フェーズ固有補足(各1行) — フェーズごとに独立Whyを書くと重複が大きく、phases.mdが200行を超過する
- workflow-delegation.mdの配置: .claude/skills/workflow-harness/配下に新規作成 — フェーズ定義(phases.md)と委譲プロトコル(delegation.md)は責務が異なるため分離する
- 委譲テンプレートとDoD成果物テンプレートの区別: 委譲テンプレートはスキルファイルが定義するプロンプト構造であり、harness_get_subphase_templateが返すDoD成果物テンプレートとは別物であることを明記する — forbidden-actions.mdの「テンプレート自作禁止」との誤解を防止(R-2)
- workflow-execution.mdの既存セクション: 今回は変更せず、delegation.mdとの責務分離は別タスクで対応 — スコープ肥大を防止し、delegation.md単体で完結する設計とする
- Prompt Contract追記位置: 各agentファイルのRole節の直後に追記 — YAML frontmatter直後ではなくRole定義を読んだ後に参照する方が認知的に自然
- 失敗パターンの反映先: フェーズ横断の共通失敗はテンプレートのConstraintsセクションに、フェーズ固有の失敗はパラメータ表の「よくある失敗」列に記載 — 二重化を避けつつ適切な粒度で配置する

## artifacts

| # | ファイルパス | 変更種別 | 対応AC | 対応RTM |
|---|-------------|---------|--------|---------|
| 1 | .claude/skills/workflow-harness/workflow-delegation.md | 新規 | AC-1, AC-2, AC-5 | F-001, F-002, F-005 |
| 2 | .claude/skills/workflow-harness/workflow-phases.md | 編集 | AC-3, AC-6 | F-003 |
| 3 | .claude/agents/coordinator.md | 編集 | AC-4, AC-6 | F-004 |
| 4 | .claude/agents/worker.md | 編集 | AC-4, AC-6 | F-004 |
| 5 | .claude/agents/hearing-worker.md | 編集 | AC-4, AC-6 | F-004 |
| 6 | .claude/rules/tool-delegation.md | 編集 | AC-6 | F-006 |

## next

- planningフェーズで技術設計
