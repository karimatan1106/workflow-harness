# P6: AC最低数変更(3->5) 実装調査レポート

## 1. AC数チェックの定義箇所

### 1-1. メインゲートチェック (DoD L4)
- ファイル: `workflow-harness/mcp-server/src/gates/dod-l4-requirements.ts`
- 行番号: 61
- コード: `if (acCount < 3) {`
- 定義方法: **リテラル直書き** (定数化されていない)
- チェック名: `ac_format`
- 適用フェーズ: `requirements` フェーズのみ (L45行で分岐)

### 1-2. 承認ハンドラチェック (IA-2)
- ファイル: `workflow-harness/mcp-server/src/tools/handlers/approval.ts`
- 行番号: 57
- コード: `if (acCount < 3) {`
- 定義方法: **リテラル直書き**
- 役割: requirements承認時にAC数が不足していれば承認をブロック

### 1-3. refinedIntent生成の閾値
- ファイル: `workflow-harness/mcp-server/src/tools/handlers/approval.ts`
- 行番号: 63
- コード: `task.acceptanceCriteria.length >= 3`
- 役割: AC数が閾値以上の場合にrefinedIntentを生成

## 2. 変更が必要なファイル一覧 (ソースコード)

| # | ファイルパス | 行 | 変更内容 |
|---|-------------|-----|---------|
| 1 | `src/gates/dod-l4-requirements.ts` | 61 | `< 3` -> `< 5` |
| 2 | `src/gates/dod-l4-requirements.ts` | 64 | エビデンス文字列内の `minimum 3` と `${3 - acCount}` |
| 3 | `src/gates/dod-l4-requirements.ts` | 65 | fix文字列内の `最低3件` |
| 4 | `src/gates/dod-l4-requirements.ts` | 69 | エビデンス文字列内の `minimum 3` |
| 5 | `src/tools/handlers/approval.ts` | 57 | `< 3` -> `< 5` |
| 6 | `src/tools/handlers/approval.ts` | 58 | エラーメッセージ内の `at least 3` |
| 7 | `src/tools/handlers/approval.ts` | 63 | `>= 3` -> `>= 5` |

## 3. 変更が必要なファイル一覧 (ドキュメント・テンプレート・ガイダンス)

| # | ファイルパス | 行 | 変更内容 |
|---|-------------|-----|---------|
| 8 | `src/phases/toon-skeletons-a.ts` | 147 | `最低3件必須` -> `最低5件必須` |
| 9 | `src/phases/defs-stage1.ts` | 91 | `最低3件定義` -> `最低5件定義` |
| 10 | `src/phases/defs-stage1.ts` | 96 | `最低3件の受入基準` -> `最低5件の受入基準` |
| 11 | `src/tools/phase-analytics.ts` | 126 | `最低3件` -> `最低5件` |
| 12 | `src/tools/retry.ts` | 93 | 正規表現 `minimum 3` -> `minimum 5` |
| 13 | `src/tools/retry.ts` | 94 | `最低3件` -> `最低5件` |

## 4. テストファイルでの影響箇所

| # | ファイルパス | 行 | 変更内容 |
|---|-------------|-----|---------|
| T1 | `src/__tests__/dod-l4-requirements.test.ts` | 26 | テスト説明文 `fewer than 3` -> `fewer than 5` |
| T2 | `src/__tests__/dod-l4-requirements.test.ts` | 28 | `acCount: 2` -> 失敗ケースは `acCount: 4` に変更 |
| T3 | `src/__tests__/dod-l4-requirements.test.ts` | 33 | `only 2` のアサーション更新 |
| T4 | `src/__tests__/dod-l4-requirements.test.ts` | 36 | テスト説明文 `3 or more` -> `5 or more` |
| T5 | `src/__tests__/dod-l4-requirements.test.ts` | 38 | `acCount: 3` -> `acCount: 5` |
| T6 | `src/__tests__/dod-l4-requirements.test.ts` | 43 | アサーション `'3'` -> `'5'` |
| T7 | `src/__tests__/dod-l4-requirements.test.ts` | 84 | intent consistencyテストの `acCount: 3` -> `acCount: 5` |
| T8 | `src/__tests__/dod-l4-requirements.test.ts` | 96 | `acceptanceCriteria[3]` -> `acceptanceCriteria[5]` (TOON内) + AC-4, AC-5追加 |
| T9 | `src/__tests__/dod-l4-requirements.test.ts` | 106 | intent consistencyパスのテスト `acCount: 3` -> `acCount: 5` |
| T10 | `src/__tests__/handler-misc-ia2.test.ts` | 41 | コメント `less than minimum 3` -> `less than minimum 5` |
| T11 | `src/__tests__/handler-misc-ia2.test.ts` | 47 | `at least 3 acceptance criteria` -> `at least 5 acceptance criteria` |
| T12 | `src/__tests__/handler-parallel.test.ts` | 46 | コメント `minimum 3` -> `minimum 5` (+ AC-4, AC-5のharness_add_ac呼び出し追加が必要) |
| T13 | `src/__tests__/handler-approval.test.ts` | 75 | コメント `minimum 3` -> `minimum 5` (+ AC-4, AC-5のharness_add_ac呼び出し追加が必要) |

## 5. 定数化の推奨

現在、`3` はすべて **リテラル直書き** (13箇所のソース + 13箇所のテスト)。
定数化すると変更箇所が大幅に削減される。

推奨: `src/gates/dod-l4-requirements.ts` に以下の定数を定義し、`approval.ts` からもインポートする。

```typescript
export const MIN_ACCEPTANCE_CRITERIA = 5;
```

これにより、ソースコード側の変更箇所はメッセージ文字列のみとなる。

## 6. 変更時の注意事項

1. **retry.ts の正規表現**: `minimum 3` をハードコードで正規表現マッチしている(L93)。定数化しても正規表現パターンの更新が必要。
2. **テストのACデータ追加**: 多くのテストが `acCount: 3` でパスケースを構築しているため、`acCount: 5` に変更すると `buildValidRequirementsToon` ヘルパーが AC-4, AC-5 を生成する必要がある(ヘルパー側の `acCount` パラメータで動的生成されるなら変更不要の可能性あり)。
3. **handler-parallel.test.ts / handler-approval.test.ts**: テスト内で `harness_add_ac` を3回呼んでいる箇所は5回に増やす必要がある。
4. **TOON形式の shortContent** (L96): テスト内にTOON形式の文字列リテラルが直書きされており、AC-1~AC-3 の3件しかないため AC-4, AC-5 を追加する必要がある。
5. **promptfoo.yaml** (eval): `decisions array must have at least 3 items` という記述があるが、これはdecisionsの閾値でありAC数とは無関係。変更不要。
6. **影響範囲は workflow-harness サブモジュール内に閉じている**。親リポジトリ側の変更は不要。
