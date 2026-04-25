# Planning: docs-workflows-refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
phase: planning
date: 2026-03-24
inputArtifact: docs/workflows/docs-workflows-refactoring/requirements.md

## summary

docs/workflows/ ディレクトリの整理を6ステップで実施する。コード変更なし、bash操作のみ。各ステップはgit commitで区切りロールバック可能にする。脅威モデルT-01〜T-08の緩和策を各ステップに組み込む。

## architectureDecisions

- AD-1: 操作順序は「削除 -> リネーム -> カテゴリ移動 -> ルーズファイル整理 -> 検証」の順とする。削除を先行させることで移動対象件数を最小化し、パス長超過リスク(T-02)を低減する。
- AD-2: mv ではなく cp -r + diff検証 + rm -rf の3段階操作を採用する(T-04緩和)。特に半角/全角マージ時は内容差分の確認が必須であり、mv の原子性に依存すると差分検証の機会を失う。
- AD-3: 全パス引数はダブルクォートで囲む(T-03緩和)。日本語ディレクトリ名のシェルエスケープ問題を防止する。
- AD-4: ステップ1-3(削除/リネーム)は相互依存なしのため並列実行可能。ステップ4(カテゴリ移動)はステップ1-3完了後に実行(T-06緩和)。ステップ5(ルーズ.md)はステップ4完了後に実行。
- AD-5: 各ステップの実行前にpre-conditionチェックを行う。git check-ignore docs/workflows/ でgitignore状態確認(T-05)、パス長260文字チェック(T-02)を含む。

## implementationSteps

- PL-01: 半角カタカナ重複24ペアの削除 (AC-1, F-001)
  - 対象: research.md Section 1 に記載の24ペア
  - 手順: 各ペアについて diff -rq で内容比較。同一なら半角版を rm -rf。差分ありなら全角版にマージ後に削除。
  - dependsOn: 初期ステップ（並列実行可）
  - files: docs/workflows/ 配下の半角カタカナディレクトリ24件

- PL-02: 半角のみディレクトリ45件の全角リネーム (AC-2, F-002)
  - 対象: research.md Section 1 に記載の45件
  - 手順: 各ディレクトリについて cp -r "半角名" "全角名" + diff -rq で一致確認 + rm -rf "半角名"
  - dependsOn: 初期ステップ（PL-01と並列実行可）
  - files: docs/workflows/ 配下の半角のみカタカナディレクトリ45件

- PL-03: 旧プロジェクト33件の完全削除 (AC-3, F-003)
  - 対象: research.md Section 2 に記載のPDF/OCR 22件、Remotion/Pachinko 3件、その他無関係5件、Frontend/Dashboard 3件
  - 手順: rm -rf で各ディレクトリを削除。削除前にls で対象が正しいことを確認。
  - dependsOn: 初期ステップ（PL-01,PL-02と並列実行可）
  - files: docs/workflows/ 配下の旧プロジェクト関連33件

- PL-04: カテゴリディレクトリ作成と残存ディレクトリの移動 (AC-4, AC-6, F-004)
  - 対象: PL-01〜PL-03完了後の残存ディレクトリ(約194件)
  - 手順:
    1. mkdir -p docs/workflows/{bugfix,feature,workflow-harness,investigation}
    2. 各ディレクトリをresearch.md Section 3 の分類に従い mv で移動
    3. bugfix/: 約77件、feature/: 約50件、workflow-harness/: 約60件、investigation/: 約7件
  - dependsOn: PL-01, PL-02, PL-03
  - files: docs/workflows/ 配下の全残存ディレクトリ

- PL-05: ルーズ.mdファイル14件のディレクトリ化 (AC-5, F-005)
  - 対象: research.md Section 4 に記載の14件
  - 手順: 各.mdファイルについて
    1. ファイル名から拡張子を除去したディレクトリ名を生成
    2. 同名ディレクトリが存在しないことを確認(T-07)
    3. mkdir "docs/workflows/investigation/{dirname}"
    4. mv "{filename}.md" "docs/workflows/investigation/{dirname}/{filename}.md"
  - dependsOn: PL-04
  - files: docs/workflows/ 配下の14個の.mdファイル

- PL-06: 最終検証 (AC-7, F-006)
  - 手順:
    1. ls docs/workflows/ で直下にカテゴリディレクトリのみ存在することを確認
    2. 半角カタカナ文字を含むディレクトリが0件であることを確認
    3. vitest でハーネステストが全件パスすることを確認
  - dependsOn: PL-04, PL-05
  - files: なし(検証のみ)

## rtmEntries

| ID | requirement | AC | status |
|----|------------|-----|--------|
| F-001 | 半角カタカナ重複24件削除 | AC-1 | pending |
| F-002 | 半角のみ45件の全角リネーム | AC-2 | pending |
| F-003 | 旧プロジェクト33件削除 | AC-3 | pending |
| F-004 | カテゴリディレクトリ作成+残存ディレクトリ移動 | AC-4, AC-6 | pending |
| F-005 | ルーズ.md 14件のディレクトリ化 | AC-5 | pending |
| F-006 | ハーネス非影響検証 | AC-7 | pending |

## decisions

- PL-D1: 削除操作を移動操作より先に実行する。移動対象数を減らしカテゴリ分類の正確性を向上させるため。
- PL-D2: cp+verify+rm の3段階パターンをリネーム操作(PL-02)に適用する。mv の原子性がWindows+日本語パスで保証されないリスクを回避するため(T-04)。
- PL-D3: PL-01〜PL-03は並列Worker実行可能とする。各ステップが異なるディレクトリ群を対象とし操作が重複しないため(T-06)。
- PL-D4: カテゴリ分類リストはresearch.mdの分類結果を正として使用する。実装時に再分類判断を行わない。分類基準のブレを排除するため。
- PL-D5: PL-06の検証でvitest失敗が発生した場合、git revert で直前のcommitを戻し原因調査を行う。自動修正は行わない。
- PL-D6: 各ステップ完了時にgit commitを行い、ステップ単位でのロールバック粒度を確保する(REQ-D06に準拠)。

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/docs-workflows-refactoring/planning.md | spec | 本ファイル: 実装計画 |
| docs/workflows/docs-workflows-refactoring/requirements.md | spec | 要件定義(AC/RTM) |
| docs/workflows/docs-workflows-refactoring/research.md | reference | 重複ペア一覧、削除対象一覧、カテゴリ分類 |
| docs/workflows/docs-workflows-refactoring/threat-model.md | reference | 脅威モデル(T-01〜T-08) |

## next

- implementation フェーズに進行
- Worker分割: PL-01, PL-02, PL-03 を並列Workerとして起動(削除/リネーム系)
- PL-04 は PL-01〜PL-03 完了後に起動(カテゴリ移動)
- PL-05 は PL-04 完了後に起動(ルーズ.md整理)
- PL-06 は PL-05 完了後に起動(最終検証)
- 読むべきファイル: research.md(分類リスト), threat-model.md(緩和策), requirements.md(AC)
- 注意: Windows環境でのパス長260文字制限、日本語シェルエスケープに留意
