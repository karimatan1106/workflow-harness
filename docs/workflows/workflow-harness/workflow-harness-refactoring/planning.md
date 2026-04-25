phase: planning
task: workflow-harness-refactoring
status: complete
inputArtifacts: [requirements.md, threat-model.md, research-analysis.md]

scope: 6機能要件(F-001〜F-006)の実装計画。削除先行で依存を減らし、正規化、インターフェース更新、構造化の順に進行する。

## decisions

- PL-D1: リファクタリング順序は「削除 -> 正規化 -> インターフェース -> 構造化 -> 検証」とする。削除(PL-01〜PL-04)で不要コードを先に除去し、後続ステップの変更対象を最小化する(REQ-02/IA-05根拠)
- PL-D2: PL-01(vscode-ext削除)とPL-03(hookバックアップ削除)とPL-04(デッドコード削除)は相互依存なく並列実行可能。ただしサブモジュール内操作のためコミット順序に注意(NF-004)
- PL-D3: Serena MCPサーバー化(PL-06)は.mcp.jsonへのエントリ追加とテンプレート内CLIコマンド書換の2段階で実施。cwdをプロジェクトルートに限定しワークスペーススコープを制御する(TM-D1/SR-1)
- PL-D4: hookバックアップ削除(PL-03)はワイルドカード不使用。4ファイルを個別指定で削除し、削除後に稼働hookファイル5件の存在を検証する(TM-D2/SR-2/TM-04緩和)
- PL-D5: hearing dodChecks追加(PL-05)はregistry.tsのdodChecks配列にインラインチェック関数を追加する方式(選択肢A)を採用。全31フェーズで初のdodChecks利用事例のため単体動作確認を先行する(REQ-04/TM-D5)
- PL-D6: small/mediumデッドコード削除(PL-04)後はTypeScriptコンパイルと文字列grep検索の二重検証で残存参照を排除する(TM-D4/SR-3)
- PL-D7: defs-stage1.ts(現202行)のSerenaテンプレート書換時に200行制限超過リスクあり。CLI記法をMCPツール記法に置換する際に行数が増えないよう記述を簡潔化する。超過時はファイル分割で対応(REQ-05/NF-003)

implementationSteps[10]:
  - id: PL-01
    description: vscode-ext/ディレクトリ全削除
    target: workflow-harness/vscode-ext/
    req: F-001
    ac: AC-1
    dependsOn: none (初期ステップ、前提条件なし)
    risk: low (ディレクトリ削除のみ)
    threat: TM-03
    verification: ls workflow-harness/vscode-ext/ が失敗すること

  - id: PL-02
    description: vscode-ext参照の除去 - STRUCTURE_REPORT.md L38およびL140-L148
    target: workflow-harness/STRUCTURE_REPORT.md
    req: F-001
    ac: AC-1
    dependsOn: PL-01
    risk: low (ドキュメント内テキスト削除のみ)
    threat: TM-03
    verification: grep -r vscode-ext workflow-harness/ がSTRUCTURE_REPORT.md以外ヒットなし、かつSTRUCTURE_REPORT.md内でもヒットなし

  - id: PL-03
    description: hooks/バックアップファイル4件を個別指定で削除
    target: [workflow-harness/hooks/pre-tool-guard.sh.bak2, workflow-harness/hooks/pre-tool-guard.sh.bak3, workflow-harness/hooks/pre-tool-guard.sh.disabled, workflow-harness/hooks/test-guard.sh.bak4]
    req: F-002
    ac: AC-2
    dependsOn: none
    risk: low (PL-01と並列可)
    threat: TM-04
    verification: 4ファイル不在かつ稼働hook5ファイル(pre-tool-guard.sh, test-guard.sh, hook-utils.js, block-dangerous-commands.js, context-watchdog.js, loop-detector.js, session-boundary.js, tool-gate.js)の存在確認

  - id: PL-04
    description: defs-a.tsのTaskSize型からsmall/medium削除、SIZE_SKIP_MAP/SIZE_MINLINES_FACTOR/getActivePhases/getPhaseConfigのsmall/medium分岐除去
    target: [workflow-harness/mcp-server/src/phases/defs-a.ts, workflow-harness/mcp-server/src/phases/registry.ts]
    req: F-006
    ac: AC-6
    dependsOn: none (並列可)
    risk: medium (型定義変更による既存コードへの影響)
    threat: TM-05
    verification: grep -r "small\|medium" defs-a.ts registry.ts で該当なし、npm run build成功

  - id: PL-05
    description: hearing dodChecks追加 - registry.tsのhearing定義にuserResponse存在チェックを追加
    target: workflow-harness/mcp-server/src/phases/registry.ts
    req: F-004
    ac: none (dodChecks動作はAC-3/AC-4で間接検証)
    dependsOn: PL-04
    risk: medium (初のdodChecks利用で動作未検証)
    threat: TM-07
    verification: npm run buildとvitest通過

  - id: PL-06
    description: Serena MCPサーバー設定 - .mcp.jsonにserenaエントリ追加、defs-stage1.tsのCLIコマンドをMCPツール形式に書換
    target: [.mcp.json, workflow-harness/mcp-server/src/phases/defs-stage1.ts]
    req: F-005
    ac: AC-5
    dependsOn: none (独立タスク、他ステップと並列実行可)
    risk: medium (MCP設定変更とテンプレート書換の二段階操作)
    threat: TM-01, TM-02
    verification: .mcp.jsonにserenaキー存在、defs-stage1.tsが200行以下

  - id: PL-07
    description: スキルドキュメント更新 - workflow-orchestrator.md L27-L28/L101をcoordinator直接取得に更新、workflow-execution.md L71更新
    target: [.claude/skills/workflow-harness/workflow-orchestrator.md, .claude/skills/workflow-harness/workflow-execution.md]
    req: F-003
    ac: AC-8
    dependsOn: PL-05, PL-06
    risk: low (スキルドキュメントのテキスト更新のみ)
    threat: none (ドキュメント更新のみ、実行系への影響なし)
    verification: workflow-orchestrator.mdにcoordinator直接取得の記述が存在すること

  - id: PL-08
    description: query/registration MCPツールのsubagent開放確認 - tool-gate.js L48-L56の動作確認、ドキュメント整合性チェック
    target: [workflow-harness/hooks/tool-gate.js]
    req: F-003
    ac: AC-7
    dependsOn: PL-07
    risk: low (コード変更なし、動作確認のみ)
    threat: none (コード変更なし、既存動作の確認のみ)
    verification: coordinatorからharness_get_subphase_template呼び出しがtool-gateで許可されていること(RD-05確認済み、コード変更なし)

  - id: PL-09
    description: ビルド検証 - npm run build実行
    target: workflow-harness/mcp-server/
    req: NF-001
    ac: AC-3
    dependsOn: PL-01, PL-02, PL-03, PL-04, PL-05, PL-06, PL-07, PL-08
    risk: low (全変更完了後のビルド検証)
    threat: TM-05
    verification: exit code 0

  - id: PL-10
    description: テスト実行 - vitest
    target: workflow-harness/mcp-server/
    req: NF-002
    ac: AC-4
    dependsOn: PL-09
    risk: low (ビルド成功後のテスト実行のみ)
    threat: none (テスト実行のみ、成果物への変更なし)
    verification: vitest pass rate 100%

executionGroups:
  group1-parallel: [PL-01, PL-03, PL-04, PL-06]
  group2-sequential: [PL-02] (after PL-01)
  group3-sequential: [PL-05] (after PL-04)
  group4-sequential: [PL-07] (after PL-05, PL-06)
  group5-sequential: [PL-08] (after PL-07)
  group6-verification: [PL-09, PL-10] (after all)

rtm[8]:
  - {step: PL-01/PL-02, req: F-001, ac: AC-1, verification: vscode-ext/不在}
  - {step: PL-03, req: F-002, ac: AC-2, verification: バックアップファイル不在}
  - {step: PL-04, req: F-006, ac: AC-6, verification: small/mediumなし}
  - {step: PL-05, req: F-004, ac: none, verification: ビルド/テスト通過}
  - {step: PL-06, req: F-005, ac: AC-5, verification: serenaキー存在}
  - {step: PL-07, req: F-003, ac: AC-8, verification: coordinator直接取得記述}
  - {step: PL-09, req: NF-001, ac: AC-3, verification: build成功}
  - {step: PL-10, req: NF-002, ac: AC-4, verification: test成功}

architectureDecisions[3]:
  - {id: AD-1, decision: Serena MCPサーバー化, rationale: CLI直接呼び出しはhookのBash制限と競合する。MCPプロトコル経由にすることでtool-gateの統一制御下に置ける, traceability: F-005/TM-01/TM-02}
  - {id: AD-2, decision: subagentのMCPツール分類, rationale: lifecycle系(harness_start/advance/complete)はオーケストレーター専用、query/registration系(harness_get_subphase_template等)はsubagent開放。tool-gate.js L48-L56で既に実装済み, traceability: F-003/RD-05/AC-7}
  - {id: AD-3, decision: リファクタリング順序は削除先行, rationale: 不要コード(vscode-ext/バックアップ/デッドコード)を先に除去することで後続ステップの変更対象ファイル数と行数を減らし、200行制限超過リスクを低減する, traceability: REQ-02/NF-003}

submoduleStrategy: サブモジュール(workflow-harness/)内の変更(PL-01〜PL-06)はサブモジュール側で先にコミットし、親リポジトリで参照を更新する(NF-004)。親リポジトリの変更(PL-07の.claude/skills/配下)は親側でコミットする。

## artifacts

- docs/workflows/workflow-harness-refactoring/planning.md, plan, 実装計画(10ステップ/5実行グループ/3アーキテクチャ決定)

## next

- workerへの委譲順序: group1(PL-01/PL-03/PL-04/PL-06並列) -> group2(PL-02) -> group3(PL-05) -> group4(PL-07) -> group5(PL-08) -> group6(PL-09/PL-10)
- criticalPath: PL-04 -> PL-05 -> PL-07(hearing dodChecks追加がスキルドキュメント更新の前提)
- warnings: defs-stage1.ts(202行)のSerena書換時に200行制限注意(PL-D7)。hookバックアップ削除は個別指定厳守(PL-D4)。サブモジュールコミット順序に注意(NF-004)
