# docs_update テンプレート情報追加 - リサーチ

## 調査内容

本タスクは、docs_update サブエージェントが実装変更の詳細を認識できず、ドキュメントを旧形式に戻してしまう問題を解決するための調査である。

### 1. definitions.ts の docs_update テンプレート現状

#### テンプレート構造
- ファイル位置: `workflow-plugin/mcp-server/src/phases/definitions.ts` 行 946-953
- テンプレートは短く、主要な機能は以下の通り:
  - `${userIntent}` プレースホルダー（ユーザー意図）
  - `${docsDir}` プレースホルダー（出力先ディレクトリ）
  - ワークフロー成果物（docs/workflows/）から永続ドキュメント（docs/spec/）への移動指示

#### 欠落している情報
docs_update テンプレートに含まれていない情報:

1. **タスク名**: `${taskName}` プレースホルダーが利用可能だが、テンプレートに含まれていない
   - 実装対象モジュール名が不明のため、適切なドキュメント配置判断ができない

2. **スコープ（影響範囲）**: `scope` 情報が全く含まれていない
   - 変更ファイル一覧（`scope.affectedFiles`）がないため、どのファイルが変更されたかが不明
   - 変更ディレクトリ（`scope.affectedDirs`）がないため、実装対象の領域が特定できない
   - `scope.moduleName` も含まれていない

3. **変更内容（実装者の視点）**: 実装フェーズで何が作成・変更されたかの情報がない
   - API エンドポイント追加か、機能追加か、バグ修正かが分からない
   - 新規ファイル作成 vs 既存ファイル修正の区別がない

4. **実装済みコンポーネント**: 実装対象となったコンポーネント・モジュール名がない

### 2. resolvePlaceholders 関数の呼び出し元と置換可能な変数

#### resolvePlaceholders 関数実装
- ファイル位置: `definitions.ts` 行 998-1003
- 実装内容: テンプレート文字列内の `${key}` パターンを Variables マップの値で置換する単純な置換関数
- 使用可能な可変パターン: 任意の `${変数名}` という形式

#### next.ts での subagentTemplate 置換処理
- ファイル位置: `workflow-plugin/mcp-server/src/tools/next.ts` 行 659-664
- 現在置換されている変数:
  1. `${taskName}` → `taskState.taskName`
  2. `${taskId}` → `taskState.taskId`

#### taskState から取得可能な情報
- `taskState.taskName`: タスク名（例: "ユーザー認証機能"）
- `taskState.taskId`: タスクID（例: "task_abc123"）
- `taskState.userIntent`: ユーザーの意図（プロンプトに記載されるが、サブフェーズでは削除される）
- `taskState.scope`: スコープ情報
  - `scope.affectedFiles`: 影響を受けるファイル一覧
  - `scope.affectedDirs`: 影響を受けるディレクトリ一覧
  - `scope.moduleName`: 推定されたモジュール名（auto-inferred）
  - `scope.preExistingChanges`: 既存変更リスト

### 3. next.ts での phaseGuide 構築プロセス

#### phaseGuide の構築フロー
- 行 657: `resolvePhaseGuide(nextPhase, taskState.docsDir, taskState.userIntent, taskState.scope?.moduleName)` を呼び出し
  - 第3引数: `userIntent` を渡している
  - 第4引数: `scope?.moduleName` を渡している

- 行 660-664: subagentTemplate の置換処理
  - 現在: `taskName`, `taskId` のみ置換
  - `userIntent` は置換されていない

#### 問題点の根本原因
1. **docs_update テンプレートにプレースホルダーがない**
   - `${taskName}` は定義されているが、テンプレートに含まれていない
   - `${userIntent}` のプレースホルダーは無い
   - `${scope}` 情報を含むプレースホルダーが無い

2. **resolvePhaseGuide で削除される情報**
   - `userIntent` は渡されるが、テンプレートに組み込まれない
   - 結果、subagentが「何の目的でこのタスクが実行されたか」を認識できない

3. **スコープ情報の非表示**
   - `taskState.scope` は存在するが、テンプレートに含まれていない
   - subagent が影響範囲を認識できず、実装変更の詳細が不明

## 課題分析

### 現象
docs_update subagent が実装内容を認識できず、以下の問題が発生:
- 新規 API エンドポイント追加を見落とし、`docs/spec/api/` に仕様書が追加されない
- 新規 UI コンポーネント実装を見落とし、`docs/spec/components/` に設計書が追加されない
- 実装変更対象モジュールが不明なため、正しい配置先が判定できない

### 根本原因
1. docs_update テンプレートが最小限の情報のみを含む
2. `${taskName}`, `${userIntent}`, `${scope}` などの実装変更コンテキストが欠落
3. subagent が「このタスクで何が実装されたのか」を理解する材料がない

## 解決策の方針

### 必須追加情報
1. **`${taskName}`**: タスク名を追加
   - 実装対象モジュール・機能名を特定するため

2. **`${userIntent}`**: ユーザーの意図を追加
   - 「何を実装したのか」の背景を subagent に提供するため

3. **`${scope}`**: スコープ情報を構造化して追加
   - 実装対象ファイル・ディレクトリの一覧
   - 新規追加 vs 既存変更の判別
   - モジュール名（自動推定）

4. **新しい情報**: 実装変更内容のサマリー
   - API 追加、UI コンポーネント追加など、変更内容の要約
   - test_impl, implementation フェーズの成果物から推定可能

### 実装上の検討事項
1. `next.ts` の subagentTemplate 置換ロジックをシンプルに保つ
2. スコープ情報（配列）を文字列化して埋め込む
3. テンプレートサイズが大きくなりすぎないよう配慮

## 対応対象ファイル

1. **definitions.ts** (PHASE_GUIDES['docs_update'].subagentTemplate)
   - テンプレート文字列に以下のプレースホルダーを追加:
     - `${taskName}`: タスク名
     - `${userIntent}`: ユーザー意図
     - `${affectedFiles}`: 影響を受けたファイル一覧
     - `${affectedDirs}`: 影響を受けたディレクトリ一覧
     - `${moduleName}`: 推定モジュール名（自動推定）

2. **next.ts** (phaseGuide.subagentTemplate の置換ロジック)
   - `userIntent` の置換を追加
   - スコープ情報を構造化して置換
   - `taskName` はテンプレートに含まれているか確認

## ★ワークフロー制御ツール禁止★

workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset は呼び出し禁止。
