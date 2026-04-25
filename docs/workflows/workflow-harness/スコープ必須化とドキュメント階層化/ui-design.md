# スコープ必須化とドキュメント階層化 UI設計書

## サマリー

本ドキュメントは「スコープ必須化とドキュメント階層化」タスクにおける UI（CLI・API・設定ファイル）設計をまとめたものである。
本タスクの対象はエンドユーザー向けグラフィカルUIではなく、MCP サーバーツールのインターフェース設計であるため、
CLI（ツール引数仕様）・エラーメッセージ文言・API レスポンス形式・状態ファイルのスキーマが設計対象となる。

主要な決定事項:
- 情報レベル・警告レベル・ブロックの3段階メッセージ設計を FR-1 の段階的必須化に対応させる
- `workflow_next` レスポンスの既存 `message` フィールドにプレフィックスを付与してフェーズを表現する
- `workflow_set_scope` の `dirs` パラメータからモジュール名を自動推定し、ユーザーの明示的な追加入力を不要とする
- `TaskState.scope.moduleName` フィールドをオプショナル追加して後方互換を維持する

次フェーズ（parallel_design）では本設計書のステートマシン図・フローチャートを作成する。

---

## CLIインターフェース設計

### workflow_set_scope ツール引数仕様

`workflow_set_scope` ツールは既存のパラメータ構成を維持したまま、モジュール名の自動推定機能を追加する。
ユーザーが新たに `moduleName` パラメータを指定する必要はなく、`dirs` パラメータの値から自動的に推定される。

受け入れるパラメータの一覧と型定義:

| パラメータ名 | 型 | 必須 | 説明 |
|---|---|---|---|
| taskId | string | 条件付き | 対象タスクID（省略時はアクティブタスクを使用）|
| files | string[] | 省略可 | 影響を受けるファイルのパスリスト |
| dirs | string[] | 省略可 | 影響を受けるディレクトリのパスリスト（先頭要素からモジュール名を自動推定）|
| glob | string | 省略可 | globパターン（例: src/stars/x.ts）|
| addMode | boolean | 省略可 | 追加モード（true の場合は既存スコープとマージ）|

`dirs` パラメータを渡した場合の自動推定の動作: 配列の先頭要素のパス末尾セグメント（basename）を
`moduleName` として保存する。たとえば `dirs: ["workflow-plugin/mcp-server/src/"]` を渡すと
`moduleName = "src"` が記録される。

`dirs` が空で `files` のみを渡した場合、新たな `moduleName` は推定されず保存もされない。
`addMode: true` かつ `dirs` が空の場合は既存の `moduleName` をそのまま引き継ぐ設計とする。

### 段階的スコープチェックの動作説明

段階的スコープチェックは `workflow_next` 呼び出し時に実行され、フェーズ遷移のタイミングに応じて
情報・警告・ブロックの3段階の動作を行う。

research フェーズ完了時（情報レベル）の動作:
スコープが未設定の場合、`message` フィールドに情報メッセージを付与して遷移を許可する。
`success: true` を返し、ユーザーの作業継続を妨げない。既存コードの行174-180の文言を整備する形で対応する。

requirements フェーズ完了時（警告レベル）の動作:
スコープが未設定の場合、`message` フィールドに警告メッセージを付与して遷移を許可する。
`success: true` を返す点は情報レベルと同じだが、parallel_analysis でブロックされる旨を事前に告知する。

parallel_analysis フェーズ完了時（ブロック）の動作:
スコープが未設定の場合、遷移を拒否して `success: false` を返す。
この動作は既存の実装を変更せず維持する（既存ブロックロジックの保持）。

---

## エラーメッセージ設計

### 3段階メッセージ仕様（FR-1対応）

メッセージは全て日本語で統一し、1行以内に収める。
改行コードをメッセージ本文に含めないことが NFR-2 の要件であり、
`workflow_next` レスポンス JSON をパースするクライアントとの互換性を確保するために必要な制約である。

#### 情報レベル（research フェーズ完了時）

表示条件: research → requirements 遷移時にスコープが未設定の場合
動作: 遷移を許可する（success: true）
推奨文言:

```
スコープが未設定です。workflow_set_scope で影響範囲を設定することを推奨します。
```

文言の要件として `workflow_set_scope` という文字列を含めること（AC-3 の受け入れ基準）。
情報メッセージは遷移をブロックしないため、ユーザーはそのまま次フェーズに進むことができる。

#### 警告レベル（requirements フェーズ完了時）

表示条件: requirements → parallel_analysis 遷移時にスコープが未設定の場合
動作: 遷移を許可する（success: true）だが、次のブロックを予告する
推奨文言:

```
スコープが未設定です。parallel_analysis フェーズに進む前に workflow_set_scope で設定してください。
```

警告メッセージには parallel_analysis でブロックされる旨を含めることで、ユーザーが事前に対処できるようにする。
警告追加は `scopeWarnings` 配列への push のみであり、遷移成否（success フラグ）には影響しない設計とする。

#### ブロック（parallel_analysis フェーズ完了時）

表示条件: parallel_analysis → parallel_design 遷移時にスコープが未設定の場合
動作: 遷移を拒否する（success: false）
推奨文言:

```
スコープ（影響範囲）が未設定のため parallel_design フェーズに進めません。workflow_set_scope で設定してください。
```

ブロックメッセージは `success: false` と組み合わせて返す。既存の実装を変更せず維持する。
ユーザーは `workflow_set_scope` でスコープを設定してから再度 `workflow_next` を呼び出す必要がある。

### メッセージ区別の仕組み

情報・警告・ブロックのメッセージをクライアントが識別するための区別基準:
- `success: false` であればブロックと判定できる
- `success: true` かつ `message` に「推奨」が含まれれば情報レベルと判定できる
- `success: true` かつ `message` に「設定してください」が含まれれば警告レベルと判定できる

将来的に `warnings` フィールドへの分離も視野に入れているが、本タスクでは `message` プレフィックス方式で実装し、
構造変更は最小限に留める。これにより既存クライアントとの互換性を維持しつつ段階的移行を可能とする。

---

## APIレスポンス設計

### workflow_next レスポンス形式

`workflow_next` の基本レスポンス型は変更しない。
スコープ警告は既存の `message` フィールドに情報を追記する形式を採用する。

成功遷移時のレスポンス例（スコープ設定済み）:

```json
{
  "success": true,
  "message": "requirements フェーズが完了しました。次のフェーズ: parallel_analysis",
  "currentPhase": "parallel_analysis",
  "taskId": "abc123"
}
```

成功遷移時のレスポンス例（スコープ未設定・警告付き）:

```json
{
  "success": true,
  "message": "requirements フェーズが完了しました。スコープが未設定です。parallel_analysis フェーズに進む前に workflow_set_scope で設定してください。次のフェーズ: parallel_analysis",
  "currentPhase": "parallel_analysis",
  "taskId": "abc123"
}
```

ブロック時のレスポンス例（スコープ未設定）:

```json
{
  "success": false,
  "message": "スコープ（影響範囲）が未設定のため parallel_design フェーズに進めません。workflow_set_scope で設定してください。",
  "currentPhase": "parallel_analysis",
  "taskId": "abc123"
}
```

### workflow_set_scope レスポンス形式

`workflow_set_scope` 呼び出し成功時のレスポンスに `moduleName` が追加される。
既存フィールドは変更せず、推定された `moduleName` を追加情報として含める。

成功時のレスポンス例（dirs あり）:

```json
{
  "success": true,
  "message": "スコープを設定しました。",
  "affectedFiles": [],
  "affectedDirs": ["workflow-plugin/mcp-server/src/"],
  "moduleName": "src"
}
```

成功時のレスポンス例（dirs なし・moduleName なし）:

```json
{
  "success": true,
  "message": "スコープを設定しました。",
  "affectedFiles": ["workflow-plugin/mcp-server/src/tools/next.ts"],
  "affectedDirs": []
}
```

`moduleName` フィールドはスコープが推定できた場合のみ含まれ、推定できない場合はレスポンスから省略される。
クライアントは `moduleName` フィールドの有無を条件分岐で処理する必要があることを明記する。

### resolvePhaseGuide 内部 API 変更仕様

`resolvePhaseGuide` 関数の引数シグネチャに `moduleName?: string` を追加する。
外部向けの公開 API（MCP ツール）ではなく内部関数の変更であるため、クライアントへの直接影響はない。

変更後のシグネチャ:

```typescript
export function resolvePhaseGuide(
  phase: string,
  docsDir?: string,
  userIntent?: string,
  moduleName?: string
): PhaseGuide | undefined
```

既存の呼び出しコードは第4引数を渡していないため変更不要であり、
TypeScript のオプショナル引数により既存テスト897件に対して型エラーは発生しない。
`next.ts` の呼び出し箇所のみ `taskState.scope?.moduleName` を渡すように更新する。

---

## 設定ファイル設計

### TaskState.scope フィールドの型定義

`TaskState` の `scope` フィールドに `moduleName` をオプショナル追加する。
変更は2行の追加のみであり、既存フィールドの型や必須/省略の区別は変更しない。

変更前の型定義:

```typescript
scope?: {
  affectedFiles: string[];
  affectedDirs: string[];
  preExistingChanges?: string[];
};
```

変更後の型定義:

```typescript
scope?: {
  affectedFiles: string[];
  affectedDirs: string[];
  preExistingChanges?: string[];
  /** dirs 指定時に自動推定されるモジュール名（FR-2-2）。{moduleDir} プレースホルダーの展開に使用する */
  moduleName?: string;
};
```

`moduleName` をオプショナル（`?:`）とした理由:
既存のすべての `TaskState` インスタンスは `moduleName` を持たないため、必須化すると既存テストの型エラーが発生する。
TypeScript の構造的部分型付けにより、オプショナルフィールドの追加は既存の型チェックを破壊しない。

### workflow-state.json 保存形式

`workflow-state.json` に保存される `scope` オブジェクトの JSON 形式:

スコープ設定後（`dirs` あり）の保存例:

```json
{
  "scope": {
    "affectedFiles": [],
    "affectedDirs": ["workflow-plugin/mcp-server/src/"],
    "preExistingChanges": [],
    "moduleName": "src"
  }
}
```

スコープ未設定の場合、`scope` フィールド自体が省略されるか `null` となる。
`moduleName` は `dirs` パラメータを渡さない限り保存されないため、既存の `workflow-state.json` との後方互換が保たれる。
既存のステートファイルを持つタスクに対して `moduleName` の初期化処理は不要である。

### {moduleDir} プレースホルダーの展開規則

フェーズ定義ファイル（`definitions.ts`）内で使用可能なプレースホルダーの対応表:

| プレースホルダー | 展開先 | 既存/新規 |
|---|---|---|
| {docsDir} | `docs/workflows/{taskId}_{taskName}/` | 既存 |
| {workflowDir} | `.claude/state/workflows/{taskId}_{taskName}/` | 既存 |
| {moduleDir} | `{docsDir}/modules/{moduleName}` または `{docsDir}` | 新規追加 |

`{moduleDir}` の展開ルール:
- `moduleName` が設定されている場合: `{docsDir}/modules/{moduleName}` に展開する
- `moduleName` が未設定の場合: `{docsDir}` にフォールバックして後方互換を保つ

フォールバック設計の採用理由: `moduleName` を持たない既存タスクのフェーズ定義で
`{moduleDir}` プレースホルダーを使用した場合にエラーを発生させないためである。
フォールバックにより既存の動作が維持され、段階的な移行が可能となる。

### ドキュメント階層の物理ディレクトリ構造

`{moduleDir}` プレースホルダーを使用した場合に生成されるディレクトリ構造の例:

`moduleName = "auth"` と設定された場合の成果物配置:

```
docs/workflows/{taskId}_{taskName}/
├── modules/
│   └── auth/
│       ├── spec.md          ← {moduleDir}/spec.md として参照
│       ├── test-design.md   ← {moduleDir}/test-design.md として参照
│       └── flowchart.mmd    ← {moduleDir}/flowchart.mmd として参照
├── research.md              ← {docsDir}/research.md（従来通り）
└── requirements.md          ← {docsDir}/requirements.md（従来通り）
```

`{moduleDir}` を未使用の既存フェーズ定義は従来通り `{docsDir}` 直下に成果物を出力する。
新規フェーズ定義で `{moduleDir}` を採用する場合のみ `modules/` サブディレクトリが作成される。
複数タスクが並行して実行される場合は各タスクの `docsDir` が独立しているためパスの衝突は起こらない。
