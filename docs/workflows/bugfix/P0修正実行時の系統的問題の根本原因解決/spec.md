## サマリー

本仕様書はP0修正実行時に発生した4つの系統的問題（FR-1〜FR-4）の実装計画を定める。
各修正はMCPサーバーの3ファイル（artifact-validator.ts、record-test-result.ts、definitions.ts）と2つの設定文書（CLAUDE.md、workflow-plugin/CLAUDE.md）を対象とし、既存テスト820件の全パス維持を前提とする。
FR-1はコードブロック内の禁止語・角括弧を誤検出する根本原因を共通関数抽出で解決し、FR-2はリトライが繰り返される状況でのモデルエスカレーション機構を導入する。
FR-3はBLOCKING_FAILURE_KEYWORDSのスペース区切り複合語誤検出と同一ハッシュ重複拒否ポリシーを緩和し、FR-4はregression_testフェーズ遷移前のベースライン存在チェックを追加する。
修正完了後はMCPサーバーを再起動してから既存リグレッションテストスイートを含む全テストスイートのパスを検証する。

### 主要な決定事項

- FR-1の共通関数名は `extractNonCodeLines(content: string): string[]` とし、コードフェンス外の行配列を返す純粋関数として実装する
- FR-2のモデルエスカレーション条件はリトライ2回目以降かつ複数エラー同時発生（3件以上）とし、過剰エスカレーションを防ぐ
- FR-3のスペース区切り複合語判定は前後2語以内の大文字始まり語チェックで実現し、isCompoundWordContext関数として追加する
- FR-4のベースライン未設定時の挙動は「警告付き確認」方式とし、forceTransitionパラメータ付き呼び出しによるスキップを許可する
- 全変更はオプショナル型追加または新関数追加のみとし、既存APIの破壊的変更を行わない

### 次フェーズで必要な情報

- artifact-validator.ts 283行目の禁止パターン検出（content.includes）と 288行目の角括弧検出（content.match）の正確な行番号と呼び出し方法
- record-test-result.ts 91行目のisHyphenatedWord関数シグネチャと、354〜362行目のhashValidation処理の正確なコード
- definitions.ts buildRetryPrompt関数（1199〜1268行目）の返り値型定義と呼び出し元（workflow_nextまたはcomplete-sub）
- next.ts workflowNext関数内のtesting→regression_test遷移処理（234行目付近）の正確なコード

---

## 概要

### 修正の背景と目的

P0修正実行時に以下の4つの系統的問題が発生し、ワークフローの円滑な進行が阻害された。
調査フェーズで特定した根本原因は、バリデーターのコードブロック非除外・モデルエスカレーション機構欠如・テスト記録API誤拒否・ベースライン未記録の技術的強制欠如の4点である。
これら4点の問題はそれぞれ独立した修正要件（FR-1〜FR-4）として定義し、各FRの受け入れ基準を明確に設ける。

第1の問題はartifact-validator.ts（バリデーター本体）がコードブロック内の禁止語・角括弧を誤検出する問題であり、正当なコード例を含む成果物が不当にバリデーションエラーとなった。
第2の問題はモデルエスカレーション機構の欠如であり、haikuによるリトライが失敗し続けてもOrchestratorは同一モデルで再試行を継続する構造になっていた。
第3の問題はBLOCKING_FAILURE_KEYWORDSによるスペース区切り複合語（"Fail Closed"等）の誤検出と、regression_testフェーズでの同一ハッシュ再記録拒否であった。
第4の問題はベースライン未記録状態でregression_testフェーズに遷移できてしまい、変更前後のテスト比較が不可能となる点であった。

### 修正範囲の概要

本修正は以下の5ファイルを対象とする。

- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`（FR-1）
- `workflow-plugin/mcp-server/src/tools/record-test-result.ts`（FR-3）
- `workflow-plugin/mcp-server/src/phases/definitions.ts`（FR-2、FR-4）
- `C:\ツール\Workflow\CLAUDE.md`（FR-2）
- `workflow-plugin/CLAUDE.md`（FR-2、同期）

---

## 実装計画

### FR-1: extractNonCodeLines関数の実装（artifact-validator.ts）

#### 実装対象

対象ファイル: `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`

このファイルはArtifactQualityCore（artifactqualitycore）の中核バリデーターであり、禁止パターン検出・角括弧プレースホルダーエラー検出・重複行検出の3つの検出機構を持つ。
現状の問題点として、禁止パターン検出と角括弧プレースホルダーエラー検出はコードブロック内外の区別を行わず全文字列検索している非対称な状態にある。
重複行検出はコードブロック追跡による除外ロジックを既に備えており、FR-1は残り2つの検出機構に同等ロジックを追加して対称性を回復することを目的とする。

#### 新規追加関数の仕様

新しく `extractNonCodeLines(content: string): string[]` 関数を実装する。
この関数はMarkdownコンテンツを行単位で走査し、コードフェンス（バックティック3個以上またはチルダ3個以上）で囲まれた範囲の行を除外した行配列を返す。
チルダ3個以上（`~~~`）もコードフェンスとして認識する。
処理は1パス（O(n)）で完結し、入れ子コードフェンスは考慮しない（標準Markdownの仕様に従い最初にマッチしたフェンスで開閉を管理する）。
ネストしたコードフェンスを追跡しないことで処理の単純さを維持し、劣化制限（10%以内）を達成しやすくする。

関数の動作仕様は以下の通りである。
コードフェンス開始行（`‌``\``または`~~~`で始まる行）はフェンス状態フラグを反転させ、その行自体は返却配列に含めない。
コードフェンス内にある行は全て返却配列から除外する。
コードフェンス外の行はそのまま返却配列に追加する。
終了行（コードフェンスを閉じる行）も開始行と同様に返却配列から除外する。

#### 既存コードの変更箇所

283行目付近の禁止パターン検出処理を変更する。
変更前: `content.includes(pattern)` によるファイル全体の文字列検索で内外を区別しない実装
変更後: `extractNonCodeLines(content)` の結果を結合した文字列に対して検索を実施する処理
具体的には `extractNonCodeLines(content).join('\n').includes(pattern)` 相当の処理に変更する。

288行目付近の角括弧プレースホルダー検出処理を変更する。
変更前: `content.match(bracketPlaceholderPattern)` によるファイル全体への正規表現マッチで内外を区別しない実装
変更後: `extractNonCodeLines(content).join('\n').match(bracketPlaceholderPattern)` 相当の処理に変更する。
この正規表現による検索範囲の限定が、コードブロック内の変数名（例: `[変数名]`）を誤検出する問題を解決する。

重複行検出処理（311行目付近）は変更しない。既存のinsideCodeFenceフラグ管理ロジックはそのまま維持する。
非除外（コードブロック外）の行のみを重複チェックの対象行とする既存実装は正しく動作しているため再利用する。

#### パフォーマンス要件

extractNonCodeLines関数はO(n)の1パス処理として実装し、1000行のMarkdownファイルに対する処理時間が修正前比で10%以内の増加に留まること。
行単位のループと状態フラグ（isInsideCodeFence: boolean）のみを使用し、複数回実行時の処理時間劣化が累積しない設計とする。

---

### FR-2: リトライ時モデルエスカレーション機構の導入

#### 実装対象（definitions.ts）

対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`

buildRetryPrompt関数（1199行目）の返り値にモデルエスカレーション情報を追加する。
OrchestratorはbuildRetryPromptの返り値を参照し、モデルエスカレーションが必要かどうかを判断してTask toolの呼び出しモデルを動的に変更する。
この設計によりOrchestratorのリトライループに自動エスカレーション機能が追加され、haikuでの複数回リトライ失敗という処理時間劣化を防ぐ。

返り値型の変更方針として、既存の返り値型がstring型の場合は新しい型定義 `BuildRetryResult` を作成してオブジェクト形式に変更するか、文字列+メタデータのオブジェクトに変更する。
フィールドはオプショナル（`suggestModelEscalation?: boolean`）として定義し、NFR-3（後方互換性）に準拠する。

エスカレーション条件の判定ロジックは以下とする。
リトライ回数が2回目以降（retryCount >= 2）の場合のみ評価対象とする。
エラー種別が「複数の違反が同時に発生（errors.length >= 3）」、または「角括弧検出エラー」、または「禁止パターン検出エラー」に該当する場合に `suggestModelEscalation: true` を設定する。
1回目のリトライでは常に `suggestModelEscalation: false` を返し、過剰エスカレーションを防ぐ。

呼び出し元がモデルエスカレーション情報を利用しない場合でも既存動作は変わらない設計とし、fail-closed（フェールクローズド）ではなくfail-safe（フェールセーフ）な後方互換動作を採用する。

#### フェーズプロンプトへの影響

definitions.ts内のbuildPrompt関数（フェーズプロンプト生成担当）については、FR-2の変更はbuildRetryPrompt関数のみに限定し、通常フェーズプロンプトの生成ロジックは変更しない。
これによりFR-2がフェーズプロンプト全体に波及するリスクを排除する。

#### 実装対象（CLAUDE.md）

対象ファイル: `C:\ツール\Workflow\CLAUDE.md`

「バリデーション失敗時のリトライプロンプトテンプレート」セクションに以下の記述を追加する。
リトライテンプレートにモデルエスカレーション手順を明記することで、OrchestratorがsuggestModelEscalation情報を使用する手順を文書化する。
追加内容: 「buildRetryPromptの返り値に `suggestModelEscalation: true` が含まれる場合、次のリトライでは模型をsonnetに変更してsubagentを再起動すること。haikuで2回以上リトライが失敗した場合は自動的にsonnetへエスカレーションする。」

`workflow-plugin/CLAUDE.md` にも同一内容を追記して両ファイルを同期させる。
既存の記述を削除・上書きせず、追記のみで対応することでNFR-3準拠を維持する。

---

### FR-3: テスト記録キーワード検出改善（record-test-result.ts）

#### 実装対象

対象ファイル: `workflow-plugin/mcp-server/src/tools/record-test-result.ts`

FR-3は2つの独立した問題を修正する。1つ目は単語境界なしのBLOCKING_FAILURE_KEYWORDS検出による誤拒否（精度向上が目的）、2つ目はhashValidationポリシーの非対称性（testingとregression_testで異なる動作が必要）である。
これら2つの修正要件は論理的に独立しており、それぞれ別の関数変更として実装する。

#### isCompoundWordContext関数の追加

35〜45行目付近のBLOCKING_FAILURE_KEYWORDSに対して単語境界マッチ（`\b` アサーション）を適用し、スペース区切り複合語を除外する新関数 `isCompoundWordContext` を追加する。
この正規表現による単語境界強化は、大文字小文字不問マッチを維持しつつ部分マッチによる誤検出を防ぐ目的で導入する。

関数シグネチャ: `function isCompoundWordContext(output: string, keyword: string, matchIndex: number): boolean`

実装ロジックは以下とする。
マッチ位置の前後50文字程度のウィンドウを取得し、コンテキストを把握する。
ウィンドウ内でキーワードの直前または直後（2語以内）に大文字始まりの語が存在する場合に `true` を返す。
具体的には "Fail Closed"、"Fail Safe"、"Fail Open" のようなパターンを検出対象とし、マッチしたキーワードが固有名詞や専門用語の一部である可能性を追跡する。

既存のisHyphenatedWord関数との使い分けは以下とする。
isHyphenatedWord: キーワードの直後にハイフンが続く場合（"Fail-Closed"）を検出してハイフン結合語を除外する。
isCompoundWordContext: キーワードの前後にスペース区切りの大文字始まり語がある場合（"Fail Closed"）を検出して除外対象外とする。

validateTestOutputConsistency関数内のhtmlFunctionの呼び出し箇所で、isHyphenatedWordチェックと同様にisCompoundWordContextチェックを追加することで、両検出ロジックを同等の条件で適用する。

#### ハッシュ重複ポリシーの緩和（regression_testフェーズ対応）

354〜362行目付近のhashValidation処理を変更する。
変更前: フェーズに関わらず同一ハッシュ（SHA256ベース）を常に拒否する設計
変更後: `currentPhase === 'regression_test'` の場合、既存ハッシュとの一致を検出しても拒否せず上書き記録を許可する

具体的な変更方法として、recordTestOutputHash関数の呼び出し前に現在のフェーズを確認し、regression_testフェーズであれば既存ハッシュ配列をクリアするか、またはhashValidation処理全体をスキップする実装を採用する。
testingフェーズでは従来通り同一ハッシュ（SHA256による同一出力判定）を拒否することを維持する。
この非対称なハッシュポリシーにより、regression_testでは同じテストスイートを複数回実行して記録できるようになり、修正前後の比較が両方記録可能になる。

---

### FR-4: regression_testフェーズ遷移時ベースライン存在チェック（next.ts / definitions.ts）

#### 実装対象

対象ファイル: `workflow-plugin/mcp-server/src/tools/next.ts`（workflowNext関数内）

FR-4はCLAUDE.mdのルール20（ベースライン記録義務化）に対して技術的な強制手段を追加する。
現状は文書上の義務化のみで技術的強制欠如の状態にあり、MCPサーバー側でのチェックが存在しない。
遷移阻止（警告付き確認方式）を導入することで、因果関係追跡のためのベースラインが存在しない状態でregression_testが実施されることを防止する。

#### 遷移前チェックの追加箇所

workflowNext関数内の「REQ-2: testing → regression_test 遷移時のテスト結果検証」処理（234行目付近）の直後に、ベースライン存在チェックを追加する。

チェックのトリガー条件: `currentPhase === 'testing'`（testingフェーズからregression_testへの遷移時）
チェック内容: `taskState.testBaseline` が undefined または null の場合に警告メッセージを返す。
返却するメッセージ内容: 「ベースラインが記録されていません。workflow_capture_baselineを実行してからregression_testフェーズに進んでください。」

ハード阻止ではなく確認ダイアログ方式を採用するため、`requiresConfirmation: true` フィールドを含む返却値を設計する。
この設計により新規プロジェクト（既存テストが存在しない場合）での遷移スキップが可能になり、利便性と安全性を両立する。

#### forceTransitionパラメータの追加

workflowNext関数のシグネチャに `forceTransition?: boolean` パラメータを追加する。
`forceTransition: true` が指定された場合、ベースライン未設定警告をスキップして遷移を許可する。
このパラメータはオプショナルであり、既存の呼び出し元コードへの影響を最小化する設計となっている。

具体的な返却値の形式は以下とする。
ベースライン未設定かつforceTransition未指定の場合: `{ success: false, message: '...', requiresConfirmation: true }` 相当の情報を含める。
forceTransition: trueの場合は通常の遷移処理を継続し、明示的な設定済み扱いとして遷移を実行する。

#### フェーズプロンプトへのベースライン指示追加

definitions.tsのresearchフェーズプロンプト（buildPrompt関数内）にベースライン記録の指示を明示的に追加する。
テスト実行コマンドの具体例（`npm test`、`npx vitest run`）を含め、workflow_capture_baselineの呼び出しタイミングを明記する。
これによりOrchestratorがresearchフェーズのsubagentを担当する際、ベースライン記録の通知がフェーズプロンプトから直接得られるようになる。

#### MCPツール定義の更新

server.tsまたはtools/index.tsのworkflow_nextツール定義のinputSchemaに `forceTransition` パラメータを追加する。

```typescript
forceTransition: {
  type: 'boolean',
  description: 'ベースライン未設定を無視してregression_testに遷移する（新規プロジェクト用）',
}
```

---

## 変更対象ファイル

### 修正対象ファイル一覧

| ファイルパス | 変更種別 | FR番号 |
|------------|---------|--------|
| `workflow-plugin/mcp-server/src/validation/artifact-validator.ts` | 関数追加・既存処理変更 | FR-1 |
| `workflow-plugin/mcp-server/src/tools/record-test-result.ts` | 関数追加・既存処理変更 | FR-3 |
| `workflow-plugin/mcp-server/src/phases/definitions.ts` | 型定義変更・返り値変更 | FR-2, FR-4 |
| `workflow-plugin/mcp-server/src/tools/next.ts` | 引数追加・チェック処理追加 | FR-4 |
| `C:\ツール\Workflow\CLAUDE.md` | 追記のみ | FR-2 |
| `workflow-plugin/CLAUDE.md` | 追記のみ | FR-2 |

### 各ファイルの変更理由と影響範囲

**artifact-validator.ts**: 禁止パターン検出・角括弧プレースホルダーエラー検出の両検出機構にコードブロック除外ロジックを追加する。既存の重複行検出が持つコードフェンス追跡ロジックを参考に、コードブロック内行を非除外対象から外す実装を再利用する形で統一する。
**record-test-result.ts**: BLOCKING_FAILURE_KEYWORDSに単語境界アサーション（`\b`）を適用して精度向上を図り、isCompoundWordContext関数を生成して複合語コンテキスト判定を追加する。また、hashValidationポリシーにフェーズ条件分岐を追加してregression_testと通常testingで異なる動作を付与する。
**definitions.ts**: buildRetryPrompt関数の返り値型にオプショナルなsuggestModelEscalationフィールドを追加し、OrchestratorへのモデルエスカレーションのOrchestratorへの通知経路を確立する。researchフェーズプロンプトにはベースライン記録指示を追記する。
**next.ts**: testingフェーズからregression_testフェーズへの遷移時に、taskState.testBaselineの存在を確認するチェックを追加する。forceTransitionパラメータ（オプショナル）を新設して遷移阻止の回避手段を提供する。
**CLAUDE.md（両方）**: リトライテンプレートへのモデルエスカレーション手順の追記のみ実施し、既存内容は変更しない。変数名や具体例を含む追記として記載する。

### MCPサーバー再起動タイミング

全修正ファイルのコンパイル（`npm run build`）完了後、testingフェーズ開始前にMCPサーバープロセスを再起動すること。
Node.jsのモジュールキャッシュ仕様により、dist/*.jsファイルの変更は再起動なしには実行中のサーバーに反映されない。
再起動手順: Claudeのsettings.jsonでMCPサーバーを再接続するか、プロセスを終了して再起動する。

---

## テスト戦略

### 新規テストケースの追加箇所

FR-1に対するテストは `workflow-plugin/mcp-server/src/validation/__tests__/artifact-validator.test.ts` に追加する。
コードブロック内の禁止語（WIP、TODO等）を含む入力、コードブロック外の禁止語を含む入力、チルダフェンス内の角括弧を含む入力を各テストケースとして追加する。
これらのテストで「誤拒否が発生しないこと」と「正当な検出が維持されること」の両立を検証する。

FR-3に対するテストは `workflow-plugin/mcp-server/src/tools/__tests__/record-test-result.test.ts` に追加する。
"Fail Closed tests"を含む出力でのexitCode 0記録が成功すること（単語境界による誤検出の排除確認）と、regression_testフェーズでの同一ハッシュ再記録が成功すること（ハッシュポリシー緩和の確認）をそれぞれテストする。

FR-4に対するテストは `workflow-plugin/mcp-server/src/tools/__tests__/next.test.ts` に追加する。
ベースライン未設定状態でのtesting→regression_test遷移がrequiresConfirmation付き警告を返すこと（遷移阻止の確認）と、forceTransition: trueで遷移できること（回避手段の確認）をテストする。

### 既存テストの保護（リグレッションテストスイート）

変更後に `npm test` を `workflow-plugin/mcp-server/` ディレクトリで実行し、820件の既存テスト（単体テスト・統合テストを含むリグレッションテストスイート）が全てパスすることを確認する。
820件の内訳は単体テストと統合テストに分割されており、3ファイルに関連するテスト群が修正後も同等の判定条件でパスすることを検証する。
特にartifact-validator.tsの変更はisStructuralLine関数や重複行検出ロジックを変更しないため、関連テストへの影響は限定的である。
record-test-result.tsの変更はAPIのリクエスト・レスポンス形式を変更しないため、既存のintegrationテストへの影響は発生しない。

---

## 用語と要件のトレーサビリティ

本セクションでは、requirements.mdで使用されている専門用語とspec.mdの設計項目の対応を記録する。
この追跡情報により、設計がすべての修正要件を適切にカバーしていることを確認できる。

### FR-1関連の対応

| requirements.mdの用語・要件内容 | spec.mdの設計項目 |
|--------------------------------|-----------------|
| 禁止パターン検出（283行目） | extractNonCodeLines関数による検索範囲の限定（283行目変更） |
| 角括弧プレースホルダーエラー検出（288行目） | extractNonCodeLines適用後の正規表現マッチ（288行目変更） |
| コードブロック内外の区別がない非対称な状態 | 共通関数extractNonCodeLinesによる対称化、両検出で再利用 |
| チルダ3個以上もコードフェンスとして認識 | チルダ対応をextractNonCodeLinesに含める設計 |
| 既存の重複行検出の動作が変化しないこと（AC-1） | 311行目の重複行検出は変更対象外として明示 |

### FR-2関連の対応

| requirements.mdの用語・要件内容 | spec.mdの設計項目 |
|--------------------------------|-----------------|
| モデルエスカレーション機構欠如（現状の問題点） | buildRetryPromptへのsuggestModelEscalation追加 |
| OrchestratorへのモデルエスカレーションOrchestratorへの通知（FR-2-A） | BuildRetryResult型定義によるフィールド追加 |
| CLAUDE.mdのリトライテンプレートへの追記（FR-2-B） | 「バリデーション失敗時のリトライプロンプトテンプレート」セクションへの追記 |
| フェーズプロンプトの明記（FR-2-C） | definitions.tsのresearchフェーズプロンプトへのベースライン記録指示追加 |
| 1回目のリトライでは `suggestModelEscalation: false` を返す（AC-2） | retryCount >= 2条件による過剰エスカレーション防止ロジック |

### FR-3関連の対応

| requirements.mdの用語・要件内容 | spec.mdの設計項目 |
|--------------------------------|-----------------|
| 単語境界なしの部分マッチによる誤検出（現状の問題点） | \bアサーション適用と精度向上のための単語境界強化 |
| スペース区切り複合語（例: "Fail Closed"）は除外対象外（現状） | isCompoundWordContext関数による複合語判定の追加 |
| ハイフン結合語（isHyphenatedWord）とスペース区切り複合語の使い分け | isHyphenatedWordとisCompoundWordContextの両検出適用 |
| regression_testフェーズでの同一ハッシュ拒否（hashValidationポリシー） | currentPhase条件分岐による同一ハッシュポリシーの緩和 |
| testingフェーズでは従来通り拒否（FR-3-C） | フェーズ条件を明示的に記述して両検出の非対称設計を文書化 |

### FR-4関連の対応

| requirements.mdの用語・要件内容 | spec.mdの設計項目 |
|--------------------------------|-----------------|
| ベースライン未記録の技術的強制欠如（根本原因） | workflowNext関数へのtestBaseline存在チェック追加による技術的強制 |
| 遷移阻止をハード阻止ではなく確認ダイアログ方式に（FR-4-B） | requiresConfirmation: trueを含む返却値設計と確認ダイアログ方式の採用 |
| forceTransition: trueパラメータによるスキップ（FR-4-B） | workflowNext関数シグネチャへのforceTransition?追加 |
| researchフェーズプロンプトへのベースライン記録指示追加（FR-4-C） | definitions.tsのbuildPrompt関数内フェーズプロンプト修正 |
| ベースライン未設定のままregression_testを阻止（FR-4-A） | testing→regression_test遷移時の存在チェック実装 |

### NFR関連の対応

| requirements.mdの非機能要件 | spec.mdの設計項目 |
|---------------------------|-----------------|
| 既存テスト820件の全パス維持（NFR-1） | テスト戦略セクションでの820件パス検証手順 |
| バリデーション処理時間の劣化制限（10%以内）（NFR-2） | O(n)の1パス処理設計とネストしたループを避ける方針 |
| 後方互換性の維持（NFR-3） | オプショナル型追加のみ・追記のみ・破壊的変更なし |

---

## 非機能要件と制約

### パフォーマンス要件

extractNonCodeLines関数はO(n)の1パス処理として実装し、1000行のMarkdownに対する処理時間増加を修正前後で10%以内に抑制する。
処理時間の計測は `workflow-plugin/mcp-server/src/validation/__tests__/` に配置するパフォーマンステストで実施する。
行単位のシンプルなループ処理により、大きなMarkdownファイルを対象とした複数回実行時でも処理時間劣化が累積しない設計とする。

### 後方互換性の維持

buildRetryPrompt関数の返り値型変更は `suggestModelEscalation?: boolean` のオプショナル追加のみとし、既存の呼び出し元コードが修正なしに動作し続けることを確認する。
workflowNext関数のforceTransitionパラメータ追加はオプショナルであり、既存の呼び出し元は変更不要である。
CLAUDE.mdへの変更は追記のみで既存内容を上書きしない設計とし、変数名や値型追加等の最小限の変更に留める。

### 制約事項

MCPサーバーの再起動は本修正の全ファイルビルド完了後に1回のみ実施する。
CLAUDE.mdの変更はGitコミット対象であるため、変更差分が最小限になるよう追記箇所を限定する。
workflow-plugin/CLAUDE.mdはサブモジュール内のファイルであるため、変更後にサブモジュールコミットが必要となることに留意する。
