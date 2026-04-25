# Requirements: harness-template-reliability

phase: requirements
task: harness-template-reliability
taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff
intent: 3タスク横断分析に基づくハーネス信頼性改善5件 — FIX-1(hearingテンプレートにuserResponse TOONキー明示), FIX-2(testing→regression_test間のbaseline_capture未実行検出), FIX-3(artifact_drift検出時のre-approvalチェーン半自動化), FIX-4(テンプレートTOON/MD出力形式統一ガイダンス強化), FIX-5(completedフェーズ異常滞留アラート)

## acceptanceCriteria

- AC-1: hearingテンプレート(TOON_SKELETON_HEARING)にuserResponseキーが含まれ、hearing-workerが出力するhearing.mdにuserResponse行が存在し、dod-l2-hearingの正規表現チェックを通過すること
- AC-2: hearingテンプレートにAskUserQuestion呼び出し必須の指示が含まれ、選択肢2個以上の提示を要求する文言がテンプレートに存在すること
- AC-3: testingフェーズテンプレートにbaseline_capture必須ステップのリマインド強調文が冒頭に追加され、regression_testフェーズ進行時にbaseline未実行を視覚的に警告すること
- AC-4: harness_backツールスキーマにcascadeオプショナルパラメータが追加され、cascade=true指定時にgoBack対象範囲の承認済みゲートを特定し再承認を実行すること
- AC-5: cascade-reapprove処理がPHASE_APPROVAL_GATESマップを参照し、goBack対象フェーズ以降のcompletedPhasesから除外されたフェーズのうち承認ゲートを持つものを再承認対象として特定すること
- AC-6: cascade-reapprove処理がapproval.tsのIA-1/IA-2/IA-6前提条件チェックをバイパスせず、前提条件未達時にcascade処理を中断しユーザーに手動対応を通知すること
- AC-7: hearingテンプレートにSUMMARY_SECTIONフラグメントが追加され、definitions.tsのreplace処理で正常に展開されること
- AC-8: phase-analytics.tsのgenerateAdvice関数にcompletedフェーズ滞留検出ルールが追加され、current===falseかつ経過時間3600s超過のフェーズに対して警告adviceが出力されること
- AC-9: goBack関数実行後にstate.approvalsから再承認対象フェーズのエントリが削除され、再承認ループ実行前にクリーンな承認状態が確保されること
- AC-10: cascade=falseまたは未指定時のharness_back動作が従来と完全に同一であり、既存のgoBack処理に副作用が発生しないこと

## decisions

- REQ-001: F-001 hearingスケルトンuserResponseフィールド追加。toon-skeletons-a.tsのTOON_SKELETON_HEARINGの:section intent-analysis内に`:userResponse [AskUserQuestionの回答全文]`行を追加する。dod-l2-hearing.tsの正規表現 `/^userResponse:/m` がマッチ可能になる。
- REQ-002: F-002 hearingテンプレートAskUserQuestion必須化と選択肢2個以上の強制。defs-stage0.tsのhearingテンプレートにAskUserQuestion呼び出し必須の指示と選択肢最低2個の要求を追加する。
- REQ-003: F-003 testingテンプレートbaseline_captureリマインド追加。defs-stage5.tsのtestingテンプレート冒頭にbaseline_capture必須ステップの強調リマインドを追加する。ロジック変更は伴わない。
- REQ-004: F-004 harness_backスキーマcascadeパラメータ追加。defs-a.tsのharness_backスキーマにcascade: boolean(オプショナル)プロパティを追加する。MCPコントラクトの後方互換性を維持する。
- REQ-005: F-005 cascade-reapproveロジック実装。scope-nav.tsのhandleHarnessBack関数内でcascade=true時にPHASE_APPROVAL_GATESを走査し、goBack対象範囲の承認済みフェーズを特定して再承認を実行する。
- REQ-006: F-006 goBack後approval削除処理追加。manager-lifecycle.tsまたはscope-nav.ts内でgoBack実行後にstate.approvalsから対象フェーズのエントリを削除する。goBack関数の型シグネチャ変更は不要。
- REQ-007: F-007 hearingテンプレートSUMMARY_SECTION追加。defs-stage0.tsのhearingテンプレートにSUMMARY_SECTIONフラグメントをARTIFACT_QUALITYの直前に追加し、他フェーズと同一構造にする。
- REQ-008: F-008 completedフェーズ滞留検出ルール追加。phase-analytics.tsのgenerateAdvice関数にcompleted(current===false)かつ経過時間3600s超過のフェーズに対する警告adviceルールを追加する。
- REQ-009: F-009 cascade-reapprove安全設計。cascade処理はapproval.tsのIA-1/IA-2/IA-6前提条件チェックをバイパスしない。前提条件未達時は処理中断しユーザー通知する。
- REQ-010: F-010 cascade=false時の後方互換性保証。cascade未指定またはfalse時のharness_back動作は従来と完全に同一であること。

## artifacts

- docs/workflows/harness-template-reliability/requirements.md: spec: FIX-1からFIX-5の機能要件10件(F-001〜F-010)と受入基準10件(AC-1〜AC-10)を定義。cascade-reapproveの安全設計と後方互換性を含む。

## next

- criticalDecisions: REQ-005(cascade-reapproveは4ファイル横断の高リスク変更であり段階的実装が必要), REQ-009(前提条件チェックのバイパス禁止は安全設計の核心)
- readFiles: src/tools/handlers/scope-nav.ts, src/tools/handlers/approval.ts, src/state/manager-lifecycle.ts, src/tools/defs-a.ts, src/phases/toon-skeletons-a.ts, src/phases/defs-stage0.ts, src/phases/defs-stage5.ts, src/tools/phase-analytics.ts
- warnings: FIX-3(F-004〜F-006, F-009〜F-010)は4ファイル横断変更で最もリスクが高い。cascade-reapproveがapproval.tsのIA-1/IA-2/IA-6チェックを通過する前提条件の維持が必須。実装順序はスキーマ(defs-a.ts)、approval削除(manager-lifecycle.ts)、cascadeロジック(scope-nav.ts)の順とする。

## notInScope

- approval.tsのhandleHarnessApprove関数自体の変更(既存の承認ロジックは維持)
- lifecycle-next.tsの承認チェックロジックの変更
- PHASE_APPROVAL_GATESマップの構造変更やエントリ追加削除
- dod-l2-hearing.tsの正規表現パターンの変更(FIX-1はスケルトン側で対応)
- dod-l3.tsのcheckBaselineRequired関数のロジック変更(FIX-2はテンプレート文言のみ)
- hearingフェーズ以外のテンプレートへのSUMMARY_SECTION追加(既に含まれている)
- phase-analytics.tsの既存5ルールの閾値やロジックの変更
- cascade-reapproveの完全自動化(明示的フラグ指定を要求する設計)

## openQuestions

なし
