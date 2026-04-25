# レビュー指摘6件の根本原因修正 - テスト設計書

## サマリー

本テスト設計書では、6件の修正要件(REQ-FIX-1〜6)について包括的なテスト戦略を定義しました。各修正は独立性が高く、並列テスト実行が可能な構造になっています。

**主要な決定事項:**
1. **テスト戦略**: ユニットテスト(関数単位)、統合テスト(フェーズ間連携)、E2Eテスト(ワークフロー全体)の3層構造を採用
2. **テストデータ**: 1000ファイル規模のモックプロジェクトを用意し、性能要件の検証を実施
3. **自動化方針**: 全テストケースをvitestで自動化し、CI環境での継続的検証を実現
4. **性能ベンチマーク**: REQ-FIX-3,4,5の性能改善は定量的に測定し、目標値(50分→5秒等)の達成を確認
5. **セキュリティテスト**: REQ-FIX-6のfail-closed原則は全エラーケースでexit(2)が返されることを検証
6. **エッジケーステスト**: null/undefined、空配列、破損データ等の異常系を網羅的にテスト

**次フェーズで必要な情報:**
- 各テストケースの実装順序は、REQ-FIX-6(セキュリティ)→ REQ-FIX-1,2(UX)→ REQ-FIX-3,4,5(性能)の段階的アプローチを推奨
- 性能テストは実機環境(1000ファイルプロジェクト)での計測が必須
- fail-closedテストは全フックに対して同一パターンを適用

## 検索キーワード索引

本テスト設計書はbfs走査性能テストとdiscovertasksインデックステストを中心構成としています。
REQ-FIX-1のuserIntentテンプレートへの埋込検証では、各フェーズへのuserIntent正常伝搬を確認します。
bfs依存解析のバッチ並列化とdiscovertasksの高速検索はパフォーマンステストの核となる項目です。
REQ-FIX-2のuserIntentテンプレートへの優先順位反映テストからfail-closed統一までの全修正項目を網羅しており、
bfs走査とdiscovertasks双方の性能目標値(50分→5秒、2秒→10ms)達成を定量的に検証します。

## テスト戦略

本プロジェクトでは、品質保証のために以下の3層テスト戦略を採用します。各層は独立して実行可能であり、CI/CD環境での自動化を前提としています。

### レイヤー別テスト構成

| テストレイヤー | 対象 | ツール | 実行時間目標 |
|:-------------|:-----|:------|:-----------|
| ユニットテスト | 関数・クラス単位のロジック検証 | vitest | 5秒以内 |
| 統合テスト | モジュール間連携・ファイルI/O検証 | vitest | 30秒以内 |
| E2Eテスト | ワークフロー全体の動作検証 | Bash + MCP Server | 2分以内 |
| 性能テスト | 1000ファイルプロジェクトでの性能計測 | console.time + Bash | 5分以内 |

### テストデータ準備

性能テストとE2Eテストでは、以下のモックプロジェクトを使用します。

```
test-project-1000files/
├── src/
│   ├── app/
│   │   ├── page.tsx (100ファイル)
│   │   └── api/ (100ファイル)
│   ├── components/
│   │   └── ui/ (200ファイル)
│   ├── lib/
│   │   └── utils/ (100ファイル)
│   └── features/
│       └── auth/ (500ファイル - ネストしたディレクトリ構造)
├── docs/
│   └── spec/ (100ファイル)
└── tests/
    └── unit/ (100ファイル)
```

**データ生成スクリプト**: `workflow-plugin/mcp-server/tests/fixtures/generate-mock-project.ts`

### カバレッジ目標

| 修正ID | ユニットテストカバレッジ | 統合テストカバレッジ | E2Eテスト |
|:------|:---------------------|:------------------|:---------|
| REQ-FIX-1 | 90%以上 | 80%以上 | 1シナリオ |
| REQ-FIX-2 | 95%以上 | 85%以上 | 3シナリオ |
| REQ-FIX-3 | 85%以上 | 90%以上 | 2シナリオ |
| REQ-FIX-4 | 85%以上 | 90%以上 | 2シナリオ |
| REQ-FIX-5 | 90%以上 | 95%以上 | 2シナリオ |
| REQ-FIX-6 | 100%（全エラーパス必須） | 95%以上 | 4シナリオ |

---

## REQ-FIX-1テスト設計

### テスト対象

- `workflow-plugin/CLAUDE.md` (Line 193-248): subagent起動テンプレート
- Orchestratorパターン説明への追記
- 成果物必須セクションへの追記

### ユニットテスト

#### TC-1.1: テンプレート内userIntentプレースホルダー検証

**テストID**: `UT-FIX1-001`
**目的**: CLAUDE.mdのsubagent起動テンプレートに`{userIntent}`プレースホルダーが含まれることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/claude-md-validation.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | CLAUDE.mdファイル |
| 期待出力 | テンプレート内に「- ユーザーの意図: {userIntent}」が18箇所存在（research以外の全フェーズ） |
| 検証ロジック | 正規表現による文字列マッチング `/ユーザーの意図:\s*\{userIntent\}/g` |
| エッジケース | プレースホルダーの大文字小文字が異なる場合 |

**実装例:**
```typescript
describe('REQ-FIX-1: userIntent埋込検証', () => {
  test('CLAUDE.mdにuserIntentプレースホルダーが含まれる', async () => {
    const claudeMd = await fs.readFile('workflow-plugin/CLAUDE.md', 'utf-8');
    const matches = claudeMd.match(/ユーザーの意図:\s*\{userIntent\}/g);
    expect(matches).toHaveLength(18); // research除く18フェーズ
  });
});
```

#### TC-1.2: Orchestratorパターン説明の存在確認

**テストID**: `UT-FIX1-002`
**目的**: CLAUDE.mdに「### userIntent伝搬の実装」セクションが追加されたことを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/claude-md-validation.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | CLAUDE.mdファイル |
| 期待出力 | 「### userIntent伝搬の実装」セクションが存在し、3つの手順が記載されている |
| 検証ロジック | セクション見出しの検索 + 手順番号1-3の存在確認 |
| エッジケース | セクションが途中で切れている場合 |

#### TC-1.3: 成果物必須セクションへの追記確認

**テストID**: `UT-FIX1-003`
**目的**: CLAUDE.mdの「## ★重要★ サマリーセクション必須化」内に「## ユーザーの意図」が追加されたことを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/claude-md-validation.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | CLAUDE.mdファイル |
| 期待出力 | 「## ユーザーの意図」セクションが含まれ、TaskState.userIntentの記載方法が説明されている |
| 検証ロジック | セクション見出しの検索 + 「TaskState.userIntent」の文字列存在確認 |
| エッジケース | 「## ユーザーの意図」が複数箇所に出現する場合（テンプレート内と説明内） |

### E2Eテスト

#### TC-1.4: userIntent伝搬の動作確認

**テストID**: `E2E-FIX1-001`
**目的**: workflow_start時に指定したuserIntentがrequirements.mdに記載されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/e2e/userintent-propagation.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | MCP Serverが起動している |
| 入力 | `workflow_start("テスト機能実装", userIntent: "ユニットテストとE2Eテストを実装する")` |
| 期待出力 | `docs/workflows/テスト機能実装/requirements.md` に「## ユーザーの意図\nユニットテストとE2Eテストを実装する」が含まれる |
| 検証手順 | 1. workflow_start実行 → 2. requirements.md読み込み → 3. セクション存在確認 |
| エッジケース | userIntentが10000文字ギリギリの場合 |

#### TC-1.5: userIntentフォールバック動作確認

**テストID**: `E2E-FIX1-002`
**目的**: userIntent未指定時にtaskNameがフォールバック値として使用されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/e2e/userintent-propagation.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | MCP Serverが起動している |
| 入力 | `workflow_start("サンプルタスク")` (userIntent省略) |
| 期待出力 | `docs/workflows/サンプルタスク/requirements.md` に「## ユーザーの意図\nサンプルタスク」が含まれる |
| 検証手順 | 1. workflow_start実行 → 2. requirements.md読み込み → 3. セクション内容確認 |
| エッジケース | taskNameが空文字列の場合 |

---

## REQ-FIX-2テスト設計

### テスト対象

- `workflow-plugin/mcp-server/src/phases/definitions.ts` (Line 459): calculatePhaseSkips()関数
- `workflow-plugin/mcp-server/src/tools/next.ts` (Line 398): calculatePhaseSkips()呼び出し箇所

### ユニットテスト

#### TC-2.1: userIntentベースのtest_implスキップ判定（キーワードあり）

**テストID**: `UT-FIX2-001`
**目的**: userIntentに「テスト」キーワードが含まれる場合、test_implがスキップされないことを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/phase-skip-calculation.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | `scope: { files: ["docs/README.md"] }`, `userIntent: "ユニットテストを追加する"` |
| 期待出力 | `phaseSkipReasons` オブジェクトに `test_impl` キーが**含まれない** |
| 検証ロジック | `calculatePhaseSkips(scope, userIntent)` の戻り値に `test_impl` が存在しないことを確認 |
| エッジケース | userIntentが「テスト」「test」「試験」の3パターン全て |

#### TC-2.2: userIntentベースのtest_implスキップ判定（キーワードなし）

**テストID**: `UT-FIX2-002`
**目的**: userIntentにテスト関連キーワードが含まれない場合、スコープベース判定にフォールバックすることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/phase-skip-calculation.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | `scope: { files: ["docs/README.md"] }`, `userIntent: "ドキュメント更新"` |
| 期待出力 | `phaseSkipReasons['test_impl'] = 'テストファイルが影響範囲に含まれないため(スコープベース判定)'` |
| 検証ロジック | `calculatePhaseSkips(scope, userIntent)` の戻り値に `test_impl` が含まれ、理由が正しいことを確認 |
| エッジケース | userIntentがnull/undefinedの場合 |

#### TC-2.3: 実装キーワード検出テスト

**テストID**: `UT-FIX2-003`
**目的**: userIntentに「実装」「implementation」キーワードが含まれる場合、implementationフェーズがスキップされないことを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/phase-skip-calculation.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | `scope: { files: ["docs/README.md"] }`, `userIntent: "新機能を実装する"` |
| 期待出力 | `phaseSkipReasons` オブジェクトに `implementation` キーが**含まれない** |
| 検証ロジック | `calculatePhaseSkips(scope, userIntent)` の戻り値に `implementation` が存在しないことを確認 |
| エッジケース | userIntentが「コード」「code」「開発」の3パターン全て |

#### TC-2.4: キーワード部分一致の許容テスト

**テストID**: `UT-FIX2-004`
**目的**: userIntentに「E2Eテスト」のように複合語が含まれる場合も正しく検出されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/phase-skip-calculation.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | `scope: { files: ["docs/README.md"] }`, `userIntent: "E2Eテストを追加"` |
| 期待出力 | `phaseSkipReasons` オブジェクトに `test_impl` キーが**含まれない** |
| 検証ロジック | `calculatePhaseSkips(scope, userIntent)` の戻り値に `test_impl` が存在しないことを確認 |
| エッジケース | 「ユニットテスト」「unit test」「unittest」等のバリエーション |

### 統合テスト

#### TC-2.5: next.ts経由のuserIntent引き渡しテスト

**テストID**: `IT-FIX2-001`
**目的**: next.ts内でcalculatePhaseSkips()にuserIntentが正しく引き渡されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/integration/workflow-next.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | taskStateにuserIntentが設定されている |
| 入力 | `workflow_next({ taskId: "test_task" })` |
| 期待出力 | calculatePhaseSkips()に`taskState.userIntent`が第2引数として渡される |
| 検証ロジック | モック関数でcalculatePhaseSkips()の引数をキャプチャし、userIntentが含まれることを確認 |
| エッジケース | taskState.userIntentがundefinedの場合 |

### E2Eテスト

#### TC-2.6: ユーザー意図優先のスキップ判定E2Eテスト

**テストID**: `E2E-FIX2-001`
**目的**: ワークフロー実行時にuserIntent優先のスキップ判定が動作することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/e2e/phase-skip-priority.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | MCP Serverが起動している |
| 入力 | 1. `workflow_set_scope({ files: ["docs/README.md"] })`<br>2. `workflow_start("ドキュメント更新", userIntent: "テストを追加する")` |
| 期待出力 | test_implフェーズが実行される（スキップされない） |
| 検証手順 | 1. workflow_start実行 → 2. workflow_next繰り返し → 3. test_implフェーズに到達することを確認 |
| エッジケース | スコープに.mdファイルのみでuserIntentに「実装」が含まれる場合 |

---

## REQ-FIX-3テスト設計

### テスト対象

- `workflow-plugin/mcp-server/src/validation/design-validator.ts` (新規フィールド・メソッド追加)
- `.claude/cache/ast-analysis.json` (新規ファイル)

### ユニットテスト

#### TC-3.1: hashFile()メソッドのテスト

**テストID**: `UT-FIX3-001`
**目的**: ファイル内容からMD5ハッシュが正しく生成されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/design-validator-cache.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | テスト用TypeScriptファイル（固定内容） |
| 期待出力 | 期待されるMD5ハッシュ値（事前計算済み） |
| 検証ロジック | hashFile()の戻り値と期待ハッシュ値の一致確認 |
| エッジケース | ファイルが存在しない場合（エラーがスローされることを確認） |

#### TC-3.2: analyzeWithCache()メソッドのキャッシュヒットテスト

**テストID**: `UT-FIX3-002`
**目的**: 同一ファイルの2回目の解析でキャッシュヒットすることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/design-validator-cache.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | 同一ファイルへの2回の解析リクエスト |
| 期待出力 | 2回目の解析で`this.cacheHits`が1増加 |
| 検証ロジック | analyzeWithCache()を2回実行し、getMetrics()でcacheHitsを確認 |
| エッジケース | ファイル内容が変更された場合（キャッシュミスになることを確認） |

#### TC-3.3: evictExpiredCache()メソッドのテスト

**テストID**: `UT-FIX3-003`
**目的**: 24時間経過したキャッシュが削除されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/design-validator-cache.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | 24時間以上前のタイムスタンプを持つキャッシュエントリ |
| 期待出力 | evictExpiredCache()実行後、古いエントリが削除される |
| 検証ロジック | モックで現在時刻を操作し、キャッシュサイズを確認 |
| エッジケース | キャッシュが空の場合 |

### 統合テスト

#### TC-3.4: 永続化キャッシュの読み書きテスト

**テストID**: `IT-FIX3-001`
**目的**: ast-analysis.jsonへのキャッシュ永続化と読み込みが正しく動作することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/integration/design-validator-persistence.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | `.claude/cache/`ディレクトリが存在する |
| 入力 | 1. analyzeWithCache()でキャッシュ作成 → 2. persistCache()実行 → 3. 新規DesignValidatorインスタンス作成 |
| 期待出力 | 新規インスタンスでloadPersistedCache()が実行され、キャッシュが復元される |
| 検証ロジック | キャッシュサイズとエントリ内容が一致することを確認 |
| エッジケース | ast-analysis.jsonが破損している場合（空のキャッシュとして起動することを確認） |

### 性能テスト

#### TC-3.5: 1000ファイルプロジェクトの初回解析性能テスト

**テストID**: `PERF-FIX3-001`
**目的**: 1000ファイルプロジェクトの初回AST解析が60秒以内に完了することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/performance/design-validator-perf.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 1000ファイルのモックプロジェクトが存在する |
| 入力 | DesignValidator.validateAll() |
| 期待出力 | 実行時間が60秒以内 |
| 検証ロジック | console.time()で実行時間を計測 |
| エッジケース | 複雑なAST構造を持つファイルが含まれる場合 |

#### TC-3.6: 1000ファイルプロジェクトの2回目解析性能テスト

**テストID**: `PERF-FIX3-002`
**目的**: 1000ファイルプロジェクトの2回目AST解析（キャッシュヒット時）が5秒以内に完了することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/performance/design-validator-perf.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 1回目の解析が完了し、キャッシュが存在する |
| 入力 | DesignValidator.validateAll() |
| 期待出力 | 実行時間が5秒以内、キャッシュヒット率90%以上 |
| 検証ロジック | console.time()で実行時間を計測、getMetrics()でヒット率確認 |
| エッジケース | 一部のファイルのみが変更された場合（ヒット率が下がることを確認） |

---

## REQ-FIX-4テスト設計

### テスト対象

- `workflow-plugin/mcp-server/src/validation/scope-validator.ts` (Line 445-540): trackDependencies()関数
- 同上の呼び出し元ファイル全箇所

### ユニットテスト

#### TC-4.1: extractImportsWithCache()メソッドのキャッシュヒットテスト

**テストID**: `UT-FIX4-001`
**目的**: 同一ファイルの2回目のimport抽出でキャッシュヒットすることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/scope-validator-cache.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | 同一ファイルパスと内容での2回の呼び出し |
| 期待出力 | 2回目の呼び出しでキャッシュから結果が返される |
| 検証ロジック | extractImports()のモック呼び出し回数が1回であることを確認 |
| エッジケース | ファイル内容が変更された場合（キャッシュミスになることを確認） |

#### TC-4.2: importキャッシュサイズ制限テスト

**テストID**: `UT-FIX4-002`
**目的**: importキャッシュが10000エントリ上限に達した場合、古いエントリが削除されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/scope-validator-cache.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | 10001個のファイルに対するimport抽出 |
| 期待出力 | キャッシュサイズが10000に制限される |
| 検証ロジック | importCache.sizeが10000であることを確認 |
| エッジケース | 同時に大量のファイルが処理される場合 |

### 統合テスト

#### TC-4.3: trackDependencies()非同期化テスト

**テストID**: `IT-FIX4-001`
**目的**: trackDependencies()が非同期で動作し、Promiseを返すことを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/integration/scope-validator-async.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 10ファイル程度のモックプロジェクトが存在する |
| 入力 | `await trackDependencies(['file1.ts'], ['src/'], { maxDepth: 2 })` |
| 期待出力 | Promiseが返され、awaitで結果が取得できる |
| 検証ロジック | instanceof Promiseでの型チェック |
| エッジケース | trackDependencies()内で例外がスローされた場合 |

#### TC-4.4: バッチ並列処理の動作確認テスト

**テストID**: `IT-FIX4-002`
**目的**: バッチサイズ10でファイルが並列処理されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/integration/scope-validator-async.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 30ファイルのモックプロジェクトが存在する |
| 入力 | `await trackDependencies(['file1.ts'], ['src/'], { batchSize: 10 })` |
| 期待出力 | Promise.all()が3回呼び出される（30ファイル ÷ 10バッチサイズ） |
| 検証ロジック | console.logでバッチ処理のログを確認 |
| エッジケース | バッチサイズが1の場合（逐次処理になることを確認） |

### 性能テスト

#### TC-4.5: 1000ファイルプロジェクトの初回依存解析性能テスト

**テストID**: `PERF-FIX4-001`
**目的**: 1000ファイルプロジェクトの初回BFS依存解析が30秒以内に完了することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/performance/scope-validator-perf.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 1000ファイルのモックプロジェクトが存在し、各ファイルが平均5個のimportを持つ |
| 入力 | `await trackDependencies(['src/app.ts'], ['src/'], { maxDepth: 5 })` |
| 期待出力 | 実行時間が30秒以内 |
| 検証ロジック | console.time()で実行時間を計測 |
| エッジケース | 循環依存が存在する場合（無限ループにならないことを確認） |

#### TC-4.6: 1000ファイルプロジェクトの2回目依存解析性能テスト

**テストID**: `PERF-FIX4-002`
**目的**: 1000ファイルプロジェクトの2回目BFS依存解析（キャッシュヒット時）が5秒以内に完了することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/performance/scope-validator-perf.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 1回目の解析が完了し、importキャッシュが存在する |
| 入力 | `await trackDependencies(['src/app.ts'], ['src/'], { maxDepth: 5 })` |
| 期待出力 | 実行時間が5秒以内、importキャッシュヒット率80%以上 |
| 検証ロジック | console.time()で実行時間を計測 |
| エッジケース | 一部のファイルのみが変更された場合 |

---

## REQ-FIX-5テスト設計

### テスト対象

- `workflow-plugin/mcp-server/src/state/manager.ts` (新規フィールド・メソッド追加)
- `.claude/state/task-index.json` (新規ファイル)

### ユニットテスト

#### TC-5.1: loadTaskIndex()メソッドのテスト（ファイル存在時）

**テストID**: `UT-FIX5-001`
**目的**: task-index.jsonが存在する場合、正しくインデックスが読み込まれることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/state-manager-index.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | task-index.jsonにテストデータが存在する |
| 入力 | `loadTaskIndex()` |
| 期待出力 | インデックスオブジェクトが返される |
| 検証ロジック | 戻り値の型とエントリ数を確認 |
| エッジケース | task-index.jsonが破損している場合（rebuildTaskIndex()が呼ばれることを確認） |

#### TC-5.2: saveTaskIndex()メソッドのテスト

**テストID**: `UT-FIX5-002`
**目的**: インデックスがtask-index.jsonに正しく保存されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/state-manager-index.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | `.claude/state/`ディレクトリが存在する |
| 入力 | `saveTaskIndex({ "20260214_175140": "workflows/test_task" })` |
| 期待出力 | task-index.jsonにJSONが書き込まれる |
| 検証ロジック | fs.readFileSyncでファイル内容を読み込み、JSON.parseで検証 |
| エッジケース | ディレクトリが存在しない場合（自動作成されることを確認） |

#### TC-5.3: rebuildTaskIndex()メソッドのテスト

**テストID**: `UT-FIX5-003`
**目的**: 全タスクをスキャンしてインデックスを再構築できることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/unit/state-manager-index.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | `.claude/state/workflows/`に複数のタスクディレクトリが存在する |
| 入力 | `rebuildTaskIndex()` |
| 期待出力 | 全タスクのインデックスが生成される |
| 検証ロジック | 戻り値のエントリ数がタスク数と一致することを確認 |
| エッジケース | タスクディレクトリが空の場合 |

### 統合テスト

#### TC-5.4: getTaskById()のインデックスベース高速取得テスト

**テストID**: `IT-FIX5-001`
**目的**: getTaskById()がインデックスを使用して高速にタスクを取得することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/integration/state-manager-fast-lookup.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | task-index.jsonにエントリが存在する |
| 入力 | `getTaskById("20260214_175140")` |
| 期待出力 | TaskStateオブジェクトが返される |
| 検証ロジック | 1. discoverTasks()が呼ばれないことをモックで確認 → 2. TaskStateオブジェクトの内容確認 |
| エッジケース | インデックスにない新規タスクの場合（フォールバックして全スキャンすることを確認） |

#### TC-5.5: createTask()でのインデックス自動更新テスト

**テストID**: `IT-FIX5-002`
**目的**: createTask()実行時にインデックスが自動的に更新されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/integration/state-manager-fast-lookup.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | StateManagerが初期化されている |
| 入力 | `createTask("新規タスク", "large", "ユーザー意図")` |
| 期待出力 | task-index.jsonに新規タスクのエントリが追加される |
| 検証ロジック | createTask()実行後、task-index.jsonを読み込んで新規エントリを確認 |
| エッジケース | 同一taskIdが既に存在する場合（上書きされることを確認） |

### 性能テスト

#### TC-5.6: 1000タスク環境でのgetTaskById()性能テスト

**テストID**: `PERF-FIX5-001`
**目的**: 1000タスク存在する環境でgetTaskById()が10ms以内に完了することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/performance/state-manager-perf.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 1000個のタスクがtask-index.jsonに登録されている |
| 入力 | `getTaskById("20260214_175140")` を10回実行 |
| 期待出力 | 平均実行時間が10ms以内 |
| 検証ロジック | console.time()で各実行時間を計測し、平均を算出 |
| エッジケース | インデックスが破損している場合（自動修復後の性能を確認） |

---

## REQ-FIX-6テスト設計

### テスト対象

- `workflow-plugin/hooks/loop-detector.js` (Line 381-391, catch句)
- `workflow-plugin/CLAUDE.md` (新規セクション追加)
- `workflow-plugin/hooks/phase-edit-guard.js` (fail-closed統一)
- `workflow-plugin/hooks/enforce-workflow.js` (fail-closed統一)
- `workflow-plugin/hooks/bash-whitelist.js` (fail-closed統一)

### ユニットテスト

#### TC-6.1: loop-detector.js入力検証エラーテスト

**テストID**: `UT-FIX6-001`
**目的**: loop-detector.jsで入力がnullの場合、exit(2)が返されることを確認
**テストファイル**: `workflow-plugin/hooks/tests/loop-detector-fail-closed.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | `null` |
| 期待出力 | `process.exit(2)` |
| 検証ロジック | process.exitのモックで終了コードをキャプチャ |
| エッジケース | 入力がundefined、空オブジェクト、配列の場合 |

#### TC-6.2: loop-detector.jsパス検証エラーテスト

**テストID**: `UT-FIX6-002`
**目的**: loop-detector.jsでfile_pathが空の場合、exit(2)が返されることを確認
**テストファイル**: `workflow-plugin/hooks/tests/loop-detector-fail-closed.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | `{ tool_name: "Edit", tool_input: { file_path: "" } }` |
| 期待出力 | `process.exit(2)` |
| 検証ロジック | process.exitのモックで終了コードをキャプチャ |
| エッジケース | file_pathがnull、undefinedの場合 |

#### TC-6.3: loop-detector.js予期しないエラーテスト

**テストID**: `UT-FIX6-003`
**目的**: loop-detector.jsで予期しない例外がスローされた場合、exit(2)が返されることを確認
**テストファイル**: `workflow-plugin/hooks/tests/loop-detector-fail-closed.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | checkLoop()内で例外をスローするモック |
| 期待出力 | `process.exit(2)` |
| 検証ロジック | process.exitのモックで終了コードをキャプチャ |
| エッジケース | fs.readFileSync()がENOENTエラーをスローする場合 |

#### TC-6.4: logError()のJSON Lines形式テスト

**テストID**: `UT-FIX6-004`
**目的**: logError()がJSON Lines形式でログを書き込むことを確認
**テストファイル**: `workflow-plugin/hooks/tests/loop-detector-fail-closed.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 入力 | `logError('入力検証エラー', '入力がオブジェクト型ではありません', '')` |
| 期待出力 | `.claude/state/hook-errors.log`に1行のJSON Lines形式ログが追加される |
| 検証ロジック | fs.readFileSync()でログファイルを読み込み、JSON.parse()で検証 |
| エッジケース | ログファイルが存在しない場合（自動作成されることを確認） |

### 統合テスト

#### TC-6.5: phase-edit-guard.jsのfail-closed統一テスト

**テストID**: `IT-FIX6-001`
**目的**: phase-edit-guard.jsで全エラーケースでexit(2)が返されることを確認
**テストファイル**: `workflow-plugin/hooks/tests/phase-edit-guard-fail-closed.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | workflow-state.jsonが破損している |
| 入力 | Edit toolの実行 |
| 期待出力 | `process.exit(2)` |
| 検証ロジック | process.exitのモックで終了コードをキャプチャ |
| エッジケース | HMAC検証エラー、フェーズ不一致エラー、ファイル読み込みエラーの3パターン |

#### TC-6.6: enforce-workflow.jsのfail-closed統一テスト

**テストID**: `IT-FIX6-002`
**目的**: enforce-workflow.jsで全エラーケースでexit(2)が返されることを確認
**テストファイル**: `workflow-plugin/hooks/tests/enforce-workflow-fail-closed.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | タスクが存在しない状態 |
| 入力 | Edit toolの実行 |
| 期待出力 | `process.exit(2)` |
| 検証ロジック | process.exitのモックで終了コードをキャプチャ |
| エッジケース | タスク未存在エラー、状態ファイル読み込みエラーの2パターン |

#### TC-6.7: bash-whitelist.jsのfail-closed統一テスト

**テストID**: `IT-FIX6-003`
**目的**: bash-whitelist.jsで全エラーケースでexit(2)が返されることを確認
**テストファイル**: `workflow-plugin/hooks/tests/bash-whitelist-fail-closed.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | ホワイトリストファイルが破損している |
| 入力 | Bash toolの実行 |
| 期待出力 | `process.exit(2)` |
| 検証ロジック | process.exitのモックで終了コードをキャプチャ |
| エッジケース | コマンド解析エラー、ホワイトリスト読み込みエラーの2パターン |

### E2Eテスト

#### TC-6.8: 全フックのエラーログ統合テスト

**テストID**: `E2E-FIX6-001`
**目的**: 全フックのエラーが`.claude/state/hook-errors.log`に統合記録されることを確認
**テストファイル**: `workflow-plugin/hooks/tests/e2e/hook-errors-log.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 4つのフック（loop-detector, phase-edit-guard, enforce-workflow, bash-whitelist）が有効 |
| 入力 | 各フックでエラーを発生させる |
| 期待出力 | hook-errors.logに4つのエラーログが記録される |
| 検証ロジック | fs.readFileSync()でログファイルを読み込み、行数と各hookフィールドを確認 |
| エッジケース | 同時に複数のフックがエラーをログに書き込む場合 |

---

## 統合テスト設計

統合テストでは、複数のREQ-FIX修正が組み合わさった場合の動作を検証します。

### TC-INT-1: REQ-FIX-1とREQ-FIX-2の組み合わせテスト

**テストID**: `IT-INTEGRATION-001`
**目的**: userIntentがCLAUDE.mdから成果物に伝搬され、スキップ判定にも使用されることを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/integration/userintent-and-skip.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | MCP Serverが起動している |
| 入力 | 1. `workflow_start("テスト機能実装", userIntent: "E2Eテストを実装する")`<br>2. `workflow_set_scope({ files: ["docs/README.md"] })` |
| 期待出力 | 1. requirements.mdに「## ユーザーの意図\nE2Eテストを実装する」が含まれる<br>2. test_implフェーズがスキップされない |
| 検証ロジック | 1. Readツールでrequirements.md読み込み → 2. workflow_nextでtest_implフェーズ到達確認 |
| エッジケース | userIntentに複数のキーワード（「テスト」「実装」）が含まれる場合 |

### TC-INT-2: REQ-FIX-3とREQ-FIX-4の組み合わせテスト

**テストID**: `IT-INTEGRATION-002`
**目的**: AST解析キャッシュとimportキャッシュが同時に機能し、検証速度が向上することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/integration/cache-performance.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 100ファイル規模のモックプロジェクトが存在する |
| 入力 | 1. DesignValidator.validateAll()実行 → 2. ScopeValidator.validateFilesInScope()実行 → 3. 再度両方実行 |
| 期待出力 | 2回目の実行が1回目の1/10以下の時間で完了 |
| 検証ロジック | console.time()で各実行時間を計測 |
| エッジケース | 両方のキャッシュが期限切れの場合 |

### TC-INT-3: REQ-FIX-5とREQ-FIX-6の組み合わせテスト

**テストID**: `IT-INTEGRATION-003`
**目的**: タスクインデックスの高速取得とfail-closedエラーログが同時に機能することを確認
**テストファイル**: `workflow-plugin/mcp-server/tests/integration/index-and-failclosed.test.ts`

| 項目 | 内容 |
|:----|:-----|
| 前提条件 | 10タスクが存在し、task-index.jsonが作成されている |
| 入力 | 1. getTaskById()でタスク取得 → 2. loop-detectorでエラー発生 |
| 期待出力 | 1. タスクが高速取得される（10ms以内）<br>2. hook-errors.logにエラーが記録される |
| 検証ロジック | 1. console.time()で実行時間計測 → 2. fs.readFileSync()でログ確認 |
| エッジケース | タスクインデックスが破損している状態でエラーが発生した場合 |

---

## テスト環境・前提条件

### ハードウェア要件

| 項目 | 最小スペック | 推奨スペック |
|:----|:-----------|:------------|
| CPU | 4コア | 8コア以上 |
| メモリ | 8GB | 16GB以上 |
| ストレージ | SSD 10GB以上 | SSD 20GB以上 |
| OS | Windows 10/macOS 11/Linux | Windows 11/macOS 13/Linux |

### ソフトウェア要件

| ソフトウェア | バージョン |
|:-----------|:----------|
| Node.js | 20.x以上 |
| npm | 10.x以上 |
| TypeScript | 5.x |
| vitest | 1.x |
| Git | 2.x以上 |

### 環境変数

テスト実行時に以下の環境変数を設定してください。

```bash
# テスト用ディレクトリパス
export TEST_PROJECT_DIR=/tmp/workflow-test-project
export TEST_STATE_DIR=/tmp/workflow-test-state

# テストモード有効化
export SKIP_LOOP_DETECTOR=false
export VALIDATE_DESIGN_STRICT=true

# キャッシュ無効化（初回性能テスト用）
export DISABLE_AST_CACHE=false
export DISABLE_IMPORT_CACHE=false
```

### テストデータ準備

テスト実行前に以下のスクリプトを実行してください。

```bash
# 1000ファイルモックプロジェクト生成
cd workflow-plugin/mcp-server
pnpm run generate-mock-project

# テスト用タスク1000個生成
pnpm run generate-mock-tasks

# MCP Serverビルド
pnpm run build
```

### CI/CD統合

GitHub Actionsでの自動テスト実行設定例:

```yaml
name: Workflow Plugin Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Generate test data
        run: |
          pnpm run generate-mock-project
          pnpm run generate-mock-tasks

      - name: Run unit tests
        run: pnpm test:unit

      - name: Run integration tests
        run: pnpm test:integration

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Run performance tests
        run: pnpm test:performance

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## テストファイル配置

全てのテストファイルは以下のディレクトリ構成で配置します。

```
workflow-plugin/
├── mcp-server/
│   └── tests/
│       ├── unit/
│       │   ├── claude-md-validation.test.ts (REQ-FIX-1)
│       │   ├── phase-skip-calculation.test.ts (REQ-FIX-2)
│       │   ├── design-validator-cache.test.ts (REQ-FIX-3)
│       │   ├── scope-validator-cache.test.ts (REQ-FIX-4)
│       │   └── state-manager-index.test.ts (REQ-FIX-5)
│       ├── integration/
│       │   ├── workflow-next.test.ts (REQ-FIX-2)
│       │   ├── design-validator-persistence.test.ts (REQ-FIX-3)
│       │   ├── scope-validator-async.test.ts (REQ-FIX-4)
│       │   ├── state-manager-fast-lookup.test.ts (REQ-FIX-5)
│       │   ├── userintent-and-skip.test.ts (統合)
│       │   ├── cache-performance.test.ts (統合)
│       │   └── index-and-failclosed.test.ts (統合)
│       ├── e2e/
│       │   ├── userintent-propagation.test.ts (REQ-FIX-1)
│       │   ├── phase-skip-priority.test.ts (REQ-FIX-2)
│       │   └── workflow-full-cycle.test.ts (統合)
│       ├── performance/
│       │   ├── design-validator-perf.test.ts (REQ-FIX-3)
│       │   ├── scope-validator-perf.test.ts (REQ-FIX-4)
│       │   └── state-manager-perf.test.ts (REQ-FIX-5)
│       └── fixtures/
│           ├── generate-mock-project.ts
│           └── generate-mock-tasks.ts
└── hooks/
    └── tests/
        ├── loop-detector-fail-closed.test.ts (REQ-FIX-6)
        ├── phase-edit-guard-fail-closed.test.ts (REQ-FIX-6)
        ├── enforce-workflow-fail-closed.test.ts (REQ-FIX-6)
        ├── bash-whitelist-fail-closed.test.ts (REQ-FIX-6)
        └── e2e/
            └── hook-errors-log.test.ts (REQ-FIX-6)
```
