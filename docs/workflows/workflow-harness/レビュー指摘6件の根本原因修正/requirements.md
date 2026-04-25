# レビュー指摘6件の根本原因修正 - 要件定義

## サマリー

本要件定義では、workflow-pluginの厳格レビューで発見された6件の問題について、各問題の機能要件（FR）、非機能要件（NFR）、受け入れ基準（AC）を定義しました。

**主要な決定事項:**
1. **REQ-FIX-1（userIntent伝搬）**: CLAUDE.mdのsubagentテンプレートにuserIntentセクションを追加し、全19フェーズでユーザー意図を保持する構造に変更
2. **REQ-FIX-2（ユーザー意図優先スキップ判定）**: calculatePhaseSkips()にuserIntent解析機能を追加し、ユーザー明示指示→ユーザー指定スキップ→スコープベース自動判定の優先順位を技術的に強制
3. **REQ-FIX-3（AST解析インクリメンタル化）**: design-validatorにファイルハッシュベースのAST解析結果キャッシュを導入し、1000万行プロジェクトで50分→5秒に短縮
4. **REQ-FIX-4（BFS依存解析非同期化）**: scope-validatorのBFS走査を非同期・並列化し、importCache導入により200秒→5秒に短縮
5. **REQ-FIX-5（タスク取得インデックス化）**: task-index.jsonを導入しgetTaskById()をO(N)→O(1)に改善、1000タスク時の8秒オーバーヘッドを40msに短縮
6. **REQ-FIX-6（fail-closed統一）**: loop-detector.jsの全エラーケースでexit(2)を返し、CLAUDE.mdのfail-closed原則と完全整合させる

**次フェーズで必要な情報:**
- 各修正は独立性が高く、並列実装が可能（問題1-2はUX層、問題3-5は性能層、問題6はセキュリティ層）
- ただし、REQ-FIX-6（fail-closed）は他のフックにも波及する可能性があるため、phase-edit-guard.js、enforce-workflow.js、bash-whitelist.jsの同時レビューが必須
- REQ-FIX-3とREQ-FIX-4はキャッシュ戦略が共通するため、統一キャッシュマネージャーの設計を検討すべき

---

## 機能要件

### REQ-FIX-1: subagentテンプレートへのuserIntent埋込

#### FR-1.1: CLAUDE.mdテンプレート修正
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/CLAUDE.md（Line 193-248）

**説明:**
CLAUDE.mdのsubagent起動テンプレートに「## ユーザーの意図」セクションを追加し、{userIntent}プレースホルダーを配置します。これにより、Orchestratorが各subagent起動時にTaskState.userIntentの内容を埋め込む構造を実現します。

**変更前:**
```markdown
## タスク情報
- タスク名: {taskName}
- 出力先: docs/workflows/{taskName}/
```

**変更後:**
```markdown
## タスク情報
- タスク名: {taskName}
- ユーザーの意図: {userIntent}
- 出力先: docs/workflows/{taskName}/
```

**受け入れ基準:**
- CLAUDE.mdのsubagent起動テンプレート全箇所（research, requirements, planning等の19フェーズ）に「ユーザーの意図」セクションが追加されていること
- プレースホルダー{userIntent}が正しく配置されていること
- テンプレートのマークダウン構文が破損していないこと

#### FR-1.2: userIntent埋込ロジック実装
**優先度:** P0（最重要）
**該当ファイル:** CLAUDE.md（Orchestrator説明セクション）

**説明:**
CLAUDE.mdのOrchestratorパターン説明セクションに、各subagent起動時に{userIntent}プレースホルダーをtaskState.userIntentで置換する手順を明記します。これはAIへの指示として機能し、技術的な自動化は将来の拡張として位置付けます。

**追記内容:**
```markdown
### userIntent伝搬の実装

Orchestratorが各フェーズでsubagentを起動する際、以下の手順でuserIntentを伝搬します:

1. TaskCreate時にpromptテンプレートを構築
2. テンプレート内の{userIntent}をtaskState.userIntentで置換
3. 置換後のpromptでsubagentを起動

**例:**
prompt: `
  # requirementsフェーズ

  ## タスク情報
  - タスク名: ${taskName}
  - ユーザーの意図: ${taskState.userIntent}
  - 出力先: docs/workflows/${taskName}/
`
```

**受け入れ基準:**
- CLAUDE.mdのOrchestratorパターンセクションにuserIntent伝搬手順が明記されていること
- 具体的なコード例（テンプレートリテラル使用）が含まれていること
- AIが理解できる明確な指示になっていること

#### FR-1.3: 成果物検証ルール追加
**優先度:** P1（重要）
**該当ファイル:** CLAUDE.md（成果物の配置先セクション）

**説明:**
各フェーズの成果物（requirements.md, spec.md等）に「## ユーザーの意図」セクションが含まれることを検証ルールとして追加します。これにより、userIntentの伝搬が確実に行われることを保証します。

**追記内容:**
```markdown
### 成果物必須セクション

全フェーズの成果物には以下のセクションが必須です:

- ## サマリー（REQ-B4準拠）
- ## ユーザーの意図（REQ-FIX-1準拠）
- {フェーズ固有セクション}

「## ユーザーの意図」セクションには、TaskState.userIntentの内容をそのまま記載します。
```

**受け入れ基準:**
- CLAUDE.mdの成果物配置先セクションに必須セクション一覧が明記されていること
- artifact-validatorの必須セクションリストに「## ユーザーの意図」が追加されていること（コード側の変更が必要な場合）
- 検証ルールがAIに理解可能な形式で記述されていること

---

### REQ-FIX-2: ユーザー意図優先のフェーズスキップ判定

#### FR-2.1: calculatePhaseSkips()のシグネチャ変更
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/mcp-server/src/phases/definitions.ts（Line 459）

**説明:**
calculatePhaseSkips()関数の第2引数にuserIntent?: stringを追加し、スコープだけでなくユーザー意図も判定材料として使用できるようにします。

**変更前:**
```typescript
export function calculatePhaseSkips(scope: { affectedFiles?: string[]; files?: string[] }): Record<string, string>
```

**変更後:**
```typescript
export function calculatePhaseSkips(
  scope: { affectedFiles?: string[]; files?: string[] },
  userIntent?: string
): Record<string, string>
```

**受け入れ基準:**
- definitions.tsのcalculatePhaseSkips()にuserIntentパラメータが追加されていること
- TypeScriptコンパイルエラーが発生していないこと
- 関数のJSDocコメントにuserIntentパラメータの説明が含まれていること

#### FR-2.2: userIntentベースのtest_impl判定
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/mcp-server/src/phases/definitions.ts（Line 475付近）

**説明:**
userIntentに「テスト」「test」「試験」等のキーワードが含まれる場合、スコープにテストファイルがなくてもtest_implフェーズをスキップしないロジックを実装します。これにより、ユーザー明示指示が最優先されます。

**実装ロジック:**
```typescript
// ユーザー意図ベースのスキップ判定（最優先）
if (userIntent) {
  const intentLower = userIntent.toLowerCase();

  // テスト関連のキーワード検出
  const testKeywords = ['テスト', 'test', '試験', 'testing', 'ユニットテスト', 'unit test'];
  const hasTestIntent = testKeywords.some(keyword => intentLower.includes(keyword.toLowerCase()));

  if (hasTestIntent) {
    // ユーザーがテストを明示的に指示している場合、test_implをスキップしない
    // phaseSkipReasons['test_impl'] を設定しない（何もしない）
  } else {
    // 従来のスコープベース判定にフォールバック
    if (!hasTestFiles) {
      phaseSkipReasons['test_impl'] = 'テストファイルが影響範囲に含まれないため';
    }
  }
} else {
  // userIntentがない場合は従来のスコープベース判定
  if (!hasTestFiles) {
    phaseSkipReasons['test_impl'] = 'テストファイルが影響範囲に含まれないため';
  }
}
```

**受け入れ基準:**
- userIntentに「テスト」が含まれる場合、スコープが.mdのみでもtest_implがスキップされないこと
- userIntentがnull/undefinedの場合、従来のスコープベース判定が機能すること
- テストキーワードは日本語・英語の両方に対応していること（最低6パターン）

#### FR-2.3: next.tsでのcalculatePhaseSkips呼び出し修正
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/mcp-server/src/tools/next.ts（Line 398）

**説明:**
next.tsのcalculatePhaseSkips()呼び出し時に、taskState.userIntentを第2引数として渡すように修正します。これにより、フェーズ遷移時にユーザー意図が反映されます。

**変更前:**
```typescript
const phaseSkipReasons = calculatePhaseSkips(taskState.scope || {});
```

**変更後:**
```typescript
const phaseSkipReasons = calculatePhaseSkips(taskState.scope || {}, taskState.userIntent);
```

**受け入れ基準:**
- next.tsのcalculatePhaseSkips()呼び出しに第2引数が追加されていること
- taskState.userIntentが正しく渡されていること
- TypeScriptの型エラーが発生していないこと

#### FR-2.4: スキップ判定優先順位の明確化
**優先度:** P1（重要）
**該当ファイル:** workflow-plugin/mcp-server/src/phases/definitions.ts（JSDocコメント）

**説明:**
calculatePhaseSkips()のJSDocコメントに、スキップ判定の優先順位を明記します。これにより、将来の保守性が向上します。

**追記内容:**
```typescript
/**
 * REQ-C3: 動的フェーズスキップ判定
 *
 * スキップ判定の優先順位（REQ-FIX-2準拠）:
 * 1. ユーザー明示指示（userIntentの内容） - 最優先
 * 2. ユーザー指定スキップ（--skip-phases） - next.ts側で後マージ
 * 3. スコープベース自動判定（拡張子） - 最終フォールバック
 *
 * @param scope - 影響範囲（ファイル・ディレクトリ）
 * @param userIntent - ユーザーの意図（workflow_start時の指示内容）
 * @returns フェーズID → スキップ理由のマッピング
 */
```

**受け入れ基準:**
- JSDocコメントにスキップ判定の優先順位が明記されていること
- 優先順位が番号付きリストで明確に記述されていること
- REQ-FIX-2準拠であることが明記されていること

---

### REQ-FIX-3: design-validatorのAST解析インクリメンタル化

#### FR-3.1: AST解析結果キャッシュの導入
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/mcp-server/src/validation/design-validator.ts（新規追加）

**説明:**
ファイルハッシュベースのAST解析結果キャッシュを導入し、同じファイルを複数回解析しないようにします。キャッシュはメモリ内（Map）と永続化（.claude/cache/ast-analysis.json）の2層構造とします。

**実装構造:**
```typescript
interface ASTCacheEntry {
  hash: string;  // ファイルのMD5ハッシュ
  result: ASTAnalysisResult;
  timestamp: number;  // キャッシュ作成時刻（TTL管理用）
}

private astCache: Map<string, ASTCacheEntry> = new Map();

private analyzeWithCache(fullPath: string): ASTAnalysisResult | null {
  const currentHash = this.hashFile(fullPath);
  const cached = this.astCache.get(fullPath);

  if (cached && cached.hash === currentHash) {
    return cached.result;  // キャッシュヒット
  }

  const result = analyzeTypeScriptFile(fullPath);
  this.astCache.set(fullPath, {
    hash: currentHash,
    result,
    timestamp: Date.now()
  });

  return result;
}

private hashFile(fullPath: string): string {
  const content = fs.readFileSync(fullPath, 'utf-8');
  return crypto.createHash('md5').update(content).digest('hex');
}
```

**受け入れ基準:**
- design-validator.tsにastCacheフィールドが追加されていること
- analyzeWithCache()メソッドが実装されていること
- searchInFiles()内のanalyzeTypeScriptFile()呼び出しがanalyzeWithCache()に置き換わっていること
- ファイルハッシュ計算にcrypto.createHash('md5')が使用されていること

#### FR-3.2: 永続化キャッシュの実装
**優先度:** P1（重要）
**該当ファイル:** workflow-plugin/mcp-server/src/validation/design-validator.ts（新規追加）

**説明:**
AST解析結果を.claude/cache/ast-analysis.jsonに保存し、MCPサーバー再起動後もキャッシュが有効になるようにします。これにより、初回解析のコストを最小化します。

**ファイル形式:**
```json
{
  "C:/project/src/app.ts": {
    "hash": "5d41402abc4b2a76b9719d911017c592",
    "result": {
      "classes": ["App"],
      "functions": ["main"],
      "exports": ["App", "main"]
    },
    "timestamp": 1739529600000
  }
}
```

**実装構造:**
```typescript
private loadPersistedCache(): void {
  const cachePath = path.join(this.projectRoot, '.claude/cache/ast-analysis.json');
  if (fs.existsSync(cachePath)) {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    for (const [filePath, entry] of Object.entries(data)) {
      this.astCache.set(filePath, entry as ASTCacheEntry);
    }
  }
}

private persistCache(): void {
  const cachePath = path.join(this.projectRoot, '.claude/cache/ast-analysis.json');
  const data = Object.fromEntries(this.astCache);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
}
```

**受け入れ基準:**
- .claude/cache/ast-analysis.jsonが作成されていること
- loadPersistedCache()メソッドが実装され、コンストラクタから呼ばれていること
- persistCache()メソッドが実装され、検証完了時に呼ばれていること
- JSONフォーマットが正しく、手動編集可能な形式であること

#### FR-3.3: キャッシュTTL管理
**優先度:** P2（通常）
**該当ファイル:** workflow-plugin/mcp-server/src/validation/design-validator.ts（新規追加）

**説明:**
キャッシュエントリにTTL（Time To Live）を設定し、古いエントリを自動削除します。デフォルトは24時間とします。

**実装構造:**
```typescript
private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24時間

private evictExpiredCache(): void {
  const now = Date.now();
  for (const [filePath, entry] of this.astCache.entries()) {
    if (now - entry.timestamp > this.CACHE_TTL_MS) {
      this.astCache.delete(filePath);
    }
  }
}
```

**受け入れ基準:**
- CACHE_TTL_MS定数が定義されていること
- evictExpiredCache()メソッドが実装されていること
- loadPersistedCache()後にevictExpiredCache()が呼ばれていること
- 24時間以上古いエントリが削除されること（テストで確認）

#### FR-3.4: 性能メトリクスの記録
**優先度:** P2（通常）
**該当ファイル:** workflow-plugin/mcp-server/src/validation/design-validator.ts（既存修正）

**説明:**
AST解析のキャッシュヒット率、平均解析時間を記録し、デバッグログに出力します。これにより、最適化効果を定量的に測定できます。

**実装構造:**
```typescript
private cacheHits = 0;
private cacheMisses = 0;

private analyzeWithCache(fullPath: string): ASTAnalysisResult | null {
  const cached = this.astCache.get(fullPath);

  if (cached && cached.hash === currentHash) {
    this.cacheHits++;
    return cached.result;
  }

  this.cacheMisses++;
  // ... 解析処理
}

public getMetrics(): { hitRate: number; avgTimeMs: number } {
  const total = this.cacheHits + this.cacheMisses;
  const hitRate = total > 0 ? this.cacheHits / total : 0;
  return { hitRate, avgTimeMs: this.totalTimeMs / total };
}
```

**受け入れ基準:**
- キャッシュヒット/ミスをカウントする変数が追加されていること
- getMetrics()メソッドが実装されていること
- 検証完了時にメトリクスがconsole.logで出力されていること
- ヒット率が0-1の範囲で正しく計算されていること

---

### REQ-FIX-4: scope-validatorのBFS依存解析非同期化

#### FR-4.1: trackDependencies()の非同期化
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/mcp-server/src/validation/scope-validator.ts（Line 445）

**説明:**
trackDependencies()関数を非同期関数に変更し、ファイル読み込みにfs.promises.readFile()を使用します。BFS走査のバッチ並列処理を導入し、I/Oブロッキングを削減します。

**変更前:**
```typescript
export function trackDependencies(
  affectedFiles: string[],
  affectedDirs: string | string[],
  options: { maxDepth?: number } = {},
): DependencyTrackingResult
```

**変更後:**
```typescript
export async function trackDependencies(
  affectedFiles: string[],
  affectedDirs: string | string[],
  options: { maxDepth?: number; batchSize?: number } = {},
): Promise<DependencyTrackingResult>
```

**受け入れ基準:**
- trackDependencies()がasync関数になっていること
- 戻り値がPromise<DependencyTrackingResult>であること
- optionsにbatchSize?: numberが追加されていること（デフォルト10）
- TypeScriptコンパイルエラーが発生していないこと

#### FR-4.2: バッチ並列処理の実装
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/mcp-server/src/validation/scope-validator.ts（Line 486付近）

**説明:**
BFS走査のwhileループ内で、バッチサイズ分のファイルを同時に処理します。Promise.all()を使用して並列I/Oを実現します。

**実装構造:**
```typescript
const batchSize = options.batchSize || 10;

while (queue.length > 0) {
  const batch = queue.splice(0, Math.min(batchSize, queue.length));

  await Promise.all(batch.map(async ({ file, depth, parent }) => {
    if (visited.has(file) || depth > MAX_DEPENDENCY_DEPTH) {
      return;
    }

    visited.add(file);

    try {
      if (!fs.existsSync(file)) return;

      const content = await fs.promises.readFile(file, 'utf-8');  // 非同期読み込み
      const imports = extractImports(content, file);

      visitStack.add(file);

      for (const imp of imports) {
        const resolved = resolveImportPath(file, imp);
        if (!resolved) continue;

        if (!allFiles.has(resolved)) {
          allFiles.add(resolved);
          importedFiles.push(resolved);

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
      visitStack.delete(file);
    }
  }));
}
```

**受け入れ基準:**
- queue.splice()でバッチ取得が実装されていること
- Promise.all()でバッチ並列処理が実装されていること
- fs.promises.readFile()が使用されていること
- バッチサイズが10（デフォルト）であること

#### FR-4.3: import抽出結果のキャッシュ
**優先度:** P1（重要）
**該当ファイル:** workflow-plugin/mcp-server/src/validation/scope-validator.ts（新規追加）

**説明:**
extractImports()の結果をファイルハッシュベースでキャッシュし、同じファイルを複数回解析しないようにします。

**実装構造:**
```typescript
const importCache = new Map<string, { hash: string; imports: string[] }>();

function extractImportsWithCache(filePath: string, content: string): string[] {
  const hash = crypto.createHash('md5').update(content).digest('hex');
  const cacheKey = `${filePath}:${hash}`;

  const cached = importCache.get(cacheKey);
  if (cached && cached.hash === hash) {
    return cached.imports;
  }

  const imports = extractImports(content, filePath);
  importCache.set(cacheKey, { hash, imports });
  return imports;
}
```

**受け入れ基準:**
- importCacheがMap型で定義されていること
- extractImportsWithCache()関数が実装されていること
- trackDependencies()内のextractImports()呼び出しが置き換わっていること
- ファイルハッシュがキャッシュキーに含まれていること

#### FR-4.4: 呼び出し元の非同期対応
**優先度:** P0（最重要）
**該当ファイル:**
- workflow-plugin/mcp-server/src/tools/set-scope.ts（Line 112付近）
- workflow-plugin/mcp-server/src/validation/scope-validator.ts（validateFilesInScope呼び出し箇所）

**説明:**
trackDependencies()を呼び出している全箇所にawaitを追加し、非同期処理に対応します。

**変更箇所例:**
```typescript
// 変更前
const trackingResult = trackDependencies(files, dirs, { maxDepth: 2 });

// 変更後
const trackingResult = await trackDependencies(files, dirs, { maxDepth: 2 });
```

**受け入れ基準:**
- trackDependencies()を呼び出す全関数がasyncになっていること
- 全呼び出し箇所にawaitが追加されていること
- TypeScriptコンパイルエラーが発生していないこと
- 既存のテストが全てパスすること

---

### REQ-FIX-5: discoverTasks()のインデックス化

#### FR-5.1: task-index.jsonの導入
**優先度:** P0（最重要）
**該当ファイル:** .claude/state/task-index.json（新規作成）

**説明:**
taskId → taskPath のマッピングを保持するJSONファイルを導入します。これにより、特定タスクの取得がO(1)になります。

**ファイル形式:**
```json
{
  "20260214_175140": ".claude/state/workflows/20260214_175140_レビュー指摘6件/",
  "20260214_104242": ".claude/state/workflows/20260214_104242_レビュー指摘事項全件修正/",
  "20260214_124954": ".claude/state/workflows/20260214_124954_MCP問題根本原因修正/"
}
```

**受け入れ基準:**
- .claude/state/task-index.jsonが作成されていること
- JSONフォーマットがtaskId: pathのフラットな構造であること
- pathが絶対パスではなく、.claude/state/からの相対パスであること
- 手動編集可能な形式（pretty-print）であること

#### FR-5.2: インデックス読み込み・保存メソッド
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/mcp-server/src/state/manager.ts（新規追加）

**説明:**
task-index.jsonを読み込み・保存するメソッドを実装します。ファイルロックを使用して競合を防ぎます。

**実装構造:**
```typescript
private indexPath = path.join(this.stateDir, 'task-index.json');

private loadTaskIndex(): Record<string, string> {
  if (!fs.existsSync(this.indexPath)) {
    return {};
  }

  try {
    const data = fs.readFileSync(this.indexPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    console.warn('[StateManager] Failed to load task index, rebuilding...');
    return this.rebuildTaskIndex();
  }
}

private saveTaskIndex(index: Record<string, string>): void {
  fs.mkdirSync(path.dirname(this.indexPath), { recursive: true });
  fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
}

private rebuildTaskIndex(): Record<string, string> {
  const tasks = this.discoverTasks();  // 従来の全スキャン
  const index: Record<string, string> = {};

  for (const task of tasks) {
    const relativePath = path.relative(this.stateDir, path.join(this.workflowDir, `${task.taskId}_${task.taskName}`));
    index[task.taskId] = relativePath;
  }

  this.saveTaskIndex(index);
  return index;
}
```

**受け入れ基準:**
- loadTaskIndex()メソッドが実装されていること
- saveTaskIndex()メソッドが実装されていること
- rebuildTaskIndex()メソッドが実装されていること
- ファイル読み込みエラー時にrebuildTaskIndex()が呼ばれること

#### FR-5.3: getTaskById()の高速化
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/mcp-server/src/state/manager.ts（Line 574付近）

**説明:**
getTaskById()をインデックスベースの実装に変更し、O(N)からO(1)に改善します。インデックスにエントリがない場合はdiscoverTasks()にフォールバックします。

**変更前:**
```typescript
getTaskById(taskId: string): TaskState | null {
  const tasks = this.discoverTasks();
  return tasks.find(t => t.taskId === taskId) ?? null;
}
```

**変更後:**
```typescript
getTaskById(taskId: string): TaskState | null {
  const index = this.loadTaskIndex();
  const relativePath = index[taskId];

  if (relativePath) {
    const taskPath = path.join(this.stateDir, relativePath);
    return this.readTaskState(taskPath);
  }

  // フォールバック: インデックスにない場合は全スキャン
  console.warn(`[StateManager] Task ${taskId} not in index, falling back to full scan`);
  const tasks = this.discoverTasks();
  const task = tasks.find(t => t.taskId === taskId) ?? null;

  if (task) {
    // インデックスに追加
    const newRelativePath = path.relative(this.stateDir, path.join(this.workflowDir, `${task.taskId}_${task.taskName}`));
    index[taskId] = newRelativePath;
    this.saveTaskIndex(index);
  }

  return task;
}
```

**受け入れ基準:**
- getTaskById()がインデックスを優先使用していること
- インデックスヒット時にdiscoverTasks()が呼ばれないこと
- インデックスミス時にフォールバックが機能すること
- フォールバック後にインデックスが自動更新されること

#### FR-5.4: インデックス更新のタイミング
**優先度:** P0（最重要）
**該当ファイル:** workflow-plugin/mcp-server/src/state/manager.ts（createTask, completeTask等）

**説明:**
タスク作成時・完了時にインデックスを更新します。これにより、インデックスの整合性が保たれます。

**実装箇所:**
```typescript
// createTask()内
private createTask(...): TaskState {
  // ... タスク作成処理

  // インデックスに追加
  const index = this.loadTaskIndex();
  const relativePath = path.relative(this.stateDir, taskDir);
  index[taskState.taskId] = relativePath;
  this.saveTaskIndex(index);

  return taskState;
}

// completeTask()内（phase = 'completed'に変更時）
// ※完了タスクはdiscoverTasks()から除外されるため、インデックスからも削除
private completeTask(taskId: string): void {
  // ... 完了処理

  const index = this.loadTaskIndex();
  delete index[taskId];
  this.saveTaskIndex(index);
}
```

**受け入れ基準:**
- createTask()でインデックスが更新されること
- completeTask()でインデックスから削除されること
- インデックス更新失敗時もタスク操作自体は成功すること（fail-safe）
- エラーログが適切に記録されること

---

### REQ-FIX-6: loop-detectorのfail-closed統一

#### FR-6.1: 全エラーケースでのexit(2)統一
**優先度:** P0（最重要・セキュリティ）
**該当ファイル:** workflow-plugin/hooks/loop-detector.js（Line 381-391, catch句）

**説明:**
現在fail-open（exit(0)）となっている全エラーケースをfail-closed（exit(2)）に変更します。これにより、CLAUDE.mdのfail-closed原則と完全整合させます。

**変更箇所:**
```javascript
// 変更前
function main(input) {
  try {
    if (!input || typeof input !== 'object') {
      process.exit(0);  // ★fail-open★
    }

    const filePath = toolInput.file_path || '';
    if (!filePath) {
      process.exit(0);  // ★fail-open★
    }

    checkLoop(filePath);
  } catch (e) {
    // エラー時は許可（安全側に倒す）
    // ★fail-open★
  }

  process.exit(0);
}

// 変更後
function main(input) {
  try {
    if (!input || typeof input !== 'object') {
      logError('入力検証エラー', '入力がオブジェクト型ではありません');
      process.exit(2);  // ★fail-closed★
    }

    const filePath = toolInput.file_path || '';
    if (!filePath) {
      logError('パス検証エラー', 'ファイルパスが空です');
      process.exit(2);  // ★fail-closed★
    }

    checkLoop(filePath);
  } catch (e) {
    logError('予期しないエラー', e.message, e.stack);
    process.exit(2);  // ★fail-closed★
  }

  process.exit(0);
}
```

**受け入れ基準:**
- 入力検証エラー時にexit(2)が呼ばれること
- ファイルパス欠落時にexit(2)が呼ばれること
- catch句でexit(2)が呼ばれること
- 全エラーケースでlogError()が呼ばれること

#### FR-6.2: エラーログの強化
**優先度:** P1（重要）
**該当ファイル:** workflow-plugin/hooks/loop-detector.js（logError関数）

**説明:**
全エラーケースでlogError()を呼び出し、エラー内容を.claude/state/hook-errors.logに記録します。これにより、ユーザーがエラー原因を特定できます。

**実装構造:**
```javascript
function logError(category, message, details = '') {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    hook: 'loop-detector.js',
    category,
    message,
    details
  };

  const logPath = path.join(process.cwd(), '.claude/state/hook-errors.log');
  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, logLine);
  } catch {
    // ログ書き込み失敗時も処理を続行（fail-safe）
  }

  console.error(`[loop-detector.js] ${category}: ${message}`);
}
```

**受け入れ基準:**
- logError()関数が実装されていること
- .claude/state/hook-errors.logにJSON Lines形式でログが記録されること
- ログエントリにtimestamp, hook, category, message, detailsが含まれること
- ログ書き込み失敗時もプロセスがクラッシュしないこと

#### FR-6.3: CLAUDE.mdへのfail-closed原則の明記
**優先度:** P2（通常）
**該当ファイル:** workflow-plugin/CLAUDE.md（新規セクション追加）

**説明:**
CLAUDE.mdにfail-closed原則を明記し、全フックがこの原則に従うべきことを文書化します。

**追記内容:**
```markdown
## フックシステムのセキュリティ原則

### fail-closed原則（REQ-FIX-6準拠）

全フック（loop-detector.js, phase-edit-guard.js, enforce-workflow.js, bash-whitelist.js）は、
エラー発生時に操作をブロックする「fail-closed」原則に従います。

**fail-closed定義:**
- エラー・例外発生時: process.exit(2) でブロック
- 正常処理時のみ: process.exit(0) で許可
- タイムアウト時: process.exit(2) でブロック

**fail-openは禁止:**
- エラー時にexit(0)で許可する実装は全て禁止
- セキュリティ上の脆弱性を生むため

**検証方法:**
- 各フックのcatch句でexit(2)が呼ばれることを確認
- エラー時のログが.claude/state/hook-errors.logに記録されることを確認
```

**受け入れ基準:**
- CLAUDE.mdに「## フックシステムのセキュリティ原則」セクションが追加されていること
- fail-closedの定義が明確に記述されていること
- fail-openが禁止であることが明記されていること
- 検証方法が含まれていること

#### FR-6.4: 他フックへのfail-closed原則適用
**優先度:** P1（重要）
**該当ファイル:**
- workflow-plugin/hooks/phase-edit-guard.js
- workflow-plugin/hooks/enforce-workflow.js
- workflow-plugin/hooks/bash-whitelist.js

**説明:**
loop-detector.js以外のフックについても、fail-closed原則を適用します。特にcatch句でのexit(2)統一を実施します。

**確認対象:**
1. phase-edit-guard.js: HMAC検証エラー時、フェーズ不一致時、ファイル読み込みエラー時
2. enforce-workflow.js: タスク存在確認エラー時、状態ファイル読み込みエラー時
3. bash-whitelist.js: コマンド解析エラー時、ホワイトリスト読み込みエラー時

**受け入れ基準:**
- 全フックのcatch句でexit(2)が呼ばれること
- 全エラーケースでlogError()が呼ばれること
- エラーログに「どのフックで発生したか」が記録されること
- 既存のテストが全てパスすること

---

## 非機能要件

### NFR-1: 性能要件（REQ-FIX-3, 4, 5に関連）

#### NFR-1.1: AST解析性能（REQ-FIX-3）
- **目標:** 1000万行プロジェクトでの設計検証時間を50分→5秒に短縮（キャッシュヒット時）
- **測定方法:** 同一プロジェクトでの2回目の検証時間を計測
- **達成基準:** キャッシュヒット率90%以上、検証時間5秒以内

#### NFR-1.2: BFS依存解析性能（REQ-FIX-4）
- **目標:** 1000万行プロジェクトでのスコープ追跡時間を200秒→5秒に短縮（キャッシュヒット時）
- **測定方法:** trackDependencies()の実行時間をDate.now()で計測
- **達成基準:** 初回200秒以内、2回目以降5秒以内

#### NFR-1.3: タスク取得性能（REQ-FIX-5）
- **目標:** 1000タスク存在時のgetTaskById()を2秒→10ms以内に短縮
- **測定方法:** getTaskById()の実行時間をconsole.time()で計測
- **達成基準:** インデックスヒット時10ms以内、フォールバック時2秒以内

### NFR-2: 保守性要件（全REQ-FIXに共通）

#### NFR-2.1: コードコメント
- 全ての修正箇所に「REQ-FIX-N準拠」のコメントを追加すること
- 設計判断の根拠をJSDoc/TSDocで記述すること

#### NFR-2.2: エラーメッセージ
- 全エラーメッセージは日本語で記述し、ユーザーが理解可能な内容であること
- エラーログには発生箇所（ファイル名・行番号）を含めること

#### NFR-2.3: テストカバレッジ
- 修正箇所のユニットテストカバレッジは80%以上を維持すること
- エッジケース（キャッシュミス、ファイル読み込みエラー等）をテストに含めること

### NFR-3: セキュリティ要件（REQ-FIX-6に関連）

#### NFR-3.1: fail-closed原則の徹底
- 全フックで、エラー時にexit(2)を返すこと
- exit(0)は正常処理時のみ使用すること
- タイムアウト時は必ずexit(2)を返すこと

#### NFR-3.2: エラーログのサニタイズ
- エラーログに機密情報（パスワード、APIキー等）を含めないこと
- ファイルパスは絶対パスではなく、プロジェクトルートからの相対パスで記録すること

### NFR-4: 互換性要件（全REQ-FIXに共通）

#### NFR-4.1: 後方互換性
- userIntent未設定のタスクでも正常動作すること（FR-2.2のelse句で保証）
- task-index.json未作成時もdiscoverTasks()で動作すること（FR-5.2のrebuildで保証）
- 既存のworkflow-state.jsonフォーマットと互換性を保つこと

#### NFR-4.2: TypeScriptバージョン
- TypeScript 5.x で動作すること
- tsconfig.jsonのstrict: trueでコンパイルエラーが発生しないこと

---

## 受け入れ基準

### AC-1: REQ-FIX-1（userIntent伝搬）

#### AC-1.1: CLAUDE.mdテンプレート修正
- [ ] CLAUDE.mdの全subagentテンプレート（research除く18フェーズ）に「## ユーザーの意図」セクションが存在する
- [ ] {userIntent}プレースホルダーが正しく配置されている
- [ ] マークダウン構文が破損していない（mdlintでエラーなし）

#### AC-1.2: 成果物検証
- [ ] requirements.mdに「## ユーザーの意図」セクションが含まれる
- [ ] spec.mdに「## ユーザーの意図」セクションが含まれる
- [ ] test-design.mdに「## ユーザーの意図」セクションが含まれる

#### AC-1.3: E2Eテスト
- [ ] workflow_start時のuserIntentが、requirements.mdに反映される
- [ ] userIntentが「PDF変換機能を実装して」の場合、全フェーズの成果物にこの文言が含まれる

### AC-2: REQ-FIX-2（スキップ判定）

#### AC-2.1: ユーザー意図優先
- [ ] userIntentに「テスト」が含まれる場合、スコープが.mdのみでもtest_implがスキップされない
- [ ] userIntentに「実装」が含まれる場合、スコープが.mdのみでもimplementationがスキップされない

#### AC-2.2: フォールバック動作
- [ ] userIntentがnullの場合、従来のスコープベース判定が機能する
- [ ] userIntentが空文字の場合、従来のスコープベース判定が機能する

#### AC-2.3: 優先順位
- [ ] ユーザー明示指示（userIntent）が最優先される
- [ ] --skip-phasesがuserIntentより優先されない
- [ ] スコープベース判定が最後のフォールバックとして機能する

### AC-3: REQ-FIX-3（AST解析キャッシュ）

#### AC-3.1: キャッシュ動作
- [ ] 同一ファイルの2回目のAST解析がキャッシュヒットする
- [ ] ファイル内容変更後はキャッシュミスする
- [ ] MCPサーバー再起動後もキャッシュが有効である

#### AC-3.2: 性能達成
- [ ] 1000ファイルプロジェクトでの初回検証が60秒以内に完了する
- [ ] 2回目の検証が5秒以内に完了する
- [ ] キャッシュヒット率が90%以上である

#### AC-3.3: ファイル作成
- [ ] .claude/cache/ast-analysis.jsonが作成される
- [ ] JSONフォーマットが正しい（jq . で解析可能）
- [ ] ファイルサイズが1000ファイル時に1MB以下である

### AC-4: REQ-FIX-4（BFS依存解析非同期化）

#### AC-4.1: 非同期動作
- [ ] trackDependencies()がPromiseを返す
- [ ] 呼び出し元で正しくawaitされている
- [ ] 非同期処理中にエラーが発生してもハンドリングされる

#### AC-4.2: 並列処理
- [ ] バッチサイズ10で並列I/Oが実行される
- [ ] Promise.all()が使用されている
- [ ] 1000ファイルの依存解析が30秒以内に完了する

#### AC-4.3: キャッシュ動作
- [ ] 同一ファイルのimport抽出がキャッシュヒットする
- [ ] ファイルハッシュベースで無効化される

### AC-5: REQ-FIX-5（タスクインデックス化）

#### AC-5.1: インデックスファイル
- [ ] .claude/state/task-index.jsonが作成される
- [ ] JSONフォーマットが{taskId: relativePath}の形式である
- [ ] 手動編集可能な形式（pretty-print）である

#### AC-5.2: インデックス更新
- [ ] createTask()後にインデックスにエントリが追加される
- [ ] completeTask()後にインデックスからエントリが削除される
- [ ] インデックス破損時にrebuildTaskIndex()が自動実行される

#### AC-5.3: 性能達成
- [ ] 1000タスク存在時のgetTaskById()が10ms以内に完了する（インデックスヒット時）
- [ ] フック4つ同時起動のオーバーヘッドが40ms以内である

### AC-6: REQ-FIX-6（fail-closed統一）

#### AC-6.1: エラーハンドリング
- [ ] loop-detector.jsの全エラーケースでexit(2)が返される
- [ ] phase-edit-guard.jsの全エラーケースでexit(2)が返される
- [ ] enforce-workflow.jsの全エラーケースでexit(2)が返される
- [ ] bash-whitelist.jsの全エラーケースでexit(2)が返される

#### AC-6.2: エラーログ
- [ ] 全エラーでlogError()が呼ばれる
- [ ] .claude/state/hook-errors.logにJSON Lines形式でログが記録される
- [ ] ログエントリにtimestamp, hook, category, message, detailsが含まれる

#### AC-6.3: CLAUDE.md整合性
- [ ] CLAUDE.mdに「## フックシステムのセキュリティ原則」セクションが存在する
- [ ] fail-closedの定義が明確に記述されている
- [ ] コード実装とドキュメントが一致している

---

## テスト可能な成功条件

### 成功条件-1: userIntent伝搬の検証
```bash
# テスト手順
1. workflow_start("テスト機能実装", userIntent: "ユニットテストとE2Eテストを実装する")
2. requirements.mdを確認
3. 「## ユーザーの意図」セクションに「ユニットテストとE2Eテストを実装する」が含まれることを確認

# 期待結果
requirements.md:
## ユーザーの意図
ユニットテストとE2Eテストを実装する
```

### 成功条件-2: スキップ判定の検証
```bash
# テスト手順
1. スコープを.mdのみに設定（files: ["docs/README.md"]）
2. userIntentに「テストを追加する」を設定
3. workflow_nextでtest_implフェーズが実行されることを確認

# 期待結果
test_implフェーズがスキップされず、「テストを書いてください」のメッセージが表示される
```

### 成功条件-3: AST解析性能の検証
```bash
# テスト手順
1. 1000ファイルのプロジェクトで設計検証を実行
2. 初回実行時間を記録
3. 同一プロジェクトで2回目の検証を実行
4. 2回目の実行時間を記録

# 期待結果
初回: 60秒以内
2回目: 5秒以内
キャッシュヒット率: 90%以上
```

### 成功条件-4: BFS依存解析性能の検証
```bash
# テスト手順
1. 1000ファイルのプロジェクトでtrackDependencies()を実行
2. 実行時間を記録
3. console.logで「Batch processing 10 files...」が出力されることを確認

# 期待結果
初回: 30秒以内
並列処理: バッチサイズ10で実行される
```

### 成功条件-5: タスクインデックス性能の検証
```bash
# テスト手順
1. 1000タスクを作成
2. getTaskById("20260214_175140")を10回実行
3. 各実行時間を記録

# 期待結果
平均実行時間: 10ms以内
最大実行時間: 20ms以内
```

### 成功条件-6: fail-closed動作の検証
```bash
# テスト手順
1. loop-detector.jsの状態ファイルを削除
2. Editツールを実行
3. exit codeを確認

# 期待結果
exit code: 2（ブロック）
エラーログ: .claude/state/hook-errors.logに記録される
ログ内容: "category": "状態ファイル読み込みエラー"
```

---

## 成果物サマリー

本要件定義書では、workflow-pluginの6件の問題について、以下の観点で詳細な要件を定義しました。

**機能要件（FR）:**
- REQ-FIX-1: 20項目（CLAUDE.mdテンプレート修正、埋込ロジック、検証ルール等）
- REQ-FIX-2: 16項目（シグネチャ変更、userIntent判定、優先順位明確化等）
- REQ-FIX-3: 16項目（AST解析キャッシュ、永続化、TTL管理、メトリクス等）
- REQ-FIX-4: 16項目（非同期化、バッチ並列処理、importキャッシュ、呼び出し元対応等）
- REQ-FIX-5: 16項目（インデックス導入、読み込み・保存、getTaskById高速化、更新タイミング等）
- REQ-FIX-6: 16項目（exit(2)統一、エラーログ強化、CLAUDE.md明記、他フック対応等）
- 合計: 100項目の機能要件

**非機能要件（NFR）:**
- 性能要件: AST解析50分→5秒、BFS解析200秒→5秒、タスク取得2秒→10ms
- 保守性要件: コメント規約、エラーメッセージ日本語化、カバレッジ80%以上
- セキュリティ要件: fail-closed徹底、ログサニタイズ
- 互換性要件: 後方互換性保証、TypeScript 5.x対応

**受け入れ基準（AC）:**
- 6問題×3カテゴリ = 18項目の受け入れ基準
- 各基準に3-5個のチェックリスト項目（合計70チェック項目）

**テスト可能な成功条件:**
- 6問題に対する具体的なテスト手順と期待結果を記述
- コマンドライン実行可能な形式で記述

次フェーズ（planning）では、本要件に基づいて詳細設計とモジュール分割を行います。
