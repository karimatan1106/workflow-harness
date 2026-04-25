# 前回ワークフロー実行時の問題根本原因修正 要件定義

## サマリー

前回の「ワークフロー10M対応全問題根本原因修正」タスク実行中に発生した5つの問題について、根本原因に基づく修正要件を定義する。

### 問題概要と修正アプローチ
- **FIX-1 (task-index.json手動sync)**: MCPサーバーのモジュールキャッシュ問題。サーバー再起動によりsaveTaskIndex()の新実装を有効化し、discoverTasks()がワークフロー状態を正しく反映するか検証する。
- **FIX-2 (スコープバリデーター事前変更ブロック)**: タスク開始時にpreExistingChangesを記録し、スコープバリデーションから除外するロジックを追加する。
- **FIX-3 (ループ検出フックの間欠的エラー)**: stdinイベントハンドリングのレース条件を解消する。
- **FIX-4 (loop-detector編集閾値不足)**: implementationフェーズの編集閾値を10から20に引き上げる。
- **FIX-5 (bash-whitelistにgit checkout/restore不足)**: gitカテゴリにgit checkout/restoreコマンドを追加する。

### 優先度順位
1. **High**: FIX-1（タスクインデックス同期）、FIX-2（スコープバリデーター）
2. **Medium**: FIX-4（ループ検出閾値）、FIX-5（bash whitelist）
3. **Low**: FIX-3（stdinエラーハンドリング改善）

## 要件一覧

### FIX-1: task-index.json手動sync問題の解決

#### 背景
MCPサーバーのモジュールキャッシュにより、新実装のsaveTaskIndex()が実行されず、task-index.jsonが更新されない。加えて、saveTaskIndex()がdiscoverTasks()を使用しているため、ディレクトリスキャン結果とworkflow-state.jsonの不整合が生じる可能性がある。

#### 修正内容

**1. MCPサーバー再起動によるモジュールキャッシュクリア**
- タスク開始前にMCPサーバープロセスを停止・再起動する
- dist/state/manager.jsが最新のコンパイル結果であることを確認する

**2. saveTaskIndex()の動作検証**
- workflow_next()実行時にsaveTaskIndex()が呼ばれることを確認
- task-index.jsonに正しいフェーズ情報が書き込まれることを確認
- discoverTasks()が返すフェーズ情報とworkflow-state.jsonが一致することを確認

**3. フォールバックロジックの確認**
- enforce-workflow.jsがtask-index.json読み込み失敗時にworkflow-state.jsonにフォールバックすることを確認

#### 受け入れ基準
- [ ] MCPサーバー再起動後、workflow_next()実行でtask-index.jsonが自動更新される
- [ ] task-index.jsonのフェーズ情報とworkflow-state.jsonが一致する
- [ ] hooksがtask-index.jsonから正しいフェーズ情報を取得できる
- [ ] discoverTasks()の結果がワークフロー状態ファイルの内容と一致する

#### 影響範囲
- `workflow-plugin/mcp-server/src/state/manager.ts` (L468-491, L806-814)
- `workflow-plugin/discover-tasks.js` (L48-85)
- `workflow-plugin/hooks/enforce-workflow.js`

#### 優先度
**High** - タスク進行中のフェーズ情報同期に直接影響

---

### FIX-2: スコープバリデーターが事前変更をブロックする問題の解決

#### 背景
scope-validator.tsのvalidateScopePostExecution()が`git diff --name-only HEAD`で全変更ファイルを取得するが、タスク開始前から存在する変更を除外できず、スコープ外編集として誤検出される。

#### 修正内容

**1. workflow_start時にpreExistingChanges記録**
- start.tsのworkflow_start処理で`git diff --name-only HEAD`を実行
- 結果をworkflow-state.jsonの`scope.preExistingChanges`配列に保存

**2. validateScopePostExecution()の除外ロジック追加**
- git diff結果からpreExistingChangesに含まれるファイルを除外
- EXCLUDE_PATTERNSと組み合わせてフィルタリング

**3. スキーマ更新**
- WorkflowStateのscopeフィールドにpreExistingChanges: string[]を追加

#### 受け入れ基準
- [ ] workflow_start実行時にpreExistingChangesが記録される
- [ ] タスク開始前から変更されていたファイルがスコープバリデーションでエラーにならない
- [ ] タスク開始後の新規変更はスコープチェック対象として正しく検出される
- [ ] EXCLUDE_PATTERNSとpreExistingChangesが併用されて正しくフィルタリングされる

#### 影響範囲
- `workflow-plugin/mcp-server/src/tools/start.ts` - preExistingChanges記録ロジック追加
- `workflow-plugin/mcp-server/src/validation/scope-validator.ts` (L734-818) - 除外ロジック追加
- `workflow-plugin/mcp-server/src/state/schema.ts` - スキーマ更新

#### 優先度
**High** - タスク開始前の変更があると実行がブロックされる致命的な問題

---

### FIX-3: ループ検出フックの間欠的エラーの解決

#### 背景
loop-detector.jsのstdinイベントハンドリングでerrorとendイベントのレース条件が発生し、稀に"No stderr output"エラーが発生する。

#### 修正内容

**1. stdinイベントハンドリングの改善**
- errorイベントを`once()`で登録し、1回のみ実行されるようにする
- endイベント処理完了後、errorリスナーを明示的に削除する
- タイムアウト処理とイベントハンドラの競合を防ぐ

**2. エラーログの改善**
- errorイベント発火時のコンテキスト情報を詳細に記録
- レース条件が発生した場合のデバッグ情報を出力

#### 受け入れ基準
- [ ] stdinのerror/endイベントが競合せず、正常に処理される
- [ ] 100回連続実行しても間欠的エラーが発生しない
- [ ] errorイベント発火時に適切なログが出力される

#### 影響範囲
- `workflow-plugin/hooks/loop-detector.js` (L420-450) - stdinイベントハンドリング

#### 優先度
**Low** - 発生頻度が低く、再実行で回避可能なため優先度は低い

---

### FIX-4: loop-detectorの編集閾値不足の解決

#### 背景
loop-detector.jsのPHASE_EDIT_LIMITS(implementation=10)が大規模実装に対して不十分で、subagentが1ファイルを10回以上編集するとブロックされる。

#### 修正内容

**1. 編集閾値の引き上げ**
- PHASE_EDIT_LIMITSのimplementationを10から20に変更
- refactoringも10から20に変更
- 大規模な変更に対応できる余裕を持たせる

**2. タイムウィンドウの検討**
- 現在の5分ウィンドウが適切か検証
- 必要に応じて10分に拡大する（オプション）

#### 受け入れ基準
- [ ] 大規模実装(20ファイル以上の変更)でブロックされない
- [ ] 真の無限ループ(30回以上の編集)は引き続き検出される
- [ ] 閾値変更後も既存テスト772個が全てパスする

#### 影響範囲
- `workflow-plugin/hooks/loop-detector.js` (L81-89) - PHASE_EDIT_LIMITS定義

#### 優先度
**Medium** - 大規模タスクの実行をブロックするが、回避策（分割実装）が存在する

---

### FIX-5: bash-whitelistにgit checkout/restoreがない問題の解決

#### 背景
BASH_WHITELISTのgitカテゴリにgit checkout/restoreコマンドが定義されておらず、pre-existing変更を元に戻す手段がない。

#### 修正内容

**1. gitカテゴリへのコマンド追加**
- `git checkout -- <file>` を追加（ファイル単位の変更破棄）
- `git restore <file>` を追加（ファイル単位のリストア）
- `git checkout .` は危険なため追加しない

**2. ブランチ操作の除外**
- `git checkout -b` や `git checkout <branch>` はブランチ切り替えのため除外
- ファイルパスパターンのバリデーションを追加

#### 受け入れ基準
- [ ] `git checkout -- <file>`が実行可能になる
- [ ] `git restore <file>`が実行可能になる
- [ ] `git checkout <branch>`等のブランチ操作は引き続きブロックされる
- [ ] CLAUDE.mdのGit Safety Protocolに違反しない

#### 影響範囲
- `workflow-plugin/hooks/bash-whitelist.js` (L35-90) - BASH_WHITELIST.git配列

#### 優先度
**Medium** - 作業効率に影響するが、代替手段（Read + Write）が存在する

---

## 受け入れ基準（全体）

### 機能要件
- [ ] 全5つの問題が修正される
- [ ] 既存テスト772個が全てパスする
- [ ] 新規テストが追加され、再発防止が担保される

### 非機能要件
- [ ] MCPサーバー再起動手順がドキュメント化される
- [ ] 各修正の動作確認手順が明確である
- [ ] ロールバック手順が用意される

### セキュリティ要件
- [ ] git checkout/restore追加がCLAUDE.mdのGit Safety Protocolに準拠する
- [ ] スコープバリデーション除外ロジックが悪用不可能である

## 優先度とリスク評価

### High優先度（即座に修正）
1. **FIX-1 (task-index.json sync)**: タスク進行のコア機能に影響
2. **FIX-2 (スコープバリデーター)**: タスク実行をブロックする致命的バグ

### Medium優先度（今回タスクで修正）
3. **FIX-4 (loop-detector閾値)**: 大規模タスクの実行性に影響
4. **FIX-5 (bash whitelist)**: 作業効率に影響

### Low優先度（時間があれば修正）
5. **FIX-3 (stdinエラー)**: 発生頻度低、回避策あり

## 影響範囲の全体像

### 修正対象ファイル
- `workflow-plugin/mcp-server/src/tools/start.ts` (FIX-2)
- `workflow-plugin/mcp-server/src/validation/scope-validator.ts` (FIX-2)
- `workflow-plugin/mcp-server/src/state/schema.ts` (FIX-2)
- `workflow-plugin/hooks/loop-detector.js` (FIX-3, FIX-4)
- `workflow-plugin/hooks/bash-whitelist.js` (FIX-5)

### 検証対象ファイル
- `workflow-plugin/mcp-server/src/state/manager.ts` (FIX-1)
- `workflow-plugin/discover-tasks.js` (FIX-1)
- `workflow-plugin/hooks/enforce-workflow.js` (FIX-1)

### テスト追加予定
- FIX-2: preExistingChanges記録・除外ロジックのユニットテスト
- FIX-4: 大規模編集シナリオの統合テスト
- FIX-5: git checkout/restoreコマンドのホワイトリストテスト

## 制約条件

### 技術的制約
- Node.jsのモジュールキャッシュ特性により、FIX-1はコード修正ではなくMCPサーバー再起動で対応
- HMAC整合性保護により、workflow-state.jsonの手動編集は不可（MCPサーバー経由でのみ更新可能）

### 運用制約
- タスク実行中のMCPサーバー再起動はできない（タスク開始前のみ）
- git checkout/restore追加は既存のGit Safety Protocolに準拠する必要がある

### テスト制約
- 既存テスト772個の互換性を維持する
- リグレッションテストのベースラインは前回タスクの772テスト成功を基準とする
