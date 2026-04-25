## サマリー

本ドキュメントは、前タスク「スコープ必須化とドキュメント階層化」のコードレビューで指摘された4件の残存問題（BUG-1〜BUG-4）の実装仕様を確定する。
修正対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts`、`workflow-plugin/mcp-server/src/tools/set-scope.ts`、`workflow-plugin/mcp-server/src/validation/semantic-checker.ts` の3ファイルで変更箇所は合計10箇所である。
各バグは相互に独立しており、優先度に従い BUG-2、BUG-4、BUG-3、BUG-1 の順で対応することを推奨する。
テスト設計フェーズでは各バグに対するユニットテストケースを設計し、TDD（Red → Green）の順序で実施する。
全修正完了後に `npm run build` でコンパイルが成功することをビルドチェックフェーズで確認する。

---

## 概要

### タスクの背景と目的

前タスクにおいて、ワークフロープラグインの MCP サーバーにスコープ必須化とドキュメント階層化の機能を追加した。
実装完了後にコードレビューを実施したところ、機能の正確性・保守性・完全性に関わる4件の問題が発見された。
本タスクはこれらの問題を個別に修正し、コードレビューで指摘された品質基準を満たすことを目的とする。

### 問題の分類と位置付け

BUG-1 は `definitions.ts` の `resolvePhaseGuide` 関数における文字列置換の選択誤りであり、予防的な修正に分類される。
BUG-2 は `set-scope.ts` の MCP ツール返却値に `moduleName` フィールドが欠落している正確性の問題である。
BUG-3 は `semantic-checker.ts` の関数名と JSDoc が実装実態（キーワードマッチング）と乖離している保守性の問題である。
BUG-4 は `definitions.ts` の `calculatePhaseSkips` 関数においてスコープ未設定時のスキップ理由メッセージが付与されない完全性の問題であり、前タスクの FR-1-4 要件の実装漏れに相当する。

### 修正の基本方針

全4件の修正は既存の外部インターフェース（関数シグネチャ・TaskState 形式）を破壊しない後方互換の形で実施する。
BUG-3 の関数名変更は唯一の名称変更を伴うが、外部ファイルからの参照が存在しないことを確認済みのため影響範囲は `semantic-checker.ts` 単体に限定される。

---

## 変更対象ファイル

本タスクで修正する対象ファイルは以下の3ファイルである。

- `workflow-plugin/mcp-server/src/phases/definitions.ts`: BUG-1（replaceAll化・合計8箇所）およびBUG-4（calculatePhaseSkips関数の早期リターンブロックへのスキップ理由メッセージ追加）を修正する。resolvePhaseGuide関数（行1431〜1481付近）とcalculatePhaseSkips関数（行518〜521付近）が変更対象である。
- `workflow-plugin/mcp-server/src/tools/set-scope.ts`: BUG-2（返却値オブジェクトへのmoduleNameフィールド追加、およびmessage文字列へのモジュール名追記）を修正する。返却値オブジェクトの構築箇所（行339〜348付近）に1行追加と1行修正を加える。
- `workflow-plugin/mcp-server/src/validation/semantic-checker.ts`: BUG-3（インターフェース名・関数名・JSDocの実装実態への整合化）を修正する。validateLLMSemanticTraceability関数（行212付近）の名称をvalidateKeywordSemanticTraceabilityに変更し、行190のインターフェース名と行199〜210のJSDocを実態に合わせて更新する。

テストファイルは `workflow-plugin/mcp-server/src/` ディレクトリ内の対応するテストファイルに追加する予定である。
各ファイルの変更は相互に独立しており、修正の推奨順序は BUG-2（set-scope.ts） → BUG-4（definitions.ts） → BUG-3（semantic-checker.ts） → BUG-1（definitions.ts）である。
変更後は `workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行し、TypeScript コンパイルエラーが発生しないことを確認する。

---

## 機能仕様

### BUG-1: resolvePhaseGuide 内の replace をグローバル置換に変更

#### 対象ファイル

`workflow-plugin/mcp-server/src/phases/definitions.ts`（行1431〜1481）

#### 問題の所在

`resolvePhaseGuide` 関数の内部で `String.prototype.replace` を文字列リテラルの引数で呼び出している。
ECMAScript 仕様上、文字列引数を使用した `replace` は最初のマッチのみを置換するため、
同一パス文字列内にプレースホルダーが2回以上登場する将来の拡張時に置換漏れが発生する。

#### 変更対象の全行（8箇所）

1箇所目（行1435）: `resolved.outputFile` の `{docsDir}` 置換、`.replace` を `.replaceAll` に変更。
2箇所目（行1436）: `resolved.outputFile` の `{moduleDir}` 置換、`.replace` を `.replaceAll` に変更。
3箇所目（行1441の内側）: `resolved.inputFiles` マップ内の連鎖置換、2つの `.replace` を `.replaceAll` に変更。
4箇所目（行1448）: `resolved.inputFileMetadata` マップ内 `path` の連鎖置換、2つの `.replace` を `.replaceAll` に変更。
5箇所目（行1462〜1464）: サブフェーズ `subResolved.outputFile` の連鎖置換、2つの `.replace` を `.replaceAll` に変更。
6箇所目（行1467〜1468内側）: サブフェーズ `subResolved.inputFiles` マップの連鎖置換、2つの `.replace` を `.replaceAll` に変更。
7箇所目（行1474〜1475）: サブフェーズ `subResolved.inputFileMetadata` の `path` 連鎖置換、2つの `.replace` を `.replaceAll` に変更。

#### 受け入れ基準

関数内の全ての文字列 `.replace('{docsDir}'` が `.replaceAll('{docsDir}'` に変更されていること。
関数内の全ての文字列 `.replace('{moduleDir}'` が `.replaceAll('{moduleDir}'` に変更されていること。
`{docsDir}` を2回含むパス文字列を引数として渡した場合に、両方が正しく置換されること。

---

### BUG-2: workflow_set_scope 返却値への moduleName 追加

#### 対象ファイル

`workflow-plugin/mcp-server/src/tools/set-scope.ts`（行339〜348）

#### 問題の所在

行339〜348 の返却値構築部において、`scope` フィールドのオブジェクトリテラルが `affectedFiles` と `affectedDirs` のみを含んでいる。
一方、行333 で `TaskState` への書き込み時には `moduleName: inferredModuleName` が含まれており、永続化と返却値の間に不整合が生じている。
オーケストレーターが返却値の `scope.moduleName` を参照した場合にフィールドが存在せず、スコープ設定確認時の表示が不正確になる。

#### 変更内容（1箇所）

行342〜345 の `scope` オブジェクトリテラルに `moduleName: inferredModuleName` を追加する。
変更後の返却値 `scope` オブジェクトは `affectedFiles`、`affectedDirs`、`moduleName` の3フィールドを持つ構造になる。
また、行346 の `message` 文字列にもモジュール名を追記し、確認メッセージの完全性を高める。

#### 受け入れ基準

`workflow_set_scope` の返却値オブジェクトの `scope` フィールドに `moduleName` キーが存在すること。
`dirs` を指定した呼び出しでは、推定されたモジュール名が `scope.moduleName` に文字列として含まれること。
`dirs` を空配列または未指定で呼び出した場合、`scope.moduleName` が `undefined` となっても返却値の構造が壊れないこと。
`TaskState` への書き込みロジック（行327〜335）は一切変更しないこと。

---

### BUG-3: validateLLMSemanticTraceability の関数名・JSDoc を実態と一致させる

#### 対象ファイル

`workflow-plugin/mcp-server/src/validation/semantic-checker.ts`（行190〜212）

#### 問題の所在

関数名 `validateLLMSemanticTraceability`（行212）および JSDoc（行199〜210）が「LLM を使ったセマンティック検証」を示す記述になっているが、実装の実態はキーワードマッチングによるトレーサビリティ検証であり、LLM API は呼び出されない。
SDK 可用性チェック（行218〜225）が存在するが、SDK が利用可能と判定された場合でも同じキーワードマッチング処理（行250〜260）が実行される。

#### 変更内容

行190 のインターフェース名を `LLMSemanticTraceabilityResult` から `KeywordSemanticTraceabilityResult` に変更する。
行199〜210 の JSDoc を「キーワードマッチング方式による検証であること」「SDK 可用性チェックは将来の LLM 統合への拡張ポイントであること」「現時点では LLM API は呼び出さないこと」を明示する内容に書き直す。
行212 の関数名を `validateLLMSemanticTraceability` から `validateKeywordSemanticTraceability` に変更する。
ファイル内の全参照箇所（エクスポート含む）を新しい名前に更新する。

#### 受け入れ基準

関数名から `LLM` という表現が除去されていること（`validateKeywordSemanticTraceability` に変更）。
変更後の JSDoc に「LLM を使う」または「API を呼び出す」という記述が含まれないこと。
`npm run build` が成功し、TypeScript コンパイルエラーが発生しないこと。
関数の実行ロジック（行216〜269）は一切変更しないこと。

---

### BUG-4: calculatePhaseSkips でスコープ空配列時のスキップ理由メッセージを追加

#### 対象ファイル

`workflow-plugin/mcp-server/src/phases/definitions.ts`（行518〜521）

#### 問題の所在

`calculatePhaseSkips` 関数の早期リターン部分（行518〜521）において、`files.length === 0` のとき空の `phaseSkipReasons` をそのまま返している。
前タスクの FR-1-4 要件に定義された「スキップ判定ロジックの変更なし・スキップ理由メッセージの追加のみ」という仕様が未実装だった。

#### 変更内容

行518〜521 の早期リターンブロックを拡張し、`phaseSkipReasons` に3件のスキップ理由メッセージを設定してから `userIntent` オーバーライドを経由して返す形に変更する。
`test_impl` キーに「スコープが未設定のためテスト実装フェーズをスキップ」を設定する。
`implementation` キーに「スコープが未設定のため実装フェーズをスキップ」を設定する。
`refactoring` キーに「スコープが未設定のためリファクタリングフェーズをスキップ」を設定する。
`userIntent` によるオーバーライド処理は早期リターン内でも適用し、明示的なユーザー意図がスコープ不在のスキップを上書きできるようにする。

#### 受け入れ基準

`scope.affectedFiles` と `scope.files` がどちらも空配列の場合、返却オブジェクトに3キーが含まれること。
各キーのスキップ理由メッセージが日本語で正確に設定されていること。
`userIntent` にテスト関連キーワードが含まれる場合、`test_impl` のスキップが除去されること。
`userIntent` に実装関連キーワードが含まれる場合、`implementation` と `refactoring` のスキップが除去されること。
スコープに1件以上のファイルが設定されている場合は早期リターンが実行されず、拡張子ベース判定が継続すること。

---

## 実装計画

### 修正対象ファイルと変更方針

変更が発生するファイルは以下の3ファイルである。

**第1ファイル**: `workflow-plugin/mcp-server/src/phases/definitions.ts`
BUG-1 として `resolvePhaseGuide` 関数内の8箇所の `.replace(` を `.replaceAll(` に変更する。
BUG-4 として `calculatePhaseSkips` 関数の行518〜521 の早期リターンブロックにスキップ理由設定ロジックを追加し、`userIntent` オーバーライドを経由する順序に変更する。

**第2ファイル**: `workflow-plugin/mcp-server/src/tools/set-scope.ts`
BUG-2 として行342〜345 の `scope` オブジェクトリテラルに `moduleName: inferredModuleName` を追加する（1行追加）。
加えて行346 の `message` 文字列にモジュール名情報を条件付きで追記する（1行修正）。

**第3ファイル**: `workflow-plugin/mcp-server/src/validation/semantic-checker.ts`
BUG-3 として行190 のインターフェース名変更、行199〜210 の JSDoc 全面書き換え、行212 の関数名変更の3箇所を変更する。

### 推奨作業順序

第1優先（BUG-2）: 変更箇所が最も少なく（1行追加・1行修正）影響範囲も `set-scope.ts` のみのため最初に実施する。
第2優先（BUG-4）: フェーズ制御のスキップ判定ロジックに関わるため次に実施する。設計上の決定として `userIntent` オーバーライドを早期リターン内でも維持する。
第3優先（BUG-3）: 外部参照が存在しないことを確認済みのため影響範囲が限定的であり3番目に実施する。
第4優先（BUG-1）: 現状で実害のない予防的修正のため最後に実施する。

### ビルド検証計画

全修正完了後に `workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行し、TypeScript コンパイルエラーが発生しないことを確認する。
特に BUG-3 の関数名変更後はコンパイルエラーが発生しやすいため、変更直後にビルドを実行して問題がないことをその都度確認することを推奨する。
`replaceAll` メソッドは TypeScript 4.9 以降で型定義が提供されており、`tsconfig.json` の `lib` 設定が `ES2021` 以上であることを実装フェーズで確認すること。

---

## 実装詳細

### BUG-1: definitions.ts の置換処理（8箇所の一覧）

対象は `workflow-plugin/mcp-server/src/phases/definitions.ts` の行1431〜1481 に存在する `if (docsDir)` ブロック全体である。

メインフィールド処理エリア（行1433〜1450）の変更箇所は以下の4グループに分かれる。
グループ1は行1434〜1436 の `resolved.outputFile` への連鎖置換（2つの `.replace` を `.replaceAll` に変更）である。
グループ2は行1440〜1442 の `resolved.inputFiles` マップ内の連鎖置換（2つの `.replace` を `.replaceAll` に変更）である。
グループ3は行1446〜1449 の `resolved.inputFileMetadata` マップ内 `path` フィールドの連鎖置換（2つの `.replace` を `.replaceAll` に変更）である。

サブフェーズ処理エリア（行1451〜1481）の変更箇所も同様に3グループに分かれる。
グループ4は行1461〜1464 のサブフェーズ `outputFile` への連鎖置換（2つの `.replace` を `.replaceAll` に変更）である。
グループ5は行1466〜1469 のサブフェーズ `inputFiles` マップ内の連鎖置換（2つの `.replace` を `.replaceAll` に変更）である。
グループ6は行1472〜1476 のサブフェーズ `inputFileMetadata` マップ内 `path` フィールドの連鎖置換（2つの `.replace` を `.replaceAll` に変更）である。

関数のシグネチャ、戻り値の型、他の処理ロジックは一切変更しない。

### BUG-2: set-scope.ts 返却値修正の詳細

対象は `workflow-plugin/mcp-server/src/tools/set-scope.ts` の行339〜348 の返却値オブジェクト構築部分である。

行342〜345 の `scope` オブジェクトリテラルに `moduleName: inferredModuleName` を追加する。
`inferredModuleName` は行322〜324 で既に算出されているため、新たな計算処理は不要である。
行346 の `message` フィールドを、`inferredModuleName` が存在する場合にモジュール名を末尾に追記する条件式付きの文字列に変更する。
`TaskState` への書き込みロジック（行327〜335）は変更しない。

### BUG-3: semantic-checker.ts 関数名・JSDoc 変更の詳細

対象は `workflow-plugin/mcp-server/src/validation/semantic-checker.ts` の3箇所である。
変更1は行190 のインターフェース名 `LLMSemanticTraceabilityResult` を `KeywordSemanticTraceabilityResult` に変更する。
変更2は行199〜210 の JSDoc を「キーワードマッチング方式によるトレーサビリティ検証であること」「SDK 可用性チェックは将来の LLM 統合への拡張ポイントであること」「現時点では API 呼び出しを行わないこと」を記述した内容に全面書き換えする。
変更3は行212 の関数名 `validateLLMSemanticTraceability` を `validateKeywordSemanticTraceability` に変更する。
ファイル内の全参照箇所（エクスポート宣言を含む）を新しい名前に更新する。実装ロジック（行216〜269）は変更しない。

### BUG-4: calculatePhaseSkips の早期リターン修正の詳細

対象は `workflow-plugin/mcp-server/src/phases/definitions.ts` の行518〜521 の早期リターンブロックである。
現在の実装では `files.length === 0` のとき空の `phaseSkipReasons` オブジェクトを即座に返している。
修正後は、3件のスキップ理由メッセージを `phaseSkipReasons` に設定した後、`userIntent` が存在する場合はオーバーライド処理を適用し、その結果を返す構造に変更する。
オーバーライド処理のロジックは行553〜566 に存在する既存の `userIntent` 処理と同じロジック（TEST_KEYWORDS・IMPL_KEYWORDS によるキーワード判定）を早期リターン内でも実行する形で追加する。
行523〜551 の拡張子ベース判定ロジックは変更しない。
`calculatePhaseSkips` の関数シグネチャおよび呼び出し元（`next.ts` 等）は変更しない。
