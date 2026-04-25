# 仕様書: ワークフロープラグイン大規模対応根本改修

## 概要

workflow-pluginの評価で判明した6つのセキュリティ・品質問題を根本的に解決する。エンタープライズ環境での採用を妨げる致命的欠陥（FAIL_OPEN回避、改竄可能な状態ファイル、無制限スコープ、回避可能なBash検証、不十分な成果物検証、オプショナルな設計検証）をゼロトレランスで修正する。

**関連ドキュメント:**
- 要件定義: `/mnt/c/ツール/Workflow/docs/workflows/ワ-クフロ-プラグイン大規模対応根本改修/requirements.md`
- 調査結果: `/mnt/c/ツール/Workflow/docs/workflows/ワ-クフロ-プラグイン大規模対応根本改修/research.md`

---

## 実装計画

### 実装順序

1. **REQ-1: FAIL_OPEN除去** (最優先・独立)
2. **REQ-2: HMAC署名** (types.ts → manager.ts)
3. **REQ-3: スコープ制限** (独立)
4. **REQ-4: Bash解析強化** (独立)
5. **REQ-5: 成果物検証強化** (独立)
6. **REQ-6: 設計検証必須化** (next.ts + design-validator.ts)

---

## REQ-1: FAIL_OPEN環境変数の除去

### 目的
エラー時のfail-closed原則を強制し、環境変数によるセキュリティ機構の無効化を不可能にする。

### 変更対象ファイル
1. `/mnt/c/ツール/Workflow/workflow-plugin/hooks/enforce-workflow.js` (5箇所)
2. `/mnt/c/ツール/Workflow/workflow-plugin/hooks/phase-edit-guard.js` (4箇所)
3. `/mnt/c/ツール/Workflow/workflow-plugin/hooks/block-dangerous-commands.js` (3箇所)

### 実装詳細

#### 1.1. enforce-workflow.js の修正

**修正箇所:**
- 行35-38: `uncaughtException` ハンドラ
- 行44-48: `unhandledRejection` ハンドラ
- 行223-227: stdin error ハンドラ
- 行236-240: JSON parse error ハンドラ
- 行322-327: main error ハンドラ

**変更前パターン:**
```javascript
// 現在のコード（5箇所で同じパターン）
if (process.env.FAIL_OPEN === 'true') {
  console.error('[enforce-workflow] FAIL_OPEN: エラー時に許可');
  process.exit(0);
}
process.exit(2);
```

**変更後パターン:**
```javascript
// 統一されたエラーハンドラ
console.error('[enforce-workflow] エラー発生 - ブロック');
process.exit(2); // 常にブロック
```

**詳細な変更内容:**

```javascript
// 変更1: uncaughtException (行35-38)
process.on('uncaughtException', (err) => {
  logError('未捕捉エラー', err.message, err.stack);
  // FAIL_OPEN チェックを削除
  console.error('[enforce-workflow] 未捕捉エラー - ブロック');
  process.exit(2);
});

// 変更2: unhandledRejection (行44-48)
process.on('unhandledRejection', (reason) => {
  logError('未処理のPromise拒否', String(reason), null);
  // FAIL_OPEN チェックを削除
  console.error('[enforce-workflow] 未処理のPromise拒否 - ブロック');
  process.exit(2);
});

// 変更3: stdin error (行223-227)
process.stdin.on('error', (err) => {
  logError('stdinエラー', err.message, err.stack);
  // FAIL_OPEN チェックを削除
  console.error('[enforce-workflow] stdinエラー - ブロック');
  process.exit(2);
});

// 変更4: JSON parse error (行236-240)
} catch (parseError) {
  logError('JSONパースエラー', parseError.message, parseError.stack);
  // FAIL_OPEN チェックを削除
  console.error('[enforce-workflow] JSONパースエラー - ブロック');
  process.exit(2);
}

// 変更5: main error (行322-327)
} catch (error) {
  logError('エラー', error.message, error.stack);
  // FAIL_OPEN チェックを削除
  console.error('[enforce-workflow] エラー - ブロック');
  process.exit(2);
}
```

#### 1.2. phase-edit-guard.js の修正

**修正箇所:**
- 行39-43: `uncaughtException` ハンドラ
- 行47-51: `unhandledRejection` ハンドラ
- 行1651-1655: main error ハンドラ
- 行1677-1681: stdin error ハンドラ
- 行1691-1695: JSON parse error ハンドラ (注: 行番号は調査時点、実際のファイルで確認必要)

**変更パターン (enforce-workflow.js と同様):**

```javascript
// uncaughtException (行39-43)
process.on('uncaughtException', (err) => {
  logError('未捕捉エラー', err.message, err.stack);
  // FAIL_OPEN チェックを削除
  console.error('[phase-edit-guard] 未捕捉エラー - ブロック');
  process.exit(2);
});

// unhandledRejection (行47-51)
process.on('unhandledRejection', (reason) => {
  logError('未処理のPromise拒否', String(reason), null);
  // FAIL_OPEN チェックを削除
  console.error('[phase-edit-guard] 未処理のPromise拒否 - ブロック');
  process.exit(2);
});

// 他のエラーハンドラも同様のパターンで修正
```

#### 1.3. block-dangerous-commands.js の修正

**修正箇所:**
- 行140-145: main error ハンドラ
- 行153-157: stdin error ハンドラ
- 行164-168: uncaught error ハンドラ

**変更パターン:**

```javascript
// main error (行140-145)
} catch (error) {
  logError('エラー', error.message, error.stack);
  // FAIL_OPEN チェックを削除
  console.error('[block-dangerous-commands] エラー - ブロック');
  process.exit(2);
}

// stdin error (行153-157)
process.stdin.on('error', (err) => {
  logError('stdinエラー', err.message, err.stack);
  // FAIL_OPEN チェックを削除
  console.error('[block-dangerous-commands] stdinエラー - ブロック');
  process.exit(2);
});

// uncaught error (行164-168)
process.on('uncaughtException', (err) => {
  logError('未捕捉エラー', err.message, err.stack);
  // FAIL_OPEN チェックを削除
  console.error('[block-dangerous-commands] 未捕捉エラー - ブロック');
  process.exit(2);
});
```

### 受入条件
- AC-1-1: `FAIL_OPEN=true git add .` を実行してもフックがブロックすること
- AC-1-2: エラー発生時に `process.exit(2)` が呼ばれること
- AC-1-3: 12箇所全ての FAIL_OPEN 参照が削除されていること

---

## REQ-2: 状態ファイルのHMAC署名

### 目的
workflow-state.json の改竄を検出し、手動編集によるフェーズスキップを防止する。

### 変更対象ファイル
1. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/state/types.ts`
2. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/state/manager.ts`

### 実装詳細

#### 2.1. types.ts への署名フィールド追加

**ファイルパス:** `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/state/types.ts`

**変更内容:**

```typescript
// 行180-243: TaskState インターフェースに署名フィールドを追加
export interface TaskState {
  /** 現在のフェーズ */
  phase: PhaseName;
  /** タスクID（例: 20260115_123456） */
  taskId: string;
  /** タスク名（日本語可） */
  taskName: string;
  /** ワークフローディレクトリのパス（内部状態用） */
  workflowDir: string;
  /** ドキュメントディレクトリのパス（成果物配置用） */
  docsDir?: string;
  /** タスク開始日時（ISO 8601形式） */
  startedAt: string;
  /** タスク完了日時（ISO 8601形式、完了時のみ） */
  completedAt?: string;
  /** チェックリストの状態 */
  checklist: Record<string, boolean>;
  /** フェーズ遷移履歴 */
  history: HistoryEntry[];
  /** 並列フェーズのサブフェーズ状態 */
  subPhases: SubPhases;
  /** リセット履歴（リセットされた場合のみ） */
  resetHistory?: ResetHistoryEntry[];
  /** タスクサイズ */
  taskSize?: TaskSize;
  /** test_implフェーズで作成したテストファイル */
  testFiles?: string[];
  /** researchフェーズで記録したテストベースライン */
  testBaseline?: TestBaseline;
  /** regression_testフェーズで記録した既知バグ */
  knownBugs?: KnownBug[];
  /** 影響範囲（REQ-1） */
  scope?: {
    /** 影響を受けるファイルのパスリスト */
    affectedFiles: string[];
    /** 影響を受けるディレクトリのパスリスト */
    affectedDirs: string[];
  };
  /** テスト結果記録（REQ-2） */
  testResults?: Array<{
    /** 実行フェーズ */
    phase: 'testing' | 'regression_test';
    /** 終了コード（0=成功、非0=失敗） */
    exitCode: number;
    /** 実行日時（ISO 8601形式） */
    timestamp: string;
    /** サマリー（オプション） */
    summary?: string;
    /** テスト実行の出力（末尾500文字まで） */
    output?: string;
    /** パスしたテスト件数（自動抽出） */
    passedCount?: number;
    /** 失敗したテスト件数（自動抽出） */
    failedCount?: number;
  }>;
  
  // ★★★ 新規追加: HMAC署名フィールド ★★★
  /**
   * 状態ファイルのHMAC-SHA256署名
   * 
   * 署名対象: stateIntegrity以外の全フィールド
   * アルゴリズム: HMAC-SHA256
   * 
   * @spec docs/workflows/ワ-クフロ-プラグイン大規模対応根本改修/spec.md#REQ-2
   */
  stateIntegrity?: string;
}
```

#### 2.2. manager.ts への署名ロジック実装

**ファイルパス:** `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/state/manager.ts`

**追加する import 文:**

```typescript
// 行12: crypto モジュールのインポートを追加
import * as crypto from 'crypto';
import * as os from 'os';
```

**署名ヘルパー関数の追加 (行56の後に追加):**

```typescript
// ============================================================================
// HMAC署名関連（REQ-2: 状態ファイルの改竄検出）
// ============================================================================

/**
 * 署名キーを生成
 * 
 * ホスト名とユーザー名を組み合わせてマシン固有のキーを生成する。
 * PBKDF2で100,000回ストレッチすることで辞書攻撃に耐性を持たせる。
 * 
 * @returns HMAC署名用の32バイトキー
 */
function generateSignatureKey(): Buffer {
  const hostname = os.hostname();
  const username = os.userInfo().username;
  const salt = 'workflow-mcp-v1'; // 固定salt（バージョン識別用）
  
  return crypto.pbkdf2Sync(
    hostname + username,
    salt,
    100000, // イテレーション回数
    32,     // キー長（256bit）
    'sha256'
  );
}

/**
 * TaskState の HMAC-SHA256 署名を生成
 * 
 * stateIntegrity フィールド以外の全フィールドを JSON 文字列化して署名する。
 * フィールドの順序は Object.keys() のソート順に依存するため、
 * 同一オブジェクトは常に同じ署名を生成する。
 * 
 * @param state タスク状態
 * @returns Base64エンコードされたHMAC署名
 */
function generateStateHmac(state: TaskState): string {
  // stateIntegrity フィールドを除外したコピーを作成
  const { stateIntegrity, ...stateWithoutSignature } = state;
  
  // JSON文字列化（キーソート済み）
  const data = JSON.stringify(stateWithoutSignature, Object.keys(stateWithoutSignature).sort());
  
  // HMAC-SHA256署名を生成
  const key = generateSignatureKey();
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data, 'utf8');
  
  return hmac.digest('base64');
}

/**
 * TaskState の HMAC 署名を検証
 * 
 * @param state タスク状態
 * @param expectedHmac 期待される署名（Base64）
 * @returns 署名が一致すれば true、不一致なら false
 */
function verifyStateHmac(state: TaskState, expectedHmac: string): boolean {
  const actualHmac = generateStateHmac(state);
  
  // タイミング攻撃対策: crypto.timingSafeEqual() を使用
  try {
    const expectedBuffer = Buffer.from(expectedHmac, 'base64');
    const actualBuffer = Buffer.from(actualHmac, 'base64');
    
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (error) {
    // Base64デコードエラー等
    return false;
  }
}
```

**writeTaskState() の修正 (行170-174):**

```typescript
/**
 * タスク状態を保存する
 * 
 * 署名を自動的に付与してから保存する（REQ-2）。
 * 
 * @param taskWorkflowDir タスクのワークフローディレクトリ
 * @param state 保存するタスク状態
 */
writeTaskState(taskWorkflowDir: string, state: TaskState): void {
  // ★★★ 署名を生成して付与 ★★★
  const stateWithSignature = {
    ...state,
    stateIntegrity: generateStateHmac(state),
  };
  
  const stateFile = path.join(taskWorkflowDir, 'workflow-state.json');
  writeJsonFile(stateFile, stateWithSignature);
}
```

**readTaskState() の修正 (行160-163):**

```typescript
/**
 * タスク状態を読み込む
 * 
 * 署名を検証し、不正な場合は null を返す（REQ-2）。
 * 署名がない場合（既存ファイル）は初回アクセス時に署名を追加する。
 * 
 * @param taskWorkflowDir タスクのワークフローディレクトリ
 * @returns タスク状態、または読み込み失敗時は null
 */
readTaskState(taskWorkflowDir: string): TaskState | null {
  const stateFile = path.join(taskWorkflowDir, 'workflow-state.json');
  const state = readJsonFile<TaskState>(stateFile);
  
  if (!state) {
    return null;
  }
  
  // ★★★ 署名検証 ★★★
  if (state.stateIntegrity) {
    // 署名がある場合は検証
    if (!verifyStateHmac(state, state.stateIntegrity)) {
      console.error(`[WorkflowStateManager] 署名検証失敗: ${stateFile}`);
      console.error(`  タスク状態ファイルが改竄されている可能性があります。`);
      console.error(`  手動でファイルを編集した場合は、ファイルを削除して再度タスクを開始してください。`);
      return null; // 署名不正 → null を返す
    }
  } else {
    // ★★★ 後方互換性: 署名がない場合は自動付与（マイグレーション） ★★★
    console.warn(`[WorkflowStateManager] 署名なしファイルを検出 - 署名を追加します: ${stateFile}`);
    this.writeTaskState(taskWorkflowDir, state);
  }
  
  return state;
}
```

**getTaskById() の修正 (行230-233):**

```typescript
/**
 * taskIdでタスクを取得
 * 
 * ディレクトリスキャンで発見されたアクティブタスクから、
 * 指定されたtaskIdに一致するタスクを返す。
 * 
 * 署名検証に失敗したタスクは null として扱われる（REQ-2）。
 * 
 * @param taskId タスクID
 * @returns タスク状態、または存在しない場合はnull
 */
getTaskById(taskId: string): TaskState | null {
  const tasks = this.discoverTasks();
  return tasks.find(t => t.taskId === taskId) ?? null;
}
```

### 技術仕様

**アルゴリズム:** HMAC-SHA256

**署名キー生成:**
```typescript
crypto.pbkdf2Sync(
  hostname + username,  // ソース
  'workflow-mcp-v1',    // Salt
  100000,               // イテレーション回数
  32,                   // キー長（256bit）
  'sha256'              // ハッシュ関数
)
```

**署名対象:** `stateIntegrity` フィールド以外の全フィールド（JSON文字列化後）

**署名検証タイミング:**
- `readTaskState()` 実行時
- `getTaskById()` 経由での全アクセス

**後方互換性:**
- 署名なしファイルは初回アクセス時に署名追加
- 警告ログを出力してマイグレーション

**エラーハンドリング:**
- 署名検証失敗 → `readTaskState()` が `null` を返す
- 上位の `getTaskById()` で `null` として扱われる
- ツール側で「タスクが見つかりません」エラーになる

### 受入条件
- AC-2-1: workflow-state.json を手動編集すると `getTaskById()` が null を返すこと
- AC-2-2: 正常な `workflow_next` 経由の遷移では署名検証に成功すること
- AC-2-3: 新規タスク作成時に `stateIntegrity` フィールドが存在すること
- AC-2-4: 署名計算が10ms以内に完了すること（パフォーマンス要件）

---

## REQ-3: スコープサイズ制限

### 目的
メモリ不足・処理時間超過を防止するため、スコープのファイル数・ディレクトリ数に上限を設定する。

### 変更対象ファイル
1. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts`
2. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/next.ts`

### 実装詳細

#### 3.1. set-scope.ts への制限追加

**ファイルパス:** `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts`

**定数定義の追加 (行22の後に追加):**

```typescript
/** スコープサイズ制限（REQ-3） */
const MAX_SCOPE_FILES = 200;
const MAX_SCOPE_DIRS = 20;
```

**workflowSetScope() の修正 (行62の後、エラーメッセージの前に追加):**

```typescript
/**
 * 影響範囲を設定
 * 
 * @param taskId タスクID（必須）
 * @param files 影響を受けるファイルの配列
 * @param dirs 影響を受けるディレクトリの配列
 * @returns 設定結果
 */
export function workflowSetScope(
  taskId?: string,
  files?: string[],
  dirs?: string[]
): ToolResult {
  // タスク状態を取得
  const result = getTaskByIdOrError(taskId);
  if ('error' in result) {
    return result.error as ToolResult;
  }

  const { taskState } = result;
  const currentPhase = taskState.phase;

  // research/requirements/planningフェーズでのみ許可
  if (!ALLOWED_PHASES.includes(currentPhase as typeof ALLOWED_PHASES[number])) {
    return {
      success: false,
      message: `影響範囲の設定はresearch/requirements/planningフェーズでのみ可能です（現在: ${currentPhase}）`,
    };
  }

  // 引数検証
  const affectedFiles = Array.isArray(files) ? files : [];
  const affectedDirs = Array.isArray(dirs) ? dirs : [];

  if (affectedFiles.length === 0 && affectedDirs.length === 0) {
    return {
      success: false,
      message: 'files または dirs の少なくとも1つを指定してください',
    };
  }

  // ★★★ 新規追加: スコープサイズ制限チェック ★★★
  if (affectedFiles.length > MAX_SCOPE_FILES) {
    return {
      success: false,
      message: `スコープが大きすぎます（ファイル: ${affectedFiles.length}件、上限: ${MAX_SCOPE_FILES}件）。\n` +
               `タスクを機能単位に分割してください。\n\n` +
               `例:\n` +
               `  - ユーザー認証機能\n` +
               `  - 決済処理機能\n` +
               `  - 通知機能\n\n` +
               `各機能ごとに別タスクを作成することで、スコープを小さく保てます。`,
    };
  }

  if (affectedDirs.length > MAX_SCOPE_DIRS) {
    return {
      success: false,
      message: `スコープが大きすぎます（ディレクトリ: ${affectedDirs.length}件、上限: ${MAX_SCOPE_DIRS}件）。\n` +
               `タスクを機能単位に分割してください。\n\n` +
               `例:\n` +
               `  - src/features/auth/\n` +
               `  - src/features/payment/\n` +
               `  - src/features/notification/\n\n` +
               `各ディレクトリごとに別タスクを作成することで、スコープを小さく保てます。`,
    };
  }

  // （以降は既存のコード: ファイル存在チェック、依存関係解析等）
  // ...
```

#### 3.2. next.ts への制限追加

**ファイルパス:** `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/next.ts`

**定数定義の追加 (行34の後に追加):**

```typescript
/** スコープサイズ制限（REQ-3） */
const MAX_SCOPE_FILES = 200;
const MAX_SCOPE_DIRS = 20;
```

**スコープ検証関数の追加 (行52の後に追加):**

```typescript
/**
 * スコープサイズの検証
 * 
 * @param scope スコープ定義
 * @returns エラーメッセージ（問題なければ null）
 */
function validateScopeSize(
  scope: { affectedFiles: string[]; affectedDirs: string[] } | undefined
): string | null {
  if (!scope) {
    return 'スコープが設定されていません';
  }

  const fileCount = scope.affectedFiles?.length || 0;
  const dirCount = scope.affectedDirs?.length || 0;

  if (fileCount === 0 && dirCount === 0) {
    return 'スコープが空です';
  }

  if (fileCount > MAX_SCOPE_FILES) {
    return `スコープが大きすぎます（ファイル: ${fileCount}件、上限: ${MAX_SCOPE_FILES}件）。` +
           `タスクを機能単位に分割してください。`;
  }

  if (dirCount > MAX_SCOPE_DIRS) {
    return `スコープが大きすぎます（ディレクトリ: ${dirCount}件、上限: ${MAX_SCOPE_DIRS}件）。` +
           `タスクを機能単位に分割してください。`;
  }

  return null;
}
```

**workflowNext() の修正 (行130-138を以下に置き換え):**

```typescript
  // REQ-3: parallel_analysis → parallel_design 遷移時のスコープチェック強化
  if (currentPhase === 'parallel_analysis') {
    // スコープサイズ検証
    const scopeError = validateScopeSize(taskState.scope);
    if (scopeError) {
      return {
        success: false,
        message: `${scopeError}\nworkflow_set_scope で適切なスコープを設定してから次フェーズに進んでください`,
      };
    }
  }
```

### 制限値

```typescript
const MAX_SCOPE_FILES = 200;  // ファイル数上限
const MAX_SCOPE_DIRS = 20;     // ディレクトリ数上限
```

**選定理由:**
- 200ファイル: 中規模機能（認証、決済等）の平均的なファイル数
- 20ディレクトリ: Clean Architectureの層構造を考慮した現実的な値
- 超過時は機能単位への分割を推奨

### エラーメッセージ設計

**ファイル数超過:**
```
スコープが大きすぎます（ファイル: 250件、上限: 200件）。
タスクを機能単位に分割してください。

例:
  - ユーザー認証機能
  - 決済処理機能
  - 通知機能

各機能ごとに別タスクを作成することで、スコープを小さく保てます。
```

**ディレクトリ数超過:**
```
スコープが大きすぎます（ディレクトリ: 25件、上限: 20件）。
タスクを機能単位に分割してください。

例:
  - src/features/auth/
  - src/features/payment/
  - src/features/notification/

各ディレクトリごとに別タスクを作成することで、スコープを小さく保てます。
```

### 受入条件
- AC-3-1: 201ファイルのスコープ設定が `ScopeTooLargeError` で拒否されること
- AC-3-2: 200ファイル以下は通過すること
- AC-3-3: エラーメッセージに「タスクを分割してください」が含まれること
- AC-3-4: 21ディレクトリのスコープ設定が拒否されること

---

## REQ-4: Bashコマンド解析の強化

### 目的
パイプ・連結コマンドによる検出回避を防止し、真にread-onlyなコマンドのみを許可する。

### 変更対象ファイル
1. `/mnt/c/ツール/Workflow/workflow-plugin/hooks/phase-edit-guard.js`

### 現状の問題

**問題1: 連結コマンドの検出漏れ**
```javascript
// 現状: 先頭マッチのみ
if (ALWAYS_ALLOWED_BASH_PATTERNS.some(p => cmd.startsWith(p))) {
  return; // `pwd && rm -rf /` が通過してしまう
}
```

**問題2: awk単一リダイレクトの見逃し**
```javascript
// 現状: awk ... >> file のみブロック
// 問題: awk ... > file は検出されない
```

### 実装詳細

#### 4.1. コマンド分割関数の追加

**ファイルパス:** `/mnt/c/ツール/Workflow/workflow-plugin/hooks/phase-edit-guard.js`

**追加位置:** 行1200付近（`analyzeBashCommand()` 関数の前）

```javascript
/**
 * 複合コマンドを分割する
 * 
 * &&, ||, ;, | で連結されたコマンドを個別のコマンドに分解する。
 * 
 * @param {string} command - 複合コマンド文字列
 * @returns {string[]} - 分割されたコマンドの配列
 * 
 * @example
 * splitCompoundCommand('pwd && rm -rf /')
 * // => ['pwd', 'rm -rf /']
 * 
 * splitCompoundCommand('cat file.txt | grep error')
 * // => ['cat file.txt', 'grep error']
 */
function splitCompoundCommand(command) {
  // &&, ||, ;, | でコマンドを分割
  // 注: 引用符内の演算子は分割しない（簡易実装では無視）
  return command.split(/\s*(?:&&|\|\||;|\|)\s+/).filter(part => part.trim().length > 0);
}
```

#### 4.2. FILE_MODIFYING_COMMANDS への追加

**追加位置:** 行1100付近（`FILE_MODIFYING_COMMANDS` 配列の末尾）

```javascript
/**
 * ファイル変更を伴うコマンドのパターン
 */
const FILE_MODIFYING_COMMANDS = [
  // ... 既存のパターン ...
  
  // ★★★ 新規追加: awk単一リダイレクト ★★★
  /\bawk\b.*?\s+>\s+/i,  // awk ... > file （既存は >> のみ）
];
```

#### 4.3. analyzeBashCommand() の修正

**修正位置:** 行1250-1350付近（`analyzeBashCommand()` 関数全体）

**変更前:**
```javascript
function analyzeBashCommand(cmd) {
  // 単純な先頭マッチ判定
  if (ALWAYS_ALLOWED_BASH_PATTERNS.some(p => cmd.startsWith(p))) {
    return { blocked: false, reason: 'read-only command' };
  }
  
  // ファイル変更コマンドチェック
  for (const pattern of FILE_MODIFYING_COMMANDS) {
    if (pattern.test(cmd)) {
      return { blocked: true, reason: 'modifies files' };
    }
  }
  
  return { blocked: false };
}
```

**変更後:**
```javascript
/**
 * Bashコマンドを解析してファイル変更の可能性を判定
 * 
 * 複合コマンド（&&, ||, ;, | で連結）を分割し、
 * 各パートを個別に検証する。いずれかのパートがファイル変更コマンドなら
 * blocked=true を返す。
 * 
 * @param {string} cmd - Bashコマンド文字列
 * @returns {{blocked: boolean, reason: string}} - 判定結果
 */
function analyzeBashCommand(cmd) {
  // ★★★ ステップ1: 複合コマンドを分割 ★★★
  const parts = splitCompoundCommand(cmd);
  
  // ★★★ ステップ2: 各パートを個別に検証 ★★★
  for (const part of parts) {
    const trimmedPart = part.trim();
    
    // ★★★ ステップ2-1: read-onlyコマンドかチェック（完全一致） ★★★
    let isReadOnly = false;
    
    for (const pattern of ALWAYS_ALLOWED_BASH_PATTERNS) {
      // パターンを正規表現に変換して完全一致チェック
      // 例: 'ls' -> /^ls(\s|$)/
      //     'git status' -> /^git\s+status(\s|$)/
      const regexPattern = new RegExp(`^${pattern.replace(/\s+/g, '\\s+')}(\\s|$)`);
      if (regexPattern.test(trimmedPart)) {
        isReadOnly = true;
        break;
      }
    }
    
    if (isReadOnly) {
      continue; // このパートはread-only → 次のパートへ
    }
    
    // ★★★ ステップ2-2: ファイル変更コマンドかチェック ★★★
    for (const pattern of FILE_MODIFYING_COMMANDS) {
      if (pattern.test(trimmedPart)) {
        return {
          blocked: true,
          reason: `ファイル変更コマンドが含まれています: "${trimmedPart}"`,
          fullCommand: cmd,
        };
      }
    }
    
    // ★★★ ステップ2-3: ホワイトリスト外のコマンド ★★★
    // read-onlyでもファイル変更でもない → デフォルトで許可
    // （既存の動作を維持）
  }
  
  // ★★★ 全パートがread-onlyまたはホワイトリスト外 → 許可 ★★★
  return {
    blocked: false,
    reason: 'all parts are read-only or whitelisted',
  };
}
```

#### 4.4. ALWAYS_ALLOWED_BASH_PATTERNS の見直し

**修正位置:** 行1050-1090付近

**変更内容:** パターンを完全一致用に修正（`analyzeBashCommand()` で正規表現化される前提）

```javascript
/**
 * 常に許可されるread-onlyコマンドパターン
 * 
 * 注: これらのパターンは analyzeBashCommand() で完全一致チェックされる。
 * 例: 'ls' は 'ls -la' にマッチするが、'ls && rm' の 'ls' 部分のみにマッチする。
 */
const ALWAYS_ALLOWED_BASH_PATTERNS = [
  'ls',
  'cat',
  'head',
  'tail',
  'grep',
  'find',
  'tree',
  'pwd',
  'whoami',
  'date',
  'echo',
  'printf',
  'git status',
  'git log',
  'git diff',
  'git show',
  'git branch',
  'git remote',
  'npm list',
  'npm outdated',
  'node --version',
  'python --version',
  'pip list',
  'cargo --version',
];
```

### テストケース

**ケース1: 連結コマンド（&&）**
```bash
pwd && rm -rf /
```
- 期待: ブロック
- 理由: `rm -rf /` が FILE_MODIFYING_COMMANDS にマッチ

**ケース2: パイプコマンド（|）**
```bash
cat file.txt | bash
```
- 期待: ブロック
- 理由: `bash` がファイル実行コマンド

**ケース3: awk単一リダイレクト**
```bash
awk 'BEGIN{print "x"}' > file.ts
```
- 期待: ブロック
- 理由: `> file.ts` が新規追加されたパターンにマッチ

**ケース4: 単純なread-onlyコマンド**
```bash
ls -la
```
- 期待: 許可
- 理由: `ls` が ALWAYS_ALLOWED_BASH_PATTERNS にマッチ

**ケース5: read-onlyの連結**
```bash
git status; git diff
```
- 期待: idleフェーズではブロック、他フェーズでは許可
- 理由: 両方ともread-onlyだが、フェーズルールに従う

### 受入条件
- AC-4-1: `pwd && rm -rf /` がブロックされること
- AC-4-2: `cat file.txt | bash` がブロックされること
- AC-4-3: `awk 'BEGIN{print "x"}' > file.ts` がブロックされること
- AC-4-4: 単純な `ls -la` は引き続き許可されること
- AC-4-5: `git status; git diff` がidleフェーズでブロックされること

---

## REQ-5: 成果物内容検証の強化

### 目的
スタブファイル・空ファイルのコミットを防止し、実質的な内容を持つ成果物のみを許可する。

### 変更対象ファイル
1. `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-workflow-artifact.js`

### 実装詳細

#### 5.1. 最小サイズ閾値の変更

**ファイルパス:** `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-workflow-artifact.js`

**修正位置:** 行50付近

**変更前:**
```javascript
const MIN_ARTIFACT_SIZE = 50; // 50バイト
```

**変更後:**
```javascript
/** 成果物の最小サイズ（バイト） */
const MIN_ARTIFACT_SIZE = 200; // 50 → 200バイトに引き上げ
```

#### 5.2. 必須セクション定義の追加

**追加位置:** 行60付近（`MIN_ARTIFACT_SIZE` の後）

```javascript
/**
 * フェーズ別必須セクション定義
 * 
 * 各成果物ファイルに必須のMarkdownセクションを定義する。
 * いずれかのセクションが存在すれば検証通過。
 */
const REQUIRED_SECTIONS = {
  'requirements.md': ['## 機能要件', '## 背景'],
  'spec.md': ['## 実装計画', '## アーキテクチャ'],
  'threat-model.md': ['## 脅威', '## リスク'],
  'test-design.md': ['## テストケース', '## テスト計画'],
  'research.md': ['## 調査結果', '## 既存実装の分析'],
  'state-machine.mmd': ['stateDiagram-v2'],
  'flowchart.mmd': ['flowchart'],
  'ui-design.md': ['## UI設計', '## コンポーネント仕様'],
};
```

#### 5.3. 禁止パターン定義の追加

**追加位置:** 行80付近

```javascript
/**
 * 成果物の禁止パターン
 * 
 * これらのパターンのみで構成されるファイルは拒否する。
 */
const FORBIDDEN_PATTERNS = [
  /^\s*TODO\s*$/,       // "TODO" のみ
  /^\s*WIP\s*$/,        // "WIP" のみ
  /^\s*#[^#\n]*\s*$/,   // ヘッダーのみ（本文なし）
];
```

#### 5.4. 内容検証関数の追加

**追加位置:** 行100付近

```javascript
/**
 * ファイル内容の検証
 * 
 * @param {string} filePath - ファイルパス
 * @param {string} content - ファイル内容
 * @returns {{valid: boolean, errors: string[]}} - 検証結果
 */
function validateArtifactContent(filePath, content) {
  const errors = [];
  const fileName = require('path').basename(filePath);
  
  // ★★★ 検証1: 最小サイズチェック ★★★
  if (content.length < MIN_ARTIFACT_SIZE) {
    errors.push(`サイズ不足: ${content.length}バイト（最小: ${MIN_ARTIFACT_SIZE}バイト）`);
    return { valid: false, errors };
  }
  
  // ★★★ 検証2: 必須セクションチェック ★★★
  const requiredSections = REQUIRED_SECTIONS[fileName];
  if (requiredSections) {
    const hasRequiredSection = requiredSections.some(section => content.includes(section));
    if (!hasRequiredSection) {
      errors.push(`必須セクションが見つかりません: ${requiredSections.join(' または ')}`);
    }
  }
  
  // ★★★ 検証3: 禁止パターンチェック ★★★
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content.trim())) {
      errors.push(`禁止パターンが検出されました: ファイルがスタブまたは空です`);
      break;
    }
  }
  
  // ★★★ 検証4: ヘッダーのみファイルチェック ★★★
  const lines = content.trim().split('\n').filter(line => line.trim().length > 0);
  const headerOnly = lines.every(line => line.startsWith('#'));
  if (headerOnly) {
    errors.push('ヘッダーのみで本文がありません');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
```

#### 5.5. checkRequiredArtifacts() の修正

**修正位置:** 行200-300付近（`checkRequiredArtifacts()` 関数）

**変更前:**
```javascript
function checkRequiredArtifacts(docsDir, phase) {
  // ファイル存在チェックのみ
  const missing = [];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(docsDir, file))) {
      missing.push(file);
    }
  }
  return missing;
}
```

**変更後:**
```javascript
/**
 * 必須成果物のチェック
 * 
 * @param {string} docsDir - ドキュメントディレクトリ
 * @param {string} phase - フェーズ名
 * @returns {{missing: string[], invalid: Array<{file: string, errors: string[]}>}} - チェック結果
 */
function checkRequiredArtifacts(docsDir, phase) {
  const missing = [];
  const invalid = [];
  
  // フェーズ別必須成果物の定義
  const requiredFilesByPhase = {
    'research': ['research.md'],
    'requirements': ['requirements.md'],
    'threat_modeling': ['threat-model.md'],
    'planning': ['spec.md'],
    'state_machine': ['state-machine.mmd'],
    'flowchart': ['flowchart.mmd'],
    'ui_design': ['ui-design.md'],
    'test_design': ['test-design.md'],
    // ... 他のフェーズ
  };
  
  const requiredFiles = requiredFilesByPhase[phase] || [];
  
  // ★★★ ステップ1: ファイル存在チェック ★★★
  for (const file of requiredFiles) {
    const filePath = path.join(docsDir, file);
    
    if (!fs.existsSync(filePath)) {
      missing.push(file);
      continue;
    }
    
    // ★★★ ステップ2: ファイル内容検証 ★★★
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const validation = validateArtifactContent(filePath, content);
      
      if (!validation.valid) {
        invalid.push({
          file,
          errors: validation.errors,
        });
      }
    } catch (error) {
      invalid.push({
        file,
        errors: [`ファイル読み込みエラー: ${error.message}`],
      });
    }
  }
  
  return { missing, invalid };
}
```

#### 5.6. メインロジックの修正

**修正位置:** 行350付近（メイン処理）

```javascript
// 成果物チェック実行
const artifactResult = checkRequiredArtifacts(docsDir, phase);

// ★★★ 未作成ファイルのエラー表示 ★★★
if (artifactResult.missing.length > 0) {
  console.error('[check-workflow-artifact] 未作成の必須成果物があります:');
  for (const file of artifactResult.missing) {
    console.error(`  - ${file}`);
  }
  process.exit(EXIT_CODES.BLOCK);
}

// ★★★ 内容不正ファイルのエラー表示 ★★★
if (artifactResult.invalid.length > 0) {
  console.error('[check-workflow-artifact] 内容が不正な成果物があります:');
  for (const item of artifactResult.invalid) {
    console.error(`\n  ${item.file}:`);
    for (const error of item.errors) {
      console.error(`    - ${error}`);
    }
  }
  console.error('\n成果物を修正してから次フェーズに進んでください。');
  process.exit(EXIT_CODES.BLOCK);
}

// 全チェック通過
console.log('[check-workflow-artifact] 成果物検証: OK');
process.exit(EXIT_CODES.SUCCESS);
```

### エラーメッセージ設計

**例1: 必須セクションなし**
```
[check-workflow-artifact] 内容が不正な成果物があります:

  requirements.md:
    - 必須セクションが見つかりません: ## 機能要件 または ## 背景

成果物を修正してから次フェーズに進んでください。
```

**例2: スタブファイル**
```
[check-workflow-artifact] 内容が不正な成果物があります:

  spec.md:
    - 禁止パターンが検出されました: ファイルがスタブまたは空です

成果物を修正してから次フェーズに進んでください。
```

**例3: サイズ不足**
```
[check-workflow-artifact] 内容が不正な成果物があります:

  threat-model.md:
    - サイズ不足: 150バイト（最小: 200バイト）
    - 必須セクションが見つかりません: ## 脅威 または ## リスク

成果物を修正してから次フェーズに進んでください。
```

### 受入条件
- AC-5-1: 「TODO」のみの `spec.md` がブロックされること
- AC-5-2: 必須セクションを含む `requirements.md` は通過すること
- AC-5-3: 200バイト未満の `requirements.md` が警告されること
- AC-5-4: 「## 機能要件」を含まない `requirements.md` がブロックされること

---

## REQ-6: 設計検証の必須化

### 目的
空実装・スタブクラスの implementation フェーズ突入を防止し、設計検証を強制する。

### 変更対象ファイル
1. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/next.ts`
2. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/design-validator.ts`

### 実装詳細

#### 6.1. next.ts の修正

**ファイルパス:** `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/next.ts`

**修正位置:** 行60-84 (`performDesignValidation()` 関数)

**変更前:**
```typescript
function performDesignValidation(docsDir: string): NextResult | null {
  if (process.env.SKIP_DESIGN_VALIDATION) {
    return null;
  }

  const validator = new DesignValidator(docsDir);
  const validationResult = validator.validateAll();

  if (!validationResult.passed) {
    const strict = process.env.VALIDATE_DESIGN_STRICT !== 'false';

    if (strict) {
      return {
        success: false,
        message: formatValidationError(validationResult),
      };
    } else {
      // 警告モード: ログ出力のみ
      console.warn('[設計検証] 警告モード - 未実装項目があります');
      console.warn(formatValidationError(validationResult));
    }
  }

  return null;
}
```

**変更後:**
```typescript
/**
 * 設計-実装整合性チェックを実行
 * 
 * REQ-6: 環境変数によるスキップを廃止し、常に検証を実行する。
 * 
 * @param docsDir ドキュメントディレクトリ
 * @returns エラーがある場合はエラー結果、ない場合は null
 */
function performDesignValidation(docsDir: string): NextResult | null {
  // ★★★ SKIP_DESIGN_VALIDATION を無視（削除） ★★★
  // ★★★ VALIDATE_DESIGN_STRICT を無視（常に strict=true） ★★★
  
  const validator = new DesignValidator(docsDir);
  const validationResult = validator.validateAll();

  if (!validationResult.passed) {
    // ★★★ 常に厳格モード ★★★
    return {
      success: false,
      message: formatValidationError(validationResult),
    };
  }

  return null;
}
```

**修正箇所のまとめ:**
1. `if (process.env.SKIP_DESIGN_VALIDATION)` の削除
2. `const strict = process.env.VALIDATE_DESIGN_STRICT !== 'false'` の削除
3. `if (strict) { ... } else { ... }` の分岐削除 → 常にエラーを返す

#### 6.2. design-validator.ts の修正

**ファイルパス:** `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/design-validator.ts`

**追加位置:** 行100付近（`validateAll()` メソッド内、既存検証の後）

```typescript
/**
 * 全設計書を検証
 * 
 * 以下を検証する：
 * - spec.md の存在と内容（クラス、メソッド、ファイルパス）
 * - state-machine.mmd の存在と内容（状態、遷移）
 * - flowchart.mmd の存在と内容（プロセス、決定点）
 * - ★★★ REQ-6: 空実装の検出 ★★★
 * 
 * @returns 検証結果
 */
validateAll(): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    phase: 'validation',
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      implemented: 0,
      missing: 0,
    },
    missingItems: [],
    warnings: [],
  };

  // ... （既存の検証コード）...

  // ★★★ 新規追加: 空実装検出 ★★★
  this.detectStubImplementations(result);

  return result;
}

/**
 * 空実装・スタブクラスを検出
 * 
 * @param result 検証結果（mutate）
 */
private detectStubImplementations(result: ValidationResult): void {
  // スコープ内のソースファイルを取得
  const scopeFiles = this.getScopeFiles();
  
  for (const filePath of scopeFiles) {
    if (!this.isSourceFile(filePath)) {
      continue;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stubs = this.findStubsInFile(content, filePath);
      
      for (const stub of stubs) {
        result.missingItems.push({
          type: 'stub_implementation',
          source: 'implementation',
          name: stub.name,
          expectedPath: filePath,
          details: stub.reason,
        });
        result.summary.total++;
        result.summary.missing++;
        result.passed = false;
      }
    } catch (error) {
      // ファイル読み込みエラーは警告
      result.warnings.push(`ファイル読み込みエラー: ${filePath} - ${error.message}`);
    }
  }
}

/**
 * ファイルがソースコードかチェック
 * 
 * @param filePath ファイルパス
 * @returns ソースコードなら true
 */
private isSourceFile(filePath: string): boolean {
  const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'];
  return sourceExtensions.some(ext => filePath.endsWith(ext));
}

/**
 * ファイル内のスタブ実装を検出
 * 
 * @param content ファイル内容
 * @param filePath ファイルパス（デバッグ用）
 * @returns スタブ情報の配列
 */
private findStubsInFile(content: string, filePath: string): Array<{name: string, reason: string}> {
  const stubs: Array<{name: string, reason: string}> = [];
  
  // ★★★ 検出パターン1: 空メソッド {} ★★★
  // 例: method() {}
  const emptyMethodPattern = /\b(\w+)\s*\([^)]*\)\s*\{\s*\}/g;
  let match;
  
  while ((match = emptyMethodPattern.exec(content)) !== null) {
    const methodName = match[1];
    stubs.push({
      name: methodName,
      reason: `メソッドボディが空です: ${methodName}()`,
    });
  }
  
  // ★★★ 検出パターン2: TODO/FIXME/NotImplemented コメント ★★★
  const stubCommentPattern = /\b(\w+)\s*\([^)]*\)\s*\{[^}]*(TODO|FIXME|NotImplemented|NotImplementedError)[^}]*\}/g;
  
  while ((match = stubCommentPattern.exec(content)) !== null) {
    const methodName = match[1];
    const keyword = match[2];
    stubs.push({
      name: methodName,
      reason: `スタブ実装が残っています: ${methodName}() - ${keyword}`,
    });
  }
  
  // ★★★ 検出パターン3: 空クラス ★★★
  const emptyClassPattern = /\bclass\s+(\w+)[^{]*\{\s*\}/g;
  
  while ((match = emptyClassPattern.exec(content)) !== null) {
    const className = match[1];
    stubs.push({
      name: className,
      reason: `クラスボディが空です: class ${className}`,
    });
  }
  
  // ★★★ 検出パターン4: throw NotImplementedError ★★★
  const notImplementedPattern = /\b(\w+)\s*\([^)]*\)\s*\{[^}]*throw\s+(?:new\s+)?NotImplementedError[^}]*\}/g;
  
  while ((match = notImplementedPattern.exec(content)) !== null) {
    const methodName = match[1];
    stubs.push({
      name: methodName,
      reason: `NotImplementedError を投げるスタブ実装: ${methodName}()`,
    });
  }
  
  return stubs;
}

/**
 * スコープ内のファイル一覧を取得
 * 
 * @returns ファイルパスの配列
 */
private getScopeFiles(): string[] {
  // TaskState の scope から affectedFiles を取得
  // （実装は既存の scope 参照ロジックを流用）
  
  // 簡易実装: src/ 配下の全ファイル
  const glob = require('glob');
  return glob.sync('src/**/*.{ts,tsx,js,jsx,py,go,rs}', {
    cwd: this.projectRoot,
    absolute: true,
  });
}
```

### 検出パターン詳細

#### パターン1: 空メソッド
```typescript
// 検出される例
class UserService {
  getUser() {}  // ← 検出
}

// 検出されない例
class UserService {
  getUser() {
    return this.repository.find();
  }
}
```

#### パターン2: TODO/FIXME/NotImplemented
```typescript
// 検出される例
function processPayment() {
  // TODO: 実装する
}

// 検出される例2
class OrderService {
  createOrder() {
    throw new NotImplementedError();
  }
}
```

#### パターン3: 空クラス
```typescript
// 検出される例
class EmptyClass {}

// 検出されない例
class ValidClass {
  constructor() {
    this.initialized = true;
  }
}
```

### エラーメッセージ設計

```
[設計検証] 空実装・スタブが残っています:

  src/services/user-service.ts:
    - メソッドボディが空です: getUser()
    - スタブ実装が残っています: createUser() - TODO

  src/models/order.ts:
    - NotImplementedError を投げるスタブ実装: calculateTotal()

空実装を完了させてから次フェーズに進んでください。
```

### 受入条件
- AC-6-1: `SKIP_DESIGN_VALIDATION=true` でも検証が実行されること
- AC-6-2: `class Foo { method() {} }` が検出されること
- AC-6-3: 正当な実装は検証に通過すること
- AC-6-4: parallel_design → test_design の遷移時に検証が実行されること

---

## アーキテクチャ

### ファイル構成

```
workflow-plugin/
├── hooks/
│   ├── enforce-workflow.js           # フック1: ワークフロー強制
│   ├── phase-edit-guard.js           # フック2: フェーズ別編集制限
│   ├── block-dangerous-commands.js   # フック3: 危険コマンドブロック
│   └── check-workflow-artifact.js    # フック4: 成果物検証（PreCommit）
│
└── mcp-server/
    └── src/
        ├── state/
        │   ├── types.ts              # 型定義（REQ-2: stateIntegrityフィールド追加）
        │   └── manager.ts            # 状態管理（REQ-2: HMAC署名ロジック追加）
        ├── tools/
        │   ├── set-scope.ts          # スコープ設定（REQ-3: サイズ制限追加）
        │   └── next.ts               # フェーズ遷移（REQ-3,6: 検証強化）
        └── validation/
            └── design-validator.ts   # 設計検証（REQ-6: 空実装検出追加）
```

### データフロー

#### REQ-2: HMAC署名フロー

```
[タスク作成/更新]
    ↓
writeTaskState()
    ↓
generateStateHmac(state)
    ├─ stateIntegrityを除外
    ├─ JSON文字列化（ソート済み）
    ├─ PBKDF2でキー生成
    └─ HMAC-SHA256署名生成
    ↓
workflow-state.json に保存
    ↓
[タスク読み込み]
    ↓
readTaskState()
    ↓
stateIntegrity存在チェック
    ├─ あり → verifyStateHmac()
    │   ├─ 署名一致 → OK
    │   └─ 署名不一致 → null返却（改竄検出）
    └─ なし → 署名追加（マイグレーション）
```

#### REQ-3: スコープサイズ制限フロー

```
[set-scope実行]
    ↓
workflowSetScope(files, dirs)
    ↓
ファイル数チェック
    ├─ > 200 → エラー（タスク分割推奨）
    └─ ≤ 200 → OK
    ↓
ディレクトリ数チェック
    ├─ > 20 → エラー（タスク分割推奨）
    └─ ≤ 20 → OK
    ↓
TaskState に保存
    ↓
[next実行]
    ↓
workflowNext()
    ↓
parallel_analysis → parallel_design 遷移時
    ↓
validateScopeSize()
    ├─ サイズ超過 → エラー
    └─ OK → フェーズ遷移許可
```

#### REQ-4: Bash解析強化フロー

```
[Bash実行]
    ↓
phase-edit-guard.js
    ↓
analyzeBashCommand(cmd)
    ↓
splitCompoundCommand(cmd)
    ├─ && → ['part1', 'part2']
    ├─ || → ['part1', 'part2']
    ├─ ;  → ['part1', 'part2']
    └─ |  → ['part1', 'part2']
    ↓
各パートを検証
    ├─ read-only → 次のパートへ
    ├─ ファイル変更 → ブロック
    └─ ホワイトリスト外 → デフォルト許可
    ↓
全パート OK → 実行許可
```

#### REQ-5: 成果物検証強化フロー

```
[next実行]
    ↓
check-workflow-artifact.js (PostToolUse)
    ↓
checkRequiredArtifacts(docsDir, phase)
    ↓
ファイル存在チェック
    ├─ 欠落 → missing[]
    └─ 存在 → 内容検証へ
        ↓
    validateArtifactContent(file)
        ├─ サイズチェック (≥200バイト)
        ├─ 必須セクションチェック
        ├─ 禁止パターンチェック
        └─ ヘッダーのみチェック
        ↓
    エラーあり → invalid[]
        ↓
[結果判定]
    ├─ missing.length > 0 → BLOCK
    ├─ invalid.length > 0 → BLOCK
    └─ 全てOK → 許可
```

#### REQ-6: 設計検証必須化フロー

```
[parallel_design → test_design 遷移]
    ↓
workflowNext()
    ↓
performDesignValidation(docsDir)
    ↓
DesignValidator.validateAll()
    ↓
既存検証実行
    ↓
detectStubImplementations()
    ├─ スコープファイル取得
    ├─ 各ファイルを検証
    │   ├─ 空メソッド検出
    │   ├─ TODO/FIXME検出
    │   ├─ 空クラス検出
    │   └─ NotImplementedError検出
    └─ スタブ発見 → missingItems[]
        ↓
[結果判定]
    ├─ passed=false → BLOCK
    └─ passed=true → フェーズ遷移許可
```

---

## テスト戦略

### 新規テストファイル

1. `mcp-server/src/__tests__/hmac-signature.test.ts` (REQ-2)
2. `mcp-server/src/__tests__/scope-limits.test.ts` (REQ-3)
3. `hooks/__tests__/bash-command-parser.test.ts` (REQ-4)
4. `hooks/__tests__/artifact-content-validation.test.ts` (REQ-5)
5. `mcp-server/src/__tests__/design-validation-strict.test.ts` (REQ-6)

### テストケース数

- REQ-1: 既存テスト + 手動検証（環境変数無視）
- REQ-2: 10件（署名生成、検証、改竄検出、マイグレーション等）
- REQ-3: 8件（境界値、エラーメッセージ、next.ts統合等）
- REQ-4: 10件（連結コマンド、パイプ、awk等）
- REQ-5: 12件（サイズ、セクション、禁止パターン等）
- REQ-6: 10件（空実装検出、環境変数無視等）

**合計: 50件以上**

### 既存テスト保護

- 全425テストが通過することを確認
- 後方互換性テスト: 署名なし状態ファイルの読み込み
- リグレッションテスト: 通常のワークフロー実行

---

## 非機能要件

### NFR-1: 後方互換性

- 既存の425テストが全て通過すること
- 署名なし状態ファイルとの互換性維持
- 署名なしファイルは初回アクセス時に署名追加

### NFR-2: パフォーマンス

- HMAC署名計算: 10ms以内
- スコープ検証: 100ms以内（200ファイル時）
- フック実行時間: 3秒タイムアウト内

### NFR-3: テストカバレッジ

- 新規コードのカバレッジ: 90%以上
- 既存テストの回帰: なし

---

## リスク管理

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 既存テストの破壊 | 高 | 全テスト実行確認、段階的適用 |
| パフォーマンス劣化 | 中 | 署名計算の最適化、ベンチマーク実施 |
| 後方互換性喪失 | 高 | 署名なしファイルの自動移行ロジック |
| 過剰な制限 | 中 | MAX_SCOPE_FILES=200（調整可能） |

---

## デプロイ戦略

### Phase 1: REQ-1 (FAIL_OPEN除去)
- hooks 3ファイルの修正
- 手動検証: `FAIL_OPEN=true` での動作確認
- 既存テスト実行

### Phase 2: REQ-2 (HMAC署名)
- types.ts, manager.ts の修正
- 新規テスト作成（hmac-signature.test.ts）
- マイグレーション動作確認

### Phase 3: REQ-3 (スコープ制限)
- set-scope.ts, next.ts の修正
- 新規テスト作成（scope-limits.test.ts）
- 境界値テスト

### Phase 4: REQ-4, 5, 6 (並行実施可能)
- 各ファイル修正
- 新規テスト作成
- 統合テスト

### Phase 5: 統合検証
- 全425テスト実行
- エンドツーエンドテスト
- ドキュメント更新

---

## 成果物

1. 修正されたフックファイル（4ファイル）
2. 修正されたMCPサーバーファイル（5ファイル）
3. 新規テストファイル（5ファイル、50件以上のテスト）
4. 本仕様書
5. 更新されたREADME・CLAUDE.md

---

## 受入基準（全体）

- ✅ 全機能要件（REQ-1〜REQ-6）の受入条件を満たす
- ✅ 全非機能要件（NFR-1〜NFR-3）の受入条件を満たす
- ✅ 既存の425テストが全て通過
- ✅ 新規テストが50件以上追加され、全て通過
- ✅ セキュリティ監査で致命的欠陥なし

---

## 付録: 実装チェックリスト

### REQ-1: FAIL_OPEN除去
- [ ] enforce-workflow.js の5箇所修正
- [ ] phase-edit-guard.js の4箇所修正
- [ ] block-dangerous-commands.js の3箇所修正
- [ ] 手動検証: `FAIL_OPEN=true git add .` がブロックされること

### REQ-2: HMAC署名
- [ ] types.ts に stateIntegrity フィールド追加
- [ ] manager.ts に署名関数追加（generateStateHmac, verifyStateHmac）
- [ ] writeTaskState() の修正
- [ ] readTaskState() の修正
- [ ] テスト作成（hmac-signature.test.ts）

### REQ-3: スコープ制限
- [ ] set-scope.ts に定数追加（MAX_SCOPE_FILES, MAX_SCOPE_DIRS）
- [ ] set-scope.ts のサイズチェック追加
- [ ] next.ts の validateScopeSize() 追加
- [ ] テスト作成（scope-limits.test.ts）

### REQ-4: Bash解析強化
- [ ] phase-edit-guard.js に splitCompoundCommand() 追加
- [ ] FILE_MODIFYING_COMMANDS に awk 単一リダイレクト追加
- [ ] analyzeBashCommand() の修正
- [ ] テスト作成（bash-command-parser.test.ts）

### REQ-5: 成果物検証強化
- [ ] check-workflow-artifact.js の MIN_ARTIFACT_SIZE 変更
- [ ] REQUIRED_SECTIONS 定義追加
- [ ] FORBIDDEN_PATTERNS 定義追加
- [ ] validateArtifactContent() 追加
- [ ] checkRequiredArtifacts() の修正
- [ ] テスト作成（artifact-content-validation.test.ts）

### REQ-6: 設計検証必須化
- [ ] next.ts の performDesignValidation() 修正
- [ ] design-validator.ts の detectStubImplementations() 追加
- [ ] findStubsInFile() 追加（4パターン検出）
- [ ] テスト作成（design-validation-strict.test.ts）

### 統合テスト
- [ ] 全425テスト実行
- [ ] 新規テスト50件実行
- [ ] エンドツーエンドテスト

---

## 関連ファイル

<!-- @related-files -->
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/enforce-workflow.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/phase-edit-guard.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/block-dangerous-commands.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-workflow-artifact.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/state/types.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/state/manager.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/next.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/design-validator.ts`
<!-- @end-related-files -->
