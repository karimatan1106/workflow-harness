# 調査結果: task-index.jsonキャッシュ同期問題

## サマリー

task-index.jsonはhookのパフォーマンス向上のためのキャッシュファイルだが、MCP serverのフェーズ遷移と同期されていない。
commitフェーズでgit addがブロックされた直接原因は、task-index.jsonが"implementation"のまま更新されなかったこと。
根本原因は3つ: (A) MCP server側の不完全な同期、(B) 2層キャッシュの不整合、(C) B-2チェックの到達不能。
修正方針はMCP serverのフェーズ遷移時にtask-index.jsonを即座に更新し、hookの実行順序を修正すること。
影響ファイル: manager.ts, next.ts, phase-edit-guard.js, discover-tasks.js の4ファイル。

## 調査結果

task-index.jsonはhookのパフォーマンス向上のためのキャッシュファイルだが、MCP serverのフェーズ遷移と同期されていない。
MCP serverはworkflow-state.jsonを更新するが、task-index.jsonの更新が不完全または遅延する。
hookのdiscover-tasks.jsはtask-index.jsonを1時間TTLで読み取るため、古いフェーズ情報でbash-whitelistが判定する。
commitフェーズでgit addがブロックされた直接原因は、task-index.jsonが"implementation"のまま更新されなかったこと。
根本原因は3つ: (A) MCP server側の不完全な同期、(B) 2層キャッシュの不整合、(C) B-2チェックの到達不能。
修正方針はMCP serverのフェーズ遷移時にtask-index.jsonを即座に更新すること。

## 1. task-index.jsonの更新タイミング

MCP server側のmanager.tsにはsaveTaskIndex()メソッド(L468)が存在する。
updateTaskPhase()メソッド(L783-818)がフェーズ遷移時にsaveTaskIndex()を呼び出す設計になっている。
しかしsaveTaskIndex()はdiscoverTasks()を呼び出してディスクを再走査する重い処理である。
実際にはnext.tsのフェーズ遷移ロジックがsaveTaskIndex()を正しく呼んでいない可能性がある。
workflow-state.jsonは直接saveState()で更新されるが、task-index.jsonの更新パスが異なる。

## 2. hook側のキャッシュ読み取りロジック

discover-tasks.jsのreadTaskIndexCache()(L48-85)がtask-index.jsonを読み取る。
TTLは1時間(TASK_INDEX_TTL = 60 * 60 * 1000)でハードコードされている。
さらにtask-cache.jsのメモリキャッシュが300秒TTLで存在する2層構造になっている。
スキーマバージョンv2チェック(L56)を通過すると、キャッシュデータがそのまま返される。
TTL内であれば古いフェーズ情報がそのまま使用される致命的な問題がある。

## 3. bash-whitelistとB-2チェックの実行順序

phase-edit-guard.jsのL1432-1480で以下の順序で実行される。
まずfindActiveWorkflowState(null)でtask-index.jsonからフェーズを読み取る(L1435-1437)。
次にcheckBashWhitelist(command, phase)を実行する(L1440)。
このbash-whitelistチェックが失敗するとexit(BLOCK)で即座に終了する(L1462)。
B-2のcommit/pushチェック(L1489-1532)はbash-whitelistチェックの後にあるため到達不能になる。
staleなtask-index.jsonが"implementation"を返すと、git addはimplementationのwhitelistで判定される。
implementationのwhitelistにはgit addが含まれるが、cd && git addのチェーン分割で失敗する。

## 4. 根本原因の特定

原因A: MCP serverがworkflow-state.jsonを更新した後、task-index.jsonの更新が遅延または欠落している。
saveTaskIndex()はdiscoverTasks()を呼び出して全タスクを再走査するため重い処理だが、
フェーズ遷移のたびに正しく呼ばれていない可能性がある。
原因B: hookの2層キャッシュ(メモリ300秒 + ファイル1時間)が不整合を起こしている。
MCP serverが更新しても、hook側キャッシュのTTL内は古い値が返される。
原因C: bash-whitelistチェックがB-2 commit/pushチェックより先に実行されるため、
古いフェーズでbash-whitelistが失敗するとB-2に到達せずブロックされる。

## 既存実装の分析

manager.tsのsaveTaskIndex()はdiscoverTasks()経由で全タスクディレクトリをスキャンしてtask-index.jsonを再構築する。
next.tsのフェーズ遷移ロジックではsaveState()でworkflow-state.jsonを更新するが、saveTaskIndex()の呼び出しが不確実。
discover-tasks.jsはreadTaskIndexCache()でtask-index.jsonを1時間TTLで読み取り、キャッシュミス時のみディレクトリスキャンを行う。
phase-edit-guard.jsではbash-whitelistチェック(L1440)がB-2 commit/pushチェック(L1489)より前に実行される。
task-cache.jsのメモリキャッシュ(300秒TTL)とtask-index.jsonファイルキャッシュ(1時間TTL)の2層構造が不整合の温床になっている。

## 5. 修正方針

方針1: MCP serverのフェーズ遷移(next.ts)でsaveTaskIndex()を確実に呼ぶ。
方針2: saveTaskIndex()を軽量化し、ディスク走査なしで対象タスクのフェーズのみ更新する。
方針3: hook側でtask-index.jsonのキャッシュTTLを短くする(例: 30秒)。
方針4: phase-edit-guard.jsでB-2 commit/pushチェックをbash-whitelistチェックより前に移動する。
方針1+2+4の組み合わせが最も確実な修正となる。
