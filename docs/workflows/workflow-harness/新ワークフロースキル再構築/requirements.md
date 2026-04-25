## サマリー

- 目的: 現行の workflow/project スキルを調査結果に基づいて全面刷新し、19フェーズ・22MCPツール・Orchestratorパターンに対応した最適なスキルセットを構成する。
- 主要な決定事項: (1) SKILL.md は「ユーザー向け公開コマンドガイド」として位置づけ、Orchestratorガイドを内包した2層構造で再設計する。(2) approve コマンドは4種別（requirements/design/test_design/code_review）すべてを明記する。(3) phases/ ディレクトリは19フェーズ全カバーに拡充するが、definitions.ts の subagentTemplate が実質的プロンプト源泉であるため補助参照ドキュメントと位置づける。(4) workflow_switch はMCPツールが存在しないことを確認し、SKILL.md から除去する。(5) workflow_back および workflow_set-scope を新規ユーザーコマンドとして追加する。
- 次フェーズで必要な情報: 各機能要件の受入条件（AC番号）、phases/ 拡充対象フェーズ13種の詳細、SKILL.md の新旧セクション対応関係。

---

## 背景

### 現行スキルの問題状況

ワークフロープラグインは MCPサーバー（22ツール）とスキル定義ファイル（SKILL.md + phases/）の2層で構成される。
スキル定義はユーザーが `/workflow start` 等のコマンドを実行したときにAIが参照するガイドラインであり、
内容が古かったり不完全であると、AIが誤った動作（フェーズスキップ・承認省略・間違った手順案内）を行うリスクがある。

調査フェーズで判明した問題は大きく4種類に分類される。

第1の問題として、フェーズ数の不整合がある。SKILL.md には「18フェーズ」と記載されているが、
Sprint 7 以降の実装で regression_test フェーズが追加され、現行の CLAUDE.md では「19フェーズ」が正となっている。
この乖離により、ユーザーが SKILL.md を参照した場合に regression_test フェーズの存在に気づかない。

第2の問題として、approve コマンドの不完全な記述がある。CLAUDE.md の必須コマンド一覧では
requirements/design/test_design/code_review の4種別が定義されているが、現行 SKILL.md には
`/workflow approve design` のみが記載されており、他3種別がユーザーに通知されていない。

第3の問題として、フェーズ別テンプレートの大幅欠落がある。phases/ ディレクトリには
6ファイルしか存在せず、19フェーズ中13フェーズ分のガイドが存在しない。
現行アーキテクチャでは definitions.ts の subagentTemplate が実質的プロンプト源泉であるが、
スキルファイルとしての参照ドキュメントが不完全であることはAIが参照内容を把握できない状態を生む。

第4の問題として、Orchestratorパターン等の現行ルールが SKILL.md に未反映である点がある。
sessionToken 二層構造、バリデーション失敗時のsubagent再起動義務（ルール21）、
subagentTemplate取得フロー（workflow_get_subphase_template の活用）等の重要なルールが
SKILL.md には記述されておらず、特に新規セッションでのAIが混乱しやすい状態になっている。

### 再構築の目的

本タスクは、上記4種の問題を解消しつつ、ユーザー向けコマンドガイドとOrchestratorガイドを
適切に分離した、保守性・信頼性の高いスキルセットを構築することを目的とする。

---

## 機能要件

### F-001: フェーズ数の19フェーズへの修正

**対象ファイル**: `workflow-plugin/skills/workflow/SKILL.md`

SKILL.md のフロントマター description フィールドおよびフェーズ構成セクションを、
現行の「18フェーズ」から「19フェーズ」に修正する。
具体的には regression_test フェーズを testing の後、parallel_verification の前に追加する。
フェーズ一覧の表示形式は CLAUDE.md のフェーズ順序定義と完全に一致させること。

受入条件（AC-001）: SKILL.md の全文を検索したとき、文字列「18フェーズ」が0件であること。
受入条件（AC-002）: SKILL.md に regression_test フェーズが明記されており、testing の後に配置されていること。

---

### F-002: approve コマンドの4種別完全記述

**対象ファイル**: `workflow-plugin/skills/workflow/SKILL.md`

現行の `/workflow approve design` のみの記述を、以下4種別すべての記述に拡充する。
- `/workflow approve requirements` — requirementsフェーズで呼び出す（ユーザー承認待ち）
- `/workflow approve design` — design_reviewフェーズで呼び出す（現行記述を維持・精緻化）
- `/workflow approve test_design` — test_designフェーズで呼び出す
- `/workflow approve code_review` — code_reviewフェーズで呼び出す

各 approve コマンドには、どのフェーズで・なぜ使うのかの説明を付記すること。
AIへの厳命セクションにも4種別の呼び出し義務を明記すること。

受入条件（AC-003）: SKILL.md に `/workflow approve requirements` の記述が存在すること。
受入条件（AC-004）: SKILL.md に `/workflow approve test_design` の記述が存在すること。
受入条件（AC-005）: SKILL.md に `/workflow approve code_review` の記述が存在すること。

---

### F-003: workflow_switch コマンドの削除

**対象ファイル**: `workflow-plugin/skills/workflow/SKILL.md`

MCPツール一覧に workflow_switch は存在しない。
SKILL.md の「タスク切替」セクションおよびコマンド一覧から `/workflow switch <task-id>` を削除する。
削除に際して、複数タスク管理の代替手段として workflow_list と workflow_status の使い方を補足説明として追記する。

受入条件（AC-006）: SKILL.md の全文を検索したとき、文字列「/workflow switch」が0件であること。
受入条件（AC-007）: SKILL.md に複数タスク確認の代替手順（workflow_list 活用）が記述されていること。

---

### F-004: workflow_back コマンドの新規追加

**対象ファイル**: `workflow-plugin/skills/workflow/SKILL.md`

MCPツール workflow_back は実装済みだが、スキルに記述がない。
ユーザーがフェーズを前段階に差し戻したい場合の操作として `/workflow back <対象フェーズ>` を追加する。
用途（未実装項目が発覚した場合のimplementationへの差し戻し等）と注意事項（差し戻しで失われる成果物なし）を記述する。

受入条件（AC-008）: SKILL.md に `/workflow back` コマンドの説明が存在すること。
受入条件（AC-009）: SKILL.md に差し戻し先フェーズ名を指定する書式例が記述されていること。

---

### F-005: workflow_set-scope コマンドの新規追加

**対象ファイル**: `workflow-plugin/skills/workflow/SKILL.md`

MCPツール workflow_set_scope は実装済みだが、スキルに記述がない。
research または requirements フェーズでスコープを設定する操作として追加する。
スコープ未設定による test_impl フェーズスキップリスクを警告として明記する。
コマンド名は `/workflow set-scope` とし、dirs/files/glob パラメータの用途を説明する。

受入条件（AC-010）: SKILL.md に `/workflow set-scope` コマンドの説明が存在すること。
受入条件（AC-011）: SKILL.md にスコープ設定の具体的な例（dirs パラメータを含む）が記述されていること。

---

### F-006: Orchestratorパターンの明記

**対象ファイル**: `workflow-plugin/skills/workflow/SKILL.md`

CLAUDE.md に定義されているOrchestratorパターンの概要を SKILL.md に追加する。
追加すべき内容は以下のとおり。
- メインのClaudeはOrchestratorとして動作し、各フェーズをsubagentに委譲するという構造の説明。
- OrchestratorはTask toolでsubagentを起動し、成果物ファイルを介してコンテキストを引き継ぐという流れ。
- subagentTemplate は workflow_next のレスポンスから取得し、取得できない場合は workflow_get_subphase_template を使用するというルール。
- Orchestratorが成果物ファイルを直接Edit/Writeで編集することは禁止であり、修正もsubagent再起動で行うというルール。

受入条件（AC-012）: SKILL.md にOrchestratorパターンのセクションが存在すること。
受入条件（AC-013）: SKILL.md に subagentTemplate 取得手順の記述が存在すること。

---

### F-007: sessionToken 二層構造ルールの記載

**対象ファイル**: `workflow-plugin/skills/workflow/SKILL.md`

sessionToken の二層構造ルールを SKILL.md に追記する。
層1（Orchestrator直接呼び出し）: workflow_next / workflow_approve / workflow_complete_sub 等で sessionToken を渡す。
層2（subagentへの引き渡し）: workflow_record_test_result 目的の testing・regression_test フェーズのみ許可。
セッション再開後は taskId 指定の workflow_status で sessionToken を再取得する義務を明記する。

受入条件（AC-014）: SKILL.md に sessionToken 二層構造の説明が存在すること。
受入条件（AC-015）: SKILL.md にセッション再開後の workflow_status 呼び出し義務が記述されていること。

---

### F-008: バリデーション失敗時のsubagent再起動義務（ルール21相当）の記載

**対象ファイル**: `workflow-plugin/skills/workflow/SKILL.md`

CLAUDE.md のルール21に相当する内容（バリデーション失敗時にOrchestratorが直接修正してはならず、
subagentを再起動してリトライするという義務）を SKILL.md に追記する。
リトライ回数別エスカレーション（1回目: エラーメッセージをそのまま渡す、2回目: 行番号レベルの修正指示を追加、
3回目以降: sonnetモデルに切り替え）も要約形式で記載する。

受入条件（AC-016）: SKILL.md にバリデーション失敗時の再起動義務セクションが存在すること。
受入条件（AC-017）: SKILL.md にリトライ時のプロンプト構成（前回失敗理由コードブロック + 改善要求）の記述が存在すること。

---

### F-009: phases/ ディレクトリの index.md 整備

**対象ファイル**: `workflow-plugin/skills/workflow/phases/index.md`

phases/ ディレクトリの各ファイルの役割と位置づけを説明する index.md を作成または更新する。
現行アーキテクチャにおける phases/ ファイルの役割（補助参照ドキュメント、definitions.ts の subagentTemplate が実質的プロンプト源泉）を明確に記述する。
各フェーズのファイル名と対象フェーズの対応表を掲載する。

受入条件（AC-018）: `phases/index.md` に phases/ の役割定義が存在すること。
受入条件（AC-019）: `phases/index.md` に19フェーズ全ファイルの対応表が存在すること（未作成ファイルは「作成予定」を示す代替表現で明記）。

---

### F-010〜F-022: phases/ 不足13フェーズテンプレートの新規作成

**対象ファイル群**: `workflow-plugin/skills/workflow/phases/` 配下

以下の13フェーズに対応するガイドファイルを新規作成する。
各ファイルはOrchestratorがsubagentに渡すプロンプトの補助情報として機能する内容とし、
フェーズの目的・入力ファイル・出力ファイル・作業内容・品質要件を記述する。

作成対象フェーズ（F-010〜F-022）:
- F-010: state_machine（`phases/state-machine.md`）— stateDiagram-v2 記法・名前付き状態ルール
- F-011: flowchart（`phases/flowchart.md`）— flowchart TD 記法・処理フロー基準
- F-012: ui_design（`phases/ui-design.md`）— CDD ストーリー定義・コンポーネント仕様書連携
- F-013: design_review（`phases/design-review.md`）— 承認フロー・AskUser 必須確認事項
- F-014: test_impl（`phases/test-impl.md`）— TDD Red フェーズ・ストーリー実装（.stories.tsx）
- F-015: refactoring（`phases/refactoring.md`）— haiku モデル適用・テスト維持義務
- F-016: build_check（`phases/build-check.md`）— ビルドエラー修正・全カテゴリBashコマンド許可
- F-017: code_review（`phases/code-review.md`）— 設計-実装整合性6項目・ユーザー意図確認
- F-018: testing（`phases/testing.md`）— ベースライン記録（workflow_capture_baseline）・exit code 確認
- F-019: regression_test（`phases/regression-test.md`）— 既知バグ記録（workflow_record_known_bug）・比較基準
- F-020: manual_test（`phases/manual-test.md`）— 必須セクション「テストシナリオ」「テスト結果」
- F-021: security_scan（`phases/security-scan.md`）— 必須セクション「脆弱性スキャン結果」「検出された問題」
- F-022: performance_test（`phases/performance-test.md`）— 必須セクション「パフォーマンス計測結果」「ボトルネック分析」

追加候補（優先度中）:
- F-023: e2e_test（`phases/e2e-test.md`）— 必須セクション「E2Eテストシナリオ」「テスト実行結果」
- F-024: docs_update（`phases/docs-update.md`）— CHANGELOG・README更新ガイド
- F-025: commit（`phases/commit.md`）— git add 系統確認・サブモジュール確認手順

受入条件（AC-020）: F-010〜F-022 の13ファイルが `phases/` ディレクトリに存在すること。
受入条件（AC-021）: 各ファイルに「## 目的」「## 入力ファイル」「## 出力ファイル」「## 作業内容」の4セクションが含まれること。
受入条件（AC-022）: design_review のガイドファイルに承認種別「design」の workflow_approve 呼び出し手順が記述されていること。

---

### F-026: project スキルの /project resume 改善

**対象ファイル**: `workflow-plugin/skills/project/SKILL.md`

現行の `/project resume` コマンドはセッション復元を支援するが、SYN-3 ルール（セッション再開後の
workflow_status 疎通確認）との整合性が取れていない。
`/project resume` の実行手順に以下を追記する。
- まず workflow_list で進行中タスクの taskId を確認すること。
- 次に taskId 指定で workflow_status を呼び出し、sessionToken を再取得すること。
- sessionToken が取得できた場合、Orchestrator として通常の作業を再開すること。

受入条件（AC-023）: `project/SKILL.md` に workflow_list と workflow_status の2ステップ再開手順が記述されていること。
受入条件（AC-024）: `project/SKILL.md` にsessionToken 再取得の必要性が明記されていること。

---

### F-027: MCPツールとユーザーコマンドの分類表の整備

**対象ファイル**: `workflow-plugin/skills/workflow/SKILL.md`

22種類の MCPツールを、以下の3カテゴリに分類した表を SKILL.md に追加する。
カテゴリ1（ユーザー向けコマンドに対応するMCPツール）:
workflow_start, workflow_next, workflow_status, workflow_approve, workflow_reset,
workflow_list, workflow_complete_sub, workflow_back, workflow_set_scope の9種。
カテゴリ2（Orchestrator内部ツール、ユーザーが直接操作しないMCPツール）:
workflow_record_test, workflow_capture_baseline, workflow_get_test_info,
workflow_record_known_bug, workflow_get_known_bugs, workflow_record_test_result,
workflow_get_subphase_template, workflow_record_completion_proof,
workflow_save_checkpoint, workflow_record_feedback, workflow_create_subtask,
workflow_link_tasks, workflow_pre_validate の13種。
各カテゴリの用途・制約をワンライナーで説明すること。

受入条件（AC-025）: SKILL.md にMCPツール分類表が存在すること。
受入条件（AC-026）: 分類表のカテゴリ2にOrchestratorのみ使用可能であることが明記されていること。

---

### F-028: 既存phases/ ファイルの内容更新

**対象ファイル**: `workflow-plugin/skills/workflow/phases/requirements.md` および `phases/implementation.md`

requirements.md に承認フロー（`workflow_approve type="requirements"` の呼び出し義務）を追記する。
implementation.md に設計チェックリスト（spec.md / state-machine.mmd / flowchart.mmd / ui-design.md / test-design.md の全確認義務）を追記する。

受入条件（AC-027）: `phases/requirements.md` に workflow_approve requirements の呼び出し手順が記述されていること。
受入条件（AC-028）: `phases/implementation.md` に設計チェックリスト5項目が記述されていること。

---

## 受入条件

各機能要件の受入条件は F-001〜F-028 のセクション内に AC-001〜AC-028 として記載済みである。
以下は、全体としての完了判定基準をまとめたものである。

完了判定1: SKILL.md に「19フェーズ」「4種別 approve」「workflow_back」「workflow_set-scope」「Orchestratorパターン」「sessionToken二層構造」「バリデーション再起動義務」が全て記述されていること。
完了判定2: phases/ ディレクトリに最低13ファイル（F-010〜F-022）が新規作成されていること。既存6ファイルは合計19ファイル以上となることが目標。
完了判定3: project/SKILL.md の `/project resume` 手順に workflow_list + workflow_status の2ステップが追記されていること。
完了判定4: `/workflow switch` の記述が SKILL.md から完全に削除されていること。
完了判定5: SKILL.md と CLAUDE.md のコマンド一覧が齟齬なく一致していること（手動でのdiff確認で検証可能）。

---

## 非機能要件

### NFR-001: SKILL.md のファイルサイズ上限

SKILL.md は Claude のコンテキストウィンドウに読み込まれることを前提とするため、
ファイルサイズは 200KB 以内に抑えること。重複コンテンツは排除し、CLAUDE.md への参照リンクを積極的に活用する。

### NFR-002: phases/ ファイルの最小行数

各 phases/ ファイルは最低30行以上の実質的な内容を持つこと。
空テンプレートや形式だけのファイル作成は品質要件を満たさないため禁止する。
artifact-validator の品質要件（セクション密度30%以上・各セクション5行以上）に準拠すること。

### NFR-003: 禁止語の完全排除

SKILL.md および phases/ 全ファイルから、artifact-validator が検知する禁止語
（英語4語: TODO, TBD, WIP, FIXME / 日本語8語: 未定, 未確定, 要検討, 検討中, 対応予定, サンプル, ダミー, 仮置き）
を完全に排除すること。特に「作成予定」「対応予定」の代替には「継続して整備する」等の表現を使用すること。

### NFR-004: CLAUDE.md との整合性維持

本タスクで修正する SKILL.md の内容は、CLAUDE.md のルール定義と矛盾しないこと。
CLAUDE.md の更新なしに SKILL.md だけを先行変更することは許可されるが、
追加するルールが CLAUDE.md の既存ルールと衝突しないことを確認すること。

### NFR-005: バージョン付きファイル名の禁止

SKILL.md の更新は既存ファイルへの直接編集で行うこと。`SKILL-v2.md` 等のバージョン付きファイル名での新規作成は禁止である。
git の履歴管理でバージョン追跡を行う。

---

## ユーザー意図との整合性確認

ユーザーの意図は「メモリファイルから情報を読み取り、ワークフロープラグインのスキルを最適なアーキテクチャで再構築する」
「現行のスキル構成を分析し、抜け漏れの追加・不整合の修正を行い、全体として最適なスキルセットを構成する」である。

本要件定義が意図に整合している点は以下のとおりである。
1. 抜け漏れの追加: F-004（workflow_back）・F-005（workflow_set-scope）・F-002（approve 3種別）が対応している。
2. 不整合の修正: F-001（フェーズ数）・F-003（workflow_switch 削除）・F-028（既存ファイル更新）が対応している。
3. 最適なアーキテクチャ: F-006（Orchestratorパターン）・F-007（sessionToken二層構造）・F-027（MCPツール分類表）が「構造的整合性」を確立する。
4. スキルセットの完全性: F-010〜F-025（phases/ 拡充）・F-026（project resume 改善）が「網羅性」を担保する。

ユーザーの意図に対して本要件定義が対応できていない事項として、phases/ ファイルが参照ドキュメント止まりであり
「実質的プロンプト源泉としての subagentTemplate」を definitions.ts から移植することは含まれていない点がある。
この点はスコープ外であり、definitions.ts の変更には別タスクを立てることが適切である。
