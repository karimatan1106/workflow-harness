# ADR-013: article-insights-harness-improvements

Status: accepted
Date: 2026-03-28
TaskId: 232ed9ec-4af7-4cdf-b147-97cb18b1716c

## Intent (Why)
Anthropic記事の知見から4つの改善をハーネスに追加: (P3) AI slopパターンL4正規表現チェック, (P4) planningフェーズからコード例排除ルール, (P5) retryの改善vs方向転換判断ロジック, (P6) AC数下限を3→5に引き上げ

## Acceptance Criteria (What)
- AC-1: dod-helpers.tsにcheckAiSlopPatterns関数が存在し、hedging/empty_emphasis/redundant_preamble/vague_connectorsの4カテゴリを正規表現で検出する [met]
- AC-2: AI slopパターンが同一カテゴリで2回以上出現した場合、passed=trueかつevidenceに[WARN]プレフィックス付きで報告する（非ブロック動作） [met]
- AC-3: dod-l4-content.tsのcheckL4ContentValidation内でcheckAiSlopPatternsがduplicatesチェック後に呼び出される [met]
- AC-4: checkAiSlopPatternsはextractNonCodeLines経由で非コード行のみを対象とし、コードブロック内のパターンを検出しない [met]
- AC-5: AI slopパターンの検出テストが存在し、各4カテゴリの検出/非検出/閾値境界(1回=無視, 2回=警告)を検証する [met]
- AC-6: PhaseConfig型(types-core.ts)にnoCodeFences?: booleanオプショナルフラグが追加される [met]
- AC-7: planningフェーズ定義(defs-stage2.ts)でnoCodeFences: trueが設定される [met]
- AC-8: dod-l4-content.tsでnoCodeFences=trueのフェーズに対しCODE_FENCE_REGEX(/^`{3,}/m)でコードフェンスを検出し、passed=true + [WARN]evidenceで報告する [met]
- AC-9: .mmdファイル(Mermaid)はコードフェンス検出の対象外となる [met]
- AC-10: planningフェーズのコードフェンス検出テストが存在し、検出/非検出(.mmd除外)/インラインコード許容を検証する [met]
- AC-11: pivot-advisor.tsが新規作成され、detectRepeatedPatternとgeneratePivotSuggestionの2関数をエクスポートする [met]
- AC-12: detectRepeatedPatternはphase-errors.toonから直近失敗パターンを読み取り、現在のエラーパターンと比較して{isRepeated, consecutiveCount, pattern}を返す [met]
- AC-13: 同一L4エラーパターンが3回連続で検出された場合、generatePivotSuggestionがerrorClass別の方向転換提案文字列を生成する [met]
- AC-14: lifecycle-next.tsのbuildDoDFailureResponse内からpivot-advisor.tsが呼び出され、pivot情報がレスポンスに含まれる [met]
- AC-15: pivot-advisor.tsの単体テストが存在し、パターン一致(3回連続)/不一致/閾値未満(2回)のシナリオを検証する [met]
- AC-16: MIN_ACCEPTANCE_CRITERIA = 5定数がdod-l4-requirements.tsに定義され、エクスポートされる [met]
- AC-17: approval.tsがMIN_ACCEPTANCE_CRITERIAをdod-l4-requirements.tsからインポートして使用する [met]
- AC-18: ソース7箇所とガイダンス6箇所のリテラル"3"が全て値"5"または定数参照に更新される [met]
- AC-19: テスト9箇所以上のacCount値とアサーションが閾値5に対応するよう更新される [met]
- AC-20: ソースコード内にAC最低数に関するリテラル直書きの"3"が残存しない（定数またはメッセージ文字列内の"5"に統一） [met]
- AC-21: L4重複行チェック(checkDuplicateLines)がコードフェンス行(```で始まる行)を重複カウントから除外すること [met]
- AC-22: L4重複行チェックがMermaid構文行(graph, subgraph, end, -->等)を重複カウントから除外すること [met]
- AC-23: L4重複行チェックがMarkdownテーブル区切り行(|---|等)を重複カウントから除外すること [met]

## Scope
Files: .claude/skills/workflow-harness/workflow-rules.md, .claude/skills/workflow-harness/workflow-gates.md, .claude/skills/workflow-harness/workflow-phases.md, workflow-harness/mcp-server/src/phases/registry.ts, workflow-harness/mcp-server/src/tools/handler-shared.ts, workflow-harness/mcp-server/src/tools/delegate-coordinator.ts, workflow-harness/mcp-server/src/gates/dod-common.ts
Dirs: workflow-harness/mcp-server/src/gates, workflow-harness/mcp-server/src/phases, workflow-harness/mcp-server/src/tools, .claude/skills/workflow-harness

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\article-insights-harness-improvements
Completed phases: scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
