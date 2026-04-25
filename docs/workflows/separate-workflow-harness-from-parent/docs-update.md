# Docs Update: separate-workflow-harness-from-parent

## scope
Phase A の資産移管に伴い更新が必要なドキュメントの評価と対応記録。本 Phase は親→submodule への資産移管のみを扱い、親リポ自体の削除は Phase D で実施する。

## reviewedDocs
- RD-1 親 `C:/ツール/Workflow/CLAUDE.md` — Phase D で削除予定のため更新不要
- RD-2 親 `C:/ツール/Workflow/README.md` — Phase D で削除予定のため更新不要
- RD-3 submodule `workflow-harness/README.md` — 既存の standalone 案内で十分、本 Phase では触らない
- RD-4 submodule `workflow-harness/CLAUDE.md` — ハーネス権威仕様を既に保持、移管資産の配置が自明なため追記不要
- RD-5 `.claude/rules/*` 配下 — 移管済みファイルで内容同一、追加説明は冗長
- RD-6 ADR 新規追加 — 本 Phase は migration のみで新たな設計判断なし、ADR 追加不要

## decisions
- D-DU-1: 親リポのドキュメントは Phase D で一括削除されるため更新しない
- D-DU-2: submodule 側の README/CLAUDE.md は既に standalone 想定の記述で十分
- D-DU-3: 移管資産 (ADR 28 本, phases 27 本, hooks 11 本, commands 3 本, rules 2 本) は submodule の既存構造と同一階層に配置済み
- D-DU-4: ADR-027 (remove-minimax-settings) は直前タスクで追加済みのため本 Phase での重複記録なし
- D-DU-5: docs_update フェーズで生成すべき新規ドキュメントは本ファイルのみ

## rationale
- 親 CLAUDE.md / README.md に追記しても Phase D で削除されるため二重作業になる
- submodule 側の README は standalone 利用を前提とした構成で既に完結している
- submodule 側の CLAUDE.md は権威仕様として Phase 定義・ゲート仕様を保持済み
- 移管資産は配置先の既存パス体系に溶け込んでおり、別途インデックス化する価値が薄い
- 本 Phase のスコープは「資産移管」であり「ドキュメント再設計」ではない

## artifacts
- docs/workflows/separate-workflow-harness-from-parent/docs-update.md (本ファイル)
- workflow-harness/README.md (変更なし、既存のまま有効)
- workflow-harness/CLAUDE.md (変更なし、既存のまま有効)
- workflow-harness/.claude/rules/*.md (Phase A 前半で配置済み)

## next
commit フェーズに進み、Phase A で生成したドキュメント一式を親リポの該当範囲で commit する。実際の資産移管 commit は既に submodule 側で完了 (c5f5ce1, f834228)。その後 push, health_observation を経て Phase A を完了する。
