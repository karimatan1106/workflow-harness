## サマリー

- [R-001][finding] checkL1FileExistsはPHASE_REGISTRYのconfig.outputFileを読み出し、{docsDir}/{workflowDir}プレースホルダーを置換してexistsSyncで存在確認している
- [R-002][finding] dod-l3.tsのanalyzeArtifact関数はMarkdown行を前提とした見出し判定（/^(#{1,6})\s+/）・コードフェンス追跡・isStructuralLine除外の3要素で構成されており、TOON形式に適合しない
- [R-003][finding] dod-l4-content.tsのcheckL4ContentValidationはcheckRequiredSectionsでsection.replace(/^#+\s*/, '')による##見出し文字列比較を行っており、TOONキー名への変更が必要
- [R-004][finding] dod-l4-delta.tsのcheckDeltaEntryFormatは/^##\s+サマリー/によるセクション検出とDELTA_ENTRY_REGEX（`- [ID][category] content`形式）マッチングで実装されており、TOONのdecisions[]テーブルへの移行が必要
- [R-005][finding] registry.tsのoutputFileは全17フェーズで`{docsDir}/フェーズ名.md`の形式で定義されており、.toon拡張子への変更がL1チェック経路の起点となる
- [R-006][risk] dod-l4-requirements.tsのcheckACFormat・checkNotInScope・checkOpenQuestionsはrequirements.mdをハードコードパスで読み込んでおり、requirements.toonへの移行時に個別対応が必要
- [R-007][decision] dod-l4-toon.tsのcheckToonCheckpointはTOON-onlyへの移行後にL1チェックと役割が重複するため、廃止またはL1統合の設計判断が必要

## 調査結果

dod-l1-l2.tsのcheckL1FileExistsは、PHASE_REGISTRYからconfig.outputFileを取得している。
config.outputFileがnull/undefinedの場合はpassed:trueを返す早期リターン設計になっている。
outputFileには`{docsDir}`と`{workflowDir}`の2種類のプレースホルダーが含まれ、replace()で展開されている。
展開後のパスに対してexistsSync()を呼び出し、存在すればpassed:trueを返している。
この実装はoutputFileの文字列値に完全依存しており、拡張子の変更だけでTOON対応が完結する。

dod-l3.tsのanalyzeArtifact関数はcontent.split('\n')で全行を取得している。
/^`{3,}/正規表現でコードフェンスを検出し、フェンス内の行をスキップするinCodeFenceフラグを管理している。
/^(#{1,6})\s+(.+)$/正規表現で見出し行を判定し、currentSectionを切り替えている。
isStructuralLine関数で水平線・テーブル行・太字ラベル等の構造行を除外している。
上記4要素はすべてMarkdown構文の前提に立っており、TOON形式のキー行（`key: value`）は構造行でも見出しでもないため、contentLine計算の挙動が変わる。
TOONのテーブルヘッダー行（`decisions[N]{id,statement,rationale}:`）はisStructuralLineの短ラベル正規表現に部分一致する可能性があり、誤判定リスクが存在する。
checkL3Quality関数はconfig.minLinesをcontentLinesと比較しており、minLines定義値はresearchフェーズで50行・scope_definitionで30行がregistry.tsに設定されている。
sectionDensityの30%未満チェックはTOON形式でも適用されるため、新しいanalyzeArtifact関数でもdensity計算ロジックを保持する必要がある。

dod-l4-content.tsのcheckL4ContentValidationはconfig.outputFileからファイルを読み込んでいる。
checkRequiredSections関数はdod-helpers.tsに定義されており、sectionをreplace(/^#+\s*/, '')でtrimした後、各行をtrimして同様の処理をして比較している。
requiredSectionsはregistry.tsのPhaseConfigに文字列配列として定義され、`## サマリー`等のMarkdown見出し形式になっている。
TOON移行後はrequiredSectionsの値をTOONのトップレベルキー名（例: `decisions`、`artifacts`、`next`）に変更し、TOONパーサーで検証する設計が適切である。

dod-l4-delta.tsのcheckDeltaEntryFormatはDELTA_ENTRY_APPLICABLE_PHASESセットに対象フェーズを定義している。
config.outputFileを展開した後にreadFileSyncで読み込み、行ごとにスキャンしている。
/^##\s+サマリー/のパターンでinSummaryフラグをtrueにし、次の`## `見出しでfalseに切り替える区間検出をしている。
区間内の`- [`で始まる行に対してDELTA_ENTRY_REGEX（`/^- \[[A-Z]{1,4}-\d{1,3}\]\[[a-z_]+\] .+/`）を適用している。
カテゴリ検証はDELTA_ENTRY_CATEGORIESセット（decision, constraint, risk, finding, next, dependency, assumption）との一致で行われている。
DELTA_ENTRY_MIN_COUNTは5に設定されており、5件未満でpassed:falseとなる。
TOONのdecisions[]フィールドに同等のバリデーションを移行する場合、toonDecodeの結果オブジェクトからdecisions配列を取得してlengthを検証するロジックに置き換えられる。

definitions.tsのOUTPUT_FILE_TO_PHASEマッピングは`'scope-definition.md': 'scope_definition'`等17エントリからなる。
buildToonFirstSection関数がinputFilesを走査してこのマッピングを参照し、TOONファイルを優先読みする指示文を生成している。
TOON-only化後はinputFiles自体が.toon拡張子に変更されるため、このフォールバック指示は不要になる。

## 既存実装の分析

TOON-only移行で最大の改修コストはdod-l3.tsのanalyzeArtifact関数の全面書き換えである。
現在のMarkdown解析ロジック（見出し判定・コードフェンス追跡・isStructuralLine除外）はすべて廃止対象となる。
TOON形式はキー行（`key: value`）・テーブルヘッダー行（`key[N]{cols}:`）・テーブルデータ行（インデント+カンマ区切り）・コメント行（`#`始まり）の4種類のみで構成される。
新しいanalyzeArtifact実装ではTOONのtoonDecodeを使い、デコード結果オブジェクトから各フィールドの値の文字数を合算してcontentLine相当の指標を計算するアプローチが安全である。
または行ベース解析を維持しつつ、テーブルデータ行（インデントあり・カンマ区切り）をcontentLineとしてカウントするシンプルな置き換えも可能である。

後方互換性問題の主要シナリオは進行中タスクのdocsDir下に.mdのみ存在する状況である。
このとき、registry.tsのoutputFileが.toonに変更された後でcheckL1FileExistsが.toonファイルを探しても見つからず、ゲートが失敗する。
また、inputFilesチェーン（checkInputFilesExist）が前フェーズの.toonファイルを要求するが、旧タスクでは.mdしか存在しないため同様に失敗する。
scope_definition.toonが存在するがresearch.toonが存在しない中途段階のタスクでは、researchフェーズ移行時にinputFilesチェックが失敗する可能性がある。
フォールバック実装（.toonが存在しない場合は.mdを試みる）を追加することで段階的移行が可能だが、その場合はcheckL1FileExistsとcheckInputFilesExistの両方に分岐ロジックが必要となる。
SD-004の決定に従いresearchフェーズで要否を決定するが、現在進行中タスクが存在しない場合はフォールバックなしの一括切り替えが最もシンプルである。

checkL3Qualityの改修コストはanalyzeArtifact関数の再実装と新しいTOON品質指標の設計を含む。
toonDecode（@toon-format/toon v2.1.0）を使ってデコードし、各フィールドの値の総文字数をcontentLinesの代替指標として使うアプローチが最も堅牢である。
既存のminLines・sectionDensity・sectionContentLineCount閾値はTOON形式に合わせて再定義が必要であり、特にsectionDensityの30%基準はTOON形式でも維持可能である。
改修はdod-l3.tsの内部にTOON専用のanalyzeArtifact関数（例: analyzeToonArtifact）を追加し、outputFileの拡張子判定で分岐するアプローチが既存テストへの影響を最小化する。

## 暗黙の制約・Magic Number 一覧

minLines閾値はresearchフェーズで50行、scope_definitionフェーズで30行がregistry.tsのPhaseConfigに定義されている。
sectionDensityの下限は30%（0.30）がdod-l3.tsのcheckL3Quality関数内にハードコードされている。
sectionContentLineCountの下限は5行がdod-l3.tsのcheckL3Quality関数内にハードコードされている。
DELTA_ENTRY_MIN_COUNTは5件がdod-l4-delta.tsのconst宣言でハードコードされている。
DELTA_ENTRY_REGEX文字列形式（大文字1-4字-数字1-3桁のID、小文字アンダースコアのカテゴリ）はdod-l4-delta.tsのconst宣言で定義されている。
TOON_APPLICABLE_PHASESセットは19フェーズがdod-l4-toon.tsのconst宣言で列挙されており、outputFileを持つ全フェーズと一致する。
checkIntentConsistencyのmissing語数閾値は3語がdod-l4-requirements.tsにハードコードされており、ユーザー意図キーワードの3語以上不一致で失敗する。
CIC-1のlineCount最小値はuserIntent.length / 5の整数部がdod-l4-requirements.tsで計算されており、動的な下限閾値として機能する。

## 依存バージョン固有挙動

ビルドコマンドはworkflow-harness/mcp-server配下でnpm run build（tsc）を実行する。
テストコマンドはworkflow-harness/mcp-server配下でnpm test（vitest run）を実行する。
Node.jsバージョンはv22.15.0であり、ESMモジュール（`"type": "module"`）がpackage.jsonで宣言されている。
TypeScriptバージョンは5.9.3（devDependencies: "typescript": "^5.4.0"）であり、import pathに.js拡張子が必要なESM出力設定になっている。
@toon-format/toon v2.1.0がdependenciesに定義されており、decode関数がdod-l4-toon.tsでimportされている。
analyzeArtifact関数を変更する場合はtoonDecodeの型定義（戻り値の型）を確認しておく必要がある。
vitest v1.6.0がdevDependenciesに定義されており、テストファイルはmcp-server/src配下に配置される。
TypeScript変更を伴うためnpm run buildのゼロエラー確認とnpm testのゼロ失敗確認が完了条件となる。
