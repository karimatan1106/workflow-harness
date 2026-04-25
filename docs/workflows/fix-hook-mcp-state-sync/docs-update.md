# Docs Update — fix-hook-mcp-state-sync

## summary
docs_update フェーズの目的は、本修正 (STATE_DIR 絶対化 + hook の TOON 読取対応) に伴うドキュメント改訂の全量棚卸と、外部ドキュメント (CLAUDE.md / rtk-scope.md / session-recovery.md / workflow-harness README 群) への波及影響判定である。結論としては、本修正の Why は ADR-029 に完全に格納され、What と How はワークフロー成果物 (hearing.md〜e2e-test.md) に揃っており、既存ルール文書 (`.claude/rules/*.md`) および親側 CLAUDE.md への追記は不要と判定する。rtk-scope.md と session-recovery.md は本修正の対象ドメイン外であり、rtk 圧縮スコープおよび復旧手順の記述に state 配置詳細は含まれないため改訂を要しない。

## decisions
- DOC-001: ADR-029 を Why 層の唯一の一次情報として確定する。State 配置 (絶対 STATE_DIR) と hook のフォーマット多重対応 (JSON→TOON fallback) の判断根拠は ADR-029 Context / Decision / Consequences に全文格納済で、documentation-layers.md の Why は immutable 原則を満たす。既存 ADR (001 / 028) とは cross-link 済のため重複 ADR は発行しない。
- DOC-002: What 層ドキュメント (requirements.md / scope-definition.md / test-design.md / acceptance-report.md) は本ワークフローの `docs/workflows/fix-hook-mcp-state-sync/` 配下に完結させる。`.claude/rules/` 配下には本修正専用のルールを追加しない。状態ストア配置は ADR の Why ゲートで守られるため、ルール化 (LLM 裁量制限) は冗長となる。
- DOC-003: How 層 (手順・スクリプト) は `workflow-harness/mcp-server/start.sh` および `workflow-harness/hooks/hook-utils.js` のコード自体が一次情報を担う。スキルファイル新設や CLAUDE.md 追記は documentation-layers.md の二重管理禁止方針に抵触するため行わない。手順が必要になるのは Claude Code 再起動の release 手順のみで、これは requirements.md L83 (ADR-029 内の再起動明記) および acceptance-report.md `next` に既記載のため追加文書化は不要。
- DOC-004: bootstrap 手動成果物の排除 (D-003) は ADR-029 Sunset と acceptance-report.md `next` (AV-007) に記録済で、恒久的削除実作業は後続タスクへ引き継ぐ。本 docs_update フェーズでは「削除済エビデンス (.claude/state/workflows/30fba95f-*/ および task-index.json の active 行)」が hearing.md 38-39 行と implementation.md に記載されていることを確認し、追加記録は作成しない。

## docChanges
### newlyCreated
- `docs/adr/ADR-029-hook-mcp-state-sync.md` (新規 54 行, implementation フェーズで作成) — Why 層 immutable。Context / Decision / Consequences (Positive / Negative / Sunset) / References をフル網羅。
- `docs/workflows/fix-hook-mcp-state-sync/hearing.md` (52 行) — background と 4 件 Recommended 選択、decisions D-001〜D-006。
- `docs/workflows/fix-hook-mcp-state-sync/scope-definition.md` — scopeFiles / scopeDirs 固定。
- `docs/workflows/fix-hook-mcp-state-sync/impact-analysis.md` — 影響範囲棚卸。
- `docs/workflows/fix-hook-mcp-state-sync/research.md` — 既存実装と二重ネスト原因調査。
- `docs/workflows/fix-hook-mcp-state-sync/requirements.md` — F-001〜F-005 / AC-1〜AC-5 トレース。
- `docs/workflows/fix-hook-mcp-state-sync/threat-model.md` — 脅威モデル。
- `docs/workflows/fix-hook-mcp-state-sync/design-review.md` — 設計レビュー記録。
- `docs/workflows/fix-hook-mcp-state-sync/ui-design.md` — UI/UX 影響 (hook 経由ログ表示)。
- `docs/workflows/fix-hook-mcp-state-sync/flowchart.mmd` — フロー図。
- `docs/workflows/fix-hook-mcp-state-sync/state-machine.mmd` — state 遷移図。
- `docs/workflows/fix-hook-mcp-state-sync/planning.md` — 実装計画。
- `docs/workflows/fix-hook-mcp-state-sync/test-design.md` — AC テストケース設計。
- `docs/workflows/fix-hook-mcp-state-sync/test-selection.md` — 実行対象テスト選定。
- `docs/workflows/fix-hook-mcp-state-sync/implementation.md` — 実装詳細。
- `docs/workflows/fix-hook-mcp-state-sync/refactoring.md` — 小リファクタ記録。
- `docs/workflows/fix-hook-mcp-state-sync/build-check.md` — ビルド確認。
- `docs/workflows/fix-hook-mcp-state-sync/code-review.md` — 構造・命名レビュー。
- `docs/workflows/fix-hook-mcp-state-sync/testing.md` — 7/7 green エビデンス。
- `docs/workflows/fix-hook-mcp-state-sync/regression-test.md` — 854/864 regression 結果。
- `docs/workflows/fix-hook-mcp-state-sync/manual-test.md` — 手動リプレイ観測。
- `docs/workflows/fix-hook-mcp-state-sync/e2e-test.md` — harness_start 直後の Write 通過エンドツーエンド観測。
- `docs/workflows/fix-hook-mcp-state-sync/performance-test.md` — 4KB head read 50ms 性能契約検証。
- `docs/workflows/fix-hook-mcp-state-sync/security-scan.md` — 絶対パス埋込とログ出力の PII リスク確認。
- `docs/workflows/fix-hook-mcp-state-sync/acceptance-report.md` — AC-1〜AC-5 全件 accepted 判定。

### existingFilesDelta
- 既存ルールファイル (`.claude/rules/session-recovery.md`, `.claude/rules/rtk-scope.md`, `.claude/rules/documentation-layers.md`, `.claude/rules/core-constraints.md`, `.claude/rules/tool-delegation.md`) は本修正の対象外。判定根拠は後述 externalImpact 参照。
- 親 `CLAUDE.md` (19 行+rtk セクション 10 行) は更新不要。理由は state 配置と hook のフォーマット挙動の詳細が LLM の裁量対象ではなく、ADR-029 に immutable 固定で足りるため (documentation-layers.md 判定基準の Why に該当)。

## externalImpact
- `CLAUDE.md` (親): 変更不要。rtk セクションは圧縮スコープの話で本修正と独立。ワークフロー強制 / オーケストレーター委譲 / セッション終了時の 3 セクションはいずれも本修正の state 同期と直接関係しない。
- `.claude/rules/session-recovery.md`: 変更不要。`harness_status → claude-progress.json → git log -20` の 3 ステップ復旧手順は state ストアの内部レイアウト (JSON vs TOON / 絶対 vs 相対 STATE_DIR) に依存せず、MCP API 経由で動作する。hook が TOON を読めるようになっても復旧手順の外面は変わらない。
- `.claude/rules/rtk-scope.md`: 変更不要。rtk は Bash 出力圧縮層でありファイル I/O や state ストアには一切関与しない。本修正が触った fs.readSync / fs.readFileSync 経路は Node hook 側で rtk bypass 領域。
- `.claude/rules/documentation-layers.md` / `.claude/rules/core-constraints.md` / `.claude/rules/forbidden-actions.md` / `.claude/rules/tool-delegation.md` / `.claude/rules/workflow-enforcement.md` / `.claude/rules/code-search-policy.md`: いずれも変更不要。本修正は既存ルール体系の枠内で実施され、新規 LLM 制約を導入しないため追記不要。
- `workflow-harness/CLAUDE.md` (submodule 側): 変更不要。ADR-028 で親からの分離を進めた submodule 側の CLAUDE.md は setup / install 指南にフォーカスしており、state 配置の絶対パス化は setup.sh および start.sh のコード自体が一次情報を担う。
- `workflow-harness/INSTALL.md`: 変更不要。Install 手順は submodule 取込と npm install / setup.sh 実行手順で、STATE_DIR の解決は start.sh の pwd -P フォールバックで自動化された。利用者に追加手順は発生しない。
- `workflow-harness/STRUCTURE_REPORT.md`: 変更候補だが本スコープ外。submodule 内部の構造レポートで、state 配置の現状スナップショットを含む可能性があるが、ADR-028 側の管理文書であり fix-hook-mcp-state-sync 側からの侵襲は避ける。後続の submodule メンテナンスタスクで同期する。
- `setup.sh`: 変更不要。submodule 同梱スクリプトで STATE_DIR 環境変数を直接扱っていない。start.sh 側で解決されるため連鎖変更なし。

## conclusion
追加ドキュメント作業は None required と判定する。判定根拠は 3 点。第一に Why 層は ADR-029 が immutable に固定し ADR-001 / ADR-028 と cross-link 済で documentation-layers.md の「新ルール追加時は ADR を必ず作成」要件を充足する。第二に What 層は requirements.md の AC-1〜AC-5 と F-001〜F-005 および acceptance-report.md の AV-001〜AV-007 がトレーサビリティを担保し、追加の rules 文書や skill 新設はむしろ二重管理リスク (documentation-layers.md の How 手段決め付け) を高める。第三に How 層は start.sh / hook-utils.js / .mcp.json のコード自体が一次情報として機能し、Claude Code 再起動という唯一の手動手順は acceptance-report.md `next` に release 手順として既記載済で重複化を避ける。したがって本 docs_update では既存 26 件の成果物と ADR-029 の追加で必要十分であり、外部 7 文書 (親 CLAUDE.md / rules 7 件 / submodule CLAUDE.md / INSTALL.md) への追記は発生しない。

## artifacts
- C:/ツール/Workflow/docs/adr/ADR-029-hook-mcp-state-sync.md (Why 層, 54 行, immutable ADR)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/hearing.md (background + D-001〜D-006 確定版)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/requirements.md (AC-1〜AC-5 / F-001〜F-005 トレース表)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/test-design.md (AC テストケース設計書)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/implementation.md (コード変更一次記録)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/code-review.md (構造レビュー緑判定)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/testing.md (7/7 green エビデンス, exitCode=0)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/regression-test.md (854/864 新規 regression=0)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/acceptance-report.md (AC-1〜AC-5 accepted 総括)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/e2e-test.md (harness_start 直後の Write 通過観測)
- C:/ツール/Workflow/.claude/rules/documentation-layers.md (判定基準の参照ルール, 変更なし)
- C:/ツール/Workflow/CLAUDE.md (親プロジェクト指南, 変更なし)

## next
- retrospective フェーズへ進み、本ワークフロー全体の振り返り (keepProblemTry) を記録する。特に bootstrap 手動運用からの離脱、ADR-028 継承による submodule 分離仕上げ、TOON 最小パーサの L1-L4 決定性維持の 3 点を掘り下げる。
- retrospective 後の commit では単一 PR 方針 (D-004) に従い、.mcp.json / start.sh / hook-utils.js / hook-utils.test.js / ADR-029 を一括 atomic コミットする。docs/workflows/ 配下は .gitignore 対象のため commit 対象外となる点を retrospective でも再確認する。
- 追跡事項: (1) 既存 regression 失敗 10 件 (markdown 文言規約) を別 issue として分離追跡、(2) legacy 二重ネスト `workflow-harness/mcp-server/.claude/state/workflows/` 21 件の物理削除を後続タスクでスケジュール、(3) bootstrap 関連 README / skill の物理削除も後続タスクへ引継ぎ。
