# テスト設計書: ワークフロー10M対応全問題根本原因修正

## サマリー

本テスト設計書は、ワークフロープラグインの10M行規模対応における13件の修正要件に対するテスト戦略とテストケースを定義する。
既存の772テスト全件との互換性を維持しながら、各REQに対して最低2-3のテストケースを新規追加する。
テスト実装はvitest形式で行い、既存のテスト構造（workflow-plugin/mcp-server/src/__tests__/配下）に統合する。

主要な設計決定事項:
- Phase 1（P0修正3件）を最優先でテスト実装
- 各REQに対してユニットテスト・統合テスト・境界値テストを組み合わせて実施
- 既存テストのモックパターン（fs, lock-utils, cache）を踏襲
- 正常系・異常系・境界値をカバーする網羅的なテストケース設計

次フェーズで必要な情報:
- 各テストファイルのパス・テストケース名・期待結果の詳細一覧
- vitest設定（timeout、並列実行設定）
- モック戦略（特にファイルシステムとHMAC検証）

## テスト戦略

### 全体方針

- 既存テスト互換性: 既存772テストのモック構造・アサーション形式を維持
- TDDアプローチ: test_implフェーズで失敗するテストを作成し、implementationフェーズで成功させる
- 段階的実装: Phase 1→2→3→4の順で実施
- カバレッジ目標: 各REQに対して最低3テストケース（正常系1+異常系1+境界値1）

### テストレベル分類

| テストレベル | 対象REQ | 配置先 |
|------------|---------|--------|
| ユニットテスト | REQ-1,2,5,6,8,10,12 | src/{module}/__tests__/ |
| 統合テスト | REQ-3,4,7,9,11 | tests/hooks/, tests/unit/ |
| フェーズテスト | REQ-13 | src/tools/__tests__/ |

### モック戦略

既存テストと同様に以下をモック化:
- fsモジュール（readdirSync, statSync, existsSync, readFileSync, writeFileSync等）
- lock-utils.js（acquireLock, atomicWriteJson）
- cache.js（taskCache.get, set, invalidate）
- cryptoモジュール（REQ-6のHMAC鍵生成テスト用）

## REQ別テストケース一覧

### Phase 1: P0修正（3件）

#### REQ-1: task-index.jsonデュアルスキーマ競合の解消

対象ファイル: mcp-server/src/state/manager.ts

**TC-1-1: saveTaskIndex()がHookスキーマで書き込む**

- Given: WorkflowStateManagerインスタンスと複数のアクティブタスク
- When: saveTaskIndex()を呼び出す
- Then: atomicWriteJsonが`{tasks: [...], updatedAt}`形式で呼ばれる。taskCache.invalidate('task-list')が呼ばれる

**TC-1-2: loadTaskIndex()がHookスキーマを優先読み込み**

- Given: task-index.jsonにHookスキーマ形式のデータが存在
- When: loadTaskIndex()を呼び出す
- Then: tasks配列から正しくタスクマップを構築する

**TC-1-3: loadTaskIndex()がレガシーマップをフォールバック処理**

- Given: task-index.jsonにレガシーマップ形式`{taskId: workflowDir}`のデータが存在
- When: loadTaskIndex()を呼び出す
- Then: レガシー形式を読み込み、警告ログを出力し、次回保存時にHookスキーマに自動移行

**TC-1-4: createTask()が新タスクをtask-index.jsonに追加**

- Given: 既存タスクが1件存在
- When: createTask('新タスク')を呼び出す
- Then: saveTaskIndex()が呼ばれ、tasks配列の長さが2になる

**TC-1-5: 並列書き込み時のロック競合処理**

- Given: 2つのプロセスが同時にsaveTaskIndex()を呼び出す
- When: ファイルロックの取得を試みる
- Then: データ破損が発生しない

テストファイル: `src/state/__tests__/task-index-schema.test.ts`

#### REQ-2: フック性能O(n)→O(1)改善

対象ファイル: hooks/lib/discover-tasks.js, hooks/phase-edit-guard.js

**TC-2-1: task-index.jsonキャッシュによるディレクトリスキャン回避**

- Given: task-index.jsonが存在しupdatedAtが最新
- When: discoverTasks()を呼び出す
- Then: readdirSyncが呼ばれない（ディレクトリスキャン回避）

**TC-2-2: キャッシュ無効時のディレクトリスキャンフォールバック**

- Given: task-index.jsonが存在しないまたは古い
- When: discoverTasks()を呼び出す
- Then: readdirSyncが呼ばれる（フォールバック）

**TC-2-3: アクティブタスクのみHMAC検証**

- Given: 10個のタスクが存在し、1個のみアクティブ
- When: フック実行時にHMAC検証を行う
- Then: HMAC検証がアクティブタスク（1個）に対してのみ実行される

**TC-2-4: キャッシュTTL環境変数の反映**

- Given: TASK_INDEX_TTL_MS=10000が設定されている
- When: キャッシュTTLを参照する
- Then: 10秒間キャッシュが有効になる

テストファイル: `tests/hooks/req2-hook-performance.test.ts`

#### REQ-3: Fail-Closed緩和

対象ファイル: hooks/phase-edit-guard.js, hooks/enforce-workflow.js

**TC-3-1: HMAC検証失敗でexit(2)**

- Given: workflow-state.jsonのHMACが不正
- When: フックを実行
- Then: エラーカテゴリが「security」と判定され、exit(2)で終了

**TC-3-2: ENOENT（ファイル未発見）でexit(0)（permissiveモード）**

- Given: WORKFLOW_FAIL_MODE=permissive、読み込み対象ファイルが存在しない
- When: フックを実行
- Then: エラーカテゴリが「temporary」と判定され、exit(0)で終了

**TC-3-3: EACCES（権限エラー）でexit(0)（permissiveモード）**

- Given: WORKFLOW_FAIL_MODE=permissive、ファイル読み込み時に権限エラー
- When: フックを実行
- Then: エラーカテゴリが「temporary」と判定され、exit(0)で終了

**TC-3-4: strictモードでは一時的エラーもexit(2)**

- Given: WORKFLOW_FAIL_MODE=strict、ファイル未発見エラー
- When: フックを実行
- Then: exit(2)で終了する（拒否）

**TC-3-5: フェーズ違反はモードに関係なくexit(2)**

- Given: WORKFLOW_FAIL_MODE=permissive、researchフェーズでソースコード編集
- When: フックを実行
- Then: エラーカテゴリが「security」と判定され、exit(2)で終了

**TC-3-6: 未知のerrnoコードはsecurityとして扱う**

- Given: WORKFLOW_FAIL_MODE=permissive、未知のerrnoコード
- When: エラー分類を実行
- Then: securityカテゴリとして扱い、exit(2)で終了

テストファイル: `tests/hooks/req3-fail-closed-relaxation.test.ts`

### Phase 2: P1修正（4件）

#### REQ-4: bash-whitelistバイパス対策

対象ファイル: hooks/bash-whitelist.js

**TC-4-1: 変数展開パターン$()の検出**

- Given: コマンド`ls $(whoami)`
- When: bash-whitelistで検証
- Then: バイパス検出され、exit(2)で拒否

**TC-4-2: プロセス置換パターン<()の検出**

- Given: コマンド`diff <(ls dir1) <(ls dir2)`
- When: bash-whitelistで検証
- Then: バイパス検出され、exit(2)で拒否

**TC-4-3: バッククォートパターンの検出**

- Given: コマンド`` ls `pwd` ``
- When: bash-whitelistで検証
- Then: バイパス検出され、exit(2)で拒否

**TC-4-4: 正常なコマンドは許可**

- Given: コマンド`ls -la /path/to/dir`
- When: bash-whitelistで検証
- Then: バイパス検出されず、exit(0)で許可

テストファイル: `src/validation/__tests__/bash-bypass-enhanced.test.ts`

#### REQ-5: バリデーションタイムアウト

対象ファイル: mcp-server/src/validation/artifact-validator.ts

**TC-5-1: 通常バリデーションは10秒以内に完了**

- Given: 1000行の通常サイズMarkdownファイル
- When: validateArtifactQuality()を呼び出す
- Then: 10秒以内に完了し、タイムアウトエラーが発生しない

**TC-5-2: 巨大ファイルで10秒タイムアウト**

- Given: 処理に10秒以上かかる巨大ファイル
- When: validateArtifactQuality()を呼び出す
- Then: 10秒経過時点でタイムアウトエラー

**TC-5-3: タイムアウト境界値（9.9秒 vs 10.1秒）**

- Given: 処理時間が境界付近のファイル
- When: validateArtifactQuality()を呼び出す
- Then: 9.9秒は成功、10.1秒はタイムアウト

テストファイル: `src/validation/__tests__/validation-timeout.test.ts`

#### REQ-6: HMAC鍵30日自動ローテーション

対象ファイル: mcp-server/src/state/hmac.ts

**TC-6-1: 初回起動時に鍵生成**

- Given: hmac-keys.jsonが存在しない
- When: HMACマネージャーを初期化
- Then: 新鍵が生成され、createdAtとexpiresAtが設定される

**TC-6-2: 有効期限内の鍵はローテーション不要**

- Given: current鍵のexpiresAtが15日後
- When: 鍵の有効期限チェック
- Then: ローテーション不要と判定

**TC-6-3: 有効期限超過でローテーション実行**

- Given: current鍵のexpiresAtが昨日
- When: 鍵の有効期限チェック
- Then: ローテーションが実行され、旧currentがpreviousに移動し、新currentが生成される

**TC-6-4: グレース期間中のローテーション抑制（24時間未満）**

- Given: current鍵のexpiresAtが昨日、lastRotationが12時間前
- When: 鍵の有効期限チェック
- Then: ローテーション抑制される

**TC-6-5: 24時間経過後のローテーション実行**

- Given: current鍵のexpiresAtが昨日、lastRotationが25時間前
- When: 鍵の有効期限チェック
- Then: ローテーションが実行される

**TC-6-6: ローテーション時のworkflow-state再署名**

- Given: 3個のアクティブタスクが存在
- When: 鍵ローテーションを実行
- Then: 3個全てのworkflow-state.jsonが新鍵で再署名される

テストファイル: `src/state/__tests__/hmac-rotation.test.ts`

#### REQ-7: workflow_update_intentツール新設

対象ファイル: mcp-server/src/tools/update-intent.ts（新規）

**TC-7-1: userIntent更新成功**

- Given: タスクが存在しuserIntentが「旧意図」
- When: workflow_update_intent({taskId, newIntent: '新意図'})
- Then: userIntentが「新意図」に更新され、stateIntegrityが再計算される

**TC-7-2: 存在しないタスクでエラー**

- Given: 存在しないタスクID
- When: workflow_update_intent({taskId: 'invalid', newIntent: '新意図'})
- Then: エラーメッセージ「タスクが見つかりません」

**TC-7-3: sessionToken検証**

- Given: 無効なsessionToken
- When: workflow_update_intent({taskId, newIntent: '新意図', sessionToken: 'invalid'})
- Then: セッショントークン検証エラー

テストファイル: `src/tools/__tests__/update-intent.test.ts`

### Phase 3: P2修正（4件）

#### REQ-8: ASTキャッシュLRU化

対象ファイル: mcp-server/src/validation/ast-analyzer.ts

**TC-8-1: キャッシュヒット時のAST再利用**

- Given: 同じファイルパスで2回ASTパース
- When: parseAST(filePath)を2回呼び出す
- Then: パース実行回数が1回のみ

**TC-8-2: LRU上限100エントリでの追い出し**

- Given: 101個の異なるファイルをパース
- When: キャッシュに格納
- Then: 最初のエントリが追い出され、キャッシュサイズが100を超えない

**TC-8-3: ファイル更新時のキャッシュ無効化**

- Given: ファイルAがキャッシュに存在
- When: ファイルAが更新される（mtime変更）
- Then: キャッシュが無効化され、次回パース時に再度パース実行

テストファイル: `src/validation/__tests__/ast-cache-lru.test.ts`

#### REQ-9: 並列フェーズ依存関係のフック側強制

対象ファイル: mcp-server/src/phases/definitions.ts

**TC-9-1: 依存先未完了時のサブフェーズ完了をブロック**

- Given: parallel_analysisフェーズ、planningが未完了
- When: workflow_complete_sub('threat_modeling')（planningに依存）
- Then: エラー「依存先が完了していません」

**TC-9-2: 依存先完了後のサブフェーズ完了を許可**

- Given: parallel_analysisフェーズ、planningが完了
- When: workflow_complete_sub('threat_modeling')
- Then: threat_modelingが完了状態になる

**TC-9-3: 循環依存の検出**

- Given: サブフェーズAがBに依存、BがAに依存
- When: 依存関係を検証
- Then: エラー「循環依存を検出」

テストファイル: `src/phases/__tests__/sub-phase-dependencies.test.ts`

#### REQ-10: スコープ検証改善

対象ファイル: mcp-server/src/validation/scope-validator.ts

**TC-10-1: docs/spec/配下の編集を許可（スコープ内）**

- Given: スコープにdocs/spec/features/example.mdが設定
- When: スコープ検証を実行
- Then: docs/spec/配下が自動除外されず、編集が許可される

**TC-10-2: スコープ外のdocs/spec/編集は拒否**

- Given: スコープにsrc/backend/のみが設定
- When: docs/spec/features/other.mdを編集しようとする
- Then: スコープ外と判定され、編集が拒否される

**TC-10-3: docs/workflows/配下は引き続きスコープ対象**

- Given: スコープにdocs/workflows/task/spec.mdが設定
- When: スコープ検証を実行
- Then: スコープ検証対象に含まれ、編集が許可される

テストファイル: `src/validation/__tests__/scope-docs-spec.test.ts`

#### REQ-11: TOCTOU修正（sessionToken検証強化）

対象ファイル: mcp-server/src/tools/next.ts

**TC-11-1: 正常なsessionTokenで操作許可**

- Given: 有効なsessionTokenを持つリクエスト
- When: workflow_next({taskId, sessionToken})
- Then: sessionToken検証成功、フェーズ遷移が実行される

**TC-11-2: 無効なsessionTokenで操作拒否**

- Given: 無効なsessionToken
- When: workflow_next({taskId, sessionToken: 'invalid'})
- Then: sessionToken検証失敗、フェーズ遷移されない

**TC-11-3: TOCTOU攻撃シナリオの防止**

- Given: sessionToken取得後にworkflow-stateが別プロセスで変更された
- When: sessionTokenでworkflow_nextを実行
- Then: workflow-state変更を検出してエラー

テストファイル: `src/tools/__tests__/session-token-toctou.test.ts`

### Phase 4: CLAUDE.md修正（2件）

#### REQ-12: CLAUDE.mdサマリー行数制限 50→200行

対象ファイル: mcp-server/src/validation/artifact-validator.ts

**TC-12-1: サマリーセクション150行で合格**

- Given: サマリーセクションが150行のMarkdownファイル
- When: validateArtifactQuality()を呼び出す
- Then: バリデーション成功、警告なし

**TC-12-2: サマリーセクション201行以上で警告**

- Given: サマリーセクションが250行のMarkdownファイル
- When: validateArtifactQuality()を呼び出す
- Then: 警告「サマリーセクションの行数が200行を超えています」

**TC-12-3: サマリーセクション50行以下は引き続き合格**

- Given: サマリーセクションが30行のMarkdownファイル
- When: validateArtifactQuality()を呼び出す
- Then: バリデーション成功、警告なし

テストファイル: `src/validation/__tests__/summary-line-limit.test.ts`

#### REQ-13: taskSize選択によるフェーズ数調整復活

対象ファイル: mcp-server/src/phases/definitions.ts, tools/start.ts

**TC-13-1: taskSize=smallで8フェーズ実行**

- Given: workflow_start({taskName, taskSize: 'small'})
- When: フェーズシーケンスを取得
- Then: フェーズ数が8

**TC-13-2: taskSize=mediumで14フェーズ実行**

- Given: workflow_start({taskName, taskSize: 'medium'})
- When: フェーズシーケンスを取得
- Then: フェーズ数が14

**TC-13-3: taskSize=largeで19フェーズ実行**

- Given: workflow_start({taskName, taskSize: 'large'})
- When: フェーズシーケンスを取得
- Then: フェーズ数が19

**TC-13-4: taskSize未指定時のデフォルト動作**

- Given: workflow_start({taskName})
- When: フェーズシーケンスを取得
- Then: デフォルトでlarge、フェーズ数が19

**TC-13-5: 無効なtaskSizeでエラー**

- Given: workflow_start({taskName, taskSize: 'invalid'})
- When: バリデーション実行
- Then: エラー「taskSizeはsmall, medium, largeのいずれかを指定してください」

テストファイル: `src/tools/__tests__/task-size-phases.test.ts`

## テストファイル構成

### 新規テストファイル一覧

| Phase | ファイルパス | 対象REQ | ケース数 |
|-------|------------|---------|---------|
| P0 | src/state/__tests__/task-index-schema.test.ts | REQ-1 | 5 |
| P0 | tests/hooks/req2-hook-performance.test.ts | REQ-2 | 4 |
| P0 | tests/hooks/req3-fail-closed-relaxation.test.ts | REQ-3 | 6 |
| P1 | src/validation/__tests__/bash-bypass-enhanced.test.ts | REQ-4 | 4 |
| P1 | src/validation/__tests__/validation-timeout.test.ts | REQ-5 | 3 |
| P1 | src/state/__tests__/hmac-rotation.test.ts | REQ-6 | 6 |
| P1 | src/tools/__tests__/update-intent.test.ts | REQ-7 | 3 |
| P2 | src/validation/__tests__/ast-cache-lru.test.ts | REQ-8 | 3 |
| P2 | src/phases/__tests__/sub-phase-dependencies.test.ts | REQ-9 | 3 |
| P2 | src/validation/__tests__/scope-docs-spec.test.ts | REQ-10 | 3 |
| P2 | src/tools/__tests__/session-token-toctou.test.ts | REQ-11 | 3 |
| P4 | src/validation/__tests__/summary-line-limit.test.ts | REQ-12 | 3 |
| P4 | src/tools/__tests__/task-size-phases.test.ts | REQ-13 | 5 |

合計: 13ファイル、51テストケース

## 受入基準

1. 既存772テスト全件成功
2. 新規51テスト全件成功
3. 修正対象ファイルのカバレッジ80%以上
4. 全テスト実行時間30秒以内
