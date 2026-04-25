# リグレッションテストフェーズ追加 - 調査結果

## 調査日
2026-01-19

## 問題の背景

ユーザーからの報告:
1. **テスト実行時の判断ミス**: 既存テストが失敗しても「今回作ったテストじゃないからエラー出てても問題ない」と処理されてしまう
2. **リグレッションテストの蓄積場所がない**: 各タスクで作成したテストが散逸している

## 現状のワークフロー構造

### フェーズ順序（18フェーズ）

```
research → requirements → parallel_analysis → parallel_design → design_review
→ test_design → test_impl → implementation → refactoring
→ parallel_quality → testing → parallel_verification
→ docs_update → commit → push → ci_verification → deploy → completed
```

### テスト関連フェーズの現状

| フェーズ | 目的 | 問題点 |
|---------|------|--------|
| test_design | テスト設計 | - |
| test_impl | 新規テスト実装（TDD Red） | - |
| testing | 新規テスト実行 | 今回作成したテストのみ対象 |
| parallel_verification | 各種検証 | リグレッションテストがない |

### 並列グループ

| グループ | サブフェーズ |
|---------|-------------|
| parallel_analysis | threat_modeling, planning |
| parallel_design | state_machine, flowchart, ui_design |
| parallel_quality | build_check, code_review |
| parallel_verification | manual_test, security_scan, performance_test, e2e_test |

### 主要ファイルの場所

| ファイル | パス | 役割 |
|---------|------|------|
| フェーズ定義 | `mcp-server/src/phases/definitions.ts` | フェーズ順序、並列グループ、許可拡張子 |
| 型定義 | `mcp-server/src/state/types.ts` | PhaseName, SubPhaseName, TaskState等 |
| フェーズドキュメント | `workflow-phases/*.md` | 各フェーズの説明・手順 |
| CLAUDE.md | `CLAUDE.md` | AI向けルール・禁止事項 |

## テストディレクトリの現行ルール

CLAUDE.md より:

```
| テスト種別 | バックエンド | フロントエンド |
|------------|--------------|----------------|
| ユニットテスト | src/backend/tests/unit/ | src/frontend/**/*.test.tsx |
| 統合テスト | src/backend/tests/integration/ | src/frontend/test/integration/ |
| E2Eテスト | e2e/ | e2e/ |
```

**禁止事項**: ルートディレクトリに `tests/` を作成しない

## リグレッションテストの要件分析

### 必要な機能

1. **リグレッションテスト実行フェーズ**
   - 既存の全リグレッションテストを実行
   - 失敗は即ブロック（今回のタスクと無関係でも）
   - testing フェーズとは別に実行

2. **リグレッションテスト蓄積ディレクトリ**
   - 各タスクで作成したテストを蓄積
   - バックエンド/フロントエンド別に管理
   - 自動的に蓄積される仕組み

### 設計オプション

#### オプション A: 独立フェーズとして追加

```
testing → regression_test（新規）→ parallel_verification
```

- メリット: 明確な責任分離
- デメリット: フェーズ数増加（18 → 19）

#### オプション B: parallel_verification のサブフェーズとして追加

```
parallel_verification: manual_test, security_scan, performance_test, e2e_test, regression_test
```

- メリット: フェーズ数維持、並列実行可能
- デメリット: 他の検証と並列でよいか要検討

#### オプション C: testing フェーズを分割

```
testing_new → testing_regression
```

- メリット: テスト実行の流れが明確
- デメリット: フェーズ数増加、名前の冗長性

### ディレクトリ構成オプション

#### オプション 1: 既存構造に追加

```
src/backend/tests/regression/
src/frontend/test/regression/
```

- CLAUDE.md のルールに準拠
- 既存のテスト配置パターンを踏襲

#### オプション 2: プロジェクトレベルで管理

```
tests/regression/
├── backend/
└── frontend/
```

- CLAUDE.md のルールに違反（ルートに tests/ 禁止）
- 却下

## 推奨案

### フェーズ構成

**オプション A を推奨**: 独立フェーズとして追加

```
testing → regression_test → parallel_verification
```

理由:
- リグレッションテストの失敗は重大（ブロック必須）
- 並列実行ではなく順次実行が適切
- 責任が明確

### ディレクトリ構成

**オプション 1 を採用**: 既存構造に追加

```
src/backend/tests/regression/
├── README.md           # リグレッションテストの説明
├── {task-name}/        # タスクごとのテスト
│   └── *.test.py
└── __init__.py

src/frontend/test/regression/
├── README.md
├── {task-name}/
│   └── *.test.tsx
└── index.ts
```

### 自動蓄積の仕組み

1. test_impl フェーズでテストを作成
2. testing フェーズで新規テストを実行
3. regression_test フェーズで全リグレッションテストを実行
4. commit/push 前にテストをリグレッションディレクトリにコピー（オプション）

または:

1. リグレッションテストを最初から `tests/regression/` に作成
2. 通常のテストと両方実行される設定

## 次のステップ

1. requirements フェーズで要件を詳細化
2. フェーズ定義の修正箇所を特定
3. CLAUDE.md への追記内容を決定
