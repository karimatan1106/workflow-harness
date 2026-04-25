# Scope Definition: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: scope_definition
size: small

## P1: tdd_red_evidence免除 (scopeFilesが.md/.mmdのみの場合)

対象: test_implフェーズのDoD L2チェック checkTDDRedEvidence 関数。
現状ロジック: phase !== 'test_impl' のときのみ免除。scopeFilesの内容は考慮していない。
修正方針: scopeFilesが全て .md/.mmd 拡張子の場合、tdd_red_evidenceを免除(passed: true)する条件を追加。
根拠: ドキュメントのみの変更タスクではテストコードが存在せず、TDD Redフェーズの証拠取得が不可能。

影響ファイル:
- workflow-harness/mcp-server/src/gates/dod-l1-l2.ts (checkTDDRedEvidence関数、76-96行付近)
- workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts (テスト追加)

## P2: テンプレート全行ユニーク制約の標準注入

対象: buildSubagentPrompt関数が返すテンプレート文字列。
現状ロジック: ARTIFACT_QUALITY_RULESに「同一行3回以上繰り返し禁止」はあるが、全行ユニーク制約はない。
修正方針: definitions-shared.tsのARTIFACT_QUALITY_RULESまたはbuildSubagentPrompt内で全行ユニーク制約ルールを注入。
根拠: DoD L1ゲートが重複行を検出して失敗するが、テンプレート側でその制約を事前に伝達していない。

影響ファイル:
- workflow-harness/mcp-server/src/phases/definitions-shared.ts (ARTIFACT_QUALITY_RULES定数)
- workflow-harness/mcp-server/src/__tests__/handler-templates-validation.test.ts (テスト追加)

## decisions

- D-001: checkTDDRedEvidenceにscopeFiles拡張子チェックを追加 (ドキュメントのみのタスクでTDD Red証拠は取得不可能であり、false negativeを防ぐ)
- D-002: 免除条件は.mdと.mmdの2拡張子に限定 (ハーネスがサポートするドキュメント成果物拡張子がこの2種のみ)
- D-003: ARTIFACT_QUALITY_RULESに全行ユニーク制約を追記 (テンプレートフラグメントとして全フェーズに自動適用され漏れがない)
- D-004: state引数をcheckTDDRedEvidenceに渡してscopeFilesを参照 (関数シグネチャは既にstateを受け取っており追加引数不要)
- D-005: 既存テストケースは変更せず新規ケースのみ追加 (既存の動作保証を維持しながら新条件をカバー)

## artifacts

- docs/workflows/harness-reporting-fixes/scope-definition.md (spec): 2件の修正のスコープ定義と影響範囲分析
- docs/workflows/harness-reporting-fixes/test-design.md (test): P1/P2それぞれのテストケース設計(後続フェーズで作成)

## next

- criticalDecisions: D-001(scopeFiles拡張子チェック追加), D-003(ARTIFACT_QUALITY_RULESへの全行ユニーク制約追記)
- readFiles: workflow-harness/mcp-server/src/gates/dod-l1-l2.ts, workflow-harness/mcp-server/src/phases/definitions-shared.ts
- warnings: P1のscopeFiles参照は既存state引数から取得可能だがTaskState型にscopeFilesが存在することを確認済み

## scopeFiles

- workflow-harness/mcp-server/src/gates/dod-l1-l2.ts
- workflow-harness/mcp-server/src/phases/definitions-shared.ts
- workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts
- workflow-harness/mcp-server/src/__tests__/handler-templates-validation.test.ts

## scopeDirs

- workflow-harness/mcp-server/src/gates
- workflow-harness/mcp-server/src/phases
