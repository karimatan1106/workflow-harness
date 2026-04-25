# Planning: harness-template-reliability

phase: planning
task: harness-template-reliability
taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff
intent: FIX-1〜FIX-5の9ステップ実装計画。低リスクテンプレート変更を先行し、高リスクcascade-reapprove(FIX-3)を最後に3段階分割で実装する。

## decisions

- PL-D01: 実装順序はリスク昇順(Low→High)を採用する。FIX-1/FIX-4(テンプレート文言)→FIX-2(テンプレート文言)→FIX-5(read-only分析)→FIX-3(状態変更)の順で進め、各段階で回帰リスクを最小化する。根拠: TM-001〜TM-004がFIX-3に集中しており、先行ステップの安定性を確保した上でFIX-3に着手する必要がある。
- PL-D02: FIX-1はPL-01(スケルトン)→PL-02(テンプレート指示)→PL-03(SUMMARY_SECTION)の3ステップに分割する。PL-01でTOON_SKELETON_HEARINGの:section intent-analysis内にuserResponseキーを追加し、PL-02でdefs-stage0.tsのsubagentTemplateにAskUserQuestion必須指示を追加し、PL-03でSUMMARY_SECTIONフラグメントを{ARTIFACT_QUALITY}の直前に配置する。根拠: TM-007の干渉リスクを回避するため、各変更の配置位置を分離して段階的に適用する。
- PL-D03: FIX-3はPL-07(スキーマ追加)→PL-08(approval削除)→PL-09(cascadeロジック)の3段階で実装する。PL-07でdefs-a.tsにcascadeオプショナルパラメータを追加(後方互換維持)、PL-08でgoBack後のstate.approvals対象フェーズ削除を実装、PL-09でscope-nav.tsにcascade-reapproveロジックを実装する。根拠: TM-002(approval削除範囲限定)とTM-005(後方互換性)を段階的に検証できる構造にする。
- PL-D04: cascade-reapproveはapproval.tsのhandleHarnessApprove関数を経由して再承認を実行し、独自の承認ロジックを実装しない。前提条件(IA-1/IA-2/IA-6)未達時はcascade処理を即時中断してユーザーに手動対応を通知する。根拠: TM-001(承認バイパス防止)とTM-003(連鎖失敗ブロック防止)への直接対策。
- PL-D05: FIX-5のcompletedフェーズ滞留検出(PL-06)は既存のgenerateAdvice関数のパターンに従い、COMPLETED_STALE_THRESHOLD_SEC=3600を定数定義してphaseTimingsを走査する。Number.isFinite()による不正値検証を実施する。根拠: TM-006(不正値による誤警告防止)への対策で、既存ADVICE_RULESと同一パターンにより保守性を維持する。
- PL-D06: PL-04(FIX-4)はdefinitions-shared.tsのSUMMARY_SECTION_RULE内のTOON形式ガイダンスを強化する。JSON形式禁止・Markdownヘッダー禁止の文言を維持しつつ、TOON配列記法のフィールド順序ルールを明示する。根拠: hearingテンプレート以外のフェーズでもTOON出力形式の逸脱が発生しているため、共通ガイダンスの精度を高める。
- PL-D07: cascade=false(デフォルト)時のコードパス分離を厳密に行う。handleHarnessBack関数の冒頭でcascade値をBoolean正規化(undefined→false)し、cascade===trueの場合のみcascade処理ブロックに分岐する。根拠: TM-005(後方互換性破壊防止)への直接対策であり、REQ-010の要件を満たすための設計判断。

## steps

PL-01: FIX-1a — TOON_SKELETON_HEARINGにuserResponseキー追加
- file: mcp-server/src/phases/toon-skeletons-a.ts
- change: :section intent-analysis内の:assumptions行の後に`:userResponse [AskUserQuestionの回答全文]`行を追加
- dependsOn: none(初回ステップ、他ステップへの依存なし)
- ac: AC-1
- risk: Low — テンプレート文言追加のみ、既存ロジック変更なし

PL-02: FIX-1b — hearingテンプレートにAskUserQuestion必須指示追加
- file: mcp-server/src/phases/defs-stage0.ts
- change: subagentTemplate内のステップ2にAskUserQuestion呼び出し必須の明示指示と選択肢2個以上の要求文言を追加
- dependsOn: PL-01(スケルトンにuserResponseキーが存在する前提で指示を記述する必要がある)
- ac: AC-2
- risk: Low — テンプレート指示文言の追加のみ

PL-03: FIX-1c — hearingテンプレートにSUMMARY_SECTION追加
- file: mcp-server/src/phases/defs-stage0.ts
- change: subagentTemplate末尾の{ARTIFACT_QUALITY}の直前に{SUMMARY_SECTION}プレースホルダを挿入
- dependsOn: PL-02(同一ファイルへの変更のため、PL-02完了後に適用してコンフリクトを回避する)
- ac: AC-7
- risk: Low — フラグメント配置位置がTM-007で検証済み、intent-analysisセクションと重複しない

PL-04: FIX-4 — definitions-shared.tsのテンプレート出力形式ガイダンス強化
- file: mcp-server/src/phases/definitions-shared.ts
- change: SUMMARY_SECTION_RULE定数内のTOON形式ガイダンスにフィールド順序ルール(phase→status→summary→配列→decisions→artifacts→next)を明記
- dependsOn: PL-03(SUMMARY_SECTIONがhearingテンプレートに追加された後にガイダンス内容を最終確定する)
- ac: 直接対応ACなし(FIX-1と同系統の品質改善)
- risk: Low — ガイダンス文言のみの変更

PL-05: FIX-2 — testingテンプレートにbaseline_captureリマインド追加
- file: mcp-server/src/phases/defs-stage5.ts
- change: testingフェーズのsubagentTemplate冒頭(タスク情報セクション直後)にbaseline_capture必須ステップの強調リマインド文を追加
- dependsOn: PL-04(テンプレートガイダンス強化完了後に適用し、出力形式の一貫性を確保する)
- ac: AC-3
- risk: Low — リマインド文言追加のみ、処理フロー変更なし

PL-06: FIX-5 — phase-analytics.tsにcompleted滞留検出追加
- file: mcp-server/src/tools/phase-analytics.ts
- change: generateAdvice関数内のtimingsブロック(145行目付近)にcompleted(current===false)かつ経過時間3600s超のフェーズへの警告ルールを追加。COMPLETED_STALE_THRESHOLD_SEC定数を119行目付近に定義。Number.isFinite()による不正値スキップを含む。
- dependsOn: PL-05(テンプレート系変更が全て完了した後にロジック変更に着手する)
- ac: AC-8
- risk: Low — read-only分析ロジックの追加、state変更なし

PL-07: FIX-3a — harness_backスキーマにcascadeパラメータ追加
- file: mcp-server/src/tools/defs-a.ts
- change: harness_backのinputSchema.propertiesにcascade: { type: 'boolean', description: 'Cascade re-approval for affected gates.' }を追加。required配列に含めない(オプショナル)。
- dependsOn: PL-06(低リスク変更が全て完了した状態でFIX-3に着手する)
- ac: AC-4, AC-10
- risk: Medium — MCPスキーマ変更だが、オプショナルパラメータのため後方互換維持

PL-08: FIX-3b — goBack後のapproval削除処理追加
- file: mcp-server/src/state/manager-lifecycle.ts および mcp-server/src/tools/handlers/scope-nav.ts
- change: scope-nav.tsのhandleHarnessBack関数内でgoBack成功後にstate.approvalsからtargetPhase以降のフェーズのapprovalエントリを削除する。PHASE_APPROVAL_GATESマップを参照して削除対象を特定し、completedPhasesから除外されたフェーズのみを走査する。
- dependsOn: PL-07(cascadeパラメータがスキーマに存在する前提で、cascade未指定時のapproval削除動作を実装する)
- ac: AC-9
- risk: High — state.approvals変更。TM-002(削除範囲限定)に従い、対象範囲外のapprovalを保護する

PL-09: FIX-3c — cascade-reapproveロジック実装
- file: mcp-server/src/tools/handlers/scope-nav.ts
- change: handleHarnessBack関数末尾にcascade===true時の再承認ループを追加。PHASE_APPROVAL_GATESを走査し、goBack対象範囲の承認ゲートを持つフェーズを特定。各フェーズについてapproval.tsのhandleHarnessApprove関数を経由して再承認を実行。前提条件(IA-1/IA-2/IA-6)未達時は即時中断しユーザーに手動対応通知を返却する。
- dependsOn: PL-08(approval削除が完了し、クリーンな承認状態が確保された上でcascade再承認を実行する必要がある)
- ac: AC-5, AC-6
- risk: High — 4ファイル横断の状態変更。TM-001(バイパス禁止)、TM-003(連鎖失敗中断)、TM-004(completedPhases非操作)を全て遵守する

## artifacts

- docs/workflows/harness-template-reliability/planning.md: FIX-1〜FIX-5の9ステップ実装計画。依存関係チェーン、リスク評価、脅威モデル対策マッピングを含む。

## next

- criticalDecisions: PL-D03(FIX-3の3段階分割がcascade安全性の核心), PL-D04(approval.ts経由の再承認がバイパス防止の保証), PL-D07(cascade=false時のコードパス分離が後方互換性の保証)
- readFiles: mcp-server/src/tools/handlers/scope-nav.ts, mcp-server/src/tools/handlers/approval.ts, mcp-server/src/state/manager-lifecycle.ts, mcp-server/src/tools/defs-a.ts, mcp-server/src/phases/toon-skeletons-a.ts, mcp-server/src/phases/defs-stage0.ts, mcp-server/src/phases/defs-stage5.ts, mcp-server/src/tools/phase-analytics.ts, mcp-server/src/phases/definitions-shared.ts
- warnings: PL-07〜PL-09(FIX-3)は最高リスク。PL-08のapproval削除範囲はPHASE_APPROVAL_GATESに存在するフェーズかつcompletedPhasesから除外済みのフェーズに限定すること。PL-09のcascade-reapproveはhandleHarnessApprove関数を直接呼び出し、独自承認ロジックを絶対に実装しないこと。
