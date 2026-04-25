## サマリー

- 目的: 前タスク「スコープ必須化とドキュメント階層化」のコードレビューで指摘された4件の問題について、修正要件を確定させ、後続フェーズ（planning → test_design → test_impl → implementation）の作業基盤を整備する。
- 主要な決定事項: 全4件の修正は独立しており、相互依存関係がない。BUG-1は `replaceAll` への統一で解決する。BUG-2は返却値オブジェクトへの `moduleName` フィールド追加で解決する。BUG-3は関数名・JSDocを実態（キーワードフォールバック）に合わせて修正する。BUG-4は `calculatePhaseSkips` でスコープ空配列の場合にスキップ理由メッセージを付与する処理を追加する（FR-1-4 要件原文の確認済み）。
- 次フェーズで必要な情報: 修正対象ファイルは3ファイル（`definitions.ts`、`set-scope.ts`、`semantic-checker.ts`）で計7箇所の変更が必要。BUG-4の修正対象は `calculatePhaseSkips` 関数の早期リターン部分（definitions.ts 行518-521）であり、FR-1-4 の要件は「スキップ判定ロジックの変更なし・メッセージ出力の追加のみ」と確定している。

---

## 機能要件

### BUG-1: `resolvePhaseGuide` のプレースホルダー置換をグローバル化

#### 問題の概要

`definitions.ts` の `resolvePhaseGuide` 関数内で、`{docsDir}` および `{moduleDir}` プレースホルダーの置換に `String.prototype.replace` を文字列リテラルで呼び出している。
この呼び出し形式では、ECMAScript 仕様上、文字列内に同じプレースホルダーが2回以上登場した場合に最初のマッチのみが置換される。
現在の `PHASE_GUIDES` 定義では各パス文字列内にプレースホルダーが1回しか登場しないため実害はないが、定義が拡張された場合に潜在バグが顕在化する。

#### 修正要件

`resolvePhaseGuide` 関数内に存在する全ての `.replace('{docsDir}', ...)` および `.replace('{moduleDir}', ...)` 呼び出しを、
`replaceAll` に統一すること。`replaceAll` は ES2021 以降で利用可能であり、このプロジェクトの TypeScript 環境で使用できる。
具体的な置換対象は `outputFile` フィールド、`inputFiles` 配列の各要素、`inputFileMetadata` 配列内の `path` フィールド、
サブフェーズの同名フィールドを含む全12箇所の `replace` 呼び出しである。

#### 受け入れ基準

- `resolvePhaseGuide` 関数内の `.replace('{docsDir}', docsDir)` が `.replaceAll('{docsDir}', docsDir)` に変更されていること
- `resolvePhaseGuide` 関数内の `.replace('{moduleDir}', moduleDir)` が `.replaceAll('{moduleDir}', moduleDir)` に変更されていること
- 単一パス文字列内に `{docsDir}` が2回登場するテストケースで、両方が正しく置換されること
- 既存の PHASE_GUIDES 定義のパス解決結果が修正前後で一致すること（リグレッションなし）

#### 影響範囲

変更対象は `definitions.ts` の `resolvePhaseGuide` 関数内に限定される。
関数のシグネチャや戻り値の型は変更しない。他のファイルへの波及はない。

---

### BUG-2: `workflow_set_scope` の返却値に `moduleName` を追加

#### 問題の概要

`set-scope.ts` において、TaskState の `scope.moduleName` には自動推定された `inferredModuleName` が正しく保存されるが、
MCP ツールの返却値オブジェクトの `scope` フィールドに `moduleName` が含まれていない。
この欠落により、`workflow_set_scope` を呼び出したオーケストレーターが返却値の `scope.moduleName` を参照した場合に
フィールドが存在せず、スコープ設定の確認メッセージに誤情報が含まれる。

#### 修正要件

`set-scope.ts` の返却値構築部分（行339-348）の `scope` オブジェクトリテラルに `moduleName: inferredModuleName` を追加すること。
また、`message` 文字列にも `moduleName` が含まれると、オーケストレーターが設定内容を一見して確認できるため、
モジュール名が設定された場合に限り、メッセージ末尾に「モジュール名: {moduleName}」を追記することが望ましい。

#### 受け入れ基準

- `workflow_set_scope` の返却値に `scope.moduleName` フィールドが含まれること
- `dirs` を指定した場合、推定されたモジュール名が返却値の `scope.moduleName` に反映されること
- `dirs` を指定しない場合でも返却値オブジェクトの構造が壊れないこと（`moduleName` が `undefined` または省略されても可）
- TaskState への保存内容は変更しないこと（保存ロジックはそのまま維持）

#### 影響範囲

変更対象は `set-scope.ts` の返却値構築部分1箇所に限定される。
TaskState の書き込みロジックには触れない。他のファイルへの波及はない。

---

### BUG-3: `validateLLMSemanticTraceability` の関数名・JSDoc を実態と一致させる

#### 問題の概要

`semantic-checker.ts` の関数 `validateLLMSemanticTraceability` は、名称や JSDoc が「LLM を使ったセマンティック検証」を示しているが、
実装の実態はキーワードマッチングによるトレーサビリティ検証であり、LLM（Anthropic API）は一切呼び出されない。
SDK の可用性チェック構造が残っているが、SDK が利用可能と判定された場合でも実際は同じキーワードマッチングが実行される。
この乖離は開発者が関数の挙動を誤解する原因となり、将来の保守時に重複実装や競合が生じるリスクを生む。

#### 修正要件

関数名を `validateKeywordSemanticTraceability` または `validateSemanticTraceabilityFallback` といった、
LLM 呼び出しを示唆しない名前に変更すること。
JSDoc（行199-210）を実際の動作に合わせて書き直すこと。
修正後の JSDoc は「SDK に依存しないキーワードトレーサビリティ検証を行う。SDK が利用可能な場合にも現時点ではキーワード方式を使用する。
将来的に LLM 検証への切り替えが計画されている拡張ポイントである」という趣旨で記述すること。
`validateLLMSemanticTraceability` を呼び出している箇所がある場合は、その参照名も同時に変更すること。

#### 受け入れ基準

- 関数名から `LLM` という表現が除去されていること
- JSDoc に「LLM を使う」または「API を呼び出す」という誤った記述が残っていないこと
- 関数の動作（キーワードマッチング + フォールバック）が JSDoc に正確に記述されていること
- 関数名変更によるコンパイルエラーが発生しないこと（参照箇所の一括変更が完了していること）

#### 影響範囲

変更対象は `semantic-checker.ts` の関数定義と JSDoc のみ。
この関数が `validateSemanticConsistency` から呼び出されている場合は参照箇所も変更する。
実行時の動作ロジックには変更を加えない。

---

### BUG-4: `calculatePhaseSkips` にスコープ未設定時のスキップ理由メッセージを追加

#### 問題の概要

`definitions.ts` の `calculatePhaseSkips` 関数は、`files.length === 0`（スコープが空配列）の場合に
空の `phaseSkipReasons` オブジェクトをそのまま返す。この結果、スコープを設定せずにタスクを進めた場合、
テストファイルが存在しなくても `test_impl` フェーズが実行され、コードファイルが存在しなくても `implementation` フェーズが実行される。
前タスク（スコープ必須化）の FR-1-4 要件では「スキップ判定ロジックの変更なし・メッセージ出力の追加のみ」と明確に定義されており、
この追加処理が実装されなかった点が問題である。

#### 修正要件

`files.length === 0` の早期リターン部分（行518-521）を修正し、スコープが空配列の場合に以下のスキップ理由メッセージを付与して返すこと。
付与対象のフェーズキーとメッセージは下記の3件である。

1件目の対象フェーズキー `test_impl`: スキップ理由は「スコープが未設定のためテスト実装フェーズをスキップ」とすること。
2件目の対象フェーズキー `implementation`: スキップ理由は「スコープが未設定のため実装フェーズをスキップ」とすること。
3件目の対象フェーズキー `refactoring`: スキップ理由は「スコープが未設定のためリファクタリングフェーズをスキップ」とすること。

スキップ判定ロジック（拡張子チェック・テストパターンマッチング）は変更しない。
`userIntent` によるスキップオーバーライド（行553-566）も引き続き適用されるよう、
空配列の場合にもオーバーライド処理が実行される順序にすること。

#### 受け入れ基準

- `scope.affectedFiles` と `scope.files` がどちらも空配列の場合、返却オブジェクトに `test_impl`、`implementation`、`refactoring` の3キーが含まれること
- 各キーに対応するスキップ理由メッセージが日本語で設定されていること
- `userIntent` に実装関連のキーワードが含まれる場合、`implementation` および `refactoring` のスキップが除去されること
- `userIntent` にテスト関連のキーワードが含まれる場合、`test_impl` のスキップが除去されること
- スコープに1件以上のファイルが設定されている場合は従来の拡張子ベース判定が継続して実行されること

#### 影響範囲

変更対象は `definitions.ts` の `calculatePhaseSkips` 関数内に限定される。
`calculatePhaseSkips` の呼び出し元（`next.ts` 等）はそのまま使用できる（シグネチャ変更なし）。

---

## 非機能要件

### 修正優先順位

4件の修正はいずれも独立しており、並列で対応可能である。
ただし対応する際の推奨優先順位は以下のとおりである。

1番目の優先: BUG-2（`moduleName` 欠落）は MCP API の返却値に関わる誤情報のため最優先で修正する。
2番目の優先: BUG-4（スキップメッセージ欠落）はフェーズ制御の挙動に直接影響するため次に修正する。
3番目の優先: BUG-3（JSDoc・関数名乖離）は保守性に関わる問題のため3番目に修正する。
4番目の優先: BUG-1（`replaceAll` 化）は現状で実害のない予防的修正のため最後に対応する。

### テスト方針

各バグに対してユニットテストを `test_impl` フェーズで作成し、`implementation` フェーズで修正を実施する TDD 方式を採用する。
既存テストスイートがリグレッションしないことを `regression_test` フェーズで確認すること。

BUG-1 のテストは、プレースホルダーが2回登場するパス文字列を引数に渡した場合に全箇所が置換されることを検証する。
BUG-2 のテストは、`workflow_set_scope` の返却値オブジェクトに `scope.moduleName` が含まれることを検証する。
BUG-3 のテストは、関数名の変更後に既存の参照箇所がコンパイルエラーなく動作することを確認する。
BUG-4 のテストは、空配列を渡した場合と1件以上のファイルを渡した場合の両方で `calculatePhaseSkips` の返却値を検証する。

### 後方互換性

全4件の修正は、既存の公開インターフェースを破壊しない形で実施すること。
関数のシグネチャ変更が必要な場合（BUG-3 の関数名変更）は、参照箇所を同時に更新してコンパイルエラーが発生しないことを確認する。
TaskState の保存形式への変更は行わない（BUG-2 はツール返却値の追加のみ）。

### ビルド要件

修正後に `npm run build` が成功することを確認すること。
TypeScript のコンパイルエラーが発生しないことをビルドチェックフェーズで検証する。
`replaceAll` は TypeScript 4.9 以降で型定義が提供されているため、`tsconfig.json` の `lib` 設定が `ES2021` 以上であることを前提とする。

### 修正対象ファイル一覧

全修正を通じて変更が発生するファイルは以下の3ファイルである。

- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`（BUG-1 および BUG-4 の修正対象）
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\set-scope.ts`（BUG-2 の修正対象）
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\semantic-checker.ts`（BUG-3 の修正対象）
