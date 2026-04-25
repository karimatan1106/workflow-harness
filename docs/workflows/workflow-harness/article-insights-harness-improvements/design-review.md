# Design Review (Rev.2): article-insights-harness-improvements

## overview

5改善項目(P3-P7)の設計成果物を対象にRev.2レビューを実施。前回レビュー(Rev.1)でDR-001〜DR-005の5指摘を検出し、P7(重複行除外フィルタ)のAC-21〜AC-23/RTM F-009をrequirements.mdに追加済み、planning.mdにW3割当を追加済み。本レビューでは解消確認と残存問題・新規発見を検証する。

## rev1-resolution-status

| ID | Rev.1指摘 | 状態 | 根拠 |
|----|----------|------|------|
| DR-001 | P7のAC欠落 | RESOLVED | requirements.md L177-209にP7セクション追加。AC-21〜AC-23定義済み |
| DR-002 | P7のplanning不在 | RESOLVED | planning.md W3(L99-151)にP3+P7統合。files/steps/constraintsを記載 |
| DR-003 | flowchart.mmdのP7参照不整合 | OPEN | flowchart.mmdのWorker割当が依然としてplanning.mdと不一致(後述DR-005) |
| DR-004 | types-core.ts行数の成果物間不一致 | OPEN(軽微) | requirements.md L265にtypes-core.ts 171行、planning.md L17に198行。未修正 |
| DR-005 | flowchart.mmdのWorker割当不一致 | OPEN | flowchart.mmdのW1-W5割当がplanning.md/state-machine.mmdと不一致(後述) |

## review-results

| # | チェック項目 | 結果 | 指摘数 |
|---|------------|------|--------|
| R-1 | AC-1〜AC-23の設計カバレッジ | PASS(注意1件) | 1 |
| R-2 | P7のrequirements/planning反映 | PASS | 0 |
| R-3 | 200行制限リスクファイルへの対策 | PASS | 0 |
| R-4 | state-machine.mmdとplanning.mdの整合性 | PARTIAL | 1 |
| R-5 | flowchart.mmdとplanning.mdの整合性 | FAIL | 1 |
| R-6 | ui-design.mdのP7カバレッジ | PASS(注意1件) | 1 |

## R-1: AC-1〜AC-23の設計カバレッジ

### 結果: PASS(注意1件)

全23個のACがrequirements.mdに定義されている。planning.mdのWorker ac-coverageと照合する。

| AC範囲 | 対象 | requirements.md | planning.md Worker | ui-design.md |
|--------|------|----------------|-------------------|-------------|
| AC-1〜5 | P3 | 定義済 | W3 ac-coverage記載 | P3 evidence形式 |
| AC-6〜10 | P4 | 定義済 | W4 ac-coverage記載 | P4 evidence形式 |
| AC-11〜15 | P5 | 定義済 | W5 ac-coverage記載 | P5 pivotSuggestion形式 |
| AC-16〜20 | P6 | 定義済 | W1+W2 ac-coverage記載 | P6 evidence/fix形式 |
| AC-21〜23 | P7 | 定義済 | W3(実装)だがac-coverage欄に未記載 | P7セクション記載 |

### 指摘 DR-006: W3のac-coverageにAC-21〜AC-23が未記載(軽微)

planning.md L151のW3 ac-coverageは"AC-1, AC-2, AC-3, AC-4, AC-5"のみ。W3のtask(L103)とsteps(L123-128)にはP7が含まれているが、ac-coverageにAC-21〜AC-23が反映されていない。実装時にW3がAC-21〜23を検証対象として認識できないリスクがある。

対応: planning.md W3のac-coverage行をAC-1〜AC-5, AC-21, AC-22, AC-23に更新する。

## R-2: P7のrequirements/planning反映

### 結果: PASS

DR-001/DR-002は解消済み。

- requirements.md: P7セクション(L177-209)にAC-21〜AC-23定義、変更ファイル表、制約を記載
- requirements.md: acceptanceCriteriaサマリ表(L236-238)にAC-21〜23を追加済み
- requirements.md: RTM表(L299)にF-009を追加済み
- planning.md: W3(L99-151)にP3+P7統合。isStructuralLine関数、テスト追加を記載
- planning.md: overview(L5)に"P7(重複行除外フィルタ)はW3に同居"を記載
- planning.md: dependency-graph(L257)にW3(P3+P7)を記載

## R-3: 200行制限リスクファイルへの対策

### 結果: PASS

前回指摘DR-004(types-core.ts行数不一致)は軽微であり設計判断に影響しない。planning.mdのfile-capacity-baseline(L8-19)が実測値として信頼できる。P7追加によるdod-helpers.tsの行数影響はW3のconstraints(L144)で"123行+45行=168行: OK"と評価済み。

| ファイル | planning記載 | P7追加影響 | 対策 | 評価 |
|---------|-------------|-----------|------|------|
| types-core.ts | 198行→199行 | P7影響なし | 1行厳守(PL-1) | OK |
| lifecycle-next.ts | 198行→200行 | P7影響なし | buildPivotResponse集約(PL-3) | OK |
| retry.ts | 198行→198行 | P7影響なし | メッセージ変更のみ(PL-2) | OK |
| dod-helpers.ts | 123行→168行 | P3+P7合算で+45行 | 余裕32行(W3 constraints) | OK |

## R-4: state-machine.mmdとplanning.mdの整合性

### 結果: PARTIAL

Worker番号と実行順序はplanning.mdと一致しているが、W3の記述にP7が反映されていない。

| フェーズ | state-machine.mmd | planning.md | 一致 |
|---------|-------------------|-------------|------|
| Phase-A | W1(P6-source) + W3(P3-ai-slop) 並列 | W1(P6-source) + W3(P3+P7) 並列 | 部分不一致 |
| Phase-B | W2(P6-test) + W4(P4-code-fence) 並列 | W2(P6-test) + W4(P4-code-fence) 並列 | 一致 |
| Phase-C | W5(P5-pivot) 単独 | W5(P5-pivot) 単独 | 一致 |

### 指摘 DR-007: state-machine.mmdのW3にP7が未反映(中)

state-machine.mmd L5のW3は"P3-ai-slop"のみ記載。planning.mdではW3がP3+P7を担当する。W3_Out(L8)もcheckAiSlopPatternsのみでisStructuralLineが未記載。

対応: state-machine.mmd W3の記述にP7(isStructuralLine)を追加し、W3_Outに反映する。

## R-5: flowchart.mmdとplanning.mdの整合性

### 結果: FAIL(DR-005未解消)

flowchart.mmdのWorker割当がplanning.md/state-machine.mmdと大幅に異なったまま。

| 項目 | planning.md(正) | flowchart.mmd(不一致) |
|------|-----------------|---------------------|
| W1 | P6-source | P3(AI slop分析) |
| W2 | P6-test | P3+P5(AI slop実装+pivot) |
| W3 | P3+P7(AI slop+重複行除外) | P4(code fence) |
| W4 | P4(code fence) | P6+P7(AC数+フィルタ) |
| W5 | P5(pivot) | 全体検証 |
| Phase-A | W1+W3並列(実装) | W1+W3並列(設計) |
| Phase-B | W2+W4並列(実装) | W2+W4並列(実装) |
| Phase-C | W5単独(実装) | W5単独(検証) |

flowchart.mmdはrequirements/planning策定前のドラフト版のまま更新されていない。planning.md(ユーザー承認済み)を正としてflowchart.mmdの再生成が必要。

## R-6: ui-design.mdのP7カバレッジ

### 結果: PASS(注意1件)

ui-design.md L191-227にP7セクション(重複行チェック除外パターン表示)が記載されている。isStructuralLineの除外パターン8種、デバッグ出力形式、テスト検証形式が定義されている。

### 指摘 DR-008: ui-design.md ac-traceにP7のAC-21〜AC-23が未記載(軽微)

ui-design.md L257-268のac-traceテーブルにP7(AC-21〜AC-23)のエントリがない。P7セクション(L191-227)は存在するためui-design.mdの設計カバレッジ自体は確保されているが、トレーサビリティテーブルに欠落がある。

対応: ui-design.md ac-traceテーブルにP7エントリ(AC-21〜AC-23→P7 isStructuralLine)を追加する。

## acDesignMapping

| AC | 対象 | planning.md Worker | planning.md設計要素 | ui-design.md出力形式 |
|----|------|-------------------|-------------------|-------------------|
| AC-1 | P3 | W3 | checkAiSlopPatterns関数(4カテゴリ正規表現) | P3カテゴリ名スネークケース表示 |
| AC-2 | P3 | W3 | non-block-pattern(passed=true維持) | [WARN] AI slop detected: {category} ({count} occurrences) |
| AC-3 | P3 | W3 | dod-l4-content.ts duplicatesチェック後に統合 | evidence改行連結 |
| AC-4 | P3 | W3 | extractNonCodeLines経由(コードブロック除外) | コードブロック内非検出 |
| AC-5 | P3 | W3 | dod-extended.test.ts(4カテゴリ検出/非検出/閾値) | テスト検証形式 |
| AC-6 | P4 | W4 | types-core.ts PhaseConfig noCodeFences?: boolean | 型定義のみ(出力なし) |
| AC-7 | P4 | W4 | defs-stage2.ts planning定義 noCodeFences: true | 設定のみ(出力なし) |
| AC-8 | P4 | W4 | dod-l4-content.ts CODE_FENCE_REGEX検出 | [WARN] Code fence detected in planning artifact: {file} (line {n}) |
| AC-9 | P4 | W4 | .mmdファイル除外ロジック | 除外時は出力なし |
| AC-10 | P4 | W4 | 新規テストファイル(検出/非検出/.mmd除外) | テスト検証形式 |
| AC-11 | P5 | W5 | pivot-advisor.ts新規(detectRepeatedPattern+generatePivotSuggestion) | pivotSuggestionフィールド |
| AC-12 | P5 | W5 | phase-errors.toon読取+パターン比較 | {isRepeated, consecutiveCount, pattern} |
| AC-13 | P5 | W5 | errorClass別提案テンプレート(6分類) | 方向転換提案文字列 |
| AC-14 | P5 | W5 | lifecycle-next.ts buildDoDFailureResponse統合(2行追加) | レスポンスオブジェクトのpivotSuggestionフィールド |
| AC-15 | P5 | W5 | pivot-advisor.test.ts(3回連続/不一致/閾値未満) | テスト検証形式 |
| AC-16 | P6 | W1 | dod-l4-requirements.ts MIN_ACCEPTANCE_CRITERIA=5定数定義 | 定数定義(出力なし) |
| AC-17 | P6 | W1 | approval.ts MIN_ACCEPTANCE_CRITERIAインポート | AC count ({n}) below minimum 5メッセージ |
| AC-18 | P6 | W1+W2 | ソース7箇所+ガイダンス6箇所更新 | AC count {n} is below minimum 5 / Add at least {n} more... |
| AC-19 | P6 | W2 | 4テストファイル13箇所のacCount/アサーション更新 | テスト検証形式 |
| AC-20 | P6 | W1 | grep残存チェック("minimum 3"/"最低3件"ゼロ確認) | 残存チェック(出力なし) |
| AC-21 | P7 | W3 | isStructuralLine: コードフェンス行除外 | テストでisStructuralLine直接検証 |
| AC-22 | P7 | W3 | isStructuralLine: Mermaid構文行除外 | テストでisStructuralLine直接検証 |
| AC-23 | P7 | W3 | isStructuralLine: テーブル区切り行除外 | テストでisStructuralLine直接検証 |

## summary

### 解消済み(Rev.1→Rev.2)

| ID | 指摘 | 解消方法 |
|----|------|---------|
| DR-001 | P7のAC欠落 | requirements.mdにAC-21〜AC-23/F-009追加 |
| DR-002 | P7のplanning不在 | planning.md W3にP3+P7統合 |

### 残存指摘(重大: 実装前に解決必須)

| ID | 指摘 | 影響 | 推奨対応 |
|----|------|------|---------|
| DR-005 | flowchart.mmdのWorker割当不一致 | 実装時の混乱リスク | planning.md準拠で再生成 |

### 残存・新規指摘(中: 実装前に解決推奨)

| ID | 指摘 | 影響 | 推奨対応 |
|----|------|------|---------|
| DR-007 | state-machine.mmdのW3にP7未反映 | Worker実行時のスコープ認識漏れ | W3記述にP7を追加 |

### 残存・新規指摘(軽微: 実装時に注意)

| ID | 指摘 | 影響 | 推奨対応 |
|----|------|------|---------|
| DR-004 | types-core.ts行数の成果物間不一致 | 設計判断への影響なし | 実装時にwc -lで再確認 |
| DR-006 | W3 ac-coverageにAC-21〜23未記載 | Worker検証スコープの認識漏れ | ac-coverage行を更新 |
| DR-008 | ui-design.md ac-traceにP7未記載 | トレーサビリティ欠落 | ac-traceテーブルに追加 |

### 総合判定

DR-001/DR-002(P7のrequirements/planning不在)は解消済み。AC-1〜AC-23の設計カバレッジは確保され、200行制限対策も適切。

残存する主要問題はflowchart.mmd(DR-005)とstate-machine.mmd(DR-007)のP7反映。flowchart.mmdはplanning.md策定前のドラフト版のまま未更新であり、Worker割当が完全に異なる。state-machine.mmdはWorker番号と順序は正しいがW3の記述にP7が欠落している。

軽微指摘(DR-006/DR-008)はac-coverageとac-traceのテーブル更新で解消可能。DR-004は実装時のwc -l確認で対応する。

推奨: (1) flowchart.mmdをplanning.md準拠で再生成、(2) state-machine.mmdのW3にP7追加、(3) planning.md W3 ac-coverageにAC-21〜23追加、(4) ui-design.md ac-traceにP7追加、(5) 上記解決後に実装フェーズへ進行。

## decisions

- [DR-D1][finding] DR-001/DR-002は解消済み。P7がrequirements.md/planning.mdに正しく定義されている
- [DR-D2][finding] DR-005(flowchart.mmd Worker割当不一致)は未解消。planning.md準拠での再生成が必要
- [DR-D3][finding] DR-007(新規): state-machine.mmdのW3にP7が未反映
- [DR-D4][finding] DR-006(新規): planning.md W3 ac-coverageにAC-21〜23が欠落
- [DR-D5][finding] DR-008(新規): ui-design.md ac-traceにP7(AC-21〜23)が欠落
- [DR-D6][recommendation] flowchart.mmd再生成+state-machine.mmd W3更新+ac-coverage/ac-trace修正後に実装着手

## artifacts

- docs/workflows/article-insights-harness-improvements/design-review.md: 本設計レビュー文書(Rev.2)

## next

readyForImplementation: true
prerequisiteActions: "DR-005(flowchart.mmd再生成), DR-007(state-machine.mmd W3にP7追加), DR-006(W3 ac-coverage更新), DR-008(ui-design.md ac-trace更新)"
firstWorkers: "W1(P6-source) + W3(P3+P7) を並列起動"
criticalChecks: "types-core.ts 199行, lifecycle-next.ts 200行の行数検証を各Worker完了時に実施"
