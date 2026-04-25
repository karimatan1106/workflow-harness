# Design Review: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
phase: design_review
date: 2026-03-25

## summary

全7件のAC、7件のFR、4件のNFRが設計成果物(requirements, planning, threat-model, ui-design, state-machine, flowchart)で網羅されている。アーティファクト間の整合性は良好であり、重大な矛盾やギャップは検出されなかった。

## decisions

- DR-D01: AC-1~AC-7の全件がFR-1~FR-7に1:1で対応し、planning/ui-designの両方で設計要素が確認された。カバレッジは100%
- DR-D02: requirements(7AC)とplanning(4Worker構成)の間でFR→Worker対応が正確に一致する。Worker-1=FR-6,FR-7、Worker-2=FR-1、Worker-3=FR-3,FR-4、Worker-4=FR-2,FR-5
- DR-D03: threat-modelの8脅威(T-1~T-8)がui-designのerrorHandlingセクションおよびflowchartのガード条件(T-1パス検証, T-2サイズ上限)に反映済み
- DR-D04: ui-designのUID-D07(tool-matrix.ts)はrequirementsのFR/ACに対応するFRが存在しない。planningのWorker構成にも含まれていない。specフェーズで対応範囲を明確化する必要がある
- DR-D05: NFR-1(200行制限)はplanningのPL-D03~PL-D05で具体的な行数削減策が示されている。lifecycle-next.ts(178行)とdelegate-coordinator.ts(174行)への計装は各1行追加で200行以内に収まる設計
- DR-D06: NFR-2(MINGW互換)はrequirementsのFR-1(date +%s)、planningのPL-D06、threat-modelのT-5(echo限定)で三重に保証される
- DR-D07: NFR-3(並行追記整合性)はthreat-modelのT-3で残存リスクMとして明示的に許容判定が記録されている。append-only設計で実運用上の問題は低確率
- DR-D08: NFR-4(TOONパーサー互換)はui-designのtoonSchemaセクションで具体的なフォーマット定義が確定し、threat-modelのT-8で行順序ベースのパース戦略が裏付けられている
- DR-D09: state-machine.mmdの6状態遷移(Idle→Initialized→Recording→PhaseComplete→Finalized, SizeExceeded分岐)がflowchartの処理フローと矛盾なく対応する

## coverageMatrix

| AC | FR | planning Worker | ui-design | threat-model | flowchart | state-machine |
|----|-----|-----------------|-----------|--------------|-----------|---------------|
| AC-1 | FR-1 | Worker-2 | bashInterface | T-5 | Hook系統 | Recording |
| AC-2 | FR-2 | Worker-4 | typescriptAPI | T-4 | MCP系統(delegate) | Recording |
| AC-3 | FR-3 | Worker-3 | typescriptAPI | -- | MCP系統(lifecycle) | PhaseComplete |
| AC-4 | FR-4 | Worker-3 | UID-D05 | T-6 | MCP系統(DoD分岐) | Recording(retry) |
| AC-5 | FR-5 | Worker-4 | typescriptAPI | T-4 | MCP系統(delegate) | Recording |
| AC-6 | FR-6 | Worker-1 | toonSchema | T-1,T-8 | Writer系統 | Initialized |
| AC-7 | FR-7 | Worker-1 | -- | T-5 | Hook系統(echo) | -- |

## consistencyCheck

- requirements.mdのTraceEntry 7フィールドとui-design.mdのTraceEntry型定義は完全一致(timestamp, axis, layer, event, detail, durationMs, sizeBytes)
- planningのWorker-1が新規作成する3ファイル(trace-types.ts, trace-writer.ts, trace-logger.sh)はui-designのtypescriptAPI/bashInterfaceセクションで仕様が定義済み
- threat-modelのT-2(10MB上限)緩和策はui-designのerrorHandling(TRACE_SIZE_EXCEEDED)、flowchartのガード条件(10MB分岐)、state-machine(SizeExceeded状態)の全てに反映されている
- requirements.mdのbash側タイムスタンプ(date +%s エポック秒)とui-designのtoonSchema(bash側エポック秒、パース時ISO変換)は一致
- planningのPL-D07(observability-events.toonをDoD対象から除外)とthreat-modelのT-6緩和策は同一の方針

## gaps

- GAP-1: ui-designのUID-D07(tool-matrix.ts)が正解マトリクスとの差分検出機能を示唆するが、requirementsのFR/ACに対応する受入基準が存在しない。specフェーズでスコープ内外を確定すること
- GAP-2: requirementsにAC-8は定義されていない(AC-1~AC-7の7件)。上位指示でAC-8が言及された場合、AC-7のパフォーマンス制約がNFR-4とは別のACとして分離される可能性を確認すること
- GAP-3: flowchartのH8(stderr警告)→W1(appendTrace)への矢印は、bash側で10MB超過時にstderr警告後にさらにWriter基盤へ遷移する表記になっている。bash側はecho >>を直接使用するためWriter基盤(appendTrace)は経由しない。flowchartの修正を推奨

## acDesignMapping

- AC-1: trace-logger.sh(bash関数インタフェース) + pre-tool-guard.sh(4判定ブロックの呼び出し追加) — ALLOW/BLOCKの両方を記録
- AC-2: trace-writer.ts(appendTrace API) + delegate-coordinator.ts(spawn-start/complete/fail記録) — subagent_type/durationMs記録
- AC-3: lifecycle-next.ts(phase-enter/phase-exit記録) + lifecycle-start-status.ts(initTraceFile) — recordPhaseEnd()のdurationMs流用
- AC-4: trace-writer.ts(recordDoDResults()ヘルパー) + lifecycle-next.ts(DoD結果ループ) — PASS/FAIL/evidence/retryCount記録
- AC-5: delegate-coordinator.ts(fullInstruction.length/stdout.length) — context-size軸としてsizeBytes記録
- AC-6: trace-writer.ts(initTraceFile + appendTrace) + trace-types.ts(TOON配列形式スキーマ) — docsDir内にobservability-events.toon出力
- AC-7: trace-logger.sh(echo >>限定) + trace-writer.ts(appendFileSync) — ファイルロック/read-modify-write不使用で50ms未満保証

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/requirements.md | requirements | 7AC, 7FR, 4NFR定義 |
| docs/workflows/harness-observability-logging/planning.md | planning | 4Worker実装計画、リスク緩和策 |
| docs/workflows/harness-observability-logging/threat-model.md | threat_modeling | 8脅威(T-1~T-8)分析、残存リスク評価 |
| docs/workflows/harness-observability-logging/ui-design.md | ui_design | TOONスキーマ、bash/TS APIインタフェース |
| docs/workflows/harness-observability-logging/state-machine.mmd | state_machine | 6状態遷移図(Idle~Finalized) |
| docs/workflows/harness-observability-logging/flowchart.mmd | flowchart | 4系統処理フロー(Init/Hook/MCP/Writer) |
| docs/workflows/harness-observability-logging/design-review.md | design_review | 本ファイル: 設計レビュー結果 |

## next

- specフェーズでGAP-1(tool-matrix.tsのスコープ)を確定する
- specフェーズでGAP-3(flowchartのbash→Writer遷移)を修正する
- trace-types.ts、trace-writer.ts、trace-logger.shの詳細API仕様をspecで確定する
