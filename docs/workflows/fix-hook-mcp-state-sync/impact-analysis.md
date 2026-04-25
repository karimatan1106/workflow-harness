# Impact Analysis

## background
hook-MCP state sync修正の波及範囲を評価する。対象は4ファイル編集+1ADR新規+bootstrap削除。単一PRでアトミックに適用する決定済み。

## directImpacts
### filesModified
- .mcp.json: MCPサーバ再起動が必要。他MCPエントリには影響なし
- workflow-harness/mcp-server/start.sh: 起動スクリプトのパス解決が変わる。副作用はprocessのcwd/環境のみ
- workflow-harness/hooks/hook-utils.js: getActivePhaseFromWorkflowStateの戻り値は既存JSON経路では変化なし。TOON経路追加のみ
- workflow-harness/hooks/tool-gate.js: 呼び出し部は無変更見込み。内部分岐のみ

### filesCreated
- docs/adr/ADR-029-hook-mcp-state-sync.md: Whyドキュメント、参照読み取り専用

### filesDeleted
- .claude/state/workflows/30fba95f-c396-4427-ba30-125b308ee3cb_fix-hook-mcp-state-sync/: bootstrap成果物
- .claude/state/task-index.jsonのactiveエントリ行: bootstrap登録行のみ

## indirectImpacts
### harnessBehavior
- 新規タスクがbootstrap不要で起動→Writeまで到達可能になる
- 既存のactiveタスクは本変更で影響を受けないが、phase情報取得経路が変わるため次のharness_next呼び出しで新経路が使われる

### hookPerformance
- TOONパーサは軽量実装（phase行を正規表現で抽出）で、hook発火ごとに数ms程度のオーバーヘッド追加
- 大量のstateファイルが存在する場合でも既存のJSON走査と同レベル

### legacyCompatibility
- parent/.claude/state/workflows/の旧JSONステート群は読み取りが継続可能
- MCP新規書き込みはsubmodule側TOONのみ
- 既存のAuto-Startやキーワード起動ロジックには影響なし

### developerWorkflow
- 日々の操作（harness_start, harness_next等）の体感動作は不変
- bootstrap手順のドキュメント（もし追加されていたら）は削除

## riskAssessment
### high
- なし

### medium
- TOONパーサが期待と異なる形式を読み取ってfalse positiveするリスク → phase行のみ厳密に抽出することで低減
- STATE_DIR絶対化時にWindows/POSIXパス差異が顕在化するリスク → start.sh内で `$(pwd -P)` を使い解決

### low
- legacy JSONステートを誤って削除するリスク → D-004で明示温存
- hookが読み取りを二重に試行することで若干のレイテンシ追加 → 実測数ms程度で許容

## rollbackPlan
- 単一PRなのでrevertで全変更巻き戻せる
- bootstrap復元は手動手順を再走行すれば可能

## decisions
- D-001: 波及範囲は4ファイル編集+1ADR+bootstrap削除に限定し、他MCPエントリやビジネスロジックには触れない
- D-002: 既存legacy JSONステートは互換維持のため残し、読み取り経路はJSON/TOON両対応で提供する
- D-003: hookのオーバーヘッド増加を許容する範囲は1回あたり10ms以内を目安とする
- D-004: STATE_DIR絶対化は start.sh内で `$(pwd -P)` による解決とし、Windows環境の差分を吸収する
- D-005: 単一PRでアトミックに適用することでrollback容易性を確保する
- D-006: 本修正完了後、bootstrap手順は運用ドキュメントから削除し、非常時リカバリとしての記載のみADRに残す

## artifacts
- 本ドキュメント impact-analysis.md
- 次フェーズ threat_modeling への入力
- 想定される統合テスト: harness_start直後にWriteが通ることの確認

## next
- threat_modeling フェーズへ進む
- STRIDE分析でセキュリティ面のリスクを棚卸しする
- 特にstate file書き込みの権限境界と、TOONパーサの入力バリデーションを検討する

## constraints
- 各ソース200行以内
- legacy ステート温存
- L1-L4決定的ゲートのみ
- 新ルール追加はADR必須
