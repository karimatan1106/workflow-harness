## サマリー
- [PL-001][decision] registry.tsの17フェーズ分のoutputFileをすべて.md拡張子から.toon拡張子に変更することがTOON-only移行の起点となる
- [PL-002][decision] dod-l3.tsのanalyzeArtifact関数はMarkdown専用ロジックを全廃しtoonDecodeベースの新実装に置き換える
- [PL-003][decision] dod-l4-delta.tsのcheckDeltaEntryFormatをdecisions[]配列のlength検証に全面置き換えし、DELTA_ENTRY_REGEXとセクション区間検出を廃止する
- [PL-004][decision] dod-l4-requirements.tsの4関数はrequirements.toonから値を読む実装に変更しハードコードパスrequirements.mdを解消する
- [PL-005][decision] checkToonCheckpointをL1チェックに統合し、dod-l4-toon.tsの独立チェックとして廃止する
- [PL-006][decision] definitions.tsのOUTPUT_FILE_TO_PHASEマッピングを全エントリで.md→.toon拡張子に変更し、buildToonFirstSectionのMDフォールバック指示を削除する
- [PL-007][decision] defs-stage1〜6.tsの全subagentテンプレートからMD生成指示を削除しTOON成果物生成のみに変更する
- [PL-008][decision] CLAUDE.md Section 13の成果物品質要件をTOON-only前提に全面更新し、Markdown見出し前提の記述をTOONキー名前提の記述に置き換える
- [PL-009][constraint] 各dod-*.tsファイルの200行以下制限（CLAUDE.md Section 1）を維持する
- [PL-010][constraint] フォールバック実装（.toon不在時に.mdを試みる分岐）は実装しない。進行中タスクゼロにつき一括切り替えを採用する
- [PL-011][risk] dod-l4-requirements.tsの4関数はrequirements.toonをtoonDecodeで読む実装に変わるが、TOONのacceptanceCriteria[]キーからAC数を取得する際にフィールド名の不一致が起きうる
- [PL-012][next] 実装順序: registry.ts → definitions.ts → dod-l3.ts → dod-l4-delta.ts → dod-l4-requirements.ts → dod-l4-toon.ts → defs-stage1〜6.ts → CLAUDE.md

## 概要

本仕様書はTOON-onlyフェーズ成果物移行タスクのplanningフェーズ成果物である。
現状ではハーネスの各フェーズがMarkdown（.md）形式の成果物を生成し、DoDバリデーターがMarkdown形式を前提に検証している。
TOON-only移行後は全フェーズの成果物がTOON（.toon）形式のみとなり、Markdown成果物は生成されない。
この移行によりsubagentのコンテキスト効率が40〜50%向上し、10M行超規模コードベースでの運用がより安定する。
移行の対象はDoDバリデーター4ファイル・registry.ts・definitions.ts・defs-stage1〜6.ts・CLAUDE.mdの合計15ファイルである。
進行中タスクが存在しないことをresearch.toonのR-006決定に基づき確認済みとし、フォールバックなし一括切り替えを採用する。
npm run buildとnpm testの双方がゼロエラーで通過することを完了条件とする。

## 実装計画

実装は依存関係の上流から下流へ順番に進める。
最初にregistry.tsで17フェーズ分のoutputFileとinputFilesのパスを.toon拡張子に変更し、requiredSectionsをTOONキー名形式に変更する。
allowedExtensionsに.toonを追加し、バリデーターがTOON形式を受け付けるようにする。
次にdefinitions.tsのOUTPUT_FILE_TO_PHASEマッピングを全17エントリで.md→.toon拡張子に変更する。
buildToonFirstSectionのMDフォールバック指示（「TOONファイルが存在しない場合はMDファイルにフォールバックする」行）を削除する。
続いてdod-l3.tsのanalyzeArtifact関数を全面再実装する。
新実装はtoonDecodeの戻り値オブジェクトから全フィールドの文字数合計をcontentLines相当の指標として使用する。
sectionDensityの計算はdecisions・artifacts・nextなど各フィールド値の文字数合計を全フィールド合計で除した値を用いる。
次にdod-l4-delta.tsのcheckDeltaEntryFormatを置き換える。
DELTA_ENTRY_REGEX・セクション区間検出・DELTA_ENTRY_CATEGORIESのロジックを全て削除し、toonDecode後のdecisions[]配列のlength検証に置き換える。
DELTA_ENTRY_MIN_COUNTの5件要件はdecisions[]配列の最低5エントリ要件として維持する。
次にdod-l4-requirements.tsの4関数を変更する。
checkACFormat・checkNotInScope・checkIntentConsistency・checkOpenQuestionsの各関数でrequirements.mdへのハードコードパスをrequirements.toonへのパスに変更する。
内容の読み込みはreadFileSyncではなくtoonDecodeを使用し、TOONオブジェクトのacceptanceCriteria[]・notInScope[]・openQuestions[]キーの存在と値を検証する。
次にdod-l4-toon.tsのcheckToonCheckpointを廃止する。
L1のcheckL1FileExistsがoutputFile（.toon）の存在を確認するため、checkToonCheckpointは役割が重複する。
廃止にあたりdod-l4-toon.tsを呼び出している箇所（harness本体のgates runner）から参照を削除する。
次にdefs-stage1〜6.tsの全subagentテンプレートを更新する。
出力指示の「{docsDir}/xxx.md に保存してください」を「{docsDir}/xxx.toon に保存してください」に変更する。
SUMMARY_SECTIONプレースホルダーが展開する先（definitions-shared.tsのSUMMARY_SECTION_RULE）の内容も確認し、MD成果物への言及が残っていないことを確認する。
最後にCLAUDE.md Section 13を更新する。
Line Count and DensityセクションのMarkdown見出し前提の記述をTOONキー名前提の記述に変更する。
Required SectionsセクションのMarkdown見出し文字列一覧をTOONキー名形式に変更する。

## 変更対象ファイル

変更対象は合計15ファイルである。
全ファイルは200行以下の制限が適用されるため、改修は既存ファイル内の修正で完結させる。

DoDバリデーター（gatesディレクトリ）:
- `workflow-harness/mcp-server/src/gates/dod-l3.ts` — analyzeArtifact関数をtoonDecodeベースに全面再実装
- `workflow-harness/mcp-server/src/gates/dod-l4-content.ts` — checkRequiredSectionsのMarkdown見出し比較をTOONキー名比較に変更
- `workflow-harness/mcp-server/src/gates/dod-l4-delta.ts` — checkDeltaEntryFormatをdecisions[]配列length検証に全面置き換え
- `workflow-harness/mcp-server/src/gates/dod-l4-requirements.ts` — 4関数のrequirements.mdパスをrequirements.toonに変更しtoonDecodeで読む
- `workflow-harness/mcp-server/src/gates/dod-l4-toon.ts` — checkToonCheckpointを廃止し呼び出し元から参照を削除

フェーズ定義（phasesディレクトリ）:
- `workflow-harness/mcp-server/src/phases/registry.ts` — 17フェーズのoutputFile・inputFilesを.toon拡張子に変更、requiredSectionsをTOONキー名に変更
- `workflow-harness/mcp-server/src/phases/definitions.ts` — OUTPUT_FILE_TO_PHASEを.toon拡張子に変更、buildToonFirstSectionのMDフォールバック指示を削除
- `workflow-harness/mcp-server/src/phases/defs-stage1.ts` — scope_definition・research・impact_analysis・requirementsの出力指示をTOON形式に変更
- `workflow-harness/mcp-server/src/phases/defs-stage2.ts` — threat_modeling・planning・state_machine・flowchart・ui_designの出力指示をTOON形式に変更
- `workflow-harness/mcp-server/src/phases/defs-stage3.ts` — design_review・test_design・test_selectionの出力指示をTOON形式に変更
- `workflow-harness/mcp-server/src/phases/defs-stage4.ts` — code_reviewの出力指示をTOON形式に変更
- `workflow-harness/mcp-server/src/phases/defs-stage5.ts` — acceptance_verification・manual_test・security_scanの出力指示をTOON形式に変更
- `workflow-harness/mcp-server/src/phases/defs-stage6.ts` — performance_test・e2e_test・health_observationの出力指示をTOON形式に変更

設定・ドキュメント:
- `workflow-harness/CLAUDE.md` — Section 13をTOON-only前提に全面更新

## RTMエントリ（F-NNN定義）

F-001: registry.tsの17フェーズ分outputFile拡張子を.md→.toonに変更する
F-002: registry.tsのinputFilesパスを.md→.toonに変更する
F-003: registry.tsのrequiredSectionsをMarkdown見出し形式からTOONキー名形式に変更する
F-004: registry.tsのallowedExtensionsに.toonを追加する
F-005: definitions.tsのOUTPUT_FILE_TO_PHASEマッピングを.md→.toonに変更する
F-006: definitions.tsのbuildToonFirstSectionからMDフォールバック指示を削除する
F-007: dod-l3.tsのanalyzeArtifact関数をtoonDecodeベースに全面再実装する
F-008: dod-l4-content.tsのcheckRequiredSectionsをTOONキー名比較に変更する
F-009: dod-l4-delta.tsのcheckDeltaEntryFormatをdecisions[]配列length検証に置き換える
F-010: dod-l4-requirements.tsの4関数をrequirements.toonをtoonDecodeで読む実装に変更する
F-011: dod-l4-toon.tsのcheckToonCheckpointを廃止し呼び出し元から参照を削除する
F-012: defs-stage1〜6.tsの全subagentテンプレートの出力指示をTOON形式に変更する
F-013: CLAUDE.md Section 13をTOON-only前提に全面更新する
F-014: npm run buildがゼロエラーで通過することを確認する
F-015: npm testが全件通過することを確認する

## 実装順序と依存関係

実装の依存関係を下記に整理する。
各フェーズの完了条件はビルドエラーゼロとテスト通過である。

Step 1（最優先）: registry.tsの変更（F-001〜F-004）
Step 2（Step 1依存）: definitions.tsの変更（F-005〜F-006）
Step 3（Step 1依存）: dod-l3.tsの変更（F-007）
Step 4（Step 1依存）: dod-l4-content.tsの変更（F-008）
Step 5（Step 1依存）: dod-l4-delta.tsの変更（F-009）
Step 6（Step 1依存）: dod-l4-requirements.tsの変更（F-010）
Step 7（Step 1依存）: dod-l4-toon.tsの廃止（F-011）
Step 8（Step 2依存）: defs-stage1〜6.tsの変更（F-012）
Step 9（全変更後）: CLAUDE.md Section 13の更新（F-013）
Step 10（Step 9後）: npm run build実行とゼロエラー確認（F-014）
Step 11（Step 10後）: npm test実行と全件通過確認（F-015）

registry.tsはL1・L3・L4の全バリデーターから参照されるため最初に変更する。
definitions.tsの変更はregistry.tsのoutputFileがTOON拡張子になった後に行う。
dod-l4-toon.tsの廃止はgates runnerでの参照削除を伴うため、廃止前にrunnerの呼び出し箇所を確認する。
defs-stage1〜6.tsの変更はdefinitions.tsのbuildToonFirstSectionが更新された後に整合性を確認する。
