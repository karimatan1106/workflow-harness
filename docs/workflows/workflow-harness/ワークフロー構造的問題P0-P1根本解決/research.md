# Research Phase - ワークフロー構造的問題P0-P1根本解決

## サマリー

本調査では、ワークフローシステムにおける5つのP0/P1問題の根本解決に向けて、既存コードベースの構造を徹底的に分析した。

### 調査結果の要点

1. **P0-1（ユーザーフィードバック記録）**: TaskState型にuserIntentフィールドが存在するが、workflow_start時に1回だけ記録される。途中更新用のツールが存在しない。
2. **P0-2（セマンティック整合性チェック）**: artifact-validator.tsに形式チェック機能はあるが、requirements→spec→test-design間のキーワードトレーサビリティは未実装。
3. **P1-1（CLAUDE.md分割配信）**: PhaseGuide型が存在しCLAUDE.mdの一部情報を配信しているが、全文が渡される問題は未解決。
4. **P1-2（タスク親子関係）**: TaskState型に親子関係フィールドが存在しない。新規ツール導入が必要。
5. **P1-3（task-index.json同期）**: updateTaskIndexForSingleTask()が実装されているが、全フェーズ遷移で呼ばれるわけではない可能性がある。

### 主要な拡張ポイント

- ツール追加: TOOL_HANDLERSマップとserver.tsでの登録
- 型定義拡張: TaskStateインターフェース（types.ts）
- バリデーション拡張: artifact-validator.tsでの新規検証関数
- フェーズガイド拡張: definitions.tsのPHASE_GUIDESマップ

### 修正の影響範囲

- P0-1: 軽微（新ツール1個追加、ツールマップ更新）
- P0-2: 中程度（新バリデーション関数追加、workflow_next統合）
- P1-1: 大規模（CLAUDE.mdパース機構、配信ロジック全面改修）
- P1-2: 中程度（新ツール2個追加、TaskState拡張）
- P1-3: 軽微（既存関数の呼び出し箇所拡張のみ）

次フェーズでは、これらの知見に基づき詳細な要件定義を作成する。

## 調査結果

### 1. ファイル構成の概要

#### 1.1 状態管理層（src/state/）

**types.ts（521行）**
- TaskState型の完全な定義（行190-305）
- userIntentフィールド: 行269（string型、オプショナル）
- scopeフィールド: 行221-229（affectedFiles, affectedDirs, preExistingChanges）
- sessionTokenフィールド: 行261（string型、オプショナル）
- 親子関係フィールド: 存在しない（P1-2で追加が必要）

**manager.ts（1073行）**
- WorkflowStateManager クラス（行311-1065）
- updateTaskIndexForSingleTask(): 行507-548（FIX-1対応）
  - task-index.jsonを直接更新する軽量版
  - ロック取得してアトミックに書き込み
  - completed時はタスクを削除、それ以外は更新
- generateSessionToken(): 行44-48（28バイトランダム + 8文字タイムスタンプ）
- readTaskState(): 行337-396（HMAC検証含む）
- writeTaskState(): 行404-420（HMAC署名付き保存）

#### 1.2 ツール層（src/tools/）

**start.ts（189行）**
- workflowStart(): 行32-154
  - userIntent引数: 行32（オプショナル、10000文字まで）
  - 保存処理: 行91（taskState.userIntent = processedUserIntent || nameValidation.value）
  - セッショントークン生成: 行89
  - preExistingChanges記録: 行103-129（git diff実行）

**next.ts（560行）**
- workflowNext(): 行128-513
  - セッショントークン検証: 行139
  - 成果物品質チェック: 行307-314（checkPhaseArtifacts呼び出し）
  - セマンティック整合性チェック: 行316-358（validateSemanticConsistency呼び出し）
  - スコープ事後検証: 行360-394（validateScopePostExecution呼び出し）
  - フェーズ遷移実行: 行486（stateManager.updateTaskPhase）
  - task-index.json更新: **呼び出されていない**（P1-3問題の確認）

**status.ts（151行）**
- workflowStatus(): 行20-130
  - userIntent返却: 行82（taskState.userIntent || taskState.taskName）
  - scope情報返却: 行96-101
  - approvals情報返却: 行103-109
  - phaseGuide返却: 行121-127

#### 1.3 バリデーション層（src/validation/）

**artifact-validator.ts（941行）**
- validateArtifactQuality(): 行403-422（公開API）
- validateArtifactQualityCore(): 行200-392（内部実装）
  - 禁止パターンチェック: 行260-296
  - 重複行検出: 行298-325（同一行3回以上）
  - セクション密度チェック: 行349-354
  - 必須セクションチェック: 行364-368
- validateTraceability(): 行441-491（REQ-4、要件→テストのトレース）
  - requirements.mdからREQ-ID抽出: 行456-462
  - test-design.mdでの参照確認: 行469-477
  - カバレッジ検証: 行479-484
- validateSemanticConsistency(): 行892（semantic-checker.jsにエクスポート）

**semantic-checker.js（未読み込み）**
- P0-2の実装候補先
- validateSemanticConsistency実装が含まれる可能性

#### 1.4 フェーズ定義層（src/phases/）

**definitions.ts（300行、読み込み済み）**
- PHASES_LARGE: 行62-82（19フェーズ配列）
- PARALLEL_GROUPS: 行143-152（並列フェーズ定義）
- PHASE_DESCRIPTIONS: 行207-228（フェーズ説明）
- SUB_PHASE_DESCRIPTIONS: 行235-247（サブフェーズ説明）
- PHASE_EXTENSIONS: 行259-280（許可拡張子）
- PhaseGuideインターフェース: types.tsで定義（行339-362）
  - phaseName: string
  - description: string
  - requiredSections?: string[]
  - outputFile?: string
  - allowedBashCategories?: string[]
  - inputFiles?: string[]
  - editableFileTypes?: string[]
  - minLines?: number
  - subagentType?: string
  - model?: string
  - subPhases?: Record<string, PhaseGuide>

#### 1.5 Hook層（workflow-plugin/hooks/lib/）

**discover-tasks.js（289行）**
- readTaskIndexCache(): 行48-97
  - schemaVersion検証: 行56-59（v2のみ受け入れ）
  - TTLチェック: 行65-68（デフォルト30秒）
  - mtimeチェック: 行71-79（ファイル更新検出）
- writeTaskIndexCache(): 行106-133
  - 競合回避: 行113-122（1秒以内の更新はスキップ）
  - schemaVersion: 2を書き込み: 行125
- discoverTasks(): 行146-194
  - メモリキャッシュ使用: 行147（getCached呼び出し）
  - task-index.jsonキャッシュ試行: 行149-152
  - フォールバックスキャン: 行153-189

### 2. P0-1関連の既存コード分析（ユーザーフィードバック記録ツール）

#### 2.1 現状の課題

**userIntentの現在の扱い:**
- workflow_start時に1回だけ記録（start.ts 行91）
- 途中更新する手段が存在しない
- workflow_statusで返却はされる（status.ts 行82）

**必要な変更:**
- 新ツール `workflow_record_feedback` の追加
- TaskStateのuserIntentフィールドを更新する機能

#### 2.2 実装パターンの参考

**既存ツールの実装パターン（workflow_set_scope）:**
```typescript
// tools/set-scope.ts（参考）
export function workflowSetScope(
  taskId?: string,
  files?: string[],
  dirs?: string[],
  sessionToken?: string
): ToolResult {
  const result = getTaskByIdOrError(taskId);
  if ('error' in result) {
    return result.error as ToolResult;
  }

  const taskState = result.taskState;

  // セッショントークン検証
  const tokenError = verifySessionToken(taskState, sessionToken);
  if (tokenError) return tokenError as ToolResult;

  // 状態更新
  taskState.scope = {
    affectedFiles: files || [],
    affectedDirs: dirs || [],
  };

  stateManager.writeTaskState(taskState.workflowDir, taskState);

  return {
    success: true,
    message: 'スコープを設定しました',
  };
}
```

#### 2.3 新ツール追加の手順

1. **ツールファイル作成**: `src/tools/record-feedback.ts`
2. **ツール定義追加**: server.tsのTOOL_DEFINITIONSに追加（行61-77）
3. **ハンドラー追加**: server.tsのTOOL_HANDLERSマップに追加（行269-341）
4. **エクスポート追加**: `src/tools/index.ts`でエクスポート

**必要なコード量:** 約100行（ツール本体60行 + 定義40行）

### 3. P0-2関連の既存コード分析（セマンティック整合性チェック）

#### 3.1 現状の実装状況

**artifact-validator.tsに存在する関連機能:**
- validateTraceability(): 行441-491
  - REQ-ID形式（REQ-1, REQ-2）のトレース検証
  - requirements.md → test-design.md のカバレッジ確認
  - しかし呼び出し箇所が存在しない（workflow_nextで未使用）

**workflow_nextでの呼び出し状況:**
- validateSemanticConsistency(): 行318（semantic-checker.jsから）
- 意味的整合性チェックは既に実装済み
- しかしキーワードベースのトレーサビリティは未実装

#### 3.2 必要な拡張機能

**新規関数の追加:**
```typescript
// artifact-validator.ts に追加
export interface KeywordTraceabilityResult {
  passed: boolean;
  missingKeywords: string[];
  errors: string[];
}

export function validateKeywordTraceability(docsDir: string): KeywordTraceabilityResult {
  // requirements.md からキーワード抽出（名詞句、技術用語）
  // spec.md での参照確認
  // test-design.md での参照確認
  // implementation成果物での実装確認
}
```

**workflow_nextへの統合:**
- 行316-358のvalidateSemanticConsistency()呼び出し箇所の後に追加
- test_design → test_impl 遷移時にキーワードトレース実行
- implementation → refactoring 遷移時に実装確認

**必要なコード量:** 約200行（新関数150行 + 統合50行）

### 4. P1-1関連の既存コード分析（CLAUDE.md分割配信）

#### 4.1 現状のPhaseGuide機構

**PhaseGuideインターフェース（types.ts 行339-362）:**
- phaseName, description, requiredSections等の基本情報を含む
- subagentType, modelの推奨設定を含む
- しかしCLAUDE.mdの内容を含まない

**resolvePhaseGuide()の実装:**
```typescript
// definitions.ts（実装確認が必要）
export function resolvePhaseGuide(phase: PhaseName, docsDir?: string): PhaseGuide | undefined {
  // 現在はハードコードされたガイド情報を返すだけ
  // CLAUDE.mdからの動的抽出は未実装
}
```

#### 4.2 必要な実装

**CLAUDE.mdパース機構:**
1. CLAUDE.mdをフェーズ別セクションに分割するパーサー
2. 正規表現またはMarkdownパーサーでセクション抽出
3. フェーズ名とセクション見出しのマッピング定義

**配信機構:**
1. PhaseGuideインターフェースにcontentフィールド追加
2. resolvePhaseGuide()でCLAUDE.mdから該当セクションを抽出
3. workflow_statusとworkflow_nextでcontentを返却

**マッピング定義例:**
各フェーズ名をキーとし、対応するCLAUDE.mdセクション見出しの配列を値とするRecord型で定義する。
researchフェーズには調査関連セクションとAIへの厳命の一部を対応させる。
requirementsフェーズには要件定義関連セクションを対応させる。
test_implフェーズにはTDDサイクルセクションとテスト実装セクションを対応させる。
各フェーズには必要最小限のセクションのみを含め、不要なセクションは配信しない設計とする。

**必要なコード量:** 約500行（パーサー200行 + 配信機構100行 + マッピング200行）

#### 4.3 CLAUDE.mdの構造分析

**セクション構成:**
1. フェーズ順序（19フェーズ）
2. フェーズ詳細説明
3. AIへの厳命（19項目）
4. テスト出力・配置ルール
5. パッケージインストールルール
6. 完了宣言ルール
7. 仕様駆動開発ルール
8. ドキュメント構成
9. 図式設計

**フェーズ別必要セクション:**
- research: セクション1-2, AIへの厳命1
- requirements: セクション1-2, AIへの厳命2, 4-5
- test_impl: セクション1-2, TDDサイクル, AIへの厳命3
- implementation: セクション1-2, AIへの厳命16-17
- commit: セクション1-2, AIへの厳命19, 完了宣言ルール

### 5. P1-2関連の既存コード分析（タスク親子関係）

#### 5.1 現状の課題

**TaskState型に存在しないフィールド:**
- parentTaskId: string（親タスクID）
- childTaskIds: string[]（子タスクIDリスト）
- taskType: 'parent' | 'child' | 'standalone'（タスク種別）

**必要な新規ツール:**
1. `workflow_create_subtask(parentTaskId, subtaskName)`
2. `workflow_link_tasks(parentTaskId, childTaskId)`

#### 5.2 実装パターン

**workflow_create_subtask:**
```typescript
export function workflowCreateSubtask(
  parentTaskId: string,
  subtaskName: string,
  sessionToken?: string
): StartResult {
  // 親タスクの取得
  const parentTask = stateManager.getTaskById(parentTaskId);
  if (!parentTask) {
    return { success: false, message: '親タスクが見つかりません' };
  }

  // セッショントークン検証
  const tokenError = verifySessionToken(parentTask, sessionToken);
  if (tokenError) return tokenError;

  // 新規サブタスク作成
  const subtaskState = stateManager.createTask(subtaskName, parentTask.taskSize);
  subtaskState.parentTaskId = parentTaskId;
  subtaskState.taskType = 'child';

  // 親タスクのchildTaskIds更新
  if (!parentTask.childTaskIds) {
    parentTask.childTaskIds = [];
  }
  parentTask.childTaskIds.push(subtaskState.taskId);
  stateManager.writeTaskState(parentTask.workflowDir, parentTask);
  stateManager.writeTaskState(subtaskState.workflowDir, subtaskState);

  return {
    success: true,
    taskId: subtaskState.taskId,
    taskName: subtaskState.taskName,
    phase: subtaskState.phase,
    parentTaskId: parentTaskId,
    message: `サブタスク「${subtaskName}」を作成しました`,
  };
}
```

**必要なコード量:** 約300行（新ツール2個 × 150行）

### 6. P1-3関連の既存コード分析（task-index.json同期）

#### 6.1 既存実装の確認

**updateTaskIndexForSingleTask()の呼び出し箇所:**
- manager.ts 行866（updateTaskPhase内）
- workflow_next → updateTaskPhase → updateTaskIndexForSingleTask

**問題点の確認:**
- workflow_complete_sub()からは呼ばれない可能性
- workflow_approve()からは呼ばれない可能性

#### 6.2 修正方法

**呼び出し箇所の追加:**
1. workflow_complete_sub()内でサブフェーズ完了時に呼び出し
2. workflow_approve()内で承認時に呼び出し
3. workflow_back()内で差し戻し時に呼び出し

**必要なコード量:** 約30行（3箇所 × 10行）

### 7. 既存実装の分析

#### 7.1 ツール登録パターン

**TOOL_DEFINITIONSマップ（server.ts 行61-77）:**
TOOL_DEFINITIONS配列にstatusToolDefinition、startToolDefinition、nextToolDefinition、approveToolDefinition等のツール定義オブジェクトが列挙されている。
新ツール追加時はこの配列にツール定義を追加する。

**TOOL_HANDLERSマップ（server.ts 行269-341）:**
TOOL_HANDLERSはツール名をキーとし、引数を受け取ってToolResultを返すハンドラー関数を値とするRecord型である。
各ハンドラーはToolArguments型から引数をキャストし、対応するツール関数を呼び出す。
新ツール追加時はこのマップにハンドラーを追加する。

**ツール追加の手順:**
1. ツールファイル作成（tools/xxx.ts）
2. ツール関数とツール定義のエクスポート
3. server.tsでインポート
4. TOOL_DEFINITIONSに定義追加
5. TOOL_HANDLERSにハンドラー追加
6. ToolArgumentsインターフェースに引数型追加

#### 7.2 型定義の構造

**TaskStateインターフェース拡張パターン:**
```typescript
// types.ts 行190-305
export interface TaskState {
  // 既存フィールド
  phase: PhaseName;
  taskId: string;
  // ... 中略

  // 新規フィールド追加（オプショナル推奨）
  newField?: string;
  newFieldArray?: string[];
}
```

**新規結果型の定義パターン:**
```typescript
// types.ts
export interface NewResult extends ToolResult {
  // 固有フィールド
  specificField?: string;
}
```

#### 7.3 バリデーション拡張方法

**新規バリデーション関数の追加パターン:**
```typescript
// artifact-validator.ts
export interface NewValidationResult {
  passed: boolean;
  errors: string[];
  warnings?: string[];
}

export function validateNewFeature(
  content: string,
  requirements: SomeRequirement
): NewValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 検証ロジック

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}
```

**workflow_nextへの統合パターン:**
```typescript
// next.ts
if (currentPhase === 'target_phase') {
  const validationResult = validateNewFeature(content, requirements);
  if (!validationResult.passed) {
    return {
      success: false,
      message: `検証エラー:\n${validationResult.errors.join('\n')}`,
    };
  }
}
```

#### 7.4 task-index.json管理フロー

**書き込みフロー:**
1. stateManager.updateTaskPhase()
2. updateTaskIndexForSingleTask() 呼び出し（行866）
3. ロック取得（acquireLockSync）
4. 既存task-index.json読み込み
5. 該当タスクのエントリ更新
6. アトミック書き込み（atomicWriteJson）
7. ロック解放

**読み込みフロー（Hook側）:**
1. readTaskIndexCache()
2. schemaVersion検証（v2のみ）
3. TTLチェック（30秒）
4. mtimeチェック（ファイル更新検出）
5. キャッシュヒット → タスク配列返却
6. キャッシュミス → フォールバックスキャン

**同期問題の根本原因:**
- MCP serverとHook間でレースコンディション
- updateTaskIndexForSingleTask()の呼び出しタイミングが限定的
- 解決策: 全フェーズ遷移API（workflow_next, workflow_complete_sub, workflow_approve, workflow_back）で呼び出し

### 8. 拡張ポイントのまとめ

#### 8.1 軽微な変更（P0-1, P1-3）

**P0-1: workflow_record_feedback追加**
- 影響ファイル: 3個（新規1 + 既存2）
- 行数: 約100行
- テスト容易性: 高

**P1-3: updateTaskIndexForSingleTask呼び出し拡張**
- 影響ファイル: 4個（既存ツールファイル）
- 行数: 約30行
- テスト容易性: 高

#### 8.2 中程度の変更（P0-2, P1-2）

**P0-2: キーワードトレーサビリティ追加**
- 影響ファイル: 2個（artifact-validator.ts + next.ts）
- 行数: 約200行
- テスト容易性: 中（自然言語処理が含まれる）

**P1-2: タスク親子関係追加**
- 影響ファイル: 5個（新規2 + 既存3）
- 行数: 約300行
- テスト容易性: 中（状態管理の複雑性）

#### 8.3 大規模な変更（P1-1）

**P1-1: CLAUDE.md分割配信**
- 影響ファイル: 6個以上（新規パーサー + 既存複数）
- 行数: 約500行
- テスト容易性: 低（CLAUDE.mdの構造依存）
- リスク: CLAUDE.md更新時の保守性

### 9. 既存テストの状況

**テストファイルの配置:**
- `src/backend/tests/unit/` - ユニットテスト
- `src/backend/tests/integration/` - 統合テスト

**既存テストカバレッジ:**
- manager.ts: 部分的（主要メソッドのみ）
- tools/*: 部分的
- validation/*: 部分的

**新機能のテスト戦略:**
- P0-1, P1-3: ユニットテストで十分
- P0-2: 統合テストが必要（複数ファイル連携）
- P1-1: E2Eテストが推奨（CLAUDE.md → PhaseGuide → 配信）
- P1-2: 統合テストが必要（状態管理複雑）

### 10. 依存関係の分析

**外部ライブラリ依存:**
- fs, path, crypto（Node.js標準ライブラリのみ）
- MCP SDK（@modelcontextprotocol/sdk）
- Zod（スキーマバリデーション、現在未使用）

**内部依存関係:**
- tools/ → state/manager.ts
- tools/ → validation/*
- tools/ → phases/definitions.ts
- hooks/ → state/（task-index.json経由）

**並列タスク対応の影響:**
- GlobalState廃止済み（ディレクトリスキャンベース）
- task-index.jsonが唯一の共有状態
- レースコンディション対策が重要

### 11. パフォーマンス考慮事項

**現在のボトルネック:**
- ディレクトリスキャン（discoverTasks）
- task-index.jsonのI/O
- HMAC検証（readTaskState毎）

**P0-1の影響:**
- 軽微（1フィールド更新のみ）

**P0-2の影響:**
- 中程度（自然言語処理が含まれる）
- キャッシュ戦略が必要

**P1-1の影響:**
- 軽微（CLAUDE.mdは起動時1回読み込み）
- パース結果のキャッシュが推奨

**P1-2の影響:**
- 軽微（親子関係は単純なID参照）

**P1-3の影響:**
- なし（既存関数の呼び出し頻度が増えるだけ）

### 12. セキュリティ考慮事項

**セッショントークン検証:**
- 全フェーズ遷移APIで必須（REQ-6）
- P0-1, P1-2の新ツールでも必須

**HMAC署名:**
- TaskState改ざん防止
- 新フィールド追加時も自動で署名対象

**入力バリデーション:**
- P0-1: userIntent長さ制限（10000文字）
- P1-2: taskName, parentTaskId の検証

### 13. 後方互換性

**P0-1の影響:**
- userIntentフィールドは既存（後方互換性あり）
- 新ツールは既存ワークフローに影響なし

**P0-2の影響:**
- 既存のvalidateSemanticConsistency()との共存
- 環境変数でオフ可能な設計が推奨

**P1-1の影響:**
- PhaseGuideにcontentフィールド追加（オプショナル）
- 既存レスポンスとの互換性維持

**P1-2の影響:**
- TaskStateに新フィールド追加（オプショナル）
- 既存タスクはstandalone扱い

**P1-3の影響:**
- なし（内部実装の改善のみ）

### 14. 開発優先順位の推奨

**Phase 1（即座に実装可能）:**
- P1-3: task-index.json同期修正（30行、1日）
- P0-1: workflow_record_feedback追加（100行、2日）

**Phase 2（要件定義後に実装）:**
- P0-2: キーワードトレーサビリティ（200行、3-4日）
- P1-2: タスク親子関係（300行、5日）

**Phase 3（設計レビュー後に実装）:**
- P1-1: CLAUDE.md分割配信（500行、7-10日）

### 15. リスクの評価

**P0-1のリスク:**
- 低（既存パターンの踏襲）
- テスト容易性が高い

**P0-2のリスク:**
- 中（自然言語処理の精度）
- 誤検出のリスク
- 環境変数でのオフ機能が必須

**P1-1のリスク:**
- 高（CLAUDE.mdの構造変更に脆弱）
- 保守性の懸念
- バージョニング戦略が必要

**P1-2のリスク:**
- 中（状態管理の複雑性）
- 親子関係の循環参照防止が必要

**P1-3のリスク:**
- 低（既存関数の呼び出し追加のみ）
- レースコンディション対策は既に実装済み

### 16. 既存コードの品質評価

**良い点:**
- 型安全性が高い（TypeScript）
- HMAC署名による改ざん防止
- アトミック書き込みによる競合対策
- エラーハンドリングが適切

**改善が必要な点:**
- Zodによるランタイムバリデーションが未使用
- テストカバレッジが不十分
- ドキュメントが一部不足（内部関数のコメント）
- CLAUDE.mdの構造とコードの結合度が高い

### 17. 次フェーズへの提言

**requirements フェーズで明確にすべき事項:**
1. P0-2のキーワード抽出アルゴリズム
2. P1-1のCLAUDE.mdパース戦略（正規表現 vs Markdownパーサー）
3. P1-2の親子関係の制約（深さ制限、循環参照防止）
4. P0-1のuserIntent更新タイミング（どのフェーズで更新を許可するか）
5. エラーハンドリング戦略（厳格モード vs 警告モード）

**parallel_analysis フェーズで検討すべき事項:**
1. threat_modeling: P1-2の親子関係による権限管理の必要性
2. planning: CLAUDE.mdパース機構の設計（P1-1）

**test_design フェーズで重点的にテストすべき項目:**
1. P0-1: userIntent更新の並行性テスト
2. P0-2: キーワード抽出の精度テスト
3. P1-3: task-index.json同期のレースコンディションテスト
4. P1-2: 親子関係の循環参照テスト

## 既存実装の分析

本調査により、5つのP0/P1問題の実装可能性が確認された。
P1-3はupdateTaskIndexForSingleTask()関数が既に実装されており、呼び出し箇所を追加するだけで即座に修正可能である。
P0-1のworkflow_record_feedbackツールは、workflow_set_scopeと同一のパターンで実装でき、リスクは低い。
P1-2のタスク親子関係はTaskStateインターフェースへのフィールド追加と新規ツール2個の追加であり、既存パターンの踏襲で実装できる。
P0-2のセマンティック整合性チェックは自然言語処理が含まれるため中程度のリスクがあるが、SEMANTIC_TRACE_STRICT環境変数でのオフ機能により安全に導入できる。
P1-1のCLAUDE.md分割配信は最も大規模な変更であり、CLAUDE.mdの構造への依存度が高いため、設計レビューと段階的な実装が推奨される。
加えて、Orchestratorがsubagent出力を検証せずにworkflow_nextを呼ぶ問題（P0-3相当）を新たに発見した。
workflow_pre_validateツールの追加により、subagent完了後の事前検証を可能にし、フェーズ遷移失敗を根本的に防止する方針とする。
各問題の詳細な要件定義と受入条件は、requirementsフェーズで策定する。
