# Planning: agent-delegation-prompt-templates

## 技術設計

### F-001: workflow-delegation.md — 4層テンプレート3種

ファイル: .claude/skills/workflow-harness/workflow-delegation.md (新規、目標150行以下)

frontmatter:
name: workflow-delegation
description: 4-layer delegation prompt templates for coordinator/worker/hearing-worker agents.

テンプレートA: coordinator型
用途: 分析・分解・ファイル書き出し(scope_definition, research, impact_analysis, requirements, planning, test_design)

構造:
- Why: ステージWhyを転記 + フェーズ固有補足
- Context: ユーザーの本当の目的(hearingのdeepから)
- What: Output(書くべきファイルパス), Sections(必須セクション一覧と各セクションの書き方)
- How: 手順(番号付きリスト。使うツール、読むファイル、書く順序)
- Constraints: Scope(read/write範囲), Forbidden(禁止事項), Quality(品質ルール), Prior failures(リトライ理由)

テンプレートB: worker-write型
用途: ファイル読み→成果物作成(threat_modeling, state_machine, flowchart, ui_design, test_impl, implementation, docs_update)

構造:
- Why/Context: 同上
- What: Output(ファイルパスと形式), Spec(満たすべき仕様 — AC/RTM参照 or 具体条件)
- How: 手順
- Constraints: Scope(write対象), Forbidden(禁止語+スコープ外), Quality, Prior failures

テンプレートC: worker-verify型
用途: 実行→結果検証(build_check, code_review, testing, regression_test, manual_test, security_scan, performance_test, e2e_test)

構造:
- Why/Context: 同上
- What: Execute(実行コマンド/手順), Compare(比較基準), Output(レポートパス), Pass criteria(合格条件)
- How: 手順
- Constraints: Fail action(失敗時の行動), Quality, Prior failures

### F-002: フェーズ別パラメータ表

同ファイル内に表形式で全委譲対象フェーズを定義:

| Phase | Template | Role | 必須セクション | よくある失敗 |
|-------|----------|------|--------------|------------|
| scope_definition | coordinator | コードベース調査 | entry_points, affected_files, decisions(5件) | scope過大(100ファイル超) |
| research | coordinator | コードベース調査 | サマリー, ユーザー意図の分析, decisions(5件), 影響範囲 | decisions欠落, 推測と事実の混同 |
| impact_analysis | coordinator | 依存関係分析 | 影響範囲サマリー, 依存関係グラフ, decisions(5件) | decisions欠落 |
| hearing | hearing-worker | 意図分析 | ユーザー意図の分析, artifacts, next, userResponse | sections欠落, userResponse欠落 |
| requirements | coordinator | 要件定義 | acceptanceCriteria(3件以上), notInScope, openQuestions, decisions(5件) | openQuestions未解決, 意図キーワード未反映 |
| threat_modeling | worker-write | セキュリティ分析 | STRIDE分析, リスクサマリー, decisions(5件) | 分析の浅さ |
| planning | coordinator | 技術設計 | F-NNN仕様, 実装順序, decisions(5件) | RTM未登録 |
| state_machine | worker-write | 状態遷移設計 | stateDiagram-v2, 3状態以上, Start/End | 状態不足 |
| flowchart | worker-write | フロー設計 | flowchart TD, 3ノード以上, 2エッジ以上 | ノード不足 |
| ui_design | worker-write | UI設計 | 画面一覧, 操作フロー, decisions(5件) | sections欠落 |
| test_design | coordinator | テスト設計 | TC-AC{N}-{seq}形式, 全AC>=1TC, 期待結果に具体値 | content_validation(期待結果が曖昧) |
| test_selection | worker-write | テスト選定 | vitest --related結果, decisions(5件) | delta_entry_format |
| test_impl | worker-write | TDD Red | テストコード + 実行結果(FAIL証拠) | tdd_red_evidence(record_test_resultを使え) |
| implementation | worker-write | TDD Green | 全テストPASS | テスト未通過 |
| build_check | worker-verify | ビルド検証 | tsc/eslint/madge結果 | ビルドエラー |
| code_review | worker-verify | コードレビュー(opus) | サマリー, 設計-実装整合性, AC Achievement Status | content_validation, Markdown形式で書くこと(TOON禁止) |
| testing | worker-verify | テスト実行 | 全テスト結果, baseline capture | baseline未取得 |
| regression_test | worker-verify | 回帰テスト | baseline比較結果, 新規失敗数 | baseline_required |
| manual_test | worker-verify | 手動テスト | テストシナリオ, テスト結果 | 重複行パターン |
| security_scan | worker-verify | セキュリティ検査 | 脆弱性スキャン結果, 検出された問題 | 重複行パターン |
| performance_test | worker-verify | パフォーマンス | 計測結果, ボトルネック分析 | 重複行パターン |
| e2e_test | worker-verify | E2Eテスト | E2Eシナリオ, 実行結果 | 重複行パターン |
| docs_update | worker-write | ドキュメント更新 | 更新対象, 変更内容 | scope外ファイル編集 |

### F-003: workflow-phases.md Why追加

各ステージ冒頭に共通Why行を追加。各フェーズにもフェーズ固有Why補足を1行追加。

ステージ共通Why(8個):
- Stage 0 (Scope): 影響範囲を限定し、見落としと過剰スコープを防ぐ
- Stage 1 (Research): 事実を把握し、推測混入による下流汚染を防ぐ
- Stage 2 (Requirements): ユーザー意図をACとして合意し、下流のブレを防ぐ
- Stage 3 (Design): 構造を決め、実装時の判断迷いを防ぐ
- Stage 4 (Test): 検証基準を実装より先に固定し、テストの実装追従を防ぐ
- Stage 5 (Implementation): テストを通す最小実装で、過剰実装を防ぐ
- Stage 6 (Quality): 設計との整合性と回帰を検証し、意図からの逸脱を検出する
- Stage 7 (Delivery): 安全にリリースし、問題を早期検出する

### F-004: Prompt Contract追記

3つのエージェント定義の Role 節直後に追記:

## Prompt Contract
オーケストレーターからのプロンプトは workflow-delegation.md の4層構造(Why/What/How/Constraints)で来る。
- Why/Contextを判断の軸にし、迷ったときはユーザー意図に立ち返る
- What/Output specの必須セクションを全て含める
- Constraintsの禁止事項を遵守する

### F-005: 失敗パターン反映

テンプレートConstraintsの共通ルール:
- decisions: 全成果物に最低5件。形式: - 対象: 判断 -- 理由
- 重複行禁止: 同一テキスト3回以上の繰り返し禁止
- グラウンディング: 事実はコード/ファイルから引用。推測は[推測]と明記
- 禁止語: forbidden-actions.mdの禁止語リストを参照
- 必須セクション確認: Output specの全セクションが成果物に含まれていることを書き出し前に自己確認

フェーズ固有(パラメータ表のよくある失敗列に記載):
- test_impl: harness_record_test_result(exitCode=1)を使え。harness_record_proof(tdd_red_evidence)ではない
- code_review: Markdown形式で記述。TOON形式のdecisions禁止
- research/impact/acceptance: decisionsを5件以上書くこと(delta_entry_format頻発)

### F-006: tool-delegation.md追記

既存ルールの末尾に1行追加:
- Agent呼び出し時はworkflow-delegation.mdの4層テンプレート(Why/What/How/Constraints)に従う。

## 実装順序

1. workflow-delegation.md新規作成(F-001, F-002, F-005) -- 最大の成果物
2. workflow-phases.md編集(F-003) -- Why追加
3. coordinator.md / worker.md / hearing-worker.md編集(F-004) -- 並列可能
4. tool-delegation.md編集(F-006) -- 1行追加

## decisions

- テンプレートは3種で全委譲フェーズをカバー: 個別テンプレートは冗長で200行制限に収まらない
- パラメータ表はテンプレートと同一ファイルに配置: 別ファイルにすると参照コストが増加
- 失敗パターンは共通/固有の2層で反映: 共通はConstraints、固有はパラメータ表のよくある失敗列
- Prompt Contractは3行で最小限: テンプレート詳細はworkflow-delegation.mdに集約
- 実装順序は依存関係順: delegation.md(参照元)を先に作成し、参照する側を後に編集
- workflow-execution.mdの既存委譲コンテキストは今回変更しない: スコープ外(R-1リスク対応は別タスク)

## artifacts

| ファイル | 変更種別 | 対応RTM |
|---------|---------|---------|
| .claude/skills/workflow-harness/workflow-delegation.md | 新規 | F-001, F-002, F-005 |
| .claude/skills/workflow-harness/workflow-phases.md | 編集 | F-003 |
| .claude/agents/coordinator.md | 編集 | F-004 |
| .claude/agents/worker.md | 編集 | F-004 |
| .claude/agents/hearing-worker.md | 編集 | F-004 |
| .claude/rules/tool-delegation.md | 編集 | F-006 |

## next

- state_machine / flowchart / design_reviewフェーズへ
