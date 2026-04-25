# UI Design: article-insights-harness-improvements

## overview

MCPサーバーの内部ロジック変更であり、ユーザー向けGUIは存在しない。本文書の「UI」は(1) LLMに返すDoDCheckResult内のevidence/fix/error文字列の表示形式と(2) retryプロンプト内のメッセージ形式を指す。既存パターン(DoDCheckResult型: level/check/passed/evidence/fix/example)との一貫性を維持する。

## existing-patterns

### DoDCheckResult構造

```
{ level: 'L1'|'L2'|'L3'|'L4', check: string, passed: boolean, evidence: string, fix?: string, example?: string }
```

### 既存evidence形式

- 合格: 事実記述のみ(`All input artifacts are fresh`)
- 不合格: エラー内容+数量(`Missing input files: a.md, b.md`)
- 警告(新規): `[WARN]`プレフィックスで非ブロック情報を追加(P3/P4で導入)

### 既存error/fix形式(retry.ts)

```
ERROR: {概要}
  {ファイルパス}
  WHY: {ADR参照}
  FIX: {改善指示}
```

## P3: AI slopパターン警告出力

### evidence形式(passed=true時に追加)

```
[WARN] AI slop detected: hedging (3 occurrences)
[WARN] AI slop detected: empty_emphasis (2 occurrences)
```

### 設計根拠

- `[WARN]`プレフィックス: 既存のブラケットタグ慣例([TRIVIAL]/[MODERATE]/[CRITICAL])と同系統
- カテゴリ名を明示: LLMが具体的にどの表現を避けるべきか判断可能にする
- 出現回数を明示: 閾値(2回)との関係を確認可能にする
- passed=true維持: ワークフローを停止させず改善を促す非ブロック動作

### evidence生成ロジック

入力: カテゴリ名(string), 出現回数(number)
出力: `[WARN] AI slop detected: ${category} (${count} occurrences)`
条件: 同一カテゴリで count >= 2 の場合のみ生成

### 複数カテゴリ検出時

evidenceは改行区切りで連結される。DoDCheckResult.evidenceは単一文字列のため、複数警告は改行で結合する。

```
Content validation passed.\n[WARN] AI slop detected: hedging (3 occurrences)\n[WARN] AI slop detected: vague_connectors (2 occurrences)
```

### カテゴリ名の表示仕様

| 内部名 | evidence表示名 | 検出対象例 |
|--------|---------------|-----------|
| hedging | hedging | "it is important to note that" |
| empty_emphasis | empty_emphasis | delve, tapestry, seamless |
| redundant_preamble | redundant_preamble | certainly, "as an ai" |
| vague_connectors | vague_connectors | "in today's digital", "landscape of" |

表示名はスネークケースのまま使用する。LLM向け出力であり人間向けラベルは不要。

## P4: コードフェンス検出警告出力

### evidence形式(passed=true時に追加)

```
[WARN] Code fence detected in planning artifact: planning.md (line 42)
```

### 設計根拠

- ファイル名を明示: どのファイルを修正すべきか特定可能にする
- 行番号を明示: LLMが該当箇所を直接参照可能にする
- "planning artifact"を明記: planningフェーズ固有のルールであることを示す

### evidence生成ロジック

入力: ファイル名(string), 行番号(number)
出力: `[WARN] Code fence detected in planning artifact: ${fileName} (line ${lineNumber})`
条件: noCodeFences=trueのフェーズかつ拡張子が.mmdでないファイルでCODE_FENCE_REGEX一致時

### 複数検出時

ファイルごとに1行ずつ生成する。

```
Content validation passed.\n[WARN] Code fence detected in planning artifact: planning.md (line 12)\n[WARN] Code fence detected in planning artifact: planning.md (line 45)
```

### .mmdファイル除外時の表示

除外時はevidenceに何も追加しない。デバッグログも不要(正常動作のため)。

## P5: 方向転換提案出力

### pivot提案の出力位置

buildDoDFailureResponseのレスポンスオブジェクトに`pivotSuggestion`フィールドとして追加する。

```
{
  error: "DoD checks failed. Fix the following issues before advancing.",
  dodChecks: [...],
  errors: [...],
  retry: { retryPrompt: "...", ... },
  pivotSuggestion: "同一L4エラーが3回連続発生。..."
}
```

### pivotSuggestion文字列形式

```
同一L4エラーが${consecutiveCount}回連続発生。現在のアプローチを変更してください。
パターン: "${pattern}"
提案: ${suggestion}
```

### errorClass別提案テンプレート

| errorClass | 提案文 |
|-----------|--------|
| forbidden_word | 禁止語を含む表現を根本的に書き直してください。部分置換ではなく段落全体を再構成してください |
| duplicate_content | 成果物の構造を見直してください。重複が発生する根本原因(コピー&ペースト、テンプレート未カスタマイズ)を特定してください |
| missing_field | 必須フィールドの一覧を確認し、出力テンプレートを使用してください |
| toon_parse | TOON形式の構文を確認してください。Markdownヘッダ(#)やネストされたキーがないか確認してください |
| content_quality | 成果物の内容を具体化してください。抽象的な記述を具体的な技術仕様に置き換えてください |
| default | 前回と異なるアプローチを検討してください。同一手法の反復は同一結果を生みます |

### 設計根拠

- consecutiveCountを明示: LLMに繰り返し失敗の深刻度を伝える
- patternを引用表示: 何が繰り返されているか特定可能にする
- 提案は具体的行動指示: LLMが即座に実行可能なレベルの指示にする
- nullの場合(3回未満): pivotSuggestionフィールド自体を省略する

### phase-errors.toon読み取り不可時

buildPivotResponseがnullを返し、pivotSuggestionフィールドは省略される。ワークフロー停止しない。

## P6: AC数不足エラー出力

### evidence形式(passed=false時)

```
AC count ${actual} is below minimum ${MIN_ACCEPTANCE_CRITERIA}
```

具体例:

```
AC count 3 is below minimum 5
```

### fix形式

```
Add at least ${MIN_ACCEPTANCE_CRITERIA - actual} more acceptance criteria to meet the minimum of ${MIN_ACCEPTANCE_CRITERIA}
```

具体例:

```
Add at least 2 more acceptance criteria to meet the minimum of 5
```

### 設計根拠

- 現在数と必要最低数を両方明示: LLMが不足数を計算せずに済む
- fix文に追加必要数を明記: 具体的な行動量を提示する
- MIN_ACCEPTANCE_CRITERIA定数を使用: 将来の閾値変更時にメッセージも自動追従する

### approval.tsのエラーメッセージ

```
AC count (${acCount}) below minimum ${MIN_ACCEPTANCE_CRITERIA}. Add more acceptance criteria before approval.
```

### ガイダンスメッセージ(6箇所)

全て"最低3件"→"最低5件"、"minimum 3"→"minimum 5"に統一更新する。定数参照ではなくリテラル文字列での更新(ガイダンス文字列内のため)。

## P7: 重複行チェック除外パターン表示

### 概要

既存のcheckDuplicateLines関数はisStructuralLine()で除外判定を行う。P7はデバッグ時に除外されたパターンを可視化する仕組みを定義する。

### 現在の除外パターン(isStructuralLine)

| パターン | 除外理由 |
|---------|---------|
| `^#{1,6}\s` | Markdownヘッダは構造要素 |
| `^[-*_]{3,}\s*$` | 水平線は構造要素 |
| `` ^`{3,} `` | コードフェンスマーカーは構造要素 |
| `^\|[\s\-:\|]+\|$` | テーブル区切り行は構造要素 |
| `^\|.+\|.+\|` | テーブルデータ行は構造要素 |
| `^\*\*[^*]+\*\*[::]?\s*$` | 太字ラベル行は構造要素 |
| `^[-*]\s+\*\*[^*]+\*\*[::]?\s*$` | リスト内太字ラベルは構造要素 |
| `^(?:[-*]\s+)?.{1,50}[::]?\s*$` | 短いラベル:値行は構造要素 |

### デバッグ出力形式

通常運用時は出力しない。テスト実行時のみ使用する。checkDuplicateLines関数の戻り値を拡張するのではなく、テストコード内でisStructuralLine関数を直接テストする方式を採用する。

### テストでの検証形式

```typescript
// isStructuralLineの除外パターン検証
expect(isStructuralLine('## Section Header')).toBe(true);   // Markdownヘッダ
expect(isStructuralLine('| col1 | col2 |')).toBe(true);     // テーブル行
expect(isStructuralLine('This is normal text')).toBe(false); // 通常テキスト
```

### 設計根拠

- 本番出力への影響なし: デバッグ情報は本番のDoDCheckResultに含めない
- isStructuralLineのexport: テストから直接アクセス可能にする(既にexport済み)
- 除外理由はテストケースの命名で表現: テスト名に"excludes markdown headers as structural"のように記述

## cross-cutting-concerns

### [WARN]プレフィックス規約

P3とP4で導入する`[WARN]`プレフィックスの統一規約:

- 形式: `[WARN] {検出内容}: {詳細}`
- 使用条件: passed=trueの場合のみ。passed=falseのチェックでは使用しない
- 位置: evidence文字列内。通常のevidenceメッセージの後に改行で追加
- LLMへの影響: 改善を促すが再試行を強制しない

### evidence文字列の構成順序

```
{通常のevidenceメッセージ}
[WARN] {P3: AI slop警告(あれば)}
[WARN] {P4: コードフェンス警告(あれば)}
```

### 文字列連結パターン

evidence配列をフィルタして改行結合する共通パターン:

```
const parts = [baseEvidence, ...warnings].filter(Boolean);
return parts.join('\n');
```

## ac-trace

| 設計項目 | 関連AC |
|---------|--------|
| P3 evidence形式 | AC-2 |
| P3 カテゴリ表示 | AC-1 |
| P4 evidence形式 | AC-8 |
| P4 .mmd除外時の非表示 | AC-9 |
| P5 pivotSuggestion形式 | AC-13, AC-14 |
| P5 null時の省略 | AC-14 |
| P6 evidence/fix形式 | AC-18 |
| P6 approval.tsメッセージ | AC-17 |
| P7 isStructuralLineコードフェンス除外 | AC-21 |
| P7 isStructuralLine Mermaid構文除外 | AC-22 |
| P7 isStructuralLine テーブル区切り除外 | AC-23 |

## decisions

- [UD-1][decision] [WARN]プレフィックスをP3/P4共通の非ブロック警告形式として採用。既存ブラケットタグ慣例と整合
- [UD-2][decision] P5 pivotSuggestionはレスポンスオブジェクトの独立フィールドとして追加。evidence内に埋め込まない
- [UD-3][decision] P6メッセージは定数値を文字列補間で埋め込み。将来の閾値変更に自動追従
- [UD-4][decision] P7デバッグ情報は本番出力に含めず、テストコード内でisStructuralLineを直接検証する方式
- [UD-5][decision] evidence文字列内の複数警告は改行区切りで連結。配列ではなく単一文字列(DoDCheckResult.evidence型制約)

## artifacts

- docs/workflows/article-insights-harness-improvements/ui-design.md: 本UI設計文書

## next

readyForImplementation: true
implementationNotes: "P3/P4の[WARN]形式、P5のpivotSuggestionフィールド、P6の定数補間メッセージを実装計画に反映済み"
