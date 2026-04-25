# Threat Model: harness-detailed-error-analytics

phase: threat_modeling
task: harness-detailed-error-analytics
status: complete
inputArtifact: docs/workflows/harness-detailed-error-analytics/requirements.md

## context

内部ツール(ワークフローハーネス)のerrorAnalytics詳細化。外部入力なし、ネットワーク通信なし、認証不要。脅威は主にデータ整合性とリソース効率に限定される。攻撃者モデルは不要(内部開発ツールのため)。

## strideAnalysis

strideAnalysis5{id,category,threat,likelihood,impact,mitigation}:
  TM-01, D, "phase-errors.toonの肥大化: 全checks記録により30フェーズx30checksx5リトライで最大4500エントリ", 中, 低, "1エントリ100byte想定で最大450KB。実運用上のファイルI/Oに影響なし。サイズ上限制御はスコープ外と要件で判断済み"
  TM-02, T, "後方互換性破壊: DoDFailureEntry型変更で既存phase-errors.toonのtoonDecodeSafeパース失敗", 低, 高, "FR-4でoptionalフィールド追加のみ。toonDecodeSafeは未知フィールドを無視する設計。既存データの読み込みに影響なし"
  TM-03, I, "lifecycle-next.ts 200行超過: checks mapping追加で行数制約(NFR-1)違反", 高, 中, "FR-1のchecks mapping関数をerror-toon.tsまたは別ユーティリティにトップレベル分離。changeImpactで+3行=202行と予測済みのためリファクタ必須"
  TM-04, D, "analytics生成のパフォーマンス低下: 大量errorHistory展開による生成時間増加", 低, 低, "タスク完了時1回のみ実行。4500エントリでもJSONシリアライズ1秒未満。バッチ処理不要"
  TM-05, T, "errorHistory配列とtopFailureの不整合: errorHistoryのfailureカウントとtopFailureの集計値が異なるケース", 中, 中, "FR-2のpassed=falseフィルタとFR-3のerrorHistory展開が同一データソース(phase-errors.toon)を参照するため整合性は構造的に保証。buildErrorAnalysis()の単一責務で集計ロジック統一"

## securityRequirements

securityRequirements2{id,requirement,priority}:
  SR-1, "DoDFailureEntry型の新フィールドはすべてoptionalとし後方互換性を維持する", must
  SR-2, "errorHistory配列はAnalyticsResultのoptionalフィールドとし既存topFailure出力を破壊しない", must

## decisions

- TM-D1: 外部脅威分析はスコープ外とする。内部開発ツールでありネットワーク露出なし。攻撃者モデルの定義は不要
- TM-D2: 型変更はoptionalフィールド追加のみ許可する。toonDecodeSafeの未知フィールド無視特性を活用し後方互換性を構造的に保証(TM-02緩和)
- TM-D3: lifecycle-next.tsのリファクタをFR-1実装時に必須とする。changeImpactで202行予測。200行制約はcore-constraints.mdで強制されておりTM-03は確実に発生する
- TM-D4: errorHistoryのサイズ上限制御は導入しない。要件のnotInScopeで明示。最大450KBは実運用上問題なし(TM-01分析結果)
- TM-D5: topFailureとerrorHistoryを並列出力とし既存出力を維持する。既存のgenerateAdvice()やfindBottlenecks()がtopFailureを参照。破壊するとダウンストリーム影響が発生(TM-05緩和)
- TM-D6: passed=falseフィルタ追加によるfailureカウント減少は正しい方向の変化として許容する。現状のバグ(passed=trueもカウント)の修正であり数値減少は意図された改善
- TM-D7: analytics生成のパフォーマンス最適化は不要と判断する。タスク完了時1回実行のバッチ処理であり4500エントリでも1秒未満(TM-04分析結果)

## riskMatrix

| threat | likelihood | impact | severity | status |
|--------|-----------|--------|----------|--------|
| TM-01 file size | 中 | 低 | low | accepted |
| TM-02 backward compat | 低 | 高 | medium | mitigated by FR-4 optional fields |
| TM-03 200-line limit | 高 | 中 | high | mitigated by function extraction |
| TM-04 performance | 低 | 低 | negligible | accepted |
| TM-05 data inconsistency | 中 | 中 | moderate | mitigated by single data source |

## artifacts

artifacts2{path,role,summary}:
  docs/workflows/harness-detailed-error-analytics/threat-model.md, report, "errorAnalytics詳細化の脅威モデル。5脅威のSTRIDE分析と7判断"
  docs/workflows/harness-detailed-error-analytics/requirements.md, spec, "入力: 機能要件4件とAC4件の要件定義"

## next

criticalDecisions: "TM-03(200行超過)は設計フェーズでchecks mapping関数の外部化先を確定する必要あり。TM-D2のoptionalフィールド戦略が型設計の制約条件"
readFiles: "docs/workflows/harness-detailed-error-analytics/requirements.md, docs/workflows/harness-detailed-error-analytics/threat-model.md"
warnings: "lifecycle-next.tsは現時点で199行。FR-1実装時に必ずリファクタが必要(TM-03)"
