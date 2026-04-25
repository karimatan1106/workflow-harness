## サマリー

- [TD-001][test-design] AC-1の検証対象は「目的・成功条件・影響範囲が不明な短い入力」に対するAskUserQuestion発動である。
- [TD-002][test-design] AC-2の検証対象は「AskUserQuestion回答後にharness_startがscope_definitionで正常開始すること」である。
- [TD-003][test-design] AC-3の検証対象は「3軸すべて明確なuserIntentでAskUserQuestionがスキップされること」である。
- [TD-004][test-design] AC-4の検証対象は「変更後のSKILL.mdとworkflow-harness/skills/workflow.mdのdiff完全一致」である。
- [TD-005][test-design] AC-5の検証対象は「20文字未満の入力でUI-1がブロックしAskUserQuestionが呼ばれないこと」である。
- [TD-006][boundary] 不明軸が1軸の場合・2軸の場合・3軸すべての場合でAskUserQuestion質問数が変化することを確認する境界値テストを含む。
- [TD-007][edge] 19文字（UI-1境界値）と20文字（通過最小値）の2入力でUI-1の動作差を確認するエッジケーステストを含む。

## テスト方針

本タスクの変更対象は`.claude/skills/harness/SKILL.md`と`workflow-harness/skills/workflow.md`の2ファイルのみである。
変更内容はMarkdownのコマンドルーティング手順記述であり、MCP serverのTypeScriptコードは変更しない。
このため自動化ユニットテストは適用できず、Claude Codeセッション内での手動確認テストを主体とする。
テスト実施者はSKILL.mdを実際に読み込んだセッションで`/harness start <name>`を試行し、Agentの応答を観察する。
AC-4（diff完全一致）のみ`diff`コマンドまたはReadツールによる機械的な文字列比較で検証できる。
テストは「実装完了後のSKILL.md変更が適用されたセッション」で実施する。
各テストケースは「前提条件・入力・期待結果・判定方法」の4要素で定義する。
境界値テストはUI-1（20文字）とAskUserQuestion質問数（1〜3問）の2点に設定する。
エッジケーステストは「目的のみ明確」「成功条件のみ明確」「影響範囲のみ明確」の1軸明確3パターンを含む。
回帰確認として、変更後も既存の`/harness next`・`/harness approve`等のルーティングが影響を受けないことを確認する。

## テストケース

**TC-AC1-01: 目的・成功条件・影響範囲すべて不明な入力でのAskUserQuestion発動確認**
前提条件: 変更後のSKILL.mdが読み込まれたセッションである。
入力: `/harness start 機能追加タスク` userIntent=「機能を追加する」（9文字）
期待結果: userIntentが20文字未満のためUI-1ブロックが発動し、AskUserQuestionは呼ばれない。
判定方法: Agentのレスポンスに「20文字以上」または「UI-1」に相当する再入力要求が含まれること。
補足: この入力はUI-1ブロックが先行するため、AC-1の実際の発動確認にはTC-AC1-02を使用すること。

**TC-AC1-02: 20文字以上の曖昧入力でのAskUserQuestion発動確認（AC-1主テスト）**
前提条件: 変更後のSKILL.mdが読み込まれたセッションである。
入力: `/harness start 機能追加タスク` userIntent=「ダッシュボードに新しい機能を追加する」（19文字）
期待結果: 3軸のうち成功条件軸と影響範囲軸が不明と判定され、AskUserQuestionが最大2問発動する。
判定方法: AgentがAskUserQuestion形式（質問＋options 2〜4件）でユーザーに問いかけること。
判定方法: 「目的・成功条件・影響範囲」のうち少なくとも1軸について質問が行われること。

**TC-AC1-03: 1軸不明（影響範囲のみ不明）入力でのAskUserQuestion発動確認**
前提条件: 変更後のSKILL.mdが読み込まれたセッションである。
入力: userIntent=「ログイン失敗時のエラーメッセージを改善するため、ユーザーが原因を特定できるようになること」
期待結果: 目的軸・成功条件軸は明確と判定され、影響範囲軸（どのファイルか）のみについて1問質問される。
判定方法: AskUserQuestionが1問のみ発動し、影響範囲に関する質問とoptionsが提示されること。

**TC-AC1-04: 3軸すべて不明な入力でのAskUserQuestion最大問数確認（境界値）**
前提条件: 変更後のSKILL.mdが読み込まれたセッションである。
入力: userIntent=「システムをよくしたいと思っています（大幅改修）」（22文字）
期待結果: 目的軸・成功条件軸・影響範囲軸すべてが不明と判定され、3問のAskUserQuestionが発動する。
判定方法: 質問数が正確に3問であり、各問に2〜4件のoptionsが付与されていること。

**TC-AC2-01: AskUserQuestion回答後のharness_start呼び出し確認**
前提条件: TC-AC1-02の状況でAskUserQuestionが発動した後の状態である。
入力: AskUserQuestionに対して選択肢から回答を選択する。
期待結果: 回答がuserIntentに統合され、`harness_start(taskName, 統合済みuserIntent)`が呼ばれる。
判定方法: AgentのレスポンスにtaskId・phase=scope_definition・sessionTokenが含まれること。
判定方法: harness_startへの呼び出しが実行され、タスクが正常に作成されることをharness_statusで確認する。

**TC-AC2-02: 回答統合後のuserIntent20文字以上維持確認**
前提条件: 元のuserIntentが20文字以上でAskUserQuestion回答後の統合が行われる状況である。
入力: AskUserQuestionへの最短回答を選択する。
期待結果: 統合後のuserIntentが20文字以上であることが確認された上でharness_startが呼ばれる。
判定方法: harness_startが呼ばれ、タスクがscope_definitionフェーズで開始されること。

**TC-AC3-01: 3軸すべて明確な入力でのAskUserQuestionスキップ確認**
前提条件: 変更後のSKILL.mdが読み込まれたセッションである。
入力: userIntent=「auth/login.tsのパスワードバリデーション処理を修正するため、8文字未満の入力を拒否できるようになること（バリデーションユニットテスト通過を成功基準とする）」
期待結果: 目的軸・成功条件軸・影響範囲軸がすべて明確と判定され、AskUserQuestionが発動しない。
判定方法: Agentがharness_startを直接呼び出し、AskUserQuestionの質問文が表示されないこと。
判定方法: taskId・phase=scope_definitionが即座に報告されること。

**TC-AC3-02: 目的と成功条件は明確だが影響範囲が広い入力での挙動確認**
前提条件: 変更後のSKILL.mdが読み込まれたセッションである。
入力: userIntent=「パフォーマンス改善のため、全APIレスポンスが300ms以下になること（負荷テスト通過が成功基準）」
期待結果: 影響範囲軸が「全API」と明示されているため明確と判定されAskUserQuestionがスキップされる。
判定方法: AskUserQuestionが発動せずharness_startが直接呼ばれること。

**TC-AC4-01: SKILL.mdとworkflow.mdのdiff完全一致確認**
前提条件: 実装フェーズでSKILL.mdとworkflow.mdの両ファイルが書き換え済みの状態である。
入力: 両ファイルをReadツールで読み込む、またはdiffコマンドで比較する。
期待結果: 2ファイルの内容が完全に一致し、差分がゼロ行であること。
判定方法: `diff .claude/skills/harness/SKILL.md workflow-harness/skills/workflow.md` の出力が空であること。
判定方法: Readツールで両ファイルを読み込み、行数・各行の内容が完全に一致することを目視確認する。

**TC-AC5-01: 19文字入力でのUI-1ブロック確認（境界値：境界-1）**
前提条件: 変更後のSKILL.mdが読み込まれたセッションである。
入力: `/harness start testTask` userIntent=「ログイン機能を改修」（9文字）
期待結果: UI-1ブロックが発動し、AskUserQuestionは一切呼ばれない。
判定方法: Agentのレスポンスに再入力要求が含まれ、AskUserQuestionの質問が表示されないこと。

**TC-AC5-02: 20文字入力でのUI-1通過確認（境界値：通過最小値）**
前提条件: 変更後のSKILL.mdが読み込まれたセッションである。
入力: userIntent=「ログイン機能を改修するため20文字ちょうど」（ちょうど20文字に調整した入力）
期待結果: UI-1を通過し、次のステップ（3軸分析）へ進む。
判定方法: UI-1ブロックが発動せず、3軸分析またはAskUserQuestionが呼ばれること。

**TC-AC5-03: 空文字列入力でのUI-1ブロック確認（エッジケース）**
前提条件: 変更後のSKILL.mdが読み込まれたセッションである。
入力: `/harness start testTask` でuserIntentを省略またはスペースのみ入力する。
期待結果: UI-1ブロックが発動し、AskUserQuestionは呼ばれない。
判定方法: 再入力要求のみが表示され、AskUserQuestionの質問文が一切表示されないこと。

## AC→TCマッピングテーブル

| AC-N | テストケースID | テスト内容 |
|------|--------------|-----------|
| AC-1 | TC-AC1-01 | 9文字入力（UI-1先行ブロック）でAskUserQuestionが呼ばれないことの確認 |
| AC-1 | TC-AC1-02 | 20文字以上の曖昧入力でAskUserQuestionが発動することの確認（主テスト） |
| AC-1 | TC-AC1-03 | 1軸不明（影響範囲のみ）入力でAskUserQuestionが1問発動することの確認 |
| AC-1 | TC-AC1-04 | 3軸すべて不明な入力でAskUserQuestionが最大3問発動することの境界値確認 |
| AC-2 | TC-AC2-01 | AskUserQuestion回答後にharness_startが呼ばれscope_definitionで開始することの確認 |
| AC-2 | TC-AC2-02 | 回答統合後のuserIntentが20文字以上を維持した上でharness_startが呼ばれることの確認 |
| AC-3 | TC-AC3-01 | 3軸すべて明確な入力でAskUserQuestionがスキップされharness_startが直接呼ばれることの確認 |
| AC-3 | TC-AC3-02 | 目的・成功条件明確・影響範囲が広範指定の入力でAskUserQuestionがスキップされることの確認 |
| AC-4 | TC-AC4-01 | 実装後のSKILL.mdとworkflow.mdのdiff完全一致確認 |
| AC-5 | TC-AC5-01 | 19文字入力（境界値-1）でUI-1ブロックが発動しAskUserQuestionが呼ばれないことの確認 |
| AC-5 | TC-AC5-02 | 20文字入力（境界値通過最小値）でUI-1を通過し3軸分析へ進むことの確認 |
| AC-5 | TC-AC5-03 | 空文字列入力でUI-1ブロックが発動しAskUserQuestionが呼ばれないことの確認 |

## エッジケース

**EG-001: 回答がoptions外の自由記述の場合**
userIntentへの統合対象となる回答がoptions以外の自由記述の場合、統合方法が不定になるリスクがある。
SKILL.mdではoptions（2〜4件）形式の回答を前提としているため、自由記述回答は発生しない設計である。
確認観点: AskUserQuestionのoptions形式が実際に提示されることをTC-AC1-02で確認する。

**EG-002: harness_startへの呼び出しが失敗した場合の挙動**
AskUserQuestion回答後にharness_startがAPIエラーで失敗するケースは本テスト範囲外である。
理由: SKILL.mdのMarkdown変更のみが対象であり、MCP server側のエラーハンドリングはTypeScript実装の責務である。

**EG-003: 複数のaccessタスクが存在する場合のpre-start checksへの影響**
ステップ1のPre-start checks（アクティブタスク数5以下確認）は変更対象外のため、回帰確認のみ行う。
確認観点: 既存のPre-start checks動作が変更後も維持されることをTC-AC3-01の実施過程で確認する。

**EG-004: SKILL.md側とworkflow.md側で改行コードが異なる場合**
Writeツールで同一内容を書き込んでも、WindowsとUnixの改行コード差異でdiffが発生するリスクがある。
確認観点: TC-AC4-01のdiffコマンドに`--strip-trailing-cr`オプションを追加して改行コード差異を除外した比較も実施する。
