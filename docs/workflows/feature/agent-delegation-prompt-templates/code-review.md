# Code Review: agent-delegation-prompt-templates

## サマリー

4層委譲テンプレート(Why/What/How/Constraints)導入タスクの6ファイル変更をレビューした。主成果物のworkflow-delegation.md(新規125行)は3種テンプレートとフェーズ別パラメータ表を含み、設計意図に沿った構成である。tool-delegation.mdへの4層テンプレート参照追記(F-006)も完了。一方、workflow-phases.mdへのステージ共通Why追加(F-003/AC-3)と3エージェント定義へのPrompt Contract追記(F-004/AC-4)が未実装であり、設計との乖離がある。

## 設計-実装整合性

### F-001: workflow-delegation.md 4層テンプレート3種

Template A(coordinator)、B(worker-write)、C(worker-verify)の3種が定義されている。各テンプレートにWhy/Context/What/How/Constraintsの構造が含まれる。planningの設計と一致する。Template Cには Execute/Compare/Pass criteria が含まれ、verify型の特性を反映している。

### F-002: フェーズ別パラメータ表

23フェーズ分のパラメータ表が存在する(hearing含む)。列構成はPhase/Template/Role/Required Sections/Common Failuresで、planningの設計(フェーズ名、テンプレート種別、Output spec、よくある失敗)と対応する。hearing以外の委譲対象フェーズが網羅されている。test_selection行にvitest --related結果が明記されるなど、フェーズ固有の出力仕様も記載されている。

### F-003: workflow-phases.md Why追加

planningでは「各ステージ冒頭に共通Why行(8個)を追加し、各フェーズにもフェーズ固有Why補足を1行追加する」と定義された。現在のworkflow-phases.md(78行)にはステージ共通Whyの明示的な行がない。Stage 0の記述は「Identify entry points and affected files」と作業内容(What)のみで、計画されたWhy「影響範囲を限定し、見落としと過剰スコープを防ぐ」が欠落している。他のStage 1-7も同様。delegation.mdテンプレートが `{stage Why from workflow-phases.md}` を参照する設計のため、参照元が存在しない状態になっている。

### F-004: Prompt Contract追記

planningでは3つのエージェント定義(coordinator.md/worker.md/hearing-worker.md)のRole節直後にPrompt Contractセクションを追記すると定義された。現在の3ファイルいずれにも「Prompt Contract」セクションが存在しない。coordinator.md(37行)、worker.md(56行)、hearing-worker.md(26行)は全て変更前の構造のままである。

### F-005: 失敗パターン反映

delegation.mdのCommon Constraintsセクション(118-126行)に以下が反映されている: decisions 5件以上必須、重複行(同一テキスト3回以上)禁止、グラウンディング、禁止語参照、セクション完全性確認。パラメータ表には: test_impl行に「use harness_record_test_result(exitCode=1), NOT harness_record_proof」、code_review行に「write in Markdown format, NOT TOON」、manual_test/security_scan/performance_test/e2e_test各行に重複行パターン警告が記載されている。3つのレポートの失敗パターンが網羅されている。

### F-006: tool-delegation.md追記

tool-delegation.md 7行目に「Agent呼び出し時はworkflow-delegation.mdの4層テンプレート(Why/What/How/Constraints)に従う。」が追記されている。planningの設計と完全一致する。

## ユーザー意図との整合性

deep意図: 「DoDリトライの根本原因『Workerが何を書くべきか知らない』を解消し、ハーネス実行時間を削減する」

delegation.mdの4層テンプレートとパラメータ表は、Workerに対して「何を書くべきか」を明示する仕組みとして機能する。Required Sections列が必須セクションを列挙し、Common Failures列が過去の失敗パターンを警告することで、1回目の委譲でDoDを通過する確率が向上する。Prior failuresフィールドによるリトライ理由の伝達も、同一失敗の反復を防止する。

ただし、F-003(Why追加)とF-004(Prompt Contract)が未実装のため、Workerが「なぜこの作業をするのか」を理解する経路が不完全である。Whyの欠落は「何を書くべきか」の理解を補強する文脈情報の欠如を意味し、deep意図の達成が部分的に留まっている。

## AC Achievement Status

| AC | 内容 | 状態 | 根拠 |
|----|------|------|------|
| AC-1 | workflow-delegation.mdに4層テンプレート3種 | PASS | Template A/B/Cが定義済み。各テンプレートにWhy/What/How/Constraints構造あり |
| AC-2 | 約20フェーズのパラメータ表 | PASS | 23フェーズ分の表が存在。列: Phase/Template/Role/Required Sections/Common Failures |
| AC-3 | workflow-phases.mdにステージ共通Why+フェーズ固有補足 | FAIL | 8ステージの共通Why行が未追加。フェーズ固有補足も未追加 |
| AC-4 | 3エージェント定義にPrompt Contract | FAIL | coordinator.md/worker.md/hearing-worker.mdいずれにもPrompt Contractセクションなし |
| AC-5 | 失敗パターン反映 | PASS | Common Constraintsに5項目+パラメータ表のCommon Failures列に個別パターン反映済み |
| AC-6 | 全ファイル200行以下 | PASS | delegation 125行, phases 78行, coordinator 37行, worker 56行, hearing-worker 26行, tool-delegation 9行 |

## decisions

- CR-1: delegation.mdのテンプレート構造は設計に忠実 -- 3種テンプレートの構造(A: Sections付きWhat、B: Spec付きWhat、C: Execute/Compare/Pass criteria付きWhat)がplanningのF-001と一致しており、委譲先の役割差を適切に反映している
- CR-2: パラメータ表のCommon Failures列は実用的 -- 各フェーズ固有の失敗パターン(test_implのAPI誤用、code_reviewのTOON/Markdown不整合等)が具体的で、Workerの初回成功率向上に寄与する
- CR-3: F-003(ステージWhy追加)は未実装であり修正必要 -- delegation.mdが `{stage Why from workflow-phases.md}` を参照する設計のため、phases.mdにWhyが存在しないとオーケストレーターがテンプレートを埋められない
- CR-4: F-004(Prompt Contract)は未実装であり修正必要 -- エージェントが4層構造を認識する経路がなく、delegation.mdの効果が限定される
- CR-5: delegation.mdのCommon Constraintsセクションはスコープ変更検知を含む -- 「if scope expands mid-task, update userIntent via harness_set_scope」はplanningに明示されていなかったが、運用上有用な追加である
- CR-6: test_selection行のCommon Failuresが「delta_entry_format」のみで具体的な失敗内容の記載がない -- 他のフェーズ(test_impl等)と比べ情報量が少なく、Workerへの警告効果が弱い
- CR-7: hearing行がパラメータ表に含まれている -- requirementsではhearing以外の約20フェーズが委譲対象とされたが、hearing-workerは独自プロトコルで動作するため参照情報として問題はない

## artifacts

| ファイル | 行数 | 状態 |
|---------|------|------|
| .claude/skills/workflow-harness/workflow-delegation.md | 125 | 新規作成済み、F-001/F-002/F-005適合 |
| .claude/skills/workflow-harness/workflow-phases.md | 78 | F-003未実装(Why未追加) |
| .claude/agents/coordinator.md | 37 | F-004未実装(Prompt Contract未追記) |
| .claude/agents/worker.md | 56 | F-004未実装(Prompt Contract未追記) |
| .claude/agents/hearing-worker.md | 26 | F-004未実装(Prompt Contract未追記) |
| .claude/rules/tool-delegation.md | 9 | F-006適合 |

## next

- F-003: workflow-phases.mdに8ステージの共通Why行とフェーズ固有補足を追加
- F-004: coordinator.md/worker.md/hearing-worker.mdにPrompt Contractセクションを追記
- 上記修正後、AC-3/AC-4を再検証
