# Impact Analysis: hearing-worker-real-choices

taskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e
phase: impact_analysis
size: large

## 変更影響範囲

### hearing-worker.md (エージェント定義)

影響範囲: hearing-workerサブエージェントの全実行に影響。hearingフェーズでAskUserQuestionを呼ぶ際の選択肢生成ルールが変わる。
後方互換性: 問題なし。既存の「AskUserQuestionで質問する」指示に品質制約を追加するだけで、既存フローを壊さない。
行数影響: 現在27行。5-8行追加で32-35行。200行制限に余裕あり。
副作用リスク: hearing-workerが質問を生成する際の処理時間が微増する可能性があるが、LLMの出力品質向上による効果が上回る。

### defs-stage0.ts (hearingテンプレート)

影響範囲: hearingフェーズのsubagentTemplateに影響。hearing-workerに渡されるプロンプトの選択肢品質指示が具体化される。
後方互換性: 問題なし。既存の「AskUserQuestion呼び出しは必須。選択肢は2個以上提示すること。」を具体的ルールに書き換えるだけ。
行数影響: 現在44行。行数増減は1-2行程度。200行制限に余裕あり。
副作用リスク: テンプレート文字列の変更のみでランタイムロジックに影響なし。

### 影響を受けないファイル

- coordinator.md: hearing-workerへの委譲ロジックに変更なし
- workflow-phases.md: フェーズ定義に変更なし
- toon-skeletons-a.ts: TOONスケルトンに変更なし(前回FIX-1のuserResponseキーはそのまま)
- dod-l2-hearing.ts: DoD検証ロジックに変更なし

## リスク評価

技術リスク: 低。テンプレート文字列とエージェント定義の文言変更のみ。コンパイルエラーやランタイムエラーの可能性なし。
運用リスク: 低。hearing-workerの出力品質が向上する方向の変更であり、劣化の可能性は極めて低い。
テストリスク: 低。defs-stage0.tsの既存テスト(hearing-template.test.ts)のAskUserQuestion関連アサーションを更新する必要がある可能性。

## decisions

- IA-001: hearing-worker.mdへの変更は即座に反映される(MCP再起動不要)。エージェント定義はClaude Code起動時に読み込まれる。
- IA-002: defs-stage0.tsの変更はMCPサーバー再起動後に反映。ただしテンプレート内容はハーネスセッション開始時にロードされる。
- IA-003: 既存テストhearing-template.test.tsのTC-AC2-01/TC-AC2-02がdefs-stage0.tsの文言を検証している。文言変更に合わせてテスト更新が必要。
- IA-004: hearing-worker.mdの変更は他のエージェント定義(coordinator.md, worker.md)に影響しない。独立したエージェント定義。
- IA-005: 本変更はharness-template-reliability FIX-1の補完であり、FIX-1のuserResponseキーやSUMMARY_SECTION追加には影響しない。

## artifacts

- docs/workflows/hearing-worker-real-choices/impact-analysis.md: spec: 2ファイル変更の影響分析。低リスク、後方互換性問題なし、テスト更新が必要。

## next

- criticalDecisions: IA-003(テスト更新必要)、IA-001(即座反映)
- readFiles: .claude/agents/hearing-worker.md, workflow-harness/mcp-server/src/phases/defs-stage0.ts, workflow-harness/mcp-server/src/__tests__/hearing-template.test.ts
- warnings: hearing-template.test.tsのアサーション文言がdefs-stage0.tsの変更に追従する必要がある
