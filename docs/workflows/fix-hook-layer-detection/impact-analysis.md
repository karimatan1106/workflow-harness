# Impact Analysis — fix-hook-layer-detection

## Direct Impact

`workflow-harness/hooks/tool-gate.js::detectLayer()` 関数の挙動が変わる。旧実装では opaque hex agent_id に対して `'coordinator'` を返していたが、新実装では `'worker'` を返す。

## Indirect Impact (consumers)

- `checkWriteEdit`: layer=`'worker'` 扱いになったため、docs/workflows/ への書き込みが許可されるようになる。これが本修正の主目的
- `checkL1`: agent_id 不在時のみ orchestrator 判定に入るため影響なし
- `checkL2/L3` (coordinator/worker 固有チェック): 今まで coordinator チェックに落ちていた subagent が worker チェックに落ちる。両者のチェック内容に実質的な差はない (bashCategories/allowedExtensions は phase 由来で layer 依存ではない)

## Affected Phases

- hearing: artifact 書き込みが回復
- scope_definition: artifact 書き込みが回復
- requirements: artifact 書き込みが回復
- その他全 phase: 同上

## Behavioral Compatibility

- HARNESS_LAYER=worker / coordinator の明示 override: 引き続き機能する (先頭の env チェック分岐を維持)
- orchestrator 判定 (agent_id 不在): 挙動変更なし
- 既存の L1 ブロックルール (checkL1): agent_id 不在時のみ適用されるため影響なし

## Test Coverage Impact

- 既存テスト (hook-utils.test.js 等): detectLayer を直接呼ぶテストが存在しないため影響なし
- 新規テスト: opaque hex agent_id 入力時の worker 判定、HARNESS_LAYER override、orchestrator 判定の 3 系統を追加

## Deployment Impact

- hook は再起動不要 (Claude Code は都度 node で起動)
- .claude/hooks/pre-tool-gate.sh の変更なし
- MCP サーバー再起動不要
- 既存タスク (docs-workflows-refactoring-v2, integrate-security-review-into-harness 等) も修正後は正常に進行可能

## Rollback Plan

- 旧実装を git revert で復元可能
- ホットパッチ済みのため実装差分は detectLayer 関数 3 行の削除のみ
- テスト追加と ADR 追加は rollback しても正常機能に影響しない (補助的成果物)

## decisions

- D-001: 全ての subagent で共通の挙動になるため、coordinator と worker を区別する必要がなくなる。理由: 2 層モデル (L1/L3) と一致し、区別を維持するコストに対する利益がない
- D-002: 既存タスクは新 hook で自動的に正常化される。追加 migration 手順は不要。理由: hook は stateless で都度評価されるため、状態遷移が発生しない
- D-003: テスト追加は回帰防止が主目的であり、実装の正しさは smoke test で既に確認済みのため Red→Green の厳密な TDD は強制しない。理由: ホットパッチが既に適用済みで実動作が確認されているため、後追いで regression test を固定化するのが現実的
- D-004: ADR-030 は設計判断のイミュータブル記録として作成する。理由: 本修正は Claude Code の hook 契約に依存しており、将来の契約変更時に影響範囲を評価する根拠となる
- D-005: rollback は git revert で可能。追加の rollback 仕組みは不要。理由: 変更が局所化されており、他の状態 (state files, 設定等) に副作用を持たないため

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/impact-analysis.md (本ファイル — 影響範囲の分析記録)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (影響対象コード、ホットパッチ済み)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (新規テスト追加予定)
- C:/ツール/Workflow/docs/adr/ADR-030-hook-layer-detection.md (新規 ADR 作成予定)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/research.md (前 phase の調査記録、参照用)

## next

- requirements phase: AC-1〜AC-5 (opaque hex→worker、HARNESS_LAYER override、orchestrator 判定保持、path gate 連携、回帰テスト存在) を定義
- threat_model phase: hook bypass リスクと mitigation をレビュー
- design phase: detectLayer の入出力契約を明文化
- test_design/test_impl phase: 回帰テスト TC-AC1-01〜TC-AC5-01 を設計・実装
- documentation phase: ADR-030 を作成
