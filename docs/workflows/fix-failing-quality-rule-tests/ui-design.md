# UI Design: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Summary

本タスクはagent定義Markdownファイル(coordinator.md, worker.md, hearing-worker.md)への品質ルールセクション追記であり、ユーザー向けUIコンポーネントの変更は一切含まない。CLIインターフェース、Webインターフェース、視覚的要素のいずれも影響を受けない。

## Scope Assessment

変更対象は内部agent定義ファイルのみ:
- `.claude/agents/coordinator.md` -- Phase Output Rules セクション追加
- `.claude/agents/worker.md` -- Edit Completeness セクション追加
- `.claude/agents/hearing-worker.md` -- AskUserQuestion Quality Rules セクション追加

これらはLLMが参照するagent指示テキストであり、エンドユーザーが直接操作・閲覧するUI要素ではない。

## UI Impact Analysis

- 画面レイアウト: 変更なし
- ユーザー操作フロー: 変更なし
- 入力フォーム: 変更なし
- 出力表示: 変更なし
- エラーメッセージ: 変更なし
- アクセシビリティ: 変更なし
- レスポンシブ対応: 該当なし

## decisions

- D-001: 本タスクにUI変更は存在しないため、UIモックアップ・ワイヤーフレームの作成は不要と判断した
- D-002: agent定義ファイルはLLM内部で参照されるテキストであり、ユーザー向けUIレイヤーには影響しない
- D-003: 追加されるセクション(Phase Output Rules, Edit Completeness, AskUserQuestion Quality Rules)はagentの振る舞い制約であり、表示要素ではない
- D-004: テスト対象(first-pass-improvement.test.ts, hearing-worker-rules.test.ts)もUI関連テストではなく、ファイル内容の正規表現マッチング検証である
- D-005: 本フェーズの成果物はこのui-design.md自体のみであり、追加のデザインアーティファクトは不要である

## artifacts

- `C:/ツール/Workflow/docs/workflows/fix-failing-quality-rule-tests/ui-design.md` -- 本ドキュメント(UI変更なしの判定記録)

## next

implementation フェーズへ進む。planning.md の Step 1-3 に従い、3つのagent定義ファイルにセクションを追記し、Step 4 で全10テストのPASSを確認する。
