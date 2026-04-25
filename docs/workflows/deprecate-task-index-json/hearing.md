phase: hearing
status: complete
summary: hookのtask-index.json依存を廃してtask-index.toonを単一真実源にする最小変更の計画を確定
userResponse: orchestrator経由でユーザーから最小変更パスでD-HR-1〜D-HR-7を全承認、planning phaseへ進むとの回答を取得済み(hearing approval gate完了、approved=true)

intent-analysis:
  surfaceRequest: task-index.jsonを廃止しhook-utils.jsをparseTaskIndex()経由でtask-index.toon読みに切替える
  deepNeed: MCP writerとhook readerが別ファイルを参照しているdriftの構造的解消と手動同期運用の恒久排除
  rootCause: MCP serverはtask-index.toon書き込み、hookはtask-index.json読み込み、JSONはEdit手動同期で維持されるlegacy経路
  readerSurface: workflow-harness/hooks/hook-utils.js:22-31のgetActivePhaseFromTaskIndexが唯一のreader、getCurrentPhase経由で全PreToolUse発火点に伝搬
  writerSurface: workflow-harness/mcp-server/src/state/index-toon-io.ts の serializeTaskIndex/parseTaskIndex がMCP側writer兼parser
  scopeConfirmed: hook-utils.js改修, task-index.json削除, __tests__/配下にテスト追加の3点のみ
  assumptions:
    - hookはCommonJS(require)でparseTaskIndex()(ESM)を同期requireできないため等価な軽量parserをhook側に内蔵する
    - task-index.toonのスキーマはtasks[N]{taskId,taskName,phase,size,status}:ヘッダ+CSV行に固定と扱う
    - 非activeタスクはstatus!=="completed" && status!=="idle"で判定する現行意味論を維持する
    - workflow-state.tooncfallbackは温存しMCP未起動や書込中の一時null回避に使う
  unclearPointsResolved:
    - parser戦略: inline軽量CJS parser採用(ESM dynamic importはhook全面async化を招く)
    - fallback順序: task-index.toon → workflow-state(.json/.toon)の二段を維持
    - latency予算: 5ms未満(hot-path PreToolUse全呼び出しに発火するため)
    - テスト粒度: unit(parser)+integration(getCurrentPhase合成路)の2層
  userResponse: orchestrator経由でユーザーから「最小変更パスでD-HR-1〜D-HR-7を全承認、planning phaseへ進む」の回答を取得済み（hearing approval gate完了、approved=true）
  intentAccuracyContract: MCP側書き込み直後にhook側readが同一ファイルを返し、phase遷移後の次tool呼び出しで新phaseが反映される観測可能契約

implementation-plan:
  approach: getActivePhaseFromTaskIndexをtask-index.toon用inlineparserで書き換え、JSONファイル・JSON.parse依存を除去、既存readToonPhase/workflow-state fallbackは温存
  parserShape: readTaskIndexToon(projectRoot)関数を追加、fs.readFileSyncで.toon読み、正規表現でtasks[N]{columns}:ヘッダ抽出、続く非空インデント行をCSV分割し列マッピング、tasks配列返却
  headerRegex: /^tasks\[(\d+)\]\{([^}]+)\}:\s*$/m で列名とレコード数を取得、列名はsplit(",").map(trim)
  rowParse: ヘッダ直後から空白/末端まで、カンマ分割+列数一致検査、不一致はskipし警告を出さない(silentfallbackでhook安定優先)
  bypassPathMaint: isBypassPathは既存仕様で.claude/state/配下をbypass済のため追加変更不要
  filesTouched:
    - workflow-harness/hooks/hook-utils.js
    - workflow-harness/hooks/__tests__/hook-utils.test.js
    - .claude/state/task-index.json
  estimatedScope: 実装15-20行追加/10行削除、テスト30-40行追加、JSONファイル削除1件
  risks:
    - inlineparserがMCP側TOON出力フォーマット変更に追随できずドリフトするリスクは低いが監視必要
    - hot-path性能がPreToolUseでcumulativeに効くためregexベース実装を厳守しfsreadは4KB頭部優先
    - task-index.toon不在時nullを返しworkflow-state fallbackが作動、そこも不在ならphase未検出でtool-gateがpermissive化する既存挙動を維持
    - JSON削除のタイミングでgit未追跡状態のCI/別workflow参照が残っていないか事前検索で確認
  openQuestions:
    - orchestrator側が異なるparser戦略を希望する場合planningで再交渉する余地あり
    - latency予算5ms未満が厳しい場合20msまで緩和しdynamic import採用も検討可能
  securityPosture: TOON解析失敗時nullを返しworkflow-state経路へ委譲、solicit入力に対しregexはグリーディ無制限繰返しを避けバウンデッドとする
  performanceContract: p95で1回あたり2ms未満、最悪5ms未満、fs.readFileSyncは既存readToonHeadFromFile相当の4KB頭部限定読みを再利用する余地あり

decisions:
  - D-HR-1 inline軽量CJS parserをhook-utils.js内に実装する :reason @toon-format/toonはESM-only、hookをasync化するとPreToolUse全経路の改修とcoldstart30-50msが発生し最小変更原則に反するため
  - D-HR-2 fallbackはtask-index.toon→workflow-state(.json/.toon)の二段を維持する :reason MCP未起動や書込中の一時的null読みに対する耐性を保ちtool-gate securityの退行を防ぐため
  - D-HR-3 hot-path性能予算を5ms未満に設定する :reason PreToolUseはworkerのRead/Edit/Bash/Glob各呼び出しで発火しcumulative latencyがユーザ体感に直結するため
  - D-HR-4 テストはunit(parser純関数)+integration(getCurrentPhase合成)の二層で構成する :reason unit単独ではfallback連鎖の回帰検知が弱く、benchmarkは事前合意でスコープ外のため
  - D-HR-5 JSONファイルとgetActivePhaseFromTaskIndex内のJSON.parse依存は同一コミットで削除する :reason 新旧二系統の並存はdriftを残し本タスクの目的に反するため一括切替が妥当
  - D-HR-6 task-index.toonのスキーマ変更耐性はparseの列名マッピングで吸収する :reason MCP側がカラム追加してもhook側は必要な列(phase,status)のみ抽出し前方互換を保てるため
  - D-HR-7 task-index.toon parse失敗時は例外を外へ漏らさずnull返却する :reason hook例外はtool呼び出しをhardfailさせユーザ作業を止めるため既存readToonPhaseと同じsilent degradation規範に揃える

artifacts:
  - path: C:\ツール\Workflow\docs\workflows\deprecate-task-index-json\hearing.md
    role: hearing成果物
    summary: 採用する実装戦略と意思決定7件を確定しplanning phaseへの入力とする
  - path: C:\ツール\Workflow\workflow-harness\hooks\hook-utils.js
    role: 改修対象
    summary: getActivePhaseFromTaskIndexをtoonreaderへ差し替え、json依存を除去する
  - path: C:\ツール\Workflow\workflow-harness\mcp-server\src\state\index-toon-io.ts
    role: 参照仕様
    summary: MCP側writerのスキーマとparseTaskIndex意味論の参照元、hook側parserはこれと等価な読みをする
  - path: C:\ツール\Workflow\.claude\state\task-index.toon
    role: 単一真実源
    summary: 本タスク後はhook側も本ファイルを直接読みMCP writerと同期する
  - path: C:\ツール\Workflow\.claude\state\task-index.json
    role: 削除対象
    summary: legacyファイル、実装コミットと同一でrm、gitignore追加は不要

next:
  criticalDecisions:
    - D-HR-1 parser戦略inline採用はplanningで覆す場合dynamicimportへ切替、latency予算もD-HR-3を20ms未満へ緩和する必要あり
    - D-HR-5 json削除のatomicityはscope_definition phaseでAC化し実装phaseで検証する
  readFiles:
    - C:\ツール\Workflow\workflow-harness\hooks\hook-utils.js
    - C:\ツール\Workflow\workflow-harness\mcp-server\src\state\index-toon-io.ts
    - C:\ツール\Workflow\workflow-harness\hooks\__tests__\hook-utils.test.js
    - C:\ツール\Workflow\.claude\state\task-index.toon
  warnings:
    - AskUserQuestionがsubagent内で不可のため主要4判断をD-HR-1〜D-HR-4として既定確定、orchestrator承認が必要
    - hooks/配下はCommonJSのままでありESM移行は本タスクのスコープ外
    - task-index.json参照を含むdocs(phase-guide-enhancement.md等)は本タスクでは変更せずfollow-upで整合を取る

## decisions
- D-HR-1: inline軽量CJS parserをhook-utils.js内に実装する (理由: @toon-format/toonはESM-only、async化はhot-path 30-50ms cold-start)
- D-HR-2: fallback二段維持 — task-index.toon → workflow-state(.json/.toon) (理由: MCP未起動時の耐性)
- D-HR-3: hot-path latency budget 5ms未満 (理由: PreToolUse全呼び出しに発火)
- D-HR-4: テストはunit(parser純関数)+integration(getCurrentPhase合成)の二層 (理由: fallback連鎖の回帰検知)
- D-HR-5: JSONファイルとJSON.parse依存は同一コミットで削除 (理由: drift排除目的)
- D-HR-6: 列名マッピングでスキーマ前方互換確保 (理由: MCP側カラム追加耐性)
- D-HR-7: parse失敗時はnull返却し例外伝播させない (理由: hookがhardfailするとtool呼び出し全停止)

## artifacts
- C:\ツール\Workflow\docs\workflows\deprecate-task-index-json\hearing.md (hearing成果物)
- C:\ツール\Workflow\workflow-harness\hooks\hook-utils.js (改修対象)
- C:\ツール\Workflow\workflow-harness\mcp-server\src\state\index-toon-io.ts (参照仕様)
- C:\ツール\Workflow\.claude\state\task-index.toon (新しい単一真実源)
- C:\ツール\Workflow\.claude\state\task-index.json (削除対象)

## next
- criticalDecisions: D-HR-1 parser戦略はplanningで覆す場合dynamic import切替/D-HR-5 json削除のatomicityはscope_definition phaseでAC化
- readFiles: hook-utils.js, index-toon-io.ts, hook-utils.test.js (新規), task-index.toon
- warnings: AskUserQuestionがsubagent内で不可のため主要4判断をD-HR-1〜D-HR-4として既定確定済み (orchestrator承認済)
