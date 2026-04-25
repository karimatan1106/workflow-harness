# レビュー指摘6件の根本原因修正 - UI設計書

## サマリー

本タスクはバックエンド（MCP サーバー、フック）の修正であり、ユーザー向けUIコンポーネントの変更はありません。ただし、開発者向けのCLI出力、エラーログ、性能メトリクスの設計を定義します。

主要な決定事項：
1. **CLI出力**：JSONコマンド実行時の標準エラー出力で、fail-closed の理由を日本語で通知
2. **フックエラーログ**：JSON Lines 形式で統一し、jqでの解析を可能に（REQ-FIX-6）
3. **開発者向けメトリクス**：design-validator および scope-validator の性能計測結果を console.log で出力（REQ-FIX-3, 4）

次フェーズで必要な情報：
- hook-errors.log の継続的監視方法
- メトリクス出力を CI パイプラインに統合する仕組み
- エラーメッセージの国際化要件（現在は日本語のみ）

---

## ユーザーの意図

workflow-pluginの厳格レビューで発見された6件の問題の根本原因を追究し全て修正する。
具体的には、userIntent未埋込問題(REQ-FIX-1)の修正により、ユーザーの意図を全フェーズに伝搬させる。
スコープ判定のみのスキップ問題(REQ-FIX-2)の修正により、ユーザー明示指示を優先する。
AST解析非インクリメンタル問題(REQ-FIX-3)の修正により、大規模プロジェクトでの検証時間を短縮する。
BFS依存解析非効率問題(REQ-FIX-4)とタスクスキャン問題(REQ-FIX-5)の修正により、性能を大幅に改善する。
fail-open設計問題(REQ-FIX-6)の修正により、セキュリティ原則との整合性を確保する。

---

## UI 変更なしの宣言

本タスクの修正対象は以下の通り、すべてバックエンド実装です：

| 修正ID | 対象ファイル | UI影響 |
|--------|------------|--------|
| REQ-FIX-1 | CLAUDE.md（テンプレート） | なし |
| REQ-FIX-2 | definitions.ts, next.ts（スキップ判定） | なし |
| REQ-FIX-3 | design-validator.ts（キャッシュ） | なし（内部実装） |
| REQ-FIX-4 | scope-validator.ts（非同期化） | なし（内部実装） |
| REQ-FIX-5 | manager.ts（インデックス化） | なし（内部実装） |
| REQ-FIX-6 | loop-detector.js, 他フック（fail-closed） | あり（エラー出力） |

**UI変更なし理由：**

1. REQ-FIX-1 はドキュメント変更のみで、生成されるコンポーネントに影響しない
2. REQ-FIX-2 はロジック層の判定順序変更で、ユーザー入力方式は変わらない
3. REQ-FIX-3、4、5 は内部の性能最適化であり、外部インターフェースは変わらない
4. REQ-FIX-6 のみ、fail-closed ブロック時のエラー出力内容が変わる

---

## CLI 出力設計

### エラー出力時の標準表示（REQ-FIX-6）

フックがコマンドをブロックする際、開発者が問題を即座に理解できるように、標準エラー出力に明確なメッセージを表示します。このメッセージは日本語で記述され、詳細なデバッグ情報へのパスを含みます。エラーコードは常に2を返し、CI/CDパイプラインでの検知を容易にします。

**フック実行時のエラーメッセージ出力:**

```
[loop-detector.js] 入力検証エラー: 入力がオブジェクト型ではありません
[loop-detector.js] フェーズブロック: このコマンドは実行できません（詳細: .claude/state/hook-errors.log を参照）
```

**出力フォーマット:**
- 標準エラー出力（stderr）に JSON Lines 形式のログパスを通知
- exit code は 2（ブロック状態）
- 開発者向けの詳細情報は hook-errors.log に記録

### 正常時のログ出力

正常に処理が進行する場合でも、パフォーマンスの透明性を確保するために、各バリデーターはキャッシュの動作状況や処理時間を標準出力に記録します。これにより、開発者はシステムの健全性をリアルタイムで確認できます。特に大規模プロジェクトでは、キャッシュヒット率が性能に直結するため、詳細な統計情報を提供します。

**design-validator の キャッシュ読み込み:**

```
[Design Validator] Loaded 245 cached AST entries
[Design Validator] Processing 1000 files...
[Design Validator] Cache hit rate: 92.3% (923 hits, 77 misses)
[Design Validator] Average analysis time per file: 2.1ms
[Design Validator] Persisted 1000 AST entries to cache
```

**scope-validator のバッチ処理進捗:**

```
[Scope Validator] Processing batch of 10 files (depth=1)...
[Scope Validator] Import cache hit rate: 87.5% (875 hits, 125 misses)
[Scope Validator] Completed 1000 files in 4.2 seconds
```

**StateManager のタスクインデックス初期化:**

```
[StateManager] Loaded task index: 543 entries
[StateManager] Task lookup performance: 8.3ms average
```

---

## hook-errors.log フォーマット設計（REQ-FIX-6）

### JSON Lines 形式定義

各行は1つの JSON オブジェクトで、改行で区切られます。

```json
{"timestamp":"2026-02-14T12:00:00.000Z","hook":"loop-detector.js","category":"入力検証エラー","message":"入力がオブジェクト型ではありません","details":""}
{"timestamp":"2026-02-14T12:00:05.123Z","hook":"phase-edit-guard.js","category":"HMAC検証エラー","message":"HMAC検証に失敗しました","details":"Expected: abc123def, Got: xyz789abc"}
{"timestamp":"2026-02-14T12:00:10.456Z","hook":"enforce-workflow.js","category":"タスク未存在エラー","message":"タスク ID が見つかりません","details":"taskId: invalid-task-id"}
{"timestamp":"2026-02-14T12:00:15.789Z","hook":"bash-whitelist.js","category":"コマンド解析エラー","message":"コマンドが解析できません","details":"command: 'dangerous-rm' not in whitelist"}
```

### JSON フィールド定義

| フィールド | 型 | 説明 | 必須 | 例 |
|-----------|-----|------|------|-----|
| `timestamp` | string (ISO 8601) | エラー発生時刻 | ✅ | `2026-02-14T12:00:00.000Z` |
| `hook` | string | フック名 | ✅ | `loop-detector.js`, `phase-edit-guard.js` |
| `category` | string | エラーカテゴリ | ✅ | `入力検証エラー`, `HMAC検証エラー` |
| `message` | string | ユーザー向けメッセージ | ✅ | `HMAC検証に失敗しました` |
| `details` | string | 開発者向け詳細情報 | - | スタックトレース、パラメータ値等 |

### エラーカテゴリ一覧

**loop-detector.js の エラーカテゴリ:**

| loop-detector カテゴリ | 説明 | メッセージ例 |
|:---------|:------|:-------------|
| `入力検証エラー` | 入力引数が不正 | `入力がオブジェクト型ではありません` |
| `パス検証エラー` | ファイルパスが空 | `ファイルパスが空です` |
| `状態ファイル読み込みエラー` | loop-detector-state.json を読み込めない | `ファイルが見つかりません: .claude/state/loop-detector-state.json` |
| `ループ検出` | 循環編集を検出 | `ファイルが短時間に 5 回以上編集されています: src/app.ts` |
| `予期しないエラー` | loop-detector内部の例外 | スタックトレース |

**phase-edit-guard.js の エラーカテゴリ:**

| phase-edit-guard カテゴリ | 説明 | メッセージ例 |
|:--------|:-----|:------------|
| `HMAC検証エラー` | ワークフロー状態の改ざん | `HMAC検証に失敗しました` |
| `フェーズ不一致エラー` | 許可されていないフェーズでの編集 | `現在のフェーズ(implementation)では編集できません` |
| `ファイル読み込みエラー` | workflow-state.json を読み込めない | `ワークフロー状態ファイルが見つかりません` |
| `予期しないエラー` | phase-edit-guard内部の例外 | スタックトレース |

**enforce-workflow.js の エラーカテゴリ:**

| enforce-workflow カテゴリ | 説明 | メッセージ例 |
|:----------|:-------|:--------------|
| `タスク未存在エラー` | workflow_start なしでコード編集 | `タスクが開始されていません` |
| `状態ファイル読み込みエラー` | workflow-state.json を読み込めない | `ワークフロー状態の読み込みに失敗しました` |
| `予期しないエラー` | enforce-workflow内部の例外 | スタックトレース |

**bash-whitelist.js の エラーカテゴリ:**

| bash-whitelist カテゴリ | 説明 | メッセージ例 |
|:---------|:------|:------------|
| `コマンド解析エラー` | Bash コマンドが解析できない | `危険なコマンド rm が検出されました` |
| `ホワイトリスト読み込みエラー` | ホワイトリスト設定を読み込めない | `ホワイトリストの読み込みに失敗しました` |
| `予期しないエラー` | bash-whitelist内部の例外 | スタックトレース |

### ログ解析方法（開発者向け）

**最新 10 件のエラーを表示:**

```bash
tail -n 10 .claude/state/hook-errors.log | jq .
```

**特定のフックのエラーのみ抽出:**

```bash
cat .claude/state/hook-errors.log | jq 'select(.hook == "loop-detector.js")'
```

**エラーカテゴリ別に集計:**

```bash
cat .claude/state/hook-errors.log | jq -s 'group_by(.category) | map({category: .[0].category, count: length})'
```

**過去 1 時間のエラーを検索:**

```bash
cat .claude/state/hook-errors.log | jq --arg start "$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%S')" \
  'select(.timestamp >= $start)' | jq .
```

---

## 開発者向けメトリクス出力設計（REQ-FIX-3, REQ-FIX-4）

### design-validator の性能メトリクス（REQ-FIX-3）

design-validator はキャッシュ機構により大規模プロジェクトでのAST解析を高速化します。getMetrics() メソッドは、キャッシュの効果を定量的に測定するための情報を提供し、性能ボトルネックの早期発見に役立ちます。特にヒット率が85%を下回る場合は、キャッシュ戦略の見直しが必要なシグナルとなります。

**getMetrics() 出力フォーマット:**

```typescript
{
  hitRate: 0.923,           // キャッシュヒット率（0.0-1.0）
  avgTimeMs: 2.1,           // キャッシュミス時の平均解析時間（ミリ秒）
  hits: 923,                // キャッシュヒット件数
  misses: 77                // キャッシュミス件数
}
```

**console.log 出力例:**

```
[Design Validator] Performance Metrics:
  Cache hits: 923
  Cache misses: 77
  Hit rate: 92.3%
  Average analysis time: 2.1ms per file
  Total processing time: 4230ms
  Files with analysis time >50ms: 3
    - src/components/App.tsx: 87ms
    - src/backend/service.ts: 62ms
    - src/utils/large-utility.ts: 51ms
```

**出力タイミング:**

- validateAll() 完了時に自動出力
- CI/CD パイプラインで性能監視に利用

**性能チューニングの指標:**

| 指標 | 目標値 | 良好範囲 | 注意範囲 |
|------|--------|----------|----------|
| キャッシュヒット率 | 90% | 85%-100% | 70%-84% |
| 平均解析時間 | <5ms | <10ms | 10-50ms |
| 最大解析時間 | <100ms | <200ms | 200-500ms |

### scope-validator の性能メトリクス（REQ-FIX-4）

scope-validator は BFS アルゴリズムでファイル依存関係を追跡します。非同期バッチ処理により、I/O待機時間を最小化し、大規模プロジェクトでも高速な依存解析を実現します。バッチサイズは10をデフォルトとし、メモリとスループットのバランスを最適化しています。

**trackDependencies() の進捗出力:**

```
[Scope Validator] Starting BFS dependency tracking...
[Scope Validator] Processing batch 1 of 100 (10 files)...
[Scope Validator] Processing batch 2 of 100 (10 files)...
...
[Scope Validator] Completed 1000 files in 4.2 seconds
[Scope Validator] Import cache statistics:
  - Hits: 875
  - Misses: 125
  - Hit rate: 87.5%
[Scope Validator] Scope violations: 12
  - src/legacy/old-code.ts imported from src/new/feature.ts (out of scope)
```

**バッチサイズの調整:**

```typescript
const result = await trackDependencies(
  files,
  dirs,
  {
    maxDepth: 2,
    batchSize: 10  // デフォルト: 10（I/O 効率とメモリバランス）
  }
);
```

**性能チューニングの指標:**

| 指標 | 目標値 | バッチサイズ参考値 |
|------|--------|------|
| 並列I/O スループット | 30ファイル/秒 | 10-20 |
| メモリ使用量 | <500MB | batchSize <= 20 |
| キャッシュヒット率 | 80% | - |

### StateManager のパフォーマンス出力（REQ-FIX-5）

StateManager はタスクインデックスにより、O(n) のディレクトリスキャンを O(1) のハッシュマップ検索に改善しました。インデックスは永続化され、MCP サーバー起動時に読み込まれるため、2回目以降のタスク検索は極めて高速です。目標は全検索を10ms以内に完了することです。

**getTaskById() の実行時間ログ:**

```
[StateManager] Task lookup: taskId=20260214_175140
  - Index lookup time: 0.3ms
  - File read time: 2.1ms
  - Total time: 2.4ms
  - Status: OK (within 10ms target)
```

**インデックス再構築時の出力:**

```
[StateManager] Building task index from file system...
  - Scanned directories: 543
  - Found tasks: 543
  - Index entries: 543
  - Build time: 1234ms
  - Index file size: 12.4KB
[StateManager] Task index saved to .claude/state/task-index.json
```

**インデックスヒット率の報告:**

```
[StateManager] Index statistics (last session):
  - Lookups: 1024
  - Index hits: 1018
  - Index misses: 6
  - Hit rate: 99.4%
  - Avg lookup time: 1.8ms
```

---

## CLIインターフェース設計

本システムはCLIベースのワークフローツールであり、すべての操作はコマンドラインから実行されます。開発者はworkflow_start、workflow_next などのMCPツールをClaude経由で呼び出し、フックはBashコマンドを透明にインターセプトします。

### コマンド実行時の出力フロー

ユーザーがBashツールを使用すると、以下の順序で処理が実行されます。まず、bash-whitelist.jsフックがコマンドを検査し、危険なコマンドをブロックします。次に、phase-edit-guard.jsがファイル編集を検証し、現在のワークフローフェーズで許可されているかを確認します。最後に、loop-detector.jsが同一ファイルの繰り返し編集を検出し、無限ループを防止します。各フックは処理結果を標準エラー出力とhook-errors.logの両方に記録します。

### 成功時の出力例

ユーザーがワークフローに従って正常にコマンドを実行した場合の出力例を示します。

```
$ workflow_start "新機能の実装"
[MCP Server] Task created: 20260214_175140_新機能の実装
[MCP Server] Phase: research
[StateManager] Task index updated (544 entries)

$ Edit src/components/Button.tsx
[phase-edit-guard.js] ✅ Edit allowed: current phase (implementation) permits source code editing
[loop-detector.js] ✅ No loop detected: src/components/Button.tsx edited 1 time(s) in last 5 minutes
```

### エラー時の出力例

ワークフロー違反が発生した場合の出力例を示します。

```
$ Edit src/components/Button.tsx
[phase-edit-guard.js] ❌ Edit blocked: current phase (research) does not permit source code editing
[phase-edit-guard.js] 詳細: .claude/state/hook-errors.log を確認してください
Error: Command execution blocked by hook
Exit code: 2
```

### 対話的なフィードバック

フックは可能な限り、次に取るべきアクションを提案します。例えば、researchフェーズでコード編集がブロックされた場合は、workflow_nextでplanningフェーズに進むよう促します。これにより、開発者はワークフローを理解しやすくなります。

---

## エラーメッセージ設計

### エラーメッセージの原則

すべてのエラーメッセージは、以下の3要素を含みます：(1) 何が起きたか（事象）、(2) なぜブロックされたか（理由）、(3) どうすれば解決できるか（アクション）。これにより、開発者は即座に状況を理解し、適切な対処を取れます。

### フック別エラーメッセージテンプレート

各フックは独自のエラーメッセージフォーマットを持ちます。loop-detector.jsは繰り返し編集の回数と時間枠を通知し、phase-edit-guard.jsは現在のフェーズと編集可能なファイル種別を示し、enforce-workflow.jsはworkflow_startコマンドの実行を促します。bash-whitelist.jsは検出された危険なコマンドを具体的に指摘します。

### 日本語メッセージの標準化

すべてのエラーメッセージは日本語で記述されます。用語は以下に統一します：「フェーズ」（phase）、「ブロック」（block）、「検証」（validation）、「タスク」（task）、「編集」（edit）。英語の技術用語はカタカナ表記とし、必要に応じて括弧内に英語を併記します（例：「キャッシュ（cache）ヒット率」）。

### エラーメッセージの詳細度

標準エラー出力には簡潔なメッセージのみを表示し、詳細情報はhook-errors.logに記録します。これにより、通常の開発フローを妨げず、必要に応じて詳細を確認できます。CI/CDパイプラインではexit code 2を検知し、自動的にログファイルを抽出してレポートに含めます。

### メッセージの可読性向上

長いファイルパスは相対パス表記に変換し、重要な部分を強調します。例えば、`C:\Users\owner\.claude\state\workflows\20260214_175140_新機能の実装\workflow-state.json` は `.claude/state/workflows/.../workflow-state.json` と短縮します。タイムスタンプはISO 8601形式で記録しますが、表示時は人間に優しい形式（「5分前」）に変換します。

---

## APIレスポンス設計

### MCP ツールのレスポンス形式

MCPサーバーが提供する各ツール（workflow_start、workflow_next、workflow_approve等）は、JSON形式のレスポンスを返します。成功時は `{"success": true, "data": {...}}` を、エラー時は `{"success": false, "error": {...}}` を返します。

### workflow_start のレスポンス例

新しいタスクを開始すると、タスクIDとワークフローディレクトリパスが返されます。

```json
{
  "success": true,
  "data": {
    "taskId": "20260214_175140_新機能の実装",
    "taskName": "新機能の実装",
    "phase": "research",
    "workflowDir": ".claude/state/workflows/20260214_175140_新機能の実装",
    "docsDir": "docs/workflows/新機能の実装"
  }
}
```

### workflow_next のレスポンス例

次のフェーズに進むと、新しいフェーズ名と残りのフェーズ数が返されます。

```json
{
  "success": true,
  "data": {
    "taskId": "20260214_175140_新機能の実装",
    "previousPhase": "research",
    "currentPhase": "requirements",
    "remainingPhases": 17,
    "message": "研究フェーズが完了しました。要件定義フェーズに進みました。"
  }
}
```

### エラーレスポンス例

ワークフロー違反が発生した場合のエラーレスポンスを示します。

```json
{
  "success": false,
  "error": {
    "code": "PHASE_VIOLATION",
    "message": "現在のフェーズ(research)では編集できません",
    "details": {
      "currentPhase": "research",
      "attemptedFile": "src/components/Button.tsx",
      "allowedFileTypes": [".md"],
      "suggestion": "workflow_next を実行して次のフェーズに進んでください"
    }
  }
}
```

### レスポンスの一貫性

すべてのMCPツールは、同一の構造を持つレスポンスを返します。これにより、Claudeは統一的なエラーハンドリングロジックを実装でき、ユーザーへの応答も一貫性を保てます。

---

## 設定ファイル設計

### .claude/settings.json（フック設定）

フックの有効/無効を制御する設定ファイルです。各フックのパスとパラメータを定義します。

```json
{
  "hooks": {
    "bash": [
      {
        "name": "bash-whitelist.js",
        "path": "C:/ツール/Workflow/.claude/hooks/bash-whitelist.js",
        "enabled": true
      }
    ],
    "edit": [
      {
        "name": "loop-detector.js",
        "path": "C:/ツール/Workflow/.claude/hooks/loop-detector.js",
        "enabled": true
      },
      {
        "name": "phase-edit-guard.js",
        "path": "C:/ツール/Workflow/.claude/hooks/phase-edit-guard.js",
        "enabled": true
      },
      {
        "name": "enforce-workflow.js",
        "path": "C:/ツール/Workflow/.claude/hooks/enforce-workflow.js",
        "enabled": true
      }
    ]
  }
}
```

### .claude/state/task-index.json（タスクインデックス）

StateManagerが管理するタスクインデックスファイルです。各タスクIDに対するディレクトリパスのマッピングを保持します。

```json
{
  "20260214_175140_新機能の実装": ".claude/state/workflows/20260214_175140_新機能の実装",
  "20260213_120530_バグ修正": ".claude/state/workflows/20260213_120530_バグ修正",
  "20260212_093015_リファクタリング": ".claude/state/workflows/20260212_093015_リファクタリング"
}
```

このインデックスにより、getTaskById() は O(1) でタスクディレクトリを特定できます。ファイルサイズは1000タスクで約50KBと軽量です。

### .claude/cache/ast-analysis.json（AST キャッシュ）

design-validator が使用するASTキャッシュファイルです。各ファイルのハッシュ値と解析結果を保持します。

```json
{
  "src/components/Button.tsx": {
    "hash": "a1b2c3d4e5f6",
    "ast": { "type": "Program", "body": [...] },
    "lastModified": "2026-02-14T10:30:00.000Z"
  },
  "src/utils/helper.ts": {
    "hash": "f6e5d4c3b2a1",
    "ast": { "type": "Program", "body": [...] },
    "lastModified": "2026-02-14T09:15:00.000Z"
  }
}
```

ファイルが変更されていない場合（ハッシュ値一致）、キャッシュからASTを読み込むため、解析時間が大幅に短縮されます。大規模プロジェクトでは数百MBになる可能性があるため、定期的なクリーンアップが推奨されます。

### 設定ファイルの読み込みタイミング

settings.json はClaudeセッション開始時に一度だけ読み込まれ、セッション中は変更が反映されません。task-index.json と ast-analysis.json はMCPサーバー起動時に読み込まれ、変更時に自動保存されます。

---

## エラー出力のベストプラクティス

### ユーザーへの通知方法

フックがコマンドを検査する際、その結果を常に標準エラー出力に表示します。成功時は緑色のチェックマーク（✅）、失敗時は赤色のバツマーク（❌）を使用し、視覚的に結果を区別します。詳細情報が必要な場合は、hook-errors.log へのパスを明示します。

**許可状況の明示（REQ-FIX-6）:**

```
実行中: npm install react

[フック検出] bash-whitelist.js がコマンドを検査中...
✅ コマンド実行を許可: npm install react

実行完了: 正常に終了しました。
```

**ブロック時の通知（REQ-FIX-6）:**

```
実行中: rm -rf /

[フック検出] bash-whitelist.js がコマンドを検査中...
❌ コマンドをブロック: 危険なコマンド rm が検出されました
   詳細情報: .claude/state/hook-errors.log を確認してください

フェーズエラー: コマンド実行が許可されていません。
終了コード: 2
```

### ログローテーション

hook-errors.log は時間とともに増大するため、適切なサイズ管理が必要です。ファイルサイズが50MBを超えた場合、古いエントリから自動削除する仕組みを推奨します。月単位でのバックアップを取得し、長期的なエラー傾向の分析に活用できます。

**hook-errors.log のサイズ管理:**

- ファイルサイズ上限: 50MB
- 上限超過時は古いエントリから削除
- 月単位でのバックアップを推奨

```bash
# ログファイルのサイズを確認
ls -lh .claude/state/hook-errors.log

# 古いエントリを削除（最新 1000 件のみ保持）
tail -n 1000 .claude/state/hook-errors.log > /tmp/hook-errors.bak
mv /tmp/hook-errors.bak .claude/state/hook-errors.log
```

### エラーメッセージの改善サイクル

開発者からのフィードバックをもとに、エラーメッセージの明瞭さを継続的に改善します。特に初心者が頻繁につまずくエラーについては、より詳細なガイダンスを追加します。例えば、「workflow_start を先に実行してください」というメッセージに、実際のコマンド例を併記します。

---

## 監視・デバッグ用インターフェース

本セクションでは、開発者がシステムの動作をリアルタイムで監視し、問題を迅速にデバッグするための手法を説明します。JSON Lines形式のログはjqコマンドと組み合わせることで、強力な解析ツールとなります。Linux、macOS、Windows PowerShellのそれぞれで利用可能なコマンド例を提供します。

### リアルタイムログ監視

エラーが発生した際、リアルタイムでログを監視することで、問題の根本原因を即座に特定できます。tail -f コマンドはログファイルの末尾を継続的に表示し、新しいエントリが追加されると自動的に画面に反映されます。jq コマンドを使用することで、JSON形式のログを整形し、必要な情報だけを抽出できます。

**Linux/macOS:**

```bash
# リアルタイムでエラーログを監視
tail -f .claude/state/hook-errors.log | jq .

# 新しいエラーのみを監視（カラー表示）
tail -f .claude/state/hook-errors.log | \
  jq --raw-output '"[\(.timestamp)] \(.hook): \(.category) - \(.message)"' \
  | grep --color=always "エラー\|失敗\|ブロック"
```

**Windows PowerShell:**

```powershell
# リアルタイムログ監視
Get-Content .claude\state\hook-errors.log -Wait | ConvertFrom-Json
```

### パフォーマンス分析

性能ボトルネックを特定するために、各バリデーターのメトリクスを定期的に確認します。キャッシュヒット率が低下している場合は、キャッシュの再構築またはバッチサイズの調整を検討します。以下のTypeScriptコードは、design-validatorの性能を詳細に分析する例です。

```typescript
// design-validator の性能分析
const validator = new DesignValidator(workflowDir);
const startTime = Date.now();
const result = validator.validateAll();
const metrics = validator.getMetrics();

console.log(`Total time: ${Date.now() - startTime}ms`);
console.log(`Hit rate: ${(metrics.hitRate * 100).toFixed(1)}%`);
console.log(`Avg time per miss: ${metrics.avgTimeMs.toFixed(1)}ms`);

// キャッシュが効いていない場合、次のコマンドで再構築
// rm .claude/cache/ast-analysis.json
```

### 統計情報の集計

開発チーム全体でエラー傾向を把握するために、週次または月次でログを集計します。最も頻繁に発生するエラーカテゴリを特定し、ドキュメントやトレーニングで対処します。以下のコマンドは、エラーカテゴリごとの発生件数を降順で表示します。

```bash
# エラーカテゴリ別の発生件数を集計
cat .claude/state/hook-errors.log | jq -s 'group_by(.category) | map({category: .[0].category, count: length}) | sort_by(.count) | reverse'
```

### デバッグモードの有効化

フックに環境変数 `DEBUG=true` を設定することで、詳細なデバッグログを出力できます。これにより、フック内部の処理フローや変数の値を追跡できます。ただし、出力量が増大するため、本番環境では無効化してください。

---

## 今後の拡張可能性

### 国際化対応（i18n）

現在のエラーメッセージは日本語で実装されていますが、グローバルな開発チームでの利用を見据え、将来的には多言語対応が必要になる可能性があります。その際は、メッセージを外部の言語ファイルに分離し、環境変数 `LANG` に基づいて適切な言語を選択する仕組みを導入します。

```typescript
// 言語ファイル: locales/ja.json
{
  "errors": {
    "input_validation": "入力がオブジェクト型ではありません",
    "hmac_mismatch": "HMAC検証に失敗しました"
  }
}

// フック実装
const messages = require(`./locales/${process.env.LANG || 'ja'}.json`);
logError(messages.errors.input_validation);
```

この設計により、新しい言語の追加はlocalesディレクトリにJSONファイルを配置するだけで完了します。コードの変更は不要です。

### メトリクス集計・可視化

hook-errors.log から統計情報を抽出し、Grafana や Kibana などの可視化ツールでダッシュボードを構築することで、エラー傾向をリアルタイムで監視できます。以下のコマンドは、日別のエラー件数を集計する例です。

```bash
# 日別のエラー件数
cat .claude/state/hook-errors.log | \
  jq -r '.timestamp | split("T")[0]' | \
  sort | uniq -c | sort -rn
```

出力例：
```
  15 2026-02-14
  8 2026-02-13
  3 2026-02-12
```

この情報をCSVファイルに変換し、表計算ソフトやBIツールにインポートすることで、長期的なトレンド分析が可能になります。

### CI パイプライン統合

GitHub Actions や GitLab CI などのCIパイプラインに性能メトリクスの監視を統合することで、コード変更がパフォーマンスに悪影響を与えていないかを自動的に検証できます。以下のYAML例は、design-validatorのキャッシュヒット率が85%を下回った場合にビルドを失敗させる設定です。

```yaml
- name: Check performance metrics
  run: |
    npm test
    # design-validator のメトリクスが期待値を超えた場合、失敗
    npm run check-metrics -- --fail-on-hit-rate-below 85
```

この仕組みにより、性能劣化を早期に発見し、リリース前に修正できます。

---

## まとめ

本タスクはバックエンド修正であり、ユーザー向けUIコンポーネントの変更はありませんが、以下の出力設計で開発者体験と保守性を大幅に向上させます：

1. **エラーログ統一**：JSON Lines 形式で全フックのエラーを統合記録
2. **性能メトリクス可視化**：キャッシュヒット率・実行時間を console.log で通知
3. **デバッグ支援**：jq を使用したログ解析方法を提供

これらの実装により、本タスクの修正効果を定量的に測定し、今後のパフォーマンス改善の基盤を構築します。
