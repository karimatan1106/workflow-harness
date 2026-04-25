# Docs Update: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## summary

変更対象がagent定義ファイル(.claude/agents/)自体であり、これらは開発者ドキュメントそのものである。
追加のドキュメント更新は不要。変更済みファイルがドキュメント成果物を兼ねる。

## analysis

本タスクで変更した3ファイルはいずれもagent定義ドキュメントである:

- .claude/agents/coordinator.md: Phase Output Rulesセクションを追加
- .claude/agents/worker.md: Edit Completenessセクションを追加
- .claude/agents/hearing-worker.md: AskUserQuestion Quality Rulesセクションを書き換え

これらのファイルはコード(実行ロジック)ではなく、LLMエージェントへの指示文書である。
変更内容は品質ルールの明文化であり、ドキュメント更新そのものに該当する。
README、ADR、API仕様、ユーザーガイド等の外部ドキュメントへの影響はない。

## decisions

- D-DU-001: 追加のドキュメント更新は不要と判断した。変更対象ファイル自体がドキュメントであるため。
- D-DU-002: CLAUDE.mdへの追記は不要。品質ルールはagent定義内に閉じており、トップレベル設定に影響しない。
- D-DU-003: ADR新規作成は不要。既存の設計判断(テスト駆動でagent定義を修正する方針)に沿った変更であり、新たなアーキテクチャ判断を含まない。
- D-DU-004: MEMORYファイルへの追記は不要。本タスクはハーネス設計の変更ではなく、既存テストへの適合修正である。
- D-DU-005: workflow-harness/CLAUDE.mdへの追記は不要。ハーネス本体の仕様変更を伴わないため。
- D-DU-006: .claude/rules/配下のルールファイルへの追記は不要。品質ルールはagent定義ファイルが管轄し、rulesファイルはワークフロー全体のポリシーを管轄する。

## artifacts

- .claude/agents/coordinator.md: Phase Output Rulesセクション追加済み(43行、200行制限内)
- .claude/agents/worker.md: Edit Completenessセクション追加済み(61行、200行制限内)
- .claude/agents/hearing-worker.md: AskUserQuestion Quality Rulesセクション書き換え済み(32行、200行制限内)

## next

approvalフェーズへ進む。全AC met、テスト16/16 PASS、コードレビュー承認済み、ドキュメント更新完了。
