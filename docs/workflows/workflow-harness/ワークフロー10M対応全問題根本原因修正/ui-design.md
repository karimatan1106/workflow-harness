# CLI・エラーメッセージ設計: ワークフロー10M対応全問題根本原因修正

## サマリー

本ドキュメントは、ワークフロープラグインの10M行規模対応における開発者体験（DX）改善の仕様を定義します。
UIコンポーネントではなく、CLIインターフェース、環境変数、エラーメッセージ、ログ出力の設計を扱います。

主要な改善項目は以下の5点です：
1. 新規環境変数の追加により、開発者がワークフローの挙動を柔軟に制御可能にする
2. エラーメッセージの改善により、セキュリティ違反と一時的エラーを明確に区別する
3. 新規MCPツール `workflow_update_intent` により、タスクのuserIntentを安全に更新可能にする
4. HMAC鍵ローテーション時のユーザー通知により、突然のエラーを防止する
5. ログ出力の体系化により、デバッグ効率を向上させる

環境変数は全て既存のデフォルト値との互換性を保ち、設定なしでも従来通り動作します。
エラーメッセージはエラーカテゴリ（security/integrity/temporary/unknown）に基づき、適切な終了コードと推奨アクションを提示します。
HMAC鍵ローテーションは自動実行されますが、鍵が期限切れ30日前になると警告を表示し、手動ローテーションを推奨します。
ログレベルはDEBUG/INFO/WARN/ERRORの4段階に分類され、WORKFLOW_LOG_LEVEL環境変数で制御できます。

これらの改善により、大規模プロジェクトでのワークフロー運用が安定し、問題発生時の原因特定が容易になります。

## 新規環境変数一覧

本セクションでは、Phase 1～Phase 3で導入される環境変数を一覧化し、各変数の目的・デフォルト値・使用例を示します。
全ての環境変数は省略可能であり、設定しない場合は既存のハードコードされたデフォルト値が使用されます。

### TASK_INDEX_TTL_MS

**目的:** task-index.jsonキャッシュの有効期限をミリ秒単位で設定します。
**デフォルト値:** 5000（5秒）
**設定例:** `TASK_INDEX_TTL_MS=10000` で10秒間キャッシュを保持
**影響範囲:** hooks/lib/discover-tasks.js の readTaskIndexCache() 関数
**推奨値:** 開発中は5000、CI環境では60000（1分）を推奨

この環境変数を長く設定すると、頻繁なディレクトリスキャンを回避できパフォーマンスが向上します。
ただし、タスク一覧の更新が遅れる可能性があるため、開発中は短い値を使用することを推奨します。
CI環境では、タスク開始後にフェーズ移行が主であり、新規タスク検出の遅延は問題にならないため、長めの値を設定できます。

### WORKFLOW_FAIL_MODE

**目的:** フックエラー時の挙動を制御します（fail-closed / fail-open）
**デフォルト値:** "closed"
**設定例:** `WORKFLOW_FAIL_MODE=open` で一時的エラー時にブロックしない
**影響範囲:** hooks/phase-edit-guard.js, hooks/bash-whitelist.js, hooks/enforce-workflow.js 全般
**推奨値:** 本番環境では "closed"、開発環境では "open" を検討可能

fail-closed（デフォルト）モードでは、全てのエラーで操作をブロックし、セキュリティを優先します。
fail-openモードでは、一時的エラー（ファイルロック失敗、JSON parse エラー等）は警告のみで操作を許可します。
セキュリティ違反（HMAC不一致、フェーズ違反等）は常にブロックされ、このモードには影響されません。
開発環境で task-index.json が頻繁に更新される場合、fail-openモードにより開発がスムーズになる可能性があります。

### HOOK_CACHE_TTL_MS

**目的:** フック内部で使用するキャッシュ（AST、HMAC検証結果等）の有効期限を設定します
**デフォルト値:** 300000（5分）
**設定例:** `HOOK_CACHE_TTL_MS=600000` で10分間キャッシュを保持
**影響範囲:** hooks/lib/cache-manager.js の LRUCache 全般
**推奨値:** 通常は300000、大規模プロジェクトでは600000～900000を推奨

ASTキャッシュはファイル解析結果を保存し、再解析のオーバーヘッドを削減します。
TTLが短すぎると頻繁に再解析が発生し、長すぎると古いデータが使用される可能性があります。
Phase 3でLRUキャッシュ化されるため、メモリ使用量は最大100エントリに制限されます。

### HMAC_KEY_ROTATION_DAYS

**目的:** HMAC鍵の有効期限を日数で設定します
**デフォルト値:** 30（30日）
**設定例:** `HMAC_KEY_ROTATION_DAYS=90` で90日間有効
**影響範囲:** mcp-server/src/state/hmac.ts の鍵ローテーションロジック
**推奨値:** セキュリティポリシーに応じて30～90日を推奨

鍵の有効期限が近づくと（残り3日以内）、ワークフロー操作時に警告メッセージが表示されます。
期限切れ後は新しい鍵が自動生成されますが、古い鍵で署名された workflow-state.json は検証失敗となります。
そのため、期限切れ前に手動で workflow_rotate_hmac_key ツールを実行することを推奨します。

### WORKFLOW_LOG_LEVEL

**目的:** ログ出力のレベルを制御します（DEBUG/INFO/WARN/ERROR）
**デフォルト値:** "INFO"
**設定例:** `WORKFLOW_LOG_LEVEL=DEBUG` で詳細ログを出力
**影響範囲:** hooks/lib/logger.js および mcp-server/src/utils/logger.ts 全般
**推奨値:** 開発中は DEBUG、本番環境では INFO または WARN を推奨

DEBUGレベルでは、タスク検出、HMAC検証、AST解析、フェーズ判定の詳細ログが出力されます。
INFOレベルでは、タスク開始/終了、フェーズ移行、警告のみが出力されます。
WARNレベルでは、警告とエラーのみが出力され、通常の操作ログは抑制されます。
ERRORレベルでは、エラーのみが出力され、最小限のログとなります。

### VALIDATION_TIMEOUT_MS

**目的:** artifact-validator のバリデーション処理のタイムアウトを設定します
**デフォルト値:** 10000（10秒）
**設定例:** `VALIDATION_TIMEOUT_MS=30000` で30秒まで許容
**影響範囲:** hooks/lib/artifact-validator.js の validateArtifact() 関数
**推奨値:** 通常は10000、大規模ドキュメントでは30000を推奨

バリデーション処理が設定時間を超えると、タイムアウトエラーとなり操作がブロックされます。
ただし、WORKFLOW_FAIL_MODE=open の場合、タイムアウトは警告のみで操作は許可されます。
Phase 2でこの機能が導入され、無限ループやハングアップによるCLIフリーズを防止します。

### SCOPE_VALIDATION_MODE

**目的:** スコープ検証の厳格さを制御します（strict/lenient/off）
**デフォルト値:** "strict"
**設定例:** `SCOPE_VALIDATION_MODE=lenient` で警告のみとする
**影響範囲:** hooks/phase-edit-guard.js のスコープ検証ロジック
**推奨値:** 通常は strict、プロトタイピング時は lenient を検討可能

strictモードでは、スコープ外のファイル編集は常にブロックされます。
lenientモードでは、スコープ外の編集は警告のみで許可されますが、フェーズ制限は維持されます。
offモードでは、スコープ検証を完全に無効化します（非推奨、テスト用途のみ）。

## エラーメッセージ設計

本セクションでは、Phase 1で導入されるエラーカテゴリ分類に基づき、各カテゴリのメッセージ形式・終了コード・推奨アクションを定義します。
全てのエラーメッセージは以下の形式に統一されます：
```
[ERROR_CATEGORY] 問題の説明
→ 原因: 根本原因の説明
→ 対処: 推奨される対処方法
```

### セキュリティ違反エラー（SECURITY）

**終了コード:** 1（fail-closed固定）
**発生条件:** HMAC不一致、フェーズ外ファイル編集、禁止コマンド実行

**メッセージ例1: HMAC不一致**
```
[SECURITY] workflow-state.jsonの整合性検証に失敗しました
→ 原因: ファイルが手動編集されたか、異なるHMAC鍵で署名されています
→ 対処: workflow-state.jsonを手動で編集しないでください。破損している場合は /workflow reset で復旧できます
```

**メッセージ例2: フェーズ外ファイル編集**
```
[SECURITY] 現在のフェーズ (research) ではソースコードの編集が許可されていません
→ 原因: src/backend/service.ts は implementation フェーズまで編集できません
→ 対処: /workflow next で implementation フェーズに進むか、/workflow reset で設計を見直してください
```

**メッセージ例3: 禁止コマンド実行**
```
[SECURITY] 現在のフェーズ (research) では bash の rm コマンドは許可されていません
→ 原因: ファイル削除は implementation フェーズ以降で許可されます
→ 対処: Read/Write ツールを使用してファイル操作を行うか、適切なフェーズに進んでください
```

セキュリティ違反エラーは常にブロックされ、WORKFLOW_FAIL_MODE=open でも回避できません。
これらのエラーは開発プロセスの根本的な問題を示しており、無視すべきではありません。

### 整合性エラー（INTEGRITY）

**終了コード:** 1（デフォルト、fail-open時は0）
**発生条件:** JSON parse失敗、スキーマ不一致、必須フィールド欠損

**メッセージ例1: JSON parse失敗**
```
[INTEGRITY] task-index.json の読み込みに失敗しました
→ 原因: JSONフォーマットが不正です（Unexpected token } at position 142）
→ 対処: task-index.json を削除すると自動再生成されます。WORKFLOW_FAIL_MODE=open で一時的に回避できます
```

**メッセージ例2: スキーマ不一致**
```
[INTEGRITY] workflow-state.json のスキーマが不正です
→ 原因: 必須フィールド "phase" が存在しません
→ 対処: /workflow reset でタスクを初期化するか、手動でフィールドを追加してください
```

整合性エラーは、fail-openモードでは警告のみとなり、操作は許可されます。
ただし、データが破損している可能性があるため、早期に修復することを推奨します。

### 一時的エラー（TEMPORARY）

**終了コード:** 0（fail-open時）、1（fail-closed時）
**発生条件:** ファイルロック取得失敗、タイムアウト、ネットワークエラー

**メッセージ例1: ファイルロック失敗**
```
[TEMPORARY] task-index.json のロック取得に失敗しました（タイムアウト: 5000ms）
→ 原因: 別のプロセスがファイルを使用中です
→ 対処: 数秒待ってから再実行してください。WORKFLOW_FAIL_MODE=open で警告のみとすることもできます
```

**メッセージ例2: バリデーションタイムアウト**
```
[TEMPORARY] artifact-validator がタイムアウトしました（制限: 10000ms）
→ 原因: ドキュメントが大規模すぎるか、処理が複雑です
→ 対処: VALIDATION_TIMEOUT_MS を増やすか、ドキュメントを分割してください
```

一時的エラーは、再実行により解決する可能性が高いため、fail-openモードで許可されます。
ただし、頻発する場合は環境変数の調整やシステム設定の見直しが必要です。

### 不明なエラー（UNKNOWN）

**終了コード:** 1（常にfail-closed）
**発生条件:** 予期しない例外、未処理のエラー

**メッセージ例:**
```
[UNKNOWN] 予期しないエラーが発生しました
→ 原因: TypeError: Cannot read property 'phase' of undefined
→ 対処: これはバグの可能性があります。GitHub Issuesに報告してください
→ デバッグ情報: WORKFLOW_LOG_LEVEL=DEBUG で詳細ログを確認できます
```

不明なエラーは、プログラムのバグを示す可能性があるため、常にブロックされます。
スタックトレースとデバッグ情報を含む詳細ログが出力され、問題報告が促されます。

## 新規MCPツール: workflow_update_intent

本セクションでは、Phase 1で導入される新規MCPツール `workflow_update_intent` の仕様を定義します。
このツールは、タスクの userIntent フィールドを安全に更新するために使用されます。

### 目的と背景

現状、userIntent はタスク開始時にのみ設定でき、後から変更できません。
しかし、タスク実行中に要件が変更される場合があり、その場合は /workflow reset で最初からやり直す必要があります。
workflow_update_intent ツールにより、タスクを再開することなく userIntent を更新できるようになります。

### パラメータ仕様

| パラメータ名 | 型 | 必須 | 説明 | 例 |
|-------------|-----|-----|------|-----|
| taskId | string | オプション | 更新対象のタスクID。省略時はアクティブタスク | "20260215_123456_修正タスク" |
| userIntent | string | 必須 | 新しいuserIntent（最大10000文字） | "要件変更: ログイン機能にOAuth対応を追加" |
| sessionToken | string | オプション | セッショントークン（将来のOrchestrator認証用） | "token_abc123" |

### 実行例

```typescript
// アクティブタスクのuserIntentを更新
mcp__workflow__workflow_update_intent({
  userIntent: "要件変更: ログイン機能にOAuth対応を追加し、既存のパスワード認証も維持する"
})

// 特定のタスクのuserIntentを更新
mcp__workflow__workflow_update_intent({
  taskId: "20260215_123456_修正タスク",
  userIntent: "バグ修正: ユーザー一覧APIのページネーション処理を修正"
})
```

### 動作仕様

1. taskIdが省略された場合、アクティブタスク（task-index.json内のtasksで最新のupdatedAtを持つタスク）を対象とする
2. userIntentの長さが10000文字を超える場合、エラーを返す（既存のworkflow_startと同じ制限）
3. workflow-state.jsonを読み込み、userIntentフィールドを更新してHMAC再計算を行い、保存する
4. 更新後のworkflow-state.jsonをtask-index.jsonに反映（updatedAtを現在時刻に更新）
5. キャッシュを無効化（taskCache.invalidate('task-state')）して、次回読み込み時に最新データを取得可能にする

### エラーケース

| エラーケース | エラーメッセージ |
|-------------|----------------|
| taskIdが存在しない | "Task not found: {taskId}" |
| userIntentが空文字列 | "userIntent cannot be empty" |
| userIntentが10000文字超 | "userIntent exceeds maximum length (10000 characters)" |
| workflow-state.jsonが存在しない | "Workflow state file not found for task: {taskId}" |
| HMAC検証失敗 | "HMAC verification failed. State file may be corrupted." |

### 使用制限

- userIntentの更新はタスクのフェーズに関係なく、いつでも実行可能
- ただし、completedフェーズのタスクは更新できない（エラー: "Cannot update completed task"）
- userIntentの履歴は保存されず、常に最新の値のみが保持される（将来的にhistoryフィールドで履歴管理を検討）

## HMAC鍵ローテーション通知設計

本セクションでは、Phase 1で導入されるHMAC鍵の自動ローテーション機能に関するユーザー通知の仕様を定義します。
HMAC鍵はセキュリティ上の理由から定期的にローテーションされますが、突然のローテーションはユーザーに混乱を招く可能性があります。

### 鍵ローテーションのタイミング

HMAC鍵には以下のフィールドが追加されます：
- `createdAt`: 鍵の作成日時（Unix timestamp）
- `expiresAt`: 鍵の有効期限（Unix timestamp）

有効期限は `createdAt + HMAC_KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000` で計算されます（デフォルト30日）。
鍵の有効期限が切れると、次回のworkflow_start/workflow_next等の操作時に自動的に新しい鍵が生成されます。

### 警告表示のタイミング

鍵の有効期限が3日以内に迫ると、ワークフロー操作時に以下の警告メッセージが表示されます：

```
[WARNING] HMAC鍵の有効期限が近づいています
→ 有効期限: 2026-02-18 12:34:56（残り2日）
→ 推奨: workflow_rotate_hmac_key ツールで手動ローテーションを実行してください
→ 注意: 期限切れ後は古い鍵で署名されたworkflow-state.jsonが検証失敗となります
```

警告は1日1回のみ表示され、同じ鍵に対する重複警告を防ぎます（最終警告日時を .claude/state/hmac-last-warning.json に記録）。

### 自動ローテーションの動作

有効期限切れ後、次回のworkflow操作時に以下の処理が自動実行されます：

1. 新しいHMAC鍵を生成（256-bit random key）
2. 古い鍵を .claude/state/hmac-keys-archive/ に移動（ファイル名: hmac-keys-{timestamp}.json）
3. 全てのアクティブタスクのworkflow-state.jsonを新しい鍵で再署名
4. task-index.jsonを更新（全タスクのupdatedAtを現在時刻に設定）
5. 以下の通知メッセージを表示：

```
[INFO] HMAC鍵がローテーションされました
→ 新しい鍵ID: key_20260218_123456
→ アーカイブ: .claude/state/hmac-keys-archive/hmac-keys-20260215_123456.json
→ 再署名: 3個のアクティブタスクが新しい鍵で再署名されました
```

### 手動ローテーション

ユーザーは任意のタイミングで手動ローテーションを実行できます：

```typescript
mcp__workflow__workflow_rotate_hmac_key({
  reason: "セキュリティポリシー更新のため"
})
```

手動ローテーション時は、有効期限に関係なく即座に新しい鍵が生成されます。
reasonパラメータはオプションですが、アーカイブファイルにメタデータとして記録され、監査ログとして使用できます。

### 旧鍵のアーカイブ保持期間

アーカイブされた旧鍵は、デフォルトで90日間保持されます（HMAC_ARCHIVE_RETENTION_DAYS環境変数で調整可能）。
保持期間を超えた鍵は、次回のワークフロー操作時に自動削除されます。
削除時には以下のログが出力されます：

```
[INFO] 古いHMAC鍵アーカイブを削除しました
→ 削除ファイル: hmac-keys-20250515_123456.json（作成日: 2025-05-15、保持期限超過）
```

## ログ出力設計

本セクションでは、Phase 1～Phase 3で導入されるログ出力の体系化に関する仕様を定義します。
ログは開発者がシステムの動作を理解し、問題を診断するための重要な情報源です。

### ログレベルの定義

ログは以下の4つのレベルに分類され、WORKFLOW_LOG_LEVEL環境変数で出力レベルを制御できます。

| レベル | 用途 | 出力例 | 出力先 |
|-------|------|--------|-------|
| DEBUG | 詳細な内部処理ログ | タスク検出、HMAC検証、AST解析 | stdout |
| INFO | 通常の操作ログ | タスク開始/終了、フェーズ移行 | stdout |
| WARN | 警告（操作は継続） | 鍵期限警告、キャッシュミス | stderr |
| ERROR | エラー（操作が失敗） | HMAC不一致、フェーズ違反 | stderr |

WORKFLOW_LOG_LEVEL=DEBUG を設定すると、全てのレベルのログが出力されます。
WORKFLOW_LOG_LEVEL=ERROR を設定すると、ERRORレベルのログのみが出力されます。

### ログフォーマット

全てのログは以下の統一フォーマットで出力されます：

```
[YYYY-MM-DD HH:MM:SS] [LEVEL] [COMPONENT] メッセージ
```

例：
```
[2026-02-15 12:34:56] [DEBUG] [discover-tasks] task-index.json cache hit (age: 1234ms)
[2026-02-15 12:34:57] [INFO] [workflow] Task started: 20260215_123456_修正タスク
[2026-02-15 12:34:58] [WARN] [hmac] HMAC key expires in 2 days
[2026-02-15 12:34:59] [ERROR] [phase-edit-guard] Phase violation: editing source code in research phase
```

### コンポーネント別ログ出力

各コンポーネントは以下のログを出力します：

#### discover-tasks（タスク検出）

**DEBUGレベル:**
- `task-index.json cache hit (age: {ms}ms)` - キャッシュヒット時
- `task-index.json cache miss, scanning directories` - キャッシュミス時
- `Found {n} active tasks` - タスク検出結果

**INFOレベル:**
- `Task list updated ({n} tasks)` - タスク一覧更新時

**WARNレベル:**
- `task-index.json is stale (age: {ms}ms), rebuilding` - キャッシュ期限切れ時

#### phase-edit-guard（フェーズ編集ガード）

**DEBUGレベル:**
- `Checking file: {path} (phase: {phase}, allowed: {allowed})` - ファイルチェック時
- `HMAC verification passed for task {taskId}` - HMAC検証成功時
- `Scope validation: {path} is within scope` - スコープ検証成功時

**INFOレベル:**
- `Phase transition: {oldPhase} -> {newPhase}` - フェーズ移行時

**ERRORレベル:**
- `Phase violation: editing {path} in {phase} phase` - フェーズ違反時
- `HMAC verification failed for task {taskId}` - HMAC検証失敗時
- `Scope violation: {path} is outside scope` - スコープ違反時

#### bash-whitelist（Bashホワイトリスト）

**DEBUGレベル:**
- `Parsing bash command: {command}` - コマンド解析開始時
- `AST cache hit for command hash {hash}` - ASTキャッシュヒット時
- `Detected command: {cmd}, args: {args}` - コマンド検出時

**WARNレベル:**
- `Detected variable expansion in command: {command}` - 変数展開検出時
- `Detected process substitution in command: {command}` - プロセス置換検出時

**ERRORレベル:**
- `Forbidden command in {phase} phase: {command}` - 禁止コマンド実行時
- `Dangerous pattern detected: {pattern}` - 危険なパターン検出時

#### hmac（HMAC検証）

**DEBUGレベル:**
- `Computing HMAC for task {taskId}` - HMAC計算開始時
- `HMAC match: expected={expected}, actual={actual}` - HMAC検証詳細

**INFOレベル:**
- `HMAC key rotated (new key ID: {keyId})` - 鍵ローテーション時

**WARNレベル:**
- `HMAC key expires in {days} days` - 鍵期限警告

**ERRORレベル:**
- `HMAC mismatch for task {taskId}` - HMAC不一致時

### ログファイル出力

ログは標準出力/エラー出力に加え、以下のファイルにも記録されます：

| ログファイル | 内容 | ローテーション |
|------------|------|--------------|
| `.claude/state/workflow.log` | 全てのログ（WORKFLOW_LOG_LEVEL無視） | 10MB毎、最大5ファイル保持 |
| `.claude/state/workflow-error.log` | ERRORレベルのみ | 1MB毎、最大10ファイル保持 |

ログファイルはローテーション時に `.1`, `.2`, ... の接尾辞が付けられ、古いファイルは自動削除されます。
例: `workflow.log.1`, `workflow.log.2`, ...

### デバッグ支援機能

WORKFLOW_LOG_LEVEL=DEBUG時、以下の追加情報が出力されます：

**スタックトレース:** エラー発生時にスタックトレース全体を出力
**タイミング情報:** 各処理の実行時間をミリ秒単位で出力
**データダンプ:** JSON.stringify()で内部データ構造を出力（ただし、HMACキーは除外）

例：
```
[2026-02-15 12:34:59] [DEBUG] [discover-tasks] Timing: scanDirectories took 1234ms
[2026-02-15 12:34:59] [DEBUG] [discover-tasks] Task data: {"taskId":"...","phase":"research","updatedAt":1739577299000}
```

### ログの無効化

WORKFLOW_LOG_LEVEL=NONE を設定すると、全てのログ出力が無効化されます（ファイル出力も含む）。
ただし、エラー発生時の終了コードは正常に返されます。
この設定は、CLIツールとして使用する場合や、パフォーマンステスト時に有用です。

## CLIインターフェース設計

本セクションでは、ワークフロー操作に関連するCLIコマンドの改善点を定義します。
既存のMCPツール（workflow_start, workflow_nextなど）はCLI経由で呼び出されるため、その使い勝手を向上させます。

### 環境変数の設定方法

開発者は、以下のいずれかの方法で環境変数を設定できます：

**1. シェル環境変数として設定**
```bash
export WORKFLOW_LOG_LEVEL=DEBUG
export TASK_INDEX_TTL_MS=10000
claude-code
```

**2. .envファイルで設定（プロジェクトルート）**
```
WORKFLOW_LOG_LEVEL=DEBUG
TASK_INDEX_TTL_MS=10000
WORKFLOW_FAIL_MODE=open
```

**3. claude.jsonで設定（プロジェクト設定）**
```json
{
  "workflow": {
    "logLevel": "DEBUG",
    "taskIndexTTL": 10000,
    "failMode": "open"
  }
}
```

優先順位: シェル環境変数 > .env > claude.json > デフォルト値

### エラーメッセージの表示改善

従来のエラーメッセージは、単に「操作が許可されていません」と表示するのみでした。
Phase 1の改善により、以下の情報が含まれるようになります：

1. エラーカテゴリ（SECURITY/INTEGRITY/TEMPORARY/UNKNOWN）
2. 問題の具体的な説明
3. 根本原因
4. 推奨される対処方法
5. 関連する環境変数の提案

例（従来）：
```
Error: Operation not allowed
```

例（改善後）：
```
[SECURITY] 現在のフェーズ (research) ではソースコードの編集が許可されていません
→ 原因: src/backend/service.ts は implementation フェーズまで編集できません
→ 対処: /workflow next で implementation フェーズに進むか、/workflow reset で設計を見直してください
→ ヒント: CLAUDE.md の「フェーズごとの編集可能ファイル」セクションを参照してください
```

### プログレス表示

大規模プロジェクトでは、タスク検出やHMAC検証に時間がかかる場合があります。
Phase 3で導入されるプログレス表示により、処理の進行状況が可視化されます：

```
Scanning workflow directories... [████████████░░░░░░░░] 60% (12/20 tasks)
```

プログレス表示はWORKFLOW_LOG_LEVEL=INFOまたはWARN時のみ有効で、DEBUG時は抑制されます（詳細ログが優先されるため）。

### 対話的な確認プロンプト

セキュリティ上重要な操作（HMAC鍵ローテーション、タスクリセット等）は、確認プロンプトを表示します：

```
HMAC鍵をローテーションします。全てのアクティブタスクが再署名されます。
続行しますか？ [y/N]:
```

プロンプトは標準入力から読み取られ、5秒以内に入力がない場合はタイムアウトしてキャンセルされます。
CI環境では、WORKFLOW_INTERACTIVE=false を設定することで、全てのプロンプトを自動的にYesとして扱えます。

### ヘルプメッセージの改善

各MCPツールのヘルプメッセージに、環境変数の説明を追加します：

```
/workflow start <タスク名> - 新しいワークフローを開始

環境変数:
  TASK_INDEX_TTL_MS - タスク一覧キャッシュの有効期限（デフォルト: 5000ms）
  WORKFLOW_LOG_LEVEL - ログレベル（DEBUG/INFO/WARN/ERROR、デフォルト: INFO）
  WORKFLOW_FAIL_MODE - エラー時の挙動（closed/open、デフォルト: closed）

例:
  WORKFLOW_LOG_LEVEL=DEBUG /workflow start "バグ修正タスク"
```

ヘルプメッセージは、/workflow help コマンドで表示されるほか、MCPツールのエラーメッセージにも含まれます。

### バッチ処理モード

CI環境では、複数のワークフロー操作を自動化する必要があります。
Phase 2で導入されるバッチ処理モードにより、JSONファイルで操作シーケンスを定義できます：

```json
{
  "operations": [
    { "command": "start", "args": { "taskName": "修正タスク" } },
    { "command": "next" },
    { "command": "next" },
    { "command": "approve", "args": { "type": "design" } },
    { "command": "next" }
  ]
}
```

バッチファイルは以下のコマンドで実行されます：

```bash
/workflow batch operations.json
```

各操作の結果はJSONL形式で出力され、CI/CDパイプラインでの解析が容易になります。

## APIレスポンス設計

本セクションでは、MCPツールのレスポンス形式を定義します。全てのワークフロー制御ツールは統一されたJSON形式でレスポンスを返します。

### 共通レスポンスフィールド

全MCPツールのレスポンスに含まれる共通フィールドを定義します。

- `success` (boolean): 操作の成否を示すフラグ
- `message` (string): 人間可読な結果メッセージ
- `taskId` (string): 対象タスクのID（該当する場合）
- `phase` (string): 現在のワークフローフェーズ
- `workflow_context` (object): ワークフロー状態のコンテキスト情報

### workflow_start レスポンス

タスク開始時のレスポンスには、上記共通フィールドに加えて以下が含まれます。

- `taskName` (string): 作成されたタスクの名前
- `workflowDir` (string): ワークフロー状態ファイルの保存先パス
- `docsDir` (string): ドキュメント成果物の保存先パス
- `taskSize` (string): タスクサイズ（"large" 固定）
- `sessionToken` (string): セッション認証トークン

### workflow_next レスポンス

フェーズ遷移時のレスポンスには以下のフィールドが追加されます。

- `previousPhase` (string): 遷移前のフェーズ名
- `nextPhase` (string): 遷移後のフェーズ名
- `skippedPhases` (array): スキップされたフェーズとその理由
- `validationErrors` (array): 成果物バリデーションエラー（存在する場合）

### workflow_update_intent レスポンス

userIntent更新時のレスポンスは共通フィールドに加えて以下を含みます。

- `previousIntent` (string): 更新前のuserIntent値
- `newIntent` (string): 更新後のuserIntent値

### エラーレスポンス形式

エラー発生時は`success: false`と共に以下のフィールドが返されます。

- `error` (string): エラーの種類を示すコード（VALIDATION_ERROR, HMAC_ERROR, PHASE_ERROR等）
- `details` (array): 詳細なエラー情報のリスト

## 設定ファイル設計

本セクションでは、ワークフロープラグインが使用する設定ファイルの形式と配置を定義します。

### hmac-keys.json のスキーマ拡張

Phase 2で導入される鍵ローテーション対応のスキーマ変更を定義します。

現在のスキーマ（配列形式）から、current/previous構造を持つオブジェクト形式に移行します。

- `schemaVersion` (number): スキーマバージョン（2に更新）
- `current` (object): 現在アクティブな鍵オブジェクト
  - `key` (string): HMAC鍵（hex文字列、64文字）
  - `generation` (number): 鍵の世代番号
  - `createdAt` (string): 鍵作成日時（ISO 8601）
  - `expiresAt` (string): 鍵有効期限（ISO 8601、createdAt + 30日）
- `previous` (object|null): 前世代の鍵オブジェクト（ローテーション後に設定）
- `lastRotation` (string|null): 最後にローテーションを実行した日時

### task-index.json のスキーマ統一

Phase 1で実施されるスキーマ統一後の形式を定義します。Hookスキーマに統一されます。

- `tasks` (array): タスク情報の配列
  - 各要素: `{id, name, workflowDir, docsDir, phase, updatedAt}`
- `updatedAt` (number): 最終更新タイムスタンプ

MCP server側のマップ形式エントリ（`{taskId: relativePath}`）は廃止され、tasks配列のみが正規データとなります。

### .claude/settings.json のhook定義

ワークフローhookの定義形式は変更しませんが、以下の環境変数が参照可能になります。

- `WORKFLOW_FAIL_MODE`: フックエラー時の挙動制御（open/closed）
- `TASK_INDEX_TTL_MS`: キャッシュTTL設定
- `WORKFLOW_LOG_LEVEL`: ログレベル制御

これらは各hookスクリプト内で`process.env`経由で参照されます。

## まとめ

本ドキュメントでは、ワークフロープラグインの10M行規模対応における開発者体験改善の詳細仕様を定義しました。
環境変数により柔軟な設定が可能になり、エラーメッセージの改善により問題解決が容易になります。
新規MCPツールworkflow_update_intentにより、タスクの途中での要件変更が可能になります。
HMAC鍵ローテーション通知により、セキュリティと使いやすさの両立が実現されます。
ログ出力の体系化により、デバッグ効率が大幅に向上します。

これらの改善は、大規模プロジェクトでのワークフロー運用を安定させ、開発者がワークフローシステムに対する信頼性を高めることに貢献します。
全ての変更は既存のデフォルト動作との互換性を保ち、段階的な移行が可能です。
