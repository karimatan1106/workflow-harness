## サマリー

- 目的: 開発環境整合性修正タスクのUI設計書として、CLIインターフェース・エラーメッセージ・APIレスポンス・設定ファイル形式を定義する。本タスクはGUI操作を持たず、gitコマンドとMCP workflow APIの組み合わせで完結するCLIのみの構成となる。
- 主要な決定事項:
  - Gitコマンドの実行順序はStep 1（workflow-plugin内コミット）→ Step 2（.gitmodules作成）→ Step 3（親ポインタ更新）→ Step 4（確認）の4段階とする
  - .gitmodulesのINI形式はgit標準準拠（インデントはスペース4文字、pathとurlの2設定）を採用する
  - workflow APIの呼び出しはworkflow_status、workflow_nextの2ツールのみ使用し、状態遷移はMCPサーバーが管理する
  - エラーハンドリングは各gitコマンドの終了コードとstderrを解析して分岐する設計とする
- 次フェーズで必要な情報:
  - test_designフェーズでは本設計書のCLIコマンドシーケンスをテストケースの入力条件として参照すること
  - エラーメッセージ設計の各エラーコードはtest_implフェーズでのモックアップに利用する
  - 設定ファイル設計の.gitmodulesの期待値はimplementationフェーズの検証条件として使用する

---

## CLIインターフェース設計

本タスクで実行するgitコマンドのシーケンスを以下に定義する。実行順序は依存関係に基づいており、Step 1が完了するまでStep 3は実行してはならない。

### Step 1: workflow-pluginリポジトリ内の変更コミット

workflow-pluginリポジトリのルートディレクトリ（C:/ツール/Workflow/workflow-plugin/）で実行するコマンドを以下に示す。

カレントブランチ確認: `git -C C:/ツール/Workflow/workflow-plugin branch --show-current`
- 期待出力: `main`
- 目的: mainブランチ以外での作業を防止するための事前確認として実行する

変更状態確認: `git -C C:/ツール/Workflow/workflow-plugin status --short`
- 期待出力: `M hooks/bash-whitelist.js`、`?? mcp-server/hooks/lib/`、`?? mcp-server/src/verify-sync.test.ts` の各行が表示される
- 目的: コミット対象ファイルと除外対象ファイルの現状把握

.gitignoreへのエントリ追加は専用ツール（Write/Edit）で実施し、追加後にステージング操作を行う。
ステージング: `git -C C:/ツール/Workflow/workflow-plugin add hooks/bash-whitelist.js .gitignore`
- 目的: bash-whitelist.jsと.gitignoreの2ファイルのみをインデックスに追加する

コミット実行: `git -C C:/ツール/Workflow/workflow-plugin commit -m "feat: add parallel_verification to bash-whitelist and update gitignore"`
- コミットメッセージ形式: `feat: ` プレフィックスに変更の概要を続ける形式
- 目的: 2ファイルの変更を1コミットに原子的に記録する

コミット確認: `git -C C:/ツール/Workflow/workflow-plugin show HEAD --stat`
- 期待出力: `hooks/bash-whitelist.js` と `.gitignore` の2ファイルが変更対象として表示される

### Step 2: 親リポジトリへの.gitmodules作成

親リポジトリのルートディレクトリ（C:/ツール/Workflow/）で作成するファイルの内容を以下に示す。
ファイル作成はBashコマンドではなく、Writeツールを使用して実施する。
作成後の確認: `git -C C:/ツール/Workflow status --short`
- 期待出力: `?? .gitmodules` が1行表示される（未追跡の新規ファイルとして認識される）

### Step 3: 親リポジトリのステージングとコミット

.gitmodulesステージング: `git -C C:/ツール/Workflow add .gitmodules`
- 目的: 新規作成した.gitmodulesをインデックスに追加する

サブモジュールポインタ更新: `git -C C:/ツール/Workflow add workflow-plugin`
- 目的: Step 1で作成したコミットハッシュを親リポジトリのgitlinkオブジェクトに反映する

コミット実行: `git -C C:/ツール/Workflow commit -m "fix: add .gitmodules and update workflow-plugin submodule pointer"`
- 目的: .gitmodulesの追加とサブモジュールポインタ更新を1コミットに原子的に記録する

コミット後の整合性確認: `git -C C:/ツール/Workflow submodule status`
- 期待出力: `{コミットハッシュ} workflow-plugin (heads/main)` の形式で表示され、先頭に `-` や `+` が付かない

ステージング確認: `git -C C:/ツール/Workflow ls-files --stage workflow-plugin`
- 目的: 記録されたgitlinkのコミットハッシュをStep 1のHEADと照合して一致を確認する

### Step 4: settings.json確認操作

settings.json読み取り: ReadツールまたはGrepツールを使用してUserPromptSubmitエントリの不在を確認する
- 実行するBashコマンドは不要（読み取り専用ツールで対応可能）
- 確認項目: `UserPromptSubmit` キーが存在しないこと、`check_ocr.py` 文字列が含まれないこと

---

## エラーメッセージ設計

各操作で発生し得るエラーとその対処方針を定義する。エラーはgitコマンドの終了コードとstderrの内容から識別する。

### E-1: mainブランチ不一致エラー

発生条件: `git branch --show-current` の出力が `main` 以外の文字列を返す場合に発生する。
エラー内容: 現在のブランチが `main` ではなく別のブランチを指しており、コミット先が意図しないブランチになるリスクがある。
対処方針: `git checkout main` を実行してmainブランチに切り替えてから、Step 1の操作を再開する。ブランチ切り替え前に未コミットの変更がある場合は `git stash` で一時退避する。

### E-2: サブモジュール未初期化エラー

発生条件: 親リポジトリで `git submodule status` を実行した際に、先頭に `-` プレフィックスが付くコミットハッシュが表示される場合に発生する。
エラー内容: `.gitmodules` は存在するがサブモジュールのディレクトリが初期化されていない状態を示す。
対処方針: `git submodule update --init` を実行してサブモジュールを初期化する。初期化後に再度 `git submodule status` で `-` プレフィックスが消えていることを確認する。

### E-3: ポインタ不一致エラー

発生条件: `git submodule status` の出力で先頭に `+` プレフィックスが付く場合に発生する。
エラー内容: 親リポジトリが記録するコミットハッシュとworkflow-pluginディレクトリの実際のHEADが一致しない状態を示す。Step 3の `git add workflow-plugin` が実行される前の状態でもこの表示が出る。
対処方針: Step 3の `git add workflow-plugin` と `git commit` が完了していない場合は処理を継続する。Step 3完了後も `+` が表示される場合は、`git submodule update` でworkflow-pluginを親リポジトリのポインタが指すコミットに合わせる。

### E-4: コミット失敗エラー（変更なし）

発生条件: `git commit` 実行時に `nothing to commit, working tree clean` が出力されて終了コード1が返る場合に発生する。
エラー内容: ステージングエリアに変更が存在しない状態でコミットが試みられた場合に発生する。
対処方針: `git status` でステージングエリアの状態を確認し、対象ファイルが `git add` されているか検査する。ファイルの変更が正しく反映されているかをReadツールで確認してから再度ステージングを実施する。

### E-5: HMAC整合性エラー

発生条件: フックが `workflow-state.json` のHMAC検証を実施した際に署名不一致が検出される場合に発生する。
エラー内容: `workflow-state.json` が直接編集されてHMACが更新されていない状態を示す。Bashコマンド実行がブロックされる原因となる。
対処方針: `workflow-state.json` を直接編集してはならない。MCPサーバーのworkflow APIを通じてのみ状態を変更する。不整合が発生した場合はMCPサーバーを再起動してからworkflow_statusで現在の状態を確認する。

### E-6: .gitmodulesパース失敗

発生条件: `.gitmodules` ファイルの形式が不正でgitがパースできない場合に発生する。
エラー内容: `git submodule status` 実行時にgitがINI形式のパースエラーを返す。インデントが誤っている場合やセクションヘッダーの形式が標準でない場合に起こる。
対処方針: 設定ファイル設計セクションに記載した正確なINI形式でファイルを再作成し、インデントがスペース4文字であることを確認する。

---

## APIレスポンス設計

MCP workflowツールの呼び出しとレスポンス形式を定義する。本タスクで使用するツールはworkflow_statusとworkflow_nextの2種類である。

### workflow_status レスポンス形式

呼び出し目的: 現在のフェーズを確認してコマンド実行可否を判断するために使用する。
レスポンスはJSON形式で返却され、以下のフィールドを含む。

`currentPhase` フィールド: 現在のフェーズ名を文字列で返す。本タスクの実行中は `"implementation"` が期待値となる。
`taskName` フィールド: タスク名を文字列で返す。本タスクでは `"開発環境整合性修正"` が期待値となる。
`taskId` フィールド: タスクの識別子を文字列で返す。先頭に日付を含むタイムスタンプ形式となる。
`allowedBashCategories` フィールド: 現在フェーズで許可されているBashコマンドカテゴリの配列を返す。implementationフェーズでは `["readonly", "testing", "implementation"]` が期待値となる。

`stateIntegrity` フィールド: workflow-state.jsonのHMAC署名値を返す。このフィールドを直接参照してはならない。

### workflow_next レスポンス形式

呼び出し目的: 現在フェーズの成果物バリデーションを実行し、次フェーズへ遷移するために使用する。
バリデーション成功時のレスポンスは次フェーズの情報を含むJSONを返す。

`success` フィールド: バリデーション結果を真偽値で返す。trueの場合はフェーズ遷移が完了したことを示す。
`nextPhase` フィールド: 遷移先のフェーズ名を文字列で返す。
`validationErrors` フィールド: バリデーション失敗時に検出されたエラーの配列を返す。成功時は空配列となる。

バリデーション失敗時の対処: `validationErrors` の内容を参照し、エラー種別に応じて成果物を修正してから再度workflow_nextを呼び出す。成果物を直接修正するのではなく、失敗内容をsubagentへのリトライプロンプトに含めてsubagentを再起動する。

### workflow_complete_sub レスポンス形式

呼び出し目的: 並列フェーズのサブフェーズ完了を記録するために使用する。本タスクには並列フェーズが含まれないため、呼び出し機会は限定される。
`completed` フィールド: 完了したサブフェーズ名を文字列で返す。
`allSubPhasesCompleted` フィールド: 全サブフェーズが完了したかを真偽値で返す。trueの場合はworkflow_nextの呼び出しが可能となる。

---

## 設定ファイル設計

本タスクで作成または変更する設定ファイルの形式を定義する。

### .gitmodules ファイル形式

親リポジトリ（C:/ツール/Workflow/）のルートに新規作成するファイルの内容を以下に示す。
gitのINI形式に準拠し、セクションヘッダーとキーと値のペアで構成される。

セクションヘッダー: `[submodule "workflow-plugin"]` の形式で記述する。ダブルクォーテーションでサブモジュール名を囲む。
pathキー: サブモジュールのローカルパスを親リポジトリのルートからの相対パスで指定する。値は `workflow-plugin` とする。
urlキー: サブモジュールのリモートリポジトリのURLを指定する。値は `https://github.com/karimatan1106/workflow-plugin` とする。

インデント規則: pathとurlの各キーはスペース4文字のインデントを付与する。タブ文字ではなくスペースを使用する。
ファイル末尾: 改行コードはLFを推奨するが、CRLF環境でもgitが自動変換するため問題は生じない。

### .gitignore 追加エントリ形式（workflow-plugin）

workflow-pluginリポジトリ（C:/ツール/Workflow/workflow-plugin/）の既存の `.gitignore` ファイルに追加する2エントリの形式を以下に示す。

追加エントリ1: `mcp-server/hooks/lib/` — 末尾にスラッシュを付けてディレクトリを指定する。このパターンにより、lib/ディレクトリとその配下の全ファイルがgitの追跡対象から除外される。
追加エントリ2: `mcp-server/src/verify-sync.test.ts` — ファイルパスを完全に指定する。ディレクトリではなく特定ファイルを除外する場合はスラッシュを末尾に付けない。

追加方法: 既存の.gitignoreの末尾に改行を挟んで2エントリを追記する。Editツールを使用して既存の内容を維持しながら追記する。

### bash-whitelist.js 変更形式

workflow-pluginリポジトリ内の `hooks/bash-whitelist.js` の変更箇所の形式を以下に示す。
`verificationPhases` 配列の末尾に `'parallel_verification'` を追加する1行の変更である。

変更前の配列: `['security_scan', 'performance_test', 'e2e_test', 'ci_verification']` という4要素の配列が定義されている。
変更後の配列: 末尾に `'parallel_verification'` を追加して5要素の配列とする。シングルクォーテーションで囲み、カンマで区切る形式を維持する。

変更箇所の特定: 218行目付近の `verificationPhases` 変数定義を検索してEditツールで変更する。行番号は環境によって前後する可能性があるため、変数名で検索してから変更することを推奨する。

### .claude/settings.json 確認観点

ファイルの変更は行わず、以下の観点でReadツールによる確認を実施する。
`UserPromptSubmit` キーがトップレベルのJSONオブジェクトに存在しないことを確認する。
`check_ocr.py` という文字列がファイル全体に含まれていないことを確認する。
登録されているフックカテゴリが `PreToolUse`、`Write`、`Bash`、`PostToolUse` の4カテゴリのみであることを確認する。
確認後に変更が不要と判断した場合は、FR-4要件は充足と判定しコミット対象には含めない。
