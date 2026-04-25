## サマリー

本仕様書は、CLAUDE.mdのフェーズ別subagent設定テーブルとdefinitions.tsの実装値の乖離を解消するための実装計画を定める。
対象はルートCLAUDE.mdおよびworkflow-plugin/CLAUDE.mdに存在する5フェーズ（research・build_check・testing・commit・push）の設定誤りである。

- 目的: 上記5フェーズのsubagentTypeとmodel値をdefinitions.tsの正規ソースに合わせて修正する。
  加えて、commit/pushフェーズのBashコマンド許可カテゴリテーブルで指定されている許可カテゴリ「readonly, git」を「readonly, implementation」に修正し、定義が存在しないgitカテゴリへの参照を完全解消する。
- 主要な決定事項: definitions.tsを変更せず、CLAUDE.md側を実装値に合わせる方針を採用する。gitカテゴリの新規追加は行わない。
- 次フェーズで必要な情報: 修正対象行番号（本仕様書に明記）、受け入れ基準（AC-1〜AC-5）、2ファイルの同期確認方法。
- 変更対象: CLAUDE.md（ドキュメントファイル）のみ。workflow-plugin/mcp-server/src/phases/definitions.ts等のソースコードは変更しない。

---

## 概要

### 修正の背景と根本原因

前回のP0修正タスク（20260217_214128）実行中に複数の問題が発生した。同タスクでは、security_scan・performance_test・e2e_testの3フェーズについてCLAUDE.mdとdefinitions.tsの乖離を修正した。しかし同種の乖離が、research・build_check・testing・commit・pushの5フェーズに引き続き存在していた。

この乖離の根本原因は、CLAUDE.mdのテーブルが実装の現状と一致しないまま放置されてきた点にある。特にresearchフェーズでhaikuモデルが使用される状態になっていると、調査品質が低下し下流フェーズに悪影響が波及する。前回タスク実行中にmanual_testが3回のリトライを要した直接原因も、CLAUDE.mdがresearchに誤ったモデル（haiku）を指示していたことによる品質問題であった。同様の品質問題が再発しないよう、今回の修正で不整合を完全整合状態へと解消する。

### 修正対象ファイル一覧

本修正は以下の2ファイルのみを変更する。definitions.tsは正規ソースとして変更しない。

- `C:\ツール\Workflow\CLAUDE.md`（FR-B1 + FR-B3の変更を適用）
- `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`（FR-B2の変更を適用）

workflow-plugin/CLAUDE.mdはGitサブモジュールに含まれるため、修正後はサブモジュール側へのコミット操作が別途必要になる点に留意すること。

---

## 実装計画

### 実装順序の概要

3つの修正要件を以下の順序で実施する。順序に技術的な依存関係はないが、ルートCLAUDE.mdへの変更をまとめて行い、次にworkflow-plugin/CLAUDE.mdの変更を行うことで確認作業を効率化できる。

1. FR-B1: ルートCLAUDE.mdのsubagentType列修正（5行変更）
2. FR-B3: ルートCLAUDE.mdのBashコマンド許可カテゴリテーブル修正（1行変更）
3. FR-B2: workflow-plugin/CLAUDE.mdのsubagentType列修正（5行変更）

### FR-B1: ルートCLAUDE.mdのsubagentType列修正

対象ファイル: `C:\ツール\Workflow\CLAUDE.md`
対象セクション: 「### フェーズ別subagent設定」見出し以下のテーブル（141行目のヘッダー行以降）

変更箇所は以下の5行である。変更対象は各行のsubagent_type列とmodel列のみであり、フェーズ名・入出力ファイル・入力ファイル重要度の各列は一切変更しない。

**143行目 researchフェーズ（修正内容）:**
- 変更前: `| research | Explore | haiku | - | research.md |`
- 変更後: `| research | general-purpose | sonnet | - | research.md |`
- 修正内容: subagent_type列をExploreからgeneral-purposeに変更し、model列をhaikuからsonnetに変更する（2値変更）

**154行目 build_checkフェーズ（修正内容）:**
- 変更前: `| build_check | Bash | haiku | - | - |`
- 変更後: `| build_check | general-purpose | haiku | - | - |`
- 修正内容: build_checkのsubagent_type列をBashからgeneral-purposeに変更する（1値変更、ビルドエラー修正のためmodel列はhaikuを維持）

**156行目 testingフェーズ（修正内容）:**
- 変更前: `| testing | Bash | haiku | - | - |`
- 変更後: `| testing | general-purpose | haiku | - | - |`
- 修正内容: testingのsubagent_type列をBashからgeneral-purposeに変更する（1値変更、テスト実行のためmodel列はhaikuを維持）

**162行目 commitフェーズ（修正内容）:**
- 変更前: `| commit | Bash | haiku | - | - |`
- 変更後: `| commit | general-purpose | haiku | - | - |`
- 修正内容: commitのsubagent_type列をBashからgeneral-purposeに変更する（1値変更、Git操作のためmodel列はhaikuを維持）

**163行目 pushフェーズ（修正内容）:**
- 変更前: `| push | Bash | haiku | - | - |`
- 変更後: `| push | general-purpose | haiku | - | - |`
- 修正内容: pushのsubagent_type列をBashからgeneral-purposeに変更する（1値変更、リモート送信のためmodel列はhaikuを維持）

### FR-B3: ルートCLAUDE.mdのBashカテゴリ許可テーブル修正

対象ファイル: `C:\ツール\Workflow\CLAUDE.md`
対象セクション: 「### フェーズ別Bashコマンド許可カテゴリ」セクション以下のカテゴリテーブル（169行目のヘッダー行以降）

変更箇所は以下の1行である。変更対象は許可カテゴリ列のみであり、フェーズ列と用途列は変更しない。

**181行目 commit/pushフェーズ（修正内容）:**
- 変更前: `| commit, push | readonly, git | Git操作のため |`
- 変更後: `| commit, push | readonly, implementation | Git操作のため |`
- 修正内容: 許可カテゴリ列の「git」を「implementation」に変更する（1値変更）
- 変更理由: definitions.tsのcommit/pushフェーズのallowedBashCategoriesはreadonly・implementationであり、gitカテゴリは定義されていない。現在の「git」への参照は誤情報であり、実装値と乖離した不整合な状態である。git add・git commitはimplementationカテゴリに含まれているため、実運用上の問題は生じない。

なお、workflow-plugin/CLAUDE.mdには「フェーズ別Bashコマンド許可カテゴリ」セクションが存在しないため、FR-B3はルートCLAUDE.mdのみに適用する。

### FR-B2: workflow-plugin/CLAUDE.mdのsubagentType列修正

対象ファイル: `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`
対象セクション: 「### フェーズ別subagent設定」見出し以下のテーブル（177行目のヘッダー行以降）

このファイルのテーブルはルートCLAUDE.mdより1列多く（「入力ファイル重要度」列が追加されている）、行番号もやや異なる。変更対象の行と修正内容はFR-B1と対称であるが、変更箇所は以下の通りである。

**181行目付近 researchフェーズ（修正内容）:**
- 変更前: `| research | Explore | haiku | - | - | research.md |`
- 変更後: `| research | general-purpose | sonnet | - | - | research.md |`
- 修正内容: subagent_type列をExploreからgeneral-purposeに変更し、model列をhaikuからsonnetに変更する（2値変更）

**192行目付近 build_checkフェーズ（修正内容）:**
- 変更前: `| build_check | Bash | haiku | - | - | - |`
- 変更後: `| build_check | general-purpose | haiku | - | - | - |`
- 修正内容: plugin側build_checkのsubagent_type列をBashからgeneral-purposeに変更する（1値変更、model列haikuは変更しない）

**194行目付近 testingフェーズ（修正内容）:**
- 変更前: `| testing | Bash | haiku | ... | ... | - |`
- 変更後: `| testing | general-purpose | haiku | ... | ... | - |`
- 修正内容: plugin側testingのsubagent_type列をBashからgeneral-purposeに変更する（1値変更、model列haikuは変更しない）

**200行目付近 commitフェーズ（修正内容）:**
- 変更前: `| commit | Bash | haiku | - | - | - |`
- 変更後: `| commit | general-purpose | haiku | - | - | - |`
- 修正内容: plugin側commitのsubagent_type列をBashからgeneral-purposeに変更する（1値変更、model列haikuは変更しない）

**201行目付近 pushフェーズ（修正内容）:**
- 変更前: `| push | Bash | haiku | - | - | - |`
- 変更後: `| push | general-purpose | haiku | - | - | - |`
- 修正内容: plugin側pushのsubagent_type列をBashからgeneral-purposeに変更する（1値変更、model列haikuは変更しない）

---

## 変更対象ファイルと変更箇所の詳細

本タスクで変更するファイルはドキュメントファイル（CLAUDE.md）のみである。
参照先のソースコードである `workflow-plugin/mcp-server/src/phases/definitions.ts` は正規ソースとして読み取り専用で参照するが、変更は行わない。
また `workflow-plugin/mcp-server/src/` 配下の全TypeScriptファイルは本タスクの修正対象外である。

### ファイル1: C:\ツール\Workflow\CLAUDE.md

変更内容の合計は6箇所（FR-B1が5箇所 + FR-B3が1箇所）。変更はすべて既存テーブルのセル値の置換であり、行の追加・削除・順序変更は行わない。

| 行番号 | フェーズ | 変更前の値 | 変更後の値 | 対応要件 |
|--------|---------|-----------|-----------|---------|
| 143 | research | subagent_type=Explore, model=haiku | subagent_type=general-purpose, model=sonnet | FR-B1 |
| 154 | build_check | subagent_type=Bash | subagent_type=general-purpose | FR-B1 |
| 156 | testing | subagent_type=Bash | subagent_type=general-purpose | FR-B1 |
| 162 | commit | subagent_type=Bash | subagent_type=general-purpose | FR-B1 |
| 163 | push | subagent_type=Bash | subagent_type=general-purpose | FR-B1 |
| 181 | commit, push | 許可カテゴリ=readonly, git | 許可カテゴリ=readonly, implementation | FR-B3 |

修正対象外の行（上記6行以外の全行）については無変更保証を維持する。修正対象外行の内容が誤って変更されていないことを、実装フェーズ完了後に確認する。

### ファイル2: C:\ツール\Workflow\workflow-plugin\CLAUDE.md

変更内容の合計は5箇所（FR-B2）。このファイルにはBashコマンド許可カテゴリテーブルが存在しないため、FR-B3に相当する変更はない。

| 行番号 | フェーズ | 変更前の値 | 変更後の値 | 対応要件 |
|--------|---------|-----------|-----------|---------|
| 181行目付近 | research | subagent_type=Explore, model=haiku | subagent_type=general-purpose, model=sonnet | FR-B2 |
| 192行目付近 | build_check | subagent_type=Bash | subagent_type=general-purpose | FR-B2 |
| 194行目付近 | testing | subagent_type=Bash | subagent_type=general-purpose | FR-B2 |
| 200行目付近 | commit | subagent_type=Bash | subagent_type=general-purpose | FR-B2 |
| 201行目付近 | push | subagent_type=Bash | subagent_type=general-purpose | FR-B2 |

修正対象行番号については確認済みの行番号を使用すること。ただし実ファイルの行数は変動する可能性があるため、行目付近での検索を行い正確な行を特定してから編集すること。

---

## 受け入れ基準

実装完了の判定は以下の5項目を全て満たすことで行う。1項目でも満たさない場合は修正不完全とみなす。

**AC-1: subagentTypeの完全一致確認**
修正後のCLAUDE.md（ルート）において、フェーズ別subagent設定テーブルの全行のsubagent_type列に「Explore」または「Bash」が残存していないことを確認する。全行が「general-purpose」となっており、かつ今回の変更が両方のファイルに正しく反映されていること。

**AC-2: modelの完全一致確認**
修正後のCLAUDE.md（ルート）において、researchフェーズのmodel列が「sonnet」に変更されていることを確認する。build_check・testing・commit・pushフェーズのmodel列が「haiku」のまま維持されていることも確認する。

**AC-3: workflow-plugin/CLAUDE.mdの同期確認**
修正後のworkflow-plugin/CLAUDE.mdのフェーズ別subagent設定テーブルが、プロジェクトルートのCLAUDE.mdと同一のsubagent_type・model設定値を持つことを確認する。特にresearch行がgeneral-purpose・sonnetに変更されており、ルートCLAUDE.mdと完全整合した状態であることを重点的に確認する。

**AC-4: 定義が存在しないカテゴリ参照の解消確認**
修正後のCLAUDE.md（ルート）のBashコマンド許可カテゴリテーブルに「readonly, git」という文字列が一切存在しないことを確認する。commit/push行が「readonly, implementation」に変更されていること。これにより、カテゴリの不整合を完全解消したことを確かめる。

**AC-5: Bashカテゴリ定義との整合確認**
修正後のCLAUDE.md（ルート）のBashコマンド許可カテゴリテーブルに記載される全カテゴリ名（readonly, testing, implementation, deploy）が、Bashカテゴリ定義セクションに定義されているカテゴリのいずれかと一致していること。今回の修正で「git」のような定義が存在しないカテゴリが一覧から取り除かれていることを確認する。

---

## 非機能要件（NFR）

### NFR-1: 変更範囲の最小化と修正対象外行の無変更保証

修正対象外のセクション・行・列は一切変更しない。
変更対象はsubagent設定テーブルの特定セル値とBashコマンド許可カテゴリテーブルの特定セル値のみである。
入力ファイル列・出力ファイル列・入出力ファイル重要度列・備考列・用途列は変更禁止とする。
変更はテキストエディタ相当のツール（Edit/Write）のみで行い、BashのsedやPowerShell等のコマンドは使用しない。
本タスクの修正対象はドキュメントファイル（CLAUDE.md）のみであり、workflow-plugin/mcp-server/src/phases/definitions.ts等のソースコードは一切変更しない。

### NFR-2: definitions.tsとCLAUDE.mdの完全整合（NFR-1と並んで最重要の品質要件）

NFRのうちこの項目が最も重要である。修正後、CLAUDE.mdに記載される全フェーズ（サブフェーズを含む全20行）のsubagentTypeとmodel値が、definitions.tsの実装値と100%一致すること。
未修正フェーズが1件でも残存している場合は修正完了と見なさない。既に修正済みのフェーズに問題がないか、今回修正したフェーズを含む20フェーズ全体を網羅的に確認すること。
整合性確認はgrep等のreadonly操作のみで行い、definitions.tsへの変更は禁止とする。
確認対象は「subagent_type列」と「model列」の2列であり、その他の列は整合性チェックの対象外とする。

### NFR-3: 2ファイルの完全同期と起動時設定値の正確性

workflow-plugin/CLAUDE.mdのフェーズ別subagent設定テーブルは、ルートCLAUDE.mdのテーブルと同一のsubagent_type値およびmodel値を持つこと。
一方のファイルのみ修正して終了することは禁止であり、必ず両ファイルの修正が完了してから次フェーズに進む。
両ファイルの修正完了後、grep等で2ファイルの設定値が一致することを確認してから次フェーズへ移行する。
Orchestratorがsubagentを起動する際に参照する設定値が正確な状態に保たれることで、品質起因の繰り返しリトライや混乱を防止する効果が期待される。

---

## 影響範囲と再発防止

### 影響範囲

本修正はCLAUDE.mdのドキュメント内容のみを変更し、ソースコードは変更しない。影響が及ぶのはOrchestratorがCLAUDE.mdを参照してsubagentを起動する際の設定値である。

修正対象は2ファイル（ルートCLAUDE.md、workflow-plugin/CLAUDE.md）のフェーズ別subagent設定テーブル内のセル値に限定され、その他のドキュメント領域やソースコード領域への影響は発生しない。

修正後は、Orchestratorが正しいsubagentType（general-purpose）とmodel値を使用してsubagentを起動するため、前回のmanual_test実行中に発生した品質問題が再発するリスクを排除できる。特にresearchフェーズがhaikuからsonnetに変更されることで、調査品質が向上し、下流フェーズ（requirements・planning・test_design等）の成果物品質が改善される。

また、commit/pushフェーズでgitカテゴリが存在しないことに起因する混乱も完全解消される。Bashコマンド許可カテゴリの不整合解消により、フックの判定ロジックが正確性を取り戻す。

### 再発防止策

同種の不整合が再発しないよう、本仕様書で定めた受け入れ基準（AC-1〜AC-5）をcode_reviewフェーズでチェックリストとして活用すること。特にNFR-2で規定した20フェーズ全体の網羅確認を実施することで、一部のフェーズのみ修正して他を見落とすリスクを防止する。

品質管理上の観点では、definitions.tsが単一の真実の源（Single Source of Truth）として機能するよう、今後のCLAUDE.md更新時には常にdefinitions.tsと比較検証するプロセスを組み込むこと。

将来的にdefinitions.tsの設定値が変更された場合は、CLAUDE.md（ルートおよびworkflow-plugin/CLAUDE.md）への反映漏れがないよう、同様の確認手順を踏み、必ず両ファイルの同期を取ること。
