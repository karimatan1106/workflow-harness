# Research

## background
hook側 (`hook-utils.js`) と MCP server 側 (`manager-read.ts`) が別のディレクトリ/別の形式でワークフロー状態を参照している。
hook は parent `C:/ツール/Workflow/.claude/state/workflows/*/workflow-state.json` を起点に active phase を判定する。
一方、MCP server は `STATE_DIR=workflow-harness/mcp-server/.claude/state` 配下の `workflow-state.toon` に書き込む。
加えて start.sh の `cd "$(dirname "$0")"` により Node の cwd が `workflow-harness/mcp-server/` となり、相対 STATE_DIR が再解釈されて `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/` という二重階層を生成している。
結果として hook は phase を `null` とみなし、L3 の Write/Edit を全面ブロックする状況が起きる。
ADR-028 による submodule 分離完了後に顕在化した残存同期不具合であり、本タスクで根本解決する。

## currentImplementation
### mcpConfig
- `.mcp.json` L3-L13: command=bash, args=`workflow-harness/mcp-server/start.sh`, cwd=`workflow-harness/mcp-server`, env.STATE_DIR=`workflow-harness/mcp-server/.claude/state`
- STATE_DIR が相対で与えられている点が二重ネストの起点

### startShell
- `start.sh` L11: `cd "$(dirname "$0")" && npm run build --silent && node dist/index.js`
- Node 起動時の cwd が `workflow-harness/mcp-server/` になる
- 結果、Node が STATE_DIR 相対値をもう一度 cwd 基準で解決し `workflow-harness/mcp-server/workflow-harness/mcp-server/...` になる

### hookUtils
- `hook-utils.js` L5-L14 `findProjectRoot`: 10階層まで `.claude/state` 存在探索、parent を project root として返す
- L16-L26 `getActivePhaseFromTaskIndex`: `.claude/state/task-index.json` の active タスクから phase 取得 (JSONのみ)
- L28-L42 `getActivePhaseFromWorkflowState`: `.claude/state/workflows/*/workflow-state.json` を readdir し phase を抽出 (JSON固定、`.toon` は無視される)
- L44-L47 `getCurrentPhase`: task-index優先、fallback で workflow-state を参照

### mcpStateWriter
- `manager-read.ts` L13-L15 `getStateDir`: `process.env.STATE_DIR || '.claude/state'`
- L17-L19 `getStatePath`: `join(getStateDir(), 'workflows', taskId_taskName, 'workflow-state.toon')`
- L28-L52 `loadTaskFromDisk`: `.toon` のみ読み、`parseState` で復元
- L72-L80 `loadStateFromDir`: 同様に `.toon` 固定
- 書き込みパスは STATE_DIR 相対 (env が相対なら Node cwd 基準で再解釈される)

### stateLayout
- parent `C:/ツール/Workflow/.claude/state/workflows/`: 30件以上、`workflow-state.json` を格納 (旧hook形式)
- submodule `C:/ツール/Workflow/workflow-harness/mcp-server/.claude/state/workflows/`: 現行書き込み先に見えるが実体は二重階層側
- nested `C:/ツール/Workflow/workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/workflows/`: 実データが集中 (30fba95f_fix-hook-mcp-state-sync を含む)。MCP server の実書き込み先

## rootCauses
### cause1_doubleNesting
- STATE_DIR が相対 + start.sh が先に cd する二段階解決により階層が重複
- 再現条件: `.mcp.json` の env.STATE_DIR を相対値のままにすると Node cwd 基準で再解釈される

### cause2_formatMismatch
- hook は `.json` のみ走査、MCP は `.toon` のみ書き込み
- 同一ディレクトリを見ても互いの成果物を拾えない構造的非整合

## adrContext
- ADR-028 は親と submodule を分離し submodule を単独自立させる趣旨
- 本修正は ADR-028 の完成度を引き上げる継続作業に位置付ける
- submodule 側を単一ソース・オブ・トゥルースとする方針は ADR-028 と整合

## proposedApproach
- 修正A: start.sh 内で `STATE_DIR="$(cd "$(dirname "$0")" && pwd)/.claude/state"` を export し絶対パス化
- 修正B: `hook-utils.js` に軽量 TOON 読み取り関数を追加し、`workflow-state.toon` からも phase を抽出
- 修正C: bootstrap 成果物の自動削除を start.sh または初期化コードに組み込み、二重階層の残骸を撤去

## decisions
- D-001: STATE_DIR の絶対化は start.sh 側で `$(cd ... && pwd)` により解決する。`.mcp.json` の env 値は相対のまま温存し、参考用に保つ。最短で副作用最小
- D-002: `hook-utils.js` の `getActivePhaseFromWorkflowState` を拡張し、同名の `.toon` ファイル探索を追加する形で実装
- D-003: TOON パース処理は軽量な自前実装で phase キーのみ抽出する。依存追加なし・bundle サイズ増なし
- D-004: ADR-028 と整合するよう、parent `.claude/state/` への書き込みは廃止し submodule 側を単一ソース・オブ・トゥルースとする
- D-005: 二重階層の bootstrap 成果物削除は修正マージと同一PRに含める。手動運用ではなく実装に組み込む

## artifacts
- 本ドキュメント research.md
- 次フェーズ requirements.md への入力データ

## next
- requirements フェーズで AC-N と RTM F-NNN を定義
- 特に「bootstrap 無しで新規タスク作成→Write 可能」を受入条件化
- performance 想定: hook オーバーヘッドの変化を観測。軽量 TOON パーサなので影響は軽微見込み
- planning では修正A・B・C の実装順序を決定し、回帰観測の範囲を固定

## constraints
- ソース 200 行以内
- ADR 必須
- legacy JSON ステートファイルは温存する
- L1-L4 決定的ゲートのみ使用
