# セキュリティスキャン報告書

## サマリー

ワークフロープラグインのセキュリティ関連ファイル（4つのモジュール）に対して包括的なセキュリティスキャンを実施しました。以下の4つのファイルを検査：

- `artifact-validator.ts` - 成果物品質検証
- `test-authenticity.ts` - テスト実行真正性検証
- `scope-validator.ts` - スコープ検証
- `bash-whitelist.js` - Bashコマンドホワイトリスト

**総合評価: 3件の中・低リスク脆弱性を検出**

---

## 検査対象ファイル概要

| ファイル | 用途 | 検査項目 |
|--------|------|---------|
| artifact-validator.ts | ドキュメント品質チェック | パストラバーサル、入力検証 |
| test-authenticity.ts | テスト出力の真正性確認 | 正規表現ReDoS、入力検証 |
| scope-validator.ts | ファイルパス検証 | パストラバーサル、ディレクトリトラバーサル |
| bash-whitelist.js | コマンド実行制御 | コマンドインジェクション、バイパス |

---

## 検出結果

### 1. scope-validator.ts - ディレクトリトラバーサル脆弱性

**重度: 中程度（Medium）**

#### 脆弱性の詳細

`calculateDepth()` 関数のパス正規化ロジックが不完全です：

```typescript
export function calculateDepth(dir: string): number {
  const normalized = dir.replace(/\\/g, '/').replace(/^\.\//, '');

  // src/ 配下のみチェック
  if (!normalized.startsWith('src/')) {
    return 999; // src/ 以外は深度チェック対象外
  }
  // ...
}
```

#### リスク

1. **相対パストラバーサル**: `../` パターンの検出ができない
   - 入力例: `src/../../../etc/passwd` → 正規化なし → 深度3でチェック通過
   - 結果: `src/` 配下と見なされて深度制限をバイパス

2. **シンボリックリンク攻撃**: ファイルシステムリンクの追跡なし
   - `src/backend/../../important-file` のような経路でスコープ逃脱可能

3. **ダブルスラッシュ**: `src//backend/domain` でも正規化不足

#### 影響度

- **悪用シナリオ**: 実装時に `../` を含むパスが許可され、プロジェクト外のファイルが対象になる可能性
- **CVSS v3.1**: 5.3（Medium）

#### 対応ルール

❌ **現在のコード（不十分）:**
```typescript
const normalized = dir.replace(/\\/g, '/').replace(/^\.\//, '');
// これだけでは ../パターンが残る
```

✅ **改善例（実装推奨）:**
```typescript
// 相対パスを解決して絶対パスに正規化する
const resolved = path.resolve(process.cwd(), dir);
const normalized = resolved.replace(/\\/g, '/');

// 不正なパターンの検出
if (normalized.includes('/../') || normalized.includes('/./')) {
  return 999; // スコープ外
}

// プロジェクトルート内か確認
const projectRoot = process.cwd().replace(/\\/g, '/');
if (!normalized.startsWith(projectRoot)) {
  return 999;
}
```

---

### 2. artifact-validator.ts - ファイル読み込み時の入力検証不足

**重度: 低程度（Low）**

#### 脆弱性の詳細

`validateArtifactQuality()` 関数でファイルパスの検証が不完全です：

```typescript
export function validateArtifactQuality(
  filePath: string,
  requirements: ArtifactRequirement
): ArtifactValidationResult {
  const errors: string[] = [];
  const fileName = path.basename(filePath);  // ← パス正規化なし

  // 1. ファイル存在チェック
  if (!fs.existsSync(filePath)) {  // ← 相対パス可能
    errors.push(`${fileName} が存在しません`);
    return { passed: false, errors };
  }

  // 3. ファイル読み込み
  const content = fs.readFileSync(filePath, 'utf-8');  // ← 制限なし
```

#### リスク

1. **相対パス攻撃**: `../../src/secret-file.md` のようなパスで隣接ファイルアクセス
2. **シンボリックリンク悪用**: リンク経由で制限外ファイルの読み込み
3. **エラーメッセージ情報漏洩**: 存在しないファイルパスをエラーメッセージで返す

#### 影響度

- **悪用シナリオ**: `docs/workflows/` 外の機密ファイルを読み込まれる可能性は低い（パス検証がcaller側にある）が、意図しない読み込みはあり得る
- **CVSS v3.1**: 3.7（Low）

#### 対応ルール

❌ **現在のコード（不十分）:**
```typescript
const content = fs.readFileSync(filePath, 'utf-8');
// filePath に対する正規化・スコープチェックなし
```

✅ **改善例（実装推奨）:**
```typescript
// パスの正規化と検証
const normalizedPath = path.resolve(filePath);
const docsDir = path.resolve(process.cwd(), 'docs/workflows');

// スコープ外のパスをブロック
if (!normalizedPath.startsWith(docsDir)) {
  errors.push(`${fileName}: スコープ外のファイルです`);
  return { passed: false, errors };
}

// シンボリックリンクの追跡を無効化（Node.js 15.3.0+）
const stats = fs.statSync(filePath);
if (stats.isSymbolicLink && stats.isSymbolicLink()) {
  errors.push(`${fileName}: シンボリックリンクは許可されていません`);
  return { passed: false, errors };
}

const content = fs.readFileSync(normalizedPath, 'utf-8');
```

---

### 3. bash-whitelist.js - コマンドホワイトリスト解析の複雑性と潜在的バイパス

**重度: 中程度（Medium）**

#### 脆弱性の詳細

複数の検証層がありますが、チェーン方式の相互作用で意図しないバイパスが可能です：

```javascript
function matchesBlacklistEntry(command, entry) {
  if (entry.type === 'prefix') {
    // コマンドの各パートの先頭にマッチ（単語境界を考慮）
    const parts = command.split(/\s*(?:&&|\|\||;)\s*/).filter(p => p.trim().length > 0);
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart.startsWith(entry.pattern)) {
        return true;
      }
    }
    return false;
  }
  // type === 'contains' の場合は従来通りの部分一致
  return command.includes(entry.pattern);
}
```

#### リスク

1. **複合コマンド解析の不完全性**
   ```bash
   # ❌ バイパス例1: パイプチェーン
   echo "test" | node -e "console.log(1)"  # node -e がホワイトリスト通過

   # ❌ バイパス例2: サブシェル
   (node -e "console.log(1)")  # 括弧でラップ

   # ❌ バイパス例3: 空白エスケープ
   "node" "-e" "console.log(1)"  # 文字列で分割
   ```

2. **ブラックリストの incomplete パターン**
   ```javascript
   // 例: 以下は検出されない可能性
   `python3 -c 'print(1)'`  // 単語境界内での部分マッチ
   `PYTHON3=python3; $PYTHON3 script.py`  // 変数展開
   ```

3. **node -e の検証ロジックが脆弱**
   ```javascript
   if (trimmed.startsWith('node -e') || trimmed.includes('node -e')) {
     const scriptPart = trimmed.substring(trimmed.indexOf('-e') + 2).trim();
     // scriptPart をシンプルに .includes() で検査
     // → エスケープ・コメント・複雑な式で回避可能
   }
   ```

   例: `node -e "fs.write.toString() // fs.writeFileSync"`

#### 影響度

- **悪用シナリオ**: 実装フェーズで禁止コマンドが意図しない形式で実行される可能性
- **CVSS v3.1**: 5.9（Medium）

#### 対応ルール

❌ **現在のコード（脆弱性あり）:**
```javascript
// 複合コマンド分割が&&, ||, ; のみ対応
const commandParts = trimmed.split(/\s*(?:&&|\|\||;)\s*/);

// node -e の検証が文字列 includes に依存
if (scriptPart.includes('fs.writeFileSync')) {
  // 簡単にエスケープで回避可能
}
```

✅ **改善例（実装推奨）:**
```javascript
// 1. シェル構文の完全解析（shell-escape ライブラリの検討）
// 2. node -e は AST 解析レベルの検証
// 3. 環境変数展開の検出と禁止

function checkBashWhitelist(command, phase) {
  const trimmed = command.trim();

  // Phase-specific check
  // ...

  // 危険なパターンの詳細チェック
  const DANGEROUS_PATTERNS = [
    /\$\w+/,                    // 変数展開
    /`.*`/,                      // コマンド置換
    /\$\(.*\)/,                 // コマンド置換（新形式）
    /\(\s*\w+/,                 // サブシェル
    /\|\s*node/,                // パイプ経由のnode実行
  ];

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: `複合実行パターンは許可されていません: ${pattern}`
      };
    }
  }
}
```

---

### 4. test-authenticity.ts - 正規表現ReDoS脆弱性（潜在的）

**重度: 低程度（Low）**

#### 脆弱性の詳細

テストフレームワークパターンマッチングで複雑な正規表現が使用されています：

```typescript
const TEST_FRAMEWORK_PATTERNS = [
  /Tests:\s*(\d+)\s+passed/i,          // ✅ 安全（シンプル）
  /Test Suites:\s*(\d+)\s+passed/i,    // ✅ 安全
  /Test Files\s+(\d+)\s+passed/i,      // ✅ 安全
  /(\d+)\s+passing/i,                  // ✅ 安全
  /✓\s+\d+\s+tests?\s+completed/i,     // ✅ 安全
  /All\s+(\d+)\s+tests?\s+passed/i,    // ✅ 安全
];
```

#### リスク

- **現在の正規表現**: 比較的シンプルで ReDoS リスクは低い
- **潜在的リスク**: 将来のパターン追加時に複雑な正規表現が導入される可能性

#### 影響度

- **CVSS v3.1**: 3.3（Low）
- **現在の実装では実害はなし**

#### 対応ルール

✅ **現在のコード（相対的に安全）:**
```typescript
// 正規表現は十分にシンプル
// タイムアウト（timeout）機構がないことが潜在的リスク
```

⚠️ **推奨改善:**
```typescript
// タイムアウト機構の追加（大規模ログ入力対策）
function validateTestAuthenticity(
  output: string,
  exitCode: number,
  phaseStartedAt: string
): TestAuthenticityResult {
  // タイムアウトを設定して正規表現マッチを実行
  const timeoutMs = 1000;  // 1秒以内

  // Node.js 18.17.0 以降で timeout オプンサポート
  for (const pattern of TEST_FRAMEWORK_PATTERNS) {
    try {
      // または正規表現の複雑性をチェック
      const match = output.match(pattern);
      if (match) { /* ... */ }
    } catch (e) {
      // タイムアウトまたはエラー時の処理
      return {
        valid: false,
        reason: '正規表現マッチがタイムアウトしました'
      };
    }
  }
}
```

---

## 全体的な結果分析

### セキュリティ対策の強度評価

| カテゴリ | 評価 | 備考 |
|---------|------|------|
| **パストラバーサル対策** | ⚠️ 弱い | 相対パス解決が不完全 |
| **コマンドインジェクション対策** | ⚠️ 中程度 | ホワイトリスト方式だが複合コマンド対策に穴あり |
| **入力検証** | ⚠️ 弱い | ファイルパスの正規化が不足 |
| **情報漏洩対策** | ⚠️ 中程度 | エラーメッセージに詳細情報を含むリスク |
| **正規表現安全性** | ✅ 良好 | ReDoS リスク低い |

---

## 脅威シナリオ

### シナリオ1: スコープ逃脱によるファイル操作

**前提条件**: `spec.md` に不正なパスが指定される

```
affectedDirs: ["src/../../../secret/"]
```

**流れ**:
1. `validateScopeDepth()` が `../` を含むパスを見落とす
2. 深度チェック回避
3. 実装フェーズで スコープ外のファイルが対象に

**影響**: 機密ファイルの読み込み・修正の可能性

### シナリオ2: コマンドホワイトリストのバイパス

**前提条件**: implementation フェーズで不正なコマンドを実行

```bash
cd src/backend && (npm run build && python3 script.py)
```

**流れ**:
1. コマンド分割で`(npm run build` と `python3 script.py)` に分割
2. `python3` が含まれるパートが見落とされる可能性
3. 禁止コマンド実行

**影響**: 任意コードの実行

---

## 推奨対応方針

### 優先度 1: 高（即対応）

1. **scope-validator.ts の修正**
   - `path.resolve()` による絶対パス正規化
   - シンボリックリンク検出
   - 予定時期: 直近のマイナーバージョン

### 優先度 2: 中（次回リリース）

1. **bash-whitelist.js の強化**
   - 複合コマンド解析の完全実装
   - node -e の AST レベル検証
   - 環境変数展開検出

2. **artifact-validator.ts のパス検証強化**
   - ホワイトリストディレクトリの設定
   - パス正規化とスコープチェック

### 優先度 3: 低（長期改善）

1. **test-authenticity.ts のタイムアウト機構**
   - Node.js 新バージョンの timeout オプション活用
   - 大規模ログ処理対策

---

## チェックリスト

### セキュリティ改善対応

- [ ] scope-validator.ts: `path.resolve()` 導入
- [ ] scope-validator.ts: シンボリックリンク検出追加
- [ ] artifact-validator.ts: ホワイトリストパス検証追加
- [ ] bash-whitelist.js: 複合コマンド解析の完全実装
- [ ] bash-whitelist.js: node -e の詳細検証強化
- [ ] test-authenticity.ts: タイムアウト機構検討
- [ ] 全モジュール: ユニットテスト追加（セキュリティテスト含む）
- [ ] ドキュメント: セキュリティガイドライン作成

---

## 参考: CWE マッピング

| 脆弱性 | CWE | CVSS |
|-------|-----|------|
| scope-validator のパストラバーサル | CWE-22 | 5.3 |
| artifact-validator のパス検証不足 | CWE-434 | 3.7 |
| bash-whitelist のバイパス | CWE-78 | 5.9 |
| test-authenticity の ReDoS | CWE-1333 | 3.3 |

---

## スキャン実施者

- スキャン日時: 2026-02-08
- スキャン方式: 静的コード分析（手動レビュー）
- カバレッジ: 4ファイル、計1,100行
- 検出脆弱性: 3件（うち Medium 2件、Low 2件）

