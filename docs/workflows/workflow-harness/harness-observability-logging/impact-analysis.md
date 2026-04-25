# Impact Analysis: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277

## scope

本タスクはワークフローハーネスにobservability(可観測性)ログ機構を追加する。
影響範囲は hooks層(bash)、MCP handlers層(TypeScript)、DoD gates層、docsDir成果物の4領域。

## affected-components

| コンポーネント | ファイル | 変更種別 | 影響度 |
|---|---|---|---|
| pre-tool-guard | hooks/pre-tool-guard.sh | 修正(ログ追記) | 中 |
| delegate-coordinator | mcp-server/src/tools/handlers/delegate-coordinator.ts | 修正(イベント記録追加) | 中 |
| lifecycle-next | mcp-server/src/tools/handlers/lifecycle-next.ts | 修正(イベント記録追加) | 中 |
| dod-l1-l2 | mcp-server/src/gates/dod-l1-l2.ts | 参照のみ(tool-trace.toon検証追加の可能性) | 低 |
| dod.ts | mcp-server/src/gates/dod.ts | 参照のみ(新チェック追加時) | 低 |
| trace-logger.sh | hooks/trace-logger.sh | 新規作成 | 高 |
| observability/*.ts | mcp-server/src/observability/ | 新規ディレクトリ+ファイル群 | 高 |
| metrics.ts | mcp-server/src/tools/metrics.ts | 参照のみ(既存メトリクスとの整合) | 低 |
| tool-trace.toon | {docsDir}/tool-trace.toon | 新規生成(実行時成果物) | 中 |

## impact-detail

### hook実行速度への影響

pre-tool-guard.shは全ツール呼び出しの前に実行される(108行、set -euo pipefail)。
現在の処理: stdin JSON読み取り -> フィールド抽出(grep/sed) -> ホワイトリスト判定 -> exit。
ログ追記処理の追加箇所は、exit 0/exit 2の直前にappend操作を挿入する形になる。
bashのecho追記(`>>`)は1回あたり1ms未満だが、毎ツール呼び出しで実行されるため累積影響がある。
1タスクあたりのツール呼び出し回数は数百〜数千回に達するため、trace-logger.shを別ファイルに分離し、
pre-tool-guard.shからsource読み込みする設計が望ましい。
ログ書き込みは非同期(`&`バックグラウンド実行)とし、ガード判定のクリティカルパスに影響させない。

### MCPハンドラのAPIレスポンス時間への影響

delegate-coordinator.ts: spawnAsync前後でstartTime/durationMsを既に計測している(161-168行)。
observabilityイベント記録の追加はnon-blocking(`try/catch`で囲むパターン、lifecycle-next.tsの90行目と同様)で実装する。
lifecycle-next.ts: recordPhaseStart/recordPhaseEnd/recordRetry/recordDoDFailureの呼び出しパターンが確立済み。
新規observabilityイベントもこの既存パターン(`try { ... } catch { /* non-blocking */ }`)に従えば、
APIレスポンス時間への影響はファイルI/O 1回分(1-5ms)に収まる。
同期ファイル書き込み(writeFileSync)を避け、appendFileを使うことでI/Oブロッキングを最小化する。

### 新規ファイル追加によるビルド・テストへの影響

trace-logger.sh: bash単体ファイルのためTypeScriptビルドに影響なし。
hooksディレクトリに配置するため、既存のhook検出ロジック(.claude/hooks.json等)の更新が必要か確認する。
observability/*.ts: mcp-server/src/配下に新ディレクトリを追加。
tsconfig.jsonのincludeパターンが`src/**/*.ts`であれば自動的にコンパイル対象に含まれる。
新規モジュールのimportが既存ファイルに追加されるため、循環依存(madge検出対象)に注意する。
既存テストスイート(mcp-server/src/__tests__/)への直接的な影響はないが、
新規モジュールのユニットテストを__tests__/配下に追加する必要がある。

### docsDir内tool-trace.toon生成によるDoD検証への影響

dod-l1-l2.tsのcheckL1FileExists: PHASE_REGISTRYのoutputFileプロパティに基づくファイル存在チェック。
tool-trace.toonはフェーズ成果物ではなく実行時ログであるため、outputFileとして登録しない。
ただしDoDのcheckL3Quality(dod-l3.ts)がdocsDir配下の全ファイルをスキャンする場合、
禁止語チェックがtool-trace.toonに対して誤発火する可能性がある。
対策: L3/L4バリデータにtool-trace.toonを除外リストとして登録する。
checkInputFilesExistへの影響はない(inputFilesに登録しないため)。

### 既存テストスイートへの影響

dci-phase-integration.test.tsがimpact_analysisフェーズのテンプレートを検証している。
observabilityモジュールは既存テストのモック対象外であるため、テストの修正は不要。
ただしlifecycle-next.tsやdelegate-coordinator.tsをテストしている箇所がある場合、
新規import追加によるモジュール解決の変更でテストが壊れる可能性は低い(non-blockingパターンのため)。
新規テストとして、observabilityイベントの記録・読み取り・ローテーションのユニットテストが必要。

### hook-events.logの肥大化リスク

1ツール呼び出しあたり約100-200バイトのログ行を想定。
1タスクで1000回のツール呼び出しがあると約100-200KB。
10タスク蓄積で1-2MB。100タスクで10-20MB。
対策として以下の3段階を実装する:
(1) タスク完了時にhook-events.logをtool-trace.toonに集約・圧縮してdocsDirに移動
(2) 1MB超過時にローテーション(hook-events.log.1として退避、新規ファイル作成)
(3) .gitignoreにhook-events.logを追加し、リポジトリ肥大化を防止

## risk-matrix

| リスク | 発生確率 | 影響度 | 緩和策 |
|---|---|---|---|
| hook実行速度劣化 | 中 | 高 | バックグラウンド書き込み、trace-logger.sh分離 |
| APIレスポンス遅延 | 低 | 中 | non-blockingパターン準拠、appendFile使用 |
| L3禁止語チェック誤発火 | 中 | 高 | tool-trace.toonをバリデータ除外リストに登録 |
| ログ肥大化 | 高 | 中 | ローテーション、タスク完了時集約、.gitignore |
| 循環依存発生 | 低 | 中 | observabilityを独立モジュールとし、既存コードからの逆依存を禁止 |
| 既存テスト破損 | 低 | 低 | non-blocking追加のみ、既存API署名を変更しない |

## decisions

- pre-tool-guard.shへの直接的なログ処理埋め込みを避け、trace-logger.shを別ファイルとして分離する。クリティカルパス(ツールガード判定)とobservability(ログ記録)の責務を分離し、ガード処理の信頼性を維持するため。
- ログ書き込みはバックグラウンド実行(`echo ... >> logfile &`)とし、hook実行のクリティカルパスをブロックしない。全ツール呼び出しに対して実行されるため、同期I/Oの累積遅延がワークフロー全体のスループットを低下させることを防ぐため。
- MCP handlers内のobservabilityイベント記録は既存のnon-blockingパターン(`try { ... } catch { /* non-blocking */ }`)に統一する。lifecycle-next.tsで確立済みのパターン(90行目、108-110行目)との一貫性を保ち、observability障害がハーネス本体の動作を阻害しないことを保証するため。
- tool-trace.toonをDoD L3/L4バリデータの除外リストに明示的に登録する。実行時ログファイルにはツール名やエラーメッセージが記録されるため、禁止語チェック(forbidden-words)が誤検出する確率が高く、これを放置するとDoD通過率が著しく低下するため。
- hook-events.logに1MBローテーション閾値を設定し、タスク完了時にtool-trace.toonへ集約する2段階ライフサイクルを採用する。100タスク蓄積時に10-20MBに達する試算に基づき、ディスク消費とgitリポジトリ肥大化を防止するため。
- observabilityモジュールをmcp-server/src/observability/として独立ディレクトリに配置し、既存モジュール(gates, tools, state)からobservabilityへの逆依存(import)を禁止する。循環依存を構造的に防止し、observability機能の追加・削除が既存機能に波及しない設計とするため。

## artifacts

| 成果物 | パス | 説明 |
|---|---|---|
| impact-analysis.md | docs/workflows/harness-observability-logging/impact-analysis.md | 本ファイル |

## next

requirementsフェーズで以下を定義する:
- AC(受入基準): hook速度劣化の許容閾値、ログローテーション条件、DoD除外リスト仕様
- RTM: 各決定事項からrequirements/spec/test-designへの追跡マッピング
- 非機能要件: ログ書き込みのレイテンシ上限、ストレージ消費上限
