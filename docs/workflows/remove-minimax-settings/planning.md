# Planning: MiniMax 設定削除

## 概要

requirements.md の AC-1..AC-5 および F-001..F-005 を達成するための作業計画。
対象 4 ファイルから MiniMax 関連 live 参照を削除する実行手順を定義する。

## workBreakdown (WBS)

| ID  | 作業内容                                           | 対応 F | 対象ファイル                                      |
|-----|----------------------------------------------------|--------|---------------------------------------------------|
| W-1 | CLAUDE.md から MiniMax 言及ブロックを範囲限定削除 | F-001  | CLAUDE.md                                         |
| W-2 | feedback_no-minimax.md ファイル自体を削除         | F-002  | .claude/feedback/feedback_no-minimax.md           |
| W-3 | MEMORY.md の索引行（line 96 周辺）削除            | F-003  | ~/.claude/.../MEMORY.md                           |
| W-4 | canboluk.md 内の MiniMax 参照行（line 67）削除    | F-004  | memory/patterns/canboluk.md                       |
| W-5 | grep による全ファイル残存チェック                 | F-005  | 4 ファイル全体                                    |

## taskSequence

- W-1, W-2, W-3, W-4 は相互依存なし（並列実行可能）
- W-5 は W-1..W-4 の全完了後に実施（検証ステップ）
- 並列化により編集衝突リスクは無い（異なるファイルのみ）

実行順:
1. W-1 / W-2 / W-3 / W-4 を並列起動
2. 全 Worker 完了を待ち合わせ
3. W-5 検証を単独実行
4. 単一コミットにまとめて記録

## toolPlan

| WBS | ツール         | 手段                                          |
|-----|----------------|-----------------------------------------------|
| W-1 | Edit           | old_string に対象ブロックを指定し空文字置換   |
| W-2 | Bash (rm)      | ファイル存在確認後 rm で完全削除              |
| W-3 | Edit           | 該当索引行 1 行を指定して削除                 |
| W-4 | Edit           | MiniMax 参照行 1 行を指定して削除             |
| W-5 | Bash (grep)    | grep -rn 'MiniMax' + test -f で欠損確認       |

W-2 のみ Bash を使用する理由はファイル全体削除のため。他は行単位 Edit。

## rollbackPlan

- 全作業を 1 コミットに集約する
- 失敗時は `git revert <commit>` で単一コマンド巻き戻し
- 未コミット段階での失敗は `git restore <path>` で個別復旧
- W-2 の rm は git 管理下のため、ワーキングツリーに残っていない場合も git restore で復元可能

## estimatedEffort

- 編集操作: 4 件（W-1..W-4）
- 検証操作: 1 件（W-5）
- 合計 5 ステップ構成
- 各ステップは独立・軽量で、リトライコストも低い

## decisions

- D-PL-1: W-1..W-4 は依存関係が無いため並列実行で進める。シリアル化するメリットが無い
- D-PL-2: CLAUDE.md は文書構造を保持するため Edit の old_string で削除範囲を限定する
- D-PL-3: feedback_no-minimax.md はファイルそのものが MiniMax 専用であるため、Bash rm でファイル全体を削除する
- D-PL-4: MEMORY.md と canboluk.md は 1 行のみ削除対象のため、Edit で行単位に操作する
- D-PL-5: 全削除操作完了後、grep による 4 ファイル横断の残存チェックを 1 回実施し F-005 を満たす
- D-PL-6: ロールバックは git revert 前提とし、4 編集 + 検証を単一コミットにまとめる方針とする

## artifacts

- docs/workflows/remove-minimax-settings/planning.md

## next

- next: test_design
- input: requirements.md, planning.md
