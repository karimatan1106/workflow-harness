## サマリー

- [SD-001][decision] phase-edit-guard.jsは現時点でdocs/workflows/配下への書き込みをパスベースで検出する機能を持たない。拡張子ベース制御のみであり、フェーズ外ディレクトリへの.md書き込みは阻止されない。
- [SD-002][decision] SKILL.md（.claude/skills/harness/SKILL.md）のOrchestratorパターン節には違反例の記述がなく、「NEVER does phase work directly」の原則が宣言のみで具体的な禁止パターンが示されていない。
- [SD-003][decision] workflow-orchestrator.mdにも「Never does phase work directly」の記述はあるが、docs/workflows/配下への直接Edit/Write操作を具体例として列挙した節が存在しない。
- [SD-004][finding] phase-edit-guard.jsのrunHook関数は拡張子のみを検査し、ファイルパスのディレクトリ成分を検査するロジックを持たない。isBypassPath()によるバイパス判定はあるが、ブロック対象パターンを追加するフックポイントが設計上存在しない。
- [SD-005][constraint] 変更対象は2ファイルに限定される。phase-edit-guard.js（ガード追加）とSKILL.md（違反例追加）である。workflow.mdはSKILL.mdのミラーであり、同期対象として影響範囲に含まれる。

## スコープ定義

このタスクはCLAUDE.md Section 6「Orchestrator NEVER does phase work directly」ルールを技術的に強制するための変更である。
現在phase-edit-guard.jsはisBypassPath()とgetEffectiveExtension()による拡張子チェックのみを実施しており、docs/workflows/配下のパスを検出するロジックは存在しない。
変更後はOrchestratorがEdit/Write/Bash toolを使ってdocs/workflows/配下のMarkdownファイルを直接書き込もうとした場合にフックがexit code 2でブロックし、エラーメッセージでsubagent委任を促す設計とする。
SKILL.mdのOrchestratorパターン節には現在「NEVER does phase work directly」の宣言はあるが具体的な違反例が存在しないため、違反パターンと正しいパターンを対比形式で追加することで認知的な防止も補強する。
workflow.mdはSKILL.mdのミラーファイルであり、同一の変更を適用してミラー状態を維持することも本タスクの範囲に含まれる。
成功基準の第1点はhookがdocs/workflows/配下への直接書き込みをexit code 2でブロックすることであり、第2点はSKILL.mdに違反例と正しいパターンが記載されることである。
第3点はphase-edit-guard.jsが200行以下を維持することであり、第4点は拡張子ベースの既存チェックロジックを破壊しないことである。
この4点をすべて満たすことで、宣言的ルールと技術的強制の両面からOrchestratorの直接編集違反を防止できる状態を確立する。

## 影響範囲

直接変更対象は3ファイルである。最初の変更対象はworkflow-harness/hooks/phase-edit-guard.jsであり、runHook関数内にdocs/workflows/パス検出ブロックを追加する。
追加行数は約10行を想定しており、Windows/Unix両環境のパス区切り文字を正規化した上でディレクトリ検出を行うため、path.normalize等のユーティリティを活用する。
2番目の変更対象は.claude/skills/harness/SKILL.mdであり、Orchestratorパターン節の末尾に違反例と正しいパターンを散文または対比形式で追加する。
3番目の変更対象はworkflow-harness/skills/workflow.mdであり、SKILL.mdのミラーとして同一変更を適用し、両ファイルの内容一致を維持する。
間接的影響として、phase-edit-guard.jsを呼び出す.mcp.jsonおよびsettings.jsonのフック設定は変更不要だが、フック動作の変化によってOrchestratorの従来の直接書き込みパスがブロックされるようになる。
これはOrchestratorがDoD失敗時にsubagentを再起動せず直接Edit/Writeしていたケースを含め、docs/workflows/配下への全直接書き込みが影響を受けることを意味する。
hook-utils.js（isBypassPath, getCurrentPhase, findProjectRoot）はphase-edit-guard.jsが依存しているが今回は変更せず、依存ファイルの安定性を保持する。
CLAUDE.md Section 5（Forbidden Actions）には既に「Orchestrator directly editing artifacts on validation failure」が禁止として記載されており、今回はフック側を強化してそのルールを機械的に執行する形になる。

## スコープ外

hook-utils.jsのisBypassPathやgetCurrentPhaseのロジック変更は行わない。変更はphase-edit-guard.jsのrunHook関数内にのみ加え、ユーティリティ層には触れない方針である。
dangerous-command-guard.js、loop-detector.jsなど他のフックファイルも変更対象から除外する。これらのフックは独立した責務を持ち、今回の変更と干渉しないよう範囲を限定する。
harness-server/src/配下のMCPサーバー側DoD検証ロジックは変更しない。サーバー側の変更は別タスクとして独立した計画が必要であり、今回の範囲には含めない。
workflow-orchestrator.mdにも「NEVER edit directly」の記述はあるが、今回の追加はSKILL.mdのみとし、workflow-orchestrator.mdは別タスクで扱う方針とする。
phase-edit-guard.jsのユニットテスト追加も本タスクのスコープ外とする。テスト追加は重要だが、実装の安定を確認してから別タスクで計画することが適切である。
GitHub Actions等のCI/CDパイプライン設定変更も行わない。フックはローカル実行環境での制御であり、CI/CDへの展開は別途検討すべき課題である。
docs/workflows/配下のファイルのうちscope-definition.mdと.toonファイル以外の既存ドキュメントへの変更も行わない。既存成果物への遡及的な修正は別タスクの判断事項である。
本タスクの範囲は技術的ブロックとSKILL.mdへの記述追加の2点に集中させ、最小変更で最大の強制効果を得ることを優先する。
なお、実装後の各フェーズでこのガード機能が正常に動作していることをDoD検証時に確認する手順も併せて文書化すべきである。
