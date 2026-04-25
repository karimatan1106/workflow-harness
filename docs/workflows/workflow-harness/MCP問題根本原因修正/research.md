# MCP問題根本原因修正 - 調査結果

## サマリー

MCPサーバーとワークフロープラグインで発生した4つの問題の根本原因を調査した。
問題1はtest-authenticity.tsでrequire('crypto')がESMコンテキストで使用されていたことが原因である。
プロジェクトはpackage.jsonでtype: "module"、tsconfig.jsonでmodule: "ESNext"と設定されており、require()は使用禁止である。
問題2はartifact-validator.tsの密度計算で水平線が総行数を膨張させ、長い段落が1行としかカウントされない設計問題である。
問題3はワークフロー実行中にClaude Codeがユーザーにファイル/ディレクトリ削除の許可を求める問題で、enforce-workflow.jsの設定とClaude Codeの権限制御が原因である。
問題4はセキュリティスキャンで検出された3件の低優先度課題で、環境変数バイパス、タイミング攻撃、ログ機密情報漏洩に関する問題である。
全6件の修正を行い、ワークフロープラグインの品質と利便性を向上させる。

## 調査結果

本調査では4つの問題の根本原因を特定し、それぞれの修正方針を策定した。
問題1はESMモジュールシステムとCommonJS requireの不整合が原因のランタイムエラーである。
問題2は成果物バリデーションの密度計算ロジックの設計欠陥で、構造行が分母に含まれることが問題である。
問題3はbash-whitelist.jsとenforce-workflow.jsの設定不足により、ワークフロー成果物操作がブロックされる問題である。
問題4はセキュリティスキャンで検出された環境変数バイパス、タイミング攻撃、ログ機密情報漏洩の3件である。
全ての問題について該当コードの行番号と具体的な修正方針を特定済みである。

## 既存実装の分析

workflow-pluginは19フェーズのワークフローをMCPサーバーとhookシステムで制御する構成である。
MCPサーバー（mcp-server/src/）はTypeScript + ESMで記述され、tsconfig.jsonでmodule: "ESNext"と設定されている。
hookシステム（hooks/）はプレーンJavaScriptで記述され、Claude CodeのPreToolUse/PostToolUseイベントで実行される。
enforce-workflow.jsはファイル編集のフェーズ制限を担当し、WORKFLOW_CONFIG_PATTERNSで制限対象外のパスを定義する。
bash-whitelist.jsはBashコマンドのフェーズ別ホワイトリストを提供し、readonlyフェーズではmkdirが含まれていない。
artifact-validator.tsはcheckSectionDensity関数で成果物の密度を検証するが、密度計算式にstructuralLinesが考慮されていない。
manager.tsのisSessionTokenValid関数はtoken !== storedTokenの文字列比較を使用しておりタイミング攻撃に脆弱である。

## 問題1: workflow_record_test_resultのESMエラー

### 根本原因

test-authenticity.tsの関数内部でrequire('crypto')を使用していたことがESMコンテキストでクラッシュの原因となった。
プロジェクト設定はpackage.jsonでtype: "module"、tsconfig.jsonでmodule: "ESNext"であり、CommonJSのrequireは使用禁止である。
MCPサーバーはNode.jsプロセスとして動作し、一度読み込んだモジュールをメモリにキャッシュするため、dist/*.jsの修正は再起動まで反映されない。
ソースファイル（.ts）の修正は完了しているが、distへのビルドとサーバー再起動が必要である。
validation配下の他のファイルにもrequire()が残存している可能性がある。

### 修正方針

プロジェクト全体でrequire()パターンを検索し、全てimport文に変換する。
MCPサーバーのビルドプロセスを確認し、ESMとして正しく出力されることを検証する。

## 問題2: 成果物バリデーション密度チェックの設計問題

### 根本原因

artifact-validator.tsのcheckSectionDensity関数で密度をsubstantiveCount / totalLinesで計算している。
水平線(---)はisStructuralLine()で構造行と判定されるが、総行数にはカウントされるため密度を下げる。
長い1行段落（200文字超）も1コンテンツ行としかカウントされず、実質的な情報量が反映されない。
密度閾値のデフォルト値0.3（30%）は、Markdown文書の一般的な構造を考慮すると厳しすぎる。
この設計により、内容が十分でも形式的な理由でバリデーションが失敗する。

### 修正方針

密度計算式をsubstantiveCount / (totalLines - structuralLines)に変更し、構造行を分母から除外する。
100文字超の長い行を複数コンテンツ行としてカウントするオプションを追加する。
密度閾値を0.2に引き下げることを検討する。

## 問題3: ワークフロー実行中のファイル/ディレクトリ削除要求

### 根本原因

Claude Codeのhookシステムはsettings.jsonで定義され、ALWAYS_ALLOWED_PATTERNSに含まれるファイルのみ自動許可される。
ワークフロー成果物ディレクトリ(docs/workflows/*)やworkflow-state.jsonはALWAYS_ALLOWEDに含まれているが、ディレクトリのmkdir操作やrm操作は別のホワイトリスト制御にある。
bash-whitelist.jsのresearchフェーズではmkdir操作が許可されていないため、フォルダ作成でユーザー確認が必要になる。
また古いワークフロー状態ファイルの削除時にもユーザー確認が発生する。
enforce-workflow.jsのWORKFLOW_CONFIG_PATTERNSがワークフロー関連ファイルの自動許可対象を定義しているが、docsディレクトリは含まれていない。

### 修正方針

bash-whitelist.jsの各フェーズでワークフロー成果物ディレクトリへのmkdir操作を許可する。
enforce-workflow.jsのWORKFLOW_CONFIG_PATTERNSにdocs/workflows/パターンを追加する。
ワークフロー成果物の書き込み操作（Write/Edit）がフェーズ制限を受けないよう設定する。

## 問題4: セキュリティ低優先度課題3件

### SEC-ENV-1: シェル構文でのSECURITY_ENV_VARSバイパス

bash-whitelist.jsでexport VAR=valueとVAR=value単独形式のみチェックしている。
VAR=value command形式のインライン環境変数設定は検出されない。
SECURITY_ENV_VARSにはNODE_OPTIONS、LD_PRELOAD等の危険な環境変数が含まれる。
攻撃者がNODE_OPTIONS=--require=malicious.js node target.jsのような形式でバイパスできる。
修正方針はインライン代入形式の正規表現検出を追加すること。

### SEC-TIME-1: トークン比較が定数時間でない

manager.tsのisSessionTokenValid()でセッショントークン比較に!==演算子を使用している。
文字列比較演算子は一致しない最初の文字で早期リターンするため、タイミング攻撃に脆弱である。
hmac.tsでは既にcrypto.timingSafeEqual()を使用しており、統一性が欠けている。
実践的リスクは低いが、セキュリティベストプラクティスに従い修正すべきである。
修正方針はisSessionTokenValid()内の比較をcrypto.timingSafeEqual()に変更すること。

### SEC-LOG-1: コマンドログに機密情報が残る

phase-edit-guard.jsでコマンドの最初の100文字をログに記録している。
コマンドに--password=xxx、APIキー、トークン等が含まれる場合に機密情報が漏洩する。
ログファイルはプレーンテキストで保存されており、パーミッション制御が不十分である。
修正方針はログ記録前に機密パターンをマスキングする処理を追加すること。
具体的には--password=xxx、--token=xxx、API_KEY=xxx等のパターンを***に置換する。

## 次フェーズへの引き継ぎ情報

requirementsフェーズでは以下の要件を定義する必要がある。
ESMモジュール統一要件として、require()の完全排除とビルド検証を定義する。
密度チェック改善要件として、計算式変更と閾値調整を定義する。
ファイル管理改善要件として、bash-whitelist.jsとenforce-workflow.jsの設定変更を定義する。
セキュリティ改善要件として、3件の脆弱性修正を定義する。
