# Test Design

## background
hook-MCP state sync修正の各ACに対応するテストケースを定義する。単体テストは workflow-harness/hooks/__tests__/hook-utils.test.js を対象、統合テストは手動検証手順として記述する。

## testStrategy
- unit: readToonPhase と getActivePhaseFromWorkflowState の新旧分岐を網羅
- integration: 新規harness_start → worker Write成功の end-to-end 手動確認
- regression: 既存のJSON経路がリグレッションしていないことをテストで担保
- performance: hook呼び出し1回あたりのレイテンシを計測、10ms未満を目標

## testCases
### AC-1: bootstrap不要でWrite可能
- TC-AC1-01: 新規harness_start直後に hearing.md へ worker Write が成功する (integration, manual)
- TC-AC1-02: bootstrap ディレクトリが存在しない状態で getActivePhaseFromWorkflowState が active phase を返す (unit)

### AC-2: TOONからphase抽出
- TC-AC2-01: phase行を含むworkflow-state.toonから readToonPhase が phase値を返す (unit)
- TC-AC2-02: phase行無しのTOONで readToonPhase が undefined を返す (unit)
- TC-AC2-03: 不正なTOON（非UTF-8バイナリ）で readToonPhase が例外を投げず undefined を返す (unit)
- TC-AC2-04: 先頭64KB超過ファイルでも早期returnで応答が1ms未満 (performance)

### AC-3: STATE_DIR絶対化
- TC-AC3-01: start.sh 起動後の printenv STATE_DIR が絶対パスで出力される (integration, manual)
- TC-AC3-02: MCPサーバ起動時に二重ネストディレクトリが新規作成されない (integration, manual)

### AC-4: legacy JSON互換
- TC-AC4-01: 既存の workflow-state.json があるディレクトリで getActivePhaseFromWorkflowState が従来通り phase を返す (unit, regression)
- TC-AC4-02: JSON と TOON が同ディレクトリに共存する場合、JSON優先で phase を返す (unit)

### AC-5: ADR-029新規
- TC-AC5-01: docs/adr/ADR-029-hook-mcp-state-sync.md ファイルが存在する (integration, manual)
- TC-AC5-02: ADR-029 に Status/Context/Decision/Consequences/References セクションが含まれる (integration, manual)

## acTcMapping
- AC-1 → TC-AC1-01, TC-AC1-02
- AC-2 → TC-AC2-01, TC-AC2-02, TC-AC2-03, TC-AC2-04
- AC-3 → TC-AC3-01, TC-AC3-02
- AC-4 → TC-AC4-01, TC-AC4-02
- AC-5 → TC-AC5-01, TC-AC5-02

## testDataFixtures
- fixtureToon1: 正常 phase:hearing 含む
- fixtureToon2: phase行なし
- fixtureToon3: 64KB超過で先頭にphase:implementation
- fixtureJson1: 既存形式 {"phase":"requirements"}

## decisions
- D-001: unit testは vitest または既存テストフレームワーク（hook-utils.test.js の流儀）に合わせる
- D-002: integration testは自動化せず手動チェックリスト化し、manual-test.md に記録する
- D-003: readToonPhaseのDoS耐性は performance ケース TC-AC2-04 で1ms以内を契約とする
- D-004: AC→TC は 1対N マッピングとし、各AC最低2ケース確保する
- D-005: regression は AC-4 相当を必須とし、legacy JSON経路をリグレッションさせない
- D-006: テストfixtureは hook-utils.test.js 内のインラインリテラルで管理し、外部ファイル依存を増やさない

## artifacts
- 本ドキュメント test-design.md
- 次フェーズ test_implementation への入力
- 将来作成: workflow-harness/hooks/__tests__/hook-utils.test.js の追記分

## next
- test_implementation フェーズへ進み、上記TCをコード化する
- Red段階として最初はstubで失敗させる（TDD Red）
- harness_record_test_result で exitCode=1 証跡を残す

## constraints
- 既存テストフレームワークを踏襲
- 外部ライブラリ追加なし
- 手動テストはmanual-test.mdに集約
- L1-L4決定的ゲートのみ
