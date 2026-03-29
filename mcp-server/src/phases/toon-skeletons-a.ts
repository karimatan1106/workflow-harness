/**
 * TOON skeleton templates for Stage 1 phases (scope_definition, research, impact_analysis, requirements).
 * Fill-in-the-blank templates that satisfy DoD L4 checks on first pass.
 * Rules: "key: value" (space after colon), decisions>=5, field count = header count,
 * comma-containing values quoted "...", [N] replaced with actual count.
 * @spec docs/spec/features/workflow-harness.md
 */

export const TOON_SKELETON_SCOPE_DEFINITION = `★ 以下のスケルトンをそのまま穴埋めして scope-definition.md を作成すること。<...> を実際の値に置換。[N]は実件数に置換。

phase: scope_definition
task: {taskName}
status: complete

summary:
  purpose: <1文で目的を記述>
  rootCause: <根本原因またはきっかけを記述>
  reporter: <報告者>

scopeFiles[N]{path,role,lines,changeType}:
  <ファイルパス>, <impl|spec|test>, <行数>, <new|modified|rewrite|deleted>

decisions[N]{id,statement,rationale}:
  SD-01, <判断内容>, <理由>
  SD-02, <判断内容>, <理由>
  SD-03, <判断内容>, <理由>
  SD-04, <判断内容>, <理由>
  SD-05, <判断内容>, <理由>

artifacts[N]{path,role,summary}:
  <ファイルパス>, <spec|report>, <概要>

next:
  criticalDecisions: <重要判断のサマリー>
  readFiles: <次フェーズで読むべきファイル>
  warnings: <注意点>

注意: カンマを含む値は "..." で囲むこと。[N]は実際の件数に置換すること。`;

export const TOON_SKELETON_RESEARCH = `★ 以下のスケルトンをそのまま穴埋めして research.md を作成すること。<...> を実際の値に置換。[N]は実件数に置換。最低50行。

phase: research
task: {taskName}
status: complete
inputArtifact: {docsDir}/scope-definition.md

existingPatterns[N]{id,pattern,location,description}:
  EP-1, <パターン名>, <場所>, <説明>

magicNumbers[N]{value,location,purpose,rationale}:
  <値>, <場所>, <用途>, <根拠>

implicitConstraints[N]{id,constraint,source,impact}:
  IC-1, <制約>, <出典>, <影響>

fileAnalysis[N]{path,lines,keyFindings}:
  <ファイルパス>, <行数>, <主要な発見>

decisions[N]{id,statement,rationale}:
  R-01, <判断内容>, <理由>
  R-02, <判断内容>, <理由>
  R-03, <判断内容>, <理由>
  R-04, <判断内容>, <理由>
  R-05, <判断内容>, <理由>

artifacts[N]{path,role,summary}:
  <ファイルパス>, <report|spec>, <概要>

next:
  criticalDecisions: <重要判断のサマリー>
  readFiles: <次フェーズで読むべきファイル>
  warnings: <注意点>

注意: カンマを含む値は "..." で囲むこと。[N]は実際の件数に置換すること。`;

export const TOON_SKELETON_IMPACT_ANALYSIS = `★ 以下のスケルトンをそのまま穴埋めして impact-analysis.md を作成すること。<...> を実際の値に置換。[N]は実件数に置換。

phase: impact_analysis
task: {taskName}
status: complete
summary: <影響範囲の要約を1-2文で>

impactedFiles[N]{file,changeType,risk}:
  <ファイル名>, <変更種別>, <低|中|高>

unaffectedModules[N]{module,reason}:
  <モジュール名>, <影響を受けない理由>

breakingChanges: <破壊的変更の有無と詳細。なければ "なし">

decisions[N]{id,statement,rationale}:
  IA-01, <判断内容>, <理由>
  IA-02, <判断内容>, <理由>
  IA-03, <判断内容>, <理由>
  IA-04, <判断内容>, <理由>
  IA-05, <判断内容>, <理由>

artifacts[N]{path,role,summary}:
  <ファイルパス>, <report|spec>, <概要>

next:
  criticalDecisions: <重要判断のサマリー>
  readFiles: <次フェーズで読むべきファイル>
  warnings: <注意点>

注意: カンマを含む値は "..." で囲むこと。[N]は実際の件数に置換すること。impactedFilesとunaffectedModulesは両方必須。`;

export const TOON_SKELETON_REQUIREMENTS = `★ 以下のスケルトンをそのまま穴埋めして requirements.md を作成すること。<...> を実際の値に置換。[N]は実件数に置換。

phase: requirements
task: {taskName}
status: complete
inputArtifact: {docsDir}/research.md

functionalRequirements[N]{id,description,source,priority}:
  REQ-F1, <機能要件の説明>, <要件の出典>, <must|should|could>

nonFunctionalRequirements[N]{id,category,description,threshold}:
  REQ-NF1, <カテゴリ>, <非機能要件の説明>, <閾値>

acceptanceCriteria[N]{id,description,verificationMethod}:
  AC-1, <受入基準の説明>, <検証方法>
  AC-2, <受入基準の説明>, <検証方法>
  AC-3, <受入基準の説明>, <検証方法>

notInScope[N]{item,reason}:
  <スコープ外項目>, <除外理由>

openQuestions[0]{id,question,impact}:

decisions[N]{id,statement,rationale}:
  REQ-01, <判断内容>, <理由>
  REQ-02, <判断内容>, <理由>
  REQ-03, <判断内容>, <理由>
  REQ-04, <判断内容>, <理由>
  REQ-05, <判断内容>, <理由>

artifacts[N]{path,role,summary}:
  <ファイルパス>, <spec|input>, <概要>

next:
  criticalDecisions: <重要判断のサマリー>
  readFiles: <次フェーズで読むべきファイル>
  warnings: <注意点>

注意: カンマを含む値は "..." で囲むこと。[N]は実際の件数に置換すること。
acceptanceCriteriaは最低5件必須(DoD L4)。notInScopeとopenQuestionsは必須キー。
openQuestionsが空なら [0] で空配列にすること。未解決質問が残っているとDoD失敗。
harness_add_ac / harness_add_rtm を呼んでACとRTMを登録すること。`;

export const TOON_SKELETON_HEARING = `
出力フォーマット（TOON形式）

:toon hearing v1
:summary [1行サマリー]

:section intent-analysis
:surfaceRequest [ユーザーが明示的に言ったこと]
:deepNeed [背後にある本質的なニーズ]
:unclearPoints
  - [不明確な点1]
:assumptions
  - [前提として置いた仮定1]
:userResponse [AskUserQuestionの回答全文]
:end intent-analysis

:section implementation-plan
:approach [採用するアプローチ]
:estimatedScope [変更ファイル数・規模の概算]
:risks
  - [リスク1]
:questions
  - [ユーザーへの確認事項（あれば）]
:end implementation-plan

:section decisions
:decision [D-HR-1] [判断内容] :reason [理由]
:end decisions

:section artifacts
:artifact hearing.md :status draft
:end artifacts

:section next
:next scope_definition :input hearing.md
:end next
`;
