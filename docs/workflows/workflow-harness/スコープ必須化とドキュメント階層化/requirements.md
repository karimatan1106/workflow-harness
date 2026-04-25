# スコープ必須化とドキュメント階層化 要件定義書

## サマリー

本ドキュメントは「スコープ必須化とドキュメント階層化」タスクの要件定義を記述する。
調査フェーズで判明した現状課題（スコープ設定の遅延検出・フラット構造のドキュメント）を解消するため、
3つの機能領域（FR-1: スコープ段階的必須化、FR-2: ドキュメント階層化、FR-3: コンテキスト絞り込み）に対して
具体的な受け入れ基準と実装制約を定義する。

### 主要な決定事項

- スコープ未設定の検出タイミングを `parallel_analysis` のみから `research` 完了時点へ前倒しする
- ブロックは `parallel_analysis → parallel_design` 遷移のみに維持し、それ以前は情報・警告にとどめる
- ドキュメント階層化は `definitions.ts` の `resolvePhaseGuide()` へのプレースホルダー追加で実現する
- 型レベルの変更（`scope?` の必須化）は既存テストへの影響が大きいため採用しない
- subagent プロンプトのスコープ制約はテンプレート文言の追加のみで実現し、ランタイム変更を最小化する

### 次フェーズで必要な情報

- `next.ts` 行206-213 の遷移バリデーション実装の詳細（既存チェックとの衝突回避のため）
- `definitions.ts` の `resolvePhaseGuide()` 関数の現在のプレースホルダーリスト
- `calculatePhaseSkips()` がスコープ情報をどのように参照しているか（副作用確認のため）
- 既存 897 テストのうち `next.ts` に関連するテスト数と対象ファイルパス

---

## 機能要件

### FR-1: スコープ段階的必須化

スコープ未設定の検出タイミングを段階的に前倒しし、ユーザーが早期にスコープ設定の必要性を認識できるようにする。

#### FR-1-1: research フェーズ完了時の情報メッセージ

`workflow_next` で `research → requirements` 遷移を実行した際、スコープが未設定の場合に
1行以内の日本語情報メッセージを `workflow_next` のレスポンス内に含める。
メッセージは遷移をブロックしない（`success: true` を返す）。
メッセージ文言例: 「スコープが未設定です。`workflow_set_scope` で影響範囲を設定することを推奨します。」

#### FR-1-2: requirements → parallel_analysis 遷移時の警告

`workflow_next` で `requirements → parallel_analysis` 遷移を実行した際、スコープが未設定の場合に
日本語警告メッセージをレスポンスに含める。遷移自体はブロックしない（`success: true` を返す）。
警告はエラーメッセージとは区別し、`warnings` フィールドまたは `message` 内のプレフィックスで表現する。

#### FR-1-3: parallel_analysis → parallel_design 遷移時のブロック（現状維持・強化）

`next.ts` 行206-213 の既存チェックを維持しつつ、エラーメッセージを日本語 1 行以内に整備する。
`affectedFiles.length === 0 && affectedDirs.length === 0` の条件はそのまま保持する。
`success: false` を返し、遷移をブロックすることは現状と変わらない。

#### FR-1-4: test_impl フェーズのスコープなしスキップ（現状維持・強化）

スコープが未設定の状態で `test_impl` フェーズに到達した場合、フェーズをスキップして次フェーズへ進む
既存の `calculatePhaseSkips()` 動作を維持する。スキップ時に日本語 1 行以内の警告メッセージを返す。
スキップ判定ロジックの変更は行わず、メッセージ出力の追加のみを行う。

### FR-2: ドキュメント階層化

モジュール単位のドキュメントパスをワークフロー成果物として認識できる仕組みを提供する。

#### FR-2-1: モジュールパスのサポート

`{docsDir}/modules/{moduleName}/spec.md` 形式のパスを `outputFiles` および `requiredArtifacts` として
`definitions.ts` のフェーズ定義内で記述できるようにする。
`resolvePhaseGuide()` が `{moduleDir}` プレースホルダーを解決できるよう拡張する。

#### FR-2-2: モジュール名の自動推定

`workflow_set_scope` で `dirs` パラメータを指定した際、最初のディレクトリの末尾コンポーネントを
モジュール名として `TaskState.scope` に保存する。
複数ディレクトリが指定された場合も最初のディレクトリ名のみをモジュール名に使用する。
例: `dirs: ["src/backend/domain/auth"]` の場合、`moduleName: "auth"` として保存する。

#### FR-2-3: resolvePhaseGuide への moduleDir プレースホルダー追加

`definitions.ts` の `resolvePhaseGuide()` 関数に `{moduleDir}` プレースホルダーを追加する。
`{moduleDir}` は `{docsDir}/modules/{moduleName}` に展開される。
`moduleName` が設定されていない場合、`{moduleDir}` は `{docsDir}` に展開（フォールバック）する。
既存の `{docsDir}`, `{workflowDir}` など他のプレースホルダーの動作は変えない。

### FR-3: コンテキスト絞り込み

subagent がスコープ外の大量ファイルを誤って読み込まないよう、プロンプトテンプレートに制約を追加する。

#### FR-3-1: subagent 起動テンプレートへのスコープ制約追加

CLAUDE.md の subagent 起動テンプレートにスコープ制約セクションを追加する。
制約内容: スコープが設定されている場合、入力ファイルをスコープ内のファイルに限定することを指示する文言。
テンプレートへの追加はドキュメント変更のみで、コード変更は伴わない。

#### FR-3-2: definitions.ts のテンプレート文言更新

`definitions.ts` 内の `inputFiles` に関する記述に、スコープが設定されている場合は
スコープ内ファイルのみを参照する旨の注記を追加する。
この変更は文言追加のみであり、ランタイムのファイルフィルタリング処理は追加しない。

---

## 非機能要件

### NFR-1: テスト互換性

既存の 897 テスト（`workflow-plugin/mcp-server` の vitest スイート）が全て継続してパスすること。
`scope?` を Required に変更しないことで、`TaskState` を使用する全テストへの影響を回避する。
`next.ts` のチェック追加はテスト内でモックされた `scope` が `undefined` の場合も考慮した実装とする。

### NFR-2: エラーメッセージの品質

スコープ未設定時のエラー・警告・情報メッセージは全て日本語で表示し、1 行以内に収めること。
メッセージ内に改行コードを含めないこと。`workflow_set_scope` の具体的なコマンド名を含めること。
ブロックするチェック（`parallel_analysis` 遷移）のメッセージには `success: false` を明示すること。

### NFR-3: 既存フェーズ定義への影響ゼロ

`definitions.ts` への変更は `resolvePhaseGuide()` の拡張と `{moduleDir}` プレースホルダー追加のみとする。
`PHASES_BY_SIZE`, `SUB_PHASE_DEPENDENCIES`, `PHASE_EDIT_RULES` など既存の定数は変更しない。
`calculatePhaseSkips()` のロジック本体は変更せず、メッセージ追加のみを行う。

### NFR-4: フェーズ遷移のパフォーマンス

`next.ts` に追加するスコープチェックはメモリアクセスのみで完結し、I/O 処理を含まないこと。
遷移処理全体の実行時間増加は 10ms 以内とすること。
`scope` フィールドの存在確認は `taskState.scope?.affectedFiles?.length` パターンで行い、
null 安全なアクセスにより例外を発生させないこと。

### NFR-5: 後方互換性

`workflow_set_scope` を一度も呼び出さないで `parallel_analysis` 前のフェーズを進めている既存タスクは、
警告・情報メッセージが追加されるが遷移はブロックされないため、作業継続が可能であること。
`parallel_analysis → parallel_design` のブロックは既存動作の維持であり後方互換の変更ではない。

---

## 受け入れ基準

以下の全ての基準を満たすことでタスク完了とする。

### AC-1: research → requirements 遷移時の情報メッセージ

スコープ未設定の状態で `workflow_next` を呼び出し `research → requirements` 遷移を実行すると、
レスポンスに「スコープが未設定」に言及する日本語情報メッセージが含まれること。
遷移自体は成功し、フェーズが `requirements` に変わること。

### AC-2: requirements → parallel_analysis 遷移時の警告

スコープ未設定の状態で `workflow_next` を呼び出し `requirements → parallel_analysis` 遷移を実行すると、
レスポンスに「スコープが未設定」に言及する日本語警告メッセージが含まれること。
遷移自体は成功し、フェーズが `parallel_analysis` に変わること。

### AC-3: parallel_analysis → parallel_design 遷移時のブロック

スコープ未設定の状態で `parallel_analysis` が完了し `workflow_next` で次遷移を実行すると、
レスポンスの `success` が `false` になること。フェーズが `parallel_design` に変わらないこと。
エラーメッセージに `workflow_set_scope` のコマンド名が含まれること。

### AC-4: モジュールパスの解決

`workflow_set_scope` で `dirs: ["src/backend/domain/auth"]` を指定した後、
`resolvePhaseGuide()` を呼び出すと `{moduleDir}` が `{docsDir}/modules/auth` に展開されること。
展開されたパスを持つ成果物ファイルがバリデーション対象として認識されること。

### AC-5: 全テストのパス

`workflow-plugin/mcp-server` ディレクトリで `npm test` を実行し、897 件以上のテストが全てパスすること。
新規追加テストがスコープチェックの各ブランチ（情報・警告・ブロック）をカバーすること。
`moduleName` 自動推定のロジックがユニットテストで検証されること。

---

## 影響範囲

変更対象ファイルを以下に列挙する。

主要変更ファイルは `workflow-plugin/mcp-server/src/phases/next.ts` であり、
`research → requirements` および `requirements → parallel_analysis` 遷移へのスコープチェック追加が
最も影響の大きな変更となる。

補助変更ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` であり、
`resolvePhaseGuide()` への `{moduleDir}` プレースホルダー追加が変更内容である。

スコープ自動推定は `workflow-plugin/mcp-server/src/phases/set-scope.ts` に
`moduleName` の抽出・保存ロジックを追加することで実現する。

型定義の変更は最小限にとどめ、`TaskState` の `scope` フィールドへの `moduleName?: string`
追加のみを `workflow-plugin/mcp-server/src/state/types.ts` に行う。

テスト追加対象は `workflow-plugin/mcp-server/src/phases/next.test.ts` および
`workflow-plugin/mcp-server/src/phases/set-scope.test.ts` の既存テストファイルへの追記とする。
