# 要件定義書: task-index.jsonキャッシュ同期の根本原因修正

## サマリー

本タスクは、commitフェーズでgit addがブロックされる問題の根本原因であるtask-index.jsonのキャッシュ同期問題を修正する。
MCP serverのフェーズ遷移時にtask-index.jsonが即座かつ確実に更新されるようにする。
hook側の2層キャッシュ(メモリ300秒+ファイル1時間)の不整合を解消し、commitフェーズでのブロックを回避する。
phase-edit-guard.jsのチェック順序を修正して、B-2 commit/pushチェックが優先実行されるようにする。
既存の772テストケースが全て通り、パフォーマンスへの影響が最小限であることを保証する。

## 背景

### 問題の発生状況

commitフェーズでgit addを実行した際、「implementationフェーズではgit addは許可されていません」というエラーでブロックされた。
実際にはworkflow_nextでcommitフェーズに遷移済みだったが、hookが読み取るtask-index.jsonには古い"implementation"が残っていた。
ユーザーはworkflow_statusで現在フェーズを確認しようとしたが、MCPサーバーから正しいフェーズが返されなかった。
この問題は一時的なキャッシュ遅延ではなく、構造的な同期問題として繰り返し発生する可能性がある。
開発者体験を著しく損ね、ワークフロープラグインの信頼性を低下させる重大な問題である。

### 既存実装の問題点

task-index.jsonはhookのパフォーマンス向上のために導入されたキャッシュファイルだが、MCP serverとの同期メカニズムが不完全である。
MCP serverはworkflow-state.jsonをsaveState()で直接更新するが、task-index.jsonはsaveTaskIndex()経由でdiscoverTasks()を呼ぶ重い処理になっている。
next.tsのフェーズ遷移ロジックにおいて、saveTaskIndex()の呼び出しが不確実または欠落している箇所がある。
hook側のdiscover-tasks.jsはtask-index.jsonを1時間TTLで読み取るため、更新が遅延すると古いフェーズ情報が最大1時間残る。
task-cache.jsのメモリキャッシュ(300秒TTL)とファイルキャッシュの2層構造が不整合を助長している。

### 実行順序の問題

phase-edit-guard.jsでは、まずfindActiveWorkflowState()でtask-index.jsonからフェーズを読み取る。
次にcheckBashWhitelist()が実行され、whitelistに合わない場合は即座にBLOCKで終了する。
B-2のcommit/pushチェックはbash-whitelistチェックの後に配置されているため、古いフェーズでブロックされるとB-2に到達できない。
commitフェーズでは本来B-2チェックがgit addを許可すべきだが、bash-whitelistで先にブロックされてしまう。
この実行順序の設計ミスが、キャッシュ同期問題を顕在化させている。

## 機能要件

### REQ-1: MCP serverのフェーズ遷移時のtask-index.json即時更新

manager.tsのupdateTaskPhase()メソッドで、workflow-state.jsonの更新と同じタイミングでtask-index.jsonを更新する。
next.tsのフェーズ遷移完了後、saveState()とsaveTaskIndex()の両方を確実に呼び出す。
saveTaskIndex()の呼び出しが例外で失敗した場合でも、エラーログを出力してフェーズ遷移は継続する。
task-index.jsonの更新失敗は非致命的エラーとして扱い、次回のhook実行時にworkflow-state.jsonからの再構築で復旧可能にする。
フェーズ遷移APIのレスポンス返却前にtask-index.jsonの書き込み完了を待つことで、hook側のキャッシュTTL問題を回避する。

### REQ-2: task-index.json更新のアトミック化

saveTaskIndex()の現行実装はdiscoverTasks()を呼び出して全タスクディレクトリを再走査するため、O(n)の時間計算量がかかる。
フェーズ遷移のたびに全タスク走査を行うのはパフォーマンス上問題があるため、対象タスクのみを更新する軽量版メソッドを追加する。
updateTaskIndexForSingleTask(taskId, phase)のような専用メソッドを実装し、既存のtask-index.jsonを読み込んで該当タスクのphaseのみ更新する。
ファイルI/Oは1回の読み取り+1回の書き込みで完結させ、ロック機構でレースコンディションを回避する。
既存のsaveTaskIndex()は定期的なフルスキャン用として残し、フェーズ遷移時は軽量版を使用する。

### REQ-3: phase-edit-guardのチェック順序修正

phase-edit-guard.jsのL1432-1532において、B-2 commit/pushチェック(L1489-1532)をbash-whitelistチェック(L1440)より前に移動する。
チェック順序を「B-2 commit/push → bash-whitelist → その他」に変更することで、commitフェーズでのgit addが優先的に許可される。
コマンドがgit add/git commitで始まる場合は、まずB-2ロジックで判定し、commit/push/ci_verification/deployフェーズなら即座に許可する。
B-2でマッチしなかった場合のみ、bash-whitelistチェックにフォールバックする。
この修正により、task-index.jsonが一時的に古い値であってもcommitフェーズのgit操作はブロックされなくなる。

### REQ-4: hook側キャッシュTTLの短縮(オプション)

discover-tasks.jsのTASK_INDEX_TTLを1時間(3600秒)から30秒に短縮する。
MCP serverの即時更新が実装されれば、長いTTLは不要になり、むしろ不整合リスクを高める。
task-cache.jsのメモリキャッシュTTLも300秒から30秒に短縮する。
ただし頻繁なファイルI/Oによるパフォーマンス低下が懸念される場合は、REQ-1/REQ-2/REQ-3の修正を優先し、REQ-4は見送る選択肢もある。
短縮後のパフォーマンスへの影響を測定し、許容範囲内であることを確認する。

### REQ-5: 既存テストの全通過保証

MCP server側の修正により、既存の772テストケースが全て通ることを確認する。
特にworkflow.test.tsのフェーズ遷移テストで、task-index.jsonの内容が正しく更新されることを検証する新規テストを追加する。
hook側の修正により、phase-edit-guard.test.jsの既存テストが全て通ることを確認する。
チェック順序変更がB-2以外のロジックに影響しないことを確認する回帰テストを追加する。
パフォーマンステストで、saveTaskIndex()の軽量化がO(1)で動作することを確認する。

## 非機能要件

### NFR-1: パフォーマンス

task-index.json更新の時間計算量をO(n)からO(1)に改善し、フェーズ遷移APIのレスポンス時間への影響を10ms以内に抑える。
1000タスクが登録されている状態でのフェーズ遷移が1秒以内に完了すること。
hook側のキャッシュTTL短縮後も、git addの実行時間が50ms以内に収まること。
メモリ使用量の増加が100MB以内であること。
ディスクI/O回数を最小化し、SSDでの動作を前提としても機械式HDDで性能劣化しないこと。

### NFR-2: 信頼性

task-index.json更新の失敗がフェーズ遷移を妨げないこと(非致命的エラー)。
ファイルI/Oエラー発生時はログ出力し、次回のhook実行時にworkflow-state.jsonから再構築すること。
レースコンディションによるtask-index.jsonの破損を防ぐため、適切なロック機構を実装すること。
B-2チェックの優先実行により、commitフェーズでのgit操作が100%ブロックされないことを保証すること。
MCP server再起動後もtask-index.jsonが整合状態であることを保証すること。

### NFR-3: 保守性

manager.tsにupdateTaskIndexForSingleTask()を追加する際、既存のsaveTaskIndex()との責務分離を明確にする。
コード修正箇所は最小限に抑え、影響範囲を4ファイル(manager.ts, next.ts, phase-edit-guard.js, discover-tasks.js)に限定する。
各修正にコメントで理由を記載し、将来のメンテナンス担当者が意図を理解できるようにする。
テストケースで修正の意図を明示し、回帰を防止するドキュメントとしても機能させる。
エラーハンドリングを適切に実装し、デバッグログで問題の追跡が容易になるようにする。

## 制約条件

### CONSTRAINT-1: 既存コードへの影響最小化

manager.tsのsaveTaskIndex()の既存の呼び出し箇所は変更せず、新規メソッドupdateTaskIndexForSingleTask()を追加する。
next.tsではフェーズ遷移完了後にupdateTaskIndexForSingleTask()を呼び出すロジックを1箇所追加するのみ。
phase-edit-guard.jsではL1432-1532の範囲内でコードブロックの順序を入れ替えるのみで、ロジック自体は変更しない。
discover-tasks.jsのTTL定数変更は1行のみの修正で済む(REQ-4を採用する場合)。
既存のAPI仕様やMCPプロトコルは一切変更せず、内部実装の改善のみで問題を解決する。

### CONSTRAINT-2: 後方互換性

古いバージョンのtask-index.json(schemaVersion未定義またはv1)を読み込んだ場合でも、エラーにならず再構築が行われること。
MCP server単体でのアップグレードが可能で、hook側のアップデートは任意のタイミングで行えること。
task-index.jsonのフォーマット変更は行わず、schemaVersion v2のまま維持すること。
既存のdiscoverTasks()ロジックは保持し、フルスキャンが必要な場合のフォールバックとして機能すること。
API利用側(claude code plugin)への影響がなく、MCP server単体でのアップデート完了で問題が解決すること。

### CONSTRAINT-3: テスト要件

新規追加するテストケース数は最大20件までとし、テストスイート全体の実行時間を10%以上増加させないこと。
既存の772テストケースが全て通ることを保証し、1件でも失敗があれば修正を完了とみなさない。
パフォーマンステストで、1000タスク環境でのフェーズ遷移が1秒以内に完了することを測定する。
hook側のチェック順序変更により、B-2以外のロジックが影響を受けていないことを確認する回帰テストを追加する。
task-index.jsonの整合性を検証する統合テストを追加し、フェーズ遷移直後のhook実行で正しいフェーズが返されることを確認する。

## 成功基準

### SUCCESS-1: commitフェーズでのgit addブロック問題の解消

commitフェーズでworkflow_next実行後、即座にgit addを実行してもブロックされないこと。
task-index.jsonがcommitフェーズの値で更新され、hook実行時に正しいフェーズ情報が返されること。
B-2チェックの優先実行により、bash-whitelistチェックでブロックされる前にgit操作が許可されること。
この問題が再発しないことを確認する統合テストが追加され、CI/CDで継続的に検証されること。
ユーザーがワークフロー操作中にフェーズ遷移とgit操作のタイミングを気にする必要がなくなること。

### SUCCESS-2: テスト全通過

既存の772テストケースが全て通ること。
新規追加したテストケースが全て通ること。
パフォーマンステストで、フェーズ遷移時のtask-index.json更新が10ms以内に完了すること。
hook側のチェック順序変更による回帰がないことを確認するテストが通ること。
CI/CDパイプラインでの自動テスト実行が成功すること。

### SUCCESS-3: パフォーマンス維持

フェーズ遷移APIのレスポンス時間が修正前と比較して10%以上増加しないこと。
1000タスク環境でのフェーズ遷移が1秒以内に完了すること。
hook側のgit add実行時間が50ms以内に収まること。
メモリ使用量の増加が100MB以内であること。
ディスクI/O回数が修正前と同等またはそれ以下であること。

## リスク

### RISK-1: レースコンディション

複数のMCP serverプロセスまたは並行ワークフローが同時にtask-index.jsonを更新しようとした場合、ファイル破損のリスクがある。
対策: ファイルロック機構(fs.promises.open with 'wx'フラグなど)を実装し、排他制御を行う。
対策: 更新失敗時は非致命的エラーとしてログ出力し、次回のhook実行時にworkflow-state.jsonから再構築する。
対策: テストケースで並行更新のシナリオを検証し、ロック機構が正しく機能することを確認する。
影響度: 中(ファイル破損の可能性)、発生確率: 低(通常は単一ワークフロー実行)。

### RISK-2: チェック順序変更の副作用

B-2チェックをbash-whitelistより前に移動することで、意図しないコマンドが許可されるリスクがある。
対策: B-2チェックのロジックを厳密に保ち、git add/git commitで始まるコマンドかつ対象フェーズの場合のみ許可する。
対策: B-2でマッチしなかった場合は必ずbash-whitelistチェックにフォールバックさせる。
対策: 既存のphase-edit-guard.test.jsに回帰テストを追加し、B-2以外のロジックが影響を受けていないことを確認する。
影響度: 中(セキュリティリスク)、発生確率: 低(ロジックは厳密に実装済み)。

### RISK-3: パフォーマンス劣化

updateTaskIndexForSingleTask()の実装が非効率な場合、フェーズ遷移のたびにファイルI/Oが発生してレスポンス時間が増加する。
対策: task-index.jsonの読み込みと書き込みを1回ずつに抑え、O(1)の時間計算量で実装する。
対策: パフォーマンステストで1000タスク環境での実行時間を測定し、10ms以内に収まることを確認する。
対策: 必要に応じてインメモリキャッシュを追加し、連続するフェーズ遷移でのファイルI/O回数を削減する。
影響度: 低(10ms程度の増加は許容範囲)、発生確率: 低(実装は軽量)。

## 関連ファイル

### 修正対象ファイル

- `workflow-plugin/mcp-server/src/state/manager.ts`: updateTaskIndexForSingleTask()メソッド追加
- `workflow-plugin/mcp-server/src/phases/next.ts`: フェーズ遷移後のtask-index.json即時更新呼び出し追加
- `workflow-plugin/hooks/phase-edit-guard.js`: B-2チェックをbash-whitelistより前に移動
- `workflow-plugin/hooks/discover-tasks.js`: TASK_INDEX_TTL短縮(REQ-4採用時)

### 参照ファイル

- `workflow-plugin/mcp-server/src/state/workflow-state.ts`: WorkflowStateインターフェース定義
- `workflow-plugin/hooks/task-cache.js`: メモリキャッシュの実装
- `workflow-plugin/mcp-server/tests/integration/workflow.test.ts`: フェーズ遷移テスト
- `workflow-plugin/hooks/test/phase-edit-guard.test.js`: hookロジックテスト

## 依存関係

### 技術依存

- Node.js fs.promises API: task-index.jsonのアトミック更新に使用
- ファイルロック機構: 排他制御のためのlockfileパッケージまたはネイティブAPIを使用
- 既存のstateManagerインフラ: saveState()と同様のエラーハンドリングを適用
- MCPプロトコル: 既存のAPI仕様を維持し、内部実装のみ修正
- hook実行環境: Bash環境でのファイルI/Oパフォーマンス

### スケジュール依存

- research/requirementsフェーズ完了後にplanning開始可能
- test_implフェーズでの新規テスト追加が実装の前提条件
- 既存テスト772件の全通過確認が完了基準
- リグレッションテスト実施がdeploy前の必須条件
- ドキュメント更新が完了してからユーザー展開可能

## 付録

### 用語集

- task-index.json: hookのパフォーマンス向上のためのキャッシュファイル、全タスクのフェーズ情報を含む
- workflow-state.json: MCP serverが管理する個別ワークフローの状態ファイル、HMAC署名付き
- TTL (Time To Live): キャッシュの有効期限、現行は1時間で設定されている
- B-2チェック: phase-edit-guard.jsのcommit/push/ci_verification/deployフェーズでのgit操作許可ロジック
- bash-whitelist: 各フェーズで許可されるBashコマンドのホワイトリスト
- saveTaskIndex(): MCP serverのmanager.tsにあるtask-index.json更新メソッド、discoverTasks()を呼ぶ重い処理
- レースコンディション: 複数プロセスが同時にファイルを更新しようとして不整合が起きる状態

### 参考資料

- docs/workflows/task-index-jsonキャッシュ同期の根本原因修正/research.md: 調査結果の詳細
- workflow-plugin/mcp-server/README.md: MCP serverのアーキテクチャ説明
- workflow-plugin/hooks/README.md: hookシステムの設計思想
- CLAUDE.md: ワークフロープラグインの全体仕様
- .claude/state/audit-log.jsonl: 過去のワークフロー実行履歴(デバッグ用)
