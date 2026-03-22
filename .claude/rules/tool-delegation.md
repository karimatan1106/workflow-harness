# Tool Delegation (2層モデル)

- オーケストレーターの直接ツール使用制限（Write/Glob/Grep禁止）。
- 許可: lifecycle MCP, Agent, Skill, ToolSearch, AskUserQuestion, Read, Edit。
- Edit: Workerのedit-preview結果をOrchestratorが実行（リッチdiff表示用）。直接の調査目的でのRead使用は最小限に。
- Coordinator: 分析・タスク分解。結果はファイルに書き出し。
- Worker: ファイル操作実行。
- subagent間の文脈はファイルベースで中継。L1はファイルパスと1行サマリのみ保持。
