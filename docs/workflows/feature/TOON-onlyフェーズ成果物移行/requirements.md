## サマリー

- [REQ-001][decision] checkL1FileExistsはregistry.tsのoutputFile拡張子を.toonに変更するだけでTOON対応が完結する
- [REQ-002][decision] dod-l3.tsのanalyzeArtifact関数はMarkdown専用ロジックを全廃しtoonDecodeベースの新実装に置き換える
- [REQ-003][decision] dod-l4-delta.tsのcheckDeltaEntryFormatはdecisions[]配列のlength検証に全面置き換えする
- [REQ-004][decision] dod-l4-requirements.tsのcheckACFormat・checkNotInScope・checkOpenQuestionsをrequirements.toonから値を読む実装に変更する
- [REQ-005][decision] checkToonCheckpointをL1チェックに統合しdod-l4-toon.tsの独立チェックとしては廃止する
- [REQ-006][decision] フォールバック実装（.toon不在時に.mdを試みる分岐）は実装しない（進行中タスクゼロを確認済み）
- [REQ-007][constraint] 各dod-*.tsファイルの200行以下制限はTOON-only化後も維持する
- [REQ-008][finding] 変更対象ファイルはdod-l3.ts・dod-l4-content.ts・dod-l4-delta.ts・dod-l4-requirements.ts・dod-l4-toon.ts・registry.ts・definitions.ts・defs-stage1〜6.tsおよびCLAUDE.mdの合計15ファイルである
- [REQ-009][next] planningフェーズでanalyzeArtifact置き換えの詳細実装計画を立案すること
- [REQ-010][risk] dod-l4-requirements.tsのハードコードパス問題は4関数の個別改修が必要でありplanningで変更対象を明確化すること

## 機能要件

FR-1はdod-l1-l2.tsのoutputFile依存の変更によりTOON形式専用のL1存在確認チェックを実現する。
checkL1FileExistsはregistry.tsのoutputFileに設定された文字列パスをexistsSyncに渡すだけであり、拡張子変更のみで対応が完結する。
registry.tsの17フェーズ分のoutputFileをすべて.md拡張子から.toon拡張子に変更する。
inputFilesのパス文字列も.md拡張子から.toon拡張子に変更し、checkInputFilesExistが.toonファイルを要求するようにする。
allowedExtensionsに.toonを追加し、requiredSectionsがTOONキー名を参照するフェーズは.toon拡張子を許可する。

FR-2はdod-l3.tsのanalyzeArtifact関数をTOON形式解析に基づくL3品質チェックに全面改修する。
新しいanalyzeArtifact実装ではtoonDecodeの戻り値オブジェクトから全フィールドの文字数合計をcontentLine相当の指標として使用する。
checkL3QualityのsectionDensity30%下限はTOON形式でも維持し、decisions・artifacts・next等の各フィールド値の文字密度で計算する。
TOON形式には##見出し・コードフェンス・isStructuralLine対象行が存在しないため既存のMarkdownロジックが全無効になる。
Markdown解析ロジック（inCodeFence・headingMatch等）を全て除去し、toonDecodeベースの構造評価に置き換える。

FR-3はdod-l4-content.tsのcheckRequiredSectionsを変更しTOON値に対するL4パターン検証を実現する。
checkRequiredSectionsはMarkdown見出し文字列比較からTOONトップレベルキー名の存在確認に変更する。
TOON形式の必須フィールドはキー名で識別されMarkdown見出し比較ロジックは不要になる。
registry.tsのrequiredSectionsの値をMarkdown見出し形式（## サマリー等）からTOONキー名形式（decisions・artifacts・next等）に変更する。
dod-l4-delta.tsのcheckDeltaEntryFormatはDELTA_ENTRY_REGEX・セクション区間検出・カテゴリセット検証の全ロジックをTOONデコード後のdecisions[]配列長チェックで代替する。

FR-4はdod-l4-requirements.tsの4関数をrequirements.toonから値を読む実装に変更する。
checkACFormat・checkNotInScope・checkOpenQuestionsは現在requirements.mdをハードコードパスで参照しており個別対応が必要である。
checkACFormatはrequirements.toonのacceptanceCriteria[]フィールドの存在と件数（最低3件）を検証する。
checkNotInScopeはrequirements.toonのnotInScope[]フィールドの存在を検証する。
checkOpenQuestionsはrequirements.toonのopenQuestions[]フィールドの存在を検証する。

FR-5はsubagentテンプレート内の出力指示をTOON形式に変更しMD生成指示を廃止する。
defs-stage1.tsからdefs-stage6.tsの全subagentテンプレート内の出力指示をTOON形式の成果物を生成するよう変更する。
subagentが生成する成果物形式はテンプレート指示に従うため、MD生成指示を残すとバリデーターと不整合になる。
definitions.tsのbuildToonFirstSectionにある.mdフォールバック指示を削除する。
TOON-only移行後はinputFilesが全て.toonになるためMDへのフォールバック案内は不要かつ誤指示になる。

FR-6はCLAUDE.md Section 13の成果物品質要件をTOON-only前提に全面更新する。
Section 13はL3/L4チェックのルールを説明しており、TOON-only化後も整合する内容に更新が必要である。
Markdownの見出し・セクション密度・行数を前提とした記述を削除し、TOONフィールド構造を前提とした記述に書き換える。
定義済みのTOONキー名（decisions・artifacts・next等）を必須フィールドとして明記する。

## 非機能要件

NFR-1は後方互換性に関する非機能要件であり、フォールバックなし一括切り替えを採用する。
進行中タスクがゼロであることをresearch.toonのR-006決定に基づき移行前提条件として確認済みとして扱う。
.toon不在時に.mdを試みる分岐（フォールバック実装）は実装しない。
この決定はシステムのシンプルさを後方互換性コストより優先した結果であり要件として固定する。
フォールバックなし切り替え後に新規に開始するタスクは全てTOON形式のみを生成・利用する。

NFR-2はビルド品質に関する非機能要件であり、npm run buildが終了コード0で完了することを要求する。
TypeScript変更を伴う全15ファイルの改修後、型エラーゼロ・コンパイルエラーゼロが客観的な完了証拠となる。
ビルドチェックはworkflow-harness/mcp-server配下で実行し、全ソースファイルを対象とする。
既存の型定義（PhaseConfig・DoDCheckResult等）との整合性を維持した上でTOON対応の追加型定義を行う。
ビルド成功は実装フェーズ完了の最低条件であり、ビルド失敗のままphaseをadvanceすることは禁止である。

NFR-3は回帰テスト品質に関する非機能要件であり、npm testが全テスト通過で終了コード0であることを要求する。
既存のdod-basic.test.ts・dod-format.test.ts・dod-ia.test.ts・dod-l4-requirements.test.ts等のテストがリグレッションしないこと。
新規に追加するTOON対応バリデーターに対する単体テストを実装フェーズで追加すること。
テスト通過はchangeされた全バリデーター関数（checkL3Quality・checkDeltaEntryFormat・checkACFormat等）に対して確認する。
テスト失敗が0件であることを回帰テストフェーズで検証する。

NFR-4はコードサイズに関する非機能要件であり、各dod-*.tsファイルが200行以下を維持することを要求する。
CLAUDE.md Section 1の200行ルールはハーネスのコア原則であり改修でも厳守が必要である。
analyzeArtifact関数の置き換えで行数が増加する場合は、新しいTOON解析ロジックを別モジュールに分離することを許可する。
分離先モジュールのファイル名はdod-l3-toon.tsまたはdod-toon-analyzer.tsが候補であるが、planningフェーズで確定する。
200行制限超過の場合はリファクタリングを優先し、実装を先に進めてはならない。

## 受入基準

AC-1: harness_nextでDoDチェックを実行した際に.toonファイルのみが存在し.mdファイルが存在しないフェーズでもL1・L3・L4が全てpassとなること
AC-2: npm run buildがworkflow-harness/mcp-server配下で終了コード0で完了すること（型エラーゼロ・コンパイルエラーゼロ）
AC-3: npm testが全テスト通過（既存テストのリグレッションなし）で終了コード0であること
AC-4: CLAUDE.md Section 13がTOON-only形式の成果物品質要件として更新され、Markdown前提の記述が残っていないこと
AC-5: defs-stage1.tsからdefs-stage6.tsの全subagentテンプレートに.md成果物を生成する指示が残っていないこと

## NOT_IN_SCOPE

state_machine.mmdとflowchart.mmdのMermaid形式成果物はTOONに変換できない形式であり本タスクのスコープ外とする。
既存完了済みタスクの.md成果物を.toon形式にバッチ変換することはスコープ外とする（再実行しない完了済みタスクへの影響は運用ルールで対処する）。
@toon-format/toonライブラリ自体の変更またはバージョンアップはスコープ外とする。
CI/CDパイプラインや外部ドキュメントビューワーの対応はスコープ外とする。
outputFileを持たない11フェーズ（testing・implementation・refactoring・build_check・test_impl・regression_test・docs_update・commit・push・ci_verification・deploy）の変更はスコープ外とする。
state.tsやtypes.tsなどの型定義ファイルの大規模リファクタリングはスコープ外とする（最小限の型追加は許可する）。

## OPEN_QUESTIONS

なし
