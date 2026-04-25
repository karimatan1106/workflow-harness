# P6 AC最低数変更(3->5) 影響分析レポート

## TOON形式サマリ

ac_check_locations: dod-l4-requirements.ts:61, approval.ts:57, approval.ts:63
ac_literal_3_count: 7箇所(ソース) + 10箇所(テスト) = 計17箇所
task_size_ac_rules: なし。TaskSize='large'のみ(types-core.ts:60)。small/mediumは廃止済み。AC閾値はサイズ非依存。
test_impact_summary: 5ファイル13箇所。dod-l4-requirements.test.ts(6箇所), handler-misc-ia2.test.ts(3箇所), handler-parallel.test.ts(2箇所), handler-approval.test.ts(1箇所), dod-test-helpers.ts(デフォルト値)
constant_import_chain: dod-l4-requirements.ts(定義) -> approval.ts(import), retry.ts(正規表現のため定数化不可、文字列更新必要), toon-skeletons-a.ts(テンプレート文字列のため手動更新)
small_task_impact: 影響なし。TaskSizeは'large'固定(types-core.ts:60, lifecycle-start-status.ts:47)。small/mediumは型定義・ランタイムとも廃止済み。
breaking_change_risk: 低。進行中タスクのうちrequirementsフェーズ未通過のものはAC5件必要になるが、既にrequirements承認済みのタスクには影響しない。AC数チェックはrequirementsフェーズDoD(dod-l4-requirements.ts)とrequirements承認時(approval.ts)のみで実行される。

## 詳細分析

### 1. AC数チェック箇所(ソースコード)

| # | ファイル | 行 | コード | 役割 |
|---|---------|-----|--------|------|
| S1 | gates/dod-l4-requirements.ts | 61 | `if (acCount < 3)` | DoD L4ゲート: requirements.md内のAC-N数を検証 |
| S2 | gates/dod-l4-requirements.ts | 64 | `minimum 3 required`, `${3 - acCount}` | エビデンスメッセージ |
| S3 | gates/dod-l4-requirements.ts | 65 | `最低3件` | fix文字列 |
| S4 | gates/dod-l4-requirements.ts | 69 | `minimum 3 met` | 成功エビデンス |
| S5 | tools/handlers/approval.ts | 57 | `if (acCount < 3)` | IA-2: requirements承認ブロック |
| S6 | tools/handlers/approval.ts | 58 | `at least 3 acceptance criteria` | エラーメッセージ |
| S7 | tools/handlers/approval.ts | 63 | `length >= 3` | refinedIntent生成の閾値 |

### 2. 関連箇所(メッセージ・テンプレート)

| # | ファイル | 行 | 内容 |
|---|---------|-----|------|
| M1 | phases/toon-skeletons-a.ts | 147 | `acceptanceCriteriaは最低3件必須` |
| M2 | tools/retry.ts | 93 | 正規表現 `/AC-N entries.*minimum 3/i` |
| M3 | tools/retry.ts | 94 | `最低3件のAC-N形式` |

### 3. テスト影響箇所

| # | ファイル | 行 | 変更内容 |
|---|---------|-----|---------|
| T1 | dod-l4-requirements.test.ts | 26,28,33 | 失敗ケース: acCount:2->4, 説明文更新 |
| T2 | dod-l4-requirements.test.ts | 36,38,43 | 成功ケース: acCount:3->5, アサーション更新 |
| T3 | dod-l4-requirements.test.ts | 84,96,106 | intent consistencyテスト: acCount更新+TOON文字列内AC追加 |
| T4 | handler-misc-ia2.test.ts | 30,41,47 | IA-2テスト: 説明文+acCount+アサーション更新 |
| T5 | handler-misc-ia2.test.ts | 51,62 | 成功ケース: ループ回数3->5 |
| T6 | handler-parallel.test.ts | 46-54 | ループ回数3->5, AC-4,AC-5追加 |
| T7 | handler-parallel.test.ts | 65-68,85-92 | requirements.md内AC行+RTM行追加 |
| T8 | handler-approval.test.ts | 75-83 | ループ回数3->5 |
| T9 | dod-test-helpers.ts | 102 | デフォルト値 `acCount = 3` -> `acCount = 5` |

### 4. タスクサイズとAC閾値の関係

TaskSizeは現在`'large'`のみ(types-core.ts:60)。small/mediumは型レベルで廃止済み。
lifecycle-start-status.ts:47で`const size: TaskSize = 'large'`とハードコードされている。
handler-shared.ts:39の`shouldRequireApproval`はsize引数を受け取るが未使用(`_size`)。
AC最低数はサイズに依存しない単一閾値。サイズ別ACルールは存在しない。

### 5. 定数化インポートチェーン

推奨定義場所: `gates/dod-l4-requirements.ts`
```
gates/dod-l4-requirements.ts (export const MIN_ACCEPTANCE_CRITERIA = 5)
  <- tools/handlers/approval.ts (import)
```
定数化できない箇所:
- tools/retry.ts: 正規表現パターン内のため手動更新が必要
- phases/toon-skeletons-a.ts: テンプレートリテラル内のため手動更新が必要

### 6. 破壊的変更リスク評価

リスク: 低
- AC数チェックはrequirementsフェーズのDoD(harness_next時)とrequirements承認(harness_approve時)のみで実行
- 既にrequirementsフェーズを通過済みのタスクには遡及しない
- 変更影響はworkflow-harnessサブモジュール内に完全に閉じている
- 親リポジトリ側の変更は不要
