# スコープ必須化とドキュメント階層化 調査結果

## サマリー

スコープ必須化とドキュメント階層化を実装するための現状分析を完了した。

### 主要な発見

現在 `workflow_set_scope` は完全に任意設定であり、研究・要件・計画フェーズのいずれでも呼ばれなくても
フローが継続する。`parallel_analysis → parallel_design` 遷移時のみスコープ必須チェックが存在するが、
それ以前のフェーズでは警告すら出ない構造になっている。

ドキュメント管理は `docs/workflows/{taskName}/` の単一フラットディレクトリに全成果物が集積する設計であり、
モジュール単位での分割機能は現状存在しない。ただし `docsDir` が環境変数 `DOCS_DIR` でオーバーライド
可能な点と、`definitions.ts` の `resolvePhaseGuide()` がプレースホルダー置換をサポートしている点は
階層化実装の足がかりになる。

### 次フェーズで必要な情報

- `next.ts` のフェーズ遷移バリデーションロジック（行206付近）がスコープ必須化の主要変更点
- `types.ts` の `scope?` を必須化するか、フェーズ遷移時チェックで代替するかの設計判断
- `definitions.ts` の `PHASES_BY_SIZE` でフェーズごとに `requiresScope` フラグを追加する案の検討
- モジュールパス（`modules/{module}/spec.md`）を `docsDir` の子ディレクトリとして扱う設計方針

---

## 調査詳細

### 1. workflow_set_scope の現在の実装（set-scope.ts）

`workflow_set_scope` ツールは required パラメータが空配列であり、完全に任意呼び出しとなっている。
呼び出し可能なフェーズは `research`, `requirements`, `planning`, `implementation`, `refactoring`,
`testing`, `docs_update`, `regression_test` と広範にわたるが、呼び出しを強制するガードが存在しない。

入力パラメータは `taskId`, `files[]`, `dirs[]`, `glob`, `addMode`, `sessionToken` で、
スコープサイズの上限として `MAX_SCOPE_FILES`（デフォルト10000）と `MAX_SCOPE_DIRS`（デフォルト1000）
が定義されている。バリデーションとしてファイル存在確認・ディレクトリ深度確認・依存関係警告が
実行されるが、これらは登録時のみ動作し、未登録状態を検知する仕組みではない。

スコープデータは `TaskState.scope` に `{ affectedFiles[], affectedDirs[], preExistingChanges[] }`
の形式で保存され、後続フェーズから参照される。`preExistingChanges` はワークフロー開始前の
既存変更ファイルを追跡するための FIX-1 対応フィールドである。

### 2. workflow_next でのスコープ検証（next.ts）

`next.ts` 行206-213 に `parallel_analysis → parallel_design` 遷移時のスコープ必須チェックが
実装されている。スコープファイル数とディレクトリ数の両方がゼロの場合、遷移をブロックして
「workflow_set_scope で影響範囲を設定してください」というエラーメッセージを返す。

一方、`research → requirements` および `requirements → parallel_analysis` 遷移では
スコープチェックが存在しない。行174-180 に警告ロジックがある可能性はあるが、
実際のブロック動作は `parallel_analysis` 遷移のみに限定されている。

この設計では、ユーザーが `parallel_analysis` 直前まで作業を進めた段階で初めてスコープ未設定を
認識することになり、手戻りコストが高い。研究フェーズでの早期警告が必要である。

### 3. TaskState 型定義（state/types.ts）

`scope` フィールドは Optional 型（`?`）として定義されており、TaskState 作成時にスコープなしで
タスクを開始できる設計になっている。型レベルでの必須化は行われていない。

```typescript
scope?: {
  affectedFiles: string[];
  affectedDirs: string[];
  preExistingChanges?: string[];
};
```

スコープ必須化のアプローチとして、型を `Required` に変更する方法と、フェーズ遷移時の
ランタイムチェックで代替する方法の2択がある。型変更は既存の全テストに影響するため、
ランタイムチェックの段階的強化が現実的な実装路線である。

### 4. フェーズ定義の構造（definitions.ts）

`definitions.ts` は `PHASES_BY_SIZE` として `small`（8フェーズ）・`medium`（14フェーズ）・
`large`（19フェーズ）の3種類のフェーズセットを定義している。各フェーズオブジェクトには
`name`, `description`, `allowedEditTypes`, `outputFiles`, `requiredArtifacts` などが含まれるが、
「このフェーズでスコープ必須」を示すフラグは現状存在しない。

`resolvePhaseGuide()` 関数がプレースホルダー置換（`{docsDir}` 等）をサポートしており、
モジュールパス（`{docsDir}/modules/{module}/spec.md`）への拡張が技術的に可能な構造である。
`calculatePhaseSkips()` 関数はスコープ内ファイルの拡張子からスキップすべきフェーズを
自動判定する機能を持っており、スコープ情報がフェーズ制御に既に活用されている。

### 5. ドキュメント配置の現状

ワークフロー内部状態は `.claude/state/workflows/{taskId}_{taskName}/workflow-state.json` に格納され、
ドキュメント出力先は `docs/workflows/{taskName}/` がデフォルトで、環境変数 `DOCS_DIR` で
オーバーライド可能な設計になっている。

`manager.ts` の `createTask()` 関数（行752付近）で `docsDir` が自動設定されるが、
モジュール単位のサブディレクトリを動的に生成する仕組みは持っていない。
現状は全フェーズの成果物が同一ディレクトリに出力されるフラット構造である。

### 6. スコープ検証モジュール（scope-validator.ts）

`validateScopeDepth()` でディレクトリの深度制限を設け、`validateScopeFiles()` でファイル存在を確認し、
`trackDependencies()` で BFS 走査による依存ファイル自動検出（最大深度20）を実装している。

`validateScopePostExecution()` は `docs_update → commit` 遷移時に `git diff` でスコープ外変更を
検出する後処理バリデーションである。除外パターンとして `.md`, `package.json`, `.claude/state/` などが
設定されている。この関数の存在は、スコープ管理の重要性がすでに認識されていることを示している。

### 7. フック層でのスコープ参照（enforce-workflow.js, discover-tasks.js）

`enforce-workflow.js` は `discoverTasks()` でアクティブタスクリストを取得し、
`findTaskByFilePath()` でファイルパスからタスクを推論する（`docsDir` / `workflowDir` のプレフィックスマッチ）。
モジュール階層パスを持つファイルも、複数マッチ時の最長一致ロジックにより自動的に正しいタスクに
紐付けられる設計になっている。

`discover-tasks.js` の `isPrefixMatchWithBoundary()` はパスの誤マッチを防ぐ境界チェックを実装しており、
`docs/workflows/module-a/` と `docs/workflows/module-ab/` のような類似パスを正確に区別できる。
キャッシュの TTL は30秒（以前調査時の1時間から改善済み）に設定されている。

---

## 既存コードで再利用可能な要素

スコープ必須化に向けては、`next.ts` 既存の遷移チェック構造（行206-213）を
`research → requirements` 遷移にも適用する形で拡張できる。禁止ではなく警告として段階的に
強度を上げる設計（research: 情報提示、requirements: 警告、parallel_analysis: ブロック）が
ユーザー体験として望ましい。

ドキュメント階層化に向けては、`docsDir` 環境変数オーバーライド機能と `resolvePhaseGuide()`
のプレースホルダー置換機能が土台として使える。新たに `moduleDir` プレースホルダーを追加し、
スコープで指定されたディレクトリ名から自動的にモジュール名を推定する仕組みを実装することで、
既存の subagent テンプレートへの変更を最小限に抑えられる。
