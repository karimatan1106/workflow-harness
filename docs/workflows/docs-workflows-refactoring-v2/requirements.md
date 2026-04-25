# Requirements: docs-workflows-refactoring-v2

taskId: 5127ee0c-0fad-4088-a2bc-e7c590595738
date: 2026-03-28
userIntent: docs/workflows/ ディレクトリの追加リファクタリング。前回(ADR-010)で4カテゴリに分類済み。さらなる整理・改善を実施する。

## functionalRequirements

- REQ-F1: 重複ディレクトリ排除 - docs/workflows/ ルート直下の9件の重複空ディレクトリを削除する (source: scope-definition P1, priority: must)
- REQ-F2: カテゴリ側空ディレクトリ清掃 - investigation/feature 内の13件の冗長な空ディレクトリを削除する (source: research P1-cleanup, priority: must)
- REQ-F3: 未分類ディレクトリ分類 - ルート直下の7件の未分類サブディレクトリを適切なカテゴリ(feature: 1件, workflow-harness: 6件)に移動する (source: scope-definition P2, priority: must)
- REQ-F4: 散在mdファイル整理 - ルート直下の19件の.mdファイルを関連カテゴリ配下の新規ディレクトリに移動する (source: scope-definition P3, priority: must)
- REQ-F5: ディレクトリ構造正規化 - リファクタリング完了後、docs/workflows/ ルート直下にはカテゴリディレクトリ(bugfix/feature/investigation/workflow-harness)と自身のタスクディレクトリのみが存在する状態にする (source: ADR-010, priority: must)
- REQ-F6: データ整合性保証 - 移動操作によるファイル消失を防止し、移動前後の総ファイル数(1902件)が一致することを検証する (source: scope-definition AC-6, priority: must)

## nonFunctionalRequirements

- REQ-NF1: 履歴追跡性 - git mv を使用し、ファイル移動後も git log --follow で移動前の履歴が追跡可能であること (category: traceability)
- REQ-NF2: 操作安全性 - 全操作がドキュメントの移動または空ディレクトリ削除のみで構成され、ファイル内容の編集を行わないこと (category: safety)
- REQ-NF3: 冪等性 - 重複ディレクトリ削除は空であることを確認済みのため、再実行しても副作用がないこと (category: reliability)

## acceptanceCriteria

- AC-1: docs/workflows/ 直下に .md ファイルが存在しないこと (検証レベル: L1 - ファイルシステム確認)
- AC-2: docs/workflows/ 直下にカテゴリディレクトリ(bugfix/feature/investigation/workflow-harness)以外のタスクディレクトリが存在しないこと。自身の docs-workflows-refactoring-v2 は除く (検証レベル: L1 - ディレクトリ一覧確認)
- AC-3: 重複ディレクトリ9件(cli-test, concurrent-n58-0/1/2, integ-test-n58, list-test-n58, persist-test-n58, scope-test-n58, test-inv)のルート側が削除されていること (検証レベル: L1 - パス存在チェック)
- AC-4: 未分類サブディレクトリ7件が適切なカテゴリに移動されていること。agent-delegation-prompt-templates -> feature/, 残り6件 -> workflow-harness/ (検証レベル: L1 - 移動先パス存在チェック)
- AC-5: 散在 .md ファイル19件が適切なカテゴリ配下に移動されていること。18件 -> investigation/, 1件(refactoring.md) -> workflow-harness/ (検証レベル: L1 - 移動先ファイル存在チェック)
- AC-6: 移動によるファイル消失がないこと。移動前のベースライン1902ファイルに対し、移動後のファイル数が一致すること (検証レベル: L2 - ファイル数カウント比較)

## notInScope

- カテゴリディレクトリ内部(bugfix/feature/investigation/workflow-harness)の再構成・並び替え
- ファイル内容の編集・書き換え・フォーマット変更
- 新規カテゴリディレクトリの追加(4カテゴリ体制を維持)
- ハーネスソースコード(workflow-harness/)の変更
- docs/adr/ 配下のADRファイルの変更(イミュータブル)

## openQuestions

なし

## decisions

- REQ-01: 4カテゴリ体制(bugfix/feature/investigation/workflow-harness)を維持する。ADR-010で確立済みであり変更理由がないため。
- REQ-02: 重複ディレクトリはルート側を削除する。researchフェーズで全9件が空であることを確認済みのため、カテゴリ側を正として扱う。
- REQ-03: カテゴリ側の冗長な空ディレクトリ(13件)もP1と同時に削除する。空ディレクトリを残すと次回整理時に再対応が必要となるため。
- REQ-04: 未分類7件のカテゴリ割当はresearchフェーズで検証済みの分類に従う。agent-delegation-prompt-templates -> feature(1件), 残り6件 -> workflow-harness。
- REQ-05: 散在.mdファイルは関連性に基づきグループ化してディレクトリを作成する。同一調査の複数ファイル(5ペア10件)は共有ディレクトリに格納する。
- REQ-06: git mv による移動を採用し手動コピー+削除は行わない。git履歴の追跡性を維持するため(impact-analysis IA-03)。
- REQ-07: ファイル内容の編集は行わず移動のみとする。スコープ限定により副作用を防止する(scope-definition D-005)。

## RTM

- F-001: AC-1 散在mdファイル排除 (REQ-F4, REQ-F5)
- F-002: AC-2, AC-3, AC-4 ディレクトリ整理 (REQ-F1, REQ-F2, REQ-F3, REQ-F5)
- F-003: AC-5 mdファイルカテゴリ分類 (REQ-F4)
- F-004: AC-6 データ整合性 (REQ-F6)

## artifacts

- docs/workflows/docs-workflows-refactoring-v2/requirements.md: spec - 要件定義書(AC6件、RTM4件、機能要件6件、非機能要件3件)

## next

- criticalDecisions: REQ-01(4カテゴリ維持), REQ-06(git mv採用), REQ-07(内容編集なし)
- readFiles: docs/workflows/docs-workflows-refactoring-v2/requirements.md
- warnings: P1-cleanup(13件)はresearchで追加発見された項目。planningフェーズで操作順序に注意(子ディレクトリ削除を親より先に実行)。
