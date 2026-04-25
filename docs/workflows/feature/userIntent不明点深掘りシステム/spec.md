## サマリー

- [PL-001][decision] 3軸分析（目的・成功条件・影響範囲）による不明点検出をSKILL.mdのステップ3に導入する。
- [PL-002][decision] 不明軸が1軸以上存在する場合にAskUserQuestionを発動し最大3問を質問する設計とする。
- [PL-003][decision] 全軸が明確な場合はAskUserQuestionをスキップしてharness_startを直接呼ぶ高速パスを維持する。
- [PL-004][decision] 変更対象は`.claude/skills/harness/SKILL.md`と`workflow-harness/skills/workflow.md`の2ファイルのみとする。
- [PL-005][decision] 両ファイルは同一セッション内でWriteツールを使って全文書き換えし、diff完全一致を確認する。

## 概要

現行の`/harness start`コマンドルーティングはステップ3でUI-2曖昧表現検出、ステップ4でUI-7警告のみ通過という設計になっている。
UI-7の警告のみ通過設計では目的・成功条件・影響範囲が不明なままharness_startが呼ばれ、後続フェーズで手戻りが多発する問題がある（REQ-003）。
本システムはこの問題をAskUserQuestionによる対話的補完で解決する。
変更箇所はSKILL.mdの`## 2. Command Routing`節内の`/harness start`手順ステップ2〜4のみに限定する（SD-002）。
MCP serverのTypeScript実装は変更しない（SD-003）。
20文字未満のuserIntentはMCP server側でバリデーションされるため、UI-1の二重構造はそのまま維持される（NFR-5）。

## アーキテクチャ設計

**3軸分析ロジック**の定義は以下のとおりである。
目的軸（Purpose Axis）: 「なぜこの変更を行うのか」が明示されているかを評価する。
評価基準は「〜のため」「〜を解決する」「〜を実現する」等の目的節の有無とする。
成功条件軸（Success Criteria Axis）: 「完了したと判断できる状態」が明示されているかを評価する。
評価基準は「〜できるようになる」「〜が動作する」「〜テストが通る」等の検証可能な状態記述の有無とする。
影響範囲軸（Impact Scope Axis）: 「どのファイル・モジュール・機能に影響するか」が示されているかを評価する。
評価基準は具体的なファイル名・ディレクトリ名・機能名の有無とする。

**AskUserQuestion発動条件**は以下のとおりである。
3軸のうち1軸以上が不明と判定された場合にAskUserQuestionを発動する。
質問数は不明軸の数に一致させ、最大3問（MN-002）とする。
各質問にはoptionsとして2〜4件の選択肢を提示する（NFR-1）。
全3軸が明確と判定された場合はAskUserQuestionをスキップする（FR-4）。

**回答統合方式**は以下のとおりである。
AskUserQuestionの回答を元のuserIntentに文字列として追記する。
統合後のuserIntentが20文字以上であることを確認する（R-008）。
統合済みuserIntentを引数としてharness_start(taskName, 統合済みuserIntent)を呼ぶ（SD-006）。

## RTMエントリ定義

F-001は「/harness start実行時にuserIntentを目的・成功条件・影響範囲の3軸で分析し、各軸の明確/不明を判定する」機能である。
設計参照はspec.mdの「アーキテクチャ設計 > 3軸分析ロジック」節であり、ソース参照はSKILL.mdのステップ3である。
F-002は「不明軸が1軸以上ある場合にAskUserQuestionで最大3問を質問する」機能である。
設計参照はspec.mdの「アーキテクチャ設計 > AskUserQuestion発動条件」節であり、ソース参照はSKILL.mdのステップ4である。
F-003は「AskUserQuestion回答をuserIntentに統合してharness_startを呼ぶ」機能である。
設計参照はspec.mdの「アーキテクチャ設計 > 回答統合方式」節であり、ソース参照はSKILL.mdのステップ5〜6である。
F-004は「全軸明確時にAskUserQuestionをスキップしてharness_startを直接呼ぶ高速パス」機能である。
設計参照はspec.mdの「アーキテクチャ設計 > AskUserQuestion発動条件」節であり、ソース参照はSKILL.mdのステップ3の条件分岐である。
F-005は「2ファイルミラー同期（SKILL.mdとworkflow.md）をWriteツールで同一内容書き換えし、diff完全一致を確認する」機能である。
設計参照はspec.mdの「変更対象ファイル」節であり、ソース参照は実装手順のステップ2〜3である。

## 実装計画

実装は以下の順序で実行する。

**ステップ1: 変更内容の確定**
現行SKILL.mdのステップ2〜4（UI-1/UI-2/UI-7）を新フロー記述に置き換える。
新ステップ2はUI-1バリデーション（20文字未満ブロック）を維持する。
新ステップ3は3軸分析の実施と不明軸の特定を行う。
新ステップ4は不明軸がある場合のAskUserQuestion発動（最大3問）を行う。
新ステップ5はAskUserQuestion回答をuserIntentに統合する。
新ステップ6はharness_start(taskName, 補完後userIntent)を呼ぶ。
全軸明確な場合はステップ4〜5をスキップして直接ステップ6へ進む。

**ステップ2: SKILL.md書き換え**
`.claude/skills/harness/SKILL.md`をReadツールで読み込み、全文の内容を確認する。
ステップ2〜4の部分を新フローに置き換えた全文をWriteツールで書き込む。
現行7ステップの構造がステップ追加により8ステップになることを確認する。
Commands テーブル（## 1）の`/harness start`説明文も「Start task (userIntent >= 20 chars, UI-1; 3-axis analysis)」に更新する。

**ステップ3: workflow.md書き換え（ミラー同期）**
`workflow-harness/skills/workflow.md`を同一内容でWriteツールを使って書き換える。
ミラー同期漏れリスク（SD-008）を防ぐため、同一セッション内で連続して実行する。

**ステップ4: diff確認（AC-4）**
両ファイルをReadツールで読み込み、内容が完全に一致することを確認する。
差分がある場合は不一致箇所を特定し、後発ファイルを修正する。

**ステップ5: 動作確認手順の整理**
AC-1の確認: 「機能を追加する」等の短い曖昧入力でAskUserQuestionが発動することを確認する。
AC-2の確認: 回答後にharness_startが呼ばれることを確認する。
AC-3の確認: 十分に詳細なuserIntent入力でAskUserQuestionがスキップされることを確認する。
AC-5の確認: 20文字未満の入力でUI-1ブロックが発動しAskUserQuestionが呼ばれないことを確認する。

**依存関係**はステップ2が完了してからステップ3を実施する順序制約がある。
ステップ4はステップ2とステップ3の両方が完了してから実施する。
ステップ5の動作確認はステップ4の完了後に実施する。

## 新フロー詳細仕様

新しい`/harness start <name>`のルーティングは以下の8ステップである。

ステップ1: Pre-start checks（既存、変更なし）。アクティブタスク数5以下、gitステータスクリーン、ブランチがオリジンに対してフレッシュかを確認する。
ステップ2: UI-1バリデーション（既存、変更なし）。userIntentが20文字以上であることを確認し、短い場合はブロックしてユーザーに再入力を求める。
ステップ3: 3軸分析。目的軸・成功条件軸・影響範囲軸の各軸について「明確」または「不明」を判定する。全軸が明確な場合はステップ6へジャンプする。
ステップ4: AskUserQuestion発動（条件付き）。不明軸ごとに1問ずつ、最大3問をAskUserQuestionで質問する。各問にoptions（2〜4件）を付与する。
ステップ5: 回答統合。AskUserQuestionの回答を元のuserIntentに追記し、統合済みuserIntentを生成する。
ステップ6: `harness_start(taskName, userIntent)`を呼ぶ（ステップ3で全軸明確な場合は直接ここへ）。
ステップ7: ファイル・ディレクトリが判明している場合は`harness_set_scope`を呼ぶ（既存、変更なし）。
ステップ8: taskId・phase・size・docsDir・sessionTokenを報告する（既存、変更なし）。

## 変更対象ファイル

変更対象ファイルは以下の2ファイルである。

**ファイル1**: `.claude/skills/harness/SKILL.md`
変更箇所は`## 2. Command Routing`節の`/harness start <name>`手順のステップ2〜4と、`## 1. Commands`テーブルの`/harness start`行の説明文である。
変更後の行数は現行88行から93行前後に増加する見込みである（200行制限に対して46%以下）。
実装方法はWriteツールによる全文書き換えとする（CAN-1: 400行以下はWriteを優先）。

**ファイル2**: `workflow-harness/skills/workflow.md`
変更箇所はファイル1と完全に同一の箇所である（ミラーファイル）。
変更後の内容はファイル1と完全に一致させる（AC-4）。
実装方法はWriteツールによる全文書き換えとする。

スコープ外のファイル（変更禁止）は以下のとおりである。
`workflow-harness/mcp-server/src`配下のTypeScriptコード全体は変更しない。
`workflow-harness/skills/workflow-gates.md`のUI-1〜UI-7ポリシー条文は変更しない。
`CLAUDE.md`および`workflow-harness/CLAUDE.md`は変更しない。
`/harness next`・`approve`・`complete-sub`等の他コマンドルーティングは変更しない。
`## 3. Workflow Usage Decision`テーブルは変更しない。
