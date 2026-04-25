phase: test-design
task: workflow-harness-refactoring
status: complete
inputArtifacts: [planning.md, requirements.md]

scope: 6機能要件(F-001〜F-006)と2非機能要件(NF-001〜NF-002)に対するテスト設計。既存vitestテスト全通過を主軸とし、新規テスト追加はスコープ外。

## testStrategy

approach: 既存vitestテスト全通過を基本方針とする。削除モジュール(vscode-ext/, small/medium分岐)に依存するテストは実装フェーズで修正する。新規テストは追加しない(NOT_IN_SCOPE)。
environment: Node.js + vitest、workflow-harness/mcp-server/配下
executionTiming: 全実装ステップ(PL-01〜PL-08)完了後にPL-09(build)、PL-10(test)で一括検証

## acTcMatrix

acTcMapping[8]:
  - ac: AC-1
    tcId: TC-AC1-01
    testContent: vscode-ext/ディレクトリが存在しないことを確認
    testType: filesystem
    verificationMethod: ls workflow-harness/vscode-ext/ が失敗すること
    relatedSteps: [PL-01, PL-02]
    req: F-001

  - ac: AC-2
    tcId: TC-AC2-01
    testContent: hooks/配下に.bak/.disabledファイルが存在しないことを確認
    testType: filesystem
    verificationMethod: glob hooks/*.bak* hooks/*.disabled が空
    relatedSteps: [PL-03]
    req: F-002

  - ac: AC-3
    tcId: TC-AC3-01
    testContent: npm run build がexit code 0で完了
    testType: build
    verificationMethod: npm run build の実行結果
    relatedSteps: [PL-09]
    req: NF-001

  - ac: AC-4
    tcId: TC-AC4-01
    testContent: npx vitest run が全テスト通過
    testType: test
    verificationMethod: vitest の実行結果(pass rate 100%)
    relatedSteps: [PL-10]
    req: NF-002

  - ac: AC-5
    tcId: TC-AC5-01
    testContent: .mcp.jsonにserena MCPサーバーエントリが存在
    testType: config
    verificationMethod: .mcp.json内のserenaキー存在確認
    relatedSteps: [PL-06]
    req: F-005

  - ac: AC-6
    tcId: TC-AC6-01
    testContent: defs-a.tsのsize enumにsmall/mediumが含まれない
    testType: grep
    verificationMethod: grep 'small' defs-a.ts が空
    relatedSteps: [PL-04]
    req: F-006

  - ac: AC-7
    tcId: TC-AC7-01
    testContent: coordinator.md/worker.mdのtools行にBashがない
    testType: grep
    verificationMethod: grep 'Bash' coordinator.md worker.md が空
    relatedSteps: none (実施済み確認のみ)
    req: confirmed

  - ac: AC-8
    tcId: TC-AC8-01
    testContent: workflow-orchestrator.mdにテンプレート直接取得の記述がある
    testType: grep
    verificationMethod: grep 'harness_get_subphase_template' workflow-orchestrator.md が非空
    relatedSteps: [PL-07]
    req: F-003

## testExecutionOrder

executionSequence[3]:
  - phase: 1-filesystem-checks
    tests: [TC-AC1-01, TC-AC2-01]
    timing: PL-01〜PL-03完了直後
    description: 削除対象のファイル/ディレクトリ不在を確認

  - phase: 2-content-checks
    tests: [TC-AC5-01, TC-AC6-01, TC-AC7-01, TC-AC8-01]
    timing: PL-04〜PL-08完了直後
    description: ファイル内容の正規化/更新結果を確認

  - phase: 3-integration-checks
    tests: [TC-AC3-01, TC-AC4-01]
    timing: 全ステップ完了後(PL-09/PL-10)
    description: ビルドとテストの統合検証

## edgeCases

- EC-01: Serena MCP追加後に既存ハーネスMCPと競合しないか確認。.mcp.jsonに複数MCPサーバーエントリが共存する構成で、mcpServersキー配下のserenaエントリが他エントリと名前衝突しないことを目視確認する
- EC-02: small/medium削除後にvitest内でこれらの値を参照するテストケースが存在する場合、テストファイルの修正が必要。REQ-06に基づきIA-04で特定済みの5テストファイルを対象に確認する
- EC-03: defs-stage1.tsのSerenaテンプレート書換で200行を超過した場合、ファイル分割で対応する(PL-D7)

## testModificationPolicy

policy: 削除されたモジュール(vscode-ext/, small/medium)への参照を含む既存テストは実装フェーズで修正する
newTestCreation: スコープ外(NOT_IN_SCOPEに明記)
modificationCriteria: TypeScriptコンパイルエラーまたはvitest実行時エラーが発生するテストのみ修正対象

## decisions

- TD-01: テスト戦略は既存vitest全通過を主軸とし、新規テスト追加はスコープ外とする。リファクタリングの性質上、既存テストが回帰検証として十分機能するため(REQ-06/NF-002)
- TD-02: AC-1〜AC-8の全受入基準に対して1対1のテストケース(TC-AC1-01〜TC-AC8-01)を定義する。各テストケースは単一の検証手段で判定可能(L1-L3チェック)
- TD-03: テスト実行は3フェーズ(filesystem -> content -> integration)の順序で行う。早期フェーズの失敗で後続を中断し、原因特定を容易にする
- TD-04: EC-02(small/medium参照テスト)の修正はPL-04実装時にworkerが対応する。修正内容はsmall/mediumリテラルの削除またはlargeへの置換に限定する
- TD-05: Serena MCP競合確認(EC-01)は.mcp.jsonの構造的検査(JSONパース+キー一意性)で行う。ランタイム検証は実装フェーズのビルド/テストで間接的にカバーする

## artifacts

- docs/workflows/workflow-harness-refactoring/test-design.md, test, テスト設計書(AC-TC追跡マトリクス/3フェーズ実行順序/エッジケース3件/テスト修正ポリシー)

## next

- 実装フェーズでgroup1(PL-01/PL-03/PL-04/PL-06)を並列実行後、TC-AC1-01/TC-AC2-01で削除検証を先行する
- small/medium削除(PL-04)後にEC-02の該当テストファイル修正が必要になる可能性あり
- 全ステップ完了後にTC-AC3-01(build)/TC-AC4-01(vitest)で統合検証を実施する
