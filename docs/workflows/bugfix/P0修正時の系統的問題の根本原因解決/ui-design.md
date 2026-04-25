# UI設計書: P0修正時の系統的問題の根本原因解決

## サマリー

本設計書は、subagent_typeフィールドのドキュメント乖離修正タスクにおけるCLIインターフェース・
APIレスポンス・エラーメッセージ・設定ファイルの仕様を定義する。
今回の修正対象はドキュメント（CLAUDE.md×2）とテンプレート文字列（definitions.ts）のみであり、
MCPサーバーのコアロジックには変更を加えない。しかしOrchestratorがphaseGuideレスポンスを参照して
subagent_typeを決定するフローに直接関わるため、以下の観点でUI設計を行う。

- 目的: CLIコマンドのレスポンス仕様・エラーメッセージ設計・APIフィールド仕様・ドキュメントフォーマットの明確化
- 主要な決定事項: workflow_statusのレスポンスにsubagentTypeフィールドを明示すること
- 次フェーズで必要な情報: 各設計仕様の詳細と、実装チェックリストとの対応付け

---

## CLIインターフェース設計

### workflow_statusコマンドのレスポンス仕様

workflow_statusコマンドは、現在のタスクのフェーズ情報をJSON形式で返却する。
今回の修正により、phaseGuideセクションにsubagentTypeフィールドが正確に含まれることが求められる。
レスポンスの必須要素として、taskIdとtaskNameとcurrentPhaseとphaseGuideが設計される。
phaseGuideの内部フィールドには、phase・subagentType・model・allowedBashCategories・outputFilesが含まれる。

subagentTypeフィールドの値は、definitions.tsの実装値と常に一致している必要がある。
CLAUDE.mdのテーブルが「Bash」と誤記されていた場合、Orchestratorがレスポンスを
参照した際に誤ったエージェント型を選択するリスクがある。この修正により、
security_scanとperformance_testとe2e_testフェーズの全てで
subagentTypeが「general-purpose」と正確に返却される状態が実現される。

allowedBashCategoriesフィールドは、そのフェーズで許可されたBashコマンドのカテゴリ名を
文字列の配列形式で格納する。ui_designフェーズの場合は、readonlyカテゴリのみが許可される。
outputFilesフィールドは、そのフェーズで生成すべき出力ファイルのパスを文字列の配列形式で格納する。

### フェーズ一覧表示コマンドのサブフェーズ表記

workflow_listコマンドでアクティブタスクを一覧表示する際、
parallel_verificationのサブフェーズが正確に表示されることを確認する設計とする。
現行の設計では、サブフェーズ名と対応するsubagentTypeが以下のように表示される。

| サブフェーズ | subagentType | model |
|-------------|--------------|-------|
| manual_test | general-purpose | sonnet |
| security_scan | general-purpose（修正後） | sonnet |
| performance_test | general-purpose（修正後） | sonnet |
| e2e_test | general-purpose（修正後） | sonnet |

今回の修正前は、security_scan・performance_test・e2e_testの3行が「Bash」と誤って
表示される可能性があった。修正完了後はこの一覧が正確な状態を反映する。

---

## エラーメッセージ設計

### subagent_type不一致時の警告メッセージ設計

将来的な検証機能を見据え、OrchestratorがCLAUDE.mdの記載内容とdefinitions.tsの実装値の
不一致を検出した場合に表示する警告メッセージの仕様を定義する。
現時点ではこの検証機能は実装されていないが、設計として記録する。

警告メッセージの構造は3つのセクションで構成される。
第1セクションとして、先頭に「WARNING:」というプレフィックスをコロン形式で付与したタイトル行を置く。
第2セクションとして、フェーズ名・CLAUDE.mdの記載値・definitions.tsの実装値の3項目を列挙する。
第3セクションとして、推奨対応として修正対象ファイルと修正内容を案内するメッセージを記載する。

security_scanフェーズで不一致が検出された場合、「WARNING: subagent_typeの不一致を検出しました」から始まり、
フェーズ名はsecurity_scanと表示され、CLAUDE.mdの記載値はBashと表示される。
definitions.tsの実装値はgeneral-purposeと表示され、推奨対応として修正箇所の案内が続く。

メッセージの設計原則として、不一致が検出されたフェーズ名を明示し、
乖離しているソースの双方の値を表示し、修正が必要なファイルと箇所を具体的に案内する。
修正しない場合のリスクとして、誤ったエージェント選択によるMarkdownファイル生成失敗も明記する。

### 禁止語転記検出時のエラーメッセージ

artifact-validatorが成果物内の禁止語を検出した場合、以下の形式でエラーを返却する。
現行の実装では、入力ファイル由来の語句が無意識に転記されるケースが発生していた。
definitions.tsへの注意書き追加（FR-A3）により、この検出頻度を低減することが目的である。

エラーメッセージの構造は、先頭に「ERROR:」というプレフィックスをコロン形式で付与したタイトル行から始まる。
次に「成果物バリデーション失敗: 禁止パターンが検出されました」という概要を記述する。
その後、検出箇所の行番号と検出内容の説明を記載する。
最後に改善指示として、言い換え表現の使用・コードブロックの活用・行の個別化の3点を箇条書きで示す。

改善指示の内容は3項目で構成される。
入力ファイル（research.mdなど）の内容を解釈して言い換えた表現で記述することが第1項目である。
コードブロックやテーブルを活用して重複検出を回避することが第2項目である。
各行に文脈固有の情報を含め、同一行が3回以上繰り返さないようにすることが第3項目である。

---

## APIレスポンス設計

### phaseGuideのsubagentTypeフィールド返却値仕様

MCPサーバーのworkflow_statusツールが返却するphaseGuideオブジェクトの
subagentTypeフィールドは、definitions.tsのsubagentTypeプロパティから読み取られる。
各フェーズの正確な返却値仕様を以下に定義する。

parallel_verificationの4サブフェーズについては、今回の修正により以下の値が確定する。

| フェーズ名 | 修正前の誤った値（CLAUDE.md記載） | 修正後の正確な値（定義実装値） |
|-----------|--------------------------------|------------------------------|
| manual_test | general-purpose（変更なし） | general-purpose（変更なし） |
| security_scan | Bash（誤記） | general-purpose（修正後） |
| performance_test | Bash（誤記） | general-purpose（修正後） |
| e2e_test | Bash（誤記） | general-purpose（修正後） |

返却値の決定ロジックは以下の原則に従う。
definitions.tsのphaseDefinitionsオブジェクトに定義されたsubagentTypeが
APIレスポンスの正規ソースとして機能する。CLAUDE.mdのテーブルは参照ドキュメントであり、
この値を正規ソースと一致させることが今回の修正の核心である。

### phaseGuideオブジェクトの完全仕様

phaseGuideオブジェクトは以下のフィールドで構成される。各フィールドの型と制約を記載する。
phaseフィールドは文字列型であり、フェーズ名（例: security_scan）を保持する。
subagentTypeフィールドは文字列型であり、「general-purpose」・「Bash」・「Explore」の3値をとる。
modelフィールドは文字列型であり、「sonnet」・「haiku」・「opus」の3値をとる。
allowedBashCategoriesフィールドは文字列型の配列であり、許可Bashカテゴリ名を複数格納する。
outputFilesフィールドは文字列型の配列であり、出力ファイルのパスを複数格納する。
inputFilesフィールドは文字列型の配列であり、省略可能な入力ファイルのパスを格納する。

subagentTypeが「general-purpose」の場合、そのフェーズはWrite/Read/Edit等の
ファイル操作ツールと自然言語推論を活用する汎用エージェントとして動作する。
subagentTypeが「Bash」の場合、コマンド実行に特化したエージェントとして動作し、
Markdownファイルの生成には不適切な選択肢となる。この違いが今回の修正の技術的根拠である。

---

## 設定ファイル設計

### CLAUDE.mdのテーブルフォーマット仕様

CLAUDE.md内のフェーズ別subagent設定テーブルは、Markdownのパイプ区切りテーブル形式で記述される。
今回の修正はこのフォーマットに沿ったテーブル値の変更のみを行う。
ルートCLAUDE.md版のテーブルは5列構成であり、フェーズ・subagent_type・model・入力ファイル・出力ファイルとなる。
workflow-plugin/CLAUDE.md版のテーブルは7列構成であり、入力ファイルが全文・サマリー・参照の分類を持つ。

両バージョンのテーブルにおいて、subagent_type列（第2列）の値が今回の修正対象となる。
修正後の整合性確認では、両テーブルの第2列の値が完全に一致していることを検証する。
修正しない行としては、build_check行・testing行・commit行・push行がBashのままであることを確認する。
manual_test行はすでにgeneral-purposeであり、修正前後で変化しないことを合わせて確認する。

### definitions.tsのsubagentTemplateフィールド仕様

workflow-plugin/mcp-server/src/phases/definitions.tsのqualitySectionに追記される
注意書きのフォーマット仕様を定義する。追記箇所は行1087から1102付近の末尾とする。

追記されるテンプレート文字列の構造は3つのパートで構成される。
第1パートとして、「入力ファイルからの語句転記禁止」という見出しのセクションヘッダーを配置する。
第2パートとして、入力ファイルの内容を解釈して言い換えることを要求する原則説明文を記述する。
第3パートとして、3つ以上の具体的な代替表現を箇条書きで提示する言い換え例を列挙する。

この構造により、subagentが各フェーズ実行時にテンプレートを参照した際、
入力ファイル由来の語句をそのまま転記することを防止する効果が期待される。
CLAUDE.mdのテーブル修正（FR-A1/A2）と合わせて実施することで、
ドキュメントと実装の乖離という根本原因と、禁止語転記という副次的問題の双方を解決する。

### 修正対象ファイルの管理設計

3件の修正対象ファイルは以下の管理方針に従う。
ルートCLAUDE.md（C:\ツール\Workflow\CLAUDE.md）はGitリポジトリの管理下にあるルートドキュメントであり、修正後にGit管理される。
workflow-plugin/CLAUDE.md（C:\ツール\Workflow\workflow-plugin\CLAUDE.md）はサブモジュール内のドキュメントであり、サブモジュールのコミットが必要となる。
definitions.ts（workflow-plugin/mcp-server/src/phases/definitions.ts）はビルドが必要なTypeScriptソースファイルであり、修正後にビルドとMCPサーバー再起動が必要となる。

3ファイルのうち、definitions.tsのみがビルドステップを要する。
ビルドが成功した後、実行中のMCPサーバープロセスを再起動することで変更が反映される。
ドキュメントの2ファイルについては即時参照可能な状態になる。
MCPサーバーのモジュールキャッシュにより、ビルド前の再起動は意味を持たないため順序に注意する。
