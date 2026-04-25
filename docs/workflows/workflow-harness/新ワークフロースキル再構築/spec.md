## サマリー

- 目的: ワークフロースキル（workflow/SKILL.md・phases/・project/SKILL.md）を全面刷新し、19フェーズ・22MCPツール・Orchestratorパターンに対応した最適なスキルセットを構成する。
- 主要な決定事項: (1) workflow/SKILL.md はフェーズ数を18→19へ修正し、approve 4種別・workflow_back・workflow_set-scope を追加する。(2) workflow_switch は削除し、代替手順（workflow_list + workflow_status）を明記する。(3) Orchestratorパターン・sessionToken 二層構造・バリデーション失敗時のsubagent再起動義務を新規セクションとして追加する。(4) phases/ ディレクトリは既存6ファイルを更新し、13ファイルを新規作成して合計19ファイル体制にする。(5) project/SKILL.md の /project resume 手順に workflow_list + workflow_status の2ステップを追記する。
- 次フェーズで必要な情報: 各ファイルの具体的な記述内容（design_review フェーズ・parallel_verification サブフェーズのテンプレート仕様）、実装順序の優先度（Critical T-001/T-002 が最優先）、既存 phases/ ファイル更新時の記述スタイルの統一方針。

---

## 概要

本仕様書は「新ワークフロースキル再構築」タスクの planning フェーズ成果物として、requirements.md（F-001〜F-028）および threat-model.md（T-001〜T-005）の内容を統合し、implementation フェーズで直接参照できる設計仕様を定める。

### 問題の根本原因

現行スキルには4種の根本的な不整合が存在し、これらは全て SKILL.md が最後に更新された Sprint 7 以前の状態に固定されたことに起因する。

第1の問題は、SKILL.md のフェーズ数「18フェーズ」の記載である。Sprint 7 で regression_test フェーズが追加された結果、CLAUDE.md と SKILL.md の間に乖離が生じ、AI がフェーズ順序を誤って案内するリスクがある。

第2の問題は、approve コマンドの記述が `/workflow approve design` のみで、requirements/test_design/code_review の3種別が欠落していることである。この欠落により、4つの品質ゲートのうち3つが AI から隠蔽された状態になっている。

第3の問題は、phases/ ディレクトリに 19 フェーズ中 13 フェーズ分のガイドが存在しないことである。既存の6ファイルも内容が旧仕様（承認フロー省略・設計チェックリスト未記載）のままである。

第4の問題は、Orchestratorパターン・sessionToken 二層構造・バリデーション再起動義務（ルール21相当）がSKILL.md に一切記載されていないことである。これらのルールは CLAUDE.md に定義されているが、SKILL.md を参照する AI が把握できない状態となっている。

### アーキテクチャ上の位置づけ

```
CLAUDE.md（最高権威・ルール定義）
    ↓ 参照
workflow/SKILL.md（ユーザー向けコマンドガイド + Orchestratorガイド）
    ↓ 補助参照
phases/（フェーズ別補助ドキュメント）
    ↓ 実質的プロンプト源泉は下記
definitions.ts の subagentTemplate（実際の subagent プロンプト）
```

phases/ ファイルは definitions.ts の subagentTemplate が実質的プロンプト源泉であるため、Orchestratorが参照する補助ドキュメントとして位置づける。definitions.ts の変更は本タスクのスコープ外である。

---

## 実装計画

### 優先度1（Critical・最初に実装）

requirements.md の脅威モデル分析では T-001（フェーズ定義不整合）と T-002（承認漏れ）が Critical と評価されているため、以下を最優先で実装する。

**F-001: フェーズ数の19フェーズへの修正**

workflow/SKILL.md のフロントマター description を「18フェーズ」から「19フェーズ」に変更する。フェーズ構成セクションの一覧に regression_test フェーズ（testing の後、parallel_verification の前）を追加する。フェーズ原則テーブルにも regression_test の行を追加し、「リグレッション確認・既知バグ記録」という目的を記述する。受入条件 AC-001（文字列「18フェーズ」が0件）と AC-002（regression_test の明記）を満たすことが完了基準である。

**F-002: approve コマンドの4種別完全記述**

現行の「設計レビュー承認」セクションを「承認コマンド（4種別）」セクションに拡充する。各種別のコマンド、対象フェーズ、呼び出し義務の説明を以下の形式で記述する。

- `/workflow approve requirements` — requirementsフェーズ完了後にユーザー承認を待機する
- `/workflow approve design` — design_reviewフェーズ完了後にユーザー承認を待機する（現行記述を精緻化）
- `/workflow approve test_design` — test_designフェーズ完了後にユーザー承認を待機する
- `/workflow approve code_review` — code_reviewフェーズ完了後にユーザー承認を待機する

受入条件 AC-003〜AC-005 を満たすことが完了基準である。

### 優先度2（High・次に実装）

**F-003: workflow_switch コマンドの削除**

SKILL.md のコマンドセクションから「タスク切替」項目（`/workflow switch <task-id>`）を削除する。削除箇所に複数タスク確認の代替手順として「workflow_list でタスクIDを確認し、workflow_status でそのタスクの詳細と sessionToken を取得する」旨を記述する。また、禁止MCPツールリストから `mcp__workflow__workflow_switch` を削除する。受入条件 AC-006・AC-007 を満たすことが完了基準である。

**F-004: workflow_back コマンドの新規追加**

コマンドセクションに「フェーズ差し戻し」として `/workflow back <対象フェーズ>` を追加する。用途（未実装項目が code_review で発覚した場合に implementation へ差し戻す等）と書式例（`/workflow back implementation`）を記述する。成果物が失われない点も明記する。受入条件 AC-008・AC-009 を満たすことが完了基準である。

**F-005: workflow_set-scope コマンドの新規追加**

コマンドセクションに「スコープ設定」として `/workflow set-scope` を追加する。research または requirements フェーズで実行する旨、dirs/files/glob パラメータの用途、スコープ未設定時の test_impl フェーズスキップリスクを記述する。具体的な設定例（dirs パラメータを含む）を示す。受入条件 AC-010・AC-011 を満たすことが完了基準である。

**F-006: Orchestratorパターンの明記**

SKILL.md に「Orchestratorパターン」セクションを新規追加する。記述内容は以下のとおりである。

メインの Claude は Orchestrator として動作し、各フェーズを Task tool 経由で subagent に委譲する。subagentTemplate は workflow_next のレスポンスから取得し、取得できない場合は workflow_get_subphase_template を使用する。成果物ファイルはOrchestratorが直接 Edit/Write で編集することを禁止し、修正も subagent 再起動で行う。並列フェーズでは複数の Task tool を同時に起動する。

受入条件 AC-012・AC-013 を満たすことが完了基準である。

**F-007: sessionToken 二層構造ルールの記載**

SKILL.md に「sessionTokenの取り扱い」セクションを新規追加する。記述内容は以下のとおりである。

層1（Orchestratorが直接呼び出すMCPツール）では workflow_next / workflow_approve / workflow_complete_sub / workflow_back / workflow_set_scope / workflow_reset に sessionToken を渡す。層2（subagentへの引き渡し）は workflow_record_test_result を呼び出す目的の testing・regression_test フェーズのみ許可する。セッション再開後は taskId 指定の workflow_status で sessionToken を再取得する義務を明記する（全タスク一覧モードでは sessionToken が返されない点を注記）。

受入条件 AC-014・AC-015 を満たすことが完了基準である。

**F-008: バリデーション失敗時のsubagent再起動義務の記載**

SKILL.md に「バリデーション失敗時の再起動義務」セクションを新規追加する。Orchestrator が workflow_next でバリデーション失敗を受け取った場合、直接 Edit/Write で修正してはならず、Task tool で subagent を再起動してリトライプロンプトを渡す義務を記述する。リトライ回数別エスカレーション（1回目: エラーメッセージをそのまま渡す、2回目: 行番号レベルの修正指示を追加、3回目以降: sonnet モデルに切り替え）を要約形式で記載する。リトライプロンプトには「前回失敗理由コードブロック」と「改善要求セクション」が必須である旨も記述する。受入条件 AC-016・AC-017 を満たすことが完了基準である。

**F-026: project スキルの /project resume 改善**

project/SKILL.md の「/project resume の動作」セクションを更新する。動作手順を以下の3ステップに改訂する。

1. workflow_list を呼び出してアクティブなタスクの taskId を確認する。
2. taskId を指定して workflow_status を呼び出し、現在のフェーズと sessionToken を取得する。
3. sessionToken が取得できた場合、Orchestrator として通常の作業を再開する。

受入条件 AC-023・AC-024 を満たすことが完了基準である。

### 優先度3（Medium・続いて実装）

**F-027: MCPツール分類表の整備**

SKILL.md に「MCPツール分類」セクションを追加し、22種類のMCPツールをカテゴリ1（ユーザー向けコマンド対応・9種）とカテゴリ2（Orchestrator内部ツール・13種）に分類した表を掲載する。受入条件 AC-025・AC-026 を満たすことが完了基準である。

カテゴリ1（9種）: workflow_start, workflow_next, workflow_status, workflow_approve, workflow_reset, workflow_list, workflow_complete_sub, workflow_back, workflow_set_scope

カテゴリ2（13種）: workflow_record_test, workflow_capture_baseline, workflow_get_test_info, workflow_record_known_bug, workflow_get_known_bugs, workflow_record_test_result, workflow_get_subphase_template, workflow_record_completion_proof, workflow_save_checkpoint, workflow_record_feedback, workflow_create_subtask, workflow_link_tasks, workflow_pre_validate

**F-028: 既存 phases/ ファイルの内容更新**

requirements.md に `workflow_approve type="requirements"` の呼び出し手順を追記する（AC-027）。implementation.md に設計チェックリスト5項目（spec.md 全機能・state-machine.mmd 全状態遷移・flowchart.mmd 全処理フロー・ui-design.md 全UI要素・test-design.md 全テストケース対応）を追記する（AC-028）。

**F-009: phases/ ディレクトリの index.md 整備**

phases/index.md を全面更新する。phases/ の役割定義（補助参照ドキュメント・definitions.ts が実質的プロンプト源泉）と、19フェーズ全ファイルの対応表を記述する。未作成フェーズは「実装フェーズで整備する」等の代替表現で明記する（受入条件 AC-018・AC-019 を満たすこと）。

### 優先度4（新規 phases/ ファイルの作成）

**F-010〜F-022: 13種の新規フェーズテンプレート作成**

以下の13ファイルを `workflow-plugin/skills/workflow/phases/` に新規作成する。各ファイルは「## 目的」「## 入力ファイル」「## 出力ファイル」「## 作業内容」の4必須セクションを含み、最低30行以上の実質的な内容を持つこと（NFR-002 準拠）。

| ファイル名 | 対象フェーズ | 重要な記述要件 |
|-----------|-------------|--------------|
| state-machine.md | state_machine | stateDiagram-v2 記法・名前付き状態（Start/End）ルール |
| flowchart.md | flowchart | flowchart TD 記法・処理フロー記述基準 |
| ui-design.md | ui_design | CDD ストーリー定義・コンポーネント仕様書連携 |
| design-review.md | design_review | 承認フロー・workflow_approve type="design" 手順 |
| test-impl.md | test_impl | TDD Red フェーズ・ストーリー実装（.stories.tsx）義務 |
| refactoring.md | refactoring | haiku モデル適用・テスト維持義務 |
| build-check.md | build_check | 全カテゴリBashコマンド許可・ビルドエラー修正手順 |
| code-review.md | code_review | 設計-実装整合性6項目・ユーザー意図確認義務 |
| testing.md | testing | ベースライン記録（workflow_capture_baseline）・exit code確認 |
| regression-test.md | regression_test | workflow_record_known_bug 手順・ベースライン比較 |
| manual-test.md | manual_test | 必須セクション「テストシナリオ」「テスト結果」 |
| security-scan.md | security_scan | 必須セクション「脆弱性スキャン結果」「検出された問題」 |
| performance-test.md | performance_test | 必須セクション「パフォーマンス計測結果」「ボトルネック分析」 |

追加候補（優先度中）として e2e-test.md・docs-update.md・commit.md の3ファイルも実装フェーズで作成を目指す。

---

## 変更対象ファイル

### workflow/SKILL.md の改訂仕様

**ファイルパス**: `workflow-plugin/skills/workflow/SKILL.md`

変更の方針として、現行ファイルに対して以下のセクション単位の追加・削除・更新を行う。ファイル全体の書き換えではなく、既存の良い記述は維持したうえで不足している内容を補完する方式とする。

フロントマター description の「18フェーズ」を「19フェーズ」に変更する（F-001）。

コマンドセクションについて、「タスク切替」項目（workflow_switch）を削除し、代替手順を追記する（F-003）。「フェーズ差し戻し」（/workflow back）と「スコープ設定」（/workflow set-scope）を新規追加する（F-004・F-005）。「設計レビュー承認」を「承認コマンド（4種別）」に拡充する（F-002）。

フェーズ構成セクションについて、「18フェーズ」表記を「19フェーズ」に修正し、regression_test を追記する（F-001）。フェーズ原則テーブルに regression_test 行を追加する。

新規追加セクション（F-006〜F-008・F-027）として以下を追加する。

- 「Orchestratorパターン」セクション（F-006）
- 「sessionTokenの取り扱い」セクション（F-007）
- 「バリデーション失敗時の再起動義務」セクション（F-008）
- 「MCPツール分類」セクション（F-027）

禁止MCPツールリストから `mcp__workflow__workflow_switch` を削除し、代わりに `mcp__workflow__workflow_back`・`mcp__workflow__workflow_set_scope` の subagent による呼び出し禁止を明記する（F-003）。

AIへの厳命セクションに4フェーズでの workflow_approve 呼び出し義務を追記する（F-002）。

### project/SKILL.md の改訂仕様

**ファイルパス**: `workflow-plugin/skills/project/SKILL.md`

「/project resume の動作」セクションの「動作手順」を3ステップに改訂する（F-026）。現行の「mcp__workflow__workflow_status を呼び出す」という1ステップを、workflow_list → workflow_status（taskId 指定）→ セッション再開の3ステップに拡充する。sessionToken 再取得の必要性と、taskId 指定なしの workflow_status では sessionToken が返されない点を注記として追記する。

### phases/index.md の改訂仕様

**ファイルパス**: `workflow-plugin/skills/workflow/phases/index.md`

現行の「6ファイル」記載を全面更新し、19フェーズ全ファイルの対応表を掲載する（F-009）。phases/ の役割定義（補助参照ドキュメント・definitions.ts が実質的プロンプト源泉）を冒頭に明記する。Orchestratorが参照する際の優先順位（definitions.ts の subagentTemplate が最高権威・phases/ は補助情報）を記述する。

### phases/ 既存ファイルの更新仕様

**ファイルパス**: `workflow-plugin/skills/workflow/phases/requirements.md`

「## タスク」セクションに承認フロー手順を追記する（F-028）。成果物作成後に `workflow_approve type="requirements"` を呼び出してユーザー承認を待機する手順と、承認なしに次フェーズへ進んではならない旨を記述する。受入条件 AC-027 を満たすことが完了基準である。

**ファイルパス**: `workflow-plugin/skills/workflow/phases/implementation.md`

「## タスク」セクションの冒頭に設計チェックリスト5項目を追記する（F-028）。実装開始前に spec.md・state-machine.mmd・flowchart.mmd・ui-design.md・test-design.md を全て読み込み、記載された全項目を実装する義務を明示する。受入条件 AC-028 を満たすことが完了基準である。

### phases/ 新規作成ファイルの仕様

**ファイルパス**: `workflow-plugin/skills/workflow/phases/` 配下に以下13ファイルを新規作成する（F-010〜F-022）。

各ファイルの共通構成として「## 目的」「## 入力ファイル」「## 出力ファイル」「## 作業内容」の4セクションを含む。必要に応じて「## 品質基準」「## 禁止事項」「## 注意事項」セクションを追加する。各ファイルは最低30行以上の実質的な内容を持つこと（NFR-002 準拠）。

state-machine.md については stateDiagram-v2 記法の基礎と、Mermaid 図の stateDiagram-v2 では開始・終了に名前付き状態（Start, End）を使う要件を明記する。`[*]` ではなく名前付き状態を使うことで artifact-validator のバリデーションを通過できる点も補足する。

design-review.md については、design_review フェーズが Orchestratorに直接承認操作を求めるフェーズであることを明記し、`workflow_approve type="design"` を呼び出す前にユーザーへの確認が必要な点を記述する。subagent が design_review フェーズ内で workflow_approve を呼び出すことは禁止であることも明記する。

testing.md については、workflow_capture_baseline の呼び出し義務（ベースライン記録）と、テスト結果の exit code が 0 であることを L2 チェックとして確認する手順を記述する。

regression-test.md については、ベースライン未設定時の対処方法（workflow_back で testing フェーズへ差し戻し）と、今回の変更に起因する失敗は修正必須・起因しない失敗は workflow_record_known_bug で記録するフィルタリング方針を記述する。

---

## 受入条件の整理

本 spec.md で定義した設計が implementation フェーズで正しく実装されたことを確認する受入条件の一覧を以下に示す。

SKILL.md に関する受入条件（AC-001〜AC-017・AC-025〜AC-026）の全項目が満たされていること。特に以下の5項目は完了判定の核心である。

- AC-001: SKILL.md に「18フェーズ」という文字列が存在しないこと
- AC-003: SKILL.md に `/workflow approve requirements` の記述が存在すること
- AC-006: SKILL.md に `/workflow switch` という文字列が存在しないこと
- AC-008: SKILL.md に `/workflow back` コマンドの説明が存在すること
- AC-014: SKILL.md に sessionToken 二層構造の説明が存在すること

phases/ に関する受入条件（AC-018〜AC-022・AC-027〜AC-028）として以下を確認する。

- AC-020: F-010〜F-022 の13ファイルが phases/ に存在すること
- AC-021: 各ファイルに4必須セクションが含まれること
- AC-027: phases/requirements.md に workflow_approve requirements の手順が存在すること
- AC-028: phases/implementation.md に設計チェックリスト5項目が存在すること

project/SKILL.md に関する受入条件（AC-023〜AC-024）として workflow_list と workflow_status の2ステップ再開手順が記述されていることを確認する。

---

## 非機能要件の設計方針

NFR-001（SKILL.md のファイルサイズ上限200KB）への対応として、Orchestratorパターン等の詳細なルールは要約形式で記述し、詳細は「CLAUDE.md 参照」のリンクを活用する。

NFR-002（phases/ ファイルの最低30行）への対応として、各フェーズのガイドファイルは形式的な見出しだけで構成するのではなく、各セクションに具体的な手順・チェックリスト・判断基準を記述することで実質的な内容を確保する。

NFR-003（禁止語の完全排除）への対応として、implementation フェーズで成果物を作成する際は artifact-validator の禁止語12語を参照しながら記述する。特に「作成予定」「継続整備」等の表現を選択する際は、禁止語を含む複合語にならないよう注意する。

NFR-004（CLAUDE.md との整合性維持）への対応として、SKILL.md に追加するルールは CLAUDE.md の定義と矛盾しないことを code_review フェーズで確認する。特に sessionToken 二層構造ルールは CLAUDE.md のルール23を正確に反映する。
