# 要件定義 - ワークフロー構造的問題P0-P1根本解決

## サマリー

本要件定義では、ワークフローシステムにおける6つの構造的問題を根本解決するための詳細仕様を策定する。

最優先であるP0-3は、Orchestratorがsubagent出力をworkflow_next呼び出し前に検証可能にするworkflow_pre_validateツールの追加により、フェーズ遷移失敗を未然に防止する。P0-1は、各フェーズでのユーザーフィードバック記録を可能にするworkflow_record_feedbackツールを追加し、複雑なタスクにおける意図の補足説明を実現する。P0-2は、requirements→spec→test-design→implementation間のキーワードトレーサビリティ検証により、設計と実装の乖離を防止する。

次にP1系の問題に取り組む。P1-1は、CLAUDE.mdをフェーズ別にパースし、PhaseGuideのcontentフィールドで必要なセクションのみを配信することで、subagentのトークン消費を削減する。P1-2は、タスク親子関係の導入により、大規模タスクの階層的管理を実現する。P1-3は、全フェーズ遷移APIでupdateTaskIndexForSingleTask呼び出しを保証し、task-index.jsonの同期問題を根本解決する。

全ての変更は後方互換性を維持し、セッショントークン検証によるセキュリティを保ち、環境変数による動作制御を可能にする設計とする。

## 機能要件

### REQ-P03-1: 成果物事前検証ツール（workflow_pre_validate）

**優先度:** P0（最優先）

**説明:**
Orchestratorがworkflow_nextを呼ぶ前にsubagent出力の品質を検証するツールを提供する。requiredSections、禁止パターン、最低行数などのフェーズ固有要件を事前チェックし、問題があればエラー詳細を返却することで、フェーズ遷移失敗を未然に防止する。

**入力:**
- taskId: タスクID（オプショナル、省略時はアクティブタスク）
- targetPhase: 検証対象フェーズ名（必須）
- filePath: 検証対象ファイルパス（相対パスまたは絶対パス、必須）
- sessionToken: セッショントークン（オプショナル）

**出力:**
- passed: 検証成功フラグ（真偽値）
- errors: エラーメッセージ配列（空配列は成功を意味）
- warnings: 警告メッセージ配列（オプショナル）
- checkedRules: 実行された検証ルール名の配列
- message: 結果サマリー文字列

**受入条件:**
1. workflow_pre_validateツールがCLI実行可能である
2. requiredSectionsの欠落を検出できる
3. 禁止パターン（未定、今後、ダミー等）を検出できる
4. 最低行数要件の違反を検出できる
5. 重複行検出ロジックが既存のartifact-validatorと一致する
6. セッショントークン検証が正常に機能する
7. ファイルが存在しない場合は明確なエラーメッセージを返す
8. 検証成功時にはpassedフラグがtrueである
9. 検証失敗時にはerrorsに具体的な理由が記載される
10. PhaseGuide定義のminLines、requiredSections、禁止パターンを参照する

**影響するファイル:**
- workflow-plugin/mcp-server/src/tools/pre-validate.ts（新規作成）
- workflow-plugin/mcp-server/src/server.ts（TOOL_DEFINITIONS、TOOL_HANDLERS追加）
- workflow-plugin/mcp-server/src/validation/artifact-validator.ts（既存検証ロジックを再利用）
- workflow-plugin/mcp-server/src/types.ts（PreValidateResult型定義追加）

---

### REQ-P01-1: ユーザーフィードバック記録ツール（workflow_record_feedback）

**優先度:** P0

**説明:**
各フェーズでユーザーが追加の意図や補足説明を記録できるツールを提供する。TaskStateのuserIntentフィールドを更新し、subagentに渡されるコンテキストを動的に補完する。

**入力:**
- taskId: タスクID（オプショナル、省略時はアクティブタスク）
- feedback: ユーザーのフィードバック内容（必須、10000文字まで）
- appendMode: 追記モードフラグ（真偽値、省略時はfalse=置換モード）
- sessionToken: セッショントークン（オプショナル）

**出力:**
- success: 成功フラグ（真偽値）
- message: 結果メッセージ
- updatedUserIntent: 更新後のuserIntent全文（オプショナル）

**受入条件:**
1. workflow_record_feedbackツールがCLI実行可能である
2. feedbackが10000文字を超える場合はエラーを返す
3. appendModeがtrueの場合、既存userIntentに追記する
4. appendModeがfalseの場合、既存userIntentを置換する
5. セッショントークン検証が正常に機能する
6. 更新後のTaskStateが正しくHMAC署名される
7. workflow_statusで更新後のuserIntentが返却される
8. フェーズによる制限はない（全フェーズで実行可能）
9. 空文字列のfeedbackは拒否される
10. 更新後のupdatedUserIntentが返却される

**影響するファイル:**
- workflow-plugin/mcp-server/src/tools/record-feedback.ts（新規作成）
- workflow-plugin/mcp-server/src/server.ts（TOOL_DEFINITIONS、TOOL_HANDLERS追加）
- workflow-plugin/mcp-server/src/types.ts（RecordFeedbackResult型定義追加）

---

### REQ-P02-1: キーワードトレーサビリティ検証（validateKeywordTraceability）

**優先度:** P0

**説明:**
requirements.md、spec.md、test-design.md、implementation成果物間でキーワードトレーサビリティを検証する機能を追加する。要件定義で使用された専門用語や技術キーワードが後続フェーズで正しく参照されているかを自動検証し、設計と実装の乖離を防止する。

**入力:**
- docsDir: ドキュメントディレクトリパス（必須）
- sourcePhase: トレース元フェーズ名（requirements、spec、test-design等）
- targetPhase: トレース先フェーズ名（spec、test-design、implementation等）
- minCoverage: 最低カバレッジ閾値（0.0から1.0、デフォルト0.8）

**出力:**
- passed: 検証成功フラグ（真偽値）
- coverage: カバレッジスコア（0.0から1.0）
- missingKeywords: トレース先で未参照のキーワード配列
- errors: エラーメッセージ配列
- warnings: 警告メッセージ配列

**受入条件:**
1. validateKeywordTraceability関数が実装される
2. requirements.mdから技術キーワードを抽出できる（名詞句、ドメイン用語、技術用語）
3. spec.mdでのキーワード参照を確認できる
4. test-design.mdでのキーワード参照を確認できる
5. implementation成果物でのキーワード使用を確認できる
6. カバレッジスコアが閾値未満の場合はpassedがfalseになる
7. 環境変数SEMANTIC_TRACE_STRICTでfalseの場合は警告モードで動作する
8. missingKeywordsに未参照キーワードのリストが含まれる
9. キーワード抽出時に冠詞や接続詞を除外する
10. workflow_nextで適切なフェーズ遷移時に自動実行される

**影響するファイル:**
- workflow-plugin/mcp-server/src/validation/artifact-validator.ts（validateKeywordTraceability追加）
- workflow-plugin/mcp-server/src/tools/next.ts（workflow_next内で呼び出し）
- workflow-plugin/mcp-server/src/types.ts（KeywordTraceabilityResult型定義追加）

**統合タイミング:**
- requirements → parallel_analysis遷移時: requirements→specのキーワードトレース
- test_design → test_impl遷移時: spec→test-designのキーワードトレース
- implementation → refactoring遷移時: test-design→implementationのキーワードトレース

---

### REQ-P11-1: CLAUDE.mdフェーズ別パース機構

**優先度:** P1

**説明:**
CLAUDE.mdをフェーズ別セクションに分割するパース機構を実装する。各フェーズに必要なセクション見出しをマッピング定義し、PhaseGuideのcontentフィールドに該当部分のMarkdownテキストを格納する。

**入力:**
- claudeMdPath: CLAUDE.mdファイルパス（デフォルト: CLAUDE.md）
- phaseName: フェーズ名（必須）

**出力:**
- content: 抽出されたMarkdownテキスト（文字列）
- sections: 含まれるセクション見出しの配列
- errors: パースエラー配列

**受入条件:**
1. parseCLAUDEMdByPhase関数が実装される
2. 正規表現によるMarkdown見出しの抽出が可能である
3. フェーズ名とセクション見出しのマッピング定義が存在する
4. researchフェーズには調査関連セクションとAIへの厳命1が含まれる
5. requirementsフェーズには要件定義関連セクションが含まれる
6. test_implフェーズにはTDDサイクルとテスト実装セクションが含まれる
7. implementationフェーズには実装関連とAIへの厳命16-17が含まれる
8. commitフェーズにはコミットルールと完了宣言ルールが含まれる
9. 該当セクションが見つからない場合はエラーを返す
10. パース結果はメモリキャッシュに保存される

**影響するファイル:**
- workflow-plugin/mcp-server/src/phases/claude-md-parser.ts（新規作成）
- workflow-plugin/mcp-server/src/phases/claude-md-sections.ts（マッピング定義、新規作成）
- workflow-plugin/mcp-server/src/types.ts（PhaseGuideインターフェースにcontent、claudeMdSectionsフィールド追加）

---

### REQ-P11-2: PhaseGuideへのCLAUDE.md配信統合

**優先度:** P1

**説明:**
resolvePhaseGuide関数にCLAUDE.mdパース機構を統合し、PhaseGuideレスポンスにcontentフィールドを追加する。workflow_statusとworkflow_nextで返却されるphaseGuideに該当セクションのみが含まれる。

**入力:**
- phase: フェーズ名（必須）
- docsDir: ドキュメントディレクトリパス（オプショナル）

**出力:**
- PhaseGuide型のオブジェクト（contentフィールド追加版）

**受入条件:**
1. resolvePhaseGuide関数がcontentフィールドを含むPhaseGuideを返す
2. contentにはフェーズに必要なセクションのみが含まれる
3. workflow_statusレスポンスのphaseGuideにcontentが含まれる
4. workflow_nextレスポンスのphaseGuideにcontentが含まれる
5. CLAUDE.mdファイルが見つからない場合はcontentがundefinedになる
6. パースエラー時はcontent内にエラーメッセージが含まれる
7. 並列フェーズではsubPhasesの各PhaseGuideにcontentが含まれる
8. contentフィールドはオプショナルであり、既存動作との後方互換性がある
9. claudeMdSectionsフィールドに含まれるセクション名の配列が格納される
10. 初回実行時にパース結果がメモリキャッシュされ、2回目以降は高速化される

**影響するファイル:**
- workflow-plugin/mcp-server/src/phases/definitions.ts（resolvePhaseGuide更新）
- workflow-plugin/mcp-server/src/tools/status.ts（PhaseGuide返却箇所）
- workflow-plugin/mcp-server/src/tools/next.ts（PhaseGuide返却箇所）
- workflow-plugin/mcp-server/src/types.ts（PhaseGuide型更新）

---

### REQ-P12-1: タスク親子関係の型定義拡張

**優先度:** P1

**説明:**
TaskStateインターフェースに親子関係フィールドを追加する。parentTaskId、childTaskIds、taskTypeフィールドにより、タスク階層を表現可能にする。

**入力:**
既存のTaskStateインターフェース

**出力:**
拡張されたTaskStateインターフェース

**受入条件:**
1. parentTaskIdフィールドが追加される（文字列型、オプショナル）
2. childTaskIdsフィールドが追加される（文字列配列型、オプショナル）
3. taskTypeフィールドが追加される（parent、child、standaloneのいずれか、オプショナル）
4. 既存タスクではtaskTypeがundefinedまたはstandaloneとして扱われる
5. 親子関係フィールドはHMAC署名の対象となる
6. childTaskIdsは空配列で初期化される
7. parentTaskIdが設定されている場合はtaskTypeがchildである
8. childTaskIdsが空でない場合はtaskTypeがparentである
9. taskTypeがstandaloneの場合はparentTaskIdとchildTaskIdsが両方undefinedまたは空である
10. TaskState型のスキーマバリデーション（将来的なZod導入）に対応可能な設計である

**影響するファイル:**
- workflow-plugin/mcp-server/src/types.ts（TaskStateインターフェース拡張）

---

### REQ-P12-2: サブタスク作成ツール（workflow_create_subtask）

**優先度:** P1

**説明:**
親タスクの下にサブタスクを作成するツールを提供する。親タスクのchildTaskIdsに新規タスクIDを追加し、サブタスクのparentTaskIdに親IDを設定する。

**入力:**
- parentTaskId: 親タスクID（必須）
- subtaskName: サブタスク名（必須、100文字まで）
- taskSize: サブタスクサイズ（small、medium、large、オプショナル、デフォルトはmedium）
- sessionToken: セッショントークン（オプショナル）

**出力:**
- success: 成功フラグ（真偽値）
- taskId: 作成されたサブタスクID
- taskName: サブタスク名
- phase: 初期フェーズ（research）
- parentTaskId: 親タスクID
- message: 結果メッセージ

**受入条件:**
1. workflow_create_subtaskツールがCLI実行可能である
2. 親タスクが存在しない場合はエラーを返す
3. サブタスク名が100文字を超える場合はエラーを返す
4. セッショントークン検証が正常に機能する
5. サブタスクのtaskTypeがchildに設定される
6. 親タスクのchildTaskIdsに新規タスクIDが追加される
7. サブタスクのparentTaskIdに親タスクIDが設定される
8. 親タスクのtaskTypeがparentに更新される（初回サブタスク作成時）
9. サブタスクはresearchフェーズで開始される
10. 親子両方のTaskStateが正しくHMAC署名される

**影響するファイル:**
- workflow-plugin/mcp-server/src/tools/create-subtask.ts（新規作成）
- workflow-plugin/mcp-server/src/server.ts（TOOL_DEFINITIONS、TOOL_HANDLERS追加）
- workflow-plugin/mcp-server/src/types.ts（CreateSubtaskResult型定義追加）
- workflow-plugin/mcp-server/src/state/manager.ts（createTask関数の拡張）

---

### REQ-P12-3: タスクリンクツール（workflow_link_tasks）

**優先度:** P1

**説明:**
既存の2つのタスクを親子関係でリンクするツールを提供する。既に作成済みのタスクを後から階層化する用途に使用する。

**入力:**
- parentTaskId: 親タスクID（必須）
- childTaskId: 子タスクID（必須）
- sessionToken: セッショントークン（オプショナル）

**出力:**
- success: 成功フラグ（真偽値）
- message: 結果メッセージ

**受入条件:**
1. workflow_link_tasksツールがCLI実行可能である
2. 親タスクが存在しない場合はエラーを返す
3. 子タスクが存在しない場合はエラーを返す
4. セッショントークン検証が親タスクに対して実行される
5. 子タスクのparentTaskIdに親タスクIDが設定される
6. 親タスクのchildTaskIdsに子タスクIDが追加される
7. 循環参照を検出する（childTaskIdが既にparentTaskIdの祖先である場合）
8. 循環参照検出時はエラーを返す
9. 既にリンク済みの場合はエラーを返す
10. 親子両方のTaskStateが正しくHMAC署名される

**影響するファイル:**
- workflow-plugin/mcp-server/src/tools/link-tasks.ts（新規作成）
- workflow-plugin/mcp-server/src/server.ts（TOOL_DEFINITIONS、TOOL_HANDLERS追加）
- workflow-plugin/mcp-server/src/types.ts（LinkTasksResult型定義追加）

---

### REQ-P13-1: task-index.json同期更新の保証

**優先度:** P1

**説明:**
全てのフェーズ遷移APIでupdateTaskIndexForSingleTask関数を呼び出し、task-index.jsonとworkflow-state.jsonの同期を保証する。Hook側のキャッシュ陳腐化問題を根本解決する。

**入力:**
該当なし（内部実装の改善）

**出力:**
該当なし（動作保証）

**受入条件:**
1. workflow_next内でupdateTaskIndexForSingleTask呼び出しが追加される
2. workflow_complete_sub内でupdateTaskIndexForSingleTask呼び出しが追加される
3. workflow_approve内でupdateTaskIndexForSingleTask呼び出しが追加される
4. workflow_back内でupdateTaskIndexForSingleTask呼び出しが追加される
5. workflow_reset内でupdateTaskIndexForSingleTask呼び出しが追加される
6. 各呼び出し箇所でエラーハンドリングが適切に行われる
7. updateTaskIndexForSingleTaskのエラーがフェーズ遷移を妨げない（警告のみ）
8. task-index.jsonのschemaVersionがv2であることを確認する
9. 全フェーズ遷移後にtask-index.jsonが最新状態である
10. Hook側のreadTaskIndexCacheが最新データを取得できる

**影響するファイル:**
- workflow-plugin/mcp-server/src/tools/next.ts（呼び出し追加）
- workflow-plugin/mcp-server/src/tools/complete-sub.ts（呼び出し追加）
- workflow-plugin/mcp-server/src/tools/approve.ts（呼び出し追加）
- workflow-plugin/mcp-server/src/tools/back.ts（呼び出し追加）
- workflow-plugin/mcp-server/src/tools/reset.ts（呼び出し追加）

---

## 非機能要件

### NFR-1: パフォーマンス要件

**説明:**
全ての新規機能は既存ワークフローのパフォーマンスに悪影響を与えてはならない。特にworkflow_nextは頻繁に呼ばれるため、追加される検証処理は500ミリ秒以内に完了する必要がある。

**受入条件:**
1. workflow_pre_validateツールは1秒以内に結果を返す
2. validateKeywordTraceabilityは500ミリ秒以内に完了する
3. parseCLAUDEMdByPhaseの初回実行は1秒以内、2回目以降はキャッシュにより50ミリ秒以内
4. workflow_record_feedbackは100ミリ秒以内に完了する
5. workflow_create_subtaskは200ミリ秒以内に完了する
6. workflow_link_tasksは100ミリ秒以内に完了する
7. updateTaskIndexForSingleTask呼び出しは50ミリ秒以内に完了する
8. 全ての新規バリデーションロジックはメモリキャッシュを活用する
9. CLAUDE.mdパース結果はプロセス起動時から終了までキャッシュされる
10. キーワード抽出結果は同一ファイルに対して再計算しない

---

### NFR-2: 後方互換性

**説明:**
全ての変更は既存タスクとの後方互換性を維持する。既存のTaskStateファイルが新しいコードで正常に読み込めること、新規フィールドがオプショナルであることを保証する。

**受入条件:**
1. 既存タスクのworkflow-state.jsonが新コードで正常に読み込める
2. parentTaskId、childTaskIds、taskTypeフィールドが未定義でもエラーにならない
3. PhaseGuideのcontentフィールドが未定義でも既存動作に影響しない
4. workflow_statusレスポンスに新規フィールドが追加されても既存クライアントが動作する
5. 環境変数SEMANTIC_TRACE_STRICTが未設定でもデフォルト動作が保証される
6. CLAUDE.mdが見つからない場合もphaseGuideの他フィールドは正常に返却される
7. task-index.jsonのschemaVersionがv2未満の場合は自動アップグレードされる
8. 既存タスクのtaskTypeはundefinedまたはstandaloneとして扱われる
9. 新規ツールはオプショナル機能であり、使用しなくても既存ワークフローが動作する
10. HMAC署名は新規フィールドを含めて計算されるが、古いフィールドのみのファイルも検証可能である

---

### NFR-3: セキュリティ要件

**説明:**
全ての新規ツールはセッショントークン検証を実装し、不正な状態変更を防止する。HMAC署名による改ざん防止も維持する。

**受入条件:**
1. workflow_record_feedbackはsessionTokenが正しい場合のみuserIntentを更新する
2. workflow_create_subtaskはsessionTokenが正しい場合のみサブタスクを作成する
3. workflow_link_tasksはsessionTokenが正しい場合のみタスクをリンクする
4. sessionTokenが不正な場合は明確なエラーメッセージを返す
5. TaskStateの全フィールドがHMAC署名の対象となる
6. workflow_pre_validateは読み取り専用であり状態変更を行わない
7. userIntentの最大長は10000文字に制限される
8. subtaskNameの最大長は100文字に制限される
9. 循環参照攻撃を防止する（workflow_link_tasks）
10. 入力バリデーションエラーはスタックトレースを含まない

---

### NFR-4: 拡張性要件

**説明:**
将来的なバリデーションルール追加やフェーズ拡張が容易な設計とする。ハードコードを避け、設定ファイルやマッピング定義で動作を制御できる構造にする。

**受入条件:**
1. CLAUDE.mdセクションマッピングは独立した定義ファイルで管理される
2. キーワード抽出ロジックは関数として分離され、アルゴリズム変更が容易である
3. PhaseGuide拡張時に既存コードへの影響が最小限である
4. 新規バリデーションルール追加時はartifact-validator.tsに関数追加のみで対応可能である
5. タスク親子関係の深さ制限は定数として定義される（デフォルト5階層）
6. 環境変数による動作制御が一元管理される
7. 新規ツール追加時の手順がドキュメント化される
8. TypeScript型定義により、インターフェース変更時のコンパイルエラーで影響箇所が明確になる
9. ユニットテストのモックが容易な設計である
10. ツール定義とハンドラー実装が疎結合である

---

### NFR-5: 保守性要件

**説明:**
全ての新規コードはTypeScriptの型安全性を維持し、適切なエラーハンドリングとログ出力を含む。将来の開発者が理解しやすいコード構造とする。

**受入条件:**
1. 全ての新規関数にJSDoc形式のコメントが記載される
2. 公開APIにはパラメータと戻り値の説明が含まれる
3. エラーメッセージは原因と対処方法を含む
4. 型定義はanyを使用せず、具体的な型を指定する
5. 外部ライブラリ依存は最小限に抑える
6. 複雑な処理は小さな関数に分割される
7. マジックナンバーは定数として定義される
8. CLAUDE.mdパース処理は単体テスト可能な設計である
9. 各ツール関数は単一責任原則に従う
10. 状態管理ロジックはstateManagerクラスに集約される

---

### NFR-6: テスタビリティ要件

**説明:**
全ての新規機能はユニットテストと統合テストで検証可能な設計とする。モック化が容易で、テストカバレッジ80パーセント以上を目標とする。

**受入条件:**
1. workflow_pre_validateのユニットテストが存在する
2. workflow_record_feedbackのユニットテストが存在する
3. validateKeywordTraceabilityのユニットテストが存在する
4. parseCLAUDEMdByPhaseのユニットテストが存在する
5. workflow_create_subtaskの統合テストが存在する
6. workflow_link_tasksの循環参照検出テストが存在する
7. task-index.json同期のレースコンディションテストが存在する
8. 各テストは独立して実行可能である
9. テストデータはfixturesディレクトリで管理される
10. テスト実行時間は全体で30秒以内である

---

### NFR-7: 運用要件

**説明:**
本番環境での動作安定性を確保し、問題発生時の調査を容易にする。ログ出力、エラーレポート、環境変数による動作制御を提供する。

**受入条件:**
1. 全ての新規ツールは実行時にログ出力する
2. エラー発生時はスタックトレースがログに記録される
3. 環境変数SEMANTIC_TRACE_STRICTでキーワードトレーサビリティの厳格モードを制御できる
4. 環境変数CLAUDE_MD_PATHでCLAUDE.mdの配置先をオーバーライドできる
5. task-index.json同期失敗時は警告ログを出力するが処理は継続する
6. CLAUDE.mdパースエラー時はcontentフィールドにエラー情報を含める
7. workflow_pre_validateの検証結果は詳細ログとして記録される
8. 親子関係の循環参照検出時は警告ログを出力する
9. キーワード抽出の統計情報（抽出数、カバレッジ）がログ出力される
10. 全てのツール実行時にtaskIdとphaseが記録される
