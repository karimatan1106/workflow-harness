# 実装仕様書: task-index.jsonキャッシュ同期の根本原因修正

## サマリー

commitフェーズでgit addがブロックされる問題の根本原因を3つ特定し、それぞれに対する修正を定義する。
根本原因A: manager.tsのupdateTaskPhase()でsaveTaskIndex()がdiscoverTasks()経由で古いキャッシュを読み取る。
taskCache.invalidate()がsaveTaskIndex()の後に呼ばれるため、saveTaskIndex()内のdiscoverTasks()が古いキャッシュを返す。
修正: updateTaskIndexForSingleTask()メソッドを追加し、discoverTasks()を経由せず直接task-index.jsonの該当タスクのみ更新する。
根本原因B: phase-edit-guard.jsでbash-whitelistチェック(L1440)がB-2 commit/pushチェック(L1488)より前に実行される。
修正: B-2チェックをbash-whitelistチェックの前に移動し、commit/pushフェーズのgit操作が優先的に許可されるようにする。
根本原因C: discover-tasks.jsのキャッシュTTLが1時間と長すぎるが、環境変数で既にオーバーライド可能なためドキュメント更新のみ。
影響ファイル: manager.ts, phase-edit-guard.js の2ファイル。既存772テスト全通過を保証する。

## 概要

本仕様書はtask-index.jsonキャッシュの同期問題を根本的に解決するための実装計画を定義する。
この問題はcommitフェーズでgit addがブロックされる形で顕在化し、ワークフロープラグインの信頼性を損なっている。
原因はMCP serverのフェーズ遷移時にtask-index.jsonが古いキャッシュデータで上書きされること、
およびphase-edit-guard.jsでB-2 commit/pushチェックがbash-whitelistチェックより後に配置されていることの2つである。
修正は最小限の変更に留め、manager.tsに軽量更新メソッドを追加し、phase-edit-guard.jsのチェック順序を入れ替える。
next.tsの変更は不要で、discover-tasks.jsは環境変数による既存のTTLオーバーライド機能で対応可能なため変更しない。
既存の772テストケースの全通過を保証し、新規テストケース8件を追加して修正の正当性を検証する。

## 変更対象ファイル

本タスクで変更するファイルは以下の2ファイルに限定される。
影響範囲を最小化することで、既存の動作への副作用リスクを低減する。
変更しないファイル(next.ts, discover-tasks.js)についてもその理由を明記する。

### 変更するファイル

**workflow-plugin/mcp-server/src/state/manager.ts** はFIX-1の主要な変更対象である。
updateTaskIndexForSingleTask()メソッドを新規追加し、updateTaskPhase()内のsaveTaskIndex()呼び出しを置き換える。
変更量は約50行の追加と5行の置換で、既存のsaveTaskIndex()メソッドには手を加えない。

**workflow-plugin/hooks/phase-edit-guard.js** はFIX-2の変更対象である。
L1432-1532の範囲でB-2 commit/pushチェックブロックをbash-whitelistチェックの前に移動する。
ロジック自体の変更はなく、コードブロックの順序入れ替えのみで実現する。

### 変更しないファイル

**workflow-plugin/mcp-server/src/tools/next.ts** はFIX-1によりupdateTaskPhase()内部で
task-index.json更新が完結するため、next.ts側での追加呼び出しは不要である。

**workflow-plugin/hooks/lib/discover-tasks.js** はL65で環境変数TASK_INDEX_TTL_MSによる
TTLオーバーライドが既に実装されているため、コード変更なしで運用対応が可能である。

## 根本原因の詳細分析

### 原因A: saveTaskIndex()のキャッシュ競合

manager.ts L783-818のupdateTaskPhase()メソッドの実行順序に問題がある。

1. L794: `taskState.phase = phase` でメモリ上のオブジェクトを更新
2. L801: `atomicWriteJson(stateFile, stateWithSignature)` でworkflow-state.jsonに書き込み
3. L814: `this.saveTaskIndex(index)` を呼び出し
4. L468-491のsaveTaskIndex()内部で `this.discoverTasks()` を呼び出し(L470)
5. discoverTasks() L520-524で `taskCache.get('task-list')` をチェック、キャッシュにヒットすると古いデータを返す
6. 古いデータでtask-index.jsonを書き込み
7. L817: `taskCache.invalidate('task-list')` でキャッシュを無効化するが、既にsaveTaskIndex()は完了済み

結果として、task-index.jsonには古いフェーズ情報が書き込まれる。

### 原因B: B-2チェックの到達不能

phase-edit-guard.js L1432-1532の実行順序に問題がある。

1. L1435: `findActiveWorkflowState(null)` でtask-index.jsonからフェーズを取得
2. L1440: `checkBashWhitelist(command, phase)` でホワイトリストチェック実行
3. L1462: ホワイトリスト不一致で `process.exit(EXIT_CODES.BLOCK)` 即座に終了
4. L1488-1532: B-2 commit/pushチェックには到達しない

task-index.jsonが古い"implementation"フェーズを返すと、implementationのホワイトリストでgit addが判定される。
commitフェーズ固有のB-2ロジックに到達できないため、git addがブロックされる。

### 原因C: キャッシュTTLの設定

discover-tasks.js L21のTASK_INDEX_TTLが1時間(3600000ms)に設定されている。
ただしL65で環境変数TASK_INDEX_TTL_MSによるオーバーライドが既に実装されている。
原因Aが修正されればTTLの影響は軽微になるため、REQ-4はドキュメント更新のみとする。

## 実装計画

本修正はFIX-1とFIX-2の2段階で実施し、それぞれ独立してテスト可能とする。
FIX-1はMCP server側のキャッシュ競合を解消し、FIX-2はhook側の防御的なチェック順序修正を行う。
両方が完了することで、キャッシュ同期問題の根本原因と表面的な症状の両方が解消される。
FIX-1のみでも問題は解消されるが、FIX-2を追加することでキャッシュ遅延に対する耐性が向上する。
テストは既存772件の全通過を確認した上で、新規8件を追加して修正の正当性を検証する。

### ステップ1: FIX-1 updateTaskIndexForSingleTask()の実装

manager.tsにupdateTaskIndexForSingleTask()プライベートメソッドを追加する。
このメソッドはdiscoverTasks()を経由せず、task-index.jsonを直接読み込んで該当タスクのphaseのみ更新する。
updateTaskPhase()内のsaveTaskIndex()呼び出しをupdateTaskIndexForSingleTask()に置き換える。

### ステップ2: FIX-2 B-2チェック順序の修正

phase-edit-guard.jsのL1432-1532で、B-2 commit/pushチェックをbash-whitelistチェックの前に移動する。
コードブロックの順序入れ替えのみで、ロジック自体は変更しない。

### ステップ3: テスト追加と全テスト実行

新規テストケース8件を追加し、既存772件を含む全テストの通過を確認する。

## 修正仕様

### FIX-1: updateTaskIndexForSingleTask()メソッド追加 (manager.ts)

#### 変更箇所
manager.ts L491の後に新メソッドを追加する。

#### 実装仕様

```typescript
/**
 * 単一タスクのフェーズをtask-index.jsonで更新する（軽量版）
 *
 * saveTaskIndex()のdiscoverTasks()経由の重い処理を回避し、
 * task-index.jsonの該当タスクのphaseフィールドのみを直接更新する。
 * フェーズ遷移時のキャッシュ競合問題（原因A）を解決する。
 *
 * @param taskId 更新対象のタスクID
 * @param phase 新しいフェーズ
 * @param taskState 更新後のタスク状態（completedの場合はインデックスから削除）
 */
private updateTaskIndexForSingleTask(
  taskId: string,
  phase: PhaseName,
  taskState: TaskState
): void {
  try {
    const indexPath = path.join(STATE_DIR, 'task-index.json');
    const releaseLock = acquireLockSync(indexPath);
    try {
      // 既存のtask-index.jsonを読み込む
      let taskList: { schemaVersion: number; tasks: TaskState[]; updatedAt: number };
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        taskList = JSON.parse(content);
      } else {
        taskList = { schemaVersion: 2, tasks: [], updatedAt: Date.now() };
      }

      if (phase === 'completed') {
        // completedの場合はインデックスから削除
        taskList.tasks = taskList.tasks.filter(t => t.taskId !== taskId);
      } else {
        // 該当タスクを検索して更新
        const idx = taskList.tasks.findIndex(t => t.taskId === taskId);
        if (idx >= 0) {
          // 全フィールドを最新のtaskStateで置き換え（HMAC検証のため）
          taskList.tasks[idx] = { ...taskState, stateIntegrity: generateStateHmac(taskState) };
        } else {
          // 新規タスクの場合は追加
          taskList.tasks.push({ ...taskState, stateIntegrity: generateStateHmac(taskState) });
        }
      }
      taskList.updatedAt = Date.now();

      atomicWriteJson(indexPath, taskList);
    } finally {
      releaseLock();
    }
  } catch (err) {
    // 非致命的エラー: task-index.json更新失敗はフェーズ遷移を妨げない
    console.error('[updateTaskIndexForSingleTask] Failed:', err);
  }
}
```

#### updateTaskPhase()の修正

L806-814の既存のsaveTaskIndex()呼び出しを、updateTaskIndexForSingleTask()に置き換える。

変更前 (L806-814):
```typescript
// REQ-1: フェーズ遷移時にtask-index.jsonを更新（Hookスキーマ形式）
const index = this.loadTaskIndex();
if (phase === 'completed') {
  delete index[taskId];
  console.log(`[StateManager] Removed completed task ${taskId} from index`);
}
this.saveTaskIndex(index);
```

変更後:
```typescript
// FIX-1: フェーズ遷移時にtask-index.jsonを軽量更新
// saveTaskIndex()はdiscoverTasks()経由で古いキャッシュを読む問題があるため、
// 該当タスクのみを直接更新する軽量版を使用する
this.updateTaskIndexForSingleTask(taskId, phase, taskState);
```

### FIX-2: B-2チェック順序の修正 (phase-edit-guard.js)

#### 変更箇所
phase-edit-guard.js L1432-1532のチェック順序を変更する。

#### 実装仕様

B-2 commit/pushチェック(L1488-1532)をbash-whitelistチェック(L1440)の前に移動する。

変更後の実行順序:
1. `findActiveWorkflowState(null)` でフェーズを取得
2. **B-2チェック**: commit/pushフェーズのgit操作を優先判定して早期リターン
3. **bash-whitelistチェック**: B-2でマッチしなかった場合のフォールバック

変更後のコード構造:
```javascript
if (toolName === 'Bash') {
  const command = toolInput.command || '';

  // ワークフロー状態を確認してフェーズを取得
  let whitelistPassed = false;
  const workflowState = findActiveWorkflowState(null);
  if (workflowState) {
    const phase = workflowState.phase;
    const rule = getPhaseRule(phase, workflowState.workflowState);

    // FIX-2: B-2 commit/pushチェックをbash-whitelistより前に実行
    // キャッシュ同期遅延があっても、commit/pushフェーズのgit操作を確実に許可する
    if (phase === 'commit' || phase === 'push') {
      const lowerCmd = command.toLowerCase();
      // ... (既存のB-2ロジックをそのまま移動、amend/no-verify/forceガード含む)
    }

    // bash-whitelistチェック（B-2でマッチしなかった場合のフォールバック）
    const whitelistResult = checkBashWhitelist(command, phase);
    if (!whitelistResult.allowed) {
      // ... (既存のブロックロジック)
      process.exit(EXIT_CODES.BLOCK);
    } else {
      whitelistPassed = true;
    }
  }
  // ... (残りの処理は変更なし)
}
```

#### セキュリティ考慮

B-2チェックのロジック自体は変更しない。以下の既存ガードが全て維持される。
`git commit --amend` はcommitフェーズでもブロックされ、履歴改変を防止する。
`git commit --no-verify` はcommitフェーズでもブロックされ、hook回避を防止する。
`git push --force` および `-f` はpushフェーズでもブロックされ、強制プッシュを防止する。
commit/pushフェーズ以外ではB-2ブロックは実行されないため、他フェーズへの影響はない。

## テスト計画

### 新規テストケース

1. **updateTaskIndexForSingleTask基本動作テスト**: フェーズ遷移後にtask-index.jsonの該当タスクのphaseが正しく更新されること
2. **updateTaskIndexForSingleTask完了テスト**: completedフェーズでインデックスからタスクが削除されること
3. **updateTaskIndexForSingleTask新規タスクテスト**: task-index.jsonに存在しないタスクが追加されること
4. **updateTaskIndexForSingleTaskエラー耐性テスト**: ファイルI/Oエラー時にフェーズ遷移が妨げられないこと
5. **updateTaskIndexForSingleTask並行更新テスト**: ロック機構が正しく動作すること
6. **B-2チェック順序テスト**: commitフェーズでgit addが許可されること(B-2優先)
7. **B-2セキュリティテスト**: commit --amendとcommit --no-verifyがブロックされること(順序変更後)
8. **B-2フォールバックテスト**: B-2でマッチしないコマンドがbash-whitelistで正しく判定されること

### 既存テストの影響

既存の772テストケースは全て通過すること。特に以下のテストスイートを重点確認する。
workflow.test.tsはフェーズ遷移の基本動作を検証し、updateTaskPhase()の変更が既存動作に影響しないことを確認する。
manager.test.tsはStateManagerクラスの全メソッドをテストし、新メソッド追加が既存メソッドに影響しないことを確認する。
phase-edit-guard.test.jsはhookの判定ロジックを検証し、チェック順序変更が他のチェックに影響しないことを確認する。
bash-whitelist.test.jsはホワイトリスト判定の正当性を検証し、B-2移動後も正しく動作することを確認する。

## パフォーマンス影響分析

### FIX-1のパフォーマンス

変更前はdiscoverTasks()で全タスクディレクトリをスキャンするO(n)の処理が必要だった。
変更後はtask-index.jsonの読み込みと該当タスク検索と書き込みのみで完結する。
配列検索はO(n)だが、実質的なタスク数は10未満であり定数時間とみなせる。
JSON.parse/stringifyはタスク10件で1ms未満、ファイルI/Oは1 read + 1 write = 2回で変更なし。
ロック取得は通常1ms未満であり、合計5ms以内で現行と同等のパフォーマンスを維持する。

### FIX-2のパフォーマンス

チェック順序の変更のみで計算量に変化はなく、パフォーマンスへの影響はない。
commitフェーズでのgit操作はB-2で早期リターンとなるため、むしろ処理時間が短縮される。

## エラーハンドリング方針

updateTaskIndexForSingleTask()の失敗は非致命的エラーとして扱い、フェーズ遷移を妨げない設計とする。
try-catchでエラーをキャッチし、console.errorで詳細なログを出力して原因追跡を容易にする。
フェーズ遷移(updateTaskPhase)はtask-index.json更新の成否に関わらず正常に完了する。
hook側はtask-index.jsonが古い場合でもworkflow-state.jsonからフォールバック読み取りする既存メカニズムを活用する。
ファイルが存在しない場合は空のインデックスを新規作成し、スキーマバージョン2で初期化する。

## 後方互換性

task-index.jsonのフォーマットはschemaVersion v2のまま維持し、フォーマット変更は行わない。
MCP APIの外部インターフェースは一切変更せず、内部実装の改善のみで問題を解決する。
hook側のdiscover-tasks.jsは変更しないため、既存のTASK_INDEX_TTL_MS環境変数で運用対応が可能である。
既存のsaveTaskIndex()メソッドは定期的なフルスキャン用として保持し、削除しない。
古いバージョンのtask-index.jsonを読み込んだ場合でもエラーにならず再構築が行われる。
