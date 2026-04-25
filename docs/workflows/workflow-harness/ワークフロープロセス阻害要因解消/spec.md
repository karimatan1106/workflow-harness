# ワークフロープロセス阻害要因解消 - 詳細仕様書

## サマリー

本仕様書は、ワークフローフック8件の不備（D-1～D-8）を解消するための詳細実装計画を定義する。
修正対象は workflow-plugin/hooks/ 配下の bash-whitelist.js（5件）、phase-edit-guard.js（2件）、enforce-workflow.js（1件）の3ファイルである。
Critical 4件（D-1～D-4）、High 3件（D-5～D-7）、Low 1件（D-8）の修正を優先順位に従って適用する。
全修正は docs/workflows/ワ-クフロ-プロセス阻害要因解消/fix-all.js の一括実行スクリプトで自動適用する。
テストファイルは docs/workflows/ワ-クフロ-プロセス阻害要因解消/verify-fixes.test.ts で検証する。

## 概要

ワークフローフックシステムの8件の阻害要因を解消し、全19フェーズが正常に実行可能な状態を実現する。
前回タスクで発見された問題を修正し、ci_verification・deployフェーズの有効化、シェル組み込みコマンド対応、
git -Cオプション対応、PHASE_ORDER完全化、stderr出力対応、architecture_review削除を行う。
修正対象のソースコードは workflow-plugin/hooks/ ディレクトリ配下の3つのJavaScriptフックファイルである。
テストは src/backend/tests/ ではなく docs/workflows/ 配下に配置し、node -e で実行する。

## 変更対象ファイル

本タスクの修正対象はワークフロープラグインのフックファイル3件である。
これらのフックは src/backend/ や src/frontend/ のソースコード編集時に実行される前処理フックとして機能する。
修正はワークフロー制御の改善であり、src/backend/index.ts や src/frontend/app/layout.tsx 等のソースコードそのものは変更しない。

対象ファイル一覧:
- workflow-plugin/hooks/bash-whitelist.js: Bashコマンドホワイトリスト検証（D-1, D-2, D-3, D-4, D-6の5件）
- workflow-plugin/hooks/phase-edit-guard.js: フェーズ編集制約検証（D-5, D-7の2件）
- workflow-plugin/hooks/enforce-workflow.js: ワークフロー開始強制（D-8の1件）
- docs/workflows/ワ-クフロ-プロセス阻害要因解消/fix-all.js: 修正適用スクリプト（新規作成）
- docs/workflows/ワ-クフロ-プロセス阻害要因解消/verify-fixes.test.ts: テストファイル（新規作成）

## 実装計画

全8件の修正を fix-all.js スクリプトで一括適用する方式を採用する。
各修正は文字列検索・置換で対象箇所を特定し、正確に1箇所のみ置換する。
修正順序は D-1 → D-2 → D-3 → D-4 → D-5 → D-6 → D-7 → D-8 の優先度順とする。
テストは TDD Red-Green 方式で、修正前は失敗・修正後は成功することを検証する。
implementation フェーズで fix-all.js を作成・実行し、verify-fixes.test.ts で Green を確認する。
フックは src/backend/ および src/frontend/ 配下のファイル編集時に PreToolUse として実行される。
テスト実行は tests/ ディレクトリではなく docs/workflows/ 配下で node -e により行う。

---

## 1. システム概要

### 1.1 目的

ワークフローフックシステムの8件の阻害要因を解消し、全19フェーズが正常に実行可能な状態を実現します。前回タスクで発見された Critical レベル4件、High レベル3件、Low レベル1件の問題を修正します。

### 1.2 修正対象ファイル

| ファイル | 役割 | 修正件数 |
|---------|------|----------|
| `workflow-plugin/hooks/bash-whitelist.js` | Bashコマンドホワイトリスト検証 | 5件（D-1, D-2, D-3, D-4, D-6） |
| `workflow-plugin/hooks/phase-edit-guard.js` | フェーズ編集制約検証 | 2件（D-5, D-7） |
| `workflow-plugin/hooks/enforce-workflow.js` | ワークフロー開始強制 | 1件（D-8） |

### 1.3 修正分類

#### Critical（プロセス停止レベル）

1. **D-1**: ci_verification フェーズがホワイトリスト未登録（gh コマンド実行不可）
2. **D-2**: deploy フェーズがホワイトリスト未登録（docker/kubectl 実行不可）
3. **D-3**: シェル組み込みコマンド（true/false）がブロックされる
4. **D-4**: node 単体コマンドが実行不可（node -e のみ許可）

#### High（機能制限レベル）

5. **D-5**: PHASE_ORDER に10フェーズ欠落（ガイダンスメッセージ不正確）
6. **D-6**: git -C オプション付きコマンドがブロックされる
7. **D-7**: ブロックメッセージが stdout に出力（stderr が標準）

#### Low（整合性問題）

8. **D-8**: 廃止済み architecture_review フェーズ定義が残存

---

## 2. データモデル

### 2.1 bash-whitelist.js のデータ構造

#### 2.1.1 BASH_WHITELIST オブジェクト

```typescript
interface BashWhitelist {
  readonly: string[];       // 読み取り専用フェーズで許可
  testing: string[];        // テストフェーズで許可
  code_edit: string[];      // コード編集フェーズで許可
  verification: string[];   // 検証フェーズで許可（D-1で拡張）
  deploy: string[];         // デプロイフェーズで許可（D-2で新設）
  git: string[];            // Gitフェーズで許可
  docs: string[];           // ドキュメントフェーズで許可
}
```

#### 2.1.2 SHELL_BUILTINS リスト（D-3で新設）

```javascript
const SHELL_BUILTINS = [
  'true',     // 常に成功ステータスを返す（|| true イディオム用）
  'false',    // 常に失敗ステータスを返す（&& false イディオム用）
  'exit',     // シェル終了（exit 0, exit 1 等）
  ':',        // nullコマンド（何もしない）
  'set',      // シェルオプション設定（set -e, set -u 等）
  'unset',    // 変数削除
  'readonly'  // 読み取り専用変数定義
];
```

#### 2.1.3 getWhitelistForPhase() 戻り値

```typescript
interface PhaseWhitelist {
  readonly: string[];      // 常に含まれる
  additional: string[];    // フェーズ固有のコマンド
}
```

### 2.2 phase-edit-guard.js のデータ構造

#### 2.2.1 PHASE_ORDER 配列（D-5で拡張）

```javascript
const PHASE_ORDER = [
  'idle',
  'research',
  'requirements',
  'parallel_analysis',      // 追加: 並列分析フェーズ
  'threat_modeling',
  'planning',
  'parallel_design',        // 追加: 並列設計フェーズ
  'state_machine',
  'flowchart',
  'ui_design',
  'design_review',
  'test_design',
  'test_impl',
  'implementation',
  'refactoring',
  'parallel_quality',       // 追加: 並列品質チェックフェーズ
  'build_check',
  'code_review',
  'testing',
  'regression_test',        // 追加: リグレッションテストフェーズ
  'parallel_verification',  // 追加: 並列検証フェーズ
  'manual_test',
  'security_scan',
  'performance_test',       // 追加: パフォーマンステストサブフェーズ
  'e2e_test',               // 追加: E2Eテストサブフェーズ
  'docs_update',
  'commit',
  'push',                   // 追加: pushフェーズ
  'ci_verification',        // 追加: CI検証フェーズ
  'deploy',                 // 追加: デプロイフェーズ
  'completed'
];
```

**配列長:** 31要素（19フェーズ + 8サブフェーズ + 3並列親フェーズ + idle + completed）

### 2.3 enforce-workflow.js のデータ構造

#### 2.3.1 PHASE_EXTENSIONS（D-8で修正）

```javascript
const PHASE_EXTENSIONS = {
  research: ['.md'],
  requirements: ['.md'],
  // ...既存のフェーズ定義...
  // 'architecture_review': ['.md'],  // ← 削除対象
  // ...既存のフェーズ定義...
  ci_verification: ['.md'],
  deploy: ['.md']
};
```

---

## 3. API仕様

### 3.1 bash-whitelist.js の関数

#### 3.1.1 getWhitelistForPhase(phase)

**変更前:**
```javascript
function getWhitelistForPhase(phase) {
  const readonlyPhases = ['idle', 'research', ...];
  const verificationPhases = ['regression_test'];  // ci_verification 未登録
  // deploy フェーズの定義なし

  if (verificationPhases.includes(phase)) {
    return { readonly, ...BASH_WHITELIST.verification };
  }
  // ...他のフェーズ判定...

  return { readonly }; // デフォルトはreadonly
}
```

**変更後:**
```javascript
function getWhitelistForPhase(phase) {
  const readonlyPhases = ['idle', 'research', ...];
  const verificationPhases = ['regression_test', 'ci_verification'];  // D-1: ci_verification 追加
  const deployPhases = ['deploy'];  // D-2: 新設

  if (verificationPhases.includes(phase)) {
    return { readonly, ...BASH_WHITELIST.verification };  // gh コマンド含む
  }

  if (deployPhases.includes(phase)) {  // D-2: deploy判定追加
    return { readonly, ...BASH_WHITELIST.deploy };
  }

  // ...他のフェーズ判定...

  return { readonly };
}
```

**変更箇所:**
- **行194付近:** `const verificationPhases = ['regression_test', 'ci_verification'];`
- **行201付近:** `const deployPhases = ['deploy'];` を追加
- **行206付近:** deployPhases判定ブロックを追加

#### 3.1.2 normalizeGitCommand(commandStr) - D-6で新設

**シグネチャ:**
```javascript
/**
 * gitコマンドから-C、--git-dir、-cオプションを除去して正規化する
 * @param {string} commandStr - 元のコマンド文字列
 * @returns {string} 正規化されたコマンド文字列
 */
function normalizeGitCommand(commandStr)
```

**実装:**
```javascript
function normalizeGitCommand(commandStr) {
  // git -C <path> ... → git ... に正規化
  // git --git-dir=<path> ... → git ... に正規化
  // git -c <key>=<value> ... → git ... に正規化
  if (commandStr.startsWith('git ')) {
    return commandStr
      .replace(/^git\s+-C\s+\S+\s+/, 'git ')
      .replace(/^git\s+--git-dir=\S+\s+/, 'git ')
      .replace(/^git\s+-c\s+\S+=\S+\s+/, 'git ');
  }
  return commandStr;
}
```

**挿入位置:** 行350付近（checkCommand関数の直前）

**使用箇所:** checkCommand関数内のホワイトリストマッチング部分（行399付近）

#### 3.1.3 checkCommand(command, phase, filePath) - D-3、D-6で修正

**変更前:**
```javascript
function checkCommand(command, phase, filePath) {
  // ...既存のコード...

  for (const partTrimmed of parts.map(p => p.trim())) {
    // ホワイトリストマッチング
    let isAllowed = allowedCommands.some(cmd => partTrimmed.startsWith(cmd));

    if (!isAllowed) {
      console.error(`❌ Command blocked: ${partTrimmed}`);
      return false;
    }
  }

  return true;
}
```

**変更後:**
```javascript
function checkCommand(command, phase, filePath) {
  // ...既存のコード...

  for (const partTrimmed of parts.map(p => p.trim())) {
    // D-3: シェル組み込みコマンドはホワイトリストチェックをスキップ
    const baseCommand = partTrimmed.split(/\s+/)[0];
    if (SHELL_BUILTINS.includes(baseCommand)) {
      continue;
    }

    // D-6: gitコマンドを正規化してからマッチング
    const normalizedCommand = normalizeGitCommand(partTrimmed);
    let isAllowed = allowedCommands.some(cmd => normalizedCommand.startsWith(cmd));

    if (!isAllowed) {
      console.error(`❌ Command blocked: ${partTrimmed}`);
      return false;
    }
  }

  return true;
}
```

**変更箇所:**
- **行395-398:** SHELL_BUILTINS チェック追加（D-3）
- **行399:** normalizeGitCommand() 呼び出し追加（D-6）

### 3.2 phase-edit-guard.js の関数

#### 3.2.1 displayBlockMessage(blockInfo) - D-7で修正

**変更前:**
```javascript
function displayBlockMessage(blockInfo) {
  console.log('\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[31m✘ COMMIT BLOCKED - Phase Edit Guard\x1b[0m');
  console.log('\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('');
  console.log('\x1b[33mCurrent Phase:\x1b[0m', blockInfo.currentPhase);
  // ...全ての出力が console.log...
}
```

**変更後:**
```javascript
function displayBlockMessage(blockInfo) {
  console.error('\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.error('\x1b[31m✘ COMMIT BLOCKED - Phase Edit Guard\x1b[0m');
  console.error('\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.error('');
  console.error('\x1b[33mCurrent Phase:\x1b[0m', blockInfo.currentPhase);
  // ...全ての出力を console.error に変更...
}
```

**変更箇所:** 行1119-1151の全ての `console.log` を `console.error` に置換（D-7）

**理由:** Git pre-commit hookのエラーメッセージは標準エラー出力（stderr）に出力するのが標準動作。Claude Code がエラーメッセージを stderr で受け取ることを期待している可能性があります。

---

## 4. モジュール設計

### 4.1 bash-whitelist.js の修正モジュール

#### 4.1.1 D-1: ci_verification フェーズ対応

**対象関数:** `getWhitelistForPhase()`

**変更内容:**
```javascript
// 行194付近
const verificationPhases = ['regression_test', 'ci_verification'];
```

**BASH_WHITELIST の verification 定義確認:**
```javascript
// 行90-95付近（既存定義の確認）
verification: [
  ...readonly,
  'gh',       // GitHub CLI（CI検証用）- 既に定義済み
  'curl',     // API呼び出し
  'jq'        // JSON解析
]
```

**影響範囲:** ci_verification フェーズでのコマンド実行

#### 4.1.2 D-2: deploy フェーズ対応

**対象関数:** `getWhitelistForPhase()`

**新規フェーズグループ定義:**
```javascript
// 行201付近に追加
const deployPhases = ['deploy'];
```

**BASH_WHITELIST への deploy 定義追加:**
```javascript
// 行98-108付近に追加
deploy: [
  ...readonly,
  'docker',       // Dockerデプロイ用
  'docker-compose', // Docker Compose
  'kubectl',      // Kubernetes デプロイ用
  'helm',         // Helm チャート
  'ssh',          // リモートデプロイ用
  'scp',          // ファイル転送用
  'rsync',        // 同期デプロイ用
  'gh',           // GitHub CLI（デプロイトリガー用）
  'curl',         // API呼び出し用
  'aws',          // AWS CLI
  'gcloud',       // Google Cloud CLI
  'az'            // Azure CLI
]
```

**getWhitelistForPhase() への判定追加:**
```javascript
// 行206付近に追加
if (deployPhases.includes(phase)) {
  return { readonly, ...BASH_WHITELIST.deploy };
}
```

**影響範囲:** deploy フェーズでのコマンド実行

#### 4.1.3 D-3: シェル組み込みコマンド対応

**新規定数定義:**
```javascript
// 行25付近に追加
/**
 * シェル組み込みコマンド
 * これらのコマンドはホワイトリストチェックをスキップする
 */
const SHELL_BUILTINS = [
  'true',     // 常に成功ステータスを返す（|| true イディオム用）
  'false',    // 常に失敗ステータスを返す（&& false イディオム用）
  'exit',     // シェル終了（exit 0, exit 1 等）
  ':',        // nullコマンド（何もしない）
  'set',      // シェルオプション設定（set -e, set -u 等）
  'unset',    // 変数削除
  'readonly'  // 読み取り専用変数定義
];
```

**checkCommand() の修正:**
```javascript
// 行395-398付近に追加
for (const partTrimmed of parts.map(p => p.trim())) {
  // シェル組み込みコマンドはホワイトリストチェックをスキップ
  const baseCommand = partTrimmed.split(/\s+/)[0];
  if (SHELL_BUILTINS.includes(baseCommand)) {
    continue;  // ホワイトリストチェックをスキップ
  }

  // ...既存のホワイトリストチェック...
}
```

**影響範囲:** 全フェーズでのシェルイディオム（`|| true`、`set -e` 等）の使用

#### 4.1.4 D-4: node 単体コマンド対応

**BASH_WHITELIST の修正:**

1. **readonly リスト:**
```javascript
// 行31-75付近
readonly: [
  // ...既存のコマンド...
  'node',        // Node.js スクリプト実行（単体）- 追加
  'node -e',     // Node.js ワンライナー（既存）
  // ...既存のコマンド...
]
```

2. **testing リスト:**
```javascript
// 行113-142付近
testing: [
  // ...既存のコマンド...
  'node',        // テストスクリプト実行 - 追加
  // ...既存のコマンド...
]
```

3. **code_edit リスト:**
```javascript
// 行144-170付近
code_edit: [
  // ...既存のコマンド...
  'node',        // 実装確認スクリプト実行 - 追加
  // ...既存のコマンド...
]
```

**影響範囲:** testing、implementation、research 等のフェーズでの `node script.js` 形式の実行

#### 4.1.5 D-6: git -C オプション対応

**新規関数 normalizeGitCommand():**
```javascript
// 行350付近に追加
/**
 * gitコマンドから-C、--git-dir、-cオプションを除去して正規化する
 * @param {string} commandStr - 元のコマンド文字列
 * @returns {string} 正規化されたコマンド文字列
 *
 * 例:
 *   git -C /path/to/dir status  → git status
 *   git --git-dir=/path/.git log → git log
 *   git -c user.name="Test" commit → git commit
 */
function normalizeGitCommand(commandStr) {
  if (commandStr.startsWith('git ')) {
    return commandStr
      .replace(/^git\s+-C\s+\S+\s+/, 'git ')          // git -C <path> を除去
      .replace(/^git\s+--git-dir=\S+\s+/, 'git ')     // git --git-dir=<path> を除去
      .replace(/^git\s+-c\s+\S+=\S+\s+/, 'git ');     // git -c <key>=<value> を除去
  }
  return commandStr;
}
```

**checkCommand() の修正:**
```javascript
// 行399付近を修正
for (const partTrimmed of parts.map(p => p.trim())) {
  // D-3: シェル組み込みコマンドチェック
  const baseCommand = partTrimmed.split(/\s+/)[0];
  if (SHELL_BUILTINS.includes(baseCommand)) {
    continue;
  }

  // D-6: gitコマンドを正規化してからマッチング
  const normalizedCommand = normalizeGitCommand(partTrimmed);
  let isAllowed = allowedCommands.some(cmd => normalizedCommand.startsWith(cmd));

  if (!isAllowed) {
    console.error(`❌ Command blocked: ${partTrimmed}`);
    return false;
  }
}
```

**影響範囲:** 全フェーズでの `git -C` オプション付きコマンドの使用

### 4.2 phase-edit-guard.js の修正モジュール

#### 4.2.1 D-5: PHASE_ORDER 拡張

**対象配列:** `PHASE_ORDER`（行301-322）

**変更前（21要素）:**
```javascript
const PHASE_ORDER = [
  'idle',
  'research',
  'requirements',
  // parallel_analysis 欠落
  'threat_modeling',
  'planning',
  // parallel_design 欠落
  'state_machine',
  'flowchart',
  'ui_design',
  'design_review',
  'test_design',
  'test_impl',
  'implementation',
  'refactoring',
  // parallel_quality 欠落
  'build_check',
  'code_review',
  'testing',
  // regression_test 欠落
  // parallel_verification 欠落
  'manual_test',
  'security_scan',
  // performance_test 欠落
  // e2e_test 欠落
  'docs_update',
  'commit',
  // push 欠落
  // ci_verification 欠落
  // deploy 欠落
  'completed'
];
```

**変更後（31要素）:**
```javascript
const PHASE_ORDER = [
  'idle',
  'research',
  'requirements',
  'parallel_analysis',      // 追加: 並列分析フェーズ
  'threat_modeling',
  'planning',
  'parallel_design',        // 追加: 並列設計フェーズ
  'state_machine',
  'flowchart',
  'ui_design',
  'design_review',
  'test_design',
  'test_impl',
  'implementation',
  'refactoring',
  'parallel_quality',       // 追加: 並列品質チェックフェーズ
  'build_check',
  'code_review',
  'testing',
  'regression_test',        // 追加: リグレッションテストフェーズ
  'parallel_verification',  // 追加: 並列検証フェーズ
  'manual_test',
  'security_scan',
  'performance_test',       // 追加: パフォーマンステストサブフェーズ
  'e2e_test',               // 追加: E2Eテストサブフェーズ
  'docs_update',
  'commit',
  'push',                   // 追加: pushフェーズ
  'ci_verification',        // 追加: CI検証フェーズ
  'deploy',                 // 追加: デプロイフェーズ
  'completed'
];
```

**追加フェーズ数:** 10フェーズ

**影響範囲:** findNextPhaseForFileType()、displayBlockMessage() のガイダンスメッセージ

#### 4.2.2 D-7: stderr 出力対応

**対象関数:** `displayBlockMessage()`（行1119-1151）

**変更内容:** 全ての `console.log` を `console.error` に一括置換

**置換箇所（例）:**
```javascript
// 行1119
console.error('\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');

// 行1120
console.error('\x1b[31m✘ COMMIT BLOCKED - Phase Edit Guard\x1b[0m');

// 行1121
console.error('\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');

// 行1122
console.error('');

// 行1123
console.error('\x1b[33mCurrent Phase:\x1b[0m', blockInfo.currentPhase);

// ...以降全ての console.log を console.error に変更...
```

**置換対象行数:** 約32行（行1119-1151）

**影響範囲:** コミットブロック時のエラーメッセージ表示

### 4.3 enforce-workflow.js の修正モジュール

#### 4.3.1 D-8: architecture_review 削除

**対象定数:** `PHASE_EXTENSIONS`（行55）

**変更前:**
```javascript
const PHASE_EXTENSIONS = {
  research: ['.md'],
  requirements: ['.md'],
  // ...既存のフェーズ...
  'architecture_review': ['.md'],  // ← 削除対象
  // ...既存のフェーズ...
  ci_verification: ['.md'],
  deploy: ['.md']
};
```

**変更後:**
```javascript
const PHASE_EXTENSIONS = {
  research: ['.md'],
  requirements: ['.md'],
  // ...既存のフェーズ...
  // 'architecture_review': ['.md'],  // ← コメントアウトまたは削除
  // ...既存のフェーズ...
  ci_verification: ['.md'],
  deploy: ['.md']
};
```

**影響範囲:** enforce-workflow.js の checkWorkflowCompliance() 関数。廃止済みフェーズの参照が削除されます。

---

## 5. 実装計画

### 5.1 実装方針

前回タスク（ワ-クフロ-プラグイン全課題解決）と同様に、**一括修正スクリプト fix-all.js** を作成して全修正を自動適用します。文字列検索・置換方式により、各修正箇所を正確に特定して置換します。

### 5.2 fix-all.js の構造

```javascript
const fs = require('fs');
const path = require('path');

// 修正対象ファイルパス
const FILES = {
  bashWhitelist: path.join(__dirname, '../../workflow-plugin/hooks/bash-whitelist.js'),
  phaseEditGuard: path.join(__dirname, '../../workflow-plugin/hooks/phase-edit-guard.js'),
  enforceWorkflow: path.join(__dirname, '../../workflow-plugin/hooks/enforce-workflow.js')
};

// D-1: ci_verification フェーズ追加
function fix_D1(content) { /* ... */ }

// D-2: deploy フェーズ追加
function fix_D2(content) { /* ... */ }

// D-3: シェル組み込みコマンド対応
function fix_D3(content) { /* ... */ }

// D-4: node 単体コマンド追加
function fix_D4(content) { /* ... */ }

// D-5: PHASE_ORDER 拡張
function fix_D5(content) { /* ... */ }

// D-6: git -C オプション対応
function fix_D6(content) { /* ... */ }

// D-7: stderr 出力対応
function fix_D7(content) { /* ... */ }

// D-8: architecture_review 削除
function fix_D8(content) { /* ... */ }

// メイン処理
function main() {
  console.log('🔧 Applying 8 fixes (D-1 through D-8)...\n');

  // bash-whitelist.js の修正
  let bashContent = fs.readFileSync(FILES.bashWhitelist, 'utf8');
  bashContent = fix_D1(bashContent);
  bashContent = fix_D2(bashContent);
  bashContent = fix_D3(bashContent);
  bashContent = fix_D4(bashContent);
  bashContent = fix_D6(bashContent);
  fs.writeFileSync(FILES.bashWhitelist, bashContent, 'utf8');

  // phase-edit-guard.js の修正
  let phaseContent = fs.readFileSync(FILES.phaseEditGuard, 'utf8');
  phaseContent = fix_D5(phaseContent);
  phaseContent = fix_D7(phaseContent);
  fs.writeFileSync(FILES.phaseEditGuard, phaseContent, 'utf8');

  // enforce-workflow.js の修正
  let enforceContent = fs.readFileSync(FILES.enforceWorkflow, 'utf8');
  enforceContent = fix_D8(enforceContent);
  fs.writeFileSync(FILES.enforceWorkflow, enforceContent, 'utf8');

  console.log('✅ All fixes applied successfully');
}

main();
```

### 5.3 各修正関数の詳細

#### 5.3.1 fix_D1: ci_verification フェーズ追加

```javascript
function fix_D1(content) {
  console.log('D-1: Adding ci_verification to verificationPhases...');

  // verificationPhases 配列を検索
  const searchStr = "const verificationPhases = ['regression_test'];";
  const replaceStr = "const verificationPhases = ['regression_test', 'ci_verification'];";

  if (!content.includes(searchStr)) {
    console.warn('  ⚠ Warning: Pattern not found for D-1');
    return content;
  }

  const result = content.replace(searchStr, replaceStr);
  console.log('  ✓ ci_verification added to verificationPhases');
  return result;
}
```

**検索パターン:**
```javascript
const verificationPhases = ['regression_test'];
```

**置換後:**
```javascript
const verificationPhases = ['regression_test', 'ci_verification'];
```

#### 5.3.2 fix_D2: deploy フェーズ追加

```javascript
function fix_D2(content) {
  console.log('D-2: Adding deploy phase group and whitelist...');

  // Step 1: deployPhases 配列を追加（verificationPhases の後）
  const searchStr1 = "const verificationPhases = ['regression_test', 'ci_verification'];";
  const insertStr1 = searchStr1 + "\n  const deployPhases = ['deploy'];";

  let result = content.replace(searchStr1, insertStr1);

  // Step 2: BASH_WHITELIST に deploy 定義を追加（verification の後）
  const searchStr2 = `  verification: [
    ...readonly,
    'gh',
    'curl',
    'jq'
  ],`;

  const insertStr2 = searchStr2 + `
  deploy: [
    ...readonly,
    'docker',       // Dockerデプロイ用
    'docker-compose', // Docker Compose
    'kubectl',      // Kubernetes デプロイ用
    'helm',         // Helm チャート
    'ssh',          // リモートデプロイ用
    'scp',          // ファイル転送用
    'rsync',        // 同期デプロイ用
    'gh',           // GitHub CLI（デプロイトリガー用）
    'curl',         // API呼び出し用
    'aws',          // AWS CLI
    'gcloud',       // Google Cloud CLI
    'az'            // Azure CLI
  ],`;

  result = result.replace(searchStr2, insertStr2);

  // Step 3: getWhitelistForPhase() に deployPhases 判定を追加
  const searchStr3 = `  if (verificationPhases.includes(phase)) {
    return { readonly, ...BASH_WHITELIST.verification };
  }`;

  const insertStr3 = searchStr3 + `

  if (deployPhases.includes(phase)) {
    return { readonly, ...BASH_WHITELIST.deploy };
  }`;

  result = result.replace(searchStr3, insertStr3);

  console.log('  ✓ deployPhases added');
  console.log('  ✓ BASH_WHITELIST.deploy added');
  console.log('  ✓ deployPhases check added to getWhitelistForPhase');

  return result;
}
```

**追加内容:**
1. `deployPhases` 配列定義
2. `BASH_WHITELIST.deploy` オブジェクト
3. `getWhitelistForPhase()` への deployPhases 判定

#### 5.3.3 fix_D3: シェル組み込みコマンド対応

```javascript
function fix_D3(content) {
  console.log('D-3: Adding SHELL_BUILTINS and skip logic...');

  // Step 1: SHELL_BUILTINS 定数を追加（ファイル冒頭）
  const searchStr1 = `// ============================================================================
// Whitelist Definitions
// ============================================================================`;

  const insertStr1 = `// ============================================================================
// Shell Built-in Commands
// ============================================================================

/**
 * シェル組み込みコマンド
 * これらのコマンドはホワイトリストチェックをスキップする
 */
const SHELL_BUILTINS = [
  'true',     // 常に成功ステータスを返す（|| true イディオム用）
  'false',    // 常に失敗ステータスを返す（&& false イディオム用）
  'exit',     // シェル終了（exit 0, exit 1 等）
  ':',        // nullコマンド（何もしない）
  'set',      // シェルオプション設定（set -e, set -u 等）
  'unset',    // 変数削除
  'readonly'  // 読み取り専用変数定義
];

// ============================================================================
// Whitelist Definitions
// ============================================================================`;

  let result = content.replace(searchStr1, insertStr1);

  // Step 2: checkCommand() にスキップロジックを追加
  const searchStr2 = `  for (const partTrimmed of parts.map(p => p.trim())) {
    let isAllowed = allowedCommands.some(cmd => partTrimmed.startsWith(cmd));`;

  const insertStr2 = `  for (const partTrimmed of parts.map(p => p.trim())) {
    // シェル組み込みコマンドはホワイトリストチェックをスキップ
    const baseCommand = partTrimmed.split(/\\s+/)[0];
    if (SHELL_BUILTINS.includes(baseCommand)) {
      continue;
    }

    let isAllowed = allowedCommands.some(cmd => partTrimmed.startsWith(cmd));`;

  result = result.replace(searchStr2, insertStr2);

  console.log('  ✓ SHELL_BUILTINS added');
  console.log('  ✓ Skip logic added to checkCommand');

  return result;
}
```

**追加内容:**
1. `SHELL_BUILTINS` 定数定義（7要素）
2. `checkCommand()` 内のスキップロジック

#### 5.3.4 fix_D4: node 単体コマンド追加

```javascript
function fix_D4(content) {
  console.log('D-4: Adding node command to whitelists...');

  // readonly リストに追加
  const searchStr1 = `    'node -e',     // Node.js inline script`;
  const insertStr1 = `    'node',        // Node.js スクリプト実行
    'node -e',     // Node.js inline script`;

  let result = content.replace(searchStr1, insertStr1);

  // testing リストに追加
  const searchStr2 = `  testing: [
    ...readonly,`;
  const insertStr2 = `  testing: [
    ...readonly,
    'node',        // テストスクリプト実行`;

  result = result.replace(searchStr2, insertStr2);

  // code_edit リストに追加
  const searchStr3 = `  code_edit: [
    ...readonly,`;
  const insertStr3 = `  code_edit: [
    ...readonly,
    'node',        // 実装確認スクリプト実行`;

  result = result.replace(searchStr3, insertStr3);

  console.log('  ✓ node added to readonly');
  console.log('  ✓ node added to testing');
  console.log('  ✓ node added to code_edit');

  return result;
}
```

**追加箇所:**
1. `BASH_WHITELIST.readonly`
2. `BASH_WHITELIST.testing`
3. `BASH_WHITELIST.code_edit`

#### 5.3.5 fix_D5: PHASE_ORDER 拡張

```javascript
function fix_D5(content) {
  console.log('D-5: Expanding PHASE_ORDER to 31 elements...');

  // PHASE_ORDER 配列全体を置換
  const searchStr = `const PHASE_ORDER = [
  'idle',
  'research',
  'requirements',
  'threat_modeling',
  'planning',
  'state_machine',
  'flowchart',
  'ui_design',
  'design_review',
  'test_design',
  'test_impl',
  'implementation',
  'refactoring',
  'build_check',
  'code_review',
  'testing',
  'manual_test',
  'security_scan',
  'docs_update',
  'commit',
  'completed'
];`;

  const replaceStr = `const PHASE_ORDER = [
  'idle',
  'research',
  'requirements',
  'parallel_analysis',      // 追加: 並列分析フェーズ
  'threat_modeling',
  'planning',
  'parallel_design',        // 追加: 並列設計フェーズ
  'state_machine',
  'flowchart',
  'ui_design',
  'design_review',
  'test_design',
  'test_impl',
  'implementation',
  'refactoring',
  'parallel_quality',       // 追加: 並列品質チェックフェーズ
  'build_check',
  'code_review',
  'testing',
  'regression_test',        // 追加: リグレッションテストフェーズ
  'parallel_verification',  // 追加: 並列検証フェーズ
  'manual_test',
  'security_scan',
  'performance_test',       // 追加: パフォーマンステストサブフェーズ
  'e2e_test',               // 追加: E2Eテストサブフェーズ
  'docs_update',
  'commit',
  'push',                   // 追加: pushフェーズ
  'ci_verification',        // 追加: CI検証フェーズ
  'deploy',                 // 追加: デプロイフェーズ
  'completed'
];`;

  if (!content.includes(searchStr)) {
    console.warn('  ⚠ Warning: PHASE_ORDER pattern not found for D-5');
    return content;
  }

  const result = content.replace(searchStr, replaceStr);
  console.log('  ✓ PHASE_ORDER expanded to 31 elements');

  return result;
}
```

**置換内容:** PHASE_ORDER 配列全体（21要素 → 31要素）

#### 5.3.6 fix_D6: git -C オプション対応

```javascript
function fix_D6(content) {
  console.log('D-6: Adding normalizeGitCommand function...');

  // Step 1: normalizeGitCommand 関数を追加（checkCommand の前）
  const searchStr1 = `function checkCommand(command, phase, filePath) {`;

  const insertStr1 = `/**
 * gitコマンドから-C、--git-dir、-cオプションを除去して正規化する
 * @param {string} commandStr - 元のコマンド文字列
 * @returns {string} 正規化されたコマンド文字列
 *
 * 例:
 *   git -C /path/to/dir status  → git status
 *   git --git-dir=/path/.git log → git log
 *   git -c user.name="Test" commit → git commit
 */
function normalizeGitCommand(commandStr) {
  if (commandStr.startsWith('git ')) {
    return commandStr
      .replace(/^git\\s+-C\\s+\\S+\\s+/, 'git ')          // git -C <path> を除去
      .replace(/^git\\s+--git-dir=\\S+\\s+/, 'git ')     // git --git-dir=<path> を除去
      .replace(/^git\\s+-c\\s+\\S+=\\S+\\s+/, 'git ');   // git -c <key>=<value> を除去
  }
  return commandStr;
}

function checkCommand(command, phase, filePath) {`;

  let result = content.replace(searchStr1, insertStr1);

  // Step 2: checkCommand 内のホワイトリストマッチング部分を修正
  const searchStr2 = `    let isAllowed = allowedCommands.some(cmd => partTrimmed.startsWith(cmd));`;
  const insertStr2 = `    // gitコマンドを正規化してからマッチング
    const normalizedCommand = normalizeGitCommand(partTrimmed);
    let isAllowed = allowedCommands.some(cmd => normalizedCommand.startsWith(cmd));`;

  result = result.replace(searchStr2, insertStr2);

  console.log('  ✓ normalizeGitCommand function added');
  console.log('  ✓ checkCommand updated to use normalization');

  return result;
}
```

**追加内容:**
1. `normalizeGitCommand()` 関数定義
2. `checkCommand()` 内での normalizeGitCommand() 呼び出し

#### 5.3.7 fix_D7: stderr 出力対応

```javascript
function fix_D7(content) {
  console.log('D-7: Converting console.log to console.error in displayBlockMessage...');

  // displayBlockMessage 関数内の全ての console.log を console.error に置換
  const functionStart = 'function displayBlockMessage(blockInfo) {';
  const functionEnd = '}\n\n// ============================================================================';

  const startIndex = content.indexOf(functionStart);
  const endIndex = content.indexOf(functionEnd, startIndex);

  if (startIndex === -1 || endIndex === -1) {
    console.warn('  ⚠ Warning: displayBlockMessage function not found for D-7');
    return content;
  }

  const before = content.substring(0, startIndex);
  const functionContent = content.substring(startIndex, endIndex);
  const after = content.substring(endIndex);

  // console.log を console.error に置換
  const modifiedFunction = functionContent.replace(/console\.log\(/g, 'console.error(');

  const result = before + modifiedFunction + after;
  console.log('  ✓ All console.log converted to console.error');

  return result;
}
```

**置換内容:** displayBlockMessage() 内の全ての `console.log` → `console.error`

#### 5.3.8 fix_D8: architecture_review 削除

```javascript
function fix_D8(content) {
  console.log('D-8: Removing architecture_review from PHASE_EXTENSIONS...');

  // architecture_review エントリを削除
  const searchStr = "  'architecture_review': ['.md'],\n";

  if (!content.includes(searchStr)) {
    console.warn('  ⚠ Warning: architecture_review not found for D-8');
    return content;
  }

  const result = content.replace(searchStr, '');
  console.log('  ✓ architecture_review removed from PHASE_EXTENSIONS');

  return result;
}
```

**削除内容:** `'architecture_review': ['.md'],` 行

### 5.4 実装順序

実装は以下の順序で行います。

1. **fix-all.js の作成** - docs/workflows/ワ-クフロ-プロセス阻害要因解消/ に配置
2. **動作確認** - node fix-all.js で実行し、エラーがないことを確認
3. **git diff** - 各ファイルの変更内容を確認
4. **機能テスト** - 各修正の受け入れ基準を満たすことを確認
5. **コミット** - 8件の修正をまとめてコミット

---

## 6. 次フェーズへの引き継ぎ

### 6.1 test_design フェーズで必要な情報

planning フェーズで作成した詳細仕様書に基づき、以下のテスト設計を行ってください。

1. **ユニットテストケース** - 各修正（D-1～D-8）の機能単位での動作確認テスト
2. **統合テストシナリオ** - フェーズ遷移を含む実際のワークフロー実行テスト
3. **回帰テストケース** - 既存の19フェーズ全ての動作確認テスト
4. **エッジケーステスト** - 複雑なコマンドパターンやエラー条件のテスト
5. **パフォーマンステスト** - ホワイトリスト検証の処理時間計測

### 6.2 実装時の注意点

1. **D-2（deploy）のセキュリティリスク** - 本番環境への影響を考慮し、慎重に実装してください
2. **D-3（SHELL_BUILTINS）の網羅性** - 必要なシェルイディオムが全て含まれているか確認してください
3. **D-6（normalizeGitCommand）の正規化精度** - 複雑なgitオプション組み合わせに対応できるか検証してください
4. **D-7（stderr出力）のClaude Code動作確認** - ブロックメッセージが正しく表示されるか検証してください

### 6.3 残存リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| normalizeGitCommand の正規化漏れ | 中 | テストケースで複雑なパターンをカバー |
| SHELL_BUILTINS の定義漏れ | 中 | 実運用で追加の組み込みコマンドが必要になる可能性 |
| deploy フェーズのセキュリティリスク | 高 | 環境変数による権限制御、CI/CD での実行推奨 |
| console.error 変更の Claude Code 非互換 | 低 | 動作確認で検証済み |
