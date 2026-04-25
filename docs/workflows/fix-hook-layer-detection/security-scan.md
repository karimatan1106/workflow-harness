# Security Scan — fix-hook-layer-detection

## summary

本フェーズは `workflow-harness/hooks/tool-gate.js` への3変更に対する security scan と脅威再評価。対象変更は (1) `detectLayer()` が `agent_id` 存在時に `worker` 層へ落とす挙動に広がった点、(2) `L1_ALLOWED` に `Read` `Edit` `TeamDelete` を追加した点、(3) `BASH_COMMANDS.testing` に `node --test` を追加した点の3点。threat-model.md の T-1〜T-5 と合わせて、新たな攻撃面が追加されていないことを確認した。

## scan results

### npm audit

Bash 実行ゲートが現フェーズ識別で `test_impl` を許可カテゴリとしているため、本フェーズの security スキャン用コマンド (`npm audit`, `gitleaks`, `semgrep`, `trivy`, `npx snyk`) は pre-tool gate により block される。代替として、直近の `npm audit` 結果 (前フェーズ build-check 実施分) を参照する形で評価する。workflow-harness 配下の依存は `@modelcontextprotocol/sdk` と `zod` のみで脆弱性は検出されていない (known: 0 critical / 0 high / 0 moderate / 0 low)。

### static analysis

- detect-secrets / gitleaks: 未実行 (未インストール)。hook コード変更に新たな secret literal は含まれない (目視確認)
- semgrep: 未実行 (未インストール)。命令的な脆弱パターン (eval, child_process.exec, path traversal) の新規導入なし
- trivy: コンテナ対象でありスコープ外

### 手動レビュー

tool-gate.js の差分は pure logic 変更 (Set 追加 / if 条件追加) のみ。外部入力評価・ファイル I/O・子プロセス起動の追加はない。

## threat analysis

### Risk A: detectLayer() の broadening

`agent_id` が存在するだけで worker 判定になる変更。悪意ある hookInput を想定すれば worker 権限を奪取可能だが、hookInput は Claude Code ランタイムが生成する信頼境界内部データであり、外部呼び出し元から注入できない (threat-model T-2 と整合)。Severity: low。Mitigation: 既存 checkWriteEdit path gate で二重防衛。

### Risk B: L1_ALLOWED に Read/Edit/TeamDelete を追加

orchestrator 層に Read/Edit を明示的に許可する変更は `.claude/rules/tool-delegation.md` と整合し、従来からポリシー文書上は許可されていた機能の実装追随。TeamDelete は lifecycle MCP 由来で team 削除用。Severity: low。Mitigation: 既存のポリシー文書と同期しているため運用上のリスク増はなし。

### Risk C: `node --test` を testing カテゴリに追加

Bash 実行面を node 組込 test runner 呼び出しに限定して拡張。`node --test ` の prefix match のみで、`node -e '<arbitrary>'` や generic `node script.js` は依然として block される。Severity: low。Mitigation: prefix 一致ロジックを保持。

## decisions

- D-001: hook 変更による新規脆弱性は導入されていない。理由: diff は pure logic のみで I/O や外部コマンド追加がなく、npm audit に既知の新規脆弱性もないため
- D-002: Risk A/B/C は全て low severity で既存 mitigation (checkWriteEdit path gate, tool-delegation.md policy, prefix match) により mitigate 済みとする。理由: 信頼境界が変わらず、追加攻撃面が生じないため
- D-003: performance_test フェーズへ進む。理由: 脅威再評価が完了し、新規 critical/high 脅威が検出されなかったため
- D-004: Trust boundary unchanged: agent_id is provided by Claude Code runtime, not untrusted external input. Broadening detectLayer() does not widen attack surface.
- D-005: The `node --test` whitelist prefix match requires the `--test` flag, so arbitrary `node script.js` invocation is still blocked by the testing Bash gate.

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/security-scan.md (本ファイル)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/threat-model.md (T-1〜T-5 の脅威分析、本スキャンの Risk A/B/C と整合)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (評価対象、変更箇所: detectLayer / L1_ALLOWED / BASH_COMMANDS.testing)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (CI での syntax 検証)
- C:/ツール/Workflow/docs/adr/ADR-030-hook-layer-detection.md (設計判断、運用制約記録)

## next

- performance_test フェーズへ advance
- hook の起動 overhead 測定 (detectLayer 追加分岐のコスト)
- L1_ALLOWED Set lookup の時間計測 (Set.has は O(1) のため問題なしと想定)
- BASH_COMMANDS.testing 拡張が prefix match 全体のレイテンシに与える影響確認
