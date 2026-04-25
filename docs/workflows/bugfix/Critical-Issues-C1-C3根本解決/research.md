# researchフェーズ成果物

## サマリー

本調査では、ワークフロープラグインのレビューで指摘された3つのCritical Issues（C-1: userIntent伝播の非技術的強制、C-2: design-validator未統合、C-3: test-authenticity未統合）の根本原因と解決策を調査した。

**主要な発見事項:**
1. C-1は現在、Orchestratorの自律的判断に依存しており、技術的強制がない
2. C-2のdesign-validatorは実装済みだが、test_impl→implementation遷移時とrefactoring→parallel_quality遷移時のみ呼び出され、code_reviewフェーズでの検証が欠落している
3. C-3のtest-authenticityは実装済みだが、workflow_record_test_result内でのみ呼び出され、workflow_next/workflow_complete_subでの遷移ブロックがない
4. PHASE_GUIDESにuserIntent伝播の構造化データは存在するが、Task toolプロンプトへの埋め込みはAIの裁量に委ねられている
5. 全ての問題に共通する根本原因は「技術的強制の欠如」である

**次フェーズで必要な情報:**
- C-1: resolvePhaseGuide関数がuserIntentをphaseGuideに含める実装は完了（line 869）。Orchestratorへの伝達メカニズムの強化案を設計する必要がある
- C-2: code_reviewフェーズでのdesign-validator統合箇所（workflow_complete_sub内のcode_review完了時）
- C-3: testing→regression_test遷移時とregression_test→parallel_verification遷移時のtest-authenticity統合箇所（workflow_next内）

---

## 調査結果

### Critical Issue C-1: userIntentがsubagentプロンプトに含まれない問題

#### 現状の実装

**definitions.ts（line 860-946）:**
- `resolvePhaseGuide`関数は既にuserIntentをphaseGuideに含める実装が完了している（line 869, 894）
- TaskStateにuserIntentフィールドが定義されている（types.ts line 270）

**next.ts:**
- workflow_nextはphaseGuide情報を返却する（line 522-531）
- phaseGuideにはuserIntentが含まれている（resolvePhaseGuideで設定）

**問題点:**
- phaseGuide情報はworkflow_nextのレスポンスとして返却されるが、OrchestratorがこれをTask toolのプロンプトに埋め込むかどうかは技術的に強制されていない
- CLAUDE.mdには「workflow_statusでタスク情報（userIntent含む）を取得し、プロンプトに埋め込むこと」と記載されているが、これはAIへの指示であり技術的強制ではない

#### 根本原因

**技術的強制の欠如:**
- phaseGuideはworkflow_next/workflow_statusレスポンスに含まれるが、Orchestratorがこれを読み取るかどうかはAIの自律的判断に依存
- Task toolはMCP SDK外部のツールであり、MCP serverはTask toolのプロンプト内容を検査・制御できない

**設計上の制約:**
- MCP serverはワークフロー状態管理のみを担当
- Task toolのプロンプト生成はOrchestratorの責任範囲
- MCP serverがOrchestratorの動作を技術的に強制する手段がない

#### 解決策の方向性

**現実的なアプローチ:**
1. **phaseGuideの構造化拡充（既に実装済み）**: resolvePhaseGuideでuserIntentを含める（完了）
2. **workflow_statusレスポンスへのuserIntent明示（既に実装済み）**: StatusResult型にuserIntentフィールドあり（types.ts line 432）
3. **CLAUDE.mdの指示強化**: subagent起動テンプレートにuserIntent埋め込みの重要性を明記（既に記載あり）
4. **Post-hooksによる間接的検証**: Task tool実行後にphaseGuide成果物チェックでuserIntent関連キーワードの存在を検証（実装可能）

**技術的制約により不可能なアプローチ:**
- Pre-hooksでTask toolプロンプトの内容検証: Task tool実行前にプロンプト内容を取得する手段がない
- Task tool内部での強制: MCP serverの管轄外

---

### Critical Issue C-2: design-validatorの結果が強制されない問題

#### 現状の実装

**next.ts（line 288-304）:**
```typescript
// test_impl → implementation 遷移時
if (currentPhase === 'test_impl') {
  const docsDir = taskState.docsDir || taskState.workflowDir;
  const validationError = performDesignValidation(docsDir);
  if (validationError) {
    return validationError;
  }
}

// refactoring → parallel_quality 遷移時
if (currentPhase === 'refactoring') {
  const docsDir = taskState.docsDir || taskState.workflowDir;
  const validationError = performDesignValidation(docsDir);
  if (validationError) {
    return validationError;
  }
}
```

**design-validator.ts:**
- validateAll()メソッドが設計-実装整合性を検証
- spec.md, state-machine.mmd, flowchart.mmdから要求を抽出
- 実装コード内での存在をチェック
- スタブ検出機能あり（findStubsInContent）

**問題点:**
- code_reviewフェーズ完了時（workflow_complete_subでcode_review完了）にdesign-validator呼び出しがない
- parallel_quality→testing遷移時にcode_review承認チェックはあるが（next.ts line 477-485）、design-validator実行はない

#### 根本原因

**統合箇所の不足:**
- code_reviewサブフェーズ完了時にdesign-validatorを呼び出すロジックがcomplete-sub.ts内に存在しない
- code_reviewの成果物（code-review.md）品質チェックはあるが（complete-sub.ts line 88-120）、設計-実装整合性の自動検証がない

**レビュー承認とバリデーション実行の混同:**
- code_review承認チェックは存在する（next.ts line 479）
- しかし承認前の技術的バリデーションステップが欠落している

#### 解決策の統合ポイント

**統合箇所1: workflow_complete_sub（code_review完了時）**
- complete-sub.ts line 185-193の成果物品質チェック後にdesign-validatorを追加
- code_reviewサブフェーズ完了時に実装-設計整合性を検証
- 不整合がある場合は完了をブロック

**統合箇所2: workflow_next（parallel_quality→testing遷移時）**
- next.ts line 477-485のcode_review承認チェック前にdesign-validator実行を追加
- 承認前に技術的バリデーションを強制
- 整合性エラーがある場合は遷移をブロック

---

### Critical Issue C-3: test-authenticityが呼び出されない問題

#### 現状の実装

**test-authenticity.ts:**
- validateTestAuthenticity()が実装済み（line 26-137）
- テスト出力の最小文字数チェック（100文字以上）
- テストフレームワークパターン検出
- テスト数抽出と0件チェック
- タイムスタンプ整合性チェック
- validateTestExecutionTime()がテスト実行時間検証（line 149-164）
- recordTestOutputHash()がハッシュ記録と重複検出（line 176-192）

**問題点:**
- workflow_next内でtest-authenticity呼び出しが存在しない
- testing→regression_test遷移時にテスト真正性検証がない
- regression_test→parallel_verification遷移時にもチェックなし
- workflow_record_test_result内でのみ呼び出されている（next.tsのコード内には出現しない）

#### 根本原因

**統合ロジックの欠如:**
- next.ts line 213-244でtestingフェーズのテスト結果検証はあるが、test-authenticityは呼ばれていない
- next.ts line 247-286でregression_testフェーズのテスト結果検証はあるが、test-authenticityは呼ばれていない
- exitCodeとテスト数のチェックはあるが、真正性（テスト実行時間、出力パターン、ハッシュ重複）の検証がない

**validateTestAuthenticity統合の欠如:**
- workflow_record_test_result（別ツール）でのみvalidateTestAuthenticityが呼ばれる想定だが、workflow_nextでの二重チェックがない
- テスト結果が記録される前にフェーズ遷移できてしまう潜在的なリスク

#### 解決策の統合ポイント

**統合箇所1: workflow_next（testing→regression_test遷移時）**
- next.ts line 213-244のテスト結果検証箇所に追加
- getLatestTestResult()で取得したtestResultのoutputフィールドに対してvalidateTestAuthenticityを実行
- 真正性検証失敗時は遷移をブロック

**統合箇所2: workflow_next（regression_test→parallel_verification遷移時）**
- next.ts line 247-286のリグレッションテスト結果検証箇所に追加
- 同様にtestResult.outputに対してvalidateTestAuthenticityを実行
- 真正性検証失敗時は遷移をブロック

**統合すべきバリデーション項目:**
1. テスト出力の最小文字数（100文字以上）
2. テストフレームワークパターンの存在
3. テスト数の抽出と0件チェック
4. タイムスタンプ整合性（フェーズ開始時刻より後）
5. テスト出力ハッシュの重複チェック（既存testOutputHashesとの照合）

---

## 既存実装の分析

### workflow_next.ts（フェーズ遷移制御）

**主要な機能:**
- フェーズ遷移前の各種バリデーション実行
- 成果物品質チェック（line 306-314）
- 意味的整合性チェック（line 316-358）
- キーワードトレーサビリティ検証（line 360-384）
- スコープ事後検証（line 386-421）

**バリデーション統合パターン:**
```typescript
// 1. 条件判定でフェーズ特定
if (currentPhase === 'xxx') {
  // 2. バリデーター実行
  const validationResult = validateXxx(...);
  // 3. 失敗時はエラーメッセージを返して遷移ブロック
  if (!validationResult.passed) {
    return {
      success: false,
      message: validationResult.errors.join('\n'),
    };
  }
}
```

**C-2/C-3統合に適用できるパターン:**
- test_impl→implementation遷移時のdesign-validator統合（既存: line 288-295）
- testing→regression_test遷移時のtest-authenticity統合（新規追加箇所: line 213-244）

### workflow_complete_sub.ts（サブフェーズ完了制御）

**主要な機能:**
- サブフェーズ依存関係チェック（line 167-183）
- 成果物品質チェック（line 185-193）
- サブフェーズ状態更新

**バリデーション統合パターン:**
```typescript
// 成果物品質チェック後に追加のバリデーションを挿入
const artifactErrors = checkSubPhaseArtifacts(subPhaseName, docsDir);
if (artifactErrors.length > 0) {
  return { success: false, message: ... };
}

// ★ここに追加のバリデーション（design-validator等）を挿入可能
if (subPhaseName === 'code_review') {
  const designValidationResult = performDesignValidation(docsDir);
  if (designValidationResult) {
    return designValidationResult;
  }
}
```

**C-2統合に適用できるパターン:**
- code_reviewサブフェーズ完了時にdesign-validator実行（新規追加箇所: line 194付近）

### design-validator.ts（設計-実装整合性検証）

**検証項目:**
1. ワークフローディレクトリ存在チェック（line 417-429）
2. 設計書ファイル存在チェック（spec.md, state-machine.mmd, flowchart.mmd）（line 431-458）
3. spec.mdからの項目抽出と検証（line 461-465）
4. state-machine.mmdからの項目抽出と検証（line 468-472）
5. flowchart.mmdからの項目抽出と検証（line 475-479）
6. スコープファイル内のスタブ検出（line 482-503）
7. セマンティック検証（状態名/ノード名の実装コード内検索）（line 505-525）

**統合時の注意点:**
- docsDir引数が必要（taskState.docsDir || taskState.workflowDir）
- ValidationResult型を返す（passed: boolean, missingItems, warnings）
- formatValidationError()でメッセージ整形可能

### test-authenticity.ts（テスト真正性検証）

**検証項目:**
1. テスト出力の最小文字数チェック（100文字以上）（line 31-39）
2. テスト出力パターンチェック（構造的フレーズ検出）（line 41-56）
3. テストフレームワークパターンチェック＆テスト数抽出（line 59-86）
4. テスト数0件チェック（line 114-121）
5. タイムスタンプ整合性チェック（line 123-133）
6. テスト実行時間検証（100ms未満はエラー）（line 149-164）
7. テスト出力ハッシュ記録と重複検出（line 176-192）

**統合時の注意点:**
- validateTestAuthenticity()の引数: output（string）, exitCode（number）, phaseStartedAt（string ISO 8601）
- TestAuthenticityResult型を返す（valid: boolean, reason?: string）
- recordTestOutputHash()はexistingHashesが必要（taskState.testOutputHashes || []）

### definitions.ts（フェーズガイド定義）

**PHASE_GUIDES構造（line 536-851）:**
- 各フェーズの詳細情報を構造化データとして保持
- inputFileMetadata: 入力ファイルの重要度と読み込みモード（line 662-666, 688-693等）
- userIntent: タスク開始時のユーザー意図（resolvePhaseGuideで設定、line 869）
- requiredSections, outputFile, allowedBashCategories等

**resolvePhaseGuide関数（line 860-946）:**
- phaseGuide取得とプレースホルダー解決
- userIntentの伝播（line 869, 894）
- CLAUDE.md分割配信統合（line 918-943）
- サブフェーズへのuserIntent伝播（line 894）

**C-1対応状況:**
- userIntent伝播の実装は完了している
- phaseGuide構造にuserIntentフィールドが含まれている
- workflow_statusレスポンスにuserIntentが含まれている（types.ts line 432）

### types.ts（型定義）

**PhaseGuide型（line 371-402）:**
- inputFileMetadata: InputFileMetadata[]（重要度・読み込みモード含む）（line 384）
- userIntent?: string（line 401）

**StatusResult型（line 409-438）:**
- userIntent?: string（line 432）
- phaseGuide?: PhaseGuide（line 437）

**TaskState型（line 190-311）:**
- userIntent?: string（line 270）
- testOutputHashes?: string[]（line 251）
- testResults?: Array<...>（line 230-246）

**統合に必要な型は全て定義済み:**
- C-1: userIntent伝播に必要な型フィールドは完備
- C-2: ValidationResult型はdesign-validator.tsで定義
- C-3: TestAuthenticityResult型はtest-authenticity.tsで定義

---

## 統合実装計画の概要

### C-1: userIntent伝播の技術的強制

**現状の完了項目:**
1. resolvePhaseGuideでuserIntentをphaseGuideに設定（definitions.ts line 869）
2. StatusResult型にuserIntentフィールド定義（types.ts line 432）
3. CLAUDE.mdにsubagent起動テンプレートでuserIntent埋め込みの指示記載

**追加実装項目（requirements/planningフェーズで検討）:**
1. Post-hooks拡張: Task tool実行後にphaseGuide成果物内でuserIntent関連キーワード存在チェック
2. CLAUDE.mdのsubagent起動テンプレートをより明確化（既に記載あり、強調のみ）
3. workflow_statusレスポンスメッセージにuserIntent重要性を明示

**技術的制約:**
- Task toolプロンプトの事前検証は不可能（MCP serverの管轄外）
- 間接的な検証（成果物チェック）のみ実現可能

### C-2: design-validator統合

**統合箇所1: workflow_complete_sub（code_review完了時）**
- ファイル: complete-sub.ts
- 挿入位置: line 194付近（成果物品質チェック後）
- 条件: `subPhaseName === 'code_review'`
- 処理: performDesignValidation(docsDir)実行、失敗時は完了ブロック

**統合箇所2: workflow_next（parallel_quality→testing遷移時）**
- 対象ファイル: next.ts（フェーズ遷移制御）
- 挿入位置: line 477付近（code_review承認チェック前）
- 条件: `currentPhase === 'parallel_quality' && nextPhase === 'testing'`
- 処理: performDesignValidation(docsDir)実行、失敗時は遷移ブロック

**既存実装の再利用:**
- performDesignValidation()関数（next.ts line 107-119）を共通化して使用
- DesignValidator, formatValidationError（design-validator.ts）をインポート

### C-3: test-authenticity統合

**統合箇所1: workflow_next（testing→regression_test遷移時）**
- 変更対象: next.tsのtestingフェーズ遷移ロジック
- 挿入位置: line 227付近（exitCodeチェック後）
- 実行内容:
  1. testResult.outputからvalidateTestAuthenticity()実行
  2. phaseStartedAtはtaskState.historyから取得
  3. testOutputHashesとの重複チェック（recordTestOutputHash()）
  4. 失敗時は遷移ブロック

**統合箇所2: workflow_next（regression_test→parallel_verification遷移時）**
- 変更対象: next.tsのregression_testフェーズ遷移ロジック
- 挿入位置: line 260付近（exitCodeチェック後）
- 実行内容: testing遷移と同様のvalidateTestAuthenticity検証を適用

**既存実装の利用:**
- validateTestAuthenticity(), recordTestOutputHash()（test-authenticity.ts）をインポート
- taskState.testOutputHashes配列との照合

---

## 技術的課題と制約事項

### C-1: userIntent伝播の技術的限界

**制約1: Task toolプロンプトの事前検証不可**
- MCPプロトコルにはPre-hooksでTask toolのプロンプト内容を取得する仕組みがない
- MCP serverはTask tool実行前にプロンプトを検査できない
- Claude Code CLIがTask toolを提供しているが、MCP serverの管轄外

**制約2: Orchestratorの自律性**
- ワークフロープラグインの設計思想はOrchestratorパターン
- Main Claude（Orchestrator）の役割はタスク分配とフェーズ制御
- subagent起動時のプロンプト生成はOrchestratorの裁量範囲
- MCPサーバーがOrchestratorの動作を技術的に強制する手段がない

**可能なアプローチ:**
- Post-hooks: Task tool実行後に成果物内でuserIntent言及の有無をチェック
- 間接的検証: 成果物がuserIntentに言及しているかを自然言語処理で検証
- メッセージ強化: workflow_statusレスポンスメッセージでuserIntent重要性を明示

### C-2/C-3: バリデーター統合の技術的課題

**課題1: パフォーマンスへの影響**
- design-validatorはAST解析を含むため実行時間がかかる可能性
- LRUキャッシュ実装済み（design-validator.ts line 45-102）だが、初回実行は遅い
- タイムアウト設定: VALIDATION_TIMEOUT_MS（デフォルト10秒、artifact-validator.ts line 22）

**課題2: エラーメッセージの品質**
- バリデーション失敗時のエラーメッセージがOrchestratorに表示される
- Orchestratorが適切に解釈・対応できるメッセージ設計が重要
- formatValidationError()（design-validator.ts line 889-923）が詳細メッセージを生成

**課題3: 既存ワークフローへの影響**
- 新しいバリデーションルールが既存プロジェクトに影響する可能性
- 環境変数による緩和モード（SEMANTIC_CHECK_STRICT=false等）の検討
- 段階的ロールアウトの戦略が必要

---

## 推奨アプローチとトレードオフ

### C-1: userIntent伝播

**推奨アプローチ: 構造化データ拡充 + 間接的検証**

**メリット:**
- 技術的制約の範囲内で実現可能
- 既存実装（resolvePhaseGuide）を活用
- Post-hooksで部分的な検証が可能

**デメリット:**
- 完全な技術的強制は不可能
- AIの自律的判断に一部依存
- 間接的検証の精度に限界

**実装コスト: Low（既存実装が大部分完了）**

### C-2: design-validator統合

**推奨アプローチ: workflow_complete_sub（code_review）とworkflow_next（parallel_quality→testing）に統合**

**メリット:**
- 設計-実装不整合を技術的にブロック可能
- 既存のperformDesignValidation()関数を再利用
- code_reviewフェーズの品質が向上

**デメリット:**
- AST解析によるパフォーマンス影響（LRUキャッシュで緩和）
- エラー発生時のデバッグが複雑化
- 既存プロジェクトへの影響

**実装コスト: Medium（統合ポイント2箇所、テスト必要）**

### C-3: test-authenticity統合

**推奨アプローチ: workflow_next（testing/regression_test遷移時）に統合**

**メリット:**
- テスト捏造を技術的にブロック可能
- 既存のvalidateTestAuthenticity()関数を再利用
- テスト品質の信頼性が向上

**デメリット:**
- テスト出力のフォーマット依存性（フレームワークパターン検出）
- カスタムテストランナーでの誤検出リスク（N-3対応済み）
- ハッシュ重複検出の永続化コスト

**実装コスト: Medium（統合ポイント2箇所、テスト必要）**

---

## 次フェーズへの引き継ぎ事項

### requirementsフェーズで決定すべき事項

1. **C-1のアプローチ選定:**
   - Post-hooks拡張の採用可否
   - 間接的検証の具体的な方法（キーワード検出 vs. 自然言語処理）
   - CLAUDE.mdのメッセージ強化の具体的内容

2. **C-2/C-3の統合スコープ:**
   - 統合対象フェーズの最終確定
   - エラーハンドリング戦略（厳格モード vs. 警告モード）
   - 環境変数による緩和オプションの要否

3. **パフォーマンス要件:**
   - バリデーション実行時間の上限
   - キャッシュ戦略（LRU, TTL）
   - タイムアウト設定

4. **後方互換性:**
   - 既存ワークフローへの影響範囲
   - 段階的ロールアウト計画
   - 移行ガイドの必要性

### planningフェーズで設計すべき事項

1. **C-2統合の詳細設計:**
   - complete-sub.ts修正箇所の具体的なコード
   - next.ts修正箇所の具体的なコード
   - エラーメッセージのフォーマット

2. **C-3統合の詳細設計:**
   - next.ts修正箇所の具体的なコード（2箇所）
   - testOutputHashes配列の管理方法
   - phaseStartedAt取得ロジック

3. **共通設計:**
   - バリデーション失敗時のエラーレスポンス構造
   - 監査ログ記録の要否
   - テスト戦略（単体テスト、統合テスト）

---

## 参考資料

### 関連ファイルパス

| カテゴリ | ファイルパス |
|---------|------------|
| フェーズ遷移制御 | `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\next.ts` |
| サブフェーズ完了制御 | `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\complete-sub.ts` |
| 設計整合性検証 | `C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\design-validator.ts` |
| テスト真正性検証 | `C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\test-authenticity.ts` |
| 成果物品質検証 | `C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\artifact-validator.ts` |
| フェーズ定義 | `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts` |
| 型定義 | `C:\ツール\Workflow\workflow-plugin\mcp-server\src\state\types.ts` |

### 既存のバリデーション統合例

1. **artifact-validator統合（next.ts line 306-314）:**
   - PHASE_ARTIFACT_REQUIREMENTSによる品質チェック
   - checkPhaseArtifacts()による成果物検証

2. **semantic-checker統合（next.ts line 316-358）:**
   - validateSemanticConsistency()による意味的整合性チェック
   - SEMANTIC_CHECK_STRICT環境変数による厳格モード制御

3. **scope-validator統合（next.ts line 386-421）:**
   - validateScopePostExecution()によるスコープ外変更検出
   - SCOPE_STRICT環境変数による警告モード

### 環境変数の既存パターン

| 環境変数 | デフォルト | 用途 |
|---------|-----------|------|
| SEMANTIC_CHECK_STRICT | true | 意味的整合性チェックの厳格モード |
| SCOPE_STRICT | true | スコープ検証の厳格モード |
| VALIDATION_TIMEOUT_MS | 10000 | バリデーションタイムアウト（ms） |
| AST_CACHE_MAX_ENTRIES | 100 | AST解析キャッシュの最大エントリ数 |
| MIN_SECTION_DENSITY | 0.3 | セクション密度の最小閾値 |

---

## 調査結論

本調査により、C-1/C-2/C-3の現状実装と統合ポイントを特定した。
C-1はMCPサーバーの管轄外であるTask toolプロンプトに対する技術的強制が不可能という制約があるため、phaseGuide構造化データの拡充と間接的検証を組み合わせるアプローチが最も現実的である。
C-2はdesign-validator.tsの既存実装をcomplete-sub.ts（code_review完了時）とnext.ts（parallel_quality→testing遷移時）に統合することで、設計-実装不整合の技術的ブロックが実現可能である。
C-3はtest-authenticity.tsの既存実装をnext.ts（testing→regression_test遷移時、regression_test→parallel_verification遷移時）に統合することで、テスト形骸化の技術的ブロックが実現可能である。
次フェーズ（requirements）では、各Issueの解決アプローチを要件として定義し、受入条件を明確化する。
