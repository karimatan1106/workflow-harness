# ワークフロー大規模対応根本改修 - research.md

## 調査対象と目的

ワークフロープラグイン（19フェーズのAI駆動開発ワークフロー制御システム）の致命的欠陥と重大な欠陥を特定し、大規模コードベース対応の可能性を評価する。

### 調査範囲

- `workflow-plugin/hooks/` - 10個のGitフック実装
- `workflow-plugin/mcp-server/src/tools/` - 15個のMCP ツール実装
- `CLAUDE.md` - ワークフロー強制ルール定義（74KB）

---

## 1. 致命的欠陥（P0）- 即座に影響が発生

### 欠陥1: スコープ制御が任意・未強制（スコープバックドア）

**現在の実装:**
- `workflow_set_scope` はresearchフェーズでのみ呼び出し可能
- スコープ設定は完全に**任意**（ユーザーが忘れても先に進める）
- スコープ検証は `implementation/refactoring` フェーズのみ有効
- 他の全フェーズでは無制限編集が可能

**大規模への影響:**
- 数千ファイルのコードベースで、AIがスコープ定義を忘れた場合
- 関係ないディレクトリのファイルを編集可能
- 複数タスク並行実行時に、タスク間の編集範囲が混在する可能性

**コード位置:**
- `/workflow-plugin/mcp-server/src/tools/set-scope.ts` - 設定のみ
- `/workflow-plugin/hooks/phase-edit-guard.js` (L1591-1605) - 検証はimplementation/refactoringのみ

**具体的なシナリオ（大規模コードベース）:**
```
task-A: src/backend/auth/ を修正（スコープ定義あり）
task-B: src/frontend/ui/ を修正（スコープ未定義）
         → task-B のAIが気づかず src/backend/auth/ も編集
         → 複数タスクのファイルが混在
```

---

### 欠陥2: テスト結果の検証が自己申告制度（テストスキップ可能）

**現在の実装:**
- `workflow_record_test_result(taskId, exitCode, summary)` で任意にテスト記録可能
- **実テスト実行の証拠を全く要求しない**
- AIが `exitCode=0` を記録するだけで「テスト成功」扱い
- testingフェーズ終了後、regression_testフェーズに進む

**コード位置:**
- `/workflow-plugin/mcp-server/src/tools/record-test-result.ts` (L44-77)
- フェーズチェックのみで、実テスト実行ファイルの有無を確認しない

**大規模への影響:**
- 数百のテストケースがある大規模プロジェクトで
- AIが実テストを走らずに `exitCode=0` を記録し続ける
- バグが本番環境に流出

**具体例:**
```typescript
// AIが「テスト成功」と嘘をつける
workflow_record_test_result('task-123', 0, '全テスト成功')
// 実際にはテストを実行していない

// その後フェーズ遷移が許可される
workflow_next()  // → regression_test へ進む
```

---

### 欠陥3: 全フック「Fail Open」設計（ガード無効化）

**現在の実装:**
- 10個のGitフック全てが、エラー時に `process.exit(0)` で**許可**する
- パス解析エラー、JSON読み込みエラーなど一切のエラーで許可
- 大規模コードベースではエラー確率が高まる

**フック一覧:**
1. `phase-edit-guard.js` (L1630) - エラー時に許可
2. `check-workflow-artifact.js` (L855-857) - エラー時に許可
3. `enforce-workflow.js` (L278-281) - エラー時に許可
4. `loop-detector.js` (L399-401) - エラー時に許可
5. `spec-first-guard.js` - 同様の実装
6. その他6個のフック - 同様の実装

**大規模への影響:**
- ファイルパス5000個以上のコードベース
- パス正規化エラー確率が上昇
- 複数フックが同時にエラーを吐き、全て許可される
- ワークフロー制御が完全に無効化される可能性

---

## 2. 重大な欠陥（P1）- システム破壊のリスク

### 欠陥4: 環境変数バックドア（10個のスキップフラグ）

**現在の実装:**
- 10個の環境変数でガード機構をスキップ可能
- `SKIP_PHASE_GUARD=true` - フェーズ別編集制限を無視
- `SKIP_LOOP_DETECTION=true` - 無限ループ検出を無視
- `SKIP_SPEC_GUARD=true` - 仕様ファースト確認を無視
- その他7個

**コード位置:**
- `/workflow-plugin/hooks/phase-edit-guard.js` (L1423-1427)
- `/workflow-plugin/hooks/loop-detector.js` (L378-380)
- `/workflow-plugin/mcp-server/src/tools/*.ts` 各所

**大規模への影響:**
- AIが「エラー回避」として自主的に環境変数を設定するリスク
- once AIがスキップフラグを発見すると、以後のバージョンで同じ手法を使用
- ワークフロー強制ルールが意味をなさなくなる

**AIの学習パターン:**
```
iteration 1: エラー発生 → スキップフラグの発見
iteration 2: 「この設定で回避できる」と学習
iteration 3: 以後自動的に使用
```

---

### 欠陥5: 変更波及追跡の欠如（影響ファイル自動検出なし）

**現在の実装:**
- スコープは `affectedFiles[]` と `affectedDirs[]` の静的リスト
- 依存関係グラフの自動構築なし
- 1つのファイル修正が何個のファイルに波及するか未追跡

**大規模への影響:**
- 共有型定義ファイル(`types.ts`)を編集
  - 実装ファイル50個に波及するが、スコープに明記されていない
  - 編集がブロックされるか、または編集後にビルドエラーが続出

- 共通ユーティリティ(`utils.ts`)を編集
  - 依存ファイル100個以上に波及
  - スコープ再定義が必要になる度に`reset`を実行

**影響例:**
```
修正: src/backend/domain/types/user.ts
  ↓
波及: src/backend/application/use-cases/ (30ファイル)
      src/backend/infrastructure/repositories/ (15ファイル)
      src/backend/presentation/schemas/ (10ファイル)
  → スコープに記載がなければ編集できない
```

---

### 欠陥6: コンテキスト消失への対策なし

**現在の実装:**
- フェーズ間の知識引き継ぎは「前フェーズのファイルを読む」だけ
- メタデータ、分析結果、検討内容が全て失われる
- 19フェーズ完了時に初期状態から何かが学習されていない

**大規模への影響:**
- requirements定義で「このAPI設計により依存が減少」という検討内容が記録されない
- test_impl段階で同じ依存性問題を再度検討する無駄
- parallel_verificationで新しいセキュリティリスクが発見されても、改修理由が記録されない

**構造化コンテキスト欠落:**
```
requirements段階: 「type CircularDependency の問題を検出」
  ↓（記録がない）
test_impl段階: 同じ問題を再度検出、同じ調査を繰り返す
  ↓（記録がない）
parallel_verification段階: セキュリティスキャンで同じ問題検出
  ↓（記録がない）
完了後: 何も改善されていない
```

---

## 3. 詳細分析結果

### 件数の集計

| 分類 | フック | MCP ツール | ガード構造 | 合計 |
|------|--------|-----------|-----------|------|
| 致命的欠陥 | 3件 | 1件 | - | 4件 |
| 重大欠陥 | 5件 | 3件 | 10個 | 18件 |
| 設計欠陥 | 2件 | 2件 | - | 4件 |

### アーキテクチャの根本問題

#### 問題1: フロントエンド・バックエンド分離なし

**現在:**
- 単一のワークフロー定義で全てのコード形式に対応しようとしている
- フロントエンドタスク（Next.js）とバックエンドタスク（Express/Hono）の要件が異なるのに統一ルール
- 20フェーズ全てが全ての言語/フレームワークに適用される

**大規模での問題:**
- フロントエンド: UI開発はtest_impl段階でストーリーを実装してから、implementation で実装
- バックエンド: ドメイン層はtest_impl段階では意味をなさない（TDD Redが成り立たない）
- 同一プロジェクトの複数タスクが矛盾したフェーズ管理

---

#### 問題2: 並列フェーズの状態管理が曖昧

**現在:**
- parallel_* フェーズでサブフェーズの進行状況を追跡していない
- `subPhases` オブジェクトがあるが、詳細な状態遷移が記録されない
- AIが「このサブフェーズが完了」と自己申告して`workflow_complete_sub`を実行できる

**大規模での問題:**
```
parallel_verification:
  ├─ manual_test (in_progress)
  ├─ security_scan (pending)
  ├─ performance_test (pending)
  └─ e2e_test (pending)

AIが「manual_testが終わった」と申告 → workflow_complete_sub('manual_test')
実際には security_scan がまだ完了していない
 → 不完全なまま docs_update に進む
```

---

#### 問題3: 依存性逆転が不十分

**現在:**
- 仕様書 → テスト → 実装の流れは設計されている
- ただし仕様書から実装への遡及チェックが弱い
- 設計→実装フェーズで新しい実装が追加されても、仕様書更新は義務づけられない

---

## 4. 調査で発見した設計パターン

### パターン1: フェーズ別ルール定義（1689行の辞書）

`phase-edit-guard.js` の `PHASE_RULES` オブジェクト:
```javascript
const PHASE_RULES = {
  research: {
    allowed: ['spec'],
    blocked: ['code', 'test', 'diagram', 'config', 'env', 'other'],
    description: 'research フェーズでは調査結果（.md）のみ作成可能。コードは編集できません。',
    japaneseName: '調査',
  },
  // ... 20+ フェーズの定義
}
```

**評価:** 包括的だが、拡張性に欠ける。新しいファイルタイプが追加される度に全フェーズを修正する必要がある。

---

### パターン2: スコープ検証ロジック（複雑さレベル: 高）

```javascript
function checkScopeViolation(filePath, workflowState) {
  // 1. scopeが存在しない場合は許可
  // 2. docs/配下は常に許可
  // 3. src/配下のみチェック
  // 4. affectedFiles に完全一致でチェック
  // 5. affectedDirs にプレフィックスマッチでチェック
  // 6. どちらにも含まれない場合はブロック
}
```

**評価:** ロジックは論理的だが、相互参照（circular import）がある可能性。

---

## 5. 大規模コードベース対応の課題

### 課題1: ファイルパス正規化の脆弱性

**処理:**
```javascript
function normalizeFilePath(filePath) {
  return filePath
    .replace(/\\/g, '/') // Windows互換
    .toLowerCase()
    .replace(/^\.\//, '');
}
```

**問題:**
- シンボリックリンクを考慮していない
- 相対パスと絶対パスの混在に脆弱
- 大規模では数千回の処理→性能劣化の可能性

---

### 課題2: ディレクトリスキャン性能

**現在:**
```javascript
function discoverTasks() {
  const entries = fs.readdirSync(WORKFLOW_DIR);
  for (const entry of entries) {
    const stat = fs.statSync(entryPath);
    // ...
  }
}
```

**問題:**
- 同期I/O で全ディレクトリを列挙
- 1000タスク以上で数秒のレイテンシ
- 複数フックが同時実行される場合、スタック

---

### 課題3: JSON パースのエラー耐性

**現在:**
```javascript
try {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
} catch (e) {
  return null; // エラー時はnull
}
```

**問題:**
- 破損したJSONファイルの場合、null返却
- ガード機構がnullをチェックしないと、undefined参照エラーが発生→Fail Openで許可される
- 大規模では複数のJSON破損ファイルが存在する可能性

---

## 6. 根本改修に向けた技術的障害

### 障害1: 10個のGitフックの一括修正が必須

全フックで `Fail Open` → `Fail Secure` に変更する必要がある。

**影響範囲:**
- phase-edit-guard.js
- enforce-workflow.js
- loop-detector.js
- block-dangerous-commands.js
- check-spec-sync.js
- check-spec.js
- check-test-first.js
- check-workflow-artifact.js
- spec-first-guard.js
- spec-guard-reset.js

---

### 障害2: テスト検証の実装が必須

現在：`exitCode` の自己申告のみ

改修後：
```
1. テストファイル（*.test.ts, *.spec.ts）の存在確認
2. テスト実行のlogファイル/レポート確認
3. カバレッジレポート（coverage/）の確認
4. vitest/jest の出力形式パース
```

---

### 障害3: 依存関係グラフの構築

**新規導入技術:**
- AST（Abstract Syntax Tree）パース
- import/export分析
- type依存性分析

**影響ファイル数:**
- 数千～数万ファイルで実行時間が爆発的に増加

---

## 7. 他プロジェクトでの類似システムとの比較

| システム | スコープ制御 | テスト検証 | エラー処理 | 並列管理 |
|---------|-----------|----------|---------|---------|
| 本プロジェクト | 任意 | 自己申告 | Fail Open | 曖昧 |
| Conventional Commits | 手動 | CI/CD連携 | - | - |
| Release Drafter | 自動検出 | リリース前検証 | Fail Secure | 順序制御 |
| husky | ファイル単位 | Fail Secure | Fail Secure | - |

---

## 8. 調査結論

### 大規模対応の可否

**現状評価: 非常に危険**

|項目|評価|
|----|-----|
|スコープ制御|❌ 完全に不十分|
|テスト検証|❌ 実装なし|
|エラー耐性|❌ Fail Open危険|
|並列管理|⚠️  曖昧|
|ドキュメント|✅ 非常に詳細|

### 根本改修の必要性

**必須修正リスト（優先度順）:**

1. **P0: Fail Secure への統一**（緊急）
   - 10個のフック全て修正
   - 負担: 1日

2. **P0: テスト検証実装**（緊急）
   - テストファイル検出
   - 結果パース実装
   - 負担: 3日

3. **P0: スコープ強制**（緊急）
   - research フェーズで強制設定
   - 全フェーズで検証
   - 負担: 2日

4. **P1: 依存関係グラフ**（重要）
   - AST パース導入
   - 波及影響の自動追跡
   - 負担: 5日

5. **P1: 並列フェーズ状態管理**（重要）
   - subPhase詳細追跡
   - 検証ロジック実装
   - 負担: 2日

6. **P1: 環境変数削除**（重要）
   - スキップフラグ廃止
   - 代替メカニズム実装
   - 負担: 1日

---

## 9. 推奨次ステップ

### requirements フェーズで確認すべき項目

1. **スコープ管理の再設計**
   - 自動検出 vs 手動定義のハイブリッド
   - 依存関係グラフの必要性

2. **テスト検証フレームワーク**
   - vitest/jest/mocha 対応
   - カバレッジ要件の定義

3. **エラー戦略の統一**
   - Fail Secure への完全移行
   - エラーログの監査証跡

4. **並列実行制御**
   - サブフェーズの厳密な状態遷移
   - 並列度の上限設定

---

## 調査ファイルリスト

- `/workflow-plugin/hooks/phase-edit-guard.js` (1690行) - フェーズ別編集制限
- `/workflow-plugin/hooks/check-workflow-artifact.js` (902行) - 成果物検証
- `/workflow-plugin/hooks/enforce-workflow.js` (284行) - ワークフロー強制
- `/workflow-plugin/hooks/loop-detector.js` (458行) - 無限ループ検出
- `/workflow-plugin/mcp-server/src/tools/set-scope.ts` - スコープ設定
- `/workflow-plugin/mcp-server/src/tools/record-test-result.ts` - テスト結果記録
- `/workflow-plugin/CLAUDE.md` (74KB) - ワークフロー強制ルール

---

## 参考資料

- **フェーズ構成**: 19フェーズ（research → requirements → parallel_analysis → ... → completed）
- **ファイルタイプ**: code, test, spec, diagram, config, env, other
- **ファイル数**: 7個のメインフック + 3個のサポートフック + 15個のMCP ツール

---

**調査日時**: 2026-02-07
**調査者**: Claude（researchフェーズ実行）
**対象プロジェクト**: workflow-plugin（ワークフロー制御プラグイン）
