## サマリー

- [REQ-001][feature] phase-edit-guard.jsにdocs/workflows/配下パスを検出してOrchestratorの直接書き込みをexit code 2でブロックするロジックを追加する。
- [REQ-002][doc] SKILL.md（.claude/skills/harness/SKILL.md）のOrchestratorパターン節に違反例と正しいパターンを追加して規則の意識を強化する。
- [REQ-003][doc] workflow-harness/skills/workflow.mdをSKILL.mdのミラーとして同一変更を適用する。
- [REQ-004][constraint] 変更後のphase-edit-guard.jsは200行以下を維持しなければならない。
- [REQ-005][constraint] 既存のisBypassPath()ロジックは変更せず、runHook関数内でのみ新規チェックを追加する。

## 機能要件

runHook関数のisBypassPath()呼び出し直後（行59の直後）に、ファイルパスが `docs/workflows/` を含む場合を検出する分岐を追加する。
検出時はexit code 2でプロセスを終了し、stderrにJSON形式のブロック理由を出力する。
ブロック理由メッセージには「Orchestrator must not edit phase artifacts directly」というメッセージを含める。
SKILL.mdの `## 3. Orchestrator Pattern` 節（またはその直後の適切な位置）に違反例ブロックを追加する。
違反例は「Orchestratorがdocs/workflows/配下のファイルを直接EditまたはWriteする」ケースを示す。
正しいパターンはサブエージェントを再起動してartifactを生成させるケースを示す。
workflow.mdにもSKILL.mdと同一内容の変更を反映してミラー状態を維持する。
パスチェックはpath.sep正規化に依存せず、スラッシュ・バックスラッシュの両方に対応するため `replace(/\\/g, '/')` を使用する。

## 非機能要件

phase-edit-guard.jsの変更後の合計行数は86行（現在）＋10行以内に収め、200行上限を維持する。
新規パスチェックロジックは既存のisBypassPath()・getEffectiveExtension()のインターフェースを変更しない。
ブロックメッセージはJSON形式（`{ decision: 'block', reason: ... }`）でstderrに出力し、既存パターンと一致させる。
SKILL.mdおよびworkflow.mdへの追加は各ファイルに5〜10行以内に留め、200行上限を守る。
追加するドキュメント内容に禁止語（TODO/TBD/WIP/FIXME/未定/未確定/要検討/検討中/対応予定/サンプル/ダミー/仮置き）を含めない。
変更はhook-utils.jsの既存インターフェースに影響を与えない。
既存のテスト（存在する場合）が変更後も全てパスすること。

## 受入基準

AC-1: phase-edit-guard.jsにdocs/workflows/を含むパスへの書き込みをブロックするロジックが存在し、exit code 2で終了することをコードレビューで確認できる。
AC-2: SKILL.mdの `## 3. Orchestrator Pattern` 節（またはその直後）にOrchestratorが直接editしてはならないことを示す違反例と正しいパターンが追加されていること。
AC-3: workflow-harness/skills/workflow.mdがSKILL.mdと同一の違反例変更を反映したミラー状態であること。
AC-4: 変更後のphase-edit-guard.jsの行数が200行以下であること（L3チェック）。
AC-5: ブロック時のstderr出力がJSON形式の `{ decision: 'block', reason: '...' }` であり、既存の拡張子ブロックと同一フォーマットであること。

## NOT_IN_SCOPE

hook-utils.jsのisBypassPath()関数への変更は対象外とする。
workflow-orchestrator.mdへのドキュメント追加は別タスクとして扱う。
MCPサーバー側のDoD検証ロジックへの変更は対象外とする。
phase-edit-guard.jsのユニットテスト新規追加は対象外とする。
CIパイプラインへの変更は対象外とする。
docs/workflows/配下以外のパスに対するOrchestratorブロックルールの追加は対象外とする。

## OPEN_QUESTIONS

なし
