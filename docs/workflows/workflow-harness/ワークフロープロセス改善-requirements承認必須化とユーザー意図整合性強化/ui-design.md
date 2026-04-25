## サマリー

本ドキュメントは、ワークフロープロセス改善（FR-1: requirements承認必須化、FR-2: code_reviewユーザー意図整合性チェック、FR-3: 並列フェーズクロスチェックガイダンス）のインターフェース設計を定義する。

- 目的: MCP ツールの入出力仕様、エラーメッセージ、バリデーション設定フォーマットを設計し、実装者が迷いなくコーディングできる仕様を提供すること
- 主要な決定事項:
  - FR-1 は `workflow_approve type="requirements"` を呼び出すことで requirements 承認フラグを設定する既存インターフェースを使用する
  - FR-2 の `## ユーザー意図との整合性` セクション欠落エラーメッセージは既存パターンに準拠したフォーマットで出力する
  - FR-3 の成功・失敗レスポンスは workflow_next の標準レスポンス形式に従う
- 次フェーズで必要な情報: 変更対象は artifact-validator.ts と definitions.ts の2ファイル。ビルド後にサーバー再起動が必須となる。

---

## CLIインターフェース設計

### workflow_approve コマンド（requirements型）

FR-1 が文書化した requirements フェーズの承認インターフェースは以下の形式である。

```typescript
// MCP ツール呼び出し形式
workflow_approve({
  type: "requirements",
  taskId: "<対象タスクのID>"  // 省略時はアクティブタスクを自動選択
})
```

承認が成功した場合、以下のJSON形式のレスポンスが返される。

```json
{
  "success": true,
  "message": "requirements フェーズが承認されました。workflow_next で parallel_analysis に進めます。",
  "phase": "requirements",
  "approvedAt": "2026-02-23T10:00:00.000Z"
}
```

requirements フェーズ以外で呼び出した場合は以下のエラーレスポンスが返され、操作はブロックされる。

```json
{
  "success": false,
  "error": "requirements 承認は requirements フェーズでのみ実行可能です。現在のフェーズ: planning"
}
```

### workflow_next コマンド（requirements フェーズから）

requirements フェーズで `workflow_next` を呼び出す際のインターフェースは以下の通りである。

```typescript
// 承認前の呼び出し（ブロックされる）
workflow_next({ taskId: "<対象タスクのID>" })

// 承認後の呼び出し（成功する）
workflow_next({ taskId: "<対象タスクのID>" })
```

承認が実施されていない状態でのエラーレスポンスは次のとおりであり、next.ts の REQ-B1 として既存実装されている。

```json
{
  "success": false,
  "error": "requirements承認が必要です。workflow_approve requirements を実行してください"
}
```

承認済み状態での成功レスポンス（parallel_analysis への遷移時）については、APIレスポンス設計セクションで詳細を説明する。

---

## エラーメッセージ設計

### FR-2: ユーザー意図との整合性セクション欠落エラー

artifact-validator.ts が `## ユーザー意図との整合性` セクションの欠落を検出した場合、以下の形式でエラーメッセージを出力する。既存の requiredSections 検証エラーのパターンに準拠した形式を使用する。

```
バリデーションエラー: code-review.md に必須セクションが不足しています。
不足しているセクション:
  - "## ユーザー意図との整合性"

修正方法: code-review.md に "## ユーザー意図との整合性" セクションを追加し、
以下の観点を5行以上の実質行で記述してください:
  1. userIntent に記載されたタスク目的の要約
  2. 実装内容と userIntent の合致判定（合致・部分合致・乖離のいずれか）
  3. 乖離がある場合の詳細説明、または「乖離なし」の明示
  4. 追加実装の妥当性（範囲外の機能がある場合の影響度）
  5. 総合判定（ユーザー意図の実現度を定性評価またはパーセンテージで記述）
```

### FR-1: requirements 承認未実施エラー

requirements フェーズで承認なしに `workflow_next` を呼び出した場合のエラーメッセージは、next.ts の既存実装（REQ-B1）が返す以下のテキストを使用する。

```
requirements承認が必要です。workflow_approve requirements を実行してください
```

このメッセージは既存コードに定義済みであり、FR-1 の文書化対象としてここに記録する。変更は不要である。
次フェーズでの実装時には、next.ts で REQ-B1 として実装済みのこのメッセージテキストをそのまま活用すること。

### バリデーション失敗時のリトライガイダンス

code_review サブエージェントがバリデーション失敗した場合に Orchestrator がリトライプロンプトで提示する改善要求の文言は以下のとおりである。

```
前回のバリデーション失敗を修正してください。
バリデーターが検出した問題: code-review.md の必須セクション不足

改善要求:
- バリデーターが検出した欠落セクションを追加してください
- 「ユーザー意図との整合性」という名前のセクションを ## レベルの見出しで作成してください
- セクション内にはタスクの目的要約・合致判定・乖離説明・追加実装の妥当性・総合判定の5観点を各1行以上で記述してください
- 各行には固有の情報を含め、同一行を3回以上繰り返さないこと
```

---

## APIレスポンス設計

### workflow_next 成功レスポンス（requirements 承認後、parallel_analysis 遷移時）

requirements フェーズで `workflow_approve` 実行済みの状態で `workflow_next` を呼び出した場合、以下の形式のレスポンスが返される。

```json
{
  "success": true,
  "previousPhase": "requirements",
  "currentPhase": "parallel_analysis",
  "message": "requirements フェーズが完了しました。parallel_analysis フェーズに遷移しました。",
  "subPhases": ["threat_modeling", "planning"],
  "phaseGuide": {
    "phase": "parallel_analysis",
    "subagentTemplate": "...(テンプレート文字列)..."
  }
}
```

### workflow_next エラーレスポンス（requirements 未承認時）

requirements 承認が未実施の状態で `workflow_next` を呼び出した場合は以下の形式のエラーレスポンスが返される。

```json
{
  "success": false,
  "currentPhase": "requirements",
  "error": "requirements承認が必要です。workflow_approve requirements を実行してください",
  "hint": "workflow_approve ツールの type パラメーターに \"requirements\" を指定して実行してください。"
}
```

### code_review 完了後のレスポンス（workflow_complete_sub 呼び出し時）

parallel_quality フェーズで code_review サブフェーズを完了させる `workflow_complete_sub` を呼び出した際は、FR-2 追加後の状態では以下の形式のレスポンスが返される。

```json
{
  "success": true,
  "completedSubPhase": "code_review",
  "remainingSubPhases": [],
  "message": "code_review サブフェーズが完了しました。",
  "artifactValidation": {
    "file": "code-review.md",
    "status": "passed",
    "checkedSections": [
      "## サマリー",
      "## 設計-実装整合性",
      "## コード品質",
      "## セキュリティ",
      "## パフォーマンス",
      "## ユーザー意図との整合性"
    ]
  }
}
```

バリデーション成功時は上記の `checkedSections` に `## ユーザー意図との整合性` が含まれ、FR-2 の要件が正しく検証されたことが確認できる。
code-review.md に `## ユーザー意図との整合性` セクションが欠落している場合は以下のエラーレスポンスが返される。

```json
{
  "success": false,
  "subPhase": "code_review",
  "error": "成果物バリデーション失敗: code-review.md に必須セクション \"## ユーザー意図との整合性\" が不足しています",
  "retryRequired": true
}
```

---

## 設定ファイル設計

### artifact-validator.ts の変更後設定形式（FR-2）

`artifact-validator.ts` の `REQUIRED_SECTIONS` マップにおける `code-review.md` エントリの変更後の形式を以下に示す。

```typescript
'code-review.md': {
  minLines: 30,
  requiredSections: [
    '設計-実装整合性',
    'コード品質',
    'セキュリティ',
    'パフォーマンス',
    'ユーザー意図との整合性'  // FR-2 で追加
  ],
},
```

変更箇所は `requiredSections` 配列への1要素追加のみである。`minLines` の値 30 は変更しない。セクション名の検索は部分一致で行われるため、見出しレベル（`##` の数）は問わない。

### definitions.ts の変更後 code_review subagentTemplate 設定形式（FR-2, FR-3）

`definitions.ts` の code_review サブフェーズの `requiredSections` フィールドは、以下の形式に変更する。

```typescript
requiredSections: [
  '## サマリー',
  '## 設計-実装整合性',
  '## コード品質',
  '## セキュリティ',
  '## パフォーマンス',
  '## ユーザー意図との整合性'  // FR-2 で追加
],
```

`subagentTemplate` に追加する2つのガイダンスブロックは、以下に示す位置にそれぞれ配置する。

FR-3 のクロスチェックガイダンスは、既存の「設計-実装整合性セクションの行数ガイダンス」にある5つの観点リストの末尾に追記する形式で配置する。

```
既存の観点5:
- ui-design.md の全UI要素が実装されているかの確認結果（未実装の場合は差し戻し推奨）

FR-3 で追加する観点6（上記に続けて追記）:
- threat-model.mdとの整合性確認（threat_modelingフェーズで検出された脅威が実装で対処されているかを確認した結果を記述する。未対処の脅威が発見された場合はimplementationフェーズへの差し戻しを推奨する）
```

FR-2 のユーザー意図整合性ガイダンスは、既存の出力セクション指示の直前に独立したセクションとして挿入する形式で配置する。

```
## ユーザー意図との整合性セクションの行数ガイダンス
「## ユーザー意図との整合性」セクションには必ず5行以上の実質行を記述すること。
以下の3観点を各1行以上で記述すること。
- userIntentに記載されたタスク目的の要約（タスク名および意図の要旨を1行で記述する）
- 実装内容とuserIntentの合致判定（合致・部分合致・乖離のいずれかを明示し、判定理由を記述する）
- 乖離がある場合の詳細説明（乖離が存在しない場合は「乖離なし、全機能がuserIntentを実現している」と明記する）
- 追加実装の妥当性（userIntentの範囲外に実装された機能がある場合はその影響度を記述する）
- 総合判定（ユーザー意図の実現度をパーセンテージまたは定性評価で記述する）
```
