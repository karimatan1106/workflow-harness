# Test Design: agent-delegation-prompt-templates

## テスト戦略

本タスクはMarkdownファイルの追加・編集のみでコード変更がないため、自動テスト(vitest)は不要。
テストは成果物の構造検証(grep/wc -l)とレビューで実施する。

## テストケース一覧

### AC-1: workflow-delegation.md新規作成、4層テンプレート3種

TC-AC1-01: coordinator型テンプレートが存在する
- 前提: .claude/skills/workflow-harness/workflow-delegation.md が作成済み
- 操作: grep "coordinator" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: "coordinator"を含む行が1行以上存在する

TC-AC1-02: worker-write型テンプレートが存在する
- 操作: grep "worker-write" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: "worker-write"を含む行が1行以上存在する

TC-AC1-03: worker-verify型テンプレートが存在する
- 操作: grep "worker-verify" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: "worker-verify"を含む行が1行以上存在する

TC-AC1-04: 各テンプレートにWhy/What/How/Constraintsの4層が含まれる
- 操作: grep -c "Why\|What\|How\|Constraints" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: 12以上(3テンプレート x 4層)

TC-AC1-05: テンプレートがDoD成果物テンプレートと区別されている
- 操作: grep "harness_get_subphase_template" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: 0行(DoDテンプレートへの混同記載がない)、または区別を明記する行が1行以上存在する

### AC-2: 約20フェーズのパラメータ表

TC-AC2-01: パラメータ表のヘッダーに必須列が存在する
- 操作: grep "Phase\|Template\|必須セクション\|よくある失敗" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: "Phase"と"Template"と"必須セクション"と"よくある失敗"を含むヘッダー行が1行存在する

TC-AC2-02: パラメータ表に20フェーズ以上のデータ行が存在する
- 操作: パラメータ表内の "|" で始まるデータ行をカウント(ヘッダー/区切り行を除く)
- 期待結果: 20行以上(planningのF-002パラメータ表に定義された22フェーズ分)

TC-AC2-03: hearingフェーズが委譲対象に含まれている
- 操作: grep "hearing" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: パラメータ表内に"hearing"行が1行存在する(planningのF-002にhearing行あり)

### AC-3: workflow-phases.mdの全フェーズにWhy追加

TC-AC3-01: 8ステージそれぞれに共通Whyが存在する
- 操作: grep -c "Why:" .claude/skills/workflow-harness/workflow-phases.md
- 期待結果: 8以上(Stage 0〜7の各1個)

TC-AC3-02: Stage 0のWhyが「影響範囲を限定」に関する記述を含む
- 操作: grep "Stage 0" 周辺のWhy行を確認
- 期待結果: F-003で定義された「影響範囲を限定し、見落としと過剰スコープを防ぐ」に沿った記述が存在する

TC-AC3-03: Stage 4のWhyが「検証基準を実装より先に固定」に関する記述を含む
- 操作: grep "Stage 4" 周辺のWhy行を確認
- 期待結果: F-003で定義された「検証基準を実装より先に固定し、テストの実装追従を防ぐ」に沿った記述が存在する

TC-AC3-04: workflow-phases.mdの既存フェーズ記述が破壊されていない
- 操作: grep -c "### Stage" .claude/skills/workflow-harness/workflow-phases.md
- 期待結果: 8以上(既存の8ステージ見出しが全て維持されている)

### AC-4: Prompt Contract追記

TC-AC4-01: coordinator.mdにPrompt Contractセクションが存在する
- 操作: grep "Prompt Contract" .claude/agents/coordinator.md
- 期待結果: coordinator.mdに"## Prompt Contract"見出しが存在する(1行)

TC-AC4-02: worker.mdにPrompt Contractセクションが存在する
- 操作: grep "Prompt Contract" .claude/agents/worker.md
- 期待結果: worker.mdに"## Prompt Contract"見出しが存在する(1行)

TC-AC4-03: hearing-worker.mdにPrompt Contractセクションが存在する
- 操作: grep "Prompt Contract" .claude/agents/hearing-worker.md
- 期待結果: hearing-worker.mdに"## Prompt Contract"見出しが存在する(1行)

TC-AC4-04: 3ファイル全てがworkflow-delegation.mdへの参照を含む
- 操作: grep -l "workflow-delegation" .claude/agents/coordinator.md .claude/agents/worker.md .claude/agents/hearing-worker.md
- 期待結果: 3ファイル全てがマッチする

TC-AC4-05: Why/Contextを判断の軸とする指示が含まれる
- 操作: grep "Why\|Context\|判断の軸\|意図に立ち返る" .claude/agents/coordinator.md
- 期待結果: Why/Contextに関する指示行が1行以上存在する(3ファイル各1行以上)

### AC-5: 3レポートの失敗パターン反映

TC-AC5-01: decisionsセクション必須ルールがConstraintsに記載されている
- 操作: grep "decisions" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: "decisions"を含む行が2行以上(Constraints共通ルール + パラメータ表内)

TC-AC5-02: tdd_red_evidence正しいAPI(harness_record_test_result)が記載されている
- 操作: grep "record_test_result" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: "record_test_result"を含む行が1行以上存在する

TC-AC5-03: 重複行禁止ルールが記載されている
- 操作: grep "重複" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: "重複"を含む行が1行以上存在する(Constraintsの共通ルール)

TC-AC5-04: code_reviewフェーズでMarkdown形式指定が記載されている
- 操作: パラメータ表のcode_review行を確認
- 期待結果: code_review行の「よくある失敗」列にMarkdown形式に関する記載が存在する

TC-AC5-05: 必須セクション確認ルールがConstraintsに記載されている
- 操作: grep "必須セクション" .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: Constraints領域に必須セクション確認に関する記載が1行以上存在する

### AC-6: 全ファイル200行以下

TC-AC6-01: workflow-delegation.mdが150行以下
- 操作: wc -l .claude/skills/workflow-harness/workflow-delegation.md
- 期待結果: workflow-delegation.md: 150行以下(新規ファイル、目標150行)

TC-AC6-02: workflow-phases.mdが130行以下
- 操作: wc -l .claude/skills/workflow-harness/workflow-phases.md
- 期待結果: workflow-phases.md: 130行以下(現在79行+Why追加約40行)

TC-AC6-03: coordinator.mdが45行以下
- 操作: wc -l .claude/agents/coordinator.md
- 期待結果: coordinator.md: 45行以下(現在38行+3行追加)

TC-AC6-04: worker.mdが65行以下
- 操作: wc -l .claude/agents/worker.md
- 期待結果: worker.md: 65行以下(現在57行+3行追加)

TC-AC6-05: hearing-worker.mdが35行以下
- 操作: wc -l .claude/agents/hearing-worker.md
- 期待結果: hearing-worker.md: 35行以下(現在27行+3行追加)

TC-AC6-06: tool-delegation.mdが15行以下
- 操作: wc -l .claude/rules/tool-delegation.md
- 期待結果: tool-delegation.md: 15行以下(現在8行+1行追加)

## acTcMapping

- AC-1: TC-AC1-01, TC-AC1-02, TC-AC1-03, TC-AC1-04
- AC-2: TC-AC2-01, TC-AC2-02
- AC-3: TC-AC3-01, TC-AC3-02
- AC-4: TC-AC4-01, TC-AC4-02, TC-AC4-03, TC-AC4-04
- AC-5: TC-AC5-01, TC-AC5-02, TC-AC5-03, TC-AC5-04
- AC-6: TC-AC6-01, TC-AC6-02, TC-AC6-03, TC-AC6-04, TC-AC6-05, TC-AC6-06

## decisions

- 自動テスト不要: コード変更がないためvitest不使用。grep/wc -lによる構造検証で十分 -- Markdownスキルファイルの品質はDoDゲートが担保
- TC命名はTC-AC{N}-{seq}形式を厳守 -- content_validationの要件
- 期待結果は全て具体値("1行以上"/"8以上"/"200以下"等) -- test_design content_validation 5回リトライの教訓(requirements.md AC-1検証条件参照)
- AC-5は5テストケースで各失敗パターンを個別検証 -- 1つのTCに詰め込むと失敗原因の特定が困難
- AC-1にTC-AC1-05を追加: DoD成果物テンプレートとの区別検証 -- requirements.md decisions「委譲テンプレートとDoD成果物テンプレートの区別」に対応
- AC-3にTC-AC3-04を追加: 既存コンテンツの非破壊検証 -- workflow-phases.mdの編集で既存フェーズ記述が消失するリスクに対応

## artifacts

| テストケース | 対応AC | 対応RTM |
|------------|--------|---------|
| TC-AC1-01〜05 | AC-1 | F-001 |
| TC-AC2-01〜03 | AC-2 | F-002 |
| TC-AC3-01〜04 | AC-3 | F-003 |
| TC-AC4-01〜05 | AC-4 | F-004 |
| TC-AC5-01〜05 | AC-5 | F-005 |
| TC-AC6-01〜06 | AC-6 | F-001〜F-006 |

## next

- test_selectionフェーズ(既存テストの選定。本タスクはコード変更なしのため最小)
- test_implフェーズ(検証スクリプト作成)
