# ワークフロー実行時バグ修正 - テスト設計書

## サマリー

本ドキュメントは、ワークフロープラグイン（`workflow-plugin/`）のランタイム動作に関する4つのバグ修正（FQ-1〜FQ-4）のテスト設計を定義します。

- 目的: 各バグ修正が仕様通りに機能し、後方互換性を維持したまま既存の動作を破壊しないことを検証する
- 主要な決定事項: 静的コード検査・Node.js単体テスト・手動動作確認の3層で網羅し、MCPサーバー再起動後の統合検証まで含む
- 次フェーズで必要な情報: テスト実装（test_implフェーズ）では `next.ts`、`bash-whitelist.js`、`definitions.ts` の3ファイルを対象とし、それぞれに対応するテストファイルを作成する

修正対象は `workflow-plugin/mcp-server/src/tools/next.ts`（FQ-1）、`workflow-plugin/hooks/bash-whitelist.js`（FQ-2）、`workflow-plugin/mcp-server/src/phases/definitions.ts`（FQ-3・FQ-4）の3ファイル・4箇所です。テスト設計の基本方針は「最小変更の精密な検証」であり、修正対象箇所のみを精密に検証し、それ以外の動作が変化しないことを回帰テストで確認します。修正優先度は spec.md の定義に従い、FQ-1が最高（毎回のtestingフェーズ遷移をブロックする致命的な問題）、次いでFQ-3（subagentへの誤情報伝達）、FQ-4（ブランチ名誤指定）、FQ-2（比較演算子の誤検出）の順です。

---

## テスト背景

### プロジェクトの位置づけとランタイムバグの概要

本プロジェクトはワークフロープラグイン（`workflow-plugin/`）のランタイム動作を改善するバグ修正タスクです。ワークフロープラグインはClaude CodeのAIエージェントがタスクを段階的に実行するための基盤を提供します。発見されたバグはいずれもワークフロー実行中にフェーズ遷移や外部コマンド制御が正しく機能しない問題であり、日常的なワークフロー運用に直接影響を与えます。

requirements.mdの要件定義から引き継ぐ形で、本仕様書（spec.md）は各バグの根本原因に基づく最小限の変更を規定しています。テスト設計はその仕様内容を網羅的に検証するものとして、4つのバグすべての根本原因・再現条件・修正方針を把握した上で設計されています。

### バグ別の根本原因まとめ

FQ-1の根本原因は `next.ts` のtestingフェーズ検証ブロック（line 267-276）にあります。`workflow_record_test_result` がハッシュを `testOutputHashes` 配列に追加した直後に `workflow_next` が同じ配列を参照してハッシュ重複ロジックを実行するため、記録したばかりのハッシュを自己参照で比較し「以前と同一のテスト出力」と誤判定してフェーズブロックが生じます。なお `regression_test` フェーズでは既に同じ問題が認識されており、スキップロジックとしてハッシュチェックブロック全体が除外される条件が実装済みです。testingフェーズに対して同様の条件追加を行うことで解決できます。

FQ-2の根本原因は `bash-whitelist.js` の `hasRedirection` 関数（line 268-270）が `>` の前後の文字を確認せずにシンプルな部分文字列検索を行うことにあります。`>=` 演算子（以上を意味する比較演算子）を含む文字列でも `>` が存在するとtrueを返し、`awk ... >= ...` を含むシェルコマンドが誤ってリダイレクトを含むと判定されてブロックされるリスクが生じます。BASH_BLACKLISTの `regex` タイプエントリには `>=` を除外するパターンがすでに用意されていますが、`hasRedirection` 関数がこの洗練されたリダイレクトパターンを使用せず単純な部分文字列検索を使っているという一貫性の問題もあります。

FQ-3の根本原因は `definitions.ts` のcommitフェーズ（line 942）およびpushフェーズ（line 950）の `allowedBashCategories` が `['readonly', 'implementation']` と設定されていることにあります。`implementation` カテゴリには `npm install`, `npm run build`, `mkdir`, `rm` などが含まれており、commit/pushフェーズでは不適切なコマンド制限となっています。CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」セクションには commit/push フェーズが `readonly, git` と明記されており、`bash-whitelist.js` の `getWhitelistForPhase` 関数内の `gitPhases` 配列を参照するロジックも正しく `readonly + git` を返す構成になっているため、実装と定義の間に齟齬が生じています。

FQ-4の根本原因は `definitions.ts` のpushフェーズの `subagentTemplate`（line 953）に「リモートリポジトリにプッシュしてください」という指示のみが含まれており、subagentがどのブランチにpushするかを自律的に選択しなければならない点にあります。環境によってデフォルトブランチが `master` か `main` か異なる場合があり、サブモジュールを含むリポジトリでは親リポジトリとサブモジュールのブランチ名が独立して管理されています。

### 修正方針の基本原則とテストへの影響

spec.mdの「修正方針の基本原則」に従い、各修正は既存の動作を壊さない最小限の変更に留めています。後方互換性を維持しながら、ドキュメント・フック・フェーズ定義の三者の整合性が保たれることを確認します。この方針はテスト設計において「非機能要件テスト」として明示的に設計されています。コアモジュール（next.ts、definitions.ts）を変更した後はMCPサーバーの再起動が必要であり、フックキャッシュのリフレッシュもテスト工程に含まれます。

---

## テスト方針

### テストアプローチと技術的制約

修正対象3ファイルは本番環境のMCPサーバーとフックシステムに組み込まれているため、完全な結合テストの自動化は困難です。そのため本テスト設計では以下の3層構造を採用します。

静的コード検査として、修正後のファイル内容を直接読み込んで期待する文字列・構造が存在するかを確認します。この手法はMCPサーバー再起動前でも実施できるため、最初の検証として有効です。次にNode.js単体テストとして、`bash-whitelist.js`（FQ-2）の `hasRedirection` 関数は独立した関数ロジックであるため、Node.jsスクリプトを使った単体テストが実施可能です。最後に手動動作確認として、実際のワークフロー実行環境で各バグの修正が有効であることをセッション内で検証します。

`definitions.ts`（FQ-3・FQ-4）については、ファイル内容の静的検査で修正の有無を確認し、subagentプロンプトへの反映は手動で検証します。`next.ts`（FQ-1）については、ハッシュチェック条件分岐の静的検査とワークフロー実行時の動作確認を組み合わせます。

### テスト優先度の設定基準

FQ-1（testingフェーズのハッシュチェック）は毎回のtestingフェーズ遷移をブロックする致命的な問題であるため、最優先でテストを実施します。フェーズブロックが発生すると `workflow_record_test_result` を呼んだ直後に `workflow_next` が失敗し、ワークフロー全体が停止するため影響が甚大です。FQ-3（allowedBashCategories修正）はsubagentへの誤情報伝達を防ぐために重要性が高く、ドキュメント・フック・フェーズ定義の三者の整合性を静的に検証します。FQ-4（ブランチ確認手順追加）はpushフェーズの安全性に直結するため、subagentTemplateの内容の静的検査を確実に実施します。FQ-2（hasRedirection誤検出修正）は独立した関数レベルのバグであり、Node.jsによる単体テストで網羅的に検証します。

### 依存関係とビルドセッション効率化

spec.mdの「依存関係と制約」セクションに記載の通り、FQ-3とFQ-4は同じ `definitions.ts` への変更であるため、同一ビルドセッション内で連続して修正することを推奨します。その後一度だけ `npm run build` とMCPサーバー再起動を実施することで、2回分の再起動コストを1回に圧縮できます。テスト工程においても、FQ-3とFQ-4の静的コード検査はビルド前に実施し、手動動作確認はビルド後（MCPサーバー再起動後）に実施する設計とします。FQ-2（bash-whitelist.js）の変更はフック側への変更であり、Claude Codeのセッション再起動によってフックキャッシュがリフレッシュされます。

---

## テストケース

### TC-FQ1-01: testingフェーズでのハッシュチェックスキップ（正常系）

**検証目的:** testingフェーズでのみハッシュチェックがスキップされることを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/tools/next.ts`（line 267-275周辺）

**検証方法:** 静的コード検査

修正後のファイルにおいて、ハッシュ重複チェックブロックが以下の条件分岐で保護されていることを確認します。期待する文字列パターンとして `currentPhase !== 'regression_test' && currentPhase !== 'testing'` が if 文の条件として存在することを検査します。この条件分岐の内側に `recordTestOutputHash` 呼び出しと `hashResult.valid` チェックが含まれていることも確認します。spec.mdのFQ-1セクションで示された「変更後」コードブロックと実装内容が一致することが検証の核心です。

**合否基準:** 上記のコード構造が `next.ts` に存在すれば合格、存在しなければ実装修正が必要

---

### TC-FQ1-02: regression_testフェーズでの既存スキップロジック継続確認（正常系）

**検証目的:** regression_testフェーズの既存スキップロジックが引き続き機能することを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/tools/next.ts`

**検証方法:** 静的コード検査

条件分岐の中に `regression_test` が引き続き含まれていることを確認します。FQ-1修正によって `regression_test` の既存スキップ条件が削除されていないこと、かつ `testing` が新たに追加されていることを検査します。spec.mdの「FQ-1修正後: regression_testフェーズには既存のスキップロジックが引き続き適用されることを確認します」という受入基準を満たすことが必要です。

**合否基準:** `regression_test` と `testing` の両方がスキップ条件として存在すれば合格

---

### TC-FQ1-03: testingフェーズ以外でのハッシュ重複検出有効継続確認（回帰テスト）

**検証目的:** implementationなど他のフェーズではハッシュ重複検出が引き続き機能することを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/tools/next.ts`

**検証方法:** 静的コード検査とコードレビュー

条件分岐の形が `if (currentPhase !== 'regression_test' && currentPhase !== 'testing')` であることを確認します。この形式であれば `implementation` フェーズや `parallel_quality` フェーズ等ではハッシュチェックが実行されます。`testing` や `regression_test` だけ丸ごとブロックを消去するような変更になっていないことを検査します。spec.mdの「後方互換性の維持」（NF-1）に対応するテストです。

**合否基準:** スキップ対象が `testing` と `regression_test` の2フェーズのみであれば合格

---

### TC-FQ1-04: test-authenticityバリデーション変更なし確認（回帰テスト）

**検証目的:** FQ-1修正がtest-authenticityバリデーション（line 251-265）に影響していないことを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/tools/next.ts`（line 251-265周辺）

**検証方法:** 静的コード検査

spec.mdには「test-authenticityバリデーション（line 251-265）は変更されず、タイムスタンプベースの真正性検証が継続します」と記載されています。この検証ブロックがFQ-1の修正対象である line 267-275のハッシュ重複チェックとは独立して存在していることを確認します。ハッシュの記録処理（`record_test_result.ts`）が変更されていないことも確認します。

**合否基準:** test-authenticityバリデーションブロックが変更前と同一構造であれば合格

---

### TC-FQ1-05: testingフェーズでの workflow_next 実行成功確認（手動動作確認）

**検証目的:** testingフェーズで record_test_result を呼んだ直後に workflow_next が成功することを確認する

**対象環境:** MCPサーバー再起動後のワークフロー実行環境

**検証方法:** ワークフロー実行環境での手動確認

テスト用のワークフロータスクをtestingフェーズまで進め、`workflow_record_test_result` を1回呼び出します。直後に `workflow_next` を呼び出し、フェーズブロックが発生せずに次のフェーズへ遷移することを確認します。この操作が「testingフェーズで `workflow_record_test_result` を呼んだ直後に `workflow_next` を呼ぶ」という再現条件を再現していることを意識して実施します。MCPサーバー再起動（npm run buildを含む4ステップ）完了後に実施します。

**合否基準:** `workflow_next` の応答が success 状態であり、フェーズが `regression_test` または次フェーズに遷移すれば合格

---

### TC-FQ2-01: 比較演算子 >= を含むコマンドの誤検出排除（正常系）

**検証目的:** `>=` を含むシェルコマンドがリダイレクトとして誤検出されないことを確認する

**対象ファイル:** `workflow-plugin/hooks/bash-whitelist.js`（hasRedirection関数）

**検証方法:** Node.js単体テスト

修正後の `hasRedirection` 関数を以下のテストデータで検証します。テスト入力1として `"awk 'NR >= 2' file.txt"` に対して `hasRedirection` の戻り値が `false` であることを確認します。テスト入力2として `"node -e \"if (a >= 0) console.log(a)\""` に対して戻り値が `false` であることを確認します。awk-redirectタイプのブラックリストチェックで使用されるこの関数が、比較演算子を含むコマンドを誤ってブロックしないことが検証の核心です。

**合否基準:** 上記全ての入力に対して `false` が返れば合格

---

### TC-FQ2-02: 単純リダイレクト > の正常検出継続確認（正常系）

**検証目的:** `>` によるリダイレクトが引き続き正しく検出されることを確認する

**対象ファイル:** `workflow-plugin/hooks/bash-whitelist.js`（hasRedirection関数）

**検証方法:** Node.js単体テスト

修正後の `hasRedirection` 関数を以下の入力で検証します。テスト入力1として `"echo hello > output.txt"` に対して戻り値が `true` であることを確認します。テスト入力2として `"ls > /dev/null"` に対して戻り値が `true` であることを確認します。spec.mdの「受入基準」である「`echo hello > output.txt` はリダイレクトとして正しく検出されることを確認します」に対応するテストです。正規表現 `/(?<!=)>(?!=)/` によって `>` の前後にスペースが存在するパターンが正しくリダイレクトとして検出されることを確認します。

**合否基準:** 上記全ての入力に対して `true` が返れば合格

---

### TC-FQ2-03: 追記リダイレクト >> の正常検出継続確認（正常系）

**検証目的:** `>>` による追記リダイレクトが引き続き正しく検出されることを確認する

**対象ファイル:** `workflow-plugin/hooks/bash-whitelist.js`（hasRedirection関数）

**検証方法:** Node.js単体テスト

修正後の `hasRedirection` 関数を以下の入力で検証します。テスト入力1として `"echo test >> log.txt"` に対して戻り値が `true` であることを確認します。テスト入力2として `"cat results >> output.log"` に対して戻り値が `true` であることを確認します。`>>` パターンは `includes('>>')` による先行チェックで確実に捕捉されることを確認します。spec.mdの「正規表現の詳細解説」セクションで「`cat file >> log.txt` の `>>` は先に行われる `includes('>>')` チェックで検出されるため、正規表現チェックに到達する前に確実に捕捉されます」と記載された仕様に対応します。

**合否基準:** 上記全ての入力に対して `true` が返れば合格

---

### TC-FQ2-04: アロー演算子 => の誤検出排除（正常系）

**検証目的:** JavaScriptの `=>` アロー演算子がリダイレクトとして誤検出されないことを確認する

**対象ファイル:** `workflow-plugin/hooks/bash-whitelist.js`（hasRedirection関数）

**検証方法:** Node.js単体テスト

テスト入力として `"node -e \"const f = x => x + 1\""` に対して `hasRedirection` の戻り値が `false` であることを確認します。正規表現の否定後読み `(?<!=)` によって `=>` の `>` が除外されることを確認します。spec.mdの「正規表現の詳細解説」で示された「否定後読み `(?<!=)` は `>` の直前が `=` でないことを確認し、`=>` 記号を除外します」という仕様を検証します。

**合否基準:** 上記入力に対して `false` が返れば合格

---

### TC-FQ2-05: 正規表現パターン `/(?<!=)>(?!=)/` の静的存在確認（回帰テスト）

**検証目的:** `hasRedirection` 関数の実装が仕様の正規表現を使用していることを確認する

**対象ファイル:** `workflow-plugin/hooks/bash-whitelist.js`

**検証方法:** 静的コード検査

修正後のファイルに `(?<!=)>(?!=)` というパターンが含まれていることを確認します。`includes('>')` の単純検索形式が `hasRedirection` 関数内に残存していないことを確認します。`includes('>>')` は先行チェックとして残っていることを確認します（追記リダイレクト検出のため）。spec.mdの「変更後」コードブロックに示された実装と一致することを検査します。

**合否基準:** 正規表現パターンが存在し、単純な `includes('>')` が `hasRedirection` 内に存在しなければ合格

---

### TC-FQ2-06: hasRedirection関数とBASH_BLACKLIST正規表現タイプの一貫性確認（回帰テスト）

**検証目的:** hasRedirection関数とBASH_BLACKLISTの `regex` タイプエントリが `>=` を同様に除外することを確認する

**対象ファイル:** `workflow-plugin/hooks/bash-whitelist.js`

**検証方法:** 静的コード検査とクロスチェック

spec.mdには「BASH_BLACKLISTの `regex` タイプエントリには `>=` を除外するパターンがすでに用意されているが、`hasRedirection` 関数はこの洗練されたリダイレクトパターンを使用せず単純な部分文字列検索を使っているという一貫性の問題もあります」と記載されています。修正後はこの一貫性が解決されており、`hasRedirection` 関数も `>=` を正しく除外することを確認します。

**合否基準:** hasRedirection関数がBASH_BLACKLISTのregexタイプエントリと同様に `>=` を除外できれば合格

---

### TC-FQ3-01: commitフェーズの allowedBashCategories が readonly と git であることの確認（正常系）

**検証目的:** commitフェーズの `allowedBashCategories` が `['readonly', 'git']` であることを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（line 942周辺）

**検証方法:** 静的コード検査

修正後のファイルにおいて、commitフェーズの定義部分に `allowedBashCategories: ['readonly', 'git']` が存在することを確認します。修正前の `['readonly', 'implementation']` という記述が commitフェーズに残存していないことを確認します。spec.mdの「変更箇所1はcommitフェーズのline 942で、`allowedBashCategories` を以下のように変更します」という仕様に対応する検証です。

**合否基準:** commitフェーズの `allowedBashCategories` が `['readonly', 'git']` であれば合格

---

### TC-FQ3-02: pushフェーズの allowedBashCategories が readonly と git であることの確認（正常系）

**検証目的:** pushフェーズの `allowedBashCategories` が `['readonly', 'git']` であることを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（line 950周辺）

**検証方法:** 静的コード検査

修正後のファイルにおいて、pushフェーズの定義部分に `allowedBashCategories: ['readonly', 'git']` が存在することを確認します。commitフェーズとpushフェーズの両方で `git` カテゴリが設定されていることを確認します。`git` カテゴリには `git add`, `git commit`, `git push`, `git pull`, `git fetch` が含まれており、commit/pushフェーズの作業に必要なコマンドが網羅されていることも確認します。

**合否基準:** pushフェーズの `allowedBashCategories` が `['readonly', 'git']` であれば合格

---

### TC-FQ3-03: implementationフェーズなど他フェーズの allowedBashCategories 不変確認（回帰テスト）

**検証目的:** commit/push 以外のフェーズの `allowedBashCategories` が変更されていないことを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`

**検証方法:** 静的コード検査

FQ-3の修正対象外であるフェーズの `allowedBashCategories` が仕様通りの値を保持していることを確認します。特に `implementation` フェーズが `['readonly', 'testing', 'implementation']` を保持していることを確認します。`testing` フェーズが `['readonly', 'testing']` を保持していることを確認します。spec.mdの非機能要件NF-1「後方互換性の維持」に基づく回帰テストです。

**合否基準:** 修正対象外フェーズの `allowedBashCategories` が spec.md および CLAUDE.md の定義と一致すれば合格

---

### TC-FQ3-04: ドキュメント・フック・フェーズ定義の三者整合性確認（手動確認）

**検証目的:** CLAUDE.md・bash-whitelist.js・definitions.ts の三者が同じ値を示すことを確認する

**対象リソース:** CLAUDE.md、`workflow-plugin/hooks/bash-whitelist.js`、`workflow-plugin/mcp-server/src/phases/definitions.ts`

**検証方法:** クロスチェックによる静的確認

CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」セクションで commit/push が `readonly, git` と記載されていることを確認します。`bash-whitelist.js` の `gitPhases` 配列に `commit` と `push` が含まれており `readonly + git` を返すことを確認します。`definitions.ts` の commit/push フェーズが `['readonly', 'git']` を持つことを確認します。spec.mdの「コードの整合性」（NF-2）に対応する検証であり、三者の構成が同じ情報を持つ状態を維持することを確認します。

**合否基準:** 三者の記述が全て一致すれば合格

---

### TC-FQ4-01: pushフェーズ subagentTemplate への git branch --show-current 手順存在確認（正常系）

**検証目的:** pushフェーズの `subagentTemplate` に `git branch --show-current` によるブランチ確認手順が含まれることを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（line 953周辺）

**検証方法:** 静的コード検査

pushフェーズの `subagentTemplate` フィールドに `git branch --show-current` という文字列が含まれていることを確認します。また代替コマンドとして `git rev-parse --abbrev-ref HEAD` の記述も含まれていることを確認します。spec.mdの「requirements.mdのFQ-4セクションで定義された修正要件として、`git branch --show-current` または `git rev-parse --abbrev-ref HEAD` でカレントブランチ名を確認する手順を明示的に追加することが求められています」という要件に対応します。

**合否基準:** 両コマンドのいずれかが subagentTemplate に存在すれば合格

---

### TC-FQ4-02: detached HEAD 状態の検出とpush中止手順の存在確認（正常系）

**検証目的:** subagentTemplate にdetached HEAD状態の検出とpush中止の手順が含まれることを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（subagentTemplate部分）

**検証方法:** 静的コード検査

pushフェーズの `subagentTemplate` において、ブランチ確認コマンドの出力が空文字である場合にpushを中止してエラーを報告する内容が記述されていることを確認します。spec.mdの「detached HEAD状態（コマンド出力が空文字）の場合はpushを中止してエラーを報告すること」という仕様に対応します。state-machine.mmdで示された「DetachedHEAD → IsDetached → DetachedError → Abort」の状態遷移がテンプレートの指示内容として反映されていることも確認します。

**合否基準:** detached HEAD状態への対処手順が subagentTemplate に存在すれば合格

---

### TC-FQ4-03: サブモジュールのブランチ確認手順の存在確認（正常系）

**検証目的:** subagentTemplate にサブモジュールのブランチを個別確認する手順が含まれることを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（subagentTemplate部分）

**検証方法:** 静的コード検査

pushフェーズの `subagentTemplate` に `git submodule foreach` を使ったサブモジュールのブランチ確認手順が含まれていることを確認します。各サブモジュールについて個別にpushを実行する手順が記述されていることを確認します。spec.mdの「本プロジェクトでは `workflow-plugin` がサブモジュールとして管理されており、親リポジトリと独立したブランチを持つ可能性があります」という背景に基づく要件であり、NF-3（サブモジュール対応）に対応します。

**合否基準:** サブモジュールのブランチ確認および個別push手順が subagentTemplate に存在すれば合格

---

### TC-FQ4-04: ブランチ名ハードコード禁止の確認（正常系）

**検証目的:** subagentTemplate に `git push origin main` や `git push origin master` がハードコードされていないことを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（subagentTemplate部分）

**検証方法:** 静的コード検査

pushフェーズの `subagentTemplate` において、`git push origin main` および `git push origin master` の固定文字列がハードコードとして存在しないことを確認します。ブランチ名は動的に確認する構成（変数参照または手順として記述）になっていることを確認します。spec.mdの「ブランチ名をプロンプトにハードコードすることは環境依存性を生じさせるため、実行時に動的に確認する構成を採用します」という方針に対応します。

**合否基準:** ハードコードされた固定ブランチ名が存在せず、動的確認構成になっていれば合格

---

### TC-FQ4-05: pushフェーズでの手動動作確認（手動確認）

**検証目的:** pushフェーズに進んだときsubagentへ送信されるプロンプトにブランチ確認手順が実際に含まれることを確認する

**対象環境:** MCPサーバー再起動後のワークフロー実行環境

**検証方法:** ワークフロー実行環境での手動確認

pushフェーズに遷移した際にsubagentへ渡されるプロンプト内容を確認します。`git branch --show-current` または `git rev-parse --abbrev-ref HEAD` の記述が含まれていることを確認します。spec.mdの「手動検証手順: pushフェーズに進んだときにsubagentへ送信されるプロンプト内容を確認し、`git branch --show-current` または `git rev-parse --abbrev-ref HEAD` コマンドの引数が明示されていることを検査してください」という指示に従い実施します。

**合否基準:** プロンプトにブランチ確認コマンドが含まれていれば合格

---

## MCPサーバー再起動の検証工程

### 再起動要件と検証タイミング

spec.mdの「MCPサーバー再起動の要件」セクションに従い、FQ-1（next.ts）およびFQ-3・FQ-4（definitions.ts）の変更はMCPサーバーのコアモジュールに対する変更であるため、`npm run build` とMCPサーバー再起動が必要です。Node.jsのrequire()はモジュールをグローバルキャッシュに保存するため、ディスク上のファイルを変更しても実行中のMCPサーバーには変更が反映されません。テスト工程では、静的コード検査はビルド前に実施でき、手動動作確認はビルド後（MCPサーバー再起動後）に実施する設計とします。

### TC-BUILD-01: npm run build 成功確認

**検証目的:** TypeScriptのトランスパイルが成功し、dist/以下のファイルが更新されることを確認する

**対象ディレクトリ:** `C:\ツール\Workflow\workflow-plugin\mcp-server`

**検証方法:** ビルドコマンド実行と出力確認

`npm run build` を実行し、エラーなしで完了することを確認します。`dist/` 以下のファイル（特に `next.js` および `definitions.js` 相当のファイル）の更新日時が新しくなったことを確認します。spec.mdの再起動手順4ステップの第1・第2ステップに対応します。FQ-3とFQ-4を同一ビルドセッションで修正した後にこのビルドを実行することで、2回分のビルドコストを1回に圧縮できます。

**合否基準:** ビルドが成功し、distファイルの更新日時が新しければ合格

### TC-BUILD-02: MCPサーバー再起動後の workflow_status 正常応答確認

**検証目的:** MCPサーバー再起動後に workflow_status が正常なフェーズ情報を返すことを確認する

**対象ツール:** workflow_status MCPツール

**検証方法:** MCP経由での状態確認

Claude DesktopのMCPサーバー再起動ボタンを使用してプロセスを再起動した後、`workflow_status` を実行して現在のフェーズが正常に返されることを確認します。spec.mdの再起動手順の第4ステップである「`workflow_status` を実行して現在のフェーズが正常に返されることを確認します」に対応します。

**合否基準:** workflow_statusが正常なフェーズ情報を返せば合格

---

## フックキャッシュリフレッシュの検証工程

### TC-HOOK-01: bash-whitelist.js 変更後のフックキャッシュリフレッシュ確認

**検証目的:** FQ-2（bash-whitelist.js）の変更がセッション再起動によって適用されることを確認する

**対象ファイル:** `workflow-plugin/hooks/bash-whitelist.js`

**検証方法:** セッション再起動後の手動動作確認

spec.mdの「フックキャッシュのリフレッシュとNF-4の適用」セクションに記載の通り、Claude Codeのセッションを再起動することでフックキャッシュがリフレッシュされます。セッション再起動後に `>=` を含むコマンドを実際に実行し、ブロックされないことを確認します。NF-4（MCPサーバー再起動の要否判断）に従い、bash-whitelist.jsはフックから読み込まれるためセッション再起動によって変更が適用されます。

**合否基準:** セッション再起動後に `>=` を含むコマンドが実行許可されれば合格

---

## 非機能要件テスト

### TC-NF1-01: 後方互換性確認 - 既存フェーズ遷移ロジックの不変確認

**検証目的:** 各修正が既存の動作を壊さず後方互換性を維持していることを確認する（NF-1対応）

**対象範囲:** FQ-1〜FQ-4のすべての修正箇所

**検証方法:** 静的コード検査と回帰確認

各修正はスキップロジックの条件追加や値の変更に留め、既存のロジックを削除しない形で実装されていることを確認します。TC-FQ1-03（testingフェーズ以外のハッシュチェック有効継続）、TC-FQ3-03（他フェーズのallowedBashCategories不変）、TC-FQ2-02（リダイレクト検出継続）がNF-1の具体的な検証ケースです。spec.mdの「後方互換性を維持しながら、ドキュメント・フック・フェーズ定義の三者の整合性が保たれることを確認します」という方針に対応します。

**合否基準:** 既存の動作が維持されていることが全回帰ケースで確認できれば合格

### TC-NF3-01: サブモジュール対応の完全性確認（NF-3対応）

**検証目的:** FQ-4のテンプレートが親リポジトリとサブモジュールのブランチを個別に確認する構成であることを確認する

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（subagentTemplate部分）

**検証方法:** 静的コード検査

pushフェーズの subagentTemplate が親リポジトリのブランチ確認とサブモジュールのブランチ確認を個別に行う手順を含んでいることを確認します。spec.mdの「commitフェーズの既存テンプレートには『サブモジュール内でコミットすること』という指示が含まれていますが、pushフェーズには同様の考慮が欠如していました」という背景から、pushフェーズでも同等のサブモジュール対応が追加されていることを検査します。

**合否基準:** 親リポジトリとサブモジュールの両方に対するブランチ確認手順が存在すれば合格

---

## テストマトリクス

各テストケースの種別・対象ファイル・検証方法・対応する仕様セクションを整理します。

| テストケースID | バグ修正 | 種別 | 対象ファイル | 検証方法 | 対応仕様 |
|---|---|---|---|---|---|
| TC-FQ1-01 | FQ-1 | 正常系 | next.ts | 静的コード検査 | FQ-1変更後コード |
| TC-FQ1-02 | FQ-1 | 正常系 | next.ts | 静的コード検査 | FQ-1受入基準 |
| TC-FQ1-03 | FQ-1 | 回帰テスト | next.ts | 静的コード検査 | NF-1後方互換性 |
| TC-FQ1-04 | FQ-1 | 回帰テスト | next.ts | 静的コード検査 | test-authenticity不変 |
| TC-FQ1-05 | FQ-1 | 正常系 | ワークフロー実行環境 | 手動動作確認 | FQ-1手動検証手順 |
| TC-FQ2-01 | FQ-2 | 正常系 | bash-whitelist.js | Node.js単体テスト | FQ-2比較演算子除外 |
| TC-FQ2-02 | FQ-2 | 正常系 | bash-whitelist.js | Node.js単体テスト | FQ-2リダイレクト検出 |
| TC-FQ2-03 | FQ-2 | 正常系 | bash-whitelist.js | Node.js単体テスト | FQ-2追記リダイレクト |
| TC-FQ2-04 | FQ-2 | 正常系 | bash-whitelist.js | Node.js単体テスト | FQ-2アロー演算子除外 |
| TC-FQ2-05 | FQ-2 | 回帰テスト | bash-whitelist.js | 静的コード検査 | FQ-2正規表現パターン |
| TC-FQ2-06 | FQ-2 | 回帰テスト | bash-whitelist.js | 静的コード検査 | FQ-2一貫性確認 |
| TC-FQ3-01 | FQ-3 | 正常系 | definitions.ts | 静的コード検査 | FQ-3変更箇所1 |
| TC-FQ3-02 | FQ-3 | 正常系 | definitions.ts | 静的コード検査 | FQ-3変更箇所2 |
| TC-FQ3-03 | FQ-3 | 回帰テスト | definitions.ts | 静的コード検査 | NF-1他フェーズ不変 |
| TC-FQ3-04 | FQ-3 | 手動確認 | 三者クロスチェック | クロスチェック | NF-2コード整合性 |
| TC-FQ4-01 | FQ-4 | 正常系 | definitions.ts | 静的コード検査 | FQ-4ブランチ確認手順 |
| TC-FQ4-02 | FQ-4 | 正常系 | definitions.ts | 静的コード検査 | FQ-4detached HEAD |
| TC-FQ4-03 | FQ-4 | 正常系 | definitions.ts | 静的コード検査 | NF-3サブモジュール |
| TC-FQ4-04 | FQ-4 | 正常系 | definitions.ts | 静的コード検査 | FQ-4ハードコード禁止 |
| TC-FQ4-05 | FQ-4 | 手動確認 | ワークフロー実行環境 | 手動動作確認 | FQ-4手動検証手順 |
| TC-BUILD-01 | 全般 | 環境検証 | mcp-serverビルド | ビルド実行 | 再起動手順step1-2 |
| TC-BUILD-02 | 全般 | 環境検証 | workflow_statusツール | MCP確認 | 再起動手順step4 |
| TC-HOOK-01 | FQ-2 | 環境検証 | bash-whitelist.js | セッション再起動確認 | NF-4フックキャッシュ |
| TC-NF1-01 | 全般 | 非機能要件 | 全修正対象 | 総合確認 | NF-1後方互換性 |
| TC-NF3-01 | FQ-4 | 非機能要件 | definitions.ts | 静的コード検査 | NF-3サブモジュール対応 |

---

## テスト実行順序

静的コード検査と単体テストは実装完了後の最初のパスとして実施します。FQ-1の静的コード検査（TC-FQ1-01〜04）を先に完了させ、条件分岐の正確性を確認します。FQ-2の単体テスト（TC-FQ2-01〜06）は Node.js を使って実行し、全ケースが通過することを確認します。FQ-3の静的コード検査（TC-FQ3-01〜03）でallowedBashCategoriesの変更を検証します。FQ-4の静的コード検査（TC-FQ4-01〜04）でsubagentTemplateの内容を検証します。

静的コード検査が全て通過した後、MCPサーバーのビルド（TC-BUILD-01）を実施します。ビルド成功確認後、MCPサーバーを再起動してTC-BUILD-02を実施します。再起動後に手動動作確認（TC-FQ1-05、TC-FQ3-04、TC-FQ4-05）を実施します。FQ-2のフックキャッシュリフレッシュ確認（TC-HOOK-01）はセッション再起動後に実施します。

---

## 合否判定基準のまとめ

全25件のテストケースが合格した場合に修正全体を合格と判定します。静的コード検査は全件合格が必須であり、1件でも不合格があれば実装修正が必要です。Node.js単体テスト（TC-FQ2-01〜04）も全件合格が必須です。手動確認はMCPサーバー再起動後に実施するため、TC-BUILD-01とTC-BUILD-02の合格後にTC-FQ1-05・TC-FQ3-04・TC-FQ4-05を順次実施します。特にTC-FQ1-05（testingフェーズ手動動作確認）はワークフロー全体の健全性に直結するため、最終検証として必ず実施します。
