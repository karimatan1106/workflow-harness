## サマリー

artifact-validatorテーブル行除外タスクで発生した6件の問題とユーザー追加指摘1件の根本原因を調査した。
全7件の問題を分析した結果、コード修正が必要なものは3件、CLAUDE.md修正で対応するものは4件と判明した。
subagentへのコマンド制限伝達、必須セクション名の事前通知、ベースライン記録の確実化が主な対策である。
odコマンド繰り返しブロック問題はsubagentがホワイトリストを知らないことが原因であり、promptへの制限明記で解決する。

- 目的: ワークフロー実行中に発生した7件の問題の根本原因特定と修正方針決定
- 主要な決定事項: コード修正3件（record-test-result.ts、CLAUDE.md、bash-whitelist.js）、ドキュメント修正4件
- 次フェーズで必要な情報: 各問題の修正ファイルと具体的な変更内容

## 調査結果

7件の問題を調査した結果、全て根本原因の特定に成功した。
コード修正が必要なのはrecord-test-result.tsのテスト結果パーサー改善の1件のみである。
残り6件はCLAUDE.mdのsubagent起動テンプレート修正で対応可能であり、ホワイトリスト変更は不要と判断した。
subagentが禁止コマンドを繰り返す問題は、promptに許可コマンド一覧を明記することで根本的に解決できる。
必須セクション名の事前通知とベースライン記録の義務化により、フェーズ間の手戻りを防止する。
MCPモジュールキャッシュはNode.js仕様のため、成果物を旧バリデーター互換で書く運用ルールを追加する。

## 既存実装の分析

bash-whitelist.jsは3つのカテゴリ（readonly, testing, implementation）でコマンドを管理している。
readonlyリストにはls, cat, head, tail, grep, git status等の読み取り専用コマンド18種が定義されている。
testingリストにはnpm test, npx vitest, npx jest等のテスト実行コマンド11種が定義されている。
implementationリストにはnpm install, npm run build, mkdir等のビルド・セットアップコマンド11種が定義されている。
artifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSは全フェーズの必須セクションを厳密に定義している。
record-test-result.tsは5種類のテストフレームワークパターンと4種類のテスト件数抽出パターンを持つ。
test-tracking.tsはresearchとtestingの2フェーズでのみベースライン記録を許可している。

## 問題1: subagentディレクトリ名不一致（全角ー vs 半角-）

sanitizeTaskName()関数がタスク名中の長音記号（ー）を半角ハイフン（-）に正規化してdocsDirを生成する。
MCPサーバーはdocsDirを正しく「artifact-validatorテ-ブル行除外」として返している。
しかしsubagentはOrchestratorから受け取ったタスク名を使って独自にパスを構築し、全角のまま使用した。
根本原因はsubagent promptにdocsDirの正確なパスが埋め込まれていないことである。
修正方針はCLAUDE.mdのsubagent起動テンプレートでdocsDirをMCPサーバー返却値から取得して明示的に渡すこと。

## 問題2: cpコマンドがphase-edit-guardでブロック

bash-whitelist.jsのreadonlyリストにcpコマンドが含まれていないことが直接原因である。
parallel_verificationフェーズではreadonly+testingリストのコマンドのみ許可される。
readonlyリストはls, cat, head, tail, grep, git status等の読み取り専用コマンドで構成される。
cpは読み取り専用ではなくファイル複製操作であるため、意図的にホワイトリストから除外されている。
根本原因はsubagentがcpを使おうとしたことであり、Read/Writeツールで代替すべきだった。
修正方針はCLAUDE.mdのsubagent promptに「cpの代わりにRead/Writeツールを使用」と明記すること。

## 問題3: 成果物の必須セクション名が事前に不明

artifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSで各フェーズの必須セクションが定義されている。
manual-test.mdは「テストシナリオ」「テスト結果」の2セクションが必須である。
security-scan.mdは「脆弱性スキャン結果」「検出された問題」の2セクションが必須である。
performance-test.mdは「パフォーマンス計測結果」「ボトルネック分析」の2セクションが必須である。
e2e-test.mdは「E2Eテストシナリオ」「テスト実行結果」の2セクションが必須である。
根本原因はこれらの必須セクション名がCLAUDE.mdのsubagent promptに明記されていないことである。
修正方針はCLAUDE.mdの各フェーズ成果物説明に必須セクション名を追記すること。

## 問題4: regression_testフェーズからベースライン設定不可

test-tracking.tsのworkflowCaptureBaseline()はresearchとtestingフェーズでのみ実行可能と定義されている。
testingフェーズでの記録は遅延ベースラインとして警告付きで許可されている。
regression_testフェーズでの記録は設計上意図的に禁止されており、これは正しい仕様である。
根本原因はresearchフェーズでベースラインを記録しなかったことにある。
修正方針はCLAUDE.mdの厳命ルールにresearchフェーズでのベースライン記録義務を追加すること。

## 問題5: テスト結果のパース失敗

record-test-result.tsのパーサーはvitest/jest形式の特定パターンのみを認識する。
認識パターンはTests: N passed、N tests passed、PASS ./file.test.ts等の5種類である。
テスト件数抽出はTests: N passed形式とN passed形式の4パターンで行われる。
出力は50文字以上でなければならず、テストフレームワーク構造パターンを含む必要がある。
根本原因はパーサーが認識するフォーマットが限定的で、カスタム形式の出力を処理できないことである。
修正方針はrecord-test-result.tsのパーサーにsummaryフィールドによるフォールバックを追加すること。

## 問題6: MCPモジュールキャッシュで変更未反映

Node.jsのrequire()はモジュールをグローバルキャッシュに保存し、同一プロセス内で再読み込みしない。
MCPサーバーが起動時に読み込んだartifact-validator.tsのコンパイル結果は、プロセス終了まで変更不可である。
ディスク上のdist/*.jsファイルを変更しても実行中のサーバーには一切反映されない。
これはNode.jsの基本仕様であり、コード修正で解決することはできない。
修正方針はCLAUDE.mdにMCPサーバー再起動の必要性を明記し、成果物はサーバー起動時のバリデーター互換で書くこと。

## 問題7（追加）: subagentがodコマンドを繰り返し実行しブロックされる

subagentがファイルのバイナリ内容を確認するためにod -cコマンドを使用しようとした。
odコマンドはbash-whitelist.jsのいずれのリストにも含まれていない。
phase-edit-guardがブロックしエラーメッセージを返すが、subagentは代替手段を見つけられず繰り返し試行した。
根本原因はsubagentがホワイトリストの内容を知らないため、許可されないコマンドを繰り返し試みることである。
hooksのエラーメッセージはsubagentに伝わるが、具体的な代替手段の提案がないため同じ操作を繰り返す。
修正方針はCLAUDE.mdのsubagent promptに許可コマンド一覧と禁止コマンドの代替手段を明記すること。

## 修正分類

コード修正が必要な問題はrecord-test-result.tsのテスト結果パーサー改善（問題5）の1件のみである。
CLAUDE.md修正で対応する問題は6件あり、subagent promptへのdocsDir明示的埋め込み（問題1）が最重要と判断した。
cpコマンドの代替手段指示（問題2）とodコマンドの代替手段指示（問題7）は同一箇所で対応可能である。
必須セクション名の事前明記（問題3）はsubagent起動テンプレートのフェーズ別指示セクションに追記する方針である。
ベースライン記録の義務化（問題4）はCLAUDE.mdのAIへの厳命セクションに新規ルール20番として追加する。
MCPサーバーキャッシュの注意事項（問題6）は成果物品質ガイドとして新規セクションを追記する方針である。
bash-whitelist.jsへのcpやodコマンド追加は行わず、subagentへの代替手段周知で根本対応する。
