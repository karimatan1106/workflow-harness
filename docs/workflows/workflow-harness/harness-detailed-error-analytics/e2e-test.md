# E2E Test Plan: harness-detailed-error-analytics

phase: e2e_test
date: 2026-03-25

## summary

errorAnalytics詳細化のエンドツーエンドデータフロー検証計画。DoDCheckResultからphase-analytics.toonのerrorHistory出力までの5段階処理チェーンが、単体テスト(vitest 7件)と手動テスト(MT-1~MT-4)の組み合わせで統合的にカバーされていることを確認する。

## dataFlowChain

入力: DoDCheckResult(level, check, passed, evidence, fix?, example?)がlifecycle-next.tsに渡される

処理チェーン:
1. mapChecksForErrorToon()(error-toon.ts)で全フィールドをDoDFailureEntry.checks形式に変換する
2. appendErrorToon()(error-toon.ts)でphase-errors.toonにcheck配列を記録する
3. タスク完了時にbuildErrorAnalysis()(phase-analytics.ts)でpassedフィルタ適用とlevel実値を使用して集計する
4. buildErrorHistory()(phase-analytics.ts、非export)で全entry全checksをフラット展開する
5. writeAnalyticsToon()(analytics-toon.ts)でphase-analytics.toonにtopFailureとerrorHistory配列を出力する

出力: phase-analytics.toonにerrorAnalysis(topFailure + errorHistory配列)が記録される

## e2eVerificationMatrix

### E2E-1: 入力から中間ファイルへの記録(ステップ1-2)

- 自動テスト: TC-AC1-01(全フィールドマッピング), TC-AC1-02(optionalフィールド後方互換)
- 手動テスト: MT-1(phase-errors.toon全フィールド記録)
- 検証ポイント: DoDCheckResultの6フィールドがphase-errors.toonのchecks配列に欠落なく記録される
- AC対応: AC-1

### E2E-2: 中間ファイルから集計処理(ステップ3-4)

- 自動テスト: TC-AC3-01(passedフィルタ), TC-AC3-02(level実値使用), TC-AC2-01(errorHistory全展開)
- 手動テスト: MT-4(passedフィルタの正確性)
- 検証ポイント: passed=trueがfailureカウントから除外され、levelが実値で集計される
- AC対応: AC-2, AC-3

### E2E-3: 集計結果から最終出力(ステップ5)

- 自動テスト: TC-AC2-02(errorHistory出力生成), TC-AC2-03(空配列安全動作)
- 手動テスト: MT-2(errorHistory配列出力), MT-3(topFailure非破壊確認)
- 検証ポイント: errorHistory配列がphase-analytics.toonに正しく展開出力され、既存topFailureも維持される
- AC対応: AC-2

### E2E-4: 非機能制約の維持(横断)

- 自動テスト: TC-AC4-01(lifecycle-next.ts行数制約)
- 手動テスト: なし(ゲートチェックで自動検出)
- 検証ポイント: lifecycle-next.tsが200行以下を維持し、全変更ファイルが行数上限内に収まる
- AC対応: AC-4

## coverageAnalysis

### AC別カバレッジ

| AC | 自動テスト | 手動テスト | E2Eステップ | カバレッジ |
|----|-----------|-----------|------------|-----------|
| AC-1 | TC-AC1-01, TC-AC1-02 | MT-1 | E2E-1 | 入力変換+記録の全経路 |
| AC-2 | TC-AC2-01, TC-AC2-02, TC-AC2-03 | MT-2, MT-3 | E2E-2, E2E-3 | 集計+展開+出力の全経路 |
| AC-3 | TC-AC3-01, TC-AC3-02 | MT-4 | E2E-2 | フィルタ+level精度 |
| AC-4 | TC-AC4-01 | - | E2E-4 | 行数制約ゲート |

### RTM別カバレッジ

| RTM | 自動テスト | 手動テスト |
|-----|-----------|-----------|
| F-001 | TC-AC1-01, TC-AC4-01 | MT-1 |
| F-002 | TC-AC3-01, TC-AC3-02 | MT-4 |
| F-003 | TC-AC2-01, TC-AC2-02, TC-AC2-03 | MT-2 |
| F-004 | TC-AC1-02 | MT-1 |

### 検証方法の補完関係

- 自動テスト(vitest): 関数単位の入出力正確性を検証。モック環境でファイルI/Oを分離し、ロジックの正しさを保証する
- 手動テスト(MT-1~MT-4): 実CLIハーネス環境での統合動作を検証。TOON形式の実出力とフィールド完全性を目視確認する
- ゲートチェック(TC-AC4-01): 行数制約をwc -lで機械的に検証。実装後の静的チェックとして位置付ける

## decisions

- E2E-D1: E2Eテストは自動テスト7件+手動テスト4件の組み合わせで構成する。専用のE2Eテストスクリプトは作成しない。自動テストで関数間の入出力を検証し、手動テストで実環境の統合動作を補完するため
- E2E-D2: データフローの5段階を3つのE2E検証区間(E2E-1~E2E-3)に分割する。入力→記録、記録→集計、集計→出力の境界をテストケースで網羅するため
- E2E-D3: buildErrorHistory()は非exportのためbuildAnalytics()経由で間接検証する。TC-AC2-01がこの間接検証を担当し、errorHistory配列の要素数と構造で正しさを確認する
- E2E-D4: 既存topFailure出力の非破壊はMT-3で手動検証する。AC要件外だが運用上の後方互換性を保証するために検証対象に含める
- E2E-D5: 空配列安全動作(TC-AC2-03)をE2E-3に含める。errorHistoryがundefinedの場合に空配列へフォールバックする動作は、既存タスクの分析処理で発生する実運用シナリオのため
- E2E-D6: カバレッジ分析はAC別とRTM別の2軸で整理する。AC観点でユーザー要件の充足を、RTM観点で要件追跡の完全性をそれぞれ確認するため

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-detailed-error-analytics/e2e-test.md | e2e_test | 本ファイル: E2Eデータフロー検証計画 |
| docs/workflows/harness-detailed-error-analytics/test-design.md | input | 自動テストケース定義(TC-AC1-01~TC-AC4-01、8件) |
| docs/workflows/harness-detailed-error-analytics/manual-test.md | input | 手動テストシナリオ定義(MT-1~MT-4、4件) |
| docs/workflows/harness-detailed-error-analytics/requirements.md | input | AC-1~AC-4定義、RTM F-001~F-004 |

## next

- 自動テスト結果(vitest 7/7 PASS)とリグレッション結果(755/783 PASS)はacceptance-report.mdに記録済み
- 手動テスト(MT-1~MT-4)は次回ハーネス実行時に実施する
- 全E2E検証区間(E2E-1~E2E-3)のカバレッジが確認されたら、acceptance_verificationフェーズに進む
- TC-AC4-01(行数制約)は実装完了時点で検証済み(lifecycle-next.ts: 198行)
