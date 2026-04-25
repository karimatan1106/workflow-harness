# Hearing: hearing-worker-real-choices

taskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e
phase: hearing
size: large

## intent-analysis

surfaceRequest: hearing-workerが実質1択の確認形式を出す問題を修正する
deepNeed: ユーザーが各設計判断で実質的な選択権を持ち、推奨案に対する代替案とトレードオフを把握した上で判断できるようにする
unclearPoints: なし
assumptions: hearing-worker.mdとdefs-stage0.tsの両方を修正対象とする
userResponse: Q1=A(エージェント定義+テンプレート両方を修正し二重の安全網とする), Q2=A(各選択肢にメリット・デメリットを明記しトレードオフ明示を必須とする)

## decisions

- HR-001: hearing-worker.mdエージェント定義にAskUserQuestion品質ルールを追加する。推奨案のみの確認形式を明示的に禁止し、各質問に実質的に異なる2案以上を要求する。根拠: テンプレート指示だけではLLMが形骸的な選択肢を生成する傾向があり、エージェント定義レベルでの制約が必要。
- HR-002: defs-stage0.tsのhearingテンプレート指示を強化する。現在の「選択肢は2個以上提示すること」を、トレードオフ明示必須の具体的ルールに書き換える。根拠: 前回FIX-1の指示が抽象的すぎて効果がなかった。
- HR-003: 選択肢品質基準として「各選択肢にメリット・デメリットを明記」を採用する。根拠: ユーザーが判断材料を得られる形式を保証するため。
- HR-004: 禁止パターンとして「推奨案+それで進めてよいですか」形式を明示する。根拠: LLMがこの形式に陥りやすく、明示的禁止が必要。
- HR-005: スコープファイルは.claude/agents/hearing-worker.mdとworkflow-harness/mcp-server/src/phases/defs-stage0.tsの2ファイル。根拠: ユーザー確認済み。

## artifacts

- docs/workflows/hearing-worker-real-choices/hearing.md: spec: hearing-workerの選択肢品質改善。エージェント定義+テンプレート両方修正、トレードオフ明示必須。

## next

- criticalDecisions: HR-001(エージェント定義での制約追加が核心), HR-002(テンプレート指示の具体化)
- readFiles: .claude/agents/hearing-worker.md, workflow-harness/mcp-server/src/phases/defs-stage0.ts
- warnings: hearing-worker.mdの変更はハーネス外のエージェント定義ファイルであり、MCP再起動不要で即座に反映される
