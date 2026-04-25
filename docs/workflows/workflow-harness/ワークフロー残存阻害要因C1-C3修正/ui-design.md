# UI設計書：ワークフロー残存阻害要因C1-C3修正

## サマリー

本UI設計書は、ワークフロープラグインのCLIフックファイル改善に伴うインターフェース変更を記述している。今回の修正はバックエンドのフック実装であるが、ユーザーが直面するエラーメッセージの改善、フェーズ名表示の日本語化、MCPサーバーレスポンス変化などのユーザー体験向上が含まれる。主な変更点として、docs_updateとci_verificationフェーズでのMarkdownファイル編集が可能となり、bash-whitelist.jsのリダイレクト検出パターンが正規表現型に変更されることでアロー関数の誤検出が解消される。phase-edit-guard.jsにはregression_test、ci_verification、deployの3フェーズにjapaneseName属性が追加され、エラーメッセージの可読性が大幅に向上する。これらの変更により、ワークフロー後半でのドキュメント記録が機能し、node -eコマンドでのJavaScript実行時にアロー関数が使用可能となり、フェーズ制限エラー時のメッセージが自然な日本語表記となる。

## CLIインターフェース設計

ワークフロープラグインのCLIインターフェース変更点を以下に示す。enforce-workflow.jsの変更により、docs_updateフェーズでMarkdownファイルとMDXファイルの編集が許可されるようになり、ci_verificationフェーズでCI検証結果のMarkdown記録が可能となる。ユーザーが「/workflow next」コマンドでdocs_updateフェーズに遷移した後、docs/配下のMarkdownファイルをEditツールで編集しようとすると、以前はブロックされていたが修正後は許可される。同様に、ci_verificationフェーズでのCI結果記録も可能となるため、ワークフロー完走が実現される。bash-whitelist.jsの改善により、「node -e "arr.map(x => x + 1)"」のようなアロー関数を含むコマンドが正常に実行できるようになる。修正前は「禁止されたコマンド/パターン: > 」というエラーメッセージが表示されていたが、修正後は正規表現による否定後読みでアロー関数「=> 」を除外するため、エラーが発生しなくなる。phase-edit-guard.jsのjapaneseName属性追加により、フェーズ制限エラーメッセージに「リグレッションテスト」「CI検証」「デプロイ」などの日本語フェーズ名が表示され、ユーザーの理解が容易になる。

コマンドライン実行例として、修正前は「node -e "const fs=require('fs'); const data=[1,2,3]; const result=data.map(x => x*2); console.log(result)"」を実行すると「> 」パターンが誤検出され実行がブロックされていた。修正後はアロー関数が除外されるため、「[2,4,6]」という期待される出力が得られる。同様に、docs_updateフェーズで「echo "# CI結果" > docs/ci-result.md && /workflow next」というコマンドがブロックされていたが、修正後はMarkdownファイル編集が許可されるため正常に実行できる。ci_verificationフェーズでも「cat ci-output.log > docs/workflows/taskname/ci-verification.md」というCI結果の記録コマンドが機能するようになる。regression_testフェーズでは、フェーズルールが追加されることでテストファイルとMarkdownファイルの編集が許可され、リグレッションテスト結果の記録が可能となる。

## エラーメッセージ設計

フェーズ制限違反時のエラーメッセージが改善される。phase-edit-guard.jsに追加されるjapaneseName属性により、エラーメッセージ表示が以下のように変化する。修正前のregression_testフェーズでのエラーメッセージは「フェーズ: regression_test（regression_test）」という冗長な表示であったが、修正後は「フェーズ: regression_test（リグレッションテスト）」と自然な日本語表記になる。ci_verificationフェーズでは「フェーズ: ci_verification（ci_verification）」から「フェーズ: ci_verification（CI検証）」に改善され、deployフェーズでは「フェーズ: deploy（deploy）」から「フェーズ: deploy（デプロイ）」に変更される。これらの変更により、ユーザーがフェーズ制限エラーに遭遇した際の理解が容易になり、適切な対応を取りやすくなる。

bash-whitelist.jsのリダイレクト検出改善により、アロー関数誤検出時のエラーメッセージが表示されなくなる。修正前は「禁止されたコマンド/パターン: >  」というエラーメッセージがアロー関数を含むnode -eコマンドで表示されていたが、修正後は正規表現「/(?<!=)> /」による否定後読みでアロー関数が除外されるため、エラーメッセージ自体が表示されなくなる。これにより、開発者はアロー関数を自由に使用でき、前タスクで必要だったforループやfunction式への回避策が不要となる。enforce-workflow.jsのPHASE_EXTENSIONS追加により、docs_updateおよびci_verificationフェーズでの編集制限エラーメッセージが表示されなくなる。修正前は「ブロックされたファイル: docs/workflows/taskname/result.md」「許可される拡張子: なし」というエラーが表示されていたが、修正後はMarkdownファイル編集が許可されるためエラーが発生しない。

エラーメッセージの具体例を以下に示す。regression_testフェーズでソースコードファイルを編集しようとした場合、修正後は「フェーズ: regression_test（リグレッションテスト）」「説明: リグレッションテスト中。テストファイルと仕様書の編集が可能。」「ブロックされたファイル: src/backend/services/example.ts」「許可される拡張子: .md .test.ts .test.tsx .spec.ts .spec.tsx」と表示される。ci_verificationフェーズで実装ファイルを編集しようとした場合は「フェーズ: ci_verification（CI検証）」「説明: CI検証中。仕様書のみ編集可能。」「ブロックされたファイル: src/backend/controllers/api.ts」「許可される拡張子: .md」と表示される。deployフェーズでテストファイルを編集しようとした場合は「フェーズ: deploy（デプロイ）」「説明: デプロイ中。仕様書のみ編集可能。」「ブロックされたファイル: src/backend/tests/integration/deploy.test.ts」「許可される拡張子: .md」と表示される。

## APIレスポンス設計

MCPサーバーのレスポンスに変化が生じる箇所を以下に説明する。workflow_nextツールを使用してdocs_updateフェーズに遷移した後、EditツールでMarkdownファイルを編集しようとした際、修正前はphase-edit-guard.jsフックによりブロックされ、ツール実行が失敗していた。修正後はPHASE_RULESにdocs_updateエントリが存在し、allowedカテゴリに「spec」が含まれるため、Editツール実行が成功する。同様に、ci_verificationフェーズでのMarkdownファイル編集も成功するようになる。regression_testフェーズではPHASE_RULESにエントリが追加されることで、テストファイルとMarkdownファイルの編集が許可され、workflow_record_test_resultツールによるテスト結果記録が機能する。

Bashツールの実行レスポンスも変化する。node -eコマンドでアロー関数を含むJavaScript実行時、修正前はbash-whitelist.jsフックによりブロックされ、Bashツール実行が失敗していた。修正後は正規表現型パターンによりアロー関数が除外されるため、Bashツール実行が成功し、期待される標準出力が返される。具体的には、「node -e "console.log([1,2,3].map(x => x * 2))"」というコマンドが修正前は「exit_code: 2」「stderr: [bash-whitelist] 禁止されたコマンド/パターン: > 」というレスポンスであったが、修正後は「exit_code: 0」「stdout: [2,4,6]」というレスポンスに変化する。

workflow_statusツールのレスポンスも間接的に影響を受ける。修正前はdocs_updateフェーズでのドキュメント記録がブロックされたため、ワークフローがdocs_updateフェーズで停止し、workflow_statusツールは「phase: docs_update」「nextPhaseAvailable: false」というレスポンスを返していた。修正後はdocs_updateフェーズでの編集が許可されるため、ワークフローが次フェーズに進行し、「phase: commit」「nextPhaseAvailable: true」というレスポンスが返される。ci_verificationフェーズでも同様に、修正前は停止していたワークフローが修正後は正常に進行する。

## 設定ファイル設計

フックファイルの設定変更箇所を以下に示す。enforce-workflow.jsのPHASE_EXTENSIONSオブジェクトに2つのエントリが追加される。行75付近に「'docs_update': ['.md', '.mdx'],」エントリが挿入され、docs_updateフェーズでのMarkdownファイルとMDXファイル編集が許可される。行76付近に「'ci_verification': ['.md'],」エントリが挿入され、ci_verificationフェーズでのMarkdownファイル編集が許可される。これらのエントリは既存のPHASE_EXTENSIONSオブジェクトのスタイルに従い、シングルクォート、コロン、角括弧を使用した形式で記述される。コメントとして各エントリの後ろに「// Phase 15: Documentation update」「// Phase 17: CI verification」のような説明を付与することでコードの可読性を向上させる。

bash-whitelist.jsのBASH_BLACKLISTオブジェクトで、行90の「{ pattern: '> ', type: 'contains' }」が「{ pattern: /(?<!=)> /, type: 'regex' }」に変更される。これにより、リダイレクト演算子「> 」の検出にJavaScriptの正規表現型パターンが使用され、否定後読み「(?<!=)」によりイコール記号の直後に続く「> 」がマッチ対象から除外される。matchesBlacklistEntry関数に「case 'regex': return entry.pattern.test(command);」という1行が追加され、regex型パターンの判定ロジックが実装される。この変更により既存のcontains型、prefix型、awk-redirect型、xxd-redirect型の動作には一切影響しない。

phase-edit-guard.jsのPHASE_RULESオブジェクトに3つのエントリが追加される。行234付近のdocs_updateエントリとcommitエントリの間に、以下の形式で挿入される。「regression_test: { allowed: ['spec', 'test'], blocked: ['code', 'diagram', 'config', 'env', 'other'], description: 'リグレッションテスト中。テストファイルと仕様書の編集が可能。', japaneseName: 'リグレッションテスト', },」「ci_verification: { allowed: ['spec'], blocked: ['code', 'test', 'diagram', 'config', 'env', 'other'], description: 'CI検証中。仕様書のみ編集可能。', japaneseName: 'CI検証', },」「deploy: { allowed: ['spec'], blocked: ['code', 'test', 'diagram', 'config', 'env', 'other'], description: 'デプロイ中。仕様書のみ編集可能。', japaneseName: 'デプロイ', },」これらのエントリは既存のPHASE_RULESのスタイルに従い、インデント、カンマ、説明文の形式を統一する。

## ワークフローコマンド出力変化

ワークフロー実行時のコンソール出力に以下の変化が生じる。docs_updateフェーズに遷移後、Markdownファイルを編集しようとした際、修正前は「🚫 BLOCKED: ワークフロー違反」「現在のフェーズ: docs_update」「説明: ドキュメント更新フェーズ。仕様書のみ編集可能。」「ブロックされたファイル: docs/spec/features/example.md」「許可される拡張子: なし」と表示されていた。修正後はこのブロックメッセージが表示されず、Editツールが正常に実行され、「File edited successfully」というメッセージのみが表示される。ci_verificationフェーズでも同様に、修正前のブロックメッセージが表示されなくなる。

node -eコマンド実行時のコンソール出力変化として、修正前は「━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━」「🚫 BLOCKED: Bashコマンドがブロックされました（ホワイトリスト）」「フェーズ: testing（テスト実行）」「コマンド: node -e "arr.map(x => x + 1)"」「理由: 禁止されたコマンド/パターン: > 」と表示されていた。修正後はこのブロックメッセージが表示されず、node -eコマンドが正常に実行され、期待される標準出力が得られる。

regression_testフェーズでのエラーメッセージ表示変化として、修正前は「フェーズ: regression_test（regression_test）」という冗長な表示であったが、修正後は「フェーズ: regression_test（リグレッションテスト）」と自然な日本語表記に改善される。ci_verificationフェーズでは「フェーズ: ci_verification（ci_verification）」から「フェーズ: ci_verification（CI検証）」に変化し、deployフェーズでは「フェーズ: deploy（deploy）」から「フェーズ: deploy（デプロイ）」に変化する。これらの変化により、ユーザーがフェーズ制限エラーに遭遇した際の理解が容易になり、適切な対応を取りやすくなる。

## UI変更前後の比較

修正前後の具体的な動作変化を以下の表に示す。docs_updateフェーズでのMarkdownファイル編集について、修正前はEditツール実行時にブロックされ、「ブロックされたファイル」「許可される拡張子: なし」というエラーメッセージが表示されていた。修正後はEditツール実行が成功し、Markdownファイルの編集が可能となる。ci_verificationフェーズでのMarkdownファイル記録について、修正前は同様にブロックされていたが、修正後はCI結果のMarkdown記録が可能となる。

node -eコマンドでのアロー関数使用について、修正前は「node -e "arr.map(x => x + 1)"」というコマンドがブロックされ、「禁止されたコマンド/パターン: > 」というエラーメッセージが表示されていた。修正後はアロー関数が正常に使用でき、期待される標準出力が得られる。regression_testフェーズでのテストファイル編集について、修正前はPHASE_RULESに未定義のため全ブロックとなり、Editツール実行が失敗していた。修正後はPHASE_RULESにエントリが追加されることでテストファイルとMarkdownファイルの編集が許可される。

エラーメッセージの日本語表記について、修正前のregression_testフェーズでは「フェーズ: regression_test（regression_test）」という冗長な表示であったが、修正後は「フェーズ: regression_test（リグレッションテスト）」と自然な日本語表記になる。ci_verificationフェーズでは「ci_verification（ci_verification）」から「ci_verification（CI検証）」に改善され、deployフェーズでは「deploy（deploy）」から「deploy（デプロイ）」に変更される。これらの変更により、ユーザー体験が大幅に向上する。

## 関連ファイル

- C:\ツール\Workflow\workflow-plugin\hooks\enforce-workflow.js
- C:\ツール\Workflow\workflow-plugin\hooks\bash-whitelist.js
- C:\ツール\Workflow\workflow-plugin\hooks\phase-edit-guard.js
- C:\ツール\Workflow\docs\workflows\ワ-クフロ-残存阻害要因C1-C3修正\requirements.md
- C:\ツール\Workflow\docs\workflows\ワ-クフロ-残存阻害要因C1-C3修正\spec.md

## 変更履歴

| 日付 | バージョン | 変更内容 | 変更者 |
|------|-----------|---------|--------|
| 2026-02-09 | 1.0 | 初版作成 | Claude Sonnet 4.5 |
