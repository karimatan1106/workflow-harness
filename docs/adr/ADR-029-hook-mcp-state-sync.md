# ADR-029: hook-mcp-state-sync

Status: Accepted
Date: 2026-04-18
Supersedes: none
Related: ADR-028 (separate-workflow-harness-from-parent), ADR-001 (deterministic L1-L4 gates)

## Context (Why)

pre-tool-gate hook と lifecycle MCP サーバが別々の状態ストアを参照していた。

1. `.mcp.json` の `STATE_DIR` が相対パス `workflow-harness/mcp-server/.claude/state` で、起動 cwd 依存により
   `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/workflows/` という二重ネストディレクトリが新規生成されていた。
2. MCP サーバは `workflow-state.toon` (TOON 形式) で state を書き出す一方、hook (`hook-utils.js`) は `workflow-state.json` を決め打ちで読んでいた。形式不一致で phase が抽出できず、hook が「no active phase」として L1/L3 Write/Edit を block した。
3. 結果として harness_start 直後にも関わらず worker の Write が block され、ユーザーが手動 bootstrap を毎回強制されていた。

ADR-028 で workflow-harness の submodule 分離を進めたが、state 配置と形式の一致が未解決で、bootstrap 手動操作前提の運用が残っていた。

## Decision (What)

1. `.mcp.json` の `STATE_DIR` を絶対パス (`C:/ツール/Workflow/.claude/state`) に固定し、cwd 依存の展開を排除する。
2. `workflow-harness/mcp-server/start.sh` は起動時に `$(pwd -P)` で解決した `PROJECT_ROOT` を算出し、`STATE_DIR` が未設定または相対値の場合に絶対パスへフォールバックさせる (保険的多層防御)。
3. `hook-utils.js` に `readToonPhase()` を追加し、`getActivePhaseFromWorkflowState()` を JSON → TOON の順で読むハイブリッド実装に変更する。
   - JSON が存在すればそちらを優先 (legacy 互換、AC-4)
   - JSON が無ければ `workflow-state.toon` から `phase:` 行を抽出
   - TOON パーサは最小実装 (正規表現)。外部依存は追加しない
   - 64KB 超過ファイルは先頭 4KB だけ `fs.readSync` で読み、hook latency 契約を守る
4. bootstrap 手動成果物は運用から除外する。自動解放が機能する前提では bootstrap はむしろ不整合源になる。

## Consequences

### Positive
- harness_start 直後から worker Write/Edit が自動で通過する (AC-1)
- hook と MCP サーバが同じ絶対 STATE_DIR を参照し、state 分岐が構造的に発生しなくなる (AC-3)
- legacy JSON state は温存されるため破壊的マイグレーション不要 (AC-4)
- TOON 形式が hook 側でも読めるようになり、MCP 側の書き出し形式選択が hook と decoupled になる (AC-2)

### Negative / Trade-offs
- `.mcp.json` に絶対パスを埋め込むため、他マシンへの移植時は手動書き換えが必要。Windows 固有パスを埋めている点は受容する (R-002 に対する設計判断)。
- TOON パーサは phase 抽出に特化した最小実装で、将来の TOON 仕様拡張には追従しない。仕様拡張時は本 ADR に追補する必要がある (R-001)。
- 既存の二重ネスト `workflow-harness/mcp-server/.claude/state/workflows/` (21 件) は legacy データとして残る。物理削除は本変更のスコープ外で、別タスクとして扱う。
- `CONFIG_GUARD_DISABLE=true` 経由で `.mcp.json` を書き換えたため、他者のレビュー時には git diff で明示確認が必要 (JSON にコメント注記不可のため)。

### Sunset Condition
legacy JSON 経路のフォールバックは、全 in-flight タスクが TOON ベースに移行した時点で削除候補となる。削除判断は将来 ADR で別途行う。

## References
- docs/workflows/fix-hook-mcp-state-sync/requirements.md (F-001〜F-005)
- docs/workflows/fix-hook-mcp-state-sync/test-design.md (AC-1〜AC-5, TC 群)
- docs/adr/ADR-028-separate-workflow-harness-from-parent.md (state 物理配置の経緯)
- docs/adr/ADR-001-deterministic-gates.md (L1-L4 決定的ゲートのみ)
- workflow-harness/hooks/hook-utils.js (readToonPhase 実装)
- workflow-harness/hooks/__tests__/hook-utils.test.js (AC-2, AC-4 自動検証)
