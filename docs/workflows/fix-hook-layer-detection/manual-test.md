# Manual Test — fix-hook-layer-detection

## summary

本タスクは hooks 層判定ロジックの修正 (tool-gate.js::detectLayer の opaque hex agent_id 対応 / HARNESS_LAYER env override / checkWriteEdit の worker 書込許可) と phase-config.js の BASH_COMMANDS.testing 拡張であり、対話 UI やユーザー向け機能の変更を含まない純粋な hook 層変更である。よって manual_test phase では画面操作や手動 GUI 検証は不要であり、本タスク遂行中に orchestrator が worker へ delegate し worker が docs/workflows/fix-hook-layer-detection/ 配下に phase 成果物を実際に書き出せたこと、また本 phase までに 18 件の phase 成果物が全て所定パスに生成されたことをライブ検証エビデンスとして採用する。manual-test は「hook 修正後にハーネス動作が期待通り実現しているか」を実ハーネス実行下で確認する行為であり、本タスクのハーネス自身が 18 phase を走破している事実が最も強い証拠である。本 phase 通過後は security_scan へ進む。

## test scenarios

本 hook 変更は以下 3 シナリオで挙動が検証された。いずれも本タスクのハーネス実行中にライブで観測された。

### Scenario 1: Worker subagent が docs/workflows 配下へ書込可能

前提: pre-tool-gate.sh が Worker subagent からの Write/Edit を docs/workflows/fix-hook-layer-detection/*.md 配下に限り allow すること。
手順: Orchestrator が hearing / research / planning / test_design / test_selection / implementation / refactoring / build_check / code_review / testing / regression_test / acceptance_verification の各 phase で Worker subagent を起動し、Worker が所定パスへ .md を Write する。
期待: 全書込が hook にブロックされず成功する。
結果: 18 件 (hearing.md, scope-definition.md, research.md, impact-analysis.md, requirements.md, threat-model.md, planning.md, ui-design.md, design-review.md, test-design.md, test-selection.md, implementation.md, refactoring.md, build-check.md, code-review.md, testing.md, regression-test.md, acceptance-report.md) 全て書込成功。BLOCKED 応答は 0 件。

### Scenario 2: Orchestrator が Read / Edit / MCP 呼び出しを pre-tool-gate 通過できる

前提: tool-delegation.md に従い Orchestrator は Write/Glob/Grep を禁止され、Read/Edit/MCP のみ許可されている。
手順: Orchestrator が本タスク中に acceptance-report.md を Read し、Worker の edit-preview 結果から Edit を発行し、harness_status / harness_get_subphase_template 等の MCP を呼び出す。
期待: これらは layer=orchestrator でも hook に拒否されない。
結果: 全ての Read / Edit / MCP 呼び出しが成功している (本 phase までの対話ログで確認可能)。

### Scenario 3: node --test が test_impl / testing phase の Bash allowlist を通過する

前提: phase-config.js の BASH_COMMANDS.testing に node --test が含まれる。
手順: testing phase で Worker が `node --test hooks/__tests__/` を実行する。
期待: pre-tool-gate.sh が node --test を allow し、tool-gate.test.js 10 件 + hook-utils.test.js 7 件を走行できる。
結果: 17 件 Green、exit code 0、duration 70.0368 ms (testing.md に記録済み)。

## observed behavior

- Scenario 1: 全 18 件の phase 成果物が docs/workflows/fix-hook-layer-detection/ 配下に実在する。evidence として Glob 結果 18 件、本ファイルもその 19 件目として追加される
- Scenario 2: 本 phase の Read (acceptance-report.md) および Orchestrator による Edit 経由の manual-test.md 書込が成功している事実がエビデンス
- Scenario 3: testing.md 内 TAP 出力 "# tests 17 / # pass 17 / # fail 0" が node --test allowlist 動作のエビデンス
- 新規 regression: 0 件
- hook block による書込失敗: 0 件

## decisions

- D-001: 対話 UI や画面操作による手動検証は実施しない。理由: 本タスクは hook 層 (Bash 前段ゲート) の判定ロジック修正のみで、UI/画面/CLI サブコマンドの変更を含まないため、画面手動操作の検証対象が存在しない
- D-002: delegation-write evidence を manual_test の十分条件として採用する。理由: hook 修正の目的は Orchestrator→Worker delegation で Worker が docs/workflows へ書き込めるようにすることであり、本タスク遂行中に 18 件の Worker 書込が成功している事実は最も直接的な live verification である
- D-003: 次 phase は security_scan に進める。理由: 自動テスト (testing.md 17 件 Green) + 手動エビデンス (Worker 書込 18 件成功) の 2 軸で hook 挙動が満たされており、manual_test gate を approve できるため
- D-004: 本 phase での追加コード変更は行わない。理由: manual_test は観測 phase であり、変更が必要な場合は implementation へ差し戻すべきだが、その必要性は観測されなかったため
- D-005: 対話ログ以外の追加録画・スクリーンショット採取は行わない。理由: hook 層の挙動は ConsoleLog / ファイル存在で決定的に判定可能であり、映像/画像エビデンスは冗長であるため

## artifacts

本タスク中に Worker が docs/workflows/fix-hook-layer-detection/ 配下へ書き出した phase 成果物 (manual_test 直前までの 18 件):

- hearing.md — 要件ヒアリング
- scope-definition.md — スコープ確定
- research.md — 既存実装調査
- impact-analysis.md — 影響範囲分析
- requirements.md — AC 定義 (AC-1〜AC-5)
- threat-model.md — セキュリティ脅威分析
- planning.md — 作業計画
- ui-design.md — UI 設計 (UI 変更なし記録)
- design-review.md — 設計レビュー
- test-design.md — テスト設計 (TC-AC1〜TC-AC5)
- test-selection.md — テスト選択
- implementation.md — 実装記録 (tool-gate.js / phase-config.js)
- refactoring.md — リファクタリング
- build-check.md — ビルド確認
- code-review.md — コードレビュー
- testing.md — 単体テスト実行結果 (17 件 Green)
- regression-test.md — 回帰テスト
- acceptance-report.md — 受入判定 (5/5 met)

本 phase 成果物: docs/workflows/fix-hook-layer-detection/manual-test.md (本ファイル)

参照コード: workflow-harness/hooks/tool-gate.js, workflow-harness/hooks/phase-config.js, workflow-harness/hooks/__tests__/tool-gate.test.js

## next

次 phase: security_scan

- 実施内容: 本タスクの hook 変更 (tool-gate.js / phase-config.js) が新規セキュリティリスク (権限昇格 / path traversal / command injection 等) を導入していないかを静的解析する
- 事前入力: implementation.md, threat-model.md, code-review.md
- 出力先: docs/workflows/fix-hook-layer-detection/security-scan.md
- 完了条件: 検出された中以上 severity の指摘が 0 件、または対処方針が planning.md 範囲内で確定していること
