# hearing

phase: hearing
task: remove-minimax-settings
status: complete

## summary

ユーザー指示「ミニマックスモデルに関連するすべての設定を消してください」を受け、live 参照の MiniMax 関連記述を全て削除する作業のヒアリングを実施した。追加指示「該当箇所。全部消して」により、CLAUDE.md の注意事項セクション削除に加え、feedback_no-minimax.md ファイル削除、MEMORY.md 索引行削除、canboluk.md 表内 MiniMax 行削除の計 4 ファイルを対象とする方針で合意した。

## intent-analysis

### surfaceRequest

ユーザー原文は次の二つである。
- 第一指示: 「ミニマックスモデルに関連するすべての設定を消してください」
- 追加指示: 「該当箇所。全部消して」

### deepNeed

MiniMax バックエンドは既に使用禁止方針が確立されており、ドキュメント・memory・feedback に残存する参照は「削除済み／禁止」趣旨であっても混乱源となる。ユーザーは live 参照（編集可能な現役ファイル）から MiniMax 関連記述を一掃し、プロジェクト状態とドキュメントを一致させたい。

### unclearPoints

- UP-1: 削除範囲は CLAUDE.md の注意事項セクションのみか、関連 memory / feedback まで含めるか
- UP-2: 再発防止ガードである feedback_no-minimax.md を保持するか削除するか
- UP-3: canboluk.md の MiniMax 表行は研究データとして保持すべきか削除すべきか
- UP-4: git 履歴（commit 658381a, 2f58c16）は rewrite 対象か
- UP-5: 成果物の記述形式は TOON か Markdown か

### assumptions

- A-1: コード側の settings.json は既に clean であり、ドキュメント削除のみで要件を満たす
- A-2: 削除作業はドキュメント操作のためコード影響なしで低リスクである
- A-3: 削除対象は live 参照に限定し、git 履歴は immutable として扱う
- A-4: 再発防止は CLAUDE.md 注意事項ではなく他のガード機構に委ねられている
- A-5: 成果物形式は現行のワークフロー規約に合わせる

### userResponse

userResponse: ユーザーは初回指示「ミニマックスモデルに関連するすべての設定を消してください」と追加指示「該当箇所。全部消して」を出した。初回 AskUserQuestion では CLAUDE.md 該当セクション全体削除と feedback_no-minimax.md 保持を選択し、追加指示により live 参照 4 ファイルからの MiniMax 関連記述全削除へスコープ拡張した。

初回 AskUserQuestion の回答は次の通り。
- Q1 削除スコープ: CLAUDE.md の `## workflow-harness/.claude/settings.json 注意事項` セクション全体を削除する
- Q2 feedback_no-minimax.md: 当初は保持方針で回答
- canboluk.md:67 の研究引用: 当初はスコープ外で保持
- git 履歴 658381a, 2f58c16: rewrite 非推奨のため対象外

追加指示「該当箇所。全部消して」を受け、方針を拡張した。
- feedback_no-minimax.md: 保持から削除へ変更
- MEMORY.md:96 の索引行: 削除対象に追加
- canboluk.md:67 の MiniMax 行: 削除対象に追加
- git 履歴: immutable のため対象外のまま維持

## implementation-plan

### approach

live 参照の 4 ファイルに対し、最小差分で MiniMax 関連記述を削除する。コード変更は行わず、ドキュメント削除のみで完結させる。CLAUDE.md は該当セクション全体を削除し、feedback_no-minimax.md はファイルごと削除、MEMORY.md と canboluk.md は該当 1 行のみ削除する。

### estimatedScope

変更対象は 4 ファイルで全て削除操作である。
- CLAUDE.md: 注意事項セクション約 11 行削除
- feedback_no-minimax.md: ファイル全体削除
- MEMORY.md: 索引表の 1 行削除
- canboluk.md: ベンチマーク表の 1 行削除

### risks

- R-1: canboluk.md の表から 1 行削除することで他の行の文脈が崩れる可能性は低いが要確認
- R-2: MEMORY.md の索引は他の memory ファイルから参照される可能性があるため削除後の孤立参照を確認する
- R-3: feedback_no-minimax.md 削除により再発防止ガードが失われるためユーザー合意済みであることを記録する
- R-4: CLAUDE.md セクション削除によるフック設定に関する情報喪失は他のドキュメントでカバーされる

### questions

なし。追加指示によりスコープが確定した。

## decisions

- D-HR-1: 削除対象は CLAUDE.md の `workflow-harness/.claude/settings.json 注意事項` セクション全体とする
- D-HR-2: feedback_no-minimax.md はユーザー追加指示「全部消して」に従いファイルごと削除する
- D-HR-3: MEMORY.md の feedback 索引行（line 96 相当）を削除する
- D-HR-4: canboluk.md のベンチマーク表内 MiniMax 行（line 67 相当）を削除する
- D-HR-5: git 履歴 658381a, 2f58c16 は immutable のため rewrite 対象外とする
- D-HR-6: 成果物形式は Markdown とする

## artifacts

- path: docs/workflows/remove-minimax-settings/hearing.md
  role: spec
  summary: hearing フェーズ成果物、ユーザー意図分析と削除スコープ決定を記録

## next

- next: scope_definition
- input: docs/workflows/remove-minimax-settings/hearing.md
- criticalDecisions: 4 ファイル削除スコープ確定、git 履歴対象外、再発防止ガードは削除側合意
- readFiles: CLAUDE.md, feedback_no-minimax.md, MEMORY.md, canboluk.md
- warnings: MEMORY.md は user 固有 memory 領域、git 管理外のため workflow ハーネスの差分レビュー対象外である点に留意
