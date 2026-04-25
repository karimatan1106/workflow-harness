# Test Selection: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: test_selection
size: small

## selectedTestFiles

- workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts: 既存5テスト + 新規4テスト(TC-AC1-01, TC-AC1-02, TC-AC2-01, TC-AC2-02)。checkTDDRedEvidence関数の単体テスト。makeMinimalStateのscopeFilesを設定し直接関数呼び出しで検証する。
- workflow-harness/mcp-server/src/__tests__/handler-templates-validation.test.ts: 既存3テスト(回帰確認)。ARTIFACT_QUALITY_RULESの変更がテンプレート取得・置換・バリデーションに影響しないことを確認する。TC-AC3-01はこのファイルに追加し、ARTIFACT_QUALITY_RULES定数の文字列内容を直接検証する。

## existingTestAnalysis

- dod-tdd.test.ts (80行, 5テスト): TDD-1 Red evidence checkのdescribeブロック内に全テストが集約されている。runDoDChecks経由のテスト(L27-77)が5件。新規テストはcheckTDDRedEvidence直接呼び出しで追加し、既存テストのrunDoDChecks経由パスと分離する。
- handler-templates-validation.test.ts (165行, 5テスト): Subagent Templatesのdescribe(3テスト)とValidationのdescribe(2テスト)で構成。TC-AC3-01はARTIFACT_QUALITY_RULESのimportを追加し、独立したdescribeブロックで定数内容を検証する。
- dod-test-helpers.ts (148行): makeMinimalState関数がscopeFiles: []をデフォルトで返す。新規テストではstate.scopeFilesを直接上書きして拡張子判定ロジックを検証する。ヘルパー自体の変更は不要。

## regressionScope

- dod-basic.test.ts, dod-extended.test.ts, dod-format.test.ts: dod.tsのrunDoDChecks経由でcheckTDDRedEvidenceを間接的に呼び出す可能性がある。scopeFiles条件分岐は新規追加パスであり、既存テストのscopeFilesはデフォルト空配列のため既存ロジックにフォールスルーする(D-004に基づく)。回帰リスクは低い。
- handler-templates-s1.test.ts, handler-templates-s6-docs.test.ts: ARTIFACT_QUALITY_RULESを間接参照するテンプレート生成テスト。文字列追記のみのため構造変更なし。回帰リスクは低い。
- 全テストスイート(npx vitest run): TC-AC4-01として全テスト実行を実施し、回帰なしを確認する。

## testExecutionPlan

- Phase 1 (Red): dod-tdd.test.tsに新規4テスト(TC-AC1-01, TC-AC1-02, TC-AC2-01, TC-AC2-02)を追加し、実装前に実行して失敗を確認する。checkTDDRedEvidenceにscopeFiles判定が未実装のため、TC-AC1-01とTC-AC1-02はpassed:falseを返し失敗する。TC-AC2-01とTC-AC2-02は既存ロジックで既にpassed:falseを返すため成功する(Red phaseでは「実装後に期待通り動くこと」の確認が目的のため、既存動作テストは成功で正しい)。
- Phase 2 (Red): handler-templates-validation.test.tsにTC-AC3-01を追加し、実装前に実行して失敗を確認する。ARTIFACT_QUALITY_RULESに全行ユニーク制約が未追記のためstring containsアサーションが失敗する。
- Phase 3 (Green): Step 1(dod-l1-l2.ts変更)とStep 2(definitions-shared.ts変更)を実装後、全テストを実行してTC-AC1-01からTC-AC3-01が全てパスすることを確認する。
- Phase 4 (Regression): npx vitest runで全テストスイートを実行し、TC-AC4-01(回帰なし)を確認する。
- Phase 5 (Line count): wc -lでdod-l1-l2.tsとdefinitions-shared.tsが200行以下であることを確認する(TC-AC5-01)。

## decisions

- D-001: 新規テスト4件はdod-tdd.test.ts内に追加し、新規テストファイルは作成しない。checkTDDRedEvidenceの全テストを同一ファイルに集約することでテストの発見性と保守性を高めるため(planning D-005に準拠)。
- D-002: TC-AC3-01はhandler-templates-validation.test.tsに追加する。ARTIFACT_QUALITY_RULESはテンプレートバリデーションの一部であり、このファイルの責務範囲内であるため。
- D-003: 新規テストはcheckTDDRedEvidence関数を直接importして呼び出す。runDoDChecks経由だと他チェック(L1ファイル存在、L2 exitcode等)の副作用を受け、テスト対象が不明確になるため(planning D-006に準拠)。
- D-004: TC-AC2-01(コードファイル混在)とTC-AC2-02(空配列)はRed phaseで成功する(既存ロジックがpassed:falseを返す動作が期待通り)。実装後も同じ結果となるため、Red/Green両方で成功するテストとなる。これは既存動作の不変性を保証するテストであり正常な挙動である。
- D-005: regression scopeにdod-basic/extended/formatを含めたが、個別実行ではなくnpx vitest run(全スイート実行)でカバーする。個別ファイル指定は漏れのリスクがあるため、全スイート実行が確実である。
- D-006: handler-templates-validation.test.tsの行数は現在165行。TC-AC3-01追加で約180行となり200行以下を維持できる。分割は不要と判断した。
- D-007: ARTIFACT_QUALITY_RULESのstring containsアサーションは完全一致ではなく部分一致(toContain)で検証する。文言の微調整に対する脆弱性を下げ、制約の存在を検証する意図に集中するため。

## artifacts

- docs/workflows/harness-reporting-fixes/test-selection.md: test: テスト対象ファイル選定、既存テスト分析、回帰スコープ定義、実行計画

## next

- criticalDecisions: D-001 (既存ファイルへの集約), D-003 (直接関数呼び出し), D-004 (Red phase時の既存動作テスト挙動)
- readFiles: workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts, workflow-harness/mcp-server/src/__tests__/handler-templates-validation.test.ts, workflow-harness/mcp-server/src/__tests__/dod-test-helpers.ts
- warnings: handler-templates-validation.test.tsが180行に達するため、追加テストが大きくなる場合は分割を検討する必要がある
