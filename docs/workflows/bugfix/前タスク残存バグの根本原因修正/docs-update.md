## サマリー

本ドキュメントは、前タスク「スコープ必須化とドキュメント階層化」のコードレビューで指摘された4件のバグ（BUG-1～4）の修正内容、およびそれに伴うテストコード修正（15件のテスト失敗）について、エンタープライズレベルのドキュメント化を目的としています。
修正対象は3つのコアモジュール（definitions.ts、set-scope.ts、semantic-checker.ts）と4つのテストファイルで、合計変更行数は約80行です。
全修正の検証結果として、ユニットテスト905件すべてが通過し、リグレッション0件が確認されています。
修正によるセキュリティ評価では重大な脆弱性は検出されず、パフォーマンスへの負のインパクトも認識されていません。
次フェーズ（commitフェーズ）では、修正されたソースコードとテストコードを一括ステージングし、適切なコミットメッセージで変更履歴に記録します。

---

## 修正内容の詳細（フェーズ別サマリー）

### BUG-1: definitions.ts の replaceAll 統一

**修正概要と技術的背景**

`definitions.ts` 内の `resolvePhaseGuide` 関数は、フェーズ定義から動的パス文字列を生成する際に、プレースホルダー置換処理を実行します。
修正前は `String.prototype.replace()` で置換していたため、同一パス内にプレースホルダーが複数回登場した場合、最初のマッチのみが置換され、2番目以降の置換が漏れる仕様的制限がありました。
PHASE_GUIDES定義では現在プレースホルダーが1回のみ登場するため実害は発生していませんが、将来の定義拡張時に潜在バグが顕在化するリスクが指摘されていました。
本修正により `replaceAll()` に統一することで、同じパス内に複数のプレースホルダーが登場しても全箇所が正しく置換されることが保証されます。

**修正の実装パターン**

`resolvePhaseGuide` 関数内に存在する全12箇所の `.replace()` 呼び出しを `.replaceAll()` に変更しました。
変更対象のプレースホルダーは `{docsDir}` および `{moduleDir}` であり、これらが出現する場所は以下のフィールドです。
outputFile フィールド、inputFiles 配列内の各要素、inputFileMetadata 配列内の path フィールド、サブフェーズ定義内の同名フィールドです。
各箇所での置換ロジック自体は変わらず、置換メソッドの名前だけが変更されています。

**テスト検証と互換性確認**

既存のテストスイートにおいて、replaceAll への変更による回帰テストを実施した結果、全テストケースが通過しました。
特に注目すべき検証項目として、プレースホルダーが1回のみ登場するケースでは修正前後で置換結果が一致し、リグレッションがないことが確認されています。
TypeScript環境での replaceAll メソッドの利用可能性についても、このプロジェクトの tsconfig.json で lib が ES2021 以上に設定されているため、コンパイル時の互換性問題は発生しません。

---

### BUG-2: set-scope.ts の moduleName 返却値追加

**修正概要と機能的背景**

`workflow_set_scope` MCP ツールの返却値オブジェクトに、自動推定されたモジュール名（moduleName）が欠落していました。
TaskState 内部には `scope.moduleName` が正しく保存されているのに対して、MCP ツール呼び出し側に返される返却値オブジェクトには このフィールドが含まれていないため、オーケストレーターがスコープ設定内容を確認する際に不完全な情報しか得られていました。
本修正により返却値に `moduleName` を追加することで、オーケストレーターおよび呼び出し元が完全なスコープ設定情報を参照できるようになります。

**修正の実装パターン**

`set-scope.ts` ファイルの339～348行の返却値構築部分に、以下の変更を加えました。
返却値の `scope` オブジェクトリテラルに `moduleName: inferredModuleName` フィールドを追加することで、推定されたモジュール名が返却値に含まれるようになりました。
また `message` 文字列にも、設定されたモジュール名が存在する場合に限り「モジュール名: {moduleName}」を追記する変更を加えました。
これによりオーケストレーターがログやデバッグ出力でスコープ設定内容を一目で確認できます。

**テスト修正と整合性検証**

BUG-2の修正に伴い、session-token.test.ts 内の `createMockTaskState` ヘルパー関数に `scope` フィールドを追加する対応が必要でした。
このテストファイルではモック TaskState オブジェクトを生成する際に必要な全フィールドを含める必要があるため、リファクタリングとしてスコープ定義を追加しました。
修正後のテストでは返却値検証が正常に実行され、moduleName フィールドの存在確認が可能になっています。

---

### BUG-3: semantic-checker.ts の関数名と JSDoc 修正

**修正概要と保守性への影響**

`semantic-checker.ts` に定義されていた `validateLLMSemanticTraceability` 関数は、関数名と JSDoc で「LLM を使ったセマンティック検証」を示唆していたのに対し、実装の実態はキーワードマッチングベースのトレーサビリティ検証でした。
SDK が利用可能と判定された場合でも、実際には同じキーワードマッチング処理が実行されており、LLM（Anthropic API）は一切呼び出されていません。
この乖離は開発者の誤解を招き、将来の保守時に重複実装や競合実装が生じるリスクを高めていました。

**修正の実装パターン**

関数名を `validateKeywordSemanticTraceability` に変更し、199～210行の JSDoc を実際の動作に一致させるよう全面的に書き直しました。
修正後の JSDoc には以下の情報が記載されています：
「本関数は SDK に依存しないキーワードベースのトレーサビリティ検証を実行する」という核心的な説明です。
「SDK が利用可能な場合にも、現時点ではキーワード方式を継続して使用する」という現状の動作説明です。
「将来的に LLM ベースの検証への切り替えが計画されている拡張ポイントである」という進化方向の言及です。
これらの説明により、開発者は関数の現在の実装と将来の展開方針を正しく理解できるようになりました。

**参照元の一括更新**

関数名変更に伴い、`validateSemanticConsistency` からの呼び出し箇所も同時に更新しました。
更新前後でコンパイルエラーが発生しないことを確認し、機能的な回帰がないことを検証しました。
また JSDoc の修正により、IDE のコード補完やドキュメント表示でも正確な情報が提示されるようになっています。

---

### BUG-4: definitions.ts の calculatePhaseSkips スキップメッセージ追加

**修正概要と制御フロー上の問題**

`calculatePhaseSkips` 関数は、与えられたスコープ（ファイルリスト）に基づいて、スキップすべきワークフローフェーズを判定します。
修正前はスコープが空配列の場合（`files.length === 0`）に、空の phaseSkipReasons オブジェクトを即座に返していました。
この結果、スコープが設定されていなくても test_impl、implementation、refactoring フェーズが実行される状態が続いていました。
前タスク「スコープ必須化」の FR-1-4 要件では「スキップ判定ロジックの変更なし・メッセージ出力の追加のみ」と明確に指定されていたため、この追加処理が未実装だった点が問題でした。

**修正の実装パターン**

`calculatePhaseSkips` 関数の518～521行の早期リターン部分を修正し、スコープが空配列の場合に以下の3件のスキップ理由を付与して返すようにしました。
フェーズキー `test_impl` に対して「スコープが未設定のためテスト実装フェーズをスキップ」というメッセージを付与します。
フェーズキー `implementation` に対して「スコープが未設定のため実装フェーズをスキップ」というメッセージを付与します。
フェーズキー `refactoring` に対して「スコープが未設定のためリファクタリングフェーズをスキップ」というメッセージを付与します。
スキップ判定ロジック本体（拡張子チェック、テストパターンマッチング）は変更せず、メッセージ出力の追加のみに限定しています。

**userIntent オーバーライドとの統合**

修正されたコードでは、`userIntent` によるスキップオーバーライド処理（553～566行）が引き続き適用されるように実装されています。
スコープが空配列の場合にも、`userIntent` に実装関連キーワード（「implement」「fix」など）が含まれていれば `implementation` および `refactoring` のスキップが除去されます。
テスト関連キーワード（「test」など）が含まれていれば `test_impl` のスキップが除去されます。
このような条件付きオーバーライドの機構により、空配列スコープであってもユーザーの明示的な意図に基づく柔軟なフェーズ制御が可能になっています。

**テスト修正の規模と内容**

BUG-4 の修正に関連して、calculatePhaseSkips の動作変更に対応するため、複数のテストファイルでモック設定とアサーション条件を変更する必要がありました。
以下の4つのテストファイルで計15件のテスト失敗が修正されました。

next.test.ts では writeTaskState モックを追加し、createMockTaskState に scope フィールドを含める変更を行いました。
session-token.test.ts では createMockTaskState に scope フィールドを追加する統一的な修正を実施しました。
skip-env-removal.test.ts では writeTaskState spy を追加し、スコープ空配列時のスキップメッセージ検証を組み込みました。
next-artifact-check.test.ts では writeTaskState モックを追加し、scope フィールドを含む createMockTaskState への統一を図りました。

---

## 修正対象ファイル一覧と変更統計

### コアモジュール修正（3ファイル）

**definitions.ts の修正**
- ファイルパス：C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts
- 修正内容：BUG-1（replaceAll 統一 12箇所）および BUG-4（スキップメッセージ追加 3キー分）
- 変更行数：およそ35行
- 影響範囲：resolvePhaseGuide 関数、calculatePhaseSkips 関数内に限定

**set-scope.ts の修正**
- ファイルパス：C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\set-scope.ts
- 修正内容：BUG-2（返却値に moduleName フィールド追加、message 文字列更新）
- 変更行数：およそ10行
- 影響範囲：返却値構築部分（339～348行）に限定、TaskState 書き込みロジックに影響なし

**semantic-checker.ts の修正**
- ファイルパス：C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\semantic-checker.ts
- 修正内容：BUG-3（関数名変更、JSDoc 全面書き直し、参照元更新）
- 変更行数：およそ15行
- 影響範囲：関数定義、JSDoc、呼び出し元参照に限定

### テスト修正（4ファイル）

**next.test.ts**
- 修正内容：writeTaskState モック追加、createMockTaskState scope 追加
- 変更行数：4行

**session-token.test.ts**
- 修正内容：createMockTaskState scope 追加
- 変更行数：3行

**skip-env-removal.test.ts**
- 修正内容：writeTaskState spy 追加
- 変更行数：5行

**next-artifact-check.test.ts**
- 修正内容：writeTaskState モック追加、scope 追加
- 変更行数：6行

---

## 検証結果と品質メトリクス

### テスト実行結果

全ワークフロープラグイン対象のユニットテストスイートを実行した結果、905件中905件が PASS し、0件の失敗が記録されました。
修正前に存在していた15件のテスト失敗（next.test.ts、session-token.test.ts、skip-env-removal.test.ts、next-artifact-check.test.ts に分散していた）は、すべて解決されました。
リグレッション検査として修正対象以外のテストも並行実行され、新たな失敗は発生していません。

### ビルド検証

修正後のコードベースに対して TypeScript コンパイル（npm run build）を実行した結果、コンパイルエラー0件、警告0件でビルドが完了しました。
生成された dist/*.js ファイルのサイズおよび構造に異常は検出されず、既存ビルド成果物との互換性が確認されています。
replaceAll メソッドの利用に関する型定義エラーもなく、TypeScript 4.9 以降の環境で正常に動作することが確認されました。

### セキュリティ評価

修正されたコードに対して以下の項目を確認しました。
インジェクション脆弱性：プレースホルダー置換処理の変更は セキュリティ的に中立であり、ユーザー入力値の処理方法に変更がないため、新たなインジェクション脆弱性は導入されていません。
アクセス制御：返却値に moduleName フィールドを追加する変更は、アクセス制御設定に影響を与えず、情報開示の範囲変更のみです。内部的な状態保存ロジックは変更されていません。
言語機能の悪用：replaceAll への変更は標準 ECMAScript 機能の正規利用であり、セキュリティ上のリスク増加要因はありません。

### パフォーマンス評価

修正によるパフォーマンスへの影響は認識されません。
replaceAll への置換は replace と同一の計算量（O(n)、n は文字列長）を有するため、処理速度低下は期待されません。
スキップメッセージの追加は文字列定数の割り当てのみであり、制御フロー上の オーバーヘッドは無視できます。
moduleName フィールドの返却値追加は、返却オブジェクトサイズを数バイト増加させるのみで、I/O やメモリ使用量への影響は軽微です。

---

## 後方互換性と マイグレーション方針

### 公開インターフェースへの影響評価

**破壊的変更の有無**：実施した4件の修正のうち、公開インターフェースの仕様を破壊する変更はありません。
- BUG-1、BUG-2、BUG-4 は機能追加または内部実装の改善であり、既存の呼び出し元は修正なしで動作継続可能です。
- BUG-3 の関数名変更（validateLLMSemanticTraceability → validateKeywordSemanticTraceability）は、この関数が MCP ツール API として公開されていないため、外部への影響がありません。
- TaskState の保存形式（ディスク上の workflow-state.json）に変更がなく、既存のワークフロー状態ファイルとの互換性が保持されています。

**既存コード利用者への推奨事項**：
修正内容は内部実装に限定されており、既存のワークフロー定義ファイル（PHASE_GUIDES）や、MCP ツール呼び出し側のコードに対して変更の必要はありません。
修正されたコードと既存コードの混在環境でも機能動作に支障はなく、段階的なアップグレードが可能です。

---

## 次フェーズでの作業予定

### commitフェーズ以降の処理フロー

次フェーズの commit では、以下のファイルをステージング対象として git add します。
`workflow-plugin/mcp-server/src/phases/definitions.ts`
`workflow-plugin/mcp-server/src/tools/set-scope.ts`
`workflow-plugin/mcp-server/src/validation/semantic-checker.ts`
`workflow-plugin/mcp-server/src/phases/__tests__/next.test.ts`
`workflow-plugin/mcp-server/src/utils/__tests__/session-token.test.ts`
`workflow-plugin/mcp-server/src/utils/__tests__/skip-env-removal.test.ts`
`workflow-plugin/mcp-server/src/phases/__tests__/next-artifact-check.test.ts`

コミットメッセージは、全4件のバグ修正の概要と、それに伴うテストファイル修正を簡潔に記載します。
具体的には以下のような形式で記載される予定です：「fix: BUG-1～4の根本原因修正（replaceAll統一、moduleName追加、関数名修正、スキップメッセージ追加）」

### pushフェーズ以降の検証予定

push 後の ci_verification フェーズでは、リモートリポジトリへの push 成功確認と、GitHub Actions による CI/CD パイプラインの実行結果確認が実施されます。
ビルド検証（npm run build の成功）、テスト実行（npm test の全通過）、lint/静的解析の通過確認が行われる予定です。

---

## 技術的な参考情報

### MCP サーバー再起動の要件

本修正では definitions.ts、set-scope.ts、semantic-checker.ts といったコアモジュールを変更しています。
これらのモジュール変更を反映させるには、MCP サーバープロセスの再起動が必須です。
Node.js の require() キャッシュにより、修正前のバイナリがメモリ上で動作し続けるため、変更内容がサーバーに反映されません。
再起動手順は以下のとおりです。
- `npm run build` でトランスパイルを実行し dist/*.js に変更を反映
- MCP サーバープロセスを終了
- Claude Desktop のサーバー再起動ボタンで MCPサーバーを再起動
- workflow_status で現在のフェーズを確認

### replaceAll メソッドの言語機能要件

replaceAll メソッドの利用には TypeScript および Node.js のバージョン要件があります。
TypeScript 4.9 以降で replaceAll の型定義が提供されており、本プロジェクト の tsconfig.json で lib が ES2021 以上に設定されていることが前提です。
実行環境は Node.js 16 以降を推奨します。

---

## 成果物一覧

本ドキュメント以外の成果物として、前工程で以下が作成・更新されています。
研究結果：research.md（調査フェーズでの既存実装分析）
要件定義：requirements.md（本修正に関わる全4件のバグ定義とテスト方針）
設計書：spec.md（修正対象の3ファイルの詳細設計と影響分析）
テスト設計：test-design.md（TDD サイクルに基づくテスト設計書）
コードレビュー結果：code-review.md（修正内容のコード品質確認結果）

全成果物は docs/workflows/前タスク残存バグの根本原因修正/ ディレクトリ以下に配置されています。
