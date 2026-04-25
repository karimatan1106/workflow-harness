# レビュー指摘6件の根本原因修正 - 調査結果

## サマリー

本調査では、workflow-pluginの厳格レビューで発見された6件の問題について、根本原因を追究し修正方針を策定しました。調査の結果、以下の根本的な設計課題が明らかになりました。

**主要な決定事項:**
1. **問題1（userIntent未埋込）**: subagentテンプレートにuserIntentフィールドがハードコードされておらず、後続フェーズでユーザー意図が希薄化する構造的欠陥を確認
2. **問題2（スコープ判定のみのスキップ）**: ユーザー明示指示を無視する設計により、「テストを書いて」指示が拡張子判定でスキップされる致命的問題
3. **問題3（AST解析非インクリメンタル）**: 毎回全ファイル再解析する設計により1000万行規模で性能破綻する構造的問題
4. **問題4（BFS依存解析非効率）**: 同期走査＋キャッシュなし設計により大規模プロジェクトでタイムアウトする根本問題
5. **問題5（全タスクスキャン）**: インデックスなしの全ディレクトリ走査により、タスク数増加に比例して性能劣化する設計欠陥
6. **問題6（fail-open設計）**: エラー時に操作を許可するfail-open原則により、CLAUDE.mdの安全原則と矛盾する根本的矛盾

**次フェーズで必要な情報:**
- 各問題の修正には、設計レベルの抜本的改修が必要（単純なパッチでは解決不可）
- 特に問題3-5は性能スケーラビリティの根本問題であり、インクリメンタル処理・キャッシング・インデックス化の導入が必須
- 問題6はセキュリティ原則の根本的見直しが必要

---

## 調査結果

本調査では、workflow-pluginの厳格レビューで発見された6件の問題について、ソースコードレベルで根本原因を追究した。
各問題の発生箇所、根本原因、設計上の欠陥、修正方針を以下に詳述する。
調査対象はmcp-server/src/配下のTypeScript（tools/next.ts, tools/start.ts, phases/definitions.ts, validation/design-validator.ts, validation/scope-validator.ts, state/manager.ts）と、hooks/配下のJavaScript（loop-detector.js）である。
全6件の問題は、データ層にはユーザー意図が保存されているにもかかわらずプレゼンテーション層で使用されていない「データ・ビュー分離の失敗」パターンと、全件走査・全件解析という「スケーラビリティ考慮の欠如」パターンに大別される。
問題6（fail-open）はセキュリティ原則の実装矛盾であり、他の5件とは性質が異なる。
各問題の詳細は以降のセクションで個別に記述する。

## 既存実装の分析

workflow-pluginは3層防御アーキテクチャ（MCPサーバー層、フック層、CLAUDE.md層）で構成されており、フェーズ遷移の強制、ファイル編集の制限、TDDサイクルの技術的強制が実現されている。
MCPサーバー層ではHMAC-SHA256による状態保護、セッショントークン認証、成果物品質検証が実装されている。
フック層ではphase-edit-guard.js（フェーズ別ファイル編集制限）、enforce-workflow.js（タスク存在強制）、loop-detector.js（無限ループ検出）、bash-whitelist.js（コマンドホワイトリスト）が連携して動作する。
CLAUDE.md層では19項目のAI厳命ルールが定義され、完了宣言ルール、テスト配置ルール、パッケージインストールルールが文書化されている。
既存実装の品質は中〜大規模プロジェクト（数十万行まで）では十分に機能するが、1000万行規模ではパフォーマンスボトルネックとユーザー意図伝搬の欠如が顕在化する。

---

## 問題1: subagentテンプレートにuserIntentが埋め込まれていない

workflow_startでTaskStateに記録されるuserIntentフィールドが、CLAUDE.mdのsubagent起動テンプレートに含まれていない。
start.ts（Line 38-42, 90）ではuserIntentを正しく保存しているが、テンプレート側に{userIntent}プレースホルダーが存在しない。
これはデータ層とプレゼンテーション層の連携失敗であり、データは保持されているが利用されていない典型的な設計欠陥である。
影響範囲は全19フェーズのうちsubagentを使用する全フェーズに及び、特にrequirements→planning→implementationの連鎖で意図が段階的に希薄化する。
修正方針としてはCLAUDE.mdテンプレートにuserIntentセクションを追加し、Orchestratorが各subagentに伝搬する構造にする必要がある。

### 現象
- ユーザーの具体的指示（「〜を実装する」「〜を修正する」等）が後続フェーズで希薄化する
- subagent起動時にuserIntentフィールドが参照されず、汎用的なテンプレート文のみが使用される

### 根本原因分析

#### コード調査結果

**1. workflow-plugin/CLAUDE.md（Line 193-248）**
```markdown
## subagent起動テンプレート

各フェーズでsubagentを起動する際は以下の形式を使用：

Task({
  prompt: `
    # {フェーズ名}フェーズ

    ## タスク情報
    - タスク名: {taskName}
    - 出力先: docs/workflows/{taskName}/

    ## 入力
    以下のファイルを読み込んでください:
    - {入力ファイルパス}

    ## 作業内容
    {フェーズの作業内容}
```

**問題点:**
- テンプレート内に `userIntent` フィールドが**完全に欠落**している
- `{taskName}` のみが埋め込まれ、ユーザーの具体的な意図（userIntent）が後続フェーズに引き継がれない
- 結果として、「PDF変換機能を実装して」という具体的指示が「タスク名」としてのみ認識され、詳細な意図が消失する

**2. workflow-plugin/mcp-server/src/tools/start.ts（Line 38-42, 90）**
```typescript
// ユーザー意図の処理（10000文字まで）
let processedUserIntent = userIntent;
if (processedUserIntent && processedUserIntent.length > 10000) {
  processedUserIntent = processedUserIntent.substring(0, 10000);
}
...
taskState.userIntent = processedUserIntent || nameValidation.value;
```

**確認事項:**
- start.ts側では `userIntent` を正しく `TaskState` に保存している
- しかし、CLAUDE.mdのsubagentテンプレートには `userIntent` を埋め込む記述が存在しない

#### 設計上の欠陥

**問題の本質:**
- TaskStateにはuserIntentフィールドが存在し、データ層では正しく保持されている
- しかし、subagent起動時のプロンプトテンプレート（CLAUDE.md）が、このuserIntentを参照・埋め込む構造になっていない
- 結果として、データは存在するが使用されない「データとビューの分離失敗」状態

**影響範囲:**
- 全19フェーズのうち、subagentを使用する全フェーズ（research除く）で影響
- 特に requirements → planning → implementation の連鎖で、ユーザー意図が段階的に希薄化する

### 修正方針

#### 1. CLAUDE.mdテンプレート修正
```markdown
## subagent起動テンプレート

Task({
  prompt: `
    # {フェーズ名}フェーズ

    ## タスク情報
    - タスク名: {taskName}
    - ユーザーの意図: {userIntent}  // ★追加★
    - 出力先: docs/workflows/{taskName}/
```

#### 2. テンプレート埋込ロジック実装
- Orchestratorが各フェーズでsubagent起動時に、`{userIntent}` プレースホルダーを `taskState.userIntent` で置換する
- 実装箇所: ワークフローオーケストレーター（現在は手動だが、自動化推奨）

#### 3. 検証方法
- requirements.mdに「ユーザーの意図: {具体的指示}」セクションが含まれることを確認
- 各フェーズの成果物に、初期のuserIntentが反映されているかを監査

---

## 問題2: フェーズスキップがスコープの拡張子ベース自動判定のみ

### 現象
- ユーザーが「テストを書いて」と明示的に指示しても、スコープの拡張子判定で test_impl がスキップされる
- ユーザー明示指示（userIntent）よりも、スコープのファイル拡張子が優先される設計

### 根本原因分析

#### コード調査結果

**1. workflow-plugin/mcp-server/src/phases/definitions.ts（Line 459-509）**
```typescript
export function calculatePhaseSkips(scope: { affectedFiles?: string[]; files?: string[] }): Record<string, string> {
  const files = scope.affectedFiles || scope.files || [];
  const phaseSkipReasons: Record<string, string> = {};

  // ファイルが空の場合はスキップ判定しない
  if (files.length === 0) {
    return phaseSkipReasons;
  }

  // 拡張子を抽出
  const extensions = files.map(f => {
    const match = f.match(/\.([^.]+)$/);
    return match ? match[1] : '';
  }).filter(Boolean);

  // コードファイルの拡張子
  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'];
  // テストファイルのパターン
  const testPatterns = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

  const hasCodeFiles = files.some(f => {
    const ext = f.split('.').pop() || '';
    return codeExtensions.includes(ext) && !testPatterns.test(f);
  });
  const hasTestFiles = files.some(f => testPatterns.test(f));

  // テストファイルがない場合
  if (!hasTestFiles) {
    phaseSkipReasons['test_impl'] = 'テストファイルが影響範囲に含まれないため';
  }
```

**問題点:**
- スコープのファイル拡張子**のみ**でスキップを判定している
- `userIntent` や `taskName` の内容を全く考慮していない
- 結果として、「テストを書いて」という明示的指示が**無視**される

**2. workflow-plugin/mcp-server/src/tools/next.ts（Line 398-408）**
```typescript
// REQ-C3: 動的フェーズスキップ判定（自動検出）
const phaseSkipReasons = calculatePhaseSkips(taskState.scope || {});

// REQ-B4/D-1: ユーザー指定のスキップフェーズをマージ
if (taskState.skippedPhases && taskState.skippedPhases.length > 0) {
  for (const phase of taskState.skippedPhases) {
    if (!phaseSkipReasons[phase]) {
      phaseSkipReasons[phase] = 'ユーザー指定（--skip-phases）';
    }
  }
}
```

**確認事項:**
- next.ts側では `calculatePhaseSkips()` の結果を**そのまま使用**している
- ユーザー指定のスキップフェーズ（`--skip-phases`）はマージされるが、**userIntentベースの判定は存在しない**

#### 設計上の欠陥

**問題の本質:**
- スキップ判定ロジックが「スコープのファイル拡張子」という**技術的指標のみ**に依存している
- ユーザーの**意図**（「テストを書く」「設計書を作る」等）を考慮するロジックが完全に欠落
- 結果として、「ユーザーが何をしたいか」ではなく「現在のファイル構成がどうか」でフェーズが決まる**逆転設計**

**影響範囲:**
- test_impl だけでなく、implementation、testing、regression_test も同様の問題を抱える
- ドキュメント編集タスク（.md のみのスコープ）で、ユーザーが「実装もする」と指示しても無視される

### 修正方針

#### 1. userIntentベースの判定追加
```typescript
export function calculatePhaseSkips(
  scope: { affectedFiles?: string[]; files?: string[] },
  userIntent?: string  // ★追加★
): Record<string, string> {
  const phaseSkipReasons: Record<string, string> = {};

  // ★ユーザー意図ベースのスキップ判定を優先★
  if (userIntent) {
    const intentLower = userIntent.toLowerCase();

    // 「テストを書く」明示がある場合、test_implをスキップしない
    if (intentLower.includes('テスト') || intentLower.includes('test')) {
      // test_implをスキップリストから除外（何もしない）
    } else {
      // 従来のスコープベース判定
      const hasTestFiles = files.some(f => testPatterns.test(f));
      if (!hasTestFiles) {
        phaseSkipReasons['test_impl'] = 'テストファイルが影響範囲に含まれないため';
      }
    }
  }
```

#### 2. 優先順位の明確化
1. **ユーザー明示指示** (`userIntent` の内容) - 最優先
2. **ユーザー指定スキップ** (`--skip-phases`) - 次優先
3. **スコープベース自動判定** (拡張子) - 最終フォールバック

#### 3. 検証方法
- userIntent に「テスト」が含まれる場合、test_impl が実行されることを確認
- スコープが .md のみでも、userIntent に「実装」があれば implementation が実行されることを確認

---

## 問題3: design-validatorのAST解析がインクリメンタルでない

### 現象
- 1000万行規模のプロジェクトで設計検証がタイムアウトする
- 毎回全ファイルをAST解析するため、スケールしない

### 根本原因分析

#### コード調査結果

**1. workflow-plugin/mcp-server/src/validation/design-validator.ts（Line 406-444）**
```typescript
private searchInFiles(patterns: RegExp[], filePaths: string[], identifierName?: string): boolean {
  for (const filePath of filePaths) {
    const fullPath = path.join(this.projectRoot, filePath);

    // FR-6: TypeScript/JavaScriptファイルの場合、AST解析を試行
    if (/\.(ts|tsx|js|jsx)$/.test(fullPath) && identifierName) {
      const startTime = Date.now();
      const astResult = analyzeTypeScriptFile(fullPath);  // ★毎回全解析★
      const elapsed = Date.now() - startTime;

      if (elapsed > 50) {
        console.warn(`[Design Validator] AST analysis took ${elapsed}ms for ${filePath}`);
      }
```

**問題点:**
- `analyzeTypeScriptFile()` を**毎回呼び出し**ている
- ファイルの内容が変更されていなくても、同じファイルを何度も解析する
- TypeScript Compiler APIの `createProgram()` は重い処理（100KB/fileで10-50ms）

**2. キャッシング機構の欠如**
```typescript
private fileCache: Map<string, { content: string; cleanContent: string }> = new Map();

private readFileWithCache(fullPath: string): { content: string; cleanContent: string } | null {
  if (this.fileCache.has(fullPath)) {
    return this.fileCache.get(fullPath)!;
  }
  // ... ファイル読み込み
  this.fileCache.set(fullPath, entry);
  return entry;
}
```

**確認事項:**
- ファイル内容のキャッシュは存在する（`fileCache`）
- しかし、**AST解析結果のキャッシュは存在しない**
- 結果として、同じファイルを何度も読み込まないが、AST解析は毎回実行される

#### 設計上の欠陥

**問題の本質:**
1. **全ファイル再解析アプローチ**:
   - 検証のたびに全ファイルをAST解析する設計
   - 差分検証（変更されたファイルのみ解析）の概念が欠如

2. **AST解析結果のキャッシュなし**:
   - ファイル内容はキャッシュするが、解析結果（classes, functions, exports）はキャッシュしない
   - 同じファイルを複数回解析する無駄が発生

3. **インクリメンタル処理の欠如**:
   - プロジェクト全体のAST解析結果を永続化する仕組みがない
   - フェーズ遷移のたびに、全ファイルを最初から解析する

**性能影響試算:**
- 1000万行プロジェクト（平均100KB/file、100,000ファイル）
- AST解析: 30ms/file × 100,000 = 3,000秒（50分）
- これが各フェーズ遷移時（test_impl→implementation、refactoring→parallel_quality）で発生
- 合計: 100分のオーバーヘッド

### 修正方針

#### 1. AST解析結果のキャッシュ追加
```typescript
private astCache: Map<string, {
  hash: string;  // ファイルハッシュ
  result: ASTAnalysisResult;
}> = new Map();

private analyzeWithCache(fullPath: string): ASTAnalysisResult | null {
  const currentHash = this.hashFile(fullPath);
  const cached = this.astCache.get(fullPath);

  if (cached && cached.hash === currentHash) {
    return cached.result;  // キャッシュヒット
  }

  const result = analyzeTypeScriptFile(fullPath);
  this.astCache.set(fullPath, { hash: currentHash, result });
  return result;
}
```

#### 2. 永続化キャッシュの導入
- `.claude/cache/ast-analysis.json` に解析結果を保存
- ファイルハッシュベースで無効化
- プロジェクト全体で1回のAST解析で済む

#### 3. 差分検証の導入
- スコープ内の変更ファイルのみAST解析
- 未変更ファイルはキャッシュから取得

#### 4. 性能目標
- 1000万行プロジェクトで検証時間を 50分 → 5秒 に短縮（キャッシュヒット時）
- 初回解析でも 50分 → 10分 に短縮（並列化＋インデックス化）

---

## 問題4: scope-validatorのBFS依存解析が非同期・キャッシュなし

### 現象
- 大規模プロジェクトでスコープ追跡がタイムアウトする
- BFS走査が同期的で、キャッシングがないため遅い

### 根本原因分析

#### コード調査結果

**1. workflow-plugin/mcp-server/src/validation/scope-validator.ts（Line 445-540）**
```typescript
export function trackDependencies(
  affectedFiles: string[],
  affectedDirs: string | string[],
  options: { maxDepth?: number } = {},
): DependencyTrackingResult {
  // ... 省略 ...

  // BFS with depth tracking
  let queue: Array<{ file: string; depth: number; parent?: string }> =
    affectedFiles.map(f => ({ file: f, depth: 0 }));

  while (queue.length > 0) {
    const { file, depth, parent } = queue.shift()!;

    // ... 省略 ...

    // Read file and extract imports
    try {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');  // ★同期読み込み★
      const imports = extractImports(content, file);

      visitStack.add(file);

      for (const imp of imports) {
        const resolved = resolveImportPath(file, imp);  // ★同期解決★
        if (!resolved) continue;

        if (!allFiles.has(resolved)) {
          allFiles.add(resolved);
          importedFiles.push(resolved);

          // Check if in scope
          if (!isFileInScope(resolved, dirs)) {
            warnings.push(`${resolved} out of scope (imported from ${file})`);
          }
        }

        if (!visited.has(resolved)) {
          queue.push({ file: resolved, depth: depth + 1, parent: file });
        }
      }

      visitStack.delete(file);
    } catch {
      // File read error - skip
      visitStack.delete(file);
    }
  }
```

**問題点:**
1. **同期BFS走査**:
   - `fs.readFileSync()` で同期的にファイルを読み込む
   - 大規模プロジェクトでI/Oブロッキングが発生

2. **キャッシングなし**:
   - 同じファイルを複数回読み込む可能性がある（visited管理はあるが、import抽出結果のキャッシュはない）
   - `extractImports()` の結果が再利用されない

3. **深度制限のみの最適化**:
   - `MAX_DEPENDENCY_DEPTH` で深度制限はあるが、広さ方向の最適化がない
   - 1つのファイルが100個のimportを持つ場合、全て走査される

#### 設計上の欠陥

**問題の本質:**
1. **同期I/Oの乱用**:
   - Node.jsのイベントループをブロックする設計
   - 並列I/Oの恩恵を受けられない

2. **キャッシング戦略の欠如**:
   - ファイル内容の読み込みキャッシュなし
   - import抽出結果のキャッシュなし
   - 依存グラフの永続化なし

3. **段階的計算の欠如**:
   - プロジェクト全体の依存グラフを事前計算する仕組みがない
   - 毎回ゼロからBFS走査を実行

**性能影響試算:**
- 1000万行プロジェクト（平均100KB/file、100,000ファイル）
- 平均import数: 10/file
- BFS走査: 100,000ファイル × 10 imports = 1,000,000ノード
- ファイル読み込み: 1ms/file × 100,000 = 100秒
- import解析: 0.1ms/import × 1,000,000 = 100秒
- 合計: 200秒（3分20秒）のオーバーヘッド

### 修正方針

#### 1. 非同期BFS走査への移行
```typescript
async function trackDependenciesAsync(
  affectedFiles: string[],
  affectedDirs: string | string[],
  options: { maxDepth?: number } = {},
): Promise<DependencyTrackingResult> {
  const queue = [...affectedFiles.map(f => ({ file: f, depth: 0 }))];

  while (queue.length > 0) {
    const batch = queue.splice(0, 10);  // 10ファイル並列処理

    await Promise.all(batch.map(async ({ file, depth }) => {
      const content = await fs.promises.readFile(file, 'utf-8');
      const imports = extractImports(content, file);
      // ...
    }));
  }
}
```

#### 2. キャッシング戦略の導入
```typescript
const importCache = new Map<string, string[]>();

function extractImportsWithCache(filePath: string, content: string): string[] {
  const hash = crypto.createHash('md5').update(content).digest('hex');
  const cacheKey = `${filePath}:${hash}`;

  if (importCache.has(cacheKey)) {
    return importCache.get(cacheKey)!;
  }

  const imports = extractImports(content, filePath);
  importCache.set(cacheKey, imports);
  return imports;
}
```

#### 3. 依存グラフの永続化
- `.claude/cache/dependency-graph.json` に依存グラフを保存
- ファイルハッシュベースで差分更新
- プロジェクト全体で1回のグラフ構築で済む

#### 4. 性能目標
- 1000万行プロジェクトで追跡時間を 200秒 → 5秒 に短縮（キャッシュヒット時）
- 初回構築でも 200秒 → 30秒 に短縮（並列化＋最適化）

---

## 問題5: discoverTasks()が全タスクスキャン

### 現象
- タスク数が増加すると、タスク取得が遅くなる
- インデックスベースでなく、毎回全ディレクトリをスキャンする

### 根本原因分析

#### コード調査結果

**1. workflow-plugin/mcp-server/src/state/manager.ts（Line 431-475）**
```typescript
discoverTasks(): TaskState[] {
  // FR-11: キャッシュチェック
  if (isCacheEnabled()) {
    const cached = taskCache.get<TaskState[]>('task-list');
    if (cached) {
      return cached;
    }
  }

  if (!fs.existsSync(this.workflowDir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(this.workflowDir);  // ★全ディレクトリ読み込み★
    const tasks: TaskState[] = [];

    for (const entry of entries) {
      const entryPath = path.join(this.workflowDir, entry);
      try {
        const stat = fs.statSync(entryPath);
        if (!stat.isDirectory()) {
          continue;
        }

        const taskState = this.readTaskState(entryPath);  // ★全タスク状態読み込み★
        if (taskState && taskState.phase !== 'completed') {
          tasks.push(taskState);
        }
      } catch {
        // 個別のエントリでエラーが発生した場合はスキップ
        continue;
      }
    }
```

**問題点:**
1. **全ディレクトリスキャン**:
   - `fs.readdirSync(this.workflowDir)` で全ディレクトリを読み込む
   - タスク数が1000個あれば、1000個のディレクトリエントリを読み込む

2. **全タスク状態ファイル読み込み**:
   - `readTaskState()` で全タスクの `workflow-state.json` を読み込む
   - 1000タスク × 10KB/state = 10MB のI/O

3. **getTaskById の非効率性**:
```typescript
getTaskById(taskId: string): TaskState | null {
  const tasks = this.discoverTasks();  // ★全スキャン★
  return tasks.find(t => t.taskId === taskId) ?? null;
}
```
   - 特定のtaskIdを取得するのに、全タスクをスキャンする
   - O(N) の線形探索（N = タスク数）

#### 設計上の欠陥

**問題の本質:**
1. **インデックスの欠如**:
   - taskId → taskPath のマッピングが存在しない
   - 毎回ディレクトリスキャンで taskId を探す

2. **キャッシュの不完全性**:
   - `taskCache.get('task-list')` はあるが、特定のtaskId取得には効かない
   - `getTaskById()` 呼び出し時に `discoverTasks()` が必ず実行される

3. **命名規則への依存**:
   - ディレクトリ名が `{taskId}_{taskName}` 形式であることを前提としている
   - しかし、このパターンを直接使った高速検索を実装していない

**性能影響試算:**
- 1000タスク存在時:
  - `discoverTasks()`: 1000ディレクトリ読み込み + 1000ファイル読み込み = 1-2秒
  - `getTaskById()`: 毎回 `discoverTasks()` 実行 = 1-2秒/呼び出し
  - フック4つ同時起動: 4 × 2秒 = 8秒のオーバーヘッド

### 修正方針

#### 1. taskId → taskPath インデックスの導入
```typescript
// .claude/state/task-index.json
{
  "20260214_175140": ".claude/state/workflows/20260214_175140_レビュー指摘6件/",
  "20260214_104242": ".claude/state/workflows/20260214_104242_レビュー指摘事項全件修正/"
}
```

#### 2. インデックスベースのgetTaskById
```typescript
getTaskById(taskId: string): TaskState | null {
  // インデックスから直接パスを取得
  const index = this.loadTaskIndex();
  const taskPath = index[taskId];

  if (!taskPath) {
    return null;
  }

  // 1ファイルのみ読み込み
  return this.readTaskState(taskPath);
}
```

#### 3. インデックスの更新タイミング
- `createTask()`: 新規タスク追加時にインデックス追記
- `completeTask()`: 完了タスクをインデックスから削除
- `discoverTasks()`: フォールバック（インデックスが破損した場合）

#### 4. 性能目標
- 1000タスク存在時の `getTaskById()` を 2秒 → 10ms に短縮（200倍高速化）
- フック4つ同時起動時のオーバーヘッドを 8秒 → 40ms に短縮

---

## 問題6: loop-detectorがfail-open

### 現象
- エラー時に操作を許可する設計により、CLAUDE.mdのfail-closed原則と矛盾する
- セキュリティ上の脆弱性を生む可能性

### 根本原因分析

#### コード調査結果

**1. workflow-plugin/hooks/loop-detector.js（Line 381-391）**
```javascript
/**
 * メイン処理
 */
function main(input) {
  try {
    // 入力の検証
    if (!input || typeof input !== 'object') {
      process.exit(0);  // ★エラー時に許可★
    }

    const toolName = input.tool_name;
    const toolInput = input.tool_input || {};

    // Edit/Write ツール以外は許可
    if (toolName !== 'Edit' && toolName !== 'Write') {
      process.exit(0);
    }

    const filePath = toolInput.file_path || '';

    // ファイルパスがない場合は許可
    if (!filePath) {
      process.exit(0);  // ★エラー時に許可★
    }

    // ループ検出
    checkLoop(filePath);
  } catch (e) {
    // エラー時は許可（安全側に倒す）
    // ★fail-open設計★
  }

  // 正常終了
  process.exit(0);
}
```

**問題点:**
1. **fail-open原則**:
   - エラー発生時に `process.exit(0)` で許可する
   - 「エラー時は安全側に倒す」というコメントがあるが、これは**fail-openの定義**

2. **CLAUDE.mdとの矛盾**:
   - CLAUDE.mdには「fail-closed原則」が明記されている
   - エラー時はブロック（`exit(2)`）すべきだが、実装は逆

3. **セキュリティリスク**:
   - ループ検出器がクラッシュした場合、無限ループを検出できない
   - 状態ファイル破損時に、ループが野放しになる

**2. タイムアウト処理（Line 395-402）**
```javascript
// FR-2: Timeout fail-closed化（CRITICAL）
// タイムアウト発生時は exit code 2 でフック検証失敗として終了
// CLAUDE.md REQ-3 Fail Closed準拠
const timeout = setTimeout(() => {
  console.error('[loop-detector.js] Hook timeout - failing closed for security');
  process.exit(2);  // ★タイムアウトは fail-closed★
}, 3000);
```

**確認事項:**
- タイムアウト時は `exit(2)` で fail-closed している
- しかし、それ以外のエラー（JSON解析エラー、ファイル読み込みエラー）は fail-open
- **設計が一貫していない**

#### 設計上の欠陥

**問題の本質:**
1. **fail-openとfail-closedの混在**:
   - タイムアウト: fail-closed（`exit(2)`）
   - その他のエラー: fail-open（`exit(0)`）
   - 設計原則が統一されていない

2. **エラーハンドリングの不備**:
   - `catch (e)` ブロックでエラー内容を無視している
   - エラーログも出力されない（`logError()` が呼ばれていない）

3. **CLAUDE.md準拠の主張と実装の乖離**:
   - コメントには「CLAUDE.md REQ-3 Fail Closed準拠」とあるが、実際は fail-open
   - ドキュメントと実装が矛盾している

**影響範囲:**
- 無限ループ検出が失敗した場合、ユーザーが気づかずにループを繰り返す
- ディスク容量の浪費、開発効率の低下
- セキュリティ監査で fail-open 設計が指摘される可能性

### 修正方針

#### 1. 全エラーケースで fail-closed に統一
```javascript
function main(input) {
  try {
    // 入力の検証
    if (!input || typeof input !== 'object') {
      logError('入力エラー', '入力がオブジェクトではありません');
      process.exit(2);  // ★fail-closed★
    }

    const toolName = input.tool_name;
    const toolInput = input.tool_input || {};

    // Edit/Write ツール以外は許可
    if (toolName !== 'Edit' && toolName !== 'Write') {
      process.exit(0);
    }

    const filePath = toolInput.file_path || '';

    // ファイルパスがない場合はエラー
    if (!filePath) {
      logError('パスエラー', 'ファイルパスが空です');
      process.exit(2);  // ★fail-closed★
    }

    // ループ検出
    checkLoop(filePath);
  } catch (e) {
    // エラー時はブロック（fail-closed）
    logError('予期しないエラー', e.message, e.stack);
    process.exit(2);  // ★fail-closed★
  }

  // 正常終了
  process.exit(0);
}
```

#### 2. エラーログの強化
- 全エラーケースで `logError()` を呼び出す
- エラー内容を `.claude/state/hook-errors.log` に記録
- ユーザーがエラー原因を特定できるようにする

#### 3. CLAUDE.md との整合性確保
- ドキュメントに「fail-closed原則」を明記
- コードコメントと実装を一致させる
- レビュー時にfail-open設計を検出する静的解析ルールを追加

#### 4. 検証方法
- ループ検出器がクラッシュした場合、`exit(2)` が返されることを確認
- 状態ファイル破損時に、`exit(2)` が返されることを確認
- 全エラーケースで `.claude/state/hook-errors.log` にログが記録されることを確認

---

## 総合評価

### 根本原因の共通点

全6件の問題に共通する根本原因は以下の通りです:

1. **設計の不完全性**:
   - データは存在するが使用されていない（問題1: userIntent）
   - ユーザー意図よりも技術的指標が優先される（問題2: スキップ判定）
   - 設計原則とコードが矛盾する（問題6: fail-open/closed）

2. **スケーラビリティの欠如**:
   - 全件走査・全件解析の設計（問題3, 4, 5）
   - キャッシング・インデックス化の欠如
   - 1000万行プロジェクトを想定していない設計

3. **fail-closed原則の不徹底**:
   - エラー時の挙動が一貫していない（問題6）
   - ドキュメントと実装が矛盾
   - セキュリティ原則が守られていない

### 修正の優先順位

| 優先度 | 問題 | 理由 |
|--------|------|------|
| 1 | 問題6（fail-open） | セキュリティ原則違反、即時修正必須 |
| 2 | 問題1（userIntent） | ユーザー体験の根幹、全フェーズに影響 |
| 3 | 問題2（スキップ判定） | ユーザー指示無視、頻繁に発生する問題 |
| 4 | 問題5（全タスクスキャン） | 性能劣化が顕在化しやすい |
| 5 | 問題3（AST解析） | 大規模プロジェクトのみで顕在化 |
| 6 | 問題4（BFS依存解析） | 大規模プロジェクトのみで顕在化 |

### 次フェーズでの作業方針

1. **requirements フェーズ**:
   - 各問題の要件を具体的に定義
   - ユーザーストーリーを作成
   - 成功基準を明確化

2. **planning フェーズ**:
   - 修正アプローチの詳細設計
   - インデックス構造の設計
   - キャッシング戦略の設計

3. **実装の段階分け**:
   - Phase 1: 問題6（fail-closed）の即時修正
   - Phase 2: 問題1, 2（UX改善）
   - Phase 3: 問題3, 4, 5（性能改善）

---

## 成果物

- このresearch.mdファイルには6件の問題の根本原因分析と修正方針が記録されている
- 各問題について該当ソースコードの行番号と設計上の欠陥を含む詳細な分析結果を提供した
- 次フェーズ（requirements）では本調査結果に基づいて各問題の要件定義と成功基準の明確化を行う
- 優先順位はセキュリティ（問題6）→ UX（問題1と2）→ 性能（問題3と4と5）の順に設定した
- 修正は段階的に実施しPhase1でfail-closed即時修正とPhase2でUX改善とPhase3で性能改善を行う方針とした
