## サマリー

本テスト設計書は、本仕様書（spec.md）および本要件定義書（requirements.md）で確定された機能要件FR-5/FR-6/FR-7の実装計画に基づき、ドキュメント修正後の整合性検証テストを定義します。
調査の結果として発見された重大な残存問題（design_review・regression-test・ci_verification・deployの4フェーズ欠落）の解決を確認することが本計画の主目的です。
変更対象はプロジェクトルートのCLAUDE.mdとworkflow-plugin/CLAUDE.mdの2ファイルに対する各4行の追記操作であり、TypeScriptのソースコードへの変更は発生しません。
各挿入位置が定義順序（PHASE_SEQUENCE）に従い正確であること、追記後の書式統一が維持されていること、3ファイル間の整合性要件が充足されていることを検証します。

- 目的: 追記対象の4フェーズが正しく挿入後、定義済フェーズとの整合性検証が完了したことを確認する
- 主要な決定事項: 検証はReadツールによる目視確認とBash（readonly：許可済）のgit diffで実施し、論理的矛盾・列数不一致・破損がないことを確認する
- 次フェーズで必要な情報: 各テストケースの合否判定基準（本書に個別記載）と、修正後の実装手順に対応する検証コマンド

---

## テスト設計の概要

### テスト対象と背景

本テスト設計は4つの検証カテゴリに分類されます。
FR-5検証テストは、プロジェクトルートのCLAUDE.mdのsubagent設定ドキュメントファイルのテーブルへの追記が正しく行われたことを確認します。
FR-6検証テストは、workflow-plugin/CLAUDE.mdの6列構成テーブルへの追記が正しく行われたことを確認します。
FR-7検証テストは、2つのファイルとdefinitions.ts（TypeScript製MCPサーバーのフェーズ定義）との三者整合性を確認します。
非機能要件（NFR）検証テストは、変更の局所性・Markdown構文の正常解釈・書式統一を確認します。

本計画における検証対象フェーズは、specification上で欠落していたdesign_review・regression-test・ci_verification・deployの4タスクです。
これらはworkflow-plugin/mcp-server/src/phases/definitions.tsのPHASE_GUIDESには定義済みであり、ドキュメントファイルとの整合性が失われていた点が問題の根拠です。

### テスト環境と前提条件

テスト環境はWindows（CRLF改行コード）であり、BashコマンドはreadOnlyカテゴリ（許可済）のgrepおよびgit diffコマンドを使用します。
CRLFによる改行コード差異がEditツールのold_string一致検証に影響しないことを前提とします（リスク軽減策R-2として本仕様書に記載済み）。
TypeScript製のMCPサーバー（mcp-server）が参照するdefinitions.tsはReadツールで確認し、subagent_type・model値との照合に使用します。
Markdownパーサーでテーブルが正常に解釈できることを確認するため、列数・パイプ記号・スペース配置の構文チェックを実施します。

テスト実施前の事前確認として、ReadツールでCLAUDE.mdおよびworkflow-plugin/CLAUDE.mdを読み込み済みであることが必須条件です。
これはキャッシュ状態に関係なく常に最新状態を取得するための手順であり、Edit操作の前提として位置づけられています。
設計成果物（spec.md、threat-model.md、code-review.md、manual-test.md、security-scan.md、performance-test.md、e2e-test.md等）は参照のみ行い変更しません。
各テストケースの実施にはユーザーまたは担当者による承認と管理が伴い、合否判定の粒度は受入基準ごとに明示的に定義されます。

### テスト対象ファイルと変更種別

変更種別・変更内容・参照目的を以下に整理します。

| ファイルパス | 変更種別 | テスト観点 |
|------------|---------|-----------|
| `CLAUDE.md` | 行追記（+4行） | 追記4フェーズの存在確認・定義順序・5列構成の書式統一 |
| `workflow-plugin/CLAUDE.md` | 行追記（+4行） | 追記4フェーズの存在確認・重要度値・6列構成の維持 |
| `definitions.ts` | 参照のみ（変更なし） | PHASE_GUIDESのsubagent_type・model値との照合に使用 |

---

## FR-5検証テスト: ルートCLAUDE.md追記確認（AC-5-1〜AC-5-5）

本セクションでは、実装計画ステップ1〜5（プロジェクトルートのCLAUDE.mdへの追記）の完了を検証するテストケースを定義します。
追記対象の4フェーズは、定義済フェーズ（definitions.tsのPHASE_GUIDESに存在確認済み）であり、調査結果から重大な欠落として特定されたものです。
各テストケースは受入基準AC-5-1〜AC-5-5と1対1で対応し、個別の合否判定を行います。

### TC-5-1: design_review行の挿入位置確認（FR-5-A）

**テストID:** TC-5-1
**受入基準:** AC-5-1
**目的:** FR-5-A（実装手順ステップ2）で実施した各挿入位置（ui_design行直後）へのdesign_review行追記が正確であることを確認する
**前提条件:** EditツールのFR-5-A操作が正常完了していること（事前確認として承認済み操作であること）
**検証手順:**
1. ReadツールでCLAUDE.mdの141〜165行付近を読み込む（本仕様書の記載と一致する行付近）
2. 既存行である `| ui_design | general-purpose | sonnet | spec.md | ui-design.md |` の行直後に追記行が存在することを確認する
3. 追記行 `| design_review | general-purpose | sonnet | state-machine.mmd, flowchart.mmd, ui-design.md | - |` が行直前の文字列と一致することを確認する
4. design_review行の直後が `| test_design | ...` であることを確認し、定義順序が保持されていることを確かめる
**期待値:** design_review行がui_design直後かつtest_design直前に存在し、subagent_type=general-purpose、model=sonnet、5列構成の書式統一が維持されていること
**合否基準:** 上記4点をすべて満たす場合にPASS
**対応する受入基準:** AC-5-1

### TC-5-2: regression_test行の挿入位置確認（FR-5-B）

**テストID:** TC-5-2
**受入基準:** AC-5-2
**目的:** FR-5-B（実装手順ステップ3）で実施したregression-test行追記が、testing行直後の正確な挿入位置であることを確認する
**前提条件:** EditツールのFR-5-B操作が正常完了していること
**検証手順:**
1. ReadツールでCLAUDE.mdのtesting行付近を読み込む
2. 既存行である `| testing | general-purpose | haiku | - | - |` の行直後に追記行が存在することを確認する
3. 追記行 `| regression_test | general-purpose | haiku | テストスイート | - |` が、行以外の他のフェーズ行に影響せず挿入されていることを確認する
4. regression_test行の直後が `| manual_test | ...` であることを確認し、定義順序の整合性を確かめる
**期待値:** regression_test行がtesting直後かつmanual_test直前に存在し、subagent_type=general-purpose、model=haiku、書式統一が維持されていること
**合否基準:** 期待する順序で3行（testing、regression_test、manual_test）が連続していればPASS
**対応する受入基準:** AC-5-2

### TC-5-3: ci_verification行の挿入位置確認（FR-5-C）

**テストID:** TC-5-3
**受入基準:** AC-5-3
**目的:** FR-5-C（実装手順ステップ4）で実施したci_verification行追記が、push行直後の正確な挿入位置であることを確認する
**前提条件:** EditツールのFR-5-C操作が正常完了していること
**検証手順:**
1. ReadツールでCLAUDE.mdのpush行付近を読み込む
2. 既存行である `| push | general-purpose | haiku | - | - |` の行直後に追記行が存在することを確認する
3. 追記行 `| ci_verification | general-purpose | haiku | CI/CD結果 | - |` が挿入後に存在することを確認する
4. ci_verification行の直後にdeploy行が続き、さらに「### フェーズ別Bashコマンド許可カテゴリ」ヘッダーが続いていることを確認する（テーブルヘッダーを含む基本構造維持の確認）
**期待値:** ci_verification行がpush直後に存在し、5列構成の書式統一が維持され、次セクションヘッダーが破損していないこと
**合否基準:** ci_verification行が正確な位置に存在し、Markdown構文の正常解釈を阻害する要素がなければPASS
**対応する受入基準:** AC-5-3

### TC-5-4: deploy行の挿入位置確認（FR-5-C）

**テストID:** TC-5-4
**受入基準:** AC-5-4
**目的:** FR-5-C操作で同時追記されたdeploy行が、ci_verification行直後の正確な位置に存在することを確認する
**前提条件:** TC-5-3がPASSであること
**検証手順:**
1. ReadツールでCLAUDE.mdのci_verification行直後を確認する（キャッシュに依存せず最新の内容を取得する）
2. 追記行 `| deploy | general-purpose | haiku | デプロイ設定 | - |` がci_verification行の直後に存在することを確認する
3. deploy行の後に次セクションヘッダーが続いていることを確認する（変更の局所性：修正不要セクションへの変更箇所がないことの確認）
4. 5列構成の書式統一が維持されていることを確認する（列数不一致による破損がないことを確認）
**期待値:** deploy行がci_verification直後に存在し、subagent_type=general-purpose、model=haiku、書式統一が維持されていること
**合否基準:** deploy行が正確な位置に存在し、テーブルの末尾が正しい位置で終了していればPASS
**対応する受入基準:** AC-5-4

### TC-5-5: ルートCLAUDE.mdのテーブル行数確認（FR-7検証ステップ1）

**テストID:** TC-5-5
**受入基準:** AC-5-5
**目的:** FR-7の検証手順（実装手順ステップ10）に従い、ルートCLAUDE.mdのsubagent設定テーブルが25行（ヘッダー除く）であることを確認する
**前提条件:** TC-5-1〜TC-5-4がすべてPASSであること
**検証手順:**
1. ReadツールでCLAUDE.mdの141〜175行付近を読み込む（実装手順ステップ5：「141-170行を再読み込み」と整合）
2. テーブルのデータ行数（テーブルヘッダー行・セパレーター行を除く）を目視でカウントする
3. 25行であることを確認する（修正前21行＋追記4行＝修正後25行）
4. 定義順序がresearch → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deployとなっていることを個別に確認する
**期待値:** データ行数が25であり、定義順序がPHASE_SEQUENCEと一致していること
**合否基準:** 行数が25でかつ定義順序が正しければPASS
**対応する受入基準:** AC-5-5

---

## FR-6検証テスト: workflow-plugin/CLAUDE.md追記確認（AC-6-1〜AC-6-5）

本セクションでは、実装計画ステップ6〜9（workflow-plugin/CLAUDE.mdへの追記）の完了を検証するテストケースを定義します。
このファイルはプロジェクトルートのCLAUDE.mdと同一フェーズを扱いますが、「入力ファイル重要度」列を含む6列構成という固有の性質があります。
追記時に6列の構文が正しくないとMarkdownパーサーで正常に解釈できないため、列数不一致の有無を重点的に検証します。
各テストケースは受入基準AC-6-1〜AC-6-5と1対1で対応し、入力ファイル重要度含む全列の個別確認を行います。

### TC-6-1: design_review行の挿入確認（FR-6-A、重要度含む）

**テストID:** TC-6-1
**受入基準:** AC-6-1（入力ファイル重要度「高」での追記）
**目的:** FR-6-A（実装手順ステップ7）で実施したdesign_review行追記が、入力ファイル重要度「高」を含む正確な6列で挿入されていることを確認する
**前提条件:** EditツールのFR-6-A操作が正常完了していること（全文読み込み後の操作であること）
**検証手順:**
1. Readツールでworkflow-plugin/CLAUDE.mdの179〜210行付近を読み込む（本仕様書の記載と一致する行付近）
2. 既存行 `| ui_design | general-purpose | sonnet | spec.md | 全文 | ui-design.md |` の直後に追記行が存在することを確認する
3. 追記行が `| design_review | general-purpose | sonnet | state-machine.mmd, flowchart.mmd, ui-design.md | 高 | - |` であることを確認する
4. 各列がパイプ記号で正確に区切られており、Markdownパーサーで正常に解釈できる構文であることを確認する
**期待値:** design_review行が6列構成でui_design直後に存在し、入力ファイル重要度が「高」であること（後続フェーズ全体の方向性を左右する判断ステップのため重要度値「高」が論理的に導出される）
**合否基準:** 6列構成で「高」が入力ファイル重要度列に記載されていればPASS
**対応する受入基準:** AC-6-1

### TC-6-2: regression_test行の挿入確認（FR-6-B、重要度含む）

**テストID:** TC-6-2
**受入基準:** AC-6-2（入力ファイル重要度「中」での追記）
**目的:** FR-6-B（実装手順ステップ8）で実施したregression-test行追記が、入力ファイル重要度「中」を含む正確な6列で挿入されていることを確認する
**前提条件:** EditツールのFR-6-B操作が正常完了していること
**検証手順:**
1. Readツールでworkflow-plugin/CLAUDE.mdのtesting行付近を読み込む
2. 既存行の直後に追記行が存在することを確認する（テーブルヘッダーから数えたデータ行の位置を記録する）
3. 追記行が `| regression_test | general-purpose | haiku | テストスイート (サマリー) | 中 | - |` であることを確認する
4. 重要度値「中」がベースラインとの比較結果が主目的であることから論理的に導出されており、論理的矛盾がないことを確認する
**期待値:** regression_test行が6列構成でtesting直後に存在し、入力ファイル重要度が「中」であること
**合否基準:** 6列構成で「中」が入力ファイル重要度列に記載されていればPASS
**対応する受入基準:** AC-6-2

### TC-6-3: ci_verification行の挿入確認（FR-6-C、重要度含む）

**テストID:** TC-6-3
**受入基準:** AC-6-3（入力ファイル重要度「低」での追記）
**目的:** FR-6-C（実装手順ステップ9）で実施したci_verification行追記が、入力ファイル重要度「低」を含む正確な6列で挿入されていることを確認する
**前提条件:** EditツールのFR-6-C操作が正常完了していること
**検証手順:**
1. Readツールでworkflow-plugin/CLAUDE.mdのpush行付近を読み込む
2. 既存行 `| push | general-purpose | haiku | - | - | - |` の直後に追記行が存在することを確認する
3. 追記行が `| ci_verification | general-purpose | haiku | CI/CD結果 | 低 | - |` であることを確認する
4. 重要度値「低」がci_verificationの性質（CI結果確認が主目的、詳細参照は不要）から論理的に導出されており、NFR-3の整合性要件を満たすことを確認する
**期待値:** ci_verification行が6列構成でpush直後に存在し、入力ファイル重要度が「低」であること
**合否基準:** 6列構成で「低」が入力ファイル重要度列に記載されていればPASS
**対応する受入基準:** AC-6-3

### TC-6-4: deploy行の挿入確認（FR-6-C、重要度含む）

**テストID:** TC-6-4
**受入基準:** AC-6-4（入力ファイル重要度「低」での追記）
**目的:** FR-6-C操作で同時追記されたdeploy行が、入力ファイル重要度「低」を含む正確な6列でci_verification行直後に存在することを確認する
**前提条件:** TC-6-3がPASSであること
**検証手順:**
1. Readツールでworkflow-plugin/CLAUDE.mdのci_verification行直後を確認する
2. 追記行が `| deploy | general-purpose | haiku | デプロイ設定 | 低 | - |` であることを確認する
3. deploy行の後に次セクションヘッダー `### subagent起動テンプレート` が続いていることを確認する（テンプレートセクションの保全を確認）
4. 重要度値「低」がdeployの性質（デプロイ実行が主目的、詳細参照は不要）から論理的に導出されており、「低」という重要度値がci_verificationと整合していることを確認する
**期待値:** deploy行が6列構成でci_verification直後に存在し、入力ファイル重要度が「低」であり、次セクションのsubagent起動テンプレートが破損していないこと
**合否基準:** 6列構成で「低」が入力ファイル重要度列に記載され、テンプレートセクションが正常であればPASS
**対応する受入基準:** AC-6-4

### TC-6-5: テーブル行数・列数の確認（FR-7検証ステップ2）

**テストID:** TC-6-5
**受入基準:** AC-6-5（テーブル行数25行・6列構成の維持）
**目的:** FR-7の検証手順（実装手順ステップ10）に従い、workflow-plugin/CLAUDE.mdのテーブルが25行かつ全行6列構成であることを確認する
**前提条件:** TC-6-1〜TC-6-4がすべてPASSであること
**検証手順:**
1. Readツールでworkflow-plugin/CLAUDE.mdの179〜215行付近を読み込む（最終整合性検証ステップ2：「179-210行付近を読み込み」と整合）
2. テーブルのデータ行数を目視でカウントし、25行であることを確認する（21行＋4行追記＝25行）
3. 全データ行の列数（パイプ区切り数）が6列（パイプ区切り7セグメント）であることを確認する
4. 列数不一致（5列の行または7列以上の行）が存在しないことを確認し、Markdownパーサーでテーブル全体が正常に解釈できる構文であることを確認する
**期待値:** データ行数が25であり、全行が6列構成で、テーブルの構文エラー・破損がないこと
**合否基準:** 行数が25でかつ全行が6列構成であればPASS
**対応する受入基準:** AC-6-5

---

## FR-7検証テスト: 三者整合性確認（AC-7-1〜AC-7-2）

本セクションでは、FR-7の整合性検証手順（実装手順ステップ10）に対応するテストケースを定義します。
三者（CLAUDE.md・workflow-plugin/CLAUDE.md・definitions.ts）のフェーズ定義順序とsubagent設定値が完全に一致していることを確認します。
本仕様書の「検証ステップ3・4」（subagent_typeとmodelの個別確認、フェーズ定義順序の確認）をテストケースとして体系化しています。
整合性要件（NFR-3）を満たさない場合は、欠落フェーズの解決という目標が達成されたとみなせないため、最優先で対処します。

### TC-7-1: 三者間のフェーズ定義順序確認

**テストID:** TC-7-1
**受入基準:** AC-7-1（3ファイル間のフェーズ定義順序の一致）
**目的:** ルートCLAUDE.md・workflow-plugin/CLAUDE.md・definitions.tsの三者でフェーズ定義順序が完全に一致することを確認する
**前提条件:** TC-5-5とTC-6-5がいずれもPASSであること（最終整合性検証に向けた事前確認として想定通りの結果が出ていること）
**検証手順:**
1. Readツールでdefinitions.tsのPHASE_SEQUENCE配列（行84〜104付近）を全文読み込みし、期待する定義順序を取得する
2. ルートCLAUDE.mdのテーブルフェーズ順序（research → requirements → ... → ci_verification → deploy）と照合し、参照値として記録する
3. workflow-plugin/CLAUDE.mdのテーブルフェーズ順序が同一順序で一致していることを確認する
4. 三者すべてで25フェーズの定義順序が完全に一致していることを確認し、追記した4フェーズ（design_review・regression_test・ci_verification・deploy）が正しい挿入位置に配置されていることを個別に確認する
**期待する定義順序（全25行）:**
1行目: research、2行目: requirements、3行目: threat_modeling、4行目: planning
5行目: state_machine、6行目: flowchart、7行目: ui_design、8行目: design_review（追記対象）
9行目: test_design、10行目: test_impl、11行目: implementation、12行目: refactoring
13行目: build_check、14行目: code_review、15行目: testing、16行目: regression_test（追記対象）
17行目: manual_test、18行目: security_scan、19行目: performance_test、20行目: e2e_test
21行目: docs_update、22行目: commit、23行目: push、24行目: ci_verification（追記対象）、25行目: deploy（追記対象）
**合否基準:** 三者のフェーズ順序が完全に一致すればPASS
**対応する受入基準:** AC-7-1

### TC-7-2: 追記4フェーズのsubagent設定値確認（definitions.ts照合）

**テストID:** TC-7-2
**受入基準:** AC-7-2（追記4フェーズのsubagent_typeとmodelがdefinitions.tsと一致）
**目的:** 追記した4フェーズのsubagent_typeとmodel値がdefinitions.tsのPHASE_GUIDESから取得した正確な値と一致することを確認する
**前提条件:** TC-7-1がPASSであること
**検証手順:**
1. Readツールでdefinitions.tsを読み込み、design_review・regression_test・ci_verification・deployのsubagentType・model値を個別に取得する
2. ルートCLAUDE.mdの各追記行でsubagent_typeとmodelを確認し、definitions.tsの値と個別に照合する（検証ステップ3に対応、比較結果を記録する）
3. workflow-plugin/CLAUDE.mdの各追記行でsubagent_typeとmodelを確認し、definitions.tsの値と個別に照合する
4. 2つのCLAUDE.mdと1つのdefinitions.tsの計3ファイルで値の一致確認が完了したことを記録する（検証可能性確保のため結果を明示的に文書化する）
**期待する個別確認値（definitions.tsのPHASE_GUIDESから導出）:**
- design_review: subagent_type=general-purpose、model=sonnet（設計レビューの性質上sonnetが適切）
- regression_test: subagent_type=general-purpose、model=haiku（リグレッションテスト確認の性質上haikuが適切）
- ci_verification: subagent_type=general-purpose、model=haiku（CI確認の性質上haikuが適切）
- deploy: subagent_type=general-purpose、model=haiku（デプロイ実行の性質上haikuが適切）
**合否基準:** 4フェーズすべての値が三者間で完全一致すればPASS
**対応する受入基準:** AC-7-2

---

## 非機能要件（NFR）検証テスト

本セクションでは、非機能要件（NFR-1〜NFR-4）への対応方針を検証するテストケースを定義します。
変更の局所性・Markdown書式の維持・2ファイル間の整合性・変更の検証可能性は、機能要件の達成を補完する重要な要件です。
NFR違反が検出された場合、実装方針への根本的な再調査が必要となる可能性があるため、見逃しなく検証します。

### TC-NFR-1: 変更の局所性確認（NFR-1）

**テストID:** TC-NFR-1
**受入基準:** NFR-1（変更の局所性：対象テーブルへの行追記のみに限定）
**目的:** git diffで確認した際に、Bashコマンド許可カテゴリテーブルや他のセクション（修正不要と確定したセクション）への変更が発生していないことを確認する
**前提条件:** 全実装フェーズが完了していること
**検証手順:**
1. `git diff CLAUDE.md` を実行し（Bash readonly：許可済）、変更内容確認として差分を確認する
2. ルートCLAUDE.mdで `+| design_review | ...` 1行、`+| regression_test | ...` 1行、`+| ci_verification | ...` 1行、`+| deploy | ...` 1行の合計4行の追加のみが差分であることを確認する（対象行以外は一切変更されていないことを確認）
3. `git diff workflow-plugin/CLAUDE.md` を実行し、同様に各追記4フェーズの+4行のみが差分であることを確認する
4. いずれのファイルも削除行（-で始まる行）が存在しないことを確認し、既存行への変更がないことを確かめる
**期待値:** 各ファイルでgit diffの追加行数が4行であり、削除行が存在しないこと
**合否基準:** 各ファイルで+4行のみが差分であればPASS（削除行が1行でも存在する場合はFAIL）
**対応する受入基準:** NFR-1

### TC-NFR-2: Markdown書式の維持確認（NFR-2）

**テストID:** TC-NFR-2
**受入基準:** NFR-2（Markdown書式の維持：追記行が構文エラーなく正常に解釈できること）
**目的:** 追記した全行がMarkdownテーブルとしてパーサーで正常に解釈できる構文であり、書式統一が既存行と一致していることを確認する
**前提条件:** TC-5-1〜TC-6-5がすべてPASSであること
**検証手順:**
1. ルートCLAUDE.mdの追記4行について、パイプ記号の配置・スペース・列数が既存行と書式統一されているかを目視確認する（テーブルヘッダーの各列ラベルと各データ行の対応を検証する）
2. workflow-plugin/CLAUDE.md固有の6列構成（フェーズ・subagent_type・model・入力ファイル・入力ファイル重要度・出力ファイル）について、追記4行のパイプ記号配置が既存行と統一されていることを確認する
3. 列数不一致の行（ルート側で5列以外、plugin側で6列以外）が存在しないことを確認し、列数不一致による破損がないことを確かめる
4. Markdownパーサーが各追記行を含むテーブル全体を1つの連続したテーブルとして正常に解釈できることを確認する
**期待値:** 全追記行がMarkdownテーブルとして正常解釈可能な構文であり、書式違反による論理的矛盾がないこと
**合否基準:** 全追記行の書式が正常であればPASS
**対応する受入基準:** NFR-2

### TC-NFR-3: 2ファイル間の整合性確認（NFR-3）

**テストID:** TC-NFR-3
**受入基準:** NFR-3（2ファイル間の整合性：FR-5とFR-6の追記内容が矛盾しないこと）
**目的:** FR-5で追記したルートCLAUDE.mdの内容とFR-6で追記したworkflow-plugin/CLAUDE.mdの内容が論理的矛盾なく整合していることを確認する
**前提条件:** TC-7-2がPASSであること
**検証手順:**
1. 両ファイルの追記4フェーズについて、subagent_typeとmodelが一致していることを確認する（照合のため前後行のコンテキストを含めて読み込む）
2. workflow-plugin/CLAUDE.md固有の入力ファイル重要度列の値（design_review:高、regression_test:中、ci_verification:低、deploy:低）がフェーズの性質から論理的に導出されており、相互に矛盾しないことを確認する
3. 両ファイルのフェーズ定義順序が同一であることを確認する（TC-7-1と重複確認として実施）
4. 2ファイル間でフェーズ名・subagent設定値・定義順序に論理的矛盾がないことを総合的に確認する
**期待値:** 2ファイル間でsubagent_typeとmodel値が完全一致し、入力ファイル重要度の重要度値がNFR-3の整合性要件を満たすこと
**合否基準:** 2ファイル間で矛盾が存在しない場合にPASS
**対応する受入基準:** NFR-3

### TC-NFR-4: 変更の検証可能性確認（NFR-4）

**テストID:** TC-NFR-4
**受入基準:** NFR-4（変更の検証可能性：git diffで変更を確認できること）
**目的:** 実装手順のステップ10として記載されたgit diffによる確認を実施し、変更後の内容が想定通りであることを期待通りの形で検証する
**前提条件:** 全実装フェーズが完了していること
**検証手順:**
1. git diffコマンド（readonly：許可済）でCLAUDE.mdとworkflow-plugin/CLAUDE.mdの変更差分を確認する（本計画での最終検証可能性確保ステップ）
2. 変更行が各ファイルでそれぞれ+4行のみであることを数値で確認し、パーセント換算では各ファイルへの変更が総行数の5パーセント未満の局所的な変更であることを確認する
3. 追記4フェーズ以外の行に変更がないことを確認する（修正不要セクションが保持されていることの検証）
4. NFR-1（変更の局所性）とNFR-4（変更の検証可能性）を同時に満たすことを総合的に判定する
**期待値:** git diffで各ファイルの追記が+4行のみとして視覚的に確認でき、意図しない変更行が存在しないこと
**合否基準:** 各ファイルで+4行のみが差分として確認できればPASS
**対応する受入基準:** NFR-4

---

## テスト実施順序と依存関係

### 作業順序の整理

テストは実装手順の作業順序に対応した順で実施します。
本計画（test-design.md）で確定した受入基準AC-5-1〜AC-7-2に対し、漏れなく検証を実施します。
各タスクの完了状態は使用前に確認し、前提条件を満たしていることを検証してから次のテストケースに移行します。

| 優先度 | テストケース | 前提とする完了状態 | 参照する実装手順 |
|-------|------------|------------------|---------------|
| P1 | TC-5-1〜TC-5-4（個別挿入確認） | FR-5-A〜FR-5-C完了 | ステップ2〜4 |
| P2 | TC-5-5（ルート行数確認） | TC-5-1〜TC-5-4 PASS | ステップ5 |
| P3 | TC-6-1〜TC-6-4（plugin個別確認） | FR-6-A〜FR-6-C完了 | ステップ7〜9 |
| P4 | TC-6-5（plugin行数・列数確認） | TC-6-1〜TC-6-4 PASS | ステップ10一部 |
| P5 | TC-7-1（定義順序の三者照合） | TC-5-5・TC-6-5 PASS | ステップ10（検証ステップ4） |
| P6 | TC-7-2（subagent設定値の三者照合） | TC-7-1 PASS | ステップ10（検証ステップ3） |
| P7 | TC-NFR-1〜TC-NFR-4（非機能要件確認） | P1〜P6全PASS | ステップ10（検証ステップ5） |

### テスト失敗時の対処方針

各テストが失敗した場合の具体的な対処方針を以下に示します。

**TC-5-1〜TC-5-4がFAILの場合（各フェーズの挿入位置が誤っている）:**
本仕様書のFR-5-A〜FR-5-CのEdit操作定義を再確認し、old_stringとnew_stringの内容を検証します。
リスクR-1（old_stringの一意性問題）に従い、old_stringにより多くのコンテキスト行を含めて一意性を確保します。
Editが誤った位置に適用された場合は、ReadツールでCLAUDE.mdを再読み込みしてから修正Editを実施します。

**TC-5-5またはTC-6-5がFAILの場合（行数が25以外）:**
ReadツールでCLAUDE.mdを読み込み、欠落しているフェーズを個別に特定します。
行数が25未満の場合は追記が完了していないフェーズを特定し、対応するFR-5-AまたはFR-5-Bを再実行します。
行数が25を超える場合は誤って重複挿入されたフェーズがないかを確認し、移動・削除の必要性を判断します。

**TC-6-1〜TC-6-5がFAILの場合（列数不一致または重要度値の誤り）:**
workflow-plugin/CLAUDE.mdの追記行をReadツールで確認し、パイプ区切り数を数えます（リスクR-4への対処）。
6列テーブルには6つの値と7つのパイプが必要であることに留意し、列数不一致を修正します。
重要度値が誤っている場合は、本仕様書のFR-6-A〜FR-6-CのEdit操作定義を再確認します。

**TC-7-1またはTC-7-2がFAILの場合（三者間の不整合）:**
definitions.tsを再度Readツールで読み込み、正確なsubagent_type・model値を取得します。
三者のうち不整合が生じているファイルを特定し、対応するFR-5またはFR-6の操作を修正します。
整合性要件（NFR-3）の違反は最優先で解決します。

**TC-NFR-1またはTC-NFR-4がFAILの場合（意図しない差分が存在する）:**
git diffの出力を詳細に確認し、意図しない行の追加・削除がある箇所を特定します。
old_stringが複数箇所にマッチして意図しない位置に変更が適用された場合は、本仕様書のリスク軽減策R-1を参照して対処します。
CRLFに起因する改行コード差異が原因の場合は、リスクR-2の対応方針に従います。
