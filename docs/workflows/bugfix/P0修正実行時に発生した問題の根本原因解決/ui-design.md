## サマリー

本UI設計書は、CLAUDE.mdとdefinitions.tsの乖離解消タスクにおけるCLIインターフェース・APIレスポンス・エラーメッセージ・設定ファイルフォーマットの仕様を定める。
本タスクはCLI/APIベースのワークフロープラグインを対象とするドキュメント修正タスクであり、Webフロントエンド画面は存在しない。

- 目的: 修正後にworkflow_statusのphaseGuideレスポンスが正確なsubagentType値を返すことを仕様として明文化する
- 主要な決定事項: 修正対象の5フェーズ（research・build_check・testing・commit・push）に対し、subagentTypeは全て「general-purpose」を返す仕様とする
- 次フェーズで必要な情報: 本書で定義したAPIレスポンス形式とACの対応付け、設定ファイルフォーマットの行番号情報

---

## CLIインターフェース設計

### workflow_statusコマンドの動作仕様

`workflow_status` はMCPサーバーが公開するツールであり、現在のワークフロー状態とphaseGuide情報を返す。
本タスクの修正完了後、コマンド実行結果のphaseGuide.subagentTypeフィールドに関する仕様を以下に定める。

#### 修正前の誤った動作（廃止される挙動）

修正前のCLAUDE.mdには、research・build_check・testing・commit・pushの5フェーズで誤ったsubagentType値（ExploreまたはBash）が記載されていた。
OrchestratorはCLAUDE.mdを参照してsubagentを起動するため、修正前はこれらのフェーズで意図しないsubagentTypeが使用される状態であった。
この誤動作は、前回タスクのmanual_test実行時に品質問題を引き起こした原因の一つである。

#### 修正後の正しい動作（本仕様が定める正常状態）

修正後のCLAUDE.mdを参照したOrchestratorは、全フェーズで「general-purpose」のsubagentTypeを使用してsubagentを起動する。
これによりworkflow_statusのphaseGuideレスポンスが正確な設定値を反映し、Orchestratorが正しいsubagentを選択できる状態となる。

#### 対象フェーズ別の変更前後対照表

以下に各フェーズのsubagentTypeとmodelの正しい値を示す。この表の値がCLAUDE.md修正後の期待仕様となる。

- researchフェーズ: subagentType=general-purpose、model=sonnet（変更前はExplore/haiku）
- build_checkフェーズ: subagentType=general-purpose、model=haiku（変更前はBash/haiku。modelは維持）
- testingフェーズ: subagentType=general-purpose、model=haiku（変更前はBash/haiku。modelは維持）
- commitフェーズ: subagentType=general-purpose、model=haiku（変更前はBash/haiku。modelは維持）
- pushフェーズ: subagentType=general-purpose、model=haiku（変更前はBash/haiku。modelは維持）

---

## エラーメッセージ設計

### 不一致検出時の将来的な警告メッセージ仕様

現時点では、CLAUDE.mdとdefinitions.tsの不一致を自動検出する仕組みは実装されていない。
将来的にこのような検出機能を追加する場合に備え、警告メッセージのフォーマット仕様を以下に定める。
本タスクの修正が完了した後は不一致が存在しないため、この警告メッセージが発動することはない。

#### 警告メッセージの形式（将来実装向け仕様）

不一致が検出された場合に想定される警告メッセージは以下の構造を持つ。

- 対象フェーズ名: 不一致が発生しているフェーズのPhase識別子を明示する
- 不一致の内容: CLAUDE.mdに記載された値とdefinitions.tsに定義された実装値の差分を列挙する
- 推奨アクション: CLAUDE.mdを定義値（definitions.ts）に合わせるべきか、definitions.tsを変更すべきかを提示する

#### 正常状態のメッセージ仕様（修正完了後の期待動作）

修正完了後のシステムは不一致を検出せず、警告メッセージを出力しない。
Orchestratorは全フェーズで正確なsubagentType「general-purpose」を読み取り、対応するsubagentを正しく起動する。
エラーメッセージが出力されない状態が、本タスクの到達目標である正常状態を示す指標となる。

#### gitカテゴリ参照に関する警告メッセージの廃止

修正前のCLAUDE.mdには「commit, push」フェーズのBashカテゴリとして「git」が記載されていた。
しかし「git」はdefinitions.tsに定義が存在しないカテゴリ名であるため、フックの判定ロジックが誤判定を起こす可能性があった。
FR-B3の適用後は「readonly, implementation」に変更されるため、gitカテゴリへの参照による誤判定のリスクが解消される。

---

## APIレスポンス設計

### phaseGuideオブジェクトのsubagentTypeフィールド仕様

workflow_statusツールが返すphaseGuideオブジェクトには、現フェーズの実行に必要な設定情報が格納される。
この中でsubagentTypeフィールドは、Orchestratorがsubagentを起動する際に使用するエージェント種別を示す。

#### 修正後のsubagentTypeフィールドの期待値

修正完了後のCLAUDE.mdに基づき、各フェーズのsubagentTypeフィールドは以下の値を返す。
全フェーズで「general-purpose」が返却される仕様が本タスクの目標状態である。

- researchフェーズでのsubagentType: 値は「general-purpose」（修正前の「Explore」から変更）
- requirementsフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- threat_modelingフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- planningフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- state_machineフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- flowchartフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- ui_designフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- test_designフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- test_implフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- implementationフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- refactoringフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- build_checkフェーズでのsubagentType: 値は「general-purpose」（修正前の「Bash」から変更）
- code_reviewフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- testingフェーズでのsubagentType: 値は「general-purpose」（修正前の「Bash」から変更）
- manual_testフェーズでのsubagentType: 値は「general-purpose」（変更なし）
- security_scanフェーズでのsubagentType: 値は「general-purpose」（前回タスクで修正済み）
- performance_testフェーズでのsubagentType: 値は「general-purpose」（前回タスクで修正済み）
- e2e_testフェーズでのsubagentType: 値は「general-purpose」（前回タスクで修正済み）
- commitフェーズでのsubagentType: 値は「general-purpose」（修正前の「Bash」から変更）
- pushフェーズでのsubagentType: 値は「general-purpose」（修正前の「Bash」から変更）

#### modelフィールドの仕様

phaseGuideオブジェクトのmodelフィールドは、subagentが使用するClaudeモデルを指定する。
本タスクの修正対象はresearchフェーズのmodel値のみであり、他フェーズのmodel値は変更しない。

- researchフェーズのmodel値: 「sonnet」（修正前の「haiku」から変更。調査品質向上のため）
- build_check・testing・commit・pushフェーズのmodel値: 「haiku」を維持（変更なし）

---

## 設定ファイル設計

### ルートCLAUDE.mdのテーブルフォーマット仕様

ルートCLAUDE.mdのフェーズ別subagent設定テーブルは5列構成のMarkdownパイプテーブルである。
各列の定義は以下の通りである。

- 第1列（フェーズ列）: フェーズ名（英数字・アンダースコア）を格納し、修正時に変更してはならない列
- 第2列（subagent_type列）: subagentの種別を格納する列。修正対象の5フェーズでは「general-purpose」に統一する
- 第3列（model列）: 使用するClaudeモデルを格納する列。researchフェーズのみ「sonnet」に変更し他は「haiku」のまま維持する
- 第4列（入力ファイル列）: subagentが読み込む入力ファイル名を格納し、修正時に変更してはならない列
- 第5列（出力ファイル列）: subagentが出力するファイル名を格納し、修正時に変更してはならない列

#### セパレータ行のフォーマット

テーブルのヘッダー行の直下に配置されるセパレータ行は、ハイフンとパイプ記号で構成される。
このセパレータ行は修正対象外であり、変更してはならない。

### workflow-plugin/CLAUDE.mdのテーブルフォーマット仕様

workflow-plugin/CLAUDE.mdのフェーズ別subagent設定テーブルは7列構成であり、ルートCLAUDE.mdより2列多い。
ルートCLAUDE.mdの5列に加えて「入力ファイル重要度」列が追加されている。

- 第1列（フェーズ列）: フェーズ名を格納。修正時に変更してはならない列である点はルートCLAUDE.mdと同じ
- 第2列（subagent_type列）: 修正対象の5フェーズで「general-purpose」に変更する対象列
- 第3列（model列）: researchフェーズを「sonnet」に変更する対象列。他4フェーズは「haiku」のまま維持する
- 第4列・第5列・第6列・第7列: 入出力ファイル情報と重要度を格納し、修正時に変更してはならない列群

#### Bashコマンド許可カテゴリテーブルの存在有無

ルートCLAUDE.mdにはBashコマンド許可カテゴリテーブルが存在し、FR-B3の修正対象となる。
workflow-plugin/CLAUDE.mdにはBashコマンド許可カテゴリテーブルが存在しないため、FR-B3相当の変更は適用しない。
この構造的差異により、commit/pushフェーズのカテゴリ修正はルートCLAUDE.mdのみへの変更となる。

### 修正後の設定ファイル正常状態の確認基準

修正完了後のルートCLAUDE.mdに対するgrepパターンと期待結果を以下に示す。
「Explore」または「Bash」がフェーズテーブルの第2列に残存していないことがAC-1の確認基準となる。
「readonly, git」という文字列がBashカテゴリテーブルに残存していないことがAC-4の確認基準となる。
「readonly, implementation」がcommit/pushフェーズ行に存在することがAC-5の補完的確認となる。
