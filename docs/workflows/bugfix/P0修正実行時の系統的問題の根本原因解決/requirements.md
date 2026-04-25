## サマリー

本ドキュメントはP0修正実行時に発生した4つの系統的問題の修正要件を定義する。
調査フェーズで特定した根本原因（バリデーターのコードブロック非除外・モデルエスカレーション機構欠如・テスト記録API誤拒否・ベースライン未記録の技術的強制欠如）に対し、それぞれ具体的な機能要件（FR-1〜FR-4）を定める。
非機能要件として既存テスト820件の全パス維持と処理時間劣化の10%以内への抑制を定める。
受け入れ基準は各FRごとに定義し、修正完了の判定条件として使用する。

### 主要な決定事項

- FR-1はartifact-validator.tsの禁止パターン検出および角括弧検出に限定して修正し、重複行検出ロジックは変更しない
- FR-2はCLAUDE.mdのリトライテンプレートにモデルエスカレーション手順を追記する形で実現し、definitions.tsのコード変更と両立させる
- FR-3はBLOCKING_FAILURE_KEYWORDSの単語境界マッチ強化と同一ハッシュ拒否ポリシーの緩和の2点を対象とする
- FR-4はMCPサーバーのregression_testフェーズ遷移処理にベースライン存在チェックを追加する

### 次フェーズで必要な情報

- artifact-validator.tsの283行目（禁止パターン）・288行目（角括弧）・311行目（重複行）の3箇所の実装詳細
- record-test-result.tsの35-45行目（BLOCKING_FAILURE_KEYWORDS）・354-362行目（hashValidation）の実装詳細
- definitions.tsのbuildRetryPrompt()（行1199-1268）の現在の返り値型定義
- regression_testフェーズのワークフロー遷移処理の実装箇所

---

## 機能要件

### FR-1: 禁止パターン・角括弧検出のコードブロック除外

**対象ファイル**: `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`

**現状の問題点**:
禁止パターン検出（283行目）は `content.includes(pattern)` によるファイル全体の文字列検索であり、コードブロック内外の区別を行っていない。
角括弧プレースホルダー検出（288行目）も同様に `bracketPlaceholderPattern` によるファイル全体への正規表現マッチである。
重複行検出（311行目）はコードフェンスの開始・終了フラグを追跡してコードブロック内行をスキップする実装を既に持つが、上記2検出には同等ロジックが存在しない非対称な状態である。

**要件内容**:

FR-1-A: 禁止パターン検出の対象行をコードブロック外に限定すること。
具体的には、コンテンツを行単位で分割し、コードフェンス（バックティック3個以上）の開始行から終了行までの間にある行を禁止パターン検出の対象外とする処理を追加する。
チルダ3個以上（`~~~`）もコードフェンスとして認識すること。

FR-1-B: 角括弧プレースホルダー検出の対象行をコードブロック外に限定すること。
FR-1-Aと同じコードブロック追跡ロジックを共通関数として抽出し、両検出で再利用する設計とすること。

FR-1-C: コードブロック除外ロジックを共通関数 `extractNonCodeLines(content: string): string[]` として実装し、禁止パターン検出・角括弧検出の両方から呼び出すこと。
この関数はコードフェンス内の行を除外した行配列を返すものとする。

**受け入れ基準（AC-1）**:
- コードブロック内に禁止語（例: `WIP`）を含むMarkdownファイルを入力した場合、禁止パターン違反エラーが発生しないこと
- コードブロック内に `[変数名]` のような角括弧を含むMarkdownファイルを入力した場合、角括弧プレースホルダーエラーが発生しないこと
- コードブロック外に禁止語・角括弧が存在する場合は従来どおり検出されること
- 既存の重複行検出の動作が変化しないこと

---

### FR-2: リトライ時のモデルエスカレーション機構の導入

**対象ファイル**:
- `workflow-plugin/mcp-server/src/phases/definitions.ts`（buildRetryPrompt関数）
- `C:\ツール\Workflow\CLAUDE.md`（リトライプロンプトテンプレート）

**現状の問題点**:
buildRetryPrompt()（行1199-1268）はエラー種別に応じた改善指示を生成するが、モデルエスカレーションをOrchestratorに通知する機構を持たない。
haikuが担当するフェーズ（manual_test, security_scan, performance_test, e2e_test等）でバリデーション失敗が繰り返された場合も、Orchestratorはhaikuを使い続ける。
CLAUDE.mdのリトライテンプレートにもモデル変更の指示が含まれていない。

**要件内容**:

FR-2-A: buildRetryPrompt()の返り値に `suggestModelEscalation: boolean` フィールドを追加すること。
リトライ回数が2回目以降（retryCount >= 2）かつ、エラー種別が「複数の違反が同時に発生（3件以上）」または「角括弧検出」または「禁止パターン検出」の場合に `suggestModelEscalation: true` を返すこと。

FR-2-B: CLAUDE.mdのリトライプロンプトテンプレートに以下の記述を追加すること。
「suggestModelEscalationがtrueの場合、モデルをsonnetに変更してsubagentを再起動すること。haikuでの複数回リトライが失敗した場合は、モデルエスカレーションを実施して再試行すること。」

FR-2-C: Orchestratorは `suggestModelEscalation: true` を受け取った場合、次のリトライではモデルをsonnetに変更してTask toolを呼び出すこと。この動作を明確にするため、CLAUDE.mdのリトライ手順に手順として明記すること。

**受け入れ基準（AC-2）**:
- buildRetryPrompt()の返り値型に `suggestModelEscalation` フィールドが追加されていること
- リトライ回数2回目以降かつ複合エラーの場合に `suggestModelEscalation: true` が返されること
- CLAUDE.mdのリトライテンプレートにモデルエスカレーション手順が記載されていること
- 1回目のリトライでは `suggestModelEscalation: false` が返されること（過剰エスカレーションの防止）

---

### FR-3: テスト結果キーワード検出の精度向上と同一ハッシュポリシー緩和

**対象ファイル**: `workflow-plugin/mcp-server/src/tools/record-test-result.ts`

**現状の問題点**:
BLOCKING_FAILURE_KEYWORDS（行35-45）の一部キーワードが単語境界なしの部分マッチで実装されており、テスト名に含まれる語句を誤検出する。
isHyphenatedWord()（行91-93）はハイフン結合語を除外するが、スペース区切りの複合語（例: "Fail Closed"）は除外対象外である。
hashValidation処理（行354-362）は同一出力のSHA256ハッシュを拒否するため、regression_testフェーズで同じテストスイートを複数回実行した場合に2回目以降が全て拒否される。

**要件内容**:

FR-3-A: BLOCKING_FAILURE_KEYWORDS内の全キーワードに単語境界マッチ（`\b` アサーション）を適用すること。
大文字小文字不問マッチを維持しつつ、単語の一部として含まれる場合（例: テスト名 "FailClosed" 内の "Fail"）は検出しないよう修正すること。

FR-3-B: 既存のisHyphenatedWord()に加え、スペース区切りの複合語パターン（例: "Fail Closed"、"fail open"）を除外する関数 `isCompoundWordContext(output: string, keyword: string, matchIndex: number): boolean` を追加すること。
キーワードの前後2語以内に大文字始まりの語が存在する場合に複合語コンテキストとみなす設計を検討すること。

FR-3-C: regression_testフェーズにおける同一ハッシュ拒否を緩和すること。
現在のフェーズ（taskState.currentPhase）が `regression_test` の場合、同一ハッシュの再記録を拒否せずに上書き記録を許可すること。
testing フェーズでは従来どおり同一ハッシュを拒否すること。

**受け入れ基準（AC-3）**:
- テスト名 "FailClosed tests" を含む出力を入力した場合、FAIL キーワード誤検出エラーが発生しないこと
- テスト名 "failing threshold tests" を含む出力を入力した場合、failing キーワード誤検出エラーが発生しないこと
- regression_testフェーズで同一テスト出力を2回記録した場合に成功すること
- testingフェーズで同一テスト出力を2回記録した場合は従来どおり拒否されること
- 真の失敗キーワード（「FAILED: 5 tests」など）は引き続き正しく検出されること

---

### FR-4: regression_testフェーズ遷移時のベースライン存在チェック

**対象ファイル**: `workflow-plugin/mcp-server/src/phases/definitions.ts`（またはworkflow_next処理）

**現状の問題点**:
CLAUDE.mdのルール20でresearchフェーズでのベースライン記録を義務化しているが、MCPサーバー側には技術的な強制手段がない。
testingフェーズ完了後にregression_testフェーズへ遷移する際、ベースラインが未設定でも遷移が許可される。
ベースライン未設定の状態でregression_testを実施しても変更前後の比較ができず、テスト失敗の因果関係を判断できない。

**要件内容**:

FR-4-A: workflow_next()のフェーズ遷移処理において、regression_testフェーズへの遷移前に `taskState.testBaseline` の存在チェックを追加すること。
ベースラインが未設定の場合、警告メッセージ「ベースラインが記録されていません。workflow_capture_baselineを実行してからregression_testフェーズに進んでください。」を返して遷移を阻止すること。

FR-4-B: 遷移阻止は「エラー」ではなく「警告付き確認」として実装すること。
具体的には、ベースライン未設定時に `requiresConfirmation: true` と警告メッセージを返し、Orchestratorが明示的なスキップ指示（`forceTransition: true` パラメータ等）を与えた場合に限り遷移を許可する設計とすること。
新規プロジェクト（既存テストが存在しない場合）でのスキップを可能にするため、ハード阻止ではなく確認ダイアログ方式を採用すること。

FR-4-C: definitions.tsのresearchフェーズプロンプト（buildPrompt関数内）にベースライン記録の指示を明示的に追加すること。
テスト実行コマンドの具体例（例: `npm test`、`npx vitest run`）を含め、workflow_capture_baselineの呼び出しタイミングを明記すること。

**受け入れ基準（AC-4）**:
- ベースライン未設定の状態でtestingフェーズからregression_testフェーズへのworkflow_next呼び出しが警告メッセージを返すこと
- `forceTransition: true` を付与した場合にベースライン未設定でも遷移できること
- ベースラインが設定済みの場合、通常どおり遷移できること
- researchフェーズのプロンプトにベースライン記録の指示が含まれていること

---

## 非機能要件

### NFR-1: 既存テストの全パス維持

修正後に既存テストスイート（820件）が全てパスすること。
今回の修正はartifact-validator.ts・record-test-result.ts・definitions.tsの3ファイルに影響を与えるため、これら3ファイルに関連する全テストが修正後も成功することを確認すること。
テスト実行は `workflow-plugin/mcp-server/` ディレクトリで `npm test` または `npx vitest run` により行うこと。
820件の内訳は単体テスト・統合テストを含み、リグレッションテストスイートで確認すること。

### NFR-2: バリデーション処理時間の劣化制限

FR-1のコードブロック除外ロジック追加（extractNonCodeLines関数）により、validateArtifactQualityCore()の処理時間が修正前比で10%以内の増加に留まること。
1000行のMarkdownファイルを対象とした処理時間を修正前後で比較し、10%以内であることをパフォーマンステストで確認すること。
extractNonCodeLines()は行単位の1パス処理（O(n)）で実装し、ネストしたループを避けること。

### NFR-3: 後方互換性の維持

今回の修正によりAPI型定義が変更される場合（FR-2のbuildRetryPrompt返り値型追加等）は、既存の呼び出し元コードが修正なしに動作し続けること。
`suggestModelEscalation` フィールドはオプショナル型（`suggestModelEscalation?: boolean`）として追加し、既存コードへの影響を最小化すること。
record-test-result.tsの変更はAPIのリクエスト・レスポンス形式に影響を与えないこと。
CLAUDE.mdへの追記は既存の記述を上書き・削除せず、追記のみで対応すること。

---

## 制約事項

本修正はMCPサーバーのNode.jsモジュールキャッシュの仕様上、コード変更後にMCPサーバープロセスの再起動が必要となる。
再起動のタイミングは実装フェーズ完了後・テストフェーズ開始前とし、サーバー再起動手順を実装フェーズの成果物に明記すること。
CLAUDE.mdの変更はGitコミット対象であり、変更差分が明確になるよう最小限の追記に留めること。
