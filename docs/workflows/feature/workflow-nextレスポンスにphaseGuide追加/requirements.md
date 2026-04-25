# workflow_nextレスポンスにphaseGuide追加 - 要件定義

## サマリー

workflow_nextおよびworkflow_statusのMCPツールレスポンスに、subagent向けのphaseGuide構造化情報を追加する。
現在、Orchestratorがsubagentにpromptを渡す際に必要な情報（必須セクション、Bashホワイトリスト、出力先ファイル等）は、CLAUDE.mdの記憶とコード内の5箇所に分散しており、非確定的なプロンプト構築が情報欠落の原因となっている。
MCP serverのレスポンスから確定的に構造化情報を提供することで、subagent promptの構築信頼性を現状の70%から95%以上に引き上げる。
phaseGuideフィールドには必須セクション、出力ファイルパス、許可Bashカテゴリ、入力ファイル、編集可能ファイルタイプ、最小行数、推奨subagent設定が含まれる。
後方互換性を保つため既存フィールドは変更せず、新規フィールドとして追加する。

## 背景

### 現状の問題

現在、ワークフロープラグインではOrchestratorパターンを採用しており、メインのClaudeが各フェーズの処理をTask toolを使ってsubagentに委譲する。
subagentに渡すpromptには、フェーズ固有の制約情報（必須セクション、出力ファイルパス、許可されるBashコマンド等）を含める必要がある。

しかし、この情報は以下のように分散している：

| 情報種別 | 定義場所 | 参照方法 |
|---------|---------|---------|
| フェーズ説明 | definitions.ts の PHASE_DESCRIPTIONS | コードから取得 |
| 必須セクション | artifact-validator.ts の PHASE_ARTIFACT_REQUIREMENTS | コードから取得 |
| 編集可能ファイル | phase-definitions.js の PHASE_RULES | hooksプロセス（別プロセス） |
| 許可Bashコマンド | bash-whitelist.js の BASH_WHITELIST | hooksプロセス（別プロセス） |
| 入出力ファイル関係 | CLAUDE.md のテーブル | LLMの記憶 |

OrchestratorはCLAUDE.mdの記憶に基づいてpromptを組み立てているが、LLMの非確定性により以下の問題が発生する：

- 必須セクションの指示漏れ（70%の確率で少なくとも1つ欠落）
- 出力先パスの誤記述（taskNameから独自にパスを構築してしまう）
- Bashコマンド制限の未周知（subagentが禁止コマンドを使いhookでブロックされる）
- 入力ファイルパスの誤記述（前フェーズ成果物のパスを誤る）

これらの問題により、subagentのタスクが失敗し、Orchestratorが再試行を繰り返す事態が頻発している。

### 解決方針

MCP serverのworkflow_nextおよびworkflow_statusレスポンスに、フェーズ固有の制約情報を含むphaseGuideフィールドを追加する。
Orchestratorはこの構造化情報をそのままsubagent promptに埋め込むことで、確定的な指示伝達を実現する。

加えて、CLAUDE.mdのOrchestrator手順セクションに以下を追記する：

- **Layer2（事後検証）**: subagentタスク完了後、phaseGuideで指定された要件（必須セクション、最小行数等）を満たしているかチェック
- **Layer3（自動修正）**: 要件未達の場合、Orchestrator自身が成果物を修正してからworkflow_nextを実行

## 機能要件

### FR-1: workflow_nextレスポンスにphaseGuideフィールドを追加

workflow_nextのレスポンスに、遷移先フェーズの制約情報を含むphaseGuideフィールドを追加する。

**詳細**:
- next.ts の `NextResult` 型を拡張し、`phaseGuide?: PhaseGuide` フィールドを追加
- workflow_next実行時、遷移先フェーズ（to）に対応するphaseGuide情報をPHASE_GUIDESマスター定義から取得してレスポンスに含める
- 並列フェーズの場合、並列フェーズ全体のphaseGuideと、各サブフェーズのphaseGuideの両方を返す（構造はFR-12で定義）

**受入条件**:
- workflow_nextレスポンスにphaseGuideフィールドが含まれる
- phaseGuide.phaseNameが遷移先フェーズ名と一致する
- 並列フェーズの場合、phaseGuide.subPhasesに各サブフェーズのガイドが含まれる

### FR-2: workflow_statusレスポンスにphaseGuideフィールドを追加

workflow_statusのレスポンスに、現在のフェーズの制約情報を含むphaseGuideフィールドを追加する。

**詳細**:
- status.ts の `StatusResult` 型を拡張し、`phaseGuide?: PhaseGuide` フィールドを追加
- workflow_status実行時、現在のフェーズに対応するphaseGuide情報をPHASE_GUIDESマスター定義から取得してレスポンスに含める
- アクティブなタスクが存在しない場合、phaseGuideフィールドは含めない（undefined）

**受入条件**:
- workflow_statusレスポンスにphaseGuideフィールドが含まれる
- phaseGuide.phaseNameが現在のフェーズ名と一致する
- タスクがidleまたはcompletedの場合、phaseGuideはundefinedである

### FR-3: phaseGuideに必須セクション（requiredSections）を含める

各フェーズで作成する成果物に含めるべき必須セクションの一覧をphaseGuideに含める。

**詳細**:
- PhaseGuide型に `requiredSections?: string[]` フィールドを追加
- artifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSから必須セクション情報を取得
- 日本語セクション名のみを配列として返す（例: `["## サマリー", "## 背景", "## 機能要件"]`）
- 成果物を作成しないフェーズ（refactoring、build_check等）ではundefinedとする

**受入条件**:
- phaseGuide.requiredSectionsが配列形式で返される
- 配列の各要素が日本語Markdownヘッダー形式（`## セクション名`）である
- requirements、test_design、code_review等の成果物作成フェーズで適切な必須セクションが含まれる

### FR-4: phaseGuideに出力ファイルパス（outputFile）を含める

各フェーズで作成する成果物の出力先ファイルパスをphaseGuideに含める。

**詳細**:
- PhaseGuide型に `outputFile?: string` フィールドを追加
- 出力ファイルパスは `{docsDir}/{ファイル名}` 形式で返す
- ファイル名はフェーズに応じて決定（research.md、requirements.md、spec.md等）
- 成果物を作成しないフェーズではundefinedとする
- 並列フェーズの各サブフェーズも個別の出力ファイルを持つ

**受入条件**:
- phaseGuide.outputFileが適切なパス形式で返される
- パスに{docsDir}プレースホルダーが含まれる（実行時のdocsDir値は動的）
- research、requirements、planning等の成果物作成フェーズで適切なファイル名が含まれる

### FR-5: phaseGuideに許可Bashカテゴリ（allowedBashCategories）を含める

各フェーズで使用可能なBashコマンドカテゴリをphaseGuideに含める。

**詳細**:
- PhaseGuide型に `allowedBashCategories?: string[]` フィールドを追加
- bash-whitelist.jsのBASH_WHITELISTで定義されたカテゴリ名を配列で返す（例: `["readonly", "testing"]`）
- フェーズごとの許可カテゴリ対応：
  - research/requirements/threat_modeling/planning/design_review/test_design: `["readonly"]`
  - state_machine/flowchart/ui_design: `["readonly"]`
  - test_impl/testing/regression_test: `["readonly", "testing"]`
  - implementation/refactoring: `["readonly", "testing", "implementation"]`
  - build_check/code_review: `["readonly", "testing", "implementation"]`
  - parallel_verification（すべてのサブフェーズ）: `["readonly", "testing"]`
  - commit/push: `["readonly", "git"]`
  - ci_verification/deploy: `["readonly"]`

**受入条件**:
- phaseGuide.allowedBashCategoriesが配列形式で返される
- 各カテゴリ名がbash-whitelist.jsのカテゴリ定義と一致する
- test_implフェーズで`["readonly", "testing"]`が含まれる

### FR-6: phaseGuideに入力ファイル一覧（inputFiles）を含める

各フェーズで参照すべき前フェーズ成果物のファイルパスをphaseGuideに含める。

**詳細**:
- PhaseGuide型に `inputFiles?: string[]` フィールドを追加
- 入力ファイルパスは `{docsDir}/{ファイル名}` 形式で配列として返す
- フェーズ間の依存関係に基づいて入力ファイルを決定：
  - requirements → research.md
  - threat_modeling → requirements.md
  - planning → requirements.md
  - state_machine/flowchart/ui_design → spec.md
  - test_design → spec.md, state-machine.mmd, flowchart.mmd, ui-design.md
  - test_impl → test-design.md
  - implementation → test-design.md, *.test.ts（テストファイルはglob形式）
  - refactoring → spec.md, *.ts
  - code_review → spec.md, state-machine.mmd, flowchart.mmd, ui-design.md, *.ts
  - testing/regression_test → test-design.md
  - parallel_verification → spec.md, test-design.md, *.ts
- 最初のフェーズ（research）は入力ファイルなし（undefinedまたは空配列）

**受入条件**:
- phaseGuide.inputFilesが配列形式で返される
- 配列の各要素が`{docsDir}/...`形式またはglob形式である
- requirements、test_design、implementation等のフェーズで適切な入力ファイルが含まれる

### FR-7: phaseGuideに編集可能ファイルタイプ（editableFileTypes）を含める

各フェーズで編集可能なファイルタイプをphaseGuideに含める。

**詳細**:
- PhaseGuide型に `editableFileTypes?: string[]` フィールドを追加
- phase-definitions.jsのPHASE_RULESで定義されたファイルタイプを配列で返す
- ファイルタイプは以下のカテゴリを使用：
  - `".md"`: Markdownファイル
  - `".mmd"`: Mermaidダイアグラムファイル
  - `"test"`: テストファイル（*.test.ts、*.spec.ts等）
  - `"code"`: ソースコードファイル（*.ts、*.tsx、*.js等）
  - `"config"`: 設定ファイル（package.json、tsconfig.json等）
- フェーズごとの許可ファイルタイプ対応：
  - research/requirements/threat_modeling/planning/design_review: `[".md"]`
  - state_machine/flowchart: `[".md", ".mmd"]`
  - ui_design: `[".md", ".mmd"]`
  - test_design: `[".md"]`
  - test_impl: `["test", ".md"]`
  - implementation: `["code"]`
  - refactoring: `["code"]`
  - build_check: `["code", "test", "config"]`（ビルド修正用）
  - code_review: `[".md"]`
  - testing/regression_test: `["test", ".md"]`
  - parallel_verification（すべてのサブフェーズ）: `[".md"]`（e2e_testのみ`["test", ".md"]`）
  - docs_update: `[".md"]`
  - commit/push/ci_verification/deploy: `[]`（編集不可）

**受入条件**:
- phaseGuide.editableFileTypesが配列形式で返される
- 各ファイルタイプがphase-definitions.jsの定義と一致する
- test_implフェーズで`["test", ".md"]`が含まれる

### FR-8: phaseGuideに最小行数（minLines）を含める

各フェーズで作成する成果物の最小行数をphaseGuideに含める。

**詳細**:
- PhaseGuide型に `minLines?: number` フィールドを追加
- artifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSから最小行数情報を取得
- 成果物を作成しないフェーズではundefinedとする

**受入条件**:
- phaseGuide.minLinesが数値形式で返される
- requirements.mdで50、spec.mdで100等、適切な最小行数が設定される
- refactoring、build_check等の成果物なしフェーズではundefinedである

### FR-9: phaseGuideにsubagent設定（推奨subagent_type、model）を含める

各フェーズで推奨されるsubagent_typeとmodelをphaseGuideに含める。

**詳細**:
- PhaseGuide型に `subagentType?: string` および `model?: string` フィールドを追加
- CLAUDE.mdの「フェーズ別subagent設定」テーブルの情報をPHASE_GUIDESに含める
- フェーズごとの推奨設定：
  - research: `subagentType: "Explore", model: "haiku"`
  - requirements/threat_modeling/planning: `subagentType: "general-purpose", model: "sonnet"`
  - state_machine/flowchart: `subagentType: "general-purpose", model: "haiku"`
  - ui_design: `subagentType: "general-purpose", model: "sonnet"`
  - test_design/test_impl: `subagentType: "Plan", model: "sonnet"`
  - implementation/code_review: `subagentType: "general-purpose", model: "sonnet"`
  - refactoring/build_check: `subagentType: "Bash", model: "haiku"`
  - testing/regression_test/parallel_verification: `subagentType: "Bash", model: "haiku"`
  - docs_update: `subagentType: "general-purpose", model: "haiku"`
  - commit/push: `subagentType: "Bash", model: "haiku"`

**受入条件**:
- phaseGuide.subagentTypeが適切な値で返される
- phaseGuide.modelが"sonnet"または"haiku"である
- research、planning、implementation等のフェーズで適切なsubagent設定が含まれる

### FR-10: CLAUDE.mdにLayer2事後検証手順を追記

Orchestratorがsubagentタスク完了後に実行すべき事後検証手順をCLAUDE.mdに追記する。

**詳細**:
- CLAUDE.mdの「subagentによるフェーズ実行」セクションに、以下の手順を追記：
  1. subagentタスク完了後、TaskOutputでタスク結果を確認
  2. phaseGuide.outputFileをRead toolで読み込む
  3. phaseGuide.requiredSectionsの各セクションが含まれているかチェック
  4. phaseGuide.minLinesを満たしているかチェック（コメント・空行を除く実質的な行数）
  5. 要件を満たしていない場合、Layer3（自動修正）に進む
  6. 要件を満たしている場合、workflow_nextで次フェーズに進む
- チェック用のMarkdownテンプレートを追加し、Orchestratorが一貫した検証を行えるようにする

**受入条件**:
- CLAUDE.mdに「Layer2（事後検証）」セクションが追加される
- 検証手順が具体的かつ実行可能である
- 検証失敗時の対応（Layer3への移行）が明示される

### FR-11: CLAUDE.mdにLayer3自動修正手順を追記

Orchestratorが事後検証失敗時に実行すべき自動修正手順をCLAUDE.mdに追記する。

**詳細**:
- CLAUDE.mdの「subagentによるフェーズ実行」セクションに、以下の手順を追記：
  1. 不足しているセクション（phaseGuide.requiredSections）をリストアップ
  2. Read toolで成果物を読み込み、不足セクションを追加
  3. 行数不足の場合、既存セクションを拡充（サマリーに箇条書き追加、背景に詳細追加等）
  4. Edit toolで成果物を修正
  5. 修正後、再度Layer2検証を実行
  6. 検証通過後、workflow_nextで次フェーズに進む
- 修正方針のガイドライン（セクション追加位置、拡充方法等）を追記

**受入条件**:
- CLAUDE.mdに「Layer3（自動修正）」セクションが追加される
- 修正手順が具体的かつ実行可能である
- 修正後の再検証手順が明示される

### FR-12: 並列フェーズのphaseGuide構造定義

並列フェーズ（parallel_analysis、parallel_design、parallel_quality、parallel_verification）のphaseGuide構造を定義する。

**詳細**:
- PhaseGuide型に `subPhases?: Record<string, PhaseGuide>` フィールドを追加
- 並列フェーズの場合、phaseGuide.subPhasesに各サブフェーズ名をキーとしたPhaseGuideオブジェクトを含める
- 並列フェーズ全体のphaseGuideには、編集可能ファイルタイプやBashカテゴリは含めない（サブフェーズごとに定義）
- 各サブフェーズのphaseGuideには、FR-3からFR-9のすべてのフィールドを含める

**受入条件**:
- parallel_analysisのphaseGuideに、threat_modelingとplanningのサブフェーズガイドが含まれる
- 各サブフェーズガイドに必須セクション、出力ファイル、許可Bashカテゴリ等が含まれる
- 並列フェーズ全体のphaseGuideには共通情報のみが含まれる

### FR-13: PHASE_GUIDESマスター定義の作成

全フェーズのガイド情報を集約したPHASE_GUIDESマスター定義をdefinitions.tsに作成する。

**詳細**:
- definitions.tsに `PHASE_GUIDES: Record<PhaseName, PhaseGuide>` を定義
- 既存のPHASE_DESCRIPTIONS、PHASE_ARTIFACT_REQUIREMENTSから情報を統合
- bash-whitelist.jsとphase-definitions.jsの情報を重複定義（別プロセスのためインポート不可）
- CLAUDE.mdの入出力ファイル関係テーブルの情報をコード化
- 各フェーズの推奨subagent設定を含める

**受入条件**:
- definitions.tsにPHASE_GUIDES定義が追加される
- 全フェーズのガイド情報が含まれる
- PhaseGuide型との型整合性がある

## 非機能要件

### NFR-1: 後方互換性の保持

既存のworkflow_nextおよびworkflow_statusレスポンスフィールドを変更しない。

**詳細**:
- phaseGuideは新規フィールドとして追加し、既存フィールドの型や値を変更しない
- 既存のクライアント（現在のCLAUDE.mdベースのOrchestrator）はphaseGuideフィールドを無視し、従来通り動作する
- next.tsとstatus.tsの既存処理ロジックを変更しない

**受入条件**:
- 既存のテストケースが全てパスする（phaseGuideアサーション追加を除く）
- レスポンスの既存フィールド（success、taskId、phase等）の値が変わらない

### NFR-2: レスポンスサイズの最適化

phaseGuideフィールドの追加によるレスポンスサイズの増加を最小限に抑える。

**詳細**:
- phaseGuideの各フィールドは必要最小限の情報のみを含める
- 長大な説明文や冗長なデータ構造を避ける
- 1フェーズのphaseGuideサイズを1KB以内に抑える
- 並列フェーズでも全体で5KB以内に抑える

**受入条件**:
- workflow_nextレスポンスのJSON文字列サイズが5KB以内である（並列フェーズを除く）
- 並列フェーズのレスポンスが10KB以内である
- 不要な冗長性がない

### NFR-3: メンテナンス性の確保

フェーズ定義の変更時に、PHASE_GUIDES、hooks、CLAUDE.mdの3箇所を更新する手順を明確にする。

**詳細**:
- definitions.tsのPHASE_GUIDESがマスター定義であることをコメントで明記
- bash-whitelist.jsとphase-definitions.jsにPHASE_GUIDESとの同期が必要であることを注記
- CLAUDE.mdの「フェーズ別subagent設定」テーブルにPHASE_GUIDESとの同期が必要であることを注記
- フェーズ追加・変更時のチェックリストをdocs/architecture/decisions/ADRとして作成

**受入条件**:
- PHASE_GUIDES定義にマスター定義であることのコメントが含まれる
- bash-whitelist.jsとphase-definitions.jsに同期注記が含まれる
- CLAUDE.mdに同期注記が含まれる

### NFR-4: パフォーマンス

workflow_nextおよびworkflow_statusの応答時間が既存実装から10%以上遅くならない。

**詳細**:
- PHASE_GUIDESはメモリ内の静的定義として保持し、ディスクIOを発生させない
- レスポンス構築時の計算量を最小化（単純なオブジェクトコピー）
- 不要な動的処理を避ける

**受入条件**:
- workflow_nextの応答時間が50ms以内である
- workflow_statusの応答時間が50ms以内である
- パフォーマンステストで既存実装との差が10%以内である

## 受入条件

### AC-1: workflow_nextレスポンス検証

workflow_nextを実行し、以下を確認する：

- [ ] レスポンスにphaseGuideフィールドが含まれる
- [ ] phaseGuide.phaseNameが遷移先フェーズ名と一致する
- [ ] phaseGuide.requiredSectionsに必須セクションが含まれる（成果物作成フェーズのみ）
- [ ] phaseGuide.outputFileに適切なファイルパスが含まれる（成果物作成フェーズのみ）
- [ ] phaseGuide.allowedBashCategoriesに許可カテゴリが含まれる
- [ ] phaseGuide.inputFilesに入力ファイルパスが含まれる（researchを除く）
- [ ] phaseGuide.editableFileTypesに編集可能ファイルタイプが含まれる
- [ ] phaseGuide.minLinesに最小行数が含まれる（成果物作成フェーズのみ）
- [ ] phaseGuide.subagentTypeに推奨subagent_typeが含まれる
- [ ] phaseGuide.modelに推奨modelが含まれる

### AC-2: workflow_statusレスポンス検証

workflow_statusを実行し、以下を確認する：

- [ ] レスポンスにphaseGuideフィールドが含まれる
- [ ] phaseGuide.phaseNameが現在のフェーズ名と一致する
- [ ] phaseGuideの各フィールドがworkflow_nextと同じ内容である
- [ ] タスクがidleまたはcompletedの場合、phaseGuideがundefinedである

### AC-3: 並列フェーズのphaseGuide検証

並列フェーズに遷移し、以下を確認する：

- [ ] phaseGuide.subPhasesにサブフェーズのガイドが含まれる
- [ ] 各サブフェーズのphaseGuideに必須セクション、出力ファイル等が含まれる
- [ ] parallel_analysisでthreat_modelingとplanningのサブフェーズガイドが含まれる
- [ ] parallel_designでstate_machine、flowchart、ui_designのサブフェーズガイドが含まれる

### AC-4: CLAUDE.md更新検証

CLAUDE.mdを確認し、以下を確認する：

- [ ] 「Layer2（事後検証）」セクションが追加されている
- [ ] 事後検証手順が具体的に記載されている
- [ ] 「Layer3（自動修正）」セクションが追加されている
- [ ] 自動修正手順が具体的に記載されている
- [ ] phaseGuideの参照方法が「subagent起動テンプレート」に追記されている

### AC-5: 後方互換性検証

既存のテストスイートを実行し、以下を確認する：

- [ ] next.ts関連テストが全てパスする（phaseGuideアサーション追加を除く）
- [ ] status.ts関連テストが全てパスする（phaseGuideアサーション追加を除く）
- [ ] 既存のレスポンスフィールド（success、taskId、phase等）の値が変わらない

### AC-6: パフォーマンス検証

パフォーマンステストを実行し、以下を確認する：

- [ ] workflow_nextの応答時間が50ms以内である
- [ ] workflow_statusの応答時間が50ms以内である
- [ ] レスポンスサイズが10KB以内である（並列フェーズ）

### AC-7: 統合テスト

実際のワークフロー実行で、以下を確認する：

- [ ] Orchestratorがworkflow_nextからphaseGuideを取得できる
- [ ] OrchestratorがphaseGuideをsubagent promptに埋め込める
- [ ] subagentが必須セクション、出力ファイルパス、許可Bashカテゴリを遵守する
- [ ] Layer2事後検証が正しく動作する
- [ ] Layer3自動修正が正しく動作する
- [ ] subagent promptの構築信頼性が95%以上になる（10回の実行で9回以上成功）

## スコープ外

以下は本要件のスコープ外とする：

- **hooksプロセスのリファクタリング**: bash-whitelist.jsとphase-definitions.jsの構造変更は行わない（PHASE_GUIDESに重複定義することで対応）
- **CLAUDE.mdの完全自動生成**: CLAUDE.mdはLLM向けの自然言語ドキュメントであり、PHASE_GUIDESから完全自動生成は行わない（手動更新が必要）
- **既存フェーズの動作変更**: フェーズの実行ロジック自体は変更しない（phaseGuide情報の追加のみ）
- **CLIコマンドの追加**: workflow_nextとworkflow_status以外の新規MCPツールは追加しない

## リスクと緩和策

### リスク1: PHASE_GUIDESとhooksの定義乖離

PHASE_GUIDESとbash-whitelist.js/phase-definitions.jsの定義が同期されず、phaseGuideで許可と示されているがhookでブロックされる事態が発生する。

**緩和策**:
- PHASE_GUIDES定義にマスター定義である旨のコメントを追記
- bash-whitelist.jsとphase-definitions.jsに同期が必要である旨の注記を追加
- フェーズ追加・変更時のチェックリストをADRとして作成

### リスク2: subagent promptのサイズ肥大化

phaseGuide情報をpromptに埋め込むことで、subagent promptのトークン数が増加し、コンテキスト制限に抵触する。

**緩和策**:
- phaseGuideの各フィールドを最小限の情報に絞る
- 長大な説明文を避け、配列・オブジェクト形式で簡潔に表現
- subagent promptテンプレートを最適化し、冗長性を排除

### リスク3: Layer3自動修正の品質低下

Orchestratorによる自動修正が不適切な内容を追加し、成果物の品質を低下させる。

**緩和策**:
- Layer3手順に修正方針のガイドライン（セクション追加位置、拡充方法等）を明記
- 修正後に再度Layer2検証を実行し、要件を満たしていることを確認
- Layer3で修正できない場合はworkflow_backで前フェーズに戻す手順を追加

### リスク4: テストケースの大量更新

next.tsとstatus.tsのレスポンス構造変更により、既存テストケースの大量更新が必要になる。

**緩和策**:
- 後方互換性を保つため、既存フィールドは変更しない
- phaseGuideフィールドのアサーション追加のみで済むようにする
- 共通のテストユーティリティ関数を作成し、テストコードの重複を排除

## 関連ドキュメント

- `docs/workflows/workflow-nextレスポンスにphaseGuide追加/research.md` - 調査結果
- `workflow-plugin/mcp-server/src/tools/next.ts` - workflow_next実装
- `workflow-plugin/mcp-server/src/tools/status.ts` - workflow_status実装
- `workflow-plugin/mcp-server/src/phases/definitions.ts` - フェーズ定義
- `workflow-plugin/mcp-server/src/phases/artifact-validator.ts` - 必須セクション定義
- `workflow-plugin/hooks/bash-whitelist.js` - Bashホワイトリスト定義
- `workflow-plugin/hooks/phase-definitions.js` - 編集可能ファイル定義
- `CLAUDE.md` - ワークフロールール
