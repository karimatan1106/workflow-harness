# Impact Analysis: harness-template-reliability

phase: impact_analysis
task: harness-template-reliability

## decisions

- IA-001: FIX-1(toon-skeletons-a.ts)の逆依存はdefinitions.tsのみ。definitions.tsがskelAとしてワイルドカードimportし、全スケルトンキーをテンプレートに展開する。TOON_SKELETON_HEARINGへのuserResponseフィールド追加は展開パイプラインに沿った変更であり、他スケルトンや他フェーズのテンプレートに副作用を生じない。リスク: 低。
- IA-002: FIX-3(scope-nav.ts + defs-a.ts + handler-shared.ts + manager-lifecycle.ts)は4ファイル横断の変更で最大リスク。scope-nav.tsはhandler.tsから呼び出され、handler.tsはMCPサーバーのエントリポイントである。goBack関数の戻り値拡張はmanager.tsのデリゲート経由で全呼び出し元に影響する。PHASE_APPROVAL_GATESはapproval.ts、lifecycle-next.ts、skill-rules.test.tsから参照されており、エクスポート構造の変更は不要だが、cascade-reapproveロジックがapproval.tsのIA-1/IA-2/IA-6チェックを通過する前提条件を維持する必要がある。リスク: 高。
- IA-003: FIX-4(defs-stage0.ts)へのSUMMARY_SECTION追加はdefinitions.tsのreplace処理(L113)で自動展開される。hearingテンプレートは現在ARTIFACT_QUALITYのみ含み、他フェーズはSUMMARY_SECTIONとARTIFACT_QUALITYの両方を含む。追加位置はARTIFACT_QUALITYの直前とし、他フェーズと同一構造にする。SUMMARY_SECTION_RULEとTOON_SKELETON_HEARINGの記述に重複が生じうるが、スケルトンは出力形式の例示、SUMMARY_SECTIONは成果物記録ルールであり責務が異なるため重複にはあたらない。リスク: 低。
- IA-004: FIX-5(phase-analytics.ts)のgenerateAdvice関数への新ルール追加はビルド分析パイプライン内の局所変更。buildAnalytics関数の戻り値AnalyticsResult型にadvice配列が既存であり、新ルールは配列への要素追加のみ。逆依存はanalytics-toon.ts(型importのみ)、lifecycle-completion.ts、lifecycle-start-status.ts(buildAnalytics呼び出し)、phase-analytics.test.ts。呼び出し元は戻り値のadvice配列を透過的に使用するため破壊的変更にならない。リスク: 低。
- IA-005: FIX-2(defs-stage5.ts + dod-l3.ts)はテンプレート文言強化とエラーメッセージ改善であり、ロジック変更を伴わない。dod-l3.tsのcheckBaselineRequired関数はdod.tsからimportされ、regression_testフェーズ限定で実行される。testingテンプレートへのリマインド文追加は文字列定数の変更のみ。リスク: 最低。
- IA-006: FIX-3のmanager-lifecycle.ts goBack関数の戻り値拡張について、現在goBackはTaskState型を返す。承認済みフェーズ情報の追加はTaskState内のapprovalsプロパティで既に保持されているため、新規型定義は不要。handleHarnessBack側でgoBack実行後にstate.approvalsから対象エントリを削除し、PHASE_APPROVAL_GATESを走査して再承認ループを実行する設計とする。goBack関数自体の型シグネチャ変更は不要。
- IA-007: FIX-1とFIX-4の同時変更(SD-007)について、toon-skeletons-a.tsとdefs-stage0.tsは独立したファイルだがdefinitions.tsで統合展開される。展開順序はスケルトン置換(L119-122)が先、フラグメント置換(L113-115)が後であるため、FIX-1のスケルトン追加とFIX-4のフラグメント追加は干渉しない。

## artifacts

- docs/workflows/harness-template-reliability/impact-analysis.md: report: FIX-1からFIX-5の逆依存分析と影響範囲特定。変更対象8ファイル、影響を受ける逆依存ファイル12件、破壊的変更なし。

## impactedFiles

| ファイル | FIX | リスク | 理由 |
|---------|-----|--------|------|
| src/phases/toon-skeletons-a.ts | FIX-1 | 低 | userResponseフィールド追加。definitions.tsの展開パイプラインで自動反映 |
| src/phases/defs-stage0.ts | FIX-4 | 低 | SUMMARY_SECTIONフラグメント追加。definitions.tsのreplace処理で展開 |
| src/phases/defs-stage5.ts | FIX-2 | 最低 | テンプレート文言追加のみ。ロジック変更なし |
| src/gates/dod-l3.ts | FIX-2 | 最低 | エラーメッセージ文言改善のみ。チェックロジック変更なし |
| src/tools/handlers/scope-nav.ts | FIX-3 | 高 | cascade-reapproveロジック追加。approval.tsのチェック連携が必要 |
| src/tools/defs-a.ts | FIX-3 | 中 | harness_backスキーマにcascadeプロパティ追加。MCPコントラクト変更 |
| src/tools/handler-shared.ts | FIX-3 | 低 | PHASE_APPROVAL_GATESの既存エクスポートを参照するのみ。変更なし |
| src/state/manager-lifecycle.ts | FIX-3 | 中 | goBack後のapproval削除ロジック追加。戻り値型は変更不要 |
| src/tools/phase-analytics.ts | FIX-5 | 低 | generateAdvice関数に新ルール追加。既存ルール群と同パターン |

## unaffectedModules

| モジュール | 理由 |
|-----------|------|
| src/phases/defs-stage1.ts〜defs-stage4.ts | FIX対象外のステージ定義。テンプレート変更はdefs-stage0.tsとdefs-stage5.tsに限定 |
| src/phases/defs-stage6.ts | docs_updateフェーズ以降のテンプレート。変更スコープ外 |
| src/phases/toon-skeletons-b.ts | 後半フェーズ用スケルトン。FIX-1はtoon-skeletons-a.tsのHEARINGスケルトンのみ対象 |
| src/gates/dod-l1-l2.ts | L1/L2チェックは変更対象外。dod-l2-hearing.tsのuserResponseチェックはFIX-1で通過可能になるが関数自体の変更は不要 |
| src/gates/dod-l4-*.ts | L4チェック群は変更スコープ外 |
| src/tools/handlers/lifecycle-next.ts | PHASE_APPROVAL_GATESを参照するがFIX-3はscope-nav.ts内で完結。lifecycle-nextの承認チェックロジックは変更不要 |
| src/tools/handlers/recording.ts | 記録ハンドラーはFIXの影響範囲外 |
| src/tools/handlers/query.ts | クエリハンドラーはFIXの影響範囲外 |
| src/cli.ts | handler-shared.tsからvalidateSessionをimportするがFIX-3はPHASE_APPROVAL_GATESのみ関連。cli.tsへの影響なし |

## breakingChanges

FIX-1〜FIX-5のいずれも破壊的変更を含まない。

- FIX-1: スケルトンへのフィールド追加は後方互換。既存のhearing出力にuserResponseが追加されるがDoD L2チェックは正規表現マッチのため追加フィールドに対して寛容。
- FIX-2: テンプレート文言変更とエラーメッセージ変更はAPIコントラクトに影響しない。
- FIX-3: harness_backスキーマへのcascadeプロパティ追加はオプショナルパラメータであり、既存のharness_back呼び出し(cascadeなし)は従来通り動作する。
- FIX-4: SUMMARY_SECTIONフラグメント追加はテンプレート出力の追加であり削除ではない。
- FIX-5: advice配列への新ルール追加は既存のadvice消費ロジックに影響しない。

## testImpact

| テストファイル | 影響 | 理由 |
|--------------|------|------|
| handler-approval.test.ts | 要確認 | FIX-3のcascade-reapproveがapproval.tsのhandleHarnessApproveを呼び出すため、再承認パスの新規テストケース追加が必要 |
| manager-lifecycle-reset.test.ts | 要更新 | FIX-3でgoBack後のapproval削除ロジックが追加されるため、goBackテストケースにapproval状態の検証を追加 |
| phase-analytics.test.ts | 要追加 | FIX-5のcompleted滞留検出ルールの新規テストケースが必要。既存テストは壊れない |
| mcp-contract.test.ts | 要確認 | FIX-3でharness_backスキーマにcascadeプロパティが追加される。スキーマ構造テストがある場合は更新 |
| skill-rules.test.ts | 影響なし | PHASE_APPROVAL_GATESの数(6件)は変更されないためTC-AC2-03は通過 |
| invariant-manager.test.ts | 影響なし | dod-l3.tsのcheckInvariantCompletenessテストのみ。checkBaselineRequiredの文言変更は対象外 |
| dod-l3-baseline.test.ts | 要確認 | FIX-2のエラーメッセージ変更がアサーション文字列に影響する可能性。正確な文字列マッチをしている場合は更新 |
| handler-templates-s1.test.ts | 影響なし | stage1テンプレートのテスト。FIX対象はstage0/stage5 |
| size-argument.test.ts | 影響なし | defs-a.tsをdynamic importするがharness_startのスキーマテスト。harness_backスキーマ変更は対象外 |

## riskSummary

- 全体リスク: 中。FIX-3のcascade-reapproveが4ファイル横断で最もリスクが高い。
- FIX-3以外(FIX-1, FIX-2, FIX-4, FIX-5)は局所的な追加変更であり低リスク。
- FIX-3の実装順序: defs-a.ts(スキーマ) -> manager-lifecycle.ts(approval削除) -> scope-nav.ts(cascadeロジック)の順で段階的に実装し、各段階でテスト実行することでリスクを最小化する。

## next

- criticalDecisions: IA-002(FIX-3は4ファイル横断の高リスク変更。cascade-reapproveがapproval.tsのIA-1/IA-2/IA-6チェックを維持する設計), IA-006(goBack関数の型シグネチャ変更は不要。handleHarnessBack側でapproval削除と再承認を一括処理)
- readFiles: src/tools/handlers/scope-nav.ts, src/tools/handlers/approval.ts, src/state/manager-lifecycle.ts, src/tools/defs-a.ts, src/__tests__/manager-lifecycle-reset.test.ts, src/__tests__/dod-l3-baseline.test.ts, src/__tests__/mcp-contract.test.ts
- warnings: FIX-3のcascade-reapproveではapproval.tsのhandleHarnessApproveが持つ3つの前提条件チェック(IA-1/IA-2/IA-6)が再承認時に発動する。再承認対象フェーズの前提条件が満たされていない場合cascade処理が中断し、ユーザーに手動対応を求める必要がある。これは意図的な安全設計であり、前提条件チェックをバイパスしてはならない。
