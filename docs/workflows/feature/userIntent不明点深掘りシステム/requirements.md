## サマリー

- [REQ-001][decision] このタスクの目的は、harness_startコマンド実行時にユーザーのuserIntentが不明確な場合（目的・成功条件・影響範囲が不明）にブロックせず、AskUserQuestionツールで不明点を深掘り質問してからタスクを開始する仕組みをSKILL.mdに実装することである
- [REQ-002][decision] 変更対象はSKILL.mdとworkflow.mdの2ファイルのみで、MCP serverのTypeScriptコードは一切変更しない
- [REQ-003][finding] 現行のUI-7（警告のみ通過）設計では目的・成功条件が不明なままタスクが開始され、後続のrequirementsフェーズで手戻りが多発する問題がある
- [REQ-004][decision] AskUserQuestionの同時質問数は最大3問（不明な軸の数に対応）とし、Claude Code組み込みの制約として4問以上は使用しない
- [REQ-005][finding] R-002/R-008が示す通り、UI-1（20文字未満ブロック）はSKILL.mdとMCP serverの両方に実装された二重構造であり、本タスク後もこの二重構造を維持する
- [REQ-006][decision] 3軸のうち1軸以上が不明と判断された場合にのみAskUserQuestionを発動し、全軸が明確な場合はAskUserQuestionをスキップして即時harness_startを呼ぶ
- [REQ-007][decision] SD-002が定義する通り、SKILL.mdの変更範囲は`## 2. Command Routing`節の`/harness start`ルーティング手順（現行ステップ2〜4）のみに限定する

## 機能要件

FR-1からFR-5の5つの機能要件を定義する。
各要件はresearchフェーズのfinding（R-001〜R-010）とscope-definitionのdecision（SD-001〜SD-010）に根拠を持つ。

FR-1: /harness start 実行時のuserIntent3軸分析（目的・成功条件・影響範囲）の検出。
Orchestratorは受け取ったuserIntentのテキストを3軸の観点で評価する。
目的軸は「何を達成したいか」が一文以上で明示されているかを確認する（例: 動詞+目的語の構文があるか）。
成功条件軸は「何をもってタスク完了とみなすか」の記述があるかを確認する（例: ファイルが更新される、テストが通過する等の表現）。
影響範囲軸は「どのファイル、ディレクトリ、または機能が変更対象か」が述べられているかを確認する。
3軸それぞれに対して「明確/不明」の二値で評価し、不明の軸リストを生成する。
この分析はUI-1の20文字チェック通過後に行われ、MCP serverへの呼び出しの前に完了する。

FR-2: 不明軸がある場合のAskUserQuestionによる対話的質問（最大3問同時）。
3軸のうち1軸以上が不明と判断された場合、Orchestratorは不明な軸それぞれに対する質問を生成する。
目的不明の場合は「このタスクで何を実現したいですか？」相当の質問をoptions付きで生成する。
成功条件不明の場合は「タスクが完了したと判断する条件（成功の定義）を教えてください」相当の質問を生成する。
影響範囲不明の場合は「変更対象のファイルや機能を教えてください」相当の質問を生成する。
AskUserQuestionの一度の呼び出しでは最大1問を質問し、不明軸が複数ある場合はまとめて1回の対話セッションで解決する設計とする。
Claude Codeの制約として1回のAskUserQuestion呼び出しに含めるoptionsは2〜4件に収める（NFR-1参照）。
UI-2のリトライ要求（再入力促し）はこのAskUserQuestionフローに統合し、独立したステップとしては残さない。

FR-3: ユーザー回答を元のuserIntentと統合してharness_startを呼ぶ。
AskUserQuestionに対してユーザーが回答した後、Orchestratorはその回答内容を元のuserIntentテキストに自然言語で結合する。
統合後のuserIntentは「元の意図 + 補完された目的/成功条件/影響範囲」の形式で構成される。
統合結果がMCP serverのminLength:20バリデーション（20文字以上）を満たすことを確認した上でharness_startを呼ぶ。
統合後のuserIntentはrequirementsフェーズでのuserIntent精度向上に直接貢献する。
この手順はworkflow-gates.mdのUI-7「purpose/success criteriaの明確化」ポリシーを実運用レベルで実現する。

FR-4: 全軸が明確な場合はAskUserQuestionをスキップして直接harness_startを呼ぶ。
3軸の分析で全軸が「明確」と判定された場合は、AskUserQuestionを一切呼ばない。
この場合のフローは現行の `/harness start` フロー（ステップ5以降）と完全に同一になる。
ユーザー体験として、詳細なuserIntentを提供したユーザーに対しては遅延が発生しない。
スキップ条件は「全3軸が明確」の一条件のみであり、個別の閾値設定は行わない。
この設計はSD-006（不明点ない場合は直接harness_startへ進む）と整合する。

FR-5: 2ファイル（SKILL.mdとworkflow.md）の同時更新。
変更は`.claude/skills/harness/SKILL.md`と`workflow-harness/skills/workflow.md`の2ファイルに同一内容を同時に適用する。
SD-008が示すミラー同期漏れリスクを回避するため、両ファイルを同一実装ステップで更新する。
CAN-1ガイドライン（research.md line 83）に従い、88行の短いファイルであるため、Edit（str_replace）ではなくWriteツール（完全書き換え）を使用する。
更新後の両ファイルはdiff比較で完全一致していることを確認する。
`## 1. Commands`テーブルの`/harness start`説明文（現在: `Start task (userIntent >= 20 chars, UI-1)`）も新フローを反映した説明に更新する（SD-009対応）。

## 非機能要件

NFR-1からNFR-5の5つの非機能要件を定義する。
これらはClaude Codeの制約、既存ポリシーとの整合性、MCP serverとの互換性に関する要件である。

NFR-1: AskUserQuestionのoptions数は2〜4件（Claude Code制約）。
Claude Codeの組み込みAskUserQuestionツールはoptions配列に2〜4件を指定する制約がある。
1件や5件以上のoptionsを指定した場合の動作は保証されない。
各軸の質問のoptionsは「具体的に記述します」「スキップします（後で補完）」等の実用的な選択肢を含める。
options数の上限を守ることで、ユーザーにとって選択しやすい質問を維持する。
この制約はSKILL.mdの手順記述に「options: 2-4件」という注記として明示する。

NFR-2: 変更箇所はSKILL.mdの`## 2. Command Routing`の`/harness start`ルーティングのステップ2〜4のみ。
ステップ1（Pre-start checks）、ステップ5（harness_start呼び出し）、ステップ6（harness_set_scope）、ステップ7（Report）は変更しない。
`## 1. Commands`テーブルの`/harness start`説明文はSD-009対応として更新対象に含めるが、他の行は変更しない。
`## 3. Workflow Usage Decision`テーブルは変更しない。
他コマンド（`/harness next`等）のルーティング手順は変更しない。
この制約により変更の影響範囲が最小化され、ミラー同期作業の複雑度が低下する。

NFR-3: MCP serverのTypeScript変更なし。
`workflow-harness/mcp-server/src/`配下のすべてのTypeScriptファイルは変更しない。
`harness_start`の`userIntent`パラメータの`minLength: 20`バリデーションは変更しない。
`harness_start`のスキーマ定義、ハンドラ実装、テストファイルを含むすべてのコードファイルは変更対象外である。
このタスクの変更はスキル文書のMarkdownファイル2件のみに完結する。
TypeScript変更が不要であることはSD-003で決定済みであり、ビルド・テスト実行も不要である。

NFR-4: workflow-gates.mdのUI-1〜UI-7ポリシー定義を変更しない。
`C:/ツール/Workflow/.claude/skills/harness/workflow-gates.md`のUI-1〜UI-7の条文は変更しない。
SKILL.mdの新フローがUI-7の精神（成功条件の明確化）を実現する形で実装するが、ポリシーファイル自体は変更しない。
UI-1（20文字未満ブロック）のポリシー記述はUI-1として現行の位置に残す（SKILL.mdのステップ2相当の記述を維持する）。
UI-2の曖昧表現リスト（とか/など/いい感じ等）は引き続きworkflow-gates.mdのみに定義する。
workflow-orchestrator.md、workflow-rules.md等の他のスキルファイルも変更しない。

NFR-5: 変更後も20文字未満のuserIntentはMCP server側でブロックされること（UI-1は維持）。
SKILL.mdのステップ2「Validate userIntent >= 20 characters (UI-1: block if too short)」は新フロー後も残す。
MCP server側の`minLength: 20`バリデーションと合わせた二重チェック構造は維持する。
AskUserQuestionによる補完後のuserIntentが20文字を下回る可能性は実質的にないが、バリデーション手順は保険として維持する。
UI-1のブロック動作はAskUserQuestion呼び出しの前に実行されるため、20文字未満の場合はAskUserQuestionは呼ばれない。
この仕様によりUI-1ポリシーとの整合性が保たれる。

## 受入基準

AC-1: `/harness start <name>` を実行し、userIntentとして「機能を追加する」（目的不明・成功条件不明・影響範囲不明）を入力した場合に、AskUserQuestionが発動し目的・成功条件・影響範囲のうち少なくとも1つを質問すること。
AC-2: AskUserQuestionへの回答後にharness_startが呼ばれ、タスクがscope_definitionフェーズで正常に開始されること。
AC-3: userIntentとして「SKILL.mdのCommand Routingステップ2〜4を書き換えてAskUserQuestionによる3軸深掘りを追加する、完了条件はSKILL.mdとworkflow.mdの両ファイルが同一内容で更新されること、影響ファイルは.claude/skills/harness/SKILL.mdとworkflow-harness/skills/workflow.md」を入力した場合にAskUserQuestionがスキップされharness_startが直接呼ばれること。
AC-4: 変更後のSKILL.mdとworkflow-harness/skills/workflow.mdの内容がdiff比較で完全一致していること。
AC-5: 変更後のSKILL.mdで20文字未満のuserIntentを渡した場合にUI-1ブロックが発動し、AskUserQuestionが呼ばれないこと。

## NOT_IN_SCOPE

このタスクのスコープ外となる項目を説明する。
以下の項目は本要件定義に含まれず、実装フェーズでも変更を行わない。

MCP serverのTypeScriptコードは変更しない。
`workflow-harness/mcp-server/src/tools/handlers/lifecycle.ts`をはじめとするすべてのTypeScriptファイルが対象外である。
`harness_start`のバリデーションロジック、スキーマ定義、ユニットテスト、統合テストはすべて変更しない。

AskUserQuestionツール自体の実装変更は行わない。
Claude Code組み込みツールであるため、API変更やパラメータ拡張は本タスクの範囲外である。

`workflow-gates.md`、`workflow-orchestrator.md`、`workflow-rules.md`、`workflow-subagent.md`等の他のスキルファイルは変更しない。
UI-1〜UI-7のポリシー条文は維持され、SKILL.mdの手順がポリシーに従う形で記述される。

`CLAUDE.md`および`workflow-harness/CLAUDE.md`の権威仕様ファイルは変更しない。
`/harness next`、`/harness approve`、`/harness complete-sub`等の他コマンドのルーティング手順は変更しない。
`## 3. Workflow Usage Decision`テーブルは変更しない。

多言語対応（英語以外でのAskUserQuestion質問文生成）はスコープ外である。
質問の自動生成ロジックのカスタマイズ（軸の追加・変更）はスコープ外である。
ユーザー回答のバリデーション（回答内容の品質チェック）はスコープ外である。

## OPEN_QUESTIONS

なし
