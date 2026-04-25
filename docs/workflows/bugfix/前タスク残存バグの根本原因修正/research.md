## サマリー

- 目的: 前タスク「スコープ必須化とドキュメント階層化」のコードレビューで検出された4件の問題について根本原因を特定し、修正方針を策定する。
- 主要な決定事項: 問題1は文字列 replace のグローバルフラグ欠落による部分置換バグ（現状は outputFile レベルでは実害なし、prompt テキスト内で複数回登場する場合に顕在化）。問題2は返却値オブジェクトへの moduleName フィールド追加漏れ。問題3は JSDoc・関数名と実装の乖離（LLM呼び出しを実際には行わない）。問題4は calculatePhaseSkips のスコープ空配列時のメッセージ欠落。
- 次フェーズで必要な情報: 修正対象ファイルは3ファイル（definitions.ts、set-scope.ts、semantic-checker.ts）。各修正は独立しており依存関係がない。

---

## 問題1: definitions.ts の replace グローバルフラグ未使用

### 調査対象箇所

ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
調査行: 1431〜1476行（`resolvePhaseGuide` 関数内のプレースホルダー置換処理）

### 実際のコード

`resolvePhaseGuide` 関数では以下のパターンで置換が実装されている。

```typescript
resolved.outputFile = resolved.outputFile
  .replace('{docsDir}', docsDir)
  .replace('{moduleDir}', moduleDir);

resolved.inputFiles = resolved.inputFiles.map(f =>
  f.replace('{docsDir}', docsDir).replace('{moduleDir}', moduleDir)
);
```

`String.prototype.replace` に文字列リテラルを渡した場合、ECMAScript 仕様上は最初のマッチのみが置換される。
正規表現にグローバルフラグ（`/g`）を指定した場合や `replaceAll` を使用した場合のみ、全出現箇所が置換される。

### 現状での実害分析

`PHASE_GUIDES` 内の全 `outputFile` 値を確認した結果、全てのパスは `{docsDir}/xxx.md` の形式であり、
`{docsDir}` または `{moduleDir}` が1つのパス文字列内に2回以上登場するケースは存在しない。

同様に `inputFileMetadata[].path` の各要素も `{docsDir}/xxx.md` の形式で1回しか含まれない。

したがって現時点の PHASE_GUIDES 定義では実際の動作バグは生じていない。
ただし将来的に `{docsDir}/modules/{moduleDir}/subdir/{docsDir}/xxx.md` のような複合パスが追加された場合には、
2番目以降の `{docsDir}` が未置換のままになるという潜在バグが顕在化する。

また `buildPrompt` 関数（行1006）は `guide.outputFile` や `guide.inputFileMetadata[].path` を
既に `resolvePhaseGuide` で解決済みの値として受け取るため、`buildPrompt` 自体は二重置換の問題を持たない。

### 根本原因

JavaScript/TypeScript の `String.prototype.replace` の仕様を考慮せず、
全出現箇所の置換を意図して文字列リテラルを渡した点が根本原因である。
`resolvePlaceholders` 関数（行982〜988）では `new RegExp(..., 'g')` でグローバル置換しているが、
その実装と同等のパターンが `resolvePhaseGuide` 内に引き継がれなかった。

### 影響範囲

現在の `PHASE_GUIDES` 定義では実害なし。ただし定義拡張時に潜在バグが顕在化する。
`outputFile`、`inputFiles`（配列の各要素）、`inputFileMetadata[].path`、
サブフェーズの同名フィールドの計12箇所に同じパターンが存在する。

### 修正方針

`.replace('{docsDir}', docsDir)` を `.replaceAll('{docsDir}', docsDir)` に変更する。
または `new RegExp('{docsDir}', 'g')` 形式でグローバル正規表現に切り替える。
`replaceAll` は ES2021 以降で利用可能であり、TypeScript 環境では推奨される簡潔な修正方法である。
修正対象は resolvePhaseGuide 関数内の全12箇所の replace 呼び出しである。

---

## 問題2: set-scope.ts の返却値に moduleName が欠落

### 調査対象箇所

ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\set-scope.ts`
調査行: 339〜348行（返却値構築部分）

### 実際のコード

```typescript
return {
  success: true,
  taskId: taskState.taskId,
  scope: {
    affectedFiles,
    affectedDirs,
  },
  message: `影響範囲を設定しました（ファイル: ${affectedFiles.length}件, ディレクトリ: ${affectedDirs.length}件）`,
  ...(warnings.length > 0 && { warnings }),
};
```

一方で TaskState には正しく moduleName が保存されている（326〜334行）。

```typescript
const updatedState = {
  ...taskState,
  scope: {
    affectedFiles,
    affectedDirs,
    preExistingChanges: existingPreExistingChanges,
    moduleName: inferredModuleName,
  },
};
stateManager.writeTaskState(taskState.workflowDir, updatedState);
```

### 根本原因

TaskState への保存と MCP ツールの返却値の2箇所で scope を記述する構造になっており、
保存側に `moduleName` を追加した際に返却側への追加が漏れた。
推測される開発経緯として、moduleName 自動推定機能（FR-2-2）の実装時に `updatedState.scope` を更新したが、
呼び出し元へ返すオブジェクトの `scope` フィールドは同時に更新されなかった。

### 影響範囲

`workflow_set_scope` を呼び出したオーケストレーターが、
返却値の `scope.moduleName` を参照して後続の処理に使う場合に空欄または未定義となる。
ただし実際のドキュメント階層化は `resolvePhaseGuide` が TaskState から直接 moduleName を読み取るため、
内部的な動作は正しい。外部ツール（MCP クライアント）が返却値を信頼する場合のみ問題が発生する。
MCP ツールの返却値は Claude Code やオーケストレーターが確認メッセージとして参照することがあるため、
表示上の誤情報となる可能性が高い。

### 修正方針

返却値の `scope` フィールドに `moduleName: inferredModuleName` を追加する。
また message 文字列にも moduleName が含まれると Orchestrator が状況を確認しやすい。
具体的には以下のように変更する。

```typescript
scope: {
  affectedFiles,
  affectedDirs,
  moduleName: inferredModuleName,
},
```

修正箇所は `set-scope.ts` 行342〜345の `scope` オブジェクトリテラルのみである。

---

## 問題3: semantic-checker.ts の関数名・コメントと実装の乖離

### 調査対象箇所

ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\semantic-checker.ts`
調査行: 199〜270行（`validateLLMSemanticTraceability` 関数全体）

### 実際のコード構造

関数 `validateLLMSemanticTraceability` は以下の3つのブランチを持つ。

第1ブランチ（行218〜234）: `@anthropic-ai/sdk` の動的インポートを試みる。
インポートが失敗した場合は `sdkAvailable = false` とし、固定スコア0.5で合格を返す。

第2ブランチ（行236〜261）: SDKが利用可能とみなされた場合でも、
実際には LLM を呼び出さずにキーワードトレーサビリティ検証（`extractKeywordsFromMarkdown` + マッチング）のみを実行する。
コメント（行249）にも「現時点ではキーワードトレーサビリティ方式にフォールバック」と明記されている。

第3ブランチ（行262〜268）: 例外発生時はスコア0.5で合格を返す。

### 根本原因

SDKが利用可能かどうかを判定する構造（行218〜234）は、将来的に実際の LLM 呼び出しを実装するための
骨格として設計されたと考えられる。しかし「SDKが利用可能な場合の実装（将来拡張ポイント）」
というコメント（行236）が示すように、実装本体はキーワードマッチングで代替されており、
JSDoc と関数名が将来の意図を示すものとして記述された結果、現在の実装と乖離が生じた。

具体的には JSDoc（行200〜205）は「@anthropic-ai/sdk が利用可能な場合はAPIを呼び出し」と明記しているが、
実際は SDK の利用可否にかかわらずキーワードマッチングのみが実行される。
関数名 `validateLLMSemanticTraceability` が「LLM を使ったセマンティックトレーサビリティ検証」を示すが、
LLM による検証は一切行われていない。

また `semantic-checker.ts` のファイル先頭コメント（行1〜9）には
「N-gram方式からキーワードトレーサビリティ方式に全面置換」と記述されており、
LLM 方式は採用されていない設計方針であることが確認できる。

### 影響範囲

`validateLLMSemanticTraceability` 関数を呼び出す箇所を確認すると、
`validateSemanticConsistency` 関数（行281）は `validateKeywordTraceability` を直接呼び出しており、
`validateLLMSemanticTraceability` 自体は外部から呼ばれていない可能性がある。

JSDoc の誤記は実行時の動作には影響しないが、開発者が関数の挙動を誤解するリスクを生む。
将来、実際の LLM API 呼び出しを実装しようとした開発者が、
既存の関数が LLM を呼んでいると誤認して重複実装や競合が生じる危険性がある。

### 修正方針

JSDoc と関数名を実態に合わせて修正する。
具体的には以下の2点を変更する。

1点目：関数名を `validateKeywordTraceabilityWithFallback` または `validateSemanticTraceability` に変更し、
LLM 呼び出しを示唆しない名前にする。

2点目：JSDoc を実際の動作に合わせて書き直す。
「SDK 非依存のキーワードトレーサビリティによる検証を行う。SDK 利用可能時は将来的に LLM 検証に切り替え予定」
という趣旨に修正する。

---

## 問題4: calculatePhaseSkips のスコープ未設定時メッセージ欠落

### 調査対象箇所

ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
調査行: 511〜569行（`calculatePhaseSkips` 関数）

### 実際のコード

```typescript
export function calculatePhaseSkips(
  scope: { affectedFiles?: string[]; files?: string[] },
  userIntent?: string
): Record<string, string> {
  const files = scope.affectedFiles || scope.files || [];
  const phaseSkipReasons: Record<string, string> = {};

  // ファイルが空の場合はスキップ判定しない
  if (files.length === 0) {
    return phaseSkipReasons;
  }
  // ...（拡張子別の判定処理）
```

スコープが空配列の場合は空のオブジェクトを返し、フェーズスキップは発生しない。
これは spec.md の FR-1-4 で「スコープ未設定時に calculatePhaseSkips がスキップ理由メッセージを付与する」
という要件が定義されていたか検証する必要があった。

### FR-1-4 の定義内容の確認

spec.md の内容は現時点で参照できないが、問題提示の文面「スコープ未設定時に calculatePhaseSkips が
スキップ理由メッセージを付与する変更が定義されていたが、実装されているか不明」という表現から、
スコープ未設定（空配列またはスコープ自体が null/undefined）の場合に
特定のスキップメッセージを返すべき要件だったと判断される。

### 現状の動作

`files.length === 0` の場合に空の `phaseSkipReasons` を返す（行519〜521）。
これはスコープが設定されていない場合に「全フェーズを実行する」という挙動を意味する。
つまり、スコープ未設定でも test_impl や implementation がスキップされないため、
無駄なフェーズが実行される可能性がある。

一方、スコープが設定されてコードファイルが含まれない場合は
`implementation` と `refactoring` のスキップメッセージが付与される。

### 根本原因

FR-1-4 の実装では「スコープが空の場合はスキップ判定しない」という既存ロジックを変更せず、
スコープ未設定時のメッセージ付与を追加する処理が実装されなかった。
CLAUDE.md の「スコープ未設定の場合、test_implフェーズがスキップされる可能性がある」という記述から、
スコープ未設定時の test_impl スキップが意図された挙動と思われるが、
実際のコードでは空配列の場合に何もスキップしない実装になっている。

### 影響範囲

スコープを設定しないでタスクを進めた場合、テストファイルが存在しなくても test_impl フェーズが実行され、
コードファイルが存在しなくても implementation フェーズが実行される。
このためオーケストレーターは意図しないフェーズを実行し、その後フェーズが失敗するまで気づかない。

### 修正方針

`files.length === 0` の早期リターン部分を修正し、スコープが空の場合も
合理的なデフォルトスキップメッセージを返すように変更する。

具体的には、スコープ未設定（空配列）の場合に以下のスキップメッセージを付与することを検討する。
`test_impl`: スコープが設定されていないためテスト実装フェーズをスキップ。
`implementation`: スコープが設定されていないため実装フェーズをスキップ。
`refactoring`: スコープが設定されていないためリファクタリングフェーズをスキップ。

ただし FR-1-4 の原文（spec.md）を確認してから最終的な修正内容を確定する必要がある。

---

## 調査結果まとめ

### 問題別の深刻度

問題1（replace グローバルフラグ未使用）は現状の PHASE_GUIDES 定義では実害なし。
`outputFile` や `inputFiles` の各要素はプレースホルダーが1回しか登場しないため正しく置換される。
将来の定義拡張時に顕在化するリスクがあるため、予防的修正として `replaceAll` への変更を推奨する。

問題2（moduleName 欠落）はツール返却値の誤情報という観点では機能的バグである。
内部の TaskState には正しく保存されているため、実際のドキュメント階層化は正常に動作する。
しかし MCP クライアントが返却値の `scope` フィールドを参照する場合は誤った情報を受け取る。

問題3（JSDoc・関数名と実装の乖離）は実行時の動作に影響しない文書的問題であるが、
開発者を誤解させるリスクが高く、将来の保守性を損なう。修正は低コストで高い効果が期待できる。

問題4（calculatePhaseSkips のスコープ未設定時メッセージ欠落）は
スコープ未設定時に意図しないフェーズが実行されるという挙動上の問題である。
FR-1-4 の要件原文が確認できないため、修正内容の確定には requirements フェーズでの精査が必要である。

### 修正対象ファイル

- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`（問題1・問題4）
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\set-scope.ts`（問題2）
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\semantic-checker.ts`（問題3）

### 各問題の修正優先度

問題2（moduleName 欠落）は API 仕様の正確性に関わるため最優先で修正する。
問題3（JSDoc 乖離）は保守性向上のため次に修正する。
問題1（replace フラグ）は予防的修正として問題3の後に対応する。
問題4（スキップメッセージ）は FR-1-4 の原文確認後に修正方針を確定する。
