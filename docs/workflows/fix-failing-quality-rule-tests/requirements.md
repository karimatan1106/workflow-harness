# Requirements: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## summary

coordinator, worker, hearing-workerの3つのagentファイルに品質ルール不足があり、first-pass-improvement.test.tsで7件、hearing-worker-rules.test.tsで3件、合計で既存テスト失敗10件を修正する。各ファイルに該当セクションを追加し、全テストをPASSさせる。

ユーザー意図原文: 既存テスト失敗10件を修正: first-pass-improvement.test.ts(7件)のcoordinator.md/worker.md品質ルール不足、hearing-worker-rules.test.ts(3件)のAskUserQuestion品質ルール不足。テストが期待するルールテキストをagent定義ファイルに追加する。

keywords: first-pass-improvement, coordinator, worker, hearing-worker, quality rules, test fix

## acceptanceCriteria

- AC-1: coordinator.mdにPhase Output Rulesセクションを追加し、TC-AC1-01〜04の4テストが全てPASS
  - decisions 5件以上を列挙するルール
  - artifacts 各成果物を列挙するルール
  - next 空欄禁止ルール
- AC-2: worker.mdにEdit Completenessセクションを追加し、TC-AC2-01〜03の3テストが全てPASS
  - 部分適用禁止ルール
  - 全件適用ルール
- AC-3: hearing-worker.mdにAskUserQuestion Quality Rulesセクションを追加し、TC-AC1-01, TC-AC2-01, TC-AC3-01の3テストが全てPASS
  - 確認のみの質問を禁止するルール
  - 2つ以上の異なるアプローチを提示するルール
  - メリットとデメリットを記載するルール
- AC-4: first-pass-improvement.test.tsの7件の失敗テストが全てPASSする
- AC-5: hearing-worker-rules.test.tsの3件の失敗テストが全てPASSする

## decisions

- D-001: 各セクションの文言はテストの正規表現パターンに合致させる（テスト駆動アプローチ）
- D-002: 既存セクションの内容は一切変更しない（追記のみの方針）
- D-003: 各ファイル200行制限を維持するため、追加内容は必要最小限に留める
- D-004: coordinator.mdのPhase Output Rulesは既存のRole/Contextセクションの後に配置する
- D-005: worker.mdのEdit CompletenessはEdit Modesセクションの後に配置する
- D-006: hearing-worker.mdのAskUserQuestion Quality RulesはAskUserQuestion Guidelinesの後に配置する
- D-007: テストコード自体には変更を加えない（テストが正であり、実装を合わせる方針）

## requirements

### F-001: coordinator.md Phase Output Rules

AC-1に対応。coordinator.mdに`## Phase Output Rules`セクションを追加する。

含めるルール:
- decisions: 5件以上を列挙すること
- artifacts: 各成果物を列挙すること
- next: 空欄禁止。次に進むフェーズを明示すること

テスト対応:
- TC-AC1-01: セクション見出し `## Phase Output Rules` の存在
- TC-AC1-02: `decisions.*5件以上` パターンの存在
- TC-AC1-03: `artifacts.*列挙` パターンの存在
- TC-AC1-04: `next.*空欄禁止` パターンの存在

### F-002: worker.md Edit Completeness

AC-2に対応。worker.mdに`## Edit Completeness`セクションを追加する。

含めるルール:
- 部分適用禁止: 変更指示の一部のみを適用することを禁止
- 全件適用: 指示された変更は全件適用すること

テスト対応:
- TC-AC2-01: セクション見出し `## Edit Completeness` の存在
- TC-AC2-02: `部分適用.*禁止` パターンの存在
- TC-AC2-03: `全件適用` パターンの存在

### F-003: hearing-worker.md AskUserQuestion Quality Rules

AC-3に対応。hearing-worker.mdに`## AskUserQuestion Quality Rules`セクションを追加する。

含めるルール:
- 確認のみの質問禁止: ユーザーに確認だけを求める質問は禁止
- 複数アプローチ提示: 2つ以上の異なるアプローチを提示すること
- メリット/デメリット記載: 各アプローチのメリットとデメリットを記載すること

テスト対応:
- TC-AC1-01: 確認のみ禁止パターンの存在
- TC-AC2-01: 2以上の異なるアプローチパターンの存在
- TC-AC3-01: メリット/デメリットパターンの存在

## notInScope

- defs-stage4.tsの変更（関連テストは既にPASS）
- 200行制限テスト（TC-AC4-01〜03は既にPASS）
- テストコード自体の修正
- 既存セクション内容の変更
- 新規テストの追加

## openQuestions

