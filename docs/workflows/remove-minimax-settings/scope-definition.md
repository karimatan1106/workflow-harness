# scope_definition

phase: scope_definition
task: remove-minimax-settings
status: complete

## summary

live 参照 4 ファイルから MiniMax 関連記述を一掃するスコープを確定する。CLAUDE.md の注意事項セクション全削除、feedback_no-minimax.md ファイル削除、MEMORY.md の索引 1 行削除、canboluk.md のベンチマーク表 1 行削除、の計 4 対象で完結し、git 履歴とコードベースは対象外とする。

## scope

### inScope

- target: CLAUDE.md
  path: C:\ツール\Workflow\CLAUDE.md
  operation: delete-section
  locator: `## workflow-harness/.claude/settings.json 注意事項`
  note: セクション見出しから次の H2 直前までを全削除する
- target: feedback_no-minimax.md
  path: C:\Users\owner\.claude\projects\C------Workflow\memory\feedback\feedback_no-minimax.md
  operation: delete-file
  note: ファイルごと物理削除する
- target: MEMORY.md
  path: C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md
  operation: delete-line
  locator: line 96 相当の `feedback_no-minimax.md` 索引行
  note: 索引表の該当行のみを削除し、周辺行は触らない
- target: canboluk.md
  path: C:\Users\owner\.claude\projects\C------Workflow\memory\patterns\canboluk.md
  operation: delete-line
  locator: line 67 相当のベンチマーク表内 MiniMax 行
  note: 表の該当行のみを削除し、ヘッダと他ベンチマーク行は保持する

### outOfScope

- git 履歴のコミット 658381a, 2f58c16 は immutable として rewrite しない
- workflow-harness/.claude/settings.json は既に clean のため変更しない
- コード (.ts / .js / .mjs / .cjs) には MiniMax 参照が無いため変更しない
- 外部ベンダードキュメントやサブモジュール内の独立ファイルは対象外
- README.md / docs/adr/ など他の解説ドキュメントに MiniMax 言及が無いことが前提

keywords: MiniMax, M2.7, ミニマックス, minimax

## acceptanceCriteria

- AC-1: CLAUDE.md から `## workflow-harness/.claude/settings.json 注意事項` セクションの見出しと本文が完全に削除されている
- AC-2: C:\Users\owner\.claude\projects\C------Workflow\memory\feedback\feedback_no-minimax.md ファイルがファイルシステム上に存在しない
- AC-3: C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md に feedback_no-minimax.md を指す索引行が存在しない
- AC-4: C:\Users\owner\.claude\projects\C------Workflow\memory\patterns\canboluk.md のベンチマーク表から MiniMax を含む行が削除されている
- AC-5: 対象 4 ファイル全体に対し `(?i)minimax|m2\.7|ミニマックス` の正規表現 grep が 0 件である (workflow-state.toon の自己参照および git 履歴は除外)

## invariants

- INV-1: コードファイル (.ts/.js/.mjs/.cjs/.json スキーマ) は変更しない
- INV-2: 対象外ファイルの行順・インデントは保持する
- INV-3: CLAUDE.md の他セクション (rtk scope, session 開始手順等) は保持する
- INV-4: MEMORY.md の索引表フォーマット (列構成) は保持する
- INV-5: canboluk.md の表ヘッダおよび他ベンチマーク行は保持する

## decisions

- D-SC-1: 削除スコープは live 参照の 4 ファイルに限定し、git 履歴とコードには触れない
- D-SC-2: CLAUDE.md は該当セクション全体を削除し、部分的な書き換えや置換は行わない
- D-SC-3: feedback_no-minimax.md は再発防止ガードとしての役割よりユーザー追加指示「全部消して」を優先し、ファイルごと削除する
- D-SC-4: MEMORY.md と canboluk.md は該当 1 行のみのピンポイント削除とし、周辺行の並び替えや再フォーマットは行わない
- D-SC-5: AC 検証は CLAUDE.md および memory 配下 4 ファイル群に対する grep により決定的に判定する (workflow-state.toon の自己参照は除外)
- D-SC-6: 成果物形式は Markdown とし、scope-definition.md 単一ファイルで decisions/artifacts/next を表現する

## artifacts

- path: docs/workflows/remove-minimax-settings/scope-definition.md
  role: spec
  summary: scope_definition フェーズ成果物、削除対象 4 ファイルと AC-1..AC-5 と不変条件を確定する
- path: docs/workflows/remove-minimax-settings/hearing.md
  role: input
  summary: 前フェーズ hearing の成果物、ユーザー意図と削除範囲合意の出所

## next

- next: requirements
- input: docs/workflows/remove-minimax-settings/scope-definition.md
- readFiles:
  - C:\ツール\Workflow\CLAUDE.md
  - C:\Users\owner\.claude\projects\C------Workflow\memory\feedback\feedback_no-minimax.md
  - C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md
  - C:\Users\owner\.claude\projects\C------Workflow\memory\patterns\canboluk.md
- criticalDecisions: 4 ファイル削除スコープ確定、git 履歴対象外、feedback_no-minimax.md は削除側合意
- warnings: MEMORY.md と canboluk.md は user 固有 memory 領域のため git 差分レビュー対象外、削除後の手動確認が必要
