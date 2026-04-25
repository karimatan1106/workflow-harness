# planningフェーズ成果物

## サマリー

本仕様書は、ワークフロープラグインのレビューで指摘された3つのCritical Issues（C-1, C-2, C-3）を根本的に解決するための実装仕様を定義する。

**対象Issue:**
- **C-1**: userIntentがsubagentプロンプトに含まれない問題（技術的強制の欠如）
- **C-2**: design-validatorがcode_reviewフェーズで呼び出されない問題（未実装アイテムの通過）
- **C-3**: test-authenticityがワークフロー遷移時に呼び出されない問題（形骸化テストの通過）

**解決方針:**
1. **C-1**: phaseGuideレスポンスメッセージにuserIntent埋め込みの明示文言を追加し、subagentTemplateフィールドに埋め込みテンプレートを提供する
2. **C-2**: workflow_complete_sub（code_review完了時）とworkflow_next（parallel_quality→testing遷移時）にdesign-validator統合を追加する
3. **C-3**: workflow_next（testing→regression_test遷移時、regression_test→parallel_verification遷移時）にtest-authenticity統合を追加する

**実装対象ファイル:**
- `workflow-plugin/mcp-server/src/tools/next.ts`（C-1, C-2, C-3統合）
- `workflow-plugin/mcp-server/src/tools/complete-sub.ts`（C-2統合）
- `workflow-plugin/mcp-server/src/phases/definitions.ts`（C-1: subagentTemplate追加）
- `workflow-plugin/mcp-server/src/state/types.ts`（C-1: PhaseGuide型拡張）

**主要な技術判断:**
- C-1はMCPサーバーがTask toolプロンプトを事前検証できない技術的制約があるため、間接的アプローチ（レスポンスメッセージ強化）を採用する
- C-2とC-3は既存のバリデーター実装を活用し、ワークフロー遷移制御ロジックに統合する
- 全てのバリデーションに環境変数による厳格モード/警告モードの切り替えを提供する（後方互換性保証）

**次フェーズで必要な情報:**
- test_designフェーズ: 統合テストシナリオ（C-2/C-3のブロック確認、環境変数制御確認）
- test_implフェーズ: 単体テストコード作成（新規関数のテスト）
- implementationフェーズ: 本仕様書に基づく実装

---

## 概要

このプロジェクトは、ワークフロープラグインの品質保証機能を強化するための根本的な改善を実施します。
現在の課題として、設計フェーズで定義された内容が実装フェーズで正しく反映されない問題、
テスト実行の真正性が検証されない問題、そしてユーザーの意図がsubagentに正しく伝わらない問題が存在します。
これらはCritical Issues（C-1, C-2, C-3）として識別され、ワークフローの信頼性を損なう要因となっています。
本仕様書では、これら3つの問題に対する技術的な解決策を定義し、実装可能な形で詳細化します。
各Issueに対して、既存システムとの整合性を保ちながら、段階的にロールアウト可能な設計を提供します。

## 変更対象ファイル

本仕様書に基づく実装では、以下のファイルを変更対象とします。
types.tsではPhaseGuide型にsubagentTemplateフィールドを追加し、型レベルでのサポートを確立します。
definitions.tsではPHASE_GUIDESの全フェーズ定義にsubagentTemplateを追加し、resolvePhaseGuide関数でプレースホルダー置換を実装します。
next.tsではworkflow_next関数のレスポンスメッセージを拡充し、C-2とC-3のバリデーション統合を追加します。
complete-sub.tsではworkflow_complete_sub関数にcode_review完了時のdesign-validator統合を追加します。
design-validator.tsではperformDesignValidation共通関数を追加し、再利用可能な形で提供します。
helpers.ts（または適切なモジュール）にgetPhaseStartedAt関数を追加し、test-authenticity検証で必要な履歴情報を取得できるようにします。

---

## 技術仕様

### C-1: userIntent伝播の強化

#### C-1.1: PhaseGuide型の拡張

**対象ファイル:** `workflow-plugin/mcp-server/src/state/types.ts`

**変更内容:**

PhaseGuide型に新しいフィールド `subagentTemplate?: string` を追加する。

**変更箇所（types.ts line 371付近）:**

PhaseGuide型に新しいフィールドsubagentTemplateを追加します。このフィールドは文字列型でオプショナルです。
既存のフィールドであるphaseName、description、requiredSections、outputFile、allowedBashCategoriesなどと並んで定義されます。
新規追加フィールドとして、最後の位置にsubagentTemplateを配置します。
このフィールドはPhaseGuide型のオプショナルプロパティとして、他のオプショナルフィールドと同様に扱われます。

**説明:**

subagentTemplateフィールドには、Task tool起動時のプロンプトテンプレート文字列を格納します。
テンプレート内では変数置換が可能で、taskNameはタスク名に置換されます。
taskIdはタスクIDに、userIntentはユーザー意図の文字列に置換されます。
docsDirはドキュメントディレクトリのパスに、inputFilesは入力ファイルのカンマ区切りリストに置換されます。
outputFileは出力ファイルのパスに、allowedBashCategoriesは許可されるBashコマンドカテゴリのカンマ区切りリストに置換されます。
これらのプレースホルダーは、resolvePhaseGuide関数内で実際の値に変換されます。

#### C-1.2: PHASE_GUIDESへのsubagentTemplate追加

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`

**変更内容:**

PHASE_GUIDESの各フェーズ定義にsubagentTemplateフィールドを追加する。

**追加するテンプレート例（researchフェーズ）:**

researchフェーズのPHASE_GUIDES定義に、subagentTemplateフィールドを追加します。
このテンプレートは複数行の文字列として定義され、フェーズ名の見出しで始まります。
タスク情報セクションでは、タスク名とタスクID、出力先ディレクトリ、ユーザーの意図を列挙します。
作業内容セクションでは、既存コードの調査を行い、指定されたファイルに成果物を保存するよう指示します。
重要事項として、ユーザー意図を常に意識して調査内容に反映することを強調します。
Bashコマンド制限セクションでは、このフェーズで使用可能なコマンドカテゴリを明示します。
テンプレートの最後にtrim関数を適用して、余分な空白を削除します。

**説明:**

全てのフェーズおよびサブフェーズにsubagentTemplateフィールドを追加する必要があります。
メインフェーズには、research、requirements、parallel_analysis、parallel_design、design_review、test_design、test_impl、implementation、refactoring、parallel_quality、testing、regression_test、parallel_verification、docs_update、commit、push、ci_verification、deployが含まれます。
サブフェーズには、threat_modeling、planning、state_machine、flowchart、ui_design、build_check、code_review、manual_test、security_scan、performance_test、e2e_testが含まれます。

各テンプレートに含めるべきセクションは以下の通りです。
まず、フェーズ名の見出しを配置します。次に、タスク情報セクションでタスク名、タスクID、ドキュメントディレクトリ、ユーザー意図を記載します。
作業内容セクションでフェーズ固有のタスクを説明し、出力先ファイルを明示します。
userIntentの重要性を強調するセクションを必ず含めます。最後に、Bashコマンド制限を明記するセクションを配置します。

#### C-1.3: resolvePhaseGuide関数でのプレースホルダー置換

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`

**変更内容:**

resolvePhaseGuide関数（line 860付近）にsubagentTemplateのプレースホルダー置換ロジックを追加する。

**変更箇所（definitions.ts line 915付近に追加）:**

resolvePhaseGuide関数の実装では、まずPHASE_GUIDESから指定されたフェーズのガイドを取得します。
ガイドが存在しない場合はundefinedを返します。存在する場合は、スプレッド演算子でコピーしたresolvedオブジェクトを作成します。
userIntentが引数として渡されている場合は、resolved.userIntentに代入します。
docsDirが渡されている場合は、outputFileやinputFiles内のdocsDirプレースホルダーを実際のパスに置換します。
inputFileMetadataが存在する場合も同様に、各メタデータのpathフィールドのプレースホルダーを置換します。

C-1の変更として、resolved.subagentTemplateが存在する場合に、resolvePlaceholders関数を呼び出してプレースホルダーを置換します。
この時点では、taskNameとtaskIdは空文字列として渡されます。これらはworkflow_next関数内で後から置換されます。
userIntentはuserIntent引数またはデフォルトの空文字列、docsDirは引数の値をそのまま渡します。
inputFilesはカンマ区切りの文字列に変換し、outputFileとallowedBashCategoriesも同様に処理します。

subPhasesが存在する場合は、再帰的に各サブフェーズを解決します。ループ内で各サブガイドをコピーし、同様の置換処理を適用します。
サブフェーズのsubagentTemplateも同じresolvePlaceholders関数で処理します。最後に、解決されたサブフェーズオブジェクトをresolvedに設定します。

ヘルパー関数resolvePlaceholdersは、テンプレート文字列とキーバリューペアのレコードを受け取ります。
各エントリに対して、二重中括弧で囲まれたプレースホルダーを正規表現で検索し、対応する値に置換します。
グローバルフラグを指定することで、同じプレースホルダーが複数回出現する場合も全て置換されます。

**説明:**

resolvePhaseGuide関数は、フェーズガイドのプレースホルダーを実際の値に置換する役割を担います。
ただし、taskNameとtaskIdについては、この関数が呼ばれる時点ではまだタスク状態が確定していないため、空文字列として処理します。
これらの値は、workflow_next関数がPhaseGuideオブジェクトを取得した後、タスク状態から読み取って追加の置換を行います。
この二段階置換アプローチにより、関数の役割を適切に分離しつつ、全てのプレースホルダーを正しい値に置き換えることができます。

#### C-1.4: workflow_nextレスポンスメッセージの拡充

**対象ファイル（レスポンスメッセージ拡充）:** next.ts

**変更内容:**

workflow_next関数のレスポンスメッセージにuserIntentの重要性を明示する文言を追加する。

**変更箇所（next.ts line 522-537付近）:**

workflow_next関数内で、次フェーズのガイドをresolvePhaseGuide関数から取得します。
この時点で、docsDirとuserIntentは既に置換されていますが、taskNameとtaskIdはまだ空文字列のままです。
phaseGuideオブジェクトが存在し、subagentTemplateフィールドが含まれている場合、正規表現を使用してtaskNameとtaskIdのプレースホルダーを実際の値に置換します。
グローバルフラグを指定することで、テンプレート内の全ての出現箇所が置き換えられます。

userIntent明示メッセージの生成では、taskState.userIntentが存在する場合にメッセージ文字列を構築します。
メッセージには、ユーザー意図を必ずsubagentプロンプトに含めるよう強調する文言を含めます。
また、phaseGuide.subagentTemplateフィールドにテンプレートが含まれていることを明示します。
このメッセージは改行文字を含み、視覚的に目立つように設計されています。

最後に、workflow_nextのレスポンスオブジェクトを構築します。successフィールドをtrueに設定し、taskIdとfrom/toフィールドに遷移情報を格納します。
descriptionには次フェーズの説明を設定し、messageフィールドにはフェーズ遷移メッセージとスキップメッセージ、userIntentメッセージを連結します。
phaseGuideオブジェクトをそのまま返却し、workflow_contextには作業ディレクトリとフェーズ情報を含めます。

**説明:**

workflow_nextレスポンスのmessageフィールドは、OrchestratorがTask toolを起動する際の重要なガイドとなります。
ここにuserIntentの重要性を明示的に記載することで、Orchestratorが意図を忘れずにsubagentプロンプトに含める可能性を高めます。
phaseGuide.subagentTemplateフィールドには、既にプレースホルダーが置換された完全なテンプレートが含まれており、Orchestratorはこれをそのまま使用できます。
この二段階のアプローチ（メッセージによる明示的な指示とテンプレートの提供）により、C-1の目的である間接的な技術的強制を実現します。

### C-2: design-validatorのcode_review統合

#### C-2.1: performDesignValidation関数の共通化

**対象ファイル:** `workflow-plugin/mcp-server/src/validation/design-validator.ts`

**変更内容:**

next.ts line 107-119に定義されているperformDesignValidation関数を、design-validator.tsに共通関数として移動する。

**追加コード（design-validator.ts末尾に追加）:**

design-validator.tsファイルの末尾に、performDesignValidation関数をエクスポート関数として追加します。
この関数はドキュメントディレクトリのパスとオプショナルなstrict引数を受け取ります。
strict引数が明示的に指定されていない場合、環境変数DESIGN_VALIDATION_STRICTの値を読み取ります。
環境変数が文字列falseでない限り、デフォルトで厳格モードとして動作します。

関数内では、まずDesignValidatorクラスのインスタンスを生成し、docsDirを渡します。
次にvalidateAllメソッドを呼び出して、設計と実装の整合性を検証します。
検証結果のpassedフィールドがfalseの場合、不整合が検出されたことを意味します。
この場合、formatValidationError関数を使用してエラーメッセージを整形します。

厳格モードの場合、successフィールドがfalseのオブジェクトとエラーメッセージを返します。
これにより、呼び出し元は検証失敗を検知し、適切なエラーハンドリングを行えます。
警告モードの場合、console.warnを使用して警告メッセージを出力しますが、nullを返すことで成功として扱います。
検証が成功した場合も、nullを返して呼び出し元に問題がないことを通知します。

**説明:**

performDesignValidation関数は、設計-実装整合性検証のロジックを再利用可能な形で提供します。
next.ts内に定義されていたローカル関数を共通モジュールに移動することで、complete-sub.tsでも同じ検証ロジックを利用できるようになります。
環境変数による制御を導入することで、プロジェクトの状況に応じて厳格モードと警告モードを切り替えられます。
これは後方互換性を保ちつつ、段階的にバリデーションを導入する際に有用です。

#### C-2.2: next.tsのperformDesignValidation使用箇所の更新

**対象ファイル（performDesignValidation関数リファクタリング）:** next.ts

**変更内容:**

next.ts line 107-119のローカル関数定義を削除し、design-validator.tsからインポートする形に変更する。

**変更箇所（next.ts line 25付近）:**

next.tsファイルの冒頭にあるインポート文のセクションに、design-validatorからの追加インポートを記述します。
既存のDesignValidatorとformatValidationErrorに加えて、新しく作成したperformDesignValidation関数をインポートします。
これにより、ファイル内でこの共通関数を使用できるようになります。

**削除箇所（next.ts line 107-119）:**

next.tsファイル内に定義されていたローカルのperformDesignValidation関数を削除します。
この関数は3つの役割を持っていました。まず、DesignValidatorのインスタンスを作成し、docsDirを渡します。
次に、validateAllメソッドで検証を実行します。最後に、検証失敗時にエラーオブジェクトを返し、成功時にnullを返します。
この実装は、新しく作成したdesign-validator.tsの共通関数に移行されるため、ここでは不要になります。

**変更箇所（next.ts line 288-295, 298-304）:**

既存のperformDesignValidation呼び出しは、そのまま維持します。
これらの呼び出し箇所では、関数シグネチャが互換性を持つため、コード変更は不要です。
line 288-295付近の呼び出しは、parallel_analysis完了時の検証に使用されています。
line 298-304付近の呼び出しは、parallel_design完了時の検証に使用されています。
インポート先が変更されただけで、呼び出し方法は同じため、既存のロジックは正常に動作し続けます。

#### C-2.3: workflow_complete_subでのdesign-validator統合

**対象ファイル:** `workflow-plugin/mcp-server/src/tools/complete-sub.ts`

**変更内容:**

workflow_complete_sub関数のcode_reviewサブフェーズ完了時にdesign-validatorを実行する。

**変更箇所（complete-sub.ts line 17付近）:**

complete-sub.tsファイルの冒頭にあるインポート文のセクションを更新します。
既存のvalidateArtifactQualityとPHASE_ARTIFACT_REQUIREMENTSのインポート文の後に、新しいインポート文を追加します。
C-2の変更として、design-validator.tsからperformDesignValidation関数をインポートします。
このインポートにより、code_reviewサブフェーズ完了時に設計-実装整合性検証を実行できるようになります。

**変更箇所（complete-sub.ts line 194付近）:**

complete-sub.ts内のサブフェーズ完了処理で、成果物品質チェックのセクションを確認します。
既存のcheckSubPhaseArtifacts関数による品質チェックが正常に完了した後、追加の検証を行います。
docsDirはtaskState.docsDirまたはtaskState.workflowDirから取得されます。
artifactErrorsが存在する場合、エラーメッセージを構築して失敗を返します。

C-2の統合として、subPhaseNameがcode_reviewである場合に、performDesignValidation関数を呼び出します。
この関数はdocsDirを引数として受け取り、設計-実装整合性を検証します。
検証結果がエラーオブジェクト（designValidationError）である場合、サブフェーズ完了をブロックします。
エラーメッセージには、code_reviewサブフェーズの検証失敗であることを明示し、詳細なエラー内容を含めます。
検証が成功した場合（nullが返された場合）は、次の処理に進みます。

最後に、REQ-B3として定義されている依存関係の警告チェックを実行します。
checkSubPhaseDependencyWarnings関数を呼び出し、サブフェーズ間の依存関係に問題がないか確認します。

**説明:**

code_reviewサブフェーズ完了時にdesign-validatorを統合することで、設計と実装の不整合を早期に検出できます。
成果物品質チェックの後に実行することで、ドキュメントの品質が保証された上で、さらに内容の整合性を確認する二段階のチェックを実現します。
検証失敗時はサブフェーズ完了をブロックするため、不整合がある状態で次のフェーズに進むことを防止します。

#### C-2.4: workflow_nextでのdesign-validator統合

**対象ファイル（parallel_quality→testing遷移ロジック）:** next.ts

**変更内容:**

workflow_next関数のparallel_quality→testing遷移時にdesign-validatorを実行する。

**変更箇所（next.ts line 476付近）:**

workflow_next関数内で、parallel_qualityからtestingへの遷移を処理する条件分岐を追加します。
currentPhaseがparallel_qualityで、nextPhaseがtestingである場合に、このブロックが実行されます。

C-2の統合として、承認チェックの前にdesign-validator検証を実行します。
まず、docsDirをtaskState.docsDirまたはtaskState.workflowDirから取得します。
次に、performDesignValidation関数を呼び出し、検証結果を受け取ります。
検証結果がエラーオブジェクトである場合、フェーズ遷移をブロックします。
エラーレスポンスには、parallel_quality→testing遷移時の検証失敗であることを明示し、詳細なエラー内容を含めます。
NextResult型として返却することで、型安全性を確保します。

既存の承認チェックロジックは、design-validator検証が成功した後に実行されます。
環境変数CODE_REVIEW_APPROVALがfalseでない限り、code_review承認が必要です。
taskState.approvalsオブジェクトのcode_reviewフィールドを確認し、承認されていない場合はエラーを返します。
エラーメッセージには、workflow_approve code_reviewコマンドの実行を促す文言を含めます。

**説明:**

parallel_quality→testing遷移時にdesign-validatorを実行することで、コードレビューフェーズでの見落としを最終的にキャッチします。
承認チェックの前に検証を実行する順序により、不整合がある状態で承認プロセスに進むことを防ぎます。
この二重のチェック機構（code_review完了時とparallel_quality→testing遷移時）により、設計-実装整合性の確保を強化します。

### C-3: test-authenticityのworkflow_next統合

#### C-3.1: getPhaseStartedAt関数の追加

**対象ファイル:** `workflow-plugin/mcp-server/src/state/manager.ts`（または新規ユーティリティファイル）

**変更内容:**

taskState.historyからフェーズ開始時刻を取得するヘルパー関数を追加する。

**追加コード（manager.tsまたはhelpers.ts末尾に追加）:**

manager.tsまたはhelpers.ts（適切なユーティリティファイル）の末尾に、getPhaseStartedAt関数を追加します。
この関数は、フェーズ履歴の配列とフェーズ名を引数として受け取ります。
戻り値は、ISO 8601形式のタイムスタンプ文字列、または見つからない場合のnullです。

関数の最初で、historyがnullまたは空配列であるかをチェックします。
いずれかの条件に該当する場合、履歴が存在しないため、nullを返します。

履歴が存在する場合、配列を逆順でループします。
配列の最後の要素から順に検索することで、最も新しいエントリを優先的に見つけられます。
各エントリに対して、phaseフィールドが指定されたフェーズ名と一致し、かつactionフィールドがstartedであるかを確認します。
両方の条件を満たすエントリが見つかった場合、そのtimestampフィールドを返します。
ループが完了しても該当エントリが見つからない場合、nullを返します。

**説明:**

getPhaseStartedAt関数は、test-authenticity検証で必要なフェーズ開始時刻を取得するためのヘルパー関数です。
taskState.historyには、フェーズの開始や完了などのイベントがタイムスタンプ付きで記録されています。
逆順で検索することで、同じフェーズが複数回実行された場合でも、最新の実行開始時刻を取得できます。
この時刻情報は、test-authenticity検証で、テスト出力のタイムスタンプがフェーズ開始時刻よりも後であることを確認するために使用されます。

#### C-3.2: testing→regression_test遷移時のtest-authenticity統合

**対象ファイル（testingフェーズ遷移検証）:** next.ts

**変更内容:**

workflow_next関数のtesting→regression_test遷移時にtest-authenticityバリデーションを実行する。

**変更箇所（next.ts line 28付近）:**

next.tsファイルの冒頭にあるインポート文のセクションに、追加のインポートを記述します。
既存のインポート文として、artifact-validatorからvalidateArtifactQuality、PHASE_ARTIFACT_REQUIREMENTS、validateSemanticConsistency、validateKeywordTraceabilityをインポートしています。
また、scope-validatorからvalidateScopePostExecutionを、audit/loggerからauditLoggerをインポートしています。

C-3の変更として、test-authenticity.jsから2つの関数をインポートします。
validateTestAuthenticity関数は、テスト出力の真正性を検証するために使用します。
recordTestOutputHash関数は、テスト出力のハッシュ値を記録し、重複を検出するために使用します。
さらに、helpers.jsまたは適切なパスからgetPhaseStartedAt関数をインポートします。
この関数は、フェーズ開始時刻を取得するために必要です。

**変更箇所（next.ts line 227付近）:**

workflow_next関数内で、testingからregression_testへの遷移を処理する条件分岐を追加します。
currentPhaseがtestingである場合に、このブロックが実行されます。

REQ-2のテスト結果検証として、まずgetLatestTestResult関数でtestingフェーズの最新のテスト結果を取得します。
テスト結果が存在しない場合、workflow_record_test_resultコマンドの実行を促すエラーメッセージを返します。
テスト結果が存在する場合、exitCodeが0以外であれば、テスト失敗のエラーメッセージを返します。

C-3のtest-authenticity統合として、testResult.outputが存在する場合にさらなる検証を実行します。
まず、getPhaseStartedAt関数でtestingフェーズの開始時刻を取得します。
開始時刻が取得できた場合、validateTestAuthenticity関数を呼び出します。
この関数には、テスト出力、終了コード、フェーズ開始時刻を渡します。

環境変数TEST_AUTHENTICITY_STRICTを確認し、厳格モードか警告モードかを判定します。
authenticityResult.validがfalseの場合、検証に失敗したことを意味します。
厳格モードでは、エラーメッセージにreason（失敗理由）を含め、フェーズ遷移をブロックします。
警告モードでは、console.warnで警告を出力するのみで、遷移を継続します。

ハッシュ重複チェックでは、既存のハッシュリストをtaskState.testOutputHashesから取得します。
recordTestOutputHash関数を呼び出し、テスト出力のハッシュを計算し、重複を検出します。
hashResult.isDuplicateがtrueで、かつ厳格モードの場合、コピペの可能性を指摘するエラーを返します。

重複でない場合、新しいハッシュを既存リストに追加し、最新100個のみを保持します。
updatedStateオブジェクトを構築し、stateManager.writeTaskStateで永続化します。

最後に、REQ-4として既存のtestBaseline自動設定ロジックを維持します。

**説明:**

testing→regression_test遷移時にtest-authenticityを統合することで、形骸化されたテスト出力を検出できます。
exitCodeチェックに加えて、出力内容の真正性とハッシュ重複を確認する三段階の検証により、テストの信頼性を確保します。
環境変数による制御により、プロジェクトの状況に応じて厳格モードと警告モードを切り替えられます。

#### C-3.3: regression_test→parallel_verification遷移時のtest-authenticity統合

**対象ファイル（regression_testフェーズ遷移検証）:** next.ts

**変更内容:**

workflow_next関数のregression_test→parallel_verification遷移時にtest-authenticityバリデーションを実行する。

**変更箇所（next.ts line 260付近）:**

workflow_next関数内で、regression_testからparallel_verificationへの遷移を処理する条件分岐を追加します。
currentPhaseがregression_testである場合に、このブロックが実行されます。

REQ-2のテスト結果検証として、まずgetLatestTestResult関数でregression_testフェーズの最新のテスト結果を取得します。
テスト結果が存在しない場合、workflow_record_test_resultコマンドの実行を促すエラーメッセージを返します。
テスト結果が存在する場合、exitCodeが0以外であれば、リグレッションテスト失敗のエラーメッセージを返します。

C-3のtest-authenticity統合として、testResult.outputが存在する場合にさらなる検証を実行します。
まず、getPhaseStartedAt関数でregression_testフェーズの開始時刻を取得します。
開始時刻が取得できた場合、validateTestAuthenticity関数を呼び出します。
この関数には、リグレッションテスト出力、終了コード、フェーズ開始時刻を渡します。

環境変数TEST_AUTHENTICITY_STRICTを確認し、厳格モードか警告モードかを判定します。
authenticityResult.validがfalseの場合、検証に失敗したことを意味します。
厳格モードでは、リグレッションテストの真正性検証失敗を明示したエラーメッセージで、フェーズ遷移をブロックします。
警告モードでは、console.warnでTEST_AUTHENTICITY_STRICTがfalseである旨を出力し、遷移を継続します。

ハッシュ重複チェックでは、既存のハッシュリストをtaskState.testOutputHashesから取得します。
recordTestOutputHash関数を呼び出し、リグレッションテスト出力のハッシュを計算し、重複を検出します。
hashResult.isDuplicateがtrueで、かつ厳格モードの場合、コピペの可能性を指摘するエラーを返します。

重複でない場合、新しいハッシュを既存リストに追加し、スライスメソッドで最新100個のみを保持します。
updatedStateオブジェクトをスプレッド演算子で構築し、testOutputHashesフィールドを更新します。
stateManager.writeTaskStateメソッドで、更新された状態を永続化します。

最後に、REQ-4として既存のtestBaseline必須チェックロジックを維持します。

**説明:**

regression_test→parallel_verification遷移時にもtest-authenticityを実行することで、リグレッションテストの信頼性を確保します。
testingフェーズと同様の検証ロジックを適用することで、一貫した品質保証を提供します。
この統合により、C-3の目的である形骸化テストの検出を、ワークフローの複数の遷移ポイントで実現します。

---

## 実装計画

### フェーズ1: C-1実装（userIntent伝播強化）

**作業内容:**

1. types.tsにsubagentTemplateフィールドを追加
2. definitions.tsのPHASE_GUIDESに全フェーズのsubagentTemplateを追加
3. definitions.tsのresolvePhaseGuide関数にプレースホルダー置換ロジックを追加
4. next.tsのworkflow_nextレスポンスメッセージにuserIntent明示文言を追加

**変更ファイル:**
- `workflow-plugin/mcp-server/src/state/types.ts`
- `workflow-plugin/mcp-server/src/phases/definitions.ts`
- next.ts（レスポンスメッセージ拡充）

**見積工数:** 2時間

### フェーズ2: C-2実装（design-validator統合）

**作業内容:**

1. design-validator.tsにperformDesignValidation共通関数を追加
2. next.tsのローカル関数定義を削除し、インポートに変更
3. complete-sub.tsにdesign-validatorインポートを追加
4. complete-sub.tsのcode_review完了時にperformDesignValidation呼び出しを追加
5. next.tsのparallel_quality→testing遷移時にperformDesignValidation呼び出しを追加

**変更ファイル:**
- `workflow-plugin/mcp-server/src/validation/design-validator.ts`
- next.ts（parallel_quality遷移チェック追加）
- `workflow-plugin/mcp-server/src/tools/complete-sub.ts`

**見積工数:** 2時間

### フェーズ3: C-3実装（test-authenticity統合）

**作業内容:**

1. helpers.ts（またはmanager.ts）にgetPhaseStartedAt関数を追加
2. next.tsにtest-authenticityインポートを追加
3. next.tsのtesting→regression_test遷移時にtest-authenticity検証を追加
4. next.tsのregression_test→parallel_verification遷移時にtest-authenticity検証を追加

**変更ファイル:**
- `workflow-plugin/mcp-server/src/tools/helpers.ts`（または`workflow-plugin/mcp-server/src/state/manager.ts`）
- next.ts（testing/regression_test遷移にtest-authenticity統合）

**見積工数:** 1.5時間

### フェーズ4: 環境変数ドキュメント更新

**作業内容:**

1. README.mdに環境変数の説明を追加（DESIGN_VALIDATION_STRICT、TEST_AUTHENTICITY_STRICT）
2. ドキュメント更新

**変更ファイル:**
- `workflow-plugin/mcp-server/README.md`

**見積工数:** 0.5時間

**総見積工数:** 6時間

---

## エラーメッセージ仕様

本セクションでは、C-1、C-2、C-3の実装で発生する可能性のあるエラーメッセージの仕様を定義します。
各エラーメッセージは、問題の内容を明確に伝え、具体的な対応方法を提示することを目的としています。
厳格モードと警告モードでメッセージの内容と動作が異なるため、それぞれのケースについて詳細に記述します。
エラーメッセージは、開発者がすぐに問題を理解し、修正できるように設計されています。

### C-1関連エラーメッセージ

C-1はuserIntentのsubagentプロンプトへの埋め込みを促進する機能ですが、技術的な強制は行いません。
そのため、MCPサーバー側でエラーメッセージを発生させることはありません。
代わりに、workflow_nextレスポンスのmessageフィールドに明示的な指示文言を含めることで、間接的にOrchestratorの行動を誘導します。
phaseGuide.subagentTemplateフィールドにテンプレートを提供することで、Orchestratorが簡単にuserIntentを含むプロンプトを構築できるようにします。
エラーではなく、ガイダンスとサポートによるアプローチを採用しています。

**userIntent未設定時（該当なし）:**

C-1は技術的強制が不可能なため、エラーメッセージは発生しません。
workflow_nextやworkflow_statusのレスポンスに含まれるメッセージが、Orchestratorへの指示として機能します。
Orchestratorがこれらのメッセージを無視した場合でも、システムはエラーを返さず、ワークフローは継続します。
この設計は、MCPプロトコルの技術的制約を考慮した結果です。

### C-2関連エラーメッセージ

C-2は設計-実装整合性検証に関するエラーメッセージを提供します。
検証失敗時のメッセージは、どの設計項目が実装されていないかを具体的に示します。
また、対応方法として、implementationフェーズでの実装や設計書の修正を提案します。
参考情報として、設計書と実装ファイルのパスを明示することで、開発者が迅速に対応できるよう支援します。

**設計-実装不整合検出時（厳格モード）:**

```
code_reviewサブフェーズの設計-実装整合性検証に失敗しました:

【設計-実装整合性検証】検証失敗

問題箇所:
- spec.mdで定義された機能「UserService.findById」が実装されていません
- state-machine.mmdの状態遷移「ACTIVE→INACTIVE」が実装されていません

対応方法:
- implementationフェーズで未実装項目を実装してください
- 設計変更が必要な場合は設計書を修正してから実装してください

参考:
- 設計書: docs/workflows/{taskName}/spec.md
- 実装ファイル: src/backend/（スコープ設定を確認）
```

**設計-実装不整合検出時（警告モード）:**

```
design-validator: 設計-実装不整合を検出しましたが、DESIGN_VALIDATION_STRICT=falseのため続行します:

【設計-実装整合性検証】検証失敗

問題箇所:
- spec.mdで定義された機能「UserService.findById」が実装されていません
- state-machine.mmdの状態遷移「ACTIVE→INACTIVE」が実装されていません

対応方法:
- 未実装項目がある場合は後で実装してください
```

### C-3関連エラーメッセージ

**テスト真正性検証失敗時（厳格モード）:**

```
テスト真正性検証に失敗しました:
テスト出力からテスト数を抽出できませんでした。テストフレームワークの出力を確認してください。

テスト出力が不正である可能性があります。
```

**テスト出力ハッシュ重複検出時（厳格モード）:**

```
テスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。
```

**テスト真正性検証失敗時（警告モード）:**

```
test-authenticity: テスト真正性検証に失敗しましたが、TEST_AUTHENTICITY_STRICT=falseのため続行します: テスト出力が最小文字数未満です（50文字 < 100文字）
```

---

## 環境変数定義

### DESIGN_VALIDATION_STRICT

**説明:**

設計-実装整合性検証の厳格モードを制御する環境変数。

**デフォルト値:** `true`

**有効な値:**
- `true`: 厳格モード（検証失敗時にエラーを返して遷移/完了をブロック）
- `false`: 警告モード（検証失敗時に警告を出力するが遷移/完了を許可）

**影響範囲:**
- `workflow_complete_sub`（code_review完了時）
- `workflow_next`（parallel_quality→testing遷移時）

### TEST_AUTHENTICITY_STRICT

**説明:**

テスト真正性検証の厳格モードを制御する環境変数。

**デフォルト値:** `true`

**有効な値:**
- `true`: 厳格モード（検証失敗時にエラーを返して遷移をブロック）
- `false`: 警告モード（検証失敗時に警告を出力するが遷移を許可）

**影響範囲:**
- `workflow_next`（testing→regression_test遷移時）
- `workflow_next`（regression_test→parallel_verification遷移時）

---

## テスト設計概要

### 単体テスト

#### C-1.1: resolvePhaseGuide単体テスト

**テストケース:**
1. subagentTemplateのプレースホルダー置換確認
2. userIntentがnullの場合の空文字置換確認
3. サブフェーズのsubagentTemplate置換確認

#### C-1.2: resolvePlaceholders単体テスト

**テストケース:**
1. 全プレースホルダーの正常置換確認
2. 存在しないプレースホルダーの無視確認
3. 空文字値の置換確認

#### C-2.1: performDesignValidation単体テスト

**テストケース:**
1. 厳格モード時の検証失敗→エラー返却確認
2. 警告モード時の検証失敗→null返却確認
3. 検証成功時のnull返却確認

#### C-3.1: getPhaseStartedAt単体テスト

**テストケース:**
1. 正常系: 履歴から開始時刻取得確認
2. 異常系: 履歴が空の場合のnull返却確認
3. 異常系: 該当フェーズが存在しない場合のnull返却確認
4. 正常系: 複数回フェーズ実行時の最新開始時刻取得確認

### 統合テスト

#### C-2統合テスト: 未実装項目検出時のcode_review完了ブロック

**テストシナリオ:**
1. タスク開始（workflow_start）
2. researchフェーズからcode_reviewサブフェーズまで進める
3. spec.mdに機能定義を記載するが、実装コードを作成しない
4. workflow_complete_sub('code_review')を実行
5. 期待結果: エラーメッセージ「設計-実装不整合検証に失敗しました」が返却され、完了がブロックされる

#### C-3統合テスト: 形骸化テスト出力検出時のtesting→regression_test遷移ブロック

**テストシナリオ:**
1. タスク開始（workflow_start）
2. researchフェーズからtestingフェーズまで進める
3. 形骸化されたテスト出力（100文字未満）をworkflow_record_test_resultで記録
4. workflow_next()を実行してregression_testへ遷移を試みる
5. 期待結果: エラーメッセージ「テスト真正性検証に失敗しました」が返却され、遷移がブロックされる

#### 環境変数制御テスト: 警告モード確認

**テストシナリオ:**
1. DESIGN_VALIDATION_STRICT=false、TEST_AUTHENTICITY_STRICT=falseを設定
2. 上記のC-2/C-3統合テストと同じ手順を実行
3. 期待結果: 警告が出力されるが、完了/遷移は成功する

---

## 関連ドキュメント

このプロジェクトは、複数の既存ドキュメントとソースコードファイルに依存しています。
以下の表は、実装時に参照すべき主要なドキュメントとファイルの一覧です。
要件定義と調査結果は、本仕様書の前提となる情報を提供します。
既存のバリデーター実装は、統合対象となる機能の詳細を理解するために必要です。
フェーズ遷移制御とサブフェーズ完了制御のソースコードは、実際の統合を実装する対象ファイルです。
型定義とフェーズ定義は、PhaseGuide型の拡張とsubagentTemplateの追加に関連します。

| ドキュメント | パス | 説明 |
|-------------|------|------|
| 要件定義 | `docs/workflows/Critical-Issues-C1-C3根本解決/requirements.md` | 本プロジェクトの要件定義書で、C-1、C-2、C-3の解決すべき課題を定義しています |
| 調査結果 | `docs/workflows/Critical-Issues-C1-C3根本解決/research.md` | 現状分析と問題の根本原因を調査した結果をまとめたドキュメントです |
| design-validator | `workflow-plugin/mcp-server/src/validation/design-validator.ts` | 設計-実装整合性を検証する既存の実装で、C-2統合の対象となります |
| test-authenticity | `workflow-plugin/mcp-server/src/validation/test-authenticity.ts` | テスト出力の真正性を検証する既存の実装で、C-3統合の対象となります |
| フェーズ遷移制御 | `workflow-plugin/mcp-server/src/tools/next.ts` | workflow_next関数を含むファイルで、C-1、C-2、C-3全ての統合対象となります |
| サブフェーズ完了制御 | `workflow-plugin/mcp-server/src/tools/complete-sub.ts` | workflow_complete_sub関数を含むファイルで、C-2統合の対象となります |
| 型定義 | `workflow-plugin/mcp-server/src/state/types.ts` | PhaseGuide、StatusResult、TaskState型を定義するファイルで、C-1でsubagentTemplateフィールドを追加します |
| フェーズ定義 | `workflow-plugin/mcp-server/src/phases/definitions.ts` | PHASE_GUIDESとresolvePhaseGuide関数を定義するファイルで、C-1でsubagentTemplateを全フェーズに追加します |

---

## 制約事項と技術的制約

### TECH-1: Task toolプロンプトの事前検証不可

**制約内容:**

MCPプロトコルにはTask toolのプロンプト内容を事前に取得・検証する仕組みがない。MCP serverはTask tool実行前にプロンプトを検査できない。

**影響:**

C-1の解決策は間接的アプローチ（レスポンスメッセージ強化、subagentTemplate提供）に限定される。完全な技術的強制は不可能であり、Orchestratorの自律的判断に一部依存する。

### TECH-2: AST解析のパフォーマンス影響

**制約内容:**

design-validatorはAST解析を含むため、実行時間がかかる可能性がある。特に大規模プロジェクト（1000ファイル以上）では初回実行が遅い。LRUキャッシュで緩和されるが、キャッシュミス時は50ms以内の目標達成が難しい場合がある。

**影響:**

C-2の実装でパフォーマンス最適化が必要。環境変数AST_CACHE_MAX_ENTRIESでキャッシュサイズを調整可能にする（既に実装済み）。

### TECH-3: テストフレームワーク依存性

**制約内容:**

test-authenticityはテストフレームワークのパターンマッチングに依存する。カスタムテストランナーや新しいフレームワークでは誤検出の可能性がある。

**影響:**

カスタムテストランナー使用時はTEST_AUTHENTICITY_STRICT=falseで警告モードにする必要がある。新しいフレームワーク対応時はtest-authenticity.tsのパターンリストを更新する。

---

## 後方互換性

後方互換性の確保は、既存ワークフローへの影響を最小限に抑えるために重要です。
本実装では、既存の動作を維持しつつ、新しいバリデーション機能を段階的に導入できる設計を採用しています。
環境変数による制御により、プロジェクトの状況に応じて厳格モードと警告モードを切り替えられます。
この柔軟性により、既存プロジェクトでは警告モードを使用し、新規プロジェクトでは厳格モードを使用するといった運用が可能です。
将来的には、より細かい粒度での制御も検討されますが、本実装では一括制御のみを提供します。

### COMPAT-1: 既存ワークフローへの影響回避

既存のワークフローが新しいバリデーションによって突然ブロックされることを防ぐため、環境変数による緩和モードを提供します。

**対策:**

全てのバリデーション（design-validatorとtest-authenticity）に環境変数による緩和モード（strict等号false）を提供します。
デフォルトは厳格モード（strict等号true）として動作し、検証失敗時にエラーを返してフェーズ遷移をブロックします。
既存プロジェクトで問題が発生した場合、環境変数DESIGN_VALIDATION_STRICTやTEST_AUTHENTICITY_STRICTをfalseに設定することで警告モードに切り替え可能です。
警告モードでは、検証失敗時にconsole.warnで警告を出力するのみで、フェーズ遷移を継続します。
この設計により、既存プロジェクトは徐々にバリデーション要件を満たすように改善できます。

### COMPAT-2: 段階的ロールアウト

バリデーション機能の導入は、段階的に行うことが望ましいため、一括制御のみを実装します。

**対策:**

本タスクでは環境変数による一括制御のみ実装します。つまり、DESIGN_VALIDATION_STRICTとTEST_AUTHENTICITY_STRICTの2つの環境変数のみを提供します。
フェーズごとの細かい制御（例：特定のフェーズでのみ厳格モード）は将来の拡張として設計を検討します。
この詳細設計はアーキテクチャドキュメントに記載予定です。段階的ロールアウトの方針として、まず全プロジェクトで警告モードを有効化し、問題の傾向を把握します。
次に、問題が少ないプロジェクトから順に厳格モードに移行します。最終的には、全プロジェクトで厳格モードを標準とすることを目指します。

---

## 成功基準

### 技術的成功基準

1. **C-1解決**: workflow_next/workflow_statusレスポンスにuserIntent明示メッセージが含まれ、phaseGuide.subagentTemplateに埋め込みテンプレートが含まれる
2. **C-2解決**: code_reviewフェーズ完了時とparallel_quality→testing遷移時にdesign-validatorが実行され、不整合時にブロックされる
3. **C-3解決**: testing/regression_test遷移時にtest-authenticityが実行され、形骸化テスト時にブロックされる
4. **パフォーマンス**: 各バリデーション実行時間が50ms以内（LRUキャッシュヒット時）
5. **後方互換性**: 環境変数で全バリデーションを警告モード化可能
6. **テストカバレッジ**: 単体テストカバレッジが80%以上

### ビジネス成功基準

1. **品質向上**: 設計-実装不整合とテスト形骸化が技術的にブロックされる
2. **開発者体験**: エラーメッセージが具体的で、修正方法が明確
3. **運用性**: ログで監査証跡が残り、トラブルシューティングが容易
4. **拡張性**: 将来的な監視・アラート機能の基盤が整う

---

## 変更履歴

本セクションでは、本仕様書の変更履歴を記録します。
バージョン管理により、仕様書の変更内容を追跡し、レビューや監査の際に参照できるようにします。
各エントリには、変更日付、バージョン番号、変更内容の概要、変更者を記録します。
将来的な変更が発生した場合、このテーブルに新しいエントリを追加します。
初版作成時は、C-1、C-2、C-3の実装仕様を定義した完全な仕様書として記録されます。

| 日付 | バージョン | 変更内容 | 著者 |
|-----|-----------|---------|------|
| 2026-02-17 | 1.0 | 初版作成。C-1（userIntent伝播強化）、C-2（design-validator統合）、C-3（test-authenticity統合）の実装仕様を定義 | Claude Sonnet 4.5 |
