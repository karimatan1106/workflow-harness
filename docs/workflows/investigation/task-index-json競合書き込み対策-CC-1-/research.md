## サマリー

- 目的: `discover-tasks.js` の `writeTaskIndexCache` が MCP サーバーのロック保持中に `task-index.json` を上書きする競合リスクへの対策を調査・整理する
- 主要な決定事項: ロックファイル（`task-index.json.lock`）の存在チェックを `writeTaskIndexCache` の先頭に追加することで、MCP サーバーがロックを保持している間の hook による上書きを防止できると判断した
- 次フェーズで必要な情報: 変更対象は `workflow-plugin/hooks/lib/discover-tasks.js` の `writeTaskIndexCache` 関数（1ファイル、約5行の追加）。テスト対象は `workflow-plugin/mcp-server/src/__tests__/` 配下の既存テスト群と新規追加テスト

---

## 調査結果

### 対象ファイルの概要

**`workflow-plugin/hooks/lib/discover-tasks.js`** は 302 行のモジュールで、hook が使用するタスク検出ロジックを担う。
主要な関数は `readTaskIndexCache`（L48-97）、`writeTaskIndexCache`（L106-146）、`discoverTasks`（L159-207）の3つであり、`discoverTasks` と `findTaskByFilePath` が外部に公開される。

**`workflow-plugin/mcp-server/src/state/manager.ts`** は MCP サーバー側の状態管理モジュールであり、`acquireLockSync`（L104-136）と `updateTaskIndexForSingleTask`（L507-548）がロック付きアトミック書き込みを担当する。

### 競合が発生する具体的なシナリオ

時系列で整理すると以下のとおりである。

1. T+0ms: MCP サーバーが `acquireLockSync()` を呼び出し、`task-index.json.lock` を O_EXCL で排他作成してロックを取得する
2. T+5ms: hook の `discoverTasks()` が呼び出され、`readTaskIndexCache` でキャッシュミスが発生する
3. T+8ms: ファイルシステムスキャンが完了し、新しいタスクリストが構築される
4. T+10ms: `writeTaskIndexCache` が呼び出される。この時点での `updatedAt` 1秒チェックは通過する（MCP がロックを取得しただけで書き込みはまだ完了していないため）
5. T+11ms: hook が `renameSync` で `task-index.json` を上書きする（ロックファイルを参照していないため通過してしまう）
6. T+15ms: MCP サーバーが `atomicWriteJson` で正しいフェーズ情報を書き込み、hook の書き込み内容を上書きする
7. T+20ms: MCP がロックを解放する

この流れでは、T+11ms の hook 書き込みと T+15ms の MCP 書き込みが交差する可能性がある。
特に MCP が T+8ms に読み込んだデータを基に書き込む場合、T+11ms の hook 書き込みが影響しない設計になっているが、逆方向（hook が T+8ms のスキャン結果で古いフェーズ情報を書き込む）のリスクが残る。

### 既存対策が防げないケース

`writeTaskIndexCache` の `updatedAt 1秒チェック`（L110-122）は、MCP が1秒以内に書き込んだ場合にスキップするが、ロック期間が1秒を超えることがある（タイムアウトまで最大1秒）ため、ロック保持中の書き込みは防げない。
`readTaskIndexCache` の `mtime チェック`（L71-80）は読み取り時の無効化には効果があるが、競合書き込み後の次回読み取りまで古いデータが使用され続けるリスクがある。
`workflow-state.json` には HMAC 整合性チェックが適用されているが、`task-index.json` には HMAC が適用されていないため、不整合なデータが書き込まれてもホックが検出できない。

---

## 既存実装の分析

### `writeTaskIndexCache`（L106-146）の詳細

この関数はタスクリストをキャッシュ形式でファイルに書き込む処理を行う。
主な処理フローは以下のとおりである。

- L108: 現在時刻を `now` に記録する
- L111-122: 既存ファイルが存在する場合、`updatedAt` が1秒以内かチェックしてスキップ判断する
- L124-128: スキーマバージョン2のキャッシュオブジェクトを構築する
- L131-142: 一時ファイル（`{TASK_INDEX_FILE}.{pid}.tmp`）への書き込み後に `renameSync` でアトミック置換する

この実装では MCP サーバーが `task-index.json.lock` を保持中であっても、hook は `renameSync` を通じて `task-index.json` を上書きできてしまう。
`renameSync` 自体はアトミックな操作だが、ロックファイルのセマンティクスを理解していないため、意図せずロック保護された操作に割り込んでしまう。

### `acquireLockSync`（L104-136）の詳細

MCP サーバー側のロック機構は以下の仕様で動作する。

- ロックファイルのパス: `{indexPath} + '.lock'`（`task-index.json.lock`）
- `fs.openSync(lockFile, 'wx')` による O_EXCL 排他作成でロックを取得する
- ロックファイルには `{ pid, timestamp }` の JSON を書き込む
- リトライ設定は maxRetries=10、retryDelay=100ms で最大1秒間リトライする
- 10秒以上古いロックファイルは自動削除（ゾンビロック対策）する

### `updateTaskIndexForSingleTask`（L507-548）の動作

この関数はフェーズ遷移時にインデックスを更新する主要な経路であり、FIX-1 として実装済みである。
ロック取得後に既存の `task-index.json` を読み込み、対象タスクのエントリのみを更新してアトミックに書き込む。
`completed` フェーズ移行時はエントリを削除し、それ以外はフェーズと HMAC を更新する。
この関数が正しく動作していても、hook の `writeTaskIndexCache` が同時実行されると、MCP の書き込み結果が hook のスキャン結果（古いフェーズ情報）で上書きされるリスクがある。

### 既存対策の効果範囲と限界

| 対策 | 実装箇所 | 有効なケース | 対処できないケース |
|------|---------|-------------|------------------|
| `updatedAt` 1秒チェック | `writeTaskIndexCache` L110-122 | MCP が1秒以内に書き込んだ場合のスキップ | ロック保持中（書き込み前）の競合 |
| mtime チェック | `readTaskIndexCache` L71-80 | 読み取り時に更新を検出してキャッシュを無効化 | 競合書き込み後の次回読み取りまでの期間 |
| HMAC 整合性 | `workflow-state.json` のみ | 状態ファイル自体の改ざん防止 | `task-index.json` の不整合検出 |

### 提案する修正（CC-1 Fix）の概要

変更対象: `workflow-plugin/hooks/lib/discover-tasks.js` の `writeTaskIndexCache` 関数先頭
変更内容: `TASK_INDEX_FILE + '.lock'` の存在を確認し、存在する場合は書き込みをスキップする処理を追加する
追加行数: 約5行
影響範囲: ロックファイルが存在する間（通常1秒以下）は hook 側のキャッシュ書き込みがスキップされ、次の TTL 期間（30秒）後に改めてスキャンが行われる
後方互換性: MCP サーバーが起動していない環境ではロックファイルが生成されないため、既存の動作に影響しない
