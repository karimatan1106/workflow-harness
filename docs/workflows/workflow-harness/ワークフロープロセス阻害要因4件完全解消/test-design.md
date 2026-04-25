# test-design.md - ワークフロープロセス阻害要因4件完全解消

## サマリー

本テスト設計書は4件の修正（B-1タスクソート、B-2 git操作許可、B-3ベースライン記録緩和、B-4ドキュメント追記）に対する24個のテストケースを定義した設計書である。

**目的**: 各修正の正常系・異常系を網羅し、19フェーズ完走可能性を検証する包括的テスト計画を策定すること。

**主要な決定事項**:
- B-1は決定性検証テストを含む6ケース
- B-2はフェーズ別・オプション別に10ケース
- B-3はフェーズ制限・警告ログ・拒否を5ケース
- B-4は実地検証とドキュメント品質の確認3ケース
- テスト配置先は`workflow-plugin/mcp-server/src/__tests__/`以下
- vitestフレームワークを使用（既存スイートと同一環境）

**次フェーズで必要な情報**:
- test_implフェーズで24個のテストファイル作成
- discover-tasks.test.js、phase-edit-guard.test.js、test-tracking.test.tsの3ファイルに配置
- カバレッジ目標は修正部分の分岐を100%網羅

---

## 1. テスト戦略概要

### 1.1 テスト方針

**品質目標**:
- 既存732テスト全件パスの維持（リグレッション防止）
- 新規追加24テスト全件パス
- 修正部分のカバレッジ100%達成
- E2E完走テストで19フェーズ全体の動作保証

**テストレベル**:
| レベル | 内容 | 実施範囲 |
|--------|------|---------|
| 単体テスト | 関数単位の動作検証 | 24ケース |
| 統合テスト | モジュール間連携確認 | B-1/B-2各1ケース |
| E2Eテスト | 19フェーズ完走確認 | 1ケース |
| リグレッションテスト | 既存機能非破壊検証 | 732ケース全件 |

### 1.2 テストフレームワーク

**採用ツール**:
- vitest v2.1.9（既存テストスイートと統一）
- Jest互換のmock機能を使用
- describe/it/expect記法で記述

**ファイル配置ルール**:
```
workflow-plugin/mcp-server/src/__tests__/
├── hooks/
│   ├── discover-tasks.test.js     # B-1: 6ケース
│   └── phase-edit-guard.test.js   # B-2: 10ケース
└── tools/
    └── test-tracking.test.ts      # B-3: 5ケース
```

B-4（ドキュメント）は自動テスト対象外とし、手動レビューで品質確認する。

---

## 2. B-1: discover-tasks.jsのタスクソート（6テストケース）

### 2.1 TC-B1-01: 複数タスクのtaskId降順ソート検証

```javascript
describe('discover-tasks.js - B-1 modifications', () => {
  it('[TC-B1-01] 複数タスクがtaskId降順でソートされること', () => {
    // Given: 3つのタスクを異なるtaskIdで作成（意図的に非時系列順で作成）
    const stateDir = path.join(process.cwd(), '.claude/state/workflows');
    fs.mkdirSync(path.join(stateDir, '20260201_120000_古いタスク'), { recursive: true });
    fs.mkdirSync(path.join(stateDir, '20260203_150000_最新タスク'), { recursive: true });
    fs.mkdirSync(path.join(stateDir, '20260202_140000_中間タスク'), { recursive: true });

    // When: discoverTasks()を呼び出す
    const tasks = discoverTasks();

    // Then: taskIdの降順（最新→古い）に並んでいることを確認
    expect(tasks.length).toBe(3);
    expect(tasks[0].taskId).toBe('20260203_150000'); // 最新が先頭
    expect(tasks[1].taskId).toBe('20260202_140000'); // 中間が2番目
    expect(tasks[2].taskId).toBe('20260201_120000'); // 最古が最後
  });
});
```

**検証ポイント**: localeCompare()による文字列降順ソートが正しく動作するか。

---

### 2.2 TC-B1-02: 単一タスク環境でのソート正常動作

```javascript
it('[TC-B1-02] 単一タスクの場合もソートが正常動作すること', () => {
  // Given: 1つのタスクのみ存在
  const stateDir = path.join(process.cwd(), '.claude/state/workflows');
  fs.mkdirSync(path.join(stateDir, '20260209_100000_単一タスク'), { recursive: true });

  // When: discoverTasks()を呼び出す
  const tasks = discoverTasks();

  // Then: 配列長1でエラーなく返却される
  expect(tasks.length).toBe(1);
  expect(tasks[0].taskId).toBe('20260209_100000');
  expect(tasks[0].taskName).toBe('単一タスク');
});
```

**検証ポイント**: ソート処理が配列長1でもエラーを起こさないか。

---

### 2.3 TC-B1-03: 空配列の場合のエラー回避

```javascript
it('[TC-B1-03] 空配列の場合にエラーが発生しないこと', () => {
  // Given: workflowsディレクトリが存在しない、または空
  const stateDir = path.join(process.cwd(), '.claude/state/workflows');
  if (fs.existsSync(stateDir)) {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }

  // When: discoverTasks()を呼び出す
  const tasks = discoverTasks();

  // Then: 空配列が返却され、ソート処理でエラーが発生しない
  expect(tasks).toEqual([]);
});
```

**検証ポイント**: ディレクトリ不在時に早期リターンが機能し、ソート処理がスキップされるか。

---

### 2.4 TC-B1-04: 連続呼び出しでの決定性保証

```javascript
it('[TC-B1-04] 連続呼び出しで同一の順序が返却されること（決定性検証）', () => {
  // Given: 5つのタスクをランダムな順序でディレクトリに作成
  const stateDir = path.join(process.cwd(), '.claude/state/workflows');
  const taskIds = ['20260205_100000', '20260201_140000', '20260209_080000', '20260203_120000', '20260207_160000'];
  taskIds.forEach(id => {
    fs.mkdirSync(path.join(stateDir, `${id}_テスト`), { recursive: true });
  });

  // When: 10回連続でdiscoverTasks()を呼び出す
  const results = [];
  for (let iteration = 0; iteration < 10; iteration++) {
    results.push(discoverTasks());
  }

  // Then: 全ての呼び出しで同一の順序（20260209, 20260207, 20260205, 20260203, 20260201）を返す
  const firstOrder = results[0].map(t => t.taskId);
  results.forEach((result, index) => {
    expect(result.map(t => t.taskId)).toEqual(firstOrder);
  });

  // And: 先頭は必ず最新タスク
  expect(results[0][0].taskId).toBe('20260209_080000');
});
```

**検証ポイント**: ファイルシステムの非決定的な挙動に左右されず、常に同一順序を返すか。

---

### 2.5 TC-B1-05: taskIdフォーマット異常時のエッジケース

```javascript
it('[TC-B1-05] taskIdフォーマットが異なる場合のエッジケース', () => {
  // Given: 正常なtaskIdと異常なディレクトリ名が混在
  const stateDir = path.join(process.cwd(), '.claude/state/workflows');
  fs.mkdirSync(path.join(stateDir, '20260209_100000_正常タスク'), { recursive: true });
  fs.mkdirSync(path.join(stateDir, 'invalid_format'), { recursive: true }); // 正規表現に不一致
  fs.mkdirSync(path.join(stateDir, '20260208_090000_別の正常タスク'), { recursive: true });

  // When: discoverTasks()を呼び出す
  const tasks = discoverTasks();

  // Then: 正常なフォーマットのみが抽出され、正しくソートされる
  expect(tasks.length).toBe(2); // invalid_formatは除外
  expect(tasks[0].taskId).toBe('20260209_100000'); // 最新
  expect(tasks[1].taskId).toBe('20260208_090000'); // 次点
});
```

**検証ポイント**: 正規表現マッチングとソートの連携が正しく機能するか。

---

### 2.6 TC-B1-06: 統合テスト - phase-edit-guardとの連携

```javascript
it('[TC-B1-06] phase-edit-guardが最新タスクを確実に選択すること', () => {
  // Given: 3つのタスクが存在し、最新タスクが途中のフェーズにある
  const stateDir = path.join(process.cwd(), '.claude/state/workflows');
  const oldTaskDir = path.join(stateDir, '20260201_100000_古いタスク');
  const middleTaskDir = path.join(stateDir, '20260205_100000_中間タスク');
  const latestTaskDir = path.join(stateDir, '20260209_100000_最新タスク');

  fs.mkdirSync(oldTaskDir, { recursive: true });
  fs.mkdirSync(middleTaskDir, { recursive: true });
  fs.mkdirSync(latestTaskDir, { recursive: true });

  // 最新タスクの状態ファイルを作成（implementation フェーズにある想定）
  fs.writeFileSync(path.join(latestTaskDir, 'workflow-state.json'), JSON.stringify({
    taskId: '20260209_100000',
    phase: 'implementation'
  }));

  // When: phase-edit-guardのfindActiveWorkflowTask()を実行
  const activeTask = findActiveWorkflowTask(); // discover-tasks.jsを内部で呼び出す

  // Then: 最新タスク（20260209_100000）が選択される
  expect(activeTask.taskId).toBe('20260209_100000');
  expect(activeTask.phase).toBe('implementation');
});
```

**検証ポイント**: タスクソート修正がフックシステム全体で期待通りに動作するか。

---

## 3. B-2: analyzeBashCommand()のgit操作許可（10テストケース）

### 3.1 commitフェーズ関連テスト（6ケース）

#### 3.1.1 TC-B2-01: commitフェーズでgit addが許可されること

```javascript
describe('analyzeBashCommand - commit phase', () => {
  const phase = 'commit';

  it('[TC-B2-01] commitフェーズでgit addが許可されること', () => {
    // When: git add コマンドを評価
    const result = analyzeBashCommand('git add .', phase);

    // Then: 許可される
    expect(result.allowed).toBe(true);
  });

  it('[TC-B2-01-variant] git add 複数ファイル指定も許可', () => {
    const result = analyzeBashCommand('git add src/file1.js src/file2.js', phase);
    expect(result.allowed).toBe(true);
  });
});
```

**検証ポイント**: 正規表現 `/^git\s+add\s+/` が正しくマッチするか。

---

#### 3.1.2 TC-B2-02: commitフェーズでgit commit -m "msg"が許可されること

```javascript
it('[TC-B2-02] commitフェーズでgit commit -m "msg"が許可されること', () => {
  // When: git commit コマンドを評価
  const result = analyzeBashCommand('git commit -m "test message"', phase);

  // Then: 許可される
  expect(result.allowed).toBe(true);
});

it('[TC-B2-02-heredoc] heredoc形式のgit commitも許可', () => {
  const command = `git commit -m "$(cat <<'EOF'
Commit message here.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"`;
  const result = analyzeBashCommand(command, phase);
  expect(result.allowed).toBe(true);
});
```

**検証ポイント**: heredoc形式を含む複雑なコマンド文字列でも正しく判定されるか。

---

#### 3.1.3 TC-B2-03: commitフェーズでgit commit --amendがブロックされること

```javascript
it('[TC-B2-03] commitフェーズでgit commit --amendがブロックされること', () => {
  // When: git commit --amend を評価
  const result = analyzeBashCommand('git commit --amend', phase);

  // Then: 拒否される
  expect(result.allowed).toBe(false);
  expect(result.reason).toContain('--amend');
  expect(result.reason).toContain('禁止');
});
```

**検証ポイント**: 破壊的オプションが明示的に検出され拒否されるか。

---

#### 3.1.4 TC-B2-04: commitフェーズでgit commit --no-verifyがブロックされること

```javascript
it('[TC-B2-04] commitフェーズでgit commit --no-verifyがブロックされること', () => {
  // When: git commit --no-verify を評価
  const result = analyzeBashCommand('git commit --no-verify -m "bypass hooks"', phase);

  // Then: 拒否される
  expect(result.allowed).toBe(false);
  expect(result.reason).toContain('--no-verify');
});
```

**検証ポイント**: フック回避オプションが検出されブロックされるか。

---

#### 3.1.5 TC-B2-05: commitフェーズでgit tagが許可されること

```javascript
it('[TC-B2-05] commitフェーズでgit tagが許可されること', () => {
  // When: git tag コマンドを評価
  const result = analyzeBashCommand('git tag v1.0.0', phase);

  // Then: 許可される
  expect(result.allowed).toBe(true);
});

it('[TC-B2-05-annotated] 注釈付きタグも許可', () => {
  const result = analyzeBashCommand('git tag -a v1.0.0 -m "Release 1.0.0"', phase);
  expect(result.allowed).toBe(true);
});
```

**検証ポイント**: git tagの基本形と注釈付き形式の両方が許可されるか。

---

#### 3.1.6 TC-B2-06: commitフェーズでgit resetがブロックされること

```javascript
it('[TC-B2-06] commitフェーズでgit resetがブロックされること', () => {
  // When: git reset コマンドを評価
  const result = analyzeBashCommand('git reset --hard HEAD', phase);

  // Then: 拒否される（破壊的操作）
  expect(result.allowed).toBe(false);
});
```

**検証ポイント**: ホワイトリストに含まれない破壊的git操作が拒否されるか。

---

### 3.2 pushフェーズ関連テスト（4ケース）

#### 3.2.1 TC-B2-07: pushフェーズでgit pushが許可されること

```javascript
describe('analyzeBashCommand - push phase', () => {
  const phase = 'push';

  it('[TC-B2-07] pushフェーズでgit pushが許可されること', () => {
    // When: git push コマンドを評価
    const result = analyzeBashCommand('git push', phase);

    // Then: 許可される
    expect(result.allowed).toBe(true);
  });
});
```

**検証ポイント**: 基本的なgit pushコマンドが許可されるか。

---

#### 3.2.2 TC-B2-08: pushフェーズでgit push --forceがブロックされること

```javascript
it('[TC-B2-08] pushフェーズでgit push --forceがブロックされること', () => {
  // When: git push --force を評価
  const result = analyzeBashCommand('git push --force', phase);

  // Then: 拒否される
  expect(result.allowed).toBe(false);
  expect(result.reason).toContain('--force');
  expect(result.reason).toContain('禁止');
});

it('[TC-B2-08-variant] --force-with-leaseも拒否', () => {
  const result = analyzeBashCommand('git push --force-with-lease origin main', phase);
  expect(result.allowed).toBe(false);
});
```

**検証ポイント**: 強制プッシュの各種バリエーションがブロックされるか。

---

#### 3.2.3 TC-B2-09: pushフェーズでgit push -fがブロックされること

```javascript
it('[TC-B2-09] pushフェーズでgit push -fがブロックされること', () => {
  // When: git push -f（短縮形）を評価
  const result = analyzeBashCommand('git push -f origin main', phase);

  // Then: 拒否される
  expect(result.allowed).toBe(false);
  expect(result.reason).toContain('force');
});
```

**検証ポイント**: 短縮オプション `-f` も正しく検出されるか。

---

#### 3.2.4 TC-B2-10: pushフェーズでgit push origin mainが許可されること

```javascript
it('[TC-B2-10] pushフェーズでgit push origin mainが許可されること', () => {
  // When: リモートとブランチを指定したgit push を評価
  const result = analyzeBashCommand('git push origin main', phase);

  // Then: 許可される（破壊的オプションがないため）
  expect(result.allowed).toBe(true);
});

it('[TC-B2-10-variant] -u オプション付きも許可', () => {
  const result = analyzeBashCommand('git push -u origin feature-branch', phase);
  expect(result.allowed).toBe(true);
});
```

**検証ポイント**: 安全なオプション付きgit pushが許可されるか。

---

### 3.3 フェーズ外操作のテスト（1ケース）

#### 3.3.1 TC-B2-11: implementationフェーズでgit commitがブロックされること（フェーズ外）

```javascript
it('[TC-B2-11] implementationフェーズでgit commitがブロックされること', () => {
  // Given: 別のフェーズ（implementation）
  const phase = 'implementation';

  // When: git commit コマンドを評価
  const result = analyzeBashCommand('git commit -m "test"', phase);

  // Then: 拒否される（commit/push フェーズ外）
  expect(result.allowed).toBe(false);
});
```

**検証ポイント**: commit/push以外のフェーズではgit操作がブロックされ続けるか。

---

## 4. B-3: captureBaseline()のフェーズ拡張（5テストケース）

### 4.1 TC-B3-01: researchフェーズでベースライン記録が成功すること

```typescript
describe('workflowCaptureBaseline - B-3 modifications', () => {
  let stateManager: StateManager;
  let tool: TestTrackingTool;

  beforeEach(() => {
    stateManager = new StateManager();
    tool = new TestTrackingTool(stateManager);

    // researchフェーズのタスクを作成
    const taskState = {
      taskId: 'test-task-research',
      phase: 'research',
      testBaseline: null
    };
    stateManager.saveTaskState('test-task-research', taskState);
  });

  it('[TC-B3-01] researchフェーズでベースライン記録が成功すること', async () => {
    // When: researchフェーズでベースラインを記録
    const result = await tool.workflowCaptureBaseline({
      taskId: 'test-task-research',
      totalTests: 100,
      passedTests: 95,
      failedTests: ['test1', 'test2', 'test3', 'test4', 'test5']
    });

    // Then: 成功し、recordedPhaseがresearchに設定される
    expect(result.success).toBe(true);
    expect(result.message).toContain('記録しました');
    expect(result.message).toContain('research');

    const taskState = stateManager.getTaskState('test-task-research');
    expect(taskState.testBaseline).toBeDefined();
    expect(taskState.testBaseline.recordedPhase).toBe('research');
    expect(taskState.testBaseline.totalTests).toBe(100);
    expect(taskState.testBaseline.passedTests).toBe(95);
  });
});
```

**検証ポイント**: researchフェーズでの記録が従来通り機能するか。

---

### 4.2 TC-B3-02: testingフェーズでベースライン記録が成功すること

```typescript
it('[TC-B3-02] testingフェーズでベースライン記録が成功すること', async () => {
  // Given: testingフェーズのタスク
  const taskState = {
    taskId: 'test-task-testing',
    phase: 'testing',
    testBaseline: null
  };
  stateManager.saveTaskState('test-task-testing', taskState);

  // When: testingフェーズでベースラインを記録
  const result = await tool.workflowCaptureBaseline({
    taskId: 'test-task-testing',
    totalTests: 50,
    passedTests: 50,
    failedTests: []
  });

  // Then: 成功し、recordedPhaseがtestingに設定される
  expect(result.success).toBe(true);

  const updatedState = stateManager.getTaskState('test-task-testing');
  expect(updatedState.testBaseline.recordedPhase).toBe('testing');
  expect(updatedState.testBaseline.totalTests).toBe(50);
});
```

**検証ポイント**: testingフェーズでの記録（新規機能）が正しく動作するか。

---

### 4.3 TC-B3-03: testingフェーズでの記録時に警告ログが出力されること

```typescript
it('[TC-B3-03] testingフェーズでの記録時に警告ログが出力されること', async () => {
  // Given: testingフェーズのタスク
  const taskState = {
    taskId: 'test-task-testing-warning',
    phase: 'testing',
    testBaseline: null
  };
  stateManager.saveTaskState('test-task-testing-warning', taskState);

  // And: console.warnをモック
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  // When: testingフェーズでベースラインを記録
  await tool.workflowCaptureBaseline({
    taskId: 'test-task-testing-warning',
    totalTests: 100,
    passedTests: 100,
    failedTests: []
  });

  // Then: 警告ログが3回出力される（遅延ベースライン、タスク情報、推奨事項）
  expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
  expect(consoleWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('遅延ベースライン')
  );
  expect(consoleWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('test-task-testing-warning')
  );
  expect(consoleWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('researchフェーズでの記録を推奨')
  );

  consoleWarnSpy.mockRestore();
});
```

**検証ポイント**: testingフェーズ記録時の警告ログが適切に出力されるか。

---

### 4.4 TC-B3-04: implementationフェーズでベースライン記録が拒否されること

```typescript
it('[TC-B3-04] implementationフェーズでベースライン記録が拒否されること', async () => {
  // Given: implementationフェーズのタスク
  const taskState = {
    taskId: 'test-task-impl',
    phase: 'implementation',
    testBaseline: null
  };
  stateManager.saveTaskState('test-task-impl', taskState);

  // When: implementationフェーズでベースライン記録を試みる
  const result = await tool.workflowCaptureBaseline({
    taskId: 'test-task-impl',
    totalTests: 100,
    passedTests: 100,
    failedTests: []
  });

  // Then: 拒否される
  expect(result.success).toBe(false);
  expect(result.message).toContain('research/testing');
  expect(result.message).toContain('implementation');
});
```

**検証ポイント**: 許可されていないフェーズで記録が拒否されるか。

---

### 4.5 TC-B3-05: taskIdが未指定の場合にエラーが返却されること

```typescript
it('[TC-B3-05] taskIdが未指定の場合にエラーが返却されること', async () => {
  // Given: taskIdなし（getCurrentTaskId()も返さない状態）
  vi.spyOn(stateManager, 'getCurrentTaskId').mockReturnValue(null);

  // When: taskIdなしでベースライン記録を試みる
  const result = await tool.workflowCaptureBaseline({
    taskId: null,
    totalTests: 100,
    passedTests: 100,
    failedTests: []
  });

  // Then: エラーが返却される
  expect(result.success).toBe(false);
  expect(result.message).toContain('taskId');
  expect(result.message).toContain('指定されていません');
});
```

**検証ポイント**: 引数バリデーションが正しく機能するか。

---

## 5. B-4: ドキュメント追記（3検証項目）

B-4はコード修正ではなくドキュメント追記のため、自動テストは作成せず、手動検証とレビュープロセスで品質を担保する。

### 5.1 検証項目1: CLAUDE.mdの記述内容確認

**手動チェックリスト**:
- [ ] 「MCPサーバーのモジュールキャッシュに関する注意」セクションが追加されている
- [ ] Node.jsのrequire()キャッシュについて説明されている
- [ ] 影響範囲（hooks/, dist/）が明記されている
- [ ] 再起動手順が具体的に記載されている
- [ ] トラブルシューティングセクションが含まれている
- [ ] 既存ドキュメントのスタイルと一貫性がある

**実施者**: プロジェクトメンバー（実装者以外）

**合格基準**: 第三者がCLAUDE.mdを読んで、コード変更後に再起動が必要であることを理解できること。

---

### 5.2 検証項目2: MEMORY.mdの記述内容確認

**手動チェックリスト**:
- [ ] 「Key Learnings」セクションに追記されている
- [ ] MCP Server Module Caching (Expanded) として記載
- [ ] 再起動手順が英語で記載されている
- [ ] Development workflowが明記されている
- [ ] 既存のMEMORY.mdのフォーマットに従っている

**実施者**: プロジェクトメンバー（実装者以外）

**合格基準**: 開発者が過去の学びとして参照し、同じ問題を繰り返さないようになること。

---

### 5.3 検証項目3: 再起動手順の実地検証

**実施手順**:
1. workflow-plugin/dist/*.jsファイルを修正（例: console.logを追加）
2. Claude Codeを再起動**せずに**ワークフローを実行
3. 修正が反映されていないことを確認（期待結果: console.logが出力されない）
4. Claude Codeを完全再起動
5. 再度ワークフローを実行
6. 修正が反映されたことを確認（期待結果: console.logが出力される）

**合格基準**: 手順4の再起動後に変更が確実に反映されること。

**記録方法**: docs/workflows/{taskName}/manual-test.md に実施結果を記録。

---

## 6. エンドツーエンドテスト（E2E）

### 6.1 TC-E2E-01: 19フェーズ完走テスト（B-1/B-2/B-3統合）

```javascript
describe('E2E: 19-phase workflow completion', () => {
  it('[TC-E2E-01] 4件の修正が統合された状態で19フェーズが完走できること', async () => {
    // Given: 新規タスクを開始
    const taskName = 'E2Eテスト完走確認';
    await workflowStart({ taskName });

    // Step 1: researchフェーズ
    await workflowNext(); // research → requirements

    // Step 2: requirementsフェーズ
    await workflowNext(); // requirements → parallel_analysis

    // （中略: 各フェーズを通過）

    // Step 3: testingフェーズ到達
    // B-3検証: ベースラインをtestingフェーズで記録（遅延ベースライン）
    await workflowCaptureBaseline({
      totalTests: 732,
      passedTests: 732,
      failedTests: []
    });

    // Step 4: regression_testフェーズへ遷移
    await workflowNext(); // testing → regression_test
    // Then: testBaselineが存在するため遷移成功

    // Step 5: commitフェーズ到達
    // B-2検証: git操作が実行可能
    await bashCommand('git add .'); // 許可される
    await bashCommand('git commit -m "test commit"'); // 許可される

    // Step 6: pushフェーズ到達
    await workflowNext(); // commit → push
    // B-2検証: git pushが実行可能
    await bashCommand('git push origin main'); // 許可される

    // Step 7: completedフェーズ到達
    await workflowNext(); // push → ci_verification → deploy → completed
    const finalState = getTaskState();
    expect(finalState.phase).toBe('completed');
  });
});
```

**検証ポイント**: 4件全ての修正が統合された状態で、ワークフローが最初から最後まで完走するか。

**実行時間**: 約5〜10分（各フェーズの処理内容により変動）

**前提条件**:
- Gitリポジトリが初期化されている
- リモートリポジトリが設定されている
- 既存テスト732件が全てパスしている

---

## 7. リグレッションテスト

### 7.1 既存テストスイートの全件実行

**実行コマンド**:
```bash
cd workflow-plugin/mcp-server
pnpm test
```

**期待結果**:
```
Test Files  X passed (X)
Tests       732 passed (732)
Duration    Xms
```

**合格基準**: 既存732テスト全件がパスし、1件も失敗しないこと。

**失敗時の対応**:
1. 失敗したテストケース名を記録
2. 修正コードとの関連性を分析
3. 修正コードにバグがあれば修正
4. 既存テストの期待値が誤っていれば調整（慎重に判断）

---

### 7.2 パフォーマンスリグレッション

**測定項目**:
| 項目 | 修正前 | 修正後 | 許容範囲 |
|------|--------|--------|---------|
| discoverTasks()実行時間 | Xms | Yms | +1ms以内 |
| analyzeBashCommand()実行時間 | Ams | Bms | +0.5ms以内 |
| captureBaseline()実行時間 | Pms | Qms | +0.5ms以内 |

**測定方法**:
```javascript
describe('Performance regression', () => {
  it('discoverTasks()のパフォーマンスが劣化していないこと', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      discoverTasks();
    }
    const elapsed = performance.now() - start;
    const avgTime = elapsed / 1000;

    expect(avgTime).toBeLessThan(1); // 1ms未満
  });
});
```

**合格基準**: 平均実行時間が許容範囲内に収まること。

---

## 8. テスト環境セットアップ

### 8.1 テスト環境の構築

**必要な準備**:
```bash
# 1. 依存パッケージのインストール
cd workflow-plugin/mcp-server
pnpm install

# 2. TypeScriptのビルド
pnpm run build

# 3. テストディレクトリの確認
ls src/__tests__/hooks/
ls src/__tests__/tools/
```

### 8.2 モックとスタブの設計

**ファイルシステムモック**:
- `fs.readdirSync()`: テスト用のディレクトリリストを返却
- `fs.mkdirSync()`: 実際のディレクトリを作成せずモック
- `fs.writeFileSync()`: メモリ上のマップに書き込み

**StateManagerモック**:
- `getTaskState()`: テスト用の状態オブジェクトを返却
- `saveTaskState()`: 状態をメモリに保存
- `getCurrentTaskId()`: テスト用のtaskIdを返却

**console.warnモック**:
- `vi.spyOn(console, 'warn')`: 警告ログの出力回数と内容を検証

---

## 9. テスト実行計画

### 9.1 実行順序

1. **単体テスト**: B-1 → B-3 → B-2の順（依存度の低い順）
2. **統合テスト**: B-1とphase-edit-guardの連携
3. **リグレッションテスト**: 既存732テスト全件
4. **E2Eテスト**: 19フェーズ完走テスト
5. **手動検証**: B-4ドキュメントレビューと実地検証

### 9.2 実行タイミング

**実装中**:
- 各修正完了後に該当する単体テストを実行
- TDD（Test-Driven Development）で先にテストを書く

**実装完了後**:
- 全単体テスト実行
- リグレッションテスト実行
- E2Eテスト実行

**CI/CD統合**:
- コミット前に全テスト自動実行
- プルリクエスト時に再度実行
- マージ前にE2Eテスト必須

---

## 10. 合格基準とレポーティング

### 10.1 合格基準

**定量基準**:
- [ ] 新規追加テスト24ケース全てパス
- [ ] 既存テスト732ケース全てパス
- [ ] カバレッジ: 修正部分100%
- [ ] パフォーマンス劣化: 許容範囲内

**定性基準**:
- [ ] E2Eテストで19フェーズ完走成功
- [ ] B-4ドキュメントがレビュー承認済み
- [ ] 再起動手順の実地検証成功
- [ ] コードレビューで設計承認済み

### 10.2 テストレポート形式

**成果物**: `docs/workflows/{taskName}/test-report.md`

**記載項目**:
```markdown
# テスト実行レポート

## 実行日時
- 実施日: YYYY-MM-DD HH:MM

## テスト結果サマリー
- 総テストケース数: 756件（新規24 + 既存732）
- パス: 756件
- 失敗: 0件
- スキップ: 0件

## 詳細結果

### B-1: タスクソート（6ケース）
| テストケース | 結果 | 実行時間 |
|-------------|------|---------|
| TC-B1-01    | ✅   | 5ms     |
...

### B-2: git操作許可（10ケース）
...

### B-3: ベースライン記録（5ケース）
...

## パフォーマンス測定
- discoverTasks(): 平均0.3ms（許容範囲内）
...

## E2Eテスト
- 19フェーズ完走: ✅ 成功（実行時間: 8分32秒）

## 課題・改善点
（なし）

## 結論
全ての合格基準を満たしており、本修正は品質要件を達成している。
```

---

## 11. トラブルシューティングガイド

### 11.1 よくあるテスト失敗パターン

**パターン1: ファイルシステムのクリーンアップ漏れ**

```
症状: TC-B1-03が失敗し、「expected [] but got [...]」エラー
原因: 前のテストで作成したディレクトリが残存
解決: afterEach()でクリーンアップを徹底
```

```javascript
afterEach(() => {
  const stateDir = path.join(process.cwd(), '.claude/state/workflows');
  if (fs.existsSync(stateDir)) {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});
```

---

**パターン2: console.warnのモック復元漏れ**

```
症状: 他のテストで予期しない警告ログが出力される
原因: vi.spyOn()のモックが復元されていない
解決: finally句でmockRestore()を確実に実行
```

```typescript
let consoleWarnSpy;
try {
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // テスト実行
} finally {
  if (consoleWarnSpy) {
    consoleWarnSpy.mockRestore();
  }
}
```

---

**パターン3: 非決定的なテスト順序依存**

```
症状: 単体では成功するがスイート全体では失敗
原因: グローバル状態やシングルトンの汚染
解決: 各テストで状態を完全にリセット
```

---

## 12. 次フェーズへの引き継ぎ

### 12.1 test_implフェーズでの実装タスク

**作成するファイル**:
1. `src/__tests__/hooks/discover-tasks.test.js` - 6テストケース
2. `src/__tests__/hooks/phase-edit-guard.test.js` - 10テストケース
3. `src/__tests__/tools/test-tracking.test.ts` - 5テストケース

**実装順序**:
- B-3 → B-1 → B-2（影響範囲が小さい順）

**重点事項**:
- モックとスタブの適切な設計
- afterEach()でのクリーンアップ徹底
- describeブロックでテストを論理的にグループ化

### 12.2 testingフェーズでの実行計画

**実行コマンド**:
```bash
# 新規追加テストのみ実行
pnpm test src/__tests__/hooks/discover-tasks.test.js
pnpm test src/__tests__/hooks/phase-edit-guard.test.js
pnpm test src/__tests__/tools/test-tracking.test.ts

# 全テスト実行
pnpm test

# カバレッジ付き実行
pnpm test -- --coverage
```

**確認事項**:
- [ ] 新規24テスト全件パス
- [ ] 既存732テスト全件パス
- [ ] 修正部分のカバレッジ100%
- [ ] テストレポート作成完了

---

## 13. 関連ファイル

<!-- @related-files -->
- `workflow-plugin/hooks/lib/discover-tasks.js` - B-1テスト対象
- `workflow-plugin/hooks/phase-edit-guard.js` - B-2テスト対象
- `workflow-plugin/mcp-server/src/tools/test-tracking.ts` - B-3テスト対象
- `workflow-plugin/mcp-server/src/__tests__/` - テストファイル配置先
- `docs/workflows/ワ-クフロ-プロセス阻害要因4件完全解消/spec.md` - 仕様書の参照元
- `docs/workflows/ワ-クフロ-プロセス阻害要因4件完全解消/state-machine.mmd` - ステートマシン図
- `docs/workflows/ワ-クフロ-プロセス阻害要因4件完全解消/flowchart.mmd` - フローチャート
<!-- @end-related-files -->

---

## 14. 付録: テストケース一覧表

| ID | カテゴリ | テスト名 | 優先度 | 実行時間 |
|----|---------|---------|--------|---------|
| TC-B1-01 | B-1 | 複数タスクのtaskId降順ソート検証 | High | 5ms |
| TC-B1-02 | B-1 | 単一タスク環境でのソート正常動作 | Medium | 3ms |
| TC-B1-03 | B-1 | 空配列の場合のエラー回避 | High | 2ms |
| TC-B1-04 | B-1 | 連続呼び出しでの決定性保証 | High | 50ms |
| TC-B1-05 | B-1 | taskIdフォーマット異常時のエッジケース | Medium | 5ms |
| TC-B1-06 | B-1 | phase-edit-guardとの連携 | High | 10ms |
| TC-B2-01 | B-2 | commitフェーズでgit add許可 | High | 2ms |
| TC-B2-02 | B-2 | commitフェーズでgit commit許可 | High | 3ms |
| TC-B2-03 | B-2 | git commit --amend拒否 | High | 2ms |
| TC-B2-04 | B-2 | git commit --no-verify拒否 | High | 2ms |
| TC-B2-05 | B-2 | commitフェーズでgit tag許可 | Medium | 2ms |
| TC-B2-06 | B-2 | git reset拒否 | High | 2ms |
| TC-B2-07 | B-2 | pushフェーズでgit push許可 | High | 2ms |
| TC-B2-08 | B-2 | git push --force拒否 | High | 2ms |
| TC-B2-09 | B-2 | git push -f拒否 | High | 2ms |
| TC-B2-10 | B-2 | git push origin main許可 | High | 2ms |
| TC-B2-11 | B-2 | implementationフェーズでgit commit拒否 | High | 2ms |
| TC-B3-01 | B-3 | researchフェーズでベースライン記録成功 | High | 5ms |
| TC-B3-02 | B-3 | testingフェーズでベースライン記録成功 | High | 5ms |
| TC-B3-03 | B-3 | testingフェーズ記録時の警告ログ出力 | High | 5ms |
| TC-B3-04 | B-3 | implementationフェーズで記録拒否 | High | 3ms |
| TC-B3-05 | B-3 | taskId未指定時のエラー返却 | Medium | 2ms |
| TC-E2E-01 | E2E | 19フェーズ完走テスト | Critical | 5-10min |

**総テストケース数**: 24ケース（自動テスト21 + 手動検証3）

**推定総実行時間**: 約150ms（E2Eテスト除く）

---

**テスト設計書作成完了**

次フェーズ: test_implにてテストコードを実装してください。
