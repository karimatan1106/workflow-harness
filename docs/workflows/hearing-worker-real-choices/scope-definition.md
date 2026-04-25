# Scope Definition: hearing-worker-real-choices

taskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e
phase: scope_definition
size: large

## 問題定義

hearing-workerが「全決定委任(A)で進めてよいですか？」のような実質1択の確認形式でAskUserQuestionを使用している。ユーザーが実質的な選択権を持てていない。前回FIX-1でテンプレートに「選択肢は2個以上提示すること」を追加したが、指示が抽象的すぎて効果がなかった。

## スコープファイル

対象ファイル(2ファイル):
- .claude/agents/hearing-worker.md: hearing-workerエージェント定義。AskUserQuestion使用時の品質ルールを追加。
- workflow-harness/mcp-server/src/phases/defs-stage0.ts: hearingフェーズテンプレート。選択肢品質の具体的ルールを強化。

## 変更方針

1. hearing-worker.mdに禁止パターンと品質基準を追加:
   - 禁止: 推奨案のみの確認形式(「Aで進めてよいですか」型)
   - 必須: 各質問に実質的に異なる2案以上
   - 必須: 各選択肢にメリット・デメリット明記
2. defs-stage0.tsのhearing指示を具体化:
   - 現行の抽象的指示を具体例付きルールに書き換え

## decisions

- SD-001: スコープを2ファイルに限定。hearing-worker.md(エージェント定義)とdefs-stage0.ts(テンプレート)の二重制約で確実性を担保。
- SD-002: hearing-worker.mdはハーネス外ファイルのためMCP再起動不要で即座反映。
- SD-003: defs-stage0.tsは前回FIX-1で追加した指示行を書き換える形で対応。新規行追加ではなく既存行の具体化。
- SD-004: DOC_ONLY_EXTENSIONS対象(.md)を含むためTDD Red免除が適用される可能性あり。
- SD-005: 200行制限に注意。hearing-worker.mdの現行行数を確認の上、追加量を決定する。

## artifacts

- docs/workflows/hearing-worker-real-choices/scope-definition.md: spec: 2ファイルスコープ定義。hearing-worker.md+defs-stage0.tsの二重制約による選択肢品質改善。

## next

- criticalDecisions: SD-001(2ファイル限定スコープ)、SD-003(既存指示の具体化)
- readFiles: .claude/agents/hearing-worker.md, workflow-harness/mcp-server/src/phases/defs-stage0.ts
- warnings: hearing-worker.mdの行数が200行に近い場合は追加内容を最小限にする必要あり
