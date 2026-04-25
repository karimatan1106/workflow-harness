# test_designフェーズ成果物

## サマリー

本テスト設計書は、ワークフロープラグインのCritical Issues解決実装（C-1: userIntent伝播強化、C-2: design-validator統合、C-3: test-authenticity統合）に対する包括的なテスト戦略を定義します。

### テスト対象の概要

C-1ではuserIntentがsubagentプロンプトに確実に含まれるよう、phaseGuideレスポンスメッセージとsubagentTemplateによる間接的な技術的強制を実装します。C-2では設計と実装の整合性を検証するdesign-validatorをcode_reviewサブフェーズ完了時とparallel_quality遷移時に統合し、未実装項目の通過を防止します。C-3ではテスト出力の真正性を検証するtest-authenticityをtesting/regression_test遷移時に統合し、形骸化されたテストコピペを検出します。

### テスト方針の要点

単体テストでは各関数の正常系と異常系を網羅し、境界値やエッジケースを含めます。統合テストでは実際のワークフロー実行を模擬し、複数フェーズにわたる動作を検証します。環境変数による制御モード（厳格モード対警告モード）の切り替えテストを重視し、後方互換性を確保します。パフォーマンステストではバリデーション実行時間を計測し、50ミリ秒以内の目標達成を確認します。

### 成功基準

全ての単体テストが合格し、カバレッジ80パーセント以上を達成することが必須です。統合テストでは、設計不整合時のブロック、形骸化テスト検出時のブロック、警告モード時の遷移継続を確認します。パフォーマンス要件として、LRUキャッシュヒット時50ミリ秒以内、キャッシュミス時でも200ミリ秒以内の実行を保証します。

### 次フェーズへの引き継ぎ

test_implフェーズでは、本設計書に基づきVitestを使用した単体テストコードを作成します。各テストケースの入力データ、期待される出力、モックの設定方法を詳細化し、実装可能な形式で記述します。testingフェーズでは全テストを実行し、結果を記録します。

---

## テスト方針

### 全体方針

本プロジェクトでは、品質保証の観点から多層的なテスト戦略を採用します。単体テストで個々の関数の正確性を保証し、統合テストでシステム全体の連携を検証し、エンドツーエンドテストで実ユースケースをカバーします。特に、C-1、C-2、C-3の実装は既存のワークフロー実行に影響を与えるため、後方互換性の維持を最重要視します。

### テストレベル

#### 単体テスト（Unit Test）

個別の関数やモジュールを単独でテストします。外部依存はモックで置き換え、純粋な入出力検証に集中します。テスト対象関数として、resolvePhaseGuide関数のプレースホルダー置換、performDesignValidation関数の検証ロジック、getPhaseStartedAt関数の履歴検索を含みます。カバレッジ目標は80パーセント以上とし、全ての分岐を網羅します。

#### 統合テスト（Integration Test）

複数のモジュールや関数の連携動作を検証します。実際のファイルシステムやワークフロー状態を使用し、end-to-endに近い環境で実行します。テスト対象として、workflow_nextとdesign-validatorの統合、workflow_complete_subとdesign-validatorの統合、workflow_nextとtest-authenticityの統合を含みます。実際のタスク状態とドキュメントディレクトリを使用し、リアルな条件下での動作を確認します。

#### エンドツーエンドテスト（E2E Test）

実際のワークフロー実行を模擬し、ユーザーの操作フローを再現します。MCPサーバーを起動し、実際のworkflow_start/workflow_next/workflow_complete_subコマンドを実行します。テスト対象として、設計不整合がある状態でのcode_review完了ブロック、形骸化テスト出力でのtesting遷移ブロック、警告モードでの全フェーズ通過を含みます。

### テスト環境

#### 開発環境

Node.jsバージョン18以上、TypeScript 5.x、Vitestテストランナーを使用します。環境変数として、DESIGN_VALIDATION_STRICTとTEST_AUTHENTICITY_STRICTを制御し、モードを切り替えます。テスト用のワークフロー状態ファイルとドキュメントディレクトリをfixturesとして準備します。

#### CI環境

GitHub ActionsまたはGitLab CIでの自動テスト実行を想定します。全テストを実行し、結果をアーティファクトとして保存します。カバレッジレポートを生成し、80パーセント未満の場合はビルドを失敗させます。

### テストデータ管理

#### フィクスチャデータ

テスト用のタスク状態、ドキュメント、コードファイルをfixturesディレクトリに配置します。設計書のサンプル（spec.md、state-machine.mmd、flowchart.mmd）を用意し、整合性ありとなしの2パターンを準備します。テスト出力のサンプル（正常なテスト出力、形骸化された出力、100文字未満の短い出力）を準備します。

#### モックデータ

外部依存（ファイルシステム、stateManager、auditLogger）をモック化します。taskStateオブジェクトのモックを作成し、必要なフィールド（taskId、taskName、docsDir、userIntent、history等）を含めます。historyフィールドにフェーズ開始/完了イベントを含め、getPhaseStartedAtのテストに使用します。

---

## テストケース

### C-1: userIntent伝播強化のテスト

#### TC-C1-001: resolvePhaseGuideのsubagentTemplateプレースホルダー置換

**テスト目的:** resolvePhaseGuide関数がsubagentTemplateフィールド内のプレースホルダーを正しく置換することを確認

**前提条件:**
- PHASE_GUIDESにresearchフェーズ定義が存在し、subagentTemplateフィールドを持つ
- テンプレート内にtaskName、taskId、userIntent、docsDirのプレースホルダーが含まれる

**テスト手順:**
1. resolvePhaseGuide関数をresearchフェーズ名で呼び出す
2. userIntent引数に「PDF変換機能の追加」を渡す
3. docsDir引数に「docs/workflows/test-task」を渡す
4. 返却されたPhaseGuideオブジェクトのsubagentTemplateフィールドを取得

**期待される結果:**
- subagentTemplateフィールドが存在する
- テンプレート内のuserIntentプレースホルダーが「PDF変換機能の追加」に置換されている
- docsDirプレースホルダーが「docs/workflows/test-task」に置換されている
- taskNameとtaskIdは空文字列のまま（workflow_next内で後から置換されるため）

**エラーケース:**
- userIntentがnullまたは空文字の場合、プレースホルダーが空文字に置換される

#### TC-C1-002: workflow_nextレスポンスメッセージのuserIntent明示

**テスト目的:** workflow_next関数のレスポンスメッセージにuserIntentの重要性を明示する文言が含まれることを確認

**前提条件:**
- taskStateにuserIntentフィールドが設定されている（値: 「ユーザー認証機能の改善」）
- currentPhaseがresearch、nextPhaseがrequirements

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスオブジェクトのmessageフィールドを取得
3. messageに「ユーザー意図を必ずsubagentプロンプトに含める」旨の文言が含まれるか確認

**期待される結果:**
- レスポンスのsuccessフィールドがtrue
- messageフィールドに「ユーザー意図」という文字列が含まれる
- messageに「subagentTemplate」という文字列が含まれる
- phaseGuideオブジェクトが返却され、subagentTemplateフィールドが存在する

**エラーケース:**
- userIntentが未設定の場合、メッセージにuserIntent関連の文言が含まれない

#### TC-C1-003: subagentTemplateのtaskName/taskId後置換

**テスト目的:** workflow_next関数内でsubagentTemplateのtaskNameとtaskIdプレースホルダーが正しく置換されることを確認

**前提条件:**
- taskState.taskNameが「設計改善タスク」
- taskState.taskIdが「20260217_120000_設計改善タスク」
- resolvePhaseGuideで取得したphaseGuide.subagentTemplateにtaskNameとtaskIdのプレースホルダーが含まれる

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたphaseGuide.subagentTemplateを取得
3. テンプレート内のtaskNameプレースホルダーを検索
4. テンプレート内のtaskIdプレースホルダーを検索

**期待される結果:**
- taskNameプレースホルダーが「設計改善タスク」に置換されている
- taskIdプレースホルダーが「20260217_120000_設計改善タスク」に置換されている
- 他のプレースホルダー（userIntent、docsDir等）も全て置換されている

**エラーケース:**
- taskNameまたはtaskIdが空文字の場合、プレースホルダーが空文字に置換される

#### TC-C1-004: userIntentが長文の場合の処理

**テスト目的:** userIntentが非常に長い文字列（1000文字以上）の場合でも正しく処理されることを確認

**前提条件:**
- userIntentに1000文字の長文を設定
- フェーズ遷移を実行

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたphaseGuide.subagentTemplateを取得
3. テンプレート内に長文のuserIntentが全て含まれているか確認

**期待される結果:**
- 1000文字のuserIntentが全て置換される
- レスポンスメッセージが正常に返却される
- 文字列の切り捨てが発生しない

**エラーケース:**
- なし（長文でもエラーにならない）

#### TC-C1-005: userIntentに特殊文字が含まれる場合

**テスト目的:** userIntentに正規表現の特殊文字（ドル記号、角括弧、バックスラッシュ等）が含まれる場合でも正しく置換されることを確認

**前提条件:**
- userIntentに「価格計算ロジックの修正（単価掛ける数量足す税金）」を設定
- フェーズ遷移を実行

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたphaseGuide.subagentTemplateを取得
3. テンプレート内に特殊文字を含むuserIntentが正確に含まれているか確認

**期待される結果:**
- 特殊文字がエスケープされずそのまま置換される
- 正規表現のメタ文字として解釈されない
- 括弧やバックスラッシュが正しく保持される

**エラーケース:**
- なし（特殊文字でもエラーにならない）

#### TC-C1-006: サブフェーズのsubagentTemplate置換

**テスト目的:** parallel_analysisなどの並列フェーズのサブフェーズ（threat_modeling、planning）でもsubagentTemplateが正しく置換されることを確認

**前提条件:**
- currentPhaseがparallel_analysis
- threat_modelingサブフェーズのガイドにsubagentTemplateが存在

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたphaseGuide.subPhasesを取得
3. threat_modelingサブフェーズのsubagentTemplateを確認

**期待される結果:**
- subPhasesが配列として返却される
- threat_modelingサブフェーズにsubagentTemplateフィールドが存在
- プレースホルダーが全て置換されている

**エラーケース:**
- サブフェーズが存在しない場合、subPhasesがundefinedまたは空配列

---

### C-2: design-validator統合のテスト

#### TC-C2-001: performDesignValidation関数の正常系

**テスト目的:** performDesignValidation関数が設計と実装の整合性を正しく検証することを確認

**前提条件:**
- docsDirに設計書（spec.md、state-machine.mmd、flowchart.mmd）が存在
- スコープディレクトリに実装ファイルが存在し、設計書の全項目を実装済み
- DESIGN_VALIDATION_STRICTがtrueまたは未設定（デフォルト厳格モード）

**テスト手順:**
1. performDesignValidation関数を呼び出し、docsDirを渡す
2. 返却値を確認

**期待される結果:**
- 返却値がnull（検証成功）
- エラーメッセージが出力されない

**エラーケース:**
- なし（正常系のため）

#### TC-C2-002: performDesignValidation関数の異常系（厳格モード）

**テスト目的:** 設計と実装の不整合が存在する場合、厳格モードでエラーオブジェクトが返却されることを確認

**前提条件:**
- spec.mdに「UserService.findById関数を実装する」と記載
- 実装ファイルにfindByIdメソッドが存在しない（未実装）
- DESIGN_VALIDATION_STRICTがtrueまたは未設定

**テスト手順:**
1. performDesignValidation関数を呼び出し、docsDirを渡す
2. 返却値を確認

**期待される結果:**
- 返却値がエラーオブジェクト（successフィールドがfalse）
- messageフィールドに「設計-実装不整合」という文字列が含まれる
- 未実装項目（findById）の詳細がメッセージに含まれる

**エラーケース:**
- なし（期待される異常系の動作）

#### TC-C2-003: performDesignValidation関数の警告モード

**テスト目的:** 設計不整合が存在しても、警告モードではnullが返却され遷移が継続されることを確認

**前提条件:**
- spec.mdに未実装項目が存在
- DESIGN_VALIDATION_STRICTがfalse
- console.warnのモックを設定

**テスト手順:**
1. performDesignValidation関数を呼び出し、strictをfalseで渡す
2. 返却値を確認
3. console.warnの呼び出しを確認

**期待される結果:**
- 返却値がnull（検証失敗でも継続）
- console.warnが1回以上呼び出される
- 警告メッセージに「DESIGN_VALIDATION_STRICT」という文字列が含まれる

**エラーケース:**
- なし（警告モードの正常動作）

#### TC-C2-004: workflow_complete_subでのcode_review完了時統合

**テスト目的:** code_reviewサブフェーズ完了時にdesign-validatorが実行され、不整合時にブロックされることを確認

**前提条件:**
- currentPhaseがparallel_quality
- code_reviewサブフェーズの成果物（code-review.md）が存在
- 設計と実装に不整合が存在（未実装項目あり）
- DESIGN_VALIDATION_STRICTがtrue

**テスト手順:**
1. workflow_complete_sub関数をsubPhaseName: 'code_review'で呼び出す
2. 返却されたレスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがfalse
- messageフィールドに「設計-実装整合性検証に失敗しました」という文字列が含まれる
- taskState.completedSubPhasesにcode_reviewが追加されない
- サブフェーズ完了がブロックされる

**エラーケース:**
- 警告モード時はsuccessがtrueで完了が許可される

#### TC-C2-005: workflow_complete_subでの他サブフェーズ完了

**テスト目的:** code_review以外のサブフェーズ完了時にはdesign-validatorが実行されないことを確認

**前提条件:**
- currentPhaseがparallel_quality
- build_checkサブフェーズの完了を試みる

**テスト手順:**
1. workflow_complete_sub関数をsubPhaseName: 'build_check'で呼び出す
2. design-validatorの実行有無を確認

**期待される結果:**
- design-validatorが実行されない
- サブフェーズが正常に完了する
- performDesignValidation関数が呼び出されない（モックで確認）

**エラーケース:**
- なし（他サブフェーズでは検証不要）

#### TC-C2-006: workflow_nextでのparallel_quality→testing遷移統合（厳格モード）

**テスト目的:** parallel_qualityからtestingへの遷移時にdesign-validatorが実行され、不整合時にブロックされることを確認

**前提条件:**
- currentPhaseがparallel_quality
- code_reviewサブフェーズが完了済み
- 設計と実装に不整合が存在
- DESIGN_VALIDATION_STRICTがtrue

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがfalse
- messageフィールドに「parallel_quality→testing遷移時の設計検証に失敗しました」という文字列が含まれる
- フェーズ遷移がブロックされる
- taskState.currentPhaseがparallel_qualityのまま

**エラーケース:**
- 警告モード時は遷移が継続される

#### TC-C2-007: workflow_nextでのparallel_quality→testing遷移統合（警告モード）

**テスト目的:** 警告モードでは設計不整合があっても遷移が継続されることを確認

**前提条件:**
- currentPhaseがparallel_quality
- 設計と実装に不整合が存在
- DESIGN_VALIDATION_STRICTがfalse

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスを確認
3. console.warnの呼び出しを確認

**期待される結果:**
- レスポンスのsuccessフィールドがtrue
- フェーズ遷移が成功し、currentPhaseがtestingに変わる
- console.warnが呼び出され、警告メッセージが出力される

**エラーケース:**
- なし（警告モードの正常動作）

#### TC-C2-008: design-validator実行時のパフォーマンス計測

**テスト目的:** design-validator実行が50ミリ秒以内に完了することを確認（LRUキャッシュヒット時）

**前提条件:**
- docsDirに設計書と実装ファイルが存在
- LRUキャッシュにAST解析結果が既に存在（warmup実行済み）
- 中規模プロジェクト（ファイル数100個程度）

**テスト手順:**
1. performDesignValidation関数を3回連続で呼び出す
2. 各実行の開始時刻と終了時刻を記録
3. 実行時間を計算

**期待される結果:**
- 2回目以降の実行時間が50ミリ秒以内
- キャッシュヒット率が90パーセント以上
- 3回目の実行が1回目より高速

**エラーケース:**
- 大規模プロジェクト（1000ファイル以上）では200ミリ秒以内を許容

---

### C-3: test-authenticity統合のテスト

#### TC-C3-001: getPhaseStartedAt関数の正常系

**テスト目的:** getPhaseStartedAt関数がtaskState.historyから正しくフェーズ開始時刻を取得することを確認

**前提条件:**
- taskState.historyに複数のエントリが存在
- testingフェーズのstartedイベントが「2026-02-17T12:00:00Z」で記録されている

**テスト手順:**
1. getPhaseStartedAt関数をhistoryとphase: 'testing'で呼び出す
2. 返却値を確認

**期待される結果:**
- 返却値が「2026-02-17T12:00:00Z」という文字列
- ISO 8601形式のタイムスタンプが返却される

**エラーケース:**
- historyが空配列の場合、nullが返却される

#### TC-C3-002: getPhaseStartedAt関数での複数回実行の最新取得

**テスト目的:** 同じフェーズが複数回実行された場合、最新の開始時刻が取得されることを確認

**前提条件:**
- taskState.historyにtestingフェーズのstartedイベントが2回記録されている
- 1回目が「2026-02-17T10:00:00Z」、2回目が「2026-02-17T14:00:00Z」

**テスト手順:**
1. getPhaseStartedAt関数をhistoryとphase: 'testing'で呼び出す
2. 返却値を確認

**期待される結果:**
- 返却値が「2026-02-17T14:00:00Z」（2回目の最新時刻）
- 古い開始時刻は無視される

**エラーケース:**
- なし（最新優先が正常動作）

#### TC-C3-003: getPhaseStartedAt関数での該当フェーズ未存在

**テスト目目的:** 指定されたフェーズがhistoryに存在しない場合、nullが返却されることを確認

**前提条件:**
- taskState.historyにtestingフェーズのエントリが存在しない
- 他のフェーズ（research、requirements等）のみ存在

**テスト手順:**
1. getPhaseStartedAt関数をhistoryとphase: 'testing'で呼び出す
2. 返却値を確認

**期待される結果:**
- 返却値がnull
- エラーが発生しない

**エラーケース:**
- なし（nullが正常な返却値）

#### TC-C3-004: testing→regression_test遷移でのtest-authenticity統合（正常系）

**テスト目的:** testingフェーズからregression_testへの遷移時にtest-authenticityが実行され、正常なテスト出力で遷移が成功することを確認

**前提条件:**
- currentPhaseがtesting
- workflow_record_test_resultで正常なテスト出力を記録済み（exitCode: 0、output: 1000文字以上の正規テスト出力）
- testingフェーズ開始時刻が履歴に記録されている
- TEST_AUTHENTICITY_STRICTがtrue

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがtrue
- currentPhaseがregression_testに遷移
- test-authenticityの検証が成功
- ハッシュが重複していない

**エラーケース:**
- なし（正常系のため）

#### TC-C3-005: testing→regression_test遷移でのtest-authenticity統合（形骸化テスト検出）

**テスト目的:** 形骸化されたテスト出力（100文字未満）が記録されている場合、遷移がブロックされることを確認

**前提条件:**
- currentPhaseがtesting
- テスト出力が「All tests passed」のみ（15文字）でexitCode: 0
- TEST_AUTHENTICITY_STRICTがtrue

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがfalse
- messageフィールドに「テスト真正性検証に失敗しました」という文字列が含まれる
- reasonに「テスト出力が最小文字数未満です」という内容が含まれる
- フェーズ遷移がブロックされる

**エラーケース:**
- 警告モード時は遷移が継続される

#### TC-C3-006: testing→regression_test遷移でのテストハッシュ重複検出

**テスト目的:** 同じテスト出力が2回記録された場合、ハッシュ重複としてブロックされることを確認

**前提条件:**
- currentPhaseがtesting
- 1回目の実行で正常なテスト出力を記録
- 2回目も全く同じテスト出力を記録（コピペ）
- TEST_AUTHENTICITY_STRICTがtrue

**テスト手順:**
1. workflow_record_test_result関数を2回呼び出し、同じoutputを渡す
2. 2回目のworkflow_next関数呼び出しを試みる
3. 返却されたレスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがfalse
- messageフィールドに「テスト出力が以前と同一です（コピペの可能性）」という文字列が含まれる
- フェーズ遷移がブロックされる

**エラーケース:**
- 警告モード時は遷移が継続される

#### TC-C3-007: testing→regression_test遷移でのtest-authenticity警告モード

**テスト目的:** 警告モードでは形骸化テストでも遷移が継続されることを確認

**前提条件:**
- currentPhaseがtesting
- テスト出力が形骸化されている（100文字未満）
- TEST_AUTHENTICITY_STRICTがfalse

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスを確認
3. console.warnの呼び出しを確認

**期待される結果:**
- レスポンスのsuccessフィールドがtrue
- currentPhaseがregression_testに遷移
- console.warnが呼び出され、「TEST_AUTHENTICITY_STRICT=false」という文字列を含む警告が出力される

**エラーケース:**
- なし（警告モードの正常動作）

#### TC-C3-008: regression_test→parallel_verification遷移でのtest-authenticity統合

**テスト目的:** regression_testフェーズからparallel_verificationへの遷移時にもtest-authenticityが実行されることを確認

**前提条件:**
- currentPhaseがregression_test
- workflow_record_test_resultで正常なリグレッションテスト出力を記録済み
- TEST_AUTHENTICITY_STRICTがtrue

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがtrue
- currentPhaseがparallel_verificationに遷移
- test-authenticityの検証が成功
- ハッシュが重複していない

**エラーケース:**
- 形骸化テストまたはハッシュ重複時にブロックされる

#### TC-C3-009: test-authenticityのタイムスタンプ検証

**テスト目的:** テスト出力のタイムスタンプがフェーズ開始時刻よりも後であることが検証されることを確認

**前提条件:**
- testingフェーズ開始時刻が「2026-02-17T12:00:00Z」
- テスト出力に含まれるタイムスタンプが「2026-02-17T11:00:00Z」（フェーズ開始より前）

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがfalse（厳格モード時）
- messageに「タイムスタンプがフェーズ開始時刻よりも前です」という内容が含まれる

**エラーケース:**
- 警告モード時は遷移が継続される

#### TC-C3-010: testOutputHashesの最新100個保持

**テスト目的:** testOutputHashesフィールドが最新100個のハッシュのみを保持することを確認

**前提条件:**
- taskState.testOutputHashesに既に100個のハッシュが存在
- 新しいテスト出力を記録

**テスト手順:**
1. workflow_next関数を呼び出し、新しいハッシュを追加
2. 更新後のtaskState.testOutputHashesを確認

**期待される結果:**
- testOutputHashesの配列長が100（101にならない）
- 最も古いハッシュが削除されている
- 新しいハッシュが末尾に追加されている

**エラーケース:**
- なし（最新100個保持が正常動作）

---

### 統合テスト

#### TC-INT-001: C-1とC-2の組み合わせテスト

**テスト目的:** userIntent伝播とdesign-validator統合が同時に機能することを確認

**前提条件:**
- タスクを開始し、userIntentを設定
- researchからcode_reviewサブフェーズまで進める
- 設計書に未実装項目を含める

**テスト手順:**
1. workflow_startでuserIntentを設定
2. 各フェーズでworkflow_nextを呼び出し、phaseGuide.subagentTemplateにuserIntentが含まれることを確認
3. code_reviewサブフェーズ完了を試みる
4. design-validatorでブロックされることを確認

**期待される結果:**
- 全てのworkflow_nextレスポンスにuserIntentガイダンスが含まれる
- code_review完了時に設計不整合でブロックされる
- 両機能が独立して動作する

**エラーケース:**
- なし（正常な統合動作）

#### TC-INT-002: C-1とC-3の組み合わせテスト

**テスト目的:** userIntent伝播とtest-authenticity統合が同時に機能することを確認

**前提条件:**
- タスクを開始し、userIntentを設定
- testingフェーズまで進める
- 形骸化されたテスト出力を記録

**テスト手順:**
1. workflow_startでuserIntentを設定
2. testingフェーズまでworkflow_nextを繰り返し呼び出す
3. 各レスポンスでuserIntentガイダンスが含まれることを確認
4. workflow_record_test_resultで形骸化テスト出力を記録
5. workflow_nextでregression_test遷移を試みる

**期待される結果:**
- 全てのworkflow_nextレスポンスにuserIntentガイダンスが含まれる
- testing→regression_test遷移時にtest-authenticityでブロックされる
- 両機能が独立して動作する

**エラーケース:**
- なし（正常な統合動作）

#### TC-INT-003: C-2とC-3の組み合わせテスト

**テスト目的:** design-validatorとtest-authenticityが同時に機能することを確認

**前提条件:**
- タスクを開始
- code_reviewまで進め、設計不整合を含める
- testingまで進め、形骸化テスト出力を記録

**テスト手順:**
1. code_review完了を試み、design-validatorでブロックされることを確認
2. 設計不整合を修正し、code_reviewを完了
3. parallel_quality→testing遷移を試み、再度design-validatorを通過することを確認
4. testingフェーズでテスト出力を記録
5. testing→regression_test遷移を試み、test-authenticityでブロックされることを確認

**期待される結果:**
- code_review時にdesign-validatorが動作
- parallel_quality→testing時にもdesign-validatorが動作
- testing→regression_test時にtest-authenticityが動作
- 3つの検証ポイントが全て独立して機能

**エラーケース:**
- なし（正常な統合動作）

#### TC-INT-004: 全環境変数の組み合わせテスト

**テスト目的:** DESIGN_VALIDATION_STRICTとTEST_AUTHENTICITY_STRICTの全組み合わせで動作が正しいことを確認

**前提条件:**
- 設計不整合と形骸化テストの両方を含むタスク

**テスト手順:**
1. 環境変数を（true、true）に設定し、全検証でブロックされることを確認
2. 環境変数を（true、false）に設定し、design-validatorのみブロックされることを確認
3. 環境変数を（false、true）に設定し、test-authenticityのみブロックされることを確認
4. 環境変数を（false、false）に設定し、全検証が警告のみで遷移が継続されることを確認

**期待される結果:**
- 厳格モードの検証ではブロック、警告モードでは継続
- 各環境変数が独立して機能
- 警告メッセージが正しく出力される

**エラーケース:**
- なし（全組み合わせが正常動作）

#### TC-INT-005: エンドツーエンドフロー（全フェーズ通過）

**テスト目的:** 全てのバリデーションをパスして、researchからcompletedまで到達できることを確認

**前提条件:**
- 設計と実装が整合している
- 正常なテスト出力を記録
- 全ての環境変数がtrue（厳格モード）

**テスト手順:**
1. workflow_startでタスクを開始
2. research、requirements、parallel_analysis、parallel_design、design_review、test_design、test_impl、implementation、refactoring、parallel_quality、testing、regression_test、parallel_verification、docs_update、commit、push、ci_verification、deployの順にフェーズを進める
3. 各検証ポイントでバリデーションが実行され、全て成功することを確認
4. completedフェーズに到達

**期待される結果:**
- 全フェーズが正常に遷移
- code_reviewでdesign-validator成功
- parallel_quality→testingでdesign-validator成功
- testing→regression_testでtest-authenticity成功
- regression_test→parallel_verificationでtest-authenticity成功
- タスクがcompletedフェーズに到達

**エラーケース:**
- なし（正常なエンドツーエンド動作）

---

### エッジケーステスト

#### TC-EDGE-001: userIntentが空文字の場合

**テスト目的:** userIntentが空文字列または未設定の場合でも正常に動作することを確認

**前提条件:**
- workflow_start時にuserIntentを設定しない（デフォルト空文字）

**テスト手順:**
1. workflow_next関数を呼び出す
2. レスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがtrue
- phaseGuide.subagentTemplate内のuserIntentプレースホルダーが空文字に置換される
- messageフィールドにuserIntentガイダンスが含まれない（userIntentが空のため）

**エラーケース:**
- なし（空文字でもエラーにならない）

#### TC-EDGE-002: docsDirが存在しない場合

**テスト目的:** docsDirパスが存在しない場合、design-validatorが適切にエラーを返すことを確認

**前提条件:**
- taskState.docsDirに存在しないパス（/nonexistent/path）を設定

**テスト手順:**
1. performDesignValidation関数を呼び出す
2. 返却値を確認

**期待される結果:**
- 返却値がエラーオブジェクト
- messageに「ドキュメントディレクトリが見つかりません」という内容が含まれる

**エラーケース:**
- なし（ディレクトリ不存在は正常なエラーハンドリング）

#### TC-EDGE-003: テスト出力が空文字の場合

**テスト目的:** テスト出力が空文字列の場合、test-authenticityが失敗することを確認

**前提条件:**
- workflow_record_test_resultでoutputを空文字に設定
- TEST_AUTHENTICITY_STRICTがtrue

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがfalse
- messageに「テスト出力が最小文字数未満です」という内容が含まれる

**エラーケース:**
- 警告モード時は遷移が継続される

#### TC-EDGE-004: historyが空配列の場合

**テスト目的:** taskState.historyが空配列の場合、getPhaseStartedAtがnullを返すことを確認

**前提条件:**
- taskState.historyが空配列

**テスト手順:**
1. getPhaseStartedAt関数を呼び出す
2. 返却値を確認

**期待される結果:**
- 返却値がnull
- エラーが発生しない

**エラーケース:**
- なし（nullが正常な返却値）

#### TC-EDGE-005: テストフレームワーク出力パターンが未対応の場合

**テスト目的:** test-authenticityのパターンマッチングが未知のテストフレームワーク出力で失敗することを確認

**前提条件:**
- カスタムテストランナーの出力（既知のパターンに一致しない）を記録
- TEST_AUTHENTICITY_STRICTがtrue

**テスト手順:**
1. workflow_next関数を呼び出す
2. 返却されたレスポンスを確認

**期待される結果:**
- レスポンスのsuccessフィールドがfalse
- messageに「テスト数を抽出できませんでした」という内容が含まれる

**エラーケース:**
- 警告モードでは遷移が継続され、後で手動確認を推奨する警告が出力される

#### TC-EDGE-006: プレースホルダーが二重に存在する場合

**テスト目的:** subagentTemplate内に同じプレースホルダーが複数回出現する場合、全て置換されることを確認

**前提条件:**
- subagentTemplateに「タスク名はtaskName、このタスクtaskNameを実行」というテンプレート
- taskNameが「テストタスク」

**テスト手順:**
1. resolvePhaseGuide関数を呼び出す
2. 返却されたsubagentTemplateを確認

**期待される結果:**
- 両方のtaskNameプレースホルダーが「テストタスク」に置換される
- 「タスク名はテストタスク、このタスクテストタスクを実行」という結果

**エラーケース:**
- なし（複数出現でも全て置換される）

---

### パフォーマンステスト

#### TC-PERF-001: design-validator実行時間（キャッシュヒット）

**テスト目的:** LRUキャッシュヒット時にdesign-validator実行が50ミリ秒以内に完了することを確認

**前提条件:**
- 中規模プロジェクト（ファイル数100個）
- 1回目の実行でキャッシュをwarmup済み

**テスト手順:**
1. performDesignValidation関数を10回連続で実行
2. 各実行の開始時刻と終了時刻を記録
3. 平均実行時間を計算

**期待される結果:**
- 平均実行時間が50ミリ秒以内
- 最大実行時間が100ミリ秒以内
- 2回目以降がキャッシュヒットで高速

**エラーケース:**
- 大規模プロジェクト（1000ファイル以上）では200ミリ秒以内を許容

#### TC-PERF-002: test-authenticity実行時間

**テスト目的:** test-authenticity検証が高速に実行されることを確認（1ミリ秒以内）

**前提条件:**
- 正常なテスト出力（1000文字）

**テスト手順:**
1. validateTestAuthenticity関数を100回連続で実行
2. 各実行の開始時刻と終了時刻を記録
3. 平均実行時間を計算

**期待される結果:**
- 平均実行時間が1ミリ秒以内
- 最大実行時間が5ミリ秒以内

**エラーケース:**
- なし（軽量な正規表現処理のため高速）

#### TC-PERF-003: workflow_next全体の実行時間

**テスト目的:** バリデーション統合後もworkflow_next関数が100ミリ秒以内に完了することを確認

**前提条件:**
- parallel_quality→testing遷移（design-validator実行）
- testing→regression_test遷移（test-authenticity実行）

**テスト手順:**
1. 各遷移のworkflow_next関数を10回ずつ実行
2. 平均実行時間を計算

**期待される結果:**
- parallel_quality→testing遷移の平均が100ミリ秒以内
- testing→regression_test遷移の平均が50ミリ秒以内

**エラーケース:**
- 初回実行（キャッシュミス）では200ミリ秒以内を許容

---

## テスト実施計画

### テスト実施スケジュール

#### フェーズ1: 単体テスト実施（test_implフェーズ）

**期間:** test_implフェーズ（1日）

**実施内容:**
- TC-C1シリーズ（C-1単体テスト）を全て実装
- TC-C2シリーズ（C-2単体テスト）を全て実装
- TC-C3シリーズ（C-3単体テスト）を全て実装
- モックとフィクスチャデータの準備

**成功基準:**
- 全単体テストが合格
- コードカバレッジが80パーセント以上

#### フェーズ2: 統合テスト実施（testingフェーズ）

**期間:** testingフェーズ（0.5日）

**実施内容:**
- TC-INTシリーズ（統合テスト）を全て実行
- TC-EDGEシリーズ（エッジケース）を全て実行
- 実際のワークフロー実行を模擬

**成功基準:**
- 全統合テストが合格
- エッジケースでのエラーハンドリング確認

#### フェーズ3: パフォーマンステスト実施（parallel_verificationフェーズ）

**期間:** parallel_verificationフェーズ（0.5日）

**実施内容:**
- TC-PERFシリーズ（パフォーマンステスト）を全て実行
- 実行時間の計測とレポート作成

**成功基準:**
- design-validator実行が50ミリ秒以内（キャッシュヒット時）
- test-authenticity実行が1ミリ秒以内

### テスト環境設定

#### 開発環境

**必要なツール:**
- Node.js 18以上
- TypeScript 5.x
- Vitestテストランナー
- @vitest/coverageプラグイン

**環境変数:**
- DESIGN_VALIDATION_STRICT: テストごとに切り替え
- TEST_AUTHENTICITY_STRICT: テストごとに切り替え

#### テストデータ準備

**フィクスチャディレクトリ:** workflow-plugin/mcp-server/tests/fixtures/

**必要なファイル:**
- task-state-valid.json（整合性のあるタスク状態）
- task-state-invalid.json（不整合のあるタスク状態）
- spec-with-impl.md（実装済み設計書）
- spec-without-impl.md（未実装項目を含む設計書）
- test-output-valid.txt（正常なテスト出力）
- test-output-short.txt（形骸化テスト出力）

### テスト実行手順

#### 単体テスト実行

コマンド:
```
cd workflow-plugin/mcp-server
npm test -- src/tests/unit/
```

期待される出力:
- 全テストケースが合格
- カバレッジレポートが生成される

#### 統合テスト実行

コマンド:
```
cd workflow-plugin/mcp-server
npm test -- src/tests/integration/
```

期待される出力:
- 全統合テストが合格
- 実際のワークフロー遷移が成功

#### パフォーマンステスト実行

コマンド:
```
cd workflow-plugin/mcp-server
npm test -- src/tests/performance/
```

期待される出力:
- 各関数の実行時間が目標以内
- パフォーマンスレポートが生成される

---

## テスト成果物

### テストコード

**配置先:**
- workflow-plugin/mcp-server/src/tests/unit/c1-userintent.test.ts
- workflow-plugin/mcp-server/src/tests/unit/c2-design-validator.test.ts
- workflow-plugin/mcp-server/src/tests/unit/c3-test-authenticity.test.ts
- workflow-plugin/mcp-server/src/tests/integration/workflow-integration.test.ts
- workflow-plugin/mcp-server/src/tests/performance/validation-performance.test.ts

**命名規則:**
- テストファイル名は対象機能を明示
- テストケースIDをdescribeブロックに含める
- 各テストケースはitまたはtest関数で記述

### テストレポート

**生成されるレポート:**
- カバレッジレポート（HTML形式）
- パフォーマンスレポート（Markdown形式）
- テスト結果サマリー（JSON形式）

**配置先:**
- workflow-plugin/mcp-server/coverage/
- docs/workflows/Critical-Issues-C1-C3根本解決/test-results.md

### 不具合管理

**不具合報告フォーマット:**
- テストケースID
- 不具合の内容
- 再現手順
- 期待される動作と実際の動作
- 優先度（高/中/低）

**不具合追跡:**
- GitHubのIssueで管理
- ラベル: bug、test-failure、C-1、C-2、C-3

---

## 関連ドキュメント

本テスト設計書は、以下のドキュメントと連携して使用されます。仕様書では実装の詳細が定義され、設計図では状態遷移とフローが視覚化されています。テスト実装時にはこれらのドキュメントを参照し、仕様との整合性を確保してください。

| ドキュメント | パス | 説明 |
|-------------|------|------|
| 仕様書 | docs/workflows/Critical-Issues-C1-C3根本解決/spec.md | C-1、C-2、C-3の実装仕様を定義 |
| ステートマシン図 | docs/workflows/Critical-Issues-C1-C3根本解決/state-machine.mmd | 状態遷移図でバリデーションフローを視覚化 |
| フローチャート | docs/workflows/Critical-Issues-C1-C3根本解決/flowchart.mmd | 処理フローを詳細化 |
| 要件定義 | docs/workflows/Critical-Issues-C1-C3根本解決/requirements.md | プロジェクトの要件と背景 |
| 調査結果 | docs/workflows/Critical-Issues-C1-C3根本解決/research.md | 現状分析と問題の根本原因 |

---

## 付録

### テストケース一覧マトリクス

| カテゴリ | テストケースID | テスト名 | 優先度 |
|---------|---------------|---------|--------|
| C-1単体 | TC-C1-001 | resolvePhaseGuideのsubagentTemplateプレースホルダー置換 | 高 |
| C-1単体 | TC-C1-002 | workflow_nextレスポンスメッセージのuserIntent明示 | 高 |
| C-1単体 | TC-C1-003 | subagentTemplateのtaskName/taskId後置換 | 高 |
| C-1単体 | TC-C1-004 | userIntentが長文の場合の処理 | 中 |
| C-1単体 | TC-C1-005 | userIntentに特殊文字が含まれる場合 | 中 |
| C-1単体 | TC-C1-006 | サブフェーズのsubagentTemplate置換 | 高 |
| C-2単体 | TC-C2-001 | performDesignValidation関数の正常系 | 高 |
| C-2単体 | TC-C2-002 | performDesignValidation関数の異常系（厳格モード） | 高 |
| C-2単体 | TC-C2-003 | performDesignValidation関数の警告モード | 高 |
| C-2統合 | TC-C2-004 | workflow_complete_subでのcode_review完了時統合 | 高 |
| C-2統合 | TC-C2-005 | workflow_complete_subでの他サブフェーズ完了 | 中 |
| C-2統合 | TC-C2-006 | workflow_nextでのparallel_quality→testing遷移統合（厳格モード） | 高 |
| C-2統合 | TC-C2-007 | workflow_nextでのparallel_quality→testing遷移統合（警告モード） | 高 |
| C-2パフォーマンス | TC-C2-008 | design-validator実行時のパフォーマンス計測 | 中 |
| C-3単体 | TC-C3-001 | getPhaseStartedAt関数の正常系 | 高 |
| C-3単体 | TC-C3-002 | getPhaseStartedAt関数での複数回実行の最新取得 | 中 |
| C-3単体 | TC-C3-003 | getPhaseStartedAt関数での該当フェーズ未存在 | 中 |
| C-3統合 | TC-C3-004 | testing→regression_test遷移でのtest-authenticity統合（正常系） | 高 |
| C-3統合 | TC-C3-005 | testing→regression_test遷移でのtest-authenticity統合（形骸化テスト検出） | 高 |
| C-3統合 | TC-C3-006 | testing→regression_test遷移でのテストハッシュ重複検出 | 高 |
| C-3統合 | TC-C3-007 | testing→regression_test遷移でのtest-authenticity警告モード | 高 |
| C-3統合 | TC-C3-008 | regression_test→parallel_verification遷移でのtest-authenticity統合 | 高 |
| C-3統合 | TC-C3-009 | test-authenticityのタイムスタンプ検証 | 中 |
| C-3統合 | TC-C3-010 | testOutputHashesの最新100個保持 | 低 |
| 統合 | TC-INT-001 | C-1とC-2の組み合わせテスト | 高 |
| 統合 | TC-INT-002 | C-1とC-3の組み合わせテスト | 高 |
| 統合 | TC-INT-003 | C-2とC-3の組み合わせテスト | 高 |
| 統合 | TC-INT-004 | 全環境変数の組み合わせテスト | 高 |
| 統合 | TC-INT-005 | エンドツーエンドフロー（全フェーズ通過） | 最高 |
| エッジケース | TC-EDGE-001 | userIntentが空文字の場合 | 中 |
| エッジケース | TC-EDGE-002 | docsDirが存在しない場合 | 中 |
| エッジケース | TC-EDGE-003 | テスト出力が空文字の場合 | 中 |
| エッジケース | TC-EDGE-004 | historyが空配列の場合 | 低 |
| エッジケース | TC-EDGE-005 | テストフレームワーク出力パターンが未対応の場合 | 中 |
| エッジケース | TC-EDGE-006 | プレースホルダーが二重に存在する場合 | 低 |
| パフォーマンス | TC-PERF-001 | design-validator実行時間（キャッシュヒット） | 中 |
| パフォーマンス | TC-PERF-002 | test-authenticity実行時間 | 低 |
| パフォーマンス | TC-PERF-003 | workflow_next全体の実行時間 | 中 |

### 環境変数設定表

| 環境変数名 | デフォルト値 | 説明 | テスト時の設定 |
|-----------|------------|------|--------------|
| DESIGN_VALIDATION_STRICT | true | design-validator厳格モード | テストごとにtrue/falseを切り替え |
| TEST_AUTHENTICITY_STRICT | true | test-authenticity厳格モード | テストごとにtrue/falseを切り替え |
| AST_CACHE_MAX_ENTRIES | 1000 | LRUキャッシュの最大エントリ数 | デフォルトのまま |
| NODE_ENV | test | Node.js実行環境 | testに固定 |

### モック設定例

#### stateManagerモック

```typescript
const mockStateManager = {
  readTaskState: vi.fn().mockResolvedValue(mockTaskState),
  writeTaskState: vi.fn().mockResolvedValue(true),
};
```

#### auditLoggerモック

```typescript
const mockAuditLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
```

#### ファイルシステムモック

```typescript
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn(),
}));
```

### 期待される実行時間の目標値

| 処理 | 目標時間 | 許容時間 |
|-----|---------|---------|
| resolvePhaseGuide関数 | 1ミリ秒以内 | 5ミリ秒以内 |
| performDesignValidation関数（キャッシュヒット） | 50ミリ秒以内 | 100ミリ秒以内 |
| performDesignValidation関数（キャッシュミス） | 200ミリ秒以内 | 500ミリ秒以内 |
| validateTestAuthenticity関数 | 1ミリ秒以内 | 5ミリ秒以内 |
| workflow_next関数全体 | 100ミリ秒以内 | 200ミリ秒以内 |
| workflow_complete_sub関数全体 | 100ミリ秒以内 | 200ミリ秒以内 |
