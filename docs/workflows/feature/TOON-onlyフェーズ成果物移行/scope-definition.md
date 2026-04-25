## サマリー

このタスクはworkflow-harnessのフェーズ成果物管理をMD+TOON二重管理からTOON単一管理へ移行することを目的とする。現在のハーネスはDoDバリデーター（dod-l1-l2.ts、dod-l3.ts、dod-l4-content.ts、dod-l4-delta.ts）がMDファイルを主成果物として前提設計されており、TOONチェックポイントは補助的な役割にとどまっている。移行後はTOONファイルが唯一のprimary artifactとなり、L1存在確認・L3品質評価・L4パターン検証のすべてがTOONファイルに対して実施される体制に切り替わる。変更対象は9ファイルに限定されており、TypeScriptのビルドとテストの通過が完了条件となる。MDのDelta Entry形式（`## サマリー` + `- [ID][category] content`）はTOONのdecisions[]テーブルとfindings[]テーブルに置き換えられ、必須セクション検証もTOONフィールド名ベースに変更される。state_machine.mmdとflowchart.mmdはMermaid形式の性質上スコープ外であり、既存完了済みタスクのMDファイルをTOONに変換するバッチ処理も本タスクに含まない。後方互換性への対処としては、進行中タスクのみを移行対象とし完了済みタスクは再実行しない運用ルールを採用する。
移行によって影響を受ける主要ファイルはmcp-server/src/gates/配下のバリデーターとphases/registry.tsであり、それぞれの責務に応じた改修方針をresearchフェーズで確定する。
実装順序としてはregistry.tsのoutputFile変更を最初に行い、続いてL1チェック・L3チェック・L4チェックの順に改修することでビルド破損期間を最小化する。

- [SD-001][decision] TOON-onlyへの移行はDoDバリデーター・registry・subagentテンプレート・CLAUDE.mdの4箇所を同時変更することで実現する
- [SD-002][finding] checkL3Quality全面改修が実装コスト最大の変更箇所であり、TOON形式のキー行・配列テーブル行を解析して行数・密度指標を算出するロジックへの置き換えが必要
- [SD-003][risk] 進行中タスクのdocsDir下に.mdのみ存在するとcheckInputFilesExistが失敗するため、移行戦略の決定が実装前に必要
- [SD-004][finding] dod-l3.tsのanalyzeArtifact関数がMarkdown行解析（見出し判定・コードフェンス追跡）を前提としており、TOON-only移行で全面改修が必要である
- [SD-005][risk] 進行中タスクのdocsDir下に.mdのみ存在する場合にcheckInputFilesExistが失敗するリスクがあり、フォールバック実装の要否をresearchフェーズで確定する必要がある

## スコープ定義

このタスクはworkflow-harnessのフェーズ成果物形式をMDとTOONの二重管理からTOON単一管理に移行する変更である。現在のハーネスはDoDチェック（dod-l1-l2.ts、dod-l3.ts等）がMDファイルを前提として設計されており、TOONチェックポイントは補助的な役割にとどまっている。移行後はTOONファイルがprimary artifactとなり、L1存在確認・L3品質チェック・L4パターン検証すべてがTOONファイルに対して実施される。変更はmcp-server/src/gates/配下の5ファイルとphases/registry.tsを含む合計9ファイルに及び、TypeScriptのビルドとテストの通過が必要である。MDファイルのDelta Entry形式（`## サマリー` + `- [ID][category] content`）は廃止され、TOONのdecisions[]テーブルとfindings[]テーブルで代替される。削除されるMDの必須セクション検証（`## スコープ定義`、`## 調査結果`等）はTOONの対応フィールドの存在確認に置き換わる。CLAUDE.md Section 13の成果物品質要件も全面的にTOON形式の記述に更新が必要である。subagentテンプレート内の`## サマリー`やDelta Entry形式の記述はTOONのdecisions[]形式の説明に変更する。変更対象フェーズはoutputFileを持つ17フェーズ（state_machine・flowchartを除く）であり、testing・implementation等のoutputFile非保持フェーズは変更不要である。
移行完了後のフェーズ出力は.toon拡張子のファイルのみとなり、MD出力を期待する下流処理が存在しないことをresearchフェーズで確認する。
変更対象の9ファイルはすべてworkflow-harnessサブモジュール内に収まるため、親リポジトリへの直接変更は発生しない。

- registry.ts: outputFileを`.md`から`.toon`に変更（17フェーズ分）
- dod-l1-l2.ts: checkL1FileExistsがTOONファイルの存在を確認するよう変更
- defs-stage1.ts〜defs-stage6.ts: subagentTemplate内のMD出力指示をTOON出力指示に変更
- dod-l4-delta.tsのcheckDeltaEntryFormat: TOONのdecisions[]フィールドを代替検証対象として再定義する

## 影響範囲

DoDバリデーターへの影響が最も広範である。dod-l1-l2.tsのcheckL1FileExistsはPHASE_REGISTRYのoutputFileフィールドに記載された.mdパスを必須としているため、.toon拡張子への変更により全フェーズのゲート動作が変わる。dod-l3.tsのcheckL3Qualityは現在MDの行を解析してcontentLines・sectionDensity・sectionContentLineCountを算出しており、TOON形式のキー行・配列テーブル行を解析して同等指標を算出するロジックへの全面改修が最大の実装コストとなる。dod-l4-content.tsのcheckL4ContentValidationはMD全文に対してcheckForbiddenPatterns・checkBracketPlaceholders・checkDuplicateLines・checkRequiredSectionsを適用しているが、移行後はTOONフィールド値を対象とする検証に変わり、requiredSectionsの`## 見出し`がTOONキー名（decisions、artifactsなど）に置き換わる。dod-l4-delta.tsのcheckDeltaEntryFormatは現在MD内`## サマリー`セクションのDelta Entry行を検証しているが、TOONのdecisions[]フィールドを代替検証対象として再定義する。dod-l4-toon.tsが担う「TOONが補助ファイルとして存在するか」という確認はL1チェックに統合可能となるため、役割の重複排除設計が必要である。definitions.tsのbuildToonFirstSection（前フェーズTOONが存在すればMDより先に読むフォールバック指示）はTOON-only化により不要となり廃止する。definitions.tsのOUTPUT_FILE_TO_PHASEマッピング（`'scope-definition.md': 'scope_definition'`等17エントリ）も.toonベースに変更するか削除する。CLAUDE.md Section 13の「Line Count and Density」計算基準・「Required Sections」の`##`見出し定義・「Forbidden Patterns」の適用対象説明もすべてTOON形式ベースに更新が必要である。
analyzeArtifact関数の改修ではTOONの構造（key: value行・table[]テーブル行・コメント行）を区別してcontentLine密度を計算するアルゴリズムへの置き換えが必要であり、既存のMD見出し判定ロジック（`## ` プレフィックス判定）とコードフェンス追跡ロジックは全廃となる。
dod-l4-content.tsのcheckRequiredSectionsで参照するsectionリスト（`scope_definition`・`findings`・`artifacts`等）はTOONのトップレベルキー名に統一され、MD見出し文字列との混在は解消される。

- 後方互換性リスク: 進行中タスクのdocsDir下に.mdのみ存在するとcheckInputFilesExistが失敗する
- inputFilesチェーン（IFV-1）はregistry.tsのoutputFile変更と連動して変更が必要
- subagentTemplateを持つ全フェーズ（defs-stage1〜6）の出力指示が変更対象
- dod-l4-toon.tsの役割変更: 補助ファイル確認からL1統合への責務移転を設計フェーズで確定する
- OUTPUT_FILE_TO_PHASEマッピング変更: 17エントリの拡張子を.mdから.toonに一括置換し、既存のlookupロジックが引き続き機能することを確認する

## スコープ外

本タスクは成果物形式の切り替えとバリデーターの対応に限定しており、周辺システムへの波及対応は含まない。state_machine.mmdとflowchart.mmdはMermaid記法がMermaid rendererと統合されており、TOONへの変換は技術的に不適切であるためスコープ外とする。過去に生成済みのMDファイルをTOONに変換するバッチ処理は本タスクに含まれない。完了済みタスクについては再実行しない運用ルールで対処し、バッチ変換の実装は行わない。`@toon-format/toon`パッケージのdecode・encodeロジック自体は変更しない。harness外のGitHub Actions等がMDファイルを読む場合のCI/CDパイプライン対応も本タスクには含まれない。TOON形式を表示する外部ドキュメントビューワーや変換UIの実装も対象外である。outputFileを持たないtesting・regression_test・implementation・refactoring・build_check・docs_update・commit・push・ci_verification・deployの10フェーズはDoDバリデーターのL1対象外であるため変更不要である。
ロールバック手順（.toonから.mdへの再切り替え）もスコープ外とし、移行は一方向の変更として扱う。

- Mermaid形式ファイル（.mmd）: state_machine.mmd・flowchart.mmdは移行対象外
- 既存完了済みタスクの成果物変換バッチ: 本タスクに含まない
- toon-formatライブラリ自体の変更: `@toon-format/toon`パッケージは変更しない
- ロールバック手順の実装: 移行は一方向変更として扱い、再切り替えロジックは提供しない
- 既存テストスイートへの新規テストケース追加: 既存のビルド・テスト通過確認で品質担保とし、追加テスト実装は本タスクに含まない
