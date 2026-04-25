## サマリー

- 目的: 前回のワークフロー修正タスクで発生した開発環境の不整合（.gitmodules欠落、bash-whitelist.js未コミット変更、サブモジュールポインタ陳腐化）を根本的に解消し、Gitリポジトリの整合性を回復する
- 主要な決定事項:
  - 実装順序は「workflow-plugin内の整理 → .gitmodules作成 → 親リポジトリポインタ更新 → check_ocr.py確認」の4段階構成とする
  - mcp-server/hooks/lib/（discover-tasks.js, task-cache.js）とmcp-server/src/verify-sync.test.tsは.gitignoreに追加して追跡対象から除外する
  - bash-whitelist.jsの変更（parallel_verificationフェーズ追加）とgitignore追加を1つのコミットにまとめてworkflow-pluginに記録する
  - 親リポジトリの.gitmodulesファイルはURL「https://github.com/karimatan1106/workflow-plugin」で新規作成する
  - 親リポジトリへの最終コミットは.gitmodulesの追加とworkflow-pluginポインタ更新を1コミットにまとめる
- 次フェーズで必要な情報:
  - workflow-pluginのHEADコミットハッシュは4ead400（コミット後に更新される）
  - 親リポジトリの現在のサブモジュールポインタは4331072であり、これを更新する必要がある
  - settings.jsonのcheck_ocr.py削除は調査時点で確認済みのため、verification扱いとする

---

## 概要

本タスクは、前回のワークフロー修正タスク（20260208_ワークフロー構造的問題完全解決）の実施後に残存した開発環境の不整合を根本的に解消することを目的としている。
具体的には、親リポジトリに `.gitmodules` ファイルが欠落しており、他の開発者やCI/CD環境でのサブモジュール初期化が機能しない状態となっている。
また、`workflow-plugin`（子リポジトリ）では `hooks/bash-whitelist.js` の変更が未コミットのまま残されており、親リポジトリのサブモジュールポインタが最新HEADを指していない状態である。
修正スコープはGitリポジトリの整合性回復に必要な最小限の変更に限定し、`.gitmodules` の新規作成、`bash-whitelist.js` および `.gitignore` の変更をコミット、親リポジトリのサブモジュールポインタ更新、および `.claude/settings.json` の不要エントリ不在確認の4段階で構成される。
本タスク完了後は、`git submodule status` がエラーなしで実行でき、`git status` が両リポジトリでクリーンな状態となり、`parallel_verification` フェーズのBashコマンド許可設定が正式にコミットされた状態となる。

---

## 機能要件

### FR-1: .gitmodulesファイルの作成

親リポジトリ（C:/ツール/Workflow）のルートに `.gitmodules` ファイルを新規作成する。
作成するファイルの内容はgitサブモジュール標準形式に準拠し、pathにworkflow-plugin、URLにhttps://github.com/karimatan1106/workflow-pluginを指定する。
このファイルは親リポジトリのインデックスに追加してコミットする必要があり、欠落した状態では他の開発者がサブモジュールをcloneできない。
作成後、`git submodule status` が正常にコミットハッシュを表示することを確認する。

### FR-2: workflow-plugin内の変更をコミット

`workflow-plugin` ディレクトリ（子リポジトリ）において、hooks/bash-whitelist.jsと.gitignoreの2ファイルをまとめてコミットする。
bash-whitelist.jsの変更内容は、`getWhitelistForPhase` 関数の `verificationPhases` 配列への `'parallel_verification'` 追加であり、同フェーズにおけるBashコマンド許可範囲を `readonly` から `readonly + testing + gh` に拡張するものである。
未追跡ディレクトリ `mcp-server/hooks/lib/` と未追跡ファイル `mcp-server/src/verify-sync.test.ts` は .gitignore に追加して追跡対象から除外する。
コミット後に `workflow-plugin` の HEAD が新しいコミットハッシュを指すことを確認する。

### FR-3: 親リポジトリのサブモジュールポインタ更新

FR-2 のコミット完了後、親リポジトリ（C:/ツール/Workflow）において `workflow-plugin` のサブモジュールポインタを最新HEADに更新してコミットする。
現在の親リポジトリはコミット `4331072` を記録しているが、FR-2 のコミット後はさらに新しいコミットが追加されるため、最新のハッシュを親リポジトリに記録する必要がある。
`git add workflow-plugin` でgitlinkオブジェクトを更新し、.gitmodulesの追加と同一コミットにまとめる。

### FR-4: check_ocr.py フック設定の削除確認

`.claude/settings.json` を検査し、`UserPromptSubmit` フックエントリおよびOCR関連の参照が存在しないことを確認する。
調査時点では既に削除されていることが確認されているが、実装フェーズでの再確認を必須とする。
現在登録されているフックは `PreToolUse`、`Write`、`Bash`、`PostToolUse` の各カテゴリのみであることを確認する。

---

## 非機能要件

### NFR-1: Gitリポジトリ整合性の維持

全ての修正後に、親リポジトリおよび `workflow-plugin` リポジトリの両方でgitの整合性が保たれること。
`git submodule status` がエラーなしでコミットハッシュを返すこと、`git status` に予期しない未追跡ファイルや変更済みファイルが表示されないこと、HMACによるworkflow-stateの整合性が損なわれないことを達成基準とする。

### NFR-2: 既存ワークフロー機能への無影響

修正作業の前後で、ワークフロープラグインの既存機能（フェーズ遷移、アーティファクト検証、Bashコマンド制御）が正常に動作し続けること。
bash-whitelist.jsの変更は追加的な変更（`parallel_verification` フェーズの追加）であり、既存のフェーズへの許可カテゴリに変更を加えない。

### NFR-3: 修正の冪等性

複数回の修正実施後も同一の最終状態が得られること。
`.gitmodules` の内容は固定形式であり、同じ内容で上書きしても整合性が崩れない。
`git add workflow-plugin` による gitlink 更新は常に最新HEADを指すため、複数回実行しても最終結果は一致する。

### NFR-4: 作業の最小侵襲性

修正範囲をgit整合性の修復に必要な最小限のファイルに限定すること。
ソースコードの機能変更は bash-whitelist.js の1行追加のみであり、他のフック実装ファイルや設定ファイルには手を加えない。

---

## 実装計画

### Step 1: workflow-plugin内の整理とコミット

workflow-pluginリポジトリ（C:/ツール/Workflow/workflow-plugin）において、2つの変更をまとめてコミットする。
第1の変更はhooks/bash-whitelist.jsへのparallel_verificationフェーズ追加であり、第2の変更は不要ファイルを.gitignoreに追加して追跡対象から除外することである。
bash-whitelist.jsの変更は218行目付近の`verificationPhases`配列に`'parallel_verification'`を追加する1行の追加のみであり、既存のフェーズ定義には手を加えない。

変更前の状態:

```
const verificationPhases = ['security_scan', 'performance_test', 'e2e_test', 'ci_verification'];
```

変更後の状態:

```
const verificationPhases = ['security_scan', 'performance_test', 'e2e_test', 'ci_verification', 'parallel_verification'];
```

.gitignoreへの追加は以下の2エントリである。
- `mcp-server/hooks/lib/` — 実行時に自動生成されるlibraryファイルを格納するディレクトリ
- `mcp-server/src/verify-sync.test.ts` — テスト環境固有のファイルであり、コアMCP機能に影響しない

コミット後の確認: `git status`がクリーンであること、`git show HEAD --stat`でhooks/bash-whitelist.jsと.gitignoreの2ファイルが変更されていること。

### Step 2: 親リポジトリへの.gitmodules作成

親リポジトリ（C:/ツール/Workflow）のルートディレクトリに`.gitmodules`ファイルを新規作成する。
このファイルが存在しないと、`git submodule update --init`や`git clone --recurse-submodules`が失敗し、他の開発者やCI/CD環境でのサブモジュール初期化が機能しない。
ファイルのインデントはスペース4文字であり、gitのサブモジュール標準形式に準拠する。
このステップではファイルの作成のみを行い、git addやgit commitはStep 3でまとめて実行する。

### Step 3: 親リポジトリのサブモジュールポインタ更新とコミット

Step 1でworkflow-pluginに新しいコミットが作成されたため、親リポジトリが記録するサブモジュールポインタを最新状態に更新する。
`git add .gitmodules` と `git add workflow-plugin` を実行して両方の変更をステージングし、1回のコミットで原子的に記録する。
コミット後は `git submodule status` でエラーなしでコミットハッシュが表示され、`git ls-files --stage workflow-plugin` がStep 1で作成したコミットハッシュを指すことを確認する。

### Step 4: check_ocr.py削除状態の確認

`.claude/settings.json`を検査し、check_ocr.pyへの参照および`UserPromptSubmit`フックエントリが存在しないことを確認する。
この段階では実装作業は行わず、要件充足の最終確認のみを行う。
UserPromptSubmitエントリが存在しないこと、およびcheck_ocr.pyへの参照が全て除去されていることが確認されれば、FR-4の要件は充足と判定し、コミットは不要である。

---

## 変更対象ファイル

### workflow-pluginリポジトリ（C:/ツール/Workflow/workflow-plugin/）

`hooks/bash-whitelist.js` — `verificationPhases` 配列に `'parallel_verification'` を追加する。変更はStep 1で実施し、workflow-pluginのコミット対象となる。

`.gitignore` — `mcp-server/hooks/lib/` と `mcp-server/src/verify-sync.test.ts` の2エントリを追加する。変更はStep 1で実施し、bash-whitelist.jsと同一コミットにまとめる。

### 親リポジトリ（C:/ツール/Workflow/）

`.gitmodules` — 新規作成ファイル。`[submodule "workflow-plugin"]` ブロックにpathとurlの2設定を記述する。Step 2で作成し、Step 3でgit addしてコミットする。

`workflow-plugin`（gitlinkエントリ） — 親リポジトリが記録するサブモジュールのコミットハッシュを最新状態に更新する。`git add workflow-plugin` コマンドにより更新され、Step 3でコミットに含める。

### 変更しないファイル（確認のみ）

`.claude/settings.json` — UserPromptSubmitエントリの不在を確認する読み取り専用操作のみ実施し、ファイル内容は変更しない。

---

## 実装順序の制約

問題間の依存関係により、以下の順序で実装を進める必要がある。
Step 1（workflow-plugin内コミット）はStep 3（親ポインタ更新）より先に完了している必要がある。
Step 1の完了前にStep 3のgit addを実行すると、古いコミットハッシュが親リポジトリに記録されるリスクが生じる。
Step 2（.gitmodules作成）はStep 1の完了に依存しないため、並行して準備可能であるが、git addはStep 3でまとめて行う。
workflow-pluginのブランチはmainであり、親リポジトリのブランチはmasterであるため、各操作前にカレントブランチを確認することを推奨する。

---

## 検証チェックリスト

実装フェーズ完了後、以下の全項目を検証すること。

親リポジトリのルートに`.gitmodules`が存在し、workflow-pluginのpathとURLが正しく記述されていることを確認する。

`git submodule status`を親リポジトリで実行した際にエラーが発生せず、コミットハッシュが先頭に表示されること。プレフィックスとして`-`（未初期化）や`+`（ポインタ不一致）が表示されないことが合格条件である。

workflow-pluginの`git status`がクリーンな状態（変更済みファイルなし、未追跡ファイルなし）であること。mcp-server/hooks/とmcp-server/src/verify-sync.test.tsが.gitignoreにより無視されていることも合わせて確認する。

親リポジトリの`git ls-files --stage workflow-plugin`がStep 1で作成したコミットハッシュを指していることを確認する。

`.claude/settings.json`に`UserPromptSubmit`エントリが存在しないことを確認する。

`parallel_verification`フェーズで`readonly`、`testing`、`gh`カテゴリのBashコマンドが許可されることを、bash-whitelist.jsのverificationPhases配列に`'parallel_verification'`が含まれていることで確認する。
