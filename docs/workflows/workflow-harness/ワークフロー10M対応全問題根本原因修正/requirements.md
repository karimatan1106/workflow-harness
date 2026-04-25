# 要件定義書: ワークフロー10M対応全問題根本原因修正

## サマリー

本ドキュメントは、レビューで特定された13件の問題に対する修正要件を定義する。
修正対象はworkflow-pluginの構造的欠陥3点（Hook-MCP間の状態同期欠如、セキュリティ過剰適用、スケーラビリティ未考慮）に分類される。
優先度はP0（即座に修正すべき問題）3件、P1（次に修正すべき問題）4件、P2（改善として対応する問題）4件、CLAUDE.md修正2件である。
コード変更を伴う修正は11件であり、CLAUDE.mdの記述修正のみで対応する問題は2件である。

P0修正としてtask-index.jsonデュアルスキーマ競合の解消、O(n)フック性能の改善、Fail-Closed過剰ブロックの緩和を行う。
P1修正としてbash-whitelistバイパス対策、バリデーションタイムアウト追加、HMAC鍵管理改善、userIntent更新ツール追加を実施する。
P2修正としてASTキャッシュLRU化、並列フェーズ依存関係強化、スコープ検証改善、TOCTOU修正を実施する。
CLAUDE.md修正としてsubagentコンテキスト断絶の緩和、小規模タスク19フェーズオーバーヘッド解消のガイダンス修正を行う。

修正範囲はhooks/配下4ファイル、mcp-server/src/配下8ファイル、CLAUDE.md 1ファイルの計13ファイルである。
全修正の受入基準として既存772テスト全件成功を維持し、新規追加テストも全件成功することを求める。
本要件定義に基づき、次フェーズ（parallel_analysis）で脅威モデリングと実装計画を策定する。

## 機能要件

### REQ-1: task-index.jsonデュアルスキーマ競合の解消（P0）

#### 目的と背景
Hook側とMCP server側がtask-index.jsonに対して異なるスキーマを使用しており、状態不整合が発生している。
現在のtask-index.jsonにはHookスキーマ`{tasks: [...], updatedAt}`とMCPスキーマ`{taskId: relativePath}`が混在する。
前回修正REQ-1でsaveTaskIndex()をno-opにした結果、新タスクがtasks配列に追加されなくなるリグレッションが発生した。
新タスク開始時にtasks配列が更新されないため、フックが旧タスクにフォールバックし全操作がブロックされる事態が確認されている。

#### 修正対象ファイル
- `mcp-server/src/state/manager.ts`（saveTaskIndex()関数）
- `mcp-server/src/tools/start.ts`（workflow_start実装）
- `mcp-server/src/tools/next.ts`（workflow_next実装）
- `hooks/lib/discover-tasks.js`（readTaskIndexCache()関数）

#### 入力条件
- workflow_start時にタスクIDとタスク名が指定される
- workflow_next時にタスクIDとフェーズ遷移が実行される
- hooks側でtask-index.jsonが読み込まれる

#### 期待される出力と動作
saveTaskIndex()はHookスキーマ`{tasks: [...], updatedAt}`に統一して書き込みを行う必要がある。
tasks配列の各要素は`{id: string, name: string, workflowDir: string, phase: string, updatedAt: number}`の形式とする。
workflow_start実行時に新タスクがtasks配列に追加され、ファイルに永続化される。
workflow_next実行時にアクティブタスクのphaseフィールドが更新され、updatedAtが現在時刻に更新される。
hooks側のreadTaskIndexCache()は更新されたtasks配列を正しく読み込み、最新のタスク情報を返却する。

#### 受入基準
- 新タスク開始後にtask-index.json内のtasks配列に新エントリが追加されること
- フェーズ遷移後にtasks配列内の該当タスクのphaseフィールドが正しく更新されること
- task-index.json内にMCPスキーマ`{taskId: relativePath}`形式のフィールドが存在しないこと
- hooks側のdiscoverTasks()が更新されたtask-index.jsonを正しく読み込むこと
- 既存の772テスト全件が成功すること

#### テスト観点
saveTaskIndex()の書き込み内容がHookスキーマに準拠していることを検証する単体テストを追加する。
workflow_start実行後にtask-index.jsonを読み込み、tasks配列に新エントリが存在することを確認する統合テストを追加する。
workflow_next実行後にphaseフィールドが更新されていることを確認する統合テストを追加する。
hooks/lib/discover-tasks.test.jsに新スキーマでの読み込み成功ケースを追加する。

### REQ-2: O(n)フック性能問題の改善（P0）

#### 目的と背景
現在のdiscoverTasks()関数は全タスクディレクトリをスキャンし、全タスクに対してHMAC検証を実行する。
タスク数がnの場合、フック実行時間はO(n)であり、10Mステッププログラム開発では数百タスクが蓄積し性能劣化が顕著になる。
毎回のファイル編集で数百ms-数秒のオーバーヘッドが発生し、開発体験が著しく損なわれる。
アクティブタスク以外のHMAC検証は不要であり、完了済みタスクのスキャンも省略可能である。

#### 修正対象ファイル
- `hooks/lib/discover-tasks.js`（discoverTasks()関数）
- `hooks/enforce-workflow.js`（HMAC検証ループ）
- `mcp-server/src/state/manager.ts`（アクティブタスク情報の提供）

#### 入力条件
- フック実行時にSTATE_DIR配下に複数のタスクディレクトリが存在する
- task-index.jsonにアクティブタスクと完了タスクの情報が含まれる
- アクティブタスクのworkflow-state.jsonにstateIntegrity HMACが含まれる

#### 期待される出力と動作
discoverTasks()はtask-index.jsonからアクティブタスク情報を取得し、アクティブタスクのディレクトリのみを読み込む。
完了済みタスク（phase: 'completed'）のディレクトリスキャンはスキップされる。
enforce-workflow.jsのHMAC検証ループはアクティブタスクのworkflow-state.jsonのみを検証する。
フック実行時間はタスク総数に依存せず、定数時間O(1)で完了する。

#### 受入基準
- task-index.jsonに100個のタスクが登録されている環境でフック実行時間が100ms以下であること
- アクティブタスクのHMAC検証は必ず実行されること
- 完了タスクのディレクトリがスキャンされないことをログまたはテストで確認できること
- 既存の772テスト全件が成功すること

#### テスト観点
100個のダミータスクを作成し、その中に1個のアクティブタスクを配置して性能を計測する統合テストを追加する。
完了タスクのディレクトリがスキャンされないことを確認するモックテストをhooks/lib/discover-tasks.test.jsに追加する。
アクティブタスクのHMAC検証が確実に実行されることを確認する既存テストが維持されることを確認する。

### REQ-3: Fail-Closed過剰ブロックの緩和（P0）

#### 目的と背景
現在の全フックはuncaughtExceptionを捕捉し、無条件でexit(2)を返す。
exit(2)はClaude Codeに「操作をブロック」と伝えるシグナルであり、一時的なI/Oエラーや環境問題でも全操作がブロックされる。
セキュリティ違反（HMAC不正、フェーズ違反）と一時的エラー（ファイルI/Oタイムアウト、JSON解析エラー）を区別する必要がある。
10Mステッププログラム開発では数千時間の開発中に一時的なエラーが必然的に発生し、その都度開発が停止する問題が発生している。

#### 修正対象ファイル
- `hooks/enforce-workflow.js`（uncaughtExceptionハンドラ）
- `hooks/phase-edit-guard.js`（uncaughtExceptionハンドラ）

#### 入力条件
- フック実行中にuncaughtExceptionが発生する
- エラーがセキュリティ違反（HMAC不正、フェーズ違反）または一時的エラー（I/Oエラー、タイムアウト）のいずれかである
- 環境変数WORKFLOW_FAIL_MODEがstrict/permissive/undefinedのいずれかの値を持つ

#### 期待される出力と動作
エラーカテゴリ分類ロジックを導入し、エラー種別を判定する。
セキュリティ違反エラー（HMACValidationError、PhaseViolationError等）はexit(2)でブロックする。
一時的エラー（ENOENT、ETIMEDOUT、SyntaxError等）はexit(0)で許可し、stderr+ログに警告を出力する。
環境変数WORKFLOW_FAIL_MODE=strictの場合は全エラーでexit(2)（従来動作）を維持する。
環境変数WORKFLOW_FAIL_MODE=permissiveの場合は一時的エラーでexit(0)を返す。
環境変数未設定時のデフォルトはpermissiveとする。

#### 受入基準
- セキュリティ違反エラー発生時はWORKFLOW_FAIL_MODEに関わらずexit(2)が返ること
- 一時的エラー発生時にWORKFLOW_FAIL_MODE=permissiveならexit(0)が返ること
- 一時的エラー発生時にWORKFLOW_FAIL_MODE=strictならexit(2)が返ること
- 一時的エラー発生時にstderr+ログファイルに警告が記録されること
- 既存の772テスト全件が成功すること（環境変数なしでpermissiveモードとして動作）

#### テスト観点
モックでセキュリティ違反エラーを発生させ、exit(2)が返ることを確認するテストを追加する。
モックで一時的エラー（EACCESなど）を発生させ、permissiveモードでexit(0)が返ることを確認するテストを追加する。
環境変数WORKFLOW_FAIL_MODE=strictでの動作テストを追加する。

### REQ-4: bash-whitelistバイパスベクターの対策（P1）

#### 目的と背景
現在のphase-edit-guard.jsのBashコマンド検証は正規表現ベースであり、シェル構文解析を行っていない。
変数展開($VAR)、プロセス置換(<())、バッククォート置換、ブレース展開などの高度なシェル機能を考慮していない。
splitCompoundCommand()はサブシェル`()`やコマンド置換`$()`内の区切り文字を認識せず、バイパスの可能性がある。
完全なシェルパーサー実装は困難だが、既知のバイパスパターンをブロックする防御層を追加する必要がある。

#### 修正対象ファイル
- `hooks/phase-edit-guard.js`（splitCompoundCommand()関数、FILE_MODIFYING_COMMANDSパターン）

#### 入力条件
- Bashツール呼び出し時にcommandパラメータとして任意のシェルコマンド文字列が渡される
- コマンド文字列に変数展開、プロセス置換、サブシェル、コマンド置換が含まれる可能性がある

#### 期待される出力と動作
変数展開+リダイレクトのパターン（例: `$VAR > file`）を検出しブロックする。
プロセス置換パターン（例: `<(command)`、`>(command)`）を検出しブロックする。
バッククォート置換パターン（例: \`command\`）を検出しブロックする。
ブレース展開パターン（例: `{a,b,c}`）でファイル作成コマンドが含まれる場合はブロックする。
splitCompoundCommand()を改善し、サブシェル・コマンド置換内の区切り文字を無視するロジックを追加する。
検出されたパターンに該当する場合はexit(2)でブロックし、具体的なパターン名をstderrに出力する。

#### 受入基準
- 変数展開+リダイレクトのコマンドがブロックされること（例: `VAR=foo && echo $VAR > file`）
- プロセス置換のコマンドがブロックされること（例: `cat <(echo foo)`）
- バッククォート置換のコマンドがブロックされること（例: \`echo foo\`）
- サブシェル内のセミコロンが外側の区切りとして誤認識されないこと（例: `(cd foo; ls) && pwd`）
- 既存の772テスト全件が成功すること

#### テスト観点
変数展開+リダイレクトのバイパスケースをhooks/phase-edit-guard.test.jsに追加する。
プロセス置換のバイパスケースをテストに追加する。
サブシェル内のセミコロン誤認識がないことを確認するテストケースを追加する。

### REQ-5: バリデーションタイムアウトの追加（P1）

#### 目的と背景
MCP server側のartifact-validator.tsとsemantic-checker.tsにタイムアウトが設定されていない。
大規模な成果物ファイル（数千行）のセマンティックチェックやn-gram計算が無限に実行される可能性がある。
Hook側にはstdinタイムアウト（3秒）があるが、MCP server側のバリデーション処理は無制限である。
10Mステッププログラム開発では数千行の設計書が生成される可能性があり、バリデーション時間が無制限に延びる問題がある。

#### 修正対象ファイル
- `mcp-server/src/validation/artifact-validator.ts`（validateArtifactQuality()関数）
- `mcp-server/src/validation/semantic-checker.ts`（checkSemanticQuality()関数）

#### 入力条件
- validateArtifactQuality()またはcheckSemanticQuality()に大規模な成果物ファイルパスが渡される
- バリデーション処理が10秒を超える可能性がある

#### 期待される出力と動作
validateArtifactQuality()をPromise.race()でラップし、10秒のタイムアウトを設定する。
checkSemanticQuality()のn-gram計算にも同様に10秒タイムアウトを設定する。
タイムアウト発生時はTimeoutErrorをthrowせず、警告ログを出力してバリデーション成功（fail-open）を返す。
バリデーション成功の戻り値に`timedOut: true`フラグを含めることで、呼び出し側でタイムアウト発生を検知可能にする。

#### 受入基準
- validateArtifactQuality()が10秒以内に完了しない場合、タイムアウトして成功を返すこと
- タイムアウト発生時に警告ログが出力されること
- タイムアウト発生時の戻り値に`timedOut: true`フラグが含まれること
- 通常サイズの成果物では10秒以内に完了し、タイムアウトが発生しないこと
- 既存の772テスト全件が成功すること

#### テスト観点
モックで処理時間が10秒を超えるバリデーションケースを作成し、タイムアウトが機能することを確認するテストを追加する。
タイムアウト時の戻り値に`timedOut: true`が含まれることを確認するテストを追加する。
通常ケースでタイムアウトが発生しないことを確認する既存テストが維持されることを確認する。

### REQ-6: HMAC鍵管理の改善（P1）

#### 目的と背景
現在のHMAC鍵には有効期限が設定されておらず、一度生成された鍵は永続的に有効である。
鍵の失効メカニズムもなく、鍵漏洩時に攻撃者が任意のワークフロー状態を偽造できるリスクがある。
鍵のローテーション機能もなく、同じ鍵が全期間使用され続ける。
長期運用される10Mステッププログラム開発プロジェクトでは、定期的な鍵ローテーションが必要である。

#### 修正対象ファイル
- `mcp-server/src/security/hmac.ts`（鍵生成・検証ロジック）
- `mcp-server/src/state/manager.ts`（鍵ローテーショントリガー）

#### 入力条件
- HMAC鍵が生成される際に現在時刻が取得可能である
- 鍵検証時に鍵の有効期限チェックが実行される
- 鍵ローテーション処理が定期的にトリガーされる

#### 期待される出力と動作
鍵生成時にcreatedAtフィールド（UNIX timestamp）を追加する。
鍵生成時にexpiresAtフィールドを追加し、createdAt + 30日の値を設定する。
鍵検証時にcurrent time < expiresAtを確認し、期限切れの鍵は検証失敗とする。
ただし、猶予期間（7日間）内の古い鍵での署名も受け入れる（新旧両方の鍵で検証を試みる）。
MCP server起動時に最新鍵の有効期限をチェックし、残り7日未満なら新鍵を自動生成する。
新鍵生成後も旧鍵は猶予期間（7日間）は保持され、その後削除される。

#### 受入基準
- 新規生成された鍵にcreatedAtとexpiresAtフィールドが含まれること
- expiresAtがcreatedAt + 30日（ミリ秒単位）に設定されていること
- 期限切れ鍵での検証が失敗すること（猶予期間外の場合）
- 猶予期間内の旧鍵での検証が成功すること
- MCP server起動時に鍵の有効期限が7日未満の場合、新鍵が自動生成されること
- 既存の772テスト全件が成功すること

#### テスト観点
鍵生成時にcreatedAt/expiresAtが正しく設定されることを確認する単体テストを追加する。
期限切れ鍵での検証失敗を確認する単体テストを追加する。
猶予期間内の旧鍵での検証成功を確認する単体テストを追加する。
鍵ローテーションロジックの統合テストを追加する。

### REQ-7: userIntent更新ツールの追加（P1）

#### 目的と背景
現在のuserIntentはworkflow_start時にのみ設定され、以降のフェーズで更新するAPIが提供されていない。
10Mステッププログラムでは開発中に要件が変化することが一般的であり、固定されたuserIntentはcalculatePhaseSkips()の判定精度を劣化させる。
例えば「テスト修正」で開始したタスクが途中で「リファクタリング」に拡大しても、フェーズスキップ判定は初期意図に基づいて行われる問題がある。
requirementsフェーズ以降でuserIntentを更新可能にし、より正確なフェーズスキップ判定を実現する必要がある。

#### 修正対象ファイル
- `mcp-server/src/tools/update-intent.ts`（新規ファイル）
- `mcp-server/src/state/manager.ts`（intentHistory管理）
- `mcp-server/src/index.ts`（ツール登録）

#### 入力条件
- workflow_update_intentツールにtaskIdとnewIntentパラメータが渡される
- 現在のフェーズがrequirements以降である（research/idleフェーズでは更新不可）
- newIntentは10000文字以内の文字列である

#### 期待される出力と動作
workflow_update_intentツールを新設し、taskIdとnewIntentを受け取る。
現在のuserIntentをintentHistory配列に保存してから、newIntentで上書きする。
intentHistoryの各エントリは`{intent: string, phase: string, updatedAt: number}`の形式とする。
フェーズがresearch/idleの場合はエラーを返し、requirements以降でのみ更新を許可する。
更新後のuserIntentはcalculatePhaseSkips()で使用され、より正確なフェーズスキップ判定が行われる。

#### 受入基準
- workflow_update_intentツールがworkflow_start後に呼び出し可能であること
- requirementsフェーズ以降でuserIntent更新が成功すること
- research/idleフェーズでの更新試行がエラーを返すこと
- intentHistory配列に過去のuserIntentが記録されること
- 更新後のuserIntentがcalculatePhaseSkips()で使用されること
- 既存の772テスト全件が成功すること

#### テスト観点
workflow_update_intentの正常系テストを追加する（requirementsフェーズでの更新成功）。
異常系テストを追加する（researchフェーズでの更新失敗、10000文字超過）。
intentHistory記録の単体テストを追加する。

### REQ-8: ASTキャッシュのLRU化（P2）

#### 目的と背景
設計整合性検証で使用されるMermaid ASTのキャッシュにサイズ制限やLRU evictionポリシーがない。
タスクが増えるたびにキャッシュが成長し、MCPサーバーのメモリ消費が増加する。
完了タスクのキャッシュが破棄されないため、長期運用でメモリリークが発生する可能性がある。
10Mステッププログラム開発では数百タスクが実行されるため、キャッシュ成長を制限する必要がある。

#### 修正対象ファイル
- `mcp-server/src/validation/design-validator.ts`（ASTキャッシュ実装）

#### 入力条件
- design-validator.tsがMermaid図ファイルを解析し、ASTキャッシュに保存する
- タスク完了時にキャッシュエントリを削除するトリガーが実行される

#### 期待される出力と動作
ASTキャッシュをLRUキャッシュ（最大100エントリ）に変更する。
新規エントリ追加時にキャッシュサイズが100を超える場合、最も古いエントリを削除する。
タスクがcompletedフェーズに移行した際、そのタスクに関連するキャッシュエントリを即座に削除する。
キャッシュヒット時にエントリのアクセス時刻を更新し、LRU順序を維持する。

#### 受入基準
- キャッシュエントリ数が100を超えないこと
- 101個目のエントリ追加時に最古のエントリが削除されること
- タスク完了時に該当タスクのキャッシュエントリが削除されること
- キャッシュヒット率が既存実装と同等以上であること
- 既存の772テスト全件が成功すること

#### テスト観点
101個のエントリを追加し、最古のエントリが削除されることを確認するテストを追加する。
タスク完了時のキャッシュ削除を確認するテストを追加する。
キャッシュヒット率の性能テストを追加する。

### REQ-9: 並列フェーズ依存関係の強化（P2）

#### 目的と背景
phase-edit-guard.jsのhandleParallelPhase()が並列フェーズのサブフェーズ依存関係を完全には強制していない。
planningサブフェーズはthreat_modelingの完了を待つべきだが、フック側の依存関係チェックが不完全である。
MCP server側のworkflow_complete_subでは依存関係チェックが実装済みだが、フック側では未対応のまま残っている。
フック側でサブフェーズのアクティブ判定を行う際にSUB_PHASE_DEPENDENCIESの依存関係グラフを参照していないため、依存元未完了でも依存先の操作が可能になっている。

#### 修正対象ファイル
- `hooks/phase-edit-guard.js`（handleParallelPhase()関数）

#### 入力条件
- 並列フェーズ（parallel_analysis、parallel_design、parallel_quality、parallel_verification）でファイル編集が試行される
- 編集対象ファイルがサブフェーズに対応している（例: planning.md）
- SUB_PHASE_DEPENDENCIESで定義された依存関係が存在する（例: planning → threat_modeling）

#### 期待される出力と動作
handleParallelPhase()内でSUB_PHASE_DEPENDENCIESを参照し、依存元サブフェーズの完了状態をチェックする。
依存元サブフェーズが未完了の場合、依存先サブフェーズのファイル編集をexit(2)でブロックする。
依存元サブフェーズが完了済みの場合のみ、依存先サブフェーズのファイル編集を許可する。
エラーメッセージに依存関係を明示する（例: "planning requires threat_modeling to be completed first"）。

#### 受入基準
- threat_modeling未完了の状態でplanning.mdの編集がブロックされること
- threat_modeling完了後にplanning.mdの編集が許可されること
- エラーメッセージに依存関係が明示されること
- 既存の772テスト全件が成功すること

#### テスト観点
threat_modeling未完了時のplanning.md編集ブロックを確認するテストを追加する。
threat_modeling完了後のplanning.md編集許可を確認するテストを追加する。
エラーメッセージ内容の検証テストを追加する。

### REQ-10: スコープ検証の改善（P2）

#### 目的と背景
phase-edit-guard.jsのcheckScopeViolation()がdocs/spec/を無条件で除外しており、他タスクのスコープ外仕様書を編集可能になっている。
スコープ除外パターンがグローバルであり、タスク固有の制限ができない問題がある。
10Mステッププログラム開発では複数タスクが並行実行される可能性があり、タスクAがタスクBのdocs/spec/を誤編集するリスクがある。
docs/spec/内のファイルもスコープチェック対象に含め、タスク固有のスコープ除外パターンを導入する必要がある。

#### 修正対象ファイル
- `hooks/phase-edit-guard.js`（checkScopeViolation()関数）

#### 入力条件
- タスクにスコープが設定されている（files/dirs/glob）
- docs/spec/配下のファイルが編集対象として渡される
- 編集対象ファイルがタスクのスコープ外である

#### 期待される出力と動作
checkScopeViolation()のグローバル除外パターンからdocs/spec/を削除する。
docs/spec/内のファイルもスコープチェックの対象とする。
タスク固有のスコープ除外パターンをworkflow-state.jsonのscopeExcludePatternsフィールドに追加する。
スコープ外のdocs/spec/ファイル編集がexit(2)でブロックされる。
スコープ内のdocs/spec/ファイル編集は許可される。

#### 受入基準
- スコープ外のdocs/spec/ファイル編集がブロックされること
- スコープ内のdocs/spec/ファイル編集が許可されること
- タスク固有のスコープ除外パターンが機能すること
- 既存の772テスト全件が成功すること

#### テスト観点
スコープ外のdocs/spec/ファイル編集ブロックを確認するテストを追加する。
スコープ内のdocs/spec/ファイル編集許可を確認するテストを追加する。
タスク固有除外パターンの動作テストを追加する。

### REQ-11: TOCTOU競合状態の修正（P2）

#### 目的と背景
mcp-server/src/state/manager.tsのisSessionTokenValid()にtime-of-check/time-of-use脆弱性がある。
sessionTokenのformat checkとexpiry checkが別々のステップで実行され、その間にトークンが失効する可能性がある。
ただし実際の影響は非常に限定的であり、ミリ秒単位のウィンドウでの攻撃は現実的でない。
完全性のためにアトミックな検証に変更するが、優先度はP2（改善）として扱う。

#### 修正対象ファイル
- `mcp-server/src/state/manager.ts`（isSessionTokenValid()関数）

#### 入力条件
- isSessionTokenValid()にsessionTokenが渡される
- sessionTokenのフォーマットチェックと有効期限チェックが実行される

#### 期待される出力と動作
isSessionTokenValid()を単一の関数内で完結させ、format checkとexpiry checkをアトミックに実行する。
中間状態を外部に公開せず、検証結果のみをboolean値で返す。
検証ロジック全体をtry-catchでラップし、例外発生時は即座にfalseを返す。

#### 受入基準
- isSessionTokenValid()内でformat checkとexpiry checkが連続して実行されること
- 中間状態が外部に公開されないこと
- 例外発生時にfalseが返ること
- 既存の772テスト全件が成功すること

#### テスト観点
isSessionTokenValid()の単体テストで正常系・異常系を確認する。
例外発生時のfalse返却を確認するテストを追加する。

### REQ-12: CLAUDE.md修正 - subagentコンテキスト断絶の緩和

#### 目的と背景
現在のCLAUDE.mdはサマリーセクションに50行制限を設けており、複雑な設計情報を50行に圧縮すると重要な詳細が失われる。
subagent起動テンプレートではサマリーのみの読み込みが推奨されており、多くの場合subagentはサマリーしか読まず、設計の詳細が次フェーズに伝達されない。
これはコード修正ではなくCLAUDE.mdのガイダンス修正で対応する問題である。
サマリーの役割を「次フェーズへの引き継ぎ情報」として構造化し、必要に応じて全文読み込みを推奨する記述に変更する。

#### 修正対象ファイル
- `CLAUDE.md`（サマリーセクション必須化のセクション、subagent起動テンプレート）

#### 入力条件
- CLAUDE.mdのREQ-4/REQ-B4セクションが存在する
- subagent起動テンプレートセクションが存在する
- フェーズ別subagent設定テーブルが存在する

#### 期待される出力と動作
サマリーセクションの説明を「50行以内で次フェーズに必要な情報を記述」から「次フェーズへの引き継ぎ情報を構造化して記述（推奨50行、最大200行）」に変更する。
subagent起動テンプレートに「複雑な設計の場合は全文を読み込んでください」という推奨文を追加する。
フェーズ別subagent設定テーブルに入力ファイルの重要度カラムを追加し、各フェーズで全文読み込みが必要かサマリーで十分かを明記する。
例: planning → requirements.md（全文必須）、state_machine → spec.md（サマリー推奨）

#### 受入基準
- サマリーセクションの推奨が「50行」から「50-200行」に変更されていること
- subagent起動テンプレートに全文読み込み推奨文が追加されていること
- フェーズ別subagent設定テーブルに入力ファイル重要度カラムが追加されていること
- CLAUDE.md修正後にworkflow-plugin/mcp-server/src/validation/artifact-validator.tsが新ルールに準拠すること

#### テスト観点
CLAUDE.md修正後に新タスクを開始し、subagentがサマリーだけでなく全文も読み込むことを確認する手動テストを実施する。
artifact-validator.tsのサマリー行数検証ロジックが新ルール（200行以内）を許容することを確認するテストを追加する。

### REQ-13: CLAUDE.md修正 - 小規模タスク19フェーズオーバーヘッド解消

#### 目的と背景
PHASES_SMALL（8フェーズ）とPHASES_MEDIUM（14フェーズ）の定義コードは存在するが、start.ts内でtaskSizeに応じたフェーズ選択ロジックが無効化されている。
CLAUDE.mdで「全てのタスクで完全なワークフローを実行」と明記されているため、全タスクが19フェーズで実行される。
typo修正のような単純なタスクに19フェーズは過剰であり、開発者の生産性を損なう問題がある。
CLAUDE.mdのガイダンスを修正し、taskSizeに応じたフェーズ選択を復活させる必要がある。

#### 修正対象ファイル
- `CLAUDE.md`（フェーズ順序セクション、タスクサイズ選択ガイダンスセクション）
- `mcp-server/src/tools/start.ts`（taskSize判定ロジック）

#### 入力条件
- workflow_start時にtaskSizeパラメータが指定される（small/medium/large）
- taskSizeが未指定の場合はデフォルトlargeが使用される

#### 期待される出力と動作
CLAUDE.mdのフェーズ順序セクションで「全てのタスクは19フェーズで実行」という記述を削除する。
タスクサイズ選択ガイダンスセクションの表を修正し、small（8フェーズ）、medium（14フェーズ）、large（19フェーズ）の適用場面を明記する。
start.ts内でtaskSizeに基づくフェーズリスト選択ロジックを実装する。
taskSize=smallの場合はPHASES_SMALL（8フェーズ）を使用する。
taskSize=mediumの場合はPHASES_MEDIUM（14フェーズ）を使用する。
taskSize=largeまたは未指定の場合はPHASES_LARGE（19フェーズ）を使用する。

#### 受入基準
- CLAUDE.mdで「全てのタスクで完全なワークフローを実行」という記述が削除されていること
- タスクサイズ選択ガイダンステーブルにsmall/medium/largeの適用場面が明記されていること
- start.tsでtaskSize=smallの場合に8フェーズが選択されること
- start.tsでtaskSize=mediumの場合に14フェーズが選択されること
- start.tsでtaskSize=large/未指定の場合に19フェーズが選択されること
- 既存の772テスト全件が成功すること（デフォルトlargeのため影響なし）

#### テスト観点
workflow_start({taskName: "test", taskSize: "small"})で8フェーズのタスクが作成されることを確認するテストを追加する。
workflow_start({taskName: "test", taskSize: "medium"})で14フェーズのタスクが作成されることを確認するテストを追加する。
workflow_start({taskName: "test"})でデフォルト19フェーズが選択されることを確認するテストを追加する。

## 非機能要件

### NFR-1: 性能要件
全修正実施後もフック実行時間は100ms以内を維持する必要がある。
タスク数が100個の環境でフック実行時間が100ms以内であることをベンチマークテストで検証する。
MCP serverのメモリ使用量は100タスク環境でも500MB以下を維持する必要がある。
バリデーション処理は10秒以内に完了する必要がある（タイムアウト設定）。

### NFR-2: 互換性要件
既存のworkflow-state.jsonフォーマットとの後方互換性を維持する必要がある。
task-index.jsonはHookスキーマに統一するが、既存のMCPスキーマエントリは読み取り時に無視される。
環境変数WORKFLOW_FAIL_MODEが未設定の環境でもデフォルト動作（permissive）で正常に機能する必要がある。
HMAC鍵にcreatedAt/expiresAtが追加されるが、既存の鍵（フィールドなし）も猶予期間内は有効とする。

### NFR-3: セキュリティ要件
セキュリティ違反エラー（HMAC不正、フェーズ違反）は必ずexit(2)でブロックする必要がある。
bash-whitelistバイパスベクターの検出は確実に機能し、既知のバイパスパターンを全てブロックする必要がある。
HMAC鍵の有効期限は30日であり、猶予期間は7日とする。
セッショントークン検証はアトミックに実行され、TOCTOU競合状態が発生しない必要がある。

### NFR-4: 保守性要件
全修正はTypeScript/JavaScriptの既存コーディング規約に準拠する必要がある。
新規追加コードには適切なコメントとJSDocを含める必要がある。
エラーメッセージは具体的であり、ユーザーが問題を理解し解決できる情報を含む必要がある。
ログ出力は構造化され、grep/jqで解析可能な形式（JSON Lines）とする。

### NFR-5: テスト要件
全修正に対して単体テスト・統合テストを追加する必要がある。
既存の772テスト全件が成功することを回帰テストで検証する必要がある。
コードカバレッジは修正前と同等以上（80%以上）を維持する必要がある。
テストは再現可能であり、CI環境でも同一結果を得られる必要がある。

### NFR-6: ドキュメント要件
各修正に対してCHANGELOG.mdにエントリを追加する必要がある。
CLAUDE.md修正箇所にはコメントで修正理由と日付を記録する必要がある。
新規追加ツール（workflow_update_intent）のAPIドキュメントをREADME.mdに追加する必要がある。
修正後のフック動作をdocs/architecture/hooks.mdに反映する必要がある。

## 制約条件

### C-1: 修正範囲の制約
本タスクでは以下のファイルのみを修正対象とする。
hooks/配下4ファイル: enforce-workflow.js、phase-edit-guard.js、lib/discover-tasks.js、bash-whitelist.js
mcp-server/src/配下8ファイル: state/manager.ts、tools/start.ts、tools/next.ts、tools/update-intent.ts（新規）、validation/artifact-validator.ts、validation/semantic-checker.ts、validation/design-validator.ts、security/hmac.ts
CLAUDE.md 1ファイル
上記以外のファイル修正は本タスクのスコープ外とする。

### C-2: 後方互換性の制約
既存のworkflow-state.jsonを持つタスクは修正後も継続実行可能でなければならない。
既存のtask-index.jsonはHookスキーマへの移行が必要だが、MCP serverの次回起動時に自動移行される。
環境変数WORKFLOW_FAIL_MODEが未設定の環境でもデフォルト動作（permissive）で正常に機能する必要がある。

### C-3: 性能制約
フック実行時間はタスク数100個の環境でも100ms以内を維持する必要がある。
MCP serverのメモリ使用量は100タスク環境でも500MB以下を維持する必要がある。
バリデーション処理は10秒以内に完了する必要がある（それを超えるとタイムアウト）。

### C-4: テスト制約
既存の772テスト全件が成功することを回帰テストで検証する必要がある。
新規追加テストは既存テストフレームワーク（vitest）を使用する必要がある。
テストカバレッジは修正前と同等以上（80%以上）を維持する必要がある。

### C-5: セキュリティ制約
セキュリティ違反エラー（HMAC不正、フェーズ違反）は必ずexit(2)でブロックする必要がある。
bash-whitelistバイパスベクターの検出は確実に機能し、既知のバイパスパターンを全てブロックする必要がある。
HMAC鍵の有効期限は30日であり、猶予期間は7日とする（これより短い/長い設定は不可）。

## 優先順位と実装順序

### 実装フェーズ1: P0修正（即座に修正すべき問題）
REQ-1: task-index.jsonデュアルスキーマ競合の解消
REQ-2: O(n)フック性能問題の改善
REQ-3: Fail-Closed過剰ブロックの緩和

これら3件は開発体験に直接影響する重大な問題であり、最優先で修正する必要がある。
実装順序はREQ-1 → REQ-2 → REQ-3とし、REQ-1の修正がREQ-2の前提となるためこの順序を遵守する。

### 実装フェーズ2: P1修正（次に修正すべき問題）
REQ-4: bash-whitelistバイパスベクターの対策
REQ-5: バリデーションタイムアウトの追加
REQ-6: HMAC鍵管理の改善
REQ-7: userIntent更新ツールの追加

これら4件はセキュリティ・機能性に関わる重要な問題であり、P0修正後に速やかに対応する必要がある。
実装順序はREQ-4 → REQ-5 → REQ-6 → REQ-7とし、各修正は独立しているため並行実装も可能である。

### 実装フェーズ3: P2修正（改善として対応する問題）
REQ-8: ASTキャッシュのLRU化
REQ-9: 並列フェーズ依存関係の強化
REQ-10: スコープ検証の改善
REQ-11: TOCTOU競合状態の修正

これら4件は長期的な保守性・品質向上に関わる改善であり、P0/P1修正後に対応する。
実装順序はREQ-8 → REQ-9 → REQ-10 → REQ-11とし、各修正は独立している。

### 実装フェーズ4: CLAUDE.md修正
REQ-12: CLAUDE.md修正 - subagentコンテキスト断絶の緩和
REQ-13: CLAUDE.md修正 - 小規模タスク19フェーズオーバーヘッド解消

これら2件はコード修正ではなくガイダンス修正であり、P0-P2修正完了後に対応する。
実装順序はREQ-12 → REQ-13とし、REQ-13はREQ-1の修正（start.ts）と連携する。

## 受入基準（全体）

全修正完了後、以下の受入基準を全て満たす必要がある。

### 機能受入基準
- 全13件のREQが仕様通りに実装されていること
- 新規追加ツール（workflow_update_intent）がMCP serverに登録され、呼び出し可能であること
- task-index.jsonがHookスキーマ`{tasks: [...], updatedAt}`形式で書き込まれること
- フック実行時間がタスク数100個の環境でも100ms以内であること
- HMAC鍵にcreatedAt/expiresAtフィールドが含まれること

### テスト受入基準
- 既存の772テスト全件が成功すること
- 新規追加テストが全件成功すること
- コードカバレッジが修正前と同等以上（80%以上）であること
- CI環境でも全テストが再現可能に成功すること

### ドキュメント受入基準
- CHANGELOG.mdに全修正のエントリが追加されていること
- CLAUDE.mdの修正箇所にコメントで修正理由と日付が記録されていること
- workflow_update_intentツールのAPIドキュメントがREADME.mdに追加されていること
- docs/architecture/hooks.mdに修正後のフック動作が反映されていること

### 非機能受入基準
- MCP serverのメモリ使用量が100タスク環境でも500MB以下であること
- バリデーション処理が10秒以内に完了すること（それを超えるとタイムアウト）
- セキュリティ違反エラーが必ずexit(2)でブロックされること
- エラーメッセージが具体的であり、ユーザーが問題を理解できること

## リスクと対策

### リスク1: task-index.json移行時のデータ損失
既存のMCPスキーマエントリをHookスキーマに移行する際、データが失われる可能性がある。
対策として、移行前にtask-index.jsonのバックアップを作成し、移行後に検証スクリプトでデータ整合性を確認する。
移行失敗時は自動的にバックアップから復元する機能を実装する。

### リスク2: HMAC鍵ローテーション時の状態検証失敗
鍵ローテーション直後に旧鍵で署名されたworkflow-state.jsonが検証失敗する可能性がある。
対策として、猶予期間（7日間）内は旧鍵での検証も許可する実装を行う。
鍵ローテーション時にアクティブタスクの状態を新鍵で再署名する機能を追加する。

### リスク3: バリデーションタイムアウト時の品質低下
バリデーション処理がタイムアウトして自動成功となる場合、品質チェックが不十分になる可能性がある。
対策として、タイムアウト発生時に警告ログを出力し、開発者に手動検証を促す。
タイムアウト発生頻度を監視し、閾値を超える場合はバリデーションロジックの最適化を検討する。

### リスク4: Fail-Closed緩和によるセキュリティ低下
一時的エラーでexit(0)を返すことで、本来ブロックすべきセキュリティ違反を見逃す可能性がある。
対策として、エラーカテゴリ分類ロジックを厳密に実装し、セキュリティ違反は必ずexit(2)でブロックする。
環境変数WORKFLOW_FAIL_MODE=strictモードで従来の厳格な動作を選択可能にする。

### リスク5: bash-whitelistバイパスベクター検出の誤検知
高リスクパターン検出を追加することで、正当なコマンドが誤検知でブロックされる可能性がある。
対策として、検出パターンを段階的に追加し、各パターンの誤検知率をテストで検証する。
誤検知が発生した場合は、該当コマンドをホワイトリストに追加する仕組みを導入する。

## 次フェーズへの引き継ぎ事項

parallel_analysisフェーズでは以下の作業を実施する。
threat_modelingサブフェーズで本要件定義に基づく脅威モデリングを実施し、セキュリティリスクを評価する。
planningサブフェーズで各REQの詳細実装計画を策定し、モジュール分割・クラス設計を行う。
実装計画では13件のREQを4つの実装フェーズに分割し、各フェーズの期間・成果物を明確化する。

parallel_designフェーズでは以下の作業を実施する。
state_machineサブフェーズで鍵ローテーション、スコープ検証、フェーズ遷移の状態遷移図を作成する。
flowchartサブフェーズで各REQの処理フローチャートを作成する。
ui_designサブフェーズは本タスクでは不要（UI要素なし）のためスキップする。

test_designフェーズでは以下の作業を実施する。
全13件のREQに対する単体テスト・統合テストの設計を行う。
既存772テストへの影響評価を実施し、修正が必要なテストを特定する。
新規追加テストのテストケース設計を行い、正常系・異常系・境界値を網羅する。
