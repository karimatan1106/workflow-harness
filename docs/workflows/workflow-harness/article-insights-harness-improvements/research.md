# Research: article-insights-harness-improvements

## P3: AI slopパターン検出

### 既存実装構造

- dod-l4-content.ts: 87行。エクスポート: `checkL4ContentValidation`
- dod-helpers.ts: 124行(残76行)。11エクスポート関数
- `extractNonCodeLines(content: string) => string[]` がL30-40に存在。全既存チェックが使用
- 共通パターン: extractNonCodeLines -> パターン適用 -> `string[]`返却(空=合格)

### L4チェック呼び出しフロー(dod-l4-content.ts)

```
checkL4ContentValidation(phase, docsDir, workflowDir)
  -> checkForbiddenPatterns(content)     // L53
  -> checkBracketPlaceholders(content)   // L56
  -> checkDuplicateLines(content)        // L59 (.mmd除外)
  -> checkRequiredToonKeys(content)      // L65 (.toonのみ)
  -> Markdown section check              // L71 (.mdのみ)
```

### checkForbiddenPatternsの実装パターン

- extractNonCodeLinesで非コード行を抽出
- FORBIDDEN_PATTERNS配列をイテレート
- isInNegationContext()で否定文脈(例: "avoid TODO")を除外
- 大文字パターンはワード境界チェック

### checkDuplicateLinesの実装パターン

- extractNonCodeLinesで非コード行を抽出
- isStructuralLine()で見出し/区切り行をスキップ
- Map<string, number>で出現回数カウント
- 3回以上の行を報告

### 推奨配置

- dod-helpers.ts L85(checkDuplicateLines直後)にcheckAiSlopPatterns追加
- 推定+30-40行 -> 合計154-164行(200行制限内)
- dod-l4-content.tsのL62(重複チェック後)で呼び出し追加
- L14のインポート文を拡張

### AI slop正規表現設計方針

- case-insensitive検索
- カテゴリ別に命名(hedging_fillers, empty_emphasis, redundant_preamble, vague_connectors)
- 閾値: 同一パターン2回以上の出現で報告(1回は意図的使用の可能性)
- extractNonCodeLines経由でコードブロック内を除外
- isStructuralLine経由で見出し行を除外

### 初期パターン候補

- hedging: "it is important to note that", "it should be noted that"
- empty_emphasis: delve, tapestry, seamless(ly), holistic(ally), robust
- redundant_preamble: certainly/absolutely/of course/great question(行頭), "as an ai"
- vague_connectors: "in today's digital/modern/fast-paced", "landscape of"

---

## P4: planningフェーズのコード例排除

### planningフェーズ定義の正確な場所

- テンプレート: mcp-server/src/phases/defs-stage2.ts (L44-L76)
- レジストリ: mcp-server/src/phases/registry.ts (L26)
- スキルファイル: .claude/skills/workflow-harness/workflow-phases.md

### planningフェーズのPhaseConfig

```
dodChecks: []        // 空。カスタムDoDチェックなし
requiredSections: ['decisions', 'artifacts', 'next']
minLines: 50
allowedExtensions: ['.md', '.mmd']
bashCategories: ['readonly']
```

### dod-l4-content.tsのフェーズ別分岐

- 現状: フェーズ名による分岐は存在しない。全フェーズ共通処理のみ
- if (phase === 'planning') のような条件分岐は未実装

### 実装案3つ

- A案(最小変更): registry.tsのplanning dodChecksにインラインチェック追加
- B案(フェーズ別分岐): dod-l4-content.tsにplanning専用分岐追加
- C案(汎用化推奨): PhaseConfigにnoCodeFences?: booleanフラグ追加 -> dod-l4-content.tsで汎用処理

### コードフェンス検出の正規表現

```
CODE_FENCE_REGEX = /^`{3,}/m
```

- 既存extractNonCodeLinesと同一パターン(L36)
- 行頭3つ以上のバックティックにマッチ
- mフラグで複数行対応
- インラインコード(シングルバックティック)は行頭条件で自然に除外

### インラインコード許容の根拠

- planningは技術仕様書。ファイルパスや関数名の参照が必然
- CODE_FENCE_REGEXはインラインコードにマッチしない(行頭3+が条件)
- 追加の除外ロジックは不要

---

## P5: retry pivot(同一パターン失敗時の方向転換)

### retry.ts概要

- パス: mcp-server/src/tools/retry.ts
- 行数: 199行(200行制限到達)
- エクスポート: classifyComplexity, buildRetryPrompt, formatStructuredError, ERROR_ADR_MAP
- 型: RetryContext, RetryPromptResult

### classifyComplexityの分類ロジック

- 入力: DoDCheckResult[] + errorClass
- L1失敗あり -> critical(opus推奨)
- L3失敗あり -> moderate(sonnet推奨)
- その他 -> trivial(haiku推奨)
- チェック空時: errorClassで判定(FileNotFound=critical, LogicError=moderate, 他=trivial)

### buildRetryPromptの構造

- 複雑度タグ([TRIVIAL]/[MODERATE]/[CRITICAL])
- フェーズ名 + リトライ回数
- 失敗理由(コードブロック内、転記禁止注意付き)
- 改善要求(ERROR/WHY/FIX形式)
- 関連ADR(最大3件)
- モデルエスカレーション: retryCount >= 2 かつ model === 'haiku'

### リトライ制御

- 上限: maxRetries = 5 (lifecycle-next.ts L42)
- retryCount >= 3: VDB-1警告(バリデータバグの可能性)
- フェーズ成功時: resetRetryCount()でリセット
- 失敗時: stashFailure()で失敗履歴記録、appendErrorToon()でphase-errors.toon追記

### 欠如している要素(pivot判断に必要)

- 連続失敗のerrorPattern比較(前回と同じパターンか判定するロジック)
- 同一パターンN回連続の検出カウンタ
- 失敗パターンに基づく代替アプローチ提案
- pivotフラグ/pivotPromptの生成

### 利用可能な既存データ

- extractErrorPattern() (reflector.ts): エラーメッセージから80文字パターン抽出
- phase-errors.toon: 各失敗の詳細記録(timestamp, phase, retryCount, errors, checks)
- reflector-log.toon: stashedFailures(最大20件)、lessons(最大50件)

### 推奨実装方針

- retry.ts(199行)に直接追加不可。pivot-advisor.ts新規ファイルに分離
- detectRepeatedPattern(docsDir, currentPattern): phase-errors.toonから直近失敗パターンを読取り比較
  - 戻り値: { isRepeated, consecutiveCount, pattern }
- generatePivotSuggestion(errorClass, pattern, phase): errorClass別の方向転換提案を生成
- RetryPromptResult拡張: pivotRequired, pivotSuggestion, consecutiveFailureCount追加
- buildRetryPrompt内でpivot判断を実行し、プロンプトに注入

### 影響範囲

- retry.ts: RetryPromptResult拡張、buildRetryPrompt内でpivot呼び出し
- 新ファイル(pivot-advisor.ts): detectRepeatedPattern, generatePivotSuggestion
- lifecycle-next.ts: buildDoDFailureResponse内でpivot情報をレスポンスに追加

---

## P6: AC最低数変更(3->5)

### 現在の定義箇所

- dod-l4-requirements.ts L61: if (acCount < 3) -- DoDゲートチェック
- approval.ts L57: if (acCount < 3) -- 承認ハンドラチェック
- approval.ts L63: task.acceptanceCriteria.length >= 3 -- refinedIntent生成閾値
- 全てリテラル直書き(定数化されていない)

### 変更ファイル一覧(ソース: 7箇所)

| ファイル | 行 | 変更内容 |
|---------|-----|---------|
| dod-l4-requirements.ts | 61 | < 3 -> < 5 |
| dod-l4-requirements.ts | 64 | エビデンス文字列 minimum 3 |
| dod-l4-requirements.ts | 65 | fix文字列 最低3件 |
| dod-l4-requirements.ts | 69 | エビデンス文字列 minimum 3 |
| approval.ts | 57 | < 3 -> < 5 |
| approval.ts | 58 | エラーメッセージ at least 3 |
| approval.ts | 63 | >= 3 -> >= 5 |

### 変更ファイル一覧(ガイダンス: 6箇所)

| ファイル | 行 | 変更内容 |
|---------|-----|---------|
| toon-skeletons-a.ts | 147 | 最低3件必須 -> 最低5件必須 |
| defs-stage1.ts | 91 | 最低3件定義 -> 最低5件定義 |
| defs-stage1.ts | 96 | 最低3件の受入基準 -> 最低5件の受入基準 |
| phase-analytics.ts | 126 | 最低3件 -> 最低5件 |
| retry.ts | 93 | 正規表現 minimum 3 -> minimum 5 |
| retry.ts | 94 | 最低3件 -> 最低5件 |

### 変更ファイル一覧(テスト: 13箇所)

| ファイル | 変更内容 |
|---------|---------|
| dod-l4-requirements.test.ts | 9箇所: 説明文、acCount値(2->4, 3->5)、アサーション、TOON内AC追加 |
| handler-misc-ia2.test.ts | 2箇所: コメント、エラーメッセージ |
| handler-parallel.test.ts | 1箇所: コメント + harness_add_ac呼び出し追加(3回->5回) |
| handler-approval.test.ts | 1箇所: コメント + harness_add_ac呼び出し追加(3回->5回) |

### 定数化の推奨

dod-l4-requirements.tsにMIN_ACCEPTANCE_CRITERIA = 5を定義し、approval.tsからインポート。ソース側の変更箇所をメッセージ文字列のみに削減可能。

### 注意事項

- retry.tsのL93にminimum 3の正規表現マッチあり。定数化しても正規表現パターンの個別更新が必要
- テストのACデータ追加: buildValidRequirementsToonヘルパーのacCountパラメータ確認が必要
- handler-parallel/approval.test.tsでharness_add_ac呼び出し回数を3->5に増加
- 影響範囲はworkflow-harnessサブモジュール内に閉じる

---

## decisions

- D-RS-1: P3のcheckAiSlopPatternsはdod-helpers.ts L85に追加(残76行で収容可能)
- D-RS-2: P4はC案(noCodeFencesフラグ汎用化)を推奨。最小実装ならA案(dodChecks追加)
- D-RS-3: P5はretry.ts(199行)に直接追加不可。pivot-advisor.ts新規ファイルに分離
- D-RS-4: P6はMIN_ACCEPTANCE_CRITERIA定数導入で変更箇所を集約
- D-RS-5: P3とP4は共にdod-l4-content.tsを変更。同一Workerまたは順序制御が必要
- D-RS-6: P5のデータソースはphase-errors.toon(既存)で追加データストア不要

## artifacts

- docs/workflows/article-insights-harness-improvements/research.md: 本調査報告

## next

- P3: dod-helpers.tsにcheckAiSlopPatterns実装、dod-l4-content.tsに呼び出し追加、テスト作成
- P4: PhaseConfigにnoCodeFences追加(C案採用時)、registry.tsのplanning設定更新、defs-stage2.tsテンプレート更新、テスト作成
- P5: pivot-advisor.ts新規作成、retry.tsのRetryPromptResult拡張、lifecycle-next.ts統合
- P6: MIN_ACCEPTANCE_CRITERIA定数定義、ソース7箇所+ガイダンス6箇所+テスト13箇所の更新
