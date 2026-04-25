# requirements

phase: requirements
task: remove-minimax-settings
status: draft

## summary

ミニマックス（MiniMax）モデルに関連するすべての設定と参照を削除するタスクの機能要件を F-001..F-005 として確定する。背景として workflow-harness/.claude/settings.json の env セクションに存在した MiniMax-M2.7 向け環境変数は既に削除済みであり、同ファイルに登録されていた enforce-workflow.js 等のフックスクリプト警告も同一の削除範囲に含まれている。しかし CLAUDE.md の関連記述、feedback ルール (feedback_no-minimax.md)、memory 索引 (MEMORY.md)、研究ベンチマーク引用 (canboluk.md) に live 参照が残存しており、本タスクではこれら live 参照 4 ファイルから MiniMax 関連の設定・コメント・参照を網羅的に除去する。scope_definition で登録済みの AC-1..AC-5 と F-001..F-005 を 1:1 でマッピングし、RTM による追跡を有効化する。本フェーズでは新規 AC 追加は行わず、要件と受入基準の対応関係のみを固定する。

## scope

keywords: MiniMax, M2.7, ミニマックス, minimax

### inScope

- CLAUDE.md の MiniMax 注意事項セクション削除に対する機能要件
- feedback_no-minimax.md の物理削除に対する機能要件
- MEMORY.md の索引行削除に対する機能要件
- canboluk.md のベンチマーク表 MiniMax 行削除に対する機能要件
- grep ベースの決定的検証に対する機能要件

## functionalRequirements

- F-001: CLAUDE.md から `## workflow-harness/.claude/settings.json 注意事項` 見出しと本文を一括削除する機能
- F-002: feedback_no-minimax.md ファイルをファイルシステムから物理削除する機能
- F-003: MEMORY.md の索引表から feedback_no-minimax.md を指す行のみを削除する機能
- F-004: canboluk.md のベンチマーク表から MiniMax を含む行のみを削除する機能
- F-005: 対象 4 ファイルに対する MiniMax 系正規表現 grep を実行し 0 件を確認する検証機能

## acceptanceCriteria

- AC-1: CLAUDE.md から `## workflow-harness/.claude/settings.json 注意事項` セクションの見出しと本文が完全に削除されている
- AC-2: feedback_no-minimax.md ファイルがファイルシステム上に存在しない
- AC-3: MEMORY.md に feedback_no-minimax.md を指す索引行が存在しない
- AC-4: canboluk.md のベンチマーク表から MiniMax を含む行が削除されている
- AC-5: 対象 4 ファイル全体に対し `(?i)minimax|m2\.7|ミニマックス` の正規表現 grep が 0 件である

## notInScope

- git 履歴のコミット rewrite (commit 658381a, 2f58c16 は immutable)
- workflow-harness/.claude/settings.json の変更 (既に clean 状態)
- コード (.ts/.js/.mjs/.cjs) の変更 (対象コードに MiniMax 参照は存在しない)
- 他 LLM バックエンド (Claude, OpenAI, Gemini 等) の設定変更
- workflow-state.toon および docs/workflows/ 配下の自己参照記述
- README.md / docs/adr/ 配下ドキュメント (MiniMax 言及は存在しない前提)

## openQuestions

なし

## decisions

- D-RQ-1: F-001..F-005 と AC-1..AC-5 は 1:1 で対応し、RTM により追跡する
- D-RQ-2: 全削除操作は非破壊であり、git revert により原状回復可能である
- D-RQ-3: 全操作の変更影響度は Low Severity であり段階的ロールアウトは不要
- D-RQ-4: 4 ファイルは相互依存しないため並列実行を許容する
- D-RQ-5: 本タスクはコード変更を含まず、テスト設計は grep とファイル存在確認のみで完結する
- D-RQ-6: 新規 AC は本フェーズでは追加せず、scope_definition フェーズで登録済みの AC-1..AC-5 を継承する

## rtm

- F-001: AC-1: CLAUDE.md セクション削除
- F-002: AC-2: feedback_no-minimax.md ファイル削除
- F-003: AC-3: MEMORY.md 索引行削除
- F-004: AC-4: canboluk.md ベンチマーク行削除
- F-005: AC-5: 4 ファイル grep 0 件検証

## artifacts

- path: docs/workflows/remove-minimax-settings/requirements.md
  role: spec
  summary: requirements フェーズ成果物、F-001..F-005 と AC-1..AC-5 の対応関係を固定する

## next

- next: design
- input: docs/workflows/remove-minimax-settings/requirements.md
- criticalDecisions: F/AC の 1:1 マッピング確定、並列実行許容、非破壊削除方針
- warnings: user 固有 memory 領域の変更は git 差分レビュー対象外のため設計フェーズで手動検証手順を明示する
