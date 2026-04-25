## サマリー

artifact-validatorテーブル行除外タスクで発生した7件の問題の要件定義書である。
各問題の根本原因はsubagentへの情報伝達不足にあり、CLAUDE.mdのsubagent起動テンプレート改善で6件、record-test-result.tsのパーサー改善で1件を解決する方針とした。
主要な要件はREQ-1のdocsDir明示的埋め込み、REQ-2のBashコマンド制限明記、REQ-3の必須セクション名事前通知、REQ-4のベースライン記録義務化、REQ-5のパーサー改善、REQ-6のMCPキャッシュ文書化、REQ-7のゴミディレクトリ削除である。

- 目的: 7件の問題の修正により、subagentが初回から正しい成果物を生成できる環境を構築する
- 主要な決定事項: bash-whitelist.jsは変更せず、subagent promptへの許可コマンド明示で対応
- 次フェーズで必要な情報: CLAUDE.mdとrecord-test-result.tsの具体的な修正箇所と変更内容

## 機能要件

### REQ-1: subagentへのdocsDir明示的埋め込み

CLAUDE.mdのsubagent起動テンプレートにおいて、MCPサーバーが返すdocsDirパスを明示的に埋め込む機能を実装する。
subagent promptには必ず「出力先: {docsDir}」という形でパスを記述し、MCPサーバーのworkflow_statusから取得した値をそのまま渡す。
subagentがタスク名から独自にパスを構築することを禁止する明示的な指示文を追加する。
この要件により問題1のディレクトリ名不一致（全角ー vs 半角-）を根本的に解決する。

MCPサーバーのsanitizeTaskName()関数が長音記号を半角ハイフンに正規化するため、subagentが受け取るdocsDirは正規化後のパスである必要がある。
Orchestratorはworkflow_statusの返却値からdocsDirフィールドを読み取り、そのまま埋め込む実装とする。
subagentは指定されたdocsDirを文字列変換や正規化を行わずそのまま使用するという運用ルールを明記する。

### REQ-2: subagent promptへのBashコマンド制限明記

各フェーズでsubagentに許可されるBashコマンド一覧をpromptに明記する機能を実装する。
フェーズごとの許可コマンドは以下の通りである。

researchフェーズではreadonly+testingカテゴリのコマンドが許可される。
具体的にはls, cat, head, tail, grep, find, git status, npm test, npx vitest, npx jestなどが使用可能である。
requirementsからdesign_reviewまではreadonly+testingカテゴリのコマンドが許可される。
test_designからtestingまではreadonly+testingカテゴリのコマンドが許可される。
regression_testフェーズではreadonly+testingカテゴリのコマンドが許可される。
parallel_verificationの各サブフェーズではreadonly+testingカテゴリのコマンドが許可される。
implementationとrefactoringではreadonly+testing+implementationカテゴリのコマンドが許可される。
具体的にはnpm install, npm run build, mkdir, rmなども使用可能である。

禁止コマンドの代替手段を明記する。
cpコマンドの代わりにRead toolでファイルを読み込みWrite toolで書き込む方法を指示する。
mvコマンドの代わりにRead tool + Write tool + rmで移動操作を実現する方法を指示する。
odコマンドの代わりにRead toolでファイル内容を読み取る方法を指示する。

この要件により問題2のcpコマンドブロックと問題7のodコマンド繰り返しブロックを同時に解決する。

### REQ-3: 成果物必須セクション名の事前通知

CLAUDE.mdの各フェーズ成果物説明に、artifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSと完全に一致する必須セクション名を明記する。
parallel_verificationのmanual_testサブフェーズでは「テストシナリオ」「テスト結果」の2セクションが必須であることを事前に通知する。
security_scanサブフェーズでは「脆弱性スキャン結果」「検出された問題」の2セクションが必須であることを事前に通知する。
performance_testサブフェーズでは「パフォーマンス計測結果」「ボトルネック分析」の2セクションが必須であることを事前に通知する。
e2e_testサブフェーズでは「E2Eテストシナリオ」「テスト実行結果」の2セクションが必須であることを事前に通知する。

CLAUDE.mdのsubagent起動テンプレートに以下の指示文を追加する。
「成果物には必ず以下のセクションを含めてください: {必須セクション一覧}」という形で明示する。
セクション名は二重ハッシュ（##）のMarkdownヘッダーで記述する必要があることも明記する。

この要件により問題3の成果物バリデーション失敗を根本的に解決する。

### REQ-4: ベースライン記録義務の厳命ルール追加

CLAUDE.mdの「AIへの厳命」セクションに新規ルール20番としてベースライン記録義務を追加する。
ルール内容は「researchフェーズで既存テストを実行しworkflow_capture_baselineを呼ぶこと」とする。
既存テストが存在する場合、researchフェーズの調査作業としてテストを実行しベースラインを記録する義務があることを明示する。
ベースライン記録を忘れた場合、regression_testフェーズでの比較ができなくなることを警告文として追記する。

test-tracking.tsのworkflowCaptureBaseline()はresearchとtestingフェーズでのみ実行可能であることを文書化する。
testingフェーズでの記録は遅延ベースラインとして警告付きで許可されるが、researchフェーズでの記録が推奨される運用である。
regression_testフェーズでの記録は設計上意図的に禁止されており、これは変更しない。

この要件により問題4のベースライン未設定を根本的に解決する。

### REQ-5: record-test-result.tsのパーサー改善

workflow_record_test_resultツールのパーサーにsummaryフィールドによるフォールバック処理を追加する。
現在のパーサーはvitest/jest形式の特定パターン（Tests: N passed、N tests passed、PASS ./file.test.ts等）のみを認識する実装である。
カスタム形式のテスト出力に対応するため、summaryフィールドが提供された場合は構造パターンマッチを省略する実装を追加する。

具体的な実装方針は以下の通りである。
summaryフィールドが提供されかつoutputが50文字以上の場合、テストフレームワークパターン未一致でも受け付ける。
summaryフィールドからテスト件数を抽出する正規表現パターンを追加する。
抽出パターンは「N件のテスト」「Nテスト実行」「totalTests: N」などの日本語と英語の両方に対応する。
パターンマッチに失敗した場合でもsummaryフィールドに情報が記載されていれば記録を許可する。

この要件により問題5のテスト結果パース失敗を根本的に解決する。

### REQ-6: MCPサーバーキャッシュの注意事項文書化

CLAUDE.mdに「MCPサーバーのモジュールキャッシュ」という新規セクションを追加する。
Node.jsのrequire()はモジュールをグローバルキャッシュに保存し、同一プロセス内で再読み込みしない仕様であることを説明する。
MCPサーバーが起動時に読み込んだartifact-validator.ts等のコンパイル結果は、プロセス終了まで変更されないことを明記する。
ディスク上のdist/*.jsファイルを変更しても実行中のサーバーには反映されないため、成果物は実行中のバリデーターと互換で書く必要がある。

Orchestratorへの指示として以下を追記する。
artifact-validator.tsのコード変更が必要な場合、MCPサーバー再起動後に再実行することを推奨する。
成果物バリデーションで予期しないエラーが発生した場合、まずバリデーターコードではなく成果物の修正で対応する。
バリデーターのバグと判断できる場合のみコード修正を行い、修正後は必ずMCPサーバーを再起動する。

この要件により問題6のモジュールキャッシュ問題を運用ルールで対応する。

### REQ-7: ゴミディレクトリの削除

docs/workflows/artifact-validatorテーブル行除外/（全角ー、未コミット）ディレクトリを削除する。
このディレクトリは問題1の発生時にsubagentが誤って生成したディレクトリであり、成果物は含まれていない。
正しいディレクトリはdocs/workflows/artifact-validatorテ-ブル行除外/（半角ハイフンの「テ」と「ブル」の間）である。

削除作業はrmコマンドまたはWindowsのrmdir /s コマンドで実行する。
削除前にディレクトリ内容を確認し、重要なファイルが含まれていないことを確認する。

この要件により問題1の副作用で生成されたゴミディレクトリを除去する。

## 非機能要件

### NFR-1: CLAUDE.mdの可読性維持

CLAUDE.mdへの修正は既存のフォーマットと統一感を保つこと。
subagent起動テンプレートへの追記は既存のプレースホルダー形式（{xxx}）と一貫性を持たせる。
AIへの厳命セクションへの追記は既存の番号付きリスト形式を継続する。

### NFR-2: 後方互換性

record-test-result.tsのパーサー改善は既存のvitest/jest形式パースを破壊しないこと。
summaryフィールドによるフォールバックは既存パターンマッチが失敗した場合のみ動作する追加実装である。

### NFR-3: エラーメッセージの明確性

subagent promptに記載する禁止コマンドの代替手段は、具体例を含めて記述すること。
cpコマンドの代替例: Read tool + Write toolによるファイル複製の実装サンプルを含める。

## 受け入れ基準

### AC-1: REQ-1の受け入れ基準

CLAUDE.mdのsubagent起動テンプレートに「出力先: {docsDir}」というプレースホルダーが含まれている。
subagentがタスク名から独自にパスを構築することを禁止する指示文が追加されている。
Orchestratorの実装例としてworkflow_statusからdocsDirを読み取る方法が記載されている。

### AC-2: REQ-2の受け入れ基準

CLAUDE.mdのフェーズごとの編集可能ファイル表に、許可されるBashコマンドカテゴリが追記されている。
具体的な許可コマンド一覧がreadonly/testing/implementationの3カテゴリで明記されている。
cp、mv、odコマンドの代替手段（Read tool / Write tool）が具体例とともに記載されている。

### AC-3: REQ-3の受け入れ基準

CLAUDE.mdのparallel_verificationフェーズ説明に、manual_test/security_scan/performance_test/e2e_testの各必須セクション名が明記されている。
subagent起動テンプレートに「成果物には必ず以下のセクションを含めてください」という指示文が追加されている。
セクション名は二重ハッシュ（##）のMarkdownヘッダーで記述する必要があることが明記されている。

### AC-4: REQ-4の受け入れ基準

CLAUDE.mdの「AIへの厳命」セクションに新規ルール20番が追加されている。
ルール内容は「researchフェーズで既存テストを実行しworkflow_capture_baselineを呼ぶこと」である。
ベースライン記録を忘れた場合の影響（regression_test失敗）が警告文として記載されている。

### AC-5: REQ-5の受け入れ基準

record-test-result.tsのvalidateAndRecordTestResult()関数にsummaryフィールドによるフォールバック処理が実装されている。
summaryフィールドが提供されかつoutputが50文字以上の場合、構造パターンマッチ失敗でも受け付ける実装になっている。
summaryからテスト件数を抽出する正規表現パターンが追加されている。
既存のvitest/jest形式パースは影響を受けずそのまま動作する。

### AC-6: REQ-6の受け入れ基準

CLAUDE.mdに「MCPサーバーのモジュールキャッシュ」セクションが追加されている。
Node.jsのrequire()によるモジュールキャッシュの仕組みが説明されている。
成果物は実行中のバリデーターと互換で書く必要があることが明記されている。
バリデーターコード変更時のMCPサーバー再起動手順が記載されている。

### AC-7: REQ-7の受け入れ基準

docs/workflows/artifact-validatorテーブル行除外/（全角ー）ディレクトリが削除されている。
git statusで未追跡ディレクトリとして表示されないことを確認する。

## 制約事項

bash-whitelist.jsへのcpやodコマンド追加は行わない方針である。
これらのコマンドは読み取り専用ではなく、ファイルシステムへの変更を伴うため、意図的にホワイトリストから除外されている。
subagentへの代替手段周知により、ホワイトリスト変更なしで問題を解決する方針とした。

artifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSは変更しない。
必須セクション名はバリデーターに定義された仕様であり、成果物側が適合する設計である。

test-tracking.tsのベースライン記録可能フェーズ（research/testing）は変更しない。
regression_testフェーズでの記録を禁止する仕様は設計上の意図であり、維持する。

## スコープ外事項

artifact-validator.tsの他のバリデーションルール（重複行チェック等）の改善は本タスクのスコープ外である。
今回は7件の問題の根本原因修正に集中し、バリデーターの全面改修は行わない。

bash-whitelist.jsのホワイトリスト内容の見直しはスコープ外である。
現在のカテゴリ分類（readonly/testing/implementation）は妥当であり、変更の必要性は認められない。

MCPサーバーの起動・停止を自動化する機能の実装はスコープ外である。
モジュールキャッシュ問題は文書化による運用ルール対応とし、技術的な解決策は追求しない。
