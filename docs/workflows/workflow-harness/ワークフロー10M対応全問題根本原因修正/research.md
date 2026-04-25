# 調査報告書: ワークフロー10M対応全問題根本原因修正

## サマリー

workflow-pluginのコードベースを徹底調査し、レビューで特定された13件の問題の根本原因を特定した。
主要な発見として、全問題は3つの構造的欠陥に起因している。
第一にHook-MCP間の状態同期メカニズムの欠如（問題1,2,11）がある。
第二にセキュリティ設計の過剰適用（問題5,6,7,8）が確認された。
第三にスケーラビリティ未考慮の初期設計（問題1,3,4,9,10）が根本にある。

修正優先度の分類結果は以下の通りである。
P0（即座に修正すべき問題）はO(n)フック性能、デュアルスキーマ競合、Fail-Closed過剰ブロックの3件である。
P1（次に修正すべき問題）はbash-whitelistバイパス、バリデーションタイムアウト、HMAC鍵管理、userIntent更新の4件である。
P2（改善として対応する問題）はsubagentコンテキスト、ASTキャッシュ、小規模タスク対応の3件である。
残りの問題12,13はP1として対応し、問題11はP2として扱う。

次フェーズ(requirements)では各問題の修正要件を定義し、修正範囲を確定する必要がある。
スコープとしてはhooks/配下の4ファイルとmcp-server/src/配下の8ファイル、CLAUDE.mdの修正を予定する。

## 調査結果

workflow-pluginの全ソースコード（hooks/7ファイル、mcp-server/src/40+ファイル）を対象に調査を実施した。
特にhooks/lib/discover-tasks.js、hooks/phase-edit-guard.js、hooks/enforce-workflow.js、hooks/bash-whitelist.jsのフック群を重点的に分析した。
MCP server側ではmcp-server/src/state/manager.ts、mcp-server/src/tools/next.ts、mcp-server/src/tools/start.tsのコア状態管理を調査した。
mcp-server/src/phases/definitions.ts、mcp-server/src/validation/配下の各バリデーターも詳細に確認した。
mcp-server/src/state/hmac.tsのHMAC鍵管理実装についてもセキュリティ観点で分析を行った。
調査の結果、13件の問題の根本原因を特定し、それぞれの修正方向性を確立した。

## 既存実装の分析

現在のworkflow-pluginは大きく3つのコンポーネントから構成されている。
第一にHookスクリプト群（hooks/）はClaude CodeのPreToolUse/PostToolUseイベントで実行されるJavaScriptである。
第二にMCPサーバー（mcp-server/）はTypeScriptで実装されたワークフロー状態管理サーバーである。
第三にCLAUDE.mdとワークフロースキルがAIへの指示としてプロセスルールを定義している。
Hook側とMCP server側はtask-index.jsonを介して状態を共有するが、スキーマが不統一で競合が発生している。
フック実行パフォーマンスはO(n)（nはタスク数）であり、タスク蓄積に伴い劣化する。
セキュリティ設計はFail-Closed方針だが、過剰適用により開発生産性を損なっている。

## 問題1: O(n)フック性能問題

### 発生箇所
hooks/lib/discover-tasks.js 行95-143のdiscoverTasks()関数が根本である。
hooks/enforce-workflow.js 行281でdiscoverTasks()が呼び出される。
hooks/enforce-workflow.js 行285-305で全タスクのHMAC検証ループが実行される。

### 根本原因
discoverTasks()はSTATE_DIR配下の全ディレクトリをfs.readdirSync()で同期スキャンし、各タスクのworkflow-state.jsonを読み込みパースする。
task-index.jsonキャッシュ（TTL 1時間）は存在するが、キャッシュミス時に全スキャンが発生する。
さらにenforce-workflow.jsでは検出された全タスクに対してHMAC検証を実行する。
10Mステッププログラム開発では数百のワークフロータスクが蓄積する。
その結果、毎回のファイル編集フック呼び出しで数百ms-数秒のオーバーヘッドが発生し、開発体験が著しく劣化する。

### 設計意図の推測
初期設計時はタスク数が少数（10件以下）を想定しており、全スキャンでも問題なかった。
HMAC全件検証はセキュリティ優先の設計判断として採用された。

### 修正方向性
HMAC検証はアクティブタスク（現在のタスク）のみに限定する。
完了済みタスクのディレクトリスキャンをスキップする最適化を導入する。
task-index.jsonの更新をMCPサーバー起動時と状態変更時に限定し、フック側では読み取りのみとする。

## 問題2: task-index.jsonデュアルスキーマ競合

### 発生箇所
hooks/lib/discover-tasks.js 行46-65のreadTaskIndexCache()がHookスキーマ`{tasks: [...], updatedAt}`を期待する。
mcp-server/src/state/manager.tsのsaveTaskIndex()が以前はMCPスキーマ`{taskId: relativePath}`を書き込んでいた（現在はno-op）。
現在のtask-index.json行98にMCPスキーマが混在しており、二重構造になっている。

### 根本原因
Hook側とMCP server側が独立して開発され、task-index.jsonのスキーマについて合意がなかった。
前回修正REQ-1でsaveTaskIndex()をno-opにしたが、これにより新タスクがtasks配列に追加されなくなるリグレッションが発生した。
新タスクを開始してもtasks配列が更新されないため、フックが旧タスクにフォールバックし全操作がブロックされる。
本調査中にもこの問題が実際に発生し、task-index.jsonの手動修正が必要だった。

### 設計意図の推測
Hook側は軽量なJavaScriptで高速実行を重視し配列形式を採用した。
MCP server側はTypeScriptで型安全性を重視しマップ形式を採用した。
両者間のスキーマ統一が行われなかった。

### 修正方向性
Hook側のスキーマ`{tasks: [...], updatedAt}`に統一する。
MCP server側のworkflow_start、workflow_next等の状態変更時にtasks配列を正しく更新する。
saveTaskIndex()のno-opを解除し、Hook互換のスキーマで書き込むように修正する。

## 問題3: userIntent固定問題

### 発生箇所
mcp-server/src/tools/start.ts 行90でuserIntentが一度だけ設定される。
全tools内にuserIntent更新ツールが存在しない。

### 根本原因
userIntentはworkflow_start時にのみ設定され、以降のフェーズで更新するAPIが提供されていない。
10Mステッププログラムでは開発中に要件が変化することが一般的であり、固定されたuserIntentはcalculatePhaseSkips()の判定精度を劣化させる。
例えば「テスト修正」で開始したタスクが途中で「リファクタリング」に拡大しても、フェーズスキップ判定は初期意図に基づいて行われる。

### 設計意図の推測
ワークフローの一貫性を保つため、開始時の意図を変更不可とした設計判断だった。
小規模タスクでは合理的だが、大規模・長期タスクでは不適切である。

### 修正方向性
workflow_update_intentツールを新設し、requirementsフェーズ以降でuserIntentを更新可能にする。
更新履歴をintentHistory配列に保持し、監査可能にする。

## 問題4: subagentコンテキスト断絶

### 発生箇所
CLAUDE.mdのサマリーセクション必須化（REQ-4/REQ-B4）で50行以内のサマリーを規定している。
ワークフロースキルのsubagent起動テンプレートで入力ファイルを指定している。

### 根本原因
サマリー50行制限はコンテキスト節約のために設けられたが、複雑な設計情報を50行に圧縮すると重要な詳細が失われる。
subagentは前フェーズの成果物全体を読む手段はあるが、サマリーのみの読み込みが推奨されている。
多くの場合subagentはサマリーしか読まず、設計の詳細が次フェーズに伝達されない。

### 設計意図の推測
subagentのコンテキストウィンドウを節約するための設計であり、大量の文書を読み込むとsubagentのコンテキストが枯渇する懸念があった。

### 修正方向性
これはコード修正ではなくCLAUDE.mdのガイダンス修正である。
サマリーは「次フェーズへの引き継ぎ情報」として構造化し、必要に応じて全文読み込みを推奨する記述に変更する。
フェーズ別subagent設定テーブルに入力ファイルの重要度（全文/サマリー/参照）を明記する。

## 問題5: Fail-Closed過剰ブロック

### 発生箇所
hooks/enforce-workflow.js 行34-43のuncaughtExceptionハンドラでprocess.exit(2)が実行される。
hooks/phase-edit-guard.js 行36-45にも同様のuncaughtExceptionハンドラがある。

### 根本原因
全フックでuncaughtExceptionを捕捉し、無条件でexit(2)を返す。
exit(2)はClaude Codeに「操作をブロック」と伝えるシグナルである。
一時的なエラー（ファイルI/Oタイムアウト、JSON解析エラー、ネットワーク障害）と致命的なセキュリティ違反を区別しない。
10Mステッププログラムでは数千時間の開発中に一時的なエラーが必然的に発生し、その都度全操作がブロックされる。

### 設計意図の推測
セキュリティファーストの設計として、不明なエラーは潜在的な攻撃と見なし安全側に倒す方針だった。
小規模開発では妥当だが、大規模開発では生産性を著しく損なう。

### 修正方向性
エラーカテゴリ分類を導入する。
セキュリティ違反（HMAC不正、フェーズ違反）はexit(2)でブロックする。
一時的エラー（I/Oエラー、タイムアウト）はexit(0)で許可しつつログに記録する。
環境変数WORKFLOW_FAIL_MODEで挙動を切り替え可能にする（strict/permissive）。

## 問題6: bash-whitelistバイパスベクター

### 発生箇所
hooks/phase-edit-guard.js 行1200-1245のFILE_MODIFYING_COMMANDSパターンが不完全である。
hooks/phase-edit-guard.js 行1180-1199のsplitCompoundCommand()がサブシェル内の区切りを認識しない。

### 根本原因
Bashコマンドのホワイトリスト検証が正規表現ベースで実装されており、シェルの構文解析を行っていない。
ブレース展開、変数展開($VAR)、プロセス置換(<())、バッククォート置換などを考慮していない。
splitCompoundCommand()は`;`、`&&`、`||`で分割するが、サブシェル`()`やコマンド置換`$()`内の区切りを認識しない。

### 設計意図の推測
正規表現による軽量な検証を選択し、パフォーマンスを優先した。
完全なシェル構文解析はNode.jsで実装が困難という技術的制約もあった。

### 修正方向性
高リスクパターンの検出を追加する。変数展開+リダイレクト、プロセス置換のパターンをブロックする。
完全なシェルパーサーは不要だが、既知のバイパスパターンをブロックする防御層を追加する。

## 問題7: HMAC鍵管理問題

### 発生箇所
mcp-server/src/security/hmac.tsが鍵生成・検証ロジックを担当している。
.claude/state/hmac-keys.jsonが鍵ストアとして使用されている。

### 根本原因
HMAC鍵に有効期限が設定されておらず、一度生成された鍵は永続的に有効である。
鍵の失効（revocation）メカニズムもない。
鍵が漏洩した場合、攻撃者が任意のワークフロー状態を偽造できる。
鍵のローテーション機能もなく同じ鍵が全期間使用される。

### 設計意図の推測
シンプルさを優先した初期実装であり、鍵管理の複雑さを回避するため有効期限なしの設計を選択した。

### 修正方向性
鍵にcreatedAtとexpiresAtフィールドを追加する。
鍵ローテーション（30日ごと）と古い鍵での検証猶予期間（7日）を実装する。

## 問題8: バリデーションタイムアウト未設定

### 発生箇所
mcp-server/src/validation/artifact-validator.tsのvalidateArtifactQuality()にタイムアウトがない。
mcp-server/src/validation/semantic-checker.tsのn-gram計算にもタイムアウトがない。
hooks/phase-edit-guard.js 行1764-1767にはstdinタイムアウト3秒のみ存在する。

### 根本原因
Hook側にはstdinタイムアウト（3秒）があるが、MCP server側のバリデーション処理にはタイムアウトが設定されていない。
大規模な成果物ファイル（数千行）のセマンティックチェックやn-gram計算が無限に実行される可能性がある。

### 設計意図の推測
バリデーション処理は通常高速に完了するため、タイムアウトを設定する必要性が認識されなかった。

### 修正方向性
バリデーション関数にPromise.race()でタイムアウト（10秒）を追加する。
タイムアウト時は警告ログを出力し、バリデーションを通過させる（fail-openに変更）。

## 問題9: ASTキャッシュ無制限成長

### 発生箇所
mcp-server/src/validation/design-validator.tsのASTキャッシュに問題がある。

### 根本原因
設計整合性検証で使用されるMermaid ASTのキャッシュにサイズ制限やLRU evictionポリシーがない。
タスクが増えるたびにキャッシュが成長し、MCPサーバーのメモリ消費が増加する。
完了タスクのキャッシュが破棄されないため、長期運用でメモリリークが発生する。

### 設計意図の推測
キャッシュヒット率を最大化するため、evictionを行わない設計とした。

### 修正方向性
LRUキャッシュ（最大100エントリ）に変更する。
完了タスクのキャッシュは即座に破棄する。

## 問題10: 小規模タスク19フェーズオーバーヘッド

### 発生箇所
mcp-server/src/phases/definitions.ts 行22-54にPHASES_SMALL(8)とPHASES_MEDIUM(14)の定義が存在する。
mcp-server/src/tools/start.tsでtaskSizeパラメータを受け取るがphase選択に未反映である。
CLAUDE.mdで「全てのタスクで完全なワークフローを実行」と明記されている。

### 根本原因
PHASES_SMALL（8フェーズ）とPHASES_MEDIUM（14フェーズ）の定義コードは存在するが、start.ts内でtaskSizeに応じたフェーズ選択ロジックが無効化されている。
CLAUDE.mdで「small/mediumサイズは廃止」と明記されているため、全タスクが19フェーズで実行される。
typo修正のような単純なタスクに19フェーズは過剰であり、開発者の生産性を損なう。

### 設計意図の推測
品質管理の一貫性を保つため全タスクで同一プロセスを強制した。

### 修正方向性
CLAUDE.mdのガイダンスを修正し、taskSizeに応じたフェーズ選択を復活させる。
start.tsでtaskSizeに基づくフェーズリスト選択を実装する。

## 問題11: セッショントークン検証の競合状態（TOCTOU）

### 発生箇所
mcp-server/src/state/manager.tsのisSessionTokenValid()にTOCTOU脆弱性がある。

### 根本原因
sessionTokenのformat checkとexpiry checkが別々のステップで実行される。
その間にトークンが失効する可能性があり、time-of-check/time-of-use脆弱性となる。
ただし実際の影響は非常に限定的であり、ミリ秒単位のウィンドウでの攻撃は現実的でない。

### 修正方向性
アトミックな検証に変更する。ただしP2優先度として対応する。

## 問題12: 並列フェーズ依存関係の未強制

### 発生箇所
phase-edit-guard.js行703-726のhandleParallelPhase()が依存関係を完全には強制していない。

### 根本原因
planningサブフェーズはthreat_modelingの完了を待つべきだが、コード上でフック側の依存関係チェックが不完全である。
MCP server側のworkflow_complete_subでは依存関係チェックが実装済みだが、フック側では未対応のままとなっている。
フック側でサブフェーズのアクティブ判定を行う際に、SUB_PHASE_DEPENDENCIESの依存関係グラフを参照していない。
依存元サブフェーズが未完了の場合でも、依存先サブフェーズのファイル操作が許可されてしまう問題がある。
この問題により、threat_modelingを完了する前にplanningの成果物を作成できてしまう可能性がある。

### 修正方向性
workflow_complete_sub時に依存関係チェックを追加し、フック側でもSUB_PHASE_DEPENDENCIESを参照するように修正する。

## 問題13: スコープ検証の不完全性

### 発生箇所
phase-edit-guard.js 行1298-1362のcheckScopeViolation()が不完全である。

### 根本原因
docs/spec/を無条件で除外しており、他タスクのスコープ外仕様書を編集可能になっている。
スコープ除外パターンがグローバルであり、タスク固有の制限ができない。

### 修正方向性
スコープ除外パターンをタスク固有にする。
docs/spec/内のファイルもスコープチェック対象に含める。

## 既存テスト状況

前回タスクのベースラインとして772テスト全件成功が確認済みである。
テストスイートは64のテストファイルに分散しており、全テストが2.63秒で完了する。
本タスクでも同一ベースラインを使用する予定であり、workflow_capture_baselineで記録済みである。
修正対象ファイルの既存テストカバレッジを確認し、影響範囲を見積もる必要がある。
特にhooks/配下のテスト（enforce-workflow.test.js、phase-edit-guard.test.js等）とmanager.test.ts等の状態管理テストが重要である。

## 次フェーズへの引き継ぎ

requirementsフェーズでは以下の情報を使用して修正要件を定義する。
各問題の根本原因と修正方向性は本文書に記載済みであり、これに基づいて具体的な修正仕様を策定する。
修正の影響範囲（スコープ）はhooks/配下4ファイルとmcp-server/src/配下8ファイル、およびCLAUDE.mdである。
優先度に基づく実装順序はP0（3件）、P1（4件）、P2（3件+追加3件）とする。
テスト戦略は既存772テストへの影響評価を行い、新規テストケースを追加する。
