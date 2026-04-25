# Planning

## background
hook-MCP state sync修正の実装プランを具体化する。single PR でアトミック適用、legacy JSON互換維持、bootstrap削除を含む。

## workBreakdown
### step1_mcpConfig
- .mcp.jsonのenv.STATE_DIRを絶対パス相当の記述に変更、またはstart.sh内で絶対化
- 変更対象: .mcp.json のharnessエントリ
- 検証: MCP再起動後にecho $STATE_DIR で絶対パスが出ること

### step2_startShell
- start.sh内でSTATE_DIRが相対値の場合に $(cd -- "${STATE_DIR}" && pwd -P) で絶対化
- POSIX/Windows bash両対応
- 変更対象: workflow-harness/mcp-server/start.sh
- 検証: printenv STATE_DIR が絶対パス

### step3_hookToonReader
- hook-utils.jsに新関数 readToonPhase(filePath) を追加
- 実装: fs.readFileSync(先頭64KB) → /^phase:\s*(\w+)/ で抽出
- 既存関数 getActivePhaseFromWorkflowState を拡張し、同ディレクトリの.jsonと.toonの両方を走査

### step4_hookIntegration
- tool-gate.js の呼び出し部は関数シグネチャ無変更なので手を入れない
- getActivePhaseFromTaskIndex も既存動作のまま

### step5_adrDraft
- docs/adr/ADR-029-hook-mcp-state-sync.md を新規作成
- 項目: Status / Context / Decision / Consequences / References
- 最後にbootstrap削除の日時を記録

### step6_cleanup
- .claude/state/workflows/30fba95f-c396-4427-ba30-125b308ee3cb_fix-hook-mcp-state-sync/ ディレクトリ削除
- .claude/state/task-index.json の該当activeエントリ削除

### step7_unitTests
- workflow-harness/hooks/__tests__/hook-utils.test.js に以下を追加:
  - readToonPhase が正しいphase値を返す
  - 不正なTOON入力でundefinedを返す
  - getActivePhaseFromWorkflowState が.toon単独ディレクトリでもphase取得

### step8_manualVerification
- 新規harness_startしてworkerがWrite可能になることを手動確認
- 既存のJSON形式workflow-state.jsonディレクトリも引き続きactive認識されることを確認

## dependencies
- step1 → step2 （envとstart.shは連動）
- step3 → step4 （関数シグネチャ維持確認）
- step7 → step3 （TDDならstep7→3の順。本タスクは既存コードベースのテストが薄いのでunit追加を並行）
- step6 → step1-5全て完了後（bootstrap削除は修正完了確認後）

## decisions
- D-001: TOONパーサはphase行限定の最小実装とし、外部依存を増やさない
- D-002: STATE_DIR絶対化はstart.sh側で pwd -P により実施しWindows/POSIX差異を吸収
- D-003: 単一PRでstep1-7を同時にマージし、step8の手動検証を経てmerge承認する
- D-004: bootstrap削除(step6)は他stepの実装完了・hook動作確認後にrequirementsゲート通過の最後に実施
- D-005: legacy JSON読み取りは既存関数を温存し、TOON読み取りを追加するだけの互換実装とする
- D-006: 本修正でtool-gate.jsの既存シグネチャは一切変更しない

## artifacts
- 本ドキュメント planning.md
- 次フェーズ design への入力
- 将来コミット対象: .mcp.json, start.sh, hook-utils.js, ADR-029, hook-utils.test.js

## next
- design フェーズへ進み関数シグネチャやデータフロー図を確定する
- test_design へ進み各ACに対応するテストケースを定義する
- 特にreadToonPhaseの契約テストケースを明文化する

## constraints
- 各ソース200行以内
- 既存legacy state温存
- 外部ライブラリ追加なし
- L1-L4決定的ゲートのみ
- 単一PR原則
