# ワークフロー実行時問題の根本原因修正 - UI設計書

## サマリー

本設計書は、MCPサーバー（TypeScriptベース）のCLIインターフェース・エラーメッセージ・APIレスポンス・設定ファイルの設計を定義する。
対象はFR-1からFR-5の修正に関連するインターフェース仕様である。

主要な設計事項として、`workflow_record_test_result` の呼び出し形式（sessionToken引数・output引数の要件）、
sessionToken認証エラーや真正性検証エラーのメッセージ形式、definitions.tsのsubagentTemplateスキーマ追記後の構造を定める。

次フェーズ（test_design）では本設計書に記載した各インターフェースをテストケースとして具体化すること。
FR-4・FR-5のワークフロー制御ツール禁止指示はテンプレートテキストとして実装されるため、
違反時の技術的ブロックではなく、ガイダンスとして機能する点に留意すること。

---

## CLIインターフェース設計

### workflow_record_test_result の呼び出し形式

`workflow_record_test_result` はtestingフェーズおよびregression_testフェーズのsubagentが呼び出すMCPツールである。
引数の仕様を以下に定める。

#### 必須引数の詳細

- `taskId` （文字列型）: 対象タスクのID。Orchestratorがプロンプト内に記載するか、`workflow_status` の戻り値から取得する。
- `exitCode` （整数型）: テスト実行コマンドの終了コード。0は成功を示し、1以上は失敗を示す。
- `output` （文字列型）: テストフレームワークが出力した完全な標準出力。**100文字以上**が必須であり、これを下回るとエラーになる。

#### オプション引数の詳細

- `sessionToken` （文字列型）: Orchestratorからプロンプト引数として渡された場合のみ使用する。
  subagent自身がMCPツールを呼び出して取得するものではない点が重要である。
- `summary` （文字列型）: テスト結果の概要説明として省略可能であり、output引数の代替としては機能しない。

#### sessionToken付き呼び出し例

```json
{
  "taskId": "task-20260223",
  "exitCode": 0,
  "output": "✓ state-manager.test.ts (45)\n  ✓ phase transition (12)\n    ✓ research → requirements: OK\n    ✓ requirements → parallel_analysis: OK\n  ✓ artifact validation (33)\nTest Files  1 passed (1)\nTests  912 passed (912)\nDuration  3.14s",
  "sessionToken": "orch-sess-abc123",
  "summary": "全912件のテストが正常に完了した"
}
```

#### sessionToken省略時の呼び出し例

```json
{
  "taskId": "task-20260223",
  "exitCode": 0,
  "output": "✓ vitest v1.2.0\n  ✓ definitions.test.ts (25)\n  ✓ phase definitions (25)\n  ✓ template structure (12)\nTest Files  1 passed (1)\nTests  25 passed (25)\nDuration  1.52s"
}
```

### workflow_approve の呼び出し形式（FR-1対応）

承認が必要な4フェーズに対応する `workflow_approve` の呼び出し形式を定める。
各フェーズで適切な `type` 引数を指定しなければフェーズ遷移がブロックされる。

フェーズとtype引数の対応:
- requirementsフェーズで承認する場合は `type="requirements"` を指定して呼び出す
- design_reviewフェーズで承認する場合は `type="design"` を指定して呼び出す
- test_designフェーズで承認する場合は `type="test_design"` を指定して呼び出す
- code_reviewフェーズで承認する場合は `type="code_review"` を指定して呼び出す

---

## エラーメッセージ設計

### sessionToken認証エラー

`workflow_record_test_result` にsessionTokenを渡した際に認証が失敗した場合のエラーメッセージ形式を定める。

#### エラーケース1: 無効なsessionToken

発生条件: sessionTokenが改ざんされているか、有効期限切れである場合に発生する。

```
エラー: sessionToken認証に失敗しました。
理由: 提供されたsessionTokenが有効ではありません。
対処: OrchestratorからプロンプトとしてsessionTokenを受け取っているか確認してください。
     sessionToken引数を省略して再度呼び出すことで認証なしで実行できます。
```

#### エラーケース2: sessionTokenのワークフロー制御ツールへの誤用

発生条件: subagentがworkflow_nextなどのワークフロー制御ツールにsessionTokenを使用しようとした場合に発生する。
現行実装では技術的ブロックは行わないが、将来実装時の参考として以下のメッセージ形式を定める。

```
エラー: このツールへのsessionTokenの使用は許可されていません。
理由: sessionTokenはworkflow_record_test_resultの呼び出しのみに使用可能です。
対処: ワークフロー制御（フェーズ遷移・承認等）はOrchestratorの専権事項です。
     subagentはテスト実行と結果記録のみを実施してください。
```

### テスト出力真正性検証エラー（FR-3対応）

`validateTestAuthenticity` が実行するチェックに失敗した場合のエラーメッセージ形式を定める。

#### エラーケース1: output引数が短すぎる

発生条件: outputパラメータが100文字未満である場合に発生する。

```
エラー: テスト出力の真正性検証に失敗しました。
理由: output引数が短すぎます（実際の文字数 / 必要: 100文字以上）。
対処: テストフレームワーク（vitest/jest/pytest等）が出力する完全な標準出力を
     そのまま渡してください。要約・短縮・加工した文字列ではなく、
     コマンド実行結果の完全な出力テキストを使用してください。
```

#### エラーケース2: 加工または要約された出力を検出

発生条件: テストフレームワークの典型的な出力パターンが検出されない場合に発生する。

```
エラー: テスト出力の真正性検証に失敗しました。
理由: 標準的なテストフレームワークの出力形式が検出されませんでした。
対処: vitest / jest / pytest 等が出力する集計行（例: "Tests  912 passed"）や
     パス結果行を含む完全な出力をそのまま渡してください。
     出力を手動で編集・要約した場合は本エラーが発生します。
```

#### エラーケース3: 重複出力の送信（testingフェーズ限定）

発生条件: testingフェーズで同一の出力テキストが既に記録されている場合に発生する。

```
エラー: テスト出力の重複送信が検出されました。
理由: 同一の出力テキストが既にこのタスクに記録されています。
対処: テストを再実行して新しい出力を取得するか、異なるテストスイートの出力を
     使用してください。重複送信はtestingフェーズでは許可されていません。
     ※regression_testフェーズでは重複送信が例外的に許可されています。
```

### ワークフロー制御ツール禁止違反のガイダンス（FR-4・FR-5対応）

FR-4・FR-5により、testingおよびregression_testのsubagentTemplateにワークフロー制御ツール禁止指示が追加される。
現行実装では技術的なブロックは行わず、テンプレートのガイダンステキストによる抑止のみとする。
将来的な技術的ブロック実装時の参考として、違反検出時のメッセージ形式を以下に示す。

```
エラー: このツールの呼び出しはsubagentには許可されていません。
禁止対象ツール: workflow_next, workflow_approve, workflow_complete_sub,
               workflow_start, workflow_reset
理由: フェーズ遷移はOrchestratorの専権事項です。
     subagentの責任範囲はテスト実行と結果記録のみです。
対処: workflow_record_test_resultで結果を記録した後、処理を終了してください。
     フェーズ遷移はOrchestratorが実施します。
```

---

## APIレスポンス設計

本セクションでは、MCPツール呼び出し時に返却されるJSONレスポンスの構造を設計する。
各ツールの成功レスポンスにはtaskId・phase・recordedAt・messageフィールドが共通して含まれる。
エラー時はsuccessフィールドがfalseとなり、reasonフィールドにエラー原因の説明が付加される。
authenticityオブジェクトはテスト出力の真正性検証結果を含み、outputLength・meetsMinimumLengthの2項目を保持する。
sessionTokenを使用した場合はレスポンスにsessionTokenオブジェクトが追加され、verified・usedByフィールドで検証結果を示す。

### workflow_record_test_result の成功レスポンス

`workflow_record_test_result` が正常に完了した場合のレスポンス形式を定める。

#### testingフェーズでの成功レスポンス

```json
{
  "success": true,
  "taskId": "task-20260223",
  "phase": "testing",
  "exitCode": 0,
  "recordedAt": "2026-02-23T10:30:00Z",
  "message": "テスト結果を記録しました。",
  "authenticity": {
    "verified": true,
    "outputLength": 512,
    "meetsMinimumLength": true
  }
}
```

#### regression_testフェーズでの成功レスポンス

```json
{
  "success": true,
  "taskId": "task-20260223",
  "phase": "regression_test",
  "exitCode": 0,
  "recordedAt": "2026-02-23T11:00:00Z",
  "message": "リグレッションテスト結果を記録しました。",
  "duplicateAllowed": true,
  "authenticity": {
    "verified": true,
    "outputLength": 480,
    "meetsMinimumLength": true
  }
}
```

#### sessionToken検証成功時の追加フィールド

sessionTokenを受け取り検証に成功した場合は、レスポンスに以下のフィールドが追加される。

```json
{
  "sessionToken": {
    "provided": true,
    "verified": true,
    "usedBy": "Orchestrator"
  }
}
```

### workflow_approve の成功レスポンス（FR-1対応）

4フェーズの承認に対応するレスポンス形式を定める。各フェーズで同一の構造を返す。

requirementsフェーズ承認時のレスポンス例:

```json
{
  "success": true,
  "type": "requirements",
  "approvedPhase": "requirements",
  "nextPhase": "parallel_analysis",
  "message": "要件定義レビューが承認されました。parallel_analysisフェーズへ進めます。",
  "approvedAt": "2026-02-23T09:15:00Z"
}
```

test_designフェーズ承認時のレスポンス例（FR-1で新たに明示化されるフェーズ）:

```json
{
  "success": true,
  "type": "test_design",
  "approvedPhase": "test_design",
  "nextPhase": "test_impl",
  "message": "テスト設計レビューが承認されました。test_implフェーズへ進めます。",
  "approvedAt": "2026-02-23T14:20:00Z"
}
```

---

## 設定ファイル設計

### definitions.ts の subagentTemplate プロパティ追記後の構造

FR-2・FR-3・FR-4・FR-5の追記によりdefinitions.tsのsubagentTemplateが変化する。
追記後のテンプレート末尾の構造設計を定める。

#### testingフェーズのsubagentTemplate末尾構造（FR-2・FR-3・FR-4追記後）

追記前の末尾は以下の注意事項セクションで終わっていた。

```
- 同一の出力テキストを重複して送信した場合もブロックエラーとなる
```

追記後は末尾に3セクションが連続して追加される。各セクションの設計要件を以下に示す。

第1セクション（FR-2: sessionToken取得方法）の設計要件:
- セクション見出しに「sessionTokenの取得方法と使用制限」を使用すること
- Orchestratorからプロンプト引数として渡される旨を明記すること
- subagent自身がMCPツールを呼び出して取得するものではない旨を明記すること
- sessionTokenが渡されなかった場合の省略方法を1行で明記すること
- sessionTokenの使用可能ツールをworkflow_record_test_resultのみと限定すること

第2セクション（FR-3: 生出力要件）の設計要件:
- 100文字以上の生の標準出力が必要であることを箇条書きで明記すること
- テストフレームワークが出力する集計行・パス結果・失敗詳細を含む完全な出力の使用を記載すること
- 要約・短縮・加工した出力ではエラーになる旨を1行で明記すること
- validateTestAuthenticity検証が実施される旨を最終行に記載すること

第3セクション（FR-4: ワークフロー制御ツール禁止）の設計要件:
- セクション見出しに「★ワークフロー制御ツール禁止★」の形式で目立つ表記を使用すること
- 禁止対象5ツールのリストを1行で列挙すること（workflow_next等）
- sessionTokenを保有していても制御ツールへの使用は禁止と1行で明記すること
- subagentの責任範囲をテスト実行と結果記録のみと限定する1行を含めること
- 完了後はOrchestratorに制御を返す旨を最終行に明記すること

#### regression_testフェーズのsubagentTemplate末尾構造（FR-5追記後）

追記前の末尾は以下で終わっていた。

```
- regression_testフェーズでは、同一の出力テキストを再送信した場合も記録が許可されている（他フェーズでは重複送信がブロックされるが、このフェーズは例外として扱われる）
```

追記後は末尾に2セクションが連続して追加される。各セクションの設計要件を以下に示す。

第1セクション（sessionToken取得方法）の設計要件:
- testingフェーズのFR-2と同一の文言・内容を使用すること（NFR-2の一貫性要件）
- Orchestratorからプロンプト引数として渡される旨を明記すること
- sessionTokenの使用可能ツールをworkflow_record_test_resultのみと限定すること

第2セクション（ワークフロー制御ツール禁止）の設計要件:
- testingフェーズのFR-4と同一の禁止対象リスト・文言を使用すること（NFR-2の一貫性要件）
- subagentの責任範囲をリグレッションテスト実行と結果記録のみと限定すること
- 完了後はOrchestratorに制御を返す旨を最終行に明記すること

### CLAUDE.md の修正後の構造設計（FR-1対応）

FR-1の適用によりCLAUDE.mdの2箇所が変化する。

#### 必須コマンド一覧の修正後の構造

変更前は `workflow_approve design` の1行のみが存在していた。
変更後は以下の4行で構成される（順序は固定とし、この順序が受け入れ基準となる）。

| コマンド形式 | 説明 | 対象フェーズ |
| :--- | :--- | :--- |
| `/workflow approve requirements` | 要件定義レビューを承認 | requirementsフェーズ |
| `/workflow approve design` | 設計レビューを承認 | design_reviewフェーズ |
| `/workflow approve test_design` | テスト設計レビューを承認 | test_designフェーズ |
| `/workflow approve code_review` | コードレビューを承認 | code_reviewフェーズ |

4行が全て存在していることがFR-1の受け入れ基準の一部となる。
既存の `/workflow approve design` 行は削除せず、新しい4行に置き換える形で更新する。

#### AIへの厳命7番目の修正後の構造

変更前の1行から、1行の見出しと4行の箇条書きで構成される形式に変化する。

見出し行の設計要件: 4フェーズ（requirements・design_review・test_design・code_review）の名前を全て含むこと。
見出し行は必ず `7.` から始まり太字で記述すること。
箇条書きの設計要件: 各フェーズに対応するworkflow_approveのtype引数（requirements・design・test_design・code_review）を1対1で対応付けて明記すること。
各箇条書き行はフェーズ名とtype引数の対応が明確に読み取れる形式で記述すること。
