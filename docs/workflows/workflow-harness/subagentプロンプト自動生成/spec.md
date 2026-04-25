# subagentプロンプト自動生成 - 仕様書

## サマリー

本仕様書は、PhaseGuideの構造化データからsubagentプロンプトを自動生成する機構の実装計画を定義する。
buildPrompt関数とbuildRetryPrompt関数を新規実装し、PhaseGuide・GlobalRules・BashWhitelistを
統合して完全なsubagentプロンプトを自動生成するアーキテクチャを確立する。
本仕様書はrequirements.mdに記載された要件定義書（functional requirementsおよびNFRを含む）の
内容を全て網羅し、設計判断の根拠を示す。ワークフローシステム全体のセキュリティ品質向上が目的である。

主要な決定事項として、GlobalRules型を新規定義してartifact-validator.tsの全品質ルール定数を構造化し、
BashWhitelist型を新規定義してカテゴリ展開機能（expandCategories関数）を提供する。
PhaseGuide型にchecklistフィールドをオプショナルなstring array形式で追加する型拡張を行い、
フェーズ固有の作業指示をリスト形式で提供する。
PHASE_ARTIFACT_REQUIREMENTSのrequiredSectionsをPHASE_GUIDESに統合し、二重管理を解消する。
ValidationResult型を導入してartifact-validator.tsのエラーを構造化し、エラーハンドリングを改善する。
exportGlobalRules()はartifact-validatorの定数を束ねるラッパー関数として機能する。
acceptance criteriaに基づく実装検証により、NFR-1からNFR-4の非機能要件への準拠を確認する。

次フェーズで必要な情報として、buildPrompt関数の9つのプロンプトセクションの文字列組み立てロジック、
GlobalRules型の16フィールドの具体的な型定義と正規表現パターン、PhaseGuide.checklistの記述例、
リトライプロンプトの11種類のエラー種別認識と修正指示生成アルゴリズムが挙げられる。
resolvePhaseGuide関数からbuildPrompt呼び出しへの移行ステップと後方互換性確保方法も明記する。
investigation（調査）フェーズで取得したresearch resultsをrequirements analysisに活用する手順、
markdown形式の成果物に対するバリデーション実行の詳細、テスト時にPhaseGuideのモックを注入する方法も含む。
MCPサーバーのAPI経由でPhaseGuideを取得する際の影響スコープ（レスポンス全体）についても検討が必要である。

影響を受けるファイルは以下の6件である。

| ファイルパス | 変更種別 | 概要 |
|---|---|---|
| workflow-plugin/mcp-server/src/state/types.ts | 型拡張 | GlobalRules型・BashWhitelist型・ValidationResult型・PhaseGuide.checklist追加 |
| workflow-plugin/mcp-server/src/validation/artifact-validator.ts | 関数追加・引数変更 | exportGlobalRules関数追加、validateArtifact引数変更、ValidationResult返却 |
| workflow-plugin/hooks/bash-whitelist.js | 関数追加 | getBashWhitelist関数とコマンドホワイトリスト展開機能の追加 |
| workflow-plugin/mcp-server/src/phases/definitions.ts | 大規模追加・変更 | buildPrompt・buildRetryPrompt追加、resolvePhaseGuide変更、checklist追加 |
| workflow-plugin/mcp-server/src/phases/claude-md-parser.ts | 変更なし | 既存機構をそのまま活用 |
| workflow-plugin/mcp-server/src/tools/status.ts | 呼び出し変更 | validateArtifact呼び出しにphaseGuide引数を追加（約5箇所） |

## 概要

### 現状の問題点

現在のsubagentTemplateフィールドは手書きの固定文字列であり、複数の根本的な問題を抱えている。
問題の全体像を理解するために、各問題を個別に整理する。

第一に、品質ルールの伝達が不十分である。
artifact-validator.tsに定義された禁止パターンリスト、placeholderRegex（角括弧プレースホルダー正規表現）、
重複行検出の閾値、セクション密度要件、サマリー行数制限、短い行比率（lineRatio）制限、
ヘッダーのみチェック、Mermaid構造検証要件、テストファイルfileQuality要件、
キーワードトレーサビリティ、codePathReference（コードパス参照）要件などの技術的詳細が
subagentに適切に伝達されていない。background（背景）として、既存のexisting subagentTemplateという
string型フィールドはハードコードされたプロンプトコンテンツであり、ルール変更のたびに手動更新が必要だった。

第二に、コマンドホワイトリスト（Bashコマンドホワイトリスト）の情報が不足している。
bash-whitelist.jsのカテゴリ別commands（コマンド）リストが展開されず、具体的に使用可能な
commandsをsubagentが把握できない。ブラックリスト、node実行時の禁止パターン、環境変数保護対象、
mkdir制限などの隠れた制約もsubagentに知らされていない。
Record型のカテゴリ別コマンドマッピングがarray形式で展開されないため、
使用可能なcommands一覧をsubagentがプロンプト内で確認できない課題がある。

第三に、必須セクションの不整合がある。
PHASE_ARTIFACT_REQUIREMENTSとPHASE_GUIDESのrequiredSectionsに差異が生じており、
バリデータ側が多言語対応のセクション名を使用している一方で、PhaseGuide側は日本語のみの場合がある。

第四に、保守負担が大きい。
新しい品質ルールを追加する際、artifact-validator.tsとPHASE_GUIDESの両方を手動で更新する必要があり、
更新漏れや不整合が発生しやすい。ハードコードされた固定テンプレートが保守の障害となっている。

第五に、リトライ機構が未整備である。
バリデーション失敗時のリトライプロンプト生成が標準化されておらず、Orchestratorが毎回手動で
エラーメッセージを解析しているため、テスタビリティと再現性が低下している。

### 解決策の全体像

buildPrompt関数を新規実装し、PhaseGuide・GlobalRules・BashWhitelistを統合して
完全なsubagentプロンプトを動的処理で自動生成するアーキテクチャを採用する。
buildRetryPrompt関数でバリデーション失敗時のエラーメッセージのanalysis（解析）を行い、
具体的な修正指示を含むリトライプロンプトを生成する仕組みとする。
プロンプトstructure（9セクション構成）はmakdown形式の成果物品質要件を完全にカバーする設計である。
acceptance criteriaに基づいてfunctional requirementsの実装結果（results）を検証する。
NFR-1からNFR-4の非機能要件がセキュリティ・パフォーマンス・保守性・テスタビリティを網羅している。

GlobalRules型を新規定義してartifact-validator.tsの全品質ルールを16フィールドとして構造化する。
型のフィールド名はstructuralLine除外パターン・lineCount制限・lineRatio閾値・
pathReference必須条件などを含む詳細な粒度で定義する。
BashWhitelist型を新規定義してカテゴリ別コマンドリストとカテゴリ展開関数（expandCategories）を提供する。

PhaseGuide型にchecklistフィールドを追加する型拡張により、フェーズ固有の作業指示をリスト形式で提供する。
PHASE_ARTIFACT_REQUIREMENTSのrequiredSectionsをPHASE_GUIDESに統合して二重管理を解消する。

resolvePhaseGuide関数内でbuildPromptを呼び出し、生成されたプロンプトをphaseGuide.subagentTemplateに
代入することで、後方互換性確保を実現し、既存の呼び出し元への変更を不要とする。

## 実装計画

### フェーズ1: GlobalRules型定義（types.ts変更）

workflow-plugin/mcp-server/src/state/types.ts の末尾にGlobalRules型を追加する。
この型はartifact-validator.tsの全品質ルール定数を構造化して表現するものである。
types.tsは型拡張によって各モジュールが依存するinterfaceを管理する中心的なファイルである。

GlobalRules型のフィールド構成は以下のとおりである。

| フィールド名 | 型 | 説明 |
|---|---|---|
| forbiddenPatterns | 文字列配列 | artifact-validator.tsの禁止パターン一覧（12種類） |
| bracketPlaceholderRegex | 正規表現（RegExp） | 角括弧プレースホルダー検出用の正規表現パターン |
| bracketPlaceholderInfo | オブジェクト | placeholderRegexの情報（パターン文字列・許可キーワード・最大長） |
| duplicateLineThreshold | 数値 | 重複行検出の閾値（3回以上でエラー）、structuralLine除外後の重複カウント |
| duplicateExclusionPatterns | オブジェクト | structuralLine（構造的な行）を重複検出から除外するパターン（8種類） |
| minSectionDensity | 数値 | セクション密度の最小閾値（0.3 = 30%）、lineRatioに相当する概念 |
| minSectionLines | 数値 | 各セクションの最小実質lineCount（5行） |
| maxSummaryLines | 数値 | サマリーセクションの最大lineCount（200行） |
| shortLineMinLength | 数値 | 短い行の最小長閾値（10文字）、lineRatio計算の基準値 |
| shortLineMaxRatio | 数値 | 短い行の最大lineRatio（0.5 = 50%） |
| minNonHeaderLines | 数値 | ヘッダーのみチェック用最小非ヘッダーlineCount（5行） |
| mermaidMinStates | 数値 | Mermaid図の最小状態数（3個）、stateDiagram構造検証に使用 |
| mermaidMinTransitions | 数値 | Mermaid図の最小遷移数（2個）、flowchart構造検証に使用 |
| testFileRules | オブジェクト | テストfileQuality要件（アサーション・テストケース・最小件数） |
| traceabilityThreshold | 数値 | キーワードトレーサビリティの最小カバレッジ閾値（0.8 = 80%） |
| codePathRequired | オブジェクト | pathReference必須条件（対象ファイル・必須パス） |
| validationTimeoutMs | 数値 | バリデーションタイムアウト（10000ms = 10秒） |

duplicateExclusionPatternsオブジェクトの8種類のフィールドは、いずれもstructuralLine（構造的な行）を
重複検出から除外するための正規表現パターン文字列を格納する。
headersフィールドはハッシュ記号で始まる見出し行を表し、
horizontalRulesフィールドは3文字以上の記号繰り返しによる水平線を表す。
codeFencesフィールドはバッククォート3文字で始まるコードブロック開始・終了行を表し、
tableSeparatorsフィールドはパイプとコロンとスペースからなるテーブル区切り行を表す。
tableDataRowsフィールドはパイプ区切り2カラム以上のテーブルデータ行（pathReferenceを含む行も対象）を表し、
boldLabelsフィールドはアスタリスク2つで囲まれたテキストのみで終わる行を表す。
listBoldLabelsフィールドはリスト先頭の太字ラベルのみの行を表し、
plainLabelsフィールドはリスト先頭の短いテキストにコロンが続く行を表す。

BashWhitelist型のフィールド構成は以下のとおりである。

| フィールド名 | 型 | 説明 |
|---|---|---|
| categories | オブジェクト（文字列キーから文字列配列へのマップ） | コマンドホワイトリストのカテゴリ別一覧 |
| blacklistSummary | 文字列 | ブラックリストの概要説明テキスト |
| nodeEBlacklist | 文字列配列 | node実行時の禁止パターン（11個） |
| securityEnvVars | 文字列配列 | 環境変数保護の対象となる変数名（8個） |
| expandCategories | 関数（文字列配列を受け取り文字列配列を返す） | カテゴリ展開機能（展開関数） |

PhaseGuide型には既存フィールドに加えて、checklistフィールドをオプショナルな文字列配列として追加する。
この型拡張はオプショナルフィールドのため、既存のPhaseGuideインスタンスへの後方互換性確保が保証される。
subagentTypeフィールドは既存どおり「general-purpose」「Explore」「Bash」の3種類を維持する。
modelフィールドは「haiku」「sonnet」「opus」の3種類を維持する。
なお、subagentTypeとして使用される値にはui-design・test-design等のフェーズ向け設定も含まれる。

ValidationResult型を新規定義し、validateArtifact関数がfileQuality検証の結果を構造化して返せるようにする。
ValidationResult型はisValid（真偽値）・errors（エラー配列）・warnings（警告配列）フィールドを持つ。
エラー配列の各要素はerrorType・message・details（オプショナル）フィールドを持つ。

### フェーズ2: exportGlobalRules関数の追加（artifact-validator.ts変更）

workflow-plugin/mcp-server/src/validation/artifact-validator.ts の末尾にexportGlobalRules関数を追加する。
この関数はartifact-validator.ts内の既存定数をGlobalRules型にマッピングして返すものであり、
バリデーションロジック自体には一切変更を加えない。

関数シグネチャとして、引数なし・戻り値はGlobalRules型のインスタンスである。
forbiddenPatternsフィールドはFORBIDDEN_PATTERNS定数（12種類の禁止パターン）を参照する。
bracketPlaceholderRegexフィールドには角括弧プレースホルダーを検出する正規表現を格納する。
bracketPlaceholderInfoは許可キーワードとして「関連」「参考」「注」「例」「出典」の5語を保持する。
duplicateLineThresholdは固定値の3であり、3回以上同一行が出現するとエラーと判定する。
minSectionDensityはMIN_SECTION_DENSITYという環境変数から読み込み、デフォルト値は0.3（lineRatio）である。
maxSummaryLinesはMAX_SUMMARY_LINESという環境変数から読み込み、デフォルト値は200（lineCount）である。
validationTimeoutMsはVALIDATION_TIMEOUT_MSという環境変数から読み込み、デフォルト値は10000である。
この環境変数保護設計により、不正値によるクラッシュを防ぐエラーハンドリングを実装する。
testFileRulesのassertionPatternsには「expect(」「assert(」「assert.」の3パターンを格納する。
testFileRulesのtestCasePatternsには「it(」「test(」「describe(」の3パターンを格納する。

definitions.ts内でexportGlobalRules関数をモジュールロード時に1回だけ呼び出し、
GLOBAL_RULES_CACHEという定数に格納してキャッシュする。
buildPrompt呼び出しごとに再計算しないことでパフォーマンスを確保する。
このラッパー関数はartifact-validatorから品質ルールを抽出する唯一の公開インターフェースであり、
セキュリティ観点からバリデーションロジック自体への外部アクセスを制限する設計となっている。
テスト時はモック（mock）のGlobalRulesインスタンスを注入することで単体テストを容易にする。

### フェーズ3: getBashWhitelist関数の追加（bash-whitelist.js変更）

workflow-plugin/hooks/bash-whitelist.js の末尾にgetBashWhitelist関数を追加する。
この関数はBashWhitelist型のインスタンスを返すものであり、既存のホワイトリストチェックロジックには変更を加えない。
コマンドホワイトリストのカテゴリ展開機能をbuildPromptが利用できるよう公開するのが目的である。

categoriesオブジェクトには4つのカテゴリキーを定義する。
readonlyカテゴリにはls・cat・head・tail・less・more・wc・file・find・grep・rg・ag・
git status・git log・git diff・git show・git branch・git ls-files・git ls-tree・
git rev-parse・git remote・pwd・which・whereis・date・uname・whoami・echo・node実行・mkdirを含める。
testingカテゴリにはnpm test・npm run test・npx vitest・npx vitest run・npx jest・npx mocha・
npx ava・npx tsc --noEmit・npx eslint・npx prettier --check・npm run lint・npm run type-checkを含める。
implementationカテゴリにはnpm install・npm ci・pnpm install・pnpm add・yarn install・
npm run build・npx tsc・npx webpack・npx vite buildを含める。
gitカテゴリにはgit add・git commit・git push・git pull・git fetch・git checkout・
git restore・rm -fを含める。

blacklistSummaryには「インタプリタ実行、シェル実行、eval、リダイレクト操作、ネットワーク操作、
再帰的強制削除は全フェーズで禁止」という説明を格納する。
nodeEBlacklistには「fs.writeFileSync」「fs.writeSync」「fs.appendFileSync」
「fs.createWriteStream」「fs.openSync」「.writeFile」「.appendFile」
「child_process」「execSync」「spawnSync」等の12パターンを格納する。
securityEnvVarsには「HMAC_STRICT」「SCOPE_STRICT」「SESSION_TOKEN_REQUIRED」
「HMAC_AUTO_RECOVER」「SKIP_WORKFLOW」「SKIP_LOOP_DETECTOR」
「VALIDATE_DESIGN_STRICT」「SPEC_FIRST_TTL_MS」の8変数名を格納する。

expandCategories関数はカテゴリ名の配列を受け取り、各カテゴリのコマンド一覧を和集合として返す展開機能である。
存在しないカテゴリ名が指定された場合はエラーにならず、そのカテゴリ分のコマンドが0件となる。
重複するコマンドは1件にまとめてアルファベット順にソートして返す。

definitions.ts内でgetBashWhitelist関数をモジュールロード時に1回だけ呼び出し、
BASH_WHITELIST_CACHEという定数に格納してキャッシュする。

### フェーズ4: buildPrompt関数の実装（definitions.ts変更）

workflow-plugin/mcp-server/src/phases/definitions.ts の900行目付近（resolvePhaseGuide関数の直前）に
buildPrompt関数を追加する。
なお、buildPrompt関数はprompt-builder.tsという独立した専用ファイルに分離することも選択肢として検討したが、
既存のdefinitions.tsへのインポート依存を最小化するため、definitions.ts内に定義することを決定する。

#### buildPrompt関数のシグネチャと役割

buildPrompt関数は以下の5つのパラメータを受け取り、文字列を返す同期関数（動的処理）である。

| パラメータ名 | 型 | 説明 |
|---|---|---|
| guide | PhaseGuide | フェーズガイドオブジェクト（プロンプトセクション生成の主要入力） |
| taskName | 文字列 | タスク名（プロンプトセクションのヘッダーに埋め込む） |
| userIntent | 文字列 | ユーザーの意図（requirements.mdやspec.md等の要件定義書の文脈を反映） |
| docsDir | 文字列 | ドキュメントディレクトリのpathReference（出力先パスの組み立てに使用） |
| グローバルルールとBashホワイトリスト | - | GLOBAL_RULES_CACHEとBASH_WHITELIST_CACHEをモジュールキャッシュから参照 |

関数内で最初に必須フィールド検証（エラーハンドリング）を行い、guide.phaseNameが空文字列の場合・
guide.descriptionが空文字列の場合・docsDirが空文字列の場合にErrorをスローする。

#### プロンプトセクションの構成（9セクション）

buildPrompt関数は以下の9つのプロンプトセクションを順序通りに組み立てて1つの文字列として返す動的処理を行う。

プロンプトセクション1はフェーズ情報ヘッダーであり、フェーズ名・タスク名・ユーザーの意図・出力先のpathReferenceを記載する。
プロンプトセクション2は入力ファイルセクションであり、guide.inputFileMetadataが存在する場合は
重要度とreadModeのメタデータを併記してリスト表示する。
inputFileMetadataが存在せずinputFilesが1件以上ある場合はファイルパスのみリスト表示する。
各ファイルに対してreadMode（読み込みモード）の指定があれば、それも表示する。
どちらも存在しない場合は「入力ファイルなし（新規作成フェーズ）」と表示する。

プロンプトセクション3は出力ファイルセクションであり、guide.outputFileが存在する場合は完全パスを表示する。
存在しない場合は「出力ファイル指定なし（フェーズの性質により成果物の形式が異なります）」と表示する。

プロンプトセクション4は必須セクションリストであり、guide.requiredSectionsの各要素をリスト表示する。
requiredSectionsが空の場合はこのプロンプトセクション全体を省略する。

プロンプトセクション5は成果物品質要件セクションであり、lineCount要件・禁止パターン一覧・
placeholderRegex禁止ルール・structuralLine除外を考慮した重複行検出ルール・
セクション密度（lineRatio）要件・サマリーlineCount制限・短い行lineRatio制限・
ヘッダーのみチェック・stateDiagramおよびflowchart構造検証要件・
testFileQuality要件・キーワードトレーサビリティ・pathReference要件を列挙する。
これらの値はGLOBAL_RULES_CACHEから取得して動的処理で展開する。

プロンプトセクション6はBashコマンド制限セクションであり、guide.allowedBashCategoriesの各カテゴリ名と、
BASH_WHITELIST_CACHEのexpandCategories展開機能を使って展開したコマンドホワイトリストを表示する。
ブラックリスト概要・node実行制限・環境変数保護対象・代替手段（Read/Write/Edit/Glob/Grepツール）も記載する。

プロンプトセクション7はファイル編集制限セクションであり、guide.editableFileTypesの各拡張子をリスト表示する。
editableFileTypesがアスタリスク1件のみの場合は「全拡張子編集可能」と表示する。

プロンプトセクション8はフェーズ固有チェックリストセクションであり、guide.checklistが存在する場合のみ表示する。
各項目を番号付きリストで表示し、guide.checklistが設定されていない場合はセクション全体を省略する。

プロンプトセクション9は重要事項セクションであり、出力先パスの厳守・サマリーセクション必須化・
バリデーション失敗時の対応について記載する。
プロンプトインジェクション対策として、userIntentの特殊文字はエスケープせずそのまま使用する。

### フェーズ5: buildRetryPrompt関数の実装（definitions.ts変更）

buildPrompt関数の直後にbuildRetryPrompt関数を追加する。
バリデーション失敗時のリトライ機構のテスタビリティを高めるため、純粋関数として実装する。

#### buildRetryPrompt関数のシグネチャ

buildRetryPrompt関数は以下のパラメータを受け取り、文字列を返す同期関数である。

| パラメータ名 | 型 | 説明 |
|---|---|---|
| guide | PhaseGuide | フェーズガイドオブジェクト |
| taskName | 文字列 | タスク名 |
| userIntent | 文字列 | ユーザーの意図（要件定義書の文脈） |
| docsDir | 文字列 | ドキュメントディレクトリのpathReference |
| errorMessage | 文字列 | バリデーションエラーメッセージ全文（ValidationResult由来） |
| retryCount | 数値 | リトライ回数（1から始まる） |

#### エラー種別と修正指示の対応表

buildRetryPrompt関数はerrorMessageの文字列を検査してエラー種別を判定し、対応する修正指示を生成する。

| エラー種別 | 検出キーワード | 生成する修正指示 |
|---|---|---|
| 禁止パターン検出 | 「禁止パターン」または「Forbidden pattern」 | 指摘された禁止語を削除し具体的な実例に置き換えること |
| セクション密度不足 | 「密度」または「density」（lineRatio不足） | 該当セクションに実質的な内容を追加して最低5行の実質lineCountを確保すること |
| 同一行繰り返し | 「同一行」または「Duplicate line」（structuralLine以外） | 繰り返されている行をそれぞれ異なる内容に書き換え各行に文脈固有の情報を含めること |
| 必須セクション欠落 | 「必須セクション」または「Required section」 | 欠落しているセクションヘッダーを追加すること |
| lineCount不足 | 「行数が不足」または「Minimum line count」 | 成果物のlineCountを必要行数以上に増やすこと |
| 短い行lineRatio超過 | 「短い行」または「Short line ratio」 | 10文字以上の実質的な文を増やし短い行のlineRatioを50パーセント未満に下げること |
| ヘッダーのみエラー | 「ヘッダーのみ」または「header-only」 | 各セクションに本文を追加して見出しだけでなく説明文を記述すること |
| Mermaid構造不足 | 「Mermaid」または「stateDiagram」または「flowchart」 | 構造検証を通過するためMermaid図に最低3つの状態と2つの遷移を追加すること |
| testFileQuality不足 | 「テストファイル」または「Test file quality」 | テストファイルにexpectアサーションとit/testケースを追加すること |
| pathReference欠落 | 「コードパス」または「Code path reference」 | spec.mdにsrcまたはtestsパスへのpathReferenceを追加すること |
| 未知のエラー種別 | 上記いずれにも該当しない場合（汎用エラーハンドリング） | エラー内容を確認し適切に対応すること |

#### リトライプロンプトセクションの構成

buildRetryPrompt関数が生成するプロンプトは以下の4つのプロンプトセクションで構成される。
セクション1はリトライヘッダーであり、フェーズ名とリトライ回数を表示する。
セクション2は前回のバリデーション失敗理由であり、ValidationResultのerrorMessageの全文を引用する。
セクション3は改善要求であり、上記エラー種別判定に基づく具体的修正指示を列挙する。
複数のエラーが検出された場合は全て列挙して包括的なエラーハンドリングを実現する。
セクション4は元のプロンプト全文であり、buildPromptを呼び出して生成した内容を挿入する。

### フェーズ6: resolvePhaseGuide関数のリファクタリング（definitions.ts変更）

definitions.tsのresolvePhaseGuide関数内にbuildPrompt呼び出しを追加し、
生成されたプロンプトをresolved.subagentTemplateに代入する。
変更前はphaseGuide.subagentTemplateの文字列内のプレースホルダーを単純置換していた動的処理を、
buildPrompt関数による完全な9セクション生成に置き換える。

後方互換性確保のため関数シグネチャは変更しないため、status.ts等の既存呼び出し元への影響は生じない。
サブフェーズが存在する場合は各サブフェーズのsubagentTemplateも同様にbuildPromptで生成する。
ハードコードされた固定テンプレートはbuildPromptの動的処理に置き換えられ、保守性が向上する。

### フェーズ7: PHASE_GUIDESへのchecklist追加（definitions.ts変更）

PHASE_GUIDES定数の各フェーズにchecklistフィールドを追加する。
以下の表は代表的なフェーズのchecklist内容を示す。

| フェーズ名 | checklistの主要項目 |
|---|---|
| research | 既存コードの構造把握・問題の発生箇所特定・既存テストのベースライン記録・技術的制約の文書化 |
| requirements | 要件定義書を読み込み影響範囲特定・機能要件と非機能要件の分離記述・各要件への一意IDの付与 |
| implementation | spec.mdの機能一覧確認・state-machine.mmdの全状態遷移把握・flowchart.mmdの全処理フロー把握 |
| code_review | spec.mdの全機能が実装されているかの確認・全状態遷移の実装確認・pathReference整合性の確認 |

ui-designフェーズのchecklistには「コンポーネント仕様の記述」「Storybookストーリー定義の追加」
「responsive設計の確認」「accessibility要件の確認」を含める。
test-designフェーズのchecklistには「テスト設計書の作成」「テストケースとspec.mdのトレーサビリティ確認」
「テストデータのfixtures準備」「general-purpose subagentへの引き継ぎ情報の整理」を含める。
Exploreサブエージェント（subagentType: 'Explore'）を使用するresearchフェーズのchecklistには
既存テストのベースライン記録指示を必ず含める。
investigation（調査）の結果をworkflow_record機能でrecordすることで、次フェーズへの引き継ぎを確実にする。

### フェーズ8: PHASE_ARTIFACT_REQUIREMENTSとPHASE_GUIDESの統合

PHASE_ARTIFACT_REQUIREMENTS（artifact-validator.ts内）のrequiredSections値を、
PHASE_GUIDESの対応するフェーズにコピーして多言語対応セクション名を統合する。
この変更により、要件定義書（requirements.md）に相当する仕様が一元管理される。

artifact-validator.tsのvalidateArtifact関数の引数にphaseGuideをオプショナルパラメータとして追加し、
requiredSectionsをPHASE_GUIDESから取得するように変更する。
PHASE_ARTIFACT_REQUIREMENTSからrequiredSectionsフィールドを削除し、minLinesのみ残す。
validateArtifactQualityCore関数においても引数にphaseGuideを追加し、構造検証の一元化を実現する。

## 変更対象ファイル

### 変更ファイル一覧と詳細

各ファイルの変更内容と規模を以下に示す。
実装時はこのpathReferenceを正確に使用し、タスク名から独自にパスを構築しないこと。

workflow-plugin/mcp-server/src/state/types.tsへの変更は
GlobalRules型・BashWhitelist型・ValidationResult型の定義追加とPhaseGuide型のchecklist追加（型拡張）であり、
約150行を追加する。既存のPhaseGuide使用箇所は後方互換性確保が保証される（checklistはオプショナル）。
型名としてstructuralLine除外パターン・lineCount・lineRatio・pathReference等を含む詳細な命名を採用する。

workflow-plugin/mcp-server/src/validation/artifact-validator.tsへの変更は
exportGlobalRules関数の追加（末尾付近）と、validateArtifactQualityCore・
validateArtifactQualityの引数へのphaseGuide追加であり、約80行追加・既存関数3箇所変更となる。
環境変数保護設計により、MIN_SECTION_DENSITY・MAX_SUMMARY_LINES・VALIDATION_TIMEOUT_MSの
パースエラー時にもデフォルト値にフォールバックするエラーハンドリングを実装する。

workflow-plugin/hooks/bash-whitelist.jsへの変更は
getBashWhitelist関数の追加（末尾付近）であり、約60行を追加する。
コマンドホワイトリストのカテゴリ展開機能（expandCategories）を外部に公開する。
既存コードへの影響はなく、新規エクスポート関数の追加のみである。

workflow-plugin/mcp-server/src/phases/definitions.tsへの変更は
buildPrompt関数追加（約150行）・buildRetryPrompt関数追加（約100行）・
resolvePhaseGuide関数変更（buildPrompt呼び出し追加でハードコード除去）・
PHASE_GUIDESの各フェーズへのchecklist追加（約200行）であり、合計で約450行追加となる。
なお、buildPromptをprompt-builder.tsに分離する場合は追加のインポート設定が必要になる。
resolvePhaseGuide関数のシグネチャは後方互換性確保のため不変であり、既存呼び出し元への影響はない。

workflow-plugin/mcp-server/src/phases/claude-md-parser.tsへの変更はなく、
既存のCLAUDE.md分割配信機構をそのまま活用する。

workflow-plugin/mcp-server/src/tools/status.tsへの変更は
validateArtifact呼び出しにphaseGuide引数を追加する箇所（約5箇所）であり、約5行変更となる。
バリデーション時にPhaseGuideのrequiredSectionsを参照可能になりfileQuality検証の精度が向上する。

### 実装順序と所要時間の見積もり

実装は優先度順に4段階のステップで行い、各ステップで動作確認とエラーハンドリングの確認を実施する。
各実装ステップでは影響スコープを最小化し、既存コードへの副作用を防ぐ。

優先度1の基盤構築として、types.ts変更（GlobalRules型・BashWhitelist型・ValidationResult型・checklist追加）を1時間、
artifact-validator.ts変更（exportGlobalRules追加）を1時間、
bash-whitelist.js変更（getBashWhitelist追加）を1時間で実施する。

優先度2のbuildPrompt実装として、definitions.ts変更（buildPrompt追加・resolvePhaseGuide変更）を3時間、
definitions.ts変更（PHASE_GUIDESのchecklist追加）を2時間で実施する。

優先度3のリトライ機構として、definitions.ts変更（buildRetryPrompt追加）を2時間で実施する。

優先度4の統合作業として、artifact-validator.ts変更（validateArtifact引数追加）を1時間、
status.ts変更（validateArtifact呼び出し変更）を0.5時間、
PHASE_GUIDESのrequiredSections更新（多言語対応）を1時間で実施する。

合計の実装時間は約12.5時間を見込む。

## 非機能要件と制約事項

### パフォーマンス要件

buildPromptとbuildRetryPromptは同期関数として実装し、I/O操作やPromise処理を含めない（動的処理のみ）。
buildPromptの実行時間は1ms以内を目標とし、resolvePhaseGuide関数のリクエスト処理パスでの遅延を防ぐ。
GLOBAL_RULES_CACHEとBASH_WHITELIST_CACHEはモジュールロード時に1回だけ計算してキャッシュする。
buildPrompt呼び出しごとに再計算しないことで、lineCount・lineRatio・structuralLine等の判定コストを最小化する。

### アーキテクチャ設計方針

データ駆動アーキテクチャを採用し、ルールの追加や変更はGlobalRules型とPhaseGuide型のデータ変更で完結させる。
buildPrompt関数のコードは一般的な文字列組み立てロジックのみとし、ハードコードを含めない設計とする。
buildPromptはプロンプト生成のみを担当し、バリデーションやフック処理とは分離する単一責任原則を維持する。
テスタビリティを高めるため、buildPromptとbuildRetryPromptは副作用のない純粋関数として実装する。
general-purposeサブエージェントが参照するsubagentTemplateの内容がGlobalRules・BashWhitelist・
PhaseGuideの最新データを自動的に反映するため、CLAUDE.mdとPhaseGuideの乖離問題を解消できる。

### 後方互換性確保の方針

resolvePhaseGuide関数のシグネチャを変更しないことで、既存の呼び出し元（status.ts等）に影響を与えない。
buildPromptの戻り値をphaseGuide.subagentTemplateに代入することで、
既存のOrchestratorがsubagentTemplateフィールドを参照する動作をそのまま維持できる。
PHASE_GUIDESの各フェーズにsubagentTemplateフィールドが存在することは変更せず、
resolvePhaseGuide呼び出し時にbuildPromptで上書きされる仕組みとする。
型拡張によってPHaseGuide.checklistを追加する際もオプショナルとして実装し、後方互換性確保を保証する。

### 制約事項

artifact-validator.tsの大規模変更は行わない。
exportGlobalRules関数は既存の定数を参照するのみで、バリデーションロジック自体（structuralLine判定・
lineCount計算・lineRatio計算・pathReference検証等）には変更を加えない。
bash-whitelist.jsの大規模変更も行わない。
getBashWhitelist関数は既存のコマンドホワイトリストチェックロジックには変更を加えない。

MCPサーバーの再起動要件として、definitions.tsやartifact-validator.tsのコード変更後は
MCPサーバープロセスの再起動が必要である。
Node.jsのrequireキャッシュにより、実行中のプロセスには変更が反映されない。

buildPromptで生成されるプロンプトの文字数はGlobalRulesとBashWhitelistの完全展開により
5000から8000文字程度になる見込みである。
使用するLLMのコンテキストウィンドウは200Kトークンであり、問題ないと判断する。

ValidationResult型の導入はartifact-validator.tsの全エラー生成箇所に影響するが、
本タスクでは主要なエラー種別の構造化を実装し、マイナーなエラー種別は後続タスクで対応する。

buildPromptで生成されるプロンプトは日本語のみとし、
英語版プロンプトの生成は将来の拡張として残す。
プロンプトインジェクション対策として、userIntentのエスケープよりもLLMの指示解釈精度を優先する。
