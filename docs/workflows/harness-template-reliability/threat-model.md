# Threat Model: harness-template-reliability

phase: threat_modeling
task: harness-template-reliability
taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff

## STRIDE Analysis Summary

FIX-1(hearingテンプレートuserResponse追加), FIX-2(baseline_captureリマインド), FIX-4(TOON/MD出力形式統一)はテンプレート文言変更のみで攻撃面が限定的。FIX-5(completedフェーズ滞留検出)はread-only分析ロジック追加で状態変更を伴わない。FIX-3(cascade-reapprove)は4ファイル横断の状態変更を伴い、承認バイパス・無限ループ・状態破壊のリスクが集中する。

## decisions

- TM-001: Spoofing — cascade-reapproveが承認ゲートを再実行する際、approval.tsのIA-1/IA-2/IA-6前提条件チェックを経由しないパスが存在すると、未承認状態のフェーズが承認済みとしてマークされる。対策: cascade処理はapproval.tsのhandleHarnessApprove関数を直接呼び出し、独自の承認ロジックを実装しない。REQ-009が明示的にバイパス禁止を定義しており、scope-nav.ts内でapproval.ts関数を経由する実装を必須とする。
- TM-002: Tampering — goBack実行後のstate.approvals削除(REQ-006)で、対象範囲外のフェーズの承認エントリまで誤削除されると、正常に承認済みのフェーズが未承認に戻り再作業が発生する。対策: 削除対象はgoBackの戻り先フェーズより後のフェーズに限定し、PHASE_APPROVAL_GATESマップに存在するフェーズのみを走査する。削除前に対象フェーズリストをログ出力し、削除後にstate.approvals残存数を検証する。
- TM-003: Denial of Service — cascade=true時にgoBack対象範囲が広い場合(例: implementationからhearingまで戻る)、再承認対象フェーズ数が多くなり、各フェーズの前提条件チェックが連鎖的に失敗して処理が長時間ブロックされる。対策: cascade処理で前提条件未達のフェーズに到達した時点で残りのcascadeを中断し、ユーザーに手動対応を通知する。再承認は先頭フェーズから順に実行し、途中失敗時のリカバリポイントを明確にする。
- TM-004: Elevation of Privilege — cascade-reapproveが再承認ループ中にstate.completedPhasesを変更すると、本来到達していないフェーズがcompleted扱いになり後続のフェーズ進行条件を不正に満たす。対策: cascade処理はstate.completedPhasesを直接操作しない。approvals削除のみを行い、フェーズのcompletedステータス変更はlifecycle-next.tsの通常フロー(DoDゲート通過後)に委ねる。
- TM-005: Tampering — harness_backスキーマにcascadeパラメータを追加する際、既存のcascade未指定時の動作が変化すると後方互換性が破壊される。対策: cascadeパラメータはオプショナル(required配列に含めない)かつデフォルトfalseとする。handleHarnessBack関数の冒頭でcascade値を正規化(undefined→false)し、cascade===false時は従来のgoBack処理のみを実行してcascade関連コードパスに一切入らない。
- TM-006: Information Disclosure — phase-analytics.tsのcompletedフェーズ滞留検出(FIX-5)が経過時間を計算する際、state.phaseTimingsの値が不正(負値やNaN)であれば誤った警告が大量出力され、正常な警告が埋もれる。対策: 経過時間計算前にphaseTimingsの値をNumber.isFinite()で検証し、不正値のフェーズはスキップする。3600s閾値は定数として定義し、将来の調整を容易にする。
- TM-007: Tampering — hearingテンプレートへのuserResponseキー追加(FIX-1)とSUMMARY_SECTION追加(REQ-007)が同一ファイル(defs-stage0.ts)に適用される。両変更が干渉してテンプレート構造が壊れると、hearing-workerの出力がdod-l2-hearingの正規表現チェックを通過しなくなる。対策: userResponseキーは:section intent-analysis内に配置し、SUMMARY_SECTIONはARTIFACT_QUALITYの直前に配置する。両変更の配置位置が重複しないことをコードレビューで確認する。

## risk-matrix

| FIX | 影響範囲 | 状態変更 | リスクレベル | 根拠 |
|-----|---------|---------|-------------|------|
| FIX-1 | toon-skeletons-a.ts, defs-stage0.ts | なし(テンプレート文言のみ) | Low | 出力形式の追加で既存ロジックに影響しない |
| FIX-2 | defs-stage5.ts | なし(テンプレート文言のみ) | Low | リマインド文言追加で処理フローに変更なし |
| FIX-3 | defs-a.ts, scope-nav.ts, manager-lifecycle.ts, approval.ts | あり(state.approvals削除、再承認実行) | High | 4ファイル横断、承認状態変更、前提条件チェーン依存 |
| FIX-4 | defs-stage0.ts | なし(テンプレート文言のみ) | Low | ガイダンス強化で出力形式に影響しない |
| FIX-5 | phase-analytics.ts | なし(read-only分析) | Low | 既存adviceルール群と同一パターンの追加 |

## artifacts

- docs/workflows/harness-template-reliability/threat-model.md: STRIDE分析に基づく脅威モデル。TM-001〜TM-007の7脅威を特定し、FIX-3集中リスクの対策を定義。

## next

- criticalDecisions: TM-001(承認バイパス防止がcascade-reapprove安全性の核心), TM-002(approval削除範囲の厳密な限定), TM-004(completedPhases直接操作禁止)
- readFiles: src/tools/handlers/scope-nav.ts, src/tools/handlers/approval.ts, src/state/manager-lifecycle.ts, src/tools/defs-a.ts
- implementationOrder: FIX-1/FIX-4(defs-stage0.ts文言変更) → FIX-2(defs-stage5.ts文言変更) → FIX-5(phase-analytics.ts分析ロジック) → FIX-3(defs-a.tsスキーマ → manager-lifecycle.ts approval削除 → scope-nav.ts cascadeロジック)の順で低リスクから実装し、FIX-3は3段階に分割する
