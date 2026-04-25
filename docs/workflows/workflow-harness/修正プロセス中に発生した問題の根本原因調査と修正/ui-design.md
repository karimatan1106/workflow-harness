## サマリー

- 目的: FR-1（CLAUDE.md厳命23番のsessionToken二層構造化）、FR-2（manual_testテンプレートへの前提条件行一意化ガイダンス追加）、FR-3（e2e_testテンプレートへの同等ガイダンス追加）に対応するインターフェース・設計を定義する。
- 評価スコープ: MCPサーバーツール群（workflow_status, workflow_next, workflow_complete_sub等）のsessionToken引数設計、definitions.tsテンプレート文字列の追記位置・内容、CLAUDE.md厳命23番の記述構造。
- 主要な決定事項: OrchestratorはsessionTokenを自身が呼び出す全MCPツールに渡す（層1）。subagentへの引き渡しはworkflow_record_test_result目的に限定する（層2）。テンプレート追記によるガイダンス提供はコード変更なしの文字列追記のみで実現する。
- 検証状況: 実装フェーズ後にnpm run buildのコンパイル成功確認とnpx vitestによる全合格確認が必要。
- 次フェーズで必要な情報: CLAUDE.md厳命23番の変更前後の正確なテキスト、definitions.tsのFR-2追記位置（MT-4行の直後）、definitions.tsのFR-3追記位置（辞書キー名説明行の直後）。

---

## CLIインターフェース設計

このプロジェクトはGUI画面を持たないMCPサーバーベースのCLIツールであり、UI設計はMCPツールのインターフェース仕様を意味する。

### workflow_status ツールのインターフェース（sessionToken取得）

workflow_statusツールはsessionTokenを取得するための主要な手段である。
呼び出しモードは2種類存在し、モードによりレスポンス内容が異なる。

全タスク一覧モードは引数を省略して呼び出す形式であり、sessionTokenが含まれないレスポンスを返す。
単一タスク詳細モードはtaskIdを引数として指定して呼び出す形式であり、レスポンスにsessionTokenが含まれる。

Orchestratorはセッション再開直後に必ずtaskId指定で workflow_status を呼び出し、sessionTokenを再取得することが必須要件である。
取得したsessionTokenはOrchestratorのメモリ内に保持し、以降のMCPツール呼び出し時に引数として渡す。

### Orchestratorが直接呼び出すMCPツール群（層1対象）

以下のツールはOrchestrator自身が直接呼び出す際にsessionTokenを引数に含めるべき対象である。

- workflow_next: 次フェーズへの遷移を実行するツールであり、sessionTokenを渡すことで認証済みの遷移が可能になる。
- workflow_complete_sub: 並列フェーズのサブフェーズ完了宣言ツールであり、sessionTokenが必要となる。
- workflow_approve: requirementsやdesign_review等のレビューフェーズでユーザー承認を記録するツールであり、sessionTokenを渡すべきである。
- workflow_set_scope: タスクの影響範囲を設定するツールであり、researchフェーズでsessionTokenとともに呼び出す。
- workflow_back: フェーズを過去に差し戻すツールであり、sessionTokenを渡すことで認証された差し戻しが可能になる。
- workflow_record_feedback: ユーザーフィードバックを記録するツールであり、sessionTokenを引数に含める。
- workflow_reset: タスクをresearchフェーズにリセットするツールであり、sessionTokenを渡すべきである。

### subagentへのsessionToken引き渡し設計（層2）

Orchestratorがsubagentを起動する際のsessionToken引き渡し設計は以下の原則に従う。

subagentへsessionTokenを渡してよい対象はtestingフェーズとregression_testフェーズのsubagentのみである。
これらのsubagentは workflow_record_test_result を呼び出す目的でsessionTokenを必要とする。
subagentへの引き渡しはTaskツールのプロンプト引数内に「sessionToken: xxxx」の形式で埋め込む方式を採用する。

それ以外のフェーズ（research, requirements, planning等）のsubagentにはsessionTokenを引き渡さない。
これらのsubagentは workflow_record_test_result を呼び出す必要がないため、sessionTokenは不要である。

---

## エラーメッセージ設計

各エラー種別に対して、ユーザーに提示すべきメッセージと対処方法を定義する。

### sessionToken未取得時のエラーメッセージ

Orchestratorがsessiontoken未取得の状態でworkflow_nextを呼び出した場合、MCPサーバーは認証失敗エラーを返す可能性がある。
エラーメッセージ例: 「sessionToken is required for this operation. Call workflow_status with taskId to retrieve it.」
対処方法: workflow_status を taskId 指定で呼び出し、レスポンスからsessionTokenを取得してから再度呼び出すこと。

### 全タスク一覧モードでsessionToken取得を試みた場合のエラー

全タスク一覧モード（taskId未指定）でworkflow_statusを呼び出してもsessionTokenは返されない。
この設計はCLAUDE.mdの厳命23番（FR-1修正後）に明記されており、開発者が誤って全タスク一覧モードを使用した場合に気付けるように設計されている。
対処方法: 必ず taskId を指定して workflow_status を呼び出すことで正しくsessionTokenを取得できる。

### 前提条件行重複エラー（manual_test・e2e_test成果物）

artifact-validatorが前提条件行の重複を検出した場合のエラーメッセージ例: 「Duplicate lines detected: '- 前提条件: MCPサーバーが起動していること' appears 3 or more times.」
対処方法: FR-22/FR-23ガイダンスに従い、TC番号またはシナリオ番号を行末に付加して各行を一意化すること。
50文字を超える前提条件テキストはルール8の除外対象にならないため、3件以上の同一行が存在するとエラーになる点に注意が必要である。

### definitions.tsのビルドエラー

テンプレート文字列の追記時にシングルクォートのエスケープが漏れた場合はコンパイルエラーが発生する。
エラーメッセージ例: 「SyntaxError: Unexpected token 'text'」のようなJavaScript構文エラーが出力される。
対処方法: 追記するテキスト内にシングルクォートが含まれていないことを事前確認し、改行は全て `\n` でエスケープすること。

---

## APIレスポンス設計

MCPツールのレスポンス形式のうち、FR-1の二層構造設計に関連する部分を定義する。

### workflow_status のレスポンス仕様（モード別）

workflow_statusは呼び出しモードによってレスポンス構造が異なる設計を採用する。
この差異はFR-1の「取得先はtaskId指定のworkflow_statusのみ」という要件を技術的に実現するものである。

全タスク一覧モード（taskId省略）のレスポンスには sessionToken フィールドが含まれない。
このレスポンスにはtasks配列と各タスクのid・name・phaseが含まれるが、セキュリティ上の観点からsessionTokenは除外される。
全タスク一覧モードは複数タスクの俯瞰確認に使用するものであり、sessionToken取得には使用できない。

単一タスク詳細モード（taskId指定）のレスポンスにはsessionTokenフィールドが含まれる。
このレスポンスにはtaskId・taskName・currentPhase・sessionTokenが含まれ、Orchestratorはこれを利用してsessionTokenを取得する。
セッション再開時や会話中断後の再開時に必ずこのモードで呼び出すことで、OrchestratorのsessionToken保持状態を確実に回復できる。

### workflow_next のレスポンス仕様（sessionToken受け取り時）

sessionTokenを引数として受け取ったworkflow_nextは、認証済みの状態でフェーズ遷移を実行する。
レスポンスにはnextPhase・phaseGuide・subagentTemplateが含まれ、Orchestratorが次フェーズのsubagentを起動するための情報を提供する。
subagentTemplateはOrchestratorが次フェーズのTaskプロンプトの本体として使用するテンプレートであり、省略・改変せずにそのまま使用することが必須である。

### artifact-validator の重複行検出レスポンス

artifact-validatorが重複行を検出した場合、workflow_next または workflow_complete_sub のレスポンスにエラーが含まれる。
エラーレスポンスのformatは「artifact validation failed: duplicate line detected」のメッセージと、重複している行のテキストと出現回数が含まれる。
Orchestratorはこのエラーを受信した場合、FR-22/FR-23ガイダンスを含むリトライプロンプトでsubagentを再起動することが義務付けられている。

---

## 設定ファイル設計

FR-1・FR-2・FR-3の修正対象ファイルの設計構造を定義する。

### CLAUDE.md 厳命23番の記述構造（FR-1修正後）

CLAUDE.mdの厳命23番はOrchestratorのsessionToken取得・使用に関するルールを定めるセクションである。
FR-1修正後の厳命23番は末尾に二層構造の箇条書きを持つ設計となる。

層1はOrchestrator自身がMCPツールを直接呼び出す場合の規則を定める。
sessionTokenを所持している場合、workflow_next・workflow_complete_sub・workflow_approve等の全MCPワークフローツール呼び出し時に引数として渡すことが必須である。
この規則はOrchestratorが認証済みの操作を確実に実行するための設計である。

層2はsubagentへのsessionToken引き渡しに関する規則を定める。
subagentへのsessionToken引き渡しはworkflow_record_test_resultを呼び出す目的に限定される。
testingフェーズとregression_testフェーズのsubagentのみが対象であり、他のフェーズのsubagentには渡さない設計である。

取得先に関する規則として、taskId指定でworkflow_statusを呼び出すことでsessionTokenを再取得できることが明記される。
全タスク一覧モード（taskId未指定）では sessionToken が返されないため、taskId指定が必須であることが強調される。

### definitions.ts テンプレート追記位置設計（FR-2: manual_test）

manual_testのsubagentTemplateは複数のガイダンスセクションが `\n##` 区切りで連結された文字列構造を持つ。
FR-2の追記位置は「MT-4 実行環境」の環境情報一意化ガイダンス行の末尾直後であり、総合評価セクション指針の直前である。
この位置を選択した理由は、既存の実行環境一意化ガイダンス（FR-1相当）と前提条件一意化ガイダンス（FR-22）を連続したセクションにまとめることで、subagentが参照しやすい構造にするためである。

追記するセクション名は「## 前提条件行の一意化（FR-22: 重複行防止）」であり、TCという略語を用いた具体的なガイダンス本文が続く。
ガイダンス本文には問題パターン・推奨パターン1（TC番号付加）・推奨パターン2（状態差異明示）の3種類の例示が含まれる。
操作手順ステップの一意化ガイダンスも同セクションに含め、テスト文書全体での重複行防止を網羅する。

### definitions.ts テンプレート追記位置設計（FR-3: e2e_test）

e2e_testのsubagentTemplateは角括弧禁止ガイダンス（FR-3）の後に総合評価セクション指針（FR-C2）が続く構造を持つ。
FR-3の追記位置は角括弧禁止ガイダンスの末尾直後・総合評価セクション指針の直前である。
この配置により、角括弧に関連する注意事項と前提条件行の一意化注意事項が近接したセクションにまとまり、subagentが参照しやすい構造になる。

追記するセクション名は「## 前提条件行の一意化（FR-23: 重複行防止）」であり、SCという略語を用いたE2E文脈の具体例が続く。
E2Eテスト特有のブラウザ起動状態・ヘッドレスモード・認証セッション引き継ぎ等の状態差異を用いた例示により、E2Eシナリオに即した一意化方法をsubagentに示す。
ブラウザ起動コマンドやURLナビゲーションステップが複数シナリオで共通になる場合の対処も同セクションに含め、E2Eテスト文書全体での重複行防止を網羅する。
