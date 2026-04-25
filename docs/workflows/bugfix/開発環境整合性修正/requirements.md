## サマリー

- 目的: 前回のワークフロー修正タスクで発生した開発環境の不整合（.gitmodules欠落、未コミット変更、サブモジュールポインタ陳腐化）を根本的に解消する
- 主要な決定事項:
  - 問題1（check_ocr.py）は調査時点で解消済みのため、要件対象外とする
  - 問題2〜4は順序依存関係があり、.gitmodules作成→workflow-pluginコミット→親リポジトリポインタ更新の順で対処する
  - mcp-server/hooks/lib/（discover-tasks.js, task-cache.js）とverify-sync.test.tsはgitignore対象とし、追跡しないこととする
  - bash-whitelist.jsの変更（parallel_verificationフェーズ追加）はworkflow-pluginのコミット対象とする
- 次フェーズで必要な情報:
  - .gitmodulesのリモートURLはhttps://github.com/karimatan1106/workflow-plugin（調査済み）
  - 修正対象ファイルは親リポジトリと子リポジトリの両方にまたがる
  - 親リポジトリのmasterブランチへのコミットが必要

---

## 機能要件

### FR-1: .gitmodulesファイルの作成

親リポジトリ（`C:\ツール\Workflow`）のルートに `.gitmodules` ファイルを新規作成する。

作成するファイルの内容は以下の形式に準拠すること：

```
[submodule "workflow-plugin"]
    path = workflow-plugin
    url = https://github.com/karimatan1106/workflow-plugin
```

このファイルは親リポジトリのインデックスに追加してコミットする必要がある。
`.gitmodules` が存在しない場合、`git submodule status` がエラーを返し、他の開発者がサブモジュールをcloneできない状態が継続する。
作成後、`git submodule status` が正常にコミットハッシュを表示することを確認する。

### FR-2: workflow-plugin内の変更をコミット

`workflow-plugin` ディレクトリ（子リポジトリ）において、以下の変更を整理してコミットする。

コミット対象ファイルは `hooks/bash-whitelist.js` のみである。
この変更内容は、`getWhitelistForPhase` 関数の `verificationPhases` 配列への `'parallel_verification'` 追加であり、同フェーズにおけるBashコマンド許可範囲を `readonly` から `readonly + testing + gh` に拡張するものである。

未追跡ディレクトリ `mcp-server/hooks/lib/`（discover-tasks.js および task-cache.js）と未追跡ファイル `mcp-server/src/verify-sync.test.ts` は、以下の理由から `.gitignore` に追加して追跡対象から除外する：
- これらのファイルは実行時に自動生成される性質を持つか、テスト環境固有のファイルである
- サブモジュールのコア機能（フェーズ制御、アーティファクト検証）に影響しない
- 追跡すると他環境でのclone後に不要なファイルが展開される

コミット後に `workflow-plugin` の HEAD が新しいコミットハッシュを指すことを確認する。

### FR-3: 親リポジトリのサブモジュールポインタ更新

FR-2 のコミット完了後、親リポジトリ（`C:\ツール\Workflow`）において `workflow-plugin` のサブモジュールポインタを最新HEADに更新してコミットする。

現在の状態では、親リポジトリは `workflow-plugin` のコミット `4331072` を記録しているが、実際のHEADは `4ead400` 以降となっている。
FR-2 のコミット後はさらに新しいコミットが `workflow-plugin` に追加されるため、そのコミットハッシュを親リポジトリに記録する必要がある。

具体的には、`git add workflow-plugin` を実行してサブモジュールのgitlinkオブジェクトを更新し、コミットメッセージには変更の意図が明確に記述されていること。
コミット後、`git ls-files --stage workflow-plugin` の出力が最新のコミットハッシュを示すことを確認する。

### FR-4: check_ocr.py フック設定の削除確認

`.claude/settings.json` を検査し、`UserPromptSubmit` フックエントリおよびOCR関連の参照が存在しないことを確認する。

調査時点では既に削除されていることが確認されているが、実装フェーズでの再確認を必須とする。
現在登録されているフックは `PreToolUse`、`Write`、`Bash`、`PostToolUse` の各カテゴリに限定されており、全てワークフロー制御に必要なフックのみが含まれていることを確認する。

---

## 非機能要件

### NFR-1: Gitリポジトリ整合性の維持

全ての修正後に、親リポジトリおよび `workflow-plugin` リポジトリの両方でgitの整合性が保たれること。
具体的には、`git submodule status` がエラーなしでコミットハッシュを返すこと、`git status` に予期しない未追跡ファイルや変更済みファイルが表示されないこと、HMACによるworkflow-stateの整合性が損なわれないことを達成基準とする。

### NFR-2: 既存ワークフロー機能への無影響

修正作業の前後で、ワークフロープラグインの既存機能（フェーズ遷移、アーティファクト検証、Bashコマンド制御）が正常に動作し続けること。
bash-whitelist.jsの変更は追加的な変更（`parallel_verification` フェーズの追加）であり、既存のフェーズへの許可カテゴリに変更を加えないことで、既存動作への影響を排除する。
フック設定（settings.json）を変更しないことで、フックシステムの動作に影響を与えないこと。

### NFR-3: 修正の冪等性

複数回の修正実施後も同一の最終状態が得られること。
`.gitmodules` の内容は固定形式であり、同じ内容で上書きしても整合性が崩れない。
`git add workflow-plugin` による gitlink 更新は常に最新HEADを指すため、複数回実行しても最終結果は一致する。

### NFR-4: 作業の最小侵襲性

修正範囲をgit整合性の修復に必要な最小限のファイルに限定すること。
ソースコードの機能変更は bash-whitelist.js の1行追加のみであり、他のフック実装ファイルや設定ファイルには手を加えないこと。

---

## 実装順序の制約

問題間の依存関係により、以下の順序で実装を進める必要がある。

第1段階として、`workflow-plugin` リポジトリの内部を整理する。`mcp-server/hooks/lib/` と `mcp-server/src/verify-sync.test.ts` を `.gitignore` に追加し、`hooks/bash-whitelist.js` の変更と合わせてコミットする。この段階で `workflow-plugin` の HEAD が確定する。

第2段階として、親リポジトリの `.gitmodules` を作成する。内容は FR-1 に記載の形式に準拠する。

第3段階として、親リポジトリで `workflow-plugin` のサブモジュールポインタを第1段階で作成されたコミットハッシュに更新し、`.gitmodules` の追加と合わせてコミットする。

第4段階として、`check_ocr.py` の削除状態を確認し（変更不要）、要件充足を記録する。

この順序を逆にすると、親リポジトリのポインタが古いコミットのままとなるか、サブモジュール参照が不整合な状態でコミットされるリスクが生じる。

---

## 検収条件

全ての修正完了後、以下の条件が満たされていること：

- 親リポジトリのルートに `.gitmodules` が存在し、`workflow-plugin` のpathとURLが正しく記述されていること
- `git submodule status` を親リポジトリで実行した際にエラーが発生せず、コミットハッシュが表示されること
- `workflow-plugin` の `git status` がクリーンな状態（変更済みファイルなし、未追跡ファイルなし）であること
- 親リポジトリの `git ls-files --stage workflow-plugin` が `workflow-plugin` の最新コミットを指していること
- `.claude/settings.json` に `UserPromptSubmit` エントリが存在しないこと
- `parallel_verification` フェーズで `readonly`、`testing`、`gh` カテゴリのBashコマンドが許可されること
