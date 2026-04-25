## サマリー

- [SD-001][finding] 変更対象ファイルは`.claude/skills/harness/SKILL.md`と`workflow-harness/skills/workflow.md`の2ファイルで、両者は同一内容のミラー関係にある
- [SD-002][decision] 変更箇所はSKILL.md内の`## 2. Command Routing`節の`/harness start`ルーティング手順（現行ステップ2〜4）に限定する
- [SD-003][decision] MCP server TypeScript実装（`workflow-harness/mcp-server/src/`配下）は変更しない。スキル定義文書のみ変更する
- [SD-004][decision] 深掘り質問の対象は「目的」「成功条件」「影響範囲」の3軸で、userIntentが不明確な場合にAskUserQuestionツールを使い対話的に補完する
- [SD-005][finding] 現行フローは「20文字未満ブロック」と「曖昧表現リトライ要求」の2ステップで不明瞭なまま`harness_start`を呼ぶ設計になっている
- [SD-006][decision] 新フロー: userIntent分析→不明点検出→AskUserQuestion質問（最大3問）→ユーザー回答統合→`harness_start`呼び出しの順にする
- [SD-007][constraint] AskUserQuestionツールはClaude Code組み込み機能であり、実装変更は不要。スキル文書の手順記述のみで動作する
- [SD-008][risk] 2ファイルのミラー同期漏れリスクあり。両ファイルを同一セッションで同時更新することで対処する
- [SD-009][dependency] SKILL.mdの`## 1. Commands`テーブルにある`/harness start`の説明文も更新が必要になる可能性がある
- [SD-010][next] requirementsフェーズでは「AskUserQuestion発動条件の3軸定義」と「UI-1/UI-2/UI-7との整合性確認」を最優先で実施する

## スコープ定義

このタスクは`/harness start <name>`コマンド実行時のOrchestratorプロトコルを変更する。
具体的には、SKILL.mdの`## 2. Command Routing`節内の`/harness start`ルーティング手順を書き換え、
userIntentが不明確な場合にAskUserQuestionツールを用いた対話的深掘りを行うステップを追加する。

現行の実装では、ステップ2でuserIntentが20文字未満の場合にブロック（UI-1）し、
ステップ3で曖昧表現を検出してリトライ要求（UI-2: PF-4）し、
ステップ4で目的・成功条件の欠如を警告のみで通過（UI-7: PF-5）するという設計になっている。
この設計では、目的や成功条件が不明なままタスクが開始されるため、後続フェーズでの手戻りが発生しやすい。

新設計では、20文字以上のuserIntentを受け取った後に3軸（目的・成功条件・影響範囲）を分析し、
不明点が1軸でもある場合はAskUserQuestionで質問を行い、回答を統合してからharness_startを呼ぶ。
不明点がない場合は現行と同様に直接harness_startを呼び出す。

変更はスキル文書の手順記述に完結し、Orchestratorがスキル文書に従い動作する仕組みを利用する。
MCP serverのharness_start実装が受け取るuserIntentは、対話完了後に補完された値となるため、
MCP server側のバリデーション実装（20文字チェック等）は影響を受けない。

## 影響範囲

変更対象ファイルは以下の2ファイルで、どちらも88行程度の短いファイルである。

- `C:\ツール\Workflow\.claude\skills\harness\SKILL.md`（親リポジトリ側のスキル登録ファイル）
- `C:\ツール\Workflow\workflow-harness\skills\workflow.md`（workflow-harnessリポジトリ側のソースファイル）

変更箇所は各ファイルの`## 2. Command Routing`節内、`/harness start`の手順リスト（現行7ステップ）に限定される。
具体的には現行ステップ2〜4（UI-1チェック、UI-2曖昧検出、UI-7警告）を置き換え、
AskUserQuestionによる対話フローに変更する。

依存関係分析の結果、`workflow-orchestrator.md`の`Execution Flow`節（ステップ2: harness_start前の前処理）も
参照整合性の観点から内容確認が必要だが、変更は不要と判断する。

リスクスコア算出: 変更ファイル数=2、テスト対象なし（スキル文書）、セキュリティ影響なし、
DB影響なし、設定ファイル影響なし → リスクスコア推定2（small相当）。
ただし2ファイルのミラー同期漏れが発生すると動作不整合を引き起こすため、実施時は2ファイルを同時に更新する。

## スコープ外

以下の項目はこのタスクのスコープ外とする。

MCP serverのTypeScript実装（`workflow-harness/mcp-server/src/tools/handlers/lifecycle.ts`等）は変更しない。
harness_startのuserIntentバリデーション（20文字チェック）はMCP server側で継続して行われるため変更不要。

CLAUDE.mdおよびworkflow-harness/CLAUDE.mdは変更しない。
これらはOrchestratorが参照する権威仕様ファイルだが、スキル文書の変更で十分に意図を実現できる。

`/harness next`、`/harness approve`、`/harness complete-sub`等の他コマンドルーティングは変更しない。
AskUserQuestionツール自体の実装変更は行わない（Claude Code組み込み機能をそのまま利用する）。

`workflow-harness/skills/workflow-gates.md`に記載のUI-1〜UI-7ポリシーの条文は変更しない。
スキル文書の手順がUI-7の精神（成功条件の明確化）に従う形で記述するに留める。

`workflow-orchestrator.md`の内容変更は行わない。参照整合性は保たれていると判断する。
