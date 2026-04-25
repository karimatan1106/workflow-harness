# Impact Analysis: harness-detailed-error-analytics

phase: impact_analysis
date: 2026-03-25

## summary

errorAnalysis詳細化の変更は4ファイルに閉じており、後方互換性を維持した安全な拡張である。lifecycle-next.tsの200行超過リスクが唯一の構造的制約だが、mapping処理のフィールド追加のみで行数増加は最小限に抑えられる。既存のtoonDecodeSafeは未知フィールドを無視するため、DoDFailureEntry型拡張による既存データの読み込み破壊は発生しない。

## change-impact

### error-toon.ts (51行 -> 約61行)

変更内容: DoDFailureEntry.checksの型にlevel, fix, exampleフィールドをoptionalで追加
影響範囲: readErrorToon()の戻り値型が拡張される
後方互換性: 新フィールドはすべてoptional。toonDecodeSafeは未知フィールドを無視するため、既存phase-errors.toonファイルの読み込みに影響なし
リスク: low

### lifecycle-next.ts (199行 -> 約202行)

変更内容: buildDoDFailureResponse()内のappendErrorToon呼び出しで、checksのmappingにlevel, fix, exampleを追加
影響範囲: 164-166行のmapping式のみ。制御フローの変更なし
200行制約: 現在199行で、フィールド追加により202行前後に到達する。mapping式を1行にまとめるか、外部ヘルパー関数化で対応する。addNextPhaseOutputFile(187-198行)は既に分離済みのため、同様にmapping関数をファイル末尾に分離する方式が最も自然
リスク: medium(200行超過の構造対応が必要)

### phase-analytics.ts (168行 -> 約185行)

変更内容: buildErrorAnalysis()の44行目でpassed=falseフィルタを追加。47行目のlevel:'L1'ハードコードをcheck.level参照に変更。errorHistory配列の構築ロジック追加
影響範囲: buildErrorAnalysis()の戻り値には変更なし(PhaseErrorStats[]のまま)。errorHistory配列はbuildAnalytics()経由でAnalyticsResultに追加
既存バグ修正: passed=trueのchecksもfailureカウントしていた問題が解消される。これによりerrorAnalysis.failuresの件数が減少する(正しい方向への変化)
リスク: medium(failureカウント変化による既存アドバイス生成への影響)

### analytics-toon.ts (65行 -> 約85行)

変更内容: writeAnalyticsToon()のresultオブジェクトにerrorHistory配列を追加。全entry全checksの展開出力
影響範囲: phase-analytics.toonの出力内容が増加する。既存のerrorAnalysis(topFailure形式)は維持
ファイルサイズ: 全checks記録によりphase-analytics.toonのサイズが増加する。5フェーズx5リトライx10checks = 250エントリが上限想定。TOON1エントリ約100バイトとして約25KB。実運用上は問題ない範囲
リスク: low

## type-compatibility

### DoDFailureEntry型拡張の安全性

現行型: `checks: Array<{ name: string; passed: boolean; message?: string }>`
拡張型: `checks: Array<{ name: string; passed: boolean; message?: string; level?: string; fix?: string; example?: string }>`

toonDecodeSafeの挙動: @toon-format/toonのdecode()はスキーマバリデーションを行わず、存在するフィールドをそのまま返す。新フィールドがoptionalであれば、旧データ(新フィールドなし)も新コード(新フィールドあり)で正常に読み込める

AnalyticsResult型拡張: errorHistory配列をoptionalフィールドとして追加。writeAnalyticsToon()は`analytics.errorHistory ?? []`で安全にアクセスする

### PhaseErrorStats型への影響

PhaseErrorStats.failuresのCheckFailure型(check, level, count)は変更不要。buildErrorAnalysis()内でlevel情報をcheck.levelから取得するように変更するのみ

## regression-impact

### failureカウントの変化

現行: passed=trueのchecksもfailureとしてカウント(バグ)
変更後: passed=falseのchecksのみカウント(正しい挙動)

影響: errorAnalysis.failuresの件数が減少する。findBottlenecks()のmostFailedCheckの集計値も変化する。generateAdvice()のADVICE_RULESマッチングは失敗checksのみ対象となり、より正確なアドバイスが生成される

回帰リスク: 低。failureカウントの減少は正しい方向の変化であり、アドバイス生成ロジック自体は変更しない

### level情報の変化

現行: level='L1'固定(バグ)
変更後: DoDCheckResult.levelの実値(L1-L4)

影響: phase-analytics.toonのerrorAnalysis出力でlevel表記が変化する。topFailureの文字列が`check_name(L1) x2`から`check_name(L3) x2`等に変わる可能性

回帰リスク: 低。level表記は情報精度の向上であり、下流で文字列パースしている箇所はない

### phase-errors.toonのサイズ増加

現行: checks配列に3フィールド(name, passed, message)
変更後: checks配列に最大6フィールド(name, passed, message, level, fix, example)

影響: 1エントリあたり約2倍のサイズ増加。fix/exampleはpassed=falseの場合のみ存在するため、実質的な増加は30-50%程度

回帰リスク: 低。phase-errors.toonの読み込みはreadErrorToon()経由のみで、サイズ上限チェックは行っていない

## file-size-analysis

| file | current | delta | projected | status |
|------|---------|-------|-----------|--------|
| error-toon.ts | 51 | +10 | 61 | safe |
| lifecycle-next.ts | 199 | +3 | 202 | requires-refactor |
| phase-analytics.ts | 168 | +17 | 185 | safe |
| analytics-toon.ts | 65 | +20 | 85 | safe |
| dod-types.ts | 21 | 0 | 21 | no-change |
| dod.ts | 82 | 0 | 82 | no-change |

lifecycle-next.tsの200行超過対策: buildDoDFailureResponse()内のchecks mapping処理をトップレベル関数に分離する。関数シグネチャ1行+本体3行+閉じ括弧1行で、呼び出し元が3行短縮され差し引きで行数が減少する

## decisions

- DoDFailureEntry.checksの新フィールド(level, fix, example)はすべてoptionalとし、既存データとの後方互換性を保証する
- lifecycle-next.tsの200行超過はchecks mapping関数の外部化で対応する(addNextPhaseOutputFileと同じパターン)
- passed=falseフィルタの追加は既存バグの修正であり、failureカウント減少は許容する
- level='L1'ハードコードの解消はDoDCheckResult.level直接参照に変更する(型安全性の向上)
- errorHistory配列はAnalyticsResultのoptionalフィールドとして追加し、writeAnalyticsToonで`?? []`ガードする
- phase-errors.toonのサイズ増加(30-50%)は実運用上問題ない範囲と判断し、サイズ上限制御はout-of-scopeとする
- phase-analytics.tsは185行で200行以内に収まるため、責務分割は不要
- 既存のerrorAnalysis(topFailure形式)は維持し、errorHistoryを並列追加する(既存出力の破壊回避)

## artifacts

- impact-analysis.md: 本ドキュメント

## next

- planningフェーズでDoDFailureEntry型拡張とchecks mapping関数の具体設計を行う
- lifecycle-next.tsの200行対応(mapping関数外部化)の実装手順を定義する
- errorHistory配列のTOON出力形式をanalytics-toon.ts内で具体設計する
- buildErrorAnalysis()のpassedフィルタ修正とlevel参照の実装手順を定義する
