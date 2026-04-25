# Scope Definition: article-insights-harness-improvements

## サマリー

Anthropic記事知見に基づく4改善(P1-P4)のスコープを定義する。対象はworkflow-harnessサブモジュール内のスキルファイル(3件)とMCPサーバーソースコード(4件)。全改善はL1-L4決定的ゲートの枠内で実装し、ADR-001(L5禁止)を遵守する。

## entry-points

| ID | ファイル | 行数 | 関連改善 | 変更種別 |
|----|---------|------|---------|---------|
| EP-1 | .claude/skills/workflow-harness/workflow-rules.md | 113 | P1, P3 | ルール追加・アノテーション付与 |
| EP-2 | .claude/skills/workflow-harness/workflow-gates.md | 63 | P3 | DoDゲートにAI slopパターン追加 |
| EP-3 | .claude/skills/workflow-harness/workflow-phases.md | 79 | P2, P4 | planning制約追加、code_review記述更新 |
| EP-4 | workflow-harness/mcp-server/src/phases/registry.ts | 99 | P2, P4 | code_review設定変更、planningのdodChecks追加 |
| EP-5 | workflow-harness/mcp-server/src/tools/delegate-coordinator.ts | 198 | P2 | code_reviewのコンテキスト分離ロジック |
| EP-6 | workflow-harness/mcp-server/src/tools/handler-shared.ts | 116 | P2 | PHASE_APPROVAL_GATES参照(読み取り専用) |
| EP-7 | workflow-harness/mcp-server/src/gates/dod-common.ts | - | P3, P4 | AI slopパターンL4チェック追加、planningコード例検出追加 |

## scope-per-item

### P1: assumptionタグ導入

- 対象ファイル: EP-1 (workflow-rules.md)
- 変更内容: 23ルール・22禁止アクション各項目に `assumption:` タグを付与。棚卸しチェックリストセクションを追加
- 推定差分: 30-40行追加
- 依存: なし(独立実装可能)
- リスク: 低。スキルファイルのみの変更。既存ゲートロジックへの影響なし

### P2: code_review独立分離

- 対象ファイル: EP-3 (workflow-phases.md), EP-4 (registry.ts), EP-5 (delegate-coordinator.ts)
- 変更内容: code_reviewフェーズのdelegate_coordinator呼び出し時に生成時中間状態(planning.md以外のinputFiles)を除外。fresh contextで評価を実行する設定変更
- 推定差分: 20-30行変更
- 依存: EP-5は198行で200行境界値。変更時に責務分割が必要になる可能性あり
- リスク: 中。delegate-coordinator.tsの構造変更。既存30フェーズの整合性維持が必要

### P3: AI slopパターン検出

- 対象ファイル: EP-1 (workflow-rules.md), EP-2 (workflow-gates.md), EP-7 (dod-common.ts)
- 変更内容: L4正規表現パターンとしてAI slopパターン(5-8個)を定義。既存の禁止語12種・重複行検出の拡張として実装
- 推定差分: 25-35行追加
- 依存: 既存のL4パターンマッチング基盤(dod-common.ts)を利用
- リスク: 中。偽陽性リスクがあるため初期は警告のみ推奨

### P4: planningフェーズのコード例排除

- 対象ファイル: EP-3 (workflow-phases.md), EP-4 (registry.ts), EP-7 (dod-common.ts)
- 変更内容: planningフェーズ出力にコードフェンス(```)が含まれる場合をL4ゲートで検出・警告するルール追加
- 推定差分: 15-20行追加
- 依存: ADR-004(Why/What/How分離)の具体的適用
- リスク: 低。新規L4チェック追加のみ

## dependency-graph

```
P1 (assumption tags) ── 独立
P2 (code_review分離) ── EP-5がP3と無関係(別ファイル領域)
P3 (AI slop検出) ── EP-7をP4と共有(dod-common.ts)。P3先行でP4が同ファイルに追加
P4 (planning制約) ── P3と同一ファイル(EP-7)に追加。実装順序: P3→P4
```

## risk-score

| 項目 | スコア | 根拠 |
|------|--------|------|
| ファイル数 | 7 | スキルファイル3 + TypeScript4 |
| 200行境界値 | 1件 | delegate-coordinator.ts(198行) |
| 並列グループ影響 | parallel_quality | code_review + build_check が同グループ |
| ゲート変更 | 2件 | dod-common.ts(P3+P4)、registry.ts(P2+P4) |
| 全体リスク | Medium | P2の構造変更がリスク主因。P1/P3/P4は低リスク |

## out-of-scope

- delegate-coordinator.tsの全面リファクタリング(200行超過時の責務分割は別タスク)
- AI slopパターンのL5(LLM判断)による検出(ADR-001違反)
- code_reviewの完全な別プロセス化(既存delegate_coordinator機構内での分離に限定)
- 既存テストの大規模修正(新規L4チェック用のテスト追加のみ)
- workflow-orchestrator.mdの変更(今回のスコープ外)

## related-design-docs

- docs/adr/ADR-001.md: L5(LLM判断)ゲート禁止の根拠
- docs/adr/ADR-003.md: 3層→2層簡素化の前例(P1の棚卸し方針の根拠)
- docs/adr/ADR-004.md: Why/What/How 3層分離(P4の根拠)

## decisions

- [SD-1][decision] スコープファイル7件、推定差分90-125行。Medium規模タスクとして実行
- [SD-2][decision] P1/P3/P4はスキルファイル+ゲートロジック変更が主。P2のみTypeScript構造変更を含む
- [SD-3][constraint] delegate-coordinator.ts(198行)は200行境界値。P2実装時に行数超過する場合は責務分割を実施
- [SD-4][constraint] AI slopパターン(P3)はL4正規表現のみ。L5判断は使用しない(ADR-001)
- [SD-5][risk] P3の偽陽性リスク。初期パターンは保守的に設計し、コードフェンス内は検出対象外とする
- [SD-6][dependency] EP-7(dod-common.ts)をP3とP4が共有。P3を先行実装しP4が追加する順序で競合回避
- [SD-7][finding] handler-shared.ts(EP-6)はP2で読み取り参照のみ。PHASE_APPROVAL_GATES定義の変更は不要

## artifacts

- docs/workflows/article-insights-harness-improvements/scope-definition.md: 本スコープ定義

## next

readyForResearch: true
focusAreas: "P2のdelegate-coordinator.ts内code_reviewハンドリングの詳細調査、dod-common.tsの既存L4チェック構造の把握、AI slopパターン候補の選定"
warnings: "delegate-coordinator.ts(198行)は200行境界値。P2の変更量次第で責務分割タスクが発生する可能性あり"
