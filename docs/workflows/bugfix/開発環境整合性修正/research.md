## サマリー

- 目的: 前回のワークフロー修正タスクで発生した4つの開発環境不整合問題を調査し、根本原因と修正方法を明確にする
- 主要な決定事項: 問題1（check_ocr.py）は既に解消済み。問題2〜4は密接に連動しており、.gitmodulesの再作成、bash-whitelist.jsのコミット、サブモジュールポインタの更新を順序立てて実施する必要がある
- 次フェーズで必要な情報: 親リポジトリのサブモジュール設定（remote URL）、workflow-plugin内の未コミットファイルの扱い方針、verify-sync.test.tsとmcp-server/hooks/lib/の追跡要否

---

## 問題1: check_ocr.py フック設定の確認

`.claude/settings.json` を実際に読み取り、現在の設定内容を確認した。`UserPromptSubmit` フックは設定ファイルに存在しない。現在のフック設定は以下のとおり：

- `PreToolUse` に4つのフック（enforce-workflow, phase-edit-guard, spec-first-guard, loop-detector）が登録されており、全て `workflow-plugin/hooks/` 配下のファイルを参照している
- `Write` ツール向けに check-spec.js と check-test-first.js が追加登録されている
- `Bash` ツール向けに block-dangerous-commands.js が登録されている
- `PostToolUse` に3つのフック（check-workflow-artifact, spec-guard-reset, check-spec-sync）が登録されている

OCR関連の `check_ocr.py` や `UserPromptSubmit` エントリは完全に削除されており、問題1は既に修正済みの状態である。

---

## 問題2: .gitmodules ファイルが存在しない（根本問題）

### 調査結果

親リポジトリ（`C:\ツール\Workflow`）において、以下の事実が確認された：

- `git ls-files --stage workflow-plugin` の出力: `160000 4331072977f0e0851ccbd4ce2b40229442799afd 0 workflow-plugin`
- モード `160000` はgitlinkオブジェクト、すなわちサブモジュールの参照であることを示している
- しかし `.gitmodules` ファイルが存在しない（`cat .gitmodules` で `No such file or directory` を確認）
- `git submodule status` を実行すると `fatal: no submodule mapping found in .gitmodules for path 'workflow-plugin'` エラーが発生する

### 根本原因の分析

`.gitmodules` はサブモジュールのメタ情報（remote URLとローカルパスのマッピング）を格納するファイルである。このファイルが存在しない場合、gitはインデックスに記録されたgitlinkオブジェクトを解釈できない。考えられる原因は以下のいずれかである：

- `git submodule add` 以外の方法でワークフロープラグインディレクトリが追加された
- `.gitmodules` がコミット後に誤って削除された
- `git rm --cached` 等の操作で一部設定のみが消えた

### 修正に必要な情報

修正時には以下の内容で `.gitmodules` を作成する必要がある：

```
[submodule "workflow-plugin"]
    path = workflow-plugin
    url = https://github.com/karimatan1106/workflow-plugin
```

workflow-pluginのリモートURLは `https://github.com/karimatan1106/workflow-plugin` であることを `git remote -v` で確認済みである。

---

## 問題3: workflow-plugin 内の未コミット変更

### 調査結果

`workflow-plugin` ディレクトリ内の `git status` 実行結果は以下のとおり：

- `M hooks/bash-whitelist.js`（追跡済みファイルの変更）
- `?? mcp-server/hooks/`（未追跡ディレクトリ）
- `?? mcp-server/src/verify-sync.test.ts`（未追跡ファイル）

### bash-whitelist.js の変更内容

`git diff` で確認した変更は1行のみである：

```
-  const verificationPhases = ['security_scan', 'performance_test', 'e2e_test', 'ci_verification'];
+  const verificationPhases = ['security_scan', 'performance_test', 'e2e_test', 'ci_verification', 'parallel_verification'];
```

`getWhitelistForPhase` 関数の `verificationPhases` 配列に `parallel_verification` が追加されている。この変更により、`parallel_verification` フェーズで `readonly + testing + gh` コマンドが許可されるようになる。変更前は `parallel_verification` が `else` 節に落ちて `readonly` のみが許可されていた。

### 未追跡ファイルの詳細

`mcp-server/hooks/lib/` には以下のファイルが存在する：

- `discover-tasks.js`
- `task-cache.js`

`mcp-server/src/verify-sync.test.ts` はMCPサーバーの同期検証に関するテストファイルと推測される。これらのファイルはgitで追跡されていないため、コミットするか `.gitignore` に追加するかの判断が必要である。

### 最新コミットとの関係

`workflow-plugin` のHEAD（commit `4ead400`）は「regression_test遷移バグ3件の根本修正」であり、この中で以下が変更された：

- `mcp-server/src/tools/__tests__/bug-fix-regression-transition.test.ts`（628行の新規テスト）
- `mcp-server/src/tools/__tests__/record-test-result-output.test.ts`（15行変更）
- `mcp-server/src/tools/next.ts`（18行変更）
- `mcp-server/src/tools/record-test-result.ts`（10行変更）

`bash-whitelist.js` の変更と未追跡ファイルはこのコミットに含まれておらず、次回コミット対象として残っている状態である。

---

## 問題4: 親リポジトリのサブモジュールポインタが古い

### 調査結果

親リポジトリが `HEAD` のツリーで追跡する `workflow-plugin` のコミットハッシュは以下のとおり確認された：

- 親リポジトリが記録しているポインタ: `4331072977f0e0851ccbd4ce2b40229442799afd`（commit `4331072`）
- `workflow-plugin` のHEAD: `4ead4007b0677f7ea7f4490cd92a71b502a24a4a`（commit `4ead400`）

`git log --oneline 4331072..4ead400` の結果、未記録のコミットが1件存在する：

```
4ead400 fix: resolve regression_test transition bugs - hash self-reference skip and output truncation
```

このコミットは2026年2月19日16:57:54（JST）に作成されたもので、regression_testフェーズに関する3つのバグ修正（ハッシュ自己参照スキップ、テスト出力接頭辞追加、出力長制限の拡張）と12件のテストケースを含む。

### 状況の整理

親リポジトリの最新コミット `c12f235`（2026年2月19日15:43:20）は `workflow-plugin` を `4331072` に設定している。その後、`workflow-plugin` 内でコミット `4ead400` が作成されたが、親リポジトリのサブモジュールポインタが更新されていない。この状態では、`git submodule update` を実行すると `4ead400` ではなく `4331072` のコードが使われてしまう。

---

## 問題間の依存関係と修正順序

4つの問題は以下の順序で対処する必要がある：

問題1は既に解消済みであるため、対応不要である。

問題2（.gitmodules欠落）は他の問題の前提条件となっており、最初に修正する必要がある。.gitmodulesを作成してコミットすることで、gitがサブモジュール構造を正しく認識できるようになる。

問題3（workflow-plugin内の未コミット変更）は、bash-whitelist.jsの変更と未追跡ファイルを整理してコミットし、workflow-pluginのHEADを先に確定させる必要がある。

問題4（親リポのポインタ更新）は、問題3の対応で workflow-plugin のHEADが確定した後に、親リポジトリからサブモジュールポインタを更新してコミットする。

この順序で対処することで、3つの問題を一貫した状態に解消できる。

---

## 修正作業の全体像

### 前提確認事項

実装フェーズに入る前に以下の点を仕様として確定する必要がある：

- `mcp-server/src/verify-sync.test.ts` はサブモジュールに追加すべきか（追跡対象）、それとも除外すべきか（.gitignore対象）
- `mcp-server/hooks/lib/discover-tasks.js` および `task-cache.js` の追跡方針
- これら未追跡ファイルが `workflow-plugin` の動作に必要かどうか

### 修正対象ファイル

修正が必要なファイルと配置先のリポジトリをまとめると以下のとおりである：

- 親リポジトリ（`C:\ツール\Workflow`）に `.gitmodules` を新規作成する
- `workflow-plugin` リポジトリで `hooks/bash-whitelist.js` の変更をコミットする
- 未追跡ファイルを追跡対象にするか除外するかを決定してコミットする
- 親リポジトリで `workflow-plugin` のサブモジュールポインタを最新HEADに更新してコミットする

### 修正後の期待動作

修正完了後は以下の動作が期待される：

- `git submodule status` が正常に実行され、`+` や `-` ではなく現在のコミットが表示される
- `parallel_verification` フェーズでBashコマンドが適切に許可される（gh, npm test等）
- 親リポジトリのサブモジュールポインタが最新のworkflow-plugin HEADを指す
