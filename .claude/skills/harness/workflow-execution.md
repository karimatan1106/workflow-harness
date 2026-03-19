---
name: harness-execution
description: Phase-specific subagent config, bash permissions, error-to-improvement conversion, and edit restrictions.
---
> CLAUDE.md Sec5(Orchestrator)/Sec6(Retry)/Sec12(Bash) が権威仕様。本ファイルはフェーズ別設定のみ。

## フェーズ別subagent設定（Agent Teams経由）

| フェーズ | model | delegation | 入力 | 出力 |
|---------|-------|-----------|------|------|
| scope_definition | sonnet | TeamCreate→Coordinator→Agent→Worker | - | scope-definition.toon |
| research | sonnet | TeamCreate→Coordinator→Agent→Worker | - | research.toon |
| impact_analysis | sonnet | TeamCreate→Coordinator→Agent→Worker | research.toon | impact-analysis.toon |
| requirements | sonnet | TeamCreate→Coordinator→Agent→Worker | research.toon | requirements.toon |
| threat_modeling / planning | sonnet | TeamCreate→Coordinator→Agent→Worker | requirements.toon / threat-model.toon | threat-model.toon / spec.toon |
| state_machine / flowchart | haiku | TeamCreate→Coordinator→Agent→Worker | spec.toon | *.mmd |
| ui_design | sonnet | TeamCreate→Coordinator→Agent→Worker | spec.toon + *.mmd | ui-design.toon |
| design_review | sonnet | TeamCreate→Coordinator→Agent→Worker | *.mmd + ui-design.toon | - |
| test_design | sonnet | TeamCreate→Coordinator→Agent→Worker | spec.toon + *.mmd | test-design.toon |
| test_impl / implementation | sonnet | TeamCreate→Coordinator→Agent→Worker | test-design.toon / *.test.ts | *.test.ts / *.ts |
| refactoring / build_check | haiku | TeamCreate→Coordinator→Agent→Worker | *.ts | *.ts / - |
| code_review | **opus** | TeamCreate→Coordinator→Agent→Worker | *.ts | code-review.toon |
| testing / regression_test | haiku | TeamCreate→Coordinator→Agent→Worker | テストスイート | - |
| manual_test ~ e2e_test | sonnet | TeamCreate→Coordinator→Agent→Worker | - | *.toon |
| docs_update ~ deploy | haiku | TeamCreate→Coordinator→Agent→Worker | 全成果物 | ドキュメント / - |

## フェーズ別Bash許可カテゴリ

| フェーズ群 | 許可 |
|-----------|------|
| research ~ design_review, code_review, manual_test, docs_update ~ deploy | readonly |
| test_impl | readonly, testing |
| implementation, refactoring, build_check | readonly, testing, implementation |
| testing, regression_test, performance_test, e2e_test | readonly, testing |
| security_scan | readonly, testing, security |
| commit, push | readonly, git |

commitフェーズにimplementation(rm含む)なし。削除はimplementation/refactoringで完了すること。

## エラー種別→改善要求変換

| エラー種別 | 改善要求 |
|-----------|---------|
| 禁止パターン検出 | 検出語句を削除し具体的実例に置換 |
| セクション密度不足 | 該当セクションに実質的内容を追加 |
| 同一行繰り返し | 各行を異なる文脈固有の内容に書き換え |
| 必須セクション欠落 | 欠落セクションヘッダーを追加 |
| 行数不足 | 成果物の行数を必要行数以上に増加 |

## フェーズ別編集可能ファイル

| フェーズ | 編集可能 | 禁止 |
|---------|---------|------|
| idle / commit / push / completed | なし | 全て |
| research ~ parallel_analysis | .toon, .md | コード |
| parallel_design | .toon, .md, .mmd | コード |
| design_review | .toon, .md | コード |
| test_design ~ regression_test | .toon, .md, テストファイル | ソースコード |
| test_impl | テストファイル, .toon, .md | ソースコード |
| implementation | ソースコード | テストファイル |
| refactoring / parallel_quality | コード全般 | - |
| parallel_verification / docs_update ~ deploy | .toon, .md | コード |

## subagent委譲時の必須コンテキスト

subagentに委譲する際、以下の情報をプロンプトに含めること：
- taskId と sessionToken
- 成果物の出力先: `docs/workflows/{taskName}/` （docsDir）
- TOON形式: `key: value` のフラットKV。カンマ含む値は引用符必須。バックスラッシュ禁止
- ファイル名: ハイフン区切り（例: `scope-definition.toon`, `research.toon`）
- 必須キー: フェーズごとのDoD要件（harness_get_subphase_template で取得可能）
