## サマリー

- 目的: 現行スキル構成（workflow/project）と全MCPツール群の対応関係を網羅的に調査し、不足スキル・不整合・最適化方針を明確化する。
- 主要な決定事項: MCPツールは22種類存在するが、ユーザー向けスキルコマンドは7種類のみ（workflow SKILL.md）。多くのMCPツールに対応するスキルが存在しない。また、フェーズ別プロンプトテンプレートが6フェーズ分しかなく、19フェーズ全体をカバーできていない。
- 次フェーズで必要な情報: 不足スキルの一覧、スキル構造の問題点、再構築の優先順位付け。

---

## 1. 現行スキル構成の全体像

現行スキルは2つのカテゴリに分かれる。

### 1a. workflow スキル（/c/ツール/Workflow/workflow-plugin/skills/workflow/）

SKILL.md がルートの定義ファイルとして機能し、phases/ サブディレクトリに各フェーズの subagent プロンプトテンプレートが格納されている。

SKILL.md に定義されているユーザー向けコマンド（7種類）:
- `/workflow start <タスク名>`: タスク開始
- `/workflow next`: 次フェーズへ進む
- `/workflow status`: 現在の状態を確認
- `/workflow approve design`: 設計レビュー承認
- `/workflow reset [理由]`: research フェーズにリセット
- `/workflow list`: アクティブなタスク一覧
- `/workflow switch <task-id>`: タスク切替
- `/workflow complete-sub <サブフェーズ>`: 並列フェーズのサブフェーズを完了

フェーズ数の不整合: SKILL.md には「18フェーズ」と記載されているが、CLAUDE.md の最新仕様では「19フェーズ」（regression_test フェーズが追加済み）。

### 1b. project スキル（/c/ツール/Workflow/workflow-plugin/skills/project/）

SKILL.md のみで、phases/ サブディレクトリなし。2つのコマンドを定義:
- `/project init <プロジェクト名>`: エンタープライズ構造でプロジェクトを初期化
- `/project resume`: 現在のワークフロー状態を表示してセッション復元を支援

---

## 2. 現行フェーズ別プロンプトテンプレートの調査

phases/ ディレクトリには6ファイルが存在する。

| ファイル | 対象フェーズ | 状況 |
|---------|------------|------|
| research.md | research | 存在するが最小構成 |
| requirements.md | requirements | 存在するが承認フロー記述なし |
| threat-modeling.md | threat_modeling | 存在 |
| planning.md | planning | 存在 |
| test-design.md | test_design | 存在 |
| implementation.md | implementation | 存在 |

存在しないフェーズテンプレート（13フェーズ分が欠落）:
- parallel_analysis（親フェーズ）
- parallel_design（親フェーズ）
- state_machine サブフェーズ
- flowchart サブフェーズ
- ui_design サブフェーズ
- design_review フェーズ
- test_impl フェーズ（TDD Redフェーズ）
- refactoring フェーズ
- parallel_quality（親フェーズ）
- build_check サブフェーズ
- code_review サブフェーズ
- testing フェーズ
- regression_test フェーズ
- parallel_verification（親フェーズ）
- manual_test サブフェーズ
- security_scan サブフェーズ
- performance_test サブフェーズ
- e2e_test サブフェーズ
- docs_update フェーズ
- commit フェーズ
- push フェーズ
- ci_verification フェーズ
- deploy フェーズ

---

## 3. MCPツール全22種類とスキル対応マッピング

MCPサーバーが提供するツール一覧と、対応するスキルコマンドの存在状況を確認した。

| MCPツール | スキルコマンド | 対応状況 |
|-----------|--------------|---------|
| workflow_status | /workflow status | 対応あり |
| workflow_start | /workflow start | 対応あり |
| workflow_next | /workflow next | 対応あり |
| workflow_approve | /workflow approve design | 対応あり（ただし design 種別のみ。requirements/test_design/code_review 種別が欠落） |
| workflow_reset | /workflow reset | 対応あり |
| workflow_list | /workflow list | 対応あり |
| workflow_complete_sub | /workflow complete-sub | 対応あり |
| workflow_record_test | スキルなし | 欠落 |
| workflow_capture_baseline | スキルなし | 欠落 |
| workflow_get_test_info | スキルなし | 欠落 |
| workflow_record_known_bug | スキルなし | 欠落 |
| workflow_get_known_bugs | スキルなし | 欠落 |
| workflow_set_scope | スキルなし | 欠落 |
| workflow_record_test_result | スキルなし | 欠落（subagent専用ツール） |
| workflow_back | スキルなし | 欠落 |
| workflow_pre_validate | スキルなし | 欠落 |
| workflow_record_feedback | スキルなし | 欠落 |
| workflow_create_subtask | スキルなし | 欠落 |
| workflow_link_tasks | スキルなし | 欠落 |
| workflow_get_subphase_template | スキルなし | 欠落（Orchestrator内部用） |
| workflow_record_completion_proof | スキルなし | 欠落 |
| workflow_save_checkpoint | スキルなし | 欠落 |

---

## 4. CLAUDE.md 必須コマンド一覧との差分確認

CLAUDE.md（メイン）の必須コマンド一覧には以下が定義されている。

| コマンド | スキルへの反映 |
|---------|--------------|
| /workflow start | 反映済み |
| /workflow next | 反映済み |
| /workflow status | 反映済み |
| /workflow approve requirements | スキルに記載なし（design のみ） |
| /workflow approve design | 反映済み |
| /workflow approve test_design | スキルに記載なし |
| /workflow approve code_review | スキルに記載なし |
| /workflow reset | 反映済み |
| /workflow list | 反映済み |
| /workflow switch | SKILL.md に記載あり（MCPツールは存在しない） |
| /workflow complete-sub | 反映済み |

approve コマンドの種別: CLAUDE.md では requirements/design/test_design/code_review の4種別が必須として定義されているが、SKILL.md には design のみが記述されている。

---

## 5. 構造上の問題点

### 問題A: フェーズ数の不整合
SKILL.md には「18フェーズ」と記載されているが、現行の定義は19フェーズ（regression_test が Sprint 7 で追加済み）。スキルが現実のフェーズ構成と乖離している。

### 問題B: approve コマンドの不完全な記述
4種類の承認コマンドのうち design のみがスキルに記載されている。requirements/test_design/code_review の承認フローがスキルから把握できない。

### 問題C: フェーズ別テンプレートの大幅欠落
phases/ ディレクトリのテンプレートは19フェーズ中6フェーズ分しか存在しない。OrchestratorがサブフェーズのためにMCPサーバーから subagentTemplate を取得する最新アーキテクチャとは別に、スキルファイルとしても参照ドキュメントが不完全である。

### 問題D: 上流設計と乖離した内容
SKILL.md の記述が旧来の動作説明にとどまっており、Orchestratorパターン・subagentTemplate取得・sessionToken二層構造・バリデーション失敗時のsubagent再起動義務などの現行ルールが反映されていない。

### 問題E: workflow_switch のMCPツールとの不一致
SKILL.md には `/workflow switch <task-id>` コマンドが記載されているが、MCPツール一覧に workflow_switch は存在しない。実際の実装として switch 機能が存在するか確認が必要。

### 問題F: Orchestrator内部ツールとユーザーコマンドの混在
workflow_record_test_result や workflow_get_subphase_template はOrchestratorが内部的に使用するツールであり、ユーザーコマンドとして提供する必要はない。一方で workflow_back や workflow_set_scope はOrchestratorまたはユーザーが直接使用する可能性がある。

---

## 6. 最適なアーキテクチャの方向性

### 方針1: スキル整理の2層構造
ユーザー向けコマンドを提供する「公開スキル」と、Orchestratorガイドとなる「運用ガイドスキル」を明確に分離する。

ユーザーコマンドとして整備が必要なスキル:
- /workflow start（現行: 整備済み）
- /workflow next（現行: 整備済み）
- /workflow status（現行: 整備済み）
- /workflow approve（4種別すべて: requirements/design/test_design/code_review）
- /workflow reset（現行: 整備済み）
- /workflow list（現行: 整備済み）
- /workflow complete-sub（現行: 整備済み）
- /workflow back（新規追加が必要）
- /workflow set-scope（新規追加が必要）
- /project init（現行: 整備済み）
- /project resume（現行: 整備済み）

### 方針2: フェーズ別ガイドの19フェーズ完全整備
phases/ ディレクトリを19フェーズ全カバーに拡充する。ただし現行アーキテクチャでは definitions.ts の subagentTemplate が実質的なプロンプト源泉のため、phases/ ファイルはOrchestratorが参照する補助ドキュメントとして位置づける。

### 方針3: SKILL.md の内容更新
SKILL.md の記述を以下の観点で更新する:
- フェーズ数を19フェーズに修正
- approve コマンドの4種別を明記
- Orchestratorパターンとsubagentテンプレート取得フローを説明
- sessionToken二層構造ルールを記載
- バリデーション失敗時の再起動ルール（ルール21）を記載
- regression_test フェーズを追加

### 方針4: workflow_switch の扱い整理
MCPツールとして workflow_switch が存在しない可能性が高い。スキルから削除または実装状況を確認して反映する。
