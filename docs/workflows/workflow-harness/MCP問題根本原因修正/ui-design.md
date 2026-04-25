# UI設計：CLIエラーメッセージと診断ログの改善

## サマリー

本タスクはworkflow-pluginのMCPサーバーとhookシステムの根本原因修正に伴うUI設計である。
ユーザーが認識可能なインターフェース変更は主にエラーメッセージとログ出力の改善である。
密度計算修正（BUG-2）はバリデーション失敗メッセージの精度向上につながる。
mkdirブロック解除（BUG-3）はワークフロー中のディレクトリ作成操作の自動許可を実現する。
インライン環境変数検出（SEC-ENV-1）は新たなセキュリティブロックメッセージを追加する。
トークン比較修正（SEC-TIME-1）は内部動作のみでUI変更はないが、APIレスポンス仕様への影響がないことを確認した。
ログマスキング（SEC-LOG-1）はコマンドログに含まれる機密情報を保護するための表示形式変更である。
本設計書ではCLIインターフェース、エラーメッセージ、APIレスポンス、設定ファイルの各観点から変更内容を定義する。

## CLIインターフェース設計

本タスクはCLIツール（Node.js hookスクリプトおよびMCPサーバー）の改善であり、Web UIコンポーネントは存在しない。
CLIインターフェースの変更は5つの修正（BUG-2、BUG-3、SEC-ENV-1、SEC-TIME-1、SEC-LOG-1）に対応する。
BUG-2の修正ではartifact-validator.tsの密度計算式が改善され、バリデーション結果の正確性が向上する。
BUG-3の修正ではbash-whitelist.jsにmkdir -pコマンドのホワイトリストエントリが追加される。
SEC-ENV-1の修正ではbash-whitelist.jsにインライン環境変数設定の検出ロジックが追加される。
SEC-TIME-1の修正ではmanager.tsのトークン比較がcrypto.timingSafeEqual()に変更されるがCLI出力に変化はない。
SEC-LOG-1の修正ではphase-edit-guard.jsのログ出力にmaskSensitiveInfo()関数が適用される。
CLIメッセージのフォーマットはアイコン付きヘッダー、詳細説明、推奨アクションの3層構造で統一する。
成功メッセージには緑色のチェックマーク、エラーには赤色のバツ印、警告には黄色の注意マーク、セキュリティブロックには紫色の鍵マークを使用する。
全てのメッセージは日本語をデフォルトとし、環境変数LANGによる英語切り替えはサポートしない。

## エラーメッセージ設計

BUG-2関連のバリデーションエラーメッセージは密度値と基準値の両方を表示してユーザーに改善指針を提供する。
密度チェック失敗時にはセクション名、現在の密度値、基準値（0.3）、構造行数、実質コンテンツ行数を含むメッセージを出力する。
推奨アクションとして実質的なコンテンツの追加またはコードブロック等の構造行の削減を提案する。
BUG-3関連のmkdirブロックエラーメッセージはブロックされたパスと許可されるパスの一覧を表示する。
許可されるディレクトリとしてdocs/workflows/、docs/security/、.claude/state/の3種類を明示する。
SEC-ENV-1関連のセキュリティブロックメッセージは検出された環境変数名とその危険性の説明を含む。
NODE_OPTIONSはプロセス起動時の任意コード実行リスク、LD_PRELOADはライブラリフックリスク、PYTHONPATHはモジュール改ざんリスクとして説明する。
SEC-LOG-1関連ではログマスキング自体はエラーメッセージを生成しないが、マスキングパターンに一致した場合はログファイル内で値が3つのアスタリスクに置換される。
パスワードパターンは--password=値、-p 値、PASSWORD=値の形式を検出して置換する。
APIキーパターンは--api-key=値、API_KEY=値、Authorization: Bearer 値の形式を検出して置換する。
トークンパターンは--token=値、TOKEN=値の形式および汎用パターンとして--に続くsecret、key、tokenを含むオプション名を検出する。

## APIレスポンス設計

本タスクの5件の修正はMCPサーバーの内部ロジックとhookスクリプトの変更であり、外部APIエンドポイントの追加や変更は行わない。
MCPサーバーのworkflow_start、workflow_next、workflow_approve等の既存APIレスポンス形式に変更はない。
SEC-TIME-1の修正はisSessionTokenValid()関数の内部比較方式のみの変更であり、認証失敗時のレスポンスメッセージは従来通りである。
artifact-validator.tsのバリデーション結果はMCPサーバーのworkflow_nextやworkflow_complete_sub内部で使用されるが、レスポンスのJSON構造に変更はない。
バリデーション失敗時のレスポンスにはsuccessフィールドがfalse、messageフィールドにエラー詳細が含まれる既存の形式を維持する。
hookスクリプト（bash-whitelist.js、enforce-workflow.js、phase-edit-guard.js）はClaude CodeのPreToolUseイベントで実行され、APIレスポンスではなく標準出力にメッセージを返す。
hookスクリプトのブロック判定はJSON形式で返却され、reasonフィールドにブロック理由の文字列が含まれる。
BUG-3修正後のmkdir許可判定結果もhookの既存レスポンス形式（許可時はundefined、ブロック時はreasonを含むオブジェクト）に従う。

## 設定ファイル設計

本タスクで変更される設定関連の要素は3つのhookスクリプトの内部定数とMCPサーバーの環境変数である。
bash-whitelist.jsのreadonlyホワイトリスト配列にmkdir -pエントリを追加し、validateMkdirTarget()関数で許可パスを制御する。
許可パスはdocs/workflows/、docs/security/、.claude/state/の3つのプレフィックスとし、path.normalize()で正規化後にプレフィックス一致を検証する。
bash-whitelist.jsのSECURITY_ENV_VARS配列は既存の8変数（NODE_OPTIONS、LD_PRELOAD、LD_LIBRARY_PATH、PYTHONPATH、CLASSPATH、AWS関連、GITHUB_TOKEN、API_KEY）を維持する。
checkInlineEnvAssignment()関数の正規表現パターンは大文字小文字を区別せず、引用符付き形式（VAR="value" command）にも対応する。
enforce-workflow.jsのWORKFLOW_CONFIG_PATTERNS配列にdocs/workflows/パターンを追加し、ワークフロー成果物ディレクトリの操作を全フェーズで許可する。
phase-edit-guard.jsのmaskSensitiveInfo()関数のマスキングパターンは配列で管理し、将来の拡張を容易にする設計とする。
artifact-validator.tsのMIN_SECTION_DENSITY環境変数のデフォルト値0.3は変更せず、計算式の分母変更で実質的な緩和を実現する。
manager.tsのisSessionTokenValid()関数はcrypto.timingSafeEqual()を使用するが、設定ファイルへの影響はなくimport文の追加のみである。
.claude/settings.jsonのhook定義は変更不要であり、既存のPreToolUse/PostToolUseイベント設定がそのまま動作する。
