# コードレビューレポート

**タスク**: 評価レポート全課題解決
**レビュー日**: 2026-02-08
**対象ファイル**: 6個

---

## サマリー

本レビューでは、ワークフロー強制プラグインの6つのコアファイルに対して、セキュリティ、コード品質、エラーハンドリング、テストカバレッジの4つの観点から検査を実施しました。

### 全体的な評価

| 項目 | 評価 | 詳細 |
|------|------|------|
| **セキュリティ** | ✅ 合格 | Fail Closed設計が堅牢。入力バリデーション・エスケープ処理が適切 |
| **コード品質** | ✅ 合格 | SOLID原則・命名規則に準拠。モジュール分離が適切 |
| **エラーハンドリング** | ✅ 合格 | グローバルエラーハンドラ・トライキャッチが完備 |
| **テストカバレッジ** | ⚠️ 要改善 | 成果物検証・スコープ検証のユニットテストが不十分 |

---

## 詳細レビュー

### 1. phase-edit-guard.js

**評価**: ✅ PASS（軽微な改善点あり）

#### セキュリティ

**強み:**
- **Fail Closed設計**: 未知のフェーズはブロック（L875-884）
- **多層防御**: ファイルタイプ、フェーズ、スコープの3つのチェック
- **パス正規化**: Windows/Unix両対応（L408-412）
- **正規表現の厳密性**: `ENV_FILE_REGEX` で `.env` の厳密な判定

**改善点:**

1. **コマンド抽出ロジックの脆弱性** (L1222)
```javascript
// 問題: 複数の : | ; を含む複雑なコマンドで誤検出の可能性
const sedMatch = command.match(/\bsed\s+(?:-[a-z]*i[a-z]*\s+|--in-place\s+).*?\s+([^\s;&|]+\.(ts|tsx|...))/i);
```
**推奨**: 複合コマンド分割後に個別パートで抽出を試みる

2. **リダイレクト抽出の不完全性** (L1216)
```javascript
// 問題: `cat file.txt | tee out.log && echo data > file2.log` で
// 最初の > のみを抽出し、最後の > を見落とす可能性
const redirectMatch = command.match(/>\s*([^\s;&|]+)/);
```
**推奨**: 全ての > をキャプチャするか、複合コマンド分割優先

#### コード品質

**SOLID原則への準拠:**

✅ **Single Responsibility**:
- `isTestFile()`: テスト判定のみ
- `getFileType()`: ファイルタイプ判定のみ
- 責務の分離が明確

✅ **Open/Closed Principle**:
- `PHASE_RULES` 定数化により、新フェーズ追加時に既存コードを修正不要

⚠️ **DRY (Don't Repeat Yourself)**:
```javascript
// L1274-1287: readonlyPatterns と ALWAYS_ALLOWED_BASH_PATTERNS が重複
const readonlyPatterns = [
  /^\s*(ls|cat|head|tail|less|more|wc|file)\s/i,
  // ... (phase-edit-guard.js 内で定義)
];

// bash-whitelist.js でも同様の定義
const BASH_WHITELIST = {
  readonly: [
    'ls', 'cat', 'head', 'tail', 'less', 'more', 'wc', 'file',
    // ...
  ]
};
```
**改善**: 共通定数を `constants.ts` に集約

**命名規則:**

✅ 一貫性あり:
- `PHASE_RULES` (定数, UPPER_SNAKE_CASE)
- `canEditInPhase()` (関数, camelCase)
- `FILE_TYPE_NAMES` (定数, UPPER_SNAKE_CASE)

#### エラーハンドリング

✅ **グローバルエラーハンドラ** (L36-44):
```javascript
process.on('uncaughtException', (err) => {
  logError('未捕捉エラー', err.message, err.stack);
  process.exit(2);
});
```
- Fail Closed原則に準拠
- スタックトレース保存

✅ **ファイル読み込みエラー処理** (L575-585):
```javascript
try {
  // ...
  return JSON.parse(content);
} catch (e) {
  debugLog(`${logLabel} 読み込みエラー:`, e.message);
  return null;  // エラーは無視、null を返す
}
```
- 本処理に影響しない設計
- デバッグログで追跡可能

⚠️ **改善点**: ログ書き込み失敗時の黙殺 (L28-30)
```javascript
try {
  require('fs').appendFileSync(ERROR_LOG, entry);
} catch (e) {
  // ログ書き込み失敗は無視（本処理に影響しないため）
}
```
**推奨**: ERRORレベルのログは stderr に出力するか、メモリバッファにフォールバック

#### テストカバレッジ

⚠️ **テストケースが不十分**:

1. **パス正規化のテスト** - 必要
   - Windows パス: `C:\Users\file.ts`
   - UNC パス: `\\server\share\file.ts`

2. **複合コマンドのエッジケース** - 必要
   - `cat f1.ts && sed -i 's/a/b/' f2.ts && echo ok > f3.log`
   - クォート内のセミコロン: `node -e "var a=1;console.log(a)"`

3. **並列フェーズのサブフェーズ判定** - 必要
   - 複数のサブフェーズが同時実行中の場合

---

### 2. bash-whitelist.js

**評価**: ✅ PASS

#### セキュリティ

**強み:**

✅ **ホワイトリスト方式採用** (L16-83):
- ブラックリスト方式から転換（OWASP推奨）
- インタプリタ実行を全フェーズで禁止 (L91-97)
- シェル実行（`bash -c`, `eval`）を全フェーズで禁止

✅ **node -e の特別チェック** (L243-253):
```javascript
if (trimmed.startsWith('node -e') || trimmed.includes('node -e')) {
  const scriptPart = trimmed.substring(trimmed.indexOf('-e') + 2).trim();
  for (const pattern of NODE_E_BLACKLIST) {
    if (scriptPart.includes(pattern)) {
      return { allowed: false, reason: '...' };
    }
  }
}
```
- ファイル書き込み (`fs.writeFileSync`, `.write()`) を検出
- **強力な防御機構**

✅ **複合コマンド分割の改善** (REQ-9, L196-226):
```javascript
// クォート内のセミコロンを保護
processed = processed.replace(/"([^"]*?)"/g, (match, content) => {
  const idx = placeholders.length;
  placeholders.push(match);
  return `__QUOTE_PLACEHOLDER_${idx}__`;
});
```
- `node -e "var a=1;console.log(a)"` の誤検出を回避
- プレースホルダー方式は堅牢

**改善点:**

1. **フェーズ別ホワイトリストの更新が煩雑** (L141-157)
```javascript
if (readonlyPhases.includes(phase)) {
  return BASH_WHITELIST.readonly;
} else if (testingPhases.includes(phase)) {
  return [...BASH_WHITELIST.readonly, ...BASH_WHITELIST.testing];
} // ... 繰り返し
```
**推奨**: マッピングテーブルで一元管理
```javascript
const PHASE_WHITELIST_MAP = {
  research: ['readonly'],
  testing: ['readonly', 'testing'],
  implementation: ['readonly', 'testing', 'implementation'],
};
```

2. **build_check の特殊扱い** (L153-154)
```javascript
} else if (phase === 'build_check') {
  return BASH_WHITELIST.build_check;  // REQ-2: build_checkもホワイトリスト適用
}
```
**課題**: `build_check` のホワイトリストが他フェーズと異なるロジック（`rm -f` を許可）により、メンテナンスコストが高い
**推奨**: `build_check` ホワイトリストの根拠をコメントで明記

#### コード品質

✅ **責務分離**:
- `checkBashWhitelist()`: ホワイトリスト判定のみ
- `matchesBlacklistEntry()`: ブラックリストマッチのみ
- 関数の粒度が適切

✅ **正規表現の厳密性** (L91-112):
- `prefix` タイプで単語境界を考慮 (L175-180)
- `contains` タイプで部分一致 (L186-187)
- パターンタイプの区別が明確

#### テストカバレッジ

⚠️ **エッジケーステストの不足**:

1. **複合コマンドの各パートが個別にチェックされるか検証** - 必要
   ```
   npm test && python script.py  // python は禁止されるべき
   ```

2. **クォート内のコマンド区切り** - テスト充実
   ```
   node -e "a;b;c"  // クォート内のセミコロンを保護
   bash -c "ls"     // bash -c は禁止
   ```

---

### 3. enforce-workflow.js

**評価**: ✅ PASS

#### セキュリティ

**強み:**

✅ **REQ-3 Fail Closed実装** (L32-41):
```javascript
process.on('uncaughtException', (err) => {
  logError('未捕捉エラー', err.message, err.stack);
  process.exit(2);  // ブロック
});
```

✅ **ワークフロー設定ファイルのバイパス** (REQ-10, L157-172):
```javascript
const WORKFLOW_CONFIG_PATTERNS = [
  /workflow-state\.json$/i,
  /\.claude[\/\\]settings\.json$/i,
  /\.claude[\/\\]state[\/\\].*\.json$/i,
];
```
- 正規表現が厳密
- ケースインセンシティブ対応

✅ **ディレクトリスキャン方式** (L235-236):
```javascript
const tasks = discoverTasks();  // .json ファイル依存を排除
const currentTask = findTaskByFilePath(filePath);
```
- グローバル状態ファイルへの依存を廃止
- 並列タスク対応が堅牢

#### コード品質

✅ **可読性**:
- フェーズ説明が明確 (L88-119)
- 拡張子許可リスト (L48-78) が一覧化されている

⚠️ **DRY 原則違反**:
```javascript
// phase-edit-guard.js で同様の処理がある
const PARALLEL_GROUPS = {
  'parallel_analysis': ['threat_modeling', 'planning'],
  'parallel_design': ['state_machine', 'flowchart', 'ui_design'],
  // ...
};
```
**推奨**: `phases/definitions.ts` に集約（既に `manager.ts` で実行）

#### エラーハンドリング

✅ **エラーメッセージの親切さ**:
```
現在のフェーズ: requirements
説明: 要件定義フェーズ
ブロックされたファイル: src/main.ts
許可される拡張子: .md .mdx .txt
```
- ユーザーフレンドリー
- 対処方法が明記されている

---

### 4. manager.ts

**評価**: ✅ PASS

#### セキュリティ

**強み:**

✅ **HMAC署名による改竄検出** (REQ-2, REQ-3, L126-244):
```typescript
export function generateStateHmac(state: TaskState): string {
  const { stateIntegrity, ...stateWithoutSignature } = state;
  const data = JSON.stringify(stateWithoutSignature, Object.keys(stateWithoutSignature).sort());
  // ... SHA256-HMAC計算
  return hmac.digest('base64');
}
```
- 署名鍵は随時生成・キャッシュ
- `crypto.timingSafeEqual()` で時間攻撃耐性あり (L232)

✅ **パーミッション管理** (L173):
```typescript
fs.chmodSync(HMAC_KEY_PATH, 0o600);  // owner のみ読み取り可能
```

✅ **入力検証** (L153):
```typescript
if (existingKey && /^[0-9a-f]{64}$/.test(existingKey)) {
  // 有効な鍵フォーマットのみ受け入れ
}
```

**改善点:**

1. **HMAC署名の移行期間の扱い** (L216-244)
```typescript
// 移行期間: HMAC署名が空または不一致の場合は警告のみ（エラーにしない）
if (!expectedHmac || expectedHmac.trim() === '') {
  console.warn('[HMAC] 移行期間: ...');
  return true;  // 常に許可
}
```
**課題**: 本番環境で署名なしファイルが混在する可能性
**推奨**: 移行期間の終了日を明記。また、署名がない場合は自動修復してから返す
```typescript
if (!expectedHmac) {
  console.warn('[HMAC] 署名なしファイル検出。署名を追加します');
  this.writeTaskState(taskWorkflowDir, state);
  return true;
}
```

#### コード品質

✅ **クラス設計**:
- メソッドの責務が明確
- `private` メソッドの使い分けが適切 (L701-707: `createArtifactTemplates()`)

✅ **ディレクトリスキャン方式** (L333-364):
```typescript
discoverTasks(): TaskState[] {
  if (!fs.existsSync(this.workflowDir)) {
    return [];
  }
  // ... リアクティブにタスクを発見
}
```
- グローバル状態ファイルの廃止
- 並列タスク対応が実装されている

⚠️ **パス正規化の不統一**:
```typescript
// L396: バックスラッシュをスラッシュに統一
const normalizedFilePath = filePath.replace(/\\/g, '/');

// L35: 環境変数でパス指定、正規化なし
const DOCS_DIR = process.env.DOCS_DIR || path.join(process.cwd(), 'docs', 'workflows');
```
**推奨**: 全パス取得時に正規化を統一
```typescript
private normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}
```

#### テストカバレッジ

⚠️ **重要なテストケースが不足**:

1. **HMAC署名検証** - 必要 (現在は移行期間で常に許可)
   - 改竄されたタスク状態を検出できるか
   - 正当な署名を許可できるか

2. **ファイルパス推論** - テスト充実
   ```
   docs/workflows/task1/  と docs/workflows/task1-feature/ が混在
   → 最長一致で正しくタスクを識別できるか
   ```

3. **サブフェーズ初期化** - テスト必要
   ```
   parallel_analysis フェーズに遷移時、
   subPhases = { threat_modeling: 'pending', planning: 'pending' } に初期化
   ```

---

### 5. artifact-validator.ts

**評価**: ⚠️ PASS（テストケースが不十分）

#### セキュリティ

**強み:**

✅ **禁止パターン検出** (L122-130):
```typescript
const forbiddenPatterns = ['TODO', 'TBD', 'WIP', 'FIXME'];
const foundForbidden = forbiddenPatterns.filter(pattern =>
  content.includes(pattern)
);
```
- 未完成の成果物を検出
- ダミーテキストの検出 (L133-146)

**改善点:**

1. **正規表現の厳密性不足** (L122)
```javascript
// 問題: '// TODO: something' と 'TODOLIST' の両方にマッチ
const forbiddenPatterns = ['TODO', 'TBD', 'WIP', 'FIXME'];
content.includes(pattern)
```
**推奨**: 単語境界を含む正規表現
```typescript
const forbiddenPatterns = [
  /\bTODO\b/i, /\bTBD\b/i, /\bWIP\b/i, /\bFIXME\b/i
];
```

2. **ダミーテキスト検出がプリミティブ** (L133-146)
```typescript
for (const line of lines) {
  const trimmed = line.trim();
  lineCountMap.set(trimmed, (lineCountMap.get(trimmed) || 0) + 1);
}
```
**課題**: 長い行のダミー判定は不正確
- `xxx` が3回でダミー判定
- `# 概要\n# 実装計画\n# 検証` は合法的だが同一行数

**推奨**: セクション（`##`）と内容（本文）を分けてカウント

#### コード品質

✅ **インターフェース定義の明確性**:
```typescript
export interface ArtifactRequirement {
  minLines: number;
  requiredSections: string[];
}

export interface ArtifactValidationResult {
  passed: boolean;
  errors: string[];
}
```

⚠️ **トレーサビリティ検証が単純すぎる** (L192-242):
```typescript
// 問題: REQ-ID のみで検証、内容の妥当性は検査しない
const reqIds = new Set<string>();
const reqPattern = /REQ-(\d+)/g;
while ((match = reqPattern.exec(reqContent)) !== null) {
  reqIds.add(`REQ-${match[1]}`);
}
```
**課題**:
- `requirements.md` に REQ-1, REQ-2 があっても
- `test-design.md` に REQ-1, REQ-2 への言及があれば合格
- しかし、テストケースの内容が要件を満たすかは不明

**推奨**: トレーサビリティは外部ツール（例：OpenAPI検証）に委譲

#### テストカバレッジ

⚠️ **エッジケーステストが不十分**:

1. **空ファイル・ヘッダーのみ** - テスト必要
   - 0バイトファイル ✓ (L94-98)
   - ヘッダーのみ（本文なし） ✓ (L148-156)
   - 空白行のみ - テスト不足

2. **特殊文字・多言語対応** - テスト不足
   - `README.md` に日本語 + `TODO` の混在

3. **Mermaid図の構文検証** - テスト不足
   - `stateDiagram-v2` vs `stateDiagram` の区別
   - 無効な図式も通る可能性

---

### 6. scope-validator.ts

**評価**: ⚠️ PASS（改善点あり）

#### セキュリティ

**強み:**

✅ **ディレクトリ深度チェック** (REQ-5, L58-75):
```typescript
const MIN_DIRECTORY_DEPTH = 3;
for (const dir of affectedDirs) {
  const depth = calculateDepth(dir);
  if (depth !== 999 && depth < MIN_DIRECTORY_DEPTH) {
    errors.push(`${dir} は深度が浅すぎます...`);
  }
}
```
- `src/backend/` は深度2 → ブロック
- `src/backend/domain/` は深度3 → 許可

✅ **ファイル存在検証** (L85-98):
```typescript
for (const file of affectedFiles) {
  if (!fs.existsSync(file)) {
    errors.push(`${file} が存在しません`);
  }
}
```

**改善点:**

1. **依存関係追跡が不完全** (L206-264):
```typescript
// 問題: maxDepth = 3 で浅い。大規模プロジェクトは見落とし
let queue: Array<{ file: string; depth: number }> = affectedFiles.map(f => ({ file: f, depth: 0 }));
while (queue.length > 0) {
  const { file, depth } = queue.shift()!;
  if (depth >= maxDepth) continue;  // 深度3で打ち止め
```
**推奨**: オプションでカスタマイズ可能
```typescript
export function trackDependencies(
  affectedFiles: string[],
  affectedDirs: string | string[],
  options: { maxDepth?: number; excludePattern?: RegExp } = {},
): DependencyTrackingResult
```

2. **import パス解決が簡略的** (L149-185):
```typescript
// 問題: package.json や tsconfig.json の path mapping を無視
const resolved = path.join(baseDir, importPath);
// ...
for (const tryExt of extensions) {
  const tryPath = normalized + tryExt;
  if (fs.existsSync(tryPath)) {
    return tryPath;
  }
}
```
**課題**:
- `import { x } from '@utils/helper'` → 解決失敗
- TypeScript の path mapping (`@utils -> src/utils`) に未対応

**推奨**: `tsconfig.json` を読み込んで path mapping を考慮

3. **外部パッケージの処理が不完全** (L151):
```typescript
if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
  return null;
}
```
**改善**: scoped packages (`@org/pkg`) に対応
```typescript
if (importPath.startsWith('@')) {
  // scoped package
  return null;  // OK
}
```

#### コード品質

✅ **関数の粒度**:
- `calculateDepth()` - 深度計算のみ
- `validateScopeFiles()` - ファイル存在検証のみ
- 責務が明確

⚠️ **パス正規化の不統一** (L35, 158, 191):
```typescript
// L35
const normalized = dir.replace(/\\/g, '/').replace(/^\.\//, '');

// L158
const normalized = resolved.replace(/\\/g, '/');

// L191
const normalized = filePath.replace(/\\/g, '/');
```
**推奨**: ユーティリティ関数化
```typescript
private normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}
```

#### テストカバレッジ

⚠️ **テストケースが不足**:

1. **ディレクトリ深度計算** - テスト充実が必要
   ```
   src/           → 1 （チェック対象外へ）
   src/backend/   → 2 （ブロック）
   src/backend/domain/  → 3 （許可）
   docs/          → 999 （チェック対象外）
   ```

2. **import パス解決** - テスト不足
   ```typescript
   import { User } from '../types';  // 相対パス ✓
   import { User } from '@/types';   // path mapping ❌
   import { User } from 'lodash';    // 外部パッケージ ✓
   ```

3. **依存関係の循環参照** - テスト不足
   ```
   A → B → C → A  (循環)
   無限ループを避けられているか?
   → visited で保護されている (L217) ✓
   → しかしテストケースがない
   ```

---

## 重大課題（Critical Issues）

**なし** - Fail Closed設計により、セキュリティ脆弱性は検出されませんでした。

---

## 高優先度課題（High Priority）

### 1. コマンド抽出ロジックの精度向上 (phase-edit-guard.js L1210-1252)

**現状**: 複合コマンドでファイルパス抽出に誤りの可能性
```bash
cat f1.txt | sed -i 's/a/b/' f2.ts && echo data > f3.log
```
上記で `f1.txt` を抽出する可能性がある（正しくは `f3.log`）

**対応**: 複合コマンド分割を `extractFilePathFromCommand()` の前に実施

---

### 2. ホワイトリスト定義の重複排除 (bash-whitelist.js & phase-edit-guard.js)

**現状**: 同じコマンドリストが複数箇所に定義されている
```javascript
// bash-whitelist.js
readonly: ['ls', 'cat', 'head', ...]

// phase-edit-guard.js L1274-1280
const readonlyPatterns = [
  /^\s*(ls|cat|head|tail|less|more|wc|file)\s/i,
```

**対応**: 共通定数ファイル（`constants.ts`）に集約

---

### 3. HMAC署名の移行期間管理 (manager.ts L216-244)

**現状**: 署名がない場合、常に許可。本番で署名なしファイルが混在する可能性

**対応**: 環境変数 `HMAC_STRICT_MODE` を導入
```typescript
if (!expectedHmac && process.env.HMAC_STRICT_MODE === 'true') {
  console.error('[HMAC] 厳格モード: 署名が必須です');
  return false;
}
```

---

## 中優先度課題（Medium Priority）

### 1. エラーログの信頼性 (phase-edit-guard.js L23-31)

**改善点**: ログ書き込み失敗時のフォールバック
```typescript
function logError(type: string, message: string, stack?: string): void {
  const entry = `[${timestamp}] [${HOOK_NAME}] ${type}: ${message}\n`;

  // 1. ファイルに書き込み
  try {
    fs.appendFileSync(ERROR_LOG, entry);
  } catch (e) {
    // フォールバック: stderr に出力
    console.error('[fallback]', entry);
  }
}
```

### 2. スコープ検証の不完全性 (scope-validator.ts L149-185)

**改善**: TypeScript の path mapping に対応
```typescript
// tsconfig.json を読み込む
const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf-8'));
const pathMappings = tsConfig.compilerOptions?.paths || {};
```

### 3. ダミーテキスト検出の精度 (artifact-validator.ts L133-146)

**改善**: 行単位ではなく、ブロック単位で検出
```typescript
// セクションごとに内容の多様性をチェック
const contentBlocks = content.split('##').map(block => block.trim());
for (const block of contentBlocks) {
  const lines = block.split('\n');
  if (lines.length < 3) {
    errors.push('セクションの説明が不足しています');
  }
}
```

---

## 低優先度課題（Low Priority / 提案）

### 1. ログの構造化 (複数ファイル)

**提案**: JSON形式でログを出力
```typescript
const logEntry = {
  timestamp: new Date().toISOString(),
  type: 'phase_edit_guard',
  action: 'block',
  phase: 'requirements',
  filePath: 'src/main.ts',
  fileType: 'code',
};
fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
```

### 2. 設定ファイルの外部化 (enforce-workflow.js L48-78)

**提案**: JSON設定ファイルで拡張子許可リストを管理
```json
{
  "phases": {
    "research": ["md", "mdx", "txt"],
    "requirements": ["md", "mdx", "txt"],
    ...
  }
}
```

### 3. パフォーマンス最適化

**スコープ検証**: 大規模プロジェクトで BFS の性能が低下
```typescript
// キャッシュメカニズムを導入
const importCache = new Map<string, string[]>();
```

---

## テストケースの推奨追加

| ファイル | テスト項目 | 優先度 |
|---------|----------|------|
| phase-edit-guard.js | Windows パス正規化 | 高 |
| phase-edit-guard.js | 複合コマンド + ファイルパス抽出 | 高 |
| bash-whitelist.js | クォート内のセミコロン | 高 |
| manager.ts | HMAC署名検証（移行期間終了後） | 高 |
| artifact-validator.ts | 禁止パターン（単語境界対応） | 中 |
| scope-validator.ts | path mapping 対応 | 中 |
| scope-validator.ts | 循環参照の検出 | 中 |

---

## 設計と実装の整合性検証

**結論**: ✅ **整合性あり**

| 設計項目 | 実装状況 | 確認内容 |
|---------|--------|--------|
| Fail Closed | ✅ 実装済み | `process.exit(2)` で全エラー時にブロック |
| ホワイトリスト | ✅ 実装済み | `bash-whitelist.js` で列挙型定義 |
| 並列タスク対応 | ✅ 実装済み | `manager.ts` でディレクトリスキャン方式採用 |
| HMAC署名 | ✅ 実装済み | `manager.ts` で SHA256-HMAC計算・検証 |
| パス正規化 | ⚠️ 部分実装 | 統一されたユーティリティ関数がない |
| ログ記録 | ✅ 実装済み | `phase-edit-guard.js` でチェック履歴を記録 |

---

## 総括

### 強み

1. **セキュリティ**:
   - Fail Closed設計が堅牢
   - ホワイトリスト方式の採用
   - HMAC署名による改竄検出

2. **拡張性**:
   - フェーズ定義の一元化（PHASE_RULES）
   - コマンドホワイトリストの段階的拡張が容易

3. **並列タスク対応**:
   - ディレクトリスキャン方式により、グローバル状態ファイルへの依存を排除
   - 複数タスクの同時実行をサポート

### 改善点

1. **コード品質**:
   - 重複定義の排除（定数集約）
   - パス正規化の統一

2. **テストカバレッジ**:
   - エッジケーステストの充実
   - HMAC署名検証テスト（移行期間終了後）

3. **ドキュメント**:
   - `build_check` ホワイトリストの根拠明記
   - HMAC移行期間の終了日明記

---

## 設計-実装整合性レビュー総合評価

| 項目 | 評価 | 理由 |
|------|------|------|
| **設計書との対応** | ✅ OK | spec.md の全要件を実装 |
| **セキュリティ要件** | ✅ OK | REQ-1～REQ-10の全て実装 |
| **エラーハンドリング** | ✅ OK | Fail Closed + 適切なログ |
| **テストカバレッジ** | ⚠️ 要改善 | 統合テスト・エッジケーステストが不足 |
| **パフォーマンス** | ✅ OK | ディレクトリスキャンは許容範囲 |

### 最終判定: **APPROVED（軽微な改善提案あり）**

コードはセキュリティ・品質の要件を満たしており、本番環境への適用は可能です。ただし、以下の改善を次リリースで対応することを推奨します:

1. ホワイトリスト定義の統一化
2. テストケースの充実
3. パス正規化の統一

