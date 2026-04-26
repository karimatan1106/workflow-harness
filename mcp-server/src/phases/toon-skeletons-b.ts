/**
 * Markdown skeleton templates for Stage 2 phases (threat_modeling, planning, ui_design).
 * Fill-in-the-blank templates that satisfy DoD L4 checks on first pass.
 * Format: Markdown (## H2 sections + tables). Each skeleton MUST contain `## decisions`,
 * `## artifacts`, and `## next` H2 headings.
 * @spec docs/spec/features/workflow-harness.md / F-204 / AC-4
 */

export const TOON_SKELETON_THREAT_MODELING = `★ 以下のスケルトンをそのまま穴埋めして threat-model.md を作成すること。<...> を実際の値に置換。

# threat_modeling

- task: {taskName}
- status: complete
- inputArtifact: {docsDir}/requirements.md

## strideAnalysis

| id | category | threat | likelihood | impact | mitigation |
|----|----------|--------|------------|--------|------------|
| TM-01 | <S|T|R|I|D|E> | <脅威の説明> | <低|中|高> | <低|中|高> | <緩和策> |
| TM-02 | <S|T|R|I|D|E> | <脅威の説明> | <低|中|高> | <低|中|高> | <緩和策> |
| TM-03 | <S|T|R|I|D|E> | <脅威の説明> | <低|中|高> | <低|中|高> | <緩和策> |
| TM-04 | <S|T|R|I|D|E> | <脅威の説明> | <低|中|高> | <低|中|高> | <緩和策> |
| TM-05 | <S|T|R|I|D|E> | <脅威の説明> | <低|中|高> | <低|中|高> | <緩和策> |

## securityRequirements

| id | requirement | priority |
|----|-------------|----------|
| SR-1 | <セキュリティ要件> | <must|should|could> |

## decisions

| id | statement | rationale |
|----|-----------|-----------|
| TM-D1 | <判断内容> | <理由> |
| TM-D2 | <判断内容> | <理由> |
| TM-D3 | <判断内容> | <理由> |
| TM-D4 | <判断内容> | <理由> |
| TM-D5 | <判断内容> | <理由> |

## artifacts

| path | role | summary |
|------|------|---------|
| <ファイルパス> | <report|spec> | <概要> |

## next

### criticalDecisions
<重要判断のサマリー>

### readFiles
<次フェーズで読むべきファイル>

### warnings
<注意点>

注意: 各テーブルは実件数で行を増減させること。decisions は最低 5 行必須(DoD L4)。`;

export const TOON_SKELETON_PLANNING = `★ 以下のスケルトンをそのまま穴埋めして planning.md を作成すること。<...> を実際の値に置換。

# planning

- task: {taskName}
- status: complete
- inputArtifact: {docsDir}/requirements.md

## architectureDecisions

| id | decision | alternatives | rationale |
|----|----------|--------------|-----------|
| AD-1 | <設計判断> | <検討した代替案> | <選択理由> |

## implementationSteps

| id | description | files | dependsOn |
|----|-------------|-------|-----------|
| PL-01 | <実装ステップの説明> | <対象ファイル> | <依存するステップID> |
| PL-02 | <実装ステップの説明> | <対象ファイル> | <依存するステップID> |
| PL-03 | <実装ステップの説明> | <対象ファイル> | <依存するステップID> |
| PL-04 | <実装ステップの説明> | <対象ファイル> | <依存するステップID> |
| PL-05 | <実装ステップの説明> | <対象ファイル> | <依存するステップID> |

## rtmEntries

| id | requirement | status |
|----|-------------|--------|
| F-001 | <要件の説明> | pending |

## decisions

| id | statement | rationale |
|----|-----------|-----------|
| PL-D1 | <判断内容> | <理由> |
| PL-D2 | <判断内容> | <理由> |
| PL-D3 | <判断内容> | <理由> |
| PL-D4 | <判断内容> | <理由> |
| PL-D5 | <判断内容> | <理由> |

## artifacts

| path | role | summary |
|------|------|---------|
| <ファイルパス> | <spec|design> | <概要> |

## next

### criticalDecisions
<重要判断のサマリー>

### readFiles
<次フェーズで読むべきファイル>

### warnings
<注意点>

注意: 各テーブルは実件数で行を増減させること。decisions は最低 5 行必須(DoD L4)。
リファクタ時の実装順序: 削除→正規化→インターフェース設計→階層化→構造化→分割。`;

export const TOON_SKELETON_UI_DESIGN = `★ 以下のスケルトンをそのまま穴埋めして ui-design.md を作成すること。<...> を実際の値に置換。

# ui_design

- task: {taskName}
- status: complete
- inputArtifact: {docsDir}/planning.md

## components

| id | name | responsibility | props |
|----|------|----------------|-------|
| UID-01 | <コンポーネント名> | <責務> | <主要Props> |
| UID-02 | <コンポーネント名> | <責務> | <主要Props> |
| UID-03 | <コンポーネント名> | <責務> | <主要Props> |

## layouts

| id | screen | components | responsive |
|----|--------|------------|------------|
| L-1 | <画面名> | <使用コンポーネント> | <レスポンシブ方針> |

## interactions

| id | trigger | action | stateChange |
|----|---------|--------|-------------|
| INT-1 | <トリガー> | <アクション> | <状態変化> |

## decisions

| id | statement | rationale |
|----|-----------|-----------|
| UID-D1 | <判断内容> | <理由> |
| UID-D2 | <判断内容> | <理由> |
| UID-D3 | <判断内容> | <理由> |
| UID-D4 | <判断内容> | <理由> |
| UID-D5 | <判断内容> | <理由> |

## artifacts

| path | role | summary |
|------|------|---------|
| <ファイルパス> | <design|spec> | <概要> |

## next

### criticalDecisions
<重要判断のサマリー>

### readFiles
<次フェーズで読むべきファイル>

### warnings
<注意点>

注意: 各テーブルは実件数で行を増減させること。decisions は最低 5 行必須(DoD L4)。`;
