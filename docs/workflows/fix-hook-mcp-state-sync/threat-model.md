# Threat Model

## background
hook-MCP state sync修正に伴うセキュリティ/運用リスクをSTRIDE分析で棚卸しする。対象は state ファイルの読み書きパス解決、TOON パーサ、bootstrap 手順の削除。

## assets
- parent/.claude/state/task-index.json: ワークフロー進行管理の中枢情報
- workflow-state.json / workflow-state.toon: 各タスクのフェーズ・セッショントークン
- .mcp.json: MCPサーバの起動設定
- start.sh: MCPサーバ起動スクリプト
- hook-utils.js: L3ワーカーの権限制御ロジック

## trustBoundaries
- 開発者マシン内ローカルファイルシステム境界
- MCPサーバプロセス↔ hookプロセス間の共有ファイル境界
- submodule↔ 親リポ間の状態共有境界

## strideAnalysis
### spoofing
- 攻撃者が任意のworkflow-state.toonを偽造し、実在しないタスクをactive扱いさせる可能性 (実現性: low、ローカルFS書き込み権限必要)
- 対策: hookはactiveタスク一覧をtask-index.json経由で二重照合する既存動作を維持

### tampering
- 攻撃者がTOONパーサの脆弱な正規表現を突いて意図しないphase値を読ませる可能性 (実現性: low)
- 対策: phase行は `phase: <literal>` 固定書式に限定し、バリデーションで既知フェーズ名セットに限定する

### repudiation
- bootstrap削除後に「bootstrap操作の痕跡」が消え、過去の手動介入が追跡不能 (影響: low)
- 対策: ADR-029に手動bootstrapの履歴と最終削除日を記載する

### informationDisclosure
- 二重ネストパス解消により新規stateは単一箇所に集約されるが、既存nested stateに機微情報は含まれないため影響なし
- 対策: なし

### denialOfService
- TOONパーサが大きなファイルでハングする可能性 (実現性: low)
- 対策: 読み取りは先頭64KBに制限、phase行発見時に早期return

### elevationOfPrivilege
- hookの読み取り経路追加により、誤ってL1層がWrite可能に誤判定されるリスク (実現性: low)
- 対策: getActivePhaseFromWorkflowStateの戻り値型と既存判定条件を変更せず、TOON読み取り成功時も同一セマンティクスで返す

## decisions
- D-001: TOONパーサは phase行のみを抽出する最小実装とし、任意のキーを読めるフルパーサは実装しない
- D-002: phase値のバリデーションは既知フェーズ名の正規表現マッチで厳格化する
- D-003: bootstrap削除履歴はADR-029に日付付きで記録する
- D-004: TOON読み取りは先頭64KB制限とphase行早期returnでDoSリスクを低減する
- D-005: hook-utils.jsの既存関数シグネチャと戻り値セマンティクスは変更せず、内部分岐のみ追加する
- D-006: 二重ネストパスは新規には作成されないが、既存nested stateは温存しマイグレーション作業は実施しない

## artifacts
- 本ドキュメント threat-model.md
- 次フェーズ planning または design への入力

## next
- planning フェーズへ進む
- STRIDE分析の指摘を planning の実装ステップに反映する
- 特にTOONパーサの安全策（サイズ制限・バリデーション）を実装タスクに明記する

## constraints
- 各ソース200行以内
- 既存legacy stateを温存
- 新規依存追加なし（TOONパーサ自前実装）
- L1-L4決定的ゲートのみ
