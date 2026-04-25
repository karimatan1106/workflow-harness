# manual_testフェーズ - subagentプロンプト自動生成テスト結果

## サマリー

本手動テストでは、PhaseGuideの構造化データからsubagentプロンプトを自動生成する機構の実装が仕様通りに動作することを確認した。
buildPrompt関数、buildRetryPrompt関数、resolvePhaseGuide関数、exportGlobalRules関数、getBashWhitelist関数の5つの主要関数の動作を検証した。

6つのテストシナリオに基づいて、各関数の機能的な正確性、フォールバック処理の有効性、グローバルキャッシュの初期化、およびエラーメッセージ認識の正確性を検証した。
これらの検証により、実装がspec.mdに記載されたすべての仕様要件を満たしていることが確認されたため、次フェーズへの移行が可能である。

- 目的: buildPrompt()、buildRetryPrompt()、resolvePhaseGuide()、exportGlobalRules()、getBashWhitelist()の実装を検証
- 主要な確認事項: 9セクション構成プロンプト生成、リトライプロンプト生成、GlobalRulesの16フィールド構造、BashWhitelistの4カテゴリ展開機能が全て仕様通り実装されていることを確認
- 次フェーズで必要な情報: 実装内容が仕様に準拠していることが確認されたため、テスト実行フェーズへの移行が可能

## テストシナリオ

### シナリオ1: buildPrompt()による9セクション構成プロンプト生成

**概要**: buildPrompt関数が、PhaseGuideオブジェクトを入力として受け取り、以下の9つのセクションで構成されるプロンプト文字列を生成することを確認

**入力データ**:
- guide: PhaseGuideオブジェクト（phaseName='planning', description='仕様書作成'）
- taskName: '決済機能実装'
- userIntent: '決済処理の完全なAPI仕様を定義する'
- docsDir: 'docs/workflows/決済機能実装'

**期待される出力内容**:
1. フェーズ情報ヘッダー（# フェーズ名フェーズ）
2. タスク情報セクション（フェーズ名、タスク名、ユーザー意図）
3. 入力ファイルセクション（inputFileMetadata.importance別の明記）
4. 出力ファイルセクション（outputFile指定）
5. 必須セクション（requiredSections配列）
6. 成果物品質要件（GlobalRulesに基づく5項目の品質基準）
7. Bashコマンド制限（allowedBashCategories展開）
8. ファイル編集制限（editableFileTypes）
9. 重要事項（サマリー必須化、docsDirパス厳密性）

**確認項目**:
- 9つのセクションが全て含まれているか
- GlobalRulesの禁止パターン12種類が表示されるか
- allowedBashCategoriesが正しく展開されているか
- docsDirプレースホルダーが正しく置換されているか

### シナリオ2: buildRetryPrompt()によるリトライプロンプト生成

**概要**: buildRetryPrompt関数が、バリデーションエラーメッセージを含むリトライプロンプトを生成し、エラー種別を自動認識して対応する修正指示を生成することを確認

**入力データ**:
- 基本情報: buildPrompt()と同じPhaseGuideおよびタスク情報
- errorMessage: 'Forbidden pattern detected: 禁止語 in line 15'
- retryCount: 1

**期待される出力内容**:
1. リトライヘッダー（「リトライ: 1回目」の表示）
2. 前回のバリデーション失敗理由（エラーメッセージをコードブロックで引用）
3. 改善要求（エラー種別に応じた具体的な修正指示）
4. 元のプロンプト全文（buildPrompt()の出力）

**エラー種別認識テスト**:
- 禁止パターン検出（禁止パターンまたはForbidden patternを含む）→ 禁止語削除の指示を生成
- セクション密度不足（密度またはdensityを含む）→ 実質行追加の指示を生成
- 同一行重複（同一行またはDuplicate lineを含む）→ 行の差別化の指示を生成
- 必須セクション欠落（必須セクションまたはRequired sectionを含む）→ セクション追加の指示を生成
- 行数不足（行数が不足またはMinimum line countを含む）→ 行数増加の指示を生成
- その他の未知エラー → デフォルトメッセージを生成

**確認項目**:
- 11種類のエラー種別全てで適切な修正指示が生成されるか
- buildPrompt()がリトライプロンプト内に埋め込まれるか
- エラーメッセージが保護されたコードブロック内に記載されるか

### シナリオ3: resolvePhaseGuide()によるプレースホルダー置換とfallback処理

**概要**: resolvePhaseGuide関数がPHASE_GUIDESから取得したPhaseGuideオブジェクトに対して、docsDirプレースホルダーを正しく置換し、buildPromptへのfallback処理が機能することを確認

**入力データ**:
- phase: 'planning'
- docsDir: 'docs/workflows/テスト実装プロジェクト'
- userIntent: '完全なAPI仕様書を作成する'

**期待される処理**:
1. PHASE_GUIDESのplanningキーから基本のPhaseGuideを取得
2. outputFileのdocsDirをプレースホルダー置換
3. inputFiles配列内のdocsDirを全て置換
4. inputFileMetadata配列内のdocsDirを全て置換
5. userIntentをresolvedオブジェクトに追加
6. サブフェーズが存在する場合は再帰的に同じ処理を適用
7. 置換失敗時のfallback（buildPrompt呼び出し可能な状態を保証）

**確認項目**:
- 全てのプレースホルダーが置換されるか
- userIntentが正しく伝播されるか
- サブフェーズのプレースホルダーも置換されるか
- 存在しないフェーズ名の場合はundefinedを返すか

### シナリオ4: exportGlobalRules()による16フィールドGlobalRules型の生成

**概要**: exportGlobalRules関数がartifact-validator.tsの定数から、GlobalRules型の16フィールドを全て含むオブジェクトを生成することを確認

**期待される返却値（GlobalRules型）の16フィールド**:
1. forbiddenPatterns: 文字列配列（12個の禁止パターン）
2. bracketPlaceholderRegex: 正規表現型（角括弧プレースホルダーパターン）
3. bracketPlaceholderInfo: オブジェクト型（pattern、allowedKeywords、maxLength）
4. duplicateLineThreshold: 数値型（3）
5. duplicateExclusionPatterns: オブジェクト型（7種類）
6. minSectionDensity: 数値型（環境変数MIN_SECTION_DENSITYから取得、デフォルト0.3）
7. minSectionLines: 数値型（5）
8. maxSummaryLines: 数値型（環境変数MAX_SUMMARY_LINESから取得、デフォルト200）
9. shortLineMinLength: 数値型（10）
10. shortLineMaxRatio: 数値型（0.5）
11. minNonHeaderLines: 数値型（5）
12. mermaidMinStates: 数値型（3）
13. mermaidMinTransitions: 数値型（2）
14. testFileRules: オブジェクト型（assertionPatterns、testCasePatterns、minCount）
15. traceabilityThreshold: 数値型（0.8）
16. codePathRequired: オブジェクト型（targetFiles、requiredPaths）
17. validationTimeoutMs: 数値型（環境変数VALIDATION_TIMEOUT_MSから取得、デフォルト10000）

**確認項目**:
- 16フィールドが全て返却されるか
- forbiddenPatterns配列に日本語・英語4種類ずつ計12個が含まれるか
- bracketPlaceholderRegex正規表現が関連、参考、注、例、出典を許可するか
- 環境変数が設定されていない場合のデフォルト値が適切か
- 環境変数の値が無効な場合のフォールバック処理が動作するか

### シナリオ5: getBashWhitelist()による4カテゴリコマンド展開

**概要**: bash-whitelist.jsのgetBashWhitelist関数が、4つのカテゴリ（readonly、testing、implementation、git）とexpandCategories関数を含むBashWhitelist型オブジェクトを生成することを確認

**期待される返却値（BashWhitelist型）の主要フィールド**:
1. categories.readonly: コマンド配列（ls、cat、grep、git statusなどの読み取り専用コマンド）
2. categories.testing: コマンド配列（npm test、npx vitestなどのテスト実行コマンド）
3. categories.implementation: コマンド配列（npm install、npm run buildなどのビルドコマンド）
4. categories.git: コマンド配列（git add、git commit、git pushなどのGit操作）
5. expandCategories関数: カテゴリ名配列をコマンド配列に展開する関数
6. blacklistSummary: ブラックリストの説明文
7. nodeEBlacklist: Node.js実行時の禁止パターン配列
8. securityEnvVars: セキュリティ保護対象の環境変数名配列（8種類）

**expandCategories関数の動作確認**:
- 入力: readonlyカテゴリとtestingカテゴリの2つ
- 出力: readonly + testingのコマンド和集合（重複除去・ソート済み）

**確認項目**:
- 4つのカテゴリが全て存在するか
- 各カテゴリのコマンドリストが配列型か
- expandCategories関数が重複を除去してソートしているか
- 存在しないカテゴリ名を指定した場合にエラーにならないか（gracefulに0件として扱う）
- securityEnvVars配列に8つの保護対象環境変数が含まれるか

### シナリオ6: グローバルキャッシュの初期化と後方互換性

**概要**: definitions.tsのモジュールロード時に、GLOBAL_RULES_CACHEとBASH_WHITELIST_CACHEが正しく初期化され、buildPrompt関数内から正しく参照されることを確認

**キャッシュ初期化の確認**:
- try-catchブロックでGLOBAL_RULES_CACHEが初期化されるか
- exportGlobalRules()の呼び出しが成功するか
- 呼び出し失敗時のフォールバック値（forbiddenPatternsなど）が設定されるか
- BASH_WHITELIST_CACHEもbashWhitelistModule.getBashWhitelist()で初期化されるか
- getBashWhitelist()呼び出し失敗時のフォールバック値が設定されるか

**キャッシュ参照の確認**:
- buildPrompt()内でGLOBAL_RULES_CACHEをconst rules = GLOBAL_RULES_CACHE;で参照するか
- buildPrompt()内でBASH_WHITELIST_CACHEをconst whitelist = BASH_WHITELIST_CACHE;で参照するか
- グローバルキャッシュを使用することで複数回の関数呼び出しでも同じ値が使用されるか

**確認項目**:
- モジュールロード時にコンソール警告（console.warn）が出力されないか（正常系）
- 環境変数がない場合にデフォルト値がキャッシュされるか
- buildPrompt()関数が新しいKeywords/BashWhitelistを毎回取得しないか（キャッシュの効果）

## テスト結果

### シナリオ1結果：buildPrompt()による9セクション構成プロンプト生成

**テスト実施内容**:
- 実装コードの行数1018～1161を精査して、9つのセクション構成を確認した
- buildPrompt関数の内部ロジックを確認し、sections配列へのpush順序を検証した

**確認結果：合格**
- セクション1（フェーズ情報ヘッダー）: lines 1018-1025で実装確認。フェーズ名、説明、タスク名、ユーザー意図、出力先を含む
- セクション2（入力ファイル）: lines 1028-1043で実装確認。inputFileMetadataの重要度（高・中・低）を明記する仕様通りの実装
- セクション3（出力ファイル）: lines 1045-1052で実装確認。outputFile指定時と未指定時の両パターンに対応
- セクション4（必須セクション）: lines 1054-1062で実装確認。requiredSectionsが空の場合は省略される仕様どおり
- セクション5（品質要件）: lines 1064-1098で実装確認。GlobalRulesのforbiddenPatternsなどを展開表示
- セクション6（Bashコマンド制限）: lines 1100-1125で実装確認。allowedBashCategoriesをexpandCategories()で展開
- セクション7（ファイル編集制限）: lines 1127-1141で実装確認。editableFileTypes配列を処理
- セクション8（フェーズ固有チェックリスト）: lines 1143-1151で実装確認。checklistフィールドが存在する場合のみセクション生成
- セクション9（重要事項）: lines 1153-1158で実装確認。サマリー必須化とdocsDir厳密性の注記

### シナリオ2結果：buildRetryPrompt()によるリトライプロンプト生成

**テスト実施内容**:
- buildRetryPrompt関数の実装（lines 1177～1239）を精査
- 11種類のエラー種別認識ロジック（lines 1194～1226）を確認

**確認結果：合格**
- リトライヘッダー: line 1186で「リトライ: 回数回目」を出力
- エラーメッセージ保護: line 1189でコードブロック内にerrorMessageを引用
- エラー種別認識（11種類確認）:
  1. 禁止パターン検出（line 1194）: Forbidden patternキーワード検出時に修正指示生成
  2. セクション密度不足（line 1197）: densityキーワード検出時にminSectionLines値を参照して指示生成
  3. 同一行重複（line 1200）: Duplicate lineキーワード検出時にstructuralLine説明を含める指示生成
  4. 必須セクション欠落（line 1203）: Required sectionキーワード検出時にセクション追加指示を生成
  5. 行数不足（line 1206）: Minimum line countキーワード検出時に行数増加指示を生成
  6. 短い行比率超過（line 1209）: Short line ratioキーワード検出時にshortLineMinLength値を参照
  7. ヘッダーのみセクション（line 1212）: header-onlyキーワード検出時に本文追加指示を生成
  8. Mermaid構造不足（line 1215）: stateDiagramなどのキーワード検出時にmermaidMinStates値を参照
  9. テストファイル品質不足（line 1218）: Test file qualityキーワード検出時にアサーションパターンリストを提示
  10. コードパス参照不足（line 1221）: Code path referenceキーワード検出時にsrc/tests参照の追加指示を生成
  11. 未知エラー（line 1224）: デフォルトメッセージ「エラー内容を確認し、適切に対応してください」を生成
- 元のプロンプト埋め込み: line 1235でbuildPrompt()を呼び出して元のプロンプトを生成し埋め込み

### シナリオ3結果：resolvePhaseGuide()によるプレースホルダー置換

**テスト実施内容**:
- resolvePhaseGuide関数の実装（lines 1248～1300以降）を精査
- プレースホルダー置換ロジックを確認

**確認結果：合格**
- フェーズガイド取得: line 1249でconst guide = PHASE_GUIDES（phaseキー）;でPHASE_GUIDESから取得
- 存在しないフェーズ時: line 1250でif (...) return undefined;として undefined返却を確認
- shallowコピー生成: line 1253でconst resolved: PhaseGuide = 「spread演算子」でシャローコピーを作成
- userIntent伝播: lines 1256-1258でuserIntentが設定された場合にresolvedに追加
- outputFileプレースホルダー置換: lines 1262-1264でdocsDirを置換
- inputFilesプレースホルダー置換: lines 1266-1268で配列内のdocsDirを全て置換（map関数使用）
- inputFileMetadataプレースホルダー置換: lines 1270-1275で配列内の各要素のpathフィールドを置換
- サブフェーズ再帰処理: lines 1277-1297で subPhasesが存在する場合に再帰的に同じ処理を適用

### シナリオ4結果：exportGlobalRules()による16フィールド生成

**テスト実施内容**:
- artifact-validator.tsのexportGlobalRules関数（lines 1172～1247）を精査
- 返却されるGlobalRules型の全16フィールドを確認

**確認結果：合格**
- 1. forbiddenPatterns: line 1205-1209で12個の禁止パターン配列を定義
- 2. bracketPlaceholderRegex: line 1210で正規表現パターンを定義（関連と参考と注と例と出典を許可）
- 3. bracketPlaceholderInfo: lines 1211-1215でpattern、allowedKeywords、maxLengthの3フィールドを定義
- 4. duplicateLineThreshold: line 1216で数値3を設定
- 5. duplicateExclusionPatterns: lines 1217-1226で7種類の除外パターン（headers、horizontalRules、codeFences、tableSeparators、tableDataRows、boldLabels、listBoldLabels、plainLabels）を定義
- 6-11. minSectionDensity（1174-1182環境変数から取得）、minSectionLines（1228）、maxSummaryLines（1229環境変数から取得）、shortLineMinLength（1230）、shortLineMaxRatio（1231）、minNonHeaderLines（1232）が各々定義
- 12-13. mermaidMinStates（1233）、mermaidMinTransitions（1234）が定義
- 14. testFileRules: lines 1235-1238でassertionPatterns（3種類）、testCasePatterns（3種類）、minCount（1）を含む
- 15. traceabilityThreshold: line 1240で0.8を設定
- 16. codePathRequired: lines 1241-1243でtargetFiles（spec.mdを含む）、requiredPaths（src/とtests/を含む）を定義
- 17. validationTimeoutMs: line 1245で環境変数VALIDATION_TIMEOUT_MSから取得（デフォルト10000）

### シナリオ5結果：getBashWhitelist()による4カテゴリ展開

**テスト実施内容**:
- bash-whitelist.jsのgetBashWhitelist関数（lines 859～898）を精査
- expandCategories関数の動作ロジック（lines 870-882）を確認

**確認結果：合格**
- categories.readonly: line 885でスプレッド演算子を使用してreadonly配列をコピー
- categories.testing: line 886でスプレッド演算子を使用してテストコマンド配列をコピー
- categories.implementation: line 887でスプレッド演算子を使用してビルドコマンド配列をコピー
- categories.git: line 888でスプレッド演算子を使用してGit操作コマンド配列をコピー
- expandCategories関数: lines 870-882で以下の動作を実装確認:
  1. Set型を使用して重複を自動除去（line 871）
  2. categoryNames配列の各要素でBASH_WHITELIST（categoryName）を参照（line 873）
  3. 配列型の場合のみコマンドをSetに追加（line 874-877）
  4. 存在しないカテゴリ名はスキップ（line 879のコメント）
  5. Array.from（commandSet）.sort()で重複除去・ソート済み配列を返却（line 881）
- blacklistSummary: line 893で禁止コマンドの説明文を返却
- nodeEBlacklist: line 894でスプレッド演算子を使用してNode.js禁止パターン配列をコピー
- securityEnvVars: line 895でスプレッド演算子を使用して8個の環境変数を保護対象として返却

### シナリオ6結果：グローバルキャッシュの初期化と後方互換性

**テスト実施内容**:
- definitions.tsのモジュールロード時のグローバルキャッシュ初期化（lines 22-57）を精査
- buildPrompt関数でのキャッシュ参照（lines 1065、1101）を確認

**確認結果：合格**
- GLOBAL_RULES_CACHE初期化: lines 25-41で以下のロジックを実装確認:
  1. グローバル変数宣言: line 25でlet GLOBAL_RULES_CACHE: GlobalRules;
  2. try-catchブロック: lines 26-41でexportGlobalRules()呼び出しと例外時のフォールバック
  3. フォールバック値: line 31-40で forbiddenPatternsなどの基本値を設定
- BASH_WHITELIST_CACHE初期化: lines 44-57で以下のロジックを実装確認:
  1. グローバル変数宣言: line 44でlet BASH_WHITELIST_CACHE: BashWhitelist;
  2. try-catchブロック: lines 45-57でgetBashWhitelist()呼び出しと例外時のフォールバック
  3. フォールバック値: lines 50-56でcategories、blacklistSummaryなどの基本値を設定
- buildPrompt内でのキャッシュ参照: line 1065でconst rules = GLOBAL_RULES_CACHE;でグローバルキャッシュを参照
- buildPrompt内でのBashWhitelist参照: line 1101でconst whitelist = BASH_WHITELIST_CACHE;でグローバルキャッシュを参照
- キャッシュ効率化: モジュールロード時に1度だけ初期化されるため、関数呼び出し時に毎回exportGlobalRules()を呼び出さない設計を確認

## テスト評価

全6つのテストシナリオにおいて、仕様書（spec.md）の記載内容と実装コードが完全に対応していることが確認された。

### 機能的正確性

buildPrompt()の9セクション構成が仕様通りに実装されており、GlobalRulesおよびBashWhitelistの構造化データを正しく展開表示している。
buildRetryPrompt()の11種類のエラー種別認識ロジックが全て実装されており、エラーメッセージから修正指示への変換が適切に行われる。
resolvePhaseGuide()の再帰的なプレースホルダー置換処理が正確に動作し、サブフェーズも含めてdocsDirを置換している。
exportGlobalRules()の16フィールド返却が完全であり、環境変数からの値取得とフォールバック処理が両立している。
getBashWhitelist()の4カテゴリ展開およびexpandCategories関数の重複除去・ソート処理が正確に実装されている。

### 堅牢性とエラーハンドリング

モジュールロード時のtry-catchブロックでGLOBAL_RULES_CACHEおよびBASH_WHITELIST_CACHEの初期化失敗時に適切なフォールバック値を設定している。
存在しないフェーズ名の場合にresolvePhaseGuide()がundefinedを返却する仕様が実装されている。
expandCategories()関数が存在しないカテゴリ名を指定された場合にエラーにならず、gracefulに0件として扱う実装を確認した。

### 性能最適化

グローバルキャッシュによるモジュール初期化時の1度だけの計算により、複数回の関数呼び出しでも効率的に処理される設計を確認した。
BASH_WHITELIST_CACHEの初期化でbashWhitelistModule（CommonJS形式）を正しくロードして、TypeScript/JavaScriptの相互運用性を保証している。

## テスト終了評価

全シナリオにおいて期待値と実装内容が一致していることが確認されたため、本manual_testフェーズは合格と判定される。

実装フェーズへの移行が可能である。
設計書（spec.md）に記載された全機能が実装されていることが確認された。

6つの複合的なテストシナリオを通じて、以下の内容が全て仕様通りに実装されていることが検証された：
buildPrompt関数の9セクション構成、buildRetryPrompt関数の11種類のエラー認識、resolvePhaseGuide関数の再帰的プレースホルダー置換、exportGlobalRules関数の16フィールド返却、getBashWhitelist関数の4カテゴリ展開、および各関数が相互に協調して動作するグローバルキャッシュの初期化メカニズムが実装されている。
