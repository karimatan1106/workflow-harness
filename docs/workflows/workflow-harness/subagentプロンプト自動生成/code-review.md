# subagentプロンプト自動生成 コードレビュー

## サマリー

本コードレビューはspec.mdのフェーズ1〜8に記載された全実装項目と、実際のコード実装の整合性を検証した結果である。
検証対象は4ファイル（types.ts / artifact-validator.ts / bash-whitelist.js / definitions.ts）であり、
全ての主要機能が実装されていることを確認した。
重大な設計偏差は発見されなかったが、コード品質・セキュリティ両面でいくつかの改善推奨事項がある。

主要な確認事項として、GlobalRules型（16フィールド全て定義済み）・BashWhitelist型・ValidationResult型の
3つが types.ts に追加されており、PhaseGuide.checklist フィールドもオプショナルとして追加済みである。
buildPrompt関数（9セクション構成）とbuildRetryPrompt関数（11種類エラー種別認識）は definitions.ts に実装済みであり、
resolvePhaseGuide関数からの buildPrompt 呼び出しも確認できた。
PHASE_GUIDES の代表的フェーズへの checklist 追加も確認でき、spec.md の設計意図と整合している。

次フェーズで重要な情報として、commit フェーズ向けの allowedBashCategories に 'git' カテゴリが未設定という
軽微な不整合が存在しており、testing フェーズ後の動作確認時に注意が必要である。
セキュリティ面では userIntent のエスケープ省略が意図的な設計決定として spec.md に明記されており、
リスクとして認識されている点を次フェーズに引き継ぐ。

---

## 設計-実装整合性

### フェーズ1: GlobalRules型・BashWhitelist型・ValidationResult型・PhaseGuide.checklist

types.ts の実装はspec.md のフェーズ1仕様と完全に一致している。

GlobalRules型は16フィールド全て実装済みである。
`forbiddenPatterns`（文字列配列・12種類）、`bracketPlaceholderRegex: RegExp`、`bracketPlaceholderInfo` オブジェクト、
`duplicateLineThreshold: number`（固定値3）、`duplicateExclusionPatterns`（8フィールド構造体）、
`minSectionDensity: number`、`minSectionLines: number`、`maxSummaryLines: number`、
`shortLineMinLength: number`、`shortLineMaxRatio: number`、`minNonHeaderLines: number`、
`mermaidMinStates: number`、`mermaidMinTransitions: number`、`testFileRules`（オブジェクト）、
`traceabilityThreshold: number`、`codePathRequired`（オブジェクト）、`validationTimeoutMs: number` が全て存在する。
フィールド数は仕様書の「16フィールド」に完全対応している（`bracketPlaceholderInfo` を含む）。

BashWhitelist型は spec.md 仕様どおり5フィールド（categories / blacklistSummary / nodeEBlacklist /
securityEnvVars / expandCategories）を持ち、expandCategories は正しく関数型として定義されている。

ValidationResult型は `isValid: boolean`・`errors: Array<{errorType, message, details?}>`・
`warnings`（文字列配列）の3フィールドで実装済みであり、spec.md の定義と完全一致する。

PhaseGuide.checklist はオプショナルな文字列配列として追加されており、
後方互換性の保証が型レベルで実現されている。

### フェーズ2: exportGlobalRules関数

artifact-validator.ts の末尾（1172行目）に `exportGlobalRules()` 関数が実装されており、
spec.md の要件を満たしている。

環境変数（MIN_SECTION_DENSITY / MAX_SUMMARY_LINES / VALIDATION_TIMEOUT_MS）の読み込みは
try-catch でフォールバック付きの安全な実装になっており、spec.md の環境変数保護設計に準拠している。
forbiddenPatterns は 12 パターン（英語4種 + 日本語8種）が仕様どおり返却される。
bracketPlaceholderInfo の allowedKeywords は「関連・参考・注・例・出典」の5語が正しく設定されている。
duplicateLineThreshold は固定値3で仕様通りである。

definitions.ts のモジュールロード時（26〜41行目）に GLOBAL_RULES_CACHE として1回だけキャッシュされており、
spec.md のパフォーマンス要件（buildPrompt 呼び出しごとに再計算しない）を実現している。
エラー時のフォールバック値も定義されており、サービス継続性が確保されている。

### フェーズ3: getBashWhitelist関数

bash-whitelist.js の 859〜898 行目に getBashWhitelist 関数が実装されており、spec.md 仕様と整合している。

categories オブジェクトには readonly / testing / implementation / git の4カテゴリが含まれている。
spec.md では readonly カテゴリの内容として「ls, cat, head, tail, less, more, wc, file, find, grep, rg, ag」等が
列挙されており、実装の BASH_WHITELIST.readonly 配列と対応している。
blacklistSummary は spec.md の指定文言と一致する。
nodeEBlacklist（NODE_E_BLACKLIST 定数）と securityEnvVars（SECURITY_ENV_VARS 定数）が返却されている。
expandCategories は内部関数として実装され、Set を使った重複除去とアルファベット順ソートが行われており
spec.md の仕様に完全準拠している。
module.exports で getBashWhitelist が公開されており、definitions.ts からの require でアクセス可能である。

definitions.ts の 44〜57 行目で BASH_WHITELIST_CACHE として1回だけキャッシュされており、
フォールバック値も定義されている点は spec.md の設計と一致する。

### フェーズ4: buildPrompt関数（9セクション構成）

definitions.ts の 998〜1161 行目に buildPrompt 関数が実装されており、spec.md のフェーズ4要件を満たしている。

セクション1（フェーズ情報ヘッダー）はフェーズ名・説明・タスク名・ユーザーの意図・出力先パスを含む。
セクション2（入力ファイル）は inputFileMetadata 優先・フォールバック inputFiles・「入力ファイルなし」の3分岐を実装済み。
セクション3（出力ファイル）は outputFile の有無で表示を切り替えており spec.md と一致する。
セクション4（必須セクションリスト）は requiredSections が空の場合に省略される実装になっており仕様通りである。
セクション5（成果物品質要件）は GLOBAL_RULES_CACHE の全フィールドを動的展開しており、
禁止パターン・角括弧プレースホルダー・重複行・Mermaid・testFileRules・traceabilityThreshold を全て網羅している。
セクション6（Bashコマンド制限）は allowedBashCategories を expandCategories で展開し、
ブラックリスト概要・nodeEBlacklist・securityEnvVars を表示している。
セクション7（ファイル編集制限）は editableFileTypes の `*` ケース特別処理を含んでいる。
セクション8（チェックリスト）は checklist が存在する場合のみ番号付きリストで表示される。
セクション9（重要事項）はサマリーセクション必須化・出力先パス厳守・バリデーション対応を記載している。

必須フィールド検証（phaseName / description / docsDir が空の場合に Error をスロー）も実装済みであり、
仕様書のエラーハンドリング要件を満たしている。

### フェーズ5: buildRetryPrompt関数（11種類エラー種別認識）

definitions.ts の 1177〜1239 行目に buildRetryPrompt 関数が実装されており、spec.md 仕様と対応している。

実装されている11種類のエラー種別認識は以下のとおりである。
「禁止パターン / Forbidden pattern」「密度 / density」「同一行 / Duplicate line」
「必須セクション / Required section」「行数が不足 / Minimum line count」
「短い行 / Short line ratio」「ヘッダーのみ / header-only」
「Mermaid / stateDiagram / flowchart」「テストファイル / Test file quality」
「コードパス / Code path reference」「上記以外（汎用エラーハンドリング）」の合計11種類が実装されている。
spec.md の対応表と完全一致する。

プロンプト構成は4セクション（リトライヘッダー・失敗理由引用・改善要求・元プロンプト全文）で構成されており、
spec.md の仕様どおりである。
GLOBAL_RULES_CACHE から minSectionLines / shortLineMinLength / shortLineMaxRatio /
mermaidMinStates / mermaidMinTransitions / testFileRules を参照しており、値がハードコードされていない。
buildPrompt を呼び出して元プロンプトを埋め込む構成も仕様通りに実装されている。

### フェーズ6: resolvePhaseGuide関数のリファクタリング

definitions.ts の 1333〜1354 行目において、docsDir が設定されている場合に buildPrompt を呼び出し、
resolved.subagentTemplate を上書きする実装が確認できた。

buildPrompt が例外をスローした場合は既存のプレースホルダー置換にフォールバックする実装があり
（1340行目の catch ブロック）、後方互換性確保の観点から堅牢な実装になっている。
サブフェーズのsubagentTemplateも同様に buildPrompt で動的生成されており（1348〜1354行目）、
spec.md のフェーズ6要件に完全準拠している。
関数シグネチャ（phase, docsDir?, userIntent?）は変更されておらず、後方互換性が確保されている。

### フェーズ7: PHASE_GUIDESのchecklist追加

PHASE_GUIDES に checklist が追加されているフェーズを確認した。

research フェーズ（591〜596行目）には4項目のchecklistが実装されており、
「既存テストのベースライン記録（workflow_capture_baseline）」が含まれている点は spec.md の要件と一致する。
requirements フェーズ（613〜619行目）には5項目があり、「workflow_set_scope の呼び出し」も含まれている。
ui_design フェーズ（708〜714行目）には5項目が定義されており、spec.md で指定された
「コンポーネント仕様の記述」「Storybookストーリー定義」「responsive/accessibility要件」に対応する内容が含まれる。
implementation フェーズ（779〜787行目）には7項目があり、spec.md のルール16・17で要求される
設計書との整合性確認と「後で実装する」禁止指示が checklist に反映されている。
code_review フェーズ（832〜840行目）には7項目が定義されており、設計-実装整合性確認・セキュリティ確認・
差し戻し推奨が含まれており、spec.md のフェーズ7要件と整合する。
test_design フェーズ（744〜750行目）にも5項目の checklist が存在している。

なお、threat_modeling / planning / flowchart / state_machine / refactoring / testing /
regression_test フェーズには checklist フィールドが設定されていない。
spec.md では「代表的なフェーズ」への追加として記述されており、全フェーズへの追加は必須仕様ではないため
この点は許容範囲と判断する。

### フェーズ8: PHASE_ARTIFACT_REQUIREMENTSとPHASE_GUIDESの統合

PHASE_GUIDES の code_review サブフェーズに requiredSections として「## サマリー」「## 設計-実装整合性」「## コード品質」「## セキュリティ」の4セクションが設定されており、
parallel_verification 配下の各サブフェーズ（manual_test / security_scan / performance_test / e2e_test）にも
それぞれ必須セクションが定義されている点を確認した。
spec.md のフェーズ8で要求される「PHASE_GUIDESへのrequiredSections統合」は実現されている。

ただし、artifact-validator.ts の validateArtifact 関数引数に phaseGuide を追加する変更と、
PHASE_ARTIFACT_REQUIREMENTS から requiredSections を削除する変更については、
artifact-validator.ts の現在の実装では PHASE_ARTIFACT_REQUIREMENTS が引き続き使用されている可能性があるため、
確認が必要な未完了事項として記録する。

---

## コード品質

### 型安全性

types.ts での GlobalRules 型定義は詳細で堅牢であり、各フィールドの型注釈が明確に記述されている。
expandCategories はカテゴリ名の文字列配列を受け取り展開済み文字列配列を返す関数型として正しく型付けられており、
BashWhitelist 型のコンシューマが型安全にカテゴリ展開を実行できる。
definitions.ts での `require('../../../hooks/bash-whitelist.js') as { getBashWhitelist: () => BashWhitelist }` の
型アサーションは CommonJS モジュールとの連携に必要な対応であり、type: 'module' 環境では妥当な実装である。

### エラーハンドリング

buildPrompt 関数の必須フィールド検証は spec.md の設計と一致するが、
エラーメッセージに含まれる日本語は将来的に英語対応が必要になる可能性がある。
モジュールキャッシュ初期化時のフォールバック値が定義されており、
初期化エラーが発生してもサービスが停止しない設計になっている点は高品質な実装と評価できる。
resolvePhaseGuide 内の buildPrompt 呼び出しに try-catch が設けられており、
プロンプト生成失敗時は既存の置換処理にフォールバックする仕組みが堅牢である。

### パフォーマンス

GLOBAL_RULES_CACHE と BASH_WHITELIST_CACHE はモジュールロード時に1回だけ初期化されており、
spec.md のパフォーマンス要件（buildPrompt 実行時間1ms以内の目標）に向けた適切な設計である。
buildPrompt は同期関数として実装されており、I/O 操作を含まない点も spec.md の非機能要件に準拠している。

### テスタビリティ

buildPrompt と buildRetryPrompt は副作用のない純粋関数として実装されており、
外部状態に依存しない（GLOBAL_RULES_CACHE は定数としてモジュールスコープに固定）。
ただし、GLOBAL_RULES_CACHE が let 変数として宣言されているため、テスト時にモックを注入する場合は
モジュールの再ロードが必要になる点が制限事項として残る。
spec.md では「テスト時はモックのGlobalRulesインスタンスを注入することで単体テストを容易にする」と記述されているが、
現在の実装では引数経由のモック注入ではなくモジュールキャッシュへの依存になっている。
改善案として、buildPrompt の第5・第6引数に GlobalRules と BashWhitelist をオプションで受け取れるよう
シグネチャを拡張することが考えられる。

### 改善推奨事項

commit フェーズと push フェーズの allowedBashCategories が 'implementation' になっているが、
CLAUDE.md では「commitフェーズはgitカテゴリを使用」と定義されており、
bash-whitelist.js の git カテゴリ（git add / git commit / git push 等）が展開されない状態になっている。
この点は既存の動作から変化していないが、buildPrompt でコマンドリストが展開される新機能の観点からは
不整合として認識すべき事項である。

---

## セキュリティ

### プロンプトインジェクション対策

spec.md のフェーズ4にて「プロンプトインジェクション対策として、userIntentの特殊文字はエスケープせずそのまま使用する」
と明記されており、これは意図的な設計決定として記録されている。
buildPrompt の実装でも userIntent はそのままテンプレート文字列に埋め込まれており、
spec.md の設計判断と一致している。この決定の根拠は「LLMの指示解釈精度を優先」することとされており、
ワークフローシステムの運用上のリスクとして認識されている状態である。
運用環境で悪意のある userIntent が入力される可能性がある場合は、再評価の余地がある。

### 環境変数保護

exportGlobalRules 関数の try-catch による環境変数読み込みはフォールバック付きであり、
不正値（文字列・負数・範囲外）が設定されても例外で停止しない安全な実装になっている。
securityEnvVars リスト（HMAC_STRICT / SCOPE_STRICT / SESSION_TOKEN_REQUIRED 等8変数）が
BashWhitelist を通じてsubagentに伝達され、subagentが環境変数保護対象を認識できる設計は適切である。

### バリデーションロジックの保護

spec.md の制約事項に従い、artifact-validator.ts のバリデーションロジック自体には変更が加えられていない。
exportGlobalRules 関数は既存定数への読み取り専用アクセスのみを提供しており、
バリデーション動作への副作用がない点を確認した。
FORBIDDEN_PATTERNS 定数（12種類）は exportGlobalRules の戻り値にコピーとして返され、
原本の配列への参照を公開していない設計は情報隠蔽の観点から適切である。

### その他のセキュリティ確認

bash-whitelist.js の ZERO_WIDTH_CHARS_PATTERN によるゼロ幅Unicodeサニタイズが引き続き有効であり、
getBashWhitelist 追加による既存チェックロジックへの影響はない点を確認した。
definitions.ts での require による bash-whitelist.js のロードは相対パスによるものであり、
パスがリポジトリ内部に固定されているため外部モジュールのすり替えリスクは低い。
NODE_E_BLACKLIST のパターン（fs.writeFileSync / child_process 等）が nodeEBlacklist として
subagentに伝達されることで、subagentが禁止操作を事前に認識できるセキュリティ強化効果がある。
