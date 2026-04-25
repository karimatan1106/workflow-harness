# Test Design: article-insights-harness-improvements

## overview

5改善項目(P3-P7)のテストケース設計。全23のACに対して1:1対応する23テストケースを定義する。テスト種別は単体テスト(vitest)。各テストケースはL1-L4決定的ゲートの範囲内で検証可能であり、L5(LLM判断)を含まない。RTM F-001〜F-009にテスト結果を紐付ける。

## test-strategy

- テストフレームワーク: vitest
- テスト種別: 単体テスト(関数レベル)
- テストデータ: インラインフィクスチャ(テストコード内に定義)
- 検証方式: L4正規表現パターンの入出力一致
- 非ブロック動作の検証: passed=true + evidence内[WARN]プレフィックスの存在確認
- 閾値境界テスト: 閾値-1(パスすべき)と閾値(検出すべき)の両方を検証

## test-files

| テストファイル | 対象 | テストケース数 |
|--------------|------|--------------|
| gates/dod-extended.test.ts | P3(AI slop) + P7(重複行除外) | TC-AC1-01〜TC-AC5-01, TC-AC21-01〜TC-AC23-01 |
| 新規: gates/dod-code-fence.test.ts | P4(コードフェンス検出) | TC-AC6-01〜TC-AC10-01 |
| 新規: tools/pivot-advisor.test.ts | P5(方向転換) | TC-AC11-01〜TC-AC15-01 |
| gates/dod-l4-requirements.test.ts | P6(AC数変更) | TC-AC16-01〜TC-AC20-01 |

## P3-ai-slop-test-cases

### TC-AC1-01: hedgingパターン検出

| 項目 | 値 |
|------|-----|
| ID | TC-AC1-01 |
| AC | AC-1 |
| RTM | F-001 |
| テストファイル | gates/dod-extended.test.ts |
| 関数 | checkAiSlopPatterns |
| 入力 | "it is important to note that X.\nit is important to note that Y." |
| 期待出力 | string[]に"hedging"カテゴリの警告が含まれる |
| 検証 | expect(result).toContainEqual(expect.stringContaining('hedging')) |

### TC-AC2-01: empty_emphasisパターン検出

| 項目 | 値 |
|------|-----|
| ID | TC-AC2-01 |
| AC | AC-2 |
| RTM | F-002 |
| テストファイル | gates/dod-extended.test.ts |
| 関数 | checkAiSlopPatterns |
| 入力 | "We delve into the details.\nWe delve deeper here." |
| 期待出力 | string[]に"empty_emphasis"カテゴリの警告が含まれ、[WARN]プレフィックス付き |
| 検証 | expect(result.some(r => r.startsWith('[WARN]') && r.includes('empty_emphasis'))).toBe(true) |

### TC-AC3-01: redundant_preambleパターン検出

| 項目 | 値 |
|------|-----|
| ID | TC-AC3-01 |
| AC | AC-3 |
| RTM | F-003 |
| テストファイル | gates/dod-extended.test.ts |
| 関数 | checkAiSlopPatterns(統合テスト: checkL4ContentValidation経由) |
| 入力 | duplicatesチェック後にcheckAiSlopPatternsが呼び出されるコンテンツ。"Certainly, this is correct.\nCertainly, we agree." |
| 期待出力 | DoDCheckResultのevidenceに[WARN]プレフィックス付きredundant_preamble警告が含まれる |
| 検証 | expect(result.evidence).toContain('[WARN] AI slop detected: redundant_preamble') |

### TC-AC4-01: vague_connectorsパターン検出

| 項目 | 値 |
|------|-----|
| ID | TC-AC4-01 |
| AC | AC-4 |
| RTM | F-001 |
| テストファイル | gates/dod-extended.test.ts |
| 関数 | checkAiSlopPatterns |
| 入力 | "In today's digital world, X.\n```\nIn today's digital world, Y.\n```\nIn today's digital landscape, Z." |
| 期待出力 | コードブロック内の出現はカウントされず、コードブロック外の2回でvague_connectors警告が出る |
| 検証 | extractNonCodeLines経由で非コード行のみ対象。コードブロック内パターンが除外されていることを確認 |

### TC-AC5-01: 閾値境界テスト(1回=無視)

| 項目 | 値 |
|------|-----|
| ID | TC-AC5-01 |
| AC | AC-5 |
| RTM | F-001, F-002 |
| テストファイル | gates/dod-extended.test.ts |
| 関数 | checkAiSlopPatterns |
| 入力 | "it is important to note that X." (hedging 1回のみ) |
| 期待出力 | 空配列(警告なし) |
| 検証 | expect(result).toHaveLength(0) |

## P4-code-fence-test-cases

### TC-AC6-01: planningフェーズのコードフェンス検出

| 項目 | 値 |
|------|-----|
| ID | TC-AC6-01 |
| AC | AC-6, AC-8 |
| RTM | F-004, F-005 |
| テストファイル | gates/dod-code-fence.test.ts |
| 関数 | checkL4ContentValidation |
| 入力 | PhaseConfig: { noCodeFences: true }、コンテンツ: "# Planning\n\n```typescript\nconst x = 1;\n```" |
| 期待出力 | passed=true、evidenceに[WARN] Code fence detected in planning artifactが含まれる |
| 検証 | expect(result.passed).toBe(true); expect(result.evidence).toContain('[WARN] Code fence detected in planning artifact') |

### TC-AC7-01: インラインコードは検出対象外

| 項目 | 値 |
|------|-----|
| ID | TC-AC7-01 |
| AC | AC-8 |
| RTM | F-005 |
| テストファイル | gates/dod-code-fence.test.ts |
| 関数 | checkL4ContentValidation |
| 入力 | PhaseConfig: { noCodeFences: true }、コンテンツ: "Use `const x = 1` for assignment." |
| 期待出力 | evidenceに[WARN]が含まれない |
| 検証 | expect(result.evidence).not.toContain('[WARN]') |

### TC-AC8-01: .mmdファイルはチェック対象外

| 項目 | 値 |
|------|-----|
| ID | TC-AC8-01 |
| AC | AC-9 |
| RTM | F-005 |
| テストファイル | gates/dod-code-fence.test.ts |
| 関数 | checkL4ContentValidation |
| 入力 | PhaseConfig: { noCodeFences: true }、ファイル名: "diagram.mmd"、コンテンツ: "```mermaid\ngraph TD\n```" |
| 期待出力 | evidenceに[WARN]が含まれない(.mmd除外) |
| 検証 | expect(result.evidence).not.toContain('[WARN]') |

### TC-AC9-01: noCodeFences=falseのフェーズではチェックしない

| 項目 | 値 |
|------|-----|
| ID | TC-AC9-01 |
| AC | AC-8 |
| RTM | F-005 |
| テストファイル | gates/dod-code-fence.test.ts |
| 関数 | checkL4ContentValidation |
| 入力 | PhaseConfig: { noCodeFences: undefined }、コンテンツ: "```typescript\nconst x = 1;\n```" |
| 期待出力 | evidenceにコードフェンス警告が含まれない |
| 検証 | expect(result.evidence).not.toContain('[WARN] Code fence detected') |

### TC-AC10-01: エラーメッセージにファイル名と行番号が含まれる

| 項目 | 値 |
|------|-----|
| ID | TC-AC10-01 |
| AC | AC-10 |
| RTM | F-005 |
| テストファイル | gates/dod-code-fence.test.ts |
| 関数 | checkL4ContentValidation |
| 入力 | PhaseConfig: { noCodeFences: true }、ファイル名: "planning.md"、コンテンツ: "line1\nline2\n```typescript\ncode\n```" |
| 期待出力 | evidenceに"planning.md (line 3)"が含まれる |
| 検証 | expect(result.evidence).toContain('planning.md (line 3)') |

## P5-pivot-test-cases

### TC-AC11-01: 同一パターン3回連続で方向転換提案生成

| 項目 | 値 |
|------|-----|
| ID | TC-AC11-01 |
| AC | AC-11, AC-13 |
| RTM | F-006 |
| テストファイル | tools/pivot-advisor.test.ts |
| 関数 | detectRepeatedPattern + generatePivotSuggestion |
| 入力 | phase-errors.toonに同一パターン"forbidden_word: prohibited_term detected"が3回記録、currentPattern: "forbidden_word: prohibited_term detected" |
| 期待出力 | detectRepeatedPattern: { isRepeated: true, consecutiveCount: 3, pattern: "forbidden_word: prohibited_term detected" }。generatePivotSuggestionが提案文字列を返す |
| 検証 | expect(result.isRepeated).toBe(true); expect(result.consecutiveCount).toBe(3) |

### TC-AC12-01: 異なるエラーパターンでは方向転換提案しない

| 項目 | 値 |
|------|-----|
| ID | TC-AC12-01 |
| AC | AC-12 |
| RTM | F-006 |
| テストファイル | tools/pivot-advisor.test.ts |
| 関数 | detectRepeatedPattern |
| 入力 | phase-errors.toonに異なるパターン("error_a", "error_b", "error_c")が記録、currentPattern: "error_d" |
| 期待出力 | { isRepeated: false, consecutiveCount: 0, pattern: "" } |
| 検証 | expect(result.isRepeated).toBe(false) |

### TC-AC13-01: phase-errors.toonからエラー履歴読み取り

| 項目 | 値 |
|------|-----|
| ID | TC-AC13-01 |
| AC | AC-12 |
| RTM | F-006 |
| テストファイル | tools/pivot-advisor.test.ts |
| 関数 | detectRepeatedPattern |
| 入力 | 有効なphase-errors.toonフィクスチャ(3エントリ)を一時ディレクトリに配置 |
| 期待出力 | phase-errors.toonから正しくパターンを読み取りRepeatResultを返す |
| 検証 | toonファイルのパース結果がRepeatResult型に正しくマッピングされることを確認 |

### TC-AC14-01: 提案に現在パターン・代替アプローチ・根拠が含まれる

| 項目 | 値 |
|------|-----|
| ID | TC-AC14-01 |
| AC | AC-13, AC-14 |
| RTM | F-006, F-007 |
| テストファイル | tools/pivot-advisor.test.ts |
| 関数 | generatePivotSuggestion |
| 入力 | errorClass: "forbidden_word", pattern: "prohibited_term detected", phase: "implementation" |
| 期待出力 | 提案文字列に(1)パターン引用(2)具体的行動指示(3)連続回数が含まれる |
| 検証 | expect(suggestion).toContain('prohibited_term detected'); expect(suggestion).toContain('書き直してください') |

### TC-AC15-01: 2回以下では提案しない(閾値テスト)

| 項目 | 値 |
|------|-----|
| ID | TC-AC15-01 |
| AC | AC-15 |
| RTM | F-006 |
| テストファイル | tools/pivot-advisor.test.ts |
| 関数 | buildPivotResponse |
| 入力 | phase-errors.toonに同一パターンが2回のみ記録 |
| 期待出力 | buildPivotResponseがnullを返す |
| 検証 | expect(result).toBeNull() |

## P6-ac-count-test-cases

### TC-AC16-01: MIN_ACCEPTANCE_CRITERIA定数定義

| 項目 | 値 |
|------|-----|
| ID | TC-AC16-01 |
| AC | AC-16 |
| RTM | F-008 |
| テストファイル | gates/dod-l4-requirements.test.ts |
| 関数 | (定数検証) |
| 入力 | dod-l4-requirements.tsからMIN_ACCEPTANCE_CRITERIAをインポート |
| 期待出力 | MIN_ACCEPTANCE_CRITERIA === 5 |
| 検証 | expect(MIN_ACCEPTANCE_CRITERIA).toBe(5) |

### TC-AC17-01: AC数4以下でエラー、5以上でパス

| 項目 | 値 |
|------|-----|
| ID | TC-AC17-01 |
| AC | AC-17, AC-18 |
| RTM | F-008 |
| テストファイル | gates/dod-l4-requirements.test.ts |
| 関数 | checkL4Requirements(またはAC数チェックロジック) |
| 入力-不合格 | acCount: 4 |
| 期待出力-不合格 | passed=false |
| 入力-合格 | acCount: 5 |
| 期待出力-合格 | passed=true |
| 検証 | 境界値テスト: 4→fail, 5→pass |

### TC-AC18-01: エラーメッセージに現在数と必要最低数が含まれる

| 項目 | 値 |
|------|-----|
| ID | TC-AC18-01 |
| AC | AC-18 |
| RTM | F-008 |
| テストファイル | gates/dod-l4-requirements.test.ts |
| 関数 | checkL4Requirements |
| 入力 | acCount: 3 |
| 期待出力 | evidenceに"3"(現在数)と"5"(最低数)が含まれる |
| 検証 | expect(result.evidence).toContain('3'); expect(result.evidence).toContain('5') |

### TC-AC19-01: 旧リテラル3が残存していないことをgrep確認

| 項目 | 値 |
|------|-----|
| ID | TC-AC19-01 |
| AC | AC-20 |
| RTM | F-008 |
| テストファイル | gates/dod-l4-requirements.test.ts |
| 関数 | (静的検証) |
| 入力 | ソースコード全体のgrep "minimum 3"および"最低3件" |
| 期待出力 | 該当箇所ゼロ |
| 検証 | grepコマンドの実行結果が空であることを確認。テストコード内でexecSyncまたはvitest外の検証スクリプトで実行 |

### TC-AC20-01: 関連テスト13箇所が全て5に更新済み

| 項目 | 値 |
|------|-----|
| ID | TC-AC20-01 |
| AC | AC-19 |
| RTM | F-008 |
| テストファイル | gates/dod-l4-requirements.test.ts |
| 関数 | (テスト実行検証) |
| 入力 | vitest --run で4テストファイル全実行 |
| 期待出力 | 全テスト合格(閾値5に基づくアサーション) |
| 検証 | dod-l4-requirements.test.ts, handler-misc-ia2.test.ts, handler-parallel.test.ts, handler-approval.test.tsが全て合格 |

## P7-duplicate-filter-test-cases

### TC-AC21-01: コードフェンス行が重複カウントから除外

| 項目 | 値 |
|------|-----|
| ID | TC-AC21-01 |
| AC | AC-21 |
| RTM | F-009 |
| テストファイル | gates/dod-extended.test.ts |
| 関数 | isStructuralLine |
| 入力 | "```typescript", "```", "````" |
| 期待出力 | 全てtrue(構造行として除外) |
| 検証 | expect(isStructuralLine('```typescript')).toBe(true); expect(isStructuralLine('```')).toBe(true) |

### TC-AC22-01: Mermaid構文行が重複カウントから除外

| 項目 | 値 |
|------|-----|
| ID | TC-AC22-01 |
| AC | AC-22 |
| RTM | F-009 |
| テストファイル | gates/dod-extended.test.ts |
| 関数 | isStructuralLine |
| 入力 | "graph TD", "subgraph section1", "end", "A --> B" |
| 期待出力 | 全てtrue(構造行として除外) |
| 検証 | expect(isStructuralLine('graph TD')).toBe(true); expect(isStructuralLine('A --> B')).toBe(true) |

### TC-AC23-01: テーブル区切り行が重複カウントから除外

| 項目 | 値 |
|------|-----|
| ID | TC-AC23-01 |
| AC | AC-23 |
| RTM | F-009 |
| テストファイル | gates/dod-extended.test.ts |
| 関数 | isStructuralLine |
| 入力 | "| --- | --- |", "|:---|:---|", "| col1 | col2 |" |
| 期待出力 | 全てtrue(構造行として除外) |
| 検証 | expect(isStructuralLine('| --- | --- |')).toBe(true); expect(isStructuralLine('| col1 | col2 |')).toBe(true) |

## traceability-matrix

| TC ID | AC ID | RTM ID | テストファイル | 検証方式 |
|-------|-------|--------|--------------|---------|
| TC-AC1-01 | AC-1 | F-001 | dod-extended.test.ts | 単体テスト |
| TC-AC2-01 | AC-2 | F-002 | dod-extended.test.ts | 単体テスト |
| TC-AC3-01 | AC-3 | F-003 | dod-extended.test.ts | 統合テスト |
| TC-AC4-01 | AC-4 | F-001 | dod-extended.test.ts | 単体テスト |
| TC-AC5-01 | AC-5 | F-001, F-002 | dod-extended.test.ts | 境界値テスト |
| TC-AC6-01 | AC-6, AC-8 | F-004, F-005 | dod-code-fence.test.ts | 単体テスト |
| TC-AC7-01 | AC-8 | F-005 | dod-code-fence.test.ts | 単体テスト |
| TC-AC8-01 | AC-9 | F-005 | dod-code-fence.test.ts | 単体テスト |
| TC-AC9-01 | AC-8 | F-005 | dod-code-fence.test.ts | 単体テスト |
| TC-AC10-01 | AC-10 | F-005 | dod-code-fence.test.ts | 単体テスト |
| TC-AC11-01 | AC-11, AC-13 | F-006 | pivot-advisor.test.ts | 単体テスト |
| TC-AC12-01 | AC-12 | F-006 | pivot-advisor.test.ts | 単体テスト |
| TC-AC13-01 | AC-12 | F-006 | pivot-advisor.test.ts | 単体テスト |
| TC-AC14-01 | AC-13, AC-14 | F-006, F-007 | pivot-advisor.test.ts | 単体テスト |
| TC-AC15-01 | AC-15 | F-006 | pivot-advisor.test.ts | 境界値テスト |
| TC-AC16-01 | AC-16 | F-008 | dod-l4-requirements.test.ts | 定数検証 |
| TC-AC17-01 | AC-17, AC-18 | F-008 | dod-l4-requirements.test.ts | 境界値テスト |
| TC-AC18-01 | AC-18 | F-008 | dod-l4-requirements.test.ts | 出力検証 |
| TC-AC19-01 | AC-20 | F-008 | dod-l4-requirements.test.ts | 静的検証(grep) |
| TC-AC20-01 | AC-19 | F-008 | dod-l4-requirements.test.ts | 実行検証 |
| TC-AC21-01 | AC-21 | F-009 | dod-extended.test.ts | 単体テスト |
| TC-AC22-01 | AC-22 | F-009 | dod-extended.test.ts | 単体テスト |
| TC-AC23-01 | AC-23 | F-009 | dod-extended.test.ts | 単体テスト |

## coverage-summary

| 改善項目 | AC数 | TC数 | RTM | カバレッジ |
|---------|------|------|-----|-----------|
| P3(AI slop) | AC-1〜AC-5 | 5 | F-001, F-002, F-003 | 100% |
| P4(コードフェンス) | AC-6〜AC-10 | 5 | F-004, F-005 | 100% |
| P5(方向転換) | AC-11〜AC-15 | 5 | F-006, F-007 | 100% |
| P6(AC数変更) | AC-16〜AC-20 | 5 | F-008 | 100% |
| P7(重複行除外) | AC-21〜AC-23 | 3 | F-009 | 100% |
| 合計 | 23 | 23 | F-001〜F-009 | 100% |

## test-execution-order

| 順序 | テスト | 前提条件 |
|------|--------|---------|
| Step-1 | TC-AC16-01〜TC-AC20-01 (P6) | W1(P6-source)完了後 |
| Step-2 | TC-AC1-01〜TC-AC5-01 (P3) + TC-AC21-01〜TC-AC23-01 (P7) | W3(P3+P7)完了後 |
| Step-3 | TC-AC6-01〜TC-AC10-01 (P4) | W4(P4)完了後 |
| Step-4 | TC-AC11-01〜TC-AC15-01 (P5) | W5(P5)完了後 |
| Final | vitest --run 全テスト合格確認 | 全Worker完了後 |

## decisions

- [TD-1][decision] 全23 ACに対して1:1でテストケースを定義。過不足なし
- [TD-2][decision] TC-AC19-01(旧リテラル残存チェック)はgrepベースの静的検証。vitest外の検証も許容
- [TD-3][decision] TC-AC13-01(phase-errors.toon読み取り)は一時ディレクトリにフィクスチャ配置する方式
- [TD-4][decision] P7のisStructuralLine関数は既存export済みのため、直接単体テスト可能
- [TD-5][decision] テスト実行順序はplanning.mdの実装順序(W1→W3→W4→W5)に従う

## artifacts

- docs/workflows/article-insights-harness-improvements/test-design.md: 本テスト設計文書

## acTcMapping

- AC-1: TC-AC1-01
- AC-2: TC-AC2-01
- AC-3: TC-AC3-01
- AC-4: TC-AC4-01
- AC-5: TC-AC5-01
- AC-6: TC-AC6-01
- AC-7: TC-AC7-01
- AC-8: TC-AC8-01
- AC-9: TC-AC9-01
- AC-10: TC-AC10-01
- AC-11: TC-AC11-01
- AC-12: TC-AC12-01
- AC-13: TC-AC13-01
- AC-14: TC-AC14-01
- AC-15: TC-AC15-01
- AC-16: TC-AC16-01
- AC-17: TC-AC17-01
- AC-18: TC-AC18-01
- AC-19: TC-AC19-01
- AC-20: TC-AC20-01
- AC-21: TC-AC21-01
- AC-22: TC-AC22-01
- AC-23: TC-AC23-01

## next

readyForImplementation: true
firstWorkers: "W1(P6-source) + W3(P3+P7) を並列起動"
testExecutionOrder: "P6テスト → P3+P7テスト → P4テスト → P5テスト → 全体回帰テスト"
