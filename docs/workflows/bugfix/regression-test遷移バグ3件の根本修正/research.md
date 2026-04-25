# regression_test遷移バグ3件の根本修正 - 調査結果

## サマリー

本ドキュメントはFR-R6修正時に発見された3つのバグの根本原因をコード調査した結果をまとめたものである。
調査対象は `record-test-result.ts`（行420-492）、`next.ts`（行340-360）、`test-authenticity.ts`の全文である。

- 目的: regression_testフェーズからparallel_verificationへの遷移が常にブロックされる問題の根本原因を特定すること
- 主要な決定事項: 3つのバグはそれぞれ独立した原因を持ち、個別に修正が必要である
- 次フェーズで必要な情報: 各バグの修正方針と影響範囲（3ファイル、計3箇所の変更）

---

## バグ1: testOutputHash自己参照バグ（最重要）

### 根本原因の特定

`record-test-result.ts` の行422に以下のコードが存在する。

```typescript
const existingHashes = currentPhase === 'regression_test' ? [] : (taskState.testOutputHashes || []);
```

この行の意図は「regression_testフェーズでは同一ハッシュの再記録を許可する（修正前後の比較用）」というコメントが示す通り、
testingフェーズで使った出力と同じ内容をregression_testフェーズで再投入できるようにすることである。
しかし、行484に以下のコードがあり、問題が発生する。

```typescript
const updatedHashes = [...existingHashes, hashValidation.hash];
```

`existingHashes` は空配列なので、`updatedHashes` は `[newHash]` の1要素配列になる。
この配列が `testOutputHashes` フィールドとして状態に書き込まれる（行489）。

### next.tsでの問題連鎖

`next.ts` の行343-344に以下のコードがある。

```typescript
const existingHashes = taskState.testOutputHashes || [];
const hashResult = recordTestOutputHash(testResult.output, existingHashes);
```

`workflow_next` が `regression_test` フェーズから遷移しようとするとき、
`testState.testOutputHashes` にはすでに `record-test-result.ts` が保存した
`[newHash]` が含まれている。
`recordTestOutputHash(output, existingHashes)` は `existingHashes.includes(hash)` を評価するため、
同じ出力を使って遷移しようとすると常に「重複あり」と判定される。

### 問題の本質

`record-test-result.ts` がregression_testフェーズでハッシュを空配列ベースで計算・保存するが、
`next.ts` はそのハッシュを含む配列全体を使って重複チェックを行う。
この2つの処理が組み合わさると、regression_testフェーズでは記録した直後に遷移しようとすれば
必ず重複検出される状態になる。これはregression_testフェーズ専用の重複チェック除外ロジックが
`record-test-result.ts` にはあるが `next.ts` には存在しないことによる非対称設計が原因である。

### 修正方針（バグ1）

方針A: `next.ts` の行342-350のハッシュ重複チェックブロック全体を regression_testフェーズでは
スキップするよう条件分岐を追加する。これが最小変更で最も安全な修正である。
つまり `if (testResult.output && currentPhase !== 'regression_test')` のようなガードを設ける。

方針B: `record-test-result.ts` でregression_testフェーズでも既存のハッシュを取得し、
新しいハッシュのみを追加するが `next.ts` の重複チェックをregression_testでは無効化する。
方針Aと実質同じだが、記録側の挙動も変える点が異なる。

推奨は方針Aである。`next.ts` の該当ブロック（行342-350）にregression_testフェーズの
除外条件を追加するだけで済むため変更範囲が最小限となる。

---

## バグ2: テスト出力のfalse positive（「0 failed」問題）

### 根本原因の特定

`record-test-result.ts` の行148-171に行単位フィルタリングロジックが実装されている。
カテゴリA（集計行）として `SUMMARY_PREFIXES = ['Tests:', 'Test Files', 'Test Suites:', 'Summary']`
が定義されており、これらで始まる行はキーワード検出対象に残される。

問題は vitest の典型的な出力である以下の行にある。

```
Tests  73 passed | 0 failed (73)
```

この行は `Test Files`（末尾に空白がないプレフィックス）で始まらないが、
`Tests` プレフィックスは `SUMMARY_PREFIXES` に含まれている（`'Tests:'` はコロン付き）。
`Tests` の後ろにスペースが続く形式は `trimmed.startsWith('Tests:')` に一致しない。
したがってカテゴリDとして処理され、キーワード検出の対象となる。

行201-207の小文字キーワード処理コードでは：

```typescript
const pattern = new RegExp(`\\b${kw}\\b`, 'i');
return pattern.test(filteredOutput);
```

`kw = 'failures'` の場合は `\bfailures\b` でマッチするため、
`"0 failed (73)"` 内の `failed` は `\bfailed\b` でヒットする可能性がある。

しかし実際の誤検出経路は `BLOCKING_FAILURE_KEYWORDS` 内の `'FAILED'`（大文字）である。
行180の大文字キーワード処理では `isKeywordNegated(output, kw.toLowerCase())` を呼ぶが、
`isKeywordNegated` は `isUpperCase` の場合 `output`（全文）に対してチェックし、
一方でフィルタリング後の `filteredOutput` を使ってマッチを行う。
`"Tests  73 passed | 0 failed (73)"` という行が filteredOutput に含まれる場合、
大文字で始まる `Failed` パターンとしてはマッチしないはずだが、
行178の条件では `isKeywordNegated(output, kw.toLowerCase())` に `kw='FAILED'` を渡すため
引数は `'failed'` であり、逆向きパターン `\bfailed[:\s]+(0|no|zero|without)\b` が
`"failed (73)"` に一致しない（丸括弧のため単語境界ではある）。

より具体的な誤検出は `'failures'` や `'failing'`（小文字キーワード）で起きる。
否定語チェックは `isKeywordNegated(output, kw)` を全体出力で実行するが、
`"0 failed"` という表現は `kw = 'failures'` とは形態が異なるため否定と判定されない。
ここに false positive の余地が生じる。

### 修正方針（バグ2）

`SUMMARY_PREFIXES` に `'Tests'`（コロンなし・スペース区切り）を追加し、
`trimmed.startsWith('Tests ')` としてマッチさせることでvitest形式の集計行をカテゴリAに入れる。
あるいは `isKeywordNegated` に数字ゼロ以外の数値（例: `"0 failed"`）も否定パターンとして
認識させるロジックを追加する。最もシンプルな修正は前者であり、
`SUMMARY_PREFIXES` 配列への `'Tests '`（末尾スペース付き）の追加で対応可能である。

---

## バグ3: テスト出力切り詰め問題

### 根本原因の特定

`record-test-result.ts` の行25と行469に以下の定数と処理がある。

```typescript
const MAX_OUTPUT_LENGTH = 500;
// ...（行469）
const truncatedOutput = output.length > MAX_OUTPUT_LENGTH ? output.slice(-MAX_OUTPUT_LENGTH) : output;
```

上限文字数が500文字と非常に小さく、末尾500文字のみ保存される仕組みになっている。
`output.slice(-MAX_OUTPUT_LENGTH)` は末尾を保持するため、テスト数の集計行が
出力の先頭部分に出力されるフレームワーク（vitestのTest Files行等）では
その情報が失われる。

`validateTestAuthenticity` は `record-test-result.ts` が保存した `truncatedOutput` ではなく
`workflow_next` が呼ばれる際に取得した `testResult.output` を使う（`next.ts` 行252-253）。
しかし `testResult.output` は状態に保存された `truncatedOutput` であるため、
すでに先頭が切り詰められた状態のものである。

`test-authenticity.ts` の行59-70のパターンマッチングでは：

```typescript
/Test Files\s+(?:\d+\s+failed\s*\|\s*)?(\d+)\s+passed/i,
```

このパターンは vitest の `"Test Files  73 passed (73)"` のような行にマッチするが、
出力の先頭に現れるこの行が500文字制限で切り捨てられていると、
テスト総数の抽出に失敗する。結果として `testCount === null` となり
「テスト出力からテスト数を抽出できませんでした」エラーが返される。

### 問題の波及

`test-authenticity.ts` の行90-113の判定フローを確認すると、
`looksLikeTestOutput` が true かつ `hasFrameworkStructure` が true で
`testCount` が null の場合、行108-112で validation が失敗する。
これは `next.ts` の行253-265の真正性チェックでブロックとなる。

### 修正方針（バグ3）

方針A: `MAX_OUTPUT_LENGTH` を大幅に増やす（例: 5000文字）。
最も直接的だが、保存データ量が増加するトレードオフがある。

方針B: 保存時に末尾ではなく「先頭部分」を保持するよう変更する（`output.slice(0, MAX_OUTPUT_LENGTH)` に変更）。
テスト集計行は通常出力の末尾より先頭付近に存在するため、より適切な切り詰め方向である。
ただしスタックトレース等は末尾に集まるため情報損失の種類が変わる。

方針C: 先頭と末尾の両方を一定量ずつ保存する（例: 先頭250文字 + 末尾250文字）。

方針D: `record-test-result.ts` が保存する `truncatedOutput` と、
真正性検証用にフルサイズのハッシュ・テスト数だけを別フィールドに保持し、
`next.ts` の検証では保存済みの数値のみを使う設計に変更する。
これが根本的な解決策だが変更範囲が最大となる。

推奨は方針Bである。`output.slice(-MAX_OUTPUT_LENGTH)` を
`output.slice(0, MAX_OUTPUT_LENGTH)` に変更するだけの最小変更で、
テスト集計行（通常先頭付近）の保持が保証される。
あるいはMAX_OUTPUT_LENGTHを5000文字程度に拡大する方針Aも現実的な選択肢である。

---

## 調査対象ファイルの位置関係

3つのバグは以下の3つのファイルにまたがっており、相互に依存関係がある。

- `workflow-plugin/mcp-server/src/tools/record-test-result.ts`: バグ1・バグ3の発生源
- `workflow-plugin/mcp-server/src/tools/next.ts`: バグ1の重複チェック箇所（行342-350）
- `workflow-plugin/mcp-server/src/validation/test-authenticity.ts`: バグ2・バグ3の検証ロジック

バグ1とバグ3は連鎖しており、バグ3で出力が切り詰められるとバグ1の前に
真正性検証（バグ3由来）でブロックされる可能性がある。
実際の遷移失敗はバグ1またはバグ3のどちらが先に発動するかで異なる。
バグ2は独立したfalse positiveであり、正常なテスト出力を誤って失敗と判定するシナリオで発生する。

---

## 修正優先度と影響範囲

バグ1（testOutputHash自己参照）は `next.ts` の1箇所の条件追加で解決可能であり、
影響範囲が最小かつ再現性が確実なため最優先で修正すべきである。

バグ3（出力切り詰め）は `record-test-result.ts` の `MAX_OUTPUT_LENGTH` 定数の変更または
`slice` の方向変更のみで対応可能であり、2番目に対応すべきである。

バグ2（false positive）は発生条件が限定的（特定のフレームワーク出力形式）であり、
`SUMMARY_PREFIXES` への1エントリ追加で対応可能なため3番目に対応する。

全ての修正はMCPサーバーの再ビルドと再起動が必要であることに注意する。
変更対象ファイルはコアモジュールではないためHMAC整合性への影響はないが、
Node.jsモジュールキャッシュにより再起動しないと変更が反映されない。
