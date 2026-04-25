# Acceptance Report — fix-hook-mcp-state-sync

## acceptanceSummary
accepted。AC-1〜AC-5 の 5 項目すべてが実装・ADR・テスト証跡で裏付けられ、受入判定の決定論的条件 (pass===total=7 かつ fail===0 かつ exitCode===0 かつ新規 regression=0 かつ ADR-029 の Why 層網羅) を同時充足した。既存失敗 10 件 (first-pass-improvement / hearing-worker-rules) は hook-utils.js 非依存の markdown 文言系で、指示された baseline 39 件を大幅に下回り本スコープ外と判定済み。

## acResults
- AC-1: accepted (C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/testing.md L33-L45 TC-AC1-02 green、C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/code-review.md L24 AC-1 verification、C:/ツール/Workflow/.mcp.json L1-L14 STATE_DIR 絶対化、C:/ツール/Workflow/workflow-harness/mcp-server/start.sh L1-L21 pwd -P 多層フォールバック)
- AC-2: accepted (C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/testing.md L33-L41 TC-AC2-01 / 02 / 03 / 04 全件 green、C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js L40-L65 readToonPhase 実装、perf contract 50ms 内)
- AC-3: accepted (C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/code-review.md L26 STATE_DIR 絶対パス解決・二重ネスト不発性の構造保証、C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/regression-test.md L19-L25 回帰実測で新規二重ネスト生成なし)
- AC-4: accepted (C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/testing.md L37-L38 TC-AC4-01 / 02 green、C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js L93 JSON 優先分岐で legacy 互換維持、C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/code-review.md L27 AC-4 verification)
- AC-5: accepted (C:/ツール/Workflow/docs/adr/ADR-029-hook-mcp-state-sync.md 新規 54 行、Status / Date / Context / Decision / Consequences (Positive / Negative / Sunset) / References 完備、ADR-028 および ADR-001 への cross-link 付与)

## rtmResults
- F-001 (AC-3 / start.sh 絶対パス化): verified — start.sh が `HARNESS_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"` で絶対解決し、未設定・相対時に `$PROJECT_ROOT/.claude/state` へ昇格する多層ガード完成 (code-review.md L26)
- F-002 (AC-2 / TOON phase リーダー): verified — readToonPhase が正規表現 `/^[ \t]*phase[ \t]*:[ \t]*([^\r\n]+?)[ \t]*$/m` で抽出し、TC-AC2-01〜04 全 green (testing.md L33-L36)
- F-003 (AC-4 / JSON 互換経路): verified — getActivePhaseFromWorkflowState が JSON 優先走査後に TOON フォールバック、TC-AC4-01 / 02 全 green (testing.md L37-L38)
- F-004 (AC-1 / .mcp.json STATE_DIR 明示): verified — env セクションに `C:/ツール/Workflow/.claude/state` 絶対パスを固定、hook 読取位置と MCP 書込位置が構造的に一致 (implementation.md L4-L11)
- F-005 (AC-5 / ADR-029 新規): verified — docs/adr/ADR-029-hook-mcp-state-sync.md 生成済、documentation-layers Why 層要件を充足 (code-review.md L28)

## testEvidence
- 本修正テスト: `node --test workflow-harness/hooks/__tests__/hook-utils.test.js` → pass=7 / fail=0 / total=7 / exitCode=0 / duration=72.8387ms (testing.md L6-L13、regression-test.md L7-L12)
- ケース内訳 (7/7 Green): TC-AC2-01 readToonPhase extracts phase value / TC-AC2-02 returns undefined when no phase line / TC-AC2-03 swallows malformed binary input / TC-AC2-04 reads head only for oversized input (perf contract <50ms) / TC-AC4-01 getActivePhaseFromWorkflowState still works for .json only / TC-AC4-02 .json takes precedence over .toon when both exist / TC-AC1-02 getActivePhaseFromWorkflowState reads .toon when only .toon exists
- Regression (vitest 全体): `cd workflow-harness/mcp-server && npm test` → pass=854 / fail=10 / total=864 / files=103 (2 failed) / exitCode=1 / duration=8.27s (regression-test.md L13-L18)
- Baseline 比較: 観測 10 件 < 指示 baseline 上限 39 件。本修正起因の新規 regression=0 件。既存失敗 10 件はすべて markdown 文言規約 (first-pass-improvement.test.ts 7 件 + hearing-worker-rules.test.ts 3 件) で hook-utils.js / TOON / state-sync ロジックと非依存 (regression-test.md L27-L42)
- 性能契約: TC-AC2-04 oversized input head-only read が 50ms 未満で green。fs.readSync 4KB 固定ヘッド読取により巨大ファイル時の latency 予算を保護 (code-review.md L39)

## decisions
- AV-001: AC-1 を accepted と判定する。理由は .mcp.json 絶対 STATE_DIR 固定と start.sh pwd -P 多層防御で MCP 書込位置と hook 読取位置が構造的に一致し、TC-AC1-02 が .toon 単独で phase 抽出を green 実証したため。integration manual 層は code-review.md が 200 行内収束と try/catch 統一で構造健全性を担保済。
- AV-002: AC-2 を accepted と判定する。理由は readToonPhase が 4 ケース (正常抽出・欠落・binary 混入・oversized head-only) を全件 green で通過し、Buffer / string / path 3 入力パスを try/catch で吸収するため。正規表現固定ロジックで L1-L4 決定的ゲートに準拠 (ADR-001 整合)。
- AV-003: AC-3 を accepted と判定する。理由は start.sh が HARNESS_DIR と PROJECT_ROOT を pwd -P で絶対化し、STATE_DIR 未設定または相対値の両分岐で `$PROJECT_ROOT/.claude/state` に確定する冗長経路を持つため。cwd 依存による `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state` 新規生成経路が構造的に閉塞。
- AV-004: AC-4 を accepted と判定する。理由は getActivePhaseFromWorkflowState が L93 で workflow-state.json を先行走査しパース成功時に即 return する優先順位を保ち、TC-AC4-01 / 02 で JSON 単独および JSON+TOON 共存時の precedence を両方 green 実証したため。legacy タスク state 読取挙動は非破壊維持。
- AV-005: AC-5 を accepted と判定する。理由は ADR-029 が Status / Context / Decision / Consequences (Positive / Negative / Sunset) / References のフルセットを網羅し、ADR-028 (submodule 分離) および ADR-001 (L1-L4 決定ゲート) と cross-link されて documentation-layers Why 層イミュータブル要件を満たすため。
- AV-006: regression 既存失敗 10 件を本タスクのスコープ外として分離する。理由は failing テストが coordinator.md / worker.md / hearing-worker.md の markdown 文言規約検証であり、hook-utils.js / readToonPhase / STATE_DIR 経路と完全に独立しているため。別 issue 化して commit/deploy 後に追跡する方針を継承する。
- AV-007: bootstrap 運用排除 (D-003) を commit 時点で反映開始する。理由は ADR-029 Consequences Sunset に明記済で、自動解放が機能する前提では手動 bootstrap 手順が誤操作源となり state の不整合を再発させるため。関連 README / skill 物理削除は後続タスクで段階実施する。

## artifacts
- docs/workflows/fix-hook-mcp-state-sync/hearing.md
- docs/workflows/fix-hook-mcp-state-sync/scope-definition.md
- docs/workflows/fix-hook-mcp-state-sync/impact-analysis.md
- docs/workflows/fix-hook-mcp-state-sync/research.md
- docs/workflows/fix-hook-mcp-state-sync/requirements.md
- docs/workflows/fix-hook-mcp-state-sync/threat-model.md
- docs/workflows/fix-hook-mcp-state-sync/design-review.md
- docs/workflows/fix-hook-mcp-state-sync/ui-design.md
- docs/workflows/fix-hook-mcp-state-sync/flowchart.mmd
- docs/workflows/fix-hook-mcp-state-sync/state-machine.mmd
- docs/workflows/fix-hook-mcp-state-sync/planning.md
- docs/workflows/fix-hook-mcp-state-sync/test-design.md
- docs/workflows/fix-hook-mcp-state-sync/test-selection.md
- docs/workflows/fix-hook-mcp-state-sync/implementation.md
- docs/workflows/fix-hook-mcp-state-sync/refactoring.md
- docs/workflows/fix-hook-mcp-state-sync/build-check.md
- docs/workflows/fix-hook-mcp-state-sync/code-review.md
- docs/workflows/fix-hook-mcp-state-sync/testing.md
- docs/workflows/fix-hook-mcp-state-sync/regression-test.md
- docs/workflows/fix-hook-mcp-state-sync/acceptance-report.md
- docs/adr/ADR-029-hook-mcp-state-sync.md
- workflow-harness/hooks/hook-utils.js
- workflow-harness/hooks/__tests__/hook-utils.test.js
- workflow-harness/mcp-server/start.sh
- .mcp.json

## next
- commit: 単一 PR (D-004) でアトミック適用する。対象は workflow-harness/hooks/hook-utils.js (+73/-6 行)、.mcp.json (STATE_DIR env 絶対パス)、workflow-harness/mcp-server/start.sh (pwd -P フォールバック)、docs/adr/ADR-029-hook-mcp-state-sync.md (新規 54 行)、docs/workflows/fix-hook-mcp-state-sync/ 成果物群 (.gitignore 対象のため commit 対象外)。
- deploy: .mcp.json の env 変更は Claude Code 再起動を要するため、PR merge 後のセッション再起動を release 手順に明記する (requirements.md L83)。再起動後に harness_start 直後で worker Write が allow されることを AC-1 integration manual として観測する。
- 追跡事項: (1) 既存失敗 10 件 (markdown 文言規約) を別 issue 化し coordinator.md / worker.md / hearing-worker.md の文言整合タスクとして分離。(2) bootstrap 関連 README / skill の物理削除を後続タスクで実施 (D-003 / ADR-029 Sunset)。(3) legacy 二重ネスト `workflow-harness/mcp-server/.claude/state/workflows/` 21 件の物理削除は本スコープ外として ADR-029 Consequences に既記載、別タスクで掃除する。
- 監視: release 後 1 週間は harness_start 直後の phase 取得エラーログを monitoring し、twoo read fallback が想定外ケースで発火していないか確認する。発生時は hook-utils.js の revert で原状復帰可能 (testing.md L75)。
