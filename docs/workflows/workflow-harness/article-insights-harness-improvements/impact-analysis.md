# Impact Analysis: article-insights-harness-improvements

## サマリー

4改善項目(P3-P6)の影響分析を実施。全項目がworkflow-harnessサブモジュール内に閉じた変更であり、親リポジトリへの影響はない。P3/P4は既存L4チェック基盤の拡張、P5は新規ファイル分離、P6はリテラル定数化+19箇所の一括更新。

## P3: AI slopパターン検出

### 影響範囲

| ファイル | 行数 | 変更種別 | 影響度 |
|---------|------|---------|--------|
| dod-helpers.ts | 124/200 | 関数追加(+20-30行) | 低 |
| dod-l4-content.ts | 87/200 | 呼び出し追加(+3行) | 低 |
| dod-extended.test.ts | - | テスト追加 | 低 |

### 分析結果

- helpers_remaining_capacity: 76行。checkAiSlopPatterns(推定20-30行)を追加しても154行以下で収容可能
- existing_l4_checks: checkForbiddenPatterns, checkBracketPlaceholders, checkDuplicateLines, checkRequiredToonKeys。全て純粋関数で共有可変状態なし
- blocking_behavior: 現在の全L4チェックはブロッキング(passed=false)。警告のみ(非ブロック)にするにはpassed=trueを返しつつevidenceに[WARN]プレフィックスで記載する設計が必要。errors配列には追加しない
- interference_risk: なし。extractNonCodeLines共通基盤を利用し、既存チェックと同じパイプライン構造。実行順序に依存関係なし
- integration_point: dod-l4-content.ts L61付近(duplicatesチェック後、TOONキーチェック前)

### 判定

- [IA-P3-1][finding] 非ブロック動作には既存パターンと異なる設計が必要。passed=true + [WARN] evidenceパターンを採用
- [IA-P3-2][risk:low] 偽陽性時もブロックしないため、既存ワークフローへの悪影響なし
- [IA-P3-3][constraint] extractNonCodeLines経由でコードブロック内は自動除外済み

## P4: planningフェーズのコード例排除

### 影響範囲

| ファイル | 行数 | 変更種別 | 影響度 |
|---------|------|---------|--------|
| types-core.ts | 171 | noCodeFences?: boolean追加(+1行) | 低 |
| defs-stage2.ts | - | planning定義にnoCodeFences: true追加(+1行) | 低 |
| registry.ts | 99/200 | 変更なし(defs経由で自動反映) | なし |
| dod-l4-content.ts | 87/200 | フラグ駆動のコードフェンス検出追加(+10行) | 低 |
| workflow-phases.md | 79/200 | planningセクションに制約記述追加(+3行) | 低 |

### 分析結果

- phase_config_type_location: workflow-harness/mcp-server/src/state/types-core.ts L154-L171
- planning_dod_checks_current: 空配列。カスタムDoDチェックなし
- l4_content_phase_branching: フェーズ別分岐は未実装。全フェーズ共通処理のみ
- nocodefences_impact: optionalフラグのため他フェーズはデフォルトundefined(チェック無効)。破壊的変更なし
- user_experience_impact: planningでコードフェンスを使用した場合にDoD警告が出る。インラインコード(シングルバックティック)は検出対象外

### 判定

- [IA-P4-1][finding] C案(noCodeFencesフラグ汎用化)は5ファイル変更、全て追加的変更で破壊的変更なし
- [IA-P4-2][risk:medium] Mermaidダイアグラム(```mermaid)もコードフェンスとして検出される。planningで状態遷移図を記述するケースで偽陽性の可能性あり
- [IA-P4-3][decision] Mermaid対応: allowedExtensions に .mmd が含まれるため、Mermaidは別ファイル(.mmd)に分離する運用で回避可能。コードフェンス検出から除外ロジックは不要
- [IA-P4-4][constraint] dodChecksが空配列からの変更ではなく、PhaseConfigフラグ経由でdod-l4-content.tsの共通処理に組込む設計。dodChecks配列は引き続き空のまま

## P5: retry pivot(同一パターン失敗時の方向転換)

### 影響範囲

| ファイル | 行数 | 変更種別 | 影響度 |
|---------|------|---------|--------|
| pivot-advisor.ts | 新規 | 新規作成(推定60-80行) | 低 |
| retry.ts | 198/200 | RetryPromptResult型にpivotフィールド追加(+3行) | 中 |
| lifecycle-next.ts | 198/200 | buildDoDFailureResponse内にpivot呼び出し追加(+5行) | 中 |

### 分析結果

- retry_ts_lines: 198行。200行制限到達寸前。直接的なロジック追加は不可。型拡張のみ許容
- lifecycle_next_integration_points: L137-185のbuildDoDFailureResponse関数内。retryCount参照箇所(L155付近)でpivot判断を挿入
- phase_errors_format: TOONフォーマット。timestamp, phase, retryCount, errors, checksキーを持つ。既存readErrorToon関数で読み取り可能
- new_file_impact: toolsディレクトリに新規ファイル追加。既存モジュール構造と同一パターン(単一責務のエクスポート関数群)。インポートチェーンは retry.ts -> pivot-advisor.ts の単方向

### 判定

- [IA-P5-1][risk:high] retry.ts(198行)とlifecycle-next.ts(198行)は共に200行境界値。型追加+呼び出し追加で超過する可能性が高い。実装時に責務分割が必要
- [IA-P5-2][finding] RetryPromptResult型拡張は不要との分析結果あり。pivot情報はbuildDoDFailureResponseのレスポンスに直接注入する方式で、型変更を回避可能
- [IA-P5-3][dependency] phase-errors.toonは既存APIで安定利用可能。追加データストア不要
- [IA-P5-4][decision] pivot-advisor.tsはtoolsディレクトリに配置。detectRepeatedPattern + generatePivotSuggestionの2関数エクスポート
- [IA-P5-5][mitigation] 200行超過リスク対策: lifecycle-next.tsからpivot呼び出しロジックをpivot-advisor.tsに集約し、lifecycle-next.tsからは1行のimport + 1行の関数呼び出しのみにする

## P6: AC最低数変更(3→5)

### 影響範囲

| カテゴリ | 変更箇所数 | 影響度 |
|---------|-----------|--------|
| ソースコード(ロジック) | 7箇所 | 中 |
| ソースコード(メッセージ) | 6箇所 | 低 |
| テスト | 9箇所以上 | 中 |
| 合計 | 22箇所以上 | 中 |

### 分析結果

- ac_check_locations: dod-l4-requirements.ts L61, approval.ts L57, approval.ts L63
- task_size_ac_rules: タスクサイズ別のACルールは存在しない。TaskSizeはlarge固定。smallタスク向けの緩和ルールなし
- constant_import_chain: dod-l4-requirements.ts(定義) -> approval.ts(インポート)。2ファイル間の単方向依存
- small_task_impact: smallタスクの概念が現時点で未実装。影響なし
- breaking_change_risk: 低。進行中タスクは新セッション開始時に新閾値が適用されるが、requirements_definitionフェーズでACを追加登録すれば対応可能

### 判定

- [IA-P6-1][finding] 全22箇所の変更が必要だが、パターンが均一(リテラル3→5の置換)。機械的な一括変更で対応可能
- [IA-P6-2][decision] MIN_ACCEPTANCE_CRITERIA = 5をdod-l4-requirements.tsに定義し、approval.tsからインポート。ソース側のロジック変更箇所を2箇所に集約
- [IA-P6-3][risk:low] テストのACデータはbuildValidRequirementsToonヘルパー経由。acCountパラメータを5に変更するだけで大半のテスト更新が完了
- [IA-P6-4][finding] retry.ts L93の正規表現パターン内に"minimum 3"が存在。定数化では対応不可、個別の文字列更新が必要

## 横断分析

### 200行制限リスクマップ

| ファイル | 現在行数 | 追加見込 | 超過リスク | 対策 |
|---------|---------|---------|-----------|------|
| dod-helpers.ts | 124 | +20-30 | なし | - |
| dod-l4-content.ts | 87 | +13 | なし | - |
| retry.ts | 198 | +3(型のみ) | 低 | 型拡張最小化 |
| lifecycle-next.ts | 198 | +5 | 高 | pivot呼出をpivot-advisor.tsに集約 |
| types-core.ts | 171 | +1 | なし | - |

### 共有ファイル競合マップ

| ファイル | 変更元 | 競合リスク |
|---------|--------|-----------|
| dod-l4-content.ts | P3, P4 | 中。同一ファイルの異なる箇所を変更。P3→P4の順序で実装 |
| dod-helpers.ts | P3のみ | なし |
| retry.ts | P5, P6 | 低。P5は型拡張、P6はメッセージ文字列。異なる箇所 |

### 実装順序の推奨

```
Phase 1(並列可): P1(assumptionタグ) + P6(AC数変更)
Phase 2(順序制御): P3(AI slop) → P4(planning制約) -- dod-l4-content.ts共有
Phase 3(独立): P5(retry pivot) -- 200行制限対応のため慎重に実施
```

### テスト影響サマリー

| 改善 | 新規テスト | 既存テスト変更 | テスト戦略 |
|------|-----------|--------------|-----------|
| P3 | AI slopパターン検出テスト | dod-extended.test.ts拡張 | パターン別の検出/非検出テスト |
| P4 | コードフェンス検出テスト | なし | planning固有のDoDテスト新規追加 |
| P5 | pivot-advisor単体テスト | なし | パターン一致/不一致のシナリオテスト |
| P6 | なし | 9箇所以上の閾値変更 | acCount値の一括更新 |

## decisions

- [IA-1][decision] P3の非ブロック動作はpassed=true + [WARN] evidenceパターンで実現。既存L4チェック構造と整合
- [IA-2][decision] P4はC案(noCodeFencesフラグ)採用。Mermaidは.mmdファイル分離で対応
- [IA-3][decision] P5のlifecycle-next.ts 200行超過リスクはpivot-advisor.tsへのロジック集約で回避
- [IA-4][decision] P6のMIN_ACCEPTANCE_CRITERIA定数化でソース変更箇所を集約。テストは機械的更新
- [IA-5][dependency] P3→P4の順序制御が必須(dod-l4-content.ts共有)
- [IA-6][risk] P5が最高リスク。retry.ts(198行)+lifecycle-next.ts(198行)の200行境界値制約

## artifacts

- docs/workflows/article-insights-harness-improvements/impact-analysis.md: 本影響分析

## next

readyForDesign: true
designFocus: "P3非ブロックパターン設計、P5のlifecycle-next.ts 200行対策、P3→P4実装順序の詳細化"
warnings: "P5は200行制限により設計段階で行数見積りが必須。lifecycle-next.tsの責務分割が先行タスクになる可能性あり"
