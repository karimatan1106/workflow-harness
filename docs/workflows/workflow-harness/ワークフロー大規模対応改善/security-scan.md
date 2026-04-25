# セキュリティスキャンレポート

## 実行日時
2026-02-07

## スキャン対象ファイル

1. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts`
2. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/record-test-result.ts`
3. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/back.ts`
4. `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/parsers/spec-parser.ts`
5. `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-workflow-artifact.js`

---

## セキュリティスキャン結果サマリー

| カテゴリ | 深刻度 | 件数 | ステータス |
|---------|--------|------|-----------|
| 入力バリデーション | 中 | 2 | 許容可能 |
| パストラバーサル攻撃 | 高 | 3 | 注意が必要 |
| コマンドインジェクション | 低 | 0 | 安全 |
| 機密情報漏洩 | 低 | 1 | 許容可能 |
| エラーハンドリング | 中 | 2 | 改善推奨 |
| ReDoS脆弱性 | 低 | 0 | 安全 |

**総合判定: YELLOW（改善推奨）**

---

## 詳細スキャン結果

### 1. set-scope.ts

#### ✅ 安全な実装
- **入力バリデーション**: 配列型チェックが適切に実装されている（行44-45）
- **型安全性**: TypeScriptの型定義により、不正な型の入力を防止
- **エラー処理**: 各エラーケースに対して適切なエラーメッセージを返却

```typescript
// 適切なバリデーション例
const affectedFiles = Array.isArray(files) ? files : [];
const affectedDirs = Array.isArray(dirs) ? dirs : [];

if (affectedFiles.length === 0 && affectedDirs.length === 0) {
  return {
    success: false,
    message: 'files または dirs の少なくとも1つを指定してください',
  };
}
```

#### ⚠️ 検出項目
- **パス検証不足（中度）**: ファイル/ディレクトリパスの妥当性検証がない
  - リスク: パストラバーサル攻撃は難しいが、存在しないパスの受け入れ
  - 推奨: `path.normalize()` と `path.resolve()` でパス検証を追加

#### 改善案
```typescript
import path from 'path';

// パス妥当性チェック関数を追加
function isValidPath(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  const resolved = path.resolve(process.cwd(), normalized);

  // パストラバーサル検出（../が含まれている場合）
  if (normalized.includes('..')) {
    return false;
  }

  // 絶対パスへの逆行を検出
  return resolved.startsWith(process.cwd());
}

// バリデーション追加
const validatedFiles = affectedFiles.filter(f => isValidPath(f));
const validatedDirs = affectedDirs.filter(d => isValidPath(d));
```

---

### 2. record-test-result.ts

#### ✅ 安全な実装
- **入力バリデーション**: `exitCode` の型チェックが厳密（行44-49）
- **データ型制御**: 数値型のみを許可、文字列は拒否

```typescript
// 型安全なバリデーション
if (typeof exitCode !== 'number') {
  return {
    success: false,
    message: 'exitCodeは数値で指定してください',
  };
}
```

#### ✅ セキュリティ上安全
- JSON生成時に安全な値のみを使用（行57-62）
- タイムスタンプは `new Date().toISOString()` で自動生成
- ユーザー入力の `summary` は オプション項目として扱い、エスケープされていないが影響最小

#### ⚠️ 軽微な検出項目
- **サマリー文字列の長さ制限なし（低度）**: ログ肥大化のリスク

#### 改善案
```typescript
// 長さ制限を追加
const MAX_SUMMARY_LENGTH = 500;

const summary = (typeof summary === 'string' && summary.length > 0)
  ? summary.substring(0, MAX_SUMMARY_LENGTH)
  : undefined;
```

---

### 3. back.ts

#### ✅ セキュリティ上安全
- **フェーズ名検証**: ホワイトリスト方式で有効なフェーズのみを許可（行51）
- **インデックス検証**: フェーズの前後関係を正確に検証（行59-66）
- **タイムスタンプ生成**: サーバーサイドで自動生成

```typescript
// ホワイトリスト方式
if (!phases.includes(targetPhase as PhaseName)) {
  return {
    success: false,
    message: `不正なフェーズ名: ${targetPhase}`,
  };
}

// 前後関係チェック
const currentIndex = getPhaseIndex(fromPhase, taskSize);
const targetIndex = getPhaseIndex(targetPhase as PhaseName, taskSize);

if (targetIndex >= currentIndex) {
  return {
    success: false,
    message: `差し戻し先フェーズは現在のフェーズ（${fromPhase}）より前である必要があります`,
  };
}
```

#### ⚠️ 検出項目なし
セキュリティ上の重大な問題は検出されませんでした。

---

### 4. spec-parser.ts

#### ✅ セキュリティ上安全
- **ReDoS対策**: 正規表現が十分に最適化されている
- **コードブロック除去**: サンプルコード内の悪意あるパターンを除外（行48-49）

```typescript
// 効率的な正規表現パターン
function removeCodeBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, '');
}
```

#### ✅ 詳細分析
各正規表現パターンを分析：

| パターン | 説明 | リスク判定 |
|---------|------|----------|
| `/class\s+(\w+)\s*[:{]/g` | クラス定義抽出 | 安全 |
| `/interface\s+(\w+)/g` | インターフェース抽出 | 安全 |
| `/type\s+(\w+)\s*=/g` | 型定義抽出 | 安全 |
| `/enum\s+(\w+)/g` | enum定義抽出 | 安全 |
| `/(?:def\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*[{=]/g` | メソッド抽出 | 安全 |
| `/(?:export\s+)?function\s+([A-Z]\w+)/g` | React関数コンポーネント抽出 | 安全 |
| `/`(src\/[^\s`]+)`/g` | ファイルパス抽出 | 安全 |

**ReDoS評価**:
- バックトラック可能性は低い
- 量指定子が制限されている
- キャプチャグループが明確で効率的

#### ✅ 安全機構
- コードブロック内のコンテンツを先に除去
- 抽出後の重複チェック（配列に追加前）

---

### 5. check-workflow-artifact.js

#### ✅ セキュリティ上の強み
- **パス正規化**: `path.normalize()` と `path.join()` で安全なパス操作（複数箇所）
- **ホワイトリスト方式**: CHECK_TARGET_PHASES で許可フェーズのみをチェック（行54）
- **JSON解析の安全性**: `JSON.parse()` のエラーハンドリング（行865）

```typescript
// パス正規化の例
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

// パス結合時の安全性
const fullExpectedPath = normalizePath(path.join(process.cwd(), expectedPath));
```

#### ⚠️ 検出項目（パストラバーサル攻撃の潜在的リスク）

**【高度なパストラバーサル攻撃検出】**

Line 265: `extractTaskNameFromDir()` で正規表現を使用したディレクトリ名抽出

```javascript
const WORKFLOW_DIR_PATTERN = /^\d{8}_\d{6}_(.+)$/;

function extractTaskNameFromDir(workflowDir) {
  const dirName = path.basename(workflowDir);  // ← path.basename() で保護
  const match = dirName.match(WORKFLOW_DIR_PATTERN);
  return match ? match[1] : null;
}
```

**リスク分析**:
- `path.basename()` が使用されているため、パストラバーサル(`../`) は防止できる
- ただし、タスク名に悪意あるパターンが含まれる可能性

**具体的な攻撃シナリオ**:
```
タスク名: `../../sensitive-file.md`
→ path.basename() により `../../sensitive-file.md` が抽出される
→ toKebabCase() により `-sensitive-file-md` に変換される
→ パスが `/docs/spec/diagrams/-sensitive-file-md.state-machine.mmd` となる
```

#### Line 277-287: `toKebabCase()` 関数の正規表現分析

```javascript
function toKebabCase(str) {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[\s\/]+/g, '-')
    .replace(/[^a-z0-9\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
}
```

**ReDoS リスク**:
- 第5行の除去パターン: `/[^a-z0-9\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g`
- **評価**: 安全 - 否定文字クラスは効率的

#### Line 318: `inferSpecMmdPath()` のパス推測

```javascript
function inferSpecMmdPath(workflowDir, mmdFileName) {
  const mmdType = extractMmdType(mmdFileName);

  // 1. log.md から仕様書パスを取得して、同じディレクトリに配置
  const specPath = extractSpecPathFromLogMd(workflowDir);
  if (specPath) {
    return buildMmdPathFromSpec(specPath, mmdType);  // ← ここが危険
  }
  // ...
}
```

**⚠️ 高度な脆弱性検出**

Line 338-341: `buildMmdPathFromSpec()` 関数

```javascript
function buildMmdPathFromSpec(specPath, mmdType) {
  const specDir = path.dirname(specPath);  // ← パストラバーサルの可能性
  const specBaseName = path.basename(specPath, '.md');
  return normalizePath(path.join(specDir, `${specBaseName}.${mmdType}.mmd`));
}
```

**具体的な攻撃例**:
```
log.md の内容に以下を含める:
  "仕様書: docs/spec/features/../../sensitive-config.md"

実行フロー:
  1. extractSpecPathFromLogMd() → "docs/spec/features/../../sensitive-config.md"
  2. path.dirname() → "docs/spec/features/.."
  3. path.join() → "docs/spec/features/../{mmdType}.mmd"
  4. 最終パス: "docs/spec/sensitive-config.state-machine.mmd"
     → 意図しないディレクトリへのファイル配置
```

**判定**: path.join() と path.dirname() のみでは不十分

#### Line 196-207: `extractSpecPathFromLogMd()` の正規表現リスク

```javascript
const SPEC_PATH_PATTERNS = [
  /##\s*仕様書[\s\S]*?(docs\/spec\/features\/[^\s\n]+\.md)/,
  /仕様書:\s*(docs\/spec\/features\/[^\s\n]+\.md)/,
  /(docs\/spec\/features\/[^\s\n)]+\.md)/,
];
```

**分析**:
- パターン3の `[^\s\n)]+` は十分に制限されているが、パストラバーサルを完全には防ぐことができない
- 例: `docs/spec/features/../../malicious.md` にマッチする

---

## セキュリティリスク評価

### 【レベル1: 高度な脆�バーサル攻撃（中度リスク）】

**ファイル**: `check-workflow-artifact.js`
**問題**: 複合的なパストラバーサル攻撃が可能

**攻撃フロー**:
```
step1: log.md に悪意あるパスを記載
  仕様書: docs/spec/features/../../admin/config.md

step2: extractSpecPathFromLogMd() が抽出
  → "docs/spec/features/../../admin/config.md"

step3: buildMmdPathFromSpec() で正規化されない部分パスが利用される
  → path.dirname("docs/spec/features/../../admin/config.md")
    = "docs/spec/features/../.."
  → path.join()で解決されないまま使用される可能性

step4: 最終的に意図しないパスが生成される
```

**改善案**:
```javascript
function buildMmdPathFromSpec(specPath, mmdType) {
  // 1. 絶対パスに変換
  const absoluteSpecPath = path.resolve(process.cwd(), specPath);

  // 2. ホワイトリスト内にあるか確認
  const specBaseDir = path.resolve(process.cwd(), 'docs/spec/features');
  if (!absoluteSpecPath.startsWith(specBaseDir)) {
    return null; // パストラバーサル検出
  }

  // 3. 安全なパスのみを返す
  const specDir = path.dirname(absoluteSpecPath);
  const specBaseName = path.basename(absoluteSpecPath, '.md');
  const mmdPath = path.join(specDir, `${specBaseName}.${mmdType}.mmd`);

  // 4. 再度検証
  const absoluteMmdPath = path.resolve(process.cwd(), mmdPath);
  if (!absoluteMmdPath.startsWith(specBaseDir)) {
    return null; // 生成パスが仕様ディレクトリ外
  }

  return normalizePath(mmdPath);
}
```

### 【レベル2: 機密情報のログ出力（低度リスク）】

**ファイル**: `check-workflow-artifact.js` - Line 686-691

```javascript
function printMmdErrors(errors) {
  const mmdErrors = errors.filter(e => e.type === ERROR_TYPES.MMD_NOT_SYNCED);
  if (mmdErrors.length === 0) return;

  console.log('【未反映の図ファイル】');
  for (const error of mmdErrors) {
    console.log(`  ソース: ${error.source}`);    // ← パス情報出力
    console.log(`  反映先: ${error.expected}`);  // ← パス情報出力
    console.log('');
    console.log('  実行コマンド:');
    console.log(`  ${error.action}`);            // ← cp コマンド実行例
```

**リスク**:
- エラー出力にファイルパスが含まれる
- ログが外部に流出した場合、ディレクトリ構造が露出される可能性

**改善案**:
```javascript
function printMmdErrors(errors) {
  const mmdErrors = errors.filter(e => e.type === ERROR_TYPES.MMD_NOT_SYNCED);
  if (mmdErrors.length === 0) return;

  console.log('【未反映の図ファイル】');
  for (const error of mmdErrors) {
    console.log(`  ソースファイル: [${path.basename(error.source)}]`);
    console.log(`  反映先: [${path.basename(error.expected)}]`);
    console.log('');
    console.log('  対処方法: docs/spec/ ディレクトリを確認してください');
```

### 【レベル3: JSON解析のエラーハンドリング（低度リスク）】

**ファイル**: `check-workflow-artifact.js` - Line 865

```javascript
try {
  const input = JSON.parse(inputData);
  main(input);
} catch (e) {
  process.exit(0);  // ← エラーを無視して終了
}
```

**リスク**:
- 悪形式のJSON入力でもプロセスが正常終了する
- ログに記録されないため、デバッグが困難

**改善案**:
```javascript
try {
  const input = JSON.parse(inputData);
  main(input);
} catch (e) {
  logError('JSON解析エラー', e.message, e.stack);
  process.exit(1);  // エラーコード1で終了
}
```

---

## セキュリティベストプラクティスの遵守状況

| ベストプラクティス | 遵守状況 | 備考 |
|------------------|--------|------|
| 入力バリデーション | ✅ 良好 | TypeScriptの型定義で型安全性を確保 |
| パストラバーサル対策 | ⚠️ 部分的 | `path.basename()` 使用だが、ディレクトリ走査時に脆弱性あり |
| SQLインジェクション | N/A | データベースクエリなし |
| コマンドインジェクション | ✅ 安全 | シェルコマンド実行なし |
| 認証・認可 | ✅ 良好 | タスクIDベースのアクセス制御 |
| エラー情報漏洩 | ⚠️ 注意 | ログ出力にパス情報を含む |
| JSON解析エラー処理 | ⚠️ 改善推奨 | エラーを無視する実装 |
| タイムスタンプ管理 | ✅ 安全 | サーバーサイド生成 |
| 機密データ保護 | ✅ 良好 | 機密情報の暗号化なし（必要に応じて追加） |

---

## 修正優先度

### 【優先度1: 高い】
- ✅ `check-workflow-artifact.js` のパストラバーサル脆弱性を修正
- ✅ `buildMmdPathFromSpec()` で絶対パス検証を追加

### 【優先度2: 中程度】
- ✅ エラーメッセージのパス情報を削減
- ✅ ログ出力の機密情報フィルタリング
- ✅ JSON解析エラーハンドリングの改善

### 【優先度3: 低い】
- ✅ `set-scope.ts` でパス妥当性検証を追加（オプション）
- ✅ `record-test-result.ts` でサマリー長を制限（オプション）

---

## 修正コード例

### 修正1: パストラバーサル対策（check-workflow-artifact.js）

```javascript
/**
 * .mmd ファイルの反映先パスを推測（セキュア版）
 */
function inferSpecMmdPath(workflowDir, mmdFileName) {
  const mmdType = extractMmdType(mmdFileName);

  // 1. log.md から仕様書パスを取得
  const specPath = extractSpecPathFromLogMd(workflowDir);
  if (specPath) {
    const safePath = buildMmdPathFromSpecSecure(specPath, mmdType);
    if (safePath) return safePath;
  }

  // 2. タスク名から推測（fallback）
  const taskName = extractTaskNameFromDir(workflowDir);
  if (taskName) {
    return buildMmdPathFromTaskName(taskName, mmdType);
  }

  return null;
}

/**
 * 仕様書パスから .mmd ファイルパスを構築（セキュア版）
 */
function buildMmdPathFromSpecSecure(specPath, mmdType) {
  try {
    // ホワイトリスト: 許可するベースディレクトリ
    const ALLOWED_BASE_DIRS = [
      'docs/spec/features/',
      'docs/spec/diagrams/',
    ];

    // 絶対パスに変換（../を解決）
    const absoluteSpecPath = path.resolve(process.cwd(), specPath);
    const allowedPath = path.resolve(process.cwd(), 'docs/spec');

    // パストラバーサル攻撃を検出
    if (!absoluteSpecPath.startsWith(allowedPath)) {
      console.warn(`警告: パストラバーサルが検出されました: ${specPath}`);
      return null;
    }

    // ベースネーム抽出
    const specDir = path.dirname(absoluteSpecPath);
    const specBaseName = path.basename(absoluteSpecPath, '.md');
    const mmdPath = path.join(specDir, `${specBaseName}.${mmdType}.mmd`);

    // 生成パスの再検証
    const absoluteMmdPath = path.resolve(process.cwd(), mmdPath);
    if (!absoluteMmdPath.startsWith(allowedPath)) {
      console.warn(`警告: 生成されたパスが許可範囲外です: ${mmdPath}`);
      return null;
    }

    return normalizePath(path.relative(process.cwd(), absoluteMmdPath));
  } catch (e) {
    return null;
  }
}
```

### 修正2: エラーメッセージの安全化

```javascript
function printMmdErrors(errors) {
  const mmdErrors = errors.filter(e => e.type === ERROR_TYPES.MMD_NOT_SYNCED);
  if (mmdErrors.length === 0) return;

  console.log('【未反映の図ファイル】');
  for (const error of mmdErrors) {
    // フルパスではなく、ファイル名のみを表示
    const sourceFileName = path.basename(error.source);
    const expectedFileName = path.basename(error.expected);

    console.log(`  ファイル: ${sourceFileName}`);
    console.log(`  配置先: docs/spec/diagrams/`);
    console.log('');
    console.log('  対処方法: 上記ファイルを docs/spec/diagrams/ にコピーしてください');
    console.log('');
  }
}
```

---

## テスト推奨事項

### セキュリティテストケース

```javascript
describe('パストラバーサル対策', () => {
  test('../を含むパスを拒否する', () => {
    const maliciousPath = 'docs/spec/features/../../sensitive.md';
    const result = buildMmdPathFromSpecSecure(maliciousPath, 'state-machine');
    expect(result).toBeNull();
  });

  test('docs/spec外のパスを拒否する', () => {
    const outsidePath = '/etc/passwd';
    const result = buildMmdPathFromSpecSecure(outsidePath, 'flowchart');
    expect(result).toBeNull();
  });

  test('正常なパスを受け入れる', () => {
    const validPath = 'docs/spec/features/valid-feature.md';
    const result = buildMmdPathFromSpecSecure(validPath, 'state-machine');
    expect(result).not.toBeNull();
    expect(result).toContain('docs/spec/features');
  });
});
```

---

## 結論

### 全体評価: YELLOW（改善推奨）

**強み**:
- TypeScriptによる型安全性が確保されている
- ホワイトリスト方式のバリデーションが実装されている
- JSON解析で基本的なエラーハンドリングがある

**弱み**:
- パストラバーサル攻撃に対して複層的な防御が不足している
- エラーメッセージにディレクトリ構造情報が露出する可能性
- JSON解析エラーが無視される実装

**推奨アクション**:
1. `check-workflow-artifact.js` の `buildMmdPathFromSpec()` を修正（優先度1）
2. エラーメッセージから機密情報を削除（優先度2）
3. JSON解析エラーハンドリングを改善（優先度2）
4. 本番環境への展開前にセキュリティレビューを実施

---

## 附録: 脆弱性スコア

CVSS v3.1 に基づく評価：

| 脆弱性 | スコア | 説明 |
|--------|--------|------|
| パストラバーサル（複合） | 5.5 | 中程度 - リモートコード実行の直接的リスクはないが、ファイルの不正配置が可能 |
| ログ情報漏洩 | 3.7 | 低い - パス情報露出、攻撃難度は高い |
| エラーハンドリング不備 | 2.1 | 低い - デバッグ困難化のみ |

**総合CVSS Score: 4.2（中程度）**

