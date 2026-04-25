# requirementsフェーズ成果物

## サマリー

本ドキュメントは、ワークフロープラグインのレビューで指摘された3つのCritical Issues（C-1, C-2, C-3）を根本的に解決するための要件定義である。

**対象Issue:**
- **C-1**: userIntentがsubagentプロンプトに含まれない問題（技術的強制の欠如）
- **C-2**: design-validatorがcode_reviewフェーズで呼び出されない問題（未実装アイテムの通過）
- **C-3**: test-authenticityがワークフロー遷移時に呼び出されない問題（形骸化テストの通過）

**要件の概要:**
1. **FR-1**: userIntent伝播の強化（phaseGuideレスポンスメッセージへの明示化、CLAUDE.md指示の強化）
2. **FR-2**: design-validatorのcode_review統合（workflow_complete_sub、workflow_next両方での検証）
3. **FR-3**: test-authenticityのworkflow_next統合（testing/regression_test遷移時の検証）
4. **NFR-1**: パフォーマンス要件（各バリデーション50ms以内、フック全体100ms以内）
5. **NFR-2**: 後方互換性（環境変数による緩和モード提供）
6. **NFR-3**: エラーメッセージ品質（Orchestratorが対応可能な具体的ガイダンス）

**主要な設計判断:**
- C-1は技術的制約によりTask toolプロンプトの事前検証が不可能なため、間接的アプローチ（レスポンスメッセージ強化、CLAUDE.md指示明確化）を採用する
- C-2/C-3は既存バリデーター実装を活用し、ワークフロー遷移制御ロジック（next.ts、complete-sub.ts）に統合する
- 全てのバリデーションに環境変数による厳格モード/警告モードの切り替えを提供する

**次フェーズで必要な情報:**
- parallel_analysisフェーズ: 脅威モデリング（新しいバリデーションによるセキュリティ影響評価）とplanning（詳細設計）
- parallel_designフェーズ: 状態遷移図（バリデーション統合後のフローチャート）、フローチャート（エラーハンドリング分岐）
- test_designフェーズ: 各バリデーションの単体テスト設計、統合テストシナリオ

---

## 機能要件

### FR-1: userIntent伝播の強化（C-1対応）

#### FR-1.1: phaseGuideレスポンスメッセージの拡充

**背景:**
- resolvePhaseGuide関数は既にuserIntentをphaseGuideに含める実装が完了している（definitions.ts line 869）
- workflow_statusレスポンスにもuserIntentフィールドが含まれている（types.ts line 432）
- しかし、Orchestratorがこれを読み取ってTask toolプロンプトに埋め込むかどうかは技術的に強制されていない

**要件:**
- workflow_next/workflow_statusのレスポンスメッセージ本文に、userIntentの重要性を明示的に記載する
- 具体的には「このフェーズのsubagentプロンプトには必ずuserIntent『{実際のuserIntent}』を含めてください」という文言を追加する
- phaseGuideオブジェクト内のsubagentTemplateフィールドに、userIntentプレースホルダー `{{userIntent}}` を含むテンプレートを追加する
- Orchestratorがこのテンプレートを使用することで、userIntent埋め込みを自然に実行できるようにする

**実装箇所:**
- `workflow-plugin/mcp-server/src/tools/next.ts` (workflow_next関数のレスポンスメッセージ生成部分)
- `workflow-plugin/mcp-server/src/tools/status.ts` (workflow_status関数のレスポンスメッセージ生成部分)
- `workflow-plugin/mcp-server/src/phases/definitions.ts` (PHASE_GUIDES定義のsubagentTemplateフィールド)

**受入基準:**
- AC-1.1.1: workflow_nextレスポンスメッセージに「userIntent『{実際の値}』を含めてください」という文言が含まれる
- AC-1.1.2: workflow_statusレスポンスメッセージにも同様の文言が含まれる
- AC-1.1.3: phaseGuide.subagentTemplateに `{{userIntent}}` プレースホルダーが含まれる
- AC-1.1.4: resolvePhaseGuide関数で `{{userIntent}}` が実際の値に置換される

#### FR-1.2: CLAUDE.mdのsubagent起動テンプレート強化

**背景:**
- CLAUDE.mdには既にsubagent起動テンプレートが記載されている
- しかし「userIntentを埋め込むこと」の重要性が十分に強調されていない可能性がある

**要件:**
- CLAUDE.mdの「subagentによるフェーズ実行」セクションに、userIntent埋め込みの必須性を強調する記述を追加する
- subagent起動テンプレートの「## タスク情報」セクションに「ユーザー意図: {userIntent}」の行を必須項目として明記する
- 「★重要★ userIntentを必ずプロンプトに含めること」という警告文を追加する

**実装箇所:**
- `C:\ツール\Workflow\CLAUDE.md` (subagentによるフェーズ実行セクション)

**受入基準:**
- AC-1.2.1: CLAUDE.mdのsubagent起動テンプレートに「ユーザー意図: {userIntent}」が必須項目として記載される
- AC-1.2.2: 「★重要★ userIntentを必ずプロンプトに含めること」という警告文が追加される
- AC-1.2.3: 警告文の配置場所が視認性の高い位置（テンプレート直前）である

#### FR-1.3: phaseGuideテンプレート構造化

**背景:**
- phaseGuideにはinputFileMetadata、requiredSections等の構造化データが含まれる
- subagent起動テンプレートの一部をphaseGuideに含めることで、Orchestratorのテンプレート生成を支援できる

**要件:**
- PhaseGuide型にsubagentTemplateフィールドを追加する（オプション）
- subagentTemplateには以下のプレースホルダーを含むテンプレート文字列を設定する:
  - `{{taskName}}`: タスク名
  - `{{userIntent}}`: ユーザー意図
  - `{{docsDir}}`: ドキュメントディレクトリ
  - `{{inputFiles}}`: 入力ファイルリスト（inputFileMetadataから生成）
  - `{{outputFile}}`: 出力ファイルパス
- resolvePhaseGuide関数でこれらのプレースホルダーを実際の値に置換する

**実装箇所:**
- `workflow-plugin/mcp-server/src/state/types.ts` (PhaseGuide型定義)
- `workflow-plugin/mcp-server/src/phases/definitions.ts` (PHASE_GUIDES定義、resolvePhaseGuide関数)

**受入基準:**
- AC-1.3.1: PhaseGuide型にsubagentTemplate?: stringフィールドが追加される
- AC-1.3.2: PHASE_GUIDESの各フェーズにsubagentTemplateが定義される（空文字でも可）
- AC-1.3.3: resolvePhaseGuide関数で全てのプレースホルダーが置換される
- AC-1.3.4: 置換後のsubagentTemplateがworkflow_nextレスポンスのphaseGuideに含まれる

#### FR-1.4: 技術的制約の文書化

**背景:**
- C-1は技術的にTask toolプロンプトの事前検証が不可能という制約がある
- この制約をドキュメント化し、今後の開発者が同じ問題にぶつからないようにする

**要件:**
- ワークフロープラグインのアーキテクチャドキュメント（新規作成）に以下を記載する:
  - MCPサーバーがTask toolプロンプトを事前検証できない理由
  - Orchestratorパターンの設計思想（subagent起動はOrchestratorの責任）
  - userIntent伝播のアプローチ（構造化データ + レスポンスメッセージ強化）
  - 技術的限界と今後の改善可能性

**実装箇所:**
- `docs/architecture/workflow-plugin-constraints.md`（新規ファイル）

**受入基準:**
- AC-1.4.1: アーキテクチャドキュメントが作成される
- AC-1.4.2: Task tool事前検証不可の技術的理由が明記される
- AC-1.4.3: Orchestratorパターンの責任範囲が明記される
- AC-1.4.4: userIntent伝播のアプローチが図解される（オプション）

### FR-2: design-validatorのcode_review統合（C-2対応）

#### FR-2.1: workflow_complete_sub内でのdesign-validator統合

**背景:**
- code_reviewサブフェーズ完了時に設計-実装整合性が検証されていない
- complete-sub.ts line 185-193で成果物品質チェックは行われるが、design-validatorは呼ばれない
- この結果、未実装項目があってもcode_reviewが完了してしまう

**要件:**
- workflow_complete_sub関数でcode_reviewサブフェーズ完了時にdesign-validatorを実行する
- 実行タイミング: 成果物品質チェック（checkSubPhaseArtifacts）成功後
- 検証項目:
  - spec.mdの全項目が実装されているか
  - state-machine.mmdの全状態遷移が実装されているか
  - flowchart.mmdの全ノード/フローが実装されているか
  - スコープ内ファイルにスタブ（TODOコメント等）が残っていないか
- 検証失敗時の挙動: code_review完了をブロックし、エラーメッセージを返す
- 環境変数 `DESIGN_VALIDATION_STRICT` でstrict/warnモードを切り替え可能にする

**実装箇所:**
- `workflow-plugin/mcp-server/src/tools/complete-sub.ts` (workflow_complete_sub関数、line 194付近)

**受入基準:**
- AC-2.1.1: code_reviewサブフェーズ完了時にperformDesignValidation()が呼び出される
- AC-2.1.2: 検証失敗時に `{success: false, message: "設計-実装不整合エラー"}` が返される
- AC-2.1.3: DESIGN_VALIDATION_STRICT=false時はwarning扱いで完了が許可される
- AC-2.1.4: エラーメッセージに未実装項目リストが含まれる（formatValidationError使用）
- AC-2.1.5: 検証成功時はパフォーマンスへの影響が50ms以内（LRUキャッシュ利用）

#### FR-2.2: workflow_next内でのdesign-validator統合

**背景:**
- parallel_quality→testing遷移時にcode_review承認チェックは行われる（next.ts line 477-485）
- しかし、承認前に技術的バリデーションが実行されていない
- この結果、承認だけで遷移が可能となり、設計-実装不整合が検出されない

**要件:**
- workflow_next関数でparallel_quality→testing遷移時にdesign-validatorを実行する
- 実行タイミング: code_review承認チェック前
- 検証項目: FR-2.1と同じ
- 検証失敗時の挙動: testing遷移をブロックし、エラーメッセージを返す
- 環境変数 `DESIGN_VALIDATION_STRICT` に従う

**実装箇所:**
- `workflow-plugin/mcp-server/src/tools/next.ts` (workflow_next関数、line 477付近)

**受入基準:**
- AC-2.2.1: parallel_quality→testing遷移時にperformDesignValidation()が呼び出される
- AC-2.2.2: 検証失敗時に遷移がブロックされる
- AC-2.2.3: code_review承認チェック前に実行される（順序保証）
- AC-2.2.4: DESIGN_VALIDATION_STRICT=false時は警告のみで遷移が許可される
- AC-2.2.5: 検証結果がログに記録される（監査証跡）

#### FR-2.3: design-validator環境変数の導入

**背景:**
- 既存のSEMENTIC_CHECK_STRICT、SCOPE_STRICTと同様に、design-validatorにも緩和モードが必要

**要件:**
- 環境変数 `DESIGN_VALIDATION_STRICT` を導入する
- デフォルト値: true（厳格モード）
- false時の挙動: 検証失敗をwarningとして記録し、遷移/完了を許可する
- warning時のメッセージ: 「[警告] 設計-実装不整合が検出されましたが、DESIGN_VALIDATION_STRICT=falseのため続行します」

**実装箇所:**
- `workflow-plugin/mcp-server/src/validation/design-validator.ts`（既存のperformDesignValidation関数を拡張）
- `workflow-plugin/mcp-server/src/tools/next.ts`
- `workflow-plugin/mcp-server/src/tools/complete-sub.ts`

**受入基準:**
- AC-2.3.1: process.env.DESIGN_VALIDATION_STRICT が読み込まれる
- AC-2.3.2: デフォルト値がtrueである
- AC-2.3.3: false時は検証失敗でも遷移/完了が許可される
- AC-2.3.4: warning時のメッセージが適切に表示される
- AC-2.3.5: 環境変数の説明がREADMEに追加される

#### FR-2.4: performDesignValidation関数の共通化

**背景:**
- next.ts line 107-119にperformDesignValidation()ローカル関数が定義されている
- FR-2.1/FR-2.2で同じ関数をcomplete-sub.tsでも使用する必要がある
- コード重複を避けるため、共通関数として抽出する

**要件:**
- performDesignValidation関数を共通ユーティリティとして抽出する
- 引数: docsDir（string）、strict（boolean、デフォルトtrue）
- 戻り値: { success: false, message: string } | null（nullは成功）
- 内部でDesignValidatorインスタンスを生成し、validateAll()を実行する
- DESIGN_VALIDATION_STRICT環境変数を読み込み、strict引数に反映する

**実装箇所:**
- `workflow-plugin/mcp-server/src/validation/design-validator.ts`（関数追加）
- `workflow-plugin/mcp-server/src/tools/next.ts`（既存関数を削除し、インポートに変更）
- `workflow-plugin/mcp-server/src/tools/complete-sub.ts`（インポートして使用）

**受入基準:**
- AC-2.4.1: design-validator.tsにperformDesignValidation()が追加される
- AC-2.4.2: next.tsのローカル関数が削除され、インポートに置き換えられる
- AC-2.4.3: complete-sub.tsで同じ関数がインポートされる
- AC-2.4.4: 既存のtest_impl→implementation、refactoring→parallel_quality遷移時の動作が変わらない（回帰テスト）

### FR-3: test-authenticityのworkflow_next統合（C-3対応）

#### FR-3.1: testing→regression_test遷移時のtest-authenticity統合

**背景:**
- testing→regression_test遷移時にexitCodeとテスト数のチェックはある（next.ts line 213-244）
- しかし、テスト真正性（実行時間、出力パターン、ハッシュ重複）の検証がない
- この結果、形骸化されたテスト出力でも遷移が可能となる

**要件:**
- workflow_next関数でtesting→regression_test遷移時にtest-authenticityバリデーションを実行する
- 実行タイミング: exitCodeチェック成功後（line 227付近）
- 検証項目:
  - テスト出力の最小文字数（100文字以上）
  - テストフレームワークパターンの存在（vitest, jest, playwright等）
  - テスト数の抽出と0件チェック
  - タイムスタンプ整合性（フェーズ開始時刻より後）
  - テスト出力ハッシュの重複チェック（既存testOutputHashesとの照合）
- 検証失敗時の挙動: regression_test遷移をブロックし、エラーメッセージを返す
- 環境変数 `TEST_AUTHENTICITY_STRICT` でstrict/warnモードを切り替え可能にする

**実装箇所:**
- `workflow-plugin/mcp-server/src/tools/next.ts` (workflow_next関数、line 227付近)

**受入基準:**
- AC-3.1.1: testing→regression_test遷移時にvalidateTestAuthenticity()が呼び出される
- AC-3.1.2: testResult.outputが引数として渡される
- AC-3.1.3: phaseStartedAtがtaskState.historyから正しく取得される
- AC-3.1.4: 検証失敗時に遷移がブロックされる
- AC-3.1.5: recordTestOutputHash()が呼び出され、ハッシュ重複時にエラーが返される
- AC-3.1.6: TEST_AUTHENTICITY_STRICT=false時は警告のみで遷移が許可される

#### FR-3.2: regression_test→parallel_verification遷移時のtest-authenticity統合

**背景:**
- regression_test→parallel_verification遷移時も同様にテスト真正性検証が必要
- リグレッションテストの品質を担保する必要がある

**要件:**
- workflow_next関数でregression_test→parallel_verification遷移時にtest-authenticityバリデーションを実行する
- 実行タイミング: exitCodeチェック成功後（line 260付近）
- 検証項目: FR-3.1と同じ
- 検証失敗時の挙動: parallel_verification遷移をブロックし、エラーメッセージを返す
- 環境変数 `TEST_AUTHENTICITY_STRICT` に従う

**実装箇所:**
- `workflow-plugin/mcp-server/src/tools/next.ts` (workflow_next関数、line 260付近)

**受入基準:**
- AC-3.2.1: regression_test→parallel_verification遷移時にvalidateTestAuthenticity()が呼び出される
- AC-3.2.2: testResult.outputが引数として渡される
- AC-3.2.3: phaseStartedAtがtaskState.historyから正しく取得される
- AC-3.2.4: 検証失敗時に遷移がブロックされる
- AC-3.2.5: recordTestOutputHash()が呼び出され、ハッシュ重複がチェックされる
- AC-3.2.6: TEST_AUTHENTICITY_STRICT=false時は警告のみで遷移が許可される

#### FR-3.3: test-authenticity環境変数の導入

**背景:**
- design-validatorと同様に、test-authenticityにも緩和モードが必要
- 特にカスタムテストランナーを使用するプロジェクトでの誤検出を防ぐ

**要件:**
- 環境変数 `TEST_AUTHENTICITY_STRICT` を導入する
- デフォルト値: true（厳格モード）
- false時の挙動: 検証失敗をwarningとして記録し、遷移を許可する
- warning時のメッセージ: 「[警告] テスト真正性検証に失敗しましたが、TEST_AUTHENTICITY_STRICT=falseのため続行します」

**実装箇所:**
- `workflow-plugin/mcp-server/src/validation/test-authenticity.ts`（既存のvalidateTestAuthenticity関数を拡張）
- `workflow-plugin/mcp-server/src/tools/next.ts`

**受入基準:**
- AC-3.3.1: process.env.TEST_AUTHENTICITY_STRICT が読み込まれる
- AC-3.3.2: デフォルト値がtrueである
- AC-3.3.3: false時は検証失敗でも遷移が許可される
- AC-3.3.4: warning時のメッセージが適切に表示される
- AC-3.3.5: 環境変数の説明がREADMEに追加される

#### FR-3.4: phaseStartedAt取得ロジックの実装

**背景:**
- validateTestAuthenticity()はphaseStartedAtパラメータを必要とする
- taskState.historyからフェーズ開始時刻を取得する必要がある

**要件:**
- taskState.historyから現在フェーズの開始時刻を取得するヘルパー関数を実装する
- 関数名: getPhaseStartedAt(history: PhaseHistoryEntry[], phaseName: string): string | null
- 戻り値: ISO 8601形式のタイムスタンプ文字列、または存在しない場合はnull
- historyを逆順で検索し、最も新しいstartedAtを返す

**実装箇所:**
- `workflow-plugin/mcp-server/src/state/stateManager.ts`（ヘルパー関数追加）
- `workflow-plugin/mcp-server/src/tools/next.ts`（使用箇所）

**受入基準:**
- AC-3.4.1: getPhaseStartedAt()関数が実装される
- AC-3.4.2: historyが空の場合はnullを返す
- AC-3.4.3: 該当フェーズが存在しない場合はnullを返す
- AC-3.4.4: 最も新しいstartedAtが返される（複数回フェーズ実行時）
- AC-3.4.5: 単体テストが作成される

#### FR-3.5: testOutputHashes配列の管理

**背景:**
- recordTestOutputHash()はexistingHashesパラメータを必要とする
- taskState.testOutputHashesを参照し、重複チェック後に更新する必要がある

**要件:**
- workflow_next内でtestOutputHashesを取得し、recordTestOutputHash()に渡す
- 重複が検出された場合はエラーメッセージを返す
- 重複がない場合はtaskStateにハッシュを追加する
- testOutputHashesの最大保持数を100個に制限する（古いものから削除）

**実装箇所:**
- `workflow-plugin/mcp-server/src/tools/next.ts` (workflow_next関数)
- `workflow-plugin/mcp-server/src/state/stateManager.ts` (updateTestOutputHashes関数追加)

**受入基準:**
- AC-3.5.1: taskState.testOutputHashes || [] が取得される
- AC-3.5.2: recordTestOutputHash()の戻り値（isDuplicate）がチェックされる
- AC-3.5.3: 重複時はエラーメッセージ「テスト出力が以前と同一です（コピペの可能性）」が返される
- AC-3.5.4: 重複なしの場合は新しいハッシュがtaskStateに追加される
- AC-3.5.5: testOutputHashesが100個を超える場合は古いものが削除される

---

## 非機能要件

### NFR-1: パフォーマンス要件

#### NFR-1.1: バリデーション実行時間

**要件:**
- 各バリデーション（design-validator、test-authenticity）の実行時間は50ms以内とする
- design-validatorはAST解析を含むため、LRUキャッシュを活用する
- キャッシュヒット時は10ms以内を目標とする
- test-authenticityは正規表現マッチングのため、通常20ms以内で完了する

**測定方法:**
- 各バリデーション実行前後にperformance.now()でタイムスタンプを取得
- 実行時間をログに記録する（DEBUG_PERFORMANCEモード）
- 50msを超えた場合は警告ログを出力する

**受入基準:**
- AC-NFR-1.1.1: キャッシュヒット時のdesign-validator実行時間が10ms以内
- AC-NFR-1.1.2: キャッシュミス時のdesign-validator実行時間が50ms以内
- AC-NFR-1.1.3: test-authenticity実行時間が20ms以内
- AC-NFR-1.1.4: パフォーマンス計測ログが出力される（環境変数制御）

#### NFR-1.2: フック全体の応答時間

**要件:**
- ワークフロー遷移全体（workflow_next、workflow_complete_sub）の応答時間は100ms以内とする
- バリデーション以外の処理（状態更新、HMAC生成等）も含む
- 100msを超えた場合は警告ログを出力する

**測定方法:**
- workflow_next/workflow_complete_subの開始時と終了時にタイムスタンプを取得
- 実行時間をログに記録する

**受入基準:**
- AC-NFR-1.2.1: workflow_next全体の実行時間が100ms以内（95パーセンタイル）
- AC-NFR-1.2.2: workflow_complete_sub全体の実行時間が100ms以内（95パーセンタイル）
- AC-NFR-1.2.3: 100ms超過時に警告ログが出力される
- AC-NFR-1.2.4: パフォーマンスベンチマークテストが作成される

#### NFR-1.3: キャッシュ戦略

**要件:**
- design-validatorのLRUキャッシュサイズは100エントリとする
- キャッシュTTLは設定しない（ファイル変更検出による無効化のみ）
- キャッシュヒット率が80%以上を目標とする

**測定方法:**
- キャッシュヒット/ミスの回数をカウントする
- ワークフロー完了時にキャッシュ統計をログに出力する

**受入基準:**
- AC-NFR-1.3.1: LRUキャッシュサイズが100エントリである
- AC-NFR-1.3.2: キャッシュヒット率が80%以上（10回以上の遷移で測定）
- AC-NFR-1.3.3: キャッシュ統計ログが出力される
- AC-NFR-1.3.4: 環境変数でキャッシュサイズを変更可能

### NFR-2: 後方互換性

#### NFR-2.1: 既存ワークフローへの影響回避

**要件:**
- 新しいバリデーションルールが既存プロジェクトに悪影響を与えないようにする
- 環境変数によるオプトアウト機能を提供する
- デフォルトは厳格モード（strict=true）とするが、警告モードへの切り替えが容易である

**環境変数:**
- `DESIGN_VALIDATION_STRICT`: design-validatorの厳格モード切り替え（デフォルト: true）
- `TEST_AUTHENTICITY_STRICT`: test-authenticityの厳格モード切り替え（デフォルト: true）
- `VALIDATION_WARNINGS_ONLY`: 全てのバリデーションを警告モードにする（デフォルト: false）

**受入基準:**
- AC-NFR-2.1.1: 既存ワークフロー（統合前に作成）で新しいバリデーションがブロックしない（環境変数設定時）
- AC-NFR-2.1.2: 環境変数VALIDATION_WARNINGS_ONLY=trueで全てのバリデーションが警告モードになる
- AC-NFR-2.1.3: 警告モード時もログに検証結果が記録される
- AC-NFR-2.1.4: README.mdに環境変数の説明が追加される

#### NFR-2.2: 段階的ロールアウト

**要件:**
- 新しいバリデーションルールを段階的に有効化できるようにする
- フェーズごとに有効化/無効化を切り替えられる（将来対応）
- バージョン管理されたバリデーションルールセット（将来対応）

**実装スコープ:**
- 本タスクでは環境変数による一括制御のみ実装する
- フェーズごとの細かい制御は将来の拡張として設計を検討する

**受入基準:**
- AC-NFR-2.2.1: 環境変数で全バリデーションの有効/無効を切り替え可能
- AC-NFR-2.2.2: 段階的ロールアウトの設計案がアーキテクチャドキュメントに記載される（将来対応）
- AC-NFR-2.2.3: バージョン管理されたルールセットの設計案が記載される（将来対応）

### NFR-3: エラーメッセージ品質

#### NFR-3.1: Orchestrator向けガイダンス

**要件:**
- バリデーション失敗時のエラーメッセージは、Orchestratorが適切に対応できる具体的なガイダンスを含む
- 単なるエラー通知ではなく、修正方法を明示する
- エラーメッセージのフォーマットを統一する

**エラーメッセージ構造:**
```
【{バリデーション名}】検証失敗

問題箇所:
- {具体的な問題1}
- {具体的な問題2}

対応方法:
- {修正手順1}
- {修正手順2}

参考:
- {関連ドキュメントへのパス}
- {関連コマンド例}
```

**受入基準:**
- AC-NFR-3.1.1: design-validatorのエラーメッセージに未実装項目リストが含まれる
- AC-NFR-3.1.2: エラーメッセージに対応方法（「実装してください」「設計書を修正してください」等）が含まれる
- AC-NFR-3.1.3: test-authenticityのエラーメッセージにテスト出力の問題点が具体的に記載される
- AC-NFR-3.1.4: エラーメッセージに関連ドキュメントへのパスが含まれる
- AC-NFR-3.1.5: 全てのエラーメッセージが統一フォーマットに従う

#### NFR-3.2: ログ記録とトレーサビリティ

**要件:**
- 全てのバリデーション実行結果をログに記録する
- ログレベル: INFO（成功）、WARN（警告モード時の失敗）、ERROR（厳格モード時の失敗）
- ログにはタスクID、フェーズ、バリデーション名、結果、実行時間を含める
- ログフォーマット: JSON形式（構造化ログ）

**ログ出力例:**
```json
{
  "timestamp": "2026-02-17T10:30:00Z",
  "level": "ERROR",
  "taskId": "task_abc123",
  "phase": "parallel_quality",
  "validator": "design-validator",
  "result": "FAILED",
  "executionTime": 45,
  "details": {
    "missingItems": ["UserService.findById", "state transition: ACTIVE->INACTIVE"]
  }
}
```

**受入基準:**
- AC-NFR-3.2.1: バリデーション実行結果が構造化ログで記録される
- AC-NFR-3.2.2: ログレベルが適切に設定される（成功=INFO、警告=WARN、失敗=ERROR）
- AC-NFR-3.2.3: ログにタスクID、フェーズ、バリデーション名、実行時間が含まれる
- AC-NFR-3.2.4: ログがJSON形式で出力される（環境変数LOG_FORMAT=jsonで制御）
- AC-NFR-3.2.5: ログファイルが適切にローテーションされる（最大100MB、7日保持）

#### NFR-3.3: エラーメッセージの多言語対応

**要件:**
- エラーメッセージは将来的に多言語対応可能な設計とする
- 本タスクでは日本語メッセージのみ実装する
- メッセージキーと実際のメッセージを分離する設計とする（将来対応）

**実装スコープ:**
- 本タスクでは日本語メッセージのハードコーディングのみ
- メッセージキー分離は将来の拡張として設計を検討する

**受入基準:**
- AC-NFR-3.3.1: 全てのエラーメッセージが日本語で記述される
- AC-NFR-3.3.2: メッセージキー分離の設計案がアーキテクチャドキュメントに記載される（将来対応）
- AC-NFR-3.3.3: 多言語対応のロードマップがドキュメント化される（将来対応）

### NFR-4: テスト可能性

#### NFR-4.1: 単体テストのカバレッジ

**要件:**
- 新規実装コードの単体テストカバレッジは80%以上とする
- 特に以下のロジックは100%カバレッジを目標とする:
  - performDesignValidation関数（共通化後）
  - getPhaseStartedAtヘルパー関数
  - testOutputHashes管理ロジック
  - 環境変数読み込みロジック

**テストツール:**
- Vitest（既存のテストフレームワーク）
- c8（カバレッジ計測ツール）

**受入基準:**
- AC-NFR-4.1.1: 単体テストカバレッジが80%以上である
- AC-NFR-4.1.2: performDesignValidation関数のカバレッジが100%である
- AC-NFR-4.1.3: getPhaseStartedAt関数のカバレッジが100%である
- AC-NFR-4.1.4: カバレッジレポートがCI/CDで自動生成される

#### NFR-4.2: 統合テストシナリオ

**要件:**
- 以下の統合テストシナリオを作成する:
  1. **C-2統合テスト**: 未実装項目があるコードでcode_review完了がブロックされる
  2. **C-3統合テスト**: 形骸化テスト出力でtesting→regression_test遷移がブロックされる
  3. **環境変数テスト**: DESIGN_VALIDATION_STRICT=falseで警告モードになる
  4. **パフォーマンステスト**: バリデーション実行時間が50ms以内である

**テストデータ:**
- 未実装項目を含むサンプルコード（C-2用）
- 形骸化されたテスト出力（C-3用）
- 正常なテスト出力（比較用）

**受入基準:**
- AC-NFR-4.2.1: 4つの統合テストシナリオが実装される
- AC-NFR-4.2.2: 統合テストが自動化され、CI/CDで実行される
- AC-NFR-4.2.3: 統合テストの成功率が100%である（flaky testなし）
- AC-NFR-4.2.4: テストデータが適切にモックされている

### NFR-5: 運用性

#### NFR-5.1: 監視とアラート

**要件:**
- バリデーション失敗率を監視する（将来対応）
- バリデーション実行時間を監視する（将来対応）
- 異常検知時にアラートを発行する（将来対応）

**実装スコープ:**
- 本タスクではログ出力のみ実装する
- 監視・アラート機能は将来の拡張として設計を検討する

**受入基準:**
- AC-NFR-5.1.1: バリデーション結果がログに記録される
- AC-NFR-5.1.2: 監視・アラートの設計案がアーキテクチャドキュメントに記載される（将来対応）

#### NFR-5.2: ドキュメント更新

**要件:**
- README.mdに新しい環境変数の説明を追加する
- アーキテクチャドキュメントにバリデーション統合の設計を記載する
- トラブルシューティングガイドにバリデーション失敗時の対処法を追加する

**ドキュメント構成:**
- `README.md`: 環境変数セクション
- `docs/architecture/validation-integration.md`: バリデーション統合設計（新規）
- `docs/troubleshooting.md`: トラブルシューティングガイド（新規）

**受入基準:**
- AC-NFR-5.2.1: README.mdに3つの環境変数（DESIGN_VALIDATION_STRICT、TEST_AUTHENTICITY_STRICT、VALIDATION_WARNINGS_ONLY）の説明が追加される
- AC-NFR-5.2.2: アーキテクチャドキュメントにC-1/C-2/C-3の統合設計が記載される
- AC-NFR-5.2.3: トラブルシューティングガイドにバリデーション失敗時の対処法が記載される
- AC-NFR-5.2.4: 全てのドキュメントがMarkdownリンターでチェックされる

---

## 制約条件

### 技術的制約

#### TECH-1: Task toolプロンプトの事前検証不可

**制約内容:**
- MCPプロトコルにはTask toolのプロンプト内容を事前に取得・検証する仕組みがない
- MCP serverはTask tool実行前にプロンプトを検査できない
- この制約によりC-1のuserIntent埋め込みを技術的に強制できない

**影響:**
- C-1の解決策は間接的アプローチ（レスポンスメッセージ強化、CLAUDE.md指示明確化）に限定される
- 完全な技術的強制は不可能であり、Orchestratorの自律的判断に一部依存する

#### TECH-2: AST解析のパフォーマンス影響

**制約内容:**
- design-validatorはAST解析を含むため、実行時間がかかる可能性がある
- 特に大規模プロジェクト（1000ファイル以上）では初回実行が遅い
- LRUキャッシュで緩和されるが、キャッシュミス時は50ms以内の目標達成が難しい場合がある

**影響:**
- FR-2.1/FR-2.2の実装でパフォーマンス最適化が必要
- 環境変数でキャッシュサイズを調整可能にする
- 大規模プロジェクト向けのチューニングガイドが必要

#### TECH-3: テストフレームワーク依存性

**制約内容:**
- test-authenticityはテストフレームワークのパターンマッチングに依存する
- カスタムテストランナーや新しいフレームワークでは誤検出の可能性がある
- N-3バグ修正で既知フレームワーク（vitest, jest, playwright等）には対応済み

**影響:**
- カスタムテストランナー使用時はTEST_AUTHENTICITY_STRICT=falseで警告モードにする必要がある
- 新しいフレームワーク対応時はtest-authenticity.tsのパターンリストを更新する

### プロジェクト制約

#### PROJ-1: 後方互換性の保証

**制約内容:**
- 既存ワークフロー（統合前に作成）に悪影響を与えてはならない
- 新しいバリデーションルールはデフォルトで有効だが、無効化が容易である必要がある

**影響:**
- 全てのバリデーションに環境変数による緩和モードを提供する
- VALIDATION_WARNINGS_ONLY=trueで一括警告モード化可能にする

#### PROJ-2: 実装期間の制限

**制約内容:**
- 本タスクはmediumサイズ（14フェーズ）で実行される
- 統合実装とテストは2日以内に完了する必要がある

**影響:**
- 将来対応項目（監視・アラート、多言語対応等）は設計案のみドキュメント化し、実装はスコープ外とする
- 統合テストは最小限のシナリオに絞る

---

## 成功基準

### 技術的成功基準

1. **C-1解決**: workflow_next/workflow_statusレスポンスにuserIntent明示メッセージが含まれる
2. **C-2解決**: code_reviewフェーズ完了時とparallel_quality→testing遷移時にdesign-validatorが実行され、不整合時にブロックされる
3. **C-3解決**: testing/regression_test遷移時にtest-authenticityが実行され、形骸化テスト時にブロックされる
4. **パフォーマンス**: 各バリデーション実行時間が50ms以内、フック全体が100ms以内
5. **後方互換性**: 環境変数で全バリデーションを警告モード化可能
6. **テストカバレッジ**: 単体テストカバレッジが80%以上

### ビジネス成功基準

1. **品質向上**: 設計-実装不整合とテスト形骸化が技術的にブロックされる
2. **開発者体験**: エラーメッセージが具体的で、修正方法が明確
3. **運用性**: ログで監査証跡が残り、トラブルシューティングが容易
4. **拡張性**: 将来的な監視・アラート機能の基盤が整う

---

## リスクと対策

### リスク1: パフォーマンス劣化

**リスク内容:**
- design-validatorのAST解析により、ワークフロー遷移が遅延する可能性がある
- 特に大規模プロジェクト（1000ファイル以上）で顕著

**影響度:** 中（開発者体験への影響）

**対策:**
1. LRUキャッシュのサイズを環境変数で調整可能にする（AST_CACHE_MAX_ENTRIES）
2. パフォーマンス計測ログを出力し、ボトルネックを特定する
3. 50ms超過時は警告ログを出力し、キャッシュサイズ増加を推奨する
4. 将来的には並列AST解析を検討する（本タスクではスコープ外）

### リスク2: 既存ワークフローへの影響

**リスク内容:**
- 新しいバリデーションルールが既存プロジェクトでエラーを引き起こす可能性がある
- 特に設計書が不完全なプロジェクトでブロックされる

**影響度:** 高（既存ユーザーへの影響）

**対策:**
1. デフォルトは厳格モードだが、環境変数で簡単に警告モードに切り替え可能にする
2. VALIDATION_WARNINGS_ONLY=trueで全バリデーションを一括警告モード化
3. README.mdに環境変数の説明を明記し、移行ガイドを提供する
4. 段階的ロールアウト戦略をドキュメント化する（将来対応）

### リスク3: テストフレームワーク誤検出

**リスク内容:**
- test-authenticityがカスタムテストランナーを誤検出する可能性がある
- 新しいテストフレームワーク（まだパターンリストにない）で失敗する

**影響度:** 中（一部ユーザーへの影響）

**対策:**
1. TEST_AUTHENTICITY_STRICT=falseで警告モード化可能にする
2. エラーメッセージに「カスタムテストランナーの場合はTEST_AUTHENTICITY_STRICT=falseを設定してください」と明記する
3. test-authenticity.tsのパターンリストを拡張しやすい設計にする
4. 将来的にはプラグイン機構でカスタムパターンを追加可能にする（本タスクではスコープ外）

### リスク4: エラーメッセージの不明瞭性

**リスク内容:**
- バリデーション失敗時のエラーメッセージがOrchestratorにとって理解困難
- 修正方法が不明確で、開発者が混乱する

**影響度:** 中（開発者体験への影響）

**対策:**
1. エラーメッセージフォーマットを統一し、必ず対応方法を含める
2. 具体的な問題箇所（ファイル名、行番号、項目名）を明示する
3. 関連ドキュメントへのパスを含める
4. トラブルシューティングガイドを作成し、よくあるエラーパターンを記載する

### リスク5: 実装期間の超過

**リスク内容:**
- C-1/C-2/C-3全ての実装とテストを2日以内に完了できない可能性がある
- 特に統合テストの作成に時間がかかる

**影響度:** 中（タスクスケジュールへの影響）

**対策:**
1. 将来対応項目（監視・アラート、多言語対応等）を明確に切り分け、本タスクでは設計案のみとする
2. 統合テストは最小限のシナリオ（4つ）に絞る
3. 単体テストを優先し、統合テストは時間が許す範囲で実装する
4. 必要に応じてtest_implフェーズで追加テストを作成する

---

## 依存関係

### 前提条件

- design-validator.ts, test-authenticity.tsが既に実装済みである
- LRUキャッシュ機構が既に実装済みである（design-validator.ts line 45-102）
- PhaseGuide, StatusResult型にuserIntentフィールドが定義済みである
- resolvePhaseGuide関数でuserIntent伝播が実装済みである

### 外部依存

- MCPプロトコル仕様（Task toolの制約）
- Claude Code CLI（Task tool提供元）
- Vitest（テストフレームワーク）
- c8（カバレッジ計測ツール）

### 内部依存

- stateManager.ts（状態管理）
- types.ts（型定義）
- definitions.ts（フェーズ定義）
- next.ts（フェーズ遷移制御）
- complete-sub.ts（サブフェーズ完了制御）

---

## 関連ドキュメント

| ドキュメント | パス | 説明 |
|-------------|------|------|
| 調査結果 | `docs/workflows/Critical-Issues-C1-C3根本解決/research.md` | C-1/C-2/C-3の現状分析と統合ポイント特定 |
| 設計整合性検証 | `workflow-plugin/mcp-server/src/validation/design-validator.ts` | 既存のdesign-validator実装 |
| テスト真正性検証 | `workflow-plugin/mcp-server/src/validation/test-authenticity.ts` | 既存のtest-authenticity実装 |
| フェーズ遷移制御 | `workflow-plugin/mcp-server/src/tools/next.ts` | workflow_next関数（統合対象） |
| サブフェーズ完了制御 | `workflow-plugin/mcp-server/src/tools/complete-sub.ts` | workflow_complete_sub関数（統合対象） |
| 型定義 | `workflow-plugin/mcp-server/src/state/types.ts` | PhaseGuide, StatusResult, TaskState型 |
| フェーズ定義 | `workflow-plugin/mcp-server/src/phases/definitions.ts` | PHASE_GUIDES, resolvePhaseGuide |
| CLAUDE.md | `C:\ツール\Workflow\CLAUDE.md` | AI向けワークフロー指示（更新対象） |
| README.md | `workflow-plugin/mcp-server/README.md` | 環境変数説明追加対象 |

---

## 用語集

| 用語 | 説明 |
|-----|------|
| userIntent | タスク開始時にユーザーが指定する「このタスクで何を実現したいか」の意図（タスク名とは別に記録される詳細な説明） |
| phaseGuide | 各フェーズの詳細情報（入力ファイル、出力ファイル、必須セクション等）を含む構造化データ |
| subagentTemplate | Task tool起動時のプロンプトテンプレート（プレースホルダーを含む） |
| design-validator | 設計書（spec.md、state-machine.mmd、flowchart.mmd）と実装コードの整合性を検証するバリデーター |
| test-authenticity | テスト出力の真正性（実行時間、出力パターン、ハッシュ重複）を検証するバリデーター |
| LRUキャッシュ | Least Recently Used（最近最も使われていない）アイテムから削除するキャッシュアルゴリズム |
| AST解析 | Abstract Syntax Tree（抽象構文木）解析、ソースコードを構造化データとして解析する技術 |
| 厳格モード（strict mode） | バリデーション失敗時にエラーを返して遷移をブロックするモード |
| 警告モード（warn mode） | バリデーション失敗時に警告を記録するが遷移を許可するモード |
| Orchestrator | ワークフローの進行を制御し、各フェーズをsubagentに委譲するメインのClaude |
| phaseStartedAt | フェーズ開始時刻（ISO 8601形式のタイムスタンプ） |
| testOutputHashes | テスト出力のSHA256ハッシュリスト（重複チェック用） |

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 著者 |
|-----|-----------|---------|------|
| 2026-02-17 | 1.0 | 初版作成 | Claude Sonnet 4.5 |
