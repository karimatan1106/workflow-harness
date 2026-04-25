# Test Selection

## background
test-design.mdで定義した12件のテストケースから、今回のimplementationサイクルで実行する範囲を選定する。

## selectionStrategy
- unit: 全件実装（AC-2/AC-4 対応、計6件）
- integration: 手動チェックリスト化（AC-1/AC-3/AC-5 対応、計6件）
- performance: TC-AC2-04 のみ計測対象

## includedTests
- TC-AC1-01 (integration, manual): harness_start 後にhearing.md Write成功
- TC-AC1-02 (unit): bootstrap不在で getActivePhaseFromWorkflowState が active phase を返す
- TC-AC2-01 (unit): readToonPhase が phase値を返す
- TC-AC2-02 (unit): phase行無しで undefined
- TC-AC2-03 (unit): 不正バイナリで undefined
- TC-AC2-04 (performance): 64KB超過で1ms以内
- TC-AC3-01 (integration, manual): printenv STATE_DIR が絶対パス
- TC-AC3-02 (integration, manual): 二重ネストディレクトリが新規作成されない
- TC-AC4-01 (unit, regression): JSON読み取り継続動作
- TC-AC4-02 (unit): JSON/TOON共存でJSON優先
- TC-AC5-01 (integration, manual): ADR-029ファイル存在
- TC-AC5-02 (integration, manual): ADR-029に必須5セクション含有

## excludedTests
なし（全件included）

## decisions
- D-001: 全12件を今回サイクルに含める
- D-002: unit系6件はhook-utils.test.jsに追記する
- D-003: integration系6件はmanual-test.mdに手動チェックリストとして集約
- D-004: performance系TC-AC2-04は統合テスト扱いで、実測値をmanual-test.mdに記録する
- D-005: regression対象はTC-AC4-01として明示し、既存JSON経路の回帰を防止する
- D-006: 本選定ではexcludeなし。次回サイクル以降で負荷試験など追加する可能性はある

## artifacts
- 本ドキュメント test-selection.md
- 次フェーズ test_implementation への入力

## next
- test_implementation フェーズへ進み unit系6件をコード化する
- まず失敗（Red）させ harness_record_test_result(exitCode=1) で証跡を残す
- 次に実装してGreen化する

## constraints
- 外部依存追加なし
- 既存テストフレームワーク踏襲
- L1-L4決定的ゲートのみ
