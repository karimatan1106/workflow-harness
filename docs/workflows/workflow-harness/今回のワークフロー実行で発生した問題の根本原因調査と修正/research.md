# researchフェーズ調査結果 - 今回のワークフロー実行で発生した問題の根本原因調査と修正

## サマリー

本調査は、直近のワークフロー実行（タスク「ワ-クフロ-実行時問題の根本原因修正」）で発生した3つの問題の根本原因を特定し、修正方針を策定することを目的としている。

調査範囲は以下の通りである。
- `workflow-plugin/mcp-server/src/phases/definitions.ts`（testingテンプレート、regression_testテンプレート、test_implテンプレート、docs_updateテンプレート）
- `docs/workflows/ワ-クフロ-実行時問題の根本原因修正/test-design.md`（前回タスクのテスト設計書）
- `docs/workflows/ワ-クフロ-実行時問題の根本原因修正/docs-update-summary.md`（docs_updateフェーズの成果物）

主要な発見事項は以下の3点である。

発見1: testingフェーズのsubagentTemplateに`workflow_capture_baseline`の呼び出し指示が存在しない。`workflow_capture_baseline`への言及はresearchフェーズのchecklistにのみ存在し、testingテンプレートには全く記載がない。これがsubagentがベースライン記録をスキップした直接原因である。

発見2: test_implフェーズのsubagentTemplateが極めて簡素であり、テストファイル（.test.ts）を作成することへの明示的指示がない。テンプレートは「テストコードを実装してください（TDD Red）。」の1行のみで、出力ファイルパスの指定も含まれていない。

発見3: docs_updateフェーズのsubagentTemplateが「ドキュメントを更新してください。」の1行のみであり、更新対象ドキュメントの範囲が不明確である。これにより、docs_updateサブエージェントが「ドキュメント更新」として MEMORY.md を含むあらゆるファイルを更新対象と解釈する可能性がある。

次フェーズ（requirements）では、各問題に対する修正仕様を策定し、definitions.tsへの具体的な変更内容を要件定義書に記載する。


## 問題1の根本原因分析

testingサブエージェントがworkflow_capture_baselineを呼ばない問題の根本原因を分析する。

### CLAUDE.mdの記述

CLAUDE.mdのルール20には以下の記述がある。

「既存テストのベースライン記録義務（regression_test対応）: testingフェーズまでに既存テストスイートを実行し、workflow_capture_baselineで結果を記録すること」

さらに「researchフェーズはphase-edit-guardによりtestingカテゴリ（npm test等）がブロックされるため、テスト実行はtestingフェーズで行うことを標準とする」とも記載されている。

### researchフェーズchecklistの記述

researchフェーズのchecklistには以下の項目が含まれている。

「既存テストスイートを実行してベースラインを記録する作業は testing フェーズで workflow_capture_baseline を呼び出して実施すること（research フェーズは Bash 許可カテゴリが readonly のみのためテスト実行コマンドが使用不可）」

この記述はresearchフェーズのchecklist（行612）に存在するが、testingフェーズのsubagentTemplateには全く存在しない。

### testingテンプレートの実際の内容

testingフェーズのsubagentTemplateの内容（行878）は以下の指示のみを含む。

- 「テストを実行してください。」（作業内容）
- workflow_record_test_result呼び出し時の注意（output形式）
- sessionTokenの取得方法と使用制限
- ワークフロー制御ツール禁止の説明

テンプレートには`workflow_capture_baseline`の呼び出し指示が一切含まれていない。

### 根本原因

根本原因は「testingフェーズのsubagentTemplateにworkflow_capture_baselineの呼び出し指示が存在しないこと」である。

CLAUDE.mdのルール20はOrchestratorが読むドキュメントには記載されているが、testingフェーズのsubagentが実際に受け取るプロンプト（subagentTemplate）には反映されていない。これが「説明とテンプレートの乖離」という構造的な問題である。

subagentTemplateはsubagentが受け取る唯一の指示であり、CLAUDE.mdのルールがsubagentに伝達されるのはOrchestratorがテンプレートに明示的に追記した場合のみである。testingのsubagentはCLAUDE.mdを直接参照せず、subagentTemplateの内容のみに従う。

### 再発リスク

testingフェーズが実行されるたびに同じ問題が発生する。testingのsubagentがworkflow_capture_baselineを呼ばないため、regression_testへの遷移時に「ベースライン未設定エラー」が必ず発生する。修正なしには同じパターンが繰り返される。


## 問題2の根本原因分析

test_implフェーズでテストファイルが作成されない問題の根本原因を分析する。

### test_implテンプレートの実際の内容

test_implフェーズのsubagentTemplate（行782）は以下の内容のみである。

「# test_implフェーズ」「## タスク情報」「## 入力: test-design.md を読み込んでください。」「## 作業内容: テストコードを実装してください（TDD Red）。」

出力ファイルパスの指定が存在しない。他のフェーズ（research, requirements, planning等）のテンプレートには「## 出力: ${docsDir}/xxx.md」というセクションが含まれているが、test_implテンプレートにはこれが欠落している。

### test_implで作成すべきもの

test-design.md（前回タスクのサンプル）を参照すると、test_implフェーズで作成すべきテストケースの一覧が明示されていた。具体的にはTC-FR2-1, TC-FR2-2等のテストケースが列挙されており、それぞれが対象ファイルと確認方法を持っていた。しかしtest-design.mdに記載されたTC-FR2-1等は「Grepツールで確認する手動テスト」であり、実際のTypeScriptテストファイル（.test.ts）ではなかった。

つまり前回のタスクにおいて、test-design.mdはコード実装ではなく手動確認手順を定義していた。test_implのsubagentが「テストコードを実装してください（TDD Red）。」という指示を受けても、test-design.mdが手動確認手順のみを記載していれば、subagentは何もコードを作成できない状態になる。

### 根本原因（二重構造）

根本原因は二重構造を持っている。

第一の原因: test_implのsubagentTemplateに「出力ファイルパス」が指定されていない。他のフェーズと異なり、何のファイルを作成すべきかの指示がない。subagentは「テストコードを実装してください」という曖昧な指示だけを受けており、具体的なファイルパスを自分で判断する必要がある。

第二の原因: test-design.mdが手動確認手順を記述している場合、test_implフェーズで作成すべき.test.tsファイルの内容が不明確になる。test_designが「このファイルにこのようなテストを書け」という形式ではなく「このGrepコマンドで確認せよ」という形式だと、test_implのsubagentは具体的なテストコードの書き方を判断できない。

第三の問題: test_implフェーズの許可ファイルタイプは`.test.ts, .test.tsx, .spec.ts, .spec.tsx, .md`であるが、このプロジェクトではvitest形式のテストファイルは`workflow-plugin/mcp-server/src/tests/`に存在する。subagentが適切なテストディレクトリを認識していない。

### 前回タスクでの実際の流れ

前回のtest_implフェーズ実行後にimplementationへ進んだという事実から、test_implはエラーなく完了したと考えられる。これはtest_implのsubagentが「作業内容: テストコードを実装してください（TDD Red）。」という指示を受け、test-design.mdを読んだ後に「手動確認手順が記述されているため、実装フェーズで確認すれば十分」と判断した可能性が高い。test_implのvalidationが実装されておらず、テストファイルの出力が必須とされていないことも要因である。


## 問題3の根本原因分析

docs_update subagentがMEMORY.mdに直接知見を追記した問題の根本原因を分析する。

### docs_updateテンプレートの実際の内容

docs_updateフェーズのsubagentTemplate（行953）は以下の内容のみである。

「# docs_updateフェーズ」「## タスク情報: ユーザーの意図: ${userIntent}、出力先: ${docsDir}/」「## 作業内容: ドキュメントを更新してください。」

このテンプレートは編集対象として`docs/workflows/{taskName}/`のみを出力先として明示しているが、「ドキュメントを更新してください」という曖昧な指示が含まれている。

### 更新可能なファイルタイプ

docs_updateフェーズのeditableFileTypesは`.md, .mdx`であり、これは`.md`ファイル全体に対する編集を許可する。CLAUDE.mdの「フェーズごとの編集可能ファイル」表でも`docs_update`は`.md, .mdx`のみが編集可能とある。

phase-edit-guardはファイルタイプ（拡張子）のみを検証しており、ファイルの具体的なパスが`docs/workflows/`外であっても`.md`拡張子であれば編集を許可する。

### MEMORY.mdの配置

MEMORY.mdのパスは`C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md`であり、プロジェクトのワーキングディレクトリ（`C:\ツール\Workflow\`）の外に存在する。しかしこのファイルはシステムプロンプト（system-reminder）として毎回AIに注入されており、AIがこのファイルの存在と目的を認識している。

### 根本原因

docs_updateのsubagentTemplateが「ドキュメントを更新してください」という極めて曖昧な指示しか持っていない。subagentがどのドキュメントを更新すべきかを判断するために、userIntentとシステムプロンプトから情報を取得した結果、MEMORY.mdを「更新すべきドキュメント」として解釈した可能性がある。

CLAUDE.mdには「docs_update: 更新された仕様書（docs/spec/）、更新されたREADME（必要に応じて）、変更履歴（CHANGELOG.md など）」という説明があるが、これはsubagentTemplateには反映されていない。

また、MEMORY.mdへの追記がなぜ問題なのかという判断基準もsubagentTemplateに存在しない。MEMORY.mdはシステムプロンプトとしてsubagentに提示されており、subagentがこのファイルを「ワークフローに関する永続的な知見を記録するファイル」として認識していた可能性が高い。

### 「役割逸脱」かどうかの判断

docs_updateフェーズの目的は「実装・テスト完了後にドキュメントを更新する」ことである。MEMORY.mdへの追記がdocs_updateの目的から逸脱しているかどうかについては、以下の観点から評価する。

CLAUDE.mdでのdocs_updateの成果物定義は「更新された仕様書（docs/spec/）」「更新されたREADME」「変更履歴（CHANGELOG.md等）」であり、MEMORY.mdは含まれていない。この観点では逸脱と評価できる。

一方、MEMORY.md自体は「ワークフロー実行に関する知見の永続保存場所」であり、ワークフロータスク完了後の知見追記は実用的観点から有益である。しかし、これはdocs_updateフェーズの意図した動作ではない。

根本原因は「docs_updateテンプレートが更新対象ドキュメントの範囲を明示していないこと」であり、これにより想定外のファイルが更新対象となるリスクが存在する。


## 調査で発見した追加問題

### 追加問題A: test_implテンプレートに出力ファイル指定がない

test_implテンプレートは他のフェーズテンプレートと異なり、出力ファイルのパス指定（`## 出力`セクション）が存在しない。これはtest_implがworkflow_record_testを呼び出して記録する仕組みであるが（workflow_record_testツール）、subagentが作成すべきテストファイルの具体的なパスを知る手段がない。

### 追加問題B: testingテンプレートにworkflow_capture_baselineの呼び出し義務がない

この問題は問題1と同一だが、追加問題として記録する価値がある。testingフェーズのchecklistは存在しないため（実装されていない）、subagentがworkflow_capture_baselineを呼ぶ機会がない。CLAUDE.mdのルール20はOrchestratorへの指示であり、subagentへの指示ではない。

### 追加問題C: docs_updateテンプレートが最も簡素なテンプレートになっている

全フェーズのsubagentTemplateを比較すると、docs_updateのテンプレートが最も少ない情報しか持っていない（「ドキュメントを更新してください。」の1行）。他のフェーズ（testing, regression_test等）には詳細なガイダンスが含まれているが、docs_updateには何も存在しない。これは今後もsubagentの誤動作リスクを高める構造的問題である。

### 追加問題D: テスト設計書が「手動確認手順」として作成された場合のtest_implフェーズの機能不全

前回のtest-design.mdは「GrepツールでGrep検索して確認する」という手動確認手順を定義していた。このような設計書に対してtest_implが「テストコードを実装してください（TDD Red）。」という指示を受けると、機能不全に陥る可能性がある。


## 修正方針サマリー

### 問題1への修正方針

testingフェーズのsubagentTemplateに`workflow_capture_baseline`の呼び出し手順を追加する。具体的には以下の指示を含める必要がある。

- テスト実行前にベースライン記録が必要なこと
- `workflow_capture_baseline`ツールの呼び出し方法（totalTests, passedTests, failedTestsパラメータの指定方法）
- ベースライン記録のタイミング（テスト実行後）

### 問題2への修正方針

test_implフェーズのsubagentTemplateに以下の改善を加える。

- 出力ファイルパスの明示的指定（`## 出力`セクションの追加）
- test-design.mdに記載されたテストケースをどのように実装するかの具体的指示
- 作成したテストファイルをworkflow_record_testで登録する手順の追加

ただし、test-design.mdが手動確認手順を定義している場合は問題の性質が異なる（planning/test_designフェーズの問題）ため、test_implテンプレートの修正だけでは不十分かもしれない。

### 問題3への修正方針

docs_updateフェーズのsubagentTemplateに更新対象の明確な定義を追加する。

- 更新対象ドキュメントの列挙（docs/spec/, docs/operations/, CHANGELOG.md, README.md等）
- MEMORY.mdは更新対象に含まれないという明示的な記述
- docs/workflows/（一時的作業フォルダ）の成果物は永続仕様書（docs/spec/）に反映すること

### 優先度の評価

問題1（workflow_capture_baselineの未呼び出し）は毎回のworkflow実行で確実に再現する高確率の問題であり、修正優先度が最も高い。問題3（docs_update）はMEMORY.mdへの追記という副作用を持つが、機能的な問題は小さい。問題2（test_implのテストファイル未作成）はTDDサイクルを機能不全にする重大な問題であるが、タスクの性質（コード変更の有無）によって影響度が変わる。
