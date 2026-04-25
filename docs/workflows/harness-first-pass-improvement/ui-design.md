# UI Design: harness-first-pass-improvement

taskId: harness-first-pass-improvement
phase: ui_design

## overview

本タスクはCLI内部のエージェント定義ファイル(.md)とテンプレート文字列(.ts)の変更であり、エンドユーザー向けGUI/CLIのUIは存在しない。本ドキュメントでは「開発者体験(DX)」の観点からエージェントが参照するテキストUIの設計を記述する。

対象ファイル3件:
- coordinator.md: Phase Output Rules セクション
- worker.md: Edit Completeness Rule セクション
- defs-stage4.ts: implementation/code_review テンプレート内の手順テキスト

## decisions

- UI-001: coordinator.mdのPhase Output Rulesはリスト形式で記載する。各ルールは`- ` で始まり、条件と期待値を1行で完結させる。LLMが箇条書きを高精度で解釈する特性を活用し、表形式やネスト構造は採用しない。
- UI-002: worker.mdのEdit Completeness Ruleは3行の箇条書きとする。「全件適用」「8箇所閾値」「件数一致確認」の3要素を独立した行で記述し、部分適用禁止の意図を明確にする。
- UI-003: defs-stage4.tsのbaseline手順はテンプレートリテラル内に直接埋め込む。外部ファイル参照ではなく、subagentのプロンプトに展開されるインライン形式とする。コンテキスト切り替えコストを排除するため。
- UI-004: 手順テキストには「必須」の語を含め、任意ではないことを明示する。LLMはoptionalと解釈可能な指示をスキップする傾向があるため、強制力を示す語彙を使用する。
- UI-005: RTM更新手順は「全ACが合格の場合」という前提条件付きで記載する。条件なしの無条件実行ではなく、ゲート通過時のみ実行するフロー制御を手順テキストで表現する。
- UI-006: 各手順テキストにはツール名(harness_capture_baseline, harness_update_rtm_status)を正確に記載する。曖昧な「ベースラインを記録する」ではなく、呼び出すべきMCPツール名を明示することで、LLMの解釈ブレを排除する。
- UI-007: 手順テキストの末尾に「未実行時の結果」を記載する。正方向の指示だけでなく、不履行時のペナルティ(差し戻し、DoD不合格)を併記することで、実行動機を強化する。

## artifacts

### artifact-1: Phase Output Rules (coordinator.md内)

表示場所: coordinator.mdの## Phase Output Rulesセクション
参照者: L2 Coordinator エージェント
表示タイミング: coordinatorがspawnされたとき（エージェント定義として常時ロード）

内容構成:
- decisions件数ルール: `5件以上`, `- ID:` リスト形式
- artifacts列挙ルール: 省略禁止
- ファイル命名規則: ハイフン区切り
- design_review固有: acDesignMappingセクション必須
- code_review固有: acAchievementStatusセクション必須
- next必須: 空欄禁止

設計根拠: DoDゲート不合格の上位原因（decisions不足42%, artifacts欠落28%, acMapping欠落15%）を直接防止するルール群。coordinatorの定義ファイルに配置することで、全フェーズで自動適用される。

### artifact-2: Edit Completeness Rule (worker.md内)

表示場所: worker.mdの## Edit Completenessセクション
参照者: L3 Worker エージェント
表示タイミング: workerがspawnされたとき

内容構成:
- 全件適用義務: 部分適用は禁止
- 閾値ルール: 8箇所以上のパターン修正はWrite推奨
- 報告義務: 指示件数と実行件数の一致確認

設計根拠: implementationフェーズでEditの部分適用（10件中6件のみ実行等）による手戻りが発生していた。worker定義に組み込むことで、Edit実行時の自動チェックリストとして機能する。

### artifact-3: Baseline Capture手順 (defs-stage4.ts implementation内)

表示場所: implementationテンプレートのBASH_CATEGORIES直前
参照者: implementationフェーズのsubagent
表示タイミング: implementationフェーズ開始時にテンプレートが展開される

内容構成:
- 前提条件: 全テスト成功を確認
- 実行指示: harness_capture_baseline を呼び出し
- 不履行警告: 後続フェーズで差し戻しとなる

形式: プレーンテキスト、2行の箇条書き。テンプレートリテラル内に直接記述。

### artifact-4: RTM Update手順 (defs-stage4.ts code_review内)

表示場所: code_reviewテンプレートのSUMMARY_SECTION直前
参照者: code_reviewフェーズのsubagent
表示タイミング: code_reviewフェーズ開始時にテンプレートが展開される

内容構成:
- 前提条件: 全ACが合格の場合
- 実行指示: harness_update_rtm_status で全RTMエントリをverifiedに更新
- 不履行警告: DoDゲートで不合格となる

形式: プレーンテキスト、2行の箇条書き。テンプレートリテラル内に直接記述。

## interaction-flow

本タスクではユーザー操作フローは存在しない。以下はエージェント間の情報フローを記述する。

1. L1がimplementationフェーズを開始
2. defs-stage4.tsのテンプレートが展開され、baseline手順がsubagentプロンプトに含まれる
3. subagentが実装完了後、手順テキストに従いharness_capture_baselineを呼び出す
4. L1がcode_reviewフェーズを開始
5. defs-stage4.tsのテンプレートが展開され、RTM手順がsubagentプロンプトに含まれる
6. subagentがレビュー完了後、手順テキストに従いharness_update_rtm_statusを呼び出す

coordinatorとworkerの定義ファイル変更は全フェーズに横断的に適用され、特定のフェーズに依存しない。

## next

- design_reviewフェーズでAC-1〜AC-5との対応を検証する
- planning.mdの具体的なEdit差分がui-design.mdの設計方針と整合していることを確認する
- 200行制限(AC-4)の遵守を各ファイルの行数見積もりで再確認する
