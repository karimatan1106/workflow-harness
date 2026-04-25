# Requirements: docs-workflows-refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
phase: requirements
date: 2026-03-24

## summary

docs/workflows/ ディレクトリのリファクタリング。半角カタカナ重複削除の解消、旧タスク削除による不要ファイルの一掃、カテゴリ別サブディレクトリ整理による再配置、散在mdファイルのディレクトリ化を行う。コード変更は不要。ハーネスは動的パス生成のため破壊的影響なし。

## decisions

- REQ-D01: 半角カタカナ重複24ペアは半角版を削除し全角版を正とする。削除前にdiffで内容同一性を検証し、差分がある場合は全角版にマージしてから削除する。
- REQ-D02: 半角のみディレクトリ45件はmvで全角カタカナにリネームする。Windowsパス長260文字制限とShellエスケープに留意する。
- REQ-D03: 旧プロジェクト関連33件（PDF/OCR 22件、Remotion/Pachinko 3件、その他無関係8件）は完全削除する。
- REQ-D04: カテゴリ分類はbugfix/(約77件)、feature/(約50件)、workflow-harness/(約60件)、investigation/(約7件+14ルーズ.md)の4分類とする。
- REQ-D05: ルーズ.mdファイル14件はそれぞれ個別タスクディレクトリを作成し、investigation/配下に配置する。
- REQ-D06: 実装は5段階に分割し、各段階でgit commitを行いロールバック粒度を確保する。
- REQ-D07: .gitignoreで既にdocs/workflows/全体がignoreされているため、git履歴への影響は発生しない。ローカルファイルシステムのみの操作となる。
- REQ-D08: 既存タスクの成果物内容は一切変更しない（移動のみ）。

## acceptanceCriteria

- AC-1: 全ての半角カタカナ重複ディレクトリペア（24件）で半角版が削除されていること
- AC-2: 半角のみディレクトリ（45件）が全角カタカナにリネームされていること
- AC-3: 旧プロジェクト関連ディレクトリ（33件）が全て削除されていること
- AC-4: 残存ディレクトリがカテゴリ別サブディレクトリ（bugfix/, feature/, workflow-harness/, investigation/）に配置されていること
- AC-5: ルート散在.mdファイル（14件）が個別タスクディレクトリ化されていること
- AC-6: docs/workflows/直下にタスクディレクトリが存在しないこと（カテゴリディレクトリのみ）
- AC-7: ハーネスの既存機能に影響がないこと（mcp-server/, hooks/, rules/のパス参照が正常動作すること）

## rtm

| AC | requirement | verification |
|----|------------|-------------|
| AC-1 | 半角重複24件削除 | L1: ls で半角カタカナディレクトリが存在しないことを確認 |
| AC-2 | 半角45件リネーム | L1: ls で全角カタカナ版が存在することを確認 |
| AC-3 | 旧プロジェクト33件削除 | L1: ls で対象ディレクトリが存在しないことを確認 |
| AC-4 | カテゴリ配置 | L1: ls docs/workflows/ でカテゴリディレクトリのみ表示されることを確認 |
| AC-5 | ルーズ.md 14件ディレクトリ化 | L1: ls で各.mdに対応するディレクトリがinvestigation/配下に存在 |
| AC-6 | 直下にタスクディレクトリなし | L1: ls docs/workflows/ の出力がbugfix/, feature/, workflow-harness/, investigation/のみ |
| AC-7 | ハーネス非影響 | L2: impact-analysis.mdの結論に基づきコード参照がすべて動的パス生成であることを確認済み |

## notInScope

- タスク成果物の内容変更（移動のみ、中身は変更しない）
- ハーネスコード（mcp-server/, hooks/）の修正
- 新しいワークフロータスクの作成
- docs/workflows/以外のディレクトリの変更
- カテゴリ分類基準の厳密なルール策定（本タスクは一回限りの整理作業）
- git履歴の書き換え（.gitignoreによりトラッキング対象外）

## openQuestions

なし

## artifacts

| path | role |
|------|------|
| docs/workflows/docs-workflows-refactoring/hearing.md | ヒアリング結果 |
| docs/workflows/docs-workflows-refactoring/research.md | 調査結果（重複ペア一覧、削除対象一覧、カテゴリ分類） |
| docs/workflows/docs-workflows-refactoring/scope-definition.md | スコープ定義 |
| docs/workflows/docs-workflows-refactoring/impact-analysis.md | 影響分析 |
| docs/workflows/docs-workflows-refactoring/requirements.md | 本ファイル: 要件定義 |

## next

- implementation フェーズに進行
- 5段階の実装ステップ:
  1. 半角カタカナ重複24件の削除（diff検証後）
  2. 半角のみ45件の全角リネーム
  3. 旧プロジェクト33件の完全削除
  4. カテゴリディレクトリ作成 + 残存ディレクトリの移動
  5. ルーズ.md 14件のディレクトリ化とinvestigation/配置
- 各ステップは独立したWorkerタスクとして並列実行可能（ステップ1-3は並列、4は1-3完了後、5は4と並列可）
