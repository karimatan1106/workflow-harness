## サマリー

subagentがBashコマンド実行時に「コマンドチェーン違反」でブロックされる問題を調査した。
CLAUDE.mdのsubagent起動テンプレートにBashコマンド許可情報が含まれていないことが根本原因。
前回のルール21で追加した「成果物品質要件の具体ルール」と同じパターンで、Bashホワイトリスト情報もsubagentに伝達可能。

- 目的: subagentへのBashコマンドホワイトリスト伝達メカニズムの確立
- 主要な発見: テンプレートにBashコマンド情報が未記載、bash-whitelist.jsに18フェーズの詳細マッピングが存在
- 次フェーズで必要な情報: フェーズ別許可コマンド一覧、テンプレートへの追加フォーマット

## 既存実装の分析

### 1. 現状の問題

subagent起動テンプレート（CLAUDE.md）には以下が記載済み:
- サマリーセクション必須化
- 成果物品質要件の具体ルール（禁止語句、セクション密度等）

しかしBashコマンドの許可情報は**未記載**。subagentはどのコマンドが許可されているか知らないまま実行し、フックでブロックされる。

### 2. bash-whitelist.jsのフェーズ別マッピング

bash-whitelist.jsのgetWhitelistForPhase関数で18フェーズのマッピングが定義済み:

| フェーズグループ | 対象フェーズ | 許可カテゴリ |
|----------------|-------------|-------------|
| readonlyPhases | research, requirements, threat_modeling, planning, state_machine, flowchart, ui_design, test_design, design_review, code_review, manual_test | readonly |
| testingPhases | testing, regression_test | readonly + testing |
| implementationPhases | test_impl, implementation, refactoring | readonly + testing + implementation |
| verificationPhases | security_scan, performance_test, e2e_test, ci_verification | readonly + testing |
| gitPhases | commit, push | readonly + git |
| build_check | build_check | readonly + testing + implementation + rm |
| docsUpdatePhases | docs_update | readonly |
| deployPhases | deploy | readonly + implementation + deploy |

### 3. CLAUDE.mdの3カテゴリ定義

- readonly: ls, pwd, cat, head, tail, grep, find, wc, git status/log/diff/show, npm list, node/npm --version
- testing: npm test, npm run test, npx vitest/jest/playwright, pytest
- implementation: npm install, pnpm add, npm run build, mkdir, rm, git add, git commit

## 調査結果

bash-whitelist.jsには18フェーズ全ての許可コマンドマッピングが定義済みだが、CLAUDE.mdのsubagent起動テンプレートにはこの情報が伝達されていない。
subagentはどのコマンドが許可されているか知らないまま実行し、フックの検証でブロックされる。
成果物品質要件の伝達パターン（テンプレート内の「★重要★」セクション）が既に成功しているため、同じアプローチでBashホワイトリストも伝達可能。
CLAUDE.mdのsubagent起動テンプレートに「実行許可Bashコマンド」セクションを追加し、Orchestratorがフェーズに応じて許可コマンド一覧を動的に埋め込む方式が最適。
phaseGuideにbashWhitelist情報を含める方法もあるが、CLAUDE.md側の記述だけで対応可能な範囲であり、MCPサーバーの変更は不要と判断する。
