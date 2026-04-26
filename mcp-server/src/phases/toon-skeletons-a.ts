/**
 * Markdown skeleton templates for Stage 1 phases (scope_definition, research, impact_analysis, requirements, hearing).
 * Fill-in-the-blank templates that satisfy DoD L4 checks on first pass.
 * Format: Markdown (## H2 sections + tables). Each skeleton MUST contain `## decisions`,
 * `## artifacts`, and `## next` H2 headings.
 * @spec docs/spec/features/workflow-harness.md / F-204 / AC-4
 */

export const TOON_SKELETON_SCOPE_DEFINITION = `★ 以下のスケルトンをそのまま穴埋めして scope-definition.md を作成すること。<...> を実際の値に置換。

# scope_definition

- task: {taskName}
- status: complete

## summary

- purpose: <1文で目的を記述>
- rootCause: <根本原因またはきっかけを記述>
- reporter: <報告者>

## scopeFiles

| path | role | lines | changeType |
|------|------|-------|------------|
| <ファイルパス> | <impl|spec|test> | <行数> | <new|modified|rewrite|deleted> |

## decisions

| id | statement | rationale |
|----|-----------|-----------|
| SD-01 | <判断内容> | <理由> |
| SD-02 | <判断内容> | <理由> |
| SD-03 | <判断内容> | <理由> |
| SD-04 | <判断内容> | <理由> |
| SD-05 | <判断内容> | <理由> |

## artifacts

| path | role | summary |
|------|------|---------|
| <ファイルパス> | <spec|report> | <概要> |

## next

### criticalDecisions
<重要判断のサマリー>

### readFiles
<次フェーズで読むべきファイル>

### warnings
<注意点>

注意: 各テーブルは実件数で行を増減させること。decisions は最低 5 行必須(DoD L4)。`;

export const TOON_SKELETON_RESEARCH = `★ 以下のスケルトンをそのまま穴埋めして research.md を作成すること。<...> を実際の値に置換。最低50行。

# research

- task: {taskName}
- status: complete
- inputArtifact: {docsDir}/scope-definition.md

## existingPatterns

| id | pattern | location | description |
|----|---------|----------|-------------|
| EP-1 | <パターン名> | <場所> | <説明> |

## magicNumbers

| value | location | purpose | rationale |
|-------|----------|---------|-----------|
| <値> | <場所> | <用途> | <根拠> |

## implicitConstraints

| id | constraint | source | impact |
|----|------------|--------|--------|
| IC-1 | <制約> | <出典> | <影響> |

## fileAnalysis

| path | lines | keyFindings |
|------|-------|-------------|
| <ファイルパス> | <行数> | <主要な発見> |

## decisions

| id | statement | rationale |
|----|-----------|-----------|
| R-01 | <判断内容> | <理由> |
| R-02 | <判断内容> | <理由> |
| R-03 | <判断内容> | <理由> |
| R-04 | <判断内容> | <理由> |
| R-05 | <判断内容> | <理由> |

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

export const TOON_SKELETON_IMPACT_ANALYSIS = `★ 以下のスケルトンをそのまま穴埋めして impact-analysis.md を作成すること。<...> を実際の値に置換。

# impact_analysis

- task: {taskName}
- status: complete

## summary
<影響範囲の要約を1-2文で>

## impactedFiles

| file | changeType | risk |
|------|------------|------|
| <ファイル名> | <変更種別> | <低|中|高> |

## unaffectedModules

| module | reason |
|--------|--------|
| <モジュール名> | <影響を受けない理由> |

## breakingChanges
<破壊的変更の有無と詳細。なければ "なし">

## decisions

| id | statement | rationale |
|----|-----------|-----------|
| IA-01 | <判断内容> | <理由> |
| IA-02 | <判断内容> | <理由> |
| IA-03 | <判断内容> | <理由> |
| IA-04 | <判断内容> | <理由> |
| IA-05 | <判断内容> | <理由> |

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

注意: 各テーブルは実件数で行を増減させること。impactedFiles と unaffectedModules は両方必須。decisions は最低 5 行必須(DoD L4)。`;

export const TOON_SKELETON_REQUIREMENTS = `★ 以下のスケルトンをそのまま穴埋めして requirements.md を作成すること。<...> を実際の値に置換。

# requirements

- task: {taskName}
- status: complete
- inputArtifact: {docsDir}/research.md

## functionalRequirements

| id | description | source | priority |
|----|-------------|--------|----------|
| REQ-F1 | <機能要件の説明> | <要件の出典> | <must|should|could> |

## nonFunctionalRequirements

| id | category | description | threshold |
|----|----------|-------------|-----------|
| REQ-NF1 | <カテゴリ> | <非機能要件の説明> | <閾値> |

## acceptanceCriteria

| id | description | verificationMethod |
|----|-------------|--------------------|
| AC-1 | <受入基準の説明> | <検証方法> |
| AC-2 | <受入基準の説明> | <検証方法> |
| AC-3 | <受入基準の説明> | <検証方法> |
| AC-4 | <受入基準の説明> | <検証方法> |
| AC-5 | <受入基準の説明> | <検証方法> |

## notInScope

| item | reason |
|------|--------|
| <スコープ外項目> | <除外理由> |

## openQuestions

| id | question | impact |
|----|----------|--------|

## decisions

| id | statement | rationale |
|----|-----------|-----------|
| REQ-01 | <判断内容> | <理由> |
| REQ-02 | <判断内容> | <理由> |
| REQ-03 | <判断内容> | <理由> |
| REQ-04 | <判断内容> | <理由> |
| REQ-05 | <判断内容> | <理由> |

## artifacts

| path | role | summary |
|------|------|---------|
| <ファイルパス> | <spec|input> | <概要> |

## next

### criticalDecisions
<重要判断のサマリー>

### readFiles
<次フェーズで読むべきファイル>

### warnings
<注意点>

注意: 各テーブルは実件数で行を増減させること。
acceptanceCriteria は最低 5 件必須(DoD L4)。notInScope と openQuestions は必須セクション。
openQuestions が空ならテーブルヘッダーのみ（行なし）にすること。未解決質問が残っているとDoD失敗。
harness_add_ac / harness_add_rtm を呼んでACとRTMを登録すること。`;

export const TOON_SKELETON_HEARING = `★ 以下のスケルトンをそのまま穴埋めして hearing.md を作成すること。<...> を実際の値に置換。

# hearing

- task: {taskName}
- status: complete
- summary: <1行サマリー>

## intent-analysis

- surfaceRequest: <ユーザーが明示的に言ったこと>
- deepNeed: <背後にある本質的なニーズ>

### unclearPoints
- <不明確な点1>

### assumptions
- <前提として置いた仮定1>

### userResponse
<AskUserQuestionの回答全文>

## implementation-plan

- approach: <採用するアプローチ>
- estimatedScope: <変更ファイル数・規模の概算>

### risks
- <リスク1>

### questions
- <ユーザーへの確認事項（あれば）>

## decisions

| id | statement | rationale |
|----|-----------|-----------|
| H-01 | <判断内容> | <理由> |
| H-02 | <判断内容> | <理由> |
| H-03 | <判断内容> | <理由> |
| H-04 | <判断内容> | <理由> |
| H-05 | <判断内容> | <理由> |

## artifacts

| path | role | summary |
|------|------|---------|
| {docsDir}/hearing.md | spec | ヒアリング結果 |

## next

### criticalDecisions
<重要判断のサマリー>

### readFiles
{docsDir}/hearing.md

### warnings
<注意点>

注意: 各テーブルは実件数で行を増減させること。decisions は最低 5 行必須(DoD L4)。`;
