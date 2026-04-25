# Manual Test Plan: harness-detailed-error-analytics

taskId: harness-detailed-error-analytics
phase: manual_test
date: 2026-03-25

## purpose

CLIハーネスで意図的にDoD失敗を発生させ、errorAnalytics詳細化の実装が正しく動作することを手動で検証する。
自動テスト(vitest)でカバーした単体ロジックを、実際のハーネス実行環境で統合的に確認する。

## scenarios

### MT-1: phase-errors.toon全フィールド記録

goal: DoD失敗時にphase-errors.toonへ全checkフィールドが記録されること
steps:
1. 新規テストタスクを harness_start で開始する
2. hearing フェーズで意図的にDoD不足の成果物を作成する(例: decisionsセクション未記載)
3. harness_next でフェーズ遷移を試み、DoD失敗を発生させる
4. phase-errors.toon を開き、失敗エントリのchecks配列を確認する
expected:
- 各check要素に name, passed, message, level, fix, example の6フィールドが存在する
- name がDoD項目名と一致する(例: "decisions-section")
- passed=false のcheckに message, fix, example が空文字列でないこと
- level が "error" または "warning" であること
verdict: PASS / FAIL (phase-errors.toonの全フィールド記録を目視確認)

### MT-2: phase-analytics.toon errorHistory出力

goal: タスク完了後のphase-analytics.toonにerrorHistory配列が出力されること
steps:
1. MT-1で使用したタスク、または別のタスクをDoD失敗を含めて最終フェーズまで進める
2. acceptance_verification完了後にphase-analytics.toonを確認する
expected:
- errorHistory配列が存在し、要素数が1以上であること
- 各要素に phase, attempt, timestamp, failedChecks, totalChecks フィールドが存在すること
- failedChecks の値が phase-errors.toon の該当フェーズ失敗数と一致すること
verdict: PASS / FAIL (errorHistory配列の展開出力を目視確認)

### MT-3: topFailure既存出力の非破壊確認

goal: errorAnalysis.topFailureが従来どおり出力されていること
steps:
1. MT-2と同じphase-analytics.toonを使用する
2. errorAnalysis セクションの topFailure フィールドを確認する
expected:
- topFailure フィールドが存在し、最頻失敗フェーズ名が記録されていること
- totalRetries フィールドが存在し、数値であること
- 従来出力されていた failureRate フィールドも保持されていること
verdict: PASS / FAIL (topFailure出力の維持を目視確認)

### MT-4: passedフィルタの正確性

goal: passed=true のchecksがfailureカウントに含まれないこと
steps:
1. phase-errors.toon から任意のフェーズエントリを選択する
2. checks配列内の passed=true と passed=false の件数を手動で数える
3. phase-analytics.toon の該当フェーズの failedChecks と比較する
expected:
- failedChecks が passed=false の件数と一致すること
- totalChecks が checks配列の全要素数と一致すること
- passed=true のcheckが failedChecks に計上されていないこと
verdict: PASS / FAIL (passed=trueがカウント除外されていることを目視確認)

## decisions

- MT-D1: 手動テストはCLIハーネスの実タスク実行で検証する。モック環境では検出できない統合問題を確認するため
- MT-D2: phase-errors.toonの目視確認でフィールド欠落を検出する。自動テストではTOON出力形式の完全性を保証できないため
- MT-D3: 既存topFailure出力の維持を専用シナリオ(MT-3)で確認する。既存出力の非破壊はAC要件外だが運用上必須のため
- MT-D4: passedフィルタの効果はfailureカウントの数値比較で確認する。passed=trueのcheck名がカウントに含まれないことを検証
- MT-D5: 手動テスト結果は本ドキュメントに記録し追跡可能とする。再現手順を含めることで将来の回帰確認にも使用可能

## artifacts

- phase-errors.toon: MT-1, MT-4 の検証対象ファイル(DoD失敗チェック詳細)
- phase-analytics.toon: MT-2, MT-3, MT-4 の検証対象ファイル(エラー分析集計)
- acceptance-report.md: 自動テスト結果(vitest 7/7 PASS, regression 755/783 PASS)の参照元
- test-design.md: 自動テストケース定義(TC-AC1-01 ~ TC-AC4-02, TC-NFR1-01)の参照元

## next

- 次回ハーネス実行時にMT-1を実施し、phase-errors.toonの出力を目視確認する
- 既存の完了タスク(harness-observability-logging)のphase-analytics.toonでMT-2, MT-3を先行確認可能
- MT-4は phase-errors.toon のデータ量に依存するため、複数回DoD失敗が発生したタスクで実施する
- 全MTがPASSした場合、本タスクの手動検証は完了とする
