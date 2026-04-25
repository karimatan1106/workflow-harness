## サマリー

本要件定義書は、前回のP0修正タスク（20260217_214128）実行中に発生した複数の問題の根本原因を解消するための修正要件をまとめたものである。

### 目的

- CLAUDE.md（プロジェクトルート）のフェーズ別subagent設定テーブルを、definitions.tsの実装値と完全一致させる
- workflow-plugin/CLAUDE.mdのテーブルをプロジェクトルートのCLAUDE.mdと完全同期させる
- Bashコマンド許可カテゴリテーブルのcommit/push行を「readonly, implementation」に修正し、未定義カテゴリ「git」への参照を解消する

### 主要な決定事項

1. subagentTypeはdefinitions.tsの実装値（全フェーズ「general-purpose」）を正規ソースとみなし、CLAUDE.mdをその値に合わせる
2. researchフェーズのmodelはdefinitions.tsの値（sonnet）に合わせて修正する
3. commit/pushフェーズの許可カテゴリは「readonly, git」から「readonly, implementation」に変更し、git参照を解消する
4. gitカテゴリの新規定義は行わない（definitions.tsに存在しないため）
5. definitions.tsは変更しない（正規ソースであり、現状の実装は正しい）

### 次フェーズで必要な情報

- CLAUDE.mdの修正対象行番号（確認済み: 143, 154, 156, 162, 163, 181行）
- workflow-plugin/CLAUDE.mdの修正対象行番号（確認済み: 181, 192, 194, 200, 201行付近）
- 修正後のテーブル値が20フェーズ全て網羅されているかの確認方法

---

## 背景・問題の概要

前回のP0修正タスクでは、security_scan・performance_test・e2e_testの3フェーズにおけるCLAUDE.mdとdefinitions.tsの乖離を修正した。しかし、同種の乖離がresearch・build_check・testing・commit・pushの5フェーズにも存在しており、未修正のまま残っている。この状態では、OrchestratorがCLAUDE.mdを参照して誤ったsubagentTypeやmodelを選択し、前回と同様の品質問題が再発するリスクがある。

特にresearchフェーズはsubagentType（Explore）とmodel（haiku）の両方が乖離しており、haikuモデルで調査品質が低下した場合、下流フェーズに影響が波及する。manual_testで3回のリトライが必要になった直接原因も、CLAUDE.mdが誤ったモデル（haiku）を指示したことである。

---

## 機能要件

### FR-B1: ルートCLAUDE.mdのsubagentType列修正

対象ファイルはプロジェクトルートのCLAUDE.mdである。フェーズ別subagent設定テーブル（「### フェーズ別subagent設定」見出し以下）において以下の5行を修正する。

**researchフェーズ（143行目）の修正内容:**
- 現在の値: subagent_type列が「Explore」、model列が「haiku」
- 修正後の値: subagent_type列を「general-purpose」に変更、model列を「sonnet」に変更
- 変更理由: definitions.tsではresearchのsubagentTypeはgeneral-purpose、modelはsonnetと定義されている

**build_checkフェーズ（154行目）の修正内容:**
- 現在の値: subagent_type列が「Bash」、model列が「haiku」
- 修正後の値: subagent_type列を「general-purpose」に変更、model列は「haiku」のまま維持
- 変更理由: definitions.tsではbuild_checkのsubagentTypeはgeneral-purposeと定義されている

**testingフェーズ（156行目）の修正内容:**
- 現在の値: subagent_type列が「Bash」、model列が「haiku」
- 修正後の値: subagent_type列を「general-purpose」に変更、model列は「haiku」のまま維持
- 変更理由: definitions.tsではtestingのsubagentTypeはgeneral-purposeと定義されている

**commitフェーズ（162行目）の修正内容:**
- 現在の値: subagent_type列が「Bash」、model列が「haiku」
- 修正後の値: subagent_type列を「general-purpose」に変更、model列は「haiku」のまま維持
- 変更理由: definitions.tsではcommitのsubagentTypeはgeneral-purposeと定義されている

**pushフェーズ（163行目）の修正内容:**
- 現在の値: subagent_type列が「Bash」、model列が「haiku」
- 修正後の値: subagent_type列を「general-purpose」に変更、model列は「haiku」のまま維持
- 変更理由: definitions.tsではpushのsubagentTypeはgeneral-purposeと定義されている

---

### FR-B2: workflow-plugin/CLAUDE.mdのsubagentType列修正

対象ファイルはworkflow-plugin/CLAUDE.mdである。プロジェクトルートのCLAUDE.mdと完全同期させるため、以下の5行にFR-B1と同一の修正を適用する。

- 181行目付近（researchフェーズ）: subagent_type列を「general-purpose」、model列を「sonnet」に変更
- 192行目付近（build_checkフェーズ）: subagent_type列を「general-purpose」に変更、model列は「haiku」を維持
- 194行目付近（testingフェーズ）: subagent_type列を「general-purpose」に変更、model列は「haiku」を維持
- 200行目付近（commitフェーズ）: subagent_type列を「general-purpose」に変更、model列は「haiku」を維持
- 201行目付近（pushフェーズ）: subagent_type列を「general-purpose」に変更、model列は「haiku」を維持

workflow-plugin/CLAUDE.mdはworkflow-pluginサブモジュールに含まれるため、修正後はサブモジュール側のコミットが必要になる点に留意する。

---

### FR-B3: ルートCLAUDE.mdのallowedBashCategories修正

対象ファイルはプロジェクトルートのCLAUDE.mdである。「フェーズ別Bashコマンド許可カテゴリ」テーブルにおいて以下の行を修正する。

**commit, pushフェーズの行（181行目）の修正内容:**
- 現在の値: 許可カテゴリ列が「readonly, git」
- 修正後の値: 許可カテゴリ列を「readonly, implementation」に変更
- 変更理由: definitions.tsでのcommit/pushフェーズのallowedBashCategoriesはreadonly・implementationであり、gitカテゴリは定義されていない。「git」への参照は実装と乖離した誤情報である

この修正により、カテゴリ定義セクション（readonly/testing/implementationの3カテゴリ）と許可カテゴリテーブルの間の不整合が解消される。

---

### FR-B4: gitカテゴリ参照の完全解消

FR-B3の修正（commit/push行を「readonly, implementation」に変更）により、CLAUDE.md内に存在したgitカテゴリへの唯一の参照が削除される。

新規のgitカテゴリ定義は行わない。その理由は以下の通りである。
- definitions.tsにgitカテゴリが存在しない
- git add・git commitはimplementationカテゴリに含まれており、実運用上の問題はない
- gitカテゴリを新規追加するにはdefinitions.tsの変更も必要となり、影響範囲が広がる

---

## 非機能要件

### NFR-1: definitions.tsとCLAUDE.mdの完全整合

修正後、CLAUDE.mdのフェーズ別subagent設定テーブルに記載される全20フェーズ（サブフェーズを含む）のsubagentTypeとmodel値が、definitions.tsの実装値と100%一致していること。

未修正フェーズが1件でも残存している場合は修正完了と見なさない。修正完了の判定には、definitions.tsの全フェーズ定義とCLAUDE.mdのテーブル全行を突き合わせる確認作業が必要である。

### NFR-2: 修正対象外行の無変更保証

今回の修正対象は上記5フェーズのsubagentType列・model列（一部）と、commit/push行の許可カテゴリ列のみである。修正対象外の行・列・セクションは一切変更しないこと。特に、入力ファイル列・出力ファイル列・備考列の内容は変更してはならない。

誤って変更した場合、Orchestratorが誤った入出力ファイルを参照する恐れがある。

### NFR-3: 2ファイル間の完全同期

workflow-plugin/CLAUDE.mdのフェーズ別subagent設定テーブルは、プロジェクトルートのCLAUDE.mdのテーブルと完全に同一の値を持つこと。いずれか一方のみ修正して終了することは禁止である。

---

## 受け入れ基準

### AC-1: subagentTypeの完全一致確認

修正後のCLAUDE.md（ルート）において、フェーズ別subagent設定テーブルの全20行についてsubagentType列が「general-purpose」であることを確認する。ExploreまたはBashが残存している場合は修正不完全と判定する。

### AC-2: modelの完全一致確認

修正後のCLAUDE.md（ルート）において、researchフェーズのmodel列が「sonnet」であることを確認する。その他のhaiku指定フェーズ（build_check, testing, commit, push等）はhaikuのまま維持されていることを確認する。

### AC-3: workflow-plugin/CLAUDE.mdの同期確認

修正後のworkflow-plugin/CLAUDE.mdのフェーズ別subagent設定テーブルが、プロジェクトルートのCLAUDE.mdと同一の値を持つことを確認する。特にresearch行のsubagentType=general-purposeおよびmodel=sonnetが正しく反映されているかを確認する。

### AC-4: 未定義カテゴリ参照の解消確認

修正後のCLAUDE.md（ルート）において、「フェーズ別Bashコマンド許可カテゴリ」テーブルに「git」カテゴリへの参照が一切存在しないことを確認する。「readonly, git」という文字列が残存している場合は修正不完全と判定する。

### AC-5: Bashカテゴリ定義との整合確認

修正後のCLAUDE.md（ルート）において、「フェーズ別Bashコマンド許可カテゴリ」テーブルに記載される全カテゴリ名（readonly, testing, implementation, deploy等）が、Bashカテゴリ定義セクションに定義されているカテゴリのいずれかと一致することを確認する。定義されていないカテゴリ名が参照されている行がある場合は修正不完全と判定する。

---

## 修正対象ファイルと変更箇所の一覧

修正が必要なファイルは以下の2ファイルである。definitions.tsは変更しない。

プロジェクトルートのCLAUDE.mdにおける変更箇所は合計6箇所である。
- 143行目: researchフェーズのsubagentType（Explore→general-purpose）とmodel（haiku→sonnet）の2値変更
- 154行目: build_checkフェーズのsubagentType（Bash→general-purpose）の1値変更
- 156行目: testingフェーズのsubagentType（Bash→general-purpose）の1値変更
- 162行目: commitフェーズのsubagentType（Bash→general-purpose）の1値変更
- 163行目: pushフェーズのsubagentType（Bash→general-purpose）の1値変更
- 181行目: commit/pushフェーズの許可カテゴリ（readonly, git→readonly, implementation）の1値変更

workflow-plugin/CLAUDE.mdにおける変更箇所は合計6箇所であり、プロジェクトルートの変更と対称である。
- 181行目付近: researchフェーズのsubagentTypeとmodelの2値変更
- 192行目付近: build_checkフェーズのsubagentTypeの1値変更
- 194行目付近: testingフェーズのsubagentTypeの1値変更
- 200行目付近: commitフェーズのsubagentTypeの1値変更
- 201行目付近: pushフェーズのsubagentTypeの1値変更
- 対応する許可カテゴリ行: commit/pushの許可カテゴリの1値変更

---

## 影響範囲

本修正はCLAUDE.mdのドキュメント内容のみを変更し、ソースコードは変更しない。影響が及ぶのはOrchestratorがCLAUDE.mdを参照してsubagentを起動する際の設定値である。

修正後は、Orchestratorが正しいsubagentType（general-purpose）とmodel値を使用してsubagentを起動するため、前回のmanual_testで発生したようなモデル品質起因の繰り返しリトライが防止される。また、commit/pushフェーズでgitカテゴリが存在しないことによる混乱も解消される。
