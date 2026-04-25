# regression_test遷移バグ3件の根本修正 - 仕様書

## サマリー

本ドキュメントは `regression_test` フェーズから `parallel_verification` フェーズへの遷移が常にブロックされる3つのバグの修正仕様を定義する。
各バグの修正箇所は `next.ts`・`record-test-result.ts` の2ファイルに限定されており、合計5行の変更で完結する。

- 目的: regression_testフェーズで有効なテスト結果を記録した後に確実に遷移できるようにすること
- 主要な決定事項: 最小変更の方針（条件追加1行・定数変更1行・slice方向変更1行・プレフィックス追加1行）を採用する。`test-authenticity.ts` は変更しない
- 次フェーズで必要な情報: 各バグの修正箇所の行番号と具体的な変更内容（test_designフェーズでこの内容を参照してテストケースを設計する）

---

## 概要

本タスクはワークフロープラグインの `regression_test` フェーズに存在する3つの独立したバグを根本修正する。
これらのバグは連鎖して発現し、有効なテスト結果を記録した後でも `parallel_verification` フェーズへの遷移が常にブロックされるという現象を引き起こす。
research.mdの調査結果に基づき、バグ1（ハッシュ自己参照）・バグ2（false positive）・バグ3（出力切り詰め）の3つが特定された。

修正対象は `workflow-plugin/mcp-server/src/tools/` 配下の `next.ts` と `record-test-result.ts` の2ファイルに限定される。
`test-authenticity.ts` は変更対象から除外されており、バグ3の修正により入力品質を改善することで問題を解消する方針を採用している。
変更総量は実質5行（追加2行・変更3行）と最小限であり、既存の他フェーズの動作に影響を与えない安全な設計となっている。
修正完了後はMCPサーバーの再ビルドと再起動が必須であり、Node.jsモジュールキャッシュを更新しない限り変更が反映されない。

各バグの発生条件、修正要件、受け入れ基準を本仕様書で詳細化する。要件定義（requirements.md）との対応関係は各セクションの冒頭で明示する。

---

## 変更対象ファイル

本タスクで変更するファイルの一覧を以下に示す。変更範囲の制限として、コアモジュールへの変更は禁止されている。

| 対象ファイル | バグ | 変更行数 | 変更内容の概要 |
|------------|------|---------|--------------|
| `workflow-plugin/mcp-server/src/tools/next.ts` | バグ1 | 2行追加 | ハッシュ重複チェックをif文でラップしregression_testフェーズを除外する |
| `workflow-plugin/mcp-server/src/tools/record-test-result.ts` | バグ3 | 2行変更 | MAX_OUTPUT_LENGTHを500から5000へ、slice方向を末尾保持から先頭保持に変更する |
| `workflow-plugin/mcp-server/src/tools/record-test-result.ts` | バグ2 | 1行変更 | SUMMARY_PREFIXESに `'Tests '`（末尾スペース付き）を追加する |

変更対象外のファイルを以下に列挙する。これらのファイルは変更範囲の制限により修正禁止である。

- `workflow-plugin/mcp-server/src/tools/test-authenticity.ts` — バグ3の修正により入力品質が改善されるため変更不要
- `workflow-plugin/mcp-server/src/state-manager.ts` — HMAC整合性を管理するコアモジュールのため変更禁止。workflow-stateデータのシグネチャ計算を担う
- `workflow-plugin/mcp-server/src/artifact-validator.ts` — バリデーションロジックには変更が不要
- `workflow-plugin/mcp-server/src/phases/definitions.ts` — フェーズ定義への変更は影響範囲が広いため対象外

---

## 実装計画

バグの連鎖関係を考慮し、以下の順序で修正を適用することを推奨する。修正優先度は発生条件の頻発度と再現性に基づき設定されている。

### ステップ1: バグ3の修正（record-test-result.ts）

最初にバグ3（`record-test-result.ts` の定数・slice変更）を適用する。
具体的には行25の `MAX_OUTPUT_LENGTH = 500` を `MAX_OUTPUT_LENGTH = 5000` に変更し、
行469の `output.slice(-MAX_OUTPUT_LENGTH)` を `output.slice(0, MAX_OUTPUT_LENGTH)` に変更する。
この修正によりテスト集計行が先頭保持で正しく保存されるようになり、
`test-authenticity.ts` の真正性検証が正常に通過できるようになる。
保存後の状態データサイズは最大10倍（500→5000文字）になるが、過大にはならない設計とする。

### ステップ2: バグ2の修正（record-test-result.ts）

次にバグ2（`record-test-result.ts` のプレフィックス追加）を適用する。
行147の `SUMMARY_PREFIXES` 配列に `'Tests '` エントリを追加する。
この変更は1行の配列修正のみであり、vitestが出力する `"Tests  N passed | 0 failed (N)"` 形式の集計行を
カテゴリAとして正しく分類し、false positive（誤検出）を防止する。
`'Tests '` プレフィックスで始まる行はキーワードフィルタ対象から除外され、誤ってブロックされなくなる。

### ステップ3: バグ1の修正（next.ts）

最後にバグ1（`next.ts` の条件追加）を適用する。
行342のハッシュ重複チェックブロック全体を `if (testResult.output && currentPhase !== 'regression_test')` で囲む。
バグ3の修正後も、regression_testフェーズでは自己参照問題が残っているため、
このガード条件を追加することでハッシュチェックスキップが実現され、遷移が最終的に成功するようになる。

### ステップ4: ビルドと再起動

3ファイルの修正完了後、`workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行してトランスパイルを行う。
再起動要件として、ビルド完了後にMCPサーバープロセスを終了・起動し、Node.jsモジュールキャッシュを更新する。
再起動後は `workflow_status` MCPツールで現在フェーズを確認し、同フェーズから作業を再開する。

---

## バグ1: testOutputHash自己参照バグの修正仕様

### 機能要件との対応

requirements.mdの機能要件「バグ1: testOutputHash自己参照バグの修正」に対応する。
受け入れ基準として、regression_testフェーズで `workflow_record_test_result` APIを回呼した後に `workflow_next` が成功することを定義する。
既存挙動の維持として、testingフェーズでの重複チェックは変更しない。

### 問題の詳細

`next.ts` の行342-350のハッシュ重複チェックブロックは、regression_testフェーズにおいて自己参照問題を引き起こす。
`record-test-result.ts` の行422では `currentPhase === 'regression_test'` の場合に `existingHashes = []` として計算・保存するが、
その保存後に `workflow_next` が呼ばれると `next.ts` の行343で `testState.testOutputHashes` の配列全体を読み込む。
行344で `recordTestOutputHash(output, existingHashes)` を呼ぶと、`existingHashes` には先ほど記録した `newHash` が含まれており、
実行時に重複と判定されて遷移がブロックされるという挙動が発生する。
この非対称設計（記録側は除外ロジックあり、遷移チェック側は除外ロジックなし）が根本原因である。

### 修正対象ファイルと行番号

対象ファイル: `workflow-plugin/mcp-server/src/tools/next.ts`
修正箇所: 行342のハッシュ重複チェックブロック開始条件

### 変更前後のコード

変更前（行342の周辺）:

```typescript
// ハッシュ重複チェック
const existingHashes = taskState.testOutputHashes || [];
const hashResult = recordTestOutputHash(testResult.output, existingHashes);
if (!hashResult.valid && testStrict) {
  return {
    success: false,
    message: `リグレッションテスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。`,
  };
}
```

変更後（行342の周辺 - ハッシュ重複チェック全体をregression_testフェーズでスキップ）:

```typescript
// ハッシュ重複チェック（regression_testフェーズでは自己参照が発生するためスキップ）
if (testResult.output && currentPhase !== 'regression_test') {
  const existingHashes = taskState.testOutputHashes || [];
  const hashResult = recordTestOutputHash(testResult.output, existingHashes);
  if (!hashResult.valid && testStrict) {
    return {
      success: false,
      message: `リグレッションテスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。`,
    };
  }
}
```

### 変更の規模と後方互換性

変更規模: ブロック全体をif文で囲む（実質2行追加・1行変更）。行数変更は最小目標の範囲内である。
後方互換性への影響: testingフェーズで同一出力を2回提出した場合の重複チェックは従来通り機能し、既存挙動を維持する。
regression_testフェーズのみが影響を受け、そのフェーズではハッシュチェックスキップにより正常な遷移が可能になる。
セキュリティ上の影響は軽微である。regression_testフェーズはtestingフェーズの後続フェーズであり、
既にtestingフェーズで出力の真正性が検証済みであるため、regression_testでの再チェックは冗長であった。

---

## バグ3: テスト出力切り詰め問題の修正仕様

### 機能要件との対応

requirements.mdの機能要件「バグ3: テスト出力切り詰め問題の修正」に対応する。
本バグは修正優先度が高く、バグ1と連鎖して発現するため最初に対応する。
受け入れ基準として、5000文字超の出力が先頭保持で切り詰められ、先頭データの集計行が検証可能な状態で保持されることを定義する。

### 問題の詳細

`record-test-result.ts` の行25に定義された `MAX_OUTPUT_LENGTH = 500` が小さすぎる。
行469では `output.slice(-MAX_OUTPUT_LENGTH)` として末尾500文字のみを保存時に保持する実装になっている。
vitestが出力する `"Test Files  73 passed (73)"` などの集計行は出力の先頭付近に位置するが、
末尾保持の切り詰め方式ではその情報が失われる。末尾付近にはスタックトレースが出力されるため、
末尾保持設計は集計行の保持に適していない構成である。
その結果、`test-authenticity.ts` のパターンマッチングが入力テキストを見つけられずに失敗し、
「テスト出力からテスト数を抽出できませんでした」エラーが返され遷移がブロックされる。

### 修正対象ファイルと行番号

対象ファイル: `workflow-plugin/mcp-server/src/tools/record-test-result.ts`
修正箇所1: 行25の定数定義 `MAX_OUTPUT_LENGTH = 500`
修正箇所2: 行469の切り詰め処理 `output.slice(-MAX_OUTPUT_LENGTH)`

### 変更前後のコード

変更前（行25）:

```typescript
/** テスト出力の保存上限文字数（超過時は末尾のみ保存） */
const MAX_OUTPUT_LENGTH = 500;
```

変更後（行25）:

```typescript
/** テスト出力の保存上限文字数（超過時は先頭のみ保存） */
const MAX_OUTPUT_LENGTH = 5000;
```

変更前（行469）:

```typescript
const truncatedOutput = output.length > MAX_OUTPUT_LENGTH ? output.slice(-MAX_OUTPUT_LENGTH) : output;
```

変更後（行469）:

```typescript
const truncatedOutput = output.length > MAX_OUTPUT_LENGTH ? output.slice(0, MAX_OUTPUT_LENGTH) : output;
```

### 変更の規模と後方互換性

変更規模: 2行変更（定数値の変更とslice方向の変更）。各修正の行数変更は最小目標の範囲内である。
後方互換性への影響: workflow-stateファイルのoutputフィールドの保持文字数が増加するが、フィールド構成に変化はない。
状態ファイルの直接編集は不要であり、既存のデータ形式との互換性が維持される。
先頭保持に変更することで、スタックトレース等の末尾情報は切り詰められるが、
テスト集計行（通常先頭付近）の保持が保証される。500文字未満のテスト出力は切り詰めされない点は従来通り。

---

## バグ2: テスト出力false positiveの修正仕様

### 機能要件との対応

requirements.mdの機能要件「バグ2: テスト出力false positiveの修正」に対応する。
本バグは修正優先度が最も低く、発生条件が限定的であるため最後に対応する位置付けである。
受け入れ基準として、`'Tests '` プレフィックスが欠落した状態で誤検出されていた挙動が解消されることを定義する。

### 問題の詳細

`record-test-result.ts` の行147に定義された `SUMMARY_PREFIXES` 配列に `'Tests '`（末尾スペース付き）が含まれていない。
vitestが出力する `"Tests  73 passed | 0 failed (73)"` という集計行は `'Tests:'`（コロン付き）プレフィックスに一致しないため、
カテゴリD（その他）として処理されてキーワード検出の対象となる。
この行に `0 failed` というデータが含まれるため、`BLOCKING_FAILURE_KEYWORDS` の `'failures'` または `'failing'`
とのパターンマッチで誤検出がヒットする可能性がある（否定語チェックが数値表現を正しく認識しない場合）。
コロンの有無という些細な相違が、キーワードフィルタの検出対象・非検出対象を分けている点が根本原因である。

### 修正対象ファイルと行番号

対象ファイル: `workflow-plugin/mcp-server/src/tools/record-test-result.ts`
修正箇所: 行147の `SUMMARY_PREFIXES` 配列への `'Tests '` エントリ追加

### 変更前後のコード

変更前（行147）:

```typescript
const SUMMARY_PREFIXES = ['Tests:', 'Test Files', 'Test Suites:', 'Summary'];
```

変更後（行147）:

```typescript
const SUMMARY_PREFIXES = ['Tests:', 'Tests ', 'Test Files', 'Test Suites:', 'Summary'];
```

### 変更の規模と後方互換性

変更規模: 1行変更（配列への1エントリ追加）。行数変更目標の最小限を満たす。
後方互換性への影響: `'Tests '` プレフィックスで始まる行が新たにカテゴリAに分類されるようになる。
この変更はキーワード検出の感度を下げる方向の変更であり、正常なテスト出力での誤検出を減らす効果のみを持つ。
実際に失敗がある場合（例: `"Tests  5 passed | 3 failed (8)"`）はカテゴリAとして残るため、
集計行全体の解析対象からは除外されずフィルタ後の出力に含まれる点に注意が必要である。

---

## テスト方針

本セクションでは各バグ修正に対するユニットテストの方針を定義する。
既存のテストスイートが修正後も全てパスすることを非機能要件として維持する。
ユニットテストフレームワークとしてvitestを前提とし、検証可能な形でテストケースを設計する。

### バグ1のテスト方針

regression_testフェーズで `workflow_record_test_result` MCPツールを回呼した直後に `workflow_next` が成功することを確認する。
具体的には、あるテスト出力文字列でrecord_test_resultを記録した後、同じ出力文字列でworkflow_nextを呼んでも遷移がブロックされないことを検証可能な形で確認する。
testingフェーズでは従来通り、同一出力を2回提出した場合に重複エラーが返ること（既存挙動の維持）も別のテストケースで確認する。

### バグ2のテスト方針

`"Tests  73 passed | 0 failed (73)"` という文字列を含むテスト出力を作成し、
exitCode=0、真正なフレームワーク構造を持つ入力として `checkConsistency` または `validateTestAuthenticity` に渡したとき、
失敗として誤検出されないことを確認する。
合わせて `"Tests  5 passed | 3 failed (8)"` という実際に失敗がある出力では正しく失敗と判定されることも確認する。

### バグ3のテスト方針

5001文字以上のテスト出力を用意し、record_test_resultに渡したとき先頭5000文字が保持されることを確認する。
合わせてその先頭5000文字のテキストに `"Test Files  73 passed (73)"` という集計行が含まれていることで
`extractTestCounts` が正しい数値を返すことも確認する。
500文字未満のテスト出力は切り詰めされないことも検証し、基準以内の入力が正しく処理されることを担保する。

---

## MCPサーバー再ビルド手順

上記3つのファイルはTypeScriptソースであるため、修正後に以下の手順でビルドと再起動を行うこと。
`workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行してトランスパイルを完了させる。
ビルド完了後、MCPサーバープロセスを再起動してNode.jsモジュールキャッシュを更新する（再起動要件）。
再起動後に `workflow_status` で現在フェーズを確認し、同フェーズから作業を再開する。
再起動を省略した場合は変更が反映されないため、バリデーション失敗が継続することに注意する。

---

## 変更ファイル一覧と変更規模のまとめ

| 対象ファイル | バグ | 変更行数 | 変更内容 |
|------------|------|---------|---------|
| `workflow-plugin/mcp-server/src/tools/next.ts` | バグ1 | 2行追加 | ハッシュ重複チェックをif文でラップしregression_testを除外 |
| `workflow-plugin/mcp-server/src/tools/record-test-result.ts` | バグ3 | 2行変更 | MAX_OUTPUT_LENGTHを500から5000、slice方向を末尾から先頭に変更 |
| `workflow-plugin/mcp-server/src/tools/record-test-result.ts` | バグ2 | 1行変更 | SUMMARY_PREFIXESに'Tests 'を追加 |

`test-authenticity.ts` 自体は変更しない。バグ3の修正により真正性検証の入力が改善されるため、
`test-authenticity.ts` 側の変更は不要であり、変更範囲の制限を遵守できる。

## 非機能要件と制約事項

本タスクの非機能要件と制約事項を以下に整理する。要件定義（requirements.md）の同名セクションに対応する。

### 後方互換性の維持

修正はregression_testフェーズの挙動にのみ影響し、testing・parallel_verificationなど他のフェーズの動作を変更しない。
`workflow_record_test_result`・`workflow_next`・`workflow_capture_baseline` の各MCPツールのAPIシグネチャは変更しない。
既存のworkflow-state.jsonファイルのフィールド構成は変更せず、以前に記録された状態データを含む既存データを維持する。

### 制約事項と前提

全ての修正はMCPサーバーの再ビルドと再起動が必要であることを前提とする。
HMAC整合性（`state-manager.ts` が管理）への影響はなく、workflow-stateデータの直接編集は不要である。
修正は既存のユニットテストフレームワーク（vitestまたはjest）で検証可能な形で実装すること。
`state-manager.ts`・`artifact-validator.ts`・`definitions.ts` などのコアモジュールは変更しないこと。

### 修正優先度の根拠

修正優先度はrequirements.mdの「修正優先度」セクションから引き継ぐ。
バグ1は再現性が確実で最も頻発するため優先度1とし、バグ3はバグ1と連鎖して発現するため優先度2とする。
バグ2は発生条件が限定的なため優先度3とし、継続的な品質改善として位置付けられる。
各修正の順番はこの優先度に基づいて決定されており、バグ3・バグ2・バグ1の順に適用することで安全に対応できる。
