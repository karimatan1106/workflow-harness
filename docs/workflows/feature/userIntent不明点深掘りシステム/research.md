## サマリー

- [R-001][finding] SKILL.md の `/harness start` ルーティング手順（`## 2. Command Routing` 節）は現在7ステップ構成で、ステップ2〜4がUI-1/UI-2/UI-7に対応する
- [R-002][finding] UI-1（20文字未満ブロック）はステップ2に記述され、MCP server 側でも `harness_start` の `userIntent >= 20 chars` バリデーションが実施される二重構造になっている
- [R-003][finding] UI-2（曖昧表現リトライ）はステップ3に「Detect ambiguous expressions and request rephrasing (UI-2: PF-4)」と記述されているが、具体的な曖昧表現リスト（とか/など/いい感じ等）は SKILL.md ではなく workflow-gates.md に定義されている
- [R-004][finding] UI-7（警告のみ通過）はステップ4に「Detect missing purpose/success criteria (UI-7: PF-5, warning only)」と記述され、ブロックせず通過する設計のまま `harness_start` が呼ばれる
- [R-005][finding] AskUserQuestion ツールの使用例は SKILL.md 本体には存在しない。唯一の言及は `workflow-gates.md` の IA-1 セクション（「Orchestrator asks user via AskUserQuestion, re-runs subagent」）のみで、/harness start フローには使われていない
- [R-006][finding] `.claude/skills/harness/SKILL.md` と `workflow-harness/skills/workflow.md` は88行で完全に同一内容のミラー関係にある。git diff で差分はない
- [R-007][finding] `workflow-orchestrator.md` の `Execution Flow` 節ステップ1には「Pre-start checks」とあるが、userIntent 深掘りの記述はなく `harness_start` が直接呼ばれる構成になっている
- [R-008][constraint] `harness_start` MCP ツールの `userIntent` パラメータは `minLength: 20` が型定義に設定されており、MCP server 側では20文字未満の場合にエラーを返す（スキル文書の UI-1 チェックと二重）
- [R-009][decision] SD-002により変更範囲は SKILL.md の `## 2. Command Routing` 節内 `/harness start` 手順のみに限定される。Commands テーブル（## 1）の説明文は影響確認が必要
- [R-010][next] requirementsフェーズで「3軸（目的・成功条件・影響範囲）の検出条件」と「最大3問の質問生成ロジック」を受け入れ条件として定義する必要がある

## 調査結果

ファイルパス: `C:/ツール/Workflow/.claude/skills/harness/SKILL.md`（88行）。
ミラー: `C:/ツール/Workflow/workflow-harness/skills/workflow.md`（同一内容、88行）。

現行の `## 2. Command Routing` 節の `/harness start` ルーティング手順は以下7ステップ構成である（ファイル行51〜57）。
ステップ1は「Pre-start checks: active tasks <= 5, git status clean, branch fresh vs origin」である。
ステップ2は「Validate userIntent >= 20 characters (UI-1: block if too short)」である。
ステップ3は「Detect ambiguous expressions and request rephrasing (UI-2: PF-4)」である。
ステップ4は「Detect missing purpose/success criteria (UI-7: PF-5, warning only)」である。
ステップ5は「Call `harness_start(taskName, userIntent)`」である。
ステップ6は「Call `harness_set_scope` if files/dirs are known」である。
ステップ7は「Report: taskId, phase, size, docsDir, sessionToken」である。
ステップ2〜4が今回の変更対象であり、ステップ1・5・6・7は変更しない。

UI-1 の実装箇所は SKILL.md `## 2. Command Routing` ステップ2（行52）と workflow-gates.md Section 3 UI-1（line 94-96）の2箇所である。
動作はブロック（20文字未満で停止）である。
UI-1 は MCP server（`harness_start` の `userIntent >= 20 chars` バリデーション）と二重チェックになっている。
UI-2 の実装箇所は SKILL.md ステップ3（行53）と workflow-gates.md Section 3 UI-2（line 98-100）である。
動作はリトライ要求（再入力促す）である。
UI-2 の曖昧表現リスト（とか/など/いい感じ/適当に/よしなに）は workflow-gates.md にのみ存在し、SKILL.md には列挙されていない。
UI-7 の実装箇所は SKILL.md ステップ4（行54）と workflow-gates.md Section 3 UI-7（line 118-120）である。
動作は警告のみ通過（ブロックしない）である。
UI-7 は現行設計で「警告のみ通過」のため、目的・成功条件が不明なままタスクが開始される問題がある。

AskUserQuestion については SKILL.md 全88行中、ツール名への直接言及は存在しない。
workflow-gates.md の IA-1 節（line 56）に1箇所のみ言及がある: 「If non-empty: Orchestrator asks user via AskUserQuestion, re-runs subagent」。
これは requirements フェーズの OPEN_QUESTIONS ループで使用されるパターンである。
`/harness start` の前処理フローでの使用例は現在のスキルファイル群に存在しない。
AskUserQuestion は Claude Code の組み込みツールであり、追加実装は不要である。
スキル文書の手順記述だけで Orchestrator が使用できる（SD-007 の制約通り）。

変更後に影響を受けるセクションとして、`## 1. Commands` テーブル（行36）の `/harness start <name>` の説明がある。
現在の説明は `Start task (userIntent >= 20 chars, UI-1)` となっている。
新フロー導入後は説明文の更新が必要になる可能性がある（SD-009 のリスク）。
`## 3. Workflow Usage Decision` テーブルは変更不要である。
ディレクティブ/クエスチョン分岐ロジックは影響を受けない。
`workflow-gates.md` の UI-1〜UI-7 は変更不要（スコープ外）である。
`workflow-orchestrator.md` の `Execution Flow` は変更不要であり、ステップ1「Pre-start checks」の前処理として新フローを解釈できる。

2ファイルミラー構造の詳細として説明する。
変更対象の2ファイルは完全に同一内容を維持しなければならない。
`.claude/skills/harness/SKILL.md` が主ファイルであり、`workflow-harness/skills/workflow.md` がミラーである。
scope-definition.md の line 36-38 で「同一内容を維持すべき対象ファイルの数は2」と定義されている。
一方のみ変更するとミラー整合性が崩れるため、両ファイルを同時に更新する必要がある。

## 既存実装の分析

現行の `/harness start` フロー（ステップ2〜4）の問題点を説明する。
UI-1 で20文字未満をブロックするが、20文字以上あれば内容の質を問わずUI-2・UI-7のチェックを通過する。
UI-2 の曖昧表現検出はリトライ（再入力促し）であり、ユーザーが再入力するまで待機するだけである。
不明な軸を具体的に質問する仕組みがない。
UI-7 の目的・成功条件の欠如は「警告のみ」で通過するため、後続フェーズの requirements で OPEN_QUESTIONS が多発し手戻りが発生する。
この設計では、目的や成功条件が不明なままタスクが開始される。
requirements フェーズの IA-1（OPEN_QUESTIONS ループ）で解消されるまで無駄な往復が生じる。
requirements フェーズに到達する前に不明点を解消することが本タスクの目的である（SD-006 準拠）。

新フローの設計を説明する。
目的/成功条件/影響範囲の3軸分析→AskUserQuestion→統合→harness_start というフローを構成する。
目的軸は「何を達成したいか」が明確に述べられているかを検出する。
成功条件軸は「何をもって完了とするか」が述べられているかを検出する。
影響範囲軸は「どのファイル/機能に影響するか」が述べられているかを検出する。
3軸のうち1軸以上が不明な場合に AskUserQuestion を発動する。
最大3問を一度に質問してユーザー回答を取得する。
回答を元の userIntent に統合した上で `harness_start(taskName, 補完後の userIntent)` を呼ぶ。
不明点がない場合はステップ3から直接 `harness_start` に進み、現行と同様の速度でタスクを開始できる。

ファイル規模について説明する。
両ファイルとも88行で200行制限（CORE PRINCIPLE）の半分以下（44%）である。
CAN-1 ガイドライン（400行以下は Write を推奨）に従い、変更時はファイル全体の Write（完全書き換え）が適切である。
Edit（str_replace）ではなく Write を用いることで expression failure を回避できる。
workflow-harness/CLAUDE.md Section 5 の CAN-1 を参照すること。

暗黙の制約・Magic Number 一覧を示す。
UI-1 最小文字数は20文字である。
SKILL.md line 36 と workflow-gates.md line 95 に存在し、MCP server 側でも同値チェックがある。
AskUserQuestion 最大質問数は3問である。
scope-definition.md line 25（SD-006）に定義されており、新フローで一度に尋ねる不明点の上限となる。
3軸分析の軸数は3（目的・成功条件・影響範囲）である。
scope-definition.md line 25（SD-004）に定義されている。
SKILL.md の現行行数は88行で両ミラーファイルとも同一である。
アクティブタスク上限は5である。
SKILL.md line 51 の Pre-start checks の制約であり変更対象外である。
ミラーファイル数は2である。
scope-definition.md line 36-38 に定義されている。

既存実装が UI-7 を警告のみにした設計意図を述べる。
要件フェーズで OPEN_QUESTIONS ループを通じて不明点を解消するというアーキテクチャ判断に基づいている。
しかし実際には requirements フェーズに到達するまでに Orchestrator がタスクを進めてしまうケースがある。
requirements サブエージェントの OPEN_QUESTIONS が空のまま通過することもある。
新フローはこのギャップを `/harness start` のエントリポイントで塞ぐ設計である。

## 依存バージョン固有挙動

このタスクの変更対象は SKILL.md（Markdownドキュメント）のみである。
TypeScript ソースコードの変更は一切発生しない。
変更後のビルドやコンパイルは不要である。
ランタイムバージョンに依存する挙動は存在しない。

AskUserQuestion は Claude Code の組み込みUIツールである。
外部依存がない。
npm パッケージの追加・更新も不要である。
スキル文書に手順を記述するだけで Orchestrator が使用できる仕組みになっている。
CLI のバージョンに関わらず動作する。

`harness_start` MCP ツールの `userIntent` パラメータの `minLength: 20` バリデーションはこの変更により影響を受けない。
新フローでは AskUserQuestion による補完後の userIntent を渡すため、結果的に20文字以上を確保しやすくなる。
バリデーション値自体は変更しない。

`workflow-gates.md` の UI-1〜UI-7 のポリシー定義はスコープ外である。
変更しない。
SKILL.md の手順がポリシーに従う形で記述されるため、ポリシーファイル側の更新は不要である。

Node.js バージョン、npm バージョン、その他の実行環境依存の変数は本変更に影響しない。
影響範囲はドキュメントファイル2件（SKILL.md と workflow.md のミラーペア）のみに限定される。
