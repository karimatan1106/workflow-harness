# regression_test遷移バグ3件の根本修正 - 要件定義

## サマリー

本ドキュメントは `research.md` の調査結果に基づき、regression_testフェーズからparallel_verificationへの
遷移が常にブロックされる3つのバグに対する修正要件を定義する。
対象ファイルは `record-test-result.ts`、`next.ts`、`test-authenticity.ts` の3ファイルである。
各バグは独立した原因を持つが、実行時にはバグ1・バグ3が連鎖して発現するため、
優先度に従い順番に修正することで安全に対応できる。

- 目的: regression_testフェーズで有効なテスト結果を記録した後に確実に遷移できるようにすること
- 主要な決定事項: 最小変更の方針（条件追加・定数変更・プレフィックス追加）を採用し、リスクを最小化する
- 次フェーズで必要な情報: 3つの修正箇所の行番号と変更内容（planning/spec.mdに詳細化する）

---

## 機能要件

### バグ1: testOutputHash自己参照バグの修正

#### 問題の概要

`next.ts` の行342-350に実装されているハッシュ重複チェックが、
regression_testフェーズにおいて `record-test-result.ts` が保存したハッシュ自体を
重複とみなしてブロックする自己参照問題が存在する。
`record-test-result.ts` はregression_testフェーズでは `existingHashes = []` として計算・保存するが、
`next.ts` は保存後の `testOutputHashes` 配列全体を使って重複チェックを行うため常にヒットする。

#### 修正要件

- `next.ts` のハッシュ重複チェックブロックに、regression_testフェーズを除外する条件を追加すること
- 具体的には `if (testResult.output && currentPhase !== 'regression_test')` のようなガードを設ける
- この変更により、testingフェーズと他のフェーズのハッシュ重複チェックは従来通り動作すること
- regression_testフェーズに限定してチェックをスキップする設計であり、セキュリティ上の影響がないこと

#### 受け入れ基準

- regression_testフェーズで `workflow_record_test_result` を呼び出した後、`workflow_next` が成功すること
- testingフェーズで同一出力を使って `workflow_next` を2回呼び出した際に重複エラーが返ること（既存挙動の維持）
- 変更は `next.ts` の1箇所のみに限定されること

---

### バグ2: テスト出力false positiveの修正

#### 問題の概要

vitest が出力する `"Tests  73 passed | 0 failed (73)"` のような集計行が
`SUMMARY_PREFIXES` に含まれるプレフィックスに一致しないため、キーワード検出対象として処理される。
結果として `0 failed` 内の `failed` というキーワードが失敗として誤検出される可能性がある。
現在の `SUMMARY_PREFIXES` には `'Tests:'`（コロン付き）のみが含まれており、
`'Tests '`（コロンなしスペース付き）が欠落している。

#### 修正要件

- `record-test-result.ts` の `SUMMARY_PREFIXES` 配列に `'Tests '`（末尾にスペース1文字）を追加すること
- この追加により vitest 形式の集計行がカテゴリA（集計行）として分類され、キーワード誤検出が防止されること
- `'Test Files'` など既存のプレフィックスへの影響がないこと
- `'Tests '` プレフィックスで始まる行は `trimmed.startsWith('Tests ')` で一致し、キーワードフィルタ対象から除外されること

#### 受け入れ基準

- `"Tests  73 passed | 0 failed (73)"` という行が含まれるテスト出力に対して失敗が誤検出されないこと
- `"Tests  5 passed | 3 failed (8)"` のように実際に失敗がある場合は正しく失敗と判定されること
- 変更は `SUMMARY_PREFIXES` 配列への1エントリ追加のみに限定されること

---

### バグ3: テスト出力切り詰め問題の修正

#### 問題の概要

`record-test-result.ts` の定数 `MAX_OUTPUT_LENGTH = 500` が小さすぎるため、
保存時に `output.slice(-MAX_OUTPUT_LENGTH)` として末尾500文字のみが保持される。
vitestの `"Test Files  73 passed (73)"` のような集計行は出力の先頭付近に出力されるため、
末尾保持の切り詰め方式では情報が失われる。
結果として `test-authenticity.ts` のパターンマッチングが失敗し、
「テスト出力からテスト数を抽出できませんでした」エラーが返る。

#### 修正要件

- `MAX_OUTPUT_LENGTH` を現在の500文字から5000文字に変更すること
- 切り詰め方向を末尾保持（`slice(-MAX_OUTPUT_LENGTH)`）から先頭保持（`slice(0, MAX_OUTPUT_LENGTH)`）に変更すること
- この2点を組み合わせることで、テスト集計行（通常先頭付近）の保持が保証されること
- 変更後も `MAX_OUTPUT_LENGTH` を超えた場合は切り詰めが行われ、状態ファイルのサイズが過大にならないこと

#### 受け入れ基準

- vitestの出力（先頭付近に集計行、末尾付近にスタックトレース）で `testCount` の抽出が成功すること
- 5000文字を超えるテスト出力が保存された場合、先頭5000文字が保持されること
- 500文字未満のテスト出力は切り詰めされないこと（従来通り）

---

## 非機能要件

### 後方互換性

- 修正はregression_testフェーズの挙動にのみ影響し、testing・parallel_verificationなど他のフェーズの動作を変更しないこと
- `workflow_record_test_result`・`workflow_next`・`workflow_capture_baseline` の各MCPツールのAPIシグネチャは変更しないこと
- 既存のワークフロー状態ファイル（`workflow-state.json`）の形式・フィールド構成は変更しないこと
- バグ修正前に記録された状態データとの互換性が維持されること

### MCPサーバー再起動要件

- 上記3ファイルはTypeScriptソースであり、修正後に `npm run build` でトランスパイルを行うこと
- ビルド完了後、MCPサーバープロセスを再起動してNode.jsモジュールキャッシュを更新すること
- 再起動後に `workflow_status` で現在フェーズを確認し、同フェーズから作業を再開すること

### テスト要件

- バグ1の修正に対して、regression_testフェーズのハッシュチェックスキップを検証するユニットテストを追加すること
- バグ2の修正に対して、`"Tests  N passed | 0 failed (N)"` 形式の入力で誤検出がないことを確認するテストを追加すること
- バグ3の修正に対して、5000文字以上の出力が先頭保持で切り詰められることを確認するテストを追加すること
- 既存のテストスイートが修正後も全てパスすること（リグレッションなし）

### 変更範囲の制限

- 修正対象は `next.ts`・`record-test-result.ts`・`test-authenticity.ts` の3ファイルに限定すること
- `state-manager.ts`・`artifact-validator.ts`・`definitions.ts` などのコアモジュールは変更しないこと
- 各修正の行数変更は最小限（バグ1: 1行追加、バグ2: 1行追加、バグ3: 2行変更）を目標とすること

---

## 修正優先度

| 優先度 | バグ | 対象ファイル | 変更規模 | 理由 |
|:---:|------|------------|---------|------|
| 1 | バグ1: ハッシュ自己参照 | `next.ts` | 条件1行追加 | 再現性が確実で最も頻発する |
| 2 | バグ3: 出力切り詰め | `record-test-result.ts` | 定数変更+slice方向変更 | バグ1と連鎖して発現する |
| 3 | バグ2: false positive | `record-test-result.ts` | プレフィックス1エントリ追加 | 発生条件が限定的 |

バグ1とバグ3を先に修正することで、regression_testフェーズからの遷移ブロックという
主要な問題が解消される。バグ2はその後の継続的な品質改善として位置付けられる。

---

## 制約事項

- 全ての修正はMCPサーバーの再ビルドと再起動が必要であることを前提とする
- HMAC整合性（`state-manager.ts` が管理）への影響はなく、状態ファイルの直接編集は不要である
- 修正後のビルドは `workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行すること
- 修正は既存のユニットテストフレームワーク（vitestまたはjest）で検証可能な形で実装すること
