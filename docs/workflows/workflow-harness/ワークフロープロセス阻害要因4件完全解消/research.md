## サマリー

ワークフロープロセスの実運用で発見された構造的阻害要因4件を調査した。
全て再現可能であり、コード修正で解消可能である。

- 目的: ワークフロー全19フェーズの完走を阻害する構造的問題の特定と修正方針の決定
- 主要な決定事項: 4件全てがコード修正で解消可能（B-4のみドキュメント対応）
- 次フェーズで必要な情報: 各ブロッカーの正確なコード位置と修正方針

## 調査結果

### B-1: 複数タスク存在時の非決定的タスク選択

**現象**: 複数のアクティブタスクが存在する場合、`findActiveWorkflowTask()`がファイルパスからタスクを特定できないときに`tasks[0]`にフォールバックする。`fs.readdirSync()`の返却順序はファイルシステム依存であり、非決定的。

**影響箇所**:
- `workflow-plugin/hooks/phase-edit-guard.js:763-775` - `findActiveWorkflowTask()`
- `workflow-plugin/hooks/lib/discover-tasks.js:50` - `fs.readdirSync()`による列挙

**現在のコード**:
```javascript
function findActiveWorkflowTask(filePath) {
  if (filePath) {
    const matchedTask = findTaskByFilePathUnified(filePath);
    if (matchedTask) { return matchedTask; }
  }
  const tasks = discoverTasksUnified();
  return tasks[0] || null; // 非決定的
}
```

**修正方針**: `discoverTasks()`の返却値をtaskId降順でソートし、最新のタスクを優先する。

### B-2: commit/pushフェーズでgit操作が全てブロック

**現象**: `phase-rules.js`でcommitフェーズとpushフェーズの編集可能ファイルタイプが空配列`[]`に設定されている。このため`git add`、`git commit`、`git push`を含む全てのBashコマンドがブロックされる。

**影響箇所**:
- `workflow-plugin/hooks/modules/phase-rules.js:37-38` - `commit: [], push: []`
- `workflow-plugin/hooks/phase-edit-guard.js:1259-1272` - `ALWAYS_ALLOWED_BASH_PATTERNS`にgit write操作が未登録
- `workflow-plugin/hooks/phase-edit-guard.js:1344-1347` - git commit heredoc形式の部分的ホワイトリスト

**現在のコード (phase-rules.js)**:
```javascript
commit: [],
push: [],
```

**修正方針**:
1. `phase-rules.js`のcommit/pushフェーズに`'git'`ファイルタイプを追加（新タイプ）
2. `phase-edit-guard.js`の`analyzeBashCommand()`にcommit/pushフェーズ用のgit操作ホワイトリストを追加
3. ホワイトリスト対象: `git add`, `git commit`, `git push`, `git tag`

### B-3: testBaselineの記録がresearchフェーズに限定

**現象**: `workflow_capture_baseline`がresearchフェーズでのみ使用可能。しかし、testingフェーズからregression_testへの遷移時にtestBaselineが必須。researchフェーズでベースライン取得を忘れた場合、regression_testフェーズへ進めなくなる。

**影響箇所**:
- `workflow-plugin/mcp-server/src/tools/test-tracking.ts:162-168` - フェーズ制限
- `workflow-plugin/mcp-server/src/tools/next.ts:243-248` - testBaseline必須チェック

**現在のコード**:
```typescript
if (taskState.phase !== 'research') {
  return {
    success: false,
    message: `ベースライン記録はresearchフェーズでのみ可能です。現在: ${taskState.phase}`,
  };
}
```

**修正方針**: captureBaselineを`research`と`testing`の両フェーズで許可する。testingフェーズでの取得は「遅延ベースライン」として記録。

### B-4: MCPサーバーのモジュールキャッシュ

**現象**: Node.jsの`require()`はモジュールを一度ロードするとメモリにキャッシュする。MCPサーバーが起動中にdist/配下のJSファイルを更新しても、キャッシュ済みモジュールが使われ続ける。

**影響**: コード修正後にMCPサーバーの再起動が必要。これはNode.jsの仕様であり、コード修正では根本解決できない。

**修正方針**: ドキュメント化のみ。CLAUDE.mdまたはREADMEにMCPサーバー再起動の必要性を明記。

## テストベースライン

- テストフレームワーク: vitest v2.1.9
- テストファイル数: 63
- テスト総数: 732
- 成功: 732
- 失敗: 0

## 既存実装の分析

現在のワークフロープラグインは19フェーズの開発プロセスを強制するシステムである。
フック(phase-edit-guard.js)とMCPサーバーの2層構成で動作する。
フックはBashコマンドとファイル編集をフェーズに応じてブロックする役割を持つ。
MCPサーバーはワークフロー状態管理とフェーズ遷移を制御する。

discover-tasks.jsはワークフローディレクトリをスキャンしてアクティブタスクを返す。
ただしソート未実装のためfs.readdirSyncの返却順序に依存している。
phase-rules.jsは各フェーズで許可するファイルタイプを定義するモジュールである。
commit/pushフェーズは空配列に設定されておりgit操作自体がブロックされる。
test-tracking.tsのcaptureBaselineはresearchフェーズ限定である。
しかしregression_testへの遷移にはtestBaselineが必須という矛盾がある。
phase-edit-guard.jsのanalyzeBashCommand関数はコマンド解析の中核であり約100行のロジックを持つ。
ALWAYS_ALLOWED_BASH_PATTERNSはgit statusやgit logなど読み取り専用コマンドのみを許可する。

## 影響範囲

### 変更対象ファイル
1. `workflow-plugin/hooks/lib/discover-tasks.js` - タスクソート追加
2. `workflow-plugin/hooks/modules/phase-rules.js` - commit/pushフェーズルール修正
3. `workflow-plugin/hooks/phase-edit-guard.js` - git操作ホワイトリスト追加
4. `workflow-plugin/mcp-server/src/tools/test-tracking.ts` - フェーズ制限緩和

### 変更対象ディレクトリ
- `workflow-plugin/hooks/`
- `workflow-plugin/hooks/lib/`
- `workflow-plugin/hooks/modules/`
- `workflow-plugin/mcp-server/src/tools/`
