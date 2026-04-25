# regression_test遷移バグ3件の根本修正 - UI設計書

## サマリー

本ドキュメントは `regression_test` フェーズから `parallel_verification` フェーズへの遷移ブロックを引き起こす3つのバグ修正に関するインターフェース設計を定義する。
今回の修正対象はMCPサーバーのバックエンドロジックのみであり、ユーザー向けのグラフィカルインターフェースは存在しない。
設計の焦点は以下の3点に置く。

- MCPツール（`workflow_record_test_result`・`workflow_next`）のAPIシグネチャが変更されないことの確認
- バグ修正前後でユーザーが受け取るエラーメッセージがどのように変化するかの明示
- `workflow-state.json` の `testResults` および `testOutputHashes` フィールドへの影響の記述

次フェーズ（test_design）では本ドキュメントで定義したAPIレスポンス形式とエラーメッセージの変化をテストケース設計の基準として参照すること。

---

## CLIインターフェース設計

### workflow_record_test_result ツールのシグネチャ

本ツールのMCPインターフェース定義は今回のバグ修正によって変更されない。
引数の型・名前・必須フラグはすべて修正前と同一である。

```typescript
// MCPツール: workflow_record_test_result
// 引数定義（変更なし）
{
  taskId: string;          // タスクID（必須）
  exitCode: number;        // テスト終了コード: 0=成功, 非0=失敗（必須）
  output: string;          // テスト実行の標準出力（必須、50文字以上）
  summary?: string;        // テスト結果のサマリー（省略可能）
  sessionToken?: string;   // セッショントークン（省略可能）
}
```

バグ3の修正（`MAX_OUTPUT_LENGTH` の 500→5000 変更・`slice` 方向変更）は、ツール呼び出し側から見た引数仕様には何ら影響を与えない。
呼び出し元は従来通り生の出力文字列全体を `output` フィールドに渡してよく、切り詰め処理はサーバー内部で透過的に行われる。
`output` フィールドの文字数制限はツール仕様上存在しないため、長大な出力を渡しても呼び出し自体は成功する。

### workflow_next ツールのシグネチャ

本ツールのMCPインターフェース定義も今回のバグ修正によって変更されない。
バグ1の修正（regression_testフェーズでのハッシュ重複チェックスキップ）はサーバー内部のロジック変更のみであり、引数仕様に影響しない。

```typescript
// MCPツール: workflow_next
// 引数定義（変更なし）
{
  taskId?: string;           // タスクID（省略時は最新タスク）
  forceTransition?: boolean; // ベースライン未設定時の強制遷移フラグ
  sessionToken?: string;     // セッショントークン（省略可能）
}
```

既存の呼び出しコードを変更する必要はなく、後方互換性が完全に保たれる設計である。

---

## エラーメッセージ設計

### バグ1修正前後のエラーメッセージ変化

バグ1が発生している状態では、regression_testフェーズで有効なテスト結果を記録した直後に `workflow_next` を呼んでも以下のエラーが返された。

修正前のエラー応答（`workflow_next` が返す `message` フィールド）:

```
リグレッションテスト出力が以前と同一です（コピペの可能性）。
実際にテストを実行してください。
```

修正後は regression_test フェーズにおいてハッシュ重複チェック自体がスキップされるため、このエラーメッセージはregression_testフェーズでは表示されなくなる。
testingフェーズで同一出力を2回提出した場合は従来通り同メッセージが返され、既存の不正検出機能は維持される。

### バグ3修正前後のエラーメッセージ変化

バグ3が発生している状態では、`test-authenticity.ts` がテスト出力の先頭集計行を参照できないため以下のエラーが返された。

修正前のエラー応答例:

```
テスト出力からテスト数を抽出できませんでした。
テスト集計行（"Tests N passed"等）が出力に含まれているか確認してください。
```

修正後は `MAX_OUTPUT_LENGTH = 5000` かつ先頭保持のslice処理により、vitest集計行が切り捨てられることなく保持される。
その結果、真正性検証が正常に通過し上記エラーは表示されなくなる。
5000文字を超える出力では末尾（主にスタックトレース）が切り捨てられるが、集計行は通常先頭付近に存在するため検証に支障はない。

### バグ2修正前後のエラーメッセージ変化

バグ2が発生している状態では、`"Tests  N passed | 0 failed (N)"` 形式の行が `SUMMARY_PREFIXES` に一致せずキーワード検出対象になった。
否定語チェックが数値 `0` を正しく認識しない場合、以下のエラーが誤って返される可能性があった。

修正前の誤検出エラー応答例:

```
テスト出力にキーワード 'failed' が検出されました。
exitCode=0 であってもテストが失敗している可能性があります。
```

修正後は `'Tests '` プレフィックス（末尾スペース付き）が `SUMMARY_PREFIXES` に追加されたことで、対象行がカテゴリAとして正しく分類される。
カテゴリAに分類された行はキーワードフィルタの対象外となるため、`0 failed` の記述による誤検出が解消される。

---

## APIレスポンス設計

### workflow_record_test_result のレスポンス形式

修正後も基本的なレスポンス構造は変更されない。正常系と異常系のレスポンス形式を以下に示す。

```typescript
// 正常系レスポンス（exitCode=0かつ真正性検証通過の場合）
{
  success: true,
  message: "テスト結果を記録しました。",
  taskId: "20260219_...",
  phase: "regression_test",
  exitCode: 0
}

// 異常系レスポンス（真正性検証失敗の場合）
{
  success: false,
  message: "テスト出力からテスト数を抽出できませんでした。",
  taskId: "20260219_...",
  phase: "regression_test"
}
```

バグ3修正後は `output` フィールドの先頭5000文字が切り詰め後の値として内部保存されるが、レスポンスのJSONフィールド構成自体は変わらない。
呼び出し元はレスポンスの `success` フィールドを確認することで、記録が成功したかどうかを判断できる。

### workflow_next のレスポンス形式

修正後のregression_testフェーズにおける `workflow_next` の正常系レスポンスを以下に示す。

```typescript
// 正常系レスポンス（regression_testフェーズで遷移成功の場合）
{
  success: true,
  message: "parallel_verificationフェーズへ移行しました。",
  previousPhase: "regression_test",
  currentPhase: "parallel_verification",
  taskId: "20260219_..."
}

// 修正前のバグ状態で返っていた異常系レスポンス（修正後は表示されない）
{
  success: false,
  message: "リグレッションテスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。",
  taskId: "20260219_..."
}
```

バグ1修正後、regression_testフェーズでの `workflow_next` 呼び出しはハッシュ重複チェックをスキップして遷移条件の評価に進む。
遷移条件（`workflow_record_test_result` が呼ばれていること）が満たされていれば、正常系レスポンスが返される。

---

## 設定ファイル設計

### workflow-state.json の testResults フィールド構成

`workflow-state.json` の `testResults` フィールド構成はバグ修正前後で変わらない。
ただしバグ3の修正により、`output` フィールドに保存される文字列の内容が変化する。

```json
// testResults フィールドの構造（フィールド構成自体は変更なし）
{
  "testResults": {
    "exitCode": 0,
    "output": "(先頭5000文字が保存される。修正前は末尾500文字が保存されていた)",
    "summary": "73 passed, 0 failed",
    "recordedAt": "2026-02-19T10:00:00.000Z",
    "phase": "regression_test"
  }
}
```

修正前は `output.slice(-500)` で末尾500文字のみが保存されていたため、vitestの先頭集計行が欠落していた。
修正後は `output.slice(0, 5000)` で先頭5000文字が保存されるため、集計行が確実に含まれるようになる。
フィールド名（`exitCode`・`output`・`summary`・`recordedAt`・`phase`）はすべて維持されるため、既存の状態ファイルとの互換性が保たれる。
`output` フィールドの最大文字数が500から5000に増加することで、状態ファイルのサイズが最大10倍増加する可能性があるが、実用上の問題はない。

### workflow-state.json の testOutputHashes フィールド構成

`testOutputHashes` フィールドはハッシュ重複チェックに使用される配列であり、フィールド構成はバグ修正によって変わらない。

```json
// testOutputHashes フィールドの構造（フィールド構成自体は変更なし）
{
  "testOutputHashes": [
    "sha256-hash-of-output-1",
    "sha256-hash-of-output-2"
  ]
}
```

バグ1の修正は `next.ts` のチェックロジックを変更するのみであり、`testOutputHashes` への書き込み処理は `record-test-result.ts` 側が担う。
regression_testフェーズにおける `record-test-result.ts` の行422では既存の挙動通り `existingHashes = []` として新しいハッシュを記録する。
`workflow_next` の呼び出し時はregression_testフェーズのみこの配列を参照しないようになるが、配列自体は引き続き更新される。
testingフェーズではこの配列を従来通り参照してハッシュ重複を検出し、不正なコピペ提出をブロックする動作が維持される。

### MAX_OUTPUT_LENGTH 変更の影響まとめ

定数 `MAX_OUTPUT_LENGTH` の変更（500→5000）が `workflow-state.json` に与える影響を以下に整理する。

変更前の動作として、5000文字のテスト出力を渡した場合は末尾500文字のみが `output` フィールドに保存されており、先頭集計行が失われた。
変更後の動作として、5000文字のテスト出力を渡した場合は先頭5000文字が `output` フィールドに保存され、先頭集計行が確実に含まれる。
500文字以下のテスト出力を渡した場合は修正前後ともに切り詰めなしで全文が保存される点は変わらない。
HMAC整合性（`state-manager.ts` が管理）への影響はなく、状態ファイルのシグネチャ計算は引き続き正常に機能する。
