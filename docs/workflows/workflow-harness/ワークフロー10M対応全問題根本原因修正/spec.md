# 実装仕様書: ワークフロー10M対応全問題根本原因修正

## サマリー

本仕様書は、レビューで特定された13件の修正要件に対する詳細実装仕様を定義する。
修正は4つの実装フェーズに分類され、Phase 1（P0修正）では開発体験に直接影響する重大な問題3件を最優先で対応する。
Phase 2（P1修正）ではセキュリティ・機能性に関わる4件、Phase 3（P2修正）では保守性改善4件、Phase 4ではCLAUDE.md修正2件を実施する。

P0修正の中核はtask-index.jsonの統一、フック性能のO(1)化、Fail-Closedの緩和である。
task-index.jsonはHookスキーマ`{tasks: [...], updatedAt}`に統一し、MCP serverはworkflow-state.jsonのみを更新する読み取り専用設計とする。
フック性能改善では、task-index.jsonキャッシュによりディレクトリスキャンを回避し、アクティブタスクのみをHMAC検証する。
Fail-Closed緩和では、エラーカテゴリ分類ロジックによりセキュリティ違反と一時的エラーを区別し、後者はexit(0)で許可する。

P1修正ではbash-whitelistに変数展開・プロセス置換の検出パターンを追加し、バリデーション処理に10秒タイムアウトを設定する。
HMAC鍵にcreatedAt/expiresAtフィールドを追加し30日自動ローテーションを実装し、userIntent更新ツールworkflow_update_intentを新設する。

P2修正ではASTキャッシュをLRU(100エントリ)化し、並列フェーズ依存関係をフック側でも強制し、スコープ検証を改善する。
CLAUDE.md修正ではサマリーセクション行数制限を50→200行に緩和し、taskSize選択によるフェーズ数調整機能を復活させる。

全修正完了後、既存772テスト全件成功を維持し、新規追加テストも全件成功することを受入基準とする。

## 概要

本仕様書は、ワークフロープラグインの10M行規模プログラム対応における13件の問題の根本原因を分析し、修正仕様を定義する。
対象はhooks/lib/discover-tasks.js, hooks/phase-edit-guard.js, hooks/bash-whitelist.js, hooks/enforce-workflow.js, mcp-server/src/state/manager.ts, mcp-server/src/state/hmac.ts等のコアモジュールである。
修正はPhase 1（P0: 重大問題3件）、Phase 2（P1: セキュリティ4件）、Phase 3（P2: 保守性4件）、Phase 4（CLAUDE.md 2件）の4段階で実施する。
全修正はTDD方式で進行し、既存テスト772件の完全互換を維持しつつ、新規テスト追加により品質を保証する。
修正範囲はworkflow-plugin/ディレクトリ配下に限定し、他プロジェクトへの影響を排除する。

## 実装計画

### Phase 1: P0修正（3件）

#### REQ-1: task-index.jsonデュアルスキーマ競合の解消

##### 変更対象ファイル

- `mcp-server/src/state/manager.ts` (saveTaskIndex, loadTaskIndex, rebuildTaskIndex)
- `mcp-server/src/tools/start.ts` (workflow_start実装)
- `mcp-server/src/tools/next.ts` (workflow_next実装)
- `hooks/lib/discover-tasks.js` (readTaskIndexCache, writeTaskIndexCache)

##### 変更箇所と変更内容

**1. manager.ts: saveTaskIndex()をno-opから復活 (行464-470)**

現在の実装は意図的にno-opであり、「Hook側が唯一の書き込み権限を持つ」とコメントされている。
しかし、この設計では新タスク開始時にtasks配列が更新されず、前回修正のリグレッション原因となった。

**変更内容:**
- saveTaskIndex()をno-opから実装ありのメソッドに変更
- Hookスキーマ`{tasks: [...], updatedAt}`形式でtask-index.jsonに書き込む
- tasks配列の各要素は`{id: string, name: string, workflowDir: string, docsDir: string, phase: string, updatedAt: number}`とする
- ファイルロック（acquireLockSync）を使用して排他制御を実施
- write-then-renameパターン（atomicWriteJson）でアトミックな書き込みを保証
- 書き込み後にキャッシュ無効化（taskCache.invalidate('task-list')）を実行

**実装例:**
```typescript
private saveTaskIndex(index: Record<string, string>): void {
  const releaseLock = acquireLockSync(this.indexPath);
  try {
    const tasks = this.discoverTasks();
    const taskList = {
      tasks: tasks.map(task => ({
        id: task.taskId,
        name: task.taskName,
        workflowDir: task.workflowDir,
        docsDir: task.docsDir,
        phase: task.phase,
        updatedAt: Date.now(),
      })),
      updatedAt: Date.now(),
    };
    atomicWriteJson(this.indexPath, taskList);
    taskCache.invalidate('task-list');
  } finally {
    releaseLock();
  }
}
```

**2. manager.ts: loadTaskIndex()のスキーマ判定ロジック改善 (行428-458)**

現在の実装はHookスキーマとレガシーマップ形式の両方をサポートしているが、優先順位が不明確である。

**変更内容:**
- Hookスキーマ（tasks配列）を優先して読み込む
- レガシーマップ形式はフォールバック扱いとし、将来廃止を予定
- schemaVersionフィールド（デフォルト: 2）を追加してバージョン管理を導入
- バージョン1（レガシーマップ）を検出した場合、警告ログを出力して自動移行を実施

**3. manager.ts: createTask()でsaveTaskIndex()を呼び出し (行703-708)**

現在の実装ではcreateTask()内でsaveTaskIndex()を呼び出しているが、no-op化により実質的に無効化されている。

**変更内容:**
- saveTaskIndex()呼び出しをそのまま維持（no-opから実装ありに変更されるため、自動的に有効化される）
- 新タスク作成時にtasks配列に新エントリが追加されることを保証

**4. manager.ts: updateTaskPhase()でsaveTaskIndex()を呼び出し (行782-794)**

現在の実装ではupdateTaskPhase()内でcompletedフェーズ時のインデックス削除のみを実施している。

**変更内容:**
- フェーズ遷移時（completed以外）もsaveTaskIndex()を呼び出し、phaseフィールドを更新
- completedフェーズ時はインデックスから削除する既存ロジックを維持

**5. discover-tasks.js: readTaskIndexCache()の読み込みロジック (行46-65)**

現在の実装はHookスキーマを読み込んでいるが、エラー時のフォールバックが不十分である。

**変更内容:**
- schemaVersionフィールドをチェックし、バージョン2（Hookスキーマ）を期待
- バージョン1（レガシーマップ）を検出した場合、null返却してフルスキャンにフォールバック
- tasks配列の各要素にid, name, workflowDir, docsDir, phaseフィールドが含まれることを検証

**6. discover-tasks.js: writeTaskIndexCache()の書き込みロジック (行72-82)**

現在の実装はHook側が書き込みを実施しているが、MCP server側との同期が不完全である。

**変更内容:**
- MCP server側のsaveTaskIndex()が主導権を持つため、Hook側のwriteTaskIndexCache()は廃止を検討
- 過渡期の対応として、MCP serverが書き込んだファイルをHook側で上書きしないよう、書き込み前にmtimeチェックを実施
- mtimeがキャッシュのgeneratedAtより新しい場合、書き込みをスキップ

##### 後方互換性

- 既存のtask-index.json（レガシーマップ形式）は初回loadTaskIndex()時に自動移行される
- 移行中は両形式を読み取り可能とし、段階的に移行を完了する
- schemaVersionフィールドにより、新旧フォーマットの混在を検出可能

##### テスト仕様

**単体テスト（manager.test.ts）**
- saveTaskIndex()がHookスキーマで書き込むことを検証
- tasks配列の各要素が必須フィールド（id, name, workflowDir, phase, updatedAt）を含むことを検証
- updatedAtフィールドが現在時刻（Date.now()）であることを検証

**統合テスト（workflow-integration.test.ts）**
- workflow_start実行後にtask-index.jsonを読み込み、tasks配列に新エントリが存在することを検証
- workflow_next実行後にphaseフィールドが更新されていることを検証
- 複数タスク作成時にtasks配列が正しく更新されることを検証

**回帰テスト（regression.test.ts）**
- 既存の772テスト全件が成功することを検証
- 特にdiscoverTasks()を使用するテストケースが影響を受けないことを確認

---

#### REQ-2: O(n)フック性能問題の改善

##### 変更対象ファイル

- `hooks/lib/discover-tasks.js` (discoverTasks関数)
- `hooks/enforce-workflow.js` (HMAC検証ループ 行283-305)
- `mcp-server/src/state/manager.ts` (generateTaskListFile 行964-988)

##### 変更箇所と変更内容

**1. discover-tasks.js: discoverTasks()のキャッシュヒット最適化 (行95-143)**

現在の実装はreadTaskIndexCache()でキャッシュヒットした場合にtasks配列を返すが、ディレクトリスキャンをスキップする最適化が不完全である。

**変更内容:**
- readTaskIndexCache()がnullでない場合、tasks配列をそのまま返却してディレクトリスキャンを完全にスキップ
- キャッシュヒット時のログ出力を追加（デバッグレベル）
- TTL（1時間）を環境変数TASK_INDEX_TTL_MSでオーバーライド可能にする

**実装例:**
```javascript
function discoverTasks() {
  return getCached('discover-tasks', undefined, () => {
    const cachedTasks = readTaskIndexCache();
    if (cachedTasks !== null) {
      // キャッシュヒット: ディレクトリスキャンをスキップ
      console.debug('[discoverTasks] Cache hit, skipping directory scan');
      return cachedTasks;
    }

    // キャッシュミス: フルスキャン実行
    console.debug('[discoverTasks] Cache miss, performing full scan');
    // ... 既存のディレクトリスキャンロジック
  });
}
```

**2. enforce-workflow.js: HMAC検証をアクティブタスクのみに限定 (行283-305)**

現在の実装は全タスクに対してverifyHMAC()を実行しており、タスク数に比例して性能が劣化する。

**変更内容:**
- discoverTasks()で取得したタスク配列のうち、ファイル編集対象のタスクのみをHMAC検証
- findTaskByFilePath()で特定されたタスクが存在する場合、そのタスクのみを検証
- ファイルがどのタスクにも属さない場合、最初のアクティブタスク（tasks[0]）のみを検証
- 複数タスクのループ検証を廃止し、定数時間O(1)で完了するよう変更

**実装例:**
```javascript
const tasks = discoverTasks();
const currentTask = findTaskByFilePath(filePath);
const taskState = currentTask || tasks[0];

// アクティブタスク1件のみを検証
if (!verifyHMAC(taskState)) {
  console.log('🚫 BLOCKED: タスク状態の署名検証失敗');
  console.log(`タスクID: ${taskState.taskId}`);
  process.exit(2);
}
```

**3. manager.ts: generateTaskListFile()の呼び出しタイミング最適化 (行964-988)**

現在の実装はgenerateTaskListFile()の呼び出しタイミングが不明確である。

**変更内容:**
- workflow_start, workflow_next, workflow_complete_sub実行後に自動的にgenerateTaskListFile()を呼び出す
- フック側でtask-list.jsonキャッシュを優先的に読み込むよう、TTLを短く設定（5分）
- generateTaskListFile()失敗時も処理を継続し、エラーログのみを出力

##### 後方互換性

- discoverTasks()の戻り値形式は変更しないため、呼び出し側への影響なし
- HMAC検証ロジックの変更は内部実装のみであり、外部インターフェースに影響しない

##### テスト仕様

**性能テスト（performance.test.js）**
- 100個のダミータスクを作成し、その中に1個のアクティブタスクを配置
- discoverTasks()の実行時間が100ms以下であることを検証
- キャッシュヒット時の実行時間が10ms以下であることを検証

**単体テスト（discover-tasks.test.js）**
- readTaskIndexCache()がnullを返す場合、フルスキャンが実行されることを検証
- readTaskIndexCache()がtasks配列を返す場合、ディレクトリスキャンがスキップされることをモックで検証

**統合テスト（enforce-workflow.test.js）**
- アクティブタスクのHMAC検証が確実に実行されることを検証
- 完了タスクのHMAC検証がスキップされることを検証

---

#### REQ-3: Fail-Closed過剰ブロックの緩和

##### 変更対象ファイル

- `hooks/enforce-workflow.js` (uncaughtExceptionハンドラ 行34-43)
- `hooks/phase-edit-guard.js` (uncaughtExceptionハンドラ)

##### 変更箇所と変更内容

**1. エラーカテゴリ分類ロジックの導入**

セキュリティ違反エラーと一時的エラーを区別するため、カスタムエラークラスを定義する。

実装例（hooks/lib/error-categories.js 新規作成）:
```javascript
class HMACValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HMACValidationError';
  }
}

class PhaseViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PhaseViolationError';
  }
}

function categorizeError(error) {
  // セキュリティ違反エラー
  if (error instanceof HMACValidationError) return 'security';
  if (error instanceof PhaseViolationError) return 'security';
  if (error.message && error.message.includes('HMAC')) return 'security';
  if (error.message && error.message.includes('署名')) return 'security';

  // 一時的エラー
  if (error.code === 'ENOENT') return 'temporary';
  if (error.code === 'EACCES') return 'temporary';
  if (error.code === 'ETIMEDOUT') return 'temporary';
  if (error.name === 'SyntaxError') return 'temporary'; // JSON解析エラー

  // デフォルトはセキュリティ違反として扱う（安全側に倒す）
  return 'security';
}

module.exports = { HMACValidationError, PhaseViolationError, categorizeError };
```

**2. enforce-workflow.js: uncaughtExceptionハンドラの変更 (行34-43)**

現在の実装は全エラーでexit(2)を返すが、一時的エラーをexit(0)で許可するよう変更する。

**変更内容:**
- WORKFLOW_FAIL_MODE環境変数を導入（strict/permissive/未定義）
- デフォルトはpermissive（一時的エラーをexit(0)で許可）
- strictモードでは従来通り全エラーでexit(2)を返す
- permissiveモードでは一時的エラーをexit(0)、セキュリティ違反をexit(2)で処理
- 一時的エラー発生時はstderrとログファイルに警告を出力

**実装例:**
```javascript
const { categorizeError } = require('./lib/error-categories');

process.on('uncaughtException', (err) => {
  logError('未捕捉エラー', err.message, err.stack);

  const category = categorizeError(err);
  const failMode = process.env.WORKFLOW_FAIL_MODE || 'permissive';

  if (failMode === 'strict') {
    // 厳格モード: 全エラーでブロック
    console.error('[enforce-workflow] Strict mode: blocking all errors');
    process.exit(2);
  }

  if (category === 'security') {
    // セキュリティ違反: 常にブロック
    console.error('[enforce-workflow] Security violation: blocking operation');
    process.exit(2);
  }

  // 一時的エラー: 警告を出力して許可
  console.warn('[enforce-workflow] Temporary error detected, allowing operation with warning');
  console.warn(`  Error: ${err.message}`);
  console.warn(`  Fail mode: ${failMode}`);
  console.warn(`  WORKFLOW_FAIL_MODE=strict を設定すると、このエラーでブロックされます`);
  process.exit(0);
});
```

**3. 一時的エラーの連続発生検出**

一時的エラーが連続10回以上発生した場合、自動的にexit(2)に切り替える。

実装例（hooks/lib/error-counter.js 新規作成）:
```javascript
const fs = require('fs');
const path = require('path');

const ERROR_COUNTER_FILE = path.join(process.cwd(), '.claude', 'state', 'hook-error-count.json');

function incrementErrorCount() {
  let count = 0;
  try {
    if (fs.existsSync(ERROR_COUNTER_FILE)) {
      const data = JSON.parse(fs.readFileSync(ERROR_COUNTER_FILE, 'utf8'));
      count = data.count || 0;
    }
  } catch {
    count = 0;
  }

  count++;
  fs.writeFileSync(ERROR_COUNTER_FILE, JSON.stringify({ count, timestamp: Date.now() }));
  return count;
}

function resetErrorCount() {
  try {
    fs.unlinkSync(ERROR_COUNTER_FILE);
  } catch {
    // ファイルが存在しない場合は無視
  }
}

module.exports = { incrementErrorCount, resetErrorCount };
```

**4. HMAC検証必須ファイルのENOENTエラーをセキュリティ違反として扱う**

workflow-state.json, hmac-keys.jsonが存在しない場合のENOENTエラーは一時的エラーではなくセキュリティ違反として扱う。

**実装例:**
```javascript
function categorizeError(error) {
  // HMAC検証必須ファイルのENOENTはセキュリティ違反
  if (error.code === 'ENOENT' && error.path) {
    if (error.path.includes('workflow-state.json')) return 'security';
    if (error.path.includes('hmac-keys.json')) return 'security';
  }

  // 通常のENOENTは一時的エラー
  if (error.code === 'ENOENT') return 'temporary';
  // ... 以降既存ロジック
}
```

##### 後方互換性

- WORKFLOW_FAIL_MODE未設定時はpermissiveモードで動作するため、既存動作との互換性を維持
- 環境変数WORKFLOW_FAIL_MODE=strictを設定すれば従来の厳格な動作を選択可能

##### テスト仕様

**単体テスト（error-categories.test.js 新規作成）**
- HMACValidationErrorがcategory='security'と判定されることを検証
- ENOENTエラー（非HMAC関連）がcategory='temporary'と判定されることを検証
- workflow-state.jsonのENOENTがcategory='security'と判定されることを検証

**統合テスト（enforce-workflow.test.js）**
- セキュリティ違反エラー発生時にWORKFLOW_FAIL_MODEに関わらずexit(2)が返ることを検証
- 一時的エラー発生時にWORKFLOW_FAIL_MODE=permissiveならexit(0)が返ることを検証
- 一時的エラー発生時にWORKFLOW_FAIL_MODE=strictならexit(2)が返ることを検証
- 一時的エラーが連続10回発生した場合、exit(2)に切り替わることを検証

---

### Phase 2: P1修正（4件）

#### REQ-4: bash-whitelistバイパスベクターの対策

##### 変更対象ファイル

- `hooks/phase-edit-guard.js` (splitCompoundCommand関数、FILE_MODIFYING_COMMANDSパターン)

##### 変更箇所と変更内容

**1. 変数展開+リダイレクト検出パターンの追加**

変数展開とリダイレクトの組み合わせパターンを検出し、ブロックする。

**実装例:**
```javascript
// 変数展開+リダイレクトのパターン
const VARIABLE_REDIRECT_PATTERN = /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?\s*>\s*/;

function detectVariableRedirect(command) {
  return VARIABLE_REDIRECT_PATTERN.test(command);
}
```

**2. プロセス置換・コマンド置換検出パターンの追加**

プロセス置換`<(...)`、`>(...)`、コマンド置換`$(...)`、バッククォート\`...\`を検出する。

**実装例:**
```javascript
// プロセス置換パターン
const PROCESS_SUBSTITUTION_PATTERN = /<\(|>\(/;

// コマンド置換パターン
const COMMAND_SUBSTITUTION_PATTERN = /\$\(|`/;

function detectProcessSubstitution(command) {
  return PROCESS_SUBSTITUTION_PATTERN.test(command);
}

function detectCommandSubstitution(command) {
  return COMMAND_SUBSTITUTION_PATTERN.test(command);
}
```

**3. splitCompoundCommand()の改良: サブシェル・コマンド置換内の区切り文字を無視**

現在の実装はサブシェル`()`やコマンド置換`$()`内の区切り文字（`;`, `&&`, `||`）を誤認識する可能性がある。

**変更内容:**
- 括弧のネストレベルをカウントし、トップレベル（ネストレベル0）の区切り文字のみを認識
- サブシェル`()`、コマンド置換`$()`、プロセス置換`<()`、`>()` 内の区切り文字は無視

**実装例:**
```javascript
function splitCompoundCommand(command) {
  const parts = [];
  let current = '';
  let parenDepth = 0; // 括弧のネストレベル
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    const nextChar = command[i + 1];

    // クォート処理
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    // クォート内はそのまま追加
    if (inSingleQuote || inDoubleQuote) {
      current += char;
      continue;
    }

    // 括弧のネストレベル管理
    if (char === '(') {
      parenDepth++;
      current += char;
      continue;
    }
    if (char === ')') {
      parenDepth--;
      current += char;
      continue;
    }

    // トップレベル（parenDepth === 0）の区切り文字のみを認識
    if (parenDepth === 0) {
      if (char === ';' || (char === '&' && nextChar === '&') || (char === '|' && nextChar === '|')) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        if (char === '&' || char === '|') i++; // &&, || の場合は2文字スキップ
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}
```

**4. コマンド文字列の長さ上限とタイムアウトの設定**

DoS攻撃を防ぐため、コマンド文字列の長さ上限（10000文字）とsplitCompoundCommand()のタイムアウト（100ms）を設定する。

**実装例:**
```javascript
const MAX_COMMAND_LENGTH = 10000;
const SPLIT_TIMEOUT_MS = 100;

function checkCommandLength(command) {
  if (command.length > MAX_COMMAND_LENGTH) {
    console.error(`Command length exceeds maximum: ${command.length} > ${MAX_COMMAND_LENGTH}`);
    return false;
  }
  return true;
}

function splitCompoundCommandWithTimeout(command) {
  const startTime = Date.now();
  const result = splitCompoundCommand(command);
  const elapsed = Date.now() - startTime;

  if (elapsed > SPLIT_TIMEOUT_MS) {
    console.error(`splitCompoundCommand timeout: ${elapsed}ms > ${SPLIT_TIMEOUT_MS}ms`);
    return null; // タイムアウト時はnullを返し、呼び出し側でブロック
  }

  return result;
}
```

##### 後方互換性

- 既存の正当なコマンドがブロックされないよう、検出パターンを段階的にテスト
- 誤検知が発生した場合は、該当パターンをホワイトリストに追加する仕組みを導入（将来実装）

##### テスト仕様

**単体テスト（phase-edit-guard.test.js）**
- 変数展開+リダイレクトのコマンド（`VAR=foo && echo $VAR > file`）がブロックされることを検証
- プロセス置換のコマンド（`cat <(echo foo)`）がブロックされることを検証
- バッククォート置換のコマンド（\`echo foo\`）がブロックされることを検証
- サブシェル内のセミコロン（`(cd foo; ls) && pwd`）が外側の区切りとして誤認識されないことを検証
- コマンド長10001文字のコマンドがブロックされることを検証

**セキュリティテスト（security.test.js 新規作成）**
- 既知のバイパスベクター（変数展開、プロセス置換、コマンド置換、ブレース展開）が全てブロックされることを検証
- 正当なコマンドが誤検知でブロックされないことを検証

---

#### REQ-5: バリデーションタイムアウトの追加

##### 変更対象ファイル

- `mcp-server/src/validation/artifact-validator.ts` (validateArtifactQuality関数)
- `mcp-server/src/validation/semantic-checker.ts` (checkSemanticQuality関数)

##### 変更箇所と変更内容

**1. validateArtifactQuality()のタイムアウト設定**

現在の実装にはタイムアウトが設定されていないため、大規模ファイルで無限に実行される可能性がある。

**変更内容:**
- Promise.race()でバリデーション処理とタイムアウトPromiseを競合させる
- タイムアウト時間は10秒（環境変数VALIDATION_TIMEOUT_MSでオーバーライド可能、最小5秒、最大60秒）
- タイムアウト発生時はTimeoutErrorをthrowせず、警告ログを出力してバリデーション成功（fail-open）を返す
- 戻り値に`timedOut: true`フラグを含める

**実装例:**
```typescript
const DEFAULT_VALIDATION_TIMEOUT_MS = 10000;

export async function validateArtifactQuality(filePath: string): Promise<ValidationResult> {
  const timeoutMs = getValidationTimeout();

  const validationPromise = performValidation(filePath);
  const timeoutPromise = new Promise<ValidationResult>((resolve) => {
    setTimeout(() => {
      console.warn(`[artifact-validator] Validation timeout after ${timeoutMs}ms: ${filePath}`);
      resolve({
        valid: true,
        timedOut: true,
        message: 'Validation timed out (fail-open)',
      });
    }, timeoutMs);
  });

  return Promise.race([validationPromise, timeoutPromise]);
}

function getValidationTimeout(): number {
  const envTimeout = parseInt(process.env.VALIDATION_TIMEOUT_MS || '', 10);
  if (isNaN(envTimeout)) return DEFAULT_VALIDATION_TIMEOUT_MS;
  return Math.max(5000, Math.min(60000, envTimeout)); // 5秒〜60秒に制限
}

async function performValidation(filePath: string): Promise<ValidationResult> {
  const startTime = process.hrtime.bigint();
  // ... 既存のバリデーションロジック
  const endTime = process.hrtime.bigint();
  const elapsedMs = Number(endTime - startTime) / 1000000;

  return {
    valid: true,
    timedOut: false,
    elapsedMs,
  };
}
```

**2. checkSemanticQuality()のタイムアウト設定**

semantic-checker.tsのn-gram計算にも同様のタイムアウトを設定する。

**変更内容:**
- validateArtifactQuality()と同様のPromise.race()パターンを適用
- タイムアウト時間は同じく10秒

**3. タイムアウト発生頻度の監視**

タイムアウトが連続3回以上発生した場合、自動成功を停止してエラー（fail-closed）に切り替える。

**実装例:**
```typescript
const TIMEOUT_COUNTER_FILE = path.join(process.cwd(), '.claude', 'state', 'validation-timeout-count.json');

function incrementTimeoutCount(): number {
  let count = 0;
  try {
    if (fs.existsSync(TIMEOUT_COUNTER_FILE)) {
      const data = JSON.parse(fs.readFileSync(TIMEOUT_COUNTER_FILE, 'utf8'));
      count = data.count || 0;
    }
  } catch {
    count = 0;
  }

  count++;
  fs.writeFileSync(TIMEOUT_COUNTER_FILE, JSON.stringify({ count, timestamp: Date.now() }));
  return count;
}

function resetTimeoutCount(): void {
  try {
    fs.unlinkSync(TIMEOUT_COUNTER_FILE);
  } catch {
    // ファイルが存在しない場合は無視
  }
}

export async function validateArtifactQuality(filePath: string): Promise<ValidationResult> {
  const result = await validateWithTimeout(filePath);

  if (result.timedOut) {
    const count = incrementTimeoutCount();
    if (count >= 3) {
      console.error(`[artifact-validator] Timeout occurred 3 times consecutively, switching to fail-closed mode`);
      throw new Error('Validation timeout threshold exceeded');
    }
  } else {
    resetTimeoutCount();
  }

  return result;
}
```

##### 後方互換性

- タイムアウト発生時はバリデーション成功を返すため、既存動作に影響しない
- 環境変数VALIDATION_TIMEOUT_MSでタイムアウト時間を調整可能

##### テスト仕様

**単体テスト（artifact-validator.test.ts）**
- 処理時間が10秒を超えるモックバリデーションでタイムアウトが機能することを検証
- タイムアウト時の戻り値に`timedOut: true`が含まれることを検証
- 通常ケースでタイムアウトが発生しないことを検証

**統合テスト（validation-integration.test.ts）**
- タイムアウトが連続3回発生した場合、4回目でエラーがthrowされることを検証

---

#### REQ-6: HMAC鍵管理の改善

##### 変更対象ファイル

- `mcp-server/src/security/hmac.ts` (鍵生成・検証ロジック)
- `mcp-server/src/state/manager.ts` (鍵ローテーショントリガー)

##### 変更箇所と変更内容

**1. hmac.ts: 鍵生成時にcreatedAt/expiresAtを追加**

現在の鍵生成ロジックはkeyフィールドのみを含むが、有効期限管理のためにcreatedAt/expiresAtを追加する。

**変更内容:**
- generateNewKey()関数でcreatedAt（UNIX timestamp）とexpiresAt（createdAt + 30日）を設定
- expiresAtはミリ秒単位で計算（30日 = 30 * 24 * 60 * 60 * 1000）
- 鍵IDにcreatedAtのタイムスタンプを使用して一意性を保証

**実装例:**
```typescript
interface HMACKey {
  id: string;
  key: string;
  createdAt: number;
  expiresAt: number;
}

function generateNewKey(): HMACKey {
  const createdAt = Date.now();
  const expiresAt = createdAt + 30 * 24 * 60 * 60 * 1000; // 30日後
  const key = crypto.randomBytes(32).toString('hex');

  return {
    id: `key_${createdAt}`,
    key,
    createdAt,
    expiresAt,
  };
}
```

**2. hmac.ts: 鍵検証時の有効期限チェック**

鍵検証時にcurrent time < expiresAtを確認し、期限切れの鍵は検証失敗とする。
ただし、猶予期間（7日間）内の古い鍵での署名も受け入れる。

**実装例:**
```typescript
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7日間

function isKeyValid(key: HMACKey): boolean {
  const now = Date.now();
  return now < key.expiresAt;
}

function isKeyInGracePeriod(key: HMACKey): boolean {
  const now = Date.now();
  return now < key.expiresAt + GRACE_PERIOD_MS;
}

export function verifyWithAnyKey(data: string, expectedHmac: string): boolean {
  const keys = loadKeys();

  // 現在の鍵で検証
  if (keys.current && isKeyValid(keys.current)) {
    const hmac = crypto.createHmac('sha256', keys.current.key).update(data).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return true;
    }
  }

  // 猶予期間内の旧鍵で検証
  for (const oldKey of keys.old || []) {
    if (isKeyInGracePeriod(oldKey)) {
      const hmac = crypto.createHmac('sha256', oldKey.key).update(data).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
        console.warn(`[HMAC] Old key used (grace period): ${oldKey.id}`);
        return true;
      }
    }
  }

  return false;
}
```

**3. manager.ts: MCP server起動時の鍵有効期限チェック**

MCP server起動時に最新鍵の有効期限をチェックし、残り7日未満なら新鍵を自動生成する。

**実装例:**
```typescript
export class WorkflowStateManager {
  constructor(workflowDir: string = WORKFLOW_DIR) {
    this.workflowDir = workflowDir;
    this.indexPath = path.join(STATE_DIR, 'task-index.json');
    this.checkAndRotateKeys(); // 起動時に鍵チェック
  }

  private checkAndRotateKeys(): void {
    const keys = loadKeys();
    if (!keys.current) {
      // 鍵が存在しない場合は新規生成
      const newKey = generateNewKey();
      saveKeys({ current: newKey, old: [] });
      console.log('[HMAC] No key found, generated new key');
      return;
    }

    const now = Date.now();
    const daysUntilExpiry = (keys.current.expiresAt - now) / (24 * 60 * 60 * 1000);

    if (daysUntilExpiry < 7) {
      // 残り7日未満なら新鍵を生成
      const newKey = generateNewKey();
      const oldKeys = keys.old || [];
      oldKeys.unshift(keys.current); // 現在の鍵を古い鍵リストに追加

      // 猶予期間を過ぎた鍵を削除
      const validOldKeys = oldKeys.filter(k => isKeyInGracePeriod(k));

      saveKeys({ current: newKey, old: validOldKeys });
      console.log(`[HMAC] Key rotation: ${keys.current.id} -> ${newKey.id}`);

      // 監査ログに記録
      auditLogger.log({
        event: 'key_rotation',
        oldKeyId: keys.current.id,
        newKeyId: newKey.id,
        reason: 'automatic_rotation',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

**4. hmac.ts: 鍵ローテーション頻度制限**

鍵ローテーションが頻繁に実行されないよう、最短でも24時間に1回までとする。

**実装例:**
```typescript
const LAST_ROTATION_FILE = path.join(process.cwd(), '.claude', 'state', 'last-key-rotation.json');
const MIN_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24時間

function canRotate(): boolean {
  try {
    if (fs.existsSync(LAST_ROTATION_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAST_ROTATION_FILE, 'utf8'));
      const lastRotation = data.timestamp || 0;
      const now = Date.now();
      return (now - lastRotation) >= MIN_ROTATION_INTERVAL_MS;
    }
  } catch {
    return true;
  }
  return true;
}

function recordRotation(): void {
  fs.writeFileSync(LAST_ROTATION_FILE, JSON.stringify({ timestamp: Date.now() }));
}

function rotateKeys(): void {
  if (!canRotate()) {
    console.warn('[HMAC] Key rotation skipped: minimum interval not met (24 hours)');
    return;
  }

  // ... 鍵ローテーション処理
  recordRotation();
}
```

##### 後方互換性

- 既存の鍵（createdAt/expiresAtフィールドなし）は初回loadKeys()時に自動的にフィールドを追加
- 既存の鍵のexpiresAtはcurrent time + 30日として設定
- 猶予期間（7日間）により、旧鍵での検証も一定期間許可

##### テスト仕様

**単体テスト（hmac.test.ts）**
- generateNewKey()で生成された鍵にcreatedAt/expiresAtが含まれることを検証
- expiresAtがcreatedAt + 30日（ミリ秒単位）に設定されていることを検証
- 期限切れ鍵での検証が失敗すること（猶予期間外）を検証
- 猶予期間内の旧鍵での検証が成功することを検証

**統合テスト（key-rotation.test.ts 新規作成）**
- MCP server起動時に鍵の有効期限が7日未満の場合、新鍵が自動生成されることを検証
- 鍵ローテーション時にアクティブタスクの状態が新鍵で再署名されることを検証
- 24時間以内の再ローテーションがスキップされることを検証

---

#### REQ-7: userIntent更新ツールの追加

##### 変更対象ファイル

- `mcp-server/src/tools/update-intent.ts` (新規ファイル)
- `mcp-server/src/state/manager.ts` (intentHistory管理)
- `mcp-server/src/index.ts` (ツール登録)

##### 変更箇所と変更内容

**1. tools/update-intent.ts: workflow_update_intentツールの新設**

新規ツールを作成し、taskIdとnewIntentを受け取ってuserIntentを更新する。

実装例（update-intent.ts 新規作成）:
```typescript
import { tool } from '@modelcontextprotocol/sdk/types.js';
import { stateManager } from '../state/manager.js';
import { auditLogger } from '../audit/logger.js';

export const updateIntentTool = tool({
  name: 'workflow_update_intent',
  description: 'Update the user intent for a task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task ID to update intent for',
      },
      newIntent: {
        type: 'string',
        description: 'New user intent (max 10000 characters)',
        maxLength: 10000,
      },
    },
    required: ['taskId', 'newIntent'],
  },
}, async ({ taskId, newIntent }) => {
  const taskState = stateManager.getTaskById(taskId);
  if (!taskState) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // researchまたはidleフェーズでは更新不可
  if (taskState.phase === 'research' || taskState.phase === 'idle') {
    throw new Error(`Cannot update intent in ${taskState.phase} phase. Intent can only be updated in requirements phase or later.`);
  }

  // userIntent更新前にintentHistoryに保存
  const intentHistory = taskState.intentHistory || [];
  intentHistory.push({
    intent: taskState.userIntent || taskState.taskName,
    phase: taskState.phase,
    updatedAt: Date.now(),
  });

  // intentHistory配列の最大サイズを10エントリに制限
  if (intentHistory.length > 10) {
    intentHistory.shift(); // 最古のエントリを削除（FIFO）
  }

  taskState.userIntent = newIntent;
  taskState.intentHistory = intentHistory;
  stateManager.writeTaskState(taskState.workflowDir, taskState);

  // 監査ログに記録
  auditLogger.log({
    event: 'update_intent',
    taskId,
    oldIntent: intentHistory[intentHistory.length - 1]?.intent.substring(0, 100),
    newIntent: newIntent.substring(0, 100),
    phase: taskState.phase,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    taskId,
    phase: taskState.phase,
    newIntent,
  };
});
```

**2. state/manager.ts: intentHistory管理フィールドの追加**

TaskState型にintentHistoryフィールドを追加する。

実装例（types.ts）:
```typescript
export interface TaskState {
  phase: PhaseName;
  taskId: string;
  taskName: string;
  workflowDir: string;
  docsDir: string;
  startedAt: string;
  checklist: Checklist;
  history: PhaseHistory[];
  subPhases: SubPhases;
  taskSize: TaskSize;
  userIntent?: string;
  intentHistory?: IntentHistoryEntry[]; // 追加
  // ... 既存フィールド
}

export interface IntentHistoryEntry {
  intent: string;
  phase: string;
  updatedAt: number;
}
```

**3. index.ts: ツール登録**

workflow_update_intentツールをMCP serverに登録する。

実装例（index.ts）:
```typescript
import { updateIntentTool } from './tools/update-intent.js';

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      startTool,
      nextTool,
      statusTool,
      // ... 既存ツール
      updateIntentTool, // 追加
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'workflow_start':
      return await startTool.handler(args);
    case 'workflow_next':
      return await nextTool.handler(args);
    // ... 既存ツール
    case 'workflow_update_intent':
      return await updateIntentTool.handler(args); // 追加
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});
```

**4. userIntent更新の頻度制限**

同一タスクで1分間に1回までの更新頻度制限を実装する。

実装例（update-intent.ts に追加）:
```typescript
const lastUpdateTime = new Map<string, number>();

export const updateIntentTool = tool({
  // ... 既存定義
}, async ({ taskId, newIntent }) => {
  const lastUpdate = lastUpdateTime.get(taskId) || 0;
  const now = Date.now();
  const elapsed = now - lastUpdate;

  if (elapsed < 60000) { // 60秒以内の再更新は拒否
    throw new Error(`Intent update rate limit exceeded. Please wait ${Math.ceil((60000 - elapsed) / 1000)} seconds.`);
  }

  // ... 既存処理

  lastUpdateTime.set(taskId, now);
  return { success: true, taskId, phase: taskState.phase, newIntent };
});
```

##### 後方互換性

- intentHistoryフィールドはオプショナルであり、既存タスクへの影響なし
- userIntentが未設定の既存タスクではtaskNameをデフォルト値として使用

##### テスト仕様

**単体テスト（update-intent.test.ts 新規作成）**
- workflow_update_intentがrequirementsフェーズ以降で成功することを検証
- researchフェーズでの更新試行がエラーを返すことを検証
- newIntentが10000文字を超える場合にエラーを返すことを検証
- intentHistory配列に過去のuserIntentが記録されることを検証
- intentHistory配列が10エントリを超える場合、最古のエントリが削除されることを検証
- 1分以内の再更新が頻度制限エラーを返すことを検証

**統合テスト（workflow-integration.test.ts）**
- workflow_update_intent実行後、calculatePhaseSkips()で更新されたuserIntentが使用されることを検証

---

### Phase 3: P2修正（4件）

#### REQ-8: ASTキャッシュのLRU化

##### 変更対象ファイル

- `mcp-server/src/validation/design-validator.ts` (ASTキャッシュ実装)

##### 変更箇所と変更内容

**1. ASTキャッシュをLRUキャッシュ（最大100エントリ）に変更**

現在の実装はキャッシュサイズ制限がなく、メモリ使用量が増大する可能性がある。

**変更内容:**
- LRUキャッシュライブラリ（lru-cache）を導入、または簡易LRU実装を作成
- 最大エントリ数を100に設定
- キャッシュヒット時にエントリのアクセス時刻を更新し、LRU順序を維持
- 101個目のエントリ追加時に最古のエントリを自動削除

実装例（簡易LRU実装）:
```typescript
interface CacheEntry<T> {
  value: T;
  accessedAt: number;
}

class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // アクセス時刻を更新（LRU）
    entry.accessedAt = Date.now();
    return entry.value;
  }

  set(key: K, value: V): void {
    // 既存エントリの場合はアクセス時刻のみ更新
    if (this.cache.has(key)) {
      this.cache.get(key)!.value = value;
      this.cache.get(key)!.accessedAt = Date.now();
      return;
    }

    // キャッシュサイズチェック
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, { value, accessedAt: Date.now() });
  }

  private evictOldest(): void {
    let oldestKey: K | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey !== undefined) {
      console.debug(`[LRUCache] Evicting oldest entry: ${oldestKey}`);
      this.cache.delete(oldestKey);
    }
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const astCache = new LRUCache<string, MermaidAST>(100);
```

**2. タスク完了時のキャッシュ削除**

タスクがcompletedフェーズに移行した際、そのタスクに関連するキャッシュエントリを即座に削除する。

実装例（design-validator.ts に追加）:
```typescript
export function clearTaskCache(taskId: string): void {
  const keysToDelete: string[] = [];

  // タスクIDを含むキャッシュキーを検索
  for (const key of astCache.keys()) {
    if (key.includes(taskId)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    astCache.delete(key);
    console.debug(`[design-validator] Cleared cache for completed task: ${key}`);
  }
}
```

manager.ts のcompleteTask()から呼び出し:
```typescript
import { clearTaskCache } from '../validation/design-validator.js';

completeTask(taskId: string): void {
  const taskState = this.getTaskById(taskId);
  if (!taskState) {
    throw new Error(taskNotFoundError(taskId));
  }

  taskState.phase = 'completed';
  taskState.completedAt = getCurrentISOTimestamp();
  this.writeTaskState(taskState.workflowDir, taskState);

  // ASTキャッシュをクリア
  clearTaskCache(taskId);
}
```

**3. ASTエントリの最大サイズ上限（1MB）を設定**

大規模なMermaid図によるメモリ消費を防ぐため、ASTエントリの最大サイズを1MBに制限する。

**実装例:**
```typescript
const MAX_AST_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

function estimateASTSize(ast: MermaidAST): number {
  return JSON.stringify(ast).length;
}

export function cacheAST(filePath: string, ast: MermaidAST): void {
  const size = estimateASTSize(ast);
  if (size > MAX_AST_SIZE_BYTES) {
    console.warn(`[design-validator] AST too large to cache: ${filePath} (${size} bytes)`);
    return;
  }

  astCache.set(filePath, ast);
}
```

##### 後方互換性

- LRUキャッシュへの移行は内部実装のみであり、外部インターフェースに影響しない

##### テスト仕様

**単体テスト（design-validator.test.ts）**
- 101個のエントリを追加し、最古のエントリが削除されることを検証
- キャッシュヒット時にアクセス時刻が更新されることを検証
- タスク完了時のキャッシュ削除を確認するテストを追加

**性能テスト（performance.test.ts）**
- キャッシュヒット率が既存実装と同等以上であることを検証

---

#### REQ-9: 並列フェーズ依存関係の強化

##### 変更対象ファイル

- `hooks/phase-edit-guard.js` (handleParallelPhase関数)

##### 変更箇所と変更内容

**1. handleParallelPhase()内でSUB_PHASE_DEPENDENCIESを参照**

現在のフック側実装は並列フェーズのサブフェーズ依存関係を強制していない。

**変更内容:**
- SUB_PHASE_DEPENDENCIESをphase-definitions.jsから読み込む
- 依存元サブフェーズの完了状態をチェックし、未完了の場合は依存先サブフェーズのファイル編集をブロック
- エラーメッセージに依存関係を明示（例: "planning requires threat_modeling to be completed first"）

**実装例:**
```javascript
const { SUB_PHASE_DEPENDENCIES } = require('./lib/phase-definitions');

function handleParallelPhase(filePath, taskState) {
  const currentPhase = taskState.phase;
  const subPhases = PARALLEL_PHASES[currentPhase];
  if (!subPhases) return { allowed: true };

  // ファイルがどのサブフェーズに対応するかを判定
  const targetSubPhase = detectSubPhase(filePath);
  if (!targetSubPhase) return { allowed: true };

  // 依存関係チェック
  const dependencies = SUB_PHASE_DEPENDENCIES[targetSubPhase] || [];
  for (const dep of dependencies) {
    const depStatus = taskState.subPhases[dep];
    if (depStatus !== 'completed') {
      return {
        allowed: false,
        message: `${targetSubPhase} requires ${dep} to be completed first`,
        dependency: dep,
      };
    }
  }

  return { allowed: true };
}

function detectSubPhase(filePath) {
  const fileName = path.basename(filePath);
  if (fileName.includes('threat-model')) return 'threat_modeling';
  if (fileName.includes('planning') || fileName.includes('spec')) return 'planning';
  if (fileName.includes('state-machine')) return 'state_machine';
  if (fileName.includes('flowchart')) return 'flowchart';
  if (fileName.includes('ui-design')) return 'ui_design';
  if (fileName.includes('build')) return 'build_check';
  if (fileName.includes('code-review')) return 'code_review';
  if (fileName.includes('manual-test')) return 'manual_test';
  if (fileName.includes('security-scan')) return 'security_scan';
  if (fileName.includes('performance-test')) return 'performance_test';
  if (fileName.includes('e2e-test')) return 'e2e_test';
  return null;
}
```

**2. 循環依存検出アルゴリズム（トポロジカルソート）の実装**

SUB_PHASE_DEPENDENCIES定義時に循環依存が存在しないことを検証する。

実装例（phase-definitions.js に追加）:
```javascript
function detectCircularDependency(dependencies) {
  const visited = new Set();
  const stack = new Set();

  function visit(node) {
    if (stack.has(node)) {
      throw new Error(`Circular dependency detected: ${node}`);
    }
    if (visited.has(node)) return;

    stack.add(node);
    const deps = dependencies[node] || [];
    for (const dep of deps) {
      visit(dep);
    }
    stack.delete(node);
    visited.add(node);
  }

  for (const node in dependencies) {
    visit(node);
  }
}

// モジュール読み込み時に循環依存チェックを実行
detectCircularDependency(SUB_PHASE_DEPENDENCIES);
```

##### 後方互換性

- SUB_PHASE_DEPENDENCIESが定義されていない環境では依存関係チェックをスキップ

##### テスト仕様

**単体テスト（phase-edit-guard.test.js）**
- threat_modeling未完了時のplanning.md編集がブロックされることを検証
- threat_modeling完了後のplanning.md編集が許可されることを検証
- エラーメッセージに依存関係が明示されることを検証

**単体テスト（phase-definitions.test.js）**
- SUB_PHASE_DEPENDENCIESに循環依存が存在しないことを検証

---

#### REQ-10: スコープ検証の改善

##### 変更対象ファイル

- `hooks/phase-edit-guard.js` (checkScopeViolation関数)

##### 変更箇所と変更内容

**1. グローバル除外パターンからdocs/spec/を削除**

現在の実装はdocs/spec/を無条件で除外しているが、他タスクのスコープ外仕様書を編集可能になっている。

**変更内容:**
- グローバル除外パターンからdocs/spec/を削除
- docs/spec/内のファイルもスコープチェックの対象とする
- タスク固有のスコープ除外パターンをworkflow-state.jsonのscopeExcludePatternsフィールドに追加

**実装例:**
```javascript
const GLOBAL_EXCLUDE_PATTERNS = [
  /\.claude[\/\\]state[\/\\].*\.json$/i,
  /\.claude[\/\\]settings\.json$/i,
  /workflow-state\.json$/i,
  // docs/spec/ を除外リストから削除
];

function checkScopeViolation(filePath, taskState) {
  // グローバル除外パターンチェック
  const normalized = filePath.replace(/\\/g, '/');
  if (GLOBAL_EXCLUDE_PATTERNS.some(pattern => pattern.test(normalized))) {
    return { allowed: true };
  }

  // スコープチェック
  const scope = taskState.scope;
  if (!scope || (!scope.files && !scope.dirs && !scope.glob)) {
    return { allowed: true }; // スコープ未設定時は全て許可
  }

  // タスク固有の除外パターン
  const excludePatterns = taskState.scopeExcludePatterns || [];
  if (excludePatterns.some(pattern => new RegExp(pattern).test(normalized))) {
    return { allowed: true };
  }

  // ファイルスコープチェック
  if (scope.files && scope.files.includes(normalized)) {
    return { allowed: true };
  }

  // ディレクトリスコープチェック
  if (scope.dirs) {
    for (const dir of scope.dirs) {
      if (isPrefixMatchWithBoundary(normalized, normalizePath(dir))) {
        return { allowed: true };
      }
    }
  }

  // globスコープチェック
  if (scope.glob) {
    const minimatch = require('minimatch');
    if (minimatch(normalized, scope.glob)) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    message: `File is outside of task scope: ${filePath}`,
    scope: scope,
  };
}
```

**2. パス検証の強化: ../ を含むパスをブロック**

ディレクトリトラバーサル攻撃を防ぐため、パスに".."が含まれる場合はブロックする。

**実装例:**
```javascript
function checkScopeViolation(filePath, taskState) {
  const normalized = filePath.replace(/\\/g, '/');

  // ディレクトリトラバーサル攻撃チェック
  if (normalized.includes('..')) {
    return {
      allowed: false,
      message: 'Path traversal detected: .. is not allowed in file paths',
    };
  }

  // ... 既存のスコープチェック
}
```

**3. スコープのfiles配列要素数上限（1000個）を設定**

DoS攻撃を防ぐため、スコープのfiles配列の要素数を1000個に制限する。

実装例（workflow_set_scopeツール側で実装）:
```typescript
export const setScopeTool = tool({
  name: 'workflow_set_scope',
  // ... 既存定義
}, async ({ taskId, files, dirs, glob }) => {
  if (files && files.length > 1000) {
    throw new Error('Scope files array exceeds maximum size (1000 entries). Please use glob pattern instead.');
  }

  // ... 既存処理
});
```

##### 後方互換性

- docs/spec/がスコープチェック対象になるが、既存タスクのスコープにdocs/spec/が含まれている場合は影響なし
- スコープ未設定のタスクは全て許可される既存動作を維持

##### テスト仕様

**単体テスト（phase-edit-guard.test.js）**
- スコープ外のdocs/spec/ファイル編集がブロックされることを検証
- スコープ内のdocs/spec/ファイル編集が許可されることを検証
- パスに".."が含まれる場合にブロックされることを検証

**統合テスト（scope-validation.test.ts 新規作成）**
- タスク固有除外パターンの動作テストを追加

---

#### REQ-11: TOCTOU競合状態の修正

##### 変更対象ファイル

- `mcp-server/src/state/manager.ts` (isSessionTokenValid関数 行59-70)

##### 変更箇所と変更内容

**1. isSessionTokenValid()を単一関数内で完結**

現在の実装はformat checkとexpiry checkが別々のステップで実行されており、理論上TOCTOU脆弱性が存在する。

**変更内容:**
- format checkとexpiry checkを連続して実行し、中間状態を外部に公開しない
- 検証ロジック全体をtry-catchでラップし、例外発生時は即座にfalseを返す
- 現在時刻を一度だけ取得し、その値を全体で使用することで時刻の不整合を防ぐ

**実装例:**
```typescript
export function isSessionTokenValid(token: string, storedToken: string): boolean {
  try {
    // トークンのローカル変数へのコピー（TOCTOU対策）
    const localToken = String(token);
    const localStoredToken = String(storedToken);

    // フォーマットチェック
    if (!localToken || localToken.length !== 64) return false;

    // 定数時間比較
    const tokenBuf = Buffer.from(localToken, 'utf-8');
    const storedBuf = Buffer.from(localStoredToken, 'utf-8');
    if (tokenBuf.length !== storedBuf.length) return false;
    if (!crypto.timingSafeEqual(tokenBuf, storedBuf)) return false;

    // 有効期限チェック（現在時刻を一度だけ取得）
    const now = Math.floor(Date.now() / 1000);
    const timestampHex = localToken.substring(56, 64);
    const tokenTime = parseInt(timestampHex, 16);

    // 全チェックを連続して実行（アトミック）
    return (now - tokenTime) <= 3600;
  } catch (error) {
    // 例外発生時は即座にfalseを返す
    console.error('[isSessionTokenValid] Validation error:', error);
    return false;
  }
}
```

##### 後方互換性

- 関数のシグネチャと戻り値は変更しないため、呼び出し側への影響なし

##### テスト仕様

**単体テスト（manager.test.ts）**
- isSessionTokenValid()の正常系・異常系を検証
- 例外発生時のfalse返却を確認するテストを追加
- タイミング攻撃対策（crypto.timingSafeEqual）が維持されることを検証

---

### Phase 4: CLAUDE.md修正（2件）

#### REQ-12: CLAUDE.md修正 - subagentコンテキスト断絶の緩和

##### 変更対象ファイル

- `CLAUDE.md` (サマリーセクション必須化のセクション、subagent起動テンプレート、フェーズ別subagent設定テーブル)

##### 変更箇所と変更内容

**1. サマリーセクションの推奨行数を50→200行に変更**

現在の記述「50行以内で、このドキュメントの要点を記述」を変更する。

**変更内容:**
- 推奨行数を「50行以内」から「50-200行（推奨50行、複雑な設計の場合は最大200行）」に変更
- サマリーの役割を「次フェーズへの引き継ぎ情報」として明確化

変更箇所（CLAUDE.md 行数は変動するため、セクション名で特定）:
```
[CLAUDE.md変更例]
★重要★ サマリーセクション必須化（REQ-B4）
成果物の先頭には必ず以下のセクションを配置してください:

サマリー（50-200行で、次フェーズに必要な情報を構造化して記述）
  - 目的: このドキュメントの目的
  - 主要な決定事項: 重要な設計決定や技術選定
  - 次フェーズで必要な情報: 後続フェーズで必須となる情報

推奨行数は50行ですが、複雑な設計の場合は最大200行まで記述可能です。
次フェーズのsubagentがサマリーのみを読み込むことで効率的にコンテキストを引き継ぐことができます。
ただし、設計の詳細が重要な場合は、次フェーズで全文を読み込むことを推奨してください。
```

**2. subagent起動テンプレートに全文読み込み推奨文を追加**

subagent起動テンプレートに「複雑な設計の場合は全文を読み込んでください」という推奨文を追加する。

**変更箇所:**
```markdown
## 入力
以下のファイルを読み込んでください:
- ★ {重要度Highファイルパス} （全文読み込み）
- ☆ {重要度Mediumファイルパス} （サマリーセクションのみ読み込み）
- {重要度Lowファイルパス} （参照不要）

**重要**: 重要度Highファイルは全文を読み込んでください。重要度Mediumファイルは「## サマリー」セクションのみを読み込んでください。
**複雑な設計の場合**: サマリーだけでは情報が不足する場合、重要度Mediumファイルも全文を読み込んでください。
```

**3. フェーズ別subagent設定テーブルに入力ファイル重要度カラムを追加**

各フェーズで全文読み込みが必要かサマリーで十分かを明記する。

**変更箇所:**
```markdown
| フェーズ | subagent_type | model | 入力ファイル | 入力ファイル重要度 | 出力ファイル |
|---------|---------------|-------|-------------|-------------------|-------------|
| research | Explore | haiku | - | - | research.md |
| requirements | general-purpose | sonnet | research.md | 全文 | requirements.md |
| threat_modeling | general-purpose | sonnet | requirements.md | 全文 | threat-model.md |
| planning | Plan | sonnet | requirements.md | 全文 | spec.md |
| state_machine | general-purpose | haiku | spec.md | 全文 | state-machine.mmd |
| flowchart | general-purpose | haiku | spec.md | 全文 | flowchart.mmd |
| ui_design | general-purpose | sonnet | spec.md | 全文 | ui-design.md |
| test_design | Plan | sonnet | spec.md (全文), *.mmd (全文) | 全文 | test-design.md |
| test_impl | general-purpose | sonnet | test-design.md | 全文 | *.test.ts |
| implementation | general-purpose | sonnet | test-design.md (全文), spec.md (全文), requirements.md (サマリー) | 全文/サマリー | *.ts |
| refactoring | general-purpose | haiku | implementation成果物 (全文), spec.md (サマリー), test-design.md (参照) | 全文/サマリー/参照 | *.ts |
| build_check | Bash | haiku | - | - | - |
| code_review | general-purpose | sonnet | implementation成果物 (全文), spec.md (全文), test-design.md (サマリー), requirements.md (参照) | 全文/サマリー/参照 | code-review.md |
| testing | Bash | haiku | test-design.md (全文), implementation成果物 (全文), spec.md (サマリー), requirements.md (参照) | 全文/サマリー/参照 | - |
| manual_test | general-purpose | haiku | - | - | manual-test.md |
| security_scan | Bash | haiku | - | - | security-scan.md |
| performance_test | Bash | haiku | - | - | performance-test.md |
| e2e_test | Bash | haiku | - | - | e2e-test.md |
| docs_update | general-purpose | haiku | 全成果物 | サマリー | ドキュメント |
| commit | Bash | haiku | - | - | - |
| push | Bash | haiku | - | - | - |
```

**4. artifact-validator.tsのサマリー行数検証ロジックを新ルール（200行以内）に更新**

実装側でも200行以内を許容するようバリデーションロジックを変更する。

変更箇所（artifact-validator.ts）:
```typescript
const MAX_SUMMARY_LINES = 200; // 50 → 200 に変更

function validateSummarySection(content: string): ValidationResult {
  const summaryMatch = content.match(/^##\s+サマリー\s*$([\s\S]*?)(?=^##\s+|\Z)/m);
  if (!summaryMatch) {
    return { valid: false, message: 'サマリーセクションが見つかりません' };
  }

  const summaryContent = summaryMatch[1].trim();
  const lines = summaryContent.split('\n').filter(line => line.trim() !== '');

  if (lines.length > MAX_SUMMARY_LINES) {
    return {
      valid: false,
      message: `サマリーが長すぎます（${lines.length}行 > ${MAX_SUMMARY_LINES}行）`,
    };
  }

  return { valid: true };
}
```

##### 後方互換性

- 既存の50行以内のサマリーも引き続き有効（推奨範囲内）
- 200行以内であれば新ルールに適合

##### テスト仕様

**手動テスト**
- CLAUDE.md修正後に新タスクを開始し、subagentがサマリーだけでなく全文も読み込むことを確認

**単体テスト（artifact-validator.test.ts）**
- サマリー行数が200行以内の成果物がバリデーション成功することを検証
- サマリー行数が201行の成果物がバリデーション失敗することを検証

---

#### REQ-13: CLAUDE.md修正 - 小規模タスク19フェーズオーバーヘッド解消

##### 変更対象ファイル

- `CLAUDE.md` (フェーズ順序セクション、タスクサイズ選択ガイダンスセクション)
- `mcp-server/src/tools/start.ts` (taskSize判定ロジック)

##### 変更箇所と変更内容

**1. CLAUDE.mdのフェーズ順序セクションを修正**

「全てのタスクは以下の19フェーズで実行されます」という記述を削除し、タスクサイズに応じたフェーズ選択が可能であることを明記する。

**変更箇所:**
```markdown
### フェーズ構成（19フェーズ）

タスクサイズに応じて、8フェーズ（small）、14フェーズ（medium）、19フェーズ（large）のいずれかで実行されます。

**Large（19フェーズ）:**
```
research → requirements → parallel_analysis（threat_modeling + planning）
→ parallel_design（state_machine + flowchart + ui_design）
→ design_review【AIレビュー + ユーザー承認】
→ test_design → test_impl → implementation → refactoring
→ parallel_quality（build_check + code_review）→ testing
→ regression_test【リグレッションテスト】
→ parallel_verification（manual_test + security_scan + performance_test + e2e_test）
→ docs_update → commit → push → ci_verification → deploy → completed
```

**Medium（14フェーズ）:**
```
research → requirements → planning → test_design → test_impl
→ implementation → refactoring → testing → regression_test
→ code_review → docs_update → commit → push → completed
```

**Small（8フェーズ）:**
```
research → requirements → test_impl → implementation
→ testing → docs_update → commit → completed
```
```

**2. タスクサイズ選択ガイダンステーブルを修正**

適用場面を具体的に記述し、セキュリティ関連タスクは必ずlargeを使用することを明記する。

**変更箇所:**
```markdown
### タスクサイズ選択ガイダンス

タスクの規模に応じて適切なサイズを選択してください:

| サイズ | フェーズ数 | 適用場面 |
|-------|----------|---------|
| small | 8 | 単一ファイルの小修正、typo修正、設定変更、ドキュメント修正 |
| medium | 14 | 複数ファイルの修正、機能追加、バグ修正、リファクタリング |
| large | 19 | 大規模な機能追加、アーキテクチャ変更、**セキュリティ修正（必須）**、認証・認可・暗号化関連タスク |

**重要**: 以下のタスクは必ずlargeを使用してください:
- セキュリティ関連タスク（認証、認可、暗号化、脆弱性修正）
- アーキテクチャ変更（複数モジュールに影響）
- API設計変更（破壊的変更）

デフォルトは large です。`/workflow start <タスク名>` 実行時に MCP サーバーが自動判定します。
```

**3. start.ts: taskSize判定ロジックの実装**

現在のstart.tsではtaskSizeに応じたフェーズ選択ロジックが無効化されている。

**変更内容:**
- taskSizeパラメータに基づいてPHASES_SMALL、PHASES_MEDIUM、PHASES_LARGEを選択
- taskSizeが未指定の場合はデフォルトlargeを使用
- セキュリティキーワード（"auth", "security", "encryption", "vulnerability"）がタスク名に含まれる場合、強制的にlargeを選択して警告を表示

実装例（start.ts）:
```typescript
import { PHASES_SMALL, PHASES_MEDIUM, PHASES_LARGE } from '../phases/definitions.js';

export const startTool = tool({
  name: 'workflow_start',
  // ... 既存定義
  inputSchema: {
    type: 'object',
    properties: {
      taskName: { type: 'string', description: 'Task name' },
      taskSize: {
        type: 'string',
        enum: ['small', 'medium', 'large'],
        description: 'Task size (default: large)',
      },
      userIntent: { type: 'string', description: 'User intent (max 10000 characters)' },
    },
    required: ['taskName'],
  },
}, async ({ taskName, taskSize, userIntent }) => {
  // セキュリティキーワード検出
  const securityKeywords = ['auth', 'security', 'encryption', 'vulnerability', '認証', '認可', '暗号'];
  const isSecurityTask = securityKeywords.some(keyword => taskName.toLowerCase().includes(keyword));

  if (isSecurityTask && taskSize !== 'large') {
    console.warn(`[workflow_start] Security-related task detected: forcing taskSize=large`);
    console.warn(`  Task name: ${taskName}`);
    console.warn(`  Keywords: ${securityKeywords.filter(k => taskName.toLowerCase().includes(k)).join(', ')}`);
    taskSize = 'large';
  }

  // フェーズリスト選択
  let phaseList: PhaseName[];
  const effectiveSize = taskSize || 'large';

  switch (effectiveSize) {
    case 'small':
      phaseList = PHASES_SMALL;
      break;
    case 'medium':
      phaseList = PHASES_MEDIUM;
      break;
    case 'large':
    default:
      phaseList = PHASES_LARGE;
      break;
  }

  // タスク作成
  const taskState = stateManager.createTask(taskName, effectiveSize);
  taskState.userIntent = userIntent || taskName;

  // ログ記録
  auditLogger.log({
    event: 'workflow_start',
    taskId: taskState.taskId,
    taskName,
    taskSize: effectiveSize,
    phaseList: phaseList,
    timestamp: new Date().toISOString(),
  });

  return {
    taskId: taskState.taskId,
    taskName,
    phase: taskState.phase,
    taskSize: effectiveSize,
    phaseCount: phaseList.length,
    docsDir: taskState.docsDir,
  };
});
```

**4. phases/definitions.ts: PHASES_SMALL, PHASES_MEDIUMの定義確認**

PHASES_SMALL（8フェーズ）とPHASES_MEDIUM（14フェーズ）が正しく定義されていることを確認する。

確認箇所（definitions.ts）:
```typescript
export const PHASES_SMALL: PhaseName[] = [
  'research',
  'requirements',
  'test_impl',
  'implementation',
  'testing',
  'docs_update',
  'commit',
  'completed',
];

export const PHASES_MEDIUM: PhaseName[] = [
  'research',
  'requirements',
  'planning',
  'test_design',
  'test_impl',
  'implementation',
  'refactoring',
  'testing',
  'regression_test',
  'code_review',
  'docs_update',
  'commit',
  'push',
  'completed',
];

export const PHASES_LARGE: PhaseName[] = [
  'research',
  'requirements',
  'parallel_analysis',
  'parallel_design',
  'design_review',
  'test_design',
  'test_impl',
  'implementation',
  'refactoring',
  'parallel_quality',
  'testing',
  'regression_test',
  'parallel_verification',
  'docs_update',
  'commit',
  'push',
  'ci_verification',
  'deploy',
  'completed',
];
```

##### 後方互換性

- taskSize未指定時はデフォルトlargeを使用するため、既存動作と互換性を維持
- 既存の772テストはデフォルトlargeで実行されるため、影響なし

##### テスト仕様

**単体テスト（start.test.ts）**
- workflow_start({taskName: "test", taskSize: "small"})で8フェーズのタスクが作成されることを検証
- workflow_start({taskName: "test", taskSize: "medium"})で14フェーズのタスクが作成されることを検証
- workflow_start({taskName: "test"})でデフォルト19フェーズが選択されることを検証
- セキュリティキーワードを含むタスク名（"auth system"）でtaskSize=smallが強制的にlargeに変更されることを検証

**統合テスト（workflow-integration.test.ts）**
- smallタスクで8フェーズ全てが正しく実行されることを検証
- mediumタスクで14フェーズ全てが正しく実行されることを検証

---

## テスト仕様

### 全体テスト戦略

全13件のREQに対して、以下のテスト種別を実施する。

**単体テスト（Unit Tests）**
- 各関数・メソッドの正常系・異常系を検証
- モックを使用して依存関係を分離
- コードカバレッジ80%以上を維持

**統合テスト（Integration Tests）**
- 複数コンポーネント間の連携を検証
- 実際のファイルI/Oを使用
- ワークフロー全体のフローを検証

**性能テスト（Performance Tests）**
- フック実行時間が100ms以内であることを検証
- タスク数100個環境での性能劣化がないことを検証

**セキュリティテスト（Security Tests）**
- 既知のバイパスベクターが全てブロックされることを検証
- セキュリティ違反エラーが確実にexit(2)を返すことを検証

**回帰テスト（Regression Tests）**
- 既存772テストスイートの全件パスを確認（変更によるリグレッションがないこと）
- 新規追加テストも全件成功することを検証

### テストカバレッジ目標

| ファイル | 目標カバレッジ | 重点テスト項目 |
|---------|---------------|---------------|
| manager.ts | 85% | saveTaskIndex, loadTaskIndex, updateTaskPhase |
| discover-tasks.js | 90% | discoverTasks, readTaskIndexCache |
| enforce-workflow.js | 90% | uncaughtExceptionハンドラ, HMAC検証ループ |
| phase-edit-guard.js | 85% | splitCompoundCommand, 高リスクパターン検出 |
| artifact-validator.ts | 80% | validateArtifactQuality, タイムアウト処理 |
| hmac.ts | 95% | 鍵生成, 鍵検証, 鍵ローテーション |
| update-intent.ts | 90% | workflow_update_intent, 頻度制限 |
| design-validator.ts | 80% | LRUキャッシュ, eviction |
| start.ts | 85% | taskSize判定, セキュリティキーワード検出 |

### テスト実行順序

1. 単体テスト（各REQ個別）
2. 統合テスト（REQ間の連携）
3. 性能テスト（REQ-2のO(1)化検証）
4. セキュリティテスト（REQ-3, REQ-4のセキュリティ検証）
5. 回帰テスト（既存772テスト全件）

### CI/CD統合

全テストはCI/CDパイプラインで自動実行され、以下の条件を満たす必要がある。

**必須条件**
- 既存772テスト全件成功
- 新規追加テスト全件成功
- コードカバレッジ80%以上
- フック実行時間100ms以内（性能テスト）
- セキュリティテスト全件成功

**警告条件**
- コードカバレッジ75-80%: 警告を表示するが、ビルドは成功
- フック実行時間100-150ms: 警告を表示するが、ビルドは成功

**失敗条件**
- いずれかのテストが失敗
- コードカバレッジ75%未満
- フック実行時間150ms超過
- セキュリティテストが失敗

---

## 受入基準

全13件のREQ修正完了後、以下の受入基準を全て満たす必要がある。

### 機能受入基準

- [ ] REQ-1: task-index.jsonがHookスキーマ`{tasks: [...], updatedAt}`形式で書き込まれる
- [ ] REQ-1: workflow_start実行後にtask-index.jsonのtasks配列に新エントリが追加される
- [ ] REQ-1: workflow_next実行後にtasks配列のphaseフィールドが更新される
- [ ] REQ-2: タスク数100個環境でフック実行時間が100ms以内である
- [ ] REQ-2: アクティブタスクのみがHMAC検証される
- [ ] REQ-3: セキュリティ違反エラーがWORKFLOW_FAIL_MODEに関わらずexit(2)を返す
- [ ] REQ-3: 一時的エラーがWORKFLOW_FAIL_MODE=permissiveでexit(0)を返す
- [ ] REQ-4: 変数展開+リダイレクトのコマンドがブロックされる
- [ ] REQ-4: プロセス置換のコマンドがブロックされる
- [ ] REQ-5: バリデーション処理が10秒以内に完了する（それを超えるとタイムアウト）
- [ ] REQ-5: タイムアウト時の戻り値に`timedOut: true`フラグが含まれる
- [ ] REQ-6: 新規生成された鍵にcreatedAtとexpiresAtフィールドが含まれる
- [ ] REQ-6: MCP server起動時に鍵の有効期限が7日未満の場合、新鍵が自動生成される
- [ ] REQ-7: workflow_update_intentツールがrequirementsフェーズ以降で呼び出し可能である
- [ ] REQ-7: intentHistory配列に過去のuserIntentが記録される
- [ ] REQ-8: ASTキャッシュエントリ数が100を超えない
- [ ] REQ-8: タスク完了時にキャッシュエントリが削除される
- [ ] REQ-9: threat_modeling未完了時にplanning.mdの編集がブロックされる
- [ ] REQ-10: スコープ外のdocs/spec/ファイル編集がブロックされる
- [ ] REQ-11: isSessionTokenValid()でformat checkとexpiry checkが連続して実行される
- [ ] REQ-12: サマリーセクション行数が200行以内の成果物がバリデーション成功する
- [ ] REQ-13: workflow_start({taskSize: "small"})で8フェーズのタスクが作成される

### テスト受入基準

- [ ] 既存の772テスト全件が成功する
- [ ] 新規追加テスト全件が成功する
- [ ] コードカバレッジが修正前と同等以上（80%以上）である
- [ ] CI環境でも全テストが再現可能に成功する

### ドキュメント受入基準

- [ ] CHANGELOG.mdに全修正のエントリが追加されている
- [ ] CLAUDE.mdの修正箇所にコメントで修正理由と日付が記録されている
- [ ] workflow_update_intentツールのAPIドキュメントがREADME.mdに追加されている
- [ ] docs/architecture/hooks.mdに修正後のフック動作が反映されている

### 非機能受入基準

- [ ] MCP serverのメモリ使用量が100タスク環境でも500MB以下である
- [ ] フック実行時間がタスク数100個の環境でも100ms以内である
- [ ] バリデーション処理が10秒以内に完了する（それを超えるとタイムアウト）
- [ ] セキュリティ違反エラーが必ずexit(2)でブロックされる
- [ ] エラーメッセージが具体的であり、ユーザーが問題を理解できる

---

## 実装順序とマイルストーン

### マイルストーン1: P0修正完了（3件）

**期間**: 実装開始〜実装開始+3日

**成果物**:
- REQ-1: task-index.jsonデュアルスキーマ競合の解消（完了）
- REQ-2: O(n)フック性能問題の改善（完了）
- REQ-3: Fail-Closed過剰ブロックの緩和（完了）

**受入基準**:
- task-index.jsonがHookスキーマで書き込まれる
- フック実行時間がタスク数100個環境でも100ms以内
- セキュリティ違反エラーが必ずexit(2)を返す
- 一時的エラーがpermissiveモードでexit(0)を返す

### マイルストーン2: P1修正完了（4件）

**期間**: マイルストーン1完了〜マイルストーン1+4日

**成果物**:
- REQ-4: bash-whitelistバイパスベクターの対策（完了）
- REQ-5: バリデーションタイムアウトの追加（完了）
- REQ-6: HMAC鍵管理の改善（完了）
- REQ-7: userIntent更新ツールの追加（完了）

**受入基準**:
- 変数展開+リダイレクトのコマンドがブロックされる
- バリデーション処理が10秒以内に完了する
- HMAC鍵にcreatedAt/expiresAtが含まれる
- workflow_update_intentツールが呼び出し可能

### マイルストーン3: P2修正完了（4件）

**期間**: マイルストーン2完了〜マイルストーン2+3日

**成果物**:
- REQ-8: ASTキャッシュのLRU化（完了）
- REQ-9: 並列フェーズ依存関係の強化（完了）
- REQ-10: スコープ検証の改善（完了）
- REQ-11: TOCTOU競合状態の修正（完了）

**受入基準**:
- ASTキャッシュエントリ数が100を超えない
- threat_modeling未完了時にplanning.md編集がブロックされる
- スコープ外のdocs/spec/ファイル編集がブロックされる
- isSessionTokenValid()がアトミックに実行される

### マイルストーン4: CLAUDE.md修正完了（2件）

**期間**: マイルストーン3完了〜マイルストーン3+1日

**成果物**:
- REQ-12: CLAUDE.md修正 - subagentコンテキスト断絶の緩和（完了）
- REQ-13: CLAUDE.md修正 - 小規模タスク19フェーズオーバーヘッド解消（完了）

**受入基準**:
- サマリーセクション行数が200行以内の成果物がバリデーション成功する
- workflow_start({taskSize: "small"})で8フェーズのタスクが作成される
- セキュリティキーワードを含むタスクが強制的にlargeに変更される

### マイルストーン5: 全体テスト・統合完了

**期間**: マイルストーン4完了〜マイルストーン4+2日

**成果物**:
- 全単体テスト完了
- 全統合テスト完了
- 全性能テスト完了
- 全セキュリティテスト完了
- 全回帰テスト完了（既存772テスト全件成功）

**受入基準**:
- 上記「受入基準」セクションの全項目を満たす
- CHANGELOG.md、README.md、docs/architecture/hooks.mdの更新完了
