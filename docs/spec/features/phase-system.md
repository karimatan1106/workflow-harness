# フェーズシステム仕様

baseCommit: c01d689 | FR-2 | AC-2

## フェーズ一覧 (30 + completed = 31エントリ)

PHASE_REGISTRY (`registry.ts:8-55`) に全31エントリが定義されている。
PHASE_ORDER (`registry.ts:57-89`) が実行順序を固定する。

| # | フェーズ名 | Stage | Model | outputFile | requiredSections | minLines | bashCategories | parallelGroup | approvalRequired |
|---|-----------|-------|-------|------------|-----------------|----------|----------------|---------------|-----------------|
| 1 | scope_definition | 1 | sonnet | scope-definition.toon | decisions,artifacts,next | 30 | readonly | - | - |
| 2 | research | 1 | sonnet | research.toon | decisions,artifacts,next | 50 | readonly | - | - |
| 3 | impact_analysis | 1 | sonnet | impact-analysis.toon | decisions,artifacts,next | 40 | readonly | - | - |
| 4 | requirements | 2 | sonnet | requirements.toon | decisions,acceptanceCriteria,notInScope,openQuestions | 50 | readonly | - | requirements |
| 5 | threat_modeling | 3 | sonnet | threat-model.toon | decisions,artifacts,next | 40 | readonly | parallel_analysis | - |
| 6 | planning | 3 | sonnet | spec.toon | decisions,artifacts,next | 50 | readonly | parallel_analysis | - |
| 7 | state_machine | 4 | haiku | state-machine.mmd | decisions | 15 | readonly | parallel_design | - |
| 8 | flowchart | 4 | haiku | flowchart.mmd | decisions | 15 | readonly | parallel_design | - |
| 9 | ui_design | 4 | sonnet | ui-design.toon | decisions,artifacts,next | 50 | readonly | parallel_design | - |
| 10 | design_review | 5 | sonnet | design-review.toon | decisions,artifacts,next | 30 | readonly | - | design |
| 11 | test_design | 6 | sonnet | test-design.toon | decisions,artifacts,next | 50 | readonly | - | test_design |
| 12 | test_selection | 6 | haiku | test-selection.toon | decisions,artifacts,next | 20 | readonly | - | - |
| 13 | test_impl | 7 | sonnet | - | - | 0 | readonly,testing | - | - |
| 14 | implementation | 7 | sonnet | - | - | 0 | readonly,testing,implementation | - | - |
| 15 | refactoring | 7 | haiku | - | - | 0 | readonly,testing,implementation | - | - |
| 16 | build_check | 8 | haiku | - | - | 0 | readonly,testing,implementation | parallel_quality | - |
| 17 | code_review | 8 | sonnet | code-review.toon | decisions,artifacts,next | 30 | readonly | parallel_quality | code_review |
| 18 | testing | 9 | haiku | - | - | 0 | readonly,testing | - | - |
| 19 | regression_test | 9 | haiku | - | - | 0 | readonly,testing | - | - |
| 20 | acceptance_verification | 10 | sonnet | acceptance-report.toon | decisions,artifacts,next | 40 | readonly | - | acceptance |
| 21 | manual_test | 11 | sonnet | manual-test.toon | decisions,artifacts,next | 40 | readonly,testing | parallel_verification | - |
| 22 | security_scan | 11 | sonnet | security-scan.toon | decisions,artifacts,next | 40 | readonly,testing,security | parallel_verification | - |
| 23 | performance_test | 11 | sonnet | performance-test.toon | decisions,artifacts,next | 40 | readonly,testing | parallel_verification | - |
| 24 | e2e_test | 11 | sonnet | e2e-test.toon | decisions,artifacts,next | 40 | readonly,testing | parallel_verification | - |
| 25 | docs_update | 12 | sonnet | docs-update.toon | decisions,artifacts,next | 30 | readonly,implementation | - | - |
| 26 | commit | 13 | haiku | - | - | 0 | readonly,git | - | - |
| 27 | push | 13 | haiku | - | - | 0 | readonly,git | - | - |
| 28 | ci_verification | 13 | haiku | - | - | 0 | readonly | - | - |
| 29 | deploy | 14 | haiku | - | - | 0 | readonly | - | - |
| 30 | health_observation | 14 | sonnet | health-report.toon | decisions,artifacts,next | 20 | readonly | - | - |
| 31 | completed | 99 | haiku | - | - | 0 | readonly | - | - |

ソース: `registry.ts:8-55`, テンプレート: `defs-stage1.ts`〜`defs-stage6.ts`

## 14ステージ構造

フェーズはステージでグループ化される。ステージ値は `PHASE_REGISTRY` 各エントリの `stage` プロパティで定義する。

| Stage | 名称 | フェーズ数 | フェーズ |
|-------|------|-----------|---------|
| 1 | Discovery | 3 | scope_definition, research, impact_analysis |
| 2 | Requirements | 1 | requirements |
| 3 | Analysis | 2 | threat_modeling, planning |
| 4 | Design | 3 | state_machine, flowchart, ui_design |
| 5 | Review | 1 | design_review |
| 6 | Test Planning | 2 | test_design, test_selection |
| 7 | TDD | 3 | test_impl, implementation, refactoring |
| 8 | Quality | 2 | build_check, code_review |
| 9 | Testing | 2 | testing, regression_test |
| 10 | Acceptance | 1 | acceptance_verification |
| 11 | Verification | 4 | manual_test, security_scan, performance_test, e2e_test |
| 12 | Documentation | 1 | docs_update |
| 13 | Release | 3 | commit, push, ci_verification |
| 14 | Deployment | 2 | deploy, health_observation |
| 99 | Terminal | 1 | completed |

## 並列グループ4種

PARALLEL_GROUPS (`handler-shared.ts:27-32`) で定義される。同一グループ内のフェーズはサブエージェントで同時実行可能である。`harness_complete_sub` で個別完了を報告し、全フェーズ完了後に `harness_next` で次ステージへ遷移する。

| グループ名 | Stage | フェーズ | 依存関係 |
|-----------|-------|---------|----------|
| parallel_analysis | 3 | threat_modeling, planning | planning は threat_modeling に依存 |
| parallel_design | 4 | state_machine, flowchart, ui_design | 相互依存なし |
| parallel_quality | 8 | build_check, code_review | 相互依存なし |
| parallel_verification | 11 | manual_test, security_scan, performance_test, e2e_test | 相互依存なし |

ソース: `registry.ts:8-55`(parallelGroup属性), `handler-shared.ts:27-32`(PARALLEL_GROUPS定数)

## タスクサイジング

リスクスコアに基づきタスクサイズを決定し、SIZE_SKIP_MAP でフェーズをスキップする。

| サイズ | リスクスコア | アクティブフェーズ数 | スキップ数 |
|--------|------------|-------------------|-----------|
| small | 0-3 | 約12 | 19 |
| medium | 4-7 | 約22 | 8 |
| large | 8+ | 30 | 0 |

`getActivePhases(size)` (`registry.ts:126-129`) が PHASE_ORDER から SIZE_SKIP_MAP に含まれるフェーズを除外して返却する。

## フェーズスキップマップ

SIZE_SKIP_MAP (`registry.ts:91-124`) の定義:

**small (19スキップ)**: impact_analysis, threat_modeling, state_machine, flowchart, ui_design, design_review, test_selection, refactoring, code_review, regression_test, acceptance_verification, manual_test, security_scan, performance_test, e2e_test, docs_update, ci_verification, deploy, health_observation

**medium (8スキップ)**: impact_analysis, state_machine, flowchart, ui_design, design_review, test_selection, refactoring, acceptance_verification

**large**: スキップなし(空配列)

## リスク分類器

`risk-classifier.ts:17-58` で実装される。最大スコアは12。

**ファイル数スコア** (`calculateRiskScore`, `risk-classifier.ts:17-33`):

| 条件 | 加算値 |
|------|--------|
| fileCount >= 10 | +3 |
| fileCount >= 5 | +2 |
| fileCount >= 2 | +1 |

**コード行数スコア**:

| 条件 | 加算値 |
|------|--------|
| codeLineEstimate >= 1000 | +2 |
| codeLineEstimate >= 200 | +1 |

**ブール要因** (`analyzeScope`, `risk-classifier.ts:41-58` がファイル/ディレクトリパスのパターンマッチで判定):

| 要因 | 加算値 | パターン |
|------|--------|---------|
| hasConfig | +1 | .json, .yaml, .yml, .toml |
| hasInfra | +2 | docker, terraform, k8s, deploy |
| hasSecurity | +2 | auth, security, crypto, secret |
| hasDatabase | +1 | migration, schema, database, prisma |
| hasTests | +1 | test, spec |

`classifySize(score)` (`risk-classifier.ts:35-39`): total <= 3 → small, <= 7 → medium, 8+ → large

## サブエージェントテンプレート生成

`buildSubagentPrompt` (`definitions.ts:79-136`) が以下の手順でプロンプトを構築する:

1. **テンプレート取得**: PHASE_DEFINITIONS (`definitions.ts:26-33`) から6ステージファイルを集約したテンプレートを取得
2. **ヘッダー除去**: 冗長なタスク情報/入力/出力ヘッダーを正規表現で除去 (`definitions.ts:95-97`)
3. **フラグメント展開**: `{SUMMARY_SECTION}`, `{BASH_CATEGORIES}`, `{ARTIFACT_QUALITY}`, `{EXIT_CODE_RULE}` を展開 (`definitions.ts:99-102`)
4. **変数置換**: taskName, docsDir, workflowDir, userIntent, taskId, phase を置換 (`definitions.ts:104-109`)
5. **コンパクトヘッダー挿入**: task/intent/in/outの2行ヘッダーをタイトル直後に挿入 (`definitions.ts:113-123`)
6. **TOON入力注入**: ACE用のTOON入力ファイル参照セクションを追加 (`definitions.ts:126-127`)
7. **Reflector教訓注入**: 該当フェーズの学習済み教訓を追加 (`definitions.ts:128-129`)
8. **Markdownサニタイズ**: `##` → `===`, `###` → `==` に変換しTOON出力汚染を防止 (`definitions.ts:133`)

PhaseDefinition型 (`definitions-shared.ts:10-19`): description, subagentTemplate, model, bashCategories, inputFiles, outputFile, requiredSections, minLines の8フィールドで構成される。

テンプレートフラグメント (`definitions-shared.ts:26-57`):
- ARTIFACT_QUALITY_RULES: 品質要件(密度, 禁止語, プレースホルダー)
- SUMMARY_SECTION_RULE: TOON成果物形式ルール
- EXIT_CODE_RULE: AGT-1サブエージェント終了検出タグ
- bashCategoryHelp(): Bash制限カテゴリのヘルプテキスト生成関数

## ヘルパー関数

`registry.ts:126-170` に7個のヘルパー関数が定義されている:

| 関数 | 行 | 役割 |
|------|-----|------|
| getActivePhases(size) | 126-129 | サイズに応じたアクティブフェーズ配列を返却 |
| getNextPhase(current, size) | 131-139 | 次フェーズを返却(末尾ならnull) |
| getParallelGroup(phase) | 141-144 | フェーズの並列グループ名を返却 |
| getPhasesInGroup(group) | 146-150 | グループ内全フェーズを返却 |
| isParallelPhase(phase) | 152-154 | 並列フェーズか判定 |
| getActiveParallelGroups(size) | 156-164 | サイズに応じたアクティブ並列グループを返却 |
| getPhaseConfig(phase) | 166-170 | フェーズ設定を返却(不明フェーズはError) |
