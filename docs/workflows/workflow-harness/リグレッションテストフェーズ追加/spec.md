# リグレッションテストフェーズ追加 - 仕様書

## 1. 概要

### 1.1 目的

ワークフロープラグインにリグレッションテストフェーズを追加し、既存機能の品質を保証する仕組みを構築する。

### 1.2 スコープ

- `regression_test` フェーズの追加
- リグレッションテスト蓄積ディレクトリの定義
- 関連ドキュメントの更新

## 2. フェーズ定義

### 2.1 フェーズ順序（19フェーズ）

```typescript
export const PHASES_LARGE: PhaseName[] = [
  'research',              // 調査
  'requirements',          // 要件定義
  'parallel_analysis',     // 並列分析
  'parallel_design',       // 並列設計
  'design_review',         // 設計レビュー
  'test_design',           // テスト設計
  'test_impl',             // テスト実装
  'implementation',        // 実装
  'refactoring',           // リファクタリング
  'parallel_quality',      // 並列品質チェック
  'testing',               // テスト実行（新規テスト）
  'regression_test',       // リグレッションテスト（★新規追加）
  'parallel_verification', // 並列検証
  'docs_update',           // ドキュメント更新
  'commit',                // コミット
  'push',                  // プッシュ
  'ci_verification',       // CI検証
  'deploy',                // デプロイ
  'completed',             // 完了
];
```

### 2.2 regression_test フェーズの定義

```typescript
// PhaseName 型への追加
export type PhaseName =
  | ...
  | 'regression_test'    // リグレッションテストフェーズ（新規）
  | ...;

// フェーズ説明
PHASE_DESCRIPTIONS['regression_test'] =
  'リグレッションテストフェーズ - 既存機能の回帰テストを実行';

// 許可拡張子
PHASE_EXTENSIONS['regression_test'] = '.md .test.ts .test.tsx .spec.ts .spec.tsx';
```

## 3. ディレクトリ構成

### 3.1 バックエンド

```
src/backend/tests/regression/
├── README.md              # リグレッションテストの説明
├── conftest.py            # pytest共通設定
├── pytest.ini             # pytest設定（オプション）
└── {task-name}/           # タスクごとのディレクトリ
    ├── __init__.py
    ├── test_*.py          # テストファイル
    └── fixtures/          # テスト固有のフィクスチャ
```

### 3.2 フロントエンド

```
src/frontend/test/regression/
├── README.md              # リグレッションテストの説明
├── setup.ts               # テスト共通設定
└── {task-name}/           # タスクごとのディレクトリ
    ├── *.test.ts          # テストファイル
    ├── *.test.tsx         # コンポーネントテスト
    └── fixtures/          # テスト固有のフィクスチャ
```

### 3.3 命名規則

| 項目 | 規則 | 例 |
|------|------|-----|
| タスクディレクトリ | kebab-case | `user-authentication/` |
| テストファイル | test_*.py / *.test.ts | `test_login.py`, `login.test.ts` |
| フィクスチャ | fixtures/ | `fixtures/user.json` |

## 4. テスト実行

### 4.1 実行コマンド

#### バックエンド

```bash
# リグレッションテストのみ実行
cd src/backend && pytest tests/regression/ -v

# 特定タスクのテストのみ
cd src/backend && pytest tests/regression/{task-name}/ -v
```

#### フロントエンド

```bash
# リグレッションテストのみ実行
cd src/frontend && npm run test -- test/regression/

# 特定タスクのテストのみ
cd src/frontend && npm run test -- test/regression/{task-name}/
```

### 4.2 失敗時の挙動

- 1つでもテストが失敗した場合、`regression_test` フェーズから先に進めない
- エラーメッセージで失敗したテストを明示
- 修正後、再度テストを実行して全パスを確認

## 5. ファイル変更一覧

### 5.1 mcp-server/src/state/types.ts

```typescript
// 変更: PhaseName 型に regression_test を追加
export type PhaseName =
  | 'research'
  | 'requirements'
  | 'parallel_analysis'
  | 'parallel_design'
  | 'design_review'
  | 'test_design'
  | 'test_impl'
  | 'implementation'
  | 'refactoring'
  | 'parallel_quality'
  | 'testing'
  | 'regression_test'        // ★追加
  | 'parallel_verification'
  | 'docs_update'
  | 'commit'
  | 'push'
  | 'ci_verification'
  | 'deploy'
  | 'completed'
  | 'idle';
```

### 5.2 mcp-server/src/phases/definitions.ts

```typescript
// 1. PHASES_LARGE 配列に追加
export const PHASES_LARGE: PhaseName[] = [
  ...
  'testing',
  'regression_test',        // ★追加
  'parallel_verification',
  ...
];

// 2. PHASE_DESCRIPTIONS に追加
export const PHASE_DESCRIPTIONS: Record<PhaseName, string> = {
  ...
  regression_test: 'リグレッションテストフェーズ - 既存機能の回帰テストを実行',
  ...
};

// 3. PHASE_EXTENSIONS に追加
export const PHASE_EXTENSIONS: Record<PhaseName, string> = {
  ...
  regression_test: '.md .test.ts .test.tsx .spec.ts .spec.tsx',
  ...
};
```

### 5.3 workflow-phases/regression_test.md（新規作成）

フェーズの説明ドキュメントを作成。

### 5.4 CLAUDE.md の更新

- フェーズ順序の説明を更新（18 → 19フェーズ）
- リグレッションテストディレクトリのルールを追加
- AIへの厳命にリグレッションテストルールを追加

## 6. AIへの厳命（追加ルール）

```
13. **リグレッションテストをスキップしてはいけない**
    - testing フェーズの後は必ず regression_test フェーズを実行
    - リグレッションテストが失敗したら修正を行う
    - 「今回のタスクとは関係ない」という理由でスキップ禁止

14. **リグレッションテストは適切なディレクトリに配置**
    - バックエンド: `src/backend/tests/regression/`
    - フロントエンド: `src/frontend/test/regression/`
    - タスクごとにサブディレクトリを作成
```

## 7. 成果物チェックリスト

### 7.1 コード変更

- [ ] `mcp-server/src/state/types.ts` - PhaseName 型更新
- [ ] `mcp-server/src/phases/definitions.ts` - フェーズ定義更新
- [ ] `mcp-server/src/phases/__tests__/definitions.test.ts` - テスト更新

### 7.2 ドキュメント

- [ ] `workflow-phases/regression_test.md` - 新規作成
- [ ] `workflow-plugin/CLAUDE.md` - ルール追加
- [ ] ルート `CLAUDE.md` - ルール追加

### 7.3 ディレクトリ

- [ ] `src/backend/tests/regression/README.md` - 新規作成
- [ ] `src/frontend/test/regression/README.md` - 新規作成
