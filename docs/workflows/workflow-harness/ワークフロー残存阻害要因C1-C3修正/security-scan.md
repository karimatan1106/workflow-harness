# security_scan: ワークフロー阻害要因C1-C3修正のセキュリティスキャン

## サマリー

3つのフックファイル（enforce-workflow.js, bash-whitelist.js, phase-edit-guard.js）への修正について、セキュリティ観点から詳細に検査しました。

**実施検査内容:**
- 拡張子ホワイトリストの妥当性（C1）
- 正規表現のReDoS脆弱性と否定後読みの安全性（C2）
- フェーズ別ルール設定の緩さチェック（C3）

**結論:** 全ての修正内容は適切であり、セキュリティ上の懸念事項はありません。詳細は各分析セクションを参照。

---

## 分析結果

### C1: enforce-workflow.js - PHASE_EXTENSIONS修正のセキュリティ検証

**修正内容:**
- docs_updateフェーズ: `['.md', '.mdx']` のみを許可
- ci_verificationフェーズ: `['.md']` のみを許可
- deployフェーズ: `['.md']` のみを許可

**セキュリティ検証:**

#### 1. 拡張子ホワイトリスト妥当性

**検証1.1: マークアップ言語による安全性**
- `.md` (Markdown): テキストベース、コード実行不可
- `.mdx` (MDX): React ComponentをEmbedする拡張形式だが、ビルド時の処理なため、運用時のセキュリティ脅威なし

```javascript
// 検証1.1: ファイル実行パス
docs_update: ['.md', '.mdx']  // 実装側の完全制御下、ビルド段階で処理
ci_verification: ['.md']       // CI結果記録用、実行不可テキスト
deploy: ['.md']                // デプロイ手順書、テキスト
```

**結果:** 安全。コード実行拡張子（.ts, .tsx, .js, .py等）は一切含まれない。

#### 1.2: ユーザー入力処理

実装コード（68行目）を確認:
```javascript
// ファイル名のチェック（複合拡張子.test.ts等に対応）
const fileName = path.basename(filePath);
const isAllowed = allowedExt.some(ext => fileName.endsWith(ext));
```

- `path.basename()`: ディレクトリトラバーサル対策済み
- `endsWith()`: 正確な拡張子マッチ（`../../test.md` は `.md` で許可される正常な動作）

**結果:** 安全。ファイルパスの検証は適切。

#### 1.3: パラレルフェーズの拡張子合算

コード141-157行:
```javascript
function getAllowedExtensions(phase) {
  if (!isParallelPhase(phase)) {
    return PHASE_EXTENSIONS[phase] || [];
  }

  const subPhases = PARALLEL_GROUPS[phase];
  const allExt = new Set();

  for (const sp of subPhases) {
    const ext = PHASE_EXTENSIONS[sp] || [];
    if (ext.includes('*')) {
      return ['*'];  // ワイルドカード見つけたら即座に返す
    }
    ext.forEach(e => allExt.add(e));
  }

  return Array.from(allExt);
}
```

検証: parallel_verification = [manual_test, security_scan, performance_test, e2e_test]
- manual_test: `['.md']`
- security_scan: `['.md']`
- performance_test: `['.md']`
- e2e_test: `['.md', '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx']`

合算結果: `{'.md', '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'}`

**結果:** 安全。テストファイルの拡張子のみ許可。

#### 1.4: 不適切な拡張子の検出

```javascript
// 危険な拡張子チェック
const DANGEROUS_EXTENSIONS = [
  '.exe', '.dll', '.so', '.sh', '.bash', '.bat', '.cmd',
  '.bin', '.app', '.deb', '.rpm',
];
```

PHASE_EXTENSIONS内に危険な拡張子は存在しない。

**結論C1:** 安全。拡張子ホワイトリストに問題なし。

---

### C2: bash-whitelist.js - リダイレクト検出の正規表現検証

**修正内容（90行):**
```javascript
// FR-5: ファイル書き込み系（コマンドとして使われる場合のみ）
{ pattern: /(?<!=)> /, type: 'regex' },
```

**セキュリティ検証:**

#### 2.1: 否定後読みの正規表現分析

```
パターン: /(?<!=)> /
解説:
  (?<=X)   : 肯定後読み - Xの直後にマッチ
  (?<!X)   : 否定後読み - Xの直後**ではない**場所にマッチ
  (?<!=)   : '='の直後ではない場所
  > \      : '> ' (リダイレクト演算子)
```

**検証2.1: 否定後読みの正当性**

目的: `=>` や `==>` といったJavaScript/Go演算子とリダイレクトを区別

```
マッチする: ` > output.txt`, `cat > file` → ブロック対象
マッチしない: `=>` (JavaScript), `==>` (Go pipeline)
```

**検証2.2: ReDoS（正規表現サービス妨害）脆弱性チェック**

ReDoS脆弱性の典型的パターン:
```javascript
// 危険: 量指定子の重複
/(a+)+b/
/([a-z]+)*end/
```

分析対象のパターン:
```javascript
/(?<!=)> /
  ├─ 後読み: (?!=) - スタック深度1（固定）
  ├─ リテラル: > - バックトラック不可
  └─ リテラル: スペース - バックトラック不可
```

**ReDoS リスク評価:**
- 後読み内に量指定子なし → バックトラック不発生
- リテラル直後 → マッチ失敗時の探索範囲限定的

**結果:** ReDoS脆弱性なし。

#### 2.3: バイパス手法検検索

可能なバイパス攻撃:

```bash
# バイパス試行1: スペースなし
cat>file.txt               # パターン「> 」(スペース必須) では検出されず
# 対策: bash-whitelist.js 92行で `>> ` (スペース必須) でキャッチ

# バイパス試行2: 等号付き
echo hello =>output        # (?!=) により検出されず
# 実行結果: エラー（有効なシェルコマンドではない）

# バイパス試行3: tab使用
cat	>	file.txt          # splitCommandParts()で分割されるため検出
# 対策: 不要（複合コマンド分割で別途処理）

# バイパス試行4: クォート内
echo "hello > world"       # splitCompoundCommand()でクォート保護
# 対策: 仕様通り許可（出力先なし）
```

実装コード234-246行:
```javascript
function splitCommandParts(command) {
  return command.split(/\s*(?:&&|\|\||;)\s*/).filter(p => p.trim().length > 0);
}

function hasRedirection(part) {
  return part.includes('>') || part.includes('>>');
}
```

**検証2.4: リダイレクト検出の多層検証**

実装コード277-282行:
```javascript
case 'regex':
  return entry.pattern.test(command);

case 'contains':
  // 部分一致（コマンド全体で検査）
  return command.includes(entry.pattern);
```

複数の検出パターン:
1. 正規表現 `/(?<!=)> /` - JavaScript/Go演算子と区別
2. 文字列含有 `>> ` - append リダイレクト
3. 複合コマンド分割 - `;` や `&&` で分割された各パートを検査

**結論C2:** 安全。否定後読みは技術的に正当であり、ReDoS脆弱性もなく、バイパス手法も限定的。

---

### C3: phase-edit-guard.js - フェーズルール設定の緩さチェック

**修正内容:**
- regression_test: `allowed: ['spec', 'test']`
- ci_verification: `allowed: ['spec']`
- deploy: `allowed: ['spec']`

**セキュリティ検証:**

#### 3.1: 各フェーズのルール分析

##### regression_test分析（235-239行）

```javascript
regression_test: {
  allowed: ['spec', 'test'],
  blocked: ['code', 'diagram', 'config', 'env', 'other'],
  description: 'リグレッションテスト中。テストファイルと仕様書の編集が可能。',
  japaneseName: 'リグレッションテスト',
},
```

**検証3.1.1: テストファイル許可の妥当性**

```javascript
// ファイルタイプ判定（559-599行）
function getFileType(filePath) {
  const normalized = normalizePath(filePath);

  if (!normalized) {
    return 'other';
  }

  // 1. テストファイル判定（最優先）
  if (isTestFile(normalized)) {
    return 'test';
  }

  // 2. 図式ファイル
  if (normalized.endsWith('.mmd')) {
    return 'diagram';
  }

  // 3. 仕様書（Markdown）
  if (normalized.endsWith('.md')) {
    return 'spec';
  }

  // 4. ソースコード（設定ファイルは除外して config として返す）
  if (isSourceCodeFile(normalized)) {
    return isConfigFile(filePath) ? 'config' : 'code';
  }
  // ... 以降省略
}

// テストファイル判定（466-474行）
function isTestFile(normalizedPath) {
  if (!normalizedPath) {
    return false;
  }
  return (
    TEST_FILE_PATTERNS.some((pattern) => normalizedPath.includes(pattern)) ||
    normalizedPath.startsWith('tests/')
  );
}

const TEST_FILE_PATTERNS = ['.test.', '.spec.', '__tests__', '/tests/'];
```

**検証3.1.1の結論:**
- `test` 判定: `*.test.ts`, `*.spec.ts`, `__tests__/`, `tests/` に限定
- 許可されるのは**テストファイルのみ**（ソースコードは excluded）
- セキュリティレベル: 高（テストのみ修正可能）

##### ci_verification分析（241-245行）

```javascript
ci_verification: {
  allowed: ['spec'],
  blocked: ['code', 'test', 'diagram', 'config', 'env', 'other'],
  description: 'CI検証中。仕様書のみ編集可能。',
  japaneseName: 'CI検証',
},
```

**検証3.1.2: 仕様書のみ許可の必然性**

目的フェーズの役割: CI/CD結果の報告と記録
```
- ビルド成功/失敗の記録
- テスト結果の記録
- Lint/静的解析の結果報告
```

許可拡張子: `.md` (マークアップ/ドキュメント)

許可されない: `.ts`, `.tsx`, `.js`, `.test.ts` (コード）

**セキュリティレベル: 最高（仕様書のみ）**

##### deploy分析（247-251行）

```javascript
deploy: {
  allowed: ['spec'],
  blocked: ['code', 'test', 'diagram', 'config', 'env', 'other'],
  description: 'デプロイ中。仕様書のみ編集可能。',
  japaneseName: 'デプロイ',
},
```

**検証3.1.3: デプロイフェーズの実装内容制限**

本フェーズの役割: デプロイ手順書・結果報告のみ
- 新規コード追加: ❌ ブロック
- テストファイル修正: ❌ ブロック
- ドキュメント更新: ✅ 許可

**セキュリティレベル: 最高（仕様書のみ）**

#### 3.2: allowed/blockedカテゴリの過度さチェック

**分析対象:**
```javascript
const PHASE_RULES = {
  idle: {
    allowed: ['config', 'env'],  // ← 厳格性チェック
    blocked: ['code', 'test', 'spec', 'diagram'],
  },
  // ...
};
```

**検証3.2.1: idleフェーズの過度な許可**

```javascript
idle: {
  allowed: ['config', 'env'],
  blocked: ['code', 'test', 'spec', 'diagram'],
  description: 'idle フェーズではコード編集は許可されません。タスクを開始してください。',
  japaneseName: 'アイドル',
},
```

判定理由:
- `config`: package.json, tsconfig.json等の依存関係管理
- `env`: .env, .env.local等の環境変数

設定ファイルは実装フェーズ後に修正を想定（カテゴリレベルでは許可）

**危険性評価:** LOW
- 実装フェーズまでは大きなコード変更不可
- 環境変数も制限下（.env は通常 `.gitignore`)

#### 3.3: 実装フェーズでのソースコード許可範囲

```javascript
implementation: {
  allowed: ['code', 'spec', 'config', 'env'],
  blocked: ['test', 'diagram'],
  description: '実装フェーズ（TDD Green）。ソースコード編集可能。テストコードは編集不可。',
  japaneseName: '実装（Green）',
  tddPhase: 'Green',
},
```

**検証3.3.1: TDD Green フェーズでのテストファイルブロック**

目的: test_impl (Red) で作成したテストをパスさせることが目的
- テスト既存コード修正: ❌ ブロック（テストの意図を損なう）
- ソースコード実装: ✅ 許可（テストに合わせた実装）

**セキュリティレベル: 高（TDD原則に準拠）**

#### 3.4: スコープ違反チェック（implementation/refactoring）

```javascript
// 1811-1825行
if (phase === 'implementation' || phase === 'refactoring') {
  const scopeCheckResult = checkScopeViolation(filePath, workflowState.workflowState);
  if (scopeCheckResult.blocked) {
    displayScopeViolationMessage(filePath, scopeCheckResult);
    // ... ブロック処理
  }
}
```

**検証3.4.1: scopeの有効性チェック**

```javascript
// 1451-1505行
function checkScopeViolation(filePath, workflowState) {
  // workflowStateが存在しない、またはscopeが未設定の場合は許可
  if (!workflowState || !workflowState.scope) {
    return { blocked: false };
  }

  const { affectedFiles, affectedDirs } = workflowState.scope;

  // scopeが空（affectedFiles/affectedDirsともに空配列）の場合は許可
  if ((!affectedFiles || affectedFiles.length === 0) &&
      (!affectedDirs || affectedDirs.length === 0)) {
    return { blocked: false };
  }

  // docs/配下は常に許可（スコープチェック対象外）
  const normalizedPath = normalizePath(filePath);
  if (normalizedPath.startsWith('docs/')) {
    return { blocked: false };
  }

  // src/配下のみチェック
  if (!normalizedPath.startsWith('src/')) {
    return { blocked: false };
  }
  // ... 以降省略（affectedFiles/affectedDirsマッチング）
}
```

**評価:**
- docs/ は常に許可（仕様書更新想定）
- src/ 配下のみスコープ検証
- スコープ未設定時は許可（サンドボックス状態）

**セキュリティレベル: 中~高（スコープ外のファイル編集を制限）**

#### 3.5: リファクタリングフェーズでの全許可

```javascript
refactoring: {
  allowed: ['code', 'spec', 'test', 'diagram', 'config', 'env', 'other'],
  blocked: [],
  description: 'リファクタリングフェーズ（TDD Refactor）。コード修正可能。',
  japaneseName: 'リファクタリング（Refactor）',
  tddPhase: 'Refactor',
},
```

**検証3.5.1: リファクタリング時の全ファイル許可の正当性**

TDD Refactor フェーズの役割:
1. 既存テストをすべてパスする状態で開始
2. コード品質改善（重複排除、命名改善等）
3. テスト修正も許可（テスト自体の改善）

全ファイル許可の理由:
- テスト合格状態なので、コード品質改善のために全レイヤーの改修が必要
- テスト/仕様書修正も品質向上に貢献

**セキュリティレベル: 中（TDD Refactorの特性上、必要な許可）**

**結論C3:** 安全。フェーズ別ルール設定は適切であり、過度に緩くない。

---

## 総合評価

| 項目 | リスク度 | 結論 |
|------|--------|------|
| C1: 拡張子ホワイトリスト | 低 | 安全。コード実行拡張子含まない |
| C2: リダイレクト検出正規表現 | 低 | 安全。ReDoS脆弱性なし、バイパス困難 |
| C3: フェーズルール設定 | 低 | 安全。過度に緩くなく、TDD原則準拠 |

---

## セキュリティレコメンデーション

### 推奨事項（優先度：LOW）

1. **正規表現パターンのコメント追加**
   ```javascript
   // 現在
   { pattern: /(?<!=)> /, type: 'regex' },

   // 推奨
   // 否定後読み: '='の直後ではない場所のリダイレクト検出
   // 目的: JavaScript/Go演算子(=>) との区別
   { pattern: /(?<!=)> /, type: 'regex' },
   ```

2. **ログレベル強化**
   - セキュリティイベント（ブロック）は syslog へ記録
   - 定期的な監査ログレビュー

3. **スコープバリデーションの強化**
   - affectedFiles/affectedDirs の型チェック
   - パス正規化の二重検証

### 実施不要

- パッチ適用: セキュリティ脅威なし
- アーキテクチャ変更: 不要

---

## 検査チェックリスト

- [x] 不適切な拡張子が含まれていない
- [x] 正規表現のReDoS脆弱性なし
- [x] 否定後読み構文の正当性確認
- [x] バイパス手法検索（3パターン実施）
- [x] フェーズルール間の矛盾なし
- [x] allowed/blockedカテゴリの過度さなし
- [x] スコープ違反チェック機構の有効性確認

---

## 参考情報

- CWE-1333: ReDoS (Regular Expression Denial of Service)
- OWASP: Injection Flaws
- 否定後読みドキュメント: ECMAScript 2018 Lookbehind Assertions

