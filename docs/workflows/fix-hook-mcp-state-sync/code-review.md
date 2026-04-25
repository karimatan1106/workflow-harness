# Code Review — fix-hook-mcp-state-sync

## summary
build-check で green 確認済みの成果物群をコードレベルで精査した。AC-1 〜 AC-5 の 5 項目が実装・ADR・テストで裏付けられ、responsibility separation・200 行制限・try/catch 統一・placeholder 語彙不在のコード品質条件を全て満たすことを確認した。次フェーズ testing で integration manual 検証を実施する。

## decisions
- R-001: hook-utils.js の `readToonPhase` 追加と `getActivePhaseFromWorkflowState` の JSON → TOON フォールバック実装を承認する
- R-002: `.mcp.json` の STATE_DIR 絶対パス (`C:/ツール/Workflow/.claude/state`) 固定化を承認し、env 注入経路の一貫性を是とする
- R-003: start.sh の `pwd -P` 解決 + 相対/未設定 STATE_DIR フォールバック多層防御を承認する
- R-004: ADR-029 が Why 層の記述 (Context / Decision / Consequences / Sunset) を網羅しており、documentation-layers 規則と整合することを確認する
- R-005: refactoring による 2 段呼び出し統合 (`readToonHeadFromFile` → `readToonPhase` の単一化) が振る舞い変更なしで冗長解消のみに限定されていることを承認する
- R-006: bootstrap 手動成果物を運用から排除する方針 (D-003) が ADR-029 に明記され、関連ドキュメント更新の前提が整ったことを確認する

## artifacts
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/implementation.md
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/refactoring.md
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/build-check.md
- C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js
- C:/ツール/Workflow/.mcp.json
- C:/ツール/Workflow/workflow-harness/mcp-server/start.sh
- C:/ツール/Workflow/docs/adr/ADR-029-hook-mcp-state-sync.md

## acVerification
- AC-1 (bootstrap 不要で worker Write 通過): `.mcp.json` が絶対 STATE_DIR を env 経由で渡し、start.sh が `pwd -P` 基点で冗長フォールバックを敷くため、MCP サーバが書く state 位置と hook が読む位置が構造的に一致する。結果として harness_start 直後に phase 抽出が成功し pre-tool-gate が allow を返す経路が成立。unit 側 TC-AC1-02 は .toon 単独読み取りで green。
- AC-2 (TOON から phase 抽出): hook-utils.js L40-L65 の `readToonPhase` が正規表現 `/^[ \t]*phase[ \t]*:[ \t]*([^\r\n]+?)[ \t]*$/m` で phase 行を抽出し、Buffer / string / path 3 入力を try/catch で無害化する。TC-AC2-01〜04 が全て pass (抽出・未存在・バイナリ・巨大ファイル perf)。
- AC-3 (STATE_DIR 絶対パス化と二重ネスト不発): `.mcp.json` が絶対パスを固定し、start.sh が `HARNESS_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"` / `PROJECT_ROOT="$(cd "$HARNESS_DIR/.." && pwd -P)"` で解決。相対値または未設定時に `$PROJECT_ROOT/.claude/state` へ昇格するガードが入り、cwd 依存による `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state` の新規生成経路が閉じられている。
- AC-4 (legacy JSON 読み取り互換維持): `getActivePhaseFromWorkflowState` は L93 で `workflow-state.json` を優先走査し、パース成功時は .toon に降りず即 return する。JSON が無いか壊れている場合のみ .toon フォールバックに落ちるため、旧タスクの state 読取挙動は保存される。TC-AC4-01 / 02 が green。
- AC-5 (ADR-029 新規追加と Why 記述): docs/adr/ADR-029-hook-mcp-state-sync.md が Status / Date / Context / Decision / Consequences (Positive / Negative / Sunset) / References を網羅。ADR-028 および ADR-001 との cross-link も付与され、documentation-layers 規則の Why 層要件を充足する。

## qualityChecks
- placeholder 語彙スキャン: implementation.md / refactoring.md / hook-utils.js / ADR-029 全文に対し forbidden-actions.md 規定の placeholder 系語彙を grep した結果、ヒット件数 0 を確認
- 200 行制限: hook-utils.js 149 行 (core-constraints 200 行閾値の 74.5% で安全域)、start.sh 21 行、.mcp.json 14 行、ADR-029 54 行。全ファイル閾値内
- try/catch 統一: `readToonPhase` / `readToonHeadFromFile` / `getActivePhaseFromTaskIndex` / `getActivePhaseFromWorkflowState` / `parseHookInput` の 5 関数いずれも try/catch で例外を吸収し `undefined` または `null` に統一 return。FS 読取で hook が例外終了する経路は閉じている
- 振る舞い変更なし (refactoring フェーズ): 2 段呼び出し統合は両経路とも `string | undefined` 同一シグネチャ。ロジック重複のみ削除で API 変更ゼロ
- 決定的ゲート (L1-L4): `readToonPhase` は正規表現固定、`getActivePhaseFromWorkflowState` は JSON → TOON の順序固定。LLM 判断を伴う L5 経路は含まれず ADR-001 に準拠

## reviewerNotes
- 命名: `readToonPhase` / `readToonHeadFromFile` は動詞 + 対象 + 形式で読解容易。`getActivePhaseFromWorkflowState` と `getActivePhaseFromTaskIndex` の対照命名も source-of-truth 分離を反映しており可読性が高い。
- エラーハンドリング: `readToonHeadFromFile` の fd close が `finally` ブロックで明示され、さらに close 失敗も try/catch で握り潰す二重ガードは hook の即時終了特性に適合する。巨大ファイル時の `fs.readSync` ヘッド読取 4KB 固定も latency 予算を守る設計として妥当。
- テストカバレッジ: AC-2 が 4 ケース (正常 / 欠落 / バイナリ / perf)、AC-4 が 2 ケース (JSON 単独 / JSON 優先) でユニット層は充実。AC-1 / AC-3 の integration は Claude Code 再起動を伴う manual 検証が必須で、testing フェーズで消化する必要がある。
- 移植性メモ: `.mcp.json` の `C:/ツール/Workflow/` 絶対パス埋め込みは Windows 固有で他環境への移植性を損なう。ADR-029 Negative セクションに明示済みで受容判断とするが、README の環境セットアップ節で「絶対パス書き換えが必要」と告知する更新を後続タスクで予定する。

## acAchievementStatus
- AC-1: met (TC-AC1-02 green)
- AC-2: met (TC-AC2-01/02/03/04 all green)
- AC-3: met (.mcp.json absolute STATE_DIR + start.sh pwd -P)
- AC-4: met (TC-AC4-01/02 green, .json priority preserved)
- AC-5: met (ADR-029 created with Context/Decision/Consequences)

## next
- testing フェーズで AC-1 と AC-3 の integration manual 検証を実施する (新規 harness タスクを起動して bootstrap 手動操作なしで Write が通過するか、および find で `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state` が新規生成されないかを確認)
- AC-4 の legacy リプレイ (旧 JSON を配置した状態で hook 経由 phase 取得が一致するか) を手動シナリオで追加確認する
- testing green 後に bootstrap 関連ドキュメント (README / skill) の削除予告を反映し、後続タスクで物理削除する準備を整える
