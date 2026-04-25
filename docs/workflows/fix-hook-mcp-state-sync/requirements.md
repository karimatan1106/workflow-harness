# Requirements

## background
pre-tool-gate hookとMCPサーバの状態ストア同期を修正する。現状、hookはparent/.claude/state/task-index.jsonとworkflow-state.jsonをjson形式で参照するが、MCPサーバはworkflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/workflows/にtoon形式で書く二重ネスト+形式不一致が発生しており、harness_start後もworker Write/Edit権限が解放されない。ADR-028で進めているsubmodule分離の続きとして、STATE_DIR絶対パス化とhookのtoon対応を実施し、bootstrap操作不要な状態に戻す。

## scopeFiles
keywords: hook, mcp, state, sync, STATE_DIR, TOON, pre-tool-gate, bootstrap
- C:/ツール/Workflow/.mcp.json
- C:/ツール/Workflow/workflow-harness/mcp-server/start.sh
- C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js
- C:/ツール/Workflow/docs/adr/ADR-029-hook-mcp-state-sync.md

## acceptanceCriteria
- AC-1: 新規harnessタスク作成後、bootstrap手動操作なしでworker Write/Edit が pre-tool-gate hookを通過する
  - rationale: harness_start 直後にworker権限が自動解放されないと、ユーザーが毎回bootstrapコマンドを手動実行する負担が発生するため
  - verification: 新規タスクを harness_start し、直後に worker 経由で Write 実行してallowedログを確認する手動エンドツーエンド観測
- AC-2: hook-utils.jsのgetActivePhaseFromWorkflowStateがTOON形式のworkflow-state.toonからphaseキー値を抽出できる
  - rationale: MCPサーバ側がTOON形式で書き出す以上、hook側でも同じ形式を読める必要があり契約を揃えるため
  - verification: nodeからhook関数を直起動し、TOON固定入力で期待phase文字列が戻るか自動で検証する
- AC-3: STATE_DIRが絶対パスとして解決され、workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/ の二重ネストディレクトリが新規作成されない
  - rationale: 相対パス展開がcwd依存で二重ネストを引き起こし、hookとMCPが別stateを見る分岐の根本原因となるため
  - verification: start.sh起動後にfindで二重ネストパスが生成されないことを自動スクリプトで確認する
- AC-4: 既存のJSON形式workflow-state.jsonステートファイル読み取りが従来通り動作し、legacy互換が維持される
  - rationale: 既存タスクのstateを破壊的にマイグレーションしないことで運用継続性を担保するため
  - verification: 旧JSONステートを配置した状態でhook経由のphase取得が以前と一致するか手動リプレイで確認する
- AC-5: ADR-029「hook-mcp-state-sync」がdocs/adr/配下に新規追加され、state配置統一とhookマルチフォーマット対応のWhyを記述している
  - rationale: documentation-layers.md規則に基づき、新ルール追加時はWhyをADRとしてイミュータブルに固定する必要があるため
  - verification: docs/adr/ADR-029-hook-mcp-state-sync.mdの存在と本文セクション網羅を目視レビューで確認する

## requirementsTraceability
- F-001: AC-3: STATE_DIRを絶対パスで解決して二重ネストを排除 → workflow-harness/mcp-server/start.sh
  - statusNote: start.sh先頭でcd後に$(pwd -P)を展開してexportする方針、実装未着手でこれから手を入れる段階
- F-002: AC-2: TOON形式からphaseキー値を抽出するhookリーダー実装 → workflow-harness/hooks/hook-utils.js
  - statusNote: 最小パーサをgetActivePhaseFromWorkflowState内に追加し、既存JSON関数と並立させて切り替える構成
- F-003: AC-4: JSON形式の既存state読み取りを維持する互換経路 → workflow-harness/hooks/hook-utils.js
  - statusNote: 拡張子判定でTOONとJSONを分岐し、JSON経路は現行コードそのまま維持して副作用を避ける
- F-004: AC-1: bootstrap手動操作なしで新規タスクがWrite可能になる統合動作 → .mcp.json
  - statusNote: STATE_DIR環境変数を.mcp.jsonのenvセクションに絶対パスで明示し起動側との食い違いを消す
- F-005: AC-5: ADR-029 hook-mcp-state-sync をWhyドキュメントとして新規追加 → docs/adr/ADR-029-hook-mcp-state-sync.md
  - statusNote: ADR-028の続編としてcross-linkし、state placementとformat multiplexingの理由を固定する

## notInScope
- src/frontend/** 全般のUI変更
- workflow-harness/mcp-server/src/ のビジネスロジック書き換え
- tests/ の既存テスト大幅改修
- legacy JSON ステートファイルの破壊的マイグレーション
- MCP server プロセス管理機構の変更
- 他のMCPサーバエントリへの影響を伴う .mcp.json 構造変更

## openQuestions
なし

## decisions
- D-001: STATE_DIRは start.sh内で `$(pwd -P)` を使って絶対パス化し、環境変数の相対値は保持しない
  - justification: 相対パスは起動cwd依存で二重ネスト再発の根本原因となるため、シェル側で確定値に固定する
- D-002: hook-utils.jsはJSON形式とTOON形式の両方を読む互換実装にする
  - justification: 旧タスクのJSONステートを温存しつつ新タスクのTOON出力を読むことでAC-4とAC-2を同時充足する
- D-003: bootstrap成果物は修正完了時に削除し、運用ドキュメントからも除外する
  - justification: 自動解放が機能する前提ではbootstrap手順はむしろ誤操作源となり不整合を増やすため排除する
- D-004: 単一PRでアトミックに適用し、部分デプロイは許容しない
  - justification: hookとMCPの両側で形式契約が一致する前提のため中間状態で片側だけ出荷すると全タスクが停止する
- D-005: ADR-029を新規追加してWhyを固定する
  - justification: documentation-layersルールに従いWhy層の判断を覆させないためADRをイミュータブル台帳として追加する
- D-006: TOONパーサは自前実装の最小版とし、外部ライブラリ依存は追加しない
  - justification: hookは起動コストがシビアで依存追加はhook遅延と供給網リスクを招くため、phase抽出に足る最小実装に留める

## constraints
- 各ソース200行以内
  - reason: core-constraints準拠で責務分離の指標を維持するため、超過時は機能分割で対応する
- 新ルール追加時はADR必須
  - reason: documentation-layers規則によりWhyのない新ルール導入を禁じているため、必ずADRで裏付ける
- legacy ステートファイル温存
  - reason: 実行中タスクの互換性を損なわず段階移行するため破壊的変換を避けて並行読み取りを維持する
- L1-L4決定的ゲートのみ使用
  - reason: ADR-001に基づきL5 LLM判断をゲートに使うと再現性が崩れるため決定的判定のみ許容する
- ソース変更は単一PRで完結
  - reason: hookとMCPの契約一致を崩す中間commitをpublishしないため、アトミック適用に限定する

## operationalNotes
- 動作確認はWindows bashとPOSIX pwd -Pの挙動差に留意し、CRLF混入を避けるためLFで保存する
- hook起動遅延はfs readSyncのバッファサイズとTOONパース計算量で決まり、phase抽出だけに絞って抑える
- .mcp.jsonのenv変更はClaude Code再起動が必要なためリリース手順に明記する

## riskRegister
- R-001: TOONパーサ最小実装が将来のTOON仕様拡張で破綻する可能性 → phase抽出に限定し形式変更時はADR追補で対応する
- R-002: 絶対パス化で他環境(例えばCI)のcwd前提が崩れる恐れ → start.sh先頭でcd移動を明示してから展開する
- R-003: legacy JSON読取維持が長期化して分岐が固定化する懸念 → ADR-029に廃止タイミングをsunset条件として記述する
- R-004: bootstrap撤去後に旧ドキュメントが参照され手動操作が再発する恐れ → 関連READMEとskillに削除予告を反映してから物理削除する
