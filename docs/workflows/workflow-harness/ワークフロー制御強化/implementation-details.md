# ワークフロー制御強化 - 実装詳細

## 概要

ワークフロープラグインの制御フロー強化により、以下の2つの主要な検証メカニズムが実装されました:

1. **危険コマンドのブロック** (block-dangerous-commands.js)
2. **フェーズ別編集制限** (phase-edit-guard.js)

## 1. Bashコマンド検証フロー

### ファイル: block-dangerous-commands.js

**目的**: Claude Code自体や重要なプロセスを終了させるコマンドを禁止

#### 禁止パターン (dangerousPatterns)

```javascript
const dangerousPatterns = [
  // PowerShell系
  /\bstop-process\b/i,
  /\bremove-item\b.*-force.*-recurse/i,

  // Windows taskkill系
  /\btaskkill\s+\/f\b/i,
  /\btaskkill\b.*\/pid\b/i,

  // Unix/Linux プロセス終了系
  /\bkill\s+-9\s+-1\b/,
  /\bkillall\s+-9\b/,
  /\bpkill\s+-9\b/,
  /\bpkill\b.*\bnode\b/i,

  // システム終了系
  /\bshutdown\b/i,
  /\breboot\b/i,

  // ファイル破壊系
  /\brm\s+-rf\s+\/(?!\w)/,
  /\bformat\s+c:/i,

  // フォークボム
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,

  // バイパス対策
  /\bbash\s+-c\s+['"].*\bkill\b/i,
  /\bpowershell\b.*-command.*\bstop-process\b/i,
];
```

#### 処理フロー

```
1. stdin からコマンド入力を JSON で受け取る
2. タイムアウト設定 (3秒)
3. dangerousPatterns で順番にマッチング
4. マッチした場合:
   - エラーメッセージを JSON で出力
   - ログファイルに記録
   - exit code 1 で終了
5. マッチしない場合:
   - exit code 0 で正常終了
```

#### エラーログ

```
.claude-hook-errors.log

形式:
[timestamp] [block-dangerous] TYPE: message details

例:
[2026-02-07T12:00:00.000Z] [block-dangerous] BLOCKED: /\bkill\s+-9\s+-1\b/ kill -9 -1
```

## 2. フェーズ別編集制限フロー

### ファイル: phase-edit-guard.js

**目的**: ワークフロー各フェーズに基づいて、編集可能なファイルタイプを制御

### 重要な構造体

#### フェーズルール (PHASE_RULES)

```javascript
const PHASE_RULES = {
  idle: {
    allowed: ['config', 'env'],
    blocked: ['code', 'test', 'spec', 'diagram'],
    description: 'idle フェーズではコード編集は許可されません',
    japaneseName: 'アイドル',
  },

  research: {
    allowed: ['spec'],
    blocked: ['code', 'test', 'diagram', 'config', 'env'],
    description: 'research フェーズでは調査結果（.md）のみ作成可能',
    japaneseName: '調査',
  },

  test_impl: {
    allowed: ['spec', 'test', 'config', 'env'],
    blocked: ['code', 'diagram'],
    description: 'test_impl フェーズ（TDD Red）テストコードのみ',
    japaneseName: 'テスト実装（Red）',
    tddPhase: 'Red',
  },

  implementation: {
    allowed: ['code', 'spec', 'config', 'env'],
    blocked: ['test', 'diagram'],
    description: '実装フェーズ（TDD Green）ソースコード編集可能',
    japaneseName: '実装（Green）',
    tddPhase: 'Green',
  },

  // ... その他フェーズ
};
```

#### 並列フェーズ定義 (PARALLEL_PHASES)

```javascript
const PARALLEL_PHASES = {
  parallel_design: ['state_machine', 'flowchart', 'ui_design'],
  parallel_analysis: ['threat_modeling', 'planning'],
  parallel_quality: ['build_check', 'code_review'],
  parallel_verification: ['manual_test', 'security_scan'],
};
```

### ファイルタイプ判定プロセス

#### 1. テストファイル判定

```javascript
function isTestFile(normalizedPath) {
  return (
    TEST_FILE_PATTERNS.some((pattern) => normalizedPath.includes(pattern)) ||
    normalizedPath.startsWith('tests/')
  );
}

// パターン:
// - .test. または .spec.
// - __tests__ ディレクトリ内
// - tests/ ディレクトリ内
```

#### 2. ファイルタイプ判定フロー（優先度順）

```javascript
function getFileType(filePath) {
  const normalized = normalizePath(filePath);

  // 1. テストファイル判定（最優先）
  if (isTestFile(normalized)) return 'test';

  // 2. 図式ファイル
  if (normalized.endsWith('.mmd')) return 'diagram';

  // 3. 仕様書（Markdown）
  if (normalized.endsWith('.md')) return 'spec';

  // 4. ソースコード（設定ファイルは除外）
  if (isSourceCodeFile(normalized)) {
    return isConfigFile(filePath) ? 'config' : 'code';
  }

  // 5. 設定ファイル
  if (isConfigFile(filePath)) return 'config';

  // 6. 環境変数ファイル
  if (isEnvFile(normalized)) return 'env';

  // 7. その他
  return 'other';
}
```

### ワークフロー状態管理

#### タスク発見 (discoverTasks)

```javascript
function discoverTasks() {
  // WORKFLOW_DIR: .claude/state/workflows/

  // 各タスクディレクトリをスキャン
  // workflow-state.json を読み込み
  // phase !== 'completed' のみ対象

  // 戻り値:
  // [{
  //   taskId: "123",
  //   taskName: "ユーザー認証機能",
  //   workflowDir: ".claude/state/workflows/123_ユーザー認証機能/",
  //   phase: "implementation",
  //   docsDir: "docs/workflows/ユーザー認証機能/"
  // }]
}
```

#### ファイルパスからタスク推論 (findTaskByFilePath)

```javascript
function findTaskByFilePath(filePath) {
  // タスクのdocsDirまたはworkflowDirのプレフィックスマッチで判定
  // 複数マッチする場合は最長一致のタスクを返す

  // 例:
  // filePath: "docs/workflows/ユーザー認証機能/state-machine.mmd"
  // → taskName: "ユーザー認証機能"
}
```

### Bashコマンド分析

#### ファイル修正コマンド検出 (FILE_MODIFYING_COMMANDS)

```javascript
const FILE_MODIFYING_COMMANDS = [
  /\bsed\s+(-i|--in-place)/i,      // sed -i (in-place edit)
  /\becho\s+.*>/i,                  // echo redirection
  /\bcat\s+.*>/i,                   // cat redirection
  /\btee\s+/i,                      // tee command
  /\btouch\s+/i,                    // touch (create file)
  /<<\s*['\"]?([A-Z_]+)['\"]?/i,    // heredoc pattern
  /\brm\s+(-[rf]*\s+)?[^|&;]+/i,    // rm with code files
  /\bmv\s+/i,                       // mv (rename/move)
  /\bcp\s+/i,                       // cp (copy)
];
```

#### ファイルパス抽出 (extractFilePathFromCommand)

```javascript
function extractFilePathFromCommand(command) {
  // 1. リダイレクト (>, >>) からファイルパス抽出
  // "echo test > file.ts" → "file.ts"

  // 2. sed -i からファイルパス抽出
  // "sed -i 's/old/new/' file.ts" → "file.ts"

  // 3. tee からファイルパス抽出
  // "cat input | tee output.log" → "output.log"

  // 4. mv, cp, rm からファイルパス抽出
  // "cp src/main.ts dest/main.ts" → "dest/main.ts"

  // 5. ファイル拡張子パターンで抽出（フォールバック）
  // "process-file file.ts" → "file.ts"
}
```

### 並列フェーズ処理

#### アクティブサブフェーズ特定 (identifyActiveSubPhase)

```javascript
function identifyActiveSubPhase(workflowState, subPhases) {
  // 優先度:
  // 1. subPhaseUpdates から最後に更新されたサブフェーズ
  // 2. subPhases から in_progress のサブフェーズ

  // workflowState 例:
  // {
  //   subPhaseUpdates: {
  //     state_machine: "2026-02-07T12:00:00Z",
  //     flowchart: "2026-02-07T11:50:00Z",
  //   },
  //   subPhases: {
  //     state_machine: "completed",
  //     flowchart: "in_progress",
  //   }
  // }
}
```

#### サブフェーズルール合算 (combineSubPhaseRules)

```javascript
function combineSubPhaseRules(subPhases) {
  // 複数サブフェーズのルールを統合
  // allowed に含まれるものは blocked から除外（寛容側に倒す）

  // 例:
  // parallel_design の場合:
  // - state_machine: allowed=[spec,diagram]
  // - flowchart: allowed=[spec,diagram]
  // - ui_design: allowed=[spec,diagram]
  // → 合算: allowed=[spec,diagram]
}
```

### implementationフェーズのスコープ検証

#### スコープ違反チェック (checkScopeViolation)

```javascript
function checkScopeViolation(filePath, workflowState) {
  // docs/ 配下は常に許可
  if (normalizedPath.startsWith('docs/')) {
    return { blocked: false };
  }

  // src/ 配下のみチェック
  if (!normalizedPath.startsWith('src/')) {
    return { blocked: false };
  }

  // affectedFiles に含まれているか確認
  for (const allowedFile of affectedFiles) {
    if (normalizedPath === normalizedAllowed) {
      return { blocked: false };
    }
  }

  // affectedDirs に含まれているか確認（プレフィックスマッチ）
  for (const allowedDir of affectedDirs) {
    const dirPrefix = normalizedDir.endsWith('/') ? normalizedDir : normalizedDir + '/';
    if (normalizedPath.startsWith(dirPrefix)) {
      return { blocked: false };
    }
  }

  // どちらにも含まれない場合はブロック
  return {
    blocked: true,
    reason: 'このファイルは影響範囲に含まれていません',
    allowedFiles,
    allowedDirs,
  };
}
```

### ブロックメッセージ表示

#### メッセージ構成

```
============================================================
 フェーズ別編集制限違反
============================================================

 フェーズ: implementation（実装（Green））
 ファイル: src/unrelated/file.ts
 ファイルタイプ: code（ソースコード）

 理由: 実装フェーズ（TDD Green）ソースコード編集可能。テストコードは編集不可。

 TDD サイクル:
   1. Red フェーズ（test_impl）: テストコードを書く ← 現在地
   2. Green フェーズ（implementation）: テストを通す実装を書く
   3. Refactor フェーズ（refactoring）: コード品質を改善

 許可されるファイル:
   - ソースコード: *.ts, *.tsx, *.js, *.jsx
   - 仕様書: *.md
   - 設定ファイル: package.json, tsconfig.json, *.yaml
   - 環境変数ファイル: .env, .env.local, .env.*

 次のステップ:
   → /workflow next で test_design（テスト設計）
     フェーズへ進むとファイル編集が可能になります

 スキップ（緊急時のみ）:
   SKIP_PHASE_GUARD=true を設定

============================================================
```

### ログ機能

#### ログファイル構成

```
.claude-phase-guard-log.json (JSON 形式)

最大100エントリ保持
形式:
[
  {
    "timestamp": "2026-02-07T12:00:00.000Z",
    "allowed": true,
    "phase": "implementation",
    "filePath": "src/main.ts",
    "fileType": "code"
  },
  {
    "timestamp": "2026-02-07T12:01:00.000Z",
    "blocked": true,
    "phase": "implementation",
    "filePath": "src/unrelated/file.ts",
    "fileType": "code",
    "reason": "スコープ違反"
  }
]
```

#### デバッグログ

```bash
DEBUG_PHASE_GUARD=true node phase-edit-guard.js
```

出力例:
```
[phase-edit-guard] チェック対象: docs/workflows/task/state-machine.mmd
[phase-edit-guard] 現在のフェーズ: state_machine
[phase-edit-guard] ファイルタイプ: diagram
[phase-edit-guard] 編集許可
```

## セキュリティとベストプラクティス

### 1. 常に許可されるパターン

```javascript
const ALWAYS_ALLOWED_BASH_PATTERNS = [
  // 読み取り専用コマンド
  /^\s*(ls|dir|pwd|cat|head|tail|less|more|grep|rg|find|tree|wc|file|stat)\s/i,
  // プロセス情報（読み取りのみ）
  /^\s*(ps|top|htop)\s/i,
  // Git読み取り
  /\bgit\s+(status|log|diff|branch|show|remote)\b/i,
  // ネットワーク読み取り
  /^\s*(curl|wget|netstat|ping|nc|nslookup|dig)\s/i,
  // システム情報
  /^\s*(uname|hostname|whoami|id|env|printenv|which|where|type)\s/i,
];
```

### 2. 常に許可されるファイル

```javascript
const ALWAYS_ALLOWED_PATTERNS = [
  /workflow-state\.json$/i,
  /\.claude-workflow-state\.json$/i,
  /\.claude-.*\.json$/i, // Claude関連状態ファイル
];
```

### 3. 設定ファイルの一覧

```javascript
const CONFIG_FILE_PATTERNS = [
  // パッケージマネージャ設定
  'package.json', 'package-lock.json', 'pnpm-lock.yaml',
  // TypeScript設定
  'tsconfig.json', 'tsconfig.base.json',
  // Lint/Formatter設定
  '.eslintrc', '.prettier.rc',
  // ビルドツール設定
  'vite.config', 'webpack.config', 'jest.config',
  // その他
  '.gitignore', 'serverless.yml', 'docker-compose.yml', 'Dockerfile',
];
```

## エラーハンドリング戦略

### 「安全側に倒す」原則

```
不確実性が生じた場合は、許可の方向に倒す

例:
- JSON パースエラー → 許可（exit code 0）
- ファイル読み込みエラー → ログ記録して続行
- 不明なフェーズ → 許可
- ワークフロー未開始 → 許可
```

### タイムアウト処理

```javascript
const TIMEOUT_MS = 3000; // 3秒

const timeoutId = setTimeout(() => {
  process.exit(0); // タイムアウト時は許可
}, TIMEOUT_MS);
```

## パフォーマンス最適化

### 1. パターンマッチング順序

```javascript
// 優先度の高いパターンを最初にチェック
for (const pattern of dangerousPatterns) {
  if (pattern.test(command)) {
    // マッチしたらすぐ終了
    return;
  }
}
```

### 2. ログローテーション

```javascript
const MAX_LOG_ENTRIES = 100;

function saveLogs(logs) {
  const trimmedLogs = logs.length > MAX_LOG_ENTRIES
    ? logs.slice(-MAX_LOG_ENTRIES)
    : logs;
  fs.writeFileSync(LOG_FILE, JSON.stringify(trimmedLogs), 'utf8');
}
```

### 3. キャッシング（未実装、拡張案）

```javascript
// 将来的な拡張：ワークフロー状態をメモリキャッシュ
// 同一実行内での重複チェックを回避
```

## まとめ

このワークフロー制御強化により:

1. **セキュリティ強化**: 危険なコマンドをブロック
2. **開発フロー保護**: フェーズ別の編集制限
3. **スコープ管理**: implementationフェーズでの影響範囲チェック
4. **並列フェーズ対応**: 複数サブフェーズの同時実行対応
5. **監査可能性**: 全チェック結果をログに記録

これらのメカニズムにより、品質の高いワークフロー実行を実現します。
