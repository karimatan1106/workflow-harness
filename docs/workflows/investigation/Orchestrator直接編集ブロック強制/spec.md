## サマリー

- [PL-001][decision] runHook関数内のisBypassPath()呼び出し直後（行59直後）にdocs/workflows/パスチェックを挿入する。
- [PL-002][decision] パスチェックはfilePath.replace正規化してからincludes検出する2ステップ方式でクロスプラットフォーム対応する。
- [PL-003][decision] ブロック時はexit code 2で終了し、stderrにJSON形式のブロック理由を出力する。
- [PL-004][decision] SKILL.mdのOrchestratorパターン節に違反例と正しいパターンを追記してルールを意識させる。
- [PL-005][decision] workflow-harness/skills/workflow.mdにSKILL.mdと同一の違反例変更を適用し、ミラー状態を維持する。
- [PL-006][constraint] 追加行数はphase-edit-guard.jsで8行以内、SKILL.mdとworkflow.mdで各6行以内とし、200行制限を全ファイルで維持する。
- [PL-007][decision] RTMエントリF-001〜F-003を定義し、planningフェーズのトレーサビリティチェーンを確立する。

## 概要

Orchestratorがharness_next失敗時にdocs/workflows/配下のアーティファクトを直接Edit/Writeすることを、フックレイヤーで強制ブロックする。
現行のphase-edit-guard.jsは拡張子チェック（PHASE_EXTENSIONS）とisBypassPath()のみを実施しており、パスのディレクトリ成分を検査していない。
CLAUDE.md Section 5に「Orchestrator directly editing artifacts on validation failure」が禁止行動として明記されているが、フック側に対応する実装が存在しない乖離状態である。
この乖離を解消するため、runHook関数にパスベースのブロックを追加してCLAUDE.md Section 5の宣言をフック強制に昇格させる。
変更は3ファイル（phase-edit-guard.js、SKILL.md、workflow.md）に限定し、hook-utils.js・MCPサーバー・CIは変更対象外とする。
変更後のすべてのファイルは200行以下の制限を維持しなければならない。

## 実装計画

実装は以下の順序で実施する。依存関係が存在するため順序を変えてはならない。

ステップ1: phase-edit-guard.jsへのパスチェック追加。
行59（`if (isBypassPath(filePath)) process.exit(0);`）の直後に8行以内のパスチェックブロックを挿入する。
挿入するロジックはfilePath.replace(/\\/g, '/')でバックスラッシュをスラッシュに正規化してから`.includes('docs/workflows/')`で検出する。
ブロック時のメッセージは`'Orchestrator must not edit phase artifacts directly.\nFile: ' + filePath + '\nRe-launch subagent to regenerate the artifact.'`とする。
stderrへのJSON出力形式は既存の拡張子ブロック（行75）と完全に一致させる: `{ decision: 'block', reason: msg }`。

ステップ2: SKILL.mdへの違反例追記。
SKILL.mdの`## 3. Workflow Usage Decision`節の直前（現行88行末尾に追記する形）に違反例ブロックを追加する。
違反例はOrchestratorがdocs/workflows/配下を直接Editする誤ったパターンを示す。
正しいパターンはサブエージェントを再起動してアーティファクトを再生成させるパターンを示す。
追加行数は6行以内とし、SKILL.mdの行数を200行以下に維持する。

ステップ3: workflow.mdへのミラー適用。
ステップ2と同一の変更内容をworkflow-harness/skills/workflow.mdに適用する。
両ファイルの内容が一致していることをdiff比較で確認する。

## 変更対象ファイル

変更対象は以下の3ファイルのみである。

ファイル1: `workflow-harness/hooks/phase-edit-guard.js`（現在86行）
変更箇所: runHook関数内、行59のisBypassPath()チェック直後。
変更内容: docs/workflows/パスを検出してexit code 2でブロックする8行以内のif文を追加する。
変更後の想定行数: 94行以下（200行制限まで106行以上の余裕）。

ファイル2: `.claude/skills/harness/SKILL.md`（現在88行）
変更箇所: ファイル末尾（現行`## 3. Workflow Usage Decision`節の直前）。
変更内容: Orchestratorパターン違反例と正しいパターンを示す6行以内のブロックを追加する。
変更後の想定行数: 94行以下（200行制限まで106行以上の余裕）。

ファイル3: `workflow-harness/skills/workflow.md`（現在89行）
変更箇所: ファイル末尾（SKILL.mdと同一箇所）。
変更内容: SKILL.mdと同一の違反例変更を適用する。
変更後の想定行数: 95行以下（200行制限まで105行以上の余裕）。

変更対象外: hook-utils.js、workflow-orchestrator.md、MCPサーバー、CIパイプライン、ユニットテストファイル。

## RTMエントリ定義

F-001: AC-1に対応。phase-edit-guard.jsにdocs/workflows/パスブロックを実装する。
設計参照: spec.md「## 実装計画」ステップ1。
コード参照: workflow-harness/hooks/phase-edit-guard.js（行59直後の追加ブロック）。
テスト参照: AC-1のコードレビューによる確認（ユニットテストは対象外）。

F-002: AC-2に対応。SKILL.mdにOrchestratorパターン違反例と正しいパターンを追記する。
設計参照: spec.md「## 実装計画」ステップ2。
コード参照: .claude/skills/harness/SKILL.md（追記箇所）。
テスト参照: AC-2の目視確認。

F-003: AC-3に対応。workflow.mdにSKILL.mdと同一の変更をミラー適用する。
設計参照: spec.md「## 実装計画」ステップ3。
コード参照: workflow-harness/skills/workflow.md（追記箇所）。
テスト参照: AC-3のdiff比較確認。

## 依存関係と制約

ステップ1はステップ2・3に依存しない。ステップ1を先行させることを推奨する。
ステップ3はステップ2の内容を参照するため、ステップ2完了後に実施する。
すべての変更はimplementationフェーズで一括実施する（test_implは対象外）。
phase-edit-guard.jsの変更は既存のisBypassPath()・getEffectiveExtension()の関数シグネチャを変更してはならない。
追加するif文は既存のexit code 2パターン（行75〜76）と同一のstderr出力形式を使用しなければならない。
Windows環境のバックスラッシュとUnix環境のスラッシュの両方を正規化してからパス検出を行うこと。
