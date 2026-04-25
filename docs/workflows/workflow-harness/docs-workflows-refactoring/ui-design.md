# UI Design: docs-workflows-refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
phase: ui_design
date: 2026-03-24
inputArtifact: docs/workflows/docs-workflows-refactoring/planning.md

## summary

本タスクにUIコンポーネント(画面、ウィジェット、対話要素)は存在しない。対象はファイルシステム上のディレクトリ構造であり、人間とLLMが ls / glob / tree で探索する「ナビゲーション・インタフェース」としてのディレクトリレイアウトを設計する。

## currentState

docs/workflows/ 直下に266エントリ(251+ディレクトリ、14ルーズ.md、1 docs-workflows-refactoring自身)がフラットに配置されている。ls 出力は6画面分以上スクロールが必要で、目的のタスクを探すには grep が必須。LLMにとってもコンテキスト消費が大きく、全一覧を読み込むと約8,000トークンを消費する。

問題点:
- フラット構造のためカテゴリ的なフィルタリングが不可能
- 半角/全角カタカナの重複で同一タスクが2エントリ存在(24ペア)
- 旧プロジェクト(PDF/OCR/Remotion)のディレクトリが残存し、ノイズを生成
- ルーズ.mdファイルがディレクトリと混在し、ls出力の視認性を低下

## targetState

```
docs/workflows/
  bugfix/           (~77 task dirs)
  feature/          (~50 task dirs)
  workflow-harness/  (~60 task dirs)
  investigation/    (~21 entries: 7 dirs + 14 former loose .md dirs)
```

ls docs/workflows/ の出力は4行。各カテゴリに cd して ls すればカテゴリ内のタスク一覧を取得できる。LLMがカテゴリ一覧を読むコンテキストコストは約50トークンに削減される。

## decisions

- D-001: カテゴリ名は英語小文字ケバブケース(bugfix, feature, workflow-harness, investigation)とする。日本語カテゴリ名はシェル操作・スクリプト引数でのエスケープ問題を招くため不採用。
- D-002: 各カテゴリ内のディレクトリ名は変更しない。リネーム済みの全角カタカナ名を維持する。既存の成果物内パス参照(claude-progress.toon等)との整合性を保持するため。
- D-003: カテゴリディレクトリは4つに限定する。過度な細分化(chore, refactor, docs等の追加)を避け、4カテゴリの判断コストを最小化する。4択であればLLMが誤分類する確率も低い。
- D-004: docs-workflows-refactoringタスク自身はinvestigation/カテゴリに配置する。本タスクはコード変更を伴わないファイルシステム調査・整理作業であり、bugfix/feature/workflow-harnessのいずれにも該当しない。
- D-005: ナビゲーション改善の定量目標: ls docs/workflows/ の出力行数を266行から4行に削減する。カテゴリ単位のls出力は最大77行(bugfix/)であり、1画面に収まる。
- D-006: ルーズ.mdファイルはそれぞれ同名ディレクトリを作成しその中に移動する。investigation/配下のディレクトリとして統一形式にすることで、ls出力がディレクトリのみの一貫したリストになる。
- D-007: カテゴリディレクトリ以外のファイル・ディレクトリがdocs/workflows/直下に存在しないことを最終検証で確認する(AC-6)。今後の新規タスクがカテゴリ外に配置されることを防ぐガードレールとしても機能する。

## interactionModel

ユーザー(人間/LLM)の典型的な探索フロー:

1. `ls docs/workflows/` -> 4カテゴリを表示
2. `ls docs/workflows/bugfix/` -> バグ修正タスク一覧(~77件)
3. `ls docs/workflows/bugfix/BUG1-2-3根本原因修正/` -> タスク成果物一覧

LLMエージェントの探索パターン:
- カテゴリ名をglob: `docs/workflows/*/タスク名/` でカテゴリを跨いだ検索が可能
- 特定カテゴリ内のgrepが高速化: `grep -r "keyword" docs/workflows/bugfix/` でスコープ限定

## categoryClassificationCriteria

research.mdのSection 3で確定済みの分類基準:

| category | criteria | examples |
|----------|---------|----------|
| bugfix/ | BUG*, P0*, fix-*, 修正*, 根本原因* を名前に含む。既存機能の不具合修正。 | BUG1-2-3根本原因修正, P0修正時の成果物バリデーション失敗根本原因修正 |
| feature/ | 新機能追加、機能拡張。10M-*, concurrent-*, dci-*, template-* 等。 | dci-design-code-index, garbage-collection, HMAC互換性テスト |
| workflow-harness/ | ハーネス構造変更、3層E2E、ワークフロー全体改修。ワークフロー*, 3層*, adr-* 等。 | 3層E2Eスモークテスト, workflow-harness-refactoring, 新ワークフロー完全実装 |
| investigation/ | 調査、分析、一回限りの検証。ルーズ.mdから変換されたものを含む。 | toon-reference-audit, stale-toon-sweep, task-size-investigation |

## accessibilityConsiderations

- Windows環境(パス長260文字制限): カテゴリ追加による1階層増でパスが約20文字増加。最長タスク名「前回修正ワークフロー実行中に発生した問題の根本原因調査と修正」(約50文字)でも docs/workflows/workflow-harness/ を含めて合計約120文字。制限内に収まる。
- シェルエスケープ: カテゴリ名が英語ASCIIのためエスケープ不要。タスク名の日本語部分は既存と同じダブルクォート囲みで対応。

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/docs-workflows-refactoring/ui-design.md | spec | 本ファイル: ディレクトリレイアウト設計 |
| docs/workflows/docs-workflows-refactoring/planning.md | input | 実装計画(PL-01〜PL-06) |
| docs/workflows/docs-workflows-refactoring/research.md | reference | カテゴリ分類元データ |

## next

- implementation フェーズに進行
- PL-01〜PL-03 を並列Worker実行(削除/リネーム系)
- PL-04 完了後にPL-05(ルーズ.md整理)
- PL-06 で最終検証(ls docs/workflows/ 出力が4行であること)
