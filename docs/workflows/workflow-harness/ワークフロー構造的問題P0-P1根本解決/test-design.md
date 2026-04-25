# テスト設計 - ワークフロー構造的問題P0-P1根本解決

## サマリー

本テスト設計書は、ワークフローシステムの6つの構造的問題を解決するために追加される新規MCPツール群およびバリデーション関数群の品質保証方針を定義する文書である。対象となるのは成果物事前検証ツール、フィードバック記録ツール、キーワードトレーサビリティ検証関数、CLAUDE.md分割配信パーサー、タスク親子関係構築ツール群、task-index.json同期機構の6カテゴリである。これらは全て既存のワークフロー基盤と協調動作するため、統合テストにより実際のフェーズ遷移シナリオでの検証を重視する。単体テストでは各関数の境界値テストとエラーハンドリング網羅を実施し、統合テストでは複数ツールの連携による状態遷移と副作用の正確性を保証する。

成果物事前検証ツールは既存のartifact-validator検証関数群を再利用するため、各検証ルールのパラメータ変動に対する挙動とエラーメッセージの正確性を重点的に確認する。フィードバック記録ツールは追記モードと置換モードの両方でTaskState更新とHMAC署名の整合性を保証する必要がある。キーワードトレーサビリティ検証では異なるドキュメント形式に対する抽出精度とカバレッジ計算の正確性をフィクスチャベースで検証する。CLAUDE.md分割配信ではメモリキャッシュの効率性とセクション抽出の完全性を確認し、タスク親子関係では循環参照防止ロジックの厳密性を多段階階層で検証する。task-index.json同期では全フェーズ遷移APIでの呼び出し網羅性とエラー耐性を保証する。

テスト実行環境は開発環境および継続的統合パイプラインの両方で同一のテストスイートを実行し、回帰防止を実現する。各テストケースは独立して実行可能であり、共有状態によるテスト順序依存を排除する。テストカバレッジ目標は行カバレッジ90パーセント以上、分岐カバレッジ85パーセント以上とし、未カバー箇所は例外的エラーケースのみに限定する。

次フェーズのtest_implではこのテスト設計に基づき、各テストケースに対応するユニットテストおよび統合テストファイルを作成し、実装フェーズに移行する前に全テストが失敗する状態を確認する。

## テスト方針

本プロジェクトのテスト戦略は、ユニットテストと統合テストの2層構造で構成される。ユニットテストは各関数およびツールハンドラーの入力出力契約を検証し、異常系を含む全ての分岐パスをカバーする。統合テストは複数のツール呼び出しを組み合わせた実際のワークフローシナリオを再現し、状態遷移の一貫性とファイルシステムへの副作用を検証する。テスト実装にはTypeScriptのVitestフレームワークを使用し、モック機構によりファイルシステムアクセスを制御する。テスト実行は開発時のローカル環境とCI環境の両方で自動化され、プルリクエスト時に必ず全テストが通過することを要求する。

テスト対象のツール群は既存のWorkflowStateManagerおよびartifact-validator機構と密接に連携するため、これらの外部依存をモックではなく実際のインスタンスとして使用する統合テストを優先する。ただしファイルシステム操作については、テンポラリディレクトリを使用して実環境と分離し、テスト実行後のクリーンアップを保証する。キーワード抽出やCLAUDE.mdパースのような複雑なロジックは、小規模なフィクスチャファイルを用意して期待結果を明示的に定義する。

カバレッジ目標として、行カバレッジは全体の90パーセント以上、分岐カバレッジは85パーセント以上を達成する。未カバー箇所は例外的なファイルシステムエラーやネットワークエラーなど、制御が困難な環境依存エラーに限定し、ビジネスロジックの全分岐は必ずテストで網羅する。環境変数による動作切り替え機構については、環境変数を明示的に設定したテストケースを作成し、厳格モードと非厳格モードの両方の挙動を検証する。

## テストケース

### P0-3: workflow_pre_validateツール

#### TC-PV-001: 正常系全検証合格
- 対象: workflow_pre_validate
- 前提条件: 全ての必須セクションを含み禁止パターンを含まないMarkdownファイルが存在する
- 入力: taskId省略、targetPhaseはrequirements、filePathは検証対象ファイルの絶対パス
- 期待結果: passedがtrue、errors配列が空、checkedRules配列に実行された検証ルール名のリスト、messageに成功メッセージ
- 備考: PhaseGuide定義からrequirements用のrequiredSectionsとminLinesを取得して検証が実行されることを確認

#### TC-PV-002: 必須セクション不足エラー
- 対象: workflow_pre_validate
- 前提条件: サマリーセクションのみ存在しテスト方針セクションが欠落したMarkdownファイルが存在する
- 入力: targetPhaseはtest_design、filePathは不完全なファイル
- 期待結果: passedがfalse、errors配列に不足セクション名を含むエラーメッセージ、checkedRulesに sections_completeness が含まれる
- 備考: requiredSectionsとして「テスト方針」が定義されている場合にエラーが検出されること

#### TC-PV-003: 禁止パターン検出（厳格モード）
- 対象: workflow_pre_validate
- 前提条件: 文中に「未定」という禁止文字列を含むMarkdownファイルが存在し、環境変数VALIDATE_DESIGN_STRICTがtrueまたは未設定
- 入力: targetPhaseはimplementation、filePathは禁止パターンを含むファイル
- 期待結果: passedがfalse、errors配列に禁止パターン検出メッセージと該当行番号、checkedRulesに forbidden_patterns が含まれる
- 備考: 環境変数の影響を確認するためテスト前に明示的にVALIDATE_DESIGN_STRICTを設定

#### TC-PV-004: 禁止パターン検出（非厳格モード）
- 対象: workflow_pre_validate
- 前提条件: 禁止パターンを含むファイルが存在し、環境変数VALIDATE_DESIGN_STRICTがfalse
- 入力: targetPhaseはimplementation、filePathは禁止パターンを含むファイル
- 期待結果: passedがtrue、errors配列が空、warnings配列に禁止パターン警告メッセージ
- 備考: 非厳格モードでは警告に格下げされることを確認

#### TC-PV-005: 最低行数未達エラー
- 対象: workflow_pre_validate
- 前提条件: 必須セクションは全て存在するが本文が5行のみのMarkdownファイルが存在し、minLinesが50行と定義されている
- 入力: targetPhaseはrequirements、filePathは短いファイル
- 期待結果: passedがfalse、errors配列に現在行数と必要行数を含むエラーメッセージ、checkedRulesに minimum_lines が含まれる
- 備考: 空行とコメント行が行数カウントから除外されることを確認

#### TC-PV-006: 重複行検出エラー
- 対象: workflow_pre_validate
- 前提条件: 同一の非構造的行が3回以上繰り返されるMarkdownファイルが存在する
- 入力: targetPhaseはtest_design、filePathは重複行を含むファイル
- 期待結果: passedがfalse、errors配列に重複行内容と出現回数を含むエラーメッセージ、checkedRulesに duplicate_lines が含まれる
- 備考: テーブル行やコードフェンス内は重複判定から除外されることを確認

#### TC-PV-007: ファイル未発見エラー
- 対象: workflow_pre_validate
- 前提条件: 指定されたfilePathに対応するファイルが存在しない
- 入力: filePathは存在しないパス
- 期待結果: passedがfalse、errors配列にファイル未発見メッセージ、checkedRules配列が空
- 備考: ファイル存在確認が検証実行前に行われることを確認

#### TC-PV-008: フェーズ定義未取得時の汎用検証
- 対象: workflow_pre_validate
- 前提条件: 有効なMarkdownファイルが存在するが、targetPhaseに対応するPhaseGuide定義が存在しない
- 入力: targetPhaseは存在しないフェーズ名、filePathは有効なファイル
- 期待結果: passedがtrueまたは汎用ルールでの検証結果、warnings配列にフェーズ定義未発見の警告
- 備考: フェーズ固有の検証がスキップされても最低限の品質確認が実施されることを確認

### P0-1: workflow_record_feedbackツール

#### TC-FB-001: 正常系フィードバック置換
- 対象: workflow_record_feedback
- 前提条件: 既存のTaskStateにuserIntentフィールドが「初回の意図」として設定されている
- 入力: taskId指定、feedbackは「更新された意図」、appendModeはfalseまたは省略
- 期待結果: successがtrue、updatedUserIntentが「更新された意図」、TaskStateのuserIntentが置換されている
- 備考: 既存内容が完全に上書きされることを確認

#### TC-FB-002: 正常系フィードバック追記
- 対象: workflow_record_feedback
- 前提条件: 既存のTaskStateにuserIntentフィールドが「初回の意図」として設定されている
- 入力: taskId指定、feedbackは「追加の補足説明」、appendModeはtrue
- 期待結果: successがtrue、updatedUserIntentが「初回の意図改行改行追加の補足説明」の形式、TaskStateのuserIntentに追記されている
- 備考: 改行が2つ挿入されて自然な段落区切りが保たれることを確認

#### TC-FB-003: 初回フィードバック記録
- 対象: workflow_record_feedback
- 前提条件: TaskStateのuserIntentフィールドがundefinedまたは空文字列
- 入力: feedbackは「初回のフィードバック」、appendModeはfalse
- 期待結果: successがtrue、updatedUserIntentが「初回のフィードバック」、TaskStateのuserIntentが新規設定されている
- 備考: userIntentが未設定の場合も正常に動作することを確認

#### TC-FB-004: フィードバック空文字エラー
- 対象: workflow_record_feedback
- 前提条件: 有効なtaskIdが存在する
- 入力: feedbackは空文字列または空白文字のみ
- 期待結果: successがfalse、messageに空文字エラーメッセージ、TaskStateは変更されない
- 備考: バリデーションが入力時に実行されることを確認

#### TC-FB-005: フィードバック長超過エラー
- 対象: workflow_record_feedback
- 前提条件: 有効なtaskIdが存在する
- 入力: feedbackは10001文字以上の文字列
- 期待結果: successがfalse、messageに文字数超過エラーと現在の文字数、TaskStateは変更されない
- 備考: 最大長制限が正しく機能することを確認

#### TC-FB-006: タスク未発見エラー
- 対象: workflow_record_feedback
- 前提条件: 指定されたtaskIdに対応するTaskStateが存在しない
- 入力: 存在しないtaskId、feedbackは有効な文字列
- 期待結果: successがfalse、messageにタスク未発見エラー、ファイルシステムへの書き込みなし
- 備考: TaskState読み込み失敗時のエラーハンドリングを確認

#### TC-FB-007: セッショントークン検証成功
- 対象: workflow_record_feedback
- 前提条件: 有効なTaskStateとセッショントークンが存在する
- 入力: sessionTokenは有効なトークン、feedbackは有効な文字列
- 期待結果: successがtrue、updatedUserIntentが返却される、TaskStateが更新される
- 備考: セッショントークンが正しい場合にフィードバック記録が許可されることを確認

#### TC-FB-008: セッショントークン検証失敗
- 対象: workflow_record_feedback
- 前提条件: 有効なTaskStateが存在するが、指定されたsessionTokenが不正
- 入力: sessionTokenは不正なトークン、feedbackは有効な文字列
- 期待結果: successがfalse、messageにトークン不正エラー、TaskStateは変更されない
- 備考: 不正トークンでの操作が拒否されることを確認

#### TC-FB-009: HMAC署名更新確認
- 対象: workflow_record_feedback
- 前提条件: 有効なTaskStateが存在する
- 入力: feedbackは有効な文字列、appendModeはfalse
- 期待結果: successがtrue、TaskStateのstateIntegrityフィールドが更新前と異なる値になっている
- 備考: userIntent更新時にHMAC署名が再計算されることを確認

### P0-2: validateKeywordTraceability関数

#### TC-KW-001: 正常系高カバレッジ
- 対象: validateKeywordTraceability
- 前提条件: requirements.mdに10個の技術キーワードが含まれ、spec.mdに9個が参照されている
- 入力: docsDirはテスト用ドキュメントディレクトリ、sourcePhaseはrequirements、targetPhaseはspec、minCoverageは0.8
- 期待結果: passedがtrue、coverageが0.9、missingKeywords配列に1個のキーワード、errors配列が空
- 備考: カバレッジスコアが閾値を上回る場合に検証が成功することを確認

#### TC-KW-002: カバレッジ低下エラー（厳格モード）
- 対象: validateKeywordTraceability
- 前提条件: requirements.mdに10個のキーワード、spec.mdに7個のみ参照され、環境変数SEMANTIC_TRACE_STRICTがtrue
- 入力: sourcePhaseはrequirements、targetPhaseはspec、minCoverageは0.8
- 期待結果: passedがfalse、coverageが0.7、missingKeywords配列に3個のキーワード、errors配列にカバレッジ不足エラー
- 備考: 厳格モードではカバレッジ不足がエラーとして扱われることを確認

#### TC-KW-003: カバレッジ低下警告（非厳格モード）
- 対象: validateKeywordTraceability
- 前提条件: 同上だが環境変数SEMANTIC_TRACE_STRICTがfalse
- 入力: sourcePhaseはrequirements、targetPhaseはspec、minCoverageは0.8
- 期待結果: passedがtrue、coverageが0.7、missingKeywords配列に3個のキーワード、warnings配列にカバレッジ不足警告
- 備考: 非厳格モードではカバレッジ不足が警告に格下げされることを確認

#### TC-KW-004: ソースファイル未発見エラー
- 対象: validateKeywordTraceability
- 前提条件: 指定されたdocsDirにrequirements.mdが存在しない
- 入力: sourcePhaseはrequirements、targetPhaseはspec
- 期待結果: passedがfalse、errors配列にソースファイル未発見メッセージとファイルパス
- 備考: ソースドキュメント読み込み失敗時のエラーハンドリングを確認

#### TC-KW-005: ターゲットファイル未発見エラー
- 対象: validateKeywordTraceability
- 前提条件: requirements.mdは存在するがspec.mdが存在しない
- 入力: sourcePhaseはrequirements、targetPhaseはspec
- 期待結果: passedがfalse、errors配列にターゲットファイル未発見メッセージとファイルパス
- 備考: ターゲットドキュメント読み込み失敗時のエラーハンドリングを確認

#### TC-KW-006: キーワード抽出処理の正確性
- 対象: validateKeywordTraceability
- 前提条件: requirements.mdに技術キーワード、一般的な動詞、冠詞、接続詞が混在している
- 入力: sourcePhaseはrequirements、targetPhaseはspec
- 期待結果: 抽出されたキーワードに技術用語のみが含まれ、停止語が除外されていることをmissingKeywords配列の内容から確認可能
- 備考: キーワード抽出ロジックの品詞フィルタリングが正しく機能することを確認

#### TC-KW-007: implementation対象の複数ファイル走査
- 対象: validateKeywordTraceability
- 前提条件: test-design.mdに5個のキーワード、実装ディレクトリ配下の3ファイルに分散して参照されている
- 入力: sourcePhaseはtest-design、targetPhaseはimplementation
- 期待結果: passedがtrue、coverageが1.0、全ファイルが走査されてキーワードが発見される
- 備考: implementation検証時にディレクトリ再帰走査が実行されることを確認

#### TC-KW-008: カバレッジ100パーセント達成
- 対象: validateKeywordTraceability
- 前提条件: requirements.mdの全キーワードがspec.md内で1回以上参照されている
- 入力: sourcePhaseはrequirements、targetPhaseはspec、minCoverageは0.8
- 期待結果: passedがtrue、coverageが1.0、missingKeywords配列が空
- 備考: 完全なトレーサビリティが達成された場合の挙動を確認

### P1-1: parseCLAUDEMdByPhase関数

#### CP-001: 正常系セクション抽出
- 対象: parseCLAUDEMdByPhase
- 前提条件: CLAUDE.mdファイルが存在し、researchフェーズ用のセクション見出しが含まれている
- 入力: claudeMdPathはCLAUDE.mdの絶対パス、phaseNameはresearch
- 期待結果: contentに抽出されたMarkdownテキスト、sections配列に「調査フェーズ」などの見出し名、errors配列が空
- 備考: セクションマッピング定義に従って正しく抽出されることを確認

#### CP-002: メモリキャッシュヒット
- 対象: parseCLAUDEMdByPhase
- 前提条件: 同一フェーズに対して既に1回パース処理を実行済み
- 入力: claudeMdPathとphaseNameは前回と同一
- 期待結果: ファイル読み込みが実行されずキャッシュから即座に結果が返却される（実行時間が大幅に短縮される）
- 備考: メモリキャッシュ機構が正しく動作することを確認

#### CP-003: ファイル未発見エラー
- 対象: parseCLAUDEMdByPhase
- 前提条件: 指定されたclaudeMdPathにファイルが存在しない
- 入力: claudeMdPathは存在しないパス、phaseNameは有効
- 期待結果: contentがundefined、errors配列にファイル未発見メッセージと環境変数確認の促し
- 備考: ファイル不在時のエラーハンドリングを確認

#### CP-004: セクション未発見エラー
- 対象: parseCLAUDEMdByPhase
- 前提条件: CLAUDE.mdは存在するが指定フェーズに対応するセクションが含まれていない
- 入力: phaseNameはセクション定義に存在しないフェーズ
- 期待結果: contentに簡潔なエラーメッセージ、errors配列にセクション未発見メッセージとフェーズ名、sections配列が空
- 備考: セクションマッピングに該当がない場合のエラーハンドリングを確認

#### CP-005: 複数セクション連結
- 対象: parseCLAUDEMdByPhase
- 前提条件: implementationフェーズに対応するセクションが3つ定義されており、全て存在する
- 入力: phaseNameはimplementation
- 期待結果: contentに3セクション全ての本文が改行2つ区切りで連結されている、sections配列に3つの見出し名
- 備考: 複数セクション抽出時の連結処理が正しく実行されることを確認

#### CP-006: エンコーディングエラー
- 対象: parseCLAUDEMdByPhase
- 前提条件: CLAUDE.mdがUTF-8以外のエンコーディングで保存されている
- 入力: claudeMdPathは非UTF-8ファイルのパス
- 期待結果: contentがundefined、errors配列にエンコーディングエラーメッセージ
- 備考: エンコーディング不整合時のエラーハンドリングを確認

#### CP-007: Markdown見出し階層解析
- 対象: parseCLAUDEMdByPhase
- 前提条件: CLAUDE.mdに階層化された見出しが存在し、特定セクション配下のサブセクションも含める必要がある
- 入力: phaseNameは階層化されたセクションを持つフェーズ
- 期待結果: contentに親見出し配下の全サブセクションが含まれている
- 備考: 見出し階層を正しく認識して範囲抽出が実行されることを確認

### P1-2: workflow_create_subtaskツール

#### TC-CS-001: 正常系サブタスク作成
- 対象: workflow_create_subtask
- 前提条件: 有効な親タスクが存在する
- 入力: parentTaskIdは既存タスクID、subtaskNameは「サブタスクA」、taskSizeはmedium
- 期待結果: successがtrue、返却されたtaskIdが一意、phaseがresearch、parentTaskIdが指定値と一致、親タスクのchildTaskIds配列に新規タスクIDが追加されている
- 備考: 親子両方のTaskStateが正しく更新されることを確認

#### TC-CS-002: 親タスク未発見エラー
- 対象: workflow_create_subtask
- 前提条件: 指定されたparentTaskIdに対応するタスクが存在しない
- 入力: parentTaskIdは存在しないID、subtaskNameは有効
- 期待結果: successがfalse、messageに親タスク未発見エラー、ファイルシステムへの書き込みなし
- 備考: 親タスク存在確認が最初に実行されることを確認

#### TC-CS-003: サブタスク名長超過エラー
- 対象: workflow_create_subtask
- 前提条件: 有効な親タスクが存在する
- 入力: subtaskNameは101文字以上の文字列
- 期待結果: successがfalse、messageにサブタスク名長超過エラーと現在の文字数、ファイルシステムへの書き込みなし
- 備考: サブタスク名長検証が実行されることを確認

#### TC-CS-004: セッショントークン検証成功
- 対象: workflow_create_subtask
- 前提条件: 有効な親タスクとセッショントークンが存在する
- 入力: sessionTokenは有効なトークン、subtaskNameは有効
- 期待結果: successがtrue、サブタスクが正常に作成される
- 備考: 正しいトークンでの操作が許可されることを確認

#### TC-CS-005: セッショントークン検証失敗
- 対象: workflow_create_subtask
- 前提条件: 有効な親タスクが存在するが、sessionTokenが不正
- 入力: sessionTokenは不正なトークン、subtaskNameは有効
- 期待結果: successがfalse、messageにトークン不正エラー、ファイルシステムへの書き込みなし
- 備考: 不正トークンでの操作が拒否されることを確認

#### TC-CS-006: 複数サブタスク作成
- 対象: workflow_create_subtask
- 前提条件: 有効な親タスクが存在する
- 入力: 同一parentTaskIdに対して2回連続でworkflow_create_subtaskを実行、subtaskNameはそれぞれ「サブA」「サブB」
- 期待結果: 両方successがtrue、親タスクのchildTaskIds配列に2個のタスクIDが追加順で格納されている
- 備考: 複数サブタスクの追加が正しく処理されることを確認

#### TC-CS-007: タスクサイズ不正エラー
- 対象: workflow_create_subtask
- 前提条件: 有効な親タスクが存在する
- 入力: taskSizeは「invalid」など無効な値
- 期待結果: successがfalse、messageにタスクサイズ不正エラー、有効な値の例示
- 備考: タスクサイズバリデーションが実行されることを確認

#### TC-CS-008: HMAC署名更新確認
- 対象: workflow_create_subtask
- 前提条件: 有効な親タスクが存在する
- 入力: subtaskNameは有効、taskSizeはmedium
- 期待結果: successがtrue、親タスクと新規子タスクの両方のstateIntegrityフィールドが設定されている
- 備考: 親子両方のHMAC署名が正しく計算されることを確認

### P1-3: workflow_link_tasksツール

#### TC-LT-001: 正常系タスクリンク
- 対象: workflow_link_tasks
- 前提条件: 親タスクと子タスクが両方存在し、いずれもリンク未設定
- 入力: parentTaskIdとchildTaskIdはそれぞれ既存タスクID
- 期待結果: successがtrue、親タスクのchildTaskIds配列に子タスクIDが追加、子タスクのparentTaskIdに親タスクIDが設定、両方のtaskTypeが適切に更新されている
- 備考: 双方向リンクが正しく確立されることを確認

#### TC-LT-002: 自己参照エラー
- 対象: workflow_link_tasks
- 前提条件: 有効なタスクが存在する
- 入力: parentTaskIdとchildTaskIdが同一のタスクID
- 期待結果: successがfalse、messageに自己参照エラー、ファイルシステムへの書き込みなし
- 備考: 自己参照が事前に検出されることを確認

#### TC-LT-003: 循環参照検出エラー
- 対象: workflow_link_tasks
- 前提条件: タスクA、B、Cが存在し、A→B→Cの親子関係が既に確立されている
- 入力: parentTaskIdはC、childTaskIdはA（逆向きリンクを試みる）
- 期待結果: successがfalse、messageに循環参照検出エラーと祖先チェーン情報、ファイルシステムへの書き込みなし
- 備考: 多段階の祖先チェーンを辿って循環参照が検出されることを確認

#### TC-LT-004: 既存リンクエラー
- 対象: workflow_link_tasks
- 前提条件: 親タスクのchildTaskIds配列に既に子タスクIDが含まれている
- 入力: 既存リンクと同一のparentTaskIdとchildTaskId
- 期待結果: successがfalse、messageに既にリンク済みエラー、ファイルシステムへの書き込みなし
- 備考: 重複リンクが防止されることを確認

#### TC-LT-005: 既存親エラー
- 対象: workflow_link_tasks
- 前提条件: 子タスクのparentTaskIdに既に別の親タスクIDが設定されている
- 入力: childTaskIdは既存親を持つタスク、parentTaskIdは新しい親
- 期待結果: successがfalse、messageに既存親エラーと現在の親タスクID、ファイルシステムへの書き込みなし
- 備考: 子タスクが複数の親を持つことが防止されることを確認

#### TC-LT-006: 親タスク未発見エラー
- 対象: workflow_link_tasks
- 前提条件: 子タスクは存在するが親タスクが存在しない
- 入力: parentTaskIdは存在しないID、childTaskIdは有効
- 期待結果: successがfalse、messageに親タスク未発見エラー、ファイルシステムへの書き込みなし
- 備考: 両タスク存在確認が最初に実行されることを確認

#### TC-LT-007: 子タスク未発見エラー
- 対象: workflow_link_tasks
- 前提条件: 親タスクは存在するが子タスクが存在しない
- 入力: parentTaskIdは有効、childTaskIdは存在しないID
- 期待結果: successがfalse、messageに子タスク未発見エラー、ファイルシステムへの書き込みなし
- 備考: 両タスク存在確認が最初に実行されることを確認

#### TC-LT-008: セッショントークン検証
- 対象: workflow_link_tasks
- 前提条件: 親子タスクが両方存在し、sessionTokenが指定されている
- 入力: sessionTokenは有効または不正なトークン
- 期待結果: 有効な場合はsuccessがtrue、不正な場合はsuccessがfalseでトークン不正エラー
- 備考: セッショントークン検証が実行されることを確認

#### TC-LT-009: 最大階層深度チェック
- 対象: workflow_link_tasks
- 前提条件: タスクA→B→C→D→Eの5階層が既に確立されている
- 入力: parentTaskIdはE、childTaskIdは新規タスクF（6階層目を試みる）
- 期待結果: successがfalseまたは環境変数MAX_TASK_DEPTHの設定に応じた結果
- 備考: 階層深度制限が正しく機能することを確認（仕様に階層制限がある場合のみ）

### P1-4: task-index.json同期機構

#### TC-IS-001: workflow_next呼び出し時の同期
- 対象: updateTaskIndexForSingleTask（workflow_nextから間接呼び出し）
- 前提条件: 有効なタスクが存在しresearchフェーズにある
- 入力: workflow_nextを実行してrequirementsフェーズに遷移
- 期待結果: task-index.jsonの該当エントリのphaseフィールドがrequirementsに更新される、timestampが更新される
- 備考: フェーズ遷移直後にインデックスが同期されることを確認

#### TC-IS-002: workflow_complete_sub呼び出し時の同期
- 対象: updateTaskIndexForSingleTask（workflow_complete_subから間接呼び出し）
- 前提条件: タスクがparallel_analysisフェーズにあり、threat_modelingサブフェーズが未完了
- 入力: workflow_complete_subでthreat_modelingを完了
- 期待結果: task-index.jsonの該当エントリが更新される（phaseは変わらないがtimestampが更新される）
- 備考: サブフェーズ完了時もインデックス同期が実行されることを確認

#### TC-IS-003: workflow_approve呼び出し時の同期
- 対象: updateTaskIndexForSingleTask（workflow_approveから間接呼び出し）
- 前提条件: タスクがdesign_reviewフェーズにある
- 入力: workflow_approveでdesign承認を実行
- 期待結果: task-index.jsonの該当エントリが更新される
- 備考: 承認時もインデックス同期が実行されることを確認

#### TC-IS-004: workflow_back呼び出し時の同期
- 対象: updateTaskIndexForSingleTask（workflow_backから間接呼び出し）
- 前提条件: タスクがimplementationフェーズにある
- 入力: workflow_backでplanningフェーズに巻き戻し
- 期待結果: task-index.jsonの該当エントリのphaseフィールドがplanningに更新される
- 備考: 巻き戻し時もインデックス同期が実行されることを確認

#### TC-IS-005: workflow_reset呼び出し時の同期
- 対象: updateTaskIndexForSingleTask（workflow_resetから間接呼び出し）
- 前提条件: タスクがtestingフェーズにある
- 入力: workflow_resetでresearchフェーズにリセット
- 期待結果: task-index.jsonの該当エントリのphaseフィールドがresearchに更新される
- 備考: リセット時もインデックス同期が実行されることを確認

#### TC-IS-006: 新規エントリ追加
- 対象: updateTaskIndexForSingleTask
- 前提条件: task-index.jsonに該当タスクIDのエントリが存在しない
- 入力: 新規作成されたタスクIDを指定
- 期待結果: task-index.jsonのtasks配列に新規エントリが追加される、schemaVersionがv2である
- 備考: 新規タスクのインデックス登録が正しく実行されることを確認

#### TC-IS-007: 既存エントリ更新
- 対象: updateTaskIndexForSingleTask
- 前提条件: task-index.jsonに該当タスクIDのエントリが既に存在する
- 入力: 既存タスクIDを指定してフェーズ遷移
- 期待結果: task-index.jsonの該当エントリのphaseとtimestampが更新される、taskIdとtaskNameは不変
- 備考: 既存エントリの更新が正しく実行されることを確認

#### TC-IS-008: ファイル読み込みエラー耐性
- 対象: updateTaskIndexForSingleTask
- 前提条件: task-index.jsonが読み込み不可の状態（アクセス権限エラーまたはロック状態）
- 入力: 有効なタスクIDを指定
- 期待結果: 警告ログが出力される、呼び出し元にはエラーが伝播しない、フェーズ遷移処理は継続される
- 備考: インデックス同期失敗がフェーズ遷移を妨げないことを確認

#### TC-IS-009: JSON解析エラー耐性
- 対象: updateTaskIndexForSingleTask
- 前提条件: task-index.jsonが不正なJSON形式で保存されている
- 入力: 有効なタスクIDを指定
- 期待結果: 警告ログが出力される、既存ファイルがバックアップされる、新規インデックスとして再作成される
- 備考: JSON破損時の自動修復機構が動作することを確認

#### TC-IS-010: スキーマバージョン自動アップグレード
- 対象: updateTaskIndexForSingleTask
- 前提条件: task-index.jsonのschemaVersionがv1など古いバージョン
- 入力: 有効なタスクIDを指定
- 期待結果: schemaVersionがv2に自動アップグレードされる、既存エントリは可能な範囲で移行される
- 備考: 後方互換性維持機構が動作することを確認

## テスト用フィクスチャ設計

### フィクスチャディレクトリ構成

全てのテストフィクスチャはsrc/backend/tests/fixtures/workflow-p0p1/配下に配置し、カテゴリごとにサブディレクトリを作成する。各テストケースは専用のサブディレクトリ内で独立したファイルセットを使用し、テスト間の干渉を防止する。テスト実行前にフィクスチャをテンポラリディレクトリにコピーし、テスト完了後にクリーンアップする。

#### pre-validate-fixtures サブディレクトリ
成果物事前検証ツールのテストに使用するMarkdownファイル群を格納する。完全なドキュメント、セクション不足ドキュメント、禁止パターン含有ドキュメント、短すぎるドキュメント、重複行含有ドキュメントの5種類を用意する。各ファイルは対応するテストケース番号を接頭辞として命名する。

#### keyword-fixtures サブディレクトリ
キーワードトレーサビリティ検証のテストに使用するドキュメントセットを格納する。requirements.md、spec.md、test-design.mdの組み合わせを複数パターン用意し、高カバレッジ、低カバレッジ、完全カバレッジの各シナリオを再現可能にする。各ドキュメントには明示的な技術キーワードを埋め込み、期待されるカバレッジスコアをファイル名のコメントに記載する。

#### claude-md-fixtures サブディレクトリ
CLAUDE.mdパーサーのテストに使用するCLAUDE.mdファイル群を格納する。完全な見出し構造を持つファイル、一部セクションが欠落したファイル、深い階層構造を持つファイル、非UTF-8エンコーディングのファイルの4種類を用意する。各ファイルには特定フェーズのセクションを含め、期待される抽出結果を別ファイルとして保存する。

#### task-state-fixtures サブディレクトリ
タスク親子関係およびフィードバック記録のテストに使用するTaskState JSONファイル群を格納する。親タスク、子タスク、スタンドアロンタスク、既存リンクを持つタスク、循環参照を形成するタスクチェーンの5種類を用意する。各TaskStateファイルにはテスト実行前の初期状態を記録し、テスト後に期待される最終状態を別ファイルとして保存する。

#### task-index-fixtures サブディレクトリ
task-index.json同期機構のテストに使用するインデックスファイル群を格納する。空のインデックス、既存エントリを持つインデックス、古いスキーマバージョンのインデックス、破損したJSON形式のインデックスの4種類を用意する。各ファイルにはテスト実行後の期待される状態を別ファイルとして保存する。

### モック戦略

本プロジェクトのテスト実装ではファイルシステム操作を実際に実行するため、モック対象は最小限に留める。モックするのは環境変数読み込み、現在時刻取得、外部APIアクセスの3カテゴリのみである。環境変数読み込みはprocess.envオブジェクトのモック化により、各テストケースで独立した環境変数設定を可能にする。現在時刻取得はDate.nowのモック化により、タイムスタンプ検証の安定性を保証する。外部APIアクセスは該当機能がないため不要だが、将来的な拡張に備えてモック基盤を用意する。

WorkflowStateManagerおよびartifact-validatorは実際のインスタンスを使用し、ファイルシステムアクセスもテンポラリディレクトリに対して実行する。これにより統合テストとしての信頼性を高め、実環境との乖離を最小化する。各テストケース実行前にテンポラリディレクトリを初期化し、テスト完了後に全ファイルを削除する。テスト失敗時はテンポラリディレクトリを保持し、デバッグ用にファイル内容を確認可能にする。

### 期待結果の定義方法

各テストケースの期待結果は、アサーションライブラリのexpect関数を使用して明示的に記述する。返却値の型検証、フィールド値の完全一致検証、配列要素の包含検証、ファイルシステムへの副作用検証の4種類のアサーションを組み合わせる。返却値の型検証ではTypeScriptの型定義と実行時の値が一致することを確認する。フィールド値の完全一致検証では、passedやsuccessなどのブール値フィールドおよびcoverageなどの数値フィールドが期待値と完全に一致することを確認する。

配列要素の包含検証では、errors配列やwarnings配列に特定のキーワードを含むメッセージが存在することを確認する。完全一致ではなく部分一致とすることで、エラーメッセージの微細な変更に対してテストが脆弱にならないようにする。ファイルシステムへの副作用検証では、TaskStateファイルやtask-index.jsonファイルが期待される内容で更新されていることを、ファイル読み込みとJSON解析により確認する。HMAC署名については署名値そのものではなく、stateIntegrityフィールドが未定義でないことのみを確認する。

## テスト実行環境

### 開発環境でのテスト実行

開発者のローカル環境では、ルートディレクトリでnpm testコマンドを実行することで全テストスイートを実行可能にする。Vitestはファイルウォッチモードをデフォルトで有効化し、ソースコード変更時に関連テストのみを自動再実行する。テスト実行前にworkflow-plugin/mcp-server/ディレクトリ配下でTypeScriptビルドを実行し、最新のdist出力を使用する。環境変数VALIDATE_DESIGN_STRICTおよびSEMANTIC_TRACE_STRICTは未設定の状態で開始し、各テストケース内で明示的に設定する。

テスト結果はターミナルに色分けされたサマリーとして表示され、失敗したテストケースの詳細情報を即座に確認可能にする。カバレッジレポートはHTML形式で出力し、ブラウザで視覚的にカバレッジ状況を確認する。未カバー箇所は行単位でハイライト表示され、追加すべきテストケースを特定しやすくする。テスト実行時間は全体で3分以内を目標とし、遅いテストケースは並列実行またはモック化により高速化する。

### 継続的統合パイプラインでのテスト実行

GitHubアクションまたは同等のCI環境では、プルリクエスト作成時および主要ブランチへのプッシュ時に自動的に全テストを実行する。テスト実行環境はUbuntu最新LTSバージョンのDockerコンテナとし、Node.js最新LTSバージョンを使用する。環境変数は本番環境と同一の設定とし、厳格モードでのテスト実行を保証する。テスト失敗時はCIビルドを失敗させ、プルリクエストのマージをブロックする。

カバレッジレポートはCI環境でも生成し、カバレッジバッジとしてREADMEに表示する。カバレッジが目標値を下回る場合は警告を表示し、開発者に追加テストの作成を促す。テスト実行ログはCI環境のアーティファクトとして保存し、失敗時のデバッグを容易にする。テスト実行時間は5分以内を目標とし、タイムアウト設定により無限ループなどの問題を早期に検出する。

## カバレッジ目標

行カバレッジ目標は全体の90パーセント以上とし、ビジネスロジックを含む全モジュールで達成する。分岐カバレッジ目標は85パーセント以上とし、条件分岐の両方のパスを網羅する。関数カバレッジ目標は95パーセント以上とし、全ての公開関数およびツールハンドラーを少なくとも1回は実行する。未カバー箇所は例外的なファイルシステムエラーやネットワークエラーなど、制御が困難な環境依存エラーに限定し、全ての正常系および異常系のビジネスロジックは必ずテストで網羅する。

新規追加されるツール群については100パーセントの行カバレッジを目指し、全ての入力バリデーションとエラーハンドリングをテストケースでカバーする。既存のartifact-validator関数群については、本プロジェクトで追加される拡張部分のみをカバレッジ計測対象とし、既存部分は既存テストに委ねる。統合テストでは状態遷移の全パターンをカバーし、TaskStateファイルおよびtask-index.jsonファイルへの副作用が正しく実行されることを保証する。

## テストデータ管理

テストデータは全てフィクスチャディレクトリ配下にバージョン管理され、テストコードと同一のGitリポジトリに格納される。フィクスチャファイルの変更はコードレビューの対象とし、期待結果との整合性を保証する。テスト実行時にフィクスチャを動的に生成する場合は、生成ロジックをテストコード内に明示的に記述し、可読性を維持する。大規模なバイナリファイルはフィクスチャに含めず、テスト実行時に動的に生成するかURLからダウンロードする。

個人情報や機密情報を含むテストデータは使用せず、全て架空のダミーデータとする。TaskStateのuserIntentフィールドにはサンプルテキストを使用し、実際のユーザーフィードバックは含めない。CLAUDE.mdのフィクスチャには本プロジェクトのCLAUDE.mdを簡略化したものを使用し、著作権やライセンス問題が発生しないようにする。フィクスチャファイルのエンコーディングは全てUTF-8とし、改行コードはLFに統一する。
