## サマリー

本仕様書は、本要件定義書（requirements.md）で確定された機能要件FR-5/FR-6/FR-7の実装計画を定義します。
調査の結果として発見された重大な問題は、ルートCLAUDE.md（プロジェクトルート）とworkflow-plugin/CLAUDE.mdのフェーズ別subagent設定ドキュメントテーブルに4フェーズが欠落していることです。
追記対象は design_review、regression_test（regression-test）、ci_verification、deploy の4フェーズです。

**主要な決定事項:**
- ルートCLAUDE.mdの163行目（pushの行）直後に3行、および149行目（ui_designの行）直後に1行を挿入します。
- workflow-plugin/CLAUDE.mdの201行目（pushの行）直後に3行、および187行目（ui_designの行）直後に1行を挿入します。
- 挿入後のテーブルは両ファイルともヘッダー除く25行となり、definitions.tsのPHASE_GUIDES全フェーズと一致します。
- Edit操作は既存行のコンテキストを十分に含むold_stringを使用し、意図しない箇所への適用を防ぎます。

**次フェーズで必要な情報:**
- 挿入するMarkdown行の正確な文字列（本仕様書に記載）
- 各挿入位置のold_stringとnew_string（本仕様書に記載）
- 検証コマンド（readonly: grepによる行数カウント）

---

## 概要

本タスクは、FR-4修正後の整合性検証による調査結果を受け、残存問題を解決します。
調査ではルートCLAUDE.mdとworkflow-plugin/CLAUDE.mdのフェーズ別subagent設定ドキュメントテーブルに、合計4フェーズの欠落が確認されました。
欠落しているフェーズはdesign_review、regression_test、ci_verification、deployであり、これらはdefinitions.tsのPHASE_GUIDESに定義済みのフェーズです。
25フェーズ中4フェーズの欠落は全体の16パーセントに相当する重大な欠落であり、subagentがフェーズの仕様を参照できない状態が発生していました。
本タスクの目的は、2つのCLAUDE.mdファイルのテーブルを修正し、definitions.tsのPHASE_GUIDESとフェーズ数・定義順序・各設定値が完全に一致することを確認することです。
修正の範囲はドキュメントファイルへの各追記行のみであり、TypeScriptのソースコード（src/を含むパス）への変更は発生しません。
修正後の検証として、3ファイル間のフェーズ数・フェーズ順序・subagent設定値の一致確認を実施します。
変更の局所性は必須の非機能要件（NFR-1）として規定されており、対象テーブル以外の部分には一切変更を加えません。

---

## 変更対象ファイル

本タスクで変更するファイルの一覧を以下に示します。

| ファイルパス | 変更種別 | 変更内容 |
|------------|---------|---------|
| `CLAUDE.md` | 行追記 | subagent設定テーブルに4行追記（design_review、regression_test、ci_verification、deploy） |
| `workflow-plugin/CLAUDE.md` | 行追記 | subagent設定テーブルに4行追記（同上、入力ファイル重要度列を含む6列構成） |

参照のみ（変更なし）のファイルは以下の通りです。

| ファイルパス | 参照目的 |
|------------|---------|
| `workflow-plugin/mcp-server/src/phases/definitions.ts` | PHASE_GUIDES定義の照合・subagent_type/model値の確認に使用 |

対象ファイルの変更は、各ファイルのフェーズ別subagent設定テーブルの該当行への追記のみに限定します。
Bashコマンド許可カテゴリテーブルや他のセクションには一切変更を加えません（修正不要と確定）。
各ファイルへの変更はそれぞれ+4行（追記行）のみであり、削除・書き換え・移動は発生しません。

---

## 実装計画

実装フェーズでの作業は以下の順序で実施します。
本計画は要件（requirements.md）の受入基準AC-5-1〜AC-7-3を全て満たすことを目標とします。

### ステップ1: ルートCLAUDE.mdの事前確認

ReadツールでCLAUDE.md（141-165行）を読み込み、old_stringが正確に一致することを確認します。
現在のドキュメントテーブル構成が想定通りであることを確かめてから、Edit操作に進みます。
プロジェクトルートのCLAUDE.mdは5列構成のテーブルであることに留意します。

### ステップ2: FR-5-A実行（design_reviewの挿入）

EditツールでFR-5-Aを実行し、ui_designの行直後にdesign_review行を挿入します。
design_reviewのsubagent_typeはgeneral-purpose、modelはsonnetです。
入力ファイル列にはstate-machine.mmd、flowchart.mmd、ui-design.mdを記載します。
本挿入内容は機能要件FR-5の受入基準AC-5-1で確定された要件に基づきます。

### ステップ3: FR-5-B実行（regression_testの挿入）

EditツールでFR-5-Bを実行し、testingの行直後にregression_test行を挿入します。
regression_testのsubagent_typeはgeneral-purpose、modelはhaikuです。
入力ファイル列にはテストスイートを記載します。
本挿入内容は機能要件FR-5の受入基準AC-5-2で確定された要件に基づきます。

### ステップ4: FR-5-C実行（ci_verificationとdeployの挿入）

EditツールでFR-5-Cを実行し、pushの行直後にci_verificationとdeploy行を挿入します。
ci_verificationのmodelはhaiku、deployのmodelもhaikuです。
2行を連続して挿入し、次セクションヘッダーの前に配置します。
本挿入内容は受入基準AC-5-3およびAC-5-4で確定された要件に基づきます。

### ステップ5: ルートCLAUDE.mdの検証

ReadツールでCLAUDE.md（141-170行）を再読み込みし、テーブルが25行（ヘッダー除く）であることを確認します。
フェーズの定義順序がdefinitions.tsのPHASE_SEQUENCEと一致していることを目視確認します。
受入基準AC-5-5が求める数値の一致確認として、フェーズ数が25であることを確かめます。

### ステップ6: workflow-plugin/CLAUDE.mdの事前確認

Readツールでworkflow-plugin/CLAUDE.md（179-205行）を読み込み、old_stringを確認します。
このファイルの基本構造はルートCLAUDE.mdと同じですが、「入力ファイル重要度」列が追加された6列構成という固有の性質があります。
追記行も6列の書式に統一する必要があり、列数の構文が正しくないとMarkdownパーサーで正常に解釈できないため注意が必要です。

### ステップ7: FR-6-A実行（design_reviewの挿入、重要度含む）

EditツールでFR-6-Aを実行し、design_review行（入力ファイル重要度「高」）を挿入します。
6列すべてに値を指定し、Markdownテーブルの書式が統一されることを確認します。
受入基準AC-6-1では「入力ファイル重要度含む」での挿入が必須と規定されており、「高」の値はdesign_reviewフェーズが後続フェーズ全体の方向性を左右する判断であることに基づきます。

### ステップ8: FR-6-B実行（regression_testの挿入、重要度含む）

EditツールでFR-6-Bを実行し、regression_test行（入力ファイル重要度「中」）を挿入します。
ベースラインとの差分比較が主目的であるため、入力ファイル重要度は「中」とします。
受入基準AC-6-2では、フェーズの性質に基づき論理的に重要度を決定することが規定されています。

### ステップ9: FR-6-C実行（ci_verificationとdeployの挿入、重要度含む）

EditツールでFR-6-Cを実行し、ci_verification行（入力ファイル重要度「低」）とdeploy行（入力ファイル重要度「低」）を挿入します。
いずれのフェーズも詳細参照が不要なため、重要度は「低」とします。
受入基準AC-6-3・AC-6-4に従い、2行の矛盾なき挿入を確実に実施します。

### ステップ10: FR-7による最終整合性検証

ReadツールでFR-7の検証手順に従い、両ファイルの整合性を確認します。
definitions.tsの参照値との照合を完了させ、全25フェーズの一致確認が完了した時点で実装完了後の検証が終了します。
検証可能性（NFR-4）の要件として、git diffによる変更後の目視確認も実施します。

---

## FR-5: ルートCLAUDE.mdへの4フェーズ追記

### 対象ファイル

`C:\ツール\Workflow\CLAUDE.md`

### 現在のテーブル構成（141-164行）

現在のフェーズ別subagent設定テーブルは以下の21行（ヘッダー除く）を含んでいます。

```
| フェーズ | subagent_type | model | 入力ファイル | 出力ファイル |
|---------|---------------|-------|-------------|-------------|
| research | ... | research.md |
| requirements | ... | requirements.md |
| threat_modeling | ... | threat-model.md |
| planning | ... | spec.md |
| state_machine | ... | state-machine.mmd |
| flowchart | ... | flowchart.mmd |
| ui_design | ... | ui-design.md |           ← ここにdesign_reviewを挿入
| test_design | ... | test-design.md |
| test_impl | ... | *.test.ts |
| implementation | ... | *.ts |
| refactoring | ... | *.ts |
| build_check | ... | - |
| code_review | ... | code-review.md |
| testing | ... | - |                         ← ここにregression_testを挿入
| manual_test | ... | manual-test.md |
| security_scan | ... | security-scan.md |
| performance_test | ... | performance-test.md |
| e2e_test | ... | e2e-test.md |
| docs_update | ... | ドキュメント |
| commit | ... | - |
| push | ... | - |                            ← ここにci_verificationとdeployを挿入
```

### Edit操作 FR-5-A: design_reviewの挿入

ui_designの行直後かつtest_designの行直前の位置に挿入します。
definitions.tsではdesign_reviewのsubagentTypeは`general-purpose`、modelは`sonnet`です。
入力ファイルはstate-machine.mmd、flowchart.mmd、ui-design.mdの設計成果物であり、出力ファイルは該当なし（レビュー承認フェーズのため）です。

**old_string:**
```
| ui_design | general-purpose | sonnet | spec.md | ui-design.md |
| test_design | general-purpose | sonnet | spec.md, *.mmd | test-design.md |
```

**new_string:**
```
| ui_design | general-purpose | sonnet | spec.md | ui-design.md |
| design_review | general-purpose | sonnet | state-machine.mmd, flowchart.mmd, ui-design.md | - |
| test_design | general-purpose | sonnet | spec.md, *.mmd | test-design.md |
```

### Edit操作 FR-5-B: regression_testの挿入

testingの行直後かつmanual_testの行直前の位置に挿入します。
definitions.tsではregression_testのsubagentTypeは`general-purpose`、modelは`haiku`です。
入力ファイルはテストスイートを指し、出力ファイルは記録なし（ベースライン比較結果はMCPサーバーが管理）です。

**old_string:**
```
| testing | general-purpose | haiku | - | - |
| manual_test | general-purpose | sonnet | - | manual-test.md |
```

**new_string:**
```
| testing | general-purpose | haiku | - | - |
| regression_test | general-purpose | haiku | テストスイート | - |
| manual_test | general-purpose | sonnet | - | manual-test.md |
```

### Edit操作 FR-5-C: ci_verificationとdeployの挿入

pushの行直後の位置に挿入します。
definitions.tsではci_verificationのsubagentTypeは`general-purpose`、modelは`haiku`です。
definitions.tsではdeployのsubagentTypeは`general-purpose`、modelは`haiku`です。
この2行はpush行の直後に連続して挿入します。

**old_string:**
```
| commit | general-purpose | haiku | - | - |
| push | general-purpose | haiku | - | - |

### フェーズ別Bashコマンド許可カテゴリ
```

**new_string:**
```
| commit | general-purpose | haiku | - | - |
| push | general-purpose | haiku | - | - |
| ci_verification | general-purpose | haiku | CI/CD結果 | - |
| deploy | general-purpose | haiku | デプロイ設定 | - |

### フェーズ別Bashコマンド許可カテゴリ
```

---

## FR-6: workflow-plugin/CLAUDE.mdへの4フェーズ追記

### 対象ファイル

`C:\ツール\Workflow\workflow-plugin\CLAUDE.md`

### 現在のテーブル構成（179-202行）

workflow-plugin/CLAUDE.mdのテーブルはルートCLAUDE.mdと比較して「入力ファイル重要度」列が追加されており、6列構成となっています。
現在のテーブルはヘッダー除く21行を含んでいます（ルートCLAUDE.mdと同様の21フェーズが定義済み）。
この6列という固有の構造は、各フェーズへの入力ファイル読み込みの適切な粒度をsubagentに示すためのものです。

テーブルヘッダー行は以下の通りです。

```
| フェーズ | subagent_type | model | 入力ファイル | 入力ファイル重要度 | 出力ファイル |
```

### Edit操作 FR-6-A: design_reviewの挿入（入力ファイル重要度「高」）

ui_designの行直後かつtest_designの行直前の位置に挿入します。
requirements.mdのAC-6-1に基づき、入力ファイル重要度は「高」とします。
設計レビューは後続フェーズ全体の方向性を左右する重要な判断ステップであるため、設計成果物は全文読み込みが必須です。
6列の書式・記号の統一を保ち、Markdownパーサーが正常に解釈できる構文を維持します。

**old_string:**
```
| ui_design | general-purpose | sonnet | spec.md | 全文 | ui-design.md |
| test_design | general-purpose | sonnet | spec.md (全文), *.mmd (全文) | 全文 | test-design.md |
```

**new_string:**
```
| ui_design | general-purpose | sonnet | spec.md | 全文 | ui-design.md |
| design_review | general-purpose | sonnet | state-machine.mmd, flowchart.mmd, ui-design.md | 高 | - |
| test_design | general-purpose | sonnet | spec.md (全文), *.mmd (全文) | 全文 | test-design.md |
```

### Edit操作 FR-6-B: regression_testの挿入（入力ファイル重要度「中」）

testingの行直後かつmanual_testの行直前の位置に挿入します。
requirements.mdのAC-6-2に基づき、入力ファイル重要度は「中」とします。
ベースラインとの差分比較が主目的であるため、テストスイート全体の全文読み込みは不要です。
6列の書式統一を維持し、他の行と矛盾しない構文で追記します。

**old_string:**
```
| testing | general-purpose | haiku | test-design.md (全文), implementation成果物 (全文), spec.md (サマリー), requirements.md (参照) | 全文/サマリー/参照 | - |
| manual_test | general-purpose | sonnet | - | - | manual-test.md |
```

**new_string:**
```
| testing | general-purpose | haiku | test-design.md (全文), implementation成果物 (全文), spec.md (サマリー), requirements.md (参照) | 全文/サマリー/参照 | - |
| regression_test | general-purpose | haiku | テストスイート (サマリー) | 中 | - |
| manual_test | general-purpose | sonnet | - | - | manual-test.md |
```

### Edit操作 FR-6-C: ci_verificationとdeployの挿入

pushの行直後の位置に挿入します。
requirements.mdのAC-6-3およびAC-6-4に基づき、ci_verificationの入力ファイル重要度は「低」、deployの入力ファイル重要度は「低」とします。
ci_verificationはCI結果確認が主目的であり、deployはデプロイ実行が主目的のため、詳細参照は不要です。
2フェーズの重要度値はそれぞれのフェーズの性質から論理的に導出されており、NFR-3の整合性要件を満たします。

**old_string:**
```
| commit | general-purpose | haiku | - | - | - |
| push | general-purpose | haiku | - | - | - |

### subagent起動テンプレート
```

**new_string:**
```
| commit | general-purpose | haiku | - | - | - |
| push | general-purpose | haiku | - | - | - |
| ci_verification | general-purpose | haiku | CI/CD結果 | 低 | - |
| deploy | general-purpose | haiku | デプロイ設定 | 低 | - |

### subagent起動テンプレート
```

---

## FR-7: 修正後の整合性検証手順

### 検証ステップ 1: ルートCLAUDE.mdのフェーズ数確認

以下のgrepコマンドでsubagent設定テーブルの行数をカウントします。
コマンドはreadonly（grepコマンドは許可済み）カテゴリに該当するため使用可能です。

```bash
grep -c "^| " CLAUDE.md
```

このコマンドはMarkdownテーブルの行（ヘッダー行・セパレーター行・データ行）をカウントします。
ただし複数テーブルが存在するため、Readツールで141-170行付近を読み込み、視覚的に25行（ヘッダー除く）であることを確認します。
受入基準AC-5-5が要求する数値は25であり、個別フェーズの存在確認も合わせて実施します。

### 検証ステップ 2: workflow-plugin/CLAUDE.mdのフェーズ数確認

同様にReadツールで179-210行付近を読み込み、視覚的に25行（ヘッダー除く）であることを確認します。
また「入力ファイル重要度」列がすべての追記行に存在することを確認します（受入基準AC-6-5が求める列数の検証可能性確保）。
各追記行がMarkdownパーサーで正常に解釈できる適切な書式・構文で記載されていることを目視確認します。

### 検証ステップ 3: 追記4フェーズのsubagent_typeとmodel確認

definitions.tsから取得した正確な値と照合します（一致確認）。
design_reviewはsubagent_type=general-purpose、model=sonnetであることを個別に確認します。
regression_testはsubagent_type=general-purpose、model=haikuであることを個別に確認します。
ci_verificationはsubagent_type=general-purpose、model=haikuであることを個別に確認します。
deployはsubagent_type=general-purpose、model=haikuであることを個別に確認します。

### 検証ステップ 4: フェーズ定義順序の確認

definitions.tsのPHASE_SEQUENCE配列（行84-104付近）と照合し、テーブルのフェーズ順序が一致することを確認します。
期待される定義順序はresearch → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy の25フェーズです。
この順序がNFR-3の整合性要件を満たすことを確認します。

### 検証ステップ 5: git diffによる変更内容確認

git diffで変更後の内容を確認し、追記した4行以外の変更がないことを目視確認します。
各ファイルについてそれぞれ+4行（各追記行）のみが差分として表示されることを期待します。
NFR-4（変更の検証可能性）の要件として、この手順は必須です。

---

## リスク軽減策

### リスク R-1: old_stringが一意でない場合のedit失敗

同一文字列が複数箇所に存在すると、Editツールが「old_string is not unique」エラーを返します。
対策として、old_stringには前後の行を含めて十分なコンテキストを持たせています。
FR-5-C、FR-6-Cでは直前のcommit行とpush行を含め、さらに直後の次セクションヘッダーも含めてold_stringを構成し、一意性を確保します。

### リスク R-2: 行末スペースや改行コードの不一致

WindowsのCRLF環境では改行コードの扱いに注意が必要です。
Editツールは内部でファイルの改行コードを保持するため、new_stringに改行コードを明示的に指定する必要はありません。
old_stringが正確にファイル内容と一致していることをReadツールで事前確認します。

### リスク R-3: ファイル読み込みのキャッシュ状態

Editツール使用前にReadツールでファイルを読み込んでいる必要があります。
実装フェーズではまず両ファイルをReadツールで読み込んでから、Edit操作を実行します。

### リスク R-4: workflow-plugin/CLAUDE.mdの列数不一致

6列テーブルへの追記時に、誤って5列の行を挿入するとMarkdownテーブルが破損します。
new_stringは必ず6列（パイプ区切り7セグメント）になっていることを確認します。
本仕様書に記載のnew_stringはすべて正確な列数で構成されており、Markdownパーサーで正常に解釈できる構文です。

---

## 非機能要件の実装方針

要件定義書（requirements.md）で定義された非機能要件（NFR）への対応方針を以下に示します。

### NFR-1（変更の局所性）への対応

FR-5とFR-6の変更は、対象ファイルのsubagent設定テーブルへの行追記のみに限定します。
Bashコマンド許可カテゴリテーブルは修正不要であることが調査で確定しており、変更対象から除外します。
実装完了後のgit diffで変更箇所が期待通りの範囲に収まっていることを確認します。

### NFR-2（Markdown書式の維持）への対応

追記する各追記行のMarkdown書式（パイプ記号、スペース配置、列数）は、既存の行と書式・記号が統一されるよう設計しています。
Markdownパーサーで正常にテーブルとして解釈できる構文であることが必須の受入基準です。

### NFR-3（2ファイル間の整合性）への対応

FR-5で追記する内容とFR-6で追記する内容が矛盾しないことを確認します。
workflow-plugin/CLAUDE.mdに固有の「入力ファイル重要度」列の値は、フェーズの性質に基づいて論理的に決定されており、本仕様書に具体的な数値と根拠を記載しています。

### NFR-4（変更の検証可能性）への対応

変更後にgit diffで確認し、意図しない行が追加・削除されていないことを確認します。
定義順序の正しい位置への挿入であることも、FR-7の検証手順で目視確認します。

---

## 実装手順まとめ

実装フェーズでの作業順序を以下に整理します。

**ステップ1**: ReadツールでCLAUDE.md（141-165行）を読み込み、old_stringが正確に一致することを確認します。
**ステップ2**: EditツールでFR-5-Aを実行し、design_review行を挿入します。
**ステップ3**: EditツールでFR-5-Bを実行し、regression_test行を挿入します。
**ステップ4**: EditツールでFR-5-Cを実行し、ci_verificationとdeploy行を挿入します。
**ステップ5**: ReadツールでCLAUDE.md（141-170行）を再読み込みし、25行であることを確認します。
**ステップ6**: Readツールでworkflow-plugin/CLAUDE.md（179-205行）を読み込み、old_stringを確認します。
**ステップ7**: EditツールでFR-6-Aを実行し、design_review行（入力ファイル重要度「高」）を挿入します。
**ステップ8**: EditツールでFR-6-Bを実行し、regression_test行（入力ファイル重要度「中」）を挿入します。
**ステップ9**: EditツールでFR-6-Cを実行し、ci_verificationとdeploy行（いずれも「低」）を挿入します。
**ステップ10**: ReadツールでFR-7の検証手順に従い、両ファイルの整合性を確認します。
