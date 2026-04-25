## サマリー

本要件定義書は、FR-4修正（ci_verificationのBashコマンド許可カテゴリ修正）後の整合性検証タスクにおける調査結果を受け、新たに発見された残存問題を解決するための要件を定義します。

調査の結果、ルートCLAUDE.mdとworkflow-plugin/CLAUDE.mdのフェーズ別subagent設定テーブルに、design_review、regression_test、ci_verification、deployの4フェーズが欠落していることが確認されました。
これら4フェーズはdefinitions.tsのPHASE_GUIDESに正式に定義されているにもかかわらず、ドキュメントテーブルへの記載が漏れており、全25フェーズの16パーセントに相当する重大な欠落です。

主要な決定事項として、以下の2つの機能要件（FR-5とFR-6）を定義します。
FR-5はルートCLAUDE.mdのsubagent設定テーブルへの4フェーズ追記であり、FR-6はworkflow-plugin/CLAUDE.mdの同テーブルへの追記です。
なお、Bashコマンド許可カテゴリテーブルは全25フェーズが正確に記載されており、修正不要です。

次フェーズ（planning）では、各ファイルの挿入位置と挿入内容の詳細な仕様を確定させ、実装フェーズに備えます。

## 機能要件

### FR-5: ルートCLAUDE.mdのsubagent設定テーブルへの4フェーズ追記

**概要**

CLAUDE.md（プロジェクトルート）の141-163行に存在するフェーズ別subagent設定テーブルに、definitions.tsのPHASE_GUIDESで定義されている4フェーズを追記します。
追記対象は design_review、regression_test、ci_verification、deploy の4フェーズです。

**受入基準 AC-5-1: design_reviewの挿入**

テーブル内でui_designの直後かつtest_designの直前の位置に、design_reviewの行を挿入すること。
挿入する行の内容は、フェーズ名がdesign_reviewであり、subagent_typeがgeneral-purposeであり、modelがsonnetであること。
入力ファイル列には設計成果物（state-machine.mmd、flowchart.mmd、ui-design.md等）を、出力ファイル列には該当なし（レビュー承認フェーズのため）をそれぞれ記載すること。

**受入基準 AC-5-2: regression_testの挿入**

テーブル内でtestingの直後かつmanual_testの直前の位置に、regression_testの行を挿入すること。
挿入する行の内容は、フェーズ名がregression_testであり、subagent_typeがgeneral-purposeであり、modelがhaikuであること。
入力ファイル列には既存テスト情報（テストスイート等）を、出力ファイル列には記録なしまたはregression-test.mdをそれぞれ記載すること。

**受入基準 AC-5-3: ci_verificationの挿入**

テーブル内でpushの直後の位置に、ci_verificationの行を挿入すること。
挿入する行の内容は、フェーズ名がci_verificationであり、subagent_typeがgeneral-purposeであり、modelがhaikuであること。
入力ファイル列には「CI/CD結果」を、出力ファイル列には該当なしをそれぞれ記載すること。

**受入基準 AC-5-4: deployの挿入**

テーブル内でci_verificationの直後かつcompletedの前の位置に、deployの行を挿入すること。
挿入する行の内容は、フェーズ名がdeployであり、subagent_typeがgeneral-purposeであり、modelがhaikuであること。
入力ファイル列には「デプロイ設定」を、出力ファイル列には該当なしをそれぞれ記載すること。

**受入基準 AC-5-5: テーブル行数の確認**

修正後のsubagent設定テーブルが25行（ヘッダー除く）であること。
定義されているすべてのフェーズがテーブルに存在することを確認すること。

---

### FR-6: workflow-plugin/CLAUDE.mdのsubagent設定テーブルへの4フェーズ追記

**概要**

workflow-plugin/CLAUDE.mdのフェーズ別subagent設定テーブルに、ルートCLAUDE.mdと同様の4フェーズを追記します。
このファイルのテーブルはルートCLAUDE.mdと基本構造は同じですが、「入力ファイル重要度」列が追加されており、その列の値も合わせて定義する必要があります。

**受入基準 AC-6-1: design_reviewの挿入（入力ファイル重要度含む）**

テーブル内でui_designの直後かつtest_designの直前の位置に、design_reviewの行を挿入すること。
挿入する行の内容は、フェーズ名がdesign_reviewであり、subagent_typeがgeneral-purposeであり、modelがsonnetであること。
入力ファイル重要度列には「高」を記載すること。これはレビュー承認が後続フェーズ全体を左右する重要な判断ステップであるためです。

**受入基準 AC-6-2: regression_testの挿入（入力ファイル重要度含む）**

テーブル内でtestingの直後かつmanual_testの直前の位置に、regression_testの行を挿入すること。
挿入する行の内容は、フェーズ名がregression_testであり、subagent_typeがgeneral-purposeであり、modelがhaikuであること。
入力ファイル重要度列には「中」を記載すること。これはベースラインとの差分比較が主目的であり、テストスイート全体への読み込みが必須ではないためです。

**受入基準 AC-6-3: ci_verificationの挿入（入力ファイル重要度含む）**

テーブル内でpushの直後の位置に、ci_verificationの行を挿入すること。
挿入する行の内容は、フェーズ名がci_verificationであり、subagent_typeがgeneral-purposeであり、modelがhaikuであること。
入力ファイル重要度列には「低」を記載すること。これはCIの結果確認が主目的であり、入力ファイルは参照しないためです。

**受入基準 AC-6-4: deployの挿入（入力ファイル重要度含む）**

テーブル内でci_verificationの直後の位置に、deployの行を挿入すること。
挿入する行の内容は、フェーズ名がdeployであり、subagent_typeがgeneral-purposeであり、modelがhaikuであること。
入力ファイル重要度列には「低」を記載すること。これはデプロイ実行が主目的であり、設計成果物の詳細参照は不要なためです。

**受入基準 AC-6-5: テーブル行数と列数の確認**

修正後のsubagent設定テーブルが25行（ヘッダー除く）であること。
「入力ファイル重要度」列がすべての行に存在し、値が適切に設定されていること。

---

### FR-7: 修正後の整合性検証

**概要**

FR-5とFR-6の実装完了後、修正された2ファイルがdefinitions.tsのPHASE_GUIDESと完全に一致することを検証します。

**受入基準 AC-7-1: フェーズ数の一致確認**

ルートCLAUDE.mdのsubagent設定テーブルのフェーズ数が25であり、workflow-plugin/CLAUDE.mdのテーブルのフェーズ数が25であり、definitions.tsのPHASE_GUIDESに定義されているフェーズ数が25であること。
3つの数値がすべて一致していること。

**受入基準 AC-7-2: フェーズ順序の一致確認**

2ファイルのテーブルにおけるフェーズ順序が、definitions.tsのPHASE_GUIDESの定義順序と完全に一致すること。
フェーズ順序はresearchから始まりdeployで終わる定義済み順序に従うこと。

**受入基準 AC-7-3: subagent_typeとmodelの一致確認**

2ファイルのテーブルに記載されているsubagent_typeとmodelの値が、definitions.tsの各フェーズ定義と一致すること。
特に追記した4フェーズについて個別に確認すること。

## 非機能要件

### NFR-1: 変更の局所性

FR-5とFR-6の変更は、それぞれのファイルのフェーズ別subagent設定テーブルの行追記のみに限定すること。
他のセクション（Bashコマンド許可カテゴリテーブル等）には一切変更を加えないこと。
既存の正常なテーブル行を移動・削除・書き換えしないこと。

### NFR-2: Markdown書式の維持

追記する行のMarkdown書式（パイプ記号、スペース配置、列数）が、既存の行と統一されていること。
テーブルのMarkdown構文が正しく、Markdownパーサーで正常にテーブルとして解釈できること。

### NFR-3: 2ファイル間の整合性

FR-5で追記する内容（フェーズ名、subagent_type、model）とFR-6で追記する内容が矛盾しないこと。
workflow-plugin/CLAUDE.mdに固有の「入力ファイル重要度」列の値は、フェーズの性質に基づいて論理的に決定されること。

### NFR-4: 変更の検証可能性

変更後のファイルをgit diffで確認し、意図しない行が追加・削除されていないことを確認できること。
各追記行がフェーズ順序の正しい位置に挿入されていることが目視で確認できること。
