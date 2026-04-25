# 脅威モデル - ワークフロー実行時バグ根本原因分析と修正

## サマリー

本ドキュメントは、`next.ts` のデッドコード削除（FR-1）および import 文整理（FR-2）に伴うセキュリティ上の脅威を分析する。
分析の目的は、コードの整理作業が既存のテスト真正性検証ロジックや regression_test フェーズの遷移制御に悪影響を与えないことを確認することにある。

主要な決定事項として、デッドコード削除はテスト真正性検証ロジックに影響しないと判断した。`recordTestOutputHash` の import 削除は未使用コード除去に過ぎず、機能変更を伴わない。ハッシュ重複チェックの実際の制御は `record-test-result.ts` が担当しており、`next.ts` 側の変更は機能的に無影響である。

次フェーズで必要な情報として、変更対象は `next.ts` の 2 箇所（line 336-346 のデッドコードブロックと line 28 の import 文）に限定され、4 つの脅威（T-1 から T-4）は全て「許容範囲内」と評価されている。
緩和策として TypeScript コンパイルおよび Grep による import 残存確認を実施する方針であり、追加のセキュリティ対策は不要と判断した。

---

## 変更概要と影響範囲

今回の変更は次の 2 点からなる。

第一に、`next.ts` の regression_test フェーズハンドラー内（line 336-346）に存在するデッドコードブロックを削除する。
このブロックは `if (currentPhase !== 'regression_test')` という条件式で始まるが、
regression_test ブロック内に配置されているため、条件は常に false となり、
内部の `recordTestOutputHash` 呼び出しとエラーリターンは絶対に実行されない。

第二に、デッドコード削除後に `recordTestOutputHash` の import が未使用になるため、
line 28 の import 文から当該関数を削除する。

変更の範囲は `next.ts` 1 ファイル、削除行数は最大 12 行（デッドコードブロック 10 行 + import 変更 1-2 行）に限定される。

---

## 脅威分析：デッドコード削除の安全性

### 脅威 T-1: regression_test → parallel_verification 遷移ロジックの破損

**評価対象の変更**: `if (currentPhase !== 'regression_test')` ブロック全体の削除

**分析結果**: この条件式は regression_test ブロック内（`if (currentPhase === 'regression_test')`）に
ネストされており、論理的に `false` 以外にはなりえない。
JavaScript エンジンは条件評価を実施するが、内部コードは絶対に実行されないため、
削除前後で遷移ロジックの実行パスに変化はない。
テスト真正性検証（`validateTestAuthenticity`）はデッドコードの外側に存在し、
line 320-334 で正常に呼び出されており、削除の影響を受けない。

**残存リスクレベル**: 極めて低い。デッドコードの削除は実行パスを変更しない。

### 脅威 T-2: ハッシュ重複チェック機能の意図せぬ無効化

**評価対象の変更**: `recordTestOutputHash` 呼び出しコードの削除

**分析結果**: `record-test-result.ts` の line 422-423 において、regression_test フェーズ処理時に
空配列を渡す設計が既に適用されており、ハッシュ重複チェックの実質的な無効化は
`next.ts` のデッドコードではなく `record-test-result.ts` 側で実現済みである。
また、testing フェーズ（line 267-270）でも同様にハッシュ重複チェックがスキップされており、
この設計パターンは既存の正当な実装として機能している。
削除対象のコードは到達不能であるため、チェック機能の有効・無効を実際には制御していない。

**残存リスクレベル**: 低い。機能は `record-test-result.ts` 側で正しく管理されている。

### 脅威 T-3: import 文削除によるコンパイルエラーや型安全性の損失

**評価対象の変更**: `import { validateTestAuthenticity, recordTestOutputHash }` から
`recordTestOutputHash` を削除する変更

**分析結果**: `recordTestOutputHash` は next.ts 内で line 339 のデッドコードブロックにのみ
参照されており、他の箇所には存在しない（Grep 結果で確認済み）。
デッドコード削除後の import クリーンアップは、TypeScript コンパイラが検出する
「未使用 import」警告を解消する正当な変更であり、型安全性は維持される。
`validateTestAuthenticity` は testing および regression_test の両ブロックで引き続き使用されるため、
その import は維持しなければならない。

**残存リスクレベル**: 低い。適切な import 整理により、コンパイルエラーのリスクは除去される。

---

## 脅威分析：テスト真正性チェックの整合性

### 脅威 T-4: テスト真正性検証フローへの間接的影響

**評価対象**: `validateTestAuthenticity` と `recordTestOutputHash` の責務分離

**現状の設計**: `validateTestAuthenticity` はテスト出力のタイムスタンプや形式を検証し、
`recordTestOutputHash` はテスト出力のハッシュを記録してコピペを検出する。
これら 2 つの関数は独立した責務を持ち、共通の状態を共有していない。
次のフェーズ遷移を制御するのは `validateTestAuthenticity` であり、
`recordTestOutputHash` は補助的なハッシュ記録機能に過ぎない。

**分析結果**: デッドコード削除は `validateTestAuthenticity` の動作に影響しない。
regression_test フェーズでのテスト真正性検証（line 320-334）は変更後も正常に機能する。
`recordTestOutputHash` の実際の呼び出しは `record-test-result.ts` が担当しており、
そこに変更は加えない。

**残存リスクレベル**: 極めて低い。2 つの関数は独立して動作し、相互依存はない。

---

## 非対象の脅威（今回のスコープ外）

以下の事項は本タスクの修正対象外であるため、脅威分析の対象から除外する。

- RCA-2: `bash-whitelist.js` の `hasRedirection` 関数と regex パターンの差異は今回変更しない
- RCA-3: `task-index.json` と `workflow-state.json` の同期欠如は今回変更しない
- `test-authenticity.ts` 本体のロジックは今回変更しない
- `record-test-result.ts` の regression_test 向け空配列渡し設計は今回変更しない

---

## リスク評価マトリクス

変更全体のリスク評価を以下に示す。

| 脅威ID | 説明 | 発生可能性 | 影響度 | 総合リスク |
|--------|------|-----------|--------|-----------|
| T-1 | 遷移ロジックの破損 | 極めて低い | 高い | 許容範囲内 |
| T-2 | ハッシュチェック無効化 | 極めて低い | 中程度 | 許容範囲内 |
| T-3 | import 削除によるコンパイルエラー | 低い | 中程度 | 許容範囲内 |
| T-4 | 真正性検証フローへの影響 | 極めて低い | 高い | 許容範囲内 |

全脅威が「許容範囲内」であることを確認した。変更を実施しても既存の安全性は維持される。

---

## 緩和策と検証計画

各脅威に対する緩和策を次に示す。

T-1 および T-4 への緩和策として、変更後に TypeScript コンパイル（`npm run build`）を実施し、
エラーがないことを確認する。これにより構文上の問題を早期に検出できる。

T-2 への緩和策として、`record-test-result.ts` の regression_test 処理が空配列を渡す
設計を変更後も維持していることをコードレビューで確認する。
このファイルは今回の変更対象に含まれないため、設計変更のリスクはない。

T-3 への緩和策として、import 文の変更後に `next.ts` 内の全 `recordTestOutputHash` 参照を
Grep で確認し、残存する参照がゼロであることを検証する。
`validateTestAuthenticity` の import が削除されていないことも同時に確認する。

---

## 結論

今回の変更（デッドコード削除 + import 整理）はセキュリティ上のリスクを新たに導入しない。
デッドコードは実行されていなかったため、その削除は動作変更を伴わない。
ハッシュ重複チェックの実際の制御は `record-test-result.ts` が担当しており、
`next.ts` のデッドコード削除による影響を受けない。
変更後は TypeScript コンパイルによる検証と、Grep による import 残存確認を実施することで
リスクを最小化できる。
