# .toon -> .md フェーズ成果物拡張子移行: 影響範囲調査

scope: フェーズ成果物ファイルのみ対象。内部状態ファイル (workflow-state.toon, task-index.toon, reflector-log.toon, ace-context.toon, metrics.toon 等) は変更しない。

## 1. 変更対象ファイル一覧

### 1-A. registry.ts (outputFile / inputFiles)
path: workflow-harness/mcp-server/src/phases/registry.ts
影響箇所: 20フェーズのoutputFileと、それを参照するinputFiles全件

outputFile に .toon を使うフェーズ (19件):
- hearing -> hearing.toon
- scope_definition -> scope-definition.toon
- research -> research.toon
- impact_analysis -> impact-analysis.toon
- requirements -> requirements.toon
- threat_modeling -> threat-model.toon
- planning -> planning.toon
- ui_design -> ui-design.toon
- design_review -> design-review.toon
- test_design -> test-design.toon
- test_selection -> test-selection.toon
- code_review -> code-review.toon
- acceptance_verification -> acceptance-report.toon
- manual_test -> manual-test.toon
- security_scan -> security-scan.toon
- performance_test -> performance-test.toon
- e2e_test -> e2e-test.toon
- docs_update -> docs-update.toon
- health_observation -> health-report.toon

inputFiles に .toon を参照するフェーズ (14件):
- scope_definition: hearing.toon
- research: scope-definition.toon
- impact_analysis: scope-definition.toon, research.toon
- requirements: research.toon, impact-analysis.toon
- threat_modeling: requirements.toon
- planning: requirements.toon, threat-model.toon
- state_machine: planning.toon
- flowchart: planning.toon
- ui_design: planning.toon
- design_review: ui-design.toon, planning.toon, threat-model.toon
- test_design: planning.toon
- test_selection: test-design.toon, impact-analysis.toon
- acceptance_verification: requirements.toon, test-design.toon
- docs_update: planning.toon, requirements.toon, code-review.toon

inputFileModes に .toon キーを使うフェーズ (3件):
- design_review: ui-design.toon, planning.toon, threat-model.toon
- docs_update: planning.toon, requirements.toon, code-review.toon
- acceptance_verification: requirements.toon, test-design.toon

### 1-B. definitions.ts (OUTPUT_FILE_TO_PHASE)
path: workflow-harness/mcp-server/src/phases/definitions.ts
影響箇所: L52-72 の19エントリ全て (.toon -> .md)
関連関数: buildToonFirstSection (L74-85) -- 変数名 toonFiles の名称変更推奨

### 1-C. definitions-shared.ts
path: workflow-harness/mcp-server/src/phases/definitions-shared.ts
影響箇所:
- L32: {docsDir}/{phase}.toon -> {docsDir}/{phase}.md
- L41: scope-definition.toon -> scope-definition.md
- L67: {docsDir}/{phase}.toon -> {docsDir}/{phase}.md

### 1-D. defs-stage0.ts ~ defs-stage6.ts (subagentTemplate内)
全7ファイルの subagentTemplate 文字列リテラル内 .toon 参照を .md に変更:
- defs-stage0.ts: 2箇所
- defs-stage1.ts: 14箇所
- defs-stage2.ts: 16箇所
- defs-stage3.ts: 18箇所
- defs-stage4.ts: 17箇所
- defs-stage5.ts: 8箇所
- defs-stage6.ts: 10箇所

### 1-E. toon-skeletons-a.ts / toon-skeletons-b.ts
- skeletons-a: 7箇所 (説明文 + inputArtifact値)
- skeletons-b: 6箇所 (説明文 + inputArtifact値)

### 1-F. gates/ (DoDゲート)

dod-l3.ts:
- L23: .endsWith(.toon) ガード条件 -- 重要設計判断ポイント
- L36: fix メッセージ

dod-l4-content.ts:
- L63-68: extname(outputFile) === .toon ガード条件 -- 重要設計判断ポイント

dod-l4-ia.ts: 16箇所 (design-review.toon, test-design.toon, code-review.toon)

dod-l4-requirements.ts: 22箇所 (requirements.toon)

dod-l4-delta.ts: 1箇所 (fix メッセージ)

### 1-G. tools/
- handlers/approval.ts: 7箇所
- handlers/delegate-coordinator.ts: 1箇所
- retry.ts: 2箇所

### 1-H. テストファイル (28ファイル, 150+箇所)
主要: 10m-resilience-p1/p2p4, dod-basic, dod-ia, dod-ia-coverage, dod-ia5,
dod-l3-l4-content, dod-l4-requirements, dod-l4-sections, dod-l4-duplicate, dod-l4-refs,
dod-tdd, dod-toon-safety, context-engineering, handler-lifecycle, handler-templates-*,
handler-parallel, manager-core, manager-lifecycle, gc, hmac, stale-task-hmac,
metrics, progress-json, n63-n72, rtm-intent-gate, reflector-*

### 1-I. ドキュメント/スキル/ルール (11ファイル, 60箇所)
- .claude/rules/core-constraints.md (1箇所)
- .claude/skills/workflow-harness/workflow-execution.md (18箇所)
- .claude/skills/workflow-harness/workflow-docs.md (14箇所)
- .claude/skills/workflow-harness/workflow-phases.md (15箇所)
- .claude/skills/workflow-harness/workflow-orchestrator.md (3箇所)
- .claude/skills/workflow-harness/retrospective.md
- .claude/agents/hearing-worker.md (1箇所)
- .claude/agents/worker.md (1箇所)
- .claude/agents/coordinator.md (1箇所)
- docs/spec/features/phase-system.md (18箇所)
- docs/spec/features/gate-system.md (6箇所)

## 2. 重要設計判断ポイント

DJ-1: .md ファイルでもTOONパースを継続するか
- dod-l3.ts L23 と dod-l4-content.ts L63-68 で拡張子 .toon をガード条件に使用
- .md に変更後もTOON形式で中身を書く場合、ガード条件をレジストリベース判定に変更する必要あり

DJ-2: allowedExtensions の .toon は残すか
- 内部状態ファイル (workflow-state.toon等) の読み書きに必要なため完全削除不可
- .md を追加し .toon は内部状態用として残す方針が妥当

DJ-3: inputFileModes のキーも変更必要
- design_review, docs_update, acceptance_verification のキーはbasename

## 3. Worker分解案

Worker-1: registry + definitions (コア定義変更)
- registry.ts, definitions.ts, definitions-shared.ts
- 約80箇所

Worker-2: defs-stage + skeletons (subagentTemplate)
- defs-stage0~6.ts, toon-skeletons-a/b.ts (9ファイル)
- 約85箇所

Worker-3: gates (DoDゲート + DJ-1実装)
- dod-l3.ts, dod-l4-content.ts, dod-l4-ia.ts, dod-l4-requirements.ts, dod-l4-delta.ts
- 約45箇所

Worker-4: tools
- handlers/approval.ts, handlers/delegate-coordinator.ts, retry.ts
- 約10箇所

Worker-5: テスト更新 (Worker-1~4完了後)
- 28テストファイル
- 約150+箇所

Worker-6: ドキュメント/スキル/ルール
- 11ファイル
- 約60箇所

## 4. 変更対象外 (内部状態ファイル)

以下は .toon のまま維持:
- workflow-state.toon, task-index.toon, claude-progress.toon
- reflector-log.toon, ace-context.toon, metrics.toon
- adr-store.toon, archgate-rules.toon, curator-log.toon
- design-code-index.toon
- phase-errors.toon, phase-analytics.toon, phase-metrics.toon
- follow-up-tests.toon
- state-toon-io.ts, state-toon-parse.ts (I/Oユーティリティ)

## 5. 合計サマリ

| カテゴリ | ファイル数 | 変更箇所概算 |
|----------|-----------|-------------|
| コア定義 | 3 | 80 |
| subagentTemplate | 9 | 85 |
| DoDゲート | 5 | 45 |
| ツール | 3 | 10 |
| テスト | 28 | 150+ |
| ドキュメント | 11 | 60 |
| 合計 | 59 | 430+ |
