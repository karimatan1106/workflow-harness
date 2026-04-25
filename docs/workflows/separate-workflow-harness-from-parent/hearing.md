# hearing: separate-workflow-harness-from-parent

phase: hearing
task: separate-workflow-harness-from-parent
status: complete
summary: 親リポ C:\ツール\Workflow\ と workflow-harness submodule を完全分離するための Phase A (加法的移管) のヒアリング記録

## intent-analysis

surfaceRequest: C:\ツール\Workflow\ と workflow-harness を完全分離したい。Workflow 親リポジトリは不要。
deepNeed: workflow-harness を独立した単独リポジトリとして C:\ツール\workflow-harness\ に昇格させ、親リポジトリ固有の運用資産 (ADR/テンプレ/hooks/commands/rules) を喪失せずに保全する。同居していた他プロジェクト (kirigami/remotion/vision_ocr_mcp_server/src/mcp-servers) は不要物として廃棄する。
unclearPoints:
  - 親リポジトリ固有資産のうちどこまで submodule 側に移管するか
  - 同居プロジェクトの扱い (保全 or 削除)
  - 最終的な submodule 配置ディレクトリ
  - Claude Code の auto-memory (~/.claude/projects/C------Workflow/) の扱い
  - GitHub remote (karimatan1106/Workflow.git) の扱い
assumptions:
  - 本タスクは Phase A (加法的移管 + .mcp.json cwd 修正 + commit + push) のみをスコープとする
  - Phase B (単独 clone 昇格)、Phase C (auto-memory 削除)、Phase D (親リポ削除) は後続タスクまたは手動実行
  - submodule 側 main ブランチへの push で完結する
  - 既存 submodule 運用ルール (ファイル ≤200 行、禁止語回避、L1-L4 ゲート) は維持

userResponse: 事前 Q&A (5 問) で全論点が確定済み。以下が確定回答。Q1 同居プロジェクト扱い=kirigami/remotion/vision_ocr_mcp_server/src/mcp-servers 含め全削除。Q2 設計資産移管=ADR 27 件 + phase テンプレ 27 件 + 親固有 hooks 13 本 + commands 3 本 + 追加 rules 2 本を submodule に加法的移管してから親を捨てる。Q3 最終配置=C:\ツール\workflow-harness\ に昇格。Q4 auto-memory=~/.claude/projects/C------Workflow/ を完全削除。Q5 GitHub remote=karimatan1106/Workflow.git は放置 (削除もアーカイブもしない)。本タスクのスコープは Phase A (加法的移管 + .mcp.json cwd 修正 + commit + push) のみで、Phase B/C/D は本タスク範囲外。

## implementation-plan

approach: 加法的 (additive) 移管。親リポ側は一切削除せず、workflow-harness submodule 側にのみファイルを追加する。親リポで保持されている固有資産をカテゴリ別に submodule 側の対応ディレクトリに複製し、.mcp.json の cwd 参照を submodule 基準に修正。最後に submodule を main へ commit+push。親リポ側ファイルの削除と物理移動は Phase B 以降で実施する。

estimatedScope:
  - ADR 移管: 27 件 (docs/adr/ADR-NNN.md)
  - フェーズテンプレ移管: 27 件 (templates または mcp-server/src/phases/*)
  - hooks 移管: 13 本 (.claude/hooks/ → workflow-harness/.claude/hooks/)
  - commands 移管: 3 本 (.claude/commands/)
  - 追加 rules 移管: 2 本 (.claude/rules/)
  - .mcp.json cwd 修正: 1 箇所
  - 合計変更ファイル数: 73 件前後
  - コード変更行数: 加法のため submodule 側で純増 (概算 3000-5000 行)

risks:
  - 移管後の submodule 単独動作で参照パスが親リポ相対になっていると壊れる
  - .mcp.json cwd 変更で他タスクのハーネス起動が一時的に不整合になる
  - hooks が親リポ絶対パスを埋め込んでいる場合、submodule 単独配置で動かない
  - ADR 番号の重複 (submodule 既存 ADR-001〜005 と親リポ ADR と衝突)
  - phase テンプレが mcp-server/src/phases/ 側と重複・差分ありの可能性
  - submodule 側テストが CI で落ちる可能性 (加法でも import path が変わると壊れる)

questions:
  - なし (事前 Q&A で全論点確定済み)

## decisions

- D-HR-1: 本タスクのスコープを Phase A (加法的移管+cwd 修正+commit+push) のみに限定する。理由: 親リポ削除 (Phase D) まで一括実施すると失敗時の復旧コストが高い。加法のみなら rollback は submodule revert だけで済む。
- D-HR-2: 同居プロジェクト (kirigami/remotion/vision_ocr_mcp_server/src/mcp-servers) は移管対象外。理由: ユーザー回答 Q1=a で「全削除」が確定しており、submodule に持ち込む必然性がない。
- D-HR-3: ADR 番号衝突時は submodule 既存番号を優先し、親リポから持ち込む ADR は次番 (ADR-006 以降) にリナンバリングする。理由: submodule 側の既存 ADR-001〜005 が権威的引用元となっており、変更すると他箇所の参照が壊れる。
- D-HR-4: auto-memory (~/.claude/projects/C------Workflow/) の削除は本タスク範囲外。理由: Claude Code ランタイムが保持するキャッシュであり、親リポ削除 (Phase D) と同時でなければ意味がない。
- D-HR-5: GitHub remote karimatan1106/Workflow.git は放置する。理由: ユーザー回答 Q5=c で明示的に「放置」確定。削除もアーカイブもしない。

## artifacts

- path: docs/workflows/separate-workflow-harness-from-parent/hearing.md
  role: spec
  summary: 本ヒアリング記録。Phase A スコープ確定と 5 項目の決定事項を含む

## next

criticalDecisions: Phase A のみスコープ、加法的移管、ADR リナンバリング方針、auto-memory/remote は本タスク対象外
readFiles: workflow-harness/docs/adr/, workflow-harness/.claude/hooks/, workflow-harness/.claude/commands/, workflow-harness/.claude/rules/, workflow-harness/mcp-server/src/phases/, .mcp.json
warnings: 加法のみ実施。親リポ側の削除操作は一切行わない。submodule 側 main への commit+push で完結すること。親リポ cwd でのテストは依然 pass する必要がある。
