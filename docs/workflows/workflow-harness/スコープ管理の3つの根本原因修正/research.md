# スコープ管理の3つの根本原因修正 - 調査結果

## サマリー

前回タスク実行中に発生した3つのスコープ管理問題の根本原因を特定した。

- 問題1: `set-scope.ts:318-324` でscope更新時にpreExistingChangesが消失
- 問題2: `scope-validator.ts:160-162` でfs.existsSyncのみ使用（git追跡未確認）
- 問題3: `bash-whitelist.js:87-90` でcommitフェーズにrm不許可

3件とも修正方針が明確で、既存テストへの影響は限定的。

## 調査結果

前回のワークフロータスク「構造的問題9件の根本原因修正」実行中に、docs_update→commit遷移がSCOPE_STRICTでブロックされた。
remotionディレクトリ（タスク開始前に削除済み）のファイルがgit diff HEADに出現し、スコープ外変更として検出された。
preExistingChangesが空だったため、ワークフロー開始前の変更がスキップされなかった。
調査の結果、3つの根本原因を特定した。それぞれの修正方針を策定し、既存テストへの影響は限定的であることを確認した。
修正対象ファイルは set-scope.ts、scope-validator.ts、bash-whitelist.js の3ファイルである。

## 既存実装の分析

現在のスコープ管理は start.ts、set-scope.ts、scope-validator.ts、next.ts の4ファイルで連携する。
start.ts の行100-118で workflow_start 時にgit diff HEADの結果をpreExistingChangesとしてscopeオブジェクトに保存する。
set-scope.ts の行316-324で workflow_set_scope 時にscopeオブジェクトを新規構築するが、preExistingChangesフィールドを引き継がない。
scope-validator.ts の行160-162で validateScopeExists がfs.existsSyncのみを使用し、git追跡状態を確認しない。
next.ts の行360-394で docs_update→commit遷移時にvalidateScopePostExecutionを呼び出し、SCOPE_STRICTモードで違反をブロックする。
bash-whitelist.js の行87-90でcommitフェーズに許可されるBashコマンドにrmが含まれておらず、一時ファイルの削除が不可能である。

## 問題1: preExistingChangesの上書き消去

### 根本原因
- **ファイル**: `workflow-plugin/mcp-server/src/tools/set-scope.ts:318-324`
- `start.ts:114-118` で `scope.preExistingChanges` に保存した値が、`set-scope.ts` のscope再構築で消失
- 新オブジェクト `{ affectedFiles, affectedDirs }` でscopeを置換するためpreExistingChangesフィールドが失われる

### 再現条件
1. workflow_start でpreExistingChangesが記録される
2. workflow_set_scope でscopeオブジェクトが新規作成されpreExistingChangesが消失
3. docs_update→commit遷移時にpreExistingChangesが空のためスコープ外変更としてブロック

### 修正方針
- set-scope.ts:318-324で既存のpreExistingChangesを保持するよう修正

## 問題2: 削除済みディレクトリのスコープ追加不可

### 根本原因
- **ファイル**: `workflow-plugin/mcp-server/src/validation/scope-validator.ts:160-162`
- validateScopeExistsがfs.existsSync()のみを使用
- git追跡済みだがディスク削除済みのディレクトリを拒否

### 再現条件
1. gitで追跡されたディレクトリをディスクから削除
2. workflow_set_scopeでそのディレクトリを追加しようとする
3. 「存在しないディレクトリ」エラーで拒否される

### 修正方針
- fs.existsSyncに加えてgit ls-filesでgit追跡状態を確認する
- git管理対象であれば存在チェックをパスさせる

## 問題3: commitフェーズでrm不許可

### 根本原因
- **ファイル**: `workflow-plugin/hooks/bash-whitelist.js:87-90`
- commitフェーズのBashホワイトリスト（gitカテゴリ）にrmが含まれない
- build_checkフェーズではrm許可されているが、commitでは不許可

### 再現条件
1. 一時ファイル（scope-placeholder.md等）をcommitフェーズで削除しようとする
2. phase-edit-guardがrmをブロックする

### 修正方針
- commitフェーズのホワイトリストに限定的なrm（一時ファイル削除用）を追加
