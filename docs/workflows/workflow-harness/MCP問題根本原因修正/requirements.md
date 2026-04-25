# MCP問題根本原因修正 - 要件定義書

## サマリー

本プロジェクトでは、MCPサーバーとワークフロープラグインで発生した6件の根本原因を修正する。
BUG-1は、test-authenticity.tsでrequire('crypto')がESMコンテキストで使用されクラッシュする問題で、全require()をimportに置換する要件である。
BUG-2は、artifact-validator.tsの密度計算式が構造行を分母に含めるため不当に低い値を返す問題で、計算式をsubstantiveCount / (totalLines - structuralLines)に変更する要件である。
BUG-3は、ワークフロー実行中にdocs/workflows/ディレクトリ操作でユーザー確認が発生する問題で、bash-whitelist.jsとenforce-workflow.jsの設定に許可パターンを追加する要件である。
SEC-ENV-1、SEC-TIME-1、SEC-LOG-1は、セキュリティスキャンで検出された環境変数バイパス、タイミング攻撃、ログ機密情報漏洩の脆弱性修正要件である。
修正完了後は、全テストが通り、ワークフロー実行が円滑に動作し、セキュリティスキャンでの警告が解消される状態を目指す。
修正は後方互換性を維持し、既存のワークフロー成果物やプラグイン利用者に影響を与えない設計とする。
各バグについて受け入れ基準を定義し、実装完了の判断基準を明確化する。
非機能要件として、パフォーマンス影響なし、メンテナンス性向上、セキュリティベストプラクティス準拠を定める。
BUG-1の修正により、ESMプロジェクトとして一貫性のあるコードベースとなり、今後のrequire()混入を防ぐ。
BUG-2の修正により、Markdown文書の自然な構造を持つ成果物が適切に検証され、不要なバリデーションエラーが減少する。
BUG-3の修正により、ワークフロー実行中のユーザー確認頻度が減り、Claude Codeの自動作業が円滑になる。
セキュリティ修正により、OWASP基準に沿った堅牢なシステムとなり、監査での指摘事項が解消される。

## 機能要件

### FR-1: ESMモジュール統一（BUG-1対応）

プロジェクト全体でrequire()形式のCommonJSインポートを廃止し、import形式のESMインポートに統一する。
対象ファイルは、mcp-server/src/配下の全.tsファイルとし、特にvalidation/配下を重点的に確認する。
require('crypto')、require('fs')、require('path')等の全require()呼び出しを検索し、対応するimport文に置換する。
置換後は、TypeScriptコンパイラでエラーが発生しないこと、およびdist/配下の生成ファイルが正しくESMとして出力されることを確認する。
MCPサーバーをビルド(pnpm build)し、生成されたdist/index.jsがimport/export構文を使用していることを検証する。
test-authenticity.tsのcomputeHash関数内部でimport { createHash } from 'crypto'を使用し、関数内requireを排除する。
プロジェクトのpackage.jsonでtype: "module"、tsconfig.jsonでmodule: "ESNext"であることを再確認する。
eslint設定にno-requireルールを追加し、今後のrequire()混入を防止する。
修正完了後、MCPサーバーを再起動し、workflow_record_test_result実行時にクラッシュしないことを確認する。
既存のユニットテストが全て通ることを確認し、ESM移行によるリグレッションがないことを保証する。

### FR-2: 密度計算式改善（BUG-2対応）

artifact-validator.tsのcheckSectionDensity関数で使用する密度計算式を変更し、構造行を分母から除外する。
現在の計算式density = substantiveCount / totalLinesを、density = substantiveCount / (totalLines - structuralLines)に変更する。
structuralLinesは、isStructuralLine()でtrueとなる行(水平線、コードフェンス、テーブル区切り)の総数である。
密度計算の際、totalLines - structuralLinesがゼロまたは負の値にならないよう、最小値1を保証するガード処理を追加する。
長い1行段落の扱いを改善するため、100文字を超える行を複数コンテンツ行としてカウントするオプションを追加する。
具体的には、substantiveLineの文字数が100を超える場合、Math.ceil(line.length / 100)をsubstantiveCountに加算する処理を実装する。
密度閾値のデフォルト値を0.3から0.2に引き下げ、Markdown文書の一般的な構造を考慮した妥当な値にする。
環境変数ARTIFACT_DENSITY_THRESHOLDで閾値を上書き可能にし、プロジェクトごとの調整を可能にする。
修正後は、水平線を多用するMarkdown文書や長い段落を含む技術文書が適切に検証されることを確認する。
既存のバリデーション成功ケースが引き続き通ることを確認し、計算式変更によるリグレッションを防止する。

### FR-3: ワークフロー成果物ディレクトリ操作許可（BUG-3対応）

bash-whitelist.jsの全readonlyフェーズ（research, requirements, 等）でmkdirコマンドを条件付きで許可する。
許可条件は、対象ディレクトリがdocs/workflows/配下である場合のみとし、それ以外のディレクトリへのmkdirはブロックする。
具体的には、bash-whitelist.jsのallowDirOpsForWorkflow関数を新設し、パスがdocs/workflows/で始まる場合にtrueを返す。
research、requirements、parallel_analysis、parallel_design等の全読み取り専用フェーズでallowDirOpsForWorkflow()を呼び出す。
enforce-workflow.jsのWORKFLOW_CONFIG_PATTERNSに、新たに/^docs\/workflows\//パターンを追加する。
これにより、docs/workflows/配下のファイル編集操作がフェーズ制限を受けず、常に自動許可される。
.claude/state/workflows/配下のworkflow-state.json、log.md等のファイルも既存のALWAYS_ALLOWED_PATTERNSで許可されていることを確認する。
ワークフロー成果物のWrite/Edit操作がenforce-workflow.jsでブロックされないよう、WORKFLOW_CONFIG_PATTERNSとALWAYS_ALLOWED_PATTERNSの整合性を検証する。
修正後は、research/requirements/planning等の初期フェーズで、Claude Codeがdocs/workflows/タスク名/ディレクトリを確認なく作成できることを確認する。
また、古いワークフロー状態ファイルの削除時にもユーザー確認が発生しないことを確認する。

### FR-4: 環境変数バイパス検出強化（SEC-ENV-1対応）

bash-whitelist.jsのチェック処理で、VAR=value command形式のインライン環境変数設定を検出する。
現在のチェックは、export VAR=value形式とVAR=value単独行のみを対象としており、VAR1=v1 VAR2=v2 cmd形式は検出されない。
SECURITY_ENV_VARSリスト（NODE_OPTIONS、LD_PRELOAD、LD_LIBRARY_PATH、DYLD_INSERT_LIBRARIES等）に含まれる変数のインライン設定を検出する。
正規表現パターンを追加し、コマンド行の先頭から最初の非代入単語までの間に危険な環境変数設定がないかチェックする。
具体的には、/^(\w+=\S+\s+)*(\w+)=(\S+)\s+/パターンでインライン代入を抽出し、変数名がSECURITY_ENV_VARSに含まれるか検証する。
検出時には、"Blocked: Setting security-sensitive environment variable <VAR> via inline assignment is not allowed."メッセージを表示する。
テストケースとして、NODE_OPTIONS=--require=malicious.js node app.js形式のコマンドがブロックされることを確認する。
また、通常のNPM_CONFIG_PREFIX=/custom/path npm install等の無害な環境変数設定が誤検出されないことを確認する。
既存のexportチェックとVAR=value単独チェックも引き続き動作することを確認し、リグレッションを防止する。
修正後は、全ての環境変数代入形式（export、単独行、インライン）でSECURITY_ENV_VARSリストが一貫して適用されることを保証する。

### FR-5: タイミング攻撃対策（SEC-TIME-1対応）

manager.tsのisSessionTokenValid()関数で、トークン比較処理をcrypto.timingSafeEqual()に変更する。
現在の実装token !== storedTokenは、文字列比較演算子の早期リターン特性により、タイミング攻撃でトークン値を推測できる可能性がある。
timingSafeEqual()は、入力バッファの全バイトを比較し、常に一定時間で結果を返すため、タイミング攻撃を防止する。
変更前に、tokenとstoredTokenをBuffer.from(string, 'utf-8')でバッファに変換し、長さが一致しない場合は早期リターンする。
長さ不一致時の早期リターンは、タイミング攻撃の実用性を損なわないため許容される（長さ情報は漏洩してもリスクが低い）。
具体的な実装は、以下のように行う。
import { timingSafeEqual } from 'crypto'を追加する。
const tokenBuf = Buffer.from(token, 'utf-8'), storedBuf = Buffer.from(storedToken, 'utf-8')でバッファ変換する。
if (tokenBuf.length !== storedBuf.length) return falseで長さチェックを行う。
try { return timingSafeEqual(tokenBuf, storedBuf) } catch { return false }で定数時間比較を実行する。
hmac.tsで既に使用されているtimingSafeEqual()との一貫性を保ち、コードベース全体のセキュリティベストプラクティス準拠を徹底する。
修正後は、既存のセッショントークン検証ロジックが正常に動作し、有効/無効トークンの判定が変わらないことを確認する。

### FR-6: コマンドログマスキング（SEC-LOG-1対応）

phase-edit-guard.jsで、コマンドログに記録する前に機密情報パターンをマスキングする処理を追加する。
現在の実装では、commandの最初の100文字をそのままログに記録しており、--password=xxx、--token=yyy等の機密情報が漏洩する。
マスキング対象パターンは、--password=xxx、--token=xxx、--api-key=xxx、API_KEY=xxx、SECRET=xxx等の一般的な機密フラグと環境変数である。
正規表現パターン/(--(password|token|api[-_]key|secret)=)\S+/giで機密フラグを検出し、$1***に置換する。
環境変数代入形式(PASSWORD=xxx、API_KEY=xxx等)も/\b([A-Z_]*(?:PASSWORD|TOKEN|KEY|SECRET)[A-Z_]*)=\S+/gパターンでマスキングする。
マスキング処理は、新設するmaskSensitiveInfo(command: string): string関数で実装し、再利用可能にする。
ログ記録箇所全てでmaskSensitiveInfo()を呼び出し、機密情報が平文でログに残らないことを保証する。
テストケースとして、bash --password=secret123 cmd形式がbash --password=*** cmdにマスキングされることを確認する。
また、通常のコマンド（ls -la、git status等）がマスキングされず正常にログに記録されることを確認する。
修正後は、.claude/state/audit-log.jsonlや.claude-phase-guard-log.json等のログファイルに機密情報が含まれないことを検証する。

## 非機能要件

### NFR-1: 後方互換性

既存のワークフロー成果物、プラグイン利用者、MCPサーバーAPIクライアントに影響を与えない修正を行う。
BUG-1のESM統一は内部実装変更であり、MCPサーバーのRPC APIインターフェースには変更がない。
BUG-2の密度計算式変更は、バリデーションロジックの改善であり、既存の成功ケースが引き続き成功することを保証する。
密度閾値の引き下げにより、以前失敗していたケースが成功する可能性はあるが、成功していたケースが失敗することはない。
BUG-3のワークフロー成果物ディレクトリ操作許可は、制限の緩和であり、既存の動作に影響しない。
セキュリティ修正(SEC-ENV-1, SEC-TIME-1, SEC-LOG-1)は、内部実装の改善であり、外部APIやユーザー体験に影響しない。
後方互換性テストとして、既存のワークフロー成果物でバリデーションが通ることを確認する。
また、既存のMCPクライアントコードがサーバー再起動後も正常に動作することを確認する。
プラグインのバージョンは変更せず、パッチレベルの修正として扱う（例: 1.2.3 -> 1.2.4）。

### NFR-2: パフォーマンス影響

修正による処理速度やメモリ使用量の増加を最小限に抑え、ワークフロー実行速度に影響しない。
BUG-2の密度計算式変更では、structuralLines数をカウントする処理が追加されるが、ループは1回のみでO(n)のまま変わらない。
SEC-TIME-1のtimingSafeEqual()は、文字列比較演算子よりわずかに遅いが、実用上の影響はない（マイクロ秒オーダー）。
SEC-LOG-1のマスキング処理は、正規表現置換であり、コマンド文字列長が通常100文字程度のため、パフォーマンス影響は無視できる。
BUG-3のワークフロー成果物ディレクトリ操作許可チェックは、正規表現テストであり、O(1)の計算量で完了する。
パフォーマンステストとして、修正前後でワークフロー1サイクルの実行時間を計測し、差が5%以内であることを確認する。

### NFR-3: メンテナンス性向上

コードの可読性、テスト容易性、将来の拡張性を考慮した設計を行う。
BUG-1のESM統一により、プロジェクト全体のモジュールシステムが一貫し、新規開発者が混乱しない。
eslintルールにno-requireを追加することで、今後のrequire()混入を自動検出し、品質を維持する。
BUG-2の密度計算式は、コード内コメントで計算ロジックと意図を説明し、将来の保守者が理解しやすくする。
密度閾値を環境変数で設定可能にすることで、プロジェクトごとのカスタマイズが容易になる。
SEC-ENV-1、SEC-LOG-1のセキュリティチェック処理は、独立した関数として実装し、テストケースを追加する。
全修正箇所に対して単体テストを追加し、カバレッジを80%以上に維持する。
修正内容をCHANGELOG.mdに記録し、将来のトラブルシューティング時に参照可能にする。

### NFR-4: セキュリティベストプラクティス準拠

OWASP、CWE等のセキュリティ標準に準拠した実装を行う。
SEC-TIME-1のタイミング攻撃対策は、OWASP Cryptographic Failures (A02:2021)のベストプラクティスに従う。
SEC-LOG-1のログマスキングは、OWASP Logging Cheat Sheetの機密情報保護ガイドラインに準拠する。
SEC-ENV-1の環境変数バイパス対策は、CWE-15: External Control of System or Configuration Settingに対応する。
セキュリティスキャンツール（npm audit、semgrep等）での警告が解消されることを確認する。
修正後、再度セキュリティスキャンを実行し、新たな脆弱性が導入されていないことを検証する。

## 受け入れ基準

### AC-1: BUG-1（ESMモジュール統一）

プロジェクト内の全require()呼び出しがimport文に置換されている。
grep -r "require(" mcp-server/src/でヒットがゼロである。
pnpm buildが成功し、dist/配下のファイルがimport/export構文を使用している。
eslint設定にno-requireルールが追加され、pnpm lintでエラーが出ない。
MCPサーバー起動後、workflow_record_test_result呼び出しでクラッシュしない。
既存のユニットテストが全て通る（pnpm testでエラーなし）。

### AC-2: BUG-2（密度計算式改善）

artifact-validator.tsのcheckSectionDensity関数が、density = substantiveCount / (totalLines - structuralLines)を使用している。
totalLines - structuralLinesがゼロ以下の場合、最小値1を使用するガード処理が実装されている。
100文字超の行を複数コンテンツ行としてカウントする処理が実装されている。
密度閾値のデフォルト値が0.2に設定されている。
環境変数ARTIFACT_DENSITY_THRESHOLDで閾値を上書きできる。
水平線を多用するMarkdown文書や長い段落を含む技術文書が適切に検証される。
既存のバリデーション成功ケースが引き続き通る（リグレッションテスト）。

### AC-3: BUG-3（ワークフロー成果物ディレクトリ操作許可）

bash-whitelist.jsの全readonlyフェーズでdocs/workflows/配下へのmkdirが許可されている。
enforce-workflow.jsのWORKFLOW_CONFIG_PATTERNSに/^docs\/workflows\//パターンが含まれている。
研究フェーズでdocs/workflows/タスク名/ディレクトリをmkdirする際、ユーザー確認が発生しない。
古いワークフロー状態ファイルの削除時にユーザー確認が発生しない。
docs/workflows/配下のファイルへのWrite/Edit操作がフェーズ制限を受けない。

### AC-4: SEC-ENV-1（環境変数バイパス検出強化）

bash-whitelist.jsでVAR=value command形式のインライン環境変数設定を検出している。
NODE_OPTIONS=--require=malicious.js node app.js形式のコマンドがブロックされる。
検出時に"Blocked: Setting security-sensitive environment variable <VAR> via inline assignment is not allowed."メッセージが表示される。
通常のNPM_CONFIG_PREFIX=/custom/path npm install等の無害な環境変数設定が誤検出されない。
既存のexportチェックとVAR=value単独チェックが引き続き動作する。

### AC-5: SEC-TIME-1（タイミング攻撃対策）

manager.tsのisSessionTokenValid()でcrypto.timingSafeEqual()を使用している。
トークン比較が定数時間で実行され、タイミング攻撃で値を推測できない。
既存のセッショントークン検証ロジックが正常に動作し、有効/無効トークンの判定が変わらない。
単体テストで有効トークン、無効トークン、長さ不一致トークンの各ケースをカバーしている。

### AC-6: SEC-LOG-1（コマンドログマスキング）

phase-edit-guard.jsでコマンドログ記録前にmaskSensitiveInfo()を呼び出している。
--password=secret123がマスキングされ--password=***となる。
API_KEY=abcd1234がマスキングされAPI_KEY=***となる。
通常のコマンド（ls -la、git status等）がマスキングされず正常にログに記録される。
.claude/state/audit-log.jsonlや.claude-phase-guard-log.json等のログファイルに機密情報が含まれない。

### AC-7: 統合テスト

修正後のプラグインで、フルワークフロー（research → completed）が正常に実行される。
ワークフロー実行中にユーザー確認が最小限に抑えられる（docs/workflows/操作で確認不要）。
セキュリティスキャン（npm audit、semgrep等）で警告が解消される。
既存のワークフロー成果物でバリデーションが通る（後方互換性）。
修正前後でワークフロー1サイクルの実行時間差が5%以内である（パフォーマンス）。
