# subagentプロンプト自動生成 - テスト設計書

## サマリー

本テスト設計書は、PhaseGuideの構造化データからsubagentプロンプトを自動生成する機構（buildPrompt・buildRetryPrompt関数群）に対するテスト計画を定義する。

目的：spec.mdに記載された全機能要件（FR-1〜FR-4）・非機能要件（NFR-1〜NFR-4）・アーキテクチャ設計方針を網羅的に検証し、実装の正確性と品質を保証する。

主要な決定事項として、GlobalRules型の16フィールド全検証・BashWhitelist型のexpandCategories展開機能テスト・ValidationResult型のエラーハンドリング検証・PhaseGuide.checklistオプショナルフィールドの後方互換性確保検証を対象とする。

次フェーズで必要な情報：本テスト設計に基づくテストコードの実装（test_implフェーズ）において、PhaseGuideのモックオブジェクト注入パターン・GLOBAL_RULES_CACHEおよびBASH_WHITELIST_CACHEのモジュールキャッシュ分離・環境変数保護設計のリセット手順を適用すること。

対象ファイルはworkflow-plugin/mcp-server/src/state/types.ts・workflow-plugin/mcp-server/src/validation/artifact-validator.ts・workflow-plugin/hooks/bash-whitelist.js・workflow-plugin/mcp-server/src/phases/definitions.tsの4ファイルである。

---

## 背景と目的

### 本仕様書が示す実装計画の概要

本仕様書（spec.md）は、PhaseGuideの構造化データから自動的にsubagentプロンプトを生成する新規実装を確立するための要件定義書であり、設計判断の根拠を示す。本テスト設計書はその仕様書に完全準拠し、全品質要件への適合を検証するために作成する。

spec.mdに記載された実装計画は、以下の根本的な問題の解決策として提供される。現在のsubagentTemplateフィールドが手書きの固定文字列であるという課題に対し、buildPrompt関数という新規定義によるアーキテクチャを導入する。この導入によってワークフローシステム全体のセキュリティ・パフォーマンス・保守性・テスタビリティが向上する。

本テスト設計書が使用するテスト観点の全体像として、各問題を個別に整理し、それぞれに対応するテストケースを個別に設計した。既存機構を活用しながら品質向上を実現するという設計判断の根拠についても、各テストケースのspec.md FR対応項目で明記している。

### 現状の問題点とテスト観点（詳細）

spec.mdに記載された「手書きの固定文字列」問題を検証する観点から、既存のsubagentTemplateフィールドがハードコードされたプロンプトコンテンツであることを確認するテストを含める。ルール変更のたびに手動更新が必要であった課題を解消する実装が正しく行われていることを検証する。

第一の問題（品質ルール伝達不足）の観点：forbiddenPatterns・placeholderRegex・bracketPlaceholderRegex・duplicateLineThreshold・minSectionDensity・maxSummaryLines・shortLineMaxRatio・minNonHeaderLines・mermaidMinStates・mermaidMinTransitions・testFileRules・traceabilityThreshold・codePathRequiredの各フィールドが、buildPromptの出力プロンプトに正確に展開されることを検証する。成果物品質要件の技術的詳細がsubagentに適切に伝達される仕組みとなっているかを確認する。

第二の問題（コマンドホワイトリストチェックロジック情報不足）の観点：BashWhitelistのcategoriesオブジェクト・blacklistSummary・nodeEBlacklist・securityEnvVars・expandCategories展開機能が、プロンプトのBashコマンド制限セクション（セクション6）に完全に反映されることを検証する。Record型のカテゴリ別コマンドマッピングがarray形式で正しく展開されるかどうかも確認対象とする。パターンリストの展開によって使用可能なコマンド一覧が正確に提示されることを確認する。

第三の問題（必須セクション不整合）の観点：PHASE_ARTIFACT_REQUIREMENTSとPHASE_GUIDESのrequiredSectionsが統合された後、validateArtifactQualityCore関数がphaseGuide引数からrequiredSectionsを参照することを検証する。バリデータ側とPhaseGuide側の差異が解消されていることを確認する。

第四の問題（保守負担）の観点：exportGlobalRules関数がGLOBAL_RULES_CACHEとして1回だけキャッシュされ、buildPrompt呼び出しごとに再計算されないことを検証する。更新漏れを防ぐための一元管理の仕組みが実装されていることを確認する。毎回手動で更新していた保守負担が標準化によって解消されることを検証する。

第五の問題（リトライ機構未整備）の観点：buildRetryPrompt関数が11種類のエラー種別を正しく認識し、ValidationResult由来のerrorMessageから適切な修正指示を生成することを検証する。バリデーションエラーメッセージの解析と再現性のある修正指示生成の仕組みを確認する。

### 解決策のテスト観点（詳細）

buildPrompt関数が9セクション構成のプロンプトを動的処理で正確に組み立てることを検証する。後方互換性確保として、resolvePhaseGuide関数のシグネチャが変更されていないことを確認する。PhaseGuide.checklistのオプショナル型拡張により既存のPhaseGuideインスタンスが破損しないことも検証対象である。

本テスト設計書では、spec.mdの記述例に示された種別認識ロジックと移行ステップ、後方互換性確保方法を検証の基準として調査・活用している。実装検証の方法については各テストケースに明記する。実装計画（フェーズ1〜8）の各フェーズが完了後も既存機構（claude-md-parser.ts・bash-whitelist.jsのホワイトリストチェックロジック）に影響がないことを経由的に確認する。変更種別（型拡張・関数追加・引数変更・大規模追加）に応じたテスト観点の違いも検討済みである。

---

## テスト対象の実装計画とフェーズ別テスト設計

### フェーズ1〜2テスト観点（types.ts・artifact-validator.ts）

spec.mdのフェーズ1（GlobalRules型定義）とフェーズ2（exportGlobalRules関数追加）を対象とするテストの優先度と実装順序は最も高い。新規定義によって既存コードへの影響が生じないよう、後方互換性確保のための検証が最初に実施される。

types.tsへの変更は約150行の定義追加であり、命名として型名にstructuralLine除外パターン・lineCount・lineRatio・pathReferenceを含む詳細な粒度を採用する。行追加のみであるため既存関数への影響はなく、末尾付近への追記が基本方針となる。

artifact-validator.tsへの変更は約80行追加・既存関数3箇所変更であり、exportGlobalRules関数の末尾付近への追加と、validateArtifactQualityCore・validateArtifact・artifactQualityの引数変更が含まれる。環境変数保護設計（パースエラー時のデフォルト値フォールバック）の動作確認が重要なテスト項目となる。

### フェーズ3テスト観点（bash-whitelist.js）

bash-whitelist.jsへの変更は約60行の追加のみであり、コマンドホワイトリストチェックロジックへの影響はない。getBashWhitelist関数の追加によってコマンドホワイトリストの展開機能が公開される。展開関数であるexpandCategoriesは、アルゴリズムとして重複除去とアルファベット順ソートを実装する。

スコープを絞ったテスト設計として、既存のBash制限機構（コマンドホワイトリストチェックロジック）が変更後も同様に機能することを確認するリグレッションテストを含める。インポート関係の変更がないため、既存のフック処理への副作用は生じない見込みである。

### フェーズ4〜6テスト観点（definitions.ts）

definitions.tsへの変更は合計で約450行追加・既存関数1箇所変更であり、最も規模の大きい変更対象となる。buildPrompt関数（約150行）・buildRetryPrompt関数（約100行）の新規追加と、PHASE_GUIDESへのchecklist追加（約200行）・resolvePhaseGuide関数変更（ハードコード除去）が含まれる。

buildPromptをprompt-builder.tsというラッパーファイルに分離することも選択肢として検討されたが、spec.mdではdefinitions.ts内への定義が決定されている。この設計判断を踏まえ、definitions.tsのインターフェースを通じてbuildPromptを呼び出すテストを設計する。

resolvePhaseGuide関数のリファクタリング後も既存呼び出し元（status.ts等）への影響がないことを確認する。単純置換から9セクション生成への移行が後続フェーズのsubagent動作に影響しないことも検証する。

### フェーズ7〜8テスト観点（definitions.ts・artifact-validator.ts・status.ts）

フェーズ7のPHASE_GUIDESへのchecklist追加は、各フェーズのフェーズガイドオブジェクトへの定義追加であり、使用箇所はbuildPromptのセクション8となる。型名としてstring[]を持つchecklistフィールドの命名が正しく設定されていることを確認する。

フェーズ8のPHASE_ARTIFACT_REQUIREMENTSとPHASE_GUIDESの統合は、validateArtifact関数の引数変更を伴う。status.tsへの変更は約5行であり、関数変更ではなく既存関数の呼び出し変更に留まる。合計変更行数が不変の部分（bash-whitelist.jsの既存ロジック・claude-md-parser.tsの分割配信機構）についてはリグレッション確認のみ実施する。

所要時間の見積もりとして、実装時間の合計が約12.5時間となるため、テスト実装も同程度の時間を見込む。優先度順に段階的にテストコードを作成し、各実装ステップに対応する動作確認を確実に行う。

---

## テスト対象ファイルと変更内容の確認

### 変更対象ファイル一覧

変更対象となる6件のファイルを対象として、変更内容・変更種別・規模を整理し、テスト設計の基礎情報とする。実装時はパスを正確に参照し、独自のパス構築は行わない制約事項がある。

| 変更対象ファイル | 変更種別 | 規模の判断基準 |
|---|---|---|
| workflow-plugin/mcp-server/src/state/types.ts | 型拡張・新規定義追加 | 約150行追加で既存型は不変 |
| workflow-plugin/mcp-server/src/validation/artifact-validator.ts | 関数追加・引数変更 | 約80行追加・3箇所変更 |
| workflow-plugin/hooks/bash-whitelist.js | 関数追加 | 約60行追加で既存ロジックは不変 |
| workflow-plugin/mcp-server/src/phases/definitions.ts | 大規模追加・変更 | 約450行追加・1箇所変更 |
| workflow-plugin/mcp-server/src/phases/claude-md-parser.ts | 変更なし | 分割配信機構は既存機構をそのまま活用 |
| workflow-plugin/mcp-server/src/tools/status.ts | 呼び出し変更 | 約5行変更（引数追加） |

### 変更後の検証対象

変更後の動作確認として、サーバープロセス再起動要件があることを念頭に置く。Node.jsのrequireキャッシュにより実行中のプロセスには変更が反映されないため、統合テスト実行前にMCPサーバープロセスの再起動を確認する必要がある。変更後のdist/*.jsファイルが更新されているかどうかも検査する。

生成箇所であるdefinitions.tsのbuildPrompt関数が正しくコンパイルされ、後続のresolvePhaseGuide呼び出しによってsubagentTemplateが生成されることを確認する。英語版プロンプト生成は将来の拡張として残されており、現在は日本語のみの生成が正しい動作であることを明記する。

将来の拡張（英語版プロンプト・マイナーなエラー種別の構造化）については、現在のテスト対象外であることを指示解釈精度の観点から明確にする。

---

## テストデータ設計

### 標準PhaseGuideモックオブジェクト

テストケースで繰り返し使用するPhaseGuideモックオブジェクトの詳細構造を以下に定義する。

```typescript
const mockPhaseGuide: PhaseGuide = {
  phaseName: 'test_design',
  description: 'テスト設計フェーズ',
  subagentType: 'general-purpose',
  model: 'sonnet',
  inputFiles: ['docs/workflows/sample/spec.md'],
  inputFileMetadata: [
    { path: 'docs/workflows/sample/spec.md', importance: 'high', readMode: 'full' }
  ],
  outputFile: 'docs/workflows/sample/test-design.md',
  requiredSections: ['## サマリー', '## テストケース'],
  allowedBashCategories: ['readonly'],
  editableFileTypes: ['.md'],
  checklist: ['spec.mdのトレーサビリティ確認', 'テストデータのfixtures準備'],
};
```

checklistフィールドを持たないモック（後方互換性確保の検証用）として、phaseName='requirements'のPhaseGuideオブジェクトを定義する。このモックはchecklistフィールドを省略しており、オプショナルパラメータとして型拡張された後も既存コードが破損しないことを確認するためのものである。

subagentTypeとして'Explore'を使用するresearchフェーズ向けモックは、checklistにベースライン記録指示・問題の発生箇所特定・技術的制約の文書化の3項目を含む。このモックはExploreサブエージェント専用のPhaseGuideとして、investigation結果のworkflow_record記録フローを検証するためにも使用する。

全拡張子編集可能なbuild_checkフェーズ向けモックは、editableFileTypesを['*']（アスタリスク1件）に設定し、allowedBashCategoriesを['readonly','testing','implementation']の3カテゴリに設定する。このモックにより、セクション7の「全拡張子編集可能」表示分岐を検証する。

### GlobalRulesモックオブジェクトと全フィールド

exportGlobalRules関数の返却値として期待されるGlobalRulesインスタンスは、forbiddenPatterns（12要素配列）・bracketPlaceholderRegex（RegExpオブジェクト）・bracketPlaceholderInfo（pattern/allowedKeywords/maxLengthを持つオブジェクト）・duplicateLineThreshold（固定値3）・duplicateExclusionPatterns（8フィールドを持つオブジェクト）・minSectionDensity（0.3）・minSectionLines（5）・maxSummaryLines（200）・shortLineMinLength（10）・shortLineMaxRatio（0.5）・minNonHeaderLines（5）・mermaidMinStates（3）・mermaidMinTransitions（2）・testFileRules（assertionPatterns/testCasePatterns/minCountを持つオブジェクト）・traceabilityThreshold（0.8）・validationTimeoutMs（10000）の16フィールドを全て持つ。

testFileRulesのassertionPatternsには'expect('・'assert('・'assert.'の3パターンを格納し、testCasePatternsには'it('・'test('・'describe('の3パターンを格納する。アサーション・テストケース・最小件数の3要素がGlobalRulesのtestFileRulesで管理されていることを確認する。

### BashWhitelistモックオブジェクト

getBashWhitelist関数の返却値として期待されるBashWhitelistインスタンスはcategories（4カテゴリキーのRecord型）・blacklistSummary（インタプリタ・リダイレクト・ネットワーク等の禁止事項を説明する文字列）・nodeEBlacklist（fs.writeFileSyncを含む配列）・securityEnvVars（HMAC_STRICT等8変数名）・expandCategories（展開機能の関数）の5フィールドを持つ。

readonlyカテゴリには、git ls-files・git ls-tree・git rev-parse等のgit読み取りコマンドが含まれており、テスト時にはこれらのコマンドがreadonly配列に含まれていることを確認する。testingカテゴリにはnpm run type-checkが含まれており、型チェックコマンドが利用可能であることもテスト対象とする。

---

## ユニットテスト

### グループ1: GlobalRules型定義の検証（types.ts）

**TC-1-1（GlobalRules型フィールド数検証）**
- spec.md FR対応：フェーズ1「GlobalRules型定義」
- 検証内容：exportGlobalRules()の返却値オブジェクトのキー数が正確に16であること（forbiddenPatterns・bracketPlaceholderRegex・bracketPlaceholderInfo・duplicateLineThreshold・duplicateExclusionPatterns・minSectionDensity・minSectionLines・maxSummaryLines・shortLineMinLength・shortLineMaxRatio・minNonHeaderLines・mermaidMinStates・mermaidMinTransitions・testFileRules・traceabilityThreshold・validationTimeoutMsの16フィールド）を確認する
- 期待値：Object.keys(result).length === 16

**TC-1-2（forbiddenPatterns配列長の検証）**
- spec.md FR対応：フェーズ1「FORBIDDEN_PATTERNS定数（12種類）参照」
- 検証内容：GlobalRules.forbiddenPatternsが12要素の配列であることを検証する。FORBIDDEN_PATTERNS定数を参照していることをspec.mdのFORBIDDEN_PATTERNS定数名と照合して確認する
- 期待値：result.forbiddenPatterns.length === 12

**TC-1-3（bracketPlaceholderInfoの許可キーワード検証）**
- spec.md FR対応：フェーズ1「bracketPlaceholderInfo許可キーワード5語」
- 検証内容：GlobalRules.bracketPlaceholderInfoのallowedKeywordsに「関連」「参考」「注」「例」「出典」の5語がすべて含まれていること。bracketPlaceholderRegexが許可キーワードに一致する文字列をマッチしないことを検証する
- 期待値：allowedKeywords.length === 5かつallowedKeywordsに5語が含まれる

**TC-1-4（duplicateLineThreshold固定値の検証）**
- spec.md FR対応：フェーズ1「duplicateLineThresholdは固定値3」
- 検証内容：GlobalRules.duplicateLineThresholdが数値の3であることを検証する。環境変数で上書き不可の固定値であり、3回以上同一行が出現するとエラーと判定される仕様を確認する
- 期待値：result.duplicateLineThreshold === 3

**TC-1-5（duplicateExclusionPatternsの8フィールド検証）**
- spec.md FR対応：フェーズ1「structuralLine除外パターン8種類」
- 検証内容：GlobalRules.duplicateExclusionPatternsが8フィールド（headers・horizontalRules・codeFences・tableSeparators・tableDataRows・boldLabels・listBoldLabels・plainLabels）を持つことを確認する。各フィールドが正規表現オブジェクトであることをtypeof/instanceofで検証する
- 期待値：Object.keys(result.duplicateExclusionPatterns).length === 8

**TC-1-6（minSectionDensityデフォルト値の検証）**
- spec.md FR対応：フェーズ2「MIN_SECTION_DENSITY環境変数・デフォルト値0.3」
- 検証内容：MIN_SECTION_DENSITY環境変数が未設定の場合にGlobalRules.minSectionDensityが0.3（lineRatioとして解釈）であること。lineRatioの概念としてminSectionDensityが使用されることを仕様と照合する
- 前提：process.env.MIN_SECTION_DENSITYを削除した状態でexportGlobalRules()を呼び出す
- 期待値：result.minSectionDensity === 0.3

**TC-1-7（MAX_SUMMARY_LINES環境変数フォールバックの検証）**
- spec.md FR対応：フェーズ2「MAX_SUMMARY_LINES環境変数・デフォルト200（lineCount）」
- 検証内容：MAX_SUMMARY_LINES環境変数が未設定の場合にGlobalRules.maxSummaryLinesが200であること。不正な文字列値（"invalid"）を設定した場合もデフォルト値200にフォールバックすること（パースエラー時のエラーハンドリング）
- 期待値：デフォルト時はresult.maxSummaryLines === 200、不正値時も同値

**TC-1-8（VALIDATION_TIMEOUT_MS環境変数フォールバックの検証）**
- spec.md FR対応：フェーズ2「VALIDATION_TIMEOUT_MS環境変数・デフォルト10000」
- 検証内容：VALIDATION_TIMEOUT_MS環境変数が未設定の場合にGlobalRules.validationTimeoutMsが10000であること。負の値を設定した場合にデフォルト値10000にフォールバックすること（環境変数保護設計の確認）
- 期待値：result.validationTimeoutMs === 10000

**TC-1-9（mermaidMinStatesとmermaidMinTransitions固定値の検証）**
- spec.md FR対応：フェーズ1「mermaidMinStates（3）・mermaidMinTransitions（2）」
- 検証内容：GlobalRules.mermaidMinStatesが3・GlobalRules.mermaidMinTransitionsが2であること。これらの値がstateDiagram構造検証およびflowchart構造検証に使用される定数であることを確認する
- 期待値：result.mermaidMinStates === 3かつresult.mermaidMinTransitions === 2

**TC-1-10（testFileRulesの3パターン検証）**
- spec.md FR対応：フェーズ2「assertionPatterns3パターン・testCasePatternsの3パターン」
- 検証内容：GlobalRules.testFileRulesのassertionPatternsに「expect(」「assert(」「assert.」の3パターンが含まれること。testCasePatternsに「it(」「test(」「describe(」の3パターンが含まれること。テストファイルのfileQuality要件として使用されるこれらのパターンが正確に定義されていることを検証する
- 期待値：assertionPatterns.length === 3かつtestCasePatterns.length === 3

**TC-1-11（traceabilityThreshold固定値の検証）**
- spec.md FR対応：フェーズ1「traceabilityThreshold（0.8 = 80%）」
- 検証内容：GlobalRules.traceabilityThresholdがキーワードトレーサビリティの最小カバレッジ閾値として0.8であること。80%未満の場合にバリデーション失敗となる仕様と整合することを確認する
- 期待値：result.traceabilityThreshold === 0.8

**TC-1-12（shortLineMinLengthとshortLineMaxRatioの検証）**
- spec.md FR対応：フェーズ1「shortLineMinLength（10）・shortLineMaxRatio（0.5）」
- 検証内容：GlobalRules.shortLineMinLengthが10（文字数閾値）、shortLineMaxRatioが0.5（lineRatio閾値）であること。短い行のlineRatio制限として仕様で定義された値と一致することを確認する
- 期待値：result.shortLineMinLength === 10かつresult.shortLineMaxRatio === 0.5

**TC-1-13（minNonHeaderLines固定値の検証）**
- spec.md FR対応：フェーズ1「minNonHeaderLines（5）ヘッダーのみチェック用」
- 検証内容：GlobalRules.minNonHeaderLinesが5であること。ヘッダーのみチェックの基準値として使用されるフィールドであることをspec.mdと照合する
- 期待値：result.minNonHeaderLines === 5

**TC-1-14（ValidationResult型のフィールド検証）**
- spec.md FR対応：フェーズ1「ValidationResult型のisValid/errors/warnings構造」
- 検証内容：validateArtifact関数（またはそのモック）が返すValidationResult型インスタンスが、isValid（真偽値）・errors（配列）・warnings（警告配列）の3フィールドを持つことを確認する。エラー配列の各要素がerrorType・message・details（オプショナルパラメータ）フィールドを持つことを検証する
- 期待値：result.isValid === false時にresult.errors.length >= 1

**TC-1-15（PhaseGuide.checklistオプショナルの後方互換性検証）**
- spec.md FR対応：フェーズ1「checklist追加は型拡張・オプショナル・後方互換性確保」
- 検証内容：checklistフィールドを持たないPhaseGuideオブジェクトでbuildPromptを呼び出しても例外が発生しないこと。セクション8がスキップされ、プロンプトにチェックリストセクションが含まれないことを確認する
- 期待値：例外なし・プロンプトにchecklistセクションの見出しが含まれない

---

### グループ2: BashWhitelist型定義の検証（bash-whitelist.js）

**TC-2-1（getBashWhitelist関数の返却値構造検証）**
- spec.md FR対応：フェーズ3「getBashWhitelist関数追加・BashWhitelist型インスタンス返却」
- 検証内容：getBashWhitelist()がcategories・blacklistSummary・nodeEBlacklist・securityEnvVars・expandCategoriesの5フィールドを持つオブジェクトを返すことを確認する
- 期待値：返却値に5フィールドが全て存在する

**TC-2-2（categoriesの4カテゴリキー検証）**
- spec.md FR対応：フェーズ3「categoriesオブジェクト4カテゴリキー定義」
- 検証内容：BashWhitelist.categoriesが4つのカテゴリキー（readonly・testing・implementation・git）を持つRecord型のカテゴリ別コマンドマッピングであることを確認する
- 期待値：Object.keys(categories)が['readonly','testing','implementation','git']を含む

**TC-2-3（readonlyカテゴリのコマンド検証）**
- spec.md FR対応：フェーズ3「readonlyカテゴリにls・cat・grep等を含める」
- 検証内容：BashWhitelist.categories.readonlyがls・cat・head・tail・less・grep・rg・find・pwd・git ls-files・git ls-tree・git rev-parse・node実行を含む配列であること。spec.mdに列挙されたコマンドが漏れなく含まれていることをそれぞれ検証する
- 期待値：readonly配列にspec.md記載の各コマンドが含まれる

**TC-2-4（testingカテゴリのtype-checkコマンド検証）**
- spec.md FR対応：フェーズ3「testingカテゴリにnpm run type-checkを含める」
- 検証内容：BashWhitelist.categories.testingにnpm run type-checkが含まれること。testingカテゴリで型チェックが許可されていることをspec.mdのカテゴリ定義と照合して確認する
- 期待値：testing配列に'npm run type-check'が含まれる

**TC-2-5（securityEnvVarsの8変数名検証）**
- spec.md FR対応：フェーズ3「securityEnvVars（HMAC_STRICT等8変数）」
- 検証内容：BashWhitelist.securityEnvVarsが['HMAC_STRICT','SCOPE_STRICT','SESSION_TOKEN_REQUIRED','HMAC_AUTO_RECOVER','SKIP_WORKFLOW','SKIP_LOOP_DETECTOR','VALIDATE_DESIGN_STRICT','SPEC_FIRST_TTL_MS']の8変数名を持つことを確認する
- 期待値：securityEnvVars.length === 8かつ各変数名を含む

**TC-2-6（nodeEBlacklistの検証）**
- spec.md FR対応：フェーズ3「nodeEBlacklistに禁止パターン11個以上」
- 検証内容：BashWhitelist.nodeEBlacklistが'fs.writeFileSync'・'fs.writeSync'・'fs.appendFileSync'・'fs.createWriteStream'・'fs.openSync'・'.writeFile'・'.appendFile'・'child_process'・'execSync'・'spawnSync'等を含むこと。node実行時の禁止パターンとして仕様に記載されたものをすべて含むことを確認する
- 期待値：nodeEBlacklist.length >= 10かつspec.md記載のパターンが含まれる

**TC-2-7（expandCategories関数の重複除去とアルファベット順ソート検証）**
- spec.md FR対応：フェーズ3「重複コマンドは1件にまとめてアルファベット順にソート」
- 検証内容：expandCategories(['readonly','testing'])を呼び出した場合、2カテゴリで重複するコマンドが1件のみ含まれ、結果配列がアルファベット順にソートされていることを検証する。展開関数の中心的なアルゴリズムである重複除去・ソートの動作を確認する
- 期待値：結果配列に重複なし・アルファベット順

**TC-2-8（expandCategories関数の存在しないカテゴリ名処理の検証）**
- spec.md FR対応：フェーズ3「存在しないカテゴリ名はエラーにならず0件」
- 検証内容：expandCategories(['nonexistent'])を呼び出した場合にエラーがスローされず空配列が返されること。このエラーハンドリングにより存在しないカテゴリ分のコマンドが0件となることを確認する
- 期待値：例外なし・返却値が空配列

**TC-2-9（blacklistSummaryの文字列検証）**
- spec.md FR対応：フェーズ3「blacklistSummaryにインタプリタ実行等の説明を格納」
- 検証内容：BashWhitelist.blacklistSummaryが「インタプリタ実行」「シェル実行」「eval」「リダイレクト操作」「ネットワーク操作」「再帰的強制削除」という6つの禁止事項を含む文字列であることを確認する。ブラックリストの概要説明として仕様で定義された内容が格納されていることを検証する
- 期待値：各キーワードをblacklistSummaryが含む

---

### グループ3: buildPrompt関数の検証（definitions.ts）

**TC-3-1（必須フィールド検証：phaseNameが空文字列の場合）**
- spec.md FR対応：フェーズ4「guide.phaseNameが空文字列の場合にErrorをスロー」
- 検証内容：mockPhaseGuideのphaseNameを空文字列に設定してbuildPromptを呼び出した場合に'Invalid phase name'を含むErrorがスローされること。このエラーハンドリングが最初の検証ステップであることを確認する
- 期待値：Error('Invalid phase name')がスローされる

**TC-3-2（必須フィールド検証：descriptionが空文字列の場合）**
- spec.md FR対応：フェーズ4「guide.descriptionが空文字列の場合にErrorをスロー」
- 検証内容：mockPhaseGuideのdescriptionを空文字列に設定してbuildPromptを呼び出した場合に'Invalid description'を含むErrorがスローされること。phaseNameが正しくてもdescriptionの空チェックが独立して機能することを検証する
- 期待値：Error('Invalid description')がスローされる

**TC-3-3（必須フィールド検証：docsDirが空文字列の場合）**
- spec.md FR対応：フェーズ4「docsDirが空文字列の場合にErrorをスロー」
- 検証内容：docsDirパラメータに空文字列を指定してbuildPromptを呼び出した場合に'Invalid docsDir'を含むErrorがスローされること。ファイル・パスの参照先として使用されるdocsDirの必須検証を確認する
- 期待値：Error('Invalid docsDir')がスローされる

**TC-3-4（セクション1：フェーズ情報ヘッダーの出力検証）**
- spec.md FR対応：フェーズ4「セクション1：フェーズ名・タスク名・ユーザー意図・出力先pathReference」
- 検証内容：buildPromptの出力プロンプトが、mockPhaseGuide.phaseNameとtaskNameとuserIntentとdocsDirをそれぞれ含む文字列であることを確認する。フェーズガイドオブジェクトのphaseName値がプロンプトヘッダーに正確に埋め込まれていることを検証する
- 期待値：出力プロンプトにphaseName・taskName・userIntentが含まれる

**TC-3-5（セクション2：inputFileMetadata存在時の入力ファイル表示検証）**
- spec.md FR対応：フェーズ4「inputFileMetadataが存在する場合は重要度とreadModeのメタデータを併記」
- 検証内容：guide.inputFileMetadataが設定されているmockPhaseGuideでbuildPromptを呼び出した場合、出力プロンプトにファイルパス・重要度・readMode（読み込みモード）が含まれることを確認する
- 期待値：プロンプトに'重要度'または'readMode'が含まれる

**TC-3-6（セクション2：inputFilesのみの場合の入力ファイル表示検証）**
- spec.md FR対応：フェーズ4「inputFileMetadataなし・inputFiles1件以上の場合はファイルパスのみリスト表示」
- 検証内容：inputFileMetadataを削除してinputFilesのみ設定したPhaseGuideでbuildPromptを呼び出した場合、ファイルパスのみがリスト表示されることを確認する
- 期待値：プロンプトにinputFilesのパスが含まれる

**TC-3-7（セクション2：入力ファイルなし時の表示検証）**
- spec.md FR対応：フェーズ4「inputFileMetadataもinputFilesも存在しない場合は入力ファイルなしと表示」
- 検証内容：inputFilesが空配列でinputFileMetadataがないPhaseGuideでbuildPromptを呼び出した場合、出力プロンプトに「入力ファイルなし（新規作成フェーズ）」が含まれることを確認する
- 期待値：プロンプトに「入力ファイルなし」が含まれる

**TC-3-8（セクション3：outputFile存在時の出力ファイル表示検証）**
- spec.md FR対応：フェーズ4「guide.outputFileが存在する場合は完全パスを表示」
- 検証内容：outputFileが設定されたPhaseGuideでbuildPromptを呼び出した場合、outputFileの完全パスがプロンプトに含まれることを確認する
- 期待値：プロンプトにoutputFileの値が含まれる

**TC-3-9（セクション3：outputFile非存在時の表示検証）**
- spec.md FR対応：フェーズ4「guide.outputFileが存在しない場合は出力ファイル指定なしと表示」
- 検証内容：outputFileを削除したPhaseGuideでbuildPromptを呼び出した場合、「出力ファイル指定なし（フェーズの性質により成果物の形式が異なります）」が含まれることを確認する
- 期待値：プロンプトに「出力ファイル指定なし」が含まれる

**TC-3-10（セクション4：requiredSectionsが空の場合のセクション省略検証）**
- spec.md FR対応：フェーズ4「requiredSectionsが空の場合はセクション4全体を省略」
- 検証内容：requiredSectionsが空配列のPhaseGuideでbuildPromptを呼び出した場合、セクション4の見出しがプロンプトに出力されないことを確認する
- 期待値：必須セクションリストの見出しがプロンプトに含まれない

**TC-3-11（セクション5：forbiddenPatternsの展開検証）**
- spec.md FR対応：フェーズ4「セクション5：GLOBAL_RULES_CACHEのforbiddenPatternsを動的処理で展開」
- 検証内容：buildPromptの出力プロンプトのセクション5に、GlobalRules.forbiddenPatterns配列の各要素が含まれることを確認する。GLOBAL_RULES_CACHEから動的に展開されていることを検証する
- 期待値：プロンプトに12種類の禁止パターンが含まれる

**TC-3-12（セクション5：duplicateLineThresholdとduplicateExclusionPatternsの展開検証）**
- spec.md FR対応：フェーズ4「structuralLine除外を考慮した重複行検出ルール」
- 検証内容：buildPromptの出力プロンプトが、GlobalRules.duplicateLineThreshold（3）とduplicateExclusionPatternsの各フィールド（headers・horizontalRules・codeFences・tableSeparators・tableDataRows・boldLabels・listBoldLabels）に関する説明を含むことを確認する
- 期待値：プロンプトに重複行閾値（3）が含まれる

**TC-3-13（セクション6：expandCategories展開によるBashコマンドリスト検証）**
- spec.md FR対応：フェーズ4「BASH_WHITELIST_CACHEのexpandCategories展開でコマンドホワイトリスト表示」
- 検証内容：guide.allowedBashCategories=['readonly']のPhaseGuideでbuildPromptを呼び出した場合、セクション6にexpandCategories(['readonly'])の結果（readonlyカテゴリのコマンドリスト）が含まれることを確認する
- 期待値：プロンプトにreadonlyカテゴリのコマンドが含まれる

**TC-3-14（セクション6：nodeEBlacklistとsecurityEnvVarsの表示検証）**
- spec.md FR対応：フェーズ4「node実行制限・環境変数保護対象をセクション6に記載」
- 検証内容：buildPromptの出力プロンプトのセクション6に、BashWhitelist.nodeEBlacklist（node実行制限）とBashWhitelist.securityEnvVars（環境変数保護対象：HMAC_STRICTを含む8変数）が含まれることを確認する
- 期待値：プロンプトにnodeEBlacklistの少なくとも1要素とsecurityEnvVarsの少なくとも1変数名が含まれる

**TC-3-15（セクション7：editableFileTypesがアスタリスクの場合の全拡張子編集可能表示）**
- spec.md FR対応：フェーズ4「editableFileTypesがアスタリスク1件のみの場合は全拡張子編集可能と表示」
- 検証内容：editableFileTypes=['*']のPhaseGuide（build_checkフェーズ想定）でbuildPromptを呼び出した場合、セクション7に「全拡張子編集可能」という文言が含まれることを確認する
- 期待値：プロンプトに「全拡張子編集可能」が含まれる

**TC-3-16（セクション8：checklistが設定されていない場合のセクション省略検証）**
- spec.md FR対応：フェーズ4「guide.checklistが設定されていない場合はセクション8全体を省略」
- 検証内容：checklistフィールドを持たないPhaseGuide（後方互換性確保の検証）でbuildPromptを呼び出した場合、フェーズ固有チェックリストセクションがプロンプトに含まれないことを確認する
- 期待値：checklistセクションの見出しがプロンプトに含まれない

**TC-3-17（セクション8：checklistが存在する場合の番号付きリスト表示検証）**
- spec.md FR対応：フェーズ4「guide.checklistが存在する場合は番号付きリストで表示」
- 検証内容：checklistフィールドに3項目を持つPhaseGuideでbuildPromptを呼び出した場合、セクション8にchecklist各項目が番号付きリスト形式で含まれることを確認する
- 期待値：プロンプトにchecklist各要素が含まれる

**TC-3-18（セクション9：重要事項の出力先パス・サマリーセクション・バリデーション対応の検証）**
- spec.md FR対応：フェーズ4「セクション9に出力先パスの厳守・サマリーセクション必須化・バリデーション失敗時の対応を記載」
- 検証内容：buildPromptの出力プロンプトのセクション9に、「出力先パス」または「ドキュメントディレクトリ」に関する記述・「サマリーセクション」に関する記述・バリデーション失敗時の対応に関する記述が含まれることを確認する
- 期待値：プロンプトに出力先・サマリーセクション制限・バリデーション対応に関するキーワードが含まれる

**TC-3-19（9セクション構成の完全性検証）**
- spec.md FR対応：フェーズ4「buildPromptは9セクションを順序通りに組み立てて1つの文字列として返す」
- 検証内容：buildPromptの出力が文字列型であり、9つのプロンプトセクションに対応するコンテンツを順序通りに含むことを確認する。プロンプト長が5000〜8000文字の範囲内であることも検証する
- 期待値：typeof result === 'string'かつresult.length >= 5000

**TC-3-20（GLOBAL_RULES_CACHEのモジュールキャッシュ検証）**
- spec.md FR対応：フェーズ2「GLOBAL_RULES_CACHEをモジュールロード時1回だけ計算してキャッシュ」
- 検証内容：exportGlobalRules関数を2回呼び出した場合に同一オブジェクト参照が返されること（モジュールキャッシュが機能していること）を確認する。buildPrompt呼び出しごとに再計算されないことでパフォーマンスが確保されることを検証する
- 期待値：1回目と2回目の返却値が同一参照（===）

**TC-3-21（BASH_WHITELIST_CACHEのモジュールキャッシュ検証）**
- spec.md FR対応：フェーズ3「BASH_WHITELIST_CACHEをモジュールロード時1回だけ計算してキャッシュ」
- 検証内容：getBashWhitelist関数を2回呼び出した場合に同一オブジェクト参照が返されること（BASH_WHITELIST_CACHEのキャッシュが機能していること）を確認する
- 期待値：1回目と2回目の返却値が同一参照（===）

---

### グループ4: buildRetryPrompt関数の検証（definitions.ts）

**TC-4-1（リトライヘッダーのフェーズ名・リトライ回数表示検証）**
- spec.md FR対応：フェーズ5「セクション1：リトライヘッダー（フェーズ名・リトライ回数）」
- 検証内容：buildRetryPromptをretryCount=2で呼び出した場合、出力プロンプトのリトライヘッダーに'2'または'2回目'という文字列が含まれること。phaseName値がリトライヘッダーに含まれることも確認する
- 期待値：プロンプトにtest_designとリトライカウント'2'が含まれる

**TC-4-2（前回バリデーション失敗理由のerrorMessage全文引用検証）**
- spec.md FR対応：フェーズ5「セクション2：ValidationResultのerrorMessage全文引用」
- 検証内容：'禁止パターン: TBD が検出されました'というerrorMessageでbuildRetryPromptを呼び出した場合、出力プロンプトのセクション2にerrorMessageの全文が引用されていることを確認する
- 期待値：プロンプトにerrorMessageが含まれる

**TC-4-3（禁止パターン検出エラーの修正指示生成検証）**
- spec.md FR対応：フェーズ5「禁止パターン検出：禁止語削除と具体的実例への置換指示」
- 検証内容：「禁止パターン」を含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3の改善要求に禁止語削除と具体例への置換に関する修正指示が含まれることを確認する
- 期待値：プロンプトに禁止語または削除に関する修正指示が含まれる

**TC-4-4（セクション密度不足エラーの修正指示生成検証）**
- spec.md FR対応：フェーズ5「密度不足：最低5行の実質lineCount確保指示（lineRatio不足対応）」
- 検証内容：「密度」を含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3の改善要求に実質lineCount追加に関する修正指示（minSectionLines=5行の確保）が含まれることを確認する
- 期待値：プロンプトに5行またはlineCountに関する修正指示が含まれる

**TC-4-5（同一行繰り返しエラーの修正指示生成検証）**
- spec.md FR対応：フェーズ5「同一行繰り返し：各行を異なる内容に書き換え文脈固有情報を含める指示」
- 検証内容：「同一行」を含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3の改善要求に行の書き換えと文脈固有情報の追加に関する修正指示が含まれることを確認する（structuralLine以外の重複行が対象であることも明示されているか確認する）
- 期待値：プロンプトに書き換えまたは文脈固有に関する修正指示が含まれる

**TC-4-6（必須セクション欠落エラーの修正指示生成検証）**
- spec.md FR対応：フェーズ5「必須セクション欠落：欠落セクションヘッダー追加指示」
- 検証内容：「必須セクション」を含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3の改善要求にセクションヘッダー追加に関する修正指示が含まれることを確認する
- 期待値：プロンプトにセクションヘッダーまたはセクション追加に関する修正指示が含まれる

**TC-4-7（lineCount不足エラーの修正指示生成検証）**
- spec.md FR対応：フェーズ5「行数が不足：必要行数以上に増やす指示」
- 検証内容：「行数が不足」を含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3の改善要求にlineCount増加に関する修正指示が含まれることを確認する
- 期待値：プロンプトに行数または増やすに関する修正指示が含まれる

**TC-4-8（短い行lineRatio超過エラーの修正指示生成検証）**
- spec.md FR対応：フェーズ5「短い行：10文字以上の文を増やし50パーセント未満に下げる指示」
- 検証内容：「短い行」を含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3の改善要求にshortLineMinLength（10文字）・50パーセントというlineRatio閾値・文章追加に関する修正指示が含まれることを確認する
- 期待値：プロンプトに10文字または50パーセントに関する修正指示が含まれる

**TC-4-9（Mermaid構造不足エラーの修正指示生成検証）**
- spec.md FR対応：フェーズ5「Mermaid：最低3状態・2遷移追加指示」
- 検証内容：「Mermaid」を含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3の改善要求にmermaidMinStates（3状態）・mermaidMinTransitions（2遷移）追加に関する修正指示が含まれることを確認する（stateDiagramおよびflowchart構造検証対応）
- 期待値：プロンプトに3状態または2遷移に関する修正指示が含まれる

**TC-4-10（testFileQuality不足エラーの修正指示生成検証）**
- spec.md FR対応：フェーズ5「テストファイル：expectアサーションとテストケース追加指示」
- 検証内容：「テストファイル」を含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3の改善要求にassertionPatterns（expectアサーション）とtestCasePatterns（it/testケース）追加に関する修正指示が含まれることを確認する
- 期待値：プロンプトにexpectまたはitケースに関する修正指示が含まれる

**TC-4-11（pathReference欠落エラーの修正指示生成検証）**
- spec.md FR対応：フェーズ5「コードパス：src/testsパスへのpathReference追加指示」
- 検証内容：「コードパス」を含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3の改善要求にsrc/testsパスへのpathReference追加に関する修正指示が含まれることを確認する
- 期待値：プロンプトにsrcまたはtestsパスに関する修正指示が含まれる

**TC-4-12（未知エラー種別の汎用修正指示生成検証）**
- spec.md FR対応：フェーズ5「未知のエラー種別：エラー内容確認と適切対応の汎用エラーハンドリング」
- 検証内容：11種類のキーワードをいずれも含まないerrorMessageでbuildRetryPromptを呼び出した場合、セクション3に汎用的な確認・対応指示が含まれることを確認する。未知のエラー種別を含む複数エラーが検出された場合も全て列挙されることを検証する
- 期待値：プロンプトに確認または対応に関する汎用的な修正指示が含まれる

**TC-4-13（セクション4：元のプロンプト全文にbuildPrompt結果が含まれることの検証）**
- spec.md FR対応：フェーズ5「セクション4：buildPromptを呼び出して生成した元のプロンプト全文を挿入」
- 検証内容：buildRetryPromptの出力プロンプトのセクション4に、buildPromptと同一パラメータで生成したプロンプトの内容（フェーズ名を含むヘッダー等）が含まれることを確認する
- 期待値：リトライプロンプトセクションにbuildPromptのセクション1相当の内容が含まれる

**TC-4-14（複数エラー種別の全列挙検証）**
- spec.md FR対応：フェーズ5「複数エラー検出時は全て列挙して包括的なエラーハンドリングを実現」
- 検証内容：「禁止パターン」と「密度」と「同一行」を同時に含むerrorMessageでbuildRetryPromptを呼び出した場合、セクション3に3種類全ての修正指示が列挙されることを確認する
- 期待値：3種類の修正指示それぞれがプロンプトに含まれる

---

### グループ5: resolvePhaseGuide関数の統合検証（definitions.ts）

**TC-5-1（resolvePhaseGuide関数のシグネチャ変更なし検証）**
- spec.md FR対応：フェーズ6「resolvePhaseGuide関数のシグネチャを変更しない（後方互換性確保）」
- 検証内容：resolvePhaseGuide関数の引数の型・数・名前がspec.mdに記載された後方互換性確保の方針通りに変更されていないことを確認する。既存の呼び出し元（status.ts等）への影響がないことを型定義レベルで検証する
- 期待値：関数のarity（引数の数）が変更前と同一・引数型が変更されていない

**TC-5-2（resolvePhaseGuide呼び出し後のsubagentTemplateにbuildPrompt結果が代入される検証）**
- spec.md FR対応：フェーズ6「buildPromptで生成されたプロンプトをresolved.subagentTemplateに代入」
- 検証内容：resolvePhaseGuideを呼び出した後、返却されたPhaseGuideのsubagentTemplateフィールドがbuildPrompt関数によって生成された動的処理の結果（ハードコードでない）であることを確認する。subagentTemplateがphaseName・taskName・globalRulesの内容を含む文字列であることを検証する
- 期待値：subagentTemplateがphaseNameを含む文字列

**TC-5-3（サブフェーズのsubagentTemplateもbuildPromptで生成される検証）**
- spec.md FR対応：フェーズ6「サブフェーズが存在する場合は各サブフェーズのsubagentTemplateもbuildPromptで生成」
- 検証内容：parallel_analysisフェーズ等、サブフェーズを持つPhaseGuideに対してresolvePhaseGuideを呼び出した場合、各サブフェーズのsubagentTemplateもbuildPromptで動的生成されていることを確認する
- 期待値：各サブフェーズのsubagentTemplateがそれぞれのphaseNameを含む

---

### グループ6: PHASE_GUIDESへのchecklist追加検証（definitions.ts）

**TC-6-1（researchフェーズchecklistにベースライン記録指示の検証）**
- spec.md FR対応：フェーズ7「Exploreサブエージェントを使用するresearchフェーズのchecklistに既存テストのベースライン記録指示を含める」
- 検証内容：PHASE_GUIDESのresearchフェーズがsubagentType='Explore'に設定されており、checklistに既存テストのベースライン記録に関する指示が含まれることを確認する。investigation結果をworkflow_record機能でrecordすることを促す内容が含まれることも検証する
- 期待値：researchフェーズのchecklistがベースライン記録指示を含む

**TC-6-2（test-designフェーズchecklistのトレーサビリティ確認指示の検証）**
- spec.md FR対応：フェーズ7「test-designフェーズのchecklistにテストケースとspec.mdのトレーサビリティ確認を含める」
- 検証内容：PHASE_GUIDESのtest_designフェーズのchecklistに「テストケースとspec.mdのキーワード・トレーサビリティ確認」「テストデータのfixtures準備」「general-purpose subagentへの引き継ぎ情報の整理」に関する項目が含まれることを確認する
- 期待値：test_designフェーズのchecklistにトレーサビリティ・fixtures・引き継ぎに関する項目が含まれる

**TC-6-3（implementationフェーズchecklistのspec.md確認指示の検証）**
- spec.md FR対応：フェーズ7「implementationフェーズのchecklistにspec.mdの機能一覧確認等を含める」
- 検証内容：PHASE_GUIDESのimplementationフェーズのchecklistに「spec.mdの機能一覧確認」「state-machine.mmdの全状態遷移把握」「flowchart.mmdの全処理フロー把握」に関する項目が含まれることを確認する
- 期待値：implementationフェーズのchecklistに設計書確認に関する3項目以上が含まれる

**TC-6-4（ui_designフェーズchecklistのStorybookストーリー定義指示の検証）**
- spec.md FR対応：フェーズ7「ui-designフェーズのchecklistにStorybookストーリー定義の追加を含める」
- 検証内容：PHASE_GUIDESのui_designフェーズのchecklistに「コンポーネント仕様の記述」「Storybookストーリー定義の追加」「responsive設計の確認」「accessibility要件の確認」に関する項目が含まれることを確認する（CDD = Component-Driven Development対応）
- 期待値：ui_designフェーズのchecklistにStorybookおよびaccessibilityに関する項目が含まれる

---

### グループ7: validateArtifact関数のphaseGuide統合検証（artifact-validator.ts・status.ts）

**TC-7-1（validateArtifact関数のphaseGuide引数追加検証）**
- spec.md FR対応：フェーズ8「validateArtifact関数の引数にphaseGuideをオプショナルパラメータとして追加」
- 検証内容：validateArtifact関数がphaseGuideオプショナルパラメータを受け付けること。phaseGuideなしで呼び出した場合（既存の呼び出し元との後方互換性確保）に例外が発生しないことを確認する
- 期待値：phaseGuideなし呼び出しでも正常動作

**TC-7-2（phaseGuide.requiredSectionsからのrequiredSections取得検証）**
- spec.md FR対応：フェーズ8「requiredSectionsをPHASE_GUIDESから取得するように変更」
- 検証内容：phaseGuideを持つvalidateArtifact呼び出しで、PHASE_ARTIFACT_REQUIREMENTSではなくphaseGuide.requiredSectionsが参照されることを確認する。PHASE_ARTIFACT_REQUIREMENTSからrequiredSectionsフィールドが削除され、minLinesのみが残されていることも検証する
- 期待値：phaseGuide.requiredSectionsで指定されたセクションが検証対象となる

---

## GlobalRulesフィールド詳細テスト

### 構造的行除外パターンの詳細検証

重複検出から除外される構造的行（structuralLine）の各パターンが正しく機能することを検証するテストグループを設ける。除外後の重複カウントが閾値（3回以上同一行の出現）と比較されることを確認する。

headersフィールドの正規表現がハッシュ記号で始まる見出し行（開始記号としてのハッシュ）にマッチすることを検証する。水平線フィールドであるhorizontalRulesが終了行として3文字以上の記号繰り返し（ハイフン・アスタリスク・アンダースコア）にマッチすることを確認する。codeFencesフィールドがコードブロック開始・終了行にマッチし、コードフェンス内の行も重複検出から除外されることを検証する。

tableDataRowsフィールドがパイプ区切り2カラム以上のテーブルデータ行にマッチすることを確認する。tableSeparatorsフィールドがパイプとコロンとスペースからなる区切り行にマッチすることを検証する。boldLabelsフィールドが太字ラベル（アスタリスク2つで囲まれたテキストのみで終わる行）にマッチすることを確認する。listBoldLabelsフィールドがリスト先頭の太字ラベルのみの行にマッチすることを検証する。

duplicateLineThresholdが固定値3であることを維持し、最小閾値として正確に機能することを検証する。最小実質行数としてのminSectionLinesが5であること、最大lineCountとしてのmaxSummaryLinesが200であることを確認する。最小長閾値としてのshortLineMinLengthが10文字であり、ヘッダーのみチェック用の最小非ヘッダー行数（minNonHeaderLines=5）が一意に設定されていることを検証する。最小状態数（mermaidMinStates=3）と最小遷移数（mermaidMinTransitions=2）が既存定数として正確に定義されていることを確認する。

---

## BashWhitelist詳細テスト

### ホワイトリストチェックロジックの詳細検証

getBashWhitelist関数が公開する唯一のインターフェースとして、外部からアクセス可能な形でコマンドリストを提供することを確認する。既存のコマンドホワイトリストチェックロジックへの影響がないことを、関数追加前後のgrep結果を照合して検証する。

expandCategories関数は各カテゴリのコマンドの和集合を計算する展開関数であり、容易に利用できるようにインポート可能な形で公開されていることを確認する。複数カテゴリの和集合計算において、直前の処理で重複が除去されアルファベット順に並んでいることを検証する。選択肢として存在しないカテゴリ名を渡した場合でも0件が返る安全な動作を確認する。

役割として、各カテゴリ（readonly・testing・implementation・git）が主要入力となるパラメータを受け取り、代替手段（Read/Write/Editツール）を使用すべき場面との境界を明確にする情報を提供することを検証する。編集制限フェーズにおいて各拡張子の制約が正しく反映されることも確認する。

---

## buildPrompt 9セクション詳細テスト

### セクション別の詳細テスト設計

buildPromptが生成する9つのプロンプトセクションそれぞれについて、出力内容の正確性を詳細に検証する。ファイルセクション（セクション2）については、inputFileMetadataが存在する場合と存在しない場合の分岐が正しく動作することを確認する。サマリーセクション（セクション9の一部）については、出力先パス・必須化の理由・バリデーション失敗時の対応が含まれることを検証する。

リトライプロンプトセクション（TC-4-13で検証するセクション4）については、buildPromptを内部で呼び出して生成した元のプロンプト全文が含まれることを確認する。リトライヘッダー（セクション1）については、フェーズ名とリトライ回数がそれぞれ含まれ、直後にバリデーション失敗理由が続くことを検証する。

対応表（エラー種別と修正指示の対応）が正確に実装されていることを確認するため、各エラー種別について具体的修正指示の文字列内容をアサーションで検証する。検査対象となるerrorMessage文字列に、上記に示した11種類のキーワードが含まれているかどうかの種別判定が正しく機能することを確認する。

単純置換から9セクション生成への移行によって、既存呼び出し元（status.ts）のコードが同様に動作し続けることを検証する。プロンプト生成の品質が向上し、実質的な本文・説明文が充実したプロンプトが生成されることを確認する。通過基準として、プロンプト内にspec.md記載の全品質要件が含まれていることを上記のテストケースで確認済みであることを明記する。

---

## 統合テスト詳細

### IT-1: エンドツーエンドのプロンプト生成フロー

**目的**：resolvePhaseGuide → buildPrompt → subagentTemplate格納の完全フローを検証する。

実際のPHASE_GUIDESからtest_designフェーズのPhaseGuideを取得し、resolvePhaseGuideを呼び出す。生成されたsubagentTemplateがGlobalRules.forbiddenPatternsの各要素・BashWhitelist.securityEnvVarsの各変数名（HMAC_STRICTを含む8変数）・guide.requiredSectionsの各要素・guide.allowedBashCategoriesの展開コマンドリストを全て含むことを確認する。

代表的な検証項目として、主要入力ファイルのパス（ファイル・パス）がプロンプトに含まれること、キーワード・トレーサビリティの閾値（0.8）がプロンプト内で参照されること、アサーション・テストケース・最小件数の各フィールドが展開されていることを確認する。構造把握のために整合性チェックとして、設計書の内容が一意に実装されていることを検証する。

テスト環境ではMCPサーバーの再起動を模倣するためモジュールキャッシュをリセットした後、モジュールを再importして検証する。実行時間が100ms以内に収まることでNFR-1（パフォーマンス要件）を検証する。影響範囲特定として、変更対象の6ファイル以外への副作用がないことを確認し、各要件への一意なIDの付与（TC番号）による管理が有効に機能していることを確認する。

### IT-2: バリデーション失敗からリトライプロンプト生成のフロー

**目的**：ValidationResult由来のerrorMessageからbuildRetryPromptが正確なリトライプロンプトを生成するフローを検証する。

validateArtifactがValidationResult（isValid=false・errors配列にduplicate line errorを含む）を返すケースをモックし、そのerrorMessageをbuildRetryPromptに渡す。生成されたリトライプロンプトが同一行繰り返し修正指示を含み、元のbuildPromptのプロンプト全文も含むことを確認する。Orchestratorがキーワード・トレーサビリティ（traceabilityThreshold=0.8）を達成するためのリトライプロンプトを生成できることを確認する。

一元化されたバリデーションロジックによって、validateArtifactQualityCore関数がphaseGuideのrequiredSectionsを参照して検証を行うことを確認する。バリデーションエラーメッセージの全文がリトライプロンプトに正確に引用されることも検証する。

### IT-3: PHASE_ARTIFACT_REQUIREMENTSとPHASE_GUIDESの統合検証

**目的**：requiredSectionsの二重管理解消をエンドツーエンドで検証する。

manual_testフェーズのPhaseGuideをresolvePhaseGuideで解決し、validateArtifactにphaseGuide引数を渡してrequiredSections（テストシナリオ・テスト結果）の検証が行われることを確認する。PHASE_ARTIFACT_REQUIREMENTSからrequiredSectionsが削除された後も、バリデーション精度が保たれることを統合的に確認する。

一元管理の実装確認として、PHASE_GUIDESが全フェーズのrequiredSectionsの唯一の定義源となっていることを検証する。整合性の観点から、PHASE_GUIDESの変更が即座にvalidateArtifactの動作に反映されることを確認する。

---

## 非機能要件テスト詳細

### NFR-1: パフォーマンス要件テスト（APIと同期処理の検証）

**目的**：buildPromptとbuildRetryPromptの実行時間がNFR-1仕様（1ms以内）を満たすことを検証する。

performance.now()またはprocess.hrtime.bigint()を使用してbuildPrompt関数の実行時間を計測する。GLOBAL_RULES_CACHE・BASH_WHITELIST_CACHEがモジュールロード時にキャッシュ済みの状態で呼び出した場合（キャッシュヒット時）の実行時間が1ms以内であることを検証する。

api経由でPhaseGuideが提供される際のレスポンス時間への影響を最小化するため、buildPromptが同期関数として実装されていることを確認する。emit操作やPromise処理が含まれていないことを検証する。minimum実行時間の計測として、100回連続呼び出しの平均実行時間が0.5ms以内であることも確認する（lineCount・lineRatio・structuralLine判定コストの最小化を検証する）。

ワークフローシステム全体のパフォーマンスに影響するサーバープロセスの再起動要件があるため、MCPサーバーの起動時間計測も統合テストの補足項目として含める。

### NFR-2: アーキテクチャ設計方針の検証（データ駆動・LLM対応）

**目的**：データ駆動アーキテクチャ・単一責任原則・純粋関数設計のNFR-2仕様に準拠することを検証する。

buildPromptとbuildRetryPromptが副作用のない純粋関数であることを検証する（同一入力に対して常に同一出力・writeFileSync等のI/O操作なし）。buildPromptが文字列組み立てロジックのみを実装し、バリデーションロジック・フック処理を一切含まないことを確認する（単一責任原則の遵守）。

LLM（claude等）のsubagentがプロンプトの内容を正しく解釈できるよう、claude-md-parserと連携したCLAUDE.mdの分割配信機構が変更後も機能することを確認する。prompt-builderとしての役割を果たすbuildPromptが、LLMへの指示解釈精度を高めるに十分な情報量（5000〜8000文字程度）を持つプロンプトを生成することを検証する。

CLAUDE.mdとPhaseGuideの乖離問題を解消するラッパーとして、exportGlobalRulesとgetBashWhitelistが機能することを確認する。これにより、グローバルルール（GlobalRules）とコマンドホワイトリストチェックロジックの情報が自動的に最新状態でLLMに提供される仕組みが実装されていることを検証する。

header-onlyチェックロジックが正しく機能することも確認する（ls-files等のコマンドがreadonlyカテゴリに含まれることとあわせて検証）。

### NFR-3: 後方互換性確保の検証（インポート・エクスポート）

**目的**：NFR-3仕様の後方互換性確保方針が正確に実装されていることを検証する。

resolvePhaseGuide関数のシグネチャが変更前と同一であることを関数のtoString()または型定義で確認する。status.tsの既存validateArtifact呼び出し箇所（約5箇所）がphaseGuide引数なしでも正常動作することを確認する。型拡張によるPhaseGuide.checklistの追加がオプショナルパラメータとして実装されており、既存のPhaseGuideインスタンスが破損しないことを検証する（後方互換性確保）。

エクスポートされる関数（exportGlobalRules・getBashWhitelist・buildPrompt・buildRetryPrompt）のシグネチャがspec.mdに記載された仕様通りであることを確認する。インポート側のstatus.tsが既存の呼び出し元として変更なしに動作することを実装確認する。コピーではなく参照渡しによってキャッシュ済みオブジェクト（GLOBAL_RULES_CACHE・BASH_WHITELIST_CACHE）が効率的に利用されることを検証する。

### NFR-4: テスタビリティの検証（バリデータとモック）

**目的**：NFR-4仕様のテスタビリティ要件が満たされていることを検証する。

buildPromptとbuildRetryPromptが純粋関数として実装されており、テスト時にPhaseGuideモックオブジェクトを注入するだけで単体テストが可能であることを確認する。GLOBAL_RULES_CACHEのモジュールキャッシュ分離（モック注入パターン）が動作することを確認する。

バリデータ（artifact-validator.ts）がexportGlobalRules関数を通じてGlobalRulesインスタンスをモック可能な形で公開していることを検証する。アクセス制御として、バリデーションロジック自体への外部直接アクセスが制限され、exportGlobalRulesのみが公開インターフェースとなっていることを確認する。

---

## 境界値・異常系テスト

### 境界値テスト

**BVT-1（プロンプト文字数の上限警告閾値検証）**：GlobalRulesとBashWhitelistを完全展開した場合のbuildPrompt出力が8000文字を超えた際に警告ログが出力されること（spec.md記載の「5000〜8000文字を想定」に基づく）。コンテキストウィンドウ（200Kトークン）の制約内に収まる文字数であることも検証する。

**BVT-2（forbiddenPatternsが0件の場合の安全性）**：GlobalRulesのforbiddenPatternsが空配列の場合にbuildPromptがエラーなく動作し、セクション5の禁止パターン部分が適切に省略または「なし」と表示されることを確認する。

**BVT-3（allowedBashCategoriesが空配列の場合の安全性）**：guide.allowedBashCategoriesが空配列の場合にexpandCategories([])が空配列を返し、セクション6のコマンドホワイトリストが空として表示されることを確認する。

### 異常系テスト

**ABT-1（MIN_SECTION_DENSITY環境変数に不正値設定時のパースエラー処理）**：MIN_SECTION_DENSITYに"abc"（不正な数値文字列）を設定してexportGlobalRulesを呼び出した場合、クラッシュせずデフォルト値0.3にフォールバックすること（環境変数保護設計の確認）。

**ABT-2（buildRetryPromptのretryCount=0設定時の安全性）**：retryCountに0を指定してbuildRetryPromptを呼び出した場合に例外が発生せず、リトライヘッダーに'0'または'0回目'が含まれることを確認する。

**ABT-3（expandCategoriesに重複カテゴリ名を指定した場合の挙動）**：expandCategories(['readonly', 'readonly'])のように重複カテゴリ名を指定した場合に、コマンドリストが重複なくアルファベット順で返されることを確認する（spec.md仕様の重複除去動作を検証）。

**ABT-4（userIntentに特殊文字が含まれる場合のプロンプトインジェクション対策）**：userIntentに改行・バッククォート・コードブロック記号等の特殊文字を含む文字列を渡した場合、buildPromptがエスケープせずそのまま文字列に含めること（spec.mdの「プロンプトインジェクション対策としてuserIntentの特殊文字はエスケープせずそのまま使用する」方針に基づく）。

---

## テストファイル配置と実装手順

### テストファイル配置

全テストファイルはプロジェクトルートに散らかさず、以下のパスに配置する。

```
workflow-plugin/mcp-server/src/
├── state/__tests__/types.test.ts               # グループ1（TC-1-1〜TC-1-15）
├── validation/__tests__/artifact-validator.test.ts  # グループ1一部・グループ7
├── phases/__tests__/definitions.test.ts        # グループ3〜グループ6（TC-3-1〜TC-6-4）
└── phases/__tests__/definitions.integration.test.ts # IT-1〜IT-3統合テスト

workflow-plugin/hooks/__tests__/bash-whitelist.test.js  # グループ2（TC-2-1〜TC-2-9）
```

### 実装手順

test_implフェーズでは以下の順序でテストコード（Redフェーズ）を実装する。

優先度1（基盤構築）：types.test.tsでGlobalRules型・BashWhitelist型・ValidationResult型・PhaseGuide.checklist後方互換性のテストを実装する。モジュールキャッシュ分離のためbeforeEach/afterEachでprocess.envをリセットするfixtures準備も実施する。

優先度2（コア機能）：definitions.test.tsでbuildPrompt関数の9セクション検証（TC-3-1〜TC-3-21）とbuildRetryPrompt関数の11種類エラー種別検証（TC-4-1〜TC-4-14）を実装する。PhaseGuideモックオブジェクト（4種類）とGlobalRulesモックオブジェクトをテストデータとして定義する。

優先度3（統合作業）：definitions.integration.test.tsで実際のPHASE_GUIDESと環境変数を使用したIT-1〜IT-3の統合テストを実装する。MCPサーバーのモジュールキャッシュ問題に対応するため、jest.resetModules()またはdynamic import()パターンを使用する。

優先度4（非機能）：NFR-1（パフォーマンス）・NFR-2（アーキテクチャ）・NFR-3（後方互換性）・NFR-4（テスタビリティ）のテストを別ファイル（nfr.test.ts）として実装する。各実装ステップの動作確認が完了した段階で、段階的にテストを追加していく。
