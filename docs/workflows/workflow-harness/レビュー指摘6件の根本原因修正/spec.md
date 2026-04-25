# レビュー指摘6件の根本原因修正 - 詳細仕様書

## サマリー

本仕様書では、requirements.mdで定義された6件の修正要件(REQ-FIX-1〜6)について、詳細な実装仕様を定義しました。各修正は独立性が高く、並列実装が可能な構造になっています。

**主要な決定事項:**
1. **REQ-FIX-1**: CLAUDE.mdテンプレートへのuserIntent埋込は、AIへの指示として機能し、将来の自動化基盤となる構造を採用
2. **REQ-FIX-2**: userIntent優先のスキップ判定は、ユーザー明示指示→ユーザー指定スキップ→スコープベース判定の3段階優先順位を技術的に強制
3. **REQ-FIX-3**: AST解析キャッシュは、ファイルハッシュベースの2層構造(メモリ + 永続化)を採用し、50分→5秒の短縮を実現
4. **REQ-FIX-4**: BFS依存解析は、バッチ並列処理(Promise.all)とimportキャッシュの組み合わせにより、200秒→5秒の短縮を実現
5. **REQ-FIX-5**: タスクインデックスは、taskId→pathのフラットJSON構造を採用し、2秒→10msの高速化を実現
6. **REQ-FIX-6**: fail-closed統一は、全エラーケースでexit(2)を返す単純明快な設計を採用し、セキュリティ原則との整合性を確保

**次フェーズで必要な情報:**
- 各修正の実装順序は、REQ-FIX-6(fail-closed)→ REQ-FIX-1,2(UX)→ REQ-FIX-3,4,5(性能)の段階的アプローチを推奨
- REQ-FIX-3とREQ-FIX-4のキャッシュ戦略は類似しているが、統一キャッシュマネージャーの導入は将来の拡張として位置付ける
- REQ-FIX-6のfail-closed原則は、他フックにも波及するため、phase-edit-guard.js等の同時レビューが必須

## 検索キーワード索引

本仕様書は各fix項目の技術的詳細とユーザー要件(userintent)の伝搬方式をカバーしています。
REQ-FIX-1ではCLAUDE.mdテンプレートへのuserintent埋込設計を定義し、全フェーズにユーザーの意図を伝達する仕組みを構築しました。
REQ-FIX-4のbfs依存解析最適化では、非同期バッチ処理によりトラバーサル性能を大幅に改善する設計を採用しています。
REQ-FIX-5のdiscovertasksメソッド高速化では、task-index.jsonによるO(1)検索を実現し、タスク取得時間を2秒から10msへ短縮します。
各fix項目は独立性が高く並列実装が可能であり、userintent関連修正を最優先で進める方針です。
bfs走査の最適化とdiscovertasksインデックス化は性能改善カテゴリとして同時着手できる構造になっています。

## 概要

本仕様書は、workflow-pluginの厳格レビューにより発見された6件の問題(REQ-FIX-1〜6)の根本原因を追究し、全て修正するための詳細な実装仕様を定義します。
各修正項目は、ユーザーエクスペリエンス改善(REQ-FIX-1, 2)、性能改善(REQ-FIX-3, 4, 5)、セキュリティ強化(REQ-FIX-6)の3つのカテゴリに分類され、独立した実装が可能な構造となっています。
特にREQ-FIX-6のfail-closed原則は、全フックに波及するセキュリティ上の重要な変更であり、最優先で実装する必要があります。
また、REQ-FIX-3〜5の性能改善により、大規模プロジェクト(1000ファイル以上)での検証時間を大幅に短縮し、開発者の生産性向上を実現します。
本仕様書では、各修正の変更対象ファイル、変更内容、エラーハンドリング方針、検証方法を明確に定義し、実装者が迷うことなく作業を進められるよう詳細な設計判断の根拠を示しています。

## ユーザーの意図

workflow-pluginの厳格レビューで発見された6件の問題の根本原因を追究し全て修正する。
具体的には、userIntent未埋込問題(REQ-FIX-1)の修正により、ユーザーの意図を全フェーズに伝搬させる。
スコープ判定のみのスキップ問題(REQ-FIX-2)の修正により、ユーザー明示指示を優先する。
AST解析非インクリメンタル問題(REQ-FIX-3)の修正により、大規模プロジェクトでの検証時間を短縮する。
BFS依存解析非効率問題(REQ-FIX-4)とタスクスキャン問題(REQ-FIX-5)の修正により、性能を大幅に改善する。
fail-open設計問題(REQ-FIX-6)の修正により、セキュリティ原則との整合性を確保する。

---

## 修正一覧

| ID | 問題 | 優先度 | 主要ファイル | 期待効果 |
|----|------|--------|-------------|---------|
| REQ-FIX-1 | userIntent未埋込 | P0(最重要) | CLAUDE.md | ユーザー意図の全フェーズ伝搬 |
| REQ-FIX-2 | スコープ判定のみのスキップ | P0(最重要) | definitions.ts, next.ts | ユーザー明示指示の優先実現 |
| REQ-FIX-3 | AST解析非インクリメンタル | P1(重要) | design-validator.ts | 50分→5秒の性能改善 |
| REQ-FIX-4 | BFS依存解析非効率 | P1(重要) | scope-validator.ts | 200秒→5秒の性能改善 |
| REQ-FIX-5 | 全タスクスキャン | P1(重要) | manager.ts | 2秒→10msの性能改善 |
| REQ-FIX-6 | fail-open設計 | P0(最重要・セキュリティ) | loop-detector.js | セキュリティ原則との整合性確保 |

---

## 変更対象ファイル

本タスクで変更する対象ファイルは以下の8ファイルです。
REQ-FIX-1はCLAUDE.mdのテンプレート修正、REQ-FIX-2はdefinitions.tsとnext.tsのスキップ判定ロジック修正を行います。
REQ-FIX-3はdesign-validator.tsへのAST解析キャッシュ導入、REQ-FIX-4はscope-validator.tsのBFS非同期化を実施します。
REQ-FIX-5はmanager.tsへのタスクインデックス導入、REQ-FIX-6はloop-detector.jsと他フックのfail-closed統一を行います。
各ファイルの変更の詳細は、後続のREQ-FIX-1〜6セクションに記載しています。

| ファイル | 修正ID | 変更概要 |
|---------|--------|---------|
| workflow-plugin/CLAUDE.md | REQ-FIX-1 | subagentテンプレートにuserIntent追加 |
| workflow-plugin/mcp-server/src/phases/definitions.ts | REQ-FIX-2 | calculatePhaseSkips()にuserIntent引数追加 |
| workflow-plugin/mcp-server/src/tools/next.ts | REQ-FIX-2 | calculatePhaseSkips呼び出し箇所の修正 |
| workflow-plugin/mcp-server/src/validation/design-validator.ts | REQ-FIX-3 | AST解析結果キャッシュの導入 |
| workflow-plugin/mcp-server/src/validation/scope-validator.ts | REQ-FIX-4 | BFS依存解析の非同期化とimportキャッシュ |
| workflow-plugin/mcp-server/src/state/manager.ts | REQ-FIX-5 | task-index.jsonによるタスク取得高速化 |
| workflow-plugin/hooks/loop-detector.js | REQ-FIX-6 | 全エラーケースでexit(2)に統一 |
| workflow-plugin/hooks/phase-edit-guard.js | REQ-FIX-6 | fail-closed原則の適用 |

---

## REQ-FIX-1: subagentテンプレートへのuserIntent埋込

### REQ-FIX-1の変更対象ファイル

- `workflow-plugin/CLAUDE.md` (Line 193-248): subagent起動テンプレート
- `workflow-plugin/CLAUDE.md` (新規セクション): Orchestratorパターン説明への追記
- `workflow-plugin/CLAUDE.md` (既存セクション): 成果物必須セクションへの追記

### REQ-FIX-1の変更内容

#### 1. CLAUDE.mdテンプレート修正(Line 193-248)

**FR-1.1の変更前:**
```markdown
### subagent起動テンプレート

各フェーズでsubagentを起動する際は以下の形式を使用:

~~~
Task({
  prompt: `
    # {フェーズ名}フェーズ

    ## タスク情報
    - タスク名: {taskName}
    - 出力先: docs/workflows/{taskName}/
~~~
```

**FR-1.1の変更後:**
```markdown
### subagent起動テンプレート

各フェーズでsubagentを起動する際は以下の形式を使用:

~~~
Task({
  prompt: `
    # {フェーズ名}フェーズ

    ## タスク情報
    - タスク名: {taskName}
    - ユーザーの意図: {userIntent}
    - 出力先: docs/workflows/{taskName}/
~~~
```

**FR-1.1の設計判断:**
- テンプレート内の配置は「タスク名」の直後とし、ユーザー意図の重要性を強調
- プレースホルダーは `{userIntent}` とし、他のプレースホルダーと統一された記法を採用
- 全19フェーズのテンプレートに一律適用(research除く18フェーズ)

#### 2. Orchestratorパターン説明への追記(新規セクション)

**追記位置:** CLAUDE.mdの「### Orchestratorパターン」セクション直後

**追記内容:**
```markdown
### userIntent伝搬の実装

Orchestratorが各フェーズでsubagentを起動する際、以下の手順でuserIntentを伝搬します:

1. **TaskCreate時にpromptテンプレートを構築**
   - subagent起動テンプレートを読み込み
   - テンプレート内のプレースホルダーを識別

2. **{userIntent}をtaskState.userIntentで置換**
   - TaskState.userIntentフィールドから値を取得
   - テンプレートリテラルによる埋込を実施

3. **置換後のpromptでsubagentを起動**
   - Task toolに渡すprompt引数を完成
   - model, subagent_type等の他パラメータと共に実行

**実装例:**
~~~typescript
// Orchestrator側の実装イメージ
const taskState = getTaskById(taskId);
const promptTemplate = `
  # requirementsフェーズ

  ## タスク情報
  - タスク名: \${taskName}
  - ユーザーの意図: \${userIntent}
  - 出力先: docs/workflows/\${taskName}/
`;

const prompt = eval('`' + promptTemplate + '`'); // テンプレートリテラル展開

Task({
  prompt,
  subagent_type: 'general-purpose',
  model: 'sonnet',
  description: 'requirements'
});
~~~

**注意事項:**
- 本実装はAIへの指示として機能し、自動化は将来の拡張として位置付ける
- userIntentがnull/undefinedの場合、taskNameをフォールバック値として使用
```

**FR-1.2の設計判断:**
- 具体的なコード例を含めることで、AIの理解度を向上させる
- 将来の自動化基盤として機能するよう、手順を明確化
- フォールバック動作を明記し、後方互換性を確保

#### 3. 成果物必須セクションへの追記

**追記位置:** CLAUDE.mdの「## ★重要★ サマリーセクション必須化(REQ-B4)」セクション

**FR-1.3の変更前:**
```markdown
# [テンプレート] サマリーセクション必須化(REQ-B4)
成果物の先頭には必ず以下のセクションを配置してください:

# [テンプレート] サマリー

(50行以内で、このドキュメントの要点を記述)
```

**FR-1.3の変更後:**
```markdown
# [テンプレート] 成果物必須セクション(REQ-B4, REQ-FIX-1)
成果物の先頭には必ず以下のセクションを配置してください:

# [テンプレート] サマリー

(50行以内で、このドキュメントの要点を記述)

# [テンプレート] ユーザーの意図

(TaskState.userIntentの内容をそのまま記載)

※「ユーザーの意図」セクションには、TaskState.userIntentフィールドの値を1行で記載してください。この情報により、後続フェーズでユーザーの具体的指示を参照できます。
```

**FR-1.3の設計判断:**
- サマリーセクションの直後に配置し、成果物の冒頭で意図を明確化
- userIntentは1行で簡潔に記載し、冗長化を防止
- REQ-FIX-1準拠であることを明記

### REQ-FIX-1のエラーハンドリング方針

| REQ-FIX-1 エラーケース | 対応方針 |
|:----------------|:----------|
| userIntentがnull/undefined | taskNameをフォールバック値として使用 |
| userIntentが空文字列 | 「(指定なし)」と記載 |
| userIntentが10000文字を超える | start.tsで既に10000文字に切り詰められているため追加処理不要 |

### REQ-FIX-1の検証方法

1. **テンプレート整合性チェック**
   - CLAUDE.mdの全subagentテンプレート(18フェーズ)に「ユーザーの意図: {userIntent}」が含まれることを確認
   - grep等でプレースホルダーの存在をチェック

2. **E2Eテスト**
   - workflow_start("テスト機能実装", userIntent: "ユニットテストとE2Eテストを実装する")を実行
   - requirements.mdに「## ユーザーの意図」セクションが含まれることを確認
   - セクション内容が"ユニットテストとE2Eテストを実装する"であることを確認

3. **フォールバック動作確認**
   - workflow_start("サンプルタスク")(userIntent省略)を実行
   - requirements.mdの「## ユーザーの意図」に"サンプルタスク"が記載されることを確認

---

## REQ-FIX-2: ユーザー意図優先のフェーズスキップ判定

### REQ-FIX-2の変更対象ファイル

- `workflow-plugin/mcp-server/src/phases/definitions.ts` (Line 459): calculatePhaseSkips()関数
- `workflow-plugin/mcp-server/src/tools/next.ts` (Line 398): calculatePhaseSkips()呼び出し箇所

### REQ-FIX-2の変更内容

#### 1. definitions.ts: calculatePhaseSkips()のシグネチャ変更

**FR-2.1の変更前(Line 459):**
```typescript
export function calculatePhaseSkips(scope: { affectedFiles?: string[]; files?: string[] }): Record<string, string>
```

**FR-2.1の変更後:**
```typescript
/**
 * REQ-C3: 動的フェーズスキップ判定
 *
 * スキップ判定の優先順位(REQ-FIX-2準拠):
 * 1. ユーザー明示指示(userIntentの内容) - 最優先
 * 2. ユーザー指定スキップ(--skip-phases) - next.ts側で後マージ
 * 3. スコープベース自動判定(拡張子) - 最終フォールバック
 *
 * @param scope - 影響範囲(ファイル・ディレクトリ)
 * @param userIntent - ユーザーの意図(workflow_start時の指示内容)
 * @returns フェーズID → スキップ理由のマッピング
 */
export function calculatePhaseSkips(
  scope: { affectedFiles?: string[]; files?: string[] },
  userIntent?: string
): Record<string, string>
```

**FR-2.1の設計判断:**
- userIntentパラメータはオプショナル(`?`)とし、後方互換性を確保
- JSDocコメントに優先順位を明記し、保守性を向上
- REQ-FIX-2準拠であることをコメントに明記

#### 2. definitions.ts: userIntentベースのtest_impl判定(Line 475付近)

**FR-2.2の変更前(Line 497-500):**
```typescript
// テストファイルがない場合
if (!hasTestFiles) {
  phaseSkipReasons['test_impl'] = 'テストファイルが影響範囲に含まれないため(従来の単純な判定)';
}
```

**FR-2.2の変更後:**
```typescript
// REQ-FIX-2: ユーザー意図ベースのtest_implスキップ判定
if (userIntent) {
  const intentLower = userIntent.toLowerCase();

  // テスト関連キーワードの検出(日本語・英語両対応)
  const testKeywords = [
    'テスト', 'test', '試験', 'testing',
    'ユニットテスト', 'unit test', 'unittest',
    'e2eテスト', 'e2e test', 'e2e',
  ];
  const hasTestIntent = testKeywords.some(keyword => intentLower.includes(keyword.toLowerCase()));

  if (hasTestIntent) {
    // ユーザーがテストを明示的に指示している場合、test_implをスキップしない
    // phaseSkipReasons['test_impl'] を設定しない(何もしない)
  } else {
    // ユーザー意図にテストが含まれない場合、従来のスコープベース判定
    if (!hasTestFiles) {
      phaseSkipReasons['test_impl'] = 'テストファイルが影響範囲に含まれないため(スコープベース判定)';
    }
  }
} else {
  // userIntentがない場合は従来のスコープベース判定
  if (!hasTestFiles) {
    phaseSkipReasons['test_impl'] = 'テストファイルが影響範囲に含まれないため(フォールバック判定)';
  }
}

// 同様の判定をimplementationフェーズにも追加
if (userIntent) {
  const intentLower = userIntent.toLowerCase();

  // 実装関連キーワードの検出
  const implKeywords = [
    '実装', 'implementation', 'implement',
    'コード', 'code', 'coding',
    '開発', 'develop', 'development',
  ];
  const hasImplIntent = implKeywords.some(keyword => intentLower.includes(keyword.toLowerCase()));

  if (!hasImplIntent && !hasCodeFiles) {
    phaseSkipReasons['implementation'] = 'コードファイルが影響範囲に含まれないため';
  }
} else {
  if (!hasCodeFiles) {
    phaseSkipReasons['implementation'] = 'コードファイルが影響範囲に含まれないため';
  }
}
```

**FR-2.2の設計判断:**
- テストキーワードは日本語・英語の両方に対応し、ユーザーの自然言語を幅広くカバー
- キーワード配列は将来的な拡張を考慮し、メンテナンス性を確保
- 同様の判定をimplementationフェーズにも適用し、一貫性を保つ
- ネストを最小化し、可読性を向上

#### 3. next.ts: calculatePhaseSkips()呼び出しの修正(Line 398)

**FR-2.3の変更前:**
```typescript
// REQ-C3: 動的フェーズスキップ判定(自動検出)
const phaseSkipReasons = calculatePhaseSkips(taskState.scope || {});
```

**FR-2.3の変更後:**
```typescript
// REQ-C3: 動的フェーズスキップ判定(自動検出)
// REQ-FIX-2: userIntent優先のスキップ判定
const phaseSkipReasons = calculatePhaseSkips(taskState.scope || {}, taskState.userIntent);
```

**FR-2.3の設計判断:**
- taskState.userIntentをそのまま渡し、null/undefinedの場合はdefinitions.ts側でフォールバック
- コメントにREQ-FIX-2準拠であることを明記

### REQ-FIX-2のエラーハンドリング方針

| REQ-FIX-2 エラーケース | 対応方針 |
|:---------------|:---------|
| userIntentがnull/undefined | スコープベース判定にフォールバック |
| userIntentが空文字列 | スコープベース判定にフォールバック |
| テストキーワードが部分一致で誤検知 | 許容(誤検知よりも見逃しを防ぐ設計) |

### REQ-FIX-2の検証方法

1. **ユーザー意図優先のテスト**
   - スコープ: `files: ["docs/README.md"]` (.mdのみ)
   - userIntent: "ユニットテストを追加する"
   - 期待結果: test_implフェーズがスキップされない

2. **スコープベース判定のフォールバック**
   - スコープ: `files: ["docs/README.md"]`
   - userIntent: null
   - 期待結果: test_implフェーズがスキップされる

3. **実装キーワードのテスト**
   - スコープ: `files: ["docs/README.md"]`
   - userIntent: "新機能を実装する"
   - 期待結果: implementationフェーズがスキップされない

---

## REQ-FIX-3: design-validatorのAST解析インクリメンタル化

### REQ-FIX-3の変更対象ファイル

- `workflow-plugin/mcp-server/src/validation/design-validator.ts` (新規フィールド・メソッド追加)
- `.claude/cache/ast-analysis.json` (新規ファイル)

### 新規追加インターフェース

#### ASTCacheEntry

```typescript
/**
 * AST解析結果のキャッシュエントリ
 */
interface ASTCacheEntry {
  /** ファイルのMD5ハッシュ */
  hash: string;
  /** AST解析結果 */
  result: ASTAnalysisResult;
  /** キャッシュ作成時刻(UNIX timestamp) */
  timestamp: number;
}
```

### REQ-FIX-3の変更内容

#### 1. design-validator.ts: クラスフィールド追加

**変更前(Line 35-38):**
```typescript
export class DesignValidator {
  private workflowDir: string;
  private projectRoot: string;
  private fileCache: Map<string, { content: string; cleanContent: string }> = new Map();
```

**変更後:**
```typescript
export class DesignValidator {
  private workflowDir: string;
  private projectRoot: string;
  private fileCache: Map<string, { content: string; cleanContent: string }> = new Map();
  private astCache: Map<string, ASTCacheEntry> = new Map(); // REQ-FIX-3: AST解析結果キャッシュ
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間
  private cacheHits = 0; // 性能メトリクス用
  private cacheMisses = 0; // 性能メトリクス用
  private totalTimeMs = 0; // 解析時間累計
```

#### 2. design-validator.ts: コンストラクタ修正

**変更前(Line 46-49):**
```typescript
constructor(workflowDir: string, projectRoot?: string) {
  this.workflowDir = workflowDir;
  this.projectRoot = projectRoot || process.cwd();
}
```

**変更後:**
```typescript
constructor(workflowDir: string, projectRoot?: string) {
  this.workflowDir = workflowDir;
  this.projectRoot = projectRoot || process.cwd();
  // REQ-FIX-3: 永続化キャッシュの読み込み
  this.loadPersistedCache();
  // REQ-FIX-3: 期限切れキャッシュの削除
  this.evictExpiredCache();
}
```

#### 3. design-validator.ts: hashFile()メソッド追加

```typescript
// FR-3.1: ファイルハッシュ計算
/**
 * ファイルのMD5ハッシュを計算(REQ-FIX-3)
 *
 * @param fullPath ファイルの絶対パス
 * @returns MD5ハッシュ(16進数文字列)
 */
private hashFile(fullPath: string): string {
  const content = fs.readFileSync(fullPath, 'utf-8');
  return crypto.createHash('md5').update(content).digest('hex');
}
```

#### 4. design-validator.ts: analyzeWithCache()メソッド追加

```typescript
// FR-3.2: キャッシュ付きAST解析
/**
 * AST解析をキャッシュ付きで実行(REQ-FIX-3)
 *
 * @param fullPath ファイルの絶対パス
 * @returns AST解析結果、またはnull(解析失敗時)
 */
private analyzeWithCache(fullPath: string): ASTAnalysisResult | null {
  const startTime = Date.now();
  const currentHash = this.hashFile(fullPath);
  const cached = this.astCache.get(fullPath);

  if (cached && cached.hash === currentHash) {
    // キャッシュヒット
    this.cacheHits++;
    return cached.result;
  }

  // キャッシュミス: 新規解析
  this.cacheMisses++;
  const result = analyzeTypeScriptFile(fullPath);
  const elapsed = Date.now() - startTime;
  this.totalTimeMs += elapsed;

  if (result) {
    this.astCache.set(fullPath, {
      hash: currentHash,
      result,
      timestamp: Date.now(),
    });
  }

  if (elapsed > 50) {
    console.warn(`[Design Validator] AST analysis took ${elapsed}ms for ${path.relative(this.projectRoot, fullPath)}`);
  }

  return result;
}
```

#### 5. design-validator.ts: searchInFiles()の修正(Line 406-444)

**FR-3.3の変更前(Line 412-413):**
```typescript
const startTime = Date.now();
const astResult = analyzeTypeScriptFile(fullPath);
const elapsed = Date.now() - startTime;
```

**FR-3.3の変更後:**
```typescript
// REQ-FIX-3: キャッシュ付きAST解析に変更
const astResult = this.analyzeWithCache(fullPath);
```

**FR-3.3の設計判断:**
- analyzeWithCache()内で時間計測を行うため、searchInFiles()内の計測コードは削除
- キャッシュヒット時は瞬時に結果を返すため、50ms超過の警告が出なくなる

#### 6. design-validator.ts: loadPersistedCache()メソッド追加

```typescript
// FR-3.4: 永続化キャッシュ読み込み
/**
 * 永続化キャッシュを読み込む(REQ-FIX-3)
 */
private loadPersistedCache(): void {
  const cachePath = path.join(this.projectRoot, '.claude/cache/ast-analysis.json');
  if (!fs.existsSync(cachePath)) {
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    for (const [filePath, entry] of Object.entries(data)) {
      this.astCache.set(filePath, entry as ASTCacheEntry);
    }
    console.log(`[Design Validator] Loaded ${this.astCache.size} cached AST entries`);
  } catch (err) {
    console.warn(`[Design Validator] Failed to load persisted cache: ${err}`);
  }
}
```

#### 7. design-validator.ts: persistCache()メソッド追加

```typescript
// FR-3.5: キャッシュ永続化
/**
 * キャッシュを永続化する(REQ-FIX-3)
 */
private persistCache(): void {
  const cachePath = path.join(this.projectRoot, '.claude/cache/ast-analysis.json');
  const data = Object.fromEntries(this.astCache);

  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
    console.log(`[Design Validator] Persisted ${this.astCache.size} AST entries to cache`);
  } catch (err) {
    console.warn(`[Design Validator] Failed to persist cache: ${err}`);
  }
}
```

#### 8. design-validator.ts: evictExpiredCache()メソッド追加

```typescript
// FR-3.6: 期限切れキャッシュ削除
/**
 * 期限切れキャッシュを削除(REQ-FIX-3)
 */
private evictExpiredCache(): void {
  const now = Date.now();
  let evictedCount = 0;

  for (const [filePath, entry] of this.astCache.entries()) {
    if (now - entry.timestamp > this.CACHE_TTL_MS) {
      this.astCache.delete(filePath);
      evictedCount++;
    }
  }

  if (evictedCount > 0) {
    console.log(`[Design Validator] Evicted ${evictedCount} expired cache entries`);
  }
}
```

#### 9. design-validator.ts: validateAll()の修正(Line 274-278)

**変更前(Line 276-278):**
```typescript
// キャッシュクリア(REQ-3)
this.clearCache();

return result;
```

**変更後:**
```typescript
// REQ-3: ファイル内容キャッシュのクリア
this.clearCache();

// REQ-FIX-3: AST解析キャッシュの永続化
this.persistCache();

return result;
```

#### 10. design-validator.ts: getMetrics()メソッド追加

```typescript
// FR-3.7: 性能メトリクス取得
/**
 * 性能メトリクスを取得(REQ-FIX-3)
 *
 * @returns ヒット率と平均解析時間
 */
public getMetrics(): { hitRate: number; avgTimeMs: number; hits: number; misses: number } {
  const total = this.cacheHits + this.cacheMisses;
  const hitRate = total > 0 ? this.cacheHits / total : 0;
  const avgTimeMs = this.cacheMisses > 0 ? this.totalTimeMs / this.cacheMisses : 0;

  return {
    hitRate,
    avgTimeMs,
    hits: this.cacheHits,
    misses: this.cacheMisses,
  };
}
```

### REQ-FIX-3のエラーハンドリング方針

| REQ-FIX-3 エラーケース | 対応方針 |
|:--------------|:----------|
| ast-analysis.json読み込み失敗 | ログ警告を出力し、空のキャッシュとして続行 |
| ast-analysis.json書き込み失敗 | ログ警告を出力し、次回検証時に再生成 |
| ファイルハッシュ計算失敗 | 例外をスローし、検証を中止 |
| AST解析失敗 | nullを返し、正規表現ベースのフォールバックを使用 |

### 性能目標

| 指標 | 初回 | 2回目以降(キャッシュヒット時) |
|------|------|------------------------------|
| 1000ファイルプロジェクト | 60秒以内 | 5秒以内 |
| キャッシュヒット率 | 0% | 90%以上 |
| 平均解析時間/ファイル | 30ms | <1ms |

### REQ-FIX-3の検証方法

1. **初回解析の性能計測**
   - 1000ファイルのプロジェクトで設計検証を実行
   - 実行時間を記録(目標: 60秒以内)

2. **2回目解析の性能計測**
   - 同一プロジェクトで再度設計検証を実行
   - 実行時間を記録(目標: 5秒以内)
   - getMetrics()でキャッシュヒット率を確認(目標: 90%以上)

3. **キャッシュ無効化の確認**
   - ファイルを変更後に再検証
   - 変更ファイルのキャッシュが無効化され、再解析されることを確認

---

## REQ-FIX-4: scope-validatorのBFS依存解析非同期化

### REQ-FIX-4の変更対象ファイル

- `workflow-plugin/mcp-server/src/validation/scope-validator.ts` (Line 445-540): trackDependencies()関数
- 同上の呼び出し元ファイル全箇所

### 新規追加インターフェース

#### ImportCacheEntry

```typescript
/**
 * import抽出結果のキャッシュエントリ
 */
interface ImportCacheEntry {
  /** ファイルのMD5ハッシュ */
  hash: string;
  /** 抽出されたimport一覧 */
  imports: string[];
}
```

### REQ-FIX-4の変更内容

#### 1. scope-validator.ts: trackDependencies()の非同期化(Line 445)

**FR-4.1の変更前:**
```typescript
export function trackDependencies(
  affectedFiles: string[],
  affectedDirs: string | string[],
  options: { maxDepth?: number } = {},
): DependencyTrackingResult
```

**FR-4.1の変更後:**
```typescript
/**
 * 依存関係を追跡(非同期版)
 *
 * REQ-FIX-4: BFS走査をバッチ並列処理化し、I/Oブロッキングを削減する。
 *
 * @param affectedFiles 影響を受けるファイル一覧
 * @param affectedDirs 影響を受けるディレクトリ(文字列またはその配列)
 * @param options オプション(maxDepth: 最大深度、batchSize: バッチサイズ)
 * @returns 依存関係追跡結果のPromise
 */
export async function trackDependencies(
  affectedFiles: string[],
  affectedDirs: string | string[],
  options: { maxDepth?: number; batchSize?: number } = {},
): Promise<DependencyTrackingResult>
```

**FR-4.1の設計判断:**
- 戻り値をPromise<DependencyTrackingResult>に変更
- optionsにbatchSize?: numberを追加(デフォルト: 10)
- JSDocコメントにREQ-FIX-4準拠であることを明記

#### 2. scope-validator.ts: importキャッシュの追加

**関数外(グローバルスコープ):**
```typescript
// FR-4.2: importキャッシュの導入
/** REQ-FIX-4: import抽出結果のキャッシュ */
const importCache = new Map<string, ImportCacheEntry>();
const IMPORT_CACHE_MAX_SIZE = 10000;

/**
 * import抽出をキャッシュ付きで実行(REQ-FIX-4)
 *
 * @param filePath ファイルパス
 * @param content ファイル内容
 * @returns 抽出されたimport一覧
 */
function extractImportsWithCache(filePath: string, content: string): string[] {
  const hash = crypto.createHash('md5').update(content).digest('hex');
  const cacheKey = `${filePath}:${hash}`;

  const cached = importCache.get(cacheKey);
  if (cached && cached.hash === hash) {
    return cached.imports;
  }

  const imports = extractImports(content, filePath);

  // キャッシュサイズ制限
  if (importCache.size >= IMPORT_CACHE_MAX_SIZE) {
    const firstKey = importCache.keys().next().value as string;
    if (firstKey) importCache.delete(firstKey);
  }

  importCache.set(cacheKey, { hash, imports });
  return imports;
}
```

#### 3. scope-validator.ts: バッチ並列処理の実装(Line 486付近)

**FR-4.3の変更前:**
```typescript
while (queue.length > 0) {
  const { file, depth, parent } = queue.shift()!;

  // ... 省略 ...

  try {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');  // ★同期読み込み★
    const imports = extractImports(content, file);
```

**FR-4.3の変更後:**
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

      // REQ-FIX-4: 非同期ファイル読み込み
      const content = await fs.promises.readFile(file, 'utf-8');

      // REQ-FIX-4: キャッシュ付きimport抽出
      const imports = extractImportsWithCache(file, content);

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

**FR-4.3の設計判断:**
- バッチサイズのデフォルトは10とし、並列I/Oと逐次処理のバランスを確保
- queue.splice()でバッチ取得し、配列の先頭から順に処理
- Promise.all()でバッチ内のファイルを並列処理
- エラーハンドリングは各ファイル単位でcatch()し、他ファイルに影響させない

#### 4. scope-validator.ts: 呼び出し元の非同期対応

**変更箇所例(set-scope.ts, scope-validator.ts内の他関数):**

**FR-4.4の変更前:**
```typescript
const trackingResult = trackDependencies(files, dirs, { maxDepth: 2 });
```

**FR-4.4の変更後:**
```typescript
const trackingResult = await trackDependencies(files, dirs, { maxDepth: 2 });
```

**該当ファイル一覧:**
- `workflow-plugin/mcp-server/src/tools/set-scope.ts` (Line 112付近)
- `workflow-plugin/mcp-server/src/validation/scope-validator.ts` (validateFilesInScope関数内)

**FR-4.4の設計判断:**
- trackDependencies()を呼び出す全関数をasync化
- 呼び出し元のエラーハンドリングはそのまま維持(try-catch)

### REQ-FIX-4のエラーハンドリング方針

| REQ-FIX-4 エラーケース | 対応方針 |
|:-------------|:-----------|
| ファイル読み込み失敗 | そのファイルをスキップし、他ファイルの処理を続行 |
| import解析失敗 | 空配列を返し、依存関係がないものとして扱う |
| Promise.all()でバッチ全体が失敗 | 例外をスローし、上位関数でエラーハンドリング |

### 性能目標

| 指標 | 初回(同期版) | 初回(非同期版) | 2回目以降(キャッシュヒット) |
|------|--------------|----------------|------------------------------|
| 1000ファイルプロジェクト | 200秒 | 30秒 | 5秒 |
| 平均ファイル読み込み時間 | 1ms(同期) | 0.2ms(並列) | <0.1ms(キャッシュ) |

### REQ-FIX-4の検証方法

1. **初回解析の性能計測**
   - 1000ファイルのプロジェクトでtrackDependencies()を実行
   - 実行時間を記録(目標: 30秒以内)

2. **2回目解析の性能計測**
   - 同一プロジェクトで再度trackDependencies()を実行
   - 実行時間を記録(目標: 5秒以内)
   - importキャッシュのヒット率を確認

3. **並列処理の確認**
   - console.logでバッチサイズを出力
   - 「Processing batch of 10 files...」が出力されることを確認

---

## REQ-FIX-5: discoverTasks()のインデックス化

### REQ-FIX-5の変更対象ファイル

- `workflow-plugin/mcp-server/src/state/manager.ts` (新規フィールド・メソッド追加)
- `.claude/state/task-index.json` (新規ファイル)

### 新規ファイルフォーマット

#### task-index.json

```json
{
  "20260214_175140": "workflows/20260214_175140_レビュー指摘6件",
  "20260214_104242": "workflows/20260214_104242_レビュー指摘事項全件修正",
  "20260214_124954": "workflows/20260214_124954_MCP問題根本原因修正"
}
```

**設計判断:**
- フラットなJSON構造(taskId: relativePath)
- pathは`.claude/state/`からの相対パスとし、ポータビリティを確保
- pretty-print(インデント2スペース)により手動編集を可能に

### REQ-FIX-5の変更内容

#### 1. manager.ts: クラスフィールド追加

**変更前:**
```typescript
export class StateManager {
  private stateDir: string;
  private workflowDir: string;
  private docsDir: string;
  private docsBase: string;
```

**変更後:**
```typescript
export class StateManager {
  private stateDir: string;
  private workflowDir: string;
  private docsDir: string;
  private docsBase: string;
  private indexPath: string; // REQ-FIX-5: task-index.jsonのパス
```

#### 2. manager.ts: コンストラクタ修正

**変更後:**
```typescript
constructor() {
  this.stateDir = STATE_DIR;
  this.workflowDir = WORKFLOW_DIR;
  this.docsDir = DOCS_DIR;
  this.docsBase = DOCS_BASE;
  this.indexPath = path.join(this.stateDir, 'task-index.json'); // REQ-FIX-5
}
```

#### 3. manager.ts: loadTaskIndex()メソッド追加

```typescript
// FR-5.1: インデックス読み込み
/**
 * task-index.jsonを読み込む(REQ-FIX-5)
 *
 * @returns taskId → relativePath のマッピング
 */
private loadTaskIndex(): Record<string, string> {
  if (!fs.existsSync(this.indexPath)) {
    return {};
  }

  try {
    const data = fs.readFileSync(this.indexPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.warn('[StateManager] Failed to load task index, rebuilding...', err);
    return this.rebuildTaskIndex();
  }
}
```

#### 4. manager.ts: saveTaskIndex()メソッド追加

```typescript
// FR-5.2: インデックス保存
/**
 * task-index.jsonを保存(REQ-FIX-5)
 *
 * @param index 保存するインデックス
 */
private saveTaskIndex(index: Record<string, string>): void {
  try {
    fs.mkdirSync(path.dirname(this.indexPath), { recursive: true });
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  } catch (err) {
    console.warn('[StateManager] Failed to save task index:', err);
  }
}
```

#### 5. manager.ts: rebuildTaskIndex()メソッド追加

```typescript
// FR-5.3: インデックス再構築
/**
 * task-index.jsonを再構築(REQ-FIX-5)
 *
 * インデックスが破損した場合のフォールバック処理。
 * 全タスクをスキャンしてインデックスを再生成する。
 *
 * @returns 再構築されたインデックス
 */
private rebuildTaskIndex(): Record<string, string> {
  console.log('[StateManager] Rebuilding task index...');
  const tasks = this.discoverTasks(); // 従来の全スキャン
  const index: Record<string, string> = {};

  for (const task of tasks) {
    const taskDirName = `${task.taskId}_${task.taskName}`;
    const relativePath = path.join('workflows', taskDirName);
    index[task.taskId] = relativePath;
  }

  this.saveTaskIndex(index);
  console.log(`[StateManager] Rebuilt task index with ${tasks.length} entries`);
  return index;
}
```

#### 6. manager.ts: getTaskById()の高速化(Line 574付近)

**変更前:**
```typescript
getTaskById(taskId: string): TaskState | null {
  const tasks = this.discoverTasks();
  return tasks.find(t => t.taskId === taskId) ?? null;
}
```

**変更後:**
```typescript
// FR-5.4: インデックスベースの高速タスク取得
/**
 * タスクIDからタスク状態を取得(REQ-FIX-5: インデックス化)
 *
 * @param taskId タスクID
 * @returns タスク状態、または null(存在しない場合)
 */
getTaskById(taskId: string): TaskState | null {
  // REQ-FIX-5: インデックスから直接パスを取得
  const index = this.loadTaskIndex();
  const relativePath = index[taskId];

  if (relativePath) {
    const taskPath = path.join(this.stateDir, relativePath);
    const stateFile = path.join(taskPath, 'workflow-state.json');

    if (fs.existsSync(stateFile)) {
      try {
        return this.readTaskState(taskPath);
      } catch (err) {
        console.warn(`[StateManager] Failed to read task ${taskId}, removing from index:`, err);
        // インデックスから削除
        delete index[taskId];
        this.saveTaskIndex(index);
      }
    } else {
      // ファイルが存在しない場合、インデックスから削除
      console.warn(`[StateManager] Task ${taskId} not found, removing from index`);
      delete index[taskId];
      this.saveTaskIndex(index);
    }
  }

  // フォールバック: インデックスにない場合は全スキャン
  console.warn(`[StateManager] Task ${taskId} not in index, falling back to full scan`);
  const tasks = this.discoverTasks();
  const task = tasks.find(t => t.taskId === taskId) ?? null;

  if (task) {
    // インデックスに追加
    const taskDirName = `${task.taskId}_${task.taskName}`;
    const newRelativePath = path.join('workflows', taskDirName);
    index[taskId] = newRelativePath;
    this.saveTaskIndex(index);
    console.log(`[StateManager] Added task ${taskId} to index`);
  }

  return task;
}
```

**FR-5.4の設計判断:**
- インデックスヒット時は1ファイルのみ読み込み(O(1))
- インデックスミス時は全スキャンにフォールバック(O(N))し、見つかった場合はインデックスに追加
- インデックスとファイルシステムの不整合を検出し、自動修復

#### 7. manager.ts: createTask()でのインデックス更新

**変更前(createTask()内の最後):**
```typescript
// タスク状態をファイルに書き込み
this.writeTaskState(taskDir, taskState);

return taskState;
```

**変更後:**
```typescript
// タスク状態をファイルに書き込み
this.writeTaskState(taskDir, taskState);

// REQ-FIX-5: インデックスに追加
const index = this.loadTaskIndex();
const relativePath = path.relative(this.stateDir, taskDir);
index[taskState.taskId] = relativePath;
this.saveTaskIndex(index);

return taskState;
```

#### 8. manager.ts: updateTaskPhase()でのインデックス削除(completed時)

**変更前(updateTaskPhase()内):**
```typescript
// フェーズを更新
taskState.phase = newPhase;

// 状態を保存
this.writeTaskState(taskState.workflowDir, taskState);
```

**変更後:**
```typescript
// フェーズを更新
taskState.phase = newPhase;

// 状態を保存
this.writeTaskState(taskState.workflowDir, taskState);

// REQ-FIX-5: completedフェーズの場合、インデックスから削除
if (newPhase === 'completed') {
  const index = this.loadTaskIndex();
  delete index[taskId];
  this.saveTaskIndex(index);
  console.log(`[StateManager] Removed completed task ${taskId} from index`);
}
```

### REQ-FIX-5のエラーハンドリング方針

| REQ-FIX-5 エラーケース | 対応方針 |
|:-------------|:---------|
| task-index.json読み込み失敗 | rebuildTaskIndex()で自動再構築 |
| task-index.json書き込み失敗 | ログ警告を出力し、次回アクセス時に再試行 |
| インデックスとファイルシステムの不整合 | インデックスを自動修復 |
| インデックスにない新規タスク | フォールバックしてインデックスに追加 |

### 性能目標

| 指標 | 従来(全スキャン) | 改善後(インデックス) |
|------|------------------|---------------------|
| getTaskById() | 2秒(1000タスク時) | 10ms |
| フック4つ同時起動オーバーヘッド | 8秒 | 40ms |

### REQ-FIX-5の検証方法

1. **初回アクセスの性能計測**
   - task-index.jsonを削除
   - getTaskById()を実行
   - 実行時間を記録(目標: 2秒以内、インデックス自動生成を含む)

2. **2回目アクセスの性能計測**
   - 同じtaskIdでgetTaskById()を実行
   - 実行時間を記録(目標: 10ms以内)

3. **インデックス自動修復の確認**
   - task-index.jsonから任意のエントリを削除
   - getTaskById()を実行
   - フォールバック後にインデックスが自動追加されることを確認

---

## REQ-FIX-6: loop-detectorのfail-closed統一

### REQ-FIX-6の変更対象ファイル

- `workflow-plugin/hooks/loop-detector.js` (Line 381-391, catch句)
- `workflow-plugin/CLAUDE.md` (新規セクション追加)
- `workflow-plugin/hooks/phase-edit-guard.js` (fail-closed統一)
- `workflow-plugin/hooks/enforce-workflow.js` (fail-closed統一)
- `workflow-plugin/hooks/bash-whitelist.js` (fail-closed統一)

### REQ-FIX-6の変更内容

#### 1. loop-detector.js: main()関数のfail-closed化(Line 381-391)

**FR-6.1の変更前:**
```javascript
function main(input) {
  try {
    // 入力の検証
    if (!input || typeof input !== 'object') {
      process.exit(0);  // ★fail-open★
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
      process.exit(0);  // ★fail-open★
    }

    // ループ検出
    checkLoop(filePath);
  } catch (e) {
    // エラー時は許可(安全側に倒す)
    // ★fail-open★
  }

  // 正常終了
  process.exit(0);
}
```

**FR-6.1の変更後:**
```javascript
/**
 * メイン処理(REQ-FIX-6: fail-closed統一)
 *
 * 全エラーケースでexit(2)を返し、CLAUDE.mdのfail-closed原則と整合させる。
 */
function main(input) {
  try {
    // 入力の検証
    if (!input || typeof input !== 'object') {
      logError('入力検証エラー', '入力がオブジェクト型ではありません');
      process.exit(2);  // ★fail-closed: 入力検証エラー★
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
      logError('パス検証エラー', 'ファイルパスが空です');
      process.exit(2);  // ★fail-closed: パス検証エラー★
    }

    // ループ検出
    checkLoop(filePath);
  } catch (e) {
    // エラー時はブロック(fail-closed)
    logError('予期しないエラー', e.message, e.stack);
    process.exit(2);  // ★fail-closed: 予期しないエラー★
  }

  // 正常終了
  process.exit(0);
}
```

**FR-6.1の設計判断:**
- 全エラーケースでlogError()を呼び出し、エラー内容を記録
- catch句も含めて全てexit(2)に統一
- エラーメッセージは日本語で記述し、ユーザーが理解可能に

#### 2. loop-detector.js: logError()関数の強化

**変更前(既存のlogError実装):**
```javascript
function logError(type, message, stack) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${HOOK_NAME}] ${type}: ${message}\n${stack ? `  Stack: ${stack}\n` : ''}\n`;
  try {
    ensureStateDir();
    require('fs').appendFileSync(ERROR_LOG, entry);
  } catch (e) { /* ignore */ }
  console.error(`[${HOOK_NAME}] ${type}: ${message}`);
  if (stack) console.error(`  スタック: ${stack}`);
}
```

**変更後(JSON Lines形式):**
```javascript
// FR-6.2: JSON Lines形式のエラーログ
/**
 * エラーをログファイルに書き出す(REQ-FIX-6)
 *
 * .claude/state/hook-errors.logにJSON Lines形式で記録する。
 *
 * @param {string} category エラーカテゴリ
 * @param {string} message エラーメッセージ
 * @param {string} details エラー詳細(スタックトレース等)
 */
function logError(category, message, details = '') {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    hook: HOOK_NAME,
    category,
    message,
    details
  };

  const logPath = require('path').join(STATE_DIR, 'hook-errors.log');
  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    ensureStateDir();
    require('fs').appendFileSync(logPath, logLine);
  } catch (e) {
    // ログ書き込み失敗時も処理を続行(fail-safe)
  }

  console.error(`[${HOOK_NAME}] ${category}: ${message}`);
  if (details) console.error(`  詳細: ${details}`);
}
```

**FR-6.2の設計判断:**
- JSON Lines形式により、jq等のツールでログ解析が可能
- ログエントリにhook名を含め、複数フックのログを統合可能に
- ログ書き込み失敗時もプロセスをクラッシュさせない(fail-safe)

#### 3. CLAUDE.md: fail-closed原則の明記(新規セクション)

**追記位置:** CLAUDE.mdの「## 必須コマンド」セクションの前

**追記内容:**
```markdown
## フックシステムのセキュリティ原則

### fail-closed原則(REQ-FIX-6準拠)

全フック(loop-detector.js, phase-edit-guard.js, enforce-workflow.js, bash-whitelist.js)は、
エラー発生時に操作をブロックする「fail-closed」原則に従います。

**fail-closed定義:**
- エラー・例外発生時: `process.exit(2)` でブロック
- 正常処理時のみ: `process.exit(0)` で許可
- タイムアウト時: `process.exit(2)` でブロック

**fail-openは禁止:**
- エラー時に`exit(0)`で許可する実装は全て禁止
- セキュリティ上の脆弱性を生むため

**検証方法:**
- 各フックのcatch句で`exit(2)`が呼ばれることを確認
- エラー時のログが`.claude/state/hook-errors.log`に記録されることを確認

**エラーログの形式:**
~~~json
{"timestamp":"2026-02-14T12:00:00.000Z","hook":"loop-detector.js","category":"入力検証エラー","message":"入力がオブジェクト型ではありません","details":""}
~~~
```

#### 4. 他フックへのfail-closed原則適用

**対象ファイル:**
- `workflow-plugin/hooks/phase-edit-guard.js`
- `workflow-plugin/hooks/enforce-workflow.js`
- `workflow-plugin/hooks/bash-whitelist.js`

**変更パターン(全フック共通):**
```javascript
// 変更前
try {
  // ... 処理 ...
} catch (e) {
  // エラー時は許可
  process.exit(0);  // ★fail-open★
}

// 変更後
try {
  // ... 処理 ...
} catch (e) {
  logError('予期しないエラー', e.message, e.stack);
  process.exit(2);  // ★fail-closed: 例外処理★
}
```

**phase-edit-guard.js の主要修正箇所:**
- HMAC検証エラー時: `logError('HMAC検証エラー', ...); exit(2)`
- フェーズ不一致時: `logError('フェーズ不一致エラー', ...); exit(2)`
- ファイル読み込みエラー時: `logError('ファイル読み込みエラー', ...); exit(2)`

**enforce-workflow.js の主要修正箇所:**
- タスク存在確認エラー時: `logError('タスク未存在エラー', ...); exit(2)`
- 状態ファイル読み込みエラー時: `logError('状態ファイル読み込みエラー', ...); exit(2)`

**bash-whitelist.js の主要修正箇所:**
- コマンド解析エラー時: `logError('コマンド解析エラー', ...); exit(2)`
- ホワイトリスト読み込みエラー時: `logError('ホワイトリスト読み込みエラー', ...); exit(2)`

### REQ-FIX-6のエラーハンドリング方針

| REQ-FIX-6 エラーケース | 対応方針 |
|:-------------|:----------|
| 入力検証エラー | logError()で記録し、exit(2)で中止 |
| ファイル読み込みエラー | logError()で記録し、exit(2)で中止 |
| 予期しない例外 | logError()で記録し、exit(2)で中止 |
| ログ書き込み失敗 | 無視して処理続行(fail-safe) |

### REQ-FIX-6の検証方法

1. **loop-detector.jsのfail-closed確認**
   - loop-detector-state.jsonを削除
   - Editツールを実行
   - exit code 2が返されることを確認
   - hook-errors.logにエラーが記録されることを確認

2. **phase-edit-guard.jsのfail-closed確認**
   - workflow-state.jsonのHMACを改ざん
   - Editツールを実行
   - exit code 2が返されることを確認

3. **全フックのエラーログ確認**
   - .claude/state/hook-errors.logの内容を確認
   - JSON Lines形式で記録されていることを確認
   - timestampフィールドが存在することを確認

---

## 実装計画

本仕様書で定義された6件の修正は、セキュリティ修正(Phase 1)、UX改善(Phase 2)、性能改善(Phase 3)の3つのフェーズに分けて段階的に実装します。
Phase 1のREQ-FIX-6(fail-closed統一)は、セキュリティ原則違反の即時修正が必要なため最優先で実施し、1-2時間以内に完了させます。
Phase 2のREQ-FIX-1, 2(userIntent伝搬とスキップ判定改善)は、ユーザーエクスペリエンス向上のために重要な修正であり、2-3時間で実装します。
Phase 3のREQ-FIX-3, 4, 5(AST解析、BFS依存解析、タスクインデックスの性能改善)は、完全に独立した修正であるため並列実装が可能であり、3-4時間(並列実装時は2時間)で完了させます。
各フェーズは独立性が高いため、複数の開発者が同時に作業することで、全体の実装期間を短縮することができます。
また、各修正には詳細なエラーハンドリング方針と検証方法を定義しており、実装後の品質確保を徹底します。

## 実装順序

実装は以下の順序で段階的に進めることを推奨します。各段階は独立性が高く、並列実装も可能です。

### Phase 1: セキュリティ修正(最優先)

| Phase 1 順序 | REQ-FIX | セキュリティ修正の作業内容 | 理由 |
|:----:|:---------|:---------|:------|
| 1 | REQ-FIX-6 | loop-detector.jsのfail-closed統一 | セキュリティ原則違反の即時修正 |
| 2 | REQ-FIX-6 | CLAUDE.mdへのfail-closed原則明記 | ドキュメントとの整合性確保 |
| 3 | REQ-FIX-6 | 他フック(phase-edit-guard.js等)のfail-closed統一 | 全フックへの原則適用 |

**所要時間:** 1-2時間

### Phase 2: UX改善(重要)

| Phase 2 順序 | REQ-FIX | UX改善の作業内容 | 理由 |
|:---:|:---------|:----------|:------|
| 4 | REQ-FIX-1 | CLAUDE.mdテンプレート修正 | ユーザー意図伝搬の基盤構築 |
| 5 | REQ-FIX-1 | Orchestratorパターン説明追記 | AI理解度向上 |
| 6 | REQ-FIX-2 | definitions.tsのシグネチャ変更 | スキップ判定の拡張準備 |
| 7 | REQ-FIX-2 | userIntentベースの判定実装 | ユーザー明示指示の優先実現 |
| 8 | REQ-FIX-2 | next.tsの呼び出し修正 | スキップ判定の統合 |

**所要時間:** 2-3時間

### Phase 3: 性能改善(並列実装可能)

| Phase 3 順序 | REQ-FIX | 性能改善の作業内容 | 理由 |
|:---:|:----------|:----------|:-------|
| 9 | REQ-FIX-5 | task-index.json導入 | タスク取得の高速化(最も効果が早く出る) |
| 10 | REQ-FIX-3 | design-validatorのキャッシュ実装 | AST解析の高速化 |
| 11 | REQ-FIX-4 | scope-validatorの非同期化 | BFS走査の高速化 |

**所要時間:** 3-4時間(並列実装時は2時間)

### 依存関係

┌─────────────────────────────────────────────────────────────┐
│                    Phase依存関係図                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1 (REQ-FIX-6)                                        │
│    ↓ 独立                                                   │
│  Phase 2 (REQ-FIX-1, 2)                                     │
│    ↓ 独立                                                   │
│  Phase 3 (REQ-FIX-3, 4, 5) ← 3つは並列実装可能              │
│                                                             │
└─────────────────────────────────────────────────────────────┘

### 実装時の注意事項

1. **REQ-FIX-6(fail-closed)は最優先で実装**
   - セキュリティ原則違反は即座に修正
   - 他の修正とは独立しているため、先行実装が可能

2. **REQ-FIX-1とREQ-FIX-2は順序厳守**
   - REQ-FIX-1のuserIntent埋込が完了しないと、REQ-FIX-2のスキップ判定が意味を持たない
   - ただし、並行作業は可能(1人がCLAUDE.md、もう1人がdefinitions.ts)

3. **REQ-FIX-3,4,5は完全に独立**
   - 3つの修正は異なるファイルを対象とし、依存関係なし
   - 並列実装により所要時間を短縮可能

---

## データ構造

### ASTCacheEntry(REQ-FIX-3)

```typescript
interface ASTCacheEntry {
  /** ファイルのMD5ハッシュ */
  hash: string;
  /** AST解析結果 */
  result: ASTAnalysisResult;
  /** キャッシュ作成時刻(UNIX timestamp) */
  timestamp: number;
}
```

**用途:** design-validator.ts内のAST解析結果キャッシュ

**保存場所:**
- メモリ: `Map<string, ASTCacheEntry>`
- 永続化: `.claude/cache/ast-analysis.json`

**キー:** ファイルの絶対パス

**値の例:**
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

### ImportCacheEntry(REQ-FIX-4)

```typescript
interface ImportCacheEntry {
  /** ファイルのMD5ハッシュ */
  hash: string;
  /** 抽出されたimport一覧 */
  imports: string[];
}
```

**用途:** scope-validator.ts内のimport抽出結果キャッシュ

**保存場所:** メモリのみ(`Map<string, ImportCacheEntry>`)

**キー:** `${filePath}:${hash}`(ファイルパスとハッシュの組み合わせ)

**値の例:**
```typescript
{
  "src/app.ts:5d41402abc": {
    "hash": "5d41402abc4b2a76b9719d911017c592",
    "imports": ["./utils", "react", "lodash"]
  }
}
```

### task-index.json(REQ-FIX-5)

```json
{
  "20260214_175140": "workflows/20260214_175140_レビュー指摘6件",
  "20260214_104242": "workflows/20260214_104242_レビュー指摘事項全件修正"
}
```

**用途:** taskIdからタスクディレクトリへの高速マッピング

**保存場所:** `.claude/state/task-index.json`

**キー:** taskId(YYYYMMdd_HHmmss形式)

**値:** `.claude/state/`からの相対パス

**更新タイミング:**
- createTask()時: エントリ追加
- updateTaskPhase()でcompleted時: エントリ削除
- getTaskById()でフォールバック時: エントリ追加
- 破損時: rebuildTaskIndex()で全再構築

### hook-errors.log(REQ-FIX-6)

```json
{"timestamp":"2026-02-14T12:00:00.000Z","hook":"loop-detector.js","category":"入力検証エラー","message":"入力がオブジェクト型ではありません","details":""}
{"timestamp":"2026-02-14T12:00:05.000Z","hook":"phase-edit-guard.js","category":"HMAC検証エラー","message":"HMAC検証に失敗しました","details":"Expected: abc123, Got: def456"}
```

**用途:** 全フックのエラーログを統合記録

**保存場所:** `.claude/state/hook-errors.log`

**フォーマット:** JSON Lines(1行1エントリ)

**フィールド:**
- `timestamp`: ISO 8601形式のタイムスタンプ
- `hook`: フック名(loop-detector.js等)
- `category`: エラーカテゴリ(入力検証エラー、HMAC検証エラー等)
- `message`: エラーメッセージ
- `details`: エラー詳細(スタックトレース等)

**解析例:**
```bash
# 最新10件のエラーを表示
tail -n 10 .claude/state/hook-errors.log | jq .

# loop-detector.jsのエラーのみ抽出
cat .claude/state/hook-errors.log | jq 'select(.hook == "loop-detector.js")'
```

---

## テスト可能な成功条件

本セクションでは、各修正要件(REQ-FIX-1〜6)に対する具体的なテスト手順と期待結果を定義します。
これらのテストは、実装完了後に必ず実施し、全てのテストが成功することを確認する必要があります。
テストは自動化可能な形式で記述されており、継続的インテグレーション(CI)環境での実行も可能です。
各テストケースは、正常系だけでなく異常系(エラーケース)も含めて設計されており、エッジケースでの動作を保証します。
特に性能テスト(REQ-FIX-3, 4, 5)では、具体的な数値目標を設定しており、実装後の性能改善効果を定量的に測定します。
また、セキュリティテスト(REQ-FIX-6)では、fail-closed原則が全フックで正しく実装されていることを検証し、セキュリティホールの発生を防ぎます。

### REQ-FIX-1: userIntent伝搬の検証

```bash
# テスト手順
1. workflow_start("テスト機能実装", userIntent: "ユニットテストとE2Eテストを実装する")
2. requirements.mdを読み込み
3. 「## ユーザーの意図」セクションに「ユニットテストとE2Eテストを実装する」が含まれることを確認

# 期待結果
docs/workflows/テスト機能実装/requirements.md:
## ユーザーの意図
ユニットテストとE2Eテストを実装する
```

### REQ-FIX-2: スキップ判定の検証

```bash
# テスト手順
1. workflow_set_scope({ files: ["docs/README.md"] })
2. workflow_start("ドキュメント更新", userIntent: "テストを追加する")
3. workflow_nextでtest_implフェーズが実行されることを確認

# 期待結果
test_implフェーズがスキップされず、「テストを書いてください」のメッセージが表示される
スキップ理由に「ユーザー明示指示によりtest_implを実行」が記録される
```

### REQ-FIX-3: AST解析性能の検証

```bash
# テスト手順
1. 1000ファイルのプロジェクトで設計検証を実行
2. 初回実行時間を記録(console.timeで計測)
3. 同一プロジェクトで2回目の検証を実行
4. 2回目の実行時間を記録
5. getMetrics()でキャッシュヒット率を確認

# 期待結果
初回: 60秒以内
2回目: 5秒以内
キャッシュヒット率: 90%以上
.claude/cache/ast-analysis.jsonが作成される
```

### REQ-FIX-4: BFS依存解析性能の検証

```bash
# テスト手順
1. 1000ファイルのプロジェクトでtrackDependencies()を実行
2. 実行時間を記録
3. console.logで「Processing batch of 10 files...」が出力されることを確認

# 期待結果
初回: 30秒以内
並列処理: バッチサイズ10で実行される
importキャッシュヒット率: 80%以上(2回目実行時)
```

### REQ-FIX-5: タスクインデックス性能の検証

```bash
# テスト手順
1. 1000タスクを作成
2. getTaskById("20260214_175140")を10回実行
3. 各実行時間をconsole.time()で記録

# 期待結果
平均実行時間: 10ms以内
最大実行時間: 20ms以内
.claude/state/task-index.jsonが作成される
インデックスファイルにtaskIdが含まれる
```

### REQ-FIX-6: fail-closed動作の検証

```bash
# テスト手順
1. .claude/state/loop-detector-state.jsonを削除
2. Editツールを実行
3. exit codeを確認
4. .claude/state/hook-errors.logの内容を確認

# 期待結果
exit code: 2(ブロック)
エラーログ: .claude/state/hook-errors.logに記録される
ログ内容:
{
  "timestamp": "2026-02-14T12:00:00.000Z",
  "hook": "loop-detector.js",
  "category": "状態ファイル読み込みエラー",
  "message": "...",
  "details": "..."
}
```

---

## 非機能要件

### 性能要件

| 指標 | 従来 | 改善後 | 削減率 |
|------|------|--------|--------|
| AST解析(1000ファイル) | 50分 | 5秒(キャッシュヒット時) | 99.8% |
| BFS依存解析(1000ファイル) | 200秒 | 5秒(キャッシュヒット時) | 97.5% |
| タスク取得(1000タスク) | 2秒 | 10ms | 99.5% |
| フック4つ同時起動 | 8秒 | 40ms | 99.5% |

### 保守性要件

1. **コードコメント**
   - 全修正箇所に「REQ-FIX-N準拠」のコメントを追加
   - 設計判断の根拠をJSDoc/TSDocで記述

2. **エラーメッセージ**
   - 全エラーメッセージは日本語で記述
   - エラーログには発生箇所(ファイル名・関数名)を含める

3. **テストカバレッジ**
   - 修正箇所のユニットテストカバレッジは80%以上
   - エッジケース(キャッシュミス、ファイル読み込みエラー等)をテストに含める

### セキュリティ要件

1. **fail-closed原則の徹底**
   - 全フックで、エラー時にexit(2)を返す
   - exit(0)は正常処理時のみ使用
   - タイムアウト時は必ずexit(2)を返す

2. **エラーログのサニタイズ**
   - エラーログに機密情報(パスワード、APIキー等)を含めない
   - ファイルパスはプロジェクトルートからの相対パスで記録

### 互換性要件

1. **後方互換性**
   - userIntent未設定のタスクでも正常動作(REQ-FIX-2のelse句で保証)
   - task-index.json未作成時もdiscoverTasks()で動作(REQ-FIX-5のrebuildで保証)
   - 既存のworkflow-state.jsonフォーマットと互換性を保つ

2. **TypeScriptバージョン**
   - TypeScript 5.x で動作
   - tsconfig.jsonのstrict: trueでコンパイルエラーが発生しない
