# リサーチフェーズ結果報告書

## サマリー

- 目的: regression_test フェーズで `workflow_capture_baseline` を呼び出した際に「ベースライン記録はresearch/testingフェーズでのみ可能」エラーが発生した問題の根本原因を調査する
- 主要な決定事項: regression_test の subagentTemplate に `workflow_capture_baseline` の禁止ガイダンスが欠落していることを確認した。testing フェーズのテンプレートには適切なガイダンスが存在するが、regression_test テンプレートの「ワークフロー制御ツール禁止」リストに `workflow_capture_baseline` が含まれていない
- 次フェーズで必要な情報: definitions.ts の regression_test subagentTemplate（約880行付近）への修正箇所と修正内容の特定が完了している

## testing フェーズのテンプレート調査結果

testing フェーズの subagentTemplate（definitions.ts 866行目付近）には `workflow_capture_baseline` の呼び出しガイダンスが存在する。具体的な内容は以下の通りである。

```
## workflow_capture_baseline 呼び出し（ベースライン記録）

テスト実行後、**必ず** workflow_capture_baseline を呼び出してベースラインを記録すること。
この呼び出しは workflow_record_test_result より先に行うことを推奨する。

⚠️ 警告: ベースライン記録を省略した場合、regression_testフェーズへの遷移時に
「ベースラインが記録されていません」エラーが発生してフェーズ遷移がブロックされる。
```

このガイダンスは testing フェーズ内でベースライン記録が必須であることを明示しており、設計意図が正しく文書化されている。

## regression_test フェーズのテンプレート調査結果

regression_test の subagentTemplate（definitions.ts 880行目付近）には以下の問題が存在する。

**問題点1: `workflow_capture_baseline` の禁止ガイダンスが欠落**

「ワークフロー制御ツール禁止」セクションには以下のツールのみが禁止として列挙されている:
- workflow_next
- workflow_approve
- workflow_complete_sub
- workflow_start
- workflow_reset

しかし `workflow_capture_baseline` は禁止リストに含まれていない。

**問題点2: ベースラインの前提条件の記載がない**

regression_test テンプレートには「ベースラインは testing フェーズで記録済みであることが前提」という説明が存在しない。
このため、subagent や Orchestrator がベースライン記録を regression_test フェーズ内で試みる可能性がある。

## 問題の根本原因分析

### 発生メカニズム

1. testing フェーズでは `workflow_capture_baseline` の呼び出しが推奨されている
2. しかし、testing フェーズが parallel_quality 内での事前テスト結果記録によりバイパスされた場合、`workflow_capture_baseline` の呼び出し機会が失われる
3. その後 regression_test フェーズに遷移した際、Orchestrator がベースライン記録を試みる
4. MCP サーバー側で regression_test フェーズからの `workflow_capture_baseline` 呼び出しがブロックされる
5. エラー「ベースライン記録はresearch/testingフェーズでのみ可能」が発生する

### 根本原因の分類

**根本原因A: regression_test テンプレートの禁止ガイダンス欠落**

FR-5 でワークフロー制御ツールの禁止ガイダンスを追加した際、`workflow_capture_baseline` がデータ記録ツールとして分類されており、制御ツールの禁止リストから漏れていた。
しかし MCP サーバー側では `workflow_capture_baseline` の呼び出しを testing フェーズに限定しているため、regression_test からの呼び出しは設計上エラーになる。

**根本原因B: testing フェーズバイパス時のベースライン記録機会喪失**

parallel_quality フェーズ（build_check + code_review）で workflow_record_test_result を事前記録した場合、workflow_next が testing フェーズを自動スキップして regression_test に直接遷移する。
この経路では testing フェーズの subagentTemplate が実行されないため、workflow_capture_baseline の呼び出しが行われない。

## 修正が必要な箇所の特定

### 修正箇所1: regression_test subagentTemplate（優先度: 高）

definitions.ts の regression_test テンプレートの「ワークフロー制御ツール禁止」セクションに以下を追加する:

- 禁止ツールリストに `workflow_capture_baseline` を明示的に追加
- 追加理由として「ベースライン記録は testing フェーズでのみ有効であり、regression_test フェーズからの呼び出しはアーキテクチャ上エラーになる設計」であることを説明

### 修正箇所2: regression_test subagentTemplate にベースライン前提条件セクション追加（優先度: 高）

regression_test テンプレートに新しいセクションを追加して以下を記載する:

- ベースラインは testing フェーズで記録済みであることが前提
- regression_test フェーズではベースライン再記録を試みないこと
- ベースラインが未設定の場合は testing フェーズへの差し戻しが必要

### 修正箇所3（任意）: testing バイパス時の Orchestrator ガイダンス（優先度: 中）

CLAUDE.md または testing テンプレートに、testing フェーズがバイパスされる場合に Orchestrator が workflow_capture_baseline を直接呼び出すべきタイミングのガイダンスを追加することを検討する。

## テスト方針

修正後、以下のテストケースを追加する:

- TC-FIX-1: regression_test の subagentTemplate に `workflow_capture_baseline` の禁止ガイダンスが含まれることを確認
- TC-FIX-2: regression_test の subagentTemplate に「ベースラインは testing フェーズで記録済みであることが前提」という文言が含まれることを確認
