# UI Design: harness-detailed-error-analytics

phase: ui_design
date: 2026-03-25

## summary

phase-analytics.toonのerrorAnalysis出力形式の設計。CLIツールのため画面UIは存在せず、TOON形式での構造化データ出力が対象。既存のtopFailure形式を維持しつつ、errorHistory配列を並列追加する。

## outputElements

### element-1: errorAnalysis (既存topFailure形式 - 維持)

既存の集約ビュー。フェーズごとの最頻失敗チェックを1件表示する。

出力形式:
```toon
errorAnalysis:
  - phase: requirements
    failures: 3
    topCheck: prohibited-words-check
    level: L1
```

フィールド定義:
- phase: string - フェーズ名(planning, requirements等)
- failures: number - 当該フェーズでの失敗回数合計
- topCheck: string - 最頻失敗チェック名
- level: string - topCheckのDoDレベル(L1|L2|L3|L4)。修正前はL1固定だったが、DoDCheckResult.levelの実値を使用する

変更点: level値のみ修正(L1ハードコード → 実値)。他フィールドは変更なし。

### element-2: errorHistory配列 (新規追加)

全entry全checksの詳細展開ビュー。事後分析用の完全な履歴データ。

出力形式:
```toon
errorHistory:
  - phase: requirements
    retry: 0
    check: prohibited-words-check
    level: L1
    passed: false
    evidence: "line 42: 禁止語 TODO を検出"
  - phase: requirements
    retry: 0
    check: section-structure-check
    level: L2
    passed: true
    evidence: "全必須セクション存在"
  - phase: planning
    retry: 1
    check: line-count-check
    level: L1
    passed: false
    evidence: "planning.md: 215行 > 200行上限"
```

フィールド定義:
- phase: string - フェーズ名。phase-errors.toonのentry.phaseから取得
- retry: number - リトライ回数。entry.retryCountから取得
- check: string - チェック名。entry.checks[].nameから取得
- level: string - DoDレベル(L1|L2|L3|L4)。entry.checks[].levelから取得。値なし時はL1をデフォルトとする
- passed: boolean - チェック結果(true=合格, false=不合格)
- evidence: string - エビデンス文字列。entry.checks[].messageから取得。値なし時は空文字列

配列順序: phase-errors.toonの記録順(時系列)を維持する。ソートは行わない。

## dataMapping

### 入力: phase-errors.toon

```
entries:
  - phase: requirements
    retryCount: 0
    checks:
      - name: prohibited-words-check
        passed: false
        message: "line 42: 禁止語 TODO を検出"
        level: L1
        fix: "禁止語を削除または言い換え"
        example: "変更予定 → 対応方針"
      - name: section-structure-check
        passed: true
        message: "全必須セクション存在"
        level: L2
```

### 変換ルール

| 入力(phase-errors.toon) | 出力(errorHistory) | 変換 |
|---|---|---|
| entry.phase | phase | 直接コピー |
| entry.retryCount | retry | フィールド名変更のみ |
| check.name | check | フィールド名変更のみ |
| check.level | level | 値なし時はL1をデフォルト適用 |
| check.passed | passed | 直接コピー |
| check.message | evidence | フィールド名変更のみ。値なし時は空文字列 |
| check.fix | (出力対象外) | errorHistoryには含めない |
| check.example | (出力対象外) | errorHistoryには含めない |

fix, exampleはphase-errors.toonに記録するが、errorHistory出力には含めない。phase-errors.toonは全情報の蓄積層、errorHistoryは分析用の集約層という役割分担による。

## outputStructure

phase-analytics.toonの最終構造:

```toon
taskName: harness-detailed-error-analytics
generatedAt: 2026-03-25T12:00:00.000Z

errorAnalysis:
  - phase: requirements
    failures: 3
    topCheck: prohibited-words-check
    level: L1
  - phase: planning
    failures: 1
    topCheck: line-count-check
    level: L1

errorHistory:
  - phase: requirements
    retry: 0
    check: prohibited-words-check
    level: L1
    passed: false
    evidence: "line 42: 禁止語 TODO を検出"
  - phase: requirements
    retry: 0
    check: section-structure-check
    level: L2
    passed: true
    evidence: "全必須セクション存在"

bottlenecks:
  ...
advice:
  ...
```

errorAnalysisとerrorHistoryは同一ファイル内で並列配置される。errorAnalysisが集約ビュー、errorHistoryが詳細ビューとして補完関係にある。

## decisions

- UD-1: errorHistory配列のフィールド名はretryCount→retry、check.name→check、check.message→evidenceに短縮する。TOON出力の可読性を優先し、内部型名との1:1対応より簡潔さを選択する
- UD-2: fix, exampleフィールドはerrorHistory出力から除外する。phase-errors.toonに全情報を保持し、errorHistoryは分析に必要な最小フィールドのみ出力する
- UD-3: errorHistory配列はphase-errors.toonの記録順(時系列)を維持する。フェーズ名やlevelでのソートは行わず、発生順序の情報を保存する
- UD-4: level値なし時のデフォルトはL1とする。既存のhardcodeがL1であり、デフォルト値として最も保守的(最も厳格なレベル)であるため
- UD-5: evidence値なし時は空文字列をデフォルトとする。nullやundefinedではなく空文字列を使用し、TOON形式での出力安定性を確保する
- UD-6: errorAnalysisとerrorHistoryは同一ファイル(phase-analytics.toon)内に並列配置する。別ファイル分離はファイル数増加とI/Oコスト増大を招くため採用しない

## artifacts

- docs/workflows/harness-detailed-error-analytics/ui-design.md: 本設計書。errorHistory配列の出力形式、フィールド定義、データ変換ルール
- docs/workflows/harness-detailed-error-analytics/planning.md: 入力。実装計画と3Worker直列構成
- docs/workflows/harness-detailed-error-analytics/requirements.md: 入力。FR-1〜FR-4の機能要件定義

## next

criticalPath: "Worker-1(error-toon.ts型+関数) -> Worker-2(lifecycle-next.ts+phase-analytics.ts) -> Worker-3(analytics-toon.ts)"
readFiles: "docs/workflows/harness-detailed-error-analytics/ui-design.md, docs/workflows/harness-detailed-error-analytics/planning.md"
warnings: "errorHistoryのフィールド名はretry/check/evidenceに短縮済み。実装時にretryCount/name/messageと混同しないこと"
