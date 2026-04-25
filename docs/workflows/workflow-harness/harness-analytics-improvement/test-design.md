# Test Design: harness-analytics-improvement

phase: test_design
task: harness-analytics-improvement
date: 2026-03-26

## summary

phase-analytics改善の4機能(topFailureソート、IQR外れ値検出、tdd_red_evidence advice、エラー3分類)に対するユニットテスト設計。既存phase-analytics.test.ts(147行)への追加と、新規2テストファイル(outlier-detection.test.ts, error-classification.test.ts)の作成で構成する。全テストはvitest上で実行し、各ACに対して正常系・異常系・境界値を網羅する。

## testStrategy

- フレームワーク: vitest (既存テスト基盤を踏襲)
- テスト種別: ユニットテスト中心。各関数の入出力を独立検証する
- モック方針: readErrorToon, getTaskMetrics, fs は既存モックパターンを継続使用。新規モジュール(outlier-detection.ts, error-classification.ts)は純粋関数のためモック不要
- テストデータ: インラインファクトリ関数で生成。外部ファイル依存なし
- カバレッジ目標: AC-1からAC-5の全受入基準を1つ以上のテストケースでカバー

## testCases

### AC-1: topFailure count降順ソート (phase-analytics.test.ts)

#### TC-AC1-01: failures配列がcount降順でソートされている

- 対象関数: buildAnalytics() -> errorAnalysis.failures
- 入力: readErrorToonが3種のチェック失敗を返す(check_a: 2回, check_b: 5回, check_c: 1回)
- 期待: failures[0].check === 'check_b'(5回), failures[1].check === 'check_a'(2回), failures[2].check === 'check_c'(1回)
- RTM: F-001 topFailure集計のcount降順ソートが最頻失敗チェックを先頭に配置することを検証

#### TC-AC1-02: 同count時にL2+チェックがL1より上位

- 対象関数: buildAnalytics() -> errorAnalysis.failures
- 入力: readErrorToonがL1チェック(output_file_exists, count:3)とL3チェック(section_structure, count:3)を返す
- 期待: failures配列でL3チェック(section_structure)がL1チェック(output_file_exists)より前方に配置される
- RTM: F-001 同一count時のlevel重み付けによりL2+チェックがL1より優先表示されることを検証

#### TC-AC1-03: 空のerrorEntries入力で空の結果

- 対象関数: buildAnalytics()
- 入力: readErrorToonが空配列を返す
- 期待: errorAnalysis配列が空、failures配列へのアクセスでエラーが発生しない
- RTM: F-001 データなし時の安全なフォールバック動作を検証

### AC-2: IQR外れ値検出 (outlier-detection.test.ts)

#### TC-AC2-01: IQR法で異常値をoutlier検出

- 対象関数: detectOutliers() - IQR計算ロジック
- 入力: timings = { phase_0: 30s, phase_1: 35s, phase_2: 28s, phase_3: 32s, phase_4: 180s }(phase_4がセッション中断相当)
- 期待: 戻り値にphase_4がisOutlier=trueで含まれ、iqrScoreが正値を持つ。phase_0-3はoutlier結果に含まれない
- RTM: F-002 Q3+1.5*IQR超過の異常値がoutlierフラグを受けることを検証

#### TC-AC2-02: データ点4未満でスキップ

- 対象関数: detectOutliers() - データ点不足ガード
- 入力: timings = { phase_0: 30s, phase_1: 35s, phase_2: 28s }(3データ点)
- 期待: 空配列を返却。例外やエラーが発生しない
- RTM: F-002 統計的に四分位数計算に不十分なデータ点数でのガード動作を検証(TM-D3)

#### TC-AC2-03: 全値が同じ場合でもエラーなし

- 対象関数: detectOutliers() - IQR=0エッジケース
- 入力: timings = { phase_0: 30s, phase_1: 30s, phase_2: 30s, phase_3: 30s, phase_4: 30s }(IQR=0)
- 期待: 空配列を返却(IQR=0のためupperFence=Q3、全値が等しいため外れ値なし)。ゼロ除算エラーなし
- RTM: F-002 IQR=0の縮退ケースでiqrScore計算が安全に処理されることを検証

### AC-3: tdd_red_evidence advice生成 (phase-analytics.test.ts)

#### TC-AC3-01: tdd_red_evidence 3回以上失敗でadvice生成

- 対象関数: buildAnalytics() -> advice
- 入力: readErrorToonが3フェーズでtdd_red_evidence失敗エントリを返す(test_design, tdd_red, test_impl各1回)
- 期待: advice配列にtdd_red_evidenceパターンマッチによる「テスト設計の見直しを推奨」メッセージが含まれる
- RTM: F-003 ADVICE_RULESのtdd_red_evidenceパターンが失敗頻度に基づき発火することを検証

#### TC-AC3-02: tdd_red_evidence 2回以下では該当advice非生成

- 対象関数: buildAnalytics() -> advice
- 入力: readErrorToonが2フェーズでtdd_red_evidence失敗エントリを返す
- 期待: advice配列にtdd_red_evidence関連のメッセージが含まれない
- RTM: F-003 低頻度失敗ではadviceが過剰生成されないことを検証(ノイズ抑制)

### AC-4: エラー3分類 (error-classification.test.ts)

#### TC-AC4-01: 同一チェックが3フェーズ以上で失敗 -> recurring分類

- 対象関数: classifyErrors() - recurring判定(出現フェーズ数閾値)
- 入力: entries = [{phase:'p1', checks:[{name:'chk_x', passed:false}]}, {phase:'p5', checks:[{name:'chk_x', passed:false}]}, {phase:'p9', checks:[{name:'chk_x', passed:false}]}]
- 期待: result.recurringに'chk_x'が含まれる。result.oneOffに'chk_x'が含まれない
- RTM: F-004 同一チェック名の出現フェーズ数が閾値(3)以上でrecurring判定されることを検証

#### TC-AC4-02: 連続フェーズで異なるチェック失敗 -> cascading分類

- 対象関数: classifyErrors() - cascading判定(連続フェーズ検出)
- 入力: entries = [{phase:'phase_7', checks:[{name:'chk_y', passed:false}]}, {phase:'phase_8', checks:[{name:'chk_y', passed:false}]}]
- 期待: result.cascadingに['chk_y', '7', '8']相当の配列が含まれる
- RTM: F-004 末尾数字パターンによるフェーズ番号抽出と連続性判定がcascading分類を生成することを検証(TM-D6)

#### TC-AC4-03: 1回のみの失敗 -> one-off分類

- 対象関数: classifyErrors() - one-off判定(単発失敗フォールバック)
- 入力: entries = [{phase:'phase_3', checks:[{name:'chk_z', passed:false}]}](1フェーズのみの単発失敗)
- 期待: result.oneOffに'chk_z'が含まれる。recurringとcascadingには含まれない
- RTM: F-004 recurring/cascadingいずれにも該当しない失敗がone-offに分類されることを検証

#### TC-AC4-04: 空入力で空の分類結果

- 対象関数: classifyErrors() - 空入力の安全性
- 入力: entries = [](空配列)
- 期待: result = { recurring: [], cascading: [], oneOff: [] }
- RTM: F-004 エラーデータなし時に安全な空オブジェクトが返却されることを検証

### AC-5: 全ファイル200行以下 (静的検証)

#### TC-AC5-01: 各ファイルの行数確認

- 検証方法: wc -l で対象ファイルの行数を計測
- 対象ファイル: phase-analytics.ts(目標170行), analytics-toon.ts(目標90行), outlier-detection.ts(目標70行), error-classification.ts(目標70行)
- 期待: 全ファイルが200行以下
- RTM: F-006 ファイル分割による200行制約維持を物理的に検証

## acTestMapping

| AC | テストケース | テストファイル | 検証観点 |
|----|-------------|---------------|----------|
| AC-1 | TC-AC1-01, TC-AC1-02, TC-AC1-03 | phase-analytics.test.ts | count降順ソート、level重み付け、空入力 |
| AC-2 | TC-AC2-01, TC-AC2-02, TC-AC2-03 | outlier-detection.test.ts | IQR外れ値検出、最小データ点ガード、IQR=0 |
| AC-3 | TC-AC3-01, TC-AC3-02 | phase-analytics.test.ts | advice生成の発火条件と非発火条件 |
| AC-4 | TC-AC4-01, TC-AC4-02, TC-AC4-03, TC-AC4-04 | error-classification.test.ts | recurring/cascading/one-off/空入力 |
| AC-5 | TC-AC5-01 | 静的検証(wc -l) | 全対象ファイル200行以下 |

## testData

- phase-analytics.test.ts: 既存のmakeTask()ファクトリとreadErrorToonモックを拡張。failures配列検証用に複数チェック・複数フェーズのエントリを生成する
- outlier-detection.test.ts: Record<string, {seconds: number}>形式のtimingsオブジェクトをインラインで構築。正常分布(30-35s範囲)に1つの異常値(180s)を混入するパターンが基本形
- error-classification.test.ts: FailureInput[]形式のエントリをインラインで構築。phase名に末尾数字(phase_1, phase_2等)を含むパターンで連続性を表現

## edgeCases

| ケース | 対応TC | 挙動 |
|--------|--------|------|
| errorEntries空配列 | TC-AC1-03 | 空のerrorAnalysis返却、例外なし |
| timingsデータ点3以下 | TC-AC2-02 | detectOutliersが空配列返却 |
| 全timingsが同値(IQR=0) | TC-AC2-03 | iqrScore=0、外れ値なし、ゼロ除算なし |
| classifyErrors空入力 | TC-AC4-04 | 3カテゴリ全て空配列 |
| phase名に数字なし(cascading判定) | TC-AC4-03間接 | cascading候補から除外、one-offに分類 |
| 同一checkが正確に3フェーズ(recurring閾値境界) | TC-AC4-01 | recurring判定に含まれる(>=3) |

## acTcMapping

| AC | TC | テスト内容 |
|----|----|----|
| AC-1 | TC-AC1-01 | failures配列がcount降順ソート |
| AC-1 | TC-AC1-02 | 同count時L2+優先 |
| AC-1 | TC-AC1-03 | 空入力で空結果 |
| AC-2 | TC-AC2-01 | IQR法で外れ値検出 |
| AC-2 | TC-AC2-02 | データ点4未満でスキップ |
| AC-2 | TC-AC2-03 | IQR=0エッジケース |
| AC-3 | TC-AC3-01 | tdd_red_evidence 3回以上でadvice生成 |
| AC-3 | TC-AC3-02 | 2回以下でadvice非生成 |
| AC-4 | TC-AC4-01 | 同一チェック3フェーズ以上で recurring |
| AC-4 | TC-AC4-02 | 連続フェーズ異チェックで cascading |
| AC-4 | TC-AC4-03 | 1回のみで one-off |
| AC-4 | TC-AC4-04 | 空入力で空分類 |
| AC-5 | TC-AC5-01 | 全ファイル200行以下(wc -l静的検証) |

## decisions

- TD-D1: 新規テストファイル(outlier-detection.test.ts, error-classification.test.ts)はモック不要の純粋関数テストとする。外部依存がないためテスト実行速度と保守性が向上する
- TD-D2: TC-AC1-01からTC-AC1-03は既存phase-analytics.test.tsのdescribeブロックに追加する。buildAnalyticsの統合テストとして既存モックインフラを再利用し、テストファイルの分散を防ぐ
- TD-D3: TC-AC3-01のadvice発火条件は「tdd_red_evidenceパターンに3回以上マッチ」とする。ADVICE_RULESのpatternマッチがcount閾値と連動する設計に対応した検証条件
- TD-D4: TC-AC2-01のテストデータは正常範囲(28-35s)に180sの外れ値を1つ混入する構成とする。実際のセッション中断(数分放置)を模擬し、IQR法の検出力を実証する
- TD-D5: TC-AC4-02のcascading検証ではphase名に'phase_7','phase_8'の連番を使用する。末尾数字パターン(\d+$)の抽出と連続性判定の両方を1テストで検証できる
- TD-D6: TC-AC5-01は自動テスト(vitest)ではなくDoD静的検証(wc -l)で実施する。行数制約はコード品質メトリクスでありランタイムテストの対象ではない

## artifacts

| path | role |
|------|------|
| docs/workflows/harness-analytics-improvement/test-design.md | output: 本テスト設計書 |
| docs/workflows/harness-analytics-improvement/planning.md | input: 詳細設計・Worker分解 |
| docs/workflows/harness-analytics-improvement/requirements.md | input: 機能要件・AC定義 |
| workflow-harness/mcp-server/src/__tests__/phase-analytics.test.ts | reference: 既存テスト(147行) |

## next

criticalPath: "Worker-1(新規モジュール) -> Worker-2(テスト実装: outlier-detection.test.ts + error-classification.test.ts) + Worker-3(phase-analytics.ts改修) -> Worker-4(phase-analytics.test.ts追加テスト)"
testFiles: "phase-analytics.test.ts(既存+追加), outlier-detection.test.ts(新規), error-classification.test.ts(新規)"
warnings: "phase-analytics.test.tsは147行から200行への追加となるため、TC-AC1-01/02/03とTC-AC3-01/02の5ケース追加で行数上限に注意"
